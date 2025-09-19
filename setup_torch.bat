@echo off
chcp 65001 >nul
title PDFHelper GPU 環境配置

:menu
cls
echo.
echo ================================================================
echo               PDFHelper GPU 環境配置工具
echo ================================================================
echo.
echo 請選擇您要安裝的 PyTorch 版本：
echo.
echo   1. 自動檢測 (推薦)
echo   2. CPU 版本 (無 GPU 或相容性優先)
echo   3. CUDA 11.8 版本
echo   4. CUDA 12.6 版本  
echo   5. CUDA 12.8 版本
echo   6. 退出
echo.

set /p choice="請輸入選項編號 (1-6) [預設: 1]: "

if "%choice%"=="" set choice=1

if "%choice%"=="1" goto auto
if "%choice%"=="2" goto cpu
if "%choice%"=="3" goto cu118
if "%choice%"=="4" goto cu126
if "%choice%"=="5" goto cu128
if "%choice%"=="6" goto exit
goto invalid

:auto
set GPU_TYPE=auto
set GPU_DESC=自動檢測
goto install

:cpu
set GPU_TYPE=cpu
set GPU_DESC=CPU 版本
goto install

:cu118
set GPU_TYPE=cu118
set GPU_DESC=CUDA 11.8 版本
goto install

:cu126
set GPU_TYPE=cu126
set GPU_DESC=CUDA 12.6 版本
goto install

:cu128
set GPU_TYPE=cu128
set GPU_DESC=CUDA 12.8 版本
goto install

:install
cls
echo.
echo ================================================================
echo 正在安裝 %GPU_DESC% PyTorch...
echo ================================================================
echo.

if "%GPU_TYPE%"=="cpu" (
    echo 📱 安裝 CPU 版本 PyTorch
    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    goto verify
)

if "%GPU_TYPE%"=="cu118" (
    echo 🚀 安裝 CUDA 11.8 版本 PyTorch
    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    goto verify
)

if "%GPU_TYPE%"=="cu126" (
    echo 🚀 安裝 CUDA 12.6 版本 PyTorch
    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
    goto verify
)

if "%GPU_TYPE%"=="cu128" (
    echo 🚀 安裝 CUDA 12.8 版本 PyTorch
    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
    goto verify
)

if "%GPU_TYPE%"=="auto" (
    echo 🔍 自動檢測 GPU 環境...
    nvidia-smi >nul 2>&1
    if errorlevel 1 (
        echo 📱 未檢測到 NVIDIA GPU，安裝 CPU 版本
        uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    ) else (
        echo 🚀 檢測到 NVIDIA GPU，安裝 CUDA 12.6 版本
        uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
    )
    goto verify
)

:verify
echo.
echo ================================================================
echo 驗證安裝結果...
echo ================================================================
echo.
uv run python -c "import torch; print(f'PyTorch 版本: {torch.__version__}'); print(f'CUDA 可用: {torch.cuda.is_available()}')"

echo.
echo ================================================================
echo ✅ GPU 環境設置完成！
echo ================================================================
echo.
pause
goto menu

:invalid
echo.
echo ❌ 無效的選項，請輸入 1-6 之間的數字
echo.
pause
goto menu

:exit
echo.
echo 👋 感謝使用 PDFHelper GPU 配置工具！
echo.
pause
exit /b