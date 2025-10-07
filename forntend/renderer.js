let currentFileDir = '';

// 解析 file:/// 或 UNC 等 URL → Windows 路徑
function fileUrlToPath(uri) {
  try {
    if (!uri || typeof uri !== 'string') return '';
    if (!/^file:/i.test(uri)) return uri;
    let u = uri.replace(/^file:\/\//i, '');
    // UNC: file://server/share/dir/file -> \\\\server\\share\\dir\\file
    if (!/^\//.test(u) && !/^[a-zA-Z]:/.test(u)) {
      return "\\\\" + u.replace(/\//g, '\\');
    }
    // 本機: file:///C:/dir/file
    u = u.replace(/^\//, '');
    u = decodeURIComponent(u);
    return u.replace(/\//g, '\\');
  } catch { return ''; }
}

function parseUriList(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  return lines;
}

function pathDirname(p) {
  if (!p) return '';
  const idx1 = p.lastIndexOf('\\');
  const idx2 = p.lastIndexOf('/');
  const idx = Math.max(idx1, idx2);
  return idx >= 0 ? p.slice(0, idx) : '';
}

function pathBasename(p) {
  if (!p) return '';
  const idx1 = p.lastIndexOf('\\');
  const idx2 = p.lastIndexOf('/');
  const idx = Math.max(idx1, idx2);
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function resolveImageSrc(src) {
  if (!src) return src;
  const s = String(src);
  if (/^(https?:|data:|file:)/i.test(s)) return s;
  // 絕對 Windows 路徑
  if (/^[a-zA-Z]:[\\\/]/.test(s)) return 'file:///' + s.replace(/\\/g, '/');
  // UNC 開頭 \\\
  if (/^\\\\/.test(s)) return 'file:' + s.replace(/^\\\\/, '//').replace(/\\/g, '/');
  // 相對路徑，基於 Markdown 檔案路徑處理圖片
  if (currentFileDir) {
    const base = currentFileDir.replace(/\\/g, '/');
    const raw = (base.endsWith('/') ? base : base + '/') + s.replace(/\\/g, '/');
    const parts = raw.split('/');
    const stack = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') { stack.pop(); continue; }
      stack.push(part);
    }
    let joined = stack.join('/');
    if (/^[a-zA-Z]:$/.test(stack[0])) joined = '/' + joined;
    return 'file://' + (joined.startsWith('/') ? joined : '/' + joined);
  }
  return s;
}
// renderer.js - 控制畫面上的文字內容

// 視窗控制按鈕（仍保留標題列上的按鈕）
const btnMin = document.getElementById('btnMin');
const btnMax = document.getElementById('btnMax');
const btnClose = document.getElementById('btnClose');
const iconMax = document.getElementById('iconMax');

btnMin?.addEventListener('click', () => window.electronAPI?.minimize());
btnMax?.addEventListener('click', () => window.electronAPI?.maximizeToggle());
btnClose?.addEventListener('click', () => window.electronAPI?.close());

window.electronAPI?.onMaximizeState?.((isMax) => {
  if (!iconMax) return;
  iconMax.textContent = isMax ? '❐' : '▢';
});

// 上傳與拖放
const btnUpload = document.getElementById('btnUpload');
const dropZone = document.getElementById('dropZone');
const fileList = document.getElementById('fileList');
const btnStart = document.getElementById('btnStart');
const btnDeleteFile = document.getElementById('btnDeleteFile');
const processingView = document.getElementById('processingView');
const wrapUpload = document.querySelector('.wrap');
const resultView = document.getElementById('resultView');
const mdContainer = document.getElementById('mdContainer');
const btnNewFile = document.getElementById('btnNewFile');
// Chat UI elements
const chatListEl = document.getElementById('chatList');
const chatInputEl = document.getElementById('chatInput');
const btnChatSend = document.getElementById('btnChatSend');

// 日誌功能元素
const toggleLogsBtn = document.getElementById('toggleLogs');
const processingLogs = document.getElementById('processingLogs');
const logContent = document.getElementById('logContent');
let logsVisible = false;
let processingLogEntries = [];

// 日誌功能
function addLogEntry(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { time: timestamp, message, type };
  processingLogEntries.push(entry);
  
  // 限制日誌條目數量
  if (processingLogEntries.length > 100) {
    processingLogEntries = processingLogEntries.slice(-100);
  }
  
  // 更新日誌顯示
  if (logContent) {
    const logHtml = processingLogEntries.map(entry => {
      let color = 'var(--muted)';
      let style = '';
      
      // 根據類型設置顏色和樣式
      if (entry.type === 'error') {
        color = '#ef4444';
      } else if (entry.type === 'warning') {
        color = '#f59e0b';
      } else if (entry.type === 'backend') {
        // 後端日誌使用特殊樣式
        if (entry.message.includes('[ERROR]')) {
          color = '#ef4444';
        } else if (entry.message.includes('[MinerU]')) {
          color = '#06b6d4'; // 青色表示 MinerU 輸出
          style = 'font-family: monospace; font-size: 0.9em;';
        } else if (entry.message.includes('[INFO]')) {
          color = '#10b981'; // 綠色表示信息
        } else if (entry.message.includes('[SUCCESS]')) {
          color = '#22c55e'; // 亮綠色表示成功
        }
      }
      
      return `<div style="color:${color}; margin-bottom:2px; ${style}">[${entry.time}] ${entry.message}</div>`;
    }).join('');
    logContent.innerHTML = logHtml;
    
    // 自動滾動到底部
    logContent.scrollTop = logContent.scrollHeight;
  }
}

function clearLogs() {
  processingLogEntries = [];
  if (logContent) logContent.innerHTML = '';
}

// 日誌展開/收起
toggleLogsBtn?.addEventListener('click', () => {
  logsVisible = !logsVisible;
  if (processingLogs) processingLogs.style.display = logsVisible ? 'block' : 'none';
  if (toggleLogsBtn) toggleLogsBtn.textContent = logsVisible ? '隱藏處理日誌' : '顯示處理日誌';
});

const resultState = { markdown: '', zh: '', en: '', lang: 'zh', meta: null };
function currentMarkdown() {
  if (resultState.zh || resultState.en) {
    return resultState.lang === 'en' ? (resultState.en || resultState.markdown || '') : (resultState.zh || resultState.markdown || '');
  }
  return resultState.markdown || '';
}

function renderMarkdown() {
  if (!mdContainer) return;
  const src = currentMarkdown();
  try {
    // 解析 Markdown 並處理圖片路徑
    let html = window.marked ? window.marked.parse(src) : `<pre>${src}</pre>`;
    
    // 處理圖片相對路徑，基於 metadata 中的 markdownPath
    if (resultState.meta?.markdownPath) {
      currentFileDir = pathDirname(resultState.meta.markdownPath);
      // 替換圖片標籤中的相對路徑
      html = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/g, (match, before, src, after) => {
        const resolvedSrc = resolveImageSrc(src);
        return `<img${before}src="${resolvedSrc}"${after}>`;
      });
    }
    
    mdContainer.innerHTML = html;
    
    // 渲染 LaTeX（KaTeX auto-render）
    if (window.renderMathInElement) {
      window.renderMathInElement(mdContainer, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  } catch (e) {
    mdContainer.textContent = src;
    console.error('Markdown 渲染錯誤:', e);
  }
}
const procStatus = document.getElementById('procStatus');
// const uploadCard = document.querySelector('.upload-card'); // 不再使用整卡片點擊/拖放

function acceptExt(filePath) {
  const lower = (filePath || '').toLowerCase();
  return lower.endsWith('.pdf');
}

function showFiles(paths) {
  if (!fileList) return;
  const items = (paths || []).map(p => `<div style="font-size:14px;">• <strong>${pathBasename(p)}</strong></div>`).join('');
  fileList.innerHTML = items || '';
}

let pendingPdfPaths = [];
function updateActionButtons() {
  const hasFile = pendingPdfPaths.length > 0;
  if (btnStart) btnStart.style.display = hasFile ? 'inline-block' : 'none';
  if (btnDeleteFile) btnDeleteFile.style.display = hasFile ? 'inline-block' : 'none';
}

function setUploadControlsVisible(visible) {
  if (btnUpload) btnUpload.style.display = visible ? 'inline-block' : 'none';
  if (dropZone) dropZone.style.display = visible ? '' : 'none';
}

async function handleFiles(paths) {
  const normalized = (paths || []).map(p => fileUrlToPath(p)).filter(Boolean);
  const accepted = normalized.filter(acceptExt);
  const rejected = normalized.filter(p => !acceptExt(p));
  if (rejected.length) {
    showToast('檔案類型不符，僅支援 PDF', 'error', 2000);
  }
  if (accepted.length > 1) {
    showToast('一次僅能選擇一個 PDF，已保留第一個', 'error', 2000);
  }
  const first = accepted[0] ? [accepted[0]] : [];
  pendingPdfPaths = first;
  if (first.length) currentFileDir = pathDirname(first[0]);
  showFiles(first);
  updateActionButtons();
  setUploadControlsVisible(!first.length);
}

btnUpload?.addEventListener('click', async () => {
  const paths = await window.electronAPI?.openFileDialog?.();
  if (paths && paths.length) handleFiles(paths);
});

// 讓 dropZone 也可點擊開檔
dropZone?.addEventListener('click', async () => {
  const paths = await window.electronAPI?.openFileDialog?.();
  if (paths && paths.length) handleFiles(paths);
});

// 移除整卡片點擊以避免誤觸

['dragenter','dragover'].forEach(evt => {
  dropZone?.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt => {
  dropZone?.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragover');
  });
});
dropZone?.addEventListener('drop', async (e) => {
  const dt = e.dataTransfer;
  const fileList = Array.from(dt?.files || []);
  let paths = fileList.map(f => f.path).filter(Boolean);
  // Windows：嘗試從剪貼簿 CF_HDROP 取得原始路徑（某些來源會把路徑放到剪貼簿）
  if (!paths.length && navigator.platform && /Win/.test(navigator.platform)) {
    try {
      const clip = await window.electronAPI?.dropClipboardPaths?.();
      if (clip?.ok && Array.isArray(clip.paths) && clip.paths.length) {
        const p = clip.paths.filter(Boolean);
        if (p.length) {
          // 直接採用剪貼簿的原始路徑
          await handleFiles(p);
          return;
        }
      }
    } catch {}
  }
  // 某些環境拖放可能拿不到 path，嘗試從 items 拿 entry 名稱（瀏覽器內會是虛擬）
  if (!paths.length && dt?.items) {
    try {
      const items = Array.from(dt.items);
      const fileItems = items.filter(it => it.kind === 'file');
      // 在 Electron 中應該仍可取得 path；若拿不到就提示
      const guesses = await Promise.all(fileItems.map(async (it) => {
        const f = it.getAsFile?.();
        return f?.path || '';
      }));
      paths = guesses.filter(Boolean);
    } catch {}
  }
  // 仍然拿不到時，嘗試解析 text/uri-list
  if (!paths.length && dt?.getData) {
    try {
      const uriList = dt.getData('text/uri-list');
      if (uriList) {
        const uris = parseUriList(uriList);
        const p = uris.map(u => fileUrlToPath(u)).filter(Boolean);
        if (p.length) paths = p;
      }
    } catch {}
  }
  // 最後再嘗試 text/plain（例如從檔案總管拖的是字串路徑）
  if (!paths.length && dt?.getData) {
    try {
      const plain = dt.getData('text/plain');
      if (plain) {
        const arr = plain.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 8);
        const p = arr.map(s => /^file:/i.test(s) ? fileUrlToPath(s) : s).filter(Boolean);
        if (p.length) paths = p;
      }
    } catch {}
  }
  // 如果 types 只有 Files，且 file 有內容但無 path，走暫存檔後援路徑
  if (!paths.length && fileList.length > 0) {
    try {
      // 僅取第一個 PDF
      const f = fileList.find(x => /pdf$/i.test(x.name));
      if (f) {
        const ab = await f.arrayBuffer();
        const res = await window.electronAPI?.importTempFile?.(f.name, ab);
        if (res?.ok && res.filePath) {
          // 直接使用暫存檔路徑（不再提示選回原始檔）
          const tempPath = res.filePath;
          paths = [tempPath];
        }
      }
    } catch {}
  }
  if (!paths.length) {
    // 收集偵錯資訊
    let uriListRaw = '';
    let textPlainRaw = '';
    try { uriListRaw = dt?.getData ? dt.getData('text/uri-list') : ''; } catch {}
    try { textPlainRaw = dt?.getData ? dt.getData('text/plain') : ''; } catch {}
    const debugObj = {
      message: '拖放失敗：無法取得檔案路徑',
      types: Array.from(dt?.types || []),
      files: fileList.map(f => ({ name: f.name, type: f.type, size: f.size, path: !!f.path })),
      items: Array.from(dt?.items || []).map(it => ({ kind: it.kind, type: it.type })),
      uriListRaw,
      textPlainRaw,
      parsedFromUriList: parseUriList(uriListRaw || ''),
      parsedFromText: (textPlainRaw || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,8),
      platform: navigator.platform,
      userAgent: navigator.userAgent
    };
    try { window.electronAPI?.logDropDebug?.(debugObj); } catch {}
    showToast('拖放失敗：無法取得檔案路徑，已寫入 drop_debug.txt，請改用選擇檔案按鈕', 'error', 3200);
    return;
  }
  handleFiles(paths);
});

// 移除整卡片拖放，只保留 dropZone 的拖放

// 按下「開始」後才送路徑到主程序
btnStart?.addEventListener('click', async () => {
  if (!pendingPdfPaths.length) {
    showToast('請先選擇 PDF 檔案', 'error', 1600);
    return;
  }
  try {
    btnStart.disabled = true;
    btnStart.textContent = '處理中…';
    // 切換到全畫面處理視圖
    if (wrapUpload) wrapUpload.style.display = 'none';
    if (processingView) processingView.style.display = 'block';
    if (procStatus) procStatus.textContent = '準備開始…';

    // 讀取設定中的公司與模型
    const s = await window.electronAPI?.loadSettings?.();
    const company = s?.company || '';
    const model = s?.model || '';
    if (!company || !model) {
      showToast('請先在「設定」選擇公司與模型', 'error', 2200);
      if (processingView) processingView.style.display = 'none';
      if (wrapUpload) wrapUpload.style.display = '';
      return;
    }

  const filePath = pendingPdfPaths[0];
  currentFileDir = pathDirname(filePath);
    // 產生本次處理的 sessionId，讓事件可以對應
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const result = await window.electronAPI?.startProcessing?.({ filePath, company, model, sessionId });
    if (result?.ok) {
      showToast('處理完成', 'success', 1600);
    } else {
      const msg = result?.error || '處理失敗';
      showToast(msg, 'error', 2200);
    }
    // 視圖保留在處理畫面直到主程序事件宣告完成或失敗
  } finally {
    btnStart.disabled = false;
    btnStart.textContent = '開始';
  }
});

// 訂閱主程序的處理事件，更新處理畫面
let activeSessionId = null;
let processingStartTime = null;

function updateProcessingTime() {
  const procTime = document.getElementById('procTime');
  if (!procTime || !processingStartTime) return;
  
  const elapsed = Math.floor((Date.now() - processingStartTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}秒`;
  procTime.textContent = `處理時間: ${timeStr}`;
}

window.electronAPI?.onProcessEvent?.((evt) => {
  if (!evt || (activeSessionId && evt.sessionId && evt.sessionId !== activeSessionId)) return;
  if (evt.sessionId && !activeSessionId) {
    activeSessionId = evt.sessionId;
    processingStartTime = Date.now();
    clearLogs(); // 清除之前的日誌
    addLogEntry(`開始處理 Session: ${evt.sessionId}`);
    
    // 開始時間更新
    const timeInterval = setInterval(() => {
      if (!activeSessionId) {
        clearInterval(timeInterval);
        return;
      }
      updateProcessingTime();
    }, 1000);
  }
  
  if (evt.type === 'progress') {
    // 記錄進度到日誌
    const logMsg = `${evt.percent}% - ${evt.status}${evt.details ? ` (${evt.details})` : ''}`;
    addLogEntry(logMsg);
    
    // 更新主要狀態
    const procStatus = document.getElementById('procStatus');
    if (procStatus) procStatus.textContent = evt.status || '處理中…';
    
    // 更新詳細資訊
    const procDetails = document.getElementById('procDetails');
    if (procDetails) procDetails.textContent = evt.details || '';
    
    // 更新進度條
    const progressBar = document.getElementById('progressBar');
    if (progressBar && evt.percent !== undefined) {
      progressBar.style.width = `${Math.max(0, Math.min(100, evt.percent))}%`;
    }
    
    // 更新百分比顯示
    const procPercent = document.getElementById('procPercent');
    if (procPercent && evt.percent !== undefined) {
      procPercent.textContent = `${Math.round(evt.percent)}%`;
    }
    
    updateProcessingTime();
    
  } else if (evt.type === 'done') {
    const procStatus = document.getElementById('procStatus');
    if (procStatus) procStatus.textContent = '完成';
    
    const procDetails = document.getElementById('procDetails');
    if (procDetails) procDetails.textContent = evt.details || '處理成功完成';
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '100%';
    
    const procPercent = document.getElementById('procPercent');
    if (procPercent) procPercent.textContent = '100%';
    
    updateProcessingTime();
    showToast('處理完成', 'success', 1500);
    
    // 切到結果畫面並渲染 markdown
    const md = evt.content || '';
    resultState.markdown = md || resultState.markdown;
    if (evt.contentZh) resultState.zh = String(evt.contentZh);
    if (evt.contentEn) resultState.en = String(evt.contentEn);
    resultState.meta = evt.metadata || null;
    renderMarkdown();
    if (processingView) processingView.style.display = 'none';
    if (resultView) resultView.style.display = 'block';
    activeSessionId = null;
    processingStartTime = null;
    
  } else if (evt.type === 'log') {
    // 處理來自後端的實時日誌
    if (evt.message) {
      // 輸出到瀏覽器開發者控制台
      console.log(`[PDFHelper Backend] ${evt.message}`);
      
      // 添加到 UI 日誌列表
      addLogEntry(evt.message, 'backend');
      
      // 確保日誌區域可見（如果還沒展開的話）
      const logContainer = document.getElementById('logContainer');
      if (logContainer && !logContainer.style.display) {
        // 自動展開日誌，讓用戶看到實時輸出
        toggleLogsBtn?.click();
      }
    }
    
  } else if (evt.type === 'error') {
    const procStatus = document.getElementById('procStatus');
    if (procStatus) procStatus.textContent = '發生錯誤';
    
    const procDetails = document.getElementById('procDetails');
    if (procDetails) procDetails.textContent = evt.error || '處理失敗';
    
    updateProcessingTime();
    showToast(evt.error || '處理失敗', 'error', 2200);
    
    // 回到上傳畫面，避免卡在處理畫面
    if (processingView) processingView.style.display = 'none';
    if (wrapUpload) wrapUpload.style.display = '';
    activeSessionId = null;
    processingStartTime = null;
  }
});

// --- Chat 邏輯 ---
const chatState = {
  messages: [] // {role: 'user'|'assistant'|'system', content: string}
};

function renderChat() {
  if (!chatListEl) return;
  chatListEl.innerHTML = '';
  for (const m of chatState.messages) {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    div.textContent = m.content;
    chatListEl.appendChild(div);
  }
  // 滾到底
  chatListEl.scrollTop = chatListEl.scrollHeight;
}

async function sendChat() {
  if (!chatInputEl || !btnChatSend) return;
  const text = chatInputEl.value.trim();
  if (!text) return;
  // 推入使用者訊息
  chatState.messages.push({ role: 'user', content: text });
  renderChat();
  chatInputEl.value = '';
  btnChatSend.disabled = true;
  btnChatSend.textContent = '送出中…';
  try {
    // 將目前結果內容作為 context（可調整：也可改為選中的摘要等）
    const context = resultState.markdown || '';
  const res = await window.electronAPI?.chatAsk?.({ question: text, context, lang: resultState.lang });
    if (res?.ok) {
      chatState.messages.push({ role: 'assistant', content: String(res.text || '') });
    } else {
      chatState.messages.push({ role: 'assistant', content: `發生錯誤：${res?.error || '未知錯誤'}` });
    }
  } catch (e) {
    chatState.messages.push({ role: 'assistant', content: '發送失敗，請稍後再試' });
  } finally {
    btnChatSend.disabled = false;
    btnChatSend.textContent = '送出';
    renderChat();
    chatInputEl.focus();
  }
}

btnChatSend?.addEventListener('click', sendChat);
chatInputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

// 語言切換（中文/English）
const langToggle = document.getElementById('langToggle');
langToggle?.addEventListener('change', async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.name === 'lang') {
    resultState.lang = target.value === 'en' ? 'en' : 'zh';
    renderMarkdown();
    // 儲存到設定（與主題一致的做法）
    try {
      const existed = await window.electronAPI?.loadSettings?.();
      await window.electronAPI?.saveSettings?.({
        company: existed?.company || '',
        model: existed?.model || '',
        apiKey: existed?.apiKey || '',
        theme: existed?.theme || 'dark',
        lang: resultState.lang
      });
    } catch {}
  }
});

// 歷史按鈕（打開簡易歷史視窗）
const btnHistory = document.getElementById('btnHistory');
const historyBackdrop = document.getElementById('historyBackdrop');
const btnHistoryClose = document.getElementById('btnHistoryClose');
const btnHistoryClose2 = document.getElementById('btnHistoryClose2');
const btnHistoryClear = document.getElementById('btnHistoryClear');
const historyList = document.getElementById('historyList');

async function renderHistory() {
  const list = await window.electronAPI?.historyList?.();
  if (!historyList) return;
  const items = (Array.isArray(list) ? list : []).map(r => {
    const dt = new Date(r.updatedAt || r.createdAt || Date.now());
    const status = r.done ? '完成' : (r.error ? '錯誤' : (r.lastStatus || '進行中'));
    return `<div style="padding:8px 10px; border-bottom:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; gap:8px;">
        <div style="font-weight:600;">${r.filePath || '(無檔名)'} <span class="muted" style="font-weight:400;">${r.company || ''}/${r.model || ''}</span></div>
        <div class="muted">${dt.toLocaleString()}</div>
      </div>
      <div class="muted" style="margin-top:4px;">${status}</div>
    </div>`;
  }).join('');
  historyList.innerHTML = items || '<div class="muted">尚無歷程</div>';
}

function openHistory() {
  if (!historyBackdrop) return;
  renderHistory();
  historyBackdrop.style.display = 'flex';
  requestAnimationFrame(()=>historyBackdrop.classList.add('show'));
  const modal = historyBackdrop.querySelector('.modal');
  modal?.classList.add('open');
}
function closeHistory() {
  if (!historyBackdrop) return;
  historyBackdrop.classList.remove('show');
  const modal = historyBackdrop.querySelector('.modal');
  modal?.classList.remove('open');
  setTimeout(()=>{ historyBackdrop.style.display = 'none'; }, 180);
}

btnHistory?.addEventListener('click', openHistory);
btnHistoryClose?.addEventListener('click', closeHistory);
btnHistoryClose2?.addEventListener('click', closeHistory);
btnHistoryClear?.addEventListener('click', async () => {
  await window.electronAPI?.historyClear?.();
  renderHistory();
});


// 刪除檔案按鈕：清空選取
btnDeleteFile?.addEventListener('click', () => {
  pendingPdfPaths = [];
  showFiles([]);
  updateActionButtons();
  setUploadControlsVisible(true);
  showToast('已清除檔案', 'success', 1200);
});

// 新檔案：回到上傳畫面，清空結果與聊天
btnNewFile?.addEventListener('click', () => {
  // 隱藏結果、顯示上傳
  if (resultView) resultView.style.display = 'none';
  if (wrapUpload) wrapUpload.style.display = '';
  // 清空檔案與按鈕狀態
  pendingPdfPaths = [];
  showFiles([]);
  updateActionButtons();
  setUploadControlsVisible(true);
  // 清空結果
  resultState.markdown = '';
  if (mdContainer) mdContainer.innerHTML = '';
  // 清空聊天
  chatState.messages = [];
  renderChat();
});

// 設定 Modal
const modalBackdrop = document.getElementById('modalBackdrop');
const btnSettings = document.getElementById('btnSettings');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const selCompany = document.getElementById('selCompany');
const selModel = document.getElementById('selModel');
const txtApiKey = document.getElementById('txtApiKey');
const lblVersion = document.getElementById('lblVersion');
const btnUpdateInModal = document.getElementById('btnUpdateInModal');
const btnModalClose = document.getElementById('btnModalClose');
const btnToggleKey = document.getElementById('btnToggleKey');
const providerBadge = document.getElementById('providerBadge');
const updateStatus = document.getElementById('updateStatus');

function updateApiKeyFieldVisibility(company) {
  // Ollama 不需要 API Key，隱藏並停用欄位
  const isOllama = company === 'ollama';
  const fieldEl = txtApiKey ? txtApiKey.closest('.field') : null;
  if (fieldEl) fieldEl.style.display = isOllama ? 'none' : '';
  if (txtApiKey) txtApiKey.disabled = isOllama;
  if (btnToggleKey) btnToggleKey.style.display = isOllama ? 'none' : '';
}

function openModal() {
  if (!modalBackdrop) return;
  modalBackdrop.style.display = 'flex';
  requestAnimationFrame(() => {
    modalBackdrop.classList.add('show');
    const modal = modalBackdrop.querySelector('.modal');
    modal?.classList.add('open');
  });
}
function closeModal() {
  if (!modalBackdrop) return;
  const modal = modalBackdrop.querySelector('.modal');
  modal?.classList.remove('open');
  modalBackdrop.classList.remove('show');
  // 等待過場結束後隱藏
  setTimeout(() => { if (modalBackdrop) modalBackdrop.style.display = 'none'; }, 220);
}

function setProviderBadge(company) {
  if (!providerBadge) return;
  providerBadge.className = 'provider-badge';
  const map = { openai: 'OpenAI', google: 'Google', xai: 'xAI', anthropic: 'Anthropic', ollama: 'Ollama' };
  if (!company) { providerBadge.textContent = ''; return; }
  providerBadge.textContent = map[company] || '';
  providerBadge.classList.add(company);
}

async function loadModels(company) {
  if (!selModel) return;
  setProviderBadge(company);
  if (!company) {
    selModel.innerHTML = '<option value="">請先選公司</option>';
    return;
  }
  selModel.innerHTML = '<option value="">載入中…</option>';
  const res = await window.electronAPI?.listModels?.(company);
  const list = res?.models || [];
  const error = res?.error;
  if (error) {
    selModel.innerHTML = `<option value="">${error}</option>`;
    return;
  }
  if (!list.length) {
    selModel.innerHTML = '<option value="">未取得任何模型，請確認 API Key 或權限</option>';
    return;
  }
  const opts = list.map(m => `<option value="${m}">${m}</option>`).join('');
  selModel.innerHTML = `<option value=\"\">請選擇模型</option>${opts}`;
}

selCompany?.addEventListener('change', async () => {
  await loadModels(selCompany.value);
});

btnSettings?.addEventListener('click', async () => {
  let s;
  try {
    s = await window.electronAPI?.loadSettings?.();
  } catch (e) {
    showToast(`讀取設定失敗`, 'error');
  }
  if (s) {
    if (selCompany) selCompany.value = s.company || '';
    await loadModels(s.company || '');
    if (selModel) selModel.value = s.model || '';
    if (txtApiKey) txtApiKey.value = s.apiKey || '';
    updateApiKeyFieldVisibility(s.company || '');
  }
  // 主題 radio
  const theme = (s && s.theme) ? s.theme : 'dark';
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    if (el instanceof HTMLInputElement) el.checked = (el.value === theme);
  });
  // 顯示版本
  const res = await window.electronAPI?.checkUpdates?.();
  if (lblVersion && res) lblVersion.textContent = res.currentVersion;
  openModal();
});
btnCancelSettings?.addEventListener('click', () => closeModal());
btnModalClose?.addEventListener('click', () => closeModal());
modalBackdrop?.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalBackdrop?.style.display === 'flex') closeModal();
});

