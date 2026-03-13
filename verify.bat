@echo off
REM OpenClaw Visualization 服务验证脚本 (Windows)
REM 验证后端和前端服务是否正常运行

setlocal enabledelayedexpansion

REM 项目根目录
set "PROJECT_ROOT=%~dp0"
set "BACKEND_PORT=3000"
set "FRONTEND_PORT=5173"

REM PID 文件
set "BACKEND_PID_FILE=%PROJECT_ROOT%tmp\backend.pid"
set "FRONTEND_PID_FILE=%PROJECT_ROOT%tmp\frontend.pid"
set "FRONTEND_PORT_FILE=%PROJECT_ROOT%tmp\frontend.port"

REM 颜色定义（Windows 10+）
for /F %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"
set "BLUE=%ESC%[34m"
set "GREEN=%ESC%[32m"
set "YELLOW=%ESC%[33m"
set "RED=%ESC%[31m"
set "CYAN=%ESC%[36m"
set "BOLD=%ESC%[1m"
set "NC=%ESC%[0m"

REM 计数器
set "ERRORS=0"

echo.
echo %CYAN%============================================================%NC%
echo %CYAN%  %BOLD%OpenClaw Visualization 服务验证%NC%
echo %CYAN%============================================================%NC%
echo.

REM ========================================
REM 解析参数
REM ========================================
set "QUICK_MODE=false"
set "FULL_MODE=false"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h" goto :show_help
if /i "%~1"=="--quick" set "QUICK_MODE=true"
if /i "%~1"=="--full" set "FULL_MODE=true"
shift
goto :parse_args
:args_done

REM ========================================
REM 检查 curl 是否可用
REM ========================================
where curl >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%[!]%NC% curl 未安装，部分检查将被跳过
    set "HAS_CURL=false"
) else (
    set "HAS_CURL=true"
)

REM ========================================
REM 基础检查
REM ========================================
echo %BOLD%[基础检查]%NC%
echo.

REM 检查进程
echo %CYAN%[CHECK]%NC% 检查后端服务进程...
if exist "%BACKEND_PID_FILE%" (
    set /p "BACKEND_PID="<"%BACKEND_PID_FILE%"
    
    REM 检查进程是否存在
    tasklist /FI "PID eq !BACKEND_PID!" 2>nul | find "node" >nul
    if !errorlevel! equ 0 (
        echo %GREEN%[OK]%NC% 后端服务正在运行 ^(PID: !BACKEND_PID!^)
    ) else (
        echo %YELLOW%[!]%NC% 后端服务 PID 文件存在但进程未运行 ^(PID: !BACKEND_PID!^)
        set /a ERRORS+=1
    )
) else (
    echo %YELLOW%[!]%NC% 后端服务 PID 文件不存在
)

echo.

echo %CYAN%[CHECK]%NC% 检查前端服务进程...
if exist "%FRONTEND_PID_FILE%" (
    set /p "FRONTEND_PID="<"%FRONTEND_PID_FILE%"
    
    tasklist /FI "PID eq !FRONTEND_PID!" 2>nul | find "node" >nul
    if !errorlevel! equ 0 (
        echo %GREEN%[OK]%NC% 前端服务正在运行 ^(PID: !FRONTEND_PID!^)
    ) else (
        echo %YELLOW%[!]%NC% 前端服务 PID 文件存在但进程未运行 ^(PID: !FRONTEND_PID!^)
    )
) else (
    echo %YELLOW%[!]%NC% 前端服务 PID 文件不存在
)

echo.

REM ========================================
REM 检查端口
REM ========================================
echo %CYAN%[CHECK]%NC% 检查端口 %BACKEND_PORT% ^(后端 HTTP^)...
netstat -ano | findstr ":%BACKEND_PORT% " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%BACKEND_PORT% " ^| findstr "LISTENING"') do set "BACKEND_PID=%%A"
    echo %GREEN%[OK]%NC% 端口 %BACKEND_PORT% 已被监听 ^(PID: !BACKEND_PID!^)
) else (
    echo %RED%[X]%NC% 端口 %BACKEND_PORT% 未被监听
    set /a ERRORS+=1
)

echo.

echo %CYAN%[CHECK]%NC% 检查端口 3001 ^(后端 WebSocket^)...
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do set "WS_PID=%%A"
    echo %GREEN%[OK]%NC% 端口 3001 已被监听 ^(PID: !WS_PID!^)
) else (
    echo %RED%[X]%NC% 端口 3001 未被监听
    set /a ERRORS+=1
)

