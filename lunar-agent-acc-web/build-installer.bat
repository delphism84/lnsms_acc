@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

echo ========================================
echo LNSMS installer build
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "FRONTEND_DIR=frontend"
set "HOST_PROJECT=CareReceiverAgent.Host\CareReceiverAgent.Host.csproj"
set "INNOSETUP_SCRIPT=setup.iss"

echo Step 1/5: clean old Release and installer folder...
if exist "CareReceiverAgent.Host\bin\Release" rmdir /s /q "CareReceiverAgent.Host\bin\Release"
if exist "installer" rmdir /s /q "installer"
echo Done.
echo.

echo Step 2/5: frontend npm run build...
pushd "%FRONTEND_DIR%"
if not exist "node_modules" (
  echo npm install...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    popd
    exit /b 1
  )
)
call npm run build
if errorlevel 1 (
  echo frontend build failed.
  popd
  exit /b 1
)
popd
echo Done.
echo.

echo Step 3/5: dotnet publish Host...
dotnet publish "%HOST_PROJECT%" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o "CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish"
if errorlevel 1 (
  echo dotnet publish failed.
  exit /b 1
)
echo Done.
echo.

echo Step 4/5: copy frontend dist to publish wwwroot...
set "SRC_DIR=%CD%\%FRONTEND_DIR%\dist"
set "DST_DIR=%CD%\CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish\wwwroot"
if not exist "%SRC_DIR%" (
  echo Missing dist: %SRC_DIR%
  exit /b 1
)
if not exist "%DST_DIR%" mkdir "%DST_DIR%"
robocopy "%SRC_DIR%" "%DST_DIR%" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 (
  echo robocopy failed.
  exit /b 1
)
echo Done.
echo.

echo Step 5/5: Inno Setup compile...
set "INNO_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist "!INNO_PATH!" set "INNO_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
if not exist "!INNO_PATH!" (
  echo ISCC.exe not found. Install Inno Setup 6.
  exit /b 1
)

for %%I in ("!INNO_PATH!") do set "INNO_PATH=%%~sI"
"!INNO_PATH!" "%SCRIPT_DIR%%INNOSETUP_SCRIPT%"
if errorlevel 1 (
  echo Inno compile failed.
  exit /b 1
)

echo.
echo ========================================
echo Build OK. Output: installer\*.exe
echo ========================================
echo.

exit /b 0
