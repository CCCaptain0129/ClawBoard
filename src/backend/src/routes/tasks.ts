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
      const tasks = await taskService.getTasksByProject(id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // 更新任务状态
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

  return router;
}