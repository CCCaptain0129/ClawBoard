@echo off
REM OpenClaw Visualization 一键启动脚本 (Windows)

setlocal enabledelayedexpansion

REM 项目根目录
set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%src\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%src\frontend"

REM 日志文件
set "BACKEND_LOG=%PROJECT_ROOT%tmp\backend.log"
set "FRONTEND_LOG=%PROJECT_ROOT%tmp\frontend.log"

REM 创建临时目录
if not exist "%PROJECT_ROOT%tmp" mkdir "%PROJECT_ROOT%tmp"

echo ==========================================
echo OpenClaw Visualization 一键启动脚本
echo ==========================================
echo.

REM 检查 Node.js
echo [INFO] 检查 Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js 未安装
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js 版本: %NODE_VERSION%

REM 检查 npm
echo [INFO] 检查 npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm 未安装
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [INFO] npm 版本: %NPM_VERSION%
echo.

REM 安装依赖
echo [INFO] 检查并安装依赖...

REM 后端依赖
if not exist "%BACKEND_DIR%\node_modules" (
    echo [INFO] 安装后端依赖...
    cd /d "%BACKEND_DIR%"
    call npm install --silent
    echo [SUCCESS] 后端依赖安装完成
) else (
    echo [INFO] 后端依赖已存在
)

REM 前端依赖
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [INFO] 安装前端依赖...
    cd /d "%FRONTEND_DIR%"
    call npm install --silent
    echo [SUCCESS] 前端依赖安装完成
) else (
    echo [INFO] 前端依赖已存在
)

cd /d "%PROJECT_ROOT%"
echo.

REM 启动后端服务
echo [INFO] 启动后端服务...
cd /d "%BACKEND_DIR%"
start /B npm run dev > "%BACKEND_LOG%" 2>&1
echo [SUCCESS] 后端服务已启动
echo [INFO] 后端日志: %BACKEND_LOG%

REM 等待后端启动
timeout /t 3 /nobreak >nul

REM 检查后端是否成功启动
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] 后端服务可能未启动，请查看日志: %BACKEND_LOG%
) else (
    echo [SUCCESS] 后端服务运行正常
)

cd /d "%PROJECT_ROOT%"
echo.

REM 启动前端服务
echo [INFO] 启动前端服务...
cd /d "%FRONTEND_DIR%"
start /B npm run dev > "%FRONTEND_LOG%" 2>&1
echo [SUCCESS] 前端服务已启动
echo [INFO] 前端日志: %FRONTEND_LOG%

REM 等待前端启动
timeout /t 3 /nobreak >nul

cd /d "%PROJECT_ROOT%"
echo.

REM 显示访问信息
echo.
echo ==========================================
echo 🎉 OpenClaw Visualization 已启动！
echo ==========================================
echo.
echo 📱 访问地址:
echo    前端: http://localhost:5173
echo    后端: http://localhost:3000
echo    WebSocket: ws://localhost:3001
echo.
echo 📝 查看日志:
echo    后端: type %BACKEND_LOG%
echo    前端: type %FRONTEND_LOG%
echo.
echo 🛑 停止服务: stop.bat
echo ==========================================
echo.

pause