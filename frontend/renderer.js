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
let mdContainer = document.getElementById('mdContainer');
let mdContainerSecondary = document.getElementById('mdContainerSecondary');
let readerContentEl = document.querySelector('.reader-content');
const btnNewFile = document.getElementById('btnNewFile');
// Chat UI elements
const chatListEl = document.getElementById('chatList');
const chatInputEl = document.getElementById('chatInput');
const btnChatSend = document.getElementById('btnChatSend');
// Reader enhancement elements
const docMetaSummary = document.getElementById('docMetaSummary');
const btnToggleToc = document.getElementById('btnToggleToc');
const btnToggleSplit = document.getElementById('btnToggleSplit');
const btnOpenNewWindow = document.getElementById('btnOpenNewWindow');
let readerPanels = document.getElementById('readerPanels');
let secondaryPanel = document.getElementById('secondaryPanel');
const secondarySourceSelect = document.getElementById('secondarySource');
const btnSyncScroll = document.getElementById('btnSyncScroll');
const tocSidebar = document.getElementById('tocSidebar');
const tocListEl = document.getElementById('tocList');
const btnTocExpand = document.getElementById('btnTocExpand');
const btnTocCollapse = document.getElementById('btnTocCollapse');
const btnPrevSection = document.getElementById('btnPrevSection');
const btnNextSection = document.getElementById('btnNextSection');
const searchInputEl = document.getElementById('searchInput');
const btnSearchPrev = document.getElementById('btnSearchPrev');
const btnSearchNext = document.getElementById('btnSearchNext');
const btnSearchClear = document.getElementById('btnSearchClear');
const searchCounterEl = document.getElementById('searchCounter');
const contextChipsEl = document.getElementById('contextChips');
const selectionPopover = document.getElementById('selectionPopover');
const btnHighlightSelection = document.getElementById('btnHighlightSelection');
const btnRemoveHighlight = document.getElementById('btnRemoveHighlight');
const btnNoteSelection = document.getElementById('btnNoteSelection');
const btnAskSelection = document.getElementById('btnAskSelection');
const referenceTrailEl = document.getElementById('referenceTrail');
const btnAddBookmark = document.getElementById('btnAddBookmark');
const btnExportBookmarks = document.getElementById('btnExportBookmarks');
const bookmarkListEl = document.getElementById('bookmarkList');
const btnCreateNote = document.getElementById('btnCreateNote');
const noteListEl = document.getElementById('noteList');
const noteComposerEl = document.getElementById('noteComposer');
const noteComposerInput = document.getElementById('noteComposerInput');
const noteComposerContext = document.getElementById('noteComposerContext');
const btnNoteSave = document.getElementById('btnNoteSave');
const btnNoteCancel = document.getElementById('btnNoteCancel');
const suggestedQuestionsEl = document.getElementById('suggestedQuestions');
const btnChatNew = document.getElementById('btnChatNew');
const btnChatHistory = document.getElementById('btnChatHistory');
const btnChatHistoryClose = document.getElementById('btnChatHistoryClose');
const btnChatHistoryClose2 = document.getElementById('btnChatHistoryClose2');
const btnChatHistoryDelete = document.getElementById('btnChatHistoryDelete');
const btnChatHistoryLoad = document.getElementById('btnChatHistoryLoad');
const chatHistoryBackdrop = document.getElementById('chatHistoryBackdrop');
const chatHistoryListEl = document.getElementById('chatHistoryList');
const btnVoiceInput = document.getElementById('btnVoiceInput');
const btnVoiceOutput = document.getElementById('btnVoiceOutput');

function ensureReaderContainers() {
  if (!mdContainer || !mdContainer.isConnected) {
    mdContainer = document.getElementById('mdContainer');
  }
  if (!mdContainerSecondary || !mdContainerSecondary.isConnected) {
    mdContainerSecondary = document.getElementById('mdContainerSecondary');
  }
  if (!readerContentEl || !readerContentEl.isConnected) {
    readerContentEl = document.querySelector('.reader-content');
  }
  if (!readerPanels || !readerPanels.isConnected) {
    readerPanels = document.getElementById('readerPanels');
  }
  if (!secondaryPanel || !secondaryPanel.isConnected) {
    secondaryPanel = document.getElementById('secondaryPanel');
  }
}

document.addEventListener('DOMContentLoaded', ensureReaderContainers);
ensureReaderContainers();

// 日誌功能元素
const toggleLogsBtn = document.getElementById('toggleLogs');
const processingLogs = document.getElementById('processingLogs');
const logContent = document.getElementById('logContent');
let logsVisible = false;
let processingLogEntries = [];
let logAutoScroll = true;
const LOG_SCROLL_THRESHOLD = 24;

function isElementNearBottom(el) {
  if (!el) return true;
  return el.scrollHeight - el.clientHeight - el.scrollTop <= LOG_SCROLL_THRESHOLD;
}

function attachLogScrollListeners() {
  if (!logContent) return;
  logContent.addEventListener('scroll', () => {
    logAutoScroll = isElementNearBottom(logContent);
  }, { passive: true });
}

attachLogScrollListeners();

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
    const shouldStickToBottom = logAutoScroll || isElementNearBottom(logContent);
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
        } else if (entry.message.includes('[INFO]')) {
          color = '#10b981'; // 綠色表示信息
        } else if (entry.message.includes('[SUCCESS]')) {
          color = '#22c55e'; // 亮綠色表示成功
        }
      }
      
      return `<div class="log-line" style="color:${color}; ${style}">[${entry.time}] ${entry.message}</div>`;
    }).join('');
    logContent.innerHTML = logHtml;

    // 自動滾動到底部（除非使用者手動捲動離開底部）
    if (shouldStickToBottom) {
      logContent.scrollTop = logContent.scrollHeight;
    }
  }
}

function clearLogs() {
  processingLogEntries = [];
  logAutoScroll = true;
  if (logContent) logContent.innerHTML = '';
}

function resetProcessingLogsUI() {
  logsVisible = false;
  logAutoScroll = true;
  if (processingLogs) processingLogs.style.display = 'none';
  if (toggleLogsBtn) toggleLogsBtn.textContent = '顯示處理日誌';
  if (logContent) {
    logContent.scrollTop = logContent.scrollHeight;
  }
}

// 日誌展開/收起
toggleLogsBtn?.addEventListener('click', () => {
  logsVisible = !logsVisible;
  if (processingLogs) processingLogs.style.display = logsVisible ? 'block' : 'none';
  if (toggleLogsBtn) toggleLogsBtn.textContent = logsVisible ? '隱藏處理日誌' : '顯示處理日誌';
  if (logsVisible) {
    logAutoScroll = true;
    if (logContent) logContent.scrollTop = logContent.scrollHeight;
  }
});

const resultState = {
  markdown: '',
  zh: '',
  en: '',
  lang: 'zh',
  meta: null,
  headings: [],
  stats: { words: 0, sections: 0 }
};
const STORAGE_KEYS = {
  bookmarks: 'pdfhelper.reader.bookmarks',
  notes: 'pdfhelper.reader.notes',
  annotations: 'pdfhelper.reader.annotations',
  readerPrefs: 'pdfhelper.reader.preferences',
  chatHistory: 'pdfhelper.chat.history'
};
const tocState = { items: [], activeId: null };
const searchState = { query: '', hits: [], activeIndex: -1 };
const bookmarkState = { items: loadFromStorage(STORAGE_KEYS.bookmarks, []) };
const noteState = { items: loadFromStorage(STORAGE_KEYS.notes, []) };
const annotationState = loadFromStorage(STORAGE_KEYS.annotations, { highlights: [] });
if (!annotationState.highlights) annotationState.highlights = [];
const readerPrefs = loadFromStorage(STORAGE_KEYS.readerPrefs, { split: false, syncScroll: false, tocVisible: false });
if (typeof readerPrefs.tocVisible !== 'boolean') {
  readerPrefs.tocVisible = false;
  persistToStorage(STORAGE_KEYS.readerPrefs, readerPrefs);
}
const referenceTrail = [];
const selectionState = { range: null, text: '', headingId: null, fromSecondary: false, highlightId: null };
const noteComposerState = { editingId: null, headingId: null, snippet: '' };
let activeHeadingId = null;
let headingObserver = null;
let syncScrollActive = Boolean(readerPrefs.syncScroll);
let scrollProgress = 0;

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return Array.isArray(value) ? [...value] : { ...value }; }
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return cloneValue(fallback);
    const parsed = JSON.parse(raw);
    return typeof parsed === 'undefined' ? cloneValue(fallback) : parsed;
  } catch {
    return cloneValue(fallback);
  }
}

function persistToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('無法儲存資料到 localStorage:', err);
  }
}
function currentMarkdown() {
  if (resultState.zh || resultState.en) {
    return resultState.lang === 'en' ? (resultState.en || resultState.markdown || '') : (resultState.zh || resultState.markdown || '');
  }
  return resultState.markdown || '';
}

function renderMarkdown() {
  ensureReaderContainers();
  if (!mdContainer) return;
  const src = currentMarkdown();
  if (!src || !src.trim()) {
    mdContainer.innerHTML = '<div class="muted" style="padding:12px;">目前沒有可顯示的內容</div>';
    if (mdContainerSecondary) mdContainerSecondary.innerHTML = '';
    resultState.headings = [];
    renderToc();
    scrollProgress = 0;
    updateDocMetaSummary();
    return;
  }
  
  // 除錯：檢查 Markdown 函式庫是否載入
  console.log('Markdown 渲染偵錯:', {
    hasMarked: !!window.marked,
    markedType: typeof window.marked,
    srcLength: src.length,
    srcPreview: src.slice(0, 200) + (src.length > 200 ? '...' : '')
  });
  
  try {
    const markdownPath = resultState.meta?.markdownPath || '';
    const html = convertMarkdownToHtml(src, markdownPath);
    mdContainer.innerHTML = html;
    console.log('Markdown 渲染成功，HTML 長度:', html.length);
  activeHeadingId = null;
    postProcessMarkdown();
    
    // 渲染 LaTeX（KaTeX auto-render）
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(mdContainer, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
        console.log('LaTeX 渲染完成');
      } catch (katexError) {
        console.warn('LaTeX 渲染失敗:', katexError);
      }
    }
    enableSplitView(Boolean(readerPrefs.split), false);
    applyAnnotations();
    if (searchState.query) {
      highlightSearchQuery(searchState.query);
    }
  } catch (e) {
    console.error('Markdown 渲染錯誤:', e);
    // 顯示原始文本，但保持基本格式
    mdContainer.innerHTML = `<pre style="white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">${escapeHtml(src)}</pre>`;
  }
}