btnUpdateInModal?.addEventListener('click', async () => {
  if (!btnUpdateInModal || !updateStatus) return;
  btnUpdateInModal.disabled = true;
  updateStatus.className = 'update-status show info';
  updateStatus.innerHTML = `<span class="spinner" aria-hidden="true"></span> 正在檢查更新…`;
  try {
    const res = await window.electronAPI?.checkUpdates?.();
    if (!res) throw new Error('無回應');
    const { currentVersion, hasUpdate, message } = res;
    if (hasUpdate) {
      updateStatus.className = 'update-status show ok';
      updateStatus.textContent = `有新版本可用！目前版本 ${currentVersion}`;
    } else {
      updateStatus.className = 'update-status show info';
      updateStatus.textContent = message || `目前版本 ${currentVersion}，已是最新`;
    }
  } catch (err) {
    console.error('檢查更新失敗', err);
    updateStatus.className = 'update-status show error';
    updateStatus.textContent = '檢查更新失敗，請稍後再試';
  } finally {
    setTimeout(() => {
      updateStatus.classList.remove('show');
      btnUpdateInModal.disabled = false;
    }, 2200);
  }
});

async function applyTheme(theme) {
  // 先讓 UI 立即看到效果（非 system 可直接切換）
  if (theme === 'dark' || theme === 'light') {
    document.documentElement.setAttribute('data-theme', theme);
    // 背景更新後再通知 Electron 原生主題（不阻塞 UI）
    try { window.electronAPI?.setTheme?.(theme); } catch {}
    return;
  }
  // system 模式需查詢 nativeTheme 才能決定最終樣式
  let finalMode = 'dark';
  try {
    const nt = await window.electronAPI?.getNativeTheme?.();
    finalMode = (nt && nt.shouldUseDarkColors) ? 'dark' : 'light';
  } catch {}
  document.documentElement.setAttribute('data-theme', finalMode);
  try { window.electronAPI?.setTheme?.(theme); } catch {}
}

