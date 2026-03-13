# 部署指南

---

## 1. 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Git**: >= 2.30.0
- **OpenClaw**: 运行中且可访问

---

## 2. 本地开发环境搭建

### 2.1 安装依赖

```bash
# 后端依赖
cd src/backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 2.2 配置环境变量

创建 `.env` 文件：

**backend/.env**
```env
PORT=3000
OPENCLAW_API_URL=http://localhost:8080
WS_PORT=3001
LOG_LEVEL=info
```

**frontend/.env**
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
```

### 2.3 启动开发服务器

```bash
# 启动后端（终端1）
cd src/backend
npm run dev

# 启动前端（终端2）
cd src/frontend
npm run dev
```

访问：http://localhost:5173

---

## 3. 生产环境部署

### 3.1 构建项目

```bash
# 构建前端
cd src/frontend
npm run build

# 构建后端（TypeScript 编译）
cd ../backend
npm run build
```

### 3.2 使用 PM2 部署后端

```bash
# 安装 PM2
npm install -g pm2

# 启动后端服务
cd src/backend
pm2 start dist/index.js --name openclaw-viz-backend

# 查看状态
pm2 status

# 查看日志
pm2 logs openclaw-viz-backend
```

### 3.3 部署前端（Nginx）

**配置 Nginx**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/src/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**重启 Nginx**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3.4 使用 Docker 部署（可选）

**Dockerfile (Backend)**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000 3001
CMD ["node", "dist/index.js"]
```

**Dockerfile (Frontend)**
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  backend:
    build: ./src/backend
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - PORT=3000
      - OPENCLAW_API_URL=http://host.docker.internal:8080
    restart: unless-stopped

  frontend:
    build: ./src/frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

**启动**
```bash
docker-compose up -d
```

---

## 4. 监控与日志

### 4.1 PM2 监控

```bash
# 实时监控
pm2 monit

# 查看日志
pm2 logs openclaw-viz-backend --lines 100

# 设置开机自启
pm2 startup
pm2 save
```

### 4.2 日志管理

后端使用 Winston 记录日志：

```javascript
// logs/
├── combined.log  # 所有日志
├── error.log     # 错误日志
└── access.log    # 访问日志
```

日志轮转配置（使用 pm2-logrotate）：
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 5. 更新部署

### 5.1 更新流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
cd src/backend
npm install
cd ../frontend
npm install

# 3. 构建
cd src/backend
npm run build
cd ../frontend
npm run build

# 4. 重启服务
pm2 restart openclaw-viz-backend
sudo systemctl reload nginx
```

### 5.2 回滚

```bash
# 回滚到上一个版本
git log --oneline
git checkout <previous-commit>

# 重新构建和部署
```

---

## 6. 健康检查

### 6.1 API 健康检查

```bash
curl http://localhost:3000/health
```

响应：
```json
{
  "status": "ok",
  "timestamp": "2026-03-10T10:00:00Z"
}
```

### 6.2 WebSocket 连接测试

```javascript
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => console.log('WebSocket connected');
ws.onerror = (error) => console.error('WebSocket error', error);
```

---

## 7. 故障排查

### 7.1 常见问题

**问题：前端无法连接后端**
- 检查后端是否运行：`pm2 status`
- 检查防火墙设置
- 检查 Nginx 配置

**问题：WebSocket 连接断开**
- 检查 WebSocket 服务状态
- 查看后端日志：`pm2 logs openclaw-viz-backend`
- 检查 Nginx WebSocket 代理配置

**问题：无法获取 Agent 状态**
- 检查 OpenClaw API 是否可访问
- 检查后端环境变量配置
- 查看后端错误日志

---

*版本: 1.0.0*  
*最后更新: 2026-03-10*