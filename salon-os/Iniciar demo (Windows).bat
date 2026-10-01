@echo off
rem Doble clic para arrancar la demo de Salon OS en Windows.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No encuentro Node.js. Instala la version LTS desde https://nodejs.org y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)
node scripts\demo.js
pause
