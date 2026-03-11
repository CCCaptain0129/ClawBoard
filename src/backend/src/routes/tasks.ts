import { Router } from 'express';
import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';

export function taskRoutes(taskService: TaskService, wsServer: WebSocketHandler) {
  const router = Router();

  // 获取所有项目
  router.get('/projects', async (req, res) => {
    try {
      const projects = await taskService.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // 获取指定项目的所有任务
  router.get('/projects/:id/tasks', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, priority, assignee } = req.query;
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
      
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // 创建单个任务
  router.post('/projects/:id/tasks', async (req, res) => {
    try {
      const { id } = req.params;
      const task = req.body;
      const newTask = await taskService.createTask(id, task);
      res.json(newTask);
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
      const tasks = await taskService.getTasksByProject(id);
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // 更新任务
  router.put('/projects/:id/tasks/:taskId', async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const updates = req.body;
      const task = await taskService.updateTask(id, taskId, updates);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // 广播任务更新
      wsServer.broadcastTaskUpdate(id, task);
      res.json(task);
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

  // 查询项目进度
  router.get('/projects/:id/progress', async (req, res) => {
    try {
      const { id } = req.params;
      const tasks = await taskService.getTasksByProject(id);
      const project = await taskService.getProjectById(id);
      
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'done').length;
      const inProgress = tasks.filter(t => t.status === 'in-progress').length;
      const todo = tasks.filter(t => t.status === 'todo').length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      res.json({
        projectId: id,
        projectName: project?.name || '',
        total,
        completed,
        inProgress,
        todo,
        progress,
        taskCountByStatus: {
          done: completed,
          'in-progress': inProgress,
          todo: todo,
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get project progress' });
    }
  });

  return router;
}