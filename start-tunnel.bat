@echo off
chcp 65001 >nul
title 啟動外網網頁版穿透

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_tunnel.ps1"
pause
