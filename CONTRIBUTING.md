# Contributing

感谢你愿意为 OpenClaw Visualization 贡献代码。

## 开发环境

- Node.js >= 18
- npm >= 8

安装依赖：

```bash
./install.sh
```

启动项目：

```bash
./start.sh
```

停止项目：

```bash
./stop.sh
```

## 提交流程

1. Fork 仓库并创建分支
2. 完成开发并自测
3. 提交代码（建议使用 Conventional Commits）
4. 发起 Pull Request（请使用仓库内置 PR 模板）

建议的 commit 示例：

- `feat: add project-level auto dispatch toggle`
- `fix: prevent stale subagent sessions from overriding todo tasks`
- `docs: update source-of-truth usage`

## 代码与测试

- 保持改动聚焦，避免无关重构
- 涉及 UI 变更时，建议在 PR 中附截图
- 提交前建议执行：

```bash
cd src/backend && npm run build
cd ../frontend && npm run build
```

## 问题反馈

- Bug 和需求请通过 GitHub Issues 提交（使用 Issue 模板）
- 安全相关问题请不要公开提交细节，建议私下联系维护者
