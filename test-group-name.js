const { feishuService } = require('./src/backend/dist/services/feishuService.js');

console.log('Testing Feishu Service - Group Name Fetching\n');
console.log('='.repeat(60));

// 测试用的 chatId 列表（不同格式）
const testChatIds = [
  'chat:oc_0754a493527ed8a4b28bd0dffdf802de',
  'oc_0754a493527ed8a4b28bd0dffdf802de',
];

async function testGroupInfo() {
  for (const chatId of testChatIds) {
    console.log(`\n🔍 Testing chatId: ${chatId}`);
    console.log('-'.repeat(60));

    try {
      const groupInfo = await feishuService.getCachedGroupInfo(chatId);
      console.log(`✅ Result:`);
      console.log(`   - Name: ${groupInfo.name}`);
      console.log(`   - Chat ID: ${groupInfo.chat_id}`);
      console.log(`   - Avatar: ${groupInfo.avatar ? 'Yes' : 'No'}`);
      console.log(`   - Tenant Key: ${groupInfo.tenant_key ? 'Yes' : 'No'}`);

      // 验证是否获取到了真实的群组名称（而不是返回 chatId）
      if (groupInfo.name === chatId) {
        console.log(`⚠️  Warning: Got chatId back instead of group name`);
      } else {
        console.log(`✅ Got real group name: "${groupInfo.name}"`);
      }
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }

    // 测试缓存是否有效
    console.log(`\n🔍 Testing cache (second call):`);
    const groupInfo2 = await feishuService.getCachedGroupInfo(chatId);
    console.log(`   - Cached name: ${groupInfo2.name}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!\n');
}

testGroupInfo().catch(console.error);