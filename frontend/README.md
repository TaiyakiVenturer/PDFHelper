# Electron PDF 解析前端應用

基於 Electron 的桌面 PDF 解析前端介面，搭配 PDFHelper 後端引擎，提供現代化的用戶體驗，包含拖放上傳、實時進度監控、Markdown 渲染和聊天整合功能。

## ✨ 主要功能

- 📄 **PDF 拖放上傳**：支援拖放或點擊選擇 PDF 文件
- 🔄 **實時處理進度**：智能進度條和詳細處理狀態
- 📋 **即時日誌顯示**：查看 MinerU 後端的實際處理過程
- 📝 **Markdown 渲染**：完整的 Markdown 和 LaTeX 公式支援
- 🖼️ **圖片路徑解析**：自動處理相對路徑圖片顯示
- 💬 **聊天整合**：基於處理結果的 AI 問答功能
- 📚 **處理歷史記錄**：保存處理記錄和元數據

## 🚀 快速開始

### 1. 系統需求

- **Node.js** 16+ 和 npm
- **Python** 3.10+ (建議使用 Anaconda)
- **Windows** 10+ (主要測試平台)

### 2. 安裝前端依賴

```powershell
# 安裝 Node.js 依賴
npm install
```

**注意**: 後端 Python 環境請參考 `../backend/` 目錄中的相關說明文件進行配置。

### 3. 啟動應用

```powershell
# 從 GitHub clone 後，進入前端目錄啟動
cd frontend
npm start
```

啟動後會出現桌面應用窗口，您可以拖放 PDF 文件開始處理。

## 📁 前端應用結構

```
frontend/                      # Electron 前端應用
├── main.js                    # Electron 主程序
├── preload.js                 # 安全 API 暴露
├── renderer.js                # 前端渲染邏輯
├── index.html                 # 使用者介面
├── package.json               # Node.js 依賴配置
├── VERSION_DIFF.md            # 版本更新記錄
├── README.md                  # 本文件
└── scripts/                   # Python 橋接腳本
    ├── processor.py           # 主處理協調器
    ├── pdfhelper_bridge.py    # PDFHelper 後端橋接
    └── chat.py                # 聊天功能腳本
```

**後端說明**: 後端 PDFHelper 引擎位於 `../backend/` 目錄，詳細配置請參考該目錄的說明文件。

### 關鍵組件說明

#### `main.js` - Electron 主程序
- **IPC 事件處理**: 處理前端與後端通訊
- **Python 程序管理**: 啟動和管理 Python 子程序
- **編碼配置**: 確保 UTF-8 正確處理
- **歷史記錄管理**: 處理結果的持久化存儲

#### `renderer.js` - 前端渲染引擎
- **Markdown 渲染**: 支援 KaTeX 數學公式
- **進度監控**: 智能進度條和狀態顯示
- **日誌管理**: 多層級日誌顯示和過濾
- **圖片路徑解析**: 相對路徑自動解析

#### `processor.py` - 處理協調器
- **進度追蹤**: 基於 MinerU 輸出的智能進度更新
- **錯誤處理**: 完善的異常捕獲和報告
- **編碼安全**: UTF-8 編碼問題的解決方案
- **實時通訊**: JSONL 事件流和日誌輸出

#### `pdfhelper_bridge.py` - 橋接模組
- **路徑管理**: 自動檢測和配置系統路徑
- **文件處理**: PDF 文件的安全複製和管理
- **MinerU 整合**: CLI 調用和輸出捕獲
- **結果封裝**: 標準化的輸出格式

## 外部內容注入（給同學的後端）

本專案提供一個極簡的內容注入介面，讓外部後端直接把 Markdown 結果送進前端畫面顯示：

- Renderer 端呼叫（建議）：
	- `window.electronAPI.externalInject(markdown)`
	- 或傳遞物件：`window.electronAPI.externalInject({ markdown, meta: { source: 'backend' } })`

