import { Router } from 'express';
import { MarkdownToJSON } from '../sync/markdownToJSON';
import { SyncManager } from '../sync/syncManager';
import { TaskService } from '../services/taskService';
import { WebSocketHandler } from '../websocket/server';

export function syncRoutes(wsServer: WebSocketHandler) {
  const router = Router();
  const markdownToJSON = new MarkdownToJSON();
  const taskService = new TaskService();
  const syncManager = new SyncManager(markdownToJSON, null as any, taskService);

  router.post('/from-md', async (req, res) => {
    try {
      const { projectId = 'openclaw-visualization' } = req.body;
      console.log('🔄 Syncing from Markdown to JSON for project:', projectId);
      
      const result = await syncManager.syncFromMarkdown(projectId);
      
      console.log(`✅ Saved ${result.tasks.length} tasks`);
      wsServer.broadcastTaskUpdate(projectId, null);
      
      res.json(result);
    } catch (error) {
      console.error('Error syncing from markdown:', error);
      res.status(500).json({ error: 'Failed to sync from markdown' });
    }
  });

  return router;
}
