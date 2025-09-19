# PDFHelper - 智能PDF處理與分析系統

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TaiyakiVenturer/PDFHelper)

## 📖 專案簡介

PDFHelper 是一個基於 AI 的智能 PDF 處理系統，提供 PDF 解析、翻譯、向量檢索等功能。

## ✨ 主要功能

- 🔍 **PDF 智能解析** - 使用 MinerU 引擎進行高精度 PDF 內容提取
- 🌐 **多語言翻譯** - 支援多種語言的雙向翻譯
- 🧠 **RAG 檢索增強** - 基於 ChromaDB 的向量檢索系統
- 💬 **智能問答** - 與 PDF 內容進行自然語言對話
- 🎨 **現代化前端** - React + Material-UI 的直觀介面

## 🛠️ 技術架構

### 後端
- **Python 3.10+**
- **MinerU** - PDF 解析引擎
- **ChromaDB** - 向量資料庫
- **PyTorch** - 機器學習框架
- **Flask** - Web API 框架

### 前端 (正在開發中)
- **React 19**
- **TypeScript**
- **Material-UI**
- **Vite** - 建構工具

## 🚀 快速開始

### 環境需求
- Python 3.10 或更高版本
- uv 包管理器
- Git

### 安裝步驟

1. **克隆專案**
```bash
git clone https://github.com/TaiyakiVenturer/PDFHelper.git
cd PDFHelper
```

2. **安裝基礎依賴**
```bash
uv sync
```

3. **配置 GPU 環境**

**Windows 用戶（推薦）**：
直接點擊 `setup_torch.bat` 檔案，會出現互動式選單：
- 預設選擇自動檢測
- 支援 CPU、CUDA 11.8、CUDA 12.6、CUDA 12.8 版本
- 包含安裝驗證

**手動配置**：
```bash
# CPU 版本
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# CUDA 11.8
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.6
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# CUDA 12.8
uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

4. **驗證安裝**
```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}')"
```

### GPU 支援說明

- **有 NVIDIA GPU**: 建議使用對應的 CUDA 版本以獲得最佳性能
- **沒有 NVIDIA GPU**: 使用 CPU 版本，功能完全相同但速度較慢
- **不確定**: 使用自動檢測模式，腳本會自動選擇合適的版本

## 📄 授權資訊

本專案採用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 授權。

### ⚠️ 重要說明

由於使用了 MinerU (AGPL-3.0)，本專案必須採用 AGPL-3.0 授權，這意味著：

- ✅ **可以自由使用、修改和分發**
- ✅ **允許商業使用**
- ⚠️ **必須公開所有原始碼**
- ⚠️ **網路服務必須提供原始碼下載**
- ⚠️ **衍生作品必須採用相同授權**

詳細授權資訊請參考 [LICENSE_GUIDE.md](./docs/LICENSE_GUIDE.md)

### 第三方套件授權
- MinerU - AGPL-3.0
- ChromaDB - Apache-2.0
- PyTorch - BSD-3-Clause
- React - MIT

## 📞 聯絡資訊

- **作者**: [TaiyakiVenturer](https://github.com/TaiyakiVenturer)

## 📋 TODO

詳細的開發計畫請參考：
- [總體 TODO](./docs/TODO.md)
- [RAG 系統 TODO](./docs/TODO_RAG.md)

---

## ⚖️ 免責聲明

本軟體按 "現狀" 提供，不提供任何形式的保證。使用本軟體的風險由使用者自行承擔。

**注意**：本專案使用 AGPL-3.0 授權，在使用前請確保了解相關法律義務。如有疑問，請諮詢專業律師。