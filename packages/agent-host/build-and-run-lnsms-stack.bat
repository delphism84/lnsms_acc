@echo off
setlocal
set ROOT=%~dp0..\..
set PROJ=%~dp0CareReceiverAgent.Host.csproj

echo Repo: %ROOT%
echo Project: %PROJ%
echo.
echo Starting CareReceiverAgent.Host (LocalStack + :58000)...
echo   BE  http://127.0.0.1:40000/health
echo   FE  http://127.0.0.1:63001
echo   Agent http://localhost:58000
echo   Store http://127.0.0.1:63001/s/a1/s1/setting
echo.
echo Killing listeners on 27017, 40000, 63001, 58000 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\kill-lnsms-ports.ps1"
if errorlevel 1 (
    echo kill-lnsms-ports.ps1 failed
    pause
    exit /b 1
)
echo.
echo (Debug build uses console - look for [LocalStack] lines below.)
echo.

dotnet run --project "%PROJ%" --configuration Debug
set EXIT=%ERRORLEVEL%
if %EXIT% neq 0 (
    echo.
    echo dotnet run failed with exit code %EXIT%
    pause
)
exit /b %EXIT%
