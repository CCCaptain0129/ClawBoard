@echo off
REM OpenClaw Visualization 服务监控脚本 (Windows)
REM 监控后端和前端服务，在崩溃时自动重启

setlocal enabledelayedexpansion

:: 项目根目录
set PROJECT_ROOT=%~dp0
set BACKEND_DIR=%PROJECT_ROOT%src\backend
set FRONTEND_DIR=%PROJECT_ROOT%src\frontend

:: 配置文件
set WATCH_CONFIG=%PROJECT_ROOT%tmp\watch.conf
set WATCH_PID_FILE=%PROJECT_ROOT%tmp\watch.pid
set WATCH_LOG=%PROJECT_ROOT%tmp\watch.log
set RESTART_HISTORY=%PROJECT_ROOT%tmp\restart-history.log

:: PID 文件
set BACKEND_PID_FILE=%PROJECT_ROOT%tmp\backend.pid
set FRONTEND_PID_FILE=%PROJECT_ROOT%tmp\frontend.pid
set FRONTEND_PORT_FILE=%PROJECT_ROOT%tmp\frontend.port

:: 默认配置
set CHECK_INTERVAL=30
set MAX_RESTART_COUNT=10
set RESTART_WINDOW=3600
set HEALTH_CHECK_TIMEOUT=5

:: 创建临时目录
if not exist "%PROJECT_ROOT%tmp" mkdir "%PROJECT_ROOT%tmp"

:: 加载配置
if exist "%WATCH_CONFIG%" call "%WATCH_CONFIG%"

:: 记录监控进程 PID
echo %time% > "%WATCH_PID_FILE%"

echo ==========================================
echo OpenClaw Visualization 服务监控
echo ==========================================
echo.
echo 监控脚本已启动
echo 检查间隔: %CHECK_INTERVAL%秒
echo 最大重启次数: %MAX_RESTART_COUNT%次/%RESTART_WINDOW%秒
echo 日志文件: %WATCH_LOG%
echo 重启历史: %RESTART_HISTORY%
echo.
echo [%DATE% %TIME%] 监控脚本启动 >> "%WATCH_LOG%"

:: 监控循环
:watch_loop
:: 检查后端服务
call :check_backend

:: 检查前端服务
call :check_frontend

:: 等待下一次检查
timeout /t %CHECK_INTERVAL% /nobreak >nul
goto watch_loop

:: ==========================================
:: 检查后端服务
:: ==========================================
:check_backend
:: 检查进程是否存在
if not exist "%BACKEND_PID_FILE%" goto :restart_backend

set /p BACKEND_PID=<"%BACKEND_PID_FILE%"

:: 检查进程是否在运行
tasklist /FI "PID eq %BACKEND_PID%" 2>nul | find /I /N "node.exe">nul
if "%ERRORLEVEL%"=="0" (
    :: 进程存在，检查健康端点
    call :health_check "http://localhost:3000/health" "后端服务"
    if "%ERRORLEVEL%"=="0" (
        exit /b 0
    ) else (
        echo [%DATE% %TIME%] 后端服务健康检查失败 >> "%WATCH_LOG%"
        goto :restart_backend
    )
) else (
    goto :restart_backend
)

exit /b 0

:: ==========================================
:: 检查前端服务
:: ==========================================
:check_frontend
:: 检查进程是否存在
if not exist "%FRONTEND_PID_FILE%" goto :restart_frontend

set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"

:: 检查进程是否在运行
tasklist /FI "PID eq %FRONTEND_PID%" 2>nul | find /I /N "node.exe">nul
if "%ERRORLEVEL%"=="0" (
    :: 进程存在，检查健康端点
    if exist "%FRONTEND_PORT_FILE%" (
        set /p FRONTEND_PORT=<"%FRONTEND_PORT_FILE%"
    ) else (
        set FRONTEND_PORT=5173
    )

    call :health_check "http://localhost:%FRONTEND_PORT%" "前端服务"
    if "%ERRORLEVEL%"=="0" (
        exit /b 0
    ) else (
        echo [%DATE% %TIME%] 前端服务健康检查失败 >> "%WATCH_LOG%"
        goto :restart_frontend
    )
) else (
    goto :restart_frontend
)

exit /b 0

:: ==========================================
:: 健康检查
:: ==========================================
:health_check
set URL=%~1
set NAME=%~2

:: 使用 PowerShell 进行 HTTP 检查
powershell -Command "try { $response = Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec %HEALTH_CHECK_TIMEOUT%; exit 0 } catch { exit 1 }"

if "%ERRORLEVEL%"=="0" (
    exit /b 0
) else (
    exit /b 1
)

:: ==========================================
:: 重启后端服务
:: ==========================================
:restart_backend
echo [%DATE% %TIME%] 检测到后端服务已停止，尝试重启... >> "%WATCH_LOG%"

:: 停止可能残留的进程
if exist "%BACKEND_PID_FILE%" (
    set /p OLD_PID=<"%BACKEND_PID_FILE%"
    taskkill /F /PID %OLD_PID% 2>nul
    del "%BACKEND_PID_FILE%" 2>nul
)

:: 清理端口
for %%p in (3000 3001) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p.*LISTENING"') do (
        taskkill /F /PID %%a 2>nul
    )
)

:: 启动后端
cd /d "%BACKEND_DIR%"
start /B npm run dev > "%PROJECT_ROOT%tmp\backend.log" 2>&1

:: 等待启动并获取 PID
timeout /t 5 /nobreak >nul

:: 记录重启历史
echo [%DATE% %TIME%] 后端服务 - 自动重启 >> "%RESTART_HISTORY%"

exit /b 0

:: ==========================================
:: 重启前端服务
:: ==========================================
:restart_frontend
echo [%DATE% %TIME%] 检测到前端服务已停止，尝试重启... >> "%WATCH_LOG%"

:: 停止可能残留的进程
if exist "%FRONTEND_PID_FILE%" (
    set /p OLD_PID=<"%FRONTEND_PID_FILE%"
    taskkill /F /PID %OLD_PID% 2>nul
    del "%FRONTEND_PID_FILE%" 2>nul
)

:: 清理端口
for %%p in (5173 5174 5175 5176 5177) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%p.*LISTENING"') do (
        taskkill /F /PID %%a 2>nul
    )
)
if exist "%FRONTEND_PORT_FILE%" del "%FRONTEND_PORT_FILE%"

:: 启动前端
cd /d "%FRONTEND_DIR%"
start /B npm run dev > "%PROJECT_ROOT%tmp\frontend.log" 2>&1

:: 等待启动
timeout /t 5 /nobreak >nul

:: 从日志中提取端口
for /f "tokens=*" %%a in ('findstr /C:"Local:" "%PROJECT_ROOT%tmp\frontend.log"') do (
    set LINE=%%a
)

:: 提取端口号（简化处理）
if defined LINE (
    set FRONTEND_PORT=5173
) else (
    set FRONTEND_PORT=5173
)
echo %FRONTEND_PORT% > "%FRONTEND_PORT_FILE%"

:: 记录重启历史
echo [%DATE% %TIME%] 前端服务 - 自动重启 >> "%RESTART_HISTORY%"

exit /b 0