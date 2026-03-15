import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { validateJSONFile } from '../middleware/jsonValidator';
import { getTasksRoot } from '../config/paths';

const router = express.Router();
const tasksPath = getTasksRoot();

/**
 * GET /api/tasks/health
 * 健康检查端点，返回所有项目的健康状态
 */
router.get('/health', (req, res) => {
  try {
    const projectFiles = fs.readdirSync(tasksPath)
      .filter(file => file.endsWith('-tasks.json'))
      .sort();

    const projects = projectFiles.map(file => {
      const projectId = file.replace('-tasks.json', '');
      const filePath = path.join(tasksPath, file);
      const validation = validateJSONFile(filePath);

      let projectInfo = {
        id: projectId,
        name: projectId, // 可以从 project.json 获取更友好的名称
        status: validation.valid ? 'ok' : 'error',
        taskCount: validation.valid ? getTaskCount(filePath) : 0,
        valid: validation.valid,
        error: validation.error || null
      };

      return projectInfo;
    });

    // 统计
    const errorCount = projects.filter(p => p.status === 'error').length;
    const totalTasks = projects.reduce((sum, p) => sum + p.taskCount, 0);

    const response = {
      status: errorCount === 0 ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      summary: {
        totalProjects: projects.length,
        totalTasks: totalTasks,
        validProjects: projects.filter(p => p.status === 'ok').length,
        errorProjects: errorCount
      },
      projects: projects
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

function getTaskCount(filePath: string): number {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.tasks ? data.tasks.length : 0;
  } catch {
    return 0;
  }
}

export default router;
