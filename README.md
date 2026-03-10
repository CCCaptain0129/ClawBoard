# OpenClaw Agent 可视化监控平台

实时监控和管理 OpenClaw Agent 的 Web 可视化界面

---

## 快速开始

```bash
# 克隆项目
cd /Users/ot/.openclaw/workspace/projects/openclaw-visualization

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

---

## 功能特性

- ✅ 实时显示所有 Agent 的运行状态
- ✅ 展示每个 Agent 的当前任务和进度
- ✅ 任务历史记录查看
- ✅ 错误日志展示
- ✅ Agent 性能监控（CPU/内存使用）
- ✅ WebSocket 实时推送更新

---

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **状态管理**: Zustand
- **UI组件**: shadcn/ui + Tailwind CSS
- **实时通信**: WebSocket
- **后端**: Node.js + Express
- **数据源**: OpenClaw 数据库 / API

---

## 项目结构

```
openclaw-visualization/
├── README.md
├── docs/
│   ├── PRD.md            # 产品需求文档
│   ├── ARCHITECTURE.md   # 技术架构
│   └── DEPLOY.md         # 部署指南
├── TASKS.md              # 任务分解清单
├── PROGRESS.md           # 进度追踪
├── CHANGELOG.md          # 变更日志
├── src/
│   ├── frontend/         # 前端代码
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── stores/
│   │   │   └── hooks/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── backend/          # 后端代码
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── websocket/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/           # 共享代码
│       └── types/
├── tests/
└── .github/
    └── PULL_REQUEST_TEMPLATE.md
```

---

## 开发指南

### 环境要求

- Node.js >= 18
- npm >= 9

### 代码规范

项目使用 ESLint + Prettier 进行代码格式化：

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint:fix
```

### Commit Message 规范

遵循约定式提交规范：

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具变动

示例：
```bash
git commit -m "feat(dashboard): 添加Agent状态实时更新"
```

---

## 开发流程

1. 从 TASKS.md 选择待办任务
2. 在 PROGRESS.md 中标记为进行中
3. 创建 feature 分支：`git checkout -b feature/xxx`
4. 开发并提交代码
5. 推送到远程：`git push origin feature/xxx`
6. 更新 PROGRESS.md

详见项目管理指南：`../openclaw-project-guide.md`

---

## 部署

详见 [docs/DEPLOY.md](docs/DEPLOY.md)

---

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

---

## 许可证

MIT

---

*版本: 0.1.0*  
*最后更新: 2026-03-10*