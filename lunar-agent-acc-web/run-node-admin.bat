@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
REM Node BE: 60000, Admin FE: 60001. 탐색기에서 더블클릭 실행 권장.

echo ========================================
echo Node BE (60000) + Admin FE (60001)
echo Kill - Build - Run
echo ========================================
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo [1/4] Node 프로세스 종료 중 - 60000, 60001 포트 해제...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo   Done.
echo.

echo [2/4] Node BE (backend) 의존성 확인...
cd backend
if not exist "node_modules" (
    call npm install
    if !errorlevel! neq 0 ( echo npm install 실패 & cd .. & pause & exit /b 1 )
)
cd ..
echo.

echo [3/4] Admin FE (lnms-admin) 빌드...
cd lnms-admin
if not exist "node_modules" (
    call npm install
    if !errorlevel! neq 0 ( echo npm install 실패 & cd .. & pause & exit /b 1 )
)
call npm run build
if !errorlevel! neq 0 (
    echo Admin FE 빌드 실패!
    cd ..
    pause
    exit /b 1
)
cd ..
echo Admin FE 빌드 완료.
echo.

echo [4/4] 실행 중...
echo   Node BE: http://localhost:60000 (0.0.0.0:60000 외부접속)
echo   Admin FE: http://localhost:60001 (0.0.0.0:60001 외부접속)
echo.
start "NodeBE-60000" cmd /k "cd /d "%SCRIPT_DIR%backend" && set PORT=60000 && set HOST=0.0.0.0 && npm run start"
timeout /t 3 /nobreak >nul
start "AdminFE-60001" cmd /k "cd /d "%SCRIPT_DIR%lnms-admin" && npm run start"

echo.
echo ========================================
echo 완료. BE/FE 모두 0.0.0.0 바인딩 (방화벽에서 포트 허용 필요)
echo ========================================
if not "%1"=="/nopause" pause