- 主程序事件：
	- `ipcMain.on('external:content', (event, payload) => { webContents.send('process:evt', { type: 'done', content: payload.markdown }) })`
	- 已內建於 `main.js`，會把 `done` 事件與內容轉送給目前視窗，前端即會切換到結果畫面並渲染。

注意：此介面單純地把內容視為已完成結果，不走內建處理流程；若需要歷史紀錄或進度條，請改用既有的 `process:start` 事件流並於 Python 腳本輸出 JSONL 事件。

## 聊天整合（透過合作方 Python）

介面會在結果頁右側顯示聊天側欄。訊息送出時，前端會呼叫 `chat:ask`，主程序會啟動 `scripts/chat.py`，並透過 stdin 傳入一行 JSON：

輸入樣式（stdin）：
```json
{"question": "...使用者訊息...", "context": "...目前結果 markdown 或其他上下文..."}
```

輸出樣式（stdout 最後一行）：
```json
{"text": "...助理回覆文字..."}
```

你可以自由修改 `scripts/chat.py`，在其中串接你同學的後端（HTTP/WebSocket 皆可），最後只要把要顯示的回覆字串放到 `{"text": "..."}` 輸出即可。

## 🔧 前端環境配置

### Python 環境設定

前端需要 Python 環境來運行橋接腳本。`main.js` 會依下列優先順序尋找可用的 Python：

1. 環境變數 `PDFHELPER_PYTHON`、`PYTHON`、`PYTHON_PATH` 指定的可執行檔或命令。
2. 當前啟用的虛擬環境（`VIRTUAL_ENV` 或 `CONDA_PREFIX`），自動使用其中的 `Scripts/python.exe`（Windows）或 `bin/python`（macOS/Linux）。
3. Windows Python Launcher：`py -3`、`py`。
4. 一般系統命令：`python3`、`python`。
5. （為相容舊版）`C:\Users\User\anaconda3\python.exe`。

#### 建議做法

- 若使用 venv 或 conda，只要在啟用該環境後執行 `npm start`，應用就會自動使用對應的 Python。
- 若需明確指定執行檔，建議透過環境變數而非修改原始碼：

```powershell
# Windows PowerShell：設定當前工作階段的 Python
$env:PDFHELPER_PYTHON = "$env:USERPROFILE\.venv\Scripts\python.exe"
npm start
```

```bash
# macOS / Linux：設定當前工作階段的 Python
export PDFHELPER_PYTHON="$HOME/.venv/bin/python"
npm start
```

若想永久保留設定，可改用 `setx PDFHELPER_PYTHON "..."`（Windows）或將 `export` 指令寫入 shell 啟動腳本。

### MinerU 路徑設定

`scripts/pdfhelper_bridge.py` 會按以下優先順序尋找 MinerU CLI：

1. 環境變數 `PDFHELPER_MINERU_EXE` 指定的執行檔。
2. 環境變數 `PDFHELPER_MINERU_PATH` 指定的資料夾（會自動加入 PATH）。
3. 目前啟用的 venv / conda 環境內的 `Scripts/` 或 `bin/`。
4. 系統 PATH 中的 `mineru` 指令。
5. （相容舊版）曾經硬編碼的 Anaconda Scripts 目錄。

#### 範例設定

```powershell
# 直接指定 MinerU 可執行檔
$env:PDFHELPER_MINERU_EXE = "$env:USERPROFILE\.venv\Scripts\mineru.exe"

# 或指定包含 mineru 的資料夾
$env:PDFHELPER_MINERU_PATH = "$env:USERPROFILE\.venv\Scripts"
```

```bash
export PDFHELPER_MINERU_EXE="$HOME/.venv/bin/mineru"
# 或
export PDFHELPER_MINERU_PATH="$HOME/.venv/bin"
```

設定完成後重新啟動 Electron 應用，橋接腳本會自動使用指定位置。若仍找不到，請確認在終端機中執行 `mineru --version` 是否成功。

### 後端路徑配置

橋接腳本會自動偵測後端路徑，預設假設 `frontend` 與 `backend` 位於同一層，也保留對舊版巢狀目錄的相容性：

