@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "CMD=%~1"

if "%CMD%"=="" goto :help

shift

if /I "%CMD%"=="help" goto :help
if /I "%CMD%"=="-h" goto :help
if /I "%CMD%"=="--help" goto :help
if /I "%CMD%"=="install" goto :install
if /I "%CMD%"=="start" goto :start
if /I "%CMD%"=="stop" goto :stop
if /I "%CMD%"=="restart" goto :restart
if /I "%CMD%"=="verify" goto :verify
if /I "%CMD%"=="status" goto :status
if /I "%CMD%"=="token" goto :token

echo Unknown command: %CMD%
echo.
goto :help

:install
call "%PROJECT_ROOT%scripts\cli\install.bat" %*
goto :eof

:start
call "%PROJECT_ROOT%scripts\cli\start.bat" %*
goto :eof

:stop
call "%PROJECT_ROOT%scripts\cli\stop.bat" %*
goto :eof

:restart
call "%PROJECT_ROOT%scripts\cli\stop.bat"
call "%PROJECT_ROOT%scripts\cli\start.bat" %*
goto :eof

:verify
call "%PROJECT_ROOT%scripts\cli\verify.bat" %*
goto :eof

:status
call "%PROJECT_ROOT%scripts\cli\verify.bat" --quick %*
goto :eof

:token
set "ENV_FILE=%PROJECT_ROOT%.env"
if not exist "%ENV_FILE%" (
  echo No .env file found at: %ENV_FILE%
  echo Run: clawboard.bat install
  exit /b 1
)

set "BOARD_TOKEN="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b "BOARD_ACCESS_TOKEN=" "%ENV_FILE%"`) do (
  set "BOARD_TOKEN=%%B"
  goto :token_found
)

echo BOARD_ACCESS_TOKEN not found in .env
echo Run: clawboard.bat install
exit /b 1

:token_found
echo !BOARD_TOKEN!
goto :eof

:help
echo ClawBoard Unified CLI
echo.
echo Usage:
echo   clawboard.bat ^<command^> [args...]
echo.
echo Commands:
echo   install        Run install wizard
echo   start          Start services
echo   stop           Stop services
echo   restart        Restart services
echo   verify         Verify service health
echo   status         Alias of verify --quick
echo   token          Print BOARD_ACCESS_TOKEN from .env
echo   help           Show this help
echo.
echo Underlying scripts: scripts\cli\install.bat/start.bat/stop.bat/verify.bat
goto :eof
