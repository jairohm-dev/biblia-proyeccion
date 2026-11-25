@echo off
setlocal
rem Biblia - doble clic para abrir el servidor en Windows. No instala nada.
rem Opciones: iniciar-windows.cmd -Ayuda   (por ejemplo: -Puerto 4000, -SoloLocal, -RestablecerPin)
chcp 65001 >nul
set "BIBLIA_RED=1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 pause
