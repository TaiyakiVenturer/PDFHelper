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
- **Flask** - RESTful API 框架
- **MinerU** - PDF 解析引擎
- **ChromaDB** - 向量資料庫
- **PyTorch** - 機器學習框架

### 前端
- **Node.js 18+**
- **Electron** - 跨平台桌面應用框架
- **JavaScript (ES6+)** - 主要開發語言
- **Marked.js** - Markdown 渲染引擎
- **KaTeX** - LaTeX 數學公式渲染

## 🚀 快速開始

### 環境需求
- Python 3.10 或更高版本
- uv 包管理器
- Git
- Node.js 18+（前端）

### 安裝步驟

1. **克隆專案**
```bash
git clone https://github.com/TaiyakiVenturer/PDFHelper.git
cd PDFHelper
```

2. **安裝基礎後端依賴**
```bash
uv sync
```

3. **安裝前端依賴**
```bash
cd frontend
npm install
cd ..
```

4. **安裝 PyTorch（自動偵測 CUDA）**

推薦使用一鍵安裝腳本：
```bash
uv run setup_torch.py
```

**腳本特點：**
- 自動偵測 CUDA 是否可用及版本
- 自動選擇最接近的支援 CUDA 版本（如 12.7 會自動安裝 12.6 版）
- 無 CUDA 則自動安裝 CPU 版本
- 僅支援 uv --reinstall，安裝全自動

**進階：手動配置**
```bash
# CPU 版本
uv pip install torch torchvision torchaudio --reinstall --index-url https://download.pytorch.org/whl/cpu

# CUDA 11.8
uv pip install torch torchvision torchaudio --reinstall --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.6
uv pip install torch torchvision torchaudio --reinstall --index-url https://download.pytorch.org/whl/cu126

# CUDA 12.8
uv pip install torch torchvision torchaudio --reinstall --index-url https://download.pytorch.org/whl/cu128
```

---

### 驗證 PyTorch 安裝

安裝完成後，建議先驗證 PyTorch 是否安裝成功：
```bash
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}')"
```

### 啟動 App

啟動前端桌面應用：
```bash
cd frontend
npm run start
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

## 📞 聯絡資訊

- **作者**: [TaiyakiVenturer](https://github.com/TaiyakiVenturer)

## � 專案結構

```
PDFHelper/
├── backend/                 # Python 後端服務
│   ├── api/                # Flask API 與核心邏輯
│   └── services/           # PDF、翻譯、RAG 服務
├── frontend/               # Electron 前端應用
│   ├── modules/            # 編譯後的 TypeScript 模組
│   ├── instance/           # 本地資料（設定、歷史記錄）
│   └── scripts/            # ⚠️ 已棄用（保留供歷史參考）
└── docs/                   # 專案文件
```

### ⚠️ 重要說明

**`frontend/scripts/` 資料夾已棄用**
- 此資料夾包含早期的 Python 腳本實作（chat.py, processor.py 等）
- 自 2025-10-13 起，所有功能已完全遷移至 Flask HTTP API
- 保留此資料夾僅供歷史參考，請勿使用其中的腳本
- 詳見：[API 遷移說明](./docs/TODO.md#階段二統一api介面整合)

## 📋 TODO

詳細的開發計畫請參考：
- [總體 TODO](./docs/TODO.md)
- [RAG 系統 TODO](./docs/TODO_RAG.md)

---

## ⚖️ 免責聲明

本軟體按 "現狀" 提供，不提供任何形式的保證。使用本軟體的風險由使用者自行承擔。

**注意**：本專案使用 AGPL-3.0 授權，在使用前請確保了解相關法律義務。如有疑問，請諮詢專業律師。