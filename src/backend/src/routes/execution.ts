import { Router } from 'express';
import { ProjectExecutionService } from '../execution/projectExecutionService';

export function executionRoutes(projectExecutionService: ProjectExecutionService) {
  const router = Router();

  router.post('/projects/:id/preview', async (req, res) => {
    try {
      const { id } = req.params;
      const { forceAutoDispatch = false } = req.body || {};
      const result = await projectExecutionService.previewProject(id, Boolean(forceAutoDispatch));
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to preview project execution',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/projects/:id/guide', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await projectExecutionService.getProjectExecutionGuide(id);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to build project execution guide',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/projects/:id/tasks/:taskId/context', async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const result = await projectExecutionService.getTaskExecutionContext(id, taskId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to build task execution context',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/projects/:id/dispatch-once', async (req, res) => {
    try {
      const { id } = req.params;
      const { forceAutoDispatch = false } = req.body || {};
      const result = await projectExecutionService.dispatchOnce(id, Boolean(forceAutoDispatch));
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to dispatch project task',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post('/projects/:id/tasks/:taskId/dispatch', async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const { forceAutoDispatch = false } = req.body || {};
      const result = await projectExecutionService.dispatchTaskById(id, taskId, Boolean(forceAutoDispatch));
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to dispatch specific task',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