// 簡單的 Markdown 解析器（後備方案）
function simpleMarkdownParse(text) {
  return text
    // 標題
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 粗體和斜體
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 程式碼塊
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // 連結
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
    // 圖片
    .replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img alt="$1" src="$2" style="max-width: 100%; height: auto;">')
    // 列表
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // 段落
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h1-6]|<ul|<pre|<code)(.+)$/gm, '<p>$1</p>')
    // 清理多餘的標籤
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>.*?<\/ul>)<\/p>/g, '$1')
    .replace(/<p>(<pre>.*?<\/pre>)<\/p>/g, '$1');
}

function convertMarkdownToHtml(markdown, markdownPath) {
  if (!markdown || !markdown.trim()) return '';

  let html = '';
  if (window.marked && typeof window.marked.parse === 'function') {
    html = window.marked.parse(markdown);
  } else if (window.marked && typeof window.marked === 'function') {
    html = window.marked(markdown);
  } else {
    console.warn('marked 函式庫未載入，使用後備解析器');
    html = simpleMarkdownParse(markdown);
  }

  if (markdownPath) {
    currentFileDir = pathDirname(markdownPath);
    html = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/g, (match, before, src, after) => {
      const resolvedSrc = resolveImageSrc(src);
      return `<img${before}src="${resolvedSrc}"${after}>`;
    });
  }

  return html;
}

// HTML 跳脫函數
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeCssId(value) {
  if (typeof value !== 'string') return '';
  if (window.CSS?.escape) return window.CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
}

function postProcessMarkdown() {
  if (!mdContainer) return;
  const headingEls = Array.from(mdContainer.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  resultState.headings = headingEls.map((el, idx) => {
    let id = el.getAttribute('id');
    const text = (el.textContent || '').trim();
    if (!id) {
      id = slugifyHeading(text, idx);
      el.id = id;
    }
    el.dataset.headingId = id;
    return { id, text, level: Number(el.tagName.replace('H', '')) || 1 };
  });
  resultState.stats = {
    words: countDocumentWords(mdContainer.textContent || ''),
    sections: resultState.headings.length
  };
  if (!activeHeadingId && resultState.headings.length) {
    activeHeadingId = resultState.headings[0].id;
  }
  updateDocMetaSummary();
  renderToc();
  setupHeadingObserver(headingEls);
  populateSecondarySourceOptions();
  renderContextChips();
  prepareReferenceTargets();
  updateSuggestedQuestions();
  updateScrollProgressIndicator();
}

function countDocumentWords(text) {
  if (!text) return 0;
  const clean = text.replace(/\s+/g, '');
  return clean.length;
}

function updateDocMetaSummary() {
  if (!docMetaSummary) return;
  const { sections, words } = resultState.stats;
  const parts = [];
  if (sections) parts.push(`節數 ${sections}`);
  if (words) parts.push(`約 ${words} 字`);
  if (Number.isFinite(scrollProgress)) parts.push(`${scrollProgress}%`);
  docMetaSummary.textContent = parts.join(' · ');
}

function updateScrollProgressIndicator() {
  ensureReaderContainers();
  if (!mdContainer) return;
  const ratio = mdContainer.scrollTop / Math.max(1, mdContainer.scrollHeight - mdContainer.clientHeight);
  scrollProgress = Math.round(ratio * 100);
  updateDocMetaSummary();
}

function slugifyHeading(text, idx) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);
  return base || `section-${idx}`;
}

function renderToc() {
  if (!tocListEl) return;
  const html = resultState.headings.map(h => {
    const level = Math.min(Math.max(h.level, 1), 4);
    return `<div class="toc-item toc-level-${level}" data-id="${escapeHtml(h.id)}" tabindex="0">${escapeHtml(h.text)}</div>`;
  }).join('');
  tocListEl.innerHTML = html || '<div class="muted">尚無標題</div>';
  highlightActiveToc();
}

function activateTocItem(id) {
  ensureReaderContainers();
  if (!id) return;
  const target = mdContainer?.querySelector(`#${escapeCssId(id)}`);
  if (target) {
    smoothScrollIntoView(mdContainer, target);
    setActiveHeading(id, { pushTrail: true });
  }
}

function jumpToAdjacentHeading(direction) {
  if (!resultState.headings.length) return;
  const currentIndex = resultState.headings.findIndex(h => h.id === activeHeadingId);
  let targetIndex = currentIndex === -1 ? (direction > 0 ? 0 : resultState.headings.length - 1) : currentIndex + direction;
  targetIndex = Math.max(0, Math.min(resultState.headings.length - 1, targetIndex));
  const target = resultState.headings[targetIndex];
  if (target) activateTocItem(target.id);
}

function highlightActiveToc() {
  ensureReaderContainers();
  if (!tocListEl) return;
  const items = tocListEl.querySelectorAll('.toc-item');
  items.forEach(item => {
    if (item.getAttribute('data-id') === activeHeadingId) item.classList.add('active');
    else item.classList.remove('active');
  });
}

function setupHeadingObserver(headingEls) {
  ensureReaderContainers();
  if (!mdContainer || !headingEls.length || typeof IntersectionObserver === 'undefined') return;
  if (headingObserver) headingObserver.disconnect();
  headingObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible.length) {
      const id = visible[0].target.dataset.headingId || visible[0].target.id;
      if (id) setActiveHeading(id);
    }
  }, { root: mdContainer, rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
  headingEls.forEach(el => headingObserver.observe(el));
}

function setActiveHeading(id, options = { pushTrail: false }) {
  if (!id) return;
  activeHeadingId = id;
  highlightActiveToc();
  renderContextChips();
  if (options.pushTrail) {
    addToReferenceTrail(id);
  }
}

function renderContextChips() {
  if (!contextChipsEl) return;
  const chips = [];
  if (activeHeadingId) {
    const heading = resultState.headings.find(h => h.id === activeHeadingId);
    if (heading) {
      chips.push({ id: heading.id, label: `章節：${heading.text.slice(0, 24)}` });
    }
  }
  if (selectionState.text) {
    chips.push({ id: 'selection', label: `選取：${selectionState.text.slice(0, 30)}` });
  }
  if (annotationState.highlights?.length) {
    const latest = annotationState.highlights[annotationState.highlights.length - 1];
    chips.push({ id: latest.id, label: `標註：${latest.snippet.slice(0, 24)}` });
  }
  contextChipsEl.innerHTML = chips.map(chip => `<span class="context-chip" data-chip-id="${escapeHtml(chip.id)}">${escapeHtml(chip.label)}</span>`).join('');
}

function addToReferenceTrail(id) {
  if (!referenceTrailEl) return;
  const heading = resultState.headings.find(h => h.id === id);
  if (!heading) return;
  const exists = referenceTrail.some(item => item.id === id);
  if (!exists) referenceTrail.unshift({ id, text: heading.text, time: Date.now() });
  if (referenceTrail.length > 6) referenceTrail.length = 6;
  renderReferenceTrail();
}

function renderReferenceTrail() {
  if (!referenceTrailEl) return;
  if (!referenceTrail.length) {
    referenceTrailEl.hidden = true;
    referenceTrailEl.innerHTML = '';
    return;
  }
  referenceTrailEl.hidden = false;
  referenceTrailEl.innerHTML = referenceTrail
    .map(item => `<span class="trail-item" data-id="${escapeHtml(item.id)}">${escapeHtml(item.text)}</span>`)
    .join('');
}

