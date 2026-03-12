#!/usr/bin/env node
/**
 * 迁移脚本：更新任务ID为带项目前缀的格式
 *
 * 目标：
 * - openclaw-visualization → VIS-001, VIS-002, ...
 * - openclaw-integration → INT-001, INT-002, ...
 * - example-project-1 → EXA-001, EXA-002, ...
 * - example-project-2 → EXB-001, EXB-002, ...
 */

import * as fs from 'fs';
import * as path from 'path';

const TASKS_DIR = path.join(process.cwd(), 'tasks');
const PROJECTS_FILE = path.join(TASKS_DIR, 'projects.json');

function loadProjects() {
  try {
    const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Failed to load projects.json: ${error}`);
    process.exit(1);
  }
}

function loadProjectTasks(projectId) {
  const filePath = path.join(TASKS_DIR, `${projectId}-tasks.json`);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Failed to load ${projectId}-tasks.json: ${error}`);
    return null;
  }
}

function saveProjectTasks(projectData) {
  const filePath = path.join(TASKS_DIR, `${projectData.id}-tasks.json`);
  fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2));
  console.log(`✅ Saved: ${path.basename(filePath)}`);
}

function generateNewTaskId(prefix, index) {
  return `${prefix}-${index.toString().padStart(3, '0')}`;
}

function migrateProject(project) {
  console.log(`\n📦 Migrating project: ${project.name} (${project.id})`);
  console.log(`   Prefix: ${project.taskPrefix}`);

  const projectData = loadProjectTasks(project.id);
  if (!projectData) {
    console.log(`   ⚠️  Skipped: No tasks file found`);
    return;
  }

  const tasks = projectData.tasks || [];
  console.log(`   Tasks found: ${tasks.length}`);

  if (tasks.length === 0) {
    console.log(`   ⚠️  Skipped: No tasks to migrate`);
    return;
  }

  // 创建任务ID映射（旧ID -> 新ID）
  const idMap = {};

  // 按创建时间排序，确保序号顺序正确
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateA.getTime() - dateB.getTime();
  });

  // 为每个任务生成新ID
  let changedCount = 0;
  const newTasks = [];

  sortedTasks.forEach((task, index) => {
    const oldId = task.id;
    const newId = generateNewTaskId(project.taskPrefix, index + 1);

    // 检查是否需要迁移
    const needsMigration = !oldId.startsWith(project.taskPrefix + '-');

    if (needsMigration) {
      idMap[oldId] = newId;
      changedCount++;

      console.log(`   ${oldId} → ${newId}`);

      // 更新任务ID
      const updatedTask = { ...task, id: newId };
      newTasks.push(updatedTask);
    } else {
      // 保持原样
      newTasks.push(task);
    }
  });

  if (changedCount === 0) {
    console.log(`   ℹ️  All tasks already have correct prefix. No changes.`);
    return;
  }

  // 更新项目数据
  projectData.tasks = newTasks;
  projectData.updatedAt = new Date().toISOString();

  // 保存
  saveProjectTasks(projectData);

  console.log(`   ✅ Migrated ${changedCount} tasks`);

  return idMap;
}

function findAndReplaceInMarkdown(projectDir, oldId, newId) {
  const markdownFiles = [];

  function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        // 跳过 node_modules 和其他常见目录
        if (['node_modules', '.git', 'dist', 'build'].includes(file.name)) continue;
        scanDirectory(fullPath);
      } else if (file.name.endsWith('.md')) {
        markdownFiles.push(fullPath);
      }
    }
  }

  try {
    scanDirectory(projectDir);
  } catch (error) {
    // 目录可能不存在，忽略
  }

  let updatedFiles = 0;
  for (const file of markdownFiles) {
    try {
      let content = fs.readFileSync(file, 'utf-8');
      const regex = new RegExp(`\\b${oldId}\\b`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, newId);
        fs.writeFileSync(file, content);
        console.log(`      📄 Updated: ${path.relative(process.cwd(), file)}`);
        updatedFiles++;
      }
    } catch (error) {
      console.error(`      ❌ Error updating ${file}: ${error}`);
    }
  }

  return updatedFiles;
}

function main() {
  console.log('='.repeat(60));
  console.log('🔄 Task ID Migration Script');
  console.log('='.repeat(60));

  // 检查 tasks 目录
  if (!fs.existsSync(TASKS_DIR)) {
    console.error(`❌ Tasks directory not found: ${TASKS_DIR}`);
    process.exit(1);
  }

  // 加载项目配置
  const projects = loadProjects();
  console.log(`\n📋 Loaded ${projects.length} projects`);

  // 迁移每个项目
  let totalMigrated = 0;
  let totalTasksUpdated = 0;
  let totalMarkdownUpdated = 0;

  projects.forEach(project => {
    const projectData = loadProjectTasks(project.id);
    if (!projectData) return;

    const tasks = projectData.tasks || [];
    if (tasks.length === 0) return;

    // 检查是否有需要迁移的任务
    const needsMigration = tasks.some(t => !t.id.startsWith(project.taskPrefix + '-'));
    if (!needsMigration) {
      console.log(`\n⏭️  Skipping ${project.name}: Already migrated`);
      return;
    }

    const idMap = migrateProject(project);
    if (idMap) {
      totalMigrated++;

      // 更新 Markdown 文件
      console.log(`\n   📝 Updating Markdown files...`);
      for (const [oldId, newId] of Object.entries(idMap)) {
        const updated = findAndReplaceInMarkdown(process.cwd(), oldId, newId);
        totalMarkdownUpdated += updated;
      }

      const changedCount = Object.keys(idMap).length;
      totalTasksUpdated += changedCount;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Migration complete!`);
  console.log(`   Projects migrated: ${totalMigrated}`);
  console.log(`   Tasks updated: ${totalTasksUpdated}`);
  console.log(`   Markdown files updated: ${totalMarkdownUpdated}`);
  console.log('='.repeat(60));
  console.log('\n📝 Next steps:');
  console.log('1. Review the changes in the tasks/*.json files');
  console.log('2. Verify that the application works correctly');
  console.log('3. Commit the changes to git');
}

// 运行脚本
main();