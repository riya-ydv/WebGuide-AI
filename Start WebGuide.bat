@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap-node.ps1"
if errorlevel 1 goto failed
"%~dp0.webguide-local\node\node.exe" "%~dp0scripts\launch-webguide.mjs" %*
if errorlevel 1 goto failed
exit /b 0
:failed
echo Setup could not finish. Review the message above and retry.
pause
exit /b 1