function populateSecondarySourceOptions() {
  if (!secondarySourceSelect) return;
  const opts = ['<option value="">選擇目標節點</option>']
    .concat(resultState.headings.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.text)}</option>`));
  secondarySourceSelect.innerHTML = opts.join('');
}

function enableSplitView(enable, persistPreference = true) {
  ensureReaderContainers();
  if (!readerPanels || !secondaryPanel || !mdContainerSecondary) return;
  readerPrefs.split = enable;
  if (persistPreference) {
    persistToStorage(STORAGE_KEYS.readerPrefs, readerPrefs);
  }
  btnToggleSplit?.classList.toggle('active', enable);
  if (enable) {
    readerPanels.dataset.split = 'true';
    secondaryPanel.hidden = false;
    renderSecondaryMarkdown();
    toggleSyncScroll(Boolean(readerPrefs.syncScroll), false);
    if (readerPrefs.syncScroll) toggleSyncScroll(true);
  } else {
    readerPanels.dataset.split = 'false';
    secondaryPanel.hidden = true;
    mdContainerSecondary.innerHTML = '';
    toggleSyncScroll(false, false);
  }
}

function setSecondaryContent(html) {
  ensureReaderContainers();
  if (!mdContainerSecondary) return;
  const processed = cloneHtmlForSecondary(html);
  mdContainerSecondary.innerHTML = processed;
}

function getAlternateMarkdown() {
  const primary = String(currentMarkdown() || '').trim();
  const candidates = [];
  if (resultState.lang === 'zh') {
    candidates.push(resultState.en, resultState.markdown);
  } else if (resultState.lang === 'en') {
    candidates.push(resultState.zh, resultState.markdown);
  } else {
    candidates.push(resultState.zh, resultState.en);
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = String(candidate).trim();
    if (trimmed && trimmed !== primary) return trimmed;
  }
  return '';
}

function renderSecondaryMarkdown() {
  ensureReaderContainers();
  if (!mdContainerSecondary) return;
  const altMarkdown = getAlternateMarkdown();
  if (!altMarkdown || !altMarkdown.trim()) {
    mdContainerSecondary.innerHTML = '<div class="muted" style="padding:12px;">尚無其他語言的內容</div>';
    return;
  }
  const markdownPath = resultState.meta?.markdownPath || '';
  const html = convertMarkdownToHtml(altMarkdown, markdownPath);
  setSecondaryContent(html);
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(mdContainerSecondary, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    } catch (err) {
      console.warn('Secondary LaTeX 渲染失敗:', err);
    }
  }
}

function cloneHtmlForSecondary(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.querySelectorAll('[id]').forEach(el => {
    const original = el.id;
    el.dataset.anchor = original;
    el.id = `${original}__secondary`;
  });
  return wrapper.innerHTML;
}

function toggleSyncScroll(enable, persistPreference = true) {
  ensureReaderContainers();
  syncScrollActive = enable;
  if (persistPreference) {
    readerPrefs.syncScroll = enable;
    persistToStorage(STORAGE_KEYS.readerPrefs, readerPrefs);
  }
  if (!mdContainer || !mdContainerSecondary) return;
  mdContainer.removeEventListener('scroll', syncScrollPrimaryHandler);
  mdContainerSecondary.removeEventListener('scroll', syncScrollSecondaryHandler);
  if (enable) {
    mdContainer.addEventListener('scroll', syncScrollPrimaryHandler);
    mdContainerSecondary.addEventListener('scroll', syncScrollSecondaryHandler);
  }
  if (btnSyncScroll) {
    btnSyncScroll.classList.toggle('active', enable);
    btnSyncScroll.setAttribute('aria-pressed', enable ? 'true' : 'false');
  }
}

function syncScrollPrimaryHandler() {
  if (!syncScrollActive || !mdContainerSecondary) return;
  const ratio = mdContainer.scrollTop / Math.max(1, mdContainer.scrollHeight - mdContainer.clientHeight);
  mdContainerSecondary.scrollTop = ratio * (mdContainerSecondary.scrollHeight - mdContainerSecondary.clientHeight);
}

function syncScrollSecondaryHandler() {
  if (!syncScrollActive || !mdContainer) return;
  const ratio = mdContainerSecondary.scrollTop / Math.max(1, mdContainerSecondary.scrollHeight - mdContainerSecondary.clientHeight);
  mdContainer.scrollTop = ratio * (mdContainer.scrollHeight - mdContainer.clientHeight);
}

function highlightSearchQuery(query) {
  ensureReaderContainers();
  clearSearchHighlights();
  searchState.query = query;
  if (!query) {
    searchState.hits = [];
    searchState.activeIndex = -1;
    updateSearchCounter();
    return;
  }
  const primaryHits = markMatches(mdContainer, query, 'search-hit');
  let hits = primaryHits.map(el => ({ el, container: mdContainer }));
  if (!secondaryPanel?.hidden && mdContainerSecondary) {
    const secondaryHits = markMatches(mdContainerSecondary, query, 'search-hit');
    hits = hits.concat(secondaryHits.map(el => ({ el, container: mdContainerSecondary }))); 
  }
  searchState.hits = hits;
  searchState.activeIndex = hits.length ? 0 : -1;
  updateSearchCounter();
  focusSearchHit(searchState.activeIndex);
}

function clearSearchHighlights() {
  ensureReaderContainers();
  const unwrap = (container) => {
    if (!container) return;
    container.querySelectorAll('.search-hit').forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });
  };
  unwrap(mdContainer);
  unwrap(mdContainerSecondary);
}

function markMatches(container, query, className) {
  if (!container || !query) return [];
  const hits = [];
  const needle = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest('.selection-popover, .chat-input')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || '';
    const lower = text.toLowerCase();
    let index = lower.indexOf(needle);
    if (index === -1) continue;
    const fragments = [];
    let lastIndex = 0;
    while (index !== -1) {
      if (index > lastIndex) {
        fragments.push(document.createTextNode(text.slice(lastIndex, index)));
      }
      const match = document.createElement('mark');
      match.className = className;
      match.textContent = text.slice(index, index + query.length);
      fragments.push(match);
      hits.push(match);
      lastIndex = index + query.length;
      index = lower.indexOf(needle, lastIndex);
    }
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.slice(lastIndex)));
    }
    const parent = node.parentNode;
    fragments.forEach(fragment => parent.insertBefore(fragment, node));
    parent.removeChild(node);
  }
  return hits;
}

function focusSearchHit(index) {
  if (index < 0 || index >= searchState.hits.length) {
    updateSearchCounter();
    return;
  }
  const hit = searchState.hits[index];
  if (!hit?.el) return;
  hit.el.classList.add('active-hit');
  searchState.hits.forEach((h, idx) => {
    if (idx !== index) h.el.classList.remove('active-hit');
  });
  const container = hit.container || mdContainer;
  const rect = hit.el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset = rect.top - containerRect.top + container.scrollTop - container.clientHeight / 2;
  container.scrollTo({ top: offset, behavior: 'smooth' });
  updateSearchCounter();
}

function updateSearchCounter() {
  if (!searchCounterEl) return;
  if (!searchState.hits.length) {
    searchCounterEl.textContent = '0 / 0';
    return;
  }
  searchCounterEl.textContent = `${searchState.activeIndex + 1} / ${searchState.hits.length}`;
}

function applyAnnotations() {
  ensureReaderContainers();
  if (!annotationState?.highlights?.length) return;
  annotationState.highlights.forEach(ann => {
    reapplyHighlight(mdContainer, ann);
    if (!secondaryPanel?.hidden && mdContainerSecondary) {
      reapplyHighlight(mdContainerSecondary, ann, true);
    }
  });
}

function reapplyHighlight(container, ann, isSecondary = false) {
  if (!container || !ann?.snippet) return;
  if (container.querySelector(`[data-annotation-id="${ann.id}"]`)) return;
  wrapSnippetInContainer(container, ann.snippet, ann.id, 'annotation-highlight', isSecondary);
}

function wrapSnippetInContainer(container, snippet, id, className, isSecondary) {
  const range = createRangeForSnippet(container, snippet, isSecondary);
  if (!range) return;
  const wrapper = document.createElement('mark');
  wrapper.className = className;
  wrapper.dataset.annotationId = id;
  range.surroundContents(wrapper);
}

function unwrapHighlightElement(mark) {
  if (!mark || !mark.parentNode) return;
  const parent = mark.parentNode;
  while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
  parent.removeChild(mark);
  parent.normalize();
}

function createRangeForSnippet(container, snippet, isSecondary) {
  if (!container || !snippet) return null;
  const textNodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const needle = snippet.trim();
  for (const node of textNodes) {
    const text = node.textContent || '';
    const idx = text.indexOf(needle);
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + needle.length);
      return range;
    }
  }
  return null;
}

function prepareReferenceTargets() {
  if (!mdContainer) return;
  mdContainer.querySelectorAll('a[href^="#"]').forEach(anchor => {
    if (anchor.dataset.refBound) return;
    anchor.dataset.refBound = '1';
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href')?.slice(1);
      if (!targetId) return;
      e.preventDefault();
      const target = mdContainer.querySelector(`#${escapeCssId(targetId)}`);
      if (target) {
        smoothScrollIntoView(mdContainer, target);
        setActiveHeading(target.dataset.headingId || target.id, { pushTrail: true });
      }
    }, { once: false });
  });
}

function smoothScrollIntoView(container, target) {
  ensureReaderContainers();
  if (!container || !target) return;
  const rect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset = rect.top - containerRect.top + container.scrollTop - 16;
  container.scrollTo({ top: offset, behavior: 'smooth' });
}

function updateSuggestedQuestions() {
  // Chat enhancement placeholder; actual rendering handled later
  refreshSuggestedQuestions();
}

function getCurrentHeading() {
  if (activeHeadingId) {
    const found = resultState.headings.find(h => h.id === activeHeadingId);
    if (found) return found;
  }
  return resultState.headings[0] || null;
}

function addBookmark() {
  const heading = getCurrentHeading();
  const snippet = selectionState.text || heading?.text || (currentMarkdown().slice(0, 64));
  const bookmark = {
    id: `bm-${Date.now()}`,
    headingId: heading?.id || '',
    headingText: heading?.text || '文件頂部',
    snippet: snippet || '',
    createdAt: Date.now(),
    scrollTop: mdContainer?.scrollTop || 0
  };
  bookmarkState.items.unshift(bookmark);
  persistToStorage(STORAGE_KEYS.bookmarks, bookmarkState.items);
  renderBookmarks();
  showToast('已加入書籤', 'success', 1400);
  refreshSuggestedQuestions();
}

function renderBookmarks() {
  if (!bookmarkListEl) return;
  if (!bookmarkState.items.length) {
    bookmarkListEl.innerHTML = '<li class="muted" style="list-style:none;">尚無書籤</li>';
    return;
  }
  const html = bookmarkState.items.map(item => {
    const date = new Date(item.createdAt);
    const time = date.toLocaleTimeString();
    return `
      <li class="bookmark-item" data-id="${escapeHtml(item.id)}">
        <div class="bookmark-meta">
          <span>${escapeHtml(item.headingText || '未知章節')}</span>
          <span>${escapeHtml(time)}</span>
        </div>
        <div class="bookmark-preview">${escapeHtml((item.snippet || '').slice(0, 80))}</div>
        <div class="bookmark-actions">
          <button class="btn-icon" type="button" data-action="jump">前往</button>
          <button class="btn-icon" type="button" data-action="delete">移除</button>
        </div>
      </li>`;
  }).join('');
  bookmarkListEl.innerHTML = html;
}