```python
PDFHELPER_ROOT = _discover_pdfhelper_root()
BACKEND_ROOT = _discover_backend_root(PDFHELPER_ROOT)
INSTANCE_ROOT = Path(os.getenv("PDFHELPER_INSTANCE", BACKEND_ROOT / "instance"))
```

**注意**: 詳細的後端配置請參考 `../backend/` 目錄中的說明文件。
```

#### 自定義後端路徑
如果專案結構不同於預設的「frontend 與 backend 並列」，可以透過環境變數覆寫路徑設定：

```powershell
# 設置自定義後端路徑
$env:PDFHELPER_ROOT = "D:\MyProject\PDFHelper"
$env:PDFHELPER_BACKEND = "D:\MyProject\PDFHelper\backend"
$env:PDFHELPER_INSTANCE = "D:\Data\pdfhelper_instance"
```

一旦設置，上述環境變數會在 `pdfhelper_bridge.py` 初始化時被讀取，無需修改原始碼。

### Electron 打包注意事項

打包為 Electron 應用後，執行檔會在 `resources/app`（或 `resources/app.asar`）內運行，此時工作目錄與開發模式不同，請特別留意：

- **保留後端檔案**：請在打包工具（例如 electron-builder）的 `extraResources` 或同等設定中，將整個 `backend/` 目錄連同 `instance/` 子資料夾一併放到最終安裝資料夾（常見路徑為 `resources/backend`）。
- **設定環境變數**：在主程序啟動時，明確指定後端位置，例如：
    ```javascript
    const path = require('path');
    process.env.PDFHELPER_ROOT = path.join(process.resourcesPath, '..');
    process.env.PDFHELPER_BACKEND = path.join(process.resourcesPath, '..', 'backend');
    ```
    如需自訂輸出資料夾，也可同時設定 `PDFHELPER_INSTANCE`。
- **避免 ASAR 壓縮 Python 腳本**：`scripts/` 下的 Python 檔案與後端程式需可被外部 Python 執行，若使用 asar 請將相關檔案標記為 `asarUnpack`。

遵循上述配置，打包後的 Electron 應用即可與後端保持一致的路徑結構，確保 `pdfhelper_bridge.py` 能夠正確連結並啟動 Python 引擎。

### 處理配置參數

您可以通過環境變數自定義 PDF 處理參數：

```powershell
# 設置處理參數
$env:PDFHELPER_METHOD = "auto"      # auto/txt/ocr (處理方法)
$env:PDFHELPER_LANG = "en"          # 語言代碼 (en/ch/korean/japan等)
$env:PDFHELPER_DEVICE = "cpu"       # cpu/cuda (處理設備)
$env:PDFHELPER_VERBOSE = "1"        # 1/0 (詳細日誌)

