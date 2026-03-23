@echo off
REM OpenClaw Visualization 一键安装脚本 (Windows)
REM 新用户在干净机器上快速启动可视化看板后端/前端

setlocal enabledelayedexpansion

REM 项目根目录（当前文件位于 scripts\cli）
for %%I in ("%~dp0..\..") do set "PROJECT_ROOT=%%~fI\"
set "BACKEND_DIR=%PROJECT_ROOT%src\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%src\frontend"
set "CONFIG_DIR=%BACKEND_DIR%\config"
set "CONFIG_FILE=%CONFIG_DIR%\openclaw.json"
set "CONFIG_EXAMPLE=%CONFIG_DIR%\openclaw.json.example"
set "ENV_FILE=%PROJECT_ROOT%.env"
set "DEFAULT_TASKS_ROOT_REL=local\tasks"
set "DEFAULT_TASKS_ROOT_ABS=%PROJECT_ROOT%local\tasks"

REM 最低版本要求
set "MIN_NODE_VERSION=18"
set "MIN_NPM_VERSION=8"

REM 颜色定义（Windows 10+）
for /F %%A in ('echo prompt $E ^| cmd') do set "ESC=%%A"
set "BLUE=%ESC%[34m"
set "GREEN=%ESC%[32m"
set "YELLOW=%ESC%[33m"
set "RED=%ESC%[31m"
set "CYAN=%ESC%[36m"
set "BOLD=%ESC%[1m"
set "NC=%ESC%[0m"

echo.
echo %CYAN%============================================================%NC%
echo %CYAN%  %BOLD%OpenClaw Visualization 安装向导%NC%
echo %CYAN%============================================================%NC%
echo.

REM ========================================
REM 解析参数
REM ========================================
set "SKIP_DEPS=false"
set "CHECK_ONLY=false"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h" goto :show_help
if /i "%~1"=="--skip-deps" set "SKIP_DEPS=true"
if /i "%~1"=="--check-only" set "CHECK_ONLY=true"
shift
goto :parse_args
:args_done

REM ========================================
REM 检查 Node.js
REM ========================================
echo %CYAN%[STEP]%NC% 检查 Node.js 环境...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[X]%NC% Node.js 未安装
    echo.
    echo %BLUE%[INFO]%NC% 请先安装 Node.js %MIN_NODE_VERSION% 或更高版本：
    echo.
    echo   访问: https://nodejs.org/
    echo   下载 LTS 版本并安装
    echo.
    pause
    exit /b 1
)

REM 获取 Node.js 版本
for /f "tokens=1 delims=v" %%A in ('node --version') do set "NODE_VERSION=%%A"
for /f "tokens=1 delims=." %%A in ("%NODE_VERSION%") do set "NODE_MAJOR=%%A"

echo %BLUE%[INFO]%NC% Node.js 版本: v%NODE_VERSION%

if %NODE_MAJOR% LSS %MIN_NODE_VERSION% (
    echo %RED%[X]%NC% Node.js 版本过低 ^(需要 ^>= %MIN_NODE_VERSION%^)
    echo %BLUE%[INFO]%NC% 当前版本: v%NODE_VERSION%
    echo.
    echo %BLUE%[INFO]%NC% 请升级 Node.js：
    echo   访问: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo %GREEN%[OK]%NC% Node.js 版本满足要求 ^(^>= %MIN_NODE_VERSION%^)

REM ========================================
REM 检查 npm
REM ========================================
echo %CYAN%[STEP]%NC% 检查 npm 环境...

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%[X]%NC% npm 未安装
    echo.
    echo %BLUE%[INFO]%NC% npm 通常随 Node.js 一起安装，请重新安装 Node.js
    pause
    exit /b 1
)

REM 获取 npm 版本
for /f "tokens=1 delims=." %%A in ('npm --version') do set "NPM_MAJOR=%%A"
for /f %%A in ('npm --version') do set "NPM_VERSION=%%A"

echo %BLUE%[INFO]%NC% npm 版本: %NPM_VERSION%

if %NPM_MAJOR% LSS %MIN_NPM_VERSION% (
    echo %YELLOW%[!]%NC% npm 版本较低 ^(建议 ^>= %MIN_NPM_VERSION%^)
    echo %BLUE%[INFO]%NC% 可以运行 'npm install -g npm@latest' 升级
) else (
    echo %GREEN%[OK]%NC% npm 版本满足要求 ^(^>= %MIN_NPM_VERSION%^)
)

echo.

if "%CHECK_ONLY%"=="true" (
    echo %GREEN%[OK]%NC% 环境检查通过！
    pause
    exit /b 0
)

REM ========================================
REM 创建 tmp 目录
REM ========================================
echo %CYAN%[STEP]%NC% 创建临时目录...

if exist "%PROJECT_ROOT%tmp" (
    echo %BLUE%[INFO]%NC% tmp 目录已存在
) else (
    mkdir "%PROJECT_ROOT%tmp"
    echo %GREEN%[OK]%NC% 已创建 tmp 目录
)

if not exist "%PROJECT_ROOT%tmp\logs" mkdir "%PROJECT_ROOT%tmp\logs"
type nul > "%PROJECT_ROOT%tmp\.gitkeep" 2>nul

REM ========================================
REM 配置任务运行态目录（默认 local\tasks）
REM ========================================
echo.
echo %CYAN%[STEP]%NC% 配置任务运行态目录...

if not exist "%ENV_FILE%" (
    type nul > "%ENV_FILE%"
)

findstr /b /c:"OPENCLAW_VIS_TASKS_ROOT=" "%ENV_FILE%" >nul 2>&1
if %errorlevel% neq 0 (
    echo OPENCLAW_VIS_TASKS_ROOT=%DEFAULT_TASKS_ROOT_REL%>> "%ENV_FILE%"
)

