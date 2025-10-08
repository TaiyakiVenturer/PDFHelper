// main.js - Electron 主程序
const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // 在 macOS 上, 當 dock 圖示被點擊且沒有其它視窗開啟時, 重新建立視窗
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const defaultSettings = { company: '', model: '', apiKey: '', theme: 'dark', lang: 'zh' };
const historyPath = path.join(app.getPath('userData'), 'history.json');
const dropDebugPath = path.join(__dirname, 'drop_debug.txt');
const uploadDir = path.join(app.getPath('userData'), 'uploads');

function readSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const json = JSON.parse(raw);
      return { ...defaultSettings, ...json };
    }
  } catch (err) {
    console.error('讀取設定失敗:', err);
  }
  return { ...defaultSettings };
}

function writeSettings(data) {
  try {
    const merged = { ...defaultSettings, ...(data || {}) };
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
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

// IPC: 檔案路徑送來 (預留給 Python)
ipcMain.on('file:chosen', (_event, filePath) => {
  console.log('[file:chosen]', filePath);
});

// IPC: 啟動處理流程（交給 Python；此處先放 stub）
const { spawn } = require('child_process');
ipcMain.handle('process:start', async (event, payload) => {
  const { filePath, company, model, apiKey, sessionId } = payload || {};
  if (!filePath) return { ok: false, error: '缺少檔案路徑' };
  if (!company || !model) return { ok: false, error: '缺少公司或模型' };
  try {
    console.log('[process:start]', { filePath, company, model, sessionId });
    const win = BrowserWindow.fromWebContents(event.sender);
    
    // 使用 uv run 來自動管理虛擬環境
    const projectRoot = path.join(__dirname, '..'); // 從 frontend 回到根目錄
    const script = path.join(__dirname, 'scripts', 'processor.py');
    
    // uv 的完整路徑（避免 PATH 問題）
    const uvPath = 'C:\\Users\\User\\.local\\bin\\uv.exe';
    const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    
    // 決定使用哪個 Python 執行方式
    let useUv = true;
    let command, args;
    
    if (fs.existsSync(uvPath)) {
      // 使用 uv run
      command = uvPath;
      args = ['run', 'python', '-u', script, filePath, company, model, sessionId];
      console.log('使用 uv run 模式');
    } else if (fs.existsSync(venvPython)) {
      // 備用：直接使用虛擬環境的 python
      command = venvPython;
      args = ['-u', script, filePath, company, model, sessionId];
      useUv = false;
      console.log('使用虛擬環境 Python 備用模式');
    } else {
      console.error('找不到 uv 或虛擬環境 Python');
      return { ok: false, error: 'Python 環境未找到，請先執行 uv sync' };
    }
    
    if (fs.existsSync(script)) {
      const env = { 
        ...process.env, 
        PYTHONIOENCODING: 'utf-8', 
        PYTHONUTF8: '1',
        PYTHONUNBUFFERED: '1',  // 確保即時輸出
        LC_ALL: 'C.UTF-8'       // 設置正確的 locale
      };

      env.PDFHELPER_TRANSLATOR_PROVIDER = company;
      env.PDFHELPER_TRANSLATOR_MODEL = model;
      if (apiKey) {
        env.PDFHELPER_TRANSLATOR_KEY = apiKey;
      } else {
        delete env.PDFHELPER_TRANSLATOR_KEY;
      }
      if (company === 'openai' && apiKey) {
        env.OPENAI_API_KEY = apiKey;
      }
      if (company === 'google' && apiKey) {
        env.GEMINI_API_KEY = apiKey;
      }
      if (company === 'anthropic' && apiKey) {
        env.ANTHROPIC_API_KEY = apiKey;
      }
      if (company === 'xai' && apiKey) {
        env.XAI_API_KEY = apiKey;
      }
      
      // 如果使用 uv，添加其路徑到 PATH
      if (useUv) {
        env.PATH = `C:\\Users\\User\\.local\\bin;${process.env.PATH || ''}`;
      }
      
      console.log('執行命令:', command);
      console.log('參數:', args.join(' '));
      console.log('工作目錄:', projectRoot);
      
      const child = spawn(command, args, { 
        cwd: projectRoot,  // 在項目根目錄執行
        env,
        stdio: ['pipe', 'pipe', 'pipe']  // 明確設置 stdio
      });
      
      // 設置編碼
      if (child.stdout) {
        child.stdout.setEncoding('utf8');
      }
      if (child.stderr) {
        child.stderr.setEncoding('utf8');
      }
      child.stdout.on('data', (buf) => {
        const text = typeof buf === 'string' ? buf : String(buf);
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const evtObj = JSON.parse(line);
            if (evtObj && evtObj.sessionId === sessionId) {
              win?.webContents.send('process:evt', evtObj);
              // 歷史紀錄：進度與完成
              if (evtObj.type === 'progress' || evtObj.type === 'done' || evtObj.type === 'error') {
                const list = readHistory();
                // 以 sessionId 聚合
                let rec = list.find(r => r.sessionId === sessionId);
                if (!rec) {
                  rec = { sessionId, filePath, company, model, createdAt: Date.now(), updates: [] };
                  list.unshift(rec);
                  // 控制上限 200 筆
                  if (list.length > 200) list.length = 200;
                }
                rec.updatedAt = Date.now();
                rec.lastType = evtObj.type;
                rec.lastStatus = evtObj.status || evtObj.error || '';
                if (evtObj.type === 'done') rec.done = true;
                if (evtObj.type === 'done' && evtObj.metadata) {
                  rec.metadata = evtObj.metadata;
                  if (!rec.preview && evtObj.metadata.markdownPath) {
                    rec.markdownPath = evtObj.metadata.markdownPath;
                  }
                }
                if (evtObj.type === 'error') rec.error = String(evtObj.error || '');
                // 儲存部分節錄內容（避免太大）
                if (evtObj.type === 'done' && evtObj.content) {
                  rec.preview = String(evtObj.content).slice(0, 5000);
                }
                rec.updates.push({ t: Date.now(), type: evtObj.type, status: evtObj.status || '', percent: evtObj.percent ?? null });
                writeHistory(list);
              }
            }
          } catch (e) {
            // 如果不是 JSON，檢查是否是日誌輸出
            if (line.includes('[PDFHelper]')) {
              // 這是來自 Python 的日誌輸出，直接顯示在控制台
              console.log('Python 日誌:', line);
            } else {
              console.warn('無法解析的 Python 輸出:', line);
            }
          }
        }
      });
      child.stderr.on('data', (buf) => {
        const text = typeof buf === 'string' ? buf : String(buf);
        console.warn('[python stderr]', text);
      });
      child.on('close', (code) => {
        if (code !== 0) {
          win?.webContents.send('process:evt', { type: 'error', sessionId, error: `Python 退出碼 ${code}` });
        }
      });
      return { ok: true };
    }
    // fallback: 簡易模擬
    let percent = 0;
    const stages = ['解析文件', '抽取文字', '理解內容', '產生結果'];
    const timer = setInterval(() => {
      const stage = stages[Math.min(stages.length - 1, Math.floor(percent / 25))];
      percent = Math.min(100, percent + Math.max(3, Math.random() * 10));
      win?.webContents.send('process:evt', { type: 'progress', sessionId, status: percent < 100 ? stage : '收尾中…' });
      if (percent >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          win?.webContents.send('process:evt', { type: 'done', sessionId, content: '# 處理完成' });
        }, 300);
      }
    }, 800);
    return { ok: true };
  } catch (err) {
    console.error('處理失敗', err);
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents.send('process:evt', { type: 'error', sessionId, error: '處理失敗，請稍後再試' });
    return { ok: false, error: '處理失敗，請稍後再試' };
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

ipcMain.handle('settings:save', (_event, data) => {
  return writeSettings(data);
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
ipcMain.handle('models:list', async (_event, company) => {
  const { apiKey } = readSettings();
  if (!company) return { models: [], error: '未選擇供應商' };
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
      // 僅保留語言模型，過濾掉 embedding/音訊/影像等
      const filtered = ids.filter(id => {
        const s = String(id).toLowerCase();
        const include = /(gpt|^o[34]|chatgpt|davinci)/.test(s);
        const exclude = /(embedding|embed|whisper|tts|audio|image|vision|dall)/.test(s);
        return include && !exclude;
      });
      // 排序：常用在前
      const priority = ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4', 'o3'];
      filtered.sort((a,b)=>{
        const ia = priority.findIndex(p=>a.includes(p));
        const ib = priority.findIndex(p=>b.includes(p));
        return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
      });
      return { models: filtered };
    }
    if (company === 'ollama') {
      // Ollama 預設本機埠 http://localhost:11434/api/tags
      try {
        const res = await fetch('http://localhost:11434/api/tags');
        if (!res.ok) return { models: [], error: '無法連線到 Ollama，請確認已安裝並啟動（11434）' };
        const json = await res.json();
        const models = Array.isArray(json?.models) ? json.models.map(m => m.name).filter(Boolean) : [];
        // 僅保留常見文字模型（粗略）
        const filtered = models.filter(n => !/embed|vision|image|audio/i.test(n));
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
      // 僅保留可產生文字/內容的 Gemini 型號
      const list = models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.some(x => /generate/i.test(x)))
        .map(m => String(m.name || m.displayName || ''))
        .filter(Boolean)
        .map(name => name.replace(/^models\//, ''))
        .filter(n => /gemini/i.test(n) && !/embed|embedding|vision/i.test(n));
      // 常用優先
      const priority = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0'];
      list.sort((a,b)=>{
        const ia = priority.findIndex(p=>a.includes(p));
        const ib = priority.findIndex(p=>b.includes(p));
        return (ia===-1?999:ia)-(ib===-1?999:ib) || a.localeCompare(b);
      });
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
      const filtered = ids.filter(id => {
        const s = String(id).toLowerCase();
        const include = /(grok|xai)/.test(s);
        const exclude = /(embed|embedding|audio|image|vision)/.test(s);
        return include && !exclude;
      });
      const priority = ['grok-2', 'grok-2-mini'];
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
      const filtered = ids.filter(id => {
        const s = String(id).toLowerCase();
        const include = /claude/.test(s);
        const exclude = /(embed|embedding|audio|image|vision)/.test(s);
        return include && !exclude;
      });
      const priority = ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'];
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

// 聊天：將問題交給合作方 Python 腳本處理
ipcMain.handle('chat:ask', async (_event, payload) => {
  try {
    const script = path.join(__dirname, 'scripts', 'chat.py');
    if (!fs.existsSync(script)) {
      return { ok: false, error: '找不到聊天腳本 scripts/chat.py' };
    }

    const projectRoot = path.join(__dirname, '..');
    const uvPath = 'C:\\Users\\User\\.local\\bin\\uv.exe';
    const venvPython = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    const systemPython = process.env.PYTHON || 'C:\\Users\\User\\anaconda3\\python.exe';

    const { spawn } = require('child_process');
    let command;
    let args;
    let useUv = false;
    if (fs.existsSync(uvPath)) {
      command = uvPath;
      args = ['run', 'python', '-u', script];
      useUv = true;
    } else if (fs.existsSync(venvPython)) {
      command = venvPython;
      args = ['-u', script];
    } else {
      command = systemPython;
      args = [script];
    }

    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONUNBUFFERED: '1',
      LC_ALL: 'C.UTF-8'
    };

    if (useUv) {
      env.PATH = `C:\\Users\\User\\.local\\bin;${process.env.PATH || ''}`;
    }

    // 傳遞翻譯、Embedding、RAG 設定供腳本讀取
    if (payload?.company) env.PDFHELPER_TRANSLATOR_PROVIDER = payload.company;
    if (payload?.model) env.PDFHELPER_TRANSLATOR_MODEL = payload.model;
    if (payload?.apiKey) env.PDFHELPER_TRANSLATOR_KEY = payload.apiKey;
    if (payload?.apiKey && payload?.company === 'openai') env.OPENAI_API_KEY = payload.apiKey;
    if (payload?.apiKey && payload?.company === 'google') env.GEMINI_API_KEY = payload.apiKey;
    if (payload?.apiKey && payload?.company === 'anthropic') env.ANTHROPIC_API_KEY = payload.apiKey;
    if (payload?.apiKey && payload?.company === 'xai') env.XAI_API_KEY = payload.apiKey;

    const child = spawn(command, args, {
      cwd: projectRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdin.setDefaultEncoding && child.stdin.setDefaultEncoding('utf8');
    child.stdout.setEncoding && child.stdout.setEncoding('utf8');
    child.stderr.setEncoding && child.stderr.setEncoding('utf8');

    const requestPayload = {
      question: String(payload?.question || ''),
      context: String(payload?.context || ''),
      lang: payload?.lang === 'en' ? 'en' : 'zh',
      history: payload?.history || [],
      collection: payload?.collection || null,
      translatedJsonPath: payload?.translatedJsonPath || null,
      source: payload?.source || null,
      topK: payload?.topK || payload?.top_k || undefined,
    };

    child.stdin.write(JSON.stringify(requestPayload) + '\n');
    child.stdin.end();

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += (typeof d === 'string' ? d : String(d)); });
    child.stderr.on('data', (d) => { err += (typeof d === 'string' ? d : String(d)); });

    const code = await new Promise((resolve) => child.on('close', resolve));
    if (code !== 0) {
      return { ok: false, error: err || `Python 退出碼 ${code}` };
    }

    const lines = out.split(/\r?\n/).filter(Boolean);
    if (!lines.length) {
      return { ok: false, error: '聊天腳本無輸出' };
    }

    let resp;
    try {
      resp = JSON.parse(lines[lines.length - 1]);
    } catch (e) {
      return { ok: false, error: '聊天腳本輸出非 JSON' };
    }

    if (resp?.success === False) {
      return { ok: false, error: resp?.error || '聊天腳本回傳錯誤' };
    }

    return {
      ok: true,
      text: String(resp?.answer ?? resp?.text ?? ''),
      answer: resp?.answer ?? resp?.text ?? '',
      sources: resp?.sources || [],
      followups: resp?.followups || [],
      collection: resp?.collection || requestPayload.collection || null,
    };
  } catch (e) {
    console.error('chat:ask 失敗:', e);
    return { ok: false, error: '聊天失敗，請稍後再試' };
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
