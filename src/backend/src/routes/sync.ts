import { Router } from 'express';
import { TaskService } from '../services/taskService';
import { SyncManager } from '../sync/syncManager';
import { MarkdownToJSON } from '../sync/markdownToJSON';
import { JSONToMarkdown } from '../sync/jsonToMarkdown';
import { WebSocketHandler } from '../websocket/server';

export function syncRoutes(
  taskService: TaskService,
  wsServer: WebSocketHandler
) {
  const router = Router();
  
  const markdownToJSON = new MarkdownToJSON();
  const jsonToMarkdown = new JSONToMarkdown();
  const syncManager = new SyncManager(markdownToJSON, jsonToMarkdown, taskService);

  // 从 Markdown 同步到 JSON
  router.post('/from-markdown/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const result = await syncManager.syncFromMarkdown(projectId);
      
      // 广播同步完成事件
      wsServer.broadcast({
        type: 'SYNC_COMPLETED',
        projectId,
        taskCount: result.tasks.length,
      });
      
      res.json({
        success: true,
        project: result.project,
        taskCount: result.tasks.length,
      });
    } catch (error) {
      console.error('Sync from markdown error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to sync from markdown' 
      });
    }
  });

  // 从 JSON 同步到 Markdown
  router.post('/to-markdown/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      await syncManager.syncToMarkdown(projectId);
      
      const tasks = await taskService.getTasksByProject(projectId);
      
      wsServer.broadcast({
        type: 'SYNC_COMPLETED',
        projectId,
        taskCount: tasks.length,
      });
      
      res.json({
        success: true,
        taskCount: tasks.length,
      });
    } catch (error) {
      console.error('Sync to markdown error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to sync to markdown' 
      });
    }
  });

  // 双向同步
  router.post('/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      await syncManager.sync(projectId);
      
      const tasks = await taskService.getTasksByProject(projectId);
      
      wsServer.broadcast({
        type: 'SYNC_COMPLETED',
        projectId,
        taskCount: tasks.length,
      });
      
      res.json({
        success: true,
        taskCount: tasks.length,
      });
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to sync' 
      });
    }
  });

  return router;
}