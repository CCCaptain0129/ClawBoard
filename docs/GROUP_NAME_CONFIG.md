# 群组名称配置说明

## 问题描述

在 Agent 监控看板中，飞书群组的显示格式为 ID 字符串（如 `oc_0754a493527ed8a4b28bd0dffdf802de`），不够友好。

## 解决方案

系统提供了多种方式配置群组名称，优先级从高到低：

### 方式 1: 环境变量（推荐）

设置 `FEISHU_GROUP_NAME_MAP` 环境变量，值为 JSON 格式的群组映射：

```bash
export FEISHU_GROUP_NAME_MAP='{
  "oc_0754a493527ed8a4b28bd0dffdf802de": "OpenClaw 集成讨论组",
  "oc_00087c97b2f8a756b2e133d5e8c0ab17": "测试群组",
  "oc_49db5e0b3f3ab28b88d251cd1f59a807": "开发讨论组"
}'
```

### 方式 2: 配置文件

编辑 `config/openclaw.json` 文件：

```json
{
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "your-gateway-token-here"
  },
  "feishu": {
    "appId": "cli_xxxxxxxxx",
    "appSecret": "your-app-secret-here",
    "groupNameMap": {
      "oc_0754a493527ed8a4b28bd0dffdf802de": "OpenClaw 集成讨论组",
      "oc_00087c97b2f8a756b2e133d5e8c0ab17": "测试群组",
      "oc_49db5e0b3f3ab28b88d251cd1f59a807": "开发讨论组"
    }
  }
}
```

### 方式 3: 飞书 API（可选）

如果配置了飞书应用的 `appId` 和 `appSecret`，系统会自动通过飞书 API 获取群组名称。当 API 调用成功后，群组名称会自动缓存到本地映射表中。

## 如何获取群组 ID

1. 查看 Agent 卡片，复制群组 ID（如 `oc_0754a493527ed8a4b28bd0dffdf802de`）
2. 在飞书群组中查看群组名称
3. 将映射关系添加到配置中

## 显示优先级

1. 本地配置的群组名称映射（环境变量或配置文件）
2. 飞书 API 返回的群组名称
3. 群组 ID（作为备用）

## 示例

### 配置前显示

```
飞书群组 oc_0754a493527ed8a4b28bd0dffdf802de
状态: running
```

### 配置后显示

```
OpenClaw 集成讨论组
状态: running
```

## 注意事项

- 群组 ID 不需要包含 `chat:` 前缀，系统会自动处理
- 配置更新后需要重启后端服务才能生效
- 群组名称支持中文和特殊字符