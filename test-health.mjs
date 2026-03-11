import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/tasks/health',
  method: 'GET'
};

console.log('🧪 健康检查 API 测试脚本\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('✅ API 请求成功\n');

      // 1. 检查响应状态
      console.log('📊 响应状态:');
      console.log(`   Status: ${result.status}`);
      console.log(`   Timestamp: ${result.timestamp}\n`);

      // 2. 检查摘要信息
      console.log('📈 摘要信息:');
      console.log(`   总项目数: ${result.summary.totalProjects}`);
      console.log(`   总任务数: ${result.summary.totalTasks}`);
      console.log(`   有效项目: ${result.summary.validProjects}`);
      console.log(`   错误项目: ${result.summary.errorProjects}\n`);

      // 3. 检查项目列表
      console.log('📁 项目列表:');
      result.projects.forEach(project => {
        const icon = project.status === 'ok' ? '✅' : '❌';
        console.log(`   ${icon} ${project.id}`);
        console.log(`      任务数: ${project.taskCount}, 有效: ${project.valid}`);
        if (project.error) {
          console.log(`      错误: ${project.error}`);
        }
      });

      // 4. 验证必需字段
      console.log('\n🔍 字段验证:');
      const requiredFields = ['status', 'timestamp', 'summary', 'projects'];
      const hasAllFields = requiredFields.every(field => result.hasOwnProperty(field));
      console.log(`   ${hasAllFields ? '✅' : '❌'} 包含所有必需字段`);

      const requiredProjectFields = ['id', 'name', 'status', 'taskCount', 'valid', 'error'];
      const projectsValid = result.projects.every(project =>
        requiredProjectFields.every(field => project.hasOwnProperty(field))
      );
      console.log(`   ${projectsValid ? '✅' : '❌'} 所有项目包含必需字段`);

      // 5. 测试结论
      console.log('\n🎯 测试结论:');
      const overallStatus = hasAllFields && projectsValid && result.status !== 'error' || result.summary.errorProjects > 0;
      console.log(`   ${overallStatus ? '✅ 通过' : '❌ 失败'}`);

      console.log('\n' + '='.repeat(50));

      process.exit(0);
    } catch (error) {
      console.error('❌ 解析响应失败:', error.message);
      console.error('原始数据:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  process.exit(1);
});

req.end();