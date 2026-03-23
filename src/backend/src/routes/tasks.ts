import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';
import { SubagentManager } from '../services/subagentManager';
import type { SubagentMonitorService } from '../services/subagentMonitor';
import type { Task } from '../types/tasks';
import { getProjectRoot, getSubagentRecordingPath, getTasksRoot } from '../config/paths';

export function taskRoutes(
  taskService: TaskService,
  wsServer: WebSocketHandler,
  subagentMonitorService: SubagentMonitorService
) {
  const router = Router();
  const projectSourceMapPath = path.join(getTasksRoot(), 'project-source-map.json');

  // 初始化SubagentManager
  const subagentManager = new SubagentManager(taskService);

  type ProjectSourceMapEntry = {
    projectRoot?: string;
    docsRoot?: string;
    taskJsonPath?: string;
    notes?: string;
  };

  const loadProjectSourceMap = (): Record<string, ProjectSourceMapEntry> => {
    if (!fs.existsSync(projectSourceMapPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(projectSourceMapPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const saveProjectSourceMap = (sourceMap: Record<string, ProjectSourceMapEntry>): void => {
    fs.writeFileSync(projectSourceMapPath, JSON.stringify(sourceMap, null, 2), 'utf-8');
  };

  const buildProjectSourceOfTruth = (projectId: string) => {
    const sourceMap = loadProjectSourceMap();
    const mapped = sourceMap[projectId] || {};

    const projectRoot = mapped.projectRoot || getProjectRoot(projectId);
    const docsRoot = mapped.docsRoot || path.join(projectRoot, 'docs');
    const taskJsonPath = mapped.taskJsonPath || taskService.getProjectTasksFilePath(projectId);

    return {
      projectId,
      apiSource: {
        mode: 'api-first',
        listProjects: '/api/tasks/projects',
        listTasks: `/api/tasks/projects/${projectId}/tasks`,
        createTask: `/api/tasks/projects/${projectId}/tasks`,
        updateTask: `/api/tasks/projects/${projectId}/tasks/:taskId`,
        updateSourceMapping: `/api/tasks/projects/${projectId}/source-of-truth`,
      },
      guidance: '如果 Agent 与看板不在同一文件系统，请只使用 apiSource，不要直接写本地文件路径。',
      serverLocalFileSource: {
        enabled: true,
        serverLocalOnly: true,
        taskJsonPath,
        projectRoot,
        docsRoot,
      },
      taskJsonPath,
      projectRoot,
      docsRoot,
      memoryRule: 'MEMORY.MD 只保存长期规则、项目索引和最新进度摘要',
      notes: mapped.notes || '',
      sourceMapPath: projectSourceMapPath,
    };
  };

  const validateProjectAccess = async (projectId: string) => {
    const project = await taskService.getProjectById(projectId);
    if (!project) {
      return {
        ok: false as const,
        status: 404,
        body: { error: `Project "${projectId}" not found` },
      };
    }

    const validation = taskService.validateProjectTasksFile(projectId);
    if (!validation.valid) {
      return {
        ok: false as const,
        status: 500,
        body: {
          error: `Task data for project "${projectId}" is unavailable`,
          details: validation.error,
          line: validation.line,
          column: validation.column,
        },
      };
    }

    return { ok: true as const };
  };

  const enrichTasks = async (projectId: string, tasks: Task[]): Promise<Task[]> => {
    const executions = await subagentMonitorService.getActiveExecutions();
    return tasks.map((task) => {
      const execution = executions.get(`${projectId}:${task.id}`);
      return {
        ...task,
        activeExecutorId: execution?.subagentId || null,
        activeExecutorLabel: execution?.label || null,
        activeExecutorLastUpdate: execution?.lastUpdateTimestamp || null,
      };
    });
  };

  const enrichTask = async (projectId: string, task: Task): Promise<Task> => {
    const [enrichedTask] = await enrichTasks(projectId, [task]);
    return enrichedTask;
  };

  // 获取所有项目
  router.get('/projects', async (req, res) => {
    try {
      const projects = await taskService.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // 获取项目真源路径（给 Agent/自动化系统使用）
  router.get('/projects/:id/source-of-truth', async (req, res) => {
    try {
      const { id } = req.params;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }
      res.json(buildProjectSourceOfTruth(id));
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to load source-of-truth paths', details });
    }
  });

  // 全局真源信息（用于 Agent 启动时定位规则，不依赖本地目录）
  router.get('/source-of-truth', async (_req, res) => {
    try {
      res.json({
        mode: 'api-first',
        guidance: '外部 Agent 默认通过 API 读写任务；tasks/*.json 属于看板服务端内部真源。',
        api: {
          listProjects: '/api/tasks/projects',
          projectSourceOfTruth: '/api/tasks/projects/:projectId/source-of-truth',
          createProject: '/api/tasks/projects',
          createTask: '/api/tasks/projects/:projectId/tasks',
          updateTask: '/api/tasks/projects/:projectId/tasks/:taskId',
        },
        serverLocalFileSource: {
          enabled: true,
          serverLocalOnly: true,
          tasksRoot: getTasksRoot(),
          mappingFile: projectSourceMapPath,
        },
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to load global source-of-truth', details });
    }
  });

  // 更新项目真源路径映射（绝对路径优先）
  router.put('/projects/:id/source-of-truth', async (req, res) => {
    try {
      const { id } = req.params;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }

      const { projectRoot, docsRoot, taskJsonPath, notes } = req.body || {};
      const hasAnyField = [projectRoot, docsRoot, taskJsonPath, notes].some(
        (value) => typeof value === 'string' && value.trim().length > 0
      );
      if (!hasAnyField) {
        return res.status(400).json({
          error: 'At least one field is required: projectRoot, docsRoot, taskJsonPath, notes',
        });
      }

      const sourceMap = loadProjectSourceMap();
      const current = sourceMap[id] || {};
      sourceMap[id] = {
        ...current,
        ...(typeof projectRoot === 'string' ? { projectRoot: projectRoot.trim() } : {}),
        ...(typeof docsRoot === 'string' ? { docsRoot: docsRoot.trim() } : {}),
        ...(typeof taskJsonPath === 'string' ? { taskJsonPath: taskJsonPath.trim() } : {}),
        ...(typeof notes === 'string' ? { notes: notes.trim() } : {}),
      };
      saveProjectSourceMap(sourceMap);

      res.json({
        success: true,
        sourceOfTruth: buildProjectSourceOfTruth(id),
      });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to update source-of-truth paths', details });
    }
  });

  // 创建项目，并自动生成对应任务文件
  router.post('/projects', async (req, res) => {
    try {
      const { id, name, description, color, icon, taskPrefix, leadAgent, status } = req.body || {};

      if (!id || !name) {
        return res.status(400).json({ error: 'Project id and name are required' });
      }

      const project = await taskService.createProject({
        id,
        name,
        description,
        color,
        icon,
        taskPrefix,
        leadAgent,
        status,
      });

      res.status(201).json(project);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes('already exists') ? 409 : 500;
      res.status(status).json({ error: 'Failed to create project', details: message });
    }
  });

  router.put('/projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};
      const project = await taskService.updateProject(id, updates);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to update project', details: message });
    }
  });

  // 获取指定项目的所有任务
  router.get('/projects/:id/tasks', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, priority, assignee } = req.query;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }
      let tasks = await taskService.getTasksByProject(id);
      
      // 按状态过滤
      if (status) {
        tasks = tasks.filter(t => t.status === status);
      }
      
      // 按优先级过滤
      if (priority) {
        tasks = tasks.filter(t => t.priority === priority);
      }
      
      // 按负责人过滤
      if (assignee) {
        tasks = tasks.filter(t => t.assignee === assignee);
      }
      
      res.json(await enrichTasks(id, tasks));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // 创建单个任务
  // JSON-first: 直接写入 JSON 文件
  router.post('/projects/:id/tasks', async (req, res) => {
    try {
      const { id } = req.params;
      const task = req.body;

      // JSON-first: 所有项目都支持直接创建 JSON 任务
      const newTask = await taskService.createTask(id, task);
      const enrichedTask = await enrichTask(id, newTask);
      
      // 广播任务创建
      wsServer.broadcastTaskUpdate(id, enrichedTask);
      
      res.json(enrichedTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // 批量创建任务
  router.post('/projects/:id/tasks/batch', async (req, res) => {
    try {
      const { id } = req.params;
      const { tasks } = req.body;
      
      if (!Array.isArray(tasks)) {
        return res.status(400).json({ error: 'tasks must be an array' });
      }
      
      const createdTasks = [];
      for (const task of tasks) {
        const newTask = await taskService.createTask(id, task);
        createdTasks.push(newTask);
      }
      
      res.json({
        success: true,
        count: createdTasks.length,
        tasks: createdTasks
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create tasks' });
    }
  });

  // 获取单个任务
  router.get('/projects/:id/tasks/:taskId', async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }
      const tasks = await taskService.getTasksByProject(id);
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      res.json(await enrichTask(id, task));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // 更新任务
  router.put('/projects/:id/tasks/:taskId', async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const updates = req.body;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }
      const task = await taskService.updateTask(id, taskId, updates);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // 广播任务更新
      const enrichedTask = await enrichTask(id, task);
      wsServer.broadcastTaskUpdate(id, enrichedTask);
      res.json(enrichedTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // 批量更新任务状态
  router.put('/projects/:id/tasks/batch', async (req, res) => {
    try {
      const { id } = req.params;
      const { taskIds, status } = req.body;
      
      if (!Array.isArray(taskIds)) {
        return res.status(400).json({ error: 'taskIds must be an array' });
      }
      
      const updatedTasks = [];
      for (const taskId of taskIds) {
        const task = await taskService.updateTask(id, taskId, { status });
        if (task) {
          updatedTasks.push(task);
        }
      }
      
      res.json({
        success: true,
        count: updatedTasks.length,
        tasks: updatedTasks
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update tasks' });
    }
  });

  // ========================================
  // JSON-first: 删除任务（仅 todo 状态）
  // ========================================
  router.delete('/projects/:id/tasks/:taskId', async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }
      
      const result = await taskService.deleteTask(id, taskId);
      
      if (!result.success) {
        // 任务不存在或状态不允许删除
        if (result.error?.includes('not found')) {
          return res.status(404).json({ 
            success: false, 
            error: result.error 
          });
        }
        // 状态不允许删除
        return res.status(400).json({ 
          success: false, 
          error: result.error,
          hint: 'Only tasks with status "todo" can be deleted. In-progress or done tasks cannot be removed.'
        });
      }
      
      // 广播任务删除事件
      wsServer.broadcastTaskUpdate(id, { ...result.task, deleted: true });
      
      res.json({
        success: true,
        task: result.task,
        message: `Task ${taskId} deleted successfully`
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete task',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 手动归档已完成任务（仅归档 done，其他状态保持不变）
  router.post('/projects/:id/tasks/archive-completed', async (req, res) => {
    try {
      const { id } = req.params;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }

      const result = await taskService.archiveCompletedTasks(id);

      for (const task of result.archivedTasks) {
        wsServer.broadcastTaskUpdate(id, { ...task, deleted: true });
      }

      res.json({
        success: true,
        archivedCount: result.archivedCount,
        remainingCount: result.remainingCount,
        archiveFilePath: result.archiveFilePath,
        message:
          result.archivedCount > 0
            ? `Archived ${result.archivedCount} completed task(s).`
            : 'No completed tasks to archive.',
      });
    } catch (error) {
      console.error('Failed to archive completed tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to archive completed tasks',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // 查询项目进度
  router.get('/projects/:id/progress', async (req, res) => {
    try {
      const { id } = req.params;
      const validation = await validateProjectAccess(id);
      if (!validation.ok) {
        return res.status(validation.status).json(validation.body);
      }
      const tasks = await taskService.getTasksByProject(id);
      const project = await taskService.getProjectById(id);

      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'done').length;
      const inProgress = tasks.filter(t => t.status === 'in-progress').length;
      const review = tasks.filter(t => t.status === 'review').length;
      const todo = tasks.filter(t => t.status === 'todo').length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      res.json({
        projectId: id,
        projectName: project?.name || '',
        total,
        completed,
        inProgress,
        review,
        todo,
        progress,
        taskCountByStatus: {
          done: completed,
          'in-progress': inProgress,
          review,
          todo: todo,
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get project progress' });
    }
  });

  // 创建Subagent并自动更新任务状态
  router.post('/subagent/create', async (req, res) => {
    try {
      const { projectId, taskId, taskTitle, taskDescription, subagentType } = req.body;

      if (!projectId || !taskId || !taskTitle || !taskDescription) {
        return res.status(400).json({
          error: 'Missing required fields: projectId, taskId, taskTitle, taskDescription'
        });
      }

      const subagentId = await subagentManager.createSubagent({
        projectId,
        taskId,
        taskTitle,
        taskDescription,
        subagentType
      });

      // 获取更新后的任务
      const task = await taskService.getTasksByProject(projectId)
        .then(tasks => tasks.find(t => t.id === taskId));

      // 广播任务更新
      if (task) {
        wsServer.broadcastTaskUpdate(projectId, await enrichTask(projectId, task));
      }

      res.json({
        success: true,
        subagentId,
        task,
        message: 'Subagent created and task status updated to in-progress'
      });
    } catch (error) {
      console.error('Failed to create subagent:', error);
      res.status(500).json({
        error: 'Failed to create subagent',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 标记Subagent完成并更新任务状态
  router.post('/subagent/complete', async (req, res) => {
    try {
      const { subagentId, success, output, error } = req.body;

      if (!subagentId) {
        return res.status(400).json({
          error: 'Missing required field: subagentId'
        });
      }

      // 查找任务ID - 使用更灵活的正则表达式
      const recordingPath = getSubagentRecordingPath();
      const content = fs.readFileSync(recordingPath, 'utf-8');
      // 支持多种任务ID格式：VIS-xxx, INT-xxx, EXA-xxx, TASK-xxx, TASK-TEST-xxx, TEST-xxx 等
      const match = content.match(new RegExp(`Subagent ID.*\`${subagentId}\`.*任务:\\s*([A-Z][A-Z0-9-]+)`, 's'));
      const taskId = match ? match[1] : null;

      await subagentManager.markSubagentComplete(subagentId, {
        success: success ?? false,
        output: output || '',
        error,
        completedAt: new Date().toISOString()
      });

      // 获取更新后的任务
      let task = null;
      if (taskId) {
        const projects = await taskService.getAllProjects();
        for (const project of projects) {
          task = await taskService.getTasksByProject(project.id)
            .then(tasks => tasks.find(t => t.id === taskId));
          if (task) {
            wsServer.broadcastTaskUpdate(project.id, await enrichTask(project.id, task));
            break;
          }
        }
      }

      res.json({
        success: true,
        task,
        message: 'Subagent marked as complete and task status updated to review'
      });
    } catch (error) {
      console.error('Failed to mark subagent complete:', error);
      res.status(500).json({
        error: 'Failed to mark subagent complete',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
