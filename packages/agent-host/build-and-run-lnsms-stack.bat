@echo off
setlocal
set ROOT=%~dp0..\..
echo Repo: %ROOT%
echo.
echo 1) Optional: start stack without Host
echo    powershell -File "%ROOT%\scripts\dev-agent.ps1"
echo.
echo 2) Build and run CareReceiverAgent.Host (starts LocalStack + :58000)
echo    dotnet run --project "%~dp0CareReceiverAgent.Host.csproj"
echo.
pause
