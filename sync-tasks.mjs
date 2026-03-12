#!/usr/bin/env node

/**
 * 同步任务脚本
 * 从 TASKS.md 文件读取任务状态，并通过 API 更新到看板
 */

import fs from 'fs';
import path from 'path';
import http from 'http';

/**
 * 解析 TASKS.md 文件，提取任务信息
 */
function parseTasksMarkdown(filePath, taskPrefix) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const tasks = [];

  let currentStage = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测阶段标题
    const stageMatch = line.match(/^##+\s+(.+)$/);
    if (stageMatch && !stageMatch[1].includes('统计') && !stageMatch[1].includes('任务列表')) {
      currentStage = stageMatch[1].trim();
    }

    // 检测任务条目 - 格式：**TASK-ID** P1 `label1` `label2`
    const taskMatch = line.match(/^-\s+\*\*([A-Z0-9-]+)\*\*\s+(.*)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      const meta = taskMatch[2] || '';

      // 解析优先级
      let priority = 'P2';
      if (meta.includes('P1')) priority = 'P1';
      else if (meta.includes('P3')) priority = 'P3';

      // 解析标签
      const labels = [];
      const labelMatches = meta.matchAll(/`([^`]+)`/g);
      for (const match of labelMatches) {
        const label = match[1];
        if (label && !label.match(/^P\d+$/)) {
          labels.push(label);
        }
      }

      // 解析状态和描述
      let status = 'todo';
      let description = '';
      let assignee = null;

      // 检查接下来的几行
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j].trim();

        if (!nextLine || nextLine.startsWith('#') || (nextLine.startsWith('- **') && !nextLine.includes('状态:'))) {
          break;
        }

        const statusMatch = nextLine.match(/^-\s*状态:\s*(.+)$/);
        if (statusMatch) {
          const statusText = statusMatch[1].trim();
          if (statusText === '已完成' || statusText === 'done') status = 'done';
          else if (statusText === '进行中' || statusText === 'in-progress') status = 'in-progress';
          else status = 'todo';
        }

        const descMatch = nextLine.match(/^-\s*描述:\s*(.+)$/);
        if (descMatch) {
          description = descMatch[1].trim();
        }

        const assigneeMatch = nextLine.match(/^-\s*(负责人|领取者):\s*(.+)$/);
        if (assigneeMatch) {
          const assigneeText = assigneeMatch[2].trim();
          if (!assigneeText.match(/^[a-f0-9-]{36}$/i)) {
            assignee = assigneeText.startsWith('@') ? assigneeText : assigneeText;
          }
        }
      }

      // 添加阶段标签
      if (currentStage && !labels.includes(currentStage)) {
        labels.unshift(currentStage);
      }

      tasks.push({
        id: taskId,
        title: description || taskId,
        description,
        status,
        priority,
        labels,
        assignee
      });
    }
  }

  return tasks;
}

/**
 * 调用 API 获取项目的当前任务
 */
function getProjectTasks(projectId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/projects/${projectId}/tasks`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * 调用 API 更新任务状态
 */
function updateTaskStatus(projectId, taskId, status) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ status });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/tasks/projects/${projectId}/tasks/${taskId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('🔄 开始同步任务到看板...\n');

  // 读取项目列表
  const projectsPath = path.join(process.cwd(), 'tasks/projects.json');
  const projectsData = fs.readFileSync(projectsPath, 'utf-8');
  const projects = JSON.parse(projectsData);

  const results = {
    success: true,
    projects: [],
    totalTasks: 0,
    updatedTasks: 0,
    conflicts: 0,
    errors: []
  };

  // 处理每个项目
  for (const project of projects) {
    console.log(`\n📋 处理项目: ${project.name} (${project.id})`);
    console.log(`   前缀: ${project.taskPrefix}`);

    try {
      // 解析 TASKS.md
      const tasksMdPath = path.join(process.cwd(), `tasks/${project.id}-TASKS.md`);

      if (!fs.existsSync(tasksMdPath)) {
        console.log(`   ⚠️  TASKS.md 文件不存在，跳过`);
        results.projects.push({
          projectId: project.id,
          projectName: project.name,
          status: 'skipped',
          reason: 'TASKS.md not found'
        });
        continue;
      }

      const markdownTasks = parseTasksMarkdown(tasksMdPath, project.taskPrefix);
      console.log(`   📄 从 TASKS.md 解析了 ${markdownTasks.length} 个任务`);

      // 获取看板中的任务
      const apiTasks = await getProjectTasks(project.id);
      console.log(`   📊 从 API 获取了 ${apiTasks.length} 个任务`);

      // 创建任务映射
      const apiTaskMap = new Map(apiTasks.map(t => [t.id, t]));

      let projectUpdatedCount = 0;
      let projectConflictCount = 0;
      const updatedTaskList = [];

      // 比较并更新
      for (const mdTask of markdownTasks) {
        const apiTask = apiTaskMap.get(mdTask.id);

        if (!apiTask) {
          console.log(`      ℹ️  任务 ${mdTask.id} 不存在于看板中，跳过`);
          continue;
        }

        // 检查状态是否不同
        if (apiTask.status !== mdTask.status) {
          console.log(`      🔄 更新 ${mdTask.id}: ${apiTask.status} → ${mdTask.status}`);

          try {
            await updateTaskStatus(project.id, mdTask.id, mdTask.status);
            projectUpdatedCount++;
            updatedTaskList.push(`${mdTask.id} (${apiTask.status} → ${mdTask.status})`);
          } catch (error) {
            console.error(`      ❌ 更新失败 ${mdTask.id}:`, error);
            results.errors.push({
              projectId: project.id,
              taskId: mdTask.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      results.totalTasks += markdownTasks.length;
      results.updatedTasks += projectUpdatedCount;
      results.conflicts += projectConflictCount;

      results.projects.push({
        projectId: project.id,
        projectName: project.name,
        status: 'success',
        taskCount: markdownTasks.length,
        updatedCount: projectUpdatedCount,
        conflictCount: projectConflictCount,
        updatedTasks: updatedTaskList
      });

      console.log(`   ✅ 项目处理完成: 更新了 ${projectUpdatedCount} 个任务`);

    } catch (error) {
      console.error(`   ❌ 项目处理失败:`, error);
      results.projects.push({
        projectId: project.id,
        projectName: project.name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
      results.errors.push({
        projectId: project.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 输出结果报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 同步结果报告');
  console.log('='.repeat(60));
  console.log(`总项目数: ${projects.length}`);
  console.log(`总任务数: ${results.totalTasks}`);
  console.log(`更新任务数: ${results.updatedTasks}`);
  console.log(`冲突数: ${results.conflicts}`);
  console.log(`错误数: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n❌ 错误列表:');
    results.errors.forEach((err, idx) => {
      console.log(`   ${idx + 1}. ${err.projectId || err.taskId}: ${err.error}`);
    });
  }

  console.log('\n✅ 同步完成！');

  // 保存结果到文件
  const resultPath = path.join(process.cwd(), 'tasks/sync-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 结果已保存到: ${resultPath}`);
}

// 运行
main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});