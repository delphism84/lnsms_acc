@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo Care Receiver Agent - Build, SFTP upload, Run
echo ========================================
echo.

:: 현재 디렉토리 저장
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

:: 프로젝트 경로 설정
set FRONTEND_DIR=frontend
set HOST_PROJECT=CareReceiverAgent.Host\CareReceiverAgent.Host.csproj

:: 프로세스 이름
set HOST_PROCESS=CareReceiverAgent.Host.exe

echo [1/6] 기존 프로세스 종료 중...
echo.

:: 호스트 프로세스 종료 (정확한 프로세스 이름으로 필터링)
echo Host 프로세스 확인 중...
set HOST_FOUND=0
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq %HOST_PROCESS%" /FO LIST 2^>nul ^| findstr /C:"PID:"') do (
    set HOST_PID=%%a
    set HOST_PID=!HOST_PID: =!
    if defined HOST_PID (
        echo Host 프로세스 발견: PID !HOST_PID!
        taskkill /PID !HOST_PID! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo Host 프로세스 종료 완료: PID !HOST_PID!
            set HOST_FOUND=1
        ) else (
            echo Host 프로세스 종료 실패: PID !HOST_PID!
        )
    )
)
if !HOST_FOUND! equ 0 (
    echo Host 프로세스가 실행 중이지 않습니다.
)

:: 프로세스가 완전히 종료될 때까지 대기
timeout /t 2 /nobreak >nul

echo.

echo [2/6] 프론트엔드 빌드 중...
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

echo [3/6] 프론트엔드 빌드 결과물을 Host wwwroot(Debug^)로 복사 중...
set SRC_DIR=%CD%\%FRONTEND_DIR%\dist
set DST_DIR=%CD%\CareReceiverAgent.Host\bin\Debug\net9.0-windows\wwwroot

if exist "%SRC_DIR%" (
    :: 대상 디렉토리가 없으면 생성
    if not exist "%DST_DIR%" (
        mkdir "%DST_DIR%"
    )
    
    :: 파일 복사 (robocopy 사용)
    robocopy "%SRC_DIR%" "%DST_DIR%" /E /NFL /NDL /NJH /NJS /NP
    if errorlevel 8 (
        echo 복사 실패!
        pause
        exit /b 1
    )
    
    :: 복사 확인
    if exist "%DST_DIR%\index.html" (
        echo 복사 완료: %DST_DIR%
    ) else (
        echo 복사 실패: index.html을 찾을 수 없습니다
        pause
        exit /b 1
    )
) else (
    echo 프론트엔드 빌드 결과물을 찾을 수 없습니다: %SRC_DIR%
    pause
    exit /b 1
)
echo.

echo [4/6] 호스트 프로젝트 빌드 중 (Debug, 로컬 실행용^)...
dotnet build "%HOST_PROJECT%" -c Debug
if %errorlevel% neq 0 (
    echo 호스트 빌드 실패!
    pause
    exit /b 1
)
echo 호스트 빌드 완료!

:: 아이콘 파일 복사 (빌드 출력에 포함되지 않은 경우)
if exist "CareReceiverAgent.Host\app.ico" (
    if not exist "CareReceiverAgent.Host\bin\Debug\net9.0-windows\app.ico" (
        copy /Y "CareReceiverAgent.Host\app.ico" "CareReceiverAgent.Host\bin\Debug\net9.0-windows\app.ico" >nul 2>&1
        echo 아이콘 파일 복사 완료
    )
)
echo.

echo [5/6] Release publish + wwwroot (SFTP 업로드용, build-installer.bat 과 동일 경로^)...
dotnet publish "%HOST_PROJECT%" -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o "CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish"
if %errorlevel% neq 0 (
    echo dotnet publish 실패!
    pause
    exit /b 1
)
set "PUB_WWW=%CD%\CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish\wwwroot"
if not exist "%PUB_WWW%" mkdir "%PUB_WWW%"
robocopy "%SRC_DIR%" "%PUB_WWW%" /E /NFL /NDL /NJH /NJS /NP
if errorlevel 8 (
    echo publish wwwroot 복사 실패!
    pause
    exit /b 1
)
echo publish 완료: CareReceiverAgent.Host\bin\Release\net9.0-windows\win-x64\publish
echo.

echo [6/6] SFTP 업로드 (LnuploaderFtp.exe, SSH.NET^)...
set "LNUPL=%SCRIPT_DIR%..\lnuploader_ftp\bin\Release\net48\LnuploaderFtp.exe"
set "LNUINI=%SCRIPT_DIR%..\lnuploader_ftp\bin\Release\net48\upload.ini"
if not exist "!LNUPL!" (
    echo [경고] LnuploaderFtp 없음: !LNUPL!
    echo        lnuploader_ftp 프로젝트에서 Release 빌드 후 다시 시도하세요.
) else if not exist "!LNUINI!" (
    echo [경고] upload.ini 없음: !LNUINI!
) else (
    echo 실행: "!LNUPL!" "!LNUINI!"
    "!LNUPL!" "!LNUINI!"
    if errorlevel 1 (
        echo SFTP 업로드에서 오류가 있었습니다 (종료 코드 !errorlevel!^).
    ) else (
        echo SFTP 업로드 완료.
    )
)
echo.

echo 애플리케이션 실행 중...
echo.

:: 호스트 실행 경로 (백엔드가 통합되어 있음)
set HOST_EXE=CareReceiverAgent.Host\bin\Debug\net9.0-windows\CareReceiverAgent.Host.exe

:: 호스트 실행 (백엔드가 내장되어 있음)
if exist "%HOST_EXE%" (
    echo 애플리케이션 시작 중...
    start "CareReceiverAgent.Host" "%HOST_EXE%"
    echo 애플리케이션 시작 완료!
) else (
    echo 실행 파일을 찾을 수 없습니다: %HOST_EXE%
    pause
    exit /b 1
)

echo.
echo ========================================
echo 빌드 및 실행 완료!
echo ========================================
echo.
echo 애플리케이션이 실행 중입니다.
echo 종료하려면 애플리케이션 창을 닫거나 kill-processes.bat를 실행하세요.
echo.
pause

