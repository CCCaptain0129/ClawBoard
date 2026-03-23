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

echo Unknown command: %CMD%
echo.
goto :help

:install
call "%PROJECT_ROOT%install.bat" %*
goto :eof

:start
call "%PROJECT_ROOT%start.bat" %*
goto :eof

:stop
call "%PROJECT_ROOT%stop.bat" %*
goto :eof

:restart
call "%PROJECT_ROOT%stop.bat"
call "%PROJECT_ROOT%start.bat" %*
goto :eof

:verify
call "%PROJECT_ROOT%verify.bat" %*
goto :eof

:status
call "%PROJECT_ROOT%verify.bat" --quick %*
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
echo   help           Show this help
echo.
echo Legacy scripts still work: install.bat/start.bat/stop.bat/verify.bat
goto :eof
