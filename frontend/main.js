// main.js - Electron 主程序
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// 引入後端 API 管理模組
const { serverManager } = require('./modules/services/server-manager');
const { apiClient } = require('./modules/services/api-client');

// 全局狀態：當前活躍的文件資訊
let currentDocumentState = {
  collectionName: null,
  markdownPath: null,
  sessionId: null
};

// 降低 Windows 磁碟快取錯誤訊息 (僅影響快取，不影響功能)
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 使用自訂標題列
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 }, // macOS 位置（Windows 忽略）
    show: false, // 先隱藏，等最大化後再顯示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  
  // 預設最大化視窗
  win.once('ready-to-show', () => {
    win.maximize(); // 設定為最大化
    win.show();     // 然後顯示視窗
  });
  
  // 同步最大化狀態到 renderer
  registerWindowStateEvents(win);
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('window:isMaximized', win.isMaximized());
    // 初始主題（避免未設置時 CSS 變數未生效）
    try {
      const s = readSettings();
      win.webContents.send('app:applyTheme', s.theme || 'dark');
    } catch {}
  });

  // 開發時可打開 DevTools；正式發佈時可註解掉
  // win.webContents.openDevTools();
}

app.whenReady().then(async() => {
  console.log("[INFO] 正在啟動後端伺服器...");

  const started = await serverManager.startServer({
    timeout: 30000,
    debug: true
  });
  // 檢查是否啟動成功
  if (!started)
  {
    console.error("[ERROR] 後端伺服器啟動失敗，請確認 Python 環境與相依套件是否正確安裝。");
    dialog.showErrorBox(
      '啟動失敗', 
      '後端伺服器啟動失敗，請確認 Python 環境與相依套件是否正確安裝。\n\n' + 
      '建議步驟：\n' + 
      '1. 確認已安裝 Python 3.8+ 並加入系統 PATH。\n' + 
      '2. 在專案根目錄執行 `uv sync` 來安裝相依套件。\n' + 
      '3. 重新啟動應用程式。'
    );
    app.quit();
    return;
  }
  console.log("[INFO] 後端伺服器啟動成功。");

  createWindow();
  app.on('activate', () => {
    // 在 macOS 上, 當 dock 圖示被點擊且沒有其它視窗開啟時, 重新建立視窗
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 應用程式退出前停止後端伺服器
app.on('will-quit', (event) => {
  console.log('[INFO] 應用程式即將退出，正在停止後端伺服器...');
  
  // 阻止應用立即退出，等待伺服器停止
  if (serverManager.isRunning()) {
    event.preventDefault();
    
    try {
      serverManager.stopServer();
      console.log('[INFO] 後端伺服器已停止');
    } catch (error) {
      console.error('[ERROR] 停止後端伺服器時發生錯誤:', error);
    } finally {
      // 給予一點時間讓進程完全終止
      setTimeout(() => {
        app.exit(0);
      }, 500);
    }
  }
});

// 確保在應用崩潰時也清理進程
app.on('before-quit', (event) => {
  if (serverManager.isRunning()) {
    console.log('[INFO] 清理後端伺服器進程...');
    serverManager.stopServer();
  }
});

// 所有視窗關閉時退出 (macOS 除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: 視窗控制
ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window:maximize-toggle', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// 當最大化狀態改變時，通知 renderer
function registerWindowStateEvents(win) {
  win.on('maximize', () => {
    win.webContents.send('window:isMaximized', true);
  });
  win.on('unmaximize', () => {
    win.webContents.send('window:isMaximized', false);
  });
}

// ===== 設定檔處理 =====
const settingsPath = path.join(__dirname, 'instance', 'settings.json');

// 新版預設值（支援分開設定）
const defaultSettings = {
  translator: { company: '', model: '', apiKey: '' },
  embedding: { company: '', model: '', apiKey: '' },
  rag: { company: '', model: '', apiKey: '' },
  theme: 'dark',
  lang: 'zh'
};

const projectRoot = path.join(__dirname, '..'); // 從 frontend 回到根目錄
const uploadDir = path.join(projectRoot, 'backend', 'instance', 'pdfs');
const historyPath = path.join(__dirname, 'instance', 'history.json');
const dropDebugPath = path.join(__dirname, 'instance', 'drop_debug.txt');

console.log("[DEBUG] 設定檔路徑", settingsPath);
console.log("[DEBUG] 歷史紀錄檔案", historyPath);
console.log("[DEBUG] 拖放偵錯檔案", dropDebugPath);
console.log("[DEBUG] 上傳檔案夾", uploadDir);

function readSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const json = JSON.parse(raw);
      
      // 新版格式 → 合併預設值
      return {
        translator: { ...defaultSettings.translator, ...(json.translator || {}) },
        embedding: { ...defaultSettings.embedding, ...(json.embedding || {}) },
        rag: { ...defaultSettings.rag, ...(json.rag || {}) },
        theme: json.theme || defaultSettings.theme,
        lang: json.lang || defaultSettings.lang
      };
    }
  } catch (err) {
    console.error('讀取設定失敗:', err);
  }
  return { ...defaultSettings };
}

function writeSettings(data) {
  try {
    let toSave = {
      translator: { ...defaultSettings.translator, ...(data.translator || {}) },
      embedding: { ...defaultSettings.embedding, ...(data.embedding || {}) },
      rag: { ...defaultSettings.rag, ...(data.rag || {}) },
      theme: data.theme || defaultSettings.theme,
      lang: data.lang || defaultSettings.lang
    };
    
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(toSave, null, 2), 'utf-8');
    return toSave;
  } catch (err) {
    console.error('寫入設定失敗:', err);
    throw err;
  }
}

