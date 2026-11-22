@echo off
rem VishaSynapse 실행: .env 확인 → 의존성 설치(npm ci) → 서버 시작(npm start)
chcp 65001 > nul
cd /d "%~dp0"

rem .env가 없으면 서버가 바로 종료되므로, 설정 폴더를 열어 주고 멈춘다 (Env.js와 같은 위치)
set "SERVER_DIR=%LOCALAPPDATA%\VishaSTD\server"
if not exist "%SERVER_DIR%\.env" (
    if not exist "%SERVER_DIR%" mkdir "%SERVER_DIR%"
    echo .env 파일이 없습니다: %SERVER_DIR%
    echo 열린 폴더에 .env를 넣은 뒤 다시 실행하세요.
    start "" explorer "%SERVER_DIR%"
    pause
    exit /b 1
)

echo [1/2] 의존성 설치 (npm ci --ignore-scripts)
call npm ci --ignore-scripts
if errorlevel 1 (
    echo 의존성 설치에 실패했습니다. 위 메시지를 확인하세요.
    pause
    exit /b 1
)

echo [2/2] 서버 시작 (npm start)
call npm start

echo 서버가 종료되었습니다.
pause
