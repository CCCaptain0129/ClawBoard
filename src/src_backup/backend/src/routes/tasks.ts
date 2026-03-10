import { Router } from 'express';
import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';

export function taskRoutes(taskService: TaskService, wsServer: WebSocketHandler) {
  const router = Router();

  router.get('/projects', async (req, res) => {
    const projects = await taskService.getAllProjects();
    res.json(projects);
  });

  router.get('/projects/:id/tasks', async (req, res) => {
    const { id } = req.params;
    const tasks = await taskService.getTasksByProject(id);
    res.json(tasks);
  });

  router.put('/projects/:id/tasks/:taskId', async (req, res) => {
    const { id, taskId } = req.params;
    const updates = req.body;
    const task = await taskService.updateTask(id, taskId, updates);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    wsServer.broadcastTaskUpdate(id, task);
    res.json(task);
  });

  return router;
}