// 歷史紀錄 I/O
function readHistory() {
  try {
    if (fs.existsSync(historyPath)) {
      const raw = fs.readFileSync(historyPath, 'utf-8');
      const json = JSON.parse(raw);
      return Array.isArray(json) ? json : [];
    }
  } catch (e) {
    console.error('讀取歷史失敗:', e);
  }
  return [];
}
function writeHistory(list) {
  try {
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, JSON.stringify(list || [], null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('寫入歷史失敗:', e);
    return false;
  }
}

// 寫入拖放偵錯日誌（附加）
function appendDropDebug(obj) {
  try {
    const ts = new Date();
    const header = `\n\n===== Drag&Drop Debug @ ${ts.toISOString()} (${ts.toLocaleString()}) =====\n`;
    const body = (typeof obj === 'string') ? obj : JSON.stringify(obj, null, 2);
    fs.appendFileSync(dropDebugPath, header + body + '\n');
  } catch (e) {
    console.error('寫入 drop_debug.txt 失敗:', e);
  }
}

// IPC: 開啟選檔對話框
ipcMain.handle('dialog:open-file', async (_event, options) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    defaultPath: options?.defaultPath,
    filters: [
      { name: '支援類型', extensions: ['pdf'] },
      { name: 'PDF', extensions: ['pdf'] }
    ]
  });
  if (canceled) return [];
  // 單檔
  return filePaths.slice(0,1);
});

// IPC: 檔案路徑接收（保留供未來使用）
ipcMain.on('file:chosen', (_event, filePath) => {
  console.log('[file:chosen]', filePath);
});

// IPC: 刪除已上傳的檔案
ipcMain.handle('file:delete', async (_event, fileName) => {
  if (!fileName) return { ok: false, error: '缺少檔案名稱' };
  
  try {
    const targetPath = path.join(uploadDir, fileName);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log('[file:delete] 已刪除:', targetPath);
      return { ok: true, message: '檔案已刪除' };
    } else {
      console.log('[file:delete] 檔案不存在:', targetPath);
      return { ok: true, message: '檔案不存在或已刪除' };
    }
  } catch (err) {
    console.error('[file:delete] 刪除失敗:', err);
    return { ok: false, error: `刪除失敗: ${err.message}` };
  }
});

