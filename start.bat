@echo off
rem VishaSynapse 실행: 의존성 설치(npm ci) 후 서버 시작(npm start)
chcp 65001 > nul
cd /d "%~dp0"

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
