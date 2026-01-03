@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 장애인호출관리시스템 - 설치 패키지 빌드
echo ========================================
echo.

:: 현재 디렉토리 저장
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

:: 프로젝트 경로 설정
set FRONTEND_DIR=frontend
set HOST_PROJECT=CareReceiverAgent.Host\CareReceiverAgent.Host.csproj
set INNOSETUP_SCRIPT=setup.iss

echo [1/4] 기존 빌드 산출물 정리 중...
if exist "CareReceiverAgent.Host\bin\Release" (
    rmdir /s /q "CareReceiverAgent.Host\bin\Release"
)
if exist "installer" (
    rmdir /s /q "installer"
)
echo 정리 완료!
echo.

echo [2/4] 프론트엔드 빌드 중...
cd "%FRONTEND_DIR%"
if not exist "node_modules" (
    echo npm 패키지 설치 중...
    call npm install
    if %errorlevel% neq 0 (
        echo npm 설치 실패!
        cd ..
        pause
        exit /b 1
    )
)
echo 프론트엔드 빌드 중...
call npm run build
if %errorlevel% neq 0 (
    echo 프론트엔드 빌드 실패!
    cd ..
    pause
    exit /b 1
)
cd ..
echo 프론트엔드 빌드 완료!
echo.

echo [3/4] 호스트 프로젝트 Release 빌드 중...
dotnet publish "%HOST_PROJECT%" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o "CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish"
if %errorlevel% neq 0 (
    echo 호스트 빌드 실패!
    pause
    exit /b 1
)
echo 호스트 빌드 완료!
echo.

echo [4/4] 프론트엔드 빌드 결과물을 Host wwwroot로 복사 중...
set SRC_DIR=%CD%\%FRONTEND_DIR%\dist
set DST_DIR=%CD%\CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish\wwwroot

if exist "%SRC_DIR%" (
    if not exist "%DST_DIR%" (
        mkdir "%DST_DIR%"
    )
    robocopy "%SRC_DIR%" "%DST_DIR%" /E /NFL /NDL /NJH /NJS /NP
    if errorlevel 8 (
        echo 복사 실패!
        pause
        exit /b 1
    )
    echo 복사 완료!
) else (
    echo 프론트엔드 빌드 결과물을 찾을 수 없습니다: %SRC_DIR%
    pause
    exit /b 1
)
echo.

echo [5/5] InnoSetup으로 설치 패키지 생성 중...
set "INNO_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not exist "%INNO_PATH%" (
    set "INNO_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
)
if not exist "%INNO_PATH%" (
    echo InnoSetup을 찾을 수 없습니다!
    echo 다음 경로 중 하나에 설치되어 있는지 확인하세요:
    echo   - C:\Program Files (x86)\Inno Setup 6\ISCC.exe
    echo   - C:\Program Files\Inno Setup 6\ISCC.exe
    echo.
    echo 또는 InnoSetup이 설치되어 있다면 수동으로 setup.iss 파일을 컴파일하세요.
    pause
    exit /b 1
)

"%INNO_PATH%" "%SCRIPT_DIR%%INNOSETUP_SCRIPT%"
if %errorlevel% neq 0 (
    echo 설치 패키지 생성 실패!
    pause
    exit /b 1
)

echo.
echo ========================================
echo 설치 패키지 빌드 완료!
echo ========================================
echo 설치 파일 위치: installer\장애인호출관리시스템_Setup.exe
echo.

pause

