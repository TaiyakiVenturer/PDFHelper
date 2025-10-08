# PDFHelper GPU 環境配置工具 - PowerShell 版本
# 設定 UTF-8 編碼以支援中文
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "PDFHelper GPU 環境配置"

function Show-Menu {
    Clear-Host
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "               PDFHelper GPU 環境配置工具" -ForegroundColor Yellow
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "請選擇您要安裝的 PyTorch 版本：" -ForegroundColor White
    Write-Host ""
    Write-Host "  1. 自動檢測 (推薦)" -ForegroundColor Green
    Write-Host "  2. CPU 版本 (無 GPU 或相容性優先)" -ForegroundColor White
    Write-Host "  3. CUDA 11.8 版本" -ForegroundColor Yellow
    Write-Host "  4. CUDA 12.6 版本" -ForegroundColor Yellow
    Write-Host "  5. CUDA 12.8 版本" -ForegroundColor Yellow
    Write-Host "  6. 退出" -ForegroundColor Red
    Write-Host ""
}

function Install-PyTorch {
    param(
        [string]$GpuType,
        [string]$GpuDesc
    )
    
    Clear-Host
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "正在安裝 $GpuDesc PyTorch..." -ForegroundColor Yellow
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        switch ($GpuType) {
            "cpu" {
                Write-Host "📱 安裝 CPU 版本 PyTorch" -ForegroundColor Cyan
                & uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
            }
            "cu118" {
                Write-Host "🚀 安裝 CUDA 11.8 版本 PyTorch" -ForegroundColor Green
                & uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
            }
            "cu126" {
                Write-Host "🚀 安裝 CUDA 12.6 版本 PyTorch" -ForegroundColor Green
                & uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
            }
            "cu128" {
                Write-Host "🚀 安裝 CUDA 12.8 版本 PyTorch" -ForegroundColor Green
                & uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
            }
            "auto" {
                Write-Host "🔍 自動檢測 GPU 環境..." -ForegroundColor Yellow
                
                # 檢測 NVIDIA GPU
                $null = Get-Command nvidia-smi -ErrorAction SilentlyContinue
                if ($? -and (nvidia-smi 2>$null)) {
                    Write-Host "🚀 檢測到 NVIDIA GPU，安裝 CUDA 12.6 版本" -ForegroundColor Green
                    & uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
                } else {
                    Write-Host "📱 未檢測到 NVIDIA GPU，安裝 CPU 版本" -ForegroundColor Cyan
                    & uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
                }
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            Test-Installation
        } else {
            Write-Host "❌ 安裝過程中發生錯誤，請檢查網路連接或嘗試其他選項" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ 安裝失敗: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Test-Installation {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "驗證安裝結果..." -ForegroundColor Yellow
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        $result = & uv run python -c "import torch; print(f'PyTorch 版本: {torch.__version__}'); print(f'CUDA 可用: {torch.cuda.is_available()}')" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $result -ForegroundColor Green
            Write-Host ""
            Write-Host "================================================================" -ForegroundColor Cyan
            Write-Host "✅ GPU 環境設置完成！" -ForegroundColor Green
            Write-Host "================================================================" -ForegroundColor Cyan
        } else {
            Write-Host "❌ 驗證失敗，但安裝可能已完成" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
        }
    }
    catch {
        Write-Host "❌ 驗證過程中發生錯誤: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "按任意鍵繼續..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# 主程式迴圈
do {
    Show-Menu
    
    $choice = Read-Host "請輸入選項編號 (1-6) [預設: 1]"
    
    # 設定預設值
    if ([string]::IsNullOrWhiteSpace($choice)) {
        $choice = "1"
    }
    
    switch ($choice) {
        "1" {
            Install-PyTorch -GpuType "auto" -GpuDesc "自動檢測"
        }
        "2" {
            Install-PyTorch -GpuType "cpu" -GpuDesc "CPU 版本"
        }
        "3" {
            Install-PyTorch -GpuType "cu118" -GpuDesc "CUDA 11.8 版本"
        }
        "4" {
            Install-PyTorch -GpuType "cu126" -GpuDesc "CUDA 12.6 版本"
        }
        "5" {
            Install-PyTorch -GpuType "cu128" -GpuDesc "CUDA 12.8 版本"
        }
        "6" {
            Write-Host ""
            Write-Host "👋 感謝使用 PDFHelper GPU 配置工具！" -ForegroundColor Green
            Write-Host ""
            Write-Host "按任意鍵退出..." -ForegroundColor Gray
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            $continueLoop = $false
        }
        default {
            Write-Host ""
            Write-Host "❌ 無效的選項，請輸入 1-6 之間的數字" -ForegroundColor Red
            Write-Host ""
            Write-Host "按任意鍵繼續..." -ForegroundColor Gray
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
} while ($continueLoop -ne $false)