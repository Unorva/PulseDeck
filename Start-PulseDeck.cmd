@echo off
setlocal
if exist "%~dp0release\PulseDeck-Portable-0.4.0-x64.exe" (
  start "" "%~dp0release\PulseDeck-Portable-0.4.0-x64.exe"
  exit /b 0
)
if exist "%~dp0release\win-unpacked\PulseDeck.exe" (
  start "" "%~dp0release\win-unpacked\PulseDeck.exe"
  exit /b 0
)
cd /d "%~dp0app"
if exist "node_modules\electron\dist\electron.exe" (
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b 0
)
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run desktop:prepare
if errorlevel 1 (
  pause
  exit /b 1
)
call npm run desktop
pause
