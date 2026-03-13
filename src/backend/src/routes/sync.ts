import { Router } from 'express';
import { TaskService } from '../services/taskService';
import { SyncManager } from '../sync/syncManager';
import { MarkdownToJSON } from '../sync/markdownToJSON';
import { JSONToMarkdown } from '../sync/jsonToMarkdown';
import { WebSocketHandler } from '../websocket/server';
import { ProgressToDocService } from '../services/progressToDocService';
import { SafeSyncService, ProjectDocConfig } from '../services/safeSyncService';

export function syncRoutes(
  taskService: TaskService,
  wsServer: WebSocketHandler,
  safeSyncService?: SafeSyncService
) {
  const router = Router();
  
  const markdownToJSON = new MarkdownToJSON();
  const jsonToMarkdown = new JSONToMarkdown();
  const syncManager = new SyncManager(markdownToJSON, jsonToMarkdown, taskService);
  const progressToDocService = new ProgressToDocService(taskService);
  
  // 如果未提供 safeSyncService，创建默认实例
  const safeSync = safeSyncService || new SafeSyncService(taskService);

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

  // PMW-023 Phase 1: 将看板(JSON)进度回写到 04-进度跟踪.md
  // 仅回写进度统计，不修改任务的 status/claimedBy 运行态信息
  router.post('/progress-to-doc/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { docPath } = req.body;
      
      const result = await progressToDocService.syncProgressToDoc(projectId, docPath);
      
      // 广播进度更新事件
      wsServer.broadcast({
        type: 'PROGRESS_SYNCED',
        projectId,
        progress: result.progress,
        updatedSections: result.updatedSections,
      });
      
      res.json({
        success: true,
        projectId,
        progress: result.progress,
        updatedSections: result.updatedSections,
        message: result.message,
      });
    } catch (error) {
      console.error('Progress to doc sync error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to sync progress to doc',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ========================================
  // PMW-023 Phase 2: 安全同步 API
  // ========================================

  /**
   * 安全同步：从 03-任务分解.md 同步到看板 JSON
   * 保护运行态字段（in-progress/done 的 status/claimedBy 不被覆盖）
   * 
   * POST /api/sync/safe/from-doc/:projectId
   */
  router.post('/safe/from-doc/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      
      console.log(`📝 Safe sync triggered for project: ${projectId}`);
      const result = await safeSync.safeSyncFromMarkdown(projectId);
      
      if (result.success) {
        // 广播安全同步完成事件
        wsServer.broadcast({
          type: 'SAFE_SYNC_COMPLETED',
          projectId,
          taskCount: result.tasks.length,
          protectedCount: result.protectedCount,
          updatedCount: result.updatedCount,
          timestamp: new Date().toISOString(),
        });
        
        res.json({
          success: true,
          projectId,
          taskCount: result.tasks.length,
          protectedCount: result.protectedCount,
          updatedCount: result.updatedCount,
          message: `Synced ${result.tasks.length} tasks, protected ${result.protectedCount} runtime fields`,
        });
      } else {
        res.status(500).json({
          success: false,
          projectId,
          error: result.error,
        });
      }
    } catch (error) {
      console.error('Safe sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform safe sync',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * 配置项目文档路径
   * POST /api/sync/safe/config
   * 
   * Body: {
   *   projectId: string;
   *   projectPath: string;
   *   taskDoc: string;
   *   progressDoc?: string;
   * }
   */
  router.post('/safe/config', async (req, res) => {
    try {
      const config: ProjectDocConfig = req.body;
      
      if (!config.projectId || !config.projectPath || !config.taskDoc) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: projectId, projectPath, taskDoc',
        });
        return;
      }
      
      safeSync.setProjectConfig(config);
      
      res.json({
        success: true,
        message: `Project config updated for ${config.projectId}`,
        config,
      });
    } catch (error) {
      console.error('Config update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update config',
      });
    }
  });

  /**
   * 获取已配置的项目列表
   * GET /api/sync/safe/configured-projects
   */
  router.get('/safe/configured-projects', async (req, res) => {
    try {
      const projects = safeSync.getConfiguredProjects();
      
      res.json({
        success: true,
        projects,
        count: projects.length,
      });
    } catch (error) {
      console.error('Get configured projects error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get configured projects',
      });
    }
  });

  return router;
}