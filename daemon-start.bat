@echo off
REM OpenClaw Visualization 守护进程启动脚本 (Windows)
REM 启动服务并启动监控脚本，确保持续运行

setlocal enabledelayedexpansion

:: 项目根目录
set PROJECT_ROOT=%~dp0

:: PID 文件
set WATCH_PID_FILE=%PROJECT_ROOT%tmp\watch.pid
set DAEMON_LOG=%PROJECT_ROOT%tmp\daemon.log

echo ==========================================
echo OpenClaw Visualization 守护进程启动
echo ==========================================
echo.

:: 检查监控脚本是否已在运行
if exist "%WATCH_PID_FILE%" (
    set /p WATCH_PID=<"%WATCH_PID_FILE%"
    tasklist /FI "PID eq %WATCH_PID%" 2>nul | find /I /N "cmd.exe">nul
    if "%ERRORLEVEL%"=="0" (
        echo [INFO] 监控脚本已在运行 (PID: %WATCH_PID%)
        echo.
        echo 查看监控日志: type "%DAEMON_LOG%"
        echo 停止守护进程: daemon-stop.bat
        echo.
        exit /b 0
    )
)

:: 启动服务
echo [INFO] 启动服务...
cd /d "%PROJECT_ROOT%"
if exist "start.bat" (
    call start.bat
) else (
    echo [ERROR] 找不到 start.bat
    exit /b 1
)
echo.

:: 创建临时目录
if not exist "%PROJECT_ROOT%tmp" mkdir "%PROJECT_ROOT%tmp"

:: 启动监控脚本（后台运行）
echo [INFO] 启动监控脚本...
start /B cmd /C "%PROJECT_ROOT%watch.bat" >> "%DAEMON_LOG%" 2>&1

:: 等待启动
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo [SUCCESS] 守护进程已启动
echo ==========================================
echo.
echo 查看监控日志: type "%DAEMON_LOG%"
echo 查看重启历史: type "%PROJECT_ROOT%tmp\restart-history.log"
echo 监控进程 PID: type "%WATCH_PID_FILE%"
echo.
echo 停止守护进程: daemon-stop.bat
echo ==========================================
echo.