@echo off
REM OpenClaw Visualization 一键启动脚本 (Windows) - 优化版
REM 解决端口冲突、健康检查、多实例运行等问题

setlocal enabledelayedexpansion

REM 项目根目录
set "PROJECT_ROOT=%~dp0"
set "BACKEND_DIR=%PROJECT_ROOT%src\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%src\frontend"

REM 日志文件
set "BACKEND_LOG=%PROJECT_ROOT%tmp\backend.log"
set "FRONTEND_LOG=%PROJECT_ROOT%tmp\frontend.log"

REM PID 文件
set "BACKEND_PID_FILE=%PROJECT_ROOT%tmp\backend.pid"
set "FRONTEND_PID_FILE=%PROJECT_ROOT%tmp\frontend.pid"
set "FRONTEND_PORT_FILE=%PROJECT_ROOT%tmp\frontend.port"

REM 健康检查配置
set "HEALTH_CHECK_MAX_RETRIES=10"
set "HEALTH_CHECK_INTERVAL=2"

REM 创建临时目录
if not exist "%PROJECT_ROOT%tmp" mkdir "%PROJECT_ROOT%tmp"

REM 颜色定义（Windows 10+）
for /F %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"
set "BLUE=%ESC%[34m"
set "GREEN=%ESC%[32m"
set "YELLOW=%ESC%[33m"
set "CYAN=%ESC%[36m"
set "NC=%ESC%[0m"

echo.
echo ==========================================
echo OpenClaw Visualization 一键启动脚本 (优化版)
echo ==========================================
echo.

REM 检查 Node.js
echo %BLUE%[INFO]%NC% 检查环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% Node.js 未安装
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo %BLUE%[INFO]%NC% Node.js 版本: %NODE_VERSION%

REM 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[ERROR]%NC% npm 未安装
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo %BLUE%[INFO]%NC% npm 版本: %NPM_VERSION%

echo.

REM 安装依赖
echo %CYAN%[STEP]%NC% 检查并安装依赖...

if not exist "%BACKEND_DIR%\node_modules" (
    echo %BLUE%[INFO]%NC% 安装后端依赖...
    cd /d "%BACKEND_DIR%"
    call npm install --silent
    echo %GREEN%[SUCCESS]%NC% 后端依赖安装完成
) else (
    echo %BLUE%[INFO]%NC% 后端依赖已存在
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo %BLUE%[INFO]%NC% 安装前端依赖...
    cd /d "%FRONTEND_DIR%"
    call npm install --silent
    echo %GREEN%[SUCCESS]%NC% 前端依赖安装完成
) else (
    echo %BLUE%[INFO]%NC% 前端依赖已存在
)

cd /d "%PROJECT_ROOT%"
echo.

REM 检查并停止已有实例
echo %CYAN%[STEP]%NC% 启动后端服务...

if exist "%BACKEND_PID_FILE%" (
    set /p BACKEND_PID=<"%BACKEND_PID_FILE%"
    tasklist /FI "PID eq !BACKEND_PID!" 2>nul | find "!BACKEND_PID!" >nul
    if !errorlevel! equ 0 (
        echo %YELLOW%[WARNING]%NC% 后端服务已在运行 (PID: !BACKEND_PID!)
        echo.
        echo 检测到以下进程：
        tasklist /FI "PID eq !BACKEND_PID!"
        echo.
        echo 请选择操作：
        echo   1) 停止旧实例并重新启动
        echo   2) 使用已有实例
        echo   3) 取消启动
        set /p CHOICE="请输入选项 (1-3): "

        if "!CHOICE!"=="1" (
            taskkill /PID !BACKEND_PID! /F >nul 2>&1
            timeout /t 2 /nobreak >nul
            echo %GREEN%[SUCCESS]%NC% 后端服务已停止
        ) else if "!CHOICE!"=="2" (
            echo %BLUE%[INFO]%NC% 使用已有的后端服务实例
            goto :skip_backend
        ) else (
            echo %RED%[ERROR]%NC% 用户取消启动
            pause
            exit /b 1
        )
    )
    del "%BACKEND_PID_FILE%" 2>nul
)