function scrollToBookmark(bookmark) {
  if (!bookmark) return;
  if (bookmark.headingId) {
    activateTocItem(bookmark.headingId);
  } else if (mdContainer) {
    mdContainer.scrollTo({ top: bookmark.scrollTop || 0, behavior: 'smooth' });
  }
}

function removeBookmark(id) {
  const idx = bookmarkState.items.findIndex(b => b.id === id);
  if (idx === -1) return;
  bookmarkState.items.splice(idx, 1);
  persistToStorage(STORAGE_KEYS.bookmarks, bookmarkState.items);
  renderBookmarks();
  showToast('書籤已移除', 'info', 1200);
  refreshSuggestedQuestions();
}

function exportBookmarks() {
  if (!bookmarkState.items.length) {
    showToast('沒有書籤可匯出', 'warning', 1500);
    return;
  }
  const blob = new Blob([JSON.stringify(bookmarkState.items, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bookmarks-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('書籤已匯出', 'success', 1400);
}

function openNoteComposer(options = {}) {
  if (!noteComposerEl || !noteComposerInput || !noteComposerContext) return;
  noteComposerState.editingId = options.id || null;
  noteComposerState.headingId = options.headingId || selectionState.headingId || (getCurrentHeading()?.id ?? null);
  noteComposerState.snippet = options.snippet || selectionState.text || '';
  noteComposerInput.value = options.text || '';
  noteComposerContext.textContent = noteComposerState.snippet ? `引用：${noteComposerState.snippet.slice(0, 80)}` : '一般筆記';
  noteComposerEl.hidden = false;
  noteComposerInput.focus();
}

function closeNoteComposer() {
  if (!noteComposerEl || !noteComposerInput || !noteComposerContext) return;
  noteComposerEl.hidden = true;
  noteComposerInput.value = '';
  noteComposerContext.textContent = '';
  noteComposerState.editingId = null;
  noteComposerState.headingId = null;
  noteComposerState.snippet = '';
}

function saveNoteFromComposer() {
  if (!noteComposerInput) return;
  const text = noteComposerInput.value.trim();
  if (!text) {
    showToast('筆記內容不可為空', 'error', 1600);
    return;
  }
  const heading = resultState.headings.find(h => h.id === noteComposerState.headingId) || getCurrentHeading();
  if (noteComposerState.editingId) {
    const target = noteState.items.find(n => n.id === noteComposerState.editingId);
    if (target) {
      target.text = text;
      target.updatedAt = Date.now();
      target.headingId = heading?.id || '';
      target.headingText = heading?.text || '';
      target.snippet = noteComposerState.snippet || '';
    }
  } else {
    noteState.items.unshift({
      id: `note-${Date.now()}`,
      text,
      headingId: heading?.id || '',
      headingText: heading?.text || '',
      snippet: noteComposerState.snippet || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  persistToStorage(STORAGE_KEYS.notes, noteState.items);
  renderNotes();
  closeNoteComposer();
  showToast('筆記已儲存', 'success', 1400);
  refreshSuggestedQuestions();
}

function renderNotes() {
  if (!noteListEl) return;
  if (!noteState.items.length) {
    noteListEl.innerHTML = '<div class="muted">尚無筆記</div>';
    return;
  }
  const html = noteState.items.map(item => {
    const date = new Date(item.updatedAt || item.createdAt);
    return `
      <div class="note-card" data-id="${escapeHtml(item.id)}">
        <div class="note-meta">
          <span>${escapeHtml(item.headingText || '一般筆記')}</span>
          <span>${escapeHtml(date.toLocaleTimeString())}</span>
        </div>
        ${item.snippet ? `<div class="note-snippet muted">${escapeHtml(item.snippet.slice(0, 80))}</div>` : ''}
        <div class="note-content">${escapeHtml(item.text)}</div>
        <div class="note-actions">
          <button class="btn-icon" type="button" data-action="jump">定位</button>
          <button class="btn-icon" type="button" data-action="edit">編輯</button>
          <button class="btn-icon" type="button" data-action="delete">刪除</button>
        </div>
      </div>`;
  }).join('');
  noteListEl.innerHTML = html;
}

function removeNote(id) {
  const idx = noteState.items.findIndex(n => n.id === id);
  if (idx === -1) return;
  noteState.items.splice(idx, 1);
  persistToStorage(STORAGE_KEYS.notes, noteState.items);
  renderNotes();
  showToast('筆記已刪除', 'info', 1400);
  refreshSuggestedQuestions();
}

function locateNote(id) {
  const note = noteState.items.find(n => n.id === id);
  if (!note) return;
  if (note.headingId) activateTocItem(note.headingId);
}

function editNote(id) {
  const note = noteState.items.find(n => n.id === id);
  if (!note) return;
  openNoteComposer({
    id: note.id,
    headingId: note.headingId,
    snippet: note.snippet,
    text: note.text
  });
}

function findHighlightWrapper(node) {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node.closest('mark.annotation-highlight');
  }
  return node.parentElement?.closest('mark.annotation-highlight') || null;
}

function updateSelectionPopoverActions(mode = 'selection') {
  const hasText = Boolean(selectionState.text);
  const inHighlightMode = mode === 'highlight';
  if (btnHighlightSelection) {
    btnHighlightSelection.hidden = inHighlightMode;
    btnHighlightSelection.disabled = !hasText;
  }
  if (btnRemoveHighlight) {
    btnRemoveHighlight.hidden = !inHighlightMode;
    btnRemoveHighlight.disabled = !selectionState.highlightId;
  }
  if (btnNoteSelection) btnNoteSelection.disabled = !hasText;
  if (btnAskSelection) btnAskSelection.disabled = !hasText;
}

function clearSelection() {
  selectionState.range = null;
  selectionState.text = '';
  selectionState.headingId = null;
  selectionState.fromSecondary = false;
  selectionState.highlightId = null;
  hideSelectionPopover();
  updateSelectionPopoverActions('selection');
  renderContextChips();
}

function handleSelectionCapture(fromSecondary = false, options = {}) {
  const { triggerPopover = false, anchorEvent = null } = options;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    clearSelection();
    return false;
  }
  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    clearSelection();
    return false;
  }
  const container = fromSecondary ? mdContainerSecondary : mdContainer;
  if (!container) {
    clearSelection();
    return false;
  }
  if (!container.contains(range.commonAncestorContainer)) {
    clearSelection();
    return false;
  }
  selectionState.range = range.cloneRange();
  selectionState.text = range.toString().trim();
  selectionState.headingId = findHeadingIdForNode(range.startContainer, fromSecondary) || activeHeadingId;
  selectionState.fromSecondary = fromSecondary;
  const highlightWrapper = findHighlightWrapper(range.commonAncestorContainer);
  selectionState.highlightId = highlightWrapper?.dataset?.annotationId || null;
  if (!selectionState.text && highlightWrapper) {
    selectionState.text = (highlightWrapper.textContent || '').trim();
  }
  updateSelectionPopoverActions(selectionState.highlightId ? 'highlight' : 'selection');
  if (triggerPopover && selectionState.text) {
    showSelectionPopover({ range, anchorEvent });
  } else {
    hideSelectionPopover();
  }
  renderContextChips();
  return Boolean(selectionState.text);
}

function handleReaderContextMenu(event, fromSecondary = false) {
  ensureReaderContainers();
  const highlightTarget = event.target.closest('mark.annotation-highlight');
  if (highlightTarget?.dataset?.annotationId) {
    event.preventDefault();
    selectionState.range = null;
    selectionState.text = (highlightTarget.textContent || '').trim();
    selectionState.headingId = findHeadingIdForNode(highlightTarget, fromSecondary) || activeHeadingId;
    selectionState.fromSecondary = fromSecondary;
    selectionState.highlightId = highlightTarget.dataset.annotationId;
    updateSelectionPopoverActions('highlight');
    renderContextChips();
    showSelectionPopover({ anchorEvent: event });
    return;
  }
  const valid = handleSelectionCapture(fromSecondary, { triggerPopover: false });
  if (valid && selectionState.text) {
    event.preventDefault();
    showSelectionPopover({ range: selectionState.range, anchorEvent: event });
  } else {
    hideSelectionPopover();
  }
}

function findHeadingIdForNode(node, fromSecondary = false) {
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (el) {
    if (el.dataset?.headingId) return el.dataset.headingId;
    if (fromSecondary && el.dataset?.anchor) return el.dataset.anchor;
    if (el.id) {
      const trimmed = el.id.replace(/__secondary$/, '');
      if (resultState.headings.some(h => h.id === trimmed)) return trimmed;
    }
    el = el.parentElement;
  }
  return null;
}

function showSelectionPopover({ range, anchorEvent } = {}) {
  if (!selectionPopover) return;
  updateSelectionPopoverActions(selectionState.highlightId ? 'highlight' : 'selection');
  let rect = null;
  if (anchorEvent) {
    rect = {
      top: anchorEvent.clientY,
      left: anchorEvent.clientX,
      width: 0,
      height: 0
    };
  } else if (range) {
    rect = range.getBoundingClientRect();
  }
  if (!rect || (rect.width === 0 && rect.height === 0 && !anchorEvent)) {
    hideSelectionPopover();
    return;
  }
  selectionPopover.hidden = false;
  const popRect = selectionPopover.getBoundingClientRect();
  const baseTop = rect.top + window.scrollY;
  const baseLeft = rect.left + window.scrollX;
  const top = anchorEvent
    ? Math.max(40, baseTop - popRect.height - 8)
    : Math.max(40, baseTop - popRect.height - 8);
  const left = Math.max(16, baseLeft);
  selectionPopover.style.top = `${top}px`;
  selectionPopover.style.left = `${left}px`;
}

function hideSelectionPopover() {
  if (!selectionPopover) return;
  selectionPopover.hidden = true;
}

function createHighlightFromSelection() {
  if (!selectionState.range || !selectionState.text) {
    showToast('請先選取文字', 'warning', 1400);
    return;
  }
  const snippet = selectionState.text.slice(0, 200);
  const id = `ann-${Date.now()}`;
  const highlight = {
    id,
    snippet,
    headingId: selectionState.headingId || '',
    createdAt: Date.now()
  };
  annotationState.highlights.push(highlight);
  persistToStorage(STORAGE_KEYS.annotations, annotationState);
  reapplyHighlight(selectionState.fromSecondary ? mdContainerSecondary : mdContainer, highlight, selectionState.fromSecondary);
  if (!selectionState.fromSecondary) {
    reapplyHighlight(mdContainerSecondary, highlight, true);
  } else {
    reapplyHighlight(mdContainer, highlight, false);
  }
  renderContextChips();
  showToast('標註完成', 'success', 1400);
  window.getSelection()?.removeAllRanges();
  clearSelection();
}

function removeHighlightById(id) {
  if (!id) return false;
  const idx = annotationState.highlights.findIndex(ann => ann.id === id);
  if (idx === -1) return false;
  annotationState.highlights.splice(idx, 1);
  persistToStorage(STORAGE_KEYS.annotations, annotationState);
  [mdContainer, mdContainerSecondary].forEach(container => {
    if (!container) return;
    const selector = `mark.annotation-highlight[data-annotation-id="${escapeCssId(id)}"]`;
    container.querySelectorAll(selector).forEach(unwrapHighlightElement);
  });
  return true;
}

function removeHighlightFromSelection() {
  if (!selectionState.highlightId) {
    showToast('找不到對應的標註', 'warning', 1400);
    return;
  }
  const removed = removeHighlightById(selectionState.highlightId);
  if (!removed) {
    showToast('標註不存在或已移除', 'warning', 1400);
    clearSelection();
    return;
  }
  showToast('標註已移除', 'info', 1400);
  window.getSelection()?.removeAllRanges();
  clearSelection();
}

function composeNoteFromSelection() {
  if (!selectionState.text) {
    showToast('請先選取文字', 'warning', 1400);
    return;
  }
  openNoteComposer({
    snippet: selectionState.text,
    headingId: selectionState.headingId || getCurrentHeading()?.id
  });
}

function queueQuestionFromSelection() {
  if (!selectionState.text) {
    showToast('請先選取文字', 'warning', 1400);
    return;
  }
  enqueueChatQuestion(selectionState.text);
  clearSelection();
}

function openReaderInNewWindow() {
  const api = window.electronAPI?.openReaderWindow;
  if (!api) {
    showToast('目前環境不支援新視窗', 'warning', 1600);
    return;
  }
  const payload = {
    markdown: currentMarkdown(),
    lang: resultState.lang,
    meta: resultState.meta,
    headings: resultState.headings,
    bookmarks: bookmarkState.items,
    notes: noteState.items,
    annotations: annotationState.highlights
  };
  api(payload).catch?.((err) => console.error('開啟新視窗失敗', err));
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
  clearSelection();
  if (!pendingPdfPaths.length) {
    showToast('請先選擇 PDF 檔案', 'error', 1600);
    return;
  }

  btnStart.disabled = true;
  btnStart.textContent = '處理中…';

  // 切換到全畫面處理視圖
  if (wrapUpload) wrapUpload.style.display = 'none';
  if (processingView) processingView.style.display = 'block';
  if (procStatus) procStatus.textContent = '準備開始…';

  let startedSuccessfully = false;
  try {
    // 讀取設定（新版巢狀結構，不再傳遞給後端）
    const s = await window.electronAPI?.loadSettings?.();
    
    // 驗證配置（後端會從 settings.json 讀取，這裡只做前端驗證）
    const translatorConfig = s?.translator || {};
    const embeddingConfig = s?.embedding || {};
    
    if (!translatorConfig.company || !translatorConfig.model) {
      showToast('請先在「設定」配置翻譯器（公司與模型）', 'error', 2500);
      if (processingView) processingView.style.display = 'none';
      if (wrapUpload) wrapUpload.style.display = '';
      resetProcessingLogsUI();
      return;
    }
    
    if (!embeddingConfig.company || !embeddingConfig.model) {
      showToast('請先在「設定」配置 Embedding 服務（公司與模型）', 'error', 2500);
      if (processingView) processingView.style.display = 'none';
      if (wrapUpload) wrapUpload.style.display = '';
      resetProcessingLogsUI();
      return;
    }

    const filePath = pendingPdfPaths[0];
    currentFileDir = pathDirname(filePath);
    // 產生本次處理的 sessionId，讓事件可以對應
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    
    // 只傳遞 filePath 和 sessionId，後端會從 settings.json 讀取配置
    const result = await window.electronAPI?.startProcessing?.({ filePath, sessionId });
    
    if (result?.ok) {
      startedSuccessfully = true;
      showToast('已開始處理', 'info', 1500);
    } else {
      const msg = result?.error || '處理失敗';
      showToast(msg, 'error', 2200);
    }
    // 視圖保留在處理畫面直到主程序事件宣告完成或失敗
  } catch (err) {
    console.error('啟動處理流程失敗:', err);
    showToast('無法啟動處理流程', 'error', 2200);
  } finally {
    if (!startedSuccessfully) {
      btnStart.disabled = false;
      btnStart.textContent = '開始';
    }
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

    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = '開始';
    }
    
    // 切到結果畫面並渲染 markdown
  const mdPrimary = typeof evt.content === 'string' ? evt.content : '';
  const mdZh = typeof evt.contentZh === 'string' ? evt.contentZh : '';
  const mdEn = typeof evt.contentEn === 'string' ? evt.contentEn : '';
  if (mdZh) resultState.zh = mdZh;
  if (mdEn) resultState.en = mdEn;
  resultState.markdown = mdPrimary || mdEn || mdZh || resultState.markdown;
    resultState.meta = evt.metadata || null;
    clearSelection();
    renderMarkdown();
    if (processingView) processingView.style.display = 'none';
  resetProcessingLogsUI();
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

    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = '開始';
    }
    
    // 回到上傳畫面，避免卡在處理畫面
    if (processingView) processingView.style.display = 'none';
    if (wrapUpload) wrapUpload.style.display = '';
    resetProcessingLogsUI();
    activeSessionId = null;
    processingStartTime = null;
  }
});

