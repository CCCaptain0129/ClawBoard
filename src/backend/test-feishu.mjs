#!/usr/bin/env node

/**
 * 测试飞书 API 集成
 */

import { feishuService } from './src/services/feishuService.js';

async function testFeishuAPI() {
  console.log('=== 开始测试飞书 API ===\n');

  // 测试 1: 获取 Access Token
  console.log('测试 1: 获取 Access Token');
  try {
    const token = await feishuService.getAccessToken();
    console.log('✅ Access Token 获取成功');
    console.log('Token (前20字符):', token.substring(0, 20) + '...\n');
  } catch (error) {
    console.error('❌ Access Token 获取失败:', error.message);
    console.error('详细错误:', error);
    return;
  }

  // 测试 2: 获取群组信息
  console.log('测试 2: 获取群组信息');
  const testChatId = 'chat:oc_0754a493527ed8a4b28bd0dffdf802de';
  try {
    const groupInfo = await feishuService.getGroupInfo(testChatId);
    console.log('✅ 群组信息获取成功');
    console.log('群组名称:', groupInfo.name);
    console.log('群组 ID:', groupInfo.chat_id);
    console.log('头像:', groupInfo.avatar);
    console.log('Tenant Key:', groupInfo.tenant_key);
  } catch (error) {
    console.error('❌ 群组信息获取失败:', error.message);
  }
}

testFeishuAPI().catch(console.error);