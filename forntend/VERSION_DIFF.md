# 版本更新記錄 - Electron PDF 解析應用

## 修改檔案清單

### 新增檔案
- `專題/scripts/pdfhelper_bridge.py` - PDFHelper 後端橋接模組
- `專題/scripts/pdfhelper_rag.py` - RAG 功能腳本（預留）

### 修改的現有檔案
1. **`專題/scripts/processor.py`** - 主要處理腳本
   - 改為使用 PDFHelper 的 MinerU 管線
   - 新增錯誤處理與進度回報
   - 支援環境變數配置

2. **`專題/main.js`** - Electron 主程序
   - 新增 metadata 保存到歷史紀錄
   - 支援 PDFHelper 處理結果的額外資訊

3. **`專題/renderer.js`** - 前端渲染邏輯
   - 新增 metadata 狀態管理
   - 改善 Markdown 圖片路徑解析
   - 基於 markdownPath 處理相對路徑圖片

4. **`專題/index.html`** - 使用者介面
   - 更新文案，明確說明為 PDF 解析生成 Markdown
   - 移除 PDF 顯示相關描述

5. **`專題/README.md`** - 使用說明文件
   - 新增 PDFHelper 後端整合章節
   - 新增 MinerU CLI 安裝指引
   - 新增環境變數配置說明

## 與原版 PDFHelper-master 的差異

### 1. 架構差異
- **原版**：獨立的 Python 後端專案，需要手動呼叫 API
- **修改版**：整合到 Electron 應用，透過橋接模組自動化處理

### 2. 使用方式差異
- **原版**：
  ```python
  from api import PDFHelper
  pdf_helper = PDFHelper()
  result = pdf_helper.process_pdf_to_json("example.pdf")
  ```
- **修改版**：
  - 前端拖放 PDF → 自動觸發處理
  - 透過 `pdfhelper_bridge.py` 封裝呼叫
  - 結果直接顯示在 Electron 視窗

### 3. 功能簡化
- **保留功能**：
  - MinerU PDF 解析
  - Markdown 生成與顯示
  - 圖片路徑處理
  
- **移除功能**：
  - 翻譯功能（可後續添加）
  - RAG 問答功能（保留介面，未實作）
  - 複雜的配置管理

### 4. 新增功能
- **錯誤檢查**：自動檢查 MinerU CLI 是否安裝
- **路徑管理**：自動處理檔案複製與目錄結構
- **進度顯示**：即時顯示處理進度
- **歷史紀錄**：保存處理記錄與 metadata

### 5. 環境變數支援
新增環境變數配置：
- `PDFHELPER_METHOD` - 解析方法（auto/txt/ocr）
- `PDFHELPER_LANG` - 語言設定
- `PDFHELPER_DEVICE` - 處理設備（cpu/cuda）
- `PDFHELPER_VERBOSE` - 詳細日誌
- `PDFHELPER_MINERU_PATH` - MinerU CLI 路徑

## 安裝需求差異

### 原版需求
- Python 環境
- PDFHelper 專案依賴
- 手動配置各種服務

### 修改版需求
- Node.js + Electron
- Python 環境
- MinerU CLI（`pip install mineru-client`）
- PDFHelper 專案作為後端依賴

## 使用場景差異

### 原版適合
- 程式開發者整合到自己的專案
- 需要完整 RAG 功能
- 批量處理大量文件

### 修改版適合
- 一般使用者的桌面應用
- 簡單的 PDF 轉 Markdown 需求
- 即時預覽與處理結果
- 不需要程式開發經驗

## 未來可擴展功能
- 重新啟用翻譯功能
- 實作 RAG 問答系統
- 添加批量處理
- 支援更多輸出格式