// --- Chat 邏輯 ---
const chatState = {
  messages: [], // {role, content, references?, followups?, context?}
  conversations: loadFromStorage(STORAGE_KEYS.chatHistory, []),
  activeId: null,
  suggestions: [],
  historySelectionId: null
};
const voiceState = {
  recognition: null,
  listening: false,
  utterance: null
};

function renderChat() {
  if (!chatListEl) return;
  const html = chatState.messages.map(msg => {
    const roleClass = msg.role === 'assistant' ? 'assistant' : (msg.role === 'user' ? 'user' : 'system');
    const body = `<div class="msg-content">${formatChatHtml(msg.content || '')}</div>`;
    const references = (msg.references && msg.references.length)
      ? `<div class="msg-references">${msg.references.map(ref => `<button class="reference-chip" type="button" data-heading="${escapeHtml(ref.headingId || '')}">${escapeHtml(ref.label || ref.headingText || '引用')}</button>`).join('')}</div>`
      : '';
    const followups = (msg.followups && msg.followups.length)
      ? `<div class="followup-list">${msg.followups.map(text => `<button class="followup-btn" type="button" data-followup="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}</div>`
      : '';
    return `<div class="msg ${roleClass}">${body}${references}${followups}</div>`;
  }).join('');
  chatListEl.innerHTML = html;
  chatListEl.scrollTop = chatListEl.scrollHeight;
}

