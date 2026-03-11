#!/usr/bin/env node

/**
 * 测试飞书 API 集成
 */

import fetch from 'node-fetch';

const APP_ID = 'cli_a9285709db78dbef';
const APP_SECRET = 'kSgiXCzM1gUXWcRYzw8TnDhNr4QSwlSoS';
const BASE_URL = 'https://open.feishu.cn/open-apis';

async function testFeishuAPI() {
  console.log('=== 开始测试飞书 API ===\n');

  // 测试 1: 获取 Access Token
  console.log('测试 1: 获取 Access Token');
  try {
    const response = await fetch(`${BASE_URL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: APP_ID,
        app_secret: APP_SECRET,
      }),
    });

    const text = await response.text();
    console.log('原始响应:', text);

    const data = JSON.parse(text);

    if (data.code !== 0) {
      console.error('❌ 飞书 API 错误:', data.code, '-', data.msg);
      return;
    }

    if (!data.tenant_access_token) {
      console.error('❌ 飞书 API 未返回 access token');
      return;
    }

    const accessToken = data.tenant_access_token;
    console.log('✅ Access Token 获取成功');
    console.log('Token (前20字符):', accessToken.substring(0, 20) + '...');
    console.log('过期时间:', data.expire_in, '秒\n');

    // 测试 2: 获取群组信息
    console.log('测试 2: 获取群组信息');
    const testChatId = 'chat:oc_0754a493527ed8a4b28bd0dffdf802de';
    try {
      const groupResponse = await fetch(`${BASE_URL}/im/v1/chats/${testChatId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      });

      const groupText = await groupResponse.text();
      console.log('原始群组响应:', groupText);

      const groupData = JSON.parse(groupText);

      if (groupData.code !== 0) {
        console.warn('⚠️  飞书 API 警告:', groupData.code, '-', groupData.msg);
        console.log('返回群组 ID 作为后备方案:', testChatId);
      } else {
        console.log('✅ 群组信息获取成功');
        console.log('群组名称:', groupData.data.name);
        console.log('群组 ID:', groupData.data.chat_id);
        console.log('头像:', groupData.data.avatar);
        console.log('Tenant Key:', groupData.data.tenant_key);
      }
    } catch (error) {
      console.error('❌ 群组信息获取失败:', error.message);
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
}

testFeishuAPI().catch(console.error);