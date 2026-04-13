@echo off
setlocal

cd /d "%~dp0"
start "OWCS Dev Server" cmd /k "npm run dev"

endlocal
