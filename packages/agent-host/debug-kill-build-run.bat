@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem bin\Debug\net9.0-windows\ 에서 실행 (빌드 출력 폴더)
set "EXE=CareReceiverAgent.Host.exe"
set "PROJ=%~dp0CareReceiverAgent.Host.csproj"

echo.
echo ========================================
echo  LNSMS Agent Host - Debug Kill/Build/Run
echo ========================================
echo  Output : %~dp0
echo  Project: %PROJ%
echo.

echo [1/3] Kill existing %EXE% ...
taskkill /F /IM %EXE% >nul 2>&1
if errorlevel 1 (
  echo   - no running process
) else (
  echo   - terminated
)
ping -n 2 127.0.0.1 >nul

echo [2/3] dotnet build Debug ...
where dotnet >nul 2>&1
if errorlevel 1 (
  echo ERROR: dotnet SDK not found in PATH
  pause
  exit /b 1
)
dotnet build "%PROJ%" -c Debug -v minimal
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  pause
  exit /b 1
)

echo [3/3] Start %EXE% ...
if not exist "%~dp0%EXE%" (
  echo ERROR: %~dp0%EXE% not found
  pause
  exit /b 1
)
start "CareReceiverAgent.Host" "%~dp0%EXE%"
echo.
echo Running. WebView opens LocalStack + http://127.0.0.1:63001/s/necall/guest/setting
echo Agent API: http://127.0.0.1:58000
echo.
pause
