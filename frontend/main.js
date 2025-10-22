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

// 啟動畫面狀態
let splashWindow = null;
let splashReady = false;
const splashQueue = [];

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;

  splashReady = false;
  const win = new BrowserWindow({
    width: 480,
    height: 320,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('loading.html');

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });

  win.webContents.once('did-finish-load', () => {
    splashReady = true;
    while (splashQueue.length && !win.isDestroyed()) {
      const payload = splashQueue.shift();
      win.webContents.send('app:startup-status', payload);
    }
  });

  win.on('closed', () => {
    splashWindow = null;
    splashReady = false;
    splashQueue.length = 0;
  });

  splashWindow = win;
  return win;
}

function sendStartupStatus(message, state = 'info') {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  const payload = { message, state, timestamp: Date.now() };
  if (splashReady) {
    splashWindow.webContents.send('app:startup-status', payload);
  } else {
    splashQueue.push(payload);
  }
}

function closeSplashWindow(delay = 0) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  if (delay > 0) {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
    }, delay);
  } else {
    splashWindow.close();
  }
}

// 降低 Windows 磁碟快取錯誤訊息 (僅影響快取，不影響功能)
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

function createWindow() {
  sendStartupStatus('載入介面...', 'info');
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

  const toggleDevTools = () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  };

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toUpperCase();
    const isCtrlOrCmd = !!(input.control || input.meta);
    if (key === 'F12') {
      event.preventDefault();
      toggleDevTools();
    } else if (key === 'I' && isCtrlOrCmd && input.shift) {
      event.preventDefault();
      toggleDevTools();
    }
  });
  
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
  createSplashWindow();
  sendStartupStatus('正在啟動後端伺服器...', 'info');
  console.log("[INFO] 正在啟動後端伺服器...");

  const started = await serverManager.startServer({
    timeout: 60000,
    debug: false
  });
  // 檢查是否啟動成功
  if (!started)
  {
    console.error("[ERROR] 後端伺服器啟動失敗，請確認 Python 環境與相依套件是否正確安裝。");
    sendStartupStatus('後端伺服器啟動失敗，請確認環境設定。', 'error');
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
  sendStartupStatus('後端伺服器啟動成功，準備開啟介面。', 'success');

  closeSplashWindow();
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
const sessionTracker = new Map();

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
    // 先讀取現有設定，避免部分更新時清空其他欄位
    const current = readSettings();
    
    // 三層合併：預設值 → 現有設定 → 新資料
    let toSave = {
      translator: {
        ...defaultSettings.translator,
        ...current.translator,
        ...(data.translator || {})
      },
      embedding: {
        ...defaultSettings.embedding,
        ...current.embedding,
        ...(data.embedding || {})
      },
      rag: {
        ...defaultSettings.rag,
        ...current.rag,
        ...(data.rag || {})
      },
      theme: data.theme || current.theme || defaultSettings.theme,
      lang: data.lang || current.lang || defaultSettings.lang
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
      percent: 0,
      status: '已上傳 PDF',
      timestamp: Date.now()
    });

    const startAt = Date.now();
    sessionTracker.set(sessionId, {
      filePath,
      storedFileName: fileName,
      translator: `${translatorConfig.company}/${translatorConfig.model}`,
      embedding: `${embeddingConfig.company}/${embeddingConfig.model}`,
      createdAt: startAt,
      updatedAt: startAt,
      lastStatus: '已上傳 PDF'
    });

    // 更新後端的 API Key 和模型（分開更新）
    await apiClient.updateAPIKey("translator", translatorConfig.company, translatorConfig.apiKey, translatorConfig.model);
    await apiClient.updateAPIKey("embedding", embeddingConfig.company, embeddingConfig.apiKey, embeddingConfig.model);
    await apiClient.updateAPIKey("rag", settings.rag.company, settings.rag.apiKey, settings.rag.model);

    // 啟動非同步處理
    console.log('[process:start] 呼叫 API: startFullProcessAsync', { 
      fileName, 
      translator: `${translatorConfig.company}/${translatorConfig.model}`,
      embedding: `${embeddingConfig.company}/${embeddingConfig.model}`,
      sessionId 
    });
    method = "auto"; // 自動選擇解析方法
    lang = "en";   // 目標語言英文
    const asyncResult = await apiClient.startFullProcessAsync(
      fileName,
      method,
      lang
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
      sessionTracker.delete(sessionId);
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
        if (evtObj.type === 'progress') {
          const info = sessionTracker.get(sessionId) || {
            filePath,
            storedFileName: fileName,
            translator: `${translatorConfig.company}/${translatorConfig.model}`,
            embedding: `${embeddingConfig.company}/${embeddingConfig.model}`,
            createdAt: Date.now()
          };
          sessionTracker.set(sessionId, {
            ...info,
            updatedAt: Date.now(),
            lastStatus: evtObj.status || '',
            lastPercent: evtObj.percent ?? null
          });
        } else if (evtObj.type === 'done' || evtObj.type === 'error') {
          const info = sessionTracker.get(sessionId) || {};
          const finalRecord = {
            sessionId,
            filePath: info.filePath || filePath,
            storedFileName: info.storedFileName || fileName,
            translator: info.translator || `${translatorConfig.company}/${translatorConfig.model}`,
            embedding: info.embedding || `${embeddingConfig.company}/${embeddingConfig.model}`,
            createdAt: info.createdAt || Date.now(),
            updatedAt: Date.now(),
            status: evtObj.type,
            lastStatus: evtObj.status || evtObj.error || '',
            done: evtObj.type === 'done',
            error: evtObj.type === 'error' ? String(evtObj.error || '') : null
          };

          if (evtObj.type === 'done') {
            finalRecord.status = 'done';
            if (evtObj.metadata) {
              finalRecord.language = lang || null;
              finalRecord.collectionName = evtObj.metadata.collection_name || info.collectionName || null;
              if (evtObj.metadata.translated_json_name) {
                finalRecord.translatedJsonName = evtObj.metadata.translated_json_name;
              }
              if (evtObj.metadata.translated_json_path) {
                finalRecord.translatedJsonPath = evtObj.metadata.translated_json_path;
              }
              if (evtObj.metadata.translated_json_name) {
                try {
                  console.log('[process:start] 開始重組 Markdown:', evtObj.metadata.translated_json_name);
                  const reconstructResult = await apiClient.reconstructMarkdown(
                    evtObj.metadata.translated_json_name,
                    "auto",
                    "translated"
                  );

                  if (reconstructResult.success && reconstructResult.data?.markdown_path) {
                    const markdownPath = reconstructResult.data.markdown_path;
                    console.log('[process:start] Markdown 重組成功:', markdownPath);

                    if (fs.existsSync(markdownPath)) {
                      const markdownContent = fs.readFileSync(markdownPath, 'utf-8');
                      console.log('[process:start] Markdown 內容已讀取，長度:', markdownContent.length);

                      evtObj.content = markdownContent;
                      evtObj.metadata.markdownPath = markdownPath;
                      finalRecord.markdownPath = markdownPath;
                      currentDocumentState.markdownPath = markdownPath;

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

              if (!finalRecord.markdownPath && evtObj.metadata.markdownPath && fs.existsSync(evtObj.metadata.markdownPath)) {
                finalRecord.markdownPath = evtObj.metadata.markdownPath;
                currentDocumentState.markdownPath = evtObj.metadata.markdownPath;
              }

              if (finalRecord.collectionName) {
                currentDocumentState.collectionName = finalRecord.collectionName;
                console.log('[process:start] 更新當前文件狀態:', currentDocumentState);
              }
            }
          } else {
            finalRecord.status = 'error';
          }

          const list = readHistory().filter(r => r.sessionId !== sessionId);
          list.unshift(finalRecord);
          if (list.length > 200) list.length = 200;
          writeHistory(list);
          sessionTracker.delete(sessionId);
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
    if (sessionId) sessionTracker.delete(sessionId);
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
    const parsed = path.parse(base);
    let candidate = base || 'upload.pdf';
    let attempt = 1;
    fs.mkdirSync(uploadDir, { recursive: true });
    while (fs.existsSync(path.join(uploadDir, candidate))) {
      const suffix = `-${attempt++}`;
      candidate = `${parsed.name || 'upload'}${suffix}${parsed.ext || '.pdf'}`;
    }
    const filePath = path.join(uploadDir, candidate);
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
  // 本地寫入設定檔
  const result = writeSettings(data);
  console.log('[settings:save] 已寫入本地設定檔:', result);

  // 同步更新後端配置
  try {
    const translatorConfig = result.translator || {};
    const embeddingConfig = result.embedding || {};
    const ragConfig = result.rag || {};

    // 更新翻譯器配置
    if (translatorConfig.model && ((translatorConfig.apiKey && translatorConfig.company) || translatorConfig.company === 'ollama')) {
      // 更新後端 API Key
      await apiClient.updateAPIKey("translator", translatorConfig.company, translatorConfig.apiKey, translatorConfig.model);
      console.log('[settings:save] 已更新翻譯器配置:', translatorConfig.company, translatorConfig.model);
    }
    
    // 更新 Embedding 配置
    if (embeddingConfig.model && ((embeddingConfig.apiKey && embeddingConfig.company) || embeddingConfig.company === 'ollama')) {
      // 更新後端 API Key
      await apiClient.updateAPIKey("embedding", embeddingConfig.company, embeddingConfig.apiKey, embeddingConfig.model);
      console.log('[settings:save] 已更新 Embedding 配置:', embeddingConfig.company, embeddingConfig.model);
    }

    // 更新 RAG 配置
    if (ragConfig.model && ((ragConfig.apiKey && ragConfig.company) || ragConfig.company === 'ollama')) {
      // 更新後端 API Key
      await apiClient.updateAPIKey("rag", ragConfig.company, ragConfig.apiKey, ragConfig.model);
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

/**
 * 統一的模型過濾函式
 * @param {string[]} modelList - 原始模型列表
 * @param {boolean} isEmbedding - 是否為 embedding 模型
 * @param {RegExp} [includePattern] - 語言模型的包含條件 (可選)
 * @param {RegExp} [excludePattern] - 額外的排除條件 (可選)
 * @returns {string[]} 過濾後的模型列表
 */
function filter_models(modelList, isEmbedding, includePattern = null, excludePattern = null) {
  return modelList.filter(model => {
    const s = String(model).toLowerCase();
    
    if (isEmbedding) {
      // Embedding 模型: 必須包含 embed/embedding,排除 whisper/tts/audio/image/vision/dall
      const hasEmbed = /(embed|embedding)/.test(s);
      const isExcluded = /(whisper|tts|audio|image|vision|dall)/.test(s);
      return hasEmbed && !isExcluded;
    } else {
      // 語言模型: 檢查 include & exclude
      const shouldInclude = includePattern ? includePattern.test(s) : true;
      const baseExclude = /(embed|embedding|whisper|tts|audio|image|vision|dall|realtime|search)/.test(s);
      const extraExclude = excludePattern ? excludePattern.test(s) : false;
      return shouldInclude && !baseExclude && !extraExclude;
    }
  });
}

const companyNameMap = {
  'ollama': 'Ollama',
  'openai': 'OpenAI',
  'google': 'Google',
  'anthropic': 'Anthropic',
  'xai': 'xAI'
}

// IPC: 模型清單 (真實 API 查詢)
// 接受 company、可選的 apiKey 和 modelType 參數
// modelType: 'language' (預設) 或 'embedding'
ipcMain.handle('models:list', async (_event, company, providedApiKey, modelType = 'language') => {
  if (!company) return { models: [], error: '未選擇供應商' };
  
  // 如果沒有提供 API Key，從 settings 讀取（注意新版結構）
  let apiKey = providedApiKey;
  if (!apiKey && company != 'ollama') 
    return { models: [], error: `缺少 API Key (${companyNameMap[company]})` };  // company = ollama -> Ollama

  const isEmbedding = modelType === 'embedding';
  try {
    if (company === 'ollama') {
      // Ollama 預設本機埠 http://localhost:11434/api/tags
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) return { models: [], error: '無法連線到 Ollama，請確認已安裝並啟動（11434）' };
        const json = await res.json();
        const rawModels = Array.isArray(json?.models) ? json.models.map(m => m.name).filter(Boolean) : [];

        // 使用統一過濾函式 (Ollama 不需要額外的 includePattern)
        const models = filter_models(rawModels, isEmbedding);
        return { models };
      } catch (e) {
        return { models: [], error: 'Ollama 未啟動或無法連線' };
      }
    }
    else if (company === 'openai') {
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
      
      // 使用統一過濾函式
      const includePattern = /(gpt|^o[34]|chatgpt|davinci)/;
      const models = filter_models(ids, isEmbedding, includePattern);
      return { models };
    }
    else if (company === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) {
        let msg = `Google 錯誤 ${res.status}`;
        try { const j = await res.json(); if (j?.error?.message) msg = `Google：${j.error.message}`; } catch {}
        return { models: [], error: msg };
      }
      const json = await res.json();
      const allModels = Array.isArray(json?.models) ? json.models : [];
      
      // Google 特殊處理: 先根據 supportedGenerationMethods 篩選
      const methodFilter = isEmbedding ? /embed/i : /generate/i;
      const rawModels = allModels
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.some(x => methodFilter.test(x)))
        .map(m => String(m.name || m.displayName || ''))
        .filter(Boolean)
        .map(name => name.replace(/^models\//, ''));
      
      // 使用統一過濾函式
      const includePattern = /gemini/;
      const models = filter_models(rawModels, isEmbedding, includePattern);
      return { models };
    }
    else if (company === 'anthropic') {
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
      
      // 使用統一過濾函式
      const includePattern = /claude/;
      const models = filter_models(ids, isEmbedding, includePattern);
      return { models };
    }
    else if (company === 'xai') {
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
      
      // 使用統一過濾函式
      const includePattern = /(grok|xai)/;
      const models = filter_models(ids, isEmbedding, includePattern);
      return { models };
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
ipcMain.handle('history:clear', () => {
  sessionTracker.clear();
  writeHistory([]);
  return true;
});
ipcMain.handle('processed-docs:list', async () => {
  const history = readHistory();
  const items = history
    .filter(rec => rec && (rec.done || rec.status === 'done' || rec.status === 'error'))
    .map(rec => {
      const titleSource = rec.metadata?.title
        || rec.storedFileName
        || rec.filePath
        || rec.markdownPath
        || rec.sessionId;
      const statusCode = rec.status || (rec.done ? 'done' : '');
      const isError = statusCode === 'error';
      return {
        id: rec.sessionId,
        sessionId: rec.sessionId,
        title: titleSource ? path.basename(titleSource) : rec.sessionId,
        filePath: rec.filePath || '',
        updatedAt: rec.updatedAt || rec.createdAt || null,
        translator: rec.translator || '',
        model: rec.metadata?.translator_model || rec.metadata?.model || '',
        status: isError ? '錯誤' : '完成',
        state: statusCode,
        errorMessage: rec.error || rec.errorMessage || rec.metadata?.error || rec.metadata?.errorMessage || '',
        lastStatus: rec.lastStatus || rec.metadata?.lastStatus || '',
        language: rec.language || rec.metadata?.language || rec.metadata?.lang || '',
        collection: rec.collectionName || rec.metadata?.collection_name || '',
        markdownPath: rec.markdownPath || rec.metadata?.markdownPath || '',
        raw: rec
      };
    });
  return { ok: true, items };
});

ipcMain.handle('processed-docs:load', async (_event, docId) => {
  if (!docId) return { ok: false, error: '缺少識別碼' };
  const history = readHistory();
  const record = history.find(rec => rec.sessionId === docId || rec.collectionName === docId);
  if (!record) return { ok: false, error: '找不到紀錄' };

  let markdownPath = record.markdownPath || record.metadata?.markdownPath || '';
  if (!markdownPath || !fs.existsSync(markdownPath)) {
    const jsonName = record.translatedJsonName || record.metadata?.translated_json_name;
    if (jsonName) {
      try {
        const reconstructResult = await apiClient.reconstructMarkdown(jsonName, 'auto', 'zh');
        if (reconstructResult.success && reconstructResult.data?.markdown_path) {
          const candidate = reconstructResult.data.markdown_path;
          if (fs.existsSync(candidate)) {
            markdownPath = candidate;
            record.markdownPath = candidate;
            record.metadata = { ...(record.metadata || {}), markdownPath: candidate };
            const updatedHistory = history.filter(item => item.sessionId !== record.sessionId);
            updatedHistory.unshift(record);
            if (updatedHistory.length > 200) updatedHistory.length = 200;
            writeHistory(updatedHistory);
          }
        }
      } catch (err) {
        console.warn('[processed-docs:load] 重新重組 Markdown 失敗:', err);
      }
    }
  }

  if (!markdownPath || !fs.existsSync(markdownPath)) {
    return { ok: false, error: '找不到對應的內容檔案' };
  }

  const markdown = fs.readFileSync(markdownPath, 'utf-8');
  const meta = { ...(record.metadata || {}) };
  if (record.collectionName && !meta.collection_name) meta.collection_name = record.collectionName;
  const payload = {
    markdown,
    meta,
    metadata: meta,
    lang: record.language || meta.language || meta.lang || 'zh',
    sessionId: record.sessionId,
    filePath: record.filePath || '',
    translator: record.translator || '',
    embedding: record.embedding || '',
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null
  };
  return { ok: true, document: payload };
});

// IPC: 刪除已處理文件
ipcMain.handle('processed-docs:remove', async (_event, docId) => {
  if (!docId) return { ok: false, error: '缺少識別碼' };
  const history = readHistory();
  const index = history.findIndex(rec => rec.sessionId === docId || rec.collectionName === docId);
  if (index === -1) return { ok: false, error: '找不到紀錄' };

  const record = history[index];
  const storedFileName = record.storedFileName || '';
  if (storedFileName)
  {
    const result = await apiClient.removeFile(storedFileName);
    if (result.success)
      console.log('[processed-docs:remove] 已從後端刪除檔案:', storedFileName);
    else
      console.warn('[processed-docs:remove] 從後端刪除檔案失敗:', storedFileName, result.message);
  }

  history.splice(index, 1);
  writeHistory(history);
  return { ok: true };
});

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