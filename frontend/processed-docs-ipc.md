# 已處理文件 IPC 介面規格

前端在 `frontend/renderer.js` 中透過下列三個 IPC 呼叫存取歷史文件：

- `processed-docs:list`
- `processed-docs:load`
- `processed-docs:remove`

以下說明後端（主行程）需要配合的資料來源與回傳格式。

## 基本資料模型

```jsonc
{
  "id": "唯一識別碼，在列表與後續操作會用到",
  "title": "顯示給使用者看的名稱，預設可用檔名",
  "filePath": "原 PDF 或輸出檔的路徑（可選）",
  "updatedAt": 1739606400000, // Unix timestamp (ms) or任何 Date 可被 new Date() 解析的字串
  "translator": "openai/gpt-4.1-mini", // 可選, 顯示使用的模型資源
  "model": "text-embedding-3-small",   // 可選
  "status": "完成", // 可選, 會顯示在列表 meta 區
  "language": "zh", // 可選
  "collection": "my-collection", // 可選
  "markdown": "# 內部預設顯示內容 (選填)",
  "zh": "中文版本 (選填)",
  "en": "英文版本 (選填)",
  "meta": { … } // 其餘附加資訊（例如 rag collection、翻譯檔案路徑…）
}
```

> 其中 `id` 必填，其餘欄位選填；`markdown/zh/en/meta` 可只在 `load` 時回傳。

## 1. `processed-docs:list`

- **方向**：Renderer → Main（IPC invoke）
- **用途**：載入側邊歷史視窗的清單。
- **預期回傳**：
  - 成功：`{ ok: true, items: ProcessedDocItem[] }`
  - 若回傳陣列（而不是包在 `ok` 內），前端也會自動轉成列表。
  - 失敗：`{ ok: false, error: "說明文字" }`

### 建議流程
1. 讀取已處理檔案的紀錄來源（例如 `frontend/instance/history.json` 或後端資料庫）。
2. 將每筆紀錄轉為上述資料模型的 key，至少提供 `id` 與 `title`、`updatedAt`。
3. 回傳 `{ ok: true, items }`。

### 範例
```js
ipcMain.handle('processed-docs:list', async () => {
  const records = await loadHistoryFromDisk();
  const items = records.map(rec => ({
    id: rec.sessionId,
    title: path.basename(rec.filePath || '未命名'),
    filePath: rec.filePath,
    updatedAt: rec.updatedAt || rec.createdAt,
    translator: rec.translator,
    model: rec.embedding,
    status: rec.error ? '錯誤' : (rec.done ? '完成' : '處理中'),
    language: rec.lang,
    collection: rec.collectionName
  }));
  return { ok: true, items };
});
```

## 2. `processed-docs:load`

- **方向**：Renderer → Main（IPC invoke）
- **用途**：點選歷史項目時載入內容再顯示於閱讀器。
- **參數**：`docId`（即 `processed-docs:list` 回傳項目的 `id`）
- **預期回傳**：
  - 成功：`{ ok: true, document }`
  - `document` 需包含 `markdown`/`zh`/`en` 之中至少一個，以及需要的 `meta/metadata` 欄位。
  - 失敗：`{ ok: false, error: "說明文字" }`

### 建議流程
1. 根據 `docId` 找出儲存的結果檔（Markdown / 翻譯 JSON / RAG 等）。
2. 載入檔案內容，組成下列結構回傳：
   ```jsonc
   {
     "markdown": "主要顯示的 markdown 內容 (若提供中文/英文會自動套用)",
     "zh": "中文內容 (選填)",
     "en": "英文內容 (選填)",
     "meta": {
       "markdownPath": "e:/.../output.md",
       "ragCollection": "collection-name",
       "translatedJsonPath": "...",
       ...其它需要保留的資訊...
     }
   }
   ```
3. 如果找不到對應檔案或內容，回傳 `{ ok: false, error: '...' }`。

### 範例
```js
ipcMain.handle('processed-docs:load', async (_event, docId) => {
  const record = await loadRecordById(docId);
  if (!record) {
    return { ok: false, error: '找不到指定的歷程' };
  }
  const markdown = await fs.promises.readFile(record.markdownPath, 'utf-8');
  const meta = {
    markdownPath: record.markdownPath,
    ragCollection: record.collectionName,
    translatedJsonPath: record.translatedJsonPath
  };
  return { ok: true, document: { markdown, meta, lang: record.lang } };
});
```

## 3. `processed-docs:remove`

- **方向**：Renderer → Main（IPC invoke）
- **用途**：使用者在歷史列表 hover 時點 `×` 刪除該筆紀錄。
- **參數**：`docId`
- **預期回傳**：
  - 成功：`{ ok: true }`
  - 失敗：`{ ok: false, error: '...' }`

### 建議流程
1. 刪除歷程中對應的元資料（例如自訂的 history.json 內那一筆）。
2. 視需求決定是否同步清除對應的輸出成果檔案。
3. 回傳成功或錯誤訊息。

### 範例
```js
ipcMain.handle('processed-docs:remove', async (_event, docId) => {
  const removed = await removeRecord(docId);
  if (!removed) {
    return { ok: false, error: '找不到要刪除的項目' };
  }
  return { ok: true };
});
```

---

## 前端互動摘要

- 開啟「已處理文件」視窗時會呼叫 `processed-docs:list`。
- 點選列表項目 → 呼叫 `processed-docs:load`，成功後前端會：
  - 隱藏上傳畫面，顯示結果畫面。
  - 套用 `markdown / zh / en` 與 `meta`。
- 點選 `×` → 呼叫 `processed-docs:remove`，成功後重新載入清單。

只要後端依照上述格式提供資料即可讓功能正常運作。若後續需要補充欄位，可再在 `normalizeProcessedDoc` 內同步處理。