// 自動儲存：公司/模型/API Key 變更即儲存（成功靜默，失敗顯示）
let autosaveTimer;
async function autosaveSettings(patch = {}) {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      const existed = await window.electronAPI?.loadSettings?.();
      const data = {
        company: selCompany?.value ?? existed?.company ?? '',
        model: selModel?.value ?? existed?.model ?? '',
        apiKey: txtApiKey?.value ?? existed?.apiKey ?? '',
        theme: (document.querySelector('input[name="theme"]:checked')?.value) || existed?.theme || 'dark',
        ...patch
      };
      await window.electronAPI?.saveSettings?.(data);
      // 成功靜默
    } catch (err) {
      console.error('自動儲存失敗', err);
      showToast('儲存失敗，請稍後重試', 'error', 1800);
    }
  }, 250); // 短暫防抖，避免連續觸發
}

selCompany?.addEventListener('change', async () => {
  updateApiKeyFieldVisibility(selCompany.value);
  await loadModels(selCompany.value);
  autosaveSettings({ company: selCompany.value });
});
selModel?.addEventListener('change', () => {
  autosaveSettings({ model: selModel.value });
});
txtApiKey?.addEventListener('input', () => {
  autosaveSettings({ apiKey: txtApiKey.value });
  // API Key 改變時，如果已選擇公司就即時重新載入模型
  const company = selCompany?.value;
  if (company) {
    // 稍微延遲以等待 autosave 完成寫入
    setTimeout(() => loadModels(company), 350);
  }
});

