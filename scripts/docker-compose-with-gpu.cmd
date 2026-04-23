@echo off
REM Windows: без WSL/bash — вызывает PowerShell-скрипт с теми же аргументами.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker-compose-with-gpu.ps1" %*
