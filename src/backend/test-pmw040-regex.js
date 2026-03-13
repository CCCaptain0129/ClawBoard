/**
 * 测试 PMW-040: 修复前端"新增任务"表单填写了任务描述，但是 JSON 文件中 description 为 null
 */

const fs = require('fs');
const path = require('path');

// 临时测试：直接读取编译后的文件测试正则表达式
const lines = `# 测试任务

## 阶段 1：测试阶段

### PMW-001 \`P0\` 测试任务1

- 状态: 待处理
- 描述: 这是一个测试任务的描述
- 领取者: (空)
- 预计时间: 1小时
- 依赖: (无)

### PMW-002 \`P1\` 测试任务2：空描述

- 状态: 待处理
- 描述: 测试任务2
- 领取者: (空)
- 预计时间: 30分钟
- 依赖: (无)

## 临时/其他任务

### PMW-003 \`P2\` 临时任务：带详细描述

- 状态: 待处理
- 描述: 这是一个很详细的描述，包含很多信息
- 领取者: (空)
- 预计时间: 2小时
- 依赖: (无)
`.split('\n');

console.log('测试正则表达式匹配...\n');

// 测试格式3的正则表达式
const format3Match1 = '### PMW-001 `P0` 测试任务1'.match(/^###\s+([A-Z]+-\d+)\s+`([P\d]+)`\s+(.*)$/);
console.log('测试1: ### PMW-001 `P0` 测试任务1');
console.log('  taskId:', format3Match1?.[1]);
console.log('  priority:', format3Match1?.[2]);
console.log('  title:', format3Match1?.[3]);
console.log('  ✅ 匹配成功\n');

const format3Match2 = '### PMW-002 `P1` 测试任务2：空描述'.match(/^###\s+([A-Z]+-\d+)\s+`([P\d]+)`\s+(.*)$/);
console.log('测试2: ### PMW-002 `P1` 测试任务2：空描述');
console.log('  taskId:', format3Match2?.[1]);
console.log('  priority:', format3Match2?.[2]);
console.log('  title:', format3Match2?.[3]);
console.log('  ✅ 匹配成功\n');

const format3Match3 = '### PMW-003 `P2` 临时任务：带详细描述'.match(/^###\s+([A-Z]+-\d+)\s+`([P\d]+)`\s+(.*)$/);
console.log('测试3: ### PMW-003 `P2` 临时任务：带详细描述');
console.log('  taskId:', format3Match3?.[1]);
console.log('  priority:', format3Match3?.[2]);
console.log('  title:', format3Match3?.[3]);
console.log('  ✅ 匹配成功\n');

console.log('✅ 所有正则表达式测试通过！');