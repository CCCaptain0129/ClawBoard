@echo off
REM OpenClaw Visualization 一键停止脚本 (Windows)

setlocal enabledelayedexpansion

REM 项目根目录
set "PROJECT_ROOT=%~dp0"

echo ==========================================
echo OpenClaw Visualization 停止服务
echo ==========================================
echo.

REM 停止 Node.js 进程
echo [INFO] 停止服务...

REM 查找并停止后端和前端进程
for /f "tokens=2" %%i in ('tasklist ^| findstr "node.exe"') do (
    echo [INFO] 停止进程 PID: %%i
    taskkill /F /PID %%i >nul 2>&1
)

echo.
echo ==========================================
echo ✅ 所有服务已停止
echo ==========================================
echo.

pause