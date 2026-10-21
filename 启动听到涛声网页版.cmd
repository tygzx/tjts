@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0umi-reader\scripts\start-web.ps1"
if errorlevel 1 pause
