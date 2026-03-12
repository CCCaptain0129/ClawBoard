import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recordingPath = path.join(__dirname, 'docs/internal/SUBAGENTS任务分发记录.md');
const content = fs.readFileSync(recordingPath, 'utf-8');

const subagentId = 'agent:main:subagent:1773247354722';
const escapedId = subagentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

console.log('Subagent ID:', subagentId);
console.log('Escaped ID:', escapedId);
console.log();

// 测试不同的正则表达式
const patterns = [
  {
    name: 'Pattern 1: 基本匹配',
    regex: new RegExp(
      'Subagent ID.*`' + escapedId + '`[\\s\\S]*?\\*\\*任务\\*\\*:\\s*([A-Z][A-Z0-9-]*\\d{3,4})',
      's'
    )
  },
  {
    name: 'Pattern 2: 不转义的版本',
    regex: new RegExp(
      'Subagent ID.*`' + subagentId + '`[\\s\\S]*?\\*\\*任务\\*\\*:\\s*([A-Z][A-Z0-9-]*\\d{3,4})',
      's'
    )
  },
  {
    name: 'Pattern 3: 更宽松的匹配',
    regex: new RegExp(
      '`' + escapedId + '`[\\s\\S]*?任务\\s*[:：]\\s*([A-Z0-9-]+)',
      's'
    )
  },
  {
    name: 'Pattern 4: 简化版',
    regex: new RegExp(
      'Subagent ID[\\s\\S]*?`' + escapedId + '`[\\s\\S]*?任务[\\s\\S]*?([A-Z][A-Z0-9-]+-\\d+)',
      's'
    )
  }
];

for (const { name, regex } of patterns) {
  console.log(name);
  const match = content.match(regex);
  if (match) {
    console.log(`  ✅ 匹配成功: ${match[1]}`);
  } else {
    console.log(`  ❌ 未匹配`);
  }
  console.log();
}

// 输出包含该 Subagent ID 的文本片段
const index = content.indexOf(subagentId);
if (index !== -1) {
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + subagentId.length + 200);
  console.log('Context around Subagent ID:');
  console.log('---');
  console.log(content.substring(start, end));
  console.log('---');
}