// IPC: 啟動處理流程 (使用 apiClient 呼叫 HTTP API)
ipcMain.handle('process:start', async (event, payload) => {
  const { filePath, sessionId } = payload || {};
  if (!filePath) return { ok: false, error: '缺少檔案路徑' };
  
  try {
    // 從 settings.json 讀取配置
    const settings = readSettings();
    const translatorConfig = settings.translator || {};
    const embeddingConfig = settings.embedding || {};
    
    // 驗證必要參數
    if (!translatorConfig.company || !translatorConfig.model) {
      return { ok: false, error: '缺少翻譯器配置，請先在設定中配置' };
    }
    if (!embeddingConfig.company || !embeddingConfig.model) {
      return { ok: false, error: '缺少 Embedding 配置，請先在設定中配置' };
    }
    
    const win = BrowserWindow.fromWebContents(event.sender);
    
    // 檢查進度狀態，如果有卡住的任務則重置
    try {
      const progressResult = await apiClient.getProcessingProgress();
      if (progressResult && progressResult.is_processing) {
        console.warn('[process:start] 檢測到卡住的任務，正在重置...');
        await apiClient.resetProcess();
        console.log('[process:start] 進度狀態已重置');
      }
    } catch (err) {
      console.warn('[process:start] 無法檢查進度狀態:', err.message);
    }
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const fileName = path.basename(filePath);
    const targetPath = path.join(uploadDir, fileName);
    fs.copyFileSync(filePath, targetPath);
    console.log('[process:start] PDF 已複製到:', targetPath);
    
    // 發送初始進度
    win?.webContents.send('process:evt', {
      type: 'progress',
      sessionId,
      percent: 5,
      status: '已上傳 PDF',
      timestamp: Date.now()
    });

    // 更新環境變數（分開設定）
    process.env.PDFHELPER_TRANSLATOR_KEY = translatorConfig.apiKey || '';
    process.env.PDFHELPER_TRANSLATOR_PROVIDER = translatorConfig.company;
    process.env.PDFHELPER_TRANSLATOR_MODEL = translatorConfig.model;

    process.env.PDFHELPER_EMBEDDING_KEY = embeddingConfig.apiKey || '';
    process.env.PDFHELPER_EMBEDDING_PROVIDER = embeddingConfig.company;
    process.env.PDFHELPER_EMBEDDING_MODEL = embeddingConfig.model;

    // 更新後端的 API Key 和模型（分開更新）
    await apiClient.updateAPIKey("translator", translatorConfig.apiKey || "", translatorConfig.model);
    await apiClient.updateAPIKey("embedding", embeddingConfig.apiKey || "", embeddingConfig.model);

    // 啟動非同步處理
    console.log('[process:start] 呼叫 API: startFullProcessAsync', { 
      fileName, 
      translator: `${translatorConfig.company}/${translatorConfig.model}`,
      embedding: `${embeddingConfig.company}/${embeddingConfig.model}`,
      sessionId 
    });
    method = "auto"; // 自動選擇解析方法
    const asyncResult = await apiClient.startFullProcessAsync(
      fileName,
      method,
      "en",
      "cuda"
    );

    if (!asyncResult.success)
    {
      console.error('[process:start] API 調用失敗:', asyncResult.error || '未知錯誤');
      win?.webContents.send('process:evt', { 
        type: 'error', 
        sessionId, 
        error: asyncResult.error || 'API 調用失敗',
        timestamp: Date.now() 
      });
      return { ok: false, error: asyncResult.error || 'API 調用失敗' };
    }
    console.log('[process:start] API 調用成功，開始輪詢進度...');
    currentDocumentState.sessionId = sessionId;
    currentDocumentState.collectionName = null; // 重置
    currentDocumentState.markdownPath = null; // 重置

    // 輪詢進度（每秒查詢一次）
    const pollInterval = setInterval(async () => {
      try {
        const progressResult = await apiClient.getProcessingProgress();
        
        if (!progressResult) {
          console.warn('[process:start] 無法獲取進度');
          return;
        }
        
        // 構造事件物件 (每個迴圈創一個新的)
        const evtObj = {
          type: progressResult.is_processing ? 'progress' : (progressResult.error ? 'error' : 'done'),
          sessionId,
          percent: Math.round(progressResult.progress || 0),
          status: progressResult.message || '',
          error: progressResult.error || null,
          timestamp: Date.now()
        };
        
        // 如果完成或錯誤，加入結果
        if (evtObj.type === 'done' && progressResult.result) 
          evtObj.metadata = progressResult.result;
        
        // 發送事件到 renderer
        win?.webContents.send('process:evt', evtObj);
        
        // 更新歷史記錄
        if (evtObj.type === 'progress' || evtObj.type === 'done' || evtObj.type === 'error') {
          // 讀取 history.json 裡並依照 sessionId 獲取紀錄
          const list = readHistory();
          let rec = list.find(r => r.sessionId === sessionId);
          
          // 如果 sessionId 對應資料不存在, 創立新紀錄資料
          if (!rec) {
            rec = { 
              sessionId, 
              filePath, 
              translator: `${translatorConfig.company}/${translatorConfig.model}`,
              embedding: `${embeddingConfig.company}/${embeddingConfig.model}`,
              createdAt: Date.now(), 
              updates: [] 
            };

            // 將新紀錄移動到最前面
            list.unshift(rec);
            if (list.length > 200) list.length = 200;
          }
          rec.updatedAt = Date.now();
          rec.lastType = evtObj.type;
          rec.lastStatus = evtObj.status || evtObj.error || '';
          
          // 如果完成，加入結果資料
          if (evtObj.type === 'done') {
            rec.done = true;
            if (evtObj.metadata) {
              rec.metadata = evtObj.metadata;
              
              // 調用 reconstructMarkdown 並讀取內容
              if (evtObj.metadata.translated_json_name) {
                try {
                  console.log('[process:start] 開始重組 Markdown:', evtObj.metadata.translated_json_name);
                  const reconstructResult = await apiClient.reconstructMarkdown(
                    evtObj.metadata.translated_json_name,
                    "auto",
                    "zh"
                  );
                  
                  if (reconstructResult.success && reconstructResult.data?.markdown_path) {
                    const markdownPath = reconstructResult.data.markdown_path;
                    console.log('[process:start] Markdown 重組成功:', markdownPath);
                    
                    // 檢查檔案是否存在
                    if (fs.existsSync(markdownPath)) {
                      // 讀取 Markdown 內容
                      const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
                      console.log('[process:start] Markdown 內容已讀取，長度:', markdownContent.length);
                      
                      // 將內容加入 evtObj, 前端才能渲染
                      evtObj.content = markdownContent;
                      evtObj.metadata.markdownPath = markdownPath;
                      
                      // 保存到記錄和全局狀態
                      rec.markdownPath = markdownPath;
                      currentDocumentState.markdownPath = markdownPath;
                      
                      // 重新發送 done 事件（包含 Markdown 內容）
                      win?.webContents.send('process:evt', evtObj);
                    } else {
                      console.warn('[process:start] Markdown 檔案不存在:', markdownPath);
                    }
                  } else {
                    console.warn('[process:start] Markdown 重組失敗:', reconstructResult.message);
                  }
                } catch (reconstructError) {
                  console.error('[process:start] 重組 Markdown 時發生錯誤:', reconstructError);
                }
              }
              
              // 保存 collection_name
              if (evtObj.metadata.collection_name) {
                rec.collectionName = evtObj.metadata.collection_name;
                currentDocumentState.collectionName = evtObj.metadata.collection_name;
                console.log('[process:start] 更新當前文件狀態:', currentDocumentState);
              }
            }
          }
          else if (evtObj.type === 'error')
            rec.error = String(evtObj.error || '');
          
          // 紀錄更新歷程
          rec.updates.push({ 
            t: Date.now(), 
            type: evtObj.type, 
            status: evtObj.status || '', 
            percent: evtObj.percent ?? null 
          });
          
          // 保存回 history.json
          writeHistory(list);
        }
        
        // 如果處理完成或發生錯誤，停止輪詢
        if (!progressResult.is_processing) {
          clearInterval(pollInterval);
          console.log('[process:start] 處理完成，停止輪詢');
        }
        
      } catch (error) {
        console.error('[process:start] 輪詢進度失敗:', error);
      }
    }, 1000); // 每秒輪詢一次

    return { ok: true };
  } catch (err) {
    console.error('[process:start] 處理失敗', err);
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents.send('process:evt', { 
      type: 'error', 
      sessionId, 
      error: err.message || '處理失敗，請稍後再試',
      timestamp: Date.now()
    });
    return { ok: false, error: err.message || '處理失敗，請稍後再試' };
  }
});

