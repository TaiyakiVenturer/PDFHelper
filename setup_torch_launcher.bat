@echo off
chcp 65001 >nul
title PDFHelper GPU 環境配置

:: 檢查 PowerShell 是否可用
powershell -Command "exit" >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 PowerShell，請確保您使用的是 Windows 7 以上版本
    pause
    exit /b 1
)

:: 執行 PowerShell 腳本，繞過執行政策限制
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup_torch.ps1"

:: 如果 PowerShell 腳本執行失敗，暫停以顯示錯誤訊息
if errorlevel 1 (
    echo.
    echo ❌ PowerShell 腳本執行失敗
    pause
)