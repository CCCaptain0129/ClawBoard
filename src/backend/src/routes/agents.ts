import { Router } from 'express';
import { AgentService } from '../services/agentService';

export function agentRoutes(agentService: AgentService) {
  const router = Router();

  router.get('/', async (req, res) => {
    const agents = await agentService.getAllAgents();
    res.json(agents);
  });

  router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const agent = await agentService.getAgentById(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  });

  return router;
}