// IPC: 拖放偵錯日誌
ipcMain.on('debug:drop-log', (_event, payload) => {
  // 限縮內容大小，避免過大
  let data = payload;
  try {
    if (payload && typeof payload === 'object') {
      const safe = { ...payload };
      // 截斷可能過長欄位
      ['uriListRaw', 'textPlainRaw'].forEach(k => {
        if (typeof safe[k] === 'string' && safe[k].length > 4000) {
          safe[k] = safe[k].slice(0, 4000) + `... [truncated ${safe[k].length - 4000}]`;
        }
      });
      data = safe;
    }
  } catch {}
  appendDropDebug(data);
});

// IPC: 將拖入但無 path 的 File 內容寫入暫存檔，回傳路徑
ipcMain.handle('file:import-temp', async (_event, payload) => {
  try {
    const { name, bytes } = payload || {};
    if (!bytes) return { ok: false, error: '缺少檔案內容' };
    // 轉為 Buffer（支援 Buffer、Uint8Array、ArrayBuffer）
    let buf;
    if (Buffer.isBuffer(bytes)) buf = bytes;
    else if (bytes?.type === 'Buffer' && Array.isArray(bytes.data)) buf = Buffer.from(bytes.data);
    else if (bytes instanceof Uint8Array) buf = Buffer.from(bytes);
    else buf = Buffer.from(bytes); // 嘗試 ArrayBuffer

    // 檔名淨化與唯一化
    const base = String(name || 'upload.pdf').replace(/[\\/:*?"<>|]+/g, '_');
    const ts = new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}-${String(ts.getMilliseconds()).padStart(3,'0')}`;
    const filePath = path.join(uploadDir, `${stamp}-${base}`);
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(filePath, buf);
    return { ok: true, filePath };
  } catch (e) {
    console.error('file:import-temp 失敗:', e);
    return { ok: false, error: '無法建立暫存檔' };
  }
});

// IPC: 嘗試從剪貼簿（Windows CF_HDROP）取得拖放的原始路徑
ipcMain.handle('drop:clipboard-paths', async () => {
  try {
    if (process.platform !== 'win32') return { ok: false, paths: [] };
    const buf = clipboard.readBuffer('CF_HDROP');
    if (!buf || buf.length < 20) return { ok: false, paths: [] };
    // DROPFILES 結構：DWORD pFiles(0-3), POINT(4-11), BOOL fNC(12-15), BOOL fWide(16-19)
    const pFiles = buf.readUInt32LE(0);
    const fWide = buf.readUInt32LE(16) !== 0;
    if (pFiles >= buf.length) return { ok: false, paths: [] };
    if (fWide) {
      const text = buf.toString('ucs2', pFiles);
      // 以雙 NUL 結束，單 NUL 分隔多檔案
      const parts = text.split('\u0000').map(s => s.trim()).filter(Boolean);
      return { ok: parts.length > 0, paths: parts };
    } else {
      const text = buf.toString('ascii', pFiles);
      const parts = text.split('\u0000').map(s => s.trim()).filter(Boolean);
      return { ok: parts.length > 0, paths: parts };
    }
  } catch (e) {
    console.error('讀取 CF_HDROP 失敗:', e);
    return { ok: false, paths: [] };
  }
});

// IPC: 設定讀寫
ipcMain.handle('settings:load', () => {
  return readSettings();
});

ipcMain.handle('settings:save', async (_event, data) => {
  const result = writeSettings(data);
  
  // 同步更新後端配置（新版結構：支援分開設定）
  try {
    const translatorConfig = data.translator || {};
    const embeddingConfig = data.embedding || {};
    const ragConfig = data.rag || {};
    
    // 更新翻譯器配置
    if (translatorConfig.apiKey && translatorConfig.company && translatorConfig.model) {
      process.env.PDFHELPER_TRANSLATOR_KEY = translatorConfig.apiKey;
      process.env.PDFHELPER_TRANSLATOR_PROVIDER = translatorConfig.company;
      process.env.PDFHELPER_TRANSLATOR_MODEL = translatorConfig.model;
      
      // 更新後端 API Key
      await apiClient.updateAPIKey("translator", translatorConfig.apiKey, translatorConfig.model);
      console.log('[settings:save] 已更新翻譯器配置:', translatorConfig.company, translatorConfig.model);
    }
    
    // 更新 Embedding 配置
    if (embeddingConfig.apiKey && embeddingConfig.company && embeddingConfig.model) {
      process.env.PDFHELPER_EMBEDDING_KEY = embeddingConfig.apiKey;
      process.env.PDFHELPER_EMBEDDING_PROVIDER = embeddingConfig.company;
      process.env.PDFHELPER_EMBEDDING_MODEL = embeddingConfig.model;
      
      // 更新後端 API Key
      await apiClient.updateAPIKey("embedding", embeddingConfig.apiKey, embeddingConfig.model);
      console.log('[settings:save] 已更新 Embedding 配置:', embeddingConfig.company, embeddingConfig.model);
    }

    // 更新 RAG 配置
    if (ragConfig.apiKey && ragConfig.company && ragConfig.model) {
      process.env.PDFHELPER_RAG_KEY = ragConfig.apiKey;
      process.env.PDFHELPER_RAG_PROVIDER = ragConfig.company;
      process.env.PDFHELPER_RAG_MODEL = ragConfig.model;

      // 更新後端 API Key
      await apiClient.updateAPIKey("rag", ragConfig.apiKey, ragConfig.model);
      console.log('[settings:save] 已更新 RAG 配置:', ragConfig.company, ragConfig.model);
    }
    
    console.log('[settings:save] 後端配置同步完成');
  } catch (error) {
    console.error('[settings:save] 更新後端配置失敗:', error);
  }
  
  return result;
});

// IPC: 檢查更新（簡化版）
ipcMain.handle('app:check-updates', () => {
  return {
    currentVersion: app.getVersion(),
    hasUpdate: false,
    message: '已是最新版本'
  };
});

// IPC: 模型清單（真實 API 查詢）
// 接受 company、可選的 apiKey 和 modelType 參數
// modelType: 'language' (預設) 或 'embedding'
ipcMain.handle('models:list', async (_event, company, providedApiKey, modelType = 'language') => {
  if (!company) return { models: [], error: '未選擇供應商' };
  
  // 如果沒有提供 API Key，從 settings 讀取（注意新版結構）
  let apiKey = providedApiKey;
  if (!apiKey) {
    const settings = readSettings();
    // 嘗試從 translator 讀取（預設情況）
    apiKey = settings.translator?.apiKey || settings.apiKey || '';
  }
  
  const isEmbedding = modelType === 'embedding';
  
  try {
    if (company === 'openai') {
      if (!apiKey) return { models: [], error: '缺少 API Key（OpenAI）' };
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
        let msg = `OpenAI 錯誤 ${res.status}`;
        if (res.status === 401) msg = 'OpenAI：API Key 無效或未授權 (401)';
        else if (res.status === 429) msg = 'OpenAI：請求過多或超出配額 (429)';
        return { models: [], error: msg };
      }
      const json = await res.json();
      const ids = Array.isArray(json?.data) ? json.data.map(m => m.id) : [];
      
      let filtered;
      if (isEmbedding) {
        // Embedding 模型：只要包含 embedding 或 embed
        filtered = ids.filter(id => {
          const s = String(id).toLowerCase();
          return /(embedding|embed)/.test(s) && !/whisper|tts|audio|image|vision|dall/.test(s);
        });
        const priority = ['text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002'];
        filtered.sort((a,b)=>{
          const ia = priority.findIndex(p=>a.includes(p));
          const ib = priority.findIndex(p=>b.includes(p));
          return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
        });
      } else {
        // 語言模型：排除 embedding、image、audio 等
        filtered = ids.filter(id => {
          const s = String(id).toLowerCase();
          const include = /(gpt|^o[34]|chatgpt|davinci)/.test(s);
          const exclude = /(embedding|embed|whisper|tts|audio|image|vision|dall|instruct)/.test(s);
          return include && !exclude;
        });
        const priority = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4', 'o3'];
        filtered.sort((a,b)=>{
          const ia = priority.findIndex(p=>a.includes(p));
          const ib = priority.findIndex(p=>b.includes(p));
          return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
        });
      }
      return { models: filtered };
    }
    if (company === 'ollama') {
      // Ollama 預設本機埠 http://localhost:11434/api/tags
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) return { models: [], error: '無法連線到 Ollama，請確認已安裝並啟動（11434）' };
        const json = await res.json();
        const models = Array.isArray(json?.models) ? json.models.map(m => m.name).filter(Boolean) : [];
        
        let filtered;
        if (isEmbedding) {
          // Embedding 模型
          filtered = models.filter(n => /embed/i.test(n));
        } else {
          // 語言模型
          filtered = models.filter(n => !/embed|vision|image|audio/i.test(n));
        }
        return { models: filtered };
      } catch (e) {
        return { models: [], error: 'Ollama 未啟動或無法連線' };
      }
    }
    if (company === 'google') {
      if (!apiKey) return { models: [], error: '缺少 API Key（Google）' };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) {
        let msg = `Google 錯誤 ${res.status}`;
        try { const j = await res.json(); if (j?.error?.message) msg = `Google：${j.error.message}`; } catch {}
        return { models: [], error: msg };
      }
      const json = await res.json();
      const models = Array.isArray(json?.models) ? json.models : [];
      
      let list;
      if (isEmbedding) {
        // Embedding 模型：支援 embedContent 方法
        list = models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.some(x => /embed/i.test(x)))
          .map(m => String(m.name || m.displayName || ''))
          .filter(Boolean)
          .map(name => name.replace(/^models\//, ''))
          .filter(n => /embed/i.test(n));
        const priority = ['text-embedding-004', 'embedding-001'];
        list.sort((a,b)=>{
          const ia = priority.findIndex(p=>a.includes(p));
          const ib = priority.findIndex(p=>b.includes(p));
          return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
        });
      } else {
        // 語言模型：支援 generateContent 方法，排除 embedding、vision、audio、image 等
        list = models
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.some(x => /generate/i.test(x)))
          .map(m => String(m.name || m.displayName || ''))
          .filter(Boolean)
          .map(name => name.replace(/^models\//, ''))
          .filter(n => {
            const s = n.toLowerCase();
            const include = /gemini/.test(s);
            const exclude = /(embed|embedding|vision|audio|image|instruct)/.test(s);
            return include && !exclude;
          });
        const priority = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
        list.sort((a,b)=>{
          const ia = priority.findIndex(p=>a.includes(p));
          const ib = priority.findIndex(p=>b.includes(p));
          return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
        });
      }
      return { models: list };
    }
    if (company === 'xai') {
      if (!apiKey) return { models: [], error: '缺少 API Key（xAI）' };
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
        let msg = `xAI 錯誤 ${res.status}`;
        if (res.status === 401) msg = 'xAI：API Key 無效或未授權 (401)';
        return { models: [], error: msg };
      }
      const json = await res.json();
      const ids = Array.isArray(json?.data) ? json.data.map(m => m.id) : [];
      
      let filtered;
      if (isEmbedding) {
        // xAI 的 embedding 模型（如果有的話）
        filtered = ids.filter(id => {
          const s = String(id).toLowerCase();
          return /(embed|embedding)/.test(s);
        });
      } else {
        // 語言模型
        filtered = ids.filter(id => {
          const s = String(id).toLowerCase();
          const include = /(grok|xai)/.test(s);
          const exclude = /(embed|embedding|audio|image|vision)/.test(s);
          return include && !exclude;
        });
      }
      const priority = isEmbedding ? [] : ['grok-2', 'grok-2-mini'];
      filtered.sort((a,b)=>{
        const ia = priority.findIndex(p=>a.includes(p));
        const ib = priority.findIndex(p=>b.includes(p));
        return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
      });
      return { models: filtered };
    }
    if (company === 'anthropic') {
      if (!apiKey) return { models: [], error: '缺少 API Key（Anthropic）' };
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      if (!res.ok) {
        let msg = `Anthropic 錯誤 ${res.status}`;
        if (res.status === 401) msg = 'Anthropic：API Key 無效或未授權 (401)';
        return { models: [], error: msg };
      }
      const json = await res.json();
      const ids = Array.isArray(json?.data) ? json.data.map(m => m.id) : [];
      
      let filtered;
      if (isEmbedding) {
        // Anthropic 的 embedding 模型（如果有的話）
        filtered = ids.filter(id => {
          const s = String(id).toLowerCase();
          return /(embed|embedding)/.test(s);
        });
      } else {
        // 語言模型
        filtered = ids.filter(id => {
          const s = String(id).toLowerCase();
          const include = /claude/.test(s);
          const exclude = /(embed|embedding|audio|image|vision)/.test(s);
          return include && !exclude;
        });
      }
      const priority = isEmbedding ? [] : ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'];
      filtered.sort((a,b)=>{
        const ia = priority.findIndex(p=>a.includes(p));
        const ib = priority.findIndex(p=>b.includes(p));
        return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
      });
      return { models: filtered };
    }
  } catch (err) {
    console.error('取得模型清單失敗:', err);
    return { models: [], error: '連線或解析失敗，請稍後再試' };
  }
  return { models: [], error: '未支援的供應商' };
});

// IPC: RAG 問答功能（使用 HTTP API）
ipcMain.handle('chat:ask', async (_event, payload) => {
  try {
    // 從 settings.json 讀取 RAG 配置
    const settings = readSettings();
    const ragConfig = settings.rag || {};
    
    // 準備參數
    const question = String(payload?.question || '');
    
    // 優先使用 payload 中的 collection，否則使用全局狀態
    let document_name = payload?.collection || currentDocumentState.collectionName || '';
    
    // 如果還是沒有，嘗試從歷史記錄中找最新的
    if (!document_name) {
      const history = readHistory();
      const latestDone = history.find(h => h.done && h.collectionName);
      if (latestDone) {
        document_name = latestDone.collectionName;
        console.log('[chat:ask] 從歷史記錄取得 collection_name:', document_name);
      }
    }
    
    const top_k = payload?.topK || payload?.top_k || 10;
    const include_sources = true;
    console.log('[DEBUG] chat:ask 參數', { question, document_name, top_k, include_sources });

    if (!question) {
      return { ok: false, error: '問題不能為空' };
    }
    
    if (!document_name) {
      return { ok: false, error: '請先處理 PDF 文件以建立知識庫' };
    }
    
    // 呼叫 HTTP API
    const result = await apiClient.askQuestion(
      question,
      document_name,
      top_k,
      include_sources
    );
    
    if (!result.success) {
      return { ok: false, error: result.message || '查詢失敗' };
    }
    
    // 格式化回應（與原本的格式相容）
    return {
      ok: true,
      text: result.data?.answer || '',
      answer: result.data?.answer || '',
      sources: result.data?.sources || [],
      followups: result.data?.suggested_questions || [],
      collection: document_name
    };
    
  } catch (e) {
    console.error('chat:ask 失敗:', e);
    return { ok: false, error: e.message || '查詢失敗，請稍後再試' };
  }
});

// IPC: 歷史紀錄操作
ipcMain.handle('history:list', () => readHistory());
ipcMain.handle('history:clear', () => { writeHistory([]); return true; });

// 保留外部內容注入接口：external:content
ipcMain.on('external:content', (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  // payload: { markdown?: string, zh?: string, en?: string, contentZh?: string, contentEn?: string }
  const content = typeof payload?.markdown === 'string' ? payload.markdown : undefined;
  const contentZh = payload?.contentZh || payload?.zh || undefined;
  const contentEn = payload?.contentEn || payload?.en || undefined;
  const evt = { type: 'done', sessionId: null };
  if (typeof content === 'string') evt.content = content;
  if (typeof contentZh === 'string') evt.contentZh = contentZh;
  if (typeof contentEn === 'string') evt.contentEn = contentEn;
  win?.webContents.send('process:evt', evt);
});
