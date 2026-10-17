@echo off
setlocal
cd /d "%~dp0"
title Dragon Nest Run Tracker

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22.12 or newer and try again.
  goto :fail
)

if not exist node_modules (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist dist\web\index.html (
  echo Building the app...
  call npm run build
  if errorlevel 1 goto :fail
)

rem If the server is already running, just open the browser.
netstat -ano | findstr /R /C:"127.0.0.1:3000 .*LISTENING" >nul
if not errorlevel 1 (
  echo Server is already running. Opening the browser.
  start http://localhost:3000
  exit /b 0
)

rem Open the browser after a short delay so the server is ready.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

echo.
echo Dragon Nest Run Tracker is running at http://localhost:3000
echo Close this window or press Ctrl+C to stop the server.
echo.
call npm start

echo.
echo Server stopped.
pause
exit /b 0

:fail
echo.
echo Something went wrong. Read the message above.
pause
exit /b 1