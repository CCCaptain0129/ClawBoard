import { Router } from 'express';
import { DispatcherControlService } from '../services/dispatcherControlService';

export function dispatcherRoutes(dispatcherControlService: DispatcherControlService) {
  const router = Router();

  router.get('/status', (_req, res) => {
    try {
      res.json(dispatcherControlService.getStatus());
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to get dispatcher status', details });
    }
  });

  router.get('/prerequisites', async (_req, res) => {
    try {
      const prerequisites = await dispatcherControlService.getPrerequisites();
      res.json(prerequisites);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to get dispatcher prerequisites', details });
    }
  });

  router.post('/mode', async (req, res) => {
    try {
      const { mode, intervalMs } = req.body || {};
      if (mode !== 'manual' && mode !== 'auto') {
        return res.status(400).json({ error: 'mode must be "manual" or "auto"' });
      }

      const status = await dispatcherControlService.setMode(mode, intervalMs);
      res.json({ success: true, status });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to set dispatcher mode', details });
    }
  });

  router.post('/projects/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { enabled } = req.body || {};
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be boolean' });
      }

      const status = await dispatcherControlService.setProjectEnabled(projectId, enabled);
      res.json({ success: true, status });
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Failed to update project dispatcher status', details });
    }
  });

  return router;
}
