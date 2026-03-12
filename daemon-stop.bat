@echo off
REM OpenClaw Visualization 守护进程停止脚本 (Windows)
REM 停止服务和监控脚本

setlocal enabledelayedexpansion

:: 项目根目录
set PROJECT_ROOT=%~dp0

:: PID 文件
set WATCH_PID_FILE=%PROJECT_ROOT%tmp\watch.pid
set BACKEND_PID_FILE=%PROJECT_ROOT%tmp\backend.pid
set FRONTEND_PID_FILE=%PROJECT_ROOT%tmp\frontend.pid
set FRONTEND_PORT_FILE=%PROJECT_ROOT%tmp\frontend.port

echo ==========================================
echo OpenClaw Visualization 守护进程停止
echo ==========================================
echo.

:: 停止监控脚本
echo [INFO] 停止监控脚本...
if exist "%WATCH_PID_FILE%" (
    set /p WATCH_PID=<"%WATCH_PID_FILE%"
    tasklist /FI "PID eq %WATCH_PID%" 2>nul | find /I /N "cmd.exe">nul
    if "%ERRORLEVEL%"=="0" (
        taskkill /F /PID %WATCH_PID% 2>nul
        echo [SUCCESS] 监控脚本已停止 (PID: %WATCH_PID%)
    ) else (
        echo [WARNING] 监控脚本未运行
    )
    del "%WATCH_PID_FILE%" 2>nul
) else (
    echo [WARNING] 监控脚本 PID 文件不存在
)
echo.

:: 停止服务
echo [INFO] 停止服务...
cd /d "%PROJECT_ROOT%"
if exist "stop.bat" (
    call stop.bat
) else (
    echo [ERROR] 找不到 stop.bat
    exit /b 1
)
echo.

:: 清理所有 PID 文件
echo [INFO] 清理 PID 文件...
if exist "%WATCH_PID_FILE%" del "%WATCH_PID_FILE%" 2>nul
if exist "%BACKEND_PID_FILE%" del "%BACKEND_PID_FILE%" 2>nul
if exist "%FRONTEND_PID_FILE%" del "%FRONTEND_PID_FILE%" 2>nul
if exist "%FRONTEND_PORT_FILE%" del "%FRONTEND_PORT_FILE%" 2>nul
echo [SUCCESS] PID 文件已清理

echo.
echo ==========================================
echo [SUCCESS] 守护进程已停止
echo ==========================================
echo.