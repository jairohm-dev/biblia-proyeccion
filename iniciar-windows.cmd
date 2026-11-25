@echo off
setlocal
rem Biblia - doble clic para abrir el servidor en Windows.
rem Opciones: iniciar-windows.cmd -Ayuda
chcp 65001 >nul
set "BIBLIA_LANZADOR_CMD=1"
set "biblia_powershell=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%~dp0serve.ps1" (
  echo Falta serve.ps1. Extrae el ZIP completo y vuelve a abrir iniciar-windows.cmd.
  pause
  exit /b 1
)
if not exist "%biblia_powershell%" (
  echo Windows no pudo encontrar PowerShell. Biblia necesita Windows PowerShell.
  pause
  exit /b 1
)
if "%~1"=="" (
  "%biblia_powershell%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Menu
) else (
  "%biblia_powershell%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
)
set "biblia_resultado=%errorlevel%"
if not "%biblia_resultado%"=="0" (
  echo.
  echo Biblia se detuvo. Codigo de salida: %biblia_resultado%.
  pause
)
exit /b %biblia_resultado%
