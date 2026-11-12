@echo off
setlocal
cd /d "%~dp0app"
powershell -NoProfile -NonInteractive -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:4180/api/telemetry' -TimeoutSec 2; if ($r.application -eq 'PulseDeck') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  start "" "http://127.0.0.1:4180/"
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
call npm run build
if errorlevel 1 (
  pause
  exit /b 1
)
set PORT=4180
start "" "http://127.0.0.1:4180/"
call npm start
pause