REM 检查端口占用
netstat -aon | findstr ":3000.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo %YELLOW%[WARNING]%NC% 端口 3000 已被占用
    netstat -aon | findstr ":3000.*LISTENING"
    echo.
    echo 请选择操作：
    echo   1) 停止占用进程
    echo   2) 取消启动
    set /p CHOICE="请输入选项 (1-2): "
    if "!CHOICE!"=="1" (
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000.*LISTENING"') do (
            taskkill /PID %%a /F >nul 2>&1
        )
        echo %GREEN%[SUCCESS]%NC% 端口 3000 已清理
    ) else (
        echo %RED%[ERROR]%NC% 用户取消启动
        pause
        exit /b 1
    )
)

netstat -aon | findstr ":3001.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo %YELLOW%[WARNING]%NC% 端口 3001 已被占用
    netstat -aon | findstr ":3001.*LISTENING"
    echo.
    echo 请选择操作：
    echo   1) 停止占用进程
    echo   2) 取消启动
    set /p CHOICE="请输入选项 (1-2): "
    if "!CHOICE!"=="1" (
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001.*LISTENING"') do (
            taskkill /PID %%a /F >nul 2>&1
        )
        echo %GREEN%[SUCCESS]%NC% 端口 3001 已清理
    ) else (
        echo %RED%[ERROR]%NC% 用户取消启动
        pause
        exit /b 1
    )
)

REM 启动后端服务
cd /d "%BACKEND_DIR%"
start /B cmd /c "npm run dev > %BACKEND_LOG% 2>&1"
timeout /t 1 /nobreak >nul

REM 获取后端进程 PID
for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    set BACKEND_PID=%%a
    goto :found_backend_pid
)
:found_backend_pid
echo !BACKEND_PID! > "%BACKEND_PID_FILE%"
echo %GREEN%[SUCCESS]%NC% 后端服务已启动 (PID: !BACKEND_PID!)
echo %BLUE%[INFO]%NC% 后端日志: %BACKEND_LOG%

REM 健康检查
echo %BLUE%[INFO]%NC% 等待后端服务启动...
set /a RETRIES=0
:health_check_backend
set /a RETRIES+=1
curl -s --max-time 5 http://localhost:3000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo %GREEN%[SUCCESS]%NC% 后端服务健康检查通过
) else if %RETRIES% lss %HEALTH_CHECK_MAX_RETRIES% (
    echo %BLUE%[INFO]%NC% 后端服务启动中... (%RETRIES%/%HEALTH_CHECK_MAX_RETRIES%)
    timeout /t %HEALTH_CHECK_INTERVAL% /nobreak >nul
    goto :health_check_backend
) else (
    echo %RED%[ERROR]%NC% 后端服务启动失败或超时
    echo %RED%[ERROR]%NC% 请查看日志: %BACKEND_LOG%
    del "%BACKEND_PID_FILE%" 2>nul
    pause
    exit /b 1
)

:skip_backend

echo.
echo %CYAN%[STEP]%NC% 启动前端服务...

REM 检查是否已有实例
if exist "%FRONTEND_PID_FILE%" (
    set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"
    tasklist /FI "PID eq !FRONTEND_PID!" 2>nul | find "!FRONTEND_PID!" >nul
    if !errorlevel! equ 0 (
        echo %YELLOW%[WARNING]%NC% 前端服务已在运行 (PID: !FRONTEND_PID!)
        echo.
        echo 检测到以下进程：
        tasklist /FI "PID eq !FRONTEND_PID!"
        echo.
        echo 请选择操作：
        echo   1) 停止旧实例并重新启动
        echo   2) 使用已有实例
        echo   3) 取消启动
        set /p CHOICE="请输入选项 (1-3): "

        if "!CHOICE!"=="1" (
            taskkill /PID !FRONTEND_PID! /F >nul 2>&1
            timeout /t 2 /nobreak >nul
            echo %GREEN%[SUCCESS]%NC% 前端服务已停止
        ) else if "!CHOICE!"=="2" (
            echo %BLUE%[INFO]%NC% 使用已有的前端服务实例
            goto :skip_frontend
        ) else (
            echo %RED%[ERROR]%NC% 用户取消启动
            pause
            exit /b 1
        )
    )
    del "%FRONTEND_PID_FILE%" 2>nul
)

