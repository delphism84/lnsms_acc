@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo Care Receiver Agent - Process Killer
echo ========================================
echo.

set HOST_PROCESS=CareReceiverAgent.Host.exe

echo Host 프로세스 종료 중...
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

echo.
echo 프로세스 종료 완료!
timeout /t 2 /nobreak >nul