if not exist "%DEFAULT_TASKS_ROOT_ABS%" mkdir "%DEFAULT_TASKS_ROOT_ABS%"
if not exist "%DEFAULT_TASKS_ROOT_ABS%\projects.json" (
    if exist "%PROJECT_ROOT%tasks\projects.json" copy "%PROJECT_ROOT%tasks\projects.json" "%DEFAULT_TASKS_ROOT_ABS%\projects.json" >nul
)
if not exist "%DEFAULT_TASKS_ROOT_ABS%\example-project-tasks.json" (
    if exist "%PROJECT_ROOT%tasks\example-project-tasks.json" copy "%PROJECT_ROOT%tasks\example-project-tasks.json" "%DEFAULT_TASKS_ROOT_ABS%\example-project-tasks.json" >nul
)

echo %GREEN%[OK]%NC% 任务运行态目录已设置为: local\tasks
echo %BLUE%[INFO]%NC% 本地任务数据将写入 local\tasks ^(默认不进入 Git^)

REM ========================================
REM 检查配置文件
REM ========================================
echo.
echo %CYAN%[STEP]%NC% 检查配置文件...

if exist "%CONFIG_FILE%" (
    echo %GREEN%[OK]%NC% 配置文件已存在: src\backend\config\openclaw.json
    
    findstr /C:"your-gateway-token-here" "%CONFIG_FILE%" >nul 2>&1
    if %errorlevel% equ 0 (
        echo %YELLOW%[!]%NC% 配置文件中包含占位符，请确保已填写真实的 Gateway Token
    )
) else (
    echo %YELLOW%[!]%NC% 配置文件不存在
    
    if exist "%CONFIG_EXAMPLE%" (
        echo %BLUE%[INFO]%NC% 正在从示例配置创建配置文件...
        copy "%CONFIG_EXAMPLE%" "%CONFIG_FILE%" >nul
        echo %GREEN%[OK]%NC% 已创建配置文件: src\backend\config\openclaw.json
        echo.
        echo %YELLOW%[!]%NC% 请编辑配置文件，填入你的 Gateway Token：
        echo.
        echo   notepad src\backend\config\openclaw.json
        echo.
        echo %BLUE%[INFO]%NC% 获取 Gateway Token：
        echo   1. 确保 OpenClaw Gateway 已启动: openclaw gateway start
        echo   2. 查看 Token: openclaw gateway status
        echo.
    ) else (
        echo %YELLOW%[!]%NC% 示例配置文件不存在，请手动创建配置文件
    )
)

echo.

if "%SKIP_DEPS%"=="true" (
    echo %BLUE%[INFO]%NC% 跳过依赖安装
    echo.
    goto :show_next_steps
)

REM ========================================
REM 安装后端依赖
REM ========================================
echo %CYAN%[STEP]%NC% 安装后端依赖...

cd /d "%BACKEND_DIR%"

if exist "node_modules" (
    echo %BLUE%[INFO]%NC% 检测到已有依赖，检查是否需要更新...
    
    npm install --silent
    echo %GREEN%[OK]%NC% 后端依赖已更新
) else (
    echo %BLUE%[INFO]%NC% 正在安装后端依赖...
    npm install --silent
    echo %GREEN%[OK]%NC% 后端依赖安装完成
)

echo.

REM ========================================
REM 安装前端依赖
REM ========================================
echo %CYAN%[STEP]%NC% 安装前端依赖...

cd /d "%FRONTEND_DIR%"

if exist "node_modules" (
    echo %BLUE%[INFO]%NC% 检测到已有依赖，检查是否需要更新...
    
    npm install --silent
    echo %GREEN%[OK]%NC% 前端依赖已更新
) else (
    echo %BLUE%[INFO]%NC% 正在安装前端依赖...
    npm install --silent
    echo %GREEN%[OK]%NC% 前端依赖安装完成
)

cd /d "%PROJECT_ROOT%"
echo.

REM ========================================
REM 显示下一步
REM ========================================
:show_next_steps
echo %GREEN%============================================================%NC%
echo %GREEN%  %BOLD%安装完成！%NC%
echo %GREEN%============================================================%NC%
echo.
echo %BOLD%下一步操作：%NC%
echo.
echo   1. %CYAN%配置 Gateway Token%NC%（如果还没有配置）
echo      notepad src\backend\config\openclaw.json
echo.
echo   2. %CYAN%启动服务%NC%
echo      clawboard.bat start
echo.
echo   3. %CYAN%访问应用%NC%
echo      http://localhost:5173
echo.
echo   4. %CYAN%验证服务状态%NC%
echo      clawboard.bat status
echo.
echo %BOLD%常用命令：%NC%
echo.
echo   clawboard.bat start     启动服务
echo   clawboard.bat stop      停止服务
echo   clawboard.bat status    验证服务状态
echo.
echo %BOLD%获取帮助：%NC%
echo.
echo   查看 README.md 或 docs\INSTALL.md 了解更多
echo   GitHub: https://github.com/CCCaptain0129/ClawBoard
echo.
pause
exit /b 0

REM ========================================
REM 帮助信息
REM ========================================
:show_help
echo OpenClaw Visualization 安装脚本
echo.
echo 用法:
echo   %~nx0 [选项]
echo.
echo 选项:
echo   --help, -h       显示此帮助信息
echo   --skip-deps      跳过依赖安装（仅检查环境）
echo   --check-only     仅检查环境，不执行安装
echo.
echo 示例:
echo   %~nx0               执行完整安装
echo   %~nx0 --check-only  仅检查环境
pause
exit /b 0