function formatChatHtml(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre><code>${code}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function getActiveConversation() {
  return chatState.conversations.find(c => c.id === chatState.activeId) || null;
}

function ensureActiveConversation() {
  if (chatState.activeId) {
    const existing = getActiveConversation();
    if (existing) {
      chatState.messages = existing.messages;
      return existing;
    }
  }
  if (chatState.conversations.length) {
    const conv = chatState.conversations[0];
    chatState.activeId = conv.id;
    chatState.messages = conv.messages;
    return conv;
  }
  return startNewConversation();
}

function startNewConversation(initialTitle) {
  const conv = {
    id: `conv-${Date.now()}`,
    title: initialTitle || '新的對話',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
  chatState.conversations.unshift(conv);
  if (chatState.conversations.length > 40) chatState.conversations.length = 40;
  chatState.activeId = conv.id;
  chatState.messages = conv.messages;
  chatState.historySelectionId = conv.id;
  if (chatInputEl) chatInputEl.value = '';
  renderChat();
  saveConversations();
  renderChatHistoryList(conv.id);
  return conv;
}

function saveConversations() {
  persistToStorage(STORAGE_KEYS.chatHistory, chatState.conversations);
}

function updateConversationMetadata() {
  const conv = getActiveConversation();
  if (!conv) return;
  conv.updatedAt = Date.now();
  if (!conv.title) {
    const firstUser = conv.messages.find(m => m.role === 'user');
    if (firstUser?.content) conv.title = firstUser.content.slice(0, 32);
  }
  saveConversations();
}

function loadConversation(id) {
  const conv = chatState.conversations.find(c => c.id === id);
  if (!conv) return;
  chatState.activeId = id;
  chatState.messages = conv.messages;
  renderChat();
}

function deleteConversation(id) {
  const idx = chatState.conversations.findIndex(c => c.id === id);
  if (idx === -1) return;
  chatState.conversations.splice(idx, 1);
  if (chatState.activeId === id) {
    chatState.activeId = null;
    ensureActiveConversation();
  }
  chatState.historySelectionId = chatState.activeId;
  saveConversations();
  renderChatHistoryList(chatState.activeId);
}

function renderChatHistoryList(selectedId = chatState.historySelectionId || chatState.activeId) {
  if (!chatHistoryListEl) return;
  if (!chatState.conversations.length) {
    chatHistoryListEl.innerHTML = '<div class="muted">尚無對話</div>';
    btnChatHistoryLoad?.setAttribute('disabled', 'true');
    btnChatHistoryDelete?.setAttribute('disabled', 'true');
    return;
  }
  let effectiveId = selectedId;
  const hasSelection = Boolean(effectiveId && chatState.conversations.some(c => c.id === effectiveId));
  if (!hasSelection) {
    effectiveId = chatState.activeId || chatState.conversations[0]?.id || null;
  }
  chatState.historySelectionId = effectiveId;
  const hasEffectiveSelection = Boolean(effectiveId);
  if (hasEffectiveSelection) {
    btnChatHistoryLoad?.removeAttribute('disabled');
    btnChatHistoryDelete?.removeAttribute('disabled');
  } else {
    btnChatHistoryLoad?.setAttribute('disabled', 'true');
    btnChatHistoryDelete?.setAttribute('disabled', 'true');
  }
  const html = chatState.conversations.map(conv => {
    const active = conv.id === chatState.historySelectionId ? 'active' : '';
    const preview = conv.messages?.[conv.messages.length - 1]?.content || '';
    const updated = new Date(conv.updatedAt || conv.createdAt).toLocaleString();
    return `<div class="history-item ${active}" data-id="${escapeHtml(conv.id)}">
      <div style="font-weight:600;">${escapeHtml(conv.title || '未命名對話')}</div>
      <div class="muted" style="font-size:12px; margin:4px 0;">${escapeHtml(updated)}</div>
      <div class="muted" style="font-size:12px;">${escapeHtml(preview.slice(0, 80))}</div>
    </div>`;
  }).join('');
  chatHistoryListEl.innerHTML = html;
}

function openChatHistoryModal() {
  if (!chatHistoryBackdrop) return;
  chatState.historySelectionId = chatState.activeId;
  renderChatHistoryList();
  chatHistoryBackdrop.style.display = 'flex';
  requestAnimationFrame(() => {
    chatHistoryBackdrop.classList.add('show');
    chatHistoryBackdrop.querySelector('.modal')?.classList.add('open');
  });
}

function closeChatHistoryModal() {
  if (!chatHistoryBackdrop) return;
  chatHistoryBackdrop.classList.remove('show');
  chatHistoryBackdrop.querySelector('.modal')?.classList.remove('open');
  setTimeout(() => { chatHistoryBackdrop.style.display = 'none'; }, 200);
}

function extractHeadingContent(headingId, limit = 800) {
  if (!headingId || !mdContainer) return '';
  const headingEl = mdContainer.querySelector(`#${escapeCssId(headingId)}`);
  if (!headingEl) return '';
  let content = '';
  let node = headingEl.nextElementSibling;
  while (node && !/^H[1-6]$/.test(node.tagName)) {
    content += ` ${node.textContent || ''}`;
    if (content.length >= limit) break;
    node = node.nextElementSibling;
  }
  return content.trim().slice(0, limit);
}

function collectContextSnippets() {
  const segments = [];
  if (selectionState.text) segments.push(`選取段落:\n${selectionState.text}`);
  const heading = getCurrentHeading();
  if (heading) {
    segments.push(`目前章節: ${heading.text}\n${extractHeadingContent(heading.id)}`);
  }
  if (bookmarkState.items.length) {
    const recent = bookmarkState.items.slice(0, 2).map(b => `• ${b.headingText || '無標題'}: ${b.snippet || ''}`);
    segments.push(`書籤摘要:\n${recent.join('\n')}`);
  }
  if (noteState.items.length) {
    const recentNotes = noteState.items.slice(0, 2).map(n => `• ${n.headingText || '筆記'}: ${n.text}`);
    segments.push(`筆記摘要:\n${recentNotes.join('\n')}`);
  }
  if (annotationState.highlights?.length) {
    const latestHighlight = annotationState.highlights[annotationState.highlights.length - 1];
    segments.push(`標註摘錄:\n${latestHighlight.snippet}`);
  }
  return segments;
}

function composeQuestionContext() {
  const segments = collectContextSnippets();
  return segments.filter(Boolean).join('\n\n').slice(0, 6000);
}

function deriveReferencesFromAnswer(answer) {
  if (!answer) return [];
  const refs = [];
  const lowerAnswer = answer.toLowerCase();
  for (const heading of resultState.headings) {
    if (!heading.text) continue;
    const textLower = heading.text.toLowerCase();
    if (lowerAnswer.includes(textLower)) {
      refs.push({ headingId: heading.id, label: heading.text, headingText: heading.text });
    }
    if (refs.length >= 5) break;
  }
  if (!refs.length && activeHeadingId) {
    const current = resultState.headings.find(h => h.id === activeHeadingId);
    if (current) refs.push({ headingId: current.id, label: current.text, headingText: current.text });
  }
  const unique = [];
  const seen = new Set();
  for (const ref of refs) {
    if (!ref.headingId || seen.has(ref.headingId)) continue;
    seen.add(ref.headingId);
    unique.push(ref);
  }
  return unique;
}

function normalizeReferences(list) {
  if (!Array.isArray(list)) return [];
  const unique = [];
  const seen = new Set();
  for (const item of list) {
    if (!item) continue;
    const headingId = item.headingId || item.id || item.anchor || '';
    const label = item.label || item.headingText || item.title || item.text || headingId;
    if (headingId && seen.has(headingId)) continue;
    if (headingId) seen.add(headingId);
    unique.push({ headingId, label, headingText: item.headingText || label });
  }
  return unique;
}

function generateFollowUpSuggestions(answer) {
  const suggestions = [];
  const heading = getCurrentHeading();
  if (heading) {
    suggestions.push(`請進一步說明 ${heading.text}`);
    suggestions.push(`這段的重點是什麼？`);
  }
  if (selectionState.text) {
    suggestions.push('請針對上述選取部分提供例子');
  }
  if (answer?.includes('例如')) {
    suggestions.push('再提供更多範例');
  }
  const unique = [];
  const seen = new Set();
  for (const text of suggestions) {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
    if (unique.length >= 3) break;
  }
  return unique;
}

function refreshSuggestedQuestions() {
  const suggestions = [];
  for (const heading of resultState.headings.slice(0, 6)) {
    if (heading?.text) suggestions.push(`請總結 ${heading.text}`);
  }
  if (bookmarkState.items.length) suggestions.push('整理我的書籤摘要');
  if (noteState.items.length) suggestions.push('根據筆記提供學習建議');
  chatState.suggestions = [...new Set(suggestions)].slice(0, 6);
  renderSuggestedQuestions();
}

function renderSuggestedQuestions() {
  if (!suggestedQuestionsEl) return;
  if (!chatState.suggestions.length) {
    suggestedQuestionsEl.innerHTML = '<div class="muted" style="font-size:12px;">尚無建議問題</div>';
    return;
  }
  suggestedQuestionsEl.innerHTML = chatState.suggestions.map(text => `<button class="suggestion-item" type="button" data-suggestion="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('');
}

function enqueueChatQuestion(text, autoSend = false) {
  if (!chatInputEl) return;
  const value = String(text || '').trim();
  if (!value) return;
  chatInputEl.value = value;
  chatInputEl.focus();
  if (autoSend) sendChat();
}

function speakLastAssistantMessage() {
  const assistantMsg = [...chatState.messages].reverse().find(m => m.role === 'assistant');
  if (!assistantMsg || !assistantMsg.content) {
    showToast('尚無可朗讀的回覆', 'warning', 1400);
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) {
    showToast('裝置不支援語音播放', 'warning', 1600);
    return;
  }
  if (voiceState.utterance) {
    synth.cancel();
  }
  const utter = new SpeechSynthesisUtterance(assistantMsg.content);
  voiceState.utterance = utter;
  synth.speak(utter);
}

function initVoiceRecognition() {
  if (voiceState.recognition) return voiceState.recognition;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0]?.transcript || '')
      .join('')
      .trim();
    if (chatInputEl) chatInputEl.value = transcript;
  };
  recognition.onerror = () => {
    voiceState.listening = false;
    btnVoiceInput?.classList.remove('active');
  };
  recognition.onend = () => {
    voiceState.listening = false;
    btnVoiceInput?.classList.remove('active');
  };
  voiceState.recognition = recognition;
  return recognition;
}

function startVoiceInput() {
  const recognition = initVoiceRecognition();
  if (!recognition) {
    showToast('此平台不支援語音輸入', 'warning', 1600);
    return;
  }
  if (voiceState.listening) {
    recognition.stop();
    return;
  }
  voiceState.listening = true;
  btnVoiceInput?.classList.add('active');
  try {
    recognition.start();
  } catch (err) {
    voiceState.listening = false;
    btnVoiceInput?.classList.remove('active');
    showToast('語音輸入啟動失敗', 'error', 1600);
    console.error('Speech recognition start failed', err);
  }
}

function stopVoiceInput() {
  const recognition = voiceState.recognition;
  if (!recognition) return;
  recognition.stop();
}

async function sendChat() {
  if (!chatInputEl || !btnChatSend) return;
  const text = chatInputEl.value.trim();
  if (!text) return;
  const conv = ensureActiveConversation();
  const userMessage = { role: 'user', content: text };
  conv.messages.push(userMessage);
  updateConversationMetadata();
  renderChat();
  chatInputEl.value = '';
  btnChatSend.disabled = true;
  btnChatSend.textContent = '送出中…';
  try {
    const context = composeQuestionContext();
    const history = conv.messages.slice(0, -1).slice(-6).map(m => ({ role: m.role, content: m.content }));
    const payload = { question: text, context, lang: resultState.lang, history };
    try {
      const settings = await window.electronAPI?.loadSettings?.();
      if (settings?.company) payload.company = settings.company;
      if (settings?.model) payload.model = settings.model;
      if (settings?.apiKey) payload.apiKey = settings.apiKey;
    } catch (settingsError) {
      console.warn('無法載入聊天設定，將使用預設參數', settingsError);
    }
    if (resultState.meta?.markdownPath) payload.source = resultState.meta.markdownPath;
    const ragCollection = resultState.meta?.ragCollection || resultState.meta?.rag?.collection;
    if (ragCollection) payload.collection = ragCollection;
    if (resultState.meta?.translatedJsonPath) payload.translatedJsonPath = resultState.meta.translatedJsonPath;
    if (!payload.collection && resultState.meta?.translation?.json_path) {
      const parts = String(resultState.meta.translation.json_path).split(/[\\/]/);
      payload.collection = parts.length ? parts[parts.length - 1] : '';
    }
    if (!payload.collection) delete payload.collection;
    const res = await window.electronAPI?.chatAsk?.(payload);
    if (res?.ok !== false) {
      const answer = String(res?.text || res?.answer || '');
      const finalAnswer = answer || '（未收到回覆）';
      let references = normalizeReferences(res?.references || res?.sources);
      if (!references.length) references = deriveReferencesFromAnswer(finalAnswer);
      const followupsSource = res?.followups || res?.suggestedQuestions;
      const followups = Array.isArray(followupsSource) && followupsSource.length ? followupsSource : generateFollowUpSuggestions(finalAnswer);
      conv.messages.push({ role: 'assistant', content: finalAnswer, references, followups });
    } else {
      conv.messages.push({ role: 'assistant', content: `發生錯誤：${res?.error || '未知錯誤'}` });
    }
  } catch (e) {
    conv.messages.push({ role: 'assistant', content: '發送失敗，請稍後再試' });
  } finally {
    btnChatSend.disabled = false;
    btnChatSend.textContent = '送出';
    renderChat();
    chatInputEl.focus();
    updateConversationMetadata();
    refreshSuggestedQuestions();
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

tocListEl?.addEventListener('click', (event) => {
  const item = event.target.closest('.toc-item');
  if (!item) return;
  const id = item.getAttribute('data-id');
  activateTocItem(id);
});

tocListEl?.addEventListener('keydown', (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  const id = event.target.getAttribute('data-id');
  activateTocItem(id);
});

btnToggleToc?.addEventListener('click', () => {
  ensureReaderContainers();
  if (!readerContentEl || !tocSidebar) return;
  const hidden = tocSidebar.classList.toggle('hidden');
  readerContentEl.classList.toggle('toc-hidden', hidden);
  const visible = !hidden;
  btnToggleToc.textContent = visible ? '隱藏目錄' : '顯示目錄';
  btnToggleToc.classList.toggle('active', visible);
  readerPrefs.tocVisible = visible;
  persistToStorage(STORAGE_KEYS.readerPrefs, readerPrefs);
});

function toggleTocLevels(hideSubLevels) {
  if (!tocListEl) return;
  tocListEl.querySelectorAll('.toc-item').forEach(item => {
    const match = item.className.match(/toc-level-(\d)/);
    const level = match ? Number(match[1]) : 1;
    if (hideSubLevels && level > 2) {
      item.style.display = 'none';
    } else {
      item.style.display = '';
    }
  });
}

btnTocCollapse?.addEventListener('click', () => toggleTocLevels(true));
btnTocExpand?.addEventListener('click', () => toggleTocLevels(false));

btnToggleSplit?.addEventListener('click', () => {
  enableSplitView(!readerPrefs.split);
});

btnPrevSection?.addEventListener('click', () => jumpToAdjacentHeading(-1));
btnNextSection?.addEventListener('click', () => jumpToAdjacentHeading(1));

btnSyncScroll?.addEventListener('click', () => {
  toggleSyncScroll(!syncScrollActive);
});

secondarySourceSelect?.addEventListener('change', (event) => {
  const value = event.target.value;
  if (!value || !mdContainerSecondary) return;
  const target = mdContainerSecondary.querySelector(`[data-anchor="${escapeCssId(value)}"]`);
  if (target) smoothScrollIntoView(mdContainerSecondary, target);
});

btnOpenNewWindow?.addEventListener('click', () => openReaderInNewWindow());

let searchDebounce = null;
searchInputEl?.addEventListener('input', (event) => {
  const value = event.target.value.trim();
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => highlightSearchQuery(value), 160);
});

btnSearchClear?.addEventListener('click', () => {
  if (!searchInputEl) return;
  searchInputEl.value = '';
  highlightSearchQuery('');
});

btnSearchPrev?.addEventListener('click', () => {
  if (!searchState.hits.length) return;
  searchState.activeIndex = (searchState.activeIndex - 1 + searchState.hits.length) % searchState.hits.length;
  focusSearchHit(searchState.activeIndex);
});

btnSearchNext?.addEventListener('click', () => {
  if (!searchState.hits.length) return;
  searchState.activeIndex = (searchState.activeIndex + 1) % searchState.hits.length;
  focusSearchHit(searchState.activeIndex);
});

contextChipsEl?.addEventListener('click', (event) => {
  const chip = event.target.closest('.context-chip');
  if (!chip) return;
  const id = chip.getAttribute('data-chip-id');
  if (!id) return;
  if (id === 'selection') {
    if (selectionState.headingId) activateTocItem(selectionState.headingId);
    return;
  }
  if (id.startsWith('ann-')) {
    const highlight = annotationState.highlights.find(a => a.id === id);
    if (highlight?.headingId) activateTocItem(highlight.headingId);
    return;
  }
  activateTocItem(id);
});

referenceTrailEl?.addEventListener('click', (event) => {
  const target = event.target.closest('.trail-item');
  if (!target) return;
  const id = target.getAttribute('data-id');
  activateTocItem(id);
});

btnAddBookmark?.addEventListener('click', addBookmark);
btnExportBookmarks?.addEventListener('click', exportBookmarks);

bookmarkListEl?.addEventListener('click', (event) => {
  const item = event.target.closest('.bookmark-item');
  if (!item) return;
  const id = item.getAttribute('data-id');
  const button = event.target.closest('button[data-action]');
  const action = button?.getAttribute('data-action');
  if (!id) return;
  if (action === 'delete') {
    removeBookmark(id);
  } else if (action === 'jump') {
    const bookmark = bookmarkState.items.find(b => b.id === id);
    scrollToBookmark(bookmark);
  }
});

btnCreateNote?.addEventListener('click', () => openNoteComposer());
btnNoteCancel?.addEventListener('click', () => closeNoteComposer());
btnNoteSave?.addEventListener('click', saveNoteFromComposer);

noteListEl?.addEventListener('click', (event) => {
  const card = event.target.closest('.note-card');
  if (!card) return;
  const id = card.getAttribute('data-id');
  const button = event.target.closest('button[data-action]');
  const action = button?.getAttribute('data-action');
  if (action === 'delete') {
    removeNote(id);
  } else if (action === 'jump') {
    locateNote(id);
  } else if (action === 'edit') {
    editNote(id);
  }
});

btnChatNew?.addEventListener('click', () => startNewConversation());

suggestedQuestionsEl?.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-suggestion]');
  if (!btn) return;
  const text = btn.getAttribute('data-suggestion');
  enqueueChatQuestion(text, true);
});

chatListEl?.addEventListener('click', (event) => {
  const refBtn = event.target.closest('button.reference-chip');
  if (refBtn) {
    const headingId = refBtn.getAttribute('data-heading');
    if (headingId) activateTocItem(headingId);
    return;
  }
  const followBtn = event.target.closest('button.followup-btn');
  if (followBtn) {
    const question = followBtn.getAttribute('data-followup');
    enqueueChatQuestion(question, true);
  }
});

btnChatHistory?.addEventListener('click', openChatHistoryModal);
btnChatHistoryClose?.addEventListener('click', closeChatHistoryModal);
btnChatHistoryClose2?.addEventListener('click', closeChatHistoryModal);
btnChatHistoryDelete?.addEventListener('click', () => {
  if (!chatState.historySelectionId) return;
  deleteConversation(chatState.historySelectionId);
  renderChatHistoryList();
});
btnChatHistoryLoad?.addEventListener('click', () => {
  if (!chatState.historySelectionId) return;
  loadConversation(chatState.historySelectionId);
  closeChatHistoryModal();
});

chatHistoryListEl?.addEventListener('click', (event) => {
  const item = event.target.closest('.history-item');
  if (!item) return;
  const id = item.getAttribute('data-id');
  chatState.historySelectionId = id;
  renderChatHistoryList(id);
});

btnVoiceInput?.addEventListener('click', startVoiceInput);
btnVoiceOutput?.addEventListener('click', speakLastAssistantMessage);

ensureActiveConversation();
renderChat();
refreshSuggestedQuestions();
renderChatHistoryList();
ensureReaderContainers();
hideSelectionPopover();
updateSelectionPopoverActions('selection');
const tocInitiallyVisible = Boolean(readerPrefs.tocVisible);
if (tocSidebar) tocSidebar.classList.toggle('hidden', !tocInitiallyVisible);
if (readerContentEl) readerContentEl.classList.toggle('toc-hidden', !tocInitiallyVisible);
if (btnToggleToc) {
  btnToggleToc.textContent = tocInitiallyVisible ? '隱藏目錄' : '顯示目錄';
  btnToggleToc.classList.toggle('active', tocInitiallyVisible);
}
btnToggleSplit?.classList.toggle('active', Boolean(readerPrefs.split));
btnSyncScroll?.classList.toggle('active', Boolean(readerPrefs.syncScroll));

mdContainer?.addEventListener('mouseup', () => handleSelectionCapture(false));
mdContainer?.addEventListener('keyup', () => handleSelectionCapture(false));
mdContainer?.addEventListener('contextmenu', (event) => handleReaderContextMenu(event, false));
mdContainerSecondary?.addEventListener('mouseup', () => handleSelectionCapture(true));
mdContainerSecondary?.addEventListener('keyup', () => handleSelectionCapture(true));
mdContainerSecondary?.addEventListener('contextmenu', (event) => handleReaderContextMenu(event, true));

mdContainer?.addEventListener('scroll', () => {
  hideSelectionPopover();
  updateScrollProgressIndicator();
});
mdContainerSecondary?.addEventListener('scroll', hideSelectionPopover);

document.addEventListener('mousedown', (event) => {
  if (selectionPopover?.hidden) return;
  if (selectionPopover.contains(event.target)) return;
  hideSelectionPopover();
});

btnHighlightSelection?.addEventListener('click', createHighlightFromSelection);
btnRemoveHighlight?.addEventListener('click', removeHighlightFromSelection);
btnNoteSelection?.addEventListener('click', composeNoteFromSelection);
btnAskSelection?.addEventListener('click', queueQuestionFromSelection);

renderBookmarks();
renderNotes();

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


// 刪除檔案按鈕：清空選取並刪除後端檔案
btnDeleteFile?.addEventListener('click', async () => {
  // 如果有檔案，先刪除後端的檔案
  if (pendingPdfPaths.length > 0) {
    try {
      const filePath = pendingPdfPaths[0];
      const fileName = pathBasename(filePath);
      const result = await window.electronAPI?.deleteFile?.(fileName);
      
      if (result && !result.ok) {
        console.warn('刪除後端檔案失敗:', result.error);
        showToast('清除檔案時發生警告，但已清除介面', 'warning', 2000);
      } else {
        console.log('已刪除後端檔案:', fileName);
      }
    } catch (err) {
      console.error('刪除後端檔案時發生錯誤:', err);
      showToast('清除檔案時發生錯誤，但已清除介面', 'error', 2000);
    }
  }
  
  // 清空前端狀態
  clearSelection();
  pendingPdfPaths = [];
  showFiles([]);
  updateActionButtons();
  setUploadControlsVisible(true);
  showToast('已清除檔案', 'success', 1200);
});

// 新檔案：回到上傳畫面，清空結果與聊天
btnNewFile?.addEventListener('click', () => {
  clearSelection();
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
  resetProcessingLogsUI();
});

// 設定 Modal
const modalBackdrop = document.getElementById('modalBackdrop');
const btnSettings = document.getElementById('btnSettings');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const btnCancelSettings = document.getElementById('btnCancelSettings');
const btnModalClose = document.getElementById('btnModalClose');
const lblVersion = document.getElementById('lblVersion');
const btnUpdateInModal = document.getElementById('btnUpdateInModal');
const updateStatus = document.getElementById('updateStatus');

// 三組服務的 DOM 元素
const translatorElements = {
  company: document.getElementById('selTranslatorCompany'),
  model: document.getElementById('selTranslatorModel'),
  apiKey: document.getElementById('txtTranslatorApiKey'),
  toggleBtn: document.getElementById('btnToggleTranslatorKey'),
  badge: document.getElementById('translatorProviderBadge'),
  modelType: 'language' // 翻譯器使用語言模型
};

const embeddingElements = {
  company: document.getElementById('selEmbeddingCompany'),
  model: document.getElementById('selEmbeddingModel'),
  apiKey: document.getElementById('txtEmbeddingApiKey'),
  toggleBtn: document.getElementById('btnToggleEmbeddingKey'),
  badge: document.getElementById('embeddingProviderBadge'),
  modelType: 'embedding' // Embedding 服務使用 embedding 模型
};

const ragElements = {
  company: document.getElementById('selRagCompany'),
  model: document.getElementById('selRagModel'),
  apiKey: document.getElementById('txtRagApiKey'),
  toggleBtn: document.getElementById('btnToggleRagKey'),
  badge: document.getElementById('ragProviderBadge'),
  modelType: 'language' // RAG 使用語言模型
};

function updateApiKeyFieldVisibility(elements, company) {
  // Ollama 不需要 API Key，隱藏並停用欄位
  const isOllama = company === 'ollama';
  const fieldEl = elements.apiKey ? elements.apiKey.closest('.field') : null;
  if (fieldEl) fieldEl.style.display = isOllama ? 'none' : '';
  if (elements.apiKey) elements.apiKey.disabled = isOllama;
  if (elements.toggleBtn) elements.toggleBtn.style.display = isOllama ? 'none' : '';
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

function setProviderBadge(badgeEl, company) {
  if (!badgeEl) return;
  badgeEl.className = 'provider-badge';
  const map = { openai: 'OpenAI', google: 'Google', xai: 'xAI', anthropic: 'Anthropic', ollama: 'Ollama' };
  if (!company) { badgeEl.textContent = ''; return; }
  badgeEl.textContent = map[company] || '';
  badgeEl.classList.add(company);
}

async function loadModels(elements, company) {
  if (!elements.model) return;
  setProviderBadge(elements.badge, company);
  if (!company) {
    elements.model.innerHTML = '<option value="">請先選公司</option>';
    return;
  }
  elements.model.innerHTML = '<option value="">載入中…</option>';
  
  // 讀取當前輸入的 API Key（如果有的話）
  const currentApiKey = elements.apiKey?.value || '';
  // 傳遞 modelType 以區分語言模型和 embedding 模型
  const modelType = elements.modelType || 'language';
  const res = await window.electronAPI?.listModels?.(company, currentApiKey, modelType);
  
  const list = res?.models || [];
  const error = res?.error;
  if (error) {
    elements.model.innerHTML = `<option value="">${error}</option>`;
    return;
  }
  if (!list.length) {
    const typeStr = modelType === 'embedding' ? 'Embedding 模型' : '語言模型';
    elements.model.innerHTML = `<option value="">未取得任何${typeStr}，請確認 API Key 或權限</option>`;
    return;
  }
  const opts = list.map(m => `<option value="${m}">${m}</option>`).join('');
  elements.model.innerHTML = `<option value="">請選擇模型</option>${opts}`;
}

// 綁定每個服務的 company change 事件
function bindServiceEvents(elements) {
  elements.company?.addEventListener('change', async () => {
    updateApiKeyFieldVisibility(elements, elements.company.value);
    await loadModels(elements, elements.company.value);
  });

  // API Key 輸入時，如果已選擇公司就重新載入模型（即時驗證）
  elements.apiKey?.addEventListener('input', () => {
    const company = elements.company?.value;
    if (company && company !== 'ollama') {
      // 防抖：延遲 500ms 後才驗證，避免每次按鍵都查詢
      clearTimeout(elements._debounceTimer);
      elements._debounceTimer = setTimeout(() => {
        loadModels(elements, company);
      }, 500);
    }
  });

  // API Key 顯示/隱藏切換
  elements.toggleBtn?.addEventListener('click', () => {
    if (!(elements.apiKey instanceof HTMLInputElement)) return;
    const isPwd = elements.apiKey.type === 'password';
    elements.apiKey.type = isPwd ? 'text' : 'password';
    elements.toggleBtn.textContent = isPwd ? '隱藏' : '顯示';
  });
}

// 初始化所有服務
bindServiceEvents(translatorElements);
bindServiceEvents(embeddingElements);
bindServiceEvents(ragElements);

// 開啟設定視窗，載入當前設定
btnSettings?.addEventListener('click', async () => {
  let s;
  try {
    s = await window.electronAPI?.loadSettings?.();
  } catch (e) {
    showToast(`讀取設定失敗`, 'error');
  }
  
  if (s) {
    // 載入 Translator 設定
    if (translatorElements.company) translatorElements.company.value = s.translator?.company || '';
    await loadModels(translatorElements, s.translator?.company || '');
    if (translatorElements.model) translatorElements.model.value = s.translator?.model || '';
    if (translatorElements.apiKey) translatorElements.apiKey.value = s.translator?.apiKey || '';
    updateApiKeyFieldVisibility(translatorElements, s.translator?.company || '');

    // 載入 Embedding 設定
    if (embeddingElements.company) embeddingElements.company.value = s.embedding?.company || '';
    await loadModels(embeddingElements, s.embedding?.company || '');
    if (embeddingElements.model) embeddingElements.model.value = s.embedding?.model || '';
    if (embeddingElements.apiKey) embeddingElements.apiKey.value = s.embedding?.apiKey || '';
    updateApiKeyFieldVisibility(embeddingElements, s.embedding?.company || '');

    // 載入 RAG 設定
    if (ragElements.company) ragElements.company.value = s.rag?.company || '';
    await loadModels(ragElements, s.rag?.company || '');
    if (ragElements.model) ragElements.model.value = s.rag?.model || '';
    if (ragElements.apiKey) ragElements.apiKey.value = s.rag?.apiKey || '';
    updateApiKeyFieldVisibility(ragElements, s.rag?.company || '');
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

// 儲存設定按鈕
btnSaveSettings?.addEventListener('click', async () => {
  try {
    const theme = document.querySelector('input[name="theme"]:checked')?.value || 'dark';
    
    const data = {
      translator: {
        company: translatorElements.company?.value || '',
        model: translatorElements.model?.value || '',
        apiKey: translatorElements.apiKey?.value || ''
      },
      embedding: {
        company: embeddingElements.company?.value || '',
        model: embeddingElements.model?.value || '',
        apiKey: embeddingElements.apiKey?.value || ''
      },
      rag: {
        company: ragElements.company?.value || '',
        model: ragElements.model?.value || '',
        apiKey: ragElements.apiKey?.value || ''
      },
      theme,
      lang: 'zh' // 可以之後擴充語言設定
    };

    await window.electronAPI?.saveSettings?.(data);
    showToast('設定已儲存', 'success', 1500);
    closeModal();
  } catch (err) {
    console.error('儲存設定失敗', err);
    showToast('儲存失敗，請稍後重試', 'error', 2000);
  }
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

// 主題套用函數
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
        // 注意：主題變更會在儲存設定按鈕按下時一起儲存
        // 這裡只做即時預覽，不自動儲存
      } catch (err) {
        console.error('即時套用主題失敗', err);
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
