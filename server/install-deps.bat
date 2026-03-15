@echo off
cd /d "%~dp0"
echo Installing server dependencies...
echo.

REM Try npm (Node.js installer adds this to PATH)
where npm >nul 2>&1
if %errorlevel% equ 0 (
  npm install
  goto :done
)

REM Try common Node.js install locations
if exist "C:\Program Files\nodejs\npm.cmd" (
  "C:\Program Files\nodejs\npm.cmd" install
  goto :done
)
if exist "%LOCALAPPDATA%\Programs\node\npm.cmd" (
  "%LOCALAPPDATA%\Programs\node\npm.cmd" install
  goto :done
)

echo Node.js / npm was not found.
echo.
echo 1. Install Node.js from https://nodejs.org (LTS version)
echo 2. Close and reopen your terminal (or Cursor)
echo 3. Run: cd "%~dp0" then: npm install
echo.
pause
:done
echo.
echo Done. No native build required (using sql.js).