echo.

REM 读取前端实际端口
if exist "%FRONTEND_PORT_FILE%" (
    set /p "FRONTEND_PORT="<"%FRONTEND_PORT_FILE%"
)

echo %CYAN%[CHECK]%NC% 检查端口 !FRONTEND_PORT! ^(前端^)...
netstat -ano | findstr ":!FRONTEND_PORT! " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":!FRONTEND_PORT! " ^| findstr "LISTENING"') do set "FRONTEND_PID=%%A"
    echo %GREEN%[OK]%NC% 端口 !FRONTEND_PORT! 已被监听 ^(PID: !FRONTEND_PID!^)
) else (
    echo %RED%[X]%NC% 端口 !FRONTEND_PORT! 未被监听
    set /a ERRORS+=1
)

echo.

if "%QUICK_MODE%"=="true" goto :show_summary

REM ========================================
REM API 检查
REM ========================================
echo %BOLD%[API 端点检查]%NC%
echo.

if "%HAS_CURL%"=="true" (
    echo %CYAN%[CHECK]%NC% 验证后端健康检查...
    curl -s --max-time 5 "http://localhost:%BACKEND_PORT%/health" >nul 2>&1
    if !errorlevel! equ 0 (
        echo %GREEN%[OK]%NC% 后端健康检查通过
    ) else (
        echo %RED%[X]%NC% 后端健康检查失败
        set /a ERRORS+=1
    )
    echo.
    
    if "%FULL_MODE%"=="true" (
        echo %CYAN%[CHECK]%NC% 验证文件监听服务...
        curl -s --max-time 5 "http://localhost:%BACKEND_PORT%/api/file-watcher/status" >nul 2>&1
        if !errorlevel! equ 0 (
            echo %GREEN%[OK]%NC% 文件监听服务正常
        ) else (
            echo %YELLOW%[!]%NC% 文件监听服务可能未启动或异常
        )
        echo.
        
        echo %CYAN%[CHECK]%NC% 验证同步锁服务...
        curl -s --max-time 5 "http://localhost:%BACKEND_PORT%/api/sync-lock/status" >nul 2>&1
        if !errorlevel! equ 0 (
            echo %GREEN%[OK]%NC% 同步锁服务正常
        ) else (
            echo %YELLOW%[!]%NC% 同步锁服务可能未启动或异常
        )
        echo.
    )
    
    echo %CYAN%[CHECK]%NC% 验证前端服务...
    curl -s --max-time 5 -o nul -w "%%{http_code}" "http://localhost:!FRONTEND_PORT!" 2>nul | findstr "200" >nul
    if !errorlevel! equ 0 (
        echo %GREEN%[OK]%NC% 前端服务正常 ^(端口: !FRONTEND_PORT!^)
    ) else (
        echo %RED%[X]%NC% 前端服务异常
        set /a ERRORS+=1
    )
    echo.
) else (
    echo %YELLOW%[!]%NC% curl 未安装，跳过 HTTP 检查
    echo.
)

REM ========================================
REM 显示摘要
REM ========================================
:show_summary
echo %BOLD%============================================================%NC%
echo %BOLD%服务状态摘要%NC%
echo %BOLD%============================================================%NC%
echo.

if %ERRORS% equ 0 (
    echo %GREEN%[OK]%NC% 所有服务运行正常！
    echo.
    echo   访问地址: http://localhost:!FRONTEND_PORT!
    echo   后端 API: http://localhost:%BACKEND_PORT%
    echo.
) else (
    echo %YELLOW%[!]%NC% 部分服务异常，请检查日志
    echo.
    echo   查看日志:
    echo     后端: type tmp\backend.log
    echo     前端: type tmp\frontend.log
    echo.
    echo   重启服务:
    echo     stop.bat ^&^& start.bat
    echo.
)

pause
exit /b %ERRORS%

REM ========================================
REM 帮助信息
REM ========================================
:show_help
echo OpenClaw Visualization 服务验证脚本
echo.
echo 用法:
echo   %~nx0 [选项]
echo.
echo 选项:
echo   --help, -h       显示此帮助信息
echo   --quick          快速检查（仅检查端口）
echo   --full           完整检查（包含 API 端点）
echo.
echo 示例:
echo   %~nx0               标准检查
echo   %~nx0 --quick       快速检查
echo   %~nx0 --full        完整检查
pause
exit /b 0