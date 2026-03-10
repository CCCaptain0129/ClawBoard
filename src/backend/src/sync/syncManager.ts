import { MarkdownToJSON } from './markdownToJSON';
import { JSONToMarkdown } from './jsonToMarkdown';
import { TaskService } from '../services/taskService';
import * as fs from 'fs';
import * as path from 'path';

export class SyncManager {
  constructor(
    private markdownToJSON: MarkdownToJSON,
    private jsonToMarkdown: JSONToMarkdown,
    private taskService: TaskService
  ) {}

  async syncFromMarkdown(projectId: string) {
    const { project, tasks } = await this.markdownToJSON.parse(projectId);
    
    const tasksDir = path.join(process.cwd(), '../../tasks');
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    
    const filePath = path.join(tasksDir, `${projectId}-tasks.json`);
    fs.writeFileSync(filePath, JSON.stringify({ ...project, tasks }, null, 2));
    
    return { project, tasks };
  }

  async syncToMarkdown(projectId: string) {
    const tasks = await this.taskService.getTasksByProject(projectId);
    const markdown = await this.jsonToMarkdown.generate(projectId, tasks);
    
    const tasksMdPath = path.join(process.cwd(), '../../TASKS.md');
    fs.writeFileSync(tasksMdPath, markdown);
  }
}