// API Key 顯示/隱藏切換
btnToggleKey?.addEventListener('click', () => {
  if (!(txtApiKey instanceof HTMLInputElement)) return;
  const isPwd = txtApiKey.type === 'password';
  txtApiKey.type = isPwd ? 'text' : 'password';
  btnToggleKey.textContent = isPwd ? '隱藏' : '顯示';
});

// 啟動時讀取設定，套用主題
(async () => {
  const s = await window.electronAPI?.loadSettings?.();
  if (s && s.theme) await applyTheme(s.theme);
  // 若為系統模式，監聽 nativeTheme 變化並即時套用
  window.electronAPI?.onNativeThemeUpdated?.(async () => {
    const settings = await window.electronAPI?.loadSettings?.();
    if (settings?.theme === 'system') await applyTheme('system');
  });
  // 收到主程序的初始化主題時先套用
  window.electronAPI?.onApplyTheme?.(async (theme) => {
    await applyTheme(theme);
  });
})();

// 全域拖放防止瀏覽器開檔
['dragover','drop'].forEach(evt => {
  window.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

// Toast helpers
const toastEl = document.getElementById('toast');
function showToast(message, type = 'success', timeout = 2400) {
  if (!toastEl) return;
  const item = document.createElement('div');
  item.className = `item ${type}`;
  item.textContent = message;
  toastEl.appendChild(item);
  toastEl.style.display = 'block';
  // 進場動畫
  requestAnimationFrame(() => item.classList.add('show'));
  // 在 timeout 前加入 hide 類觸發退場
  const hideAt = Math.max(200, timeout - 180);
  setTimeout(() => {
    item.classList.add('hide');
    // 等退場動畫結束再移除
    setTimeout(() => {
      item.remove();
      if (!toastEl.childElementCount) toastEl.style.display = 'none';
    }, 220);
  }, hideAt);
}

// 綁定主題 Radio 即時切換並自動儲存（只綁一次）
let themeListenersBound = false;
function bindThemeListenersOnce() {
  if (themeListenersBound) return;
  const radios = Array.from(document.querySelectorAll('input[name="theme"]'));
  const segmented = document.querySelector('.segmented');
  radios.forEach((el) => {
    el.addEventListener('change', async (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement)) return;
      const value = input.value; // 'dark' | 'light' | 'system'
      try {
        await applyTheme(value); // 立即預覽
        // 立即儲存（僅保存主題，不關閉視窗）
        const existed = await window.electronAPI?.loadSettings?.();
        const data = {
          company: selCompany?.value ?? existed?.company ?? '',
          model: selModel?.value ?? existed?.model ?? '',
          apiKey: txtApiKey?.value ?? existed?.apiKey ?? '',
          theme: value
        };
        await window.electronAPI?.saveSettings?.(data);
        showToast('主題已套用並儲存', 'success', 1500);
      } catch (err) {
        console.error('即時套用/儲存主題失敗', err);
        showToast('主題已套用，但儲存失敗', 'error', 2000);
      }
    });
  });
  // 後備：點擊 segmented 的 label 也能穩定觸發
  segmented?.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLLabelElement && target.htmlFor) {
      const input = document.getElementById(target.htmlFor);
      if (input instanceof HTMLInputElement) input.click();
    }
  });
  themeListenersBound = true;
}

// DOM Ready 後先嘗試綁定（元素已在 HTML 中）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindThemeListenersOnce);
} else {
  bindThemeListenersOnce();
}
