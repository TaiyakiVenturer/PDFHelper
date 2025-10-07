# Electron 文字顯示範例

一個最小可執行的 Electron 專案，用來顯示文字。

## 啟動

1. 安裝依賴（首次）：

```
npm install
```

2. 啟動應用：

```
npm start
```

出現視窗後，中心面板會顯示一段文字，並在 1.5 秒後由 `renderer.js` 更新。

## 結構

- `main.js`：主程序，建立視窗並載入 `index.html`。
- `preload.js`：預加載腳本，可用於暴露安全 API。
- `index.html`：視圖模板，顯示文字的頁面。
- `renderer.js`：前端邏輯，控制畫面上的文字。

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

## 使用 PDFHelper 後端處理 PDF

Electron 專案已整合 `PDFHelper-master/backend` 的 MinerU PDF 管線。預設資料夾結構如下：

```
專題/
  scripts/
	 processor.py         # 會呼叫 PDFHelper 管線
	 pdfhelper_bridge.py  # 處理路徑與 MinerU 呼叫
PDFHelper-master/
  backend/
	 ...                  # 原 PDFHelper 原始碼
```

啟用步驟：

1. **安裝 Python 依賴**：
	```powershell
	cd ..\PDFHelper-master
	pip install -r requirements.txt
	```
	請另外安裝 MinerU CLI（例如 `pip install mineru-client` 或官方發行版），並確保在命令列執行 `mineru --help` 會成功。

2. **準備 PDF**：在 Electron 前端選擇或拖放 PDF。`processor.py` 會自動複製檔案到 `PDFHelper-master/backend/instance/pdfs/` 並呼叫 MinerU。

3. **執行流程**：
	- Electron 透過 `ipcMain.handle('process:start')` 啟動 `scripts/processor.py`。
	- `processor.py` 使用 `run_pipeline()` 執行 MinerU，完成後以 JSONL 事件回傳進度與 Markdown 結果。
	- 前端在 `renderer.js` 收到 `done` 事件後切換到結果畫面並渲染 Markdown。

4. **環境變數（可選）**：可在啟動 Electron 前設定下列變數自訂管線：
	- `PDFHELPER_METHOD` (`auto`/`txt`/`ocr`)
	- `PDFHELPER_LANG` (MinerU 語言代碼，預設 `en`)
	- `PDFHELPER_DEVICE` (`cpu` 或 `cuda`)
	- `PDFHELPER_VERBOSE` (`1` / `0`)
	- `PDFHELPER_MINERU_PATH`：若 `mineru` 不在 PATH，設定此變數為包含 `mineru` 可執行檔的資料夾路徑。
	- 若目錄不在預設位置，可設定 `PDFHELPER_ROOT`、`PDFHELPER_BACKEND` 或 `PDFHELPER_INSTANCE` 指向實際路徑。

5. **輸出資料**：`processor.py` 最終事件包含：
	- `content`：MinerU 產出的 Markdown 文字
	- `metadata.markdownPath` / `metadata.jsonPath`：檔案實際路徑
	- `metadata.processingTime`、`metadata.images` 等資訊，已儲存在歷史紀錄與 renderer 狀態，可供後續聊天/RAG 功能使用。

## 自訂顯示文字

- 直接修改 `index.html` 裡的 `<p id="text">` 預設文字。
- 或在 `renderer.js` 操作 `#text` 元素，以動態更新文字。

## 疑難排解

- 若 `npm start` 無法啟動，請先確認安裝：`npx electron --version`。
- Windows PowerShell 若遇到執行原則問題，可嘗試用 CMD 或以系統管理員身分執行。