# 啟動應用
npm start
```

#### 處理方法說明
- **auto**: 自動選擇最適合的處理方法
- **txt**: 使用文本提取方法 (適合文字類 PDF)
- **ocr**: 使用 OCR 方法 (適合圖片類 PDF)

#### 支援的語言代碼
- `en`: 英語
- `ch`: 中文 (簡體)
- `chinese_cht`: 中文 (繁體)
- `korean`: 韓語
- `japan`: 日語
- 更多語言請參考 MinerU 官方文檔

### 使用流程

1. **上傳 PDF**: 拖放或點擊選擇 PDF 文件
2. **開始處理**: 點擊「開始」按鈕啟動處理
3. **查看進度**: 
   - 觀察智能進度條顯示處理階段
   - 點擊「顯示處理日誌」查看詳細輸出
4. **查看結果**: 處理完成後自動顯示 Markdown 結果
5. **AI 問答**: 在右側聊天框基於結果進行問答

### 實時日誌功能 🆕

- **智能進度條**: 根據 MinerU 輸出智能更新進度
- **階段識別**: 自動識別載入、解析、提取、轉換等階段
- **多重輸出**: 
  - 前端 UI 日誌區域
  - 瀏覽器開發者控制台 (F12)
  - 終端機輸出 (如果從終端啟動)
- **錯誤追蹤**: 詳細錯誤信息和故障排除提示

### 輸出結果

處理完成後會生成：
- **Markdown 文件**: 完整的文檔內容
- **JSON 元數據**: 包含處理信息和統計
- **圖片文件**: 提取的圖片資源
- **處理記錄**: 保存在歷史記錄中供後續查看

## 📈 更新日誌

### v2.1.0 (2025-10-07) - 實時日誌功能
- ✨ **新增實時後端日誌顯示**
- 🔧 **智能進度條更新機制** 
- 🎨 **多彩日誌分類顯示**
- 🐛 **修復 UTF-8 編碼問題**
- 🔩 **解決 NumPy 版本兼容性**
- 📊 **增強用戶體驗和透明度**

### v2.0.0 - PDFHelper 整合
- 🔗 **整合 PDFHelper-master 後端**
- 📄 **支援 PDF 拖放上傳**
- 📝 **Markdown 渲染和顯示**
- 💬 **聊天功能集成**
- 📚 **處理歷史記錄**

### v1.0.0 - 基礎 Electron 應用
- ⚡ **基本 Electron 框架**
- 🎨 **使用者介面設計**
- 📁 **文件選擇和處理**

詳細更新記錄請參考 [`VERSION_DIFF.md`](VERSION_DIFF.md)

## 🤝 貢獻指南

### 前端開發設置

1. **Fork 專案** 並 clone 到本地
2. **安裝前端依賴**:
   ```powershell
   cd frontend
   npm install --dev
   ```
3. **後端配置**: 參考 `../backend/` 目錄說明
4. **創建功能分支**: `git checkout -b feature/your-feature`
5. **進行開發和測試**
6. **提交 Pull Request**

### 前端開發規範

- **JavaScript**: 使用 ES6+ 語法，2 空格縮進
- **CSS**: 使用現代 CSS 特性，避免內聯樣式
- **註釋**: 中文註釋，清楚說明邏輯
- **提交信息**: 使用簡潔明瞭的中文描述

### 測試

```powershell
# 手動測試前端功能
npm start

# 測試檔案上傳和進度顯示
# 測試 Markdown 渲染效果
# 測試聊天功能整合
```

### 改進建議

- � **UI/UX 改進**: 更直觀的操作介面
- ⚡ **前端性能**: 大檔案處理時的響應優化
- 🔧 **功能擴展**: 更多檔案格式支援
- � **響應式設計**: 適配不同螢幕尺寸

## 📄 授權

本專案基於 [MIT License](LICENSE) 授權。

## 🙏 致謝

- **[PDFHelper](https://github.com/opendatalab/PDFHelper)**: 核心 PDF 處理引擎
- **[MinerU](https://github.com/opendatalab/MinerU)**: PDF 解析和處理
- **[Electron](https://electronjs.org/)**: 跨平台桌面應用框架
- **[marked](https://marked.js.org/)**: Markdown 渲染引擎
- **[KaTeX](https://katex.org/)**: 數學公式渲染

## 📞 聯絡方式

如果您有任何問題或建議：

- 🐛 **Bug 報告**: [提交 Issue](issues)
- 💡 **功能請求**: [提交 Feature Request](issues)
- 💬 **討論交流**: [Discussions](discussions)
- 📧 **直接聯繫**: [電子郵件](linj80912@gmail.com)

---

**Happy Coding! 🚀**

## 🔧 疑難排解

### 常見問題與解決方案

#### 1. MinerU 相關問題

**問題**: `numpy.dtype size changed, may indicate binary incompatibility`
```powershell
# 解決方案: 降級 numpy 版本
pip uninstall numpy
pip install "numpy>=1.24,<1.26"
```

**問題**: `mineru: command not found` 或找不到 MinerU CLI
```powershell
# 檢查 MinerU 安裝
pip show mineru-client

# 重新安裝 MinerU
pip install --upgrade mineru-client

# 手動添加到 PATH (Windows)
$env:PATH += ";C:\Users\User\AppData\Roaming\Python\Python311\Scripts"
```

**問題**: MinerU 處理卡住不動
- 檢查 PDF 文件是否損壞
- 嘗試使用不同的處理方法 (`PDFHELPER_METHOD=txt` 或 `ocr`)
- 查看詳細日誌輸出排查具體問題

#### 2. Python 環境問題

**問題**: `Python 退出碼 1` 或 Python 腳本執行失敗
```powershell
# 檢查 Python 版本和路徑
python --version
where python

# 檢查依賴安裝
pip list | findstr "pandas numpy"

# 手動測試處理腳本
cd scripts
python processor.py test.pdf company model session123
```

**問題**: 編碼錯誤或中文亂碼
```powershell
# 設置正確的編碼環境變數
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
$env:LC_ALL = "C.UTF-8"
```

#### 3. Electron 應用問題

**問題**: `npm start` 無法啟動
```powershell
# 檢查 Node.js 和 Electron
node --version
npx electron --version

# 重新安裝依賴
rm -rf node_modules package-lock.json
npm install
```

**問題**: 拖放文件無效或路徑問題
- 確保 PDF 文件路徑不包含特殊字符
- 嘗試使用「選擇文件」按鈕而非拖放
- 檢查文件權限和存取控制

#### 4. 路徑配置問題

**問題**: 找不到 PDFHelper 後端
```python
# 在 pdfhelper_bridge.py 中添加調試信息
print(f"PDFHELPER_ROOT: {PDFHELPER_ROOT}")
print(f"BACKEND_ROOT: {BACKEND_ROOT}")
print(f"Backend exists: {BACKEND_ROOT.exists()}")
```

**問題**: 輸出目錄權限問題
```powershell
# 確保輸出目錄存在且可寫入
mkdir "..\backend\instance"
mkdir "..\backend\instance\pdfs"
mkdir "..\backend\instance\mineru_outputs"
```

### 調試模式

#### 啟用詳細日誌
```powershell
# 設置詳細模式
$env:PDFHELPER_VERBOSE = "1"
$env:NODE_ENV = "development"

# 啟動應用
npm start
```

#### 檢查系統配置
```powershell
# 創建系統檢查腳本
echo @"
import sys, os, subprocess
print(f'Python: {sys.executable}')
print(f'Python Version: {sys.version}')
print(f'Working Directory: {os.getcwd()}')
print('--- 檢查 MinerU ---')
try:
    result = subprocess.run(['mineru', '--help'], capture_output=True, text=True)
    print('MinerU: OK')
except:
    print('MinerU: NOT FOUND')
print('--- 檢查依賴 ---')
try:
    import numpy, pandas, pathlib
    print(f'NumPy: {numpy.__version__}')
    print(f'Pandas: {pandas.__version__}')
except ImportError as e:
    print(f'依賴錯誤: {e}')
"@ > check_env.py

python check_env.py
```

### 性能優化

#### GPU 加速 (如果可用)
```powershell
# 檢查 CUDA 可用性
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}')"

# 設置使用 GPU
$env:PDFHELPER_DEVICE = "cuda"
```

#### 記憶體優化
- 處理大型 PDF 時，建議關閉其他應用程式
- 設置 `PDFHELPER_METHOD=txt` 以節省記憶體
- 分批處理多個文件而非一次處理

### 獲取幫助

如果遇到其他問題：

1. **查看日誌**: 啟用詳細模式並檢查完整輸出
2. **檢查版本**: 確保所有依賴版本符合要求
3. **測試環境**: 使用上面的檢查腳本驗證配置
4. **重置環境**: 必要時重新安裝 Python 依賴

### 版本兼容性

- **Python**: 3.10+ (建議 3.11)
- **Node.js**: 16+ (建議 18+)
- **NumPy**: 1.24.x - 1.25.x (避免 2.x)
- **Pandas**: 1.5+ (與 NumPy 兼容版本)
- **MinerU**: 最新版本
