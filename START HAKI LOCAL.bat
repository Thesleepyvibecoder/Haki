@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ==========================================
echo          HAKI NFC - LOCAL STARTER
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this PC.
  echo Opening the official Node.js download page...
  start "" "https://nodejs.org/en/download"
  echo.
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)

set "HAKI_GLOBAL_ENV=%USERPROFILE%\.haki-nfc.env"

if not exist ".env" (
  if exist "%HAKI_GLOBAL_ENV%" (
    echo Restoring your saved Haki Supabase configuration...
    copy /Y "%HAKI_GLOBAL_ENV%" ".env" >nul
  ) else (
    echo First-time setup: Supabase connection.
    echo.
    set /p SUPABASE_URL=Paste your Supabase Project URL: 
    set /p SUPABASE_KEY=Paste your Supabase Publishable Key: 
    (
      echo VITE_SUPABASE_URL=!SUPABASE_URL!
      echo VITE_SUPABASE_PUBLISHABLE_KEY=!SUPABASE_KEY!
    ) > .env
    copy /Y ".env" "%HAKI_GLOBAL_ENV%" >nul
    echo.
    echo Supabase settings saved. Future Haki ZIPs will reuse them automatically.
  )
)

if not exist "node_modules" (
  echo Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed. Please send me a screenshot of this window.
    pause
    exit /b 1
  )
)

echo.
echo Starting Haki locally...
echo Keep this window open while using the local website.
echo.
start "Haki Local" cmd /k "cd /d "%~dp0" && npm run dev -- --host"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/"
exit /b 0
