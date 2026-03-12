# 快速参考

## 守护模式

```bash
# 启动守护进程
./daemon-start.sh

# 停止守护进程
./daemon-stop.sh
```

## 手动模式

```bash
# 启动服务
./start.sh

# 停止服务
./stop.sh
```

## 查看日志

```bash
# 监控日志
tail -f tmp/watch.log

# 重启历史
tail -f tmp/restart-history.log

# 后端日志
tail -f tmp/backend.log

# 前端日志
tail -f tmp/frontend.log
```

## 配置监控

```bash
# 复制示例配置
cp watch.conf.example tmp/watch.conf

# 编辑配置
vim tmp/watch.conf
```

## 查看进程

```bash
# 监控脚本
cat tmp/watch.pid

# 后端服务
cat tmp/backend.pid

# 前端服务
cat tmp/frontend.pid
```

## 故障排查

```bash
# 检查守护进程状态
ps -p $(cat tmp/watch.pid)

# 重新启动守护进程
./daemon-stop.sh
./daemon-start.sh

# 清理重启历史
rm tmp/restart-history.log
```