REM 检查端口占用
set "FRONTEND_PORT=5173"
:check_port_loop
netstat -aon | findstr ":%FRONTEND_PORT%.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo %YELLOW%[WARNING]%NC% 端口 %FRONTEND_PORT% 已被占用
    netstat -aon | findstr ":%FRONTEND_PORT%.*LISTENING"
    echo.
    echo 请选择操作：
    echo   1) 停止占用进程
    echo   2) 取消启动
    set /p CHOICE="请输入选项 (1-2): "
    if "!CHOICE!"=="1" (
        for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%FRONTEND_PORT%.*LISTENING"') do (
            taskkill /PID %%a /F >nul 2>&1
        )
        echo %GREEN%[SUCCESS]%NC% 端口 %FRONTEND_PORT% 已清理
    ) else (
        echo %RED%[ERROR]%NC% 用户取消启动
        pause
        exit /b 1
    )
)

REM 启动前端服务
cd /d "%FRONTEND_DIR%"
start /B cmd /c "npm run dev > %FRONTEND_LOG% 2>&1"
timeout /t 1 /nobreak >nul

REM 获取前端进程 PID
for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    set FRONTEND_PID=%%a
)
echo !FRONTEND_PID! > "%FRONTEND_PID_FILE%"
echo %GREEN%[SUCCESS]%NC% 前端服务已启动 (PID: !FRONTEND_PID!)
echo %BLUE%[INFO]%NC% 前端日志: %FRONTEND_LOG%

REM 等待 Vite 启动并检测实际端口
echo %BLUE%[INFO]%NC% 等待前端服务启动...
timeout /t 5 /nobreak >nul

REM 从日志中提取实际使用的端口
findstr /C:"Local:" "%FRONTEND_LOG%" > "%FRONTEND_PORT_FILE%.tmp"
for /f "tokens=3 delims=:" %%a in ('findstr /C:"Local:" "%FRONTEND_LOG%.tmp" ^| findstr "localhost"') do (
    set DETECTED_PORT=%%a
    goto :found_port
)
:found_port
if defined DETECTED_PORT (
    echo %DETECTED_PORT% > "%FRONTEND_PORT_FILE%"
    echo %GREEN%[SUCCESS]%NC% 前端服务运行在端口 %DETECTED_PORT%
) else (
    echo 5173 > "%FRONTEND_PORT_FILE%"
    echo %YELLOW%[WARNING]%NC% 无法自动检测前端端口，使用默认端口 5173
)
del "%FRONTEND_PORT_FILE%.tmp" 2>nul

:skip_frontend

echo.
echo ==========================================
echo %GREEN%🎉 OpenClaw Visualization 已启动！%NC%
echo ==========================================
echo.

REM 读取前端实际端口
set "FRONTEND_DISPLAY_PORT=5173"
if exist "%FRONTEND_PORT_FILE%" (
    set /p FRONTEND_DISPLAY_PORT=<"%FRONTEND_PORT_FILE%"
)

echo 📱 访问地址:
echo    前端: http://localhost:%FRONTEND_DISPLAY_PORT%
echo    后端: http://localhost:3000
echo    WebSocket: ws://localhost:3001
echo.
echo 📝 查看日志:
echo    后端: type %BACKEND_LOG%
echo    前端: type %FRONTEND_LOG%
echo.
echo 🔍 查看进程:
echo    后端: type %BACKEND_PID_FILE%
echo    前端: type %FRONTEND_PID_FILE%
echo.
echo 🛑 停止服务: stop.bat
echo ==========================================
echo.

endlocal
pause