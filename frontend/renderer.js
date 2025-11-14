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
const processingOptionsEl = document.getElementById('processingOptions');
const processingMethodInputs = Array.from(document.querySelectorAll('input[name="processingMethod"]'));
const processingLanguageSelect = document.getElementById('processingLanguage');
const processingSummaryEl = document.getElementById('processingSummary');
let mdContainer = document.getElementById('mdContainer');
let mdContainerSecondary = document.getElementById('mdContainerSecondary');
let readerPanels = document.getElementById('readerPanels');
let secondaryPanel = document.getElementById('secondaryPanel');
let readerContentEl = document.getElementById('readerContent');
let tocSidebar = document.getElementById('tocSidebar');
let chatListEl = document.getElementById('chatList');
const docMetaSummary = document.getElementById('docMetaSummary');
const tocListEl = document.getElementById('tocList');
const referenceTrailEl = document.getElementById('referenceTrail');
const workspaceTabButtons = Array.from(document.querySelectorAll('.workspace-tab'));
const workspacePanels = Array.from(document.querySelectorAll('.workspace-panels .tab-panel'));
const workspaceActionGroups = Array.from(document.querySelectorAll('.workspace-actions .tab-actions'));
const searchInputEl = document.getElementById('searchInput');
const btnSearchPrev = document.getElementById('btnSearchPrev');
const btnSearchNext = document.getElementById('btnSearchNext');
const btnSearchClear = document.getElementById('btnSearchClear');
const contextChipsEl = document.getElementById('contextChips');
const btnPrevSection = document.getElementById('btnPrevSection');
const btnNextSection = document.getElementById('btnNextSection');
const btnToggleToc = document.getElementById('btnToggleToc');
const btnToggleSplit = document.getElementById('btnToggleSplit');
const btnOpenNewWindow = document.getElementById('btnOpenNewWindow');
const btnNewFile = document.getElementById('btnNewFile');
const btnSyncScroll = document.getElementById('btnSyncScroll');
const secondarySourceSelect = document.getElementById('secondarySource');
const btnAddBookmark = document.getElementById('btnAddBookmark');
const btnExportBookmarks = document.getElementById('btnExportBookmarks');
const btnCreateNote = document.getElementById('btnCreateNote');
const btnClearHighlights = document.getElementById('btnClearHighlights');
const bookmarkListEl = document.getElementById('bookmarkList');
const highlightListEl = document.getElementById('highlightList');
const noteListEl = document.getElementById('noteList');
const noteComposerEl = document.getElementById('noteComposer');
const noteComposerInput = document.getElementById('noteComposerInput');
const noteComposerContext = document.getElementById('noteComposerContext');
const btnNoteCancel = document.getElementById('btnNoteCancel');
const btnNoteSave = document.getElementById('btnNoteSave');
const suggestionContainerEl = document.getElementById('suggestionContainer');
const btnToggleSuggestions = document.getElementById('btnToggleSuggestions');
const suggestedQuestionsEl = document.getElementById('suggestedQuestions');
const chatPlaybackEl = document.getElementById('chatPlayback');
const chatPlaybackSnippet = document.getElementById('chatPlaybackSnippet');
const btnPlaybackToggle = document.getElementById('btnPlaybackToggle');
const btnPlaybackStop = document.getElementById('btnPlaybackStop');
const chatPlaybackToggleIcon = document.getElementById('chatPlaybackToggleIcon');
const chatPlaybackToggleText = document.getElementById('chatPlaybackToggleText');
const btnChatNew = document.getElementById('btnChatNew');
const btnChatHistory = document.getElementById('btnChatHistory');
const btnVoiceOutput = document.getElementById('btnVoiceOutput');
const chatInputEl = document.getElementById('chatInput');
const btnChatSend = document.getElementById('btnChatSend');
const chatHistoryBackdrop = document.getElementById('chatHistoryBackdrop');
const chatHistoryListEl = document.getElementById('chatHistoryList');
const btnChatHistoryClose = document.getElementById('btnChatHistoryClose');
const btnChatHistoryClose2 = document.getElementById('btnChatHistoryClose2');
const btnChatHistoryDelete = document.getElementById('btnChatHistoryDelete');
const btnChatHistoryLoad = document.getElementById('btnChatHistoryLoad');
const mathRenderQueue = new Set();
let isMathEngineReady = false;

const CONTEXT_MENU_ACTIONS = Object.freeze([
  { id: 'query', label: '查詢' },
  { id: 'copy', label: '複製' },
  { id: 'highlight', label: '標註' },
  { id: 'remove-highlight', label: '取消標註' },
  { id: 'ask', label: '提問' }
]);

const contextMenuButtons = {};
let contextMenuEl = null;
const contextMenuState = {
  visible: false,
  type: null,
  fromSecondary: false,
  selectionText: '',
  selectionRaw: '',
  target: null,
  highlightId: ''
};

function ensureReaderContainers() {
  const doc = document;
  if (!mdContainer || !doc.contains(mdContainer)) mdContainer = doc.getElementById('mdContainer');
  if (!mdContainerSecondary || !doc.contains(mdContainerSecondary)) {
    mdContainerSecondary = doc.getElementById('mdContainerSecondary');
  }
  if (!readerPanels || !doc.contains(readerPanels)) readerPanels = doc.getElementById('readerPanels');
  if (!secondaryPanel || !doc.contains(secondaryPanel)) secondaryPanel = doc.getElementById('secondaryPanel');
  if (!readerContentEl || !doc.contains(readerContentEl)) readerContentEl = doc.getElementById('readerContent');
  if (!tocSidebar || !doc.contains(tocSidebar)) tocSidebar = doc.getElementById('tocSidebar');
  if (!chatListEl || !doc.contains(chatListEl)) chatListEl = doc.getElementById('chatList');
}

function flushMathRenderQueue() {
  if (!isMathEngineReady) return;
  const mathJax = window.MathJax;
  if (!mathJax || typeof mathJax.typesetPromise !== 'function') return;
  const targets = Array.from(mathRenderQueue).filter(Boolean);
  if (!targets.length) return;
  mathRenderQueue.clear();
  mathJax.typesetPromise(targets).catch(err => {
    console.warn('MathJax 渲染失敗:', err);
  });
}

function renderMathInContainer(container) {
  if (!container) return;
  mathRenderQueue.add(container);
  if (isMathEngineReady) {
    flushMathRenderQueue();
  }
}

function handleMathEngineReady() {
  isMathEngineReady = true;
  flushMathRenderQueue();
}

window.addEventListener('pdfhelper:math-ready', handleMathEngineReady);
if (window.MathJax?.typesetPromise) {
  handleMathEngineReady();
}
function ensureContextMenuElement() {
  ensureReaderContainers();
  if (contextMenuEl && document.body.contains(contextMenuEl)) return contextMenuEl;
  if (contextMenuEl?.parentNode) {
    contextMenuEl.parentNode.removeChild(contextMenuEl);
  }

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.tabIndex = -1;

  CONTEXT_MENU_ACTIONS.forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `context-menu__item context-menu__item--${action.id}`;
    btn.dataset.action = action.id;
    btn.textContent = action.label;
    btn.disabled = true;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      runContextMenuAction(action.id);
    });
    btn.addEventListener('pointerdown', (event) => event.preventDefault());
    menu.appendChild(btn);
    contextMenuButtons[action.id] = btn;
  });

  menu.addEventListener('contextmenu', (event) => event.preventDefault());
  menu.addEventListener('pointerdown', (event) => event.preventDefault());

  document.body.appendChild(menu);
  contextMenuEl = menu;
  return menu;
}

function isResultViewActive() {
  if (!resultView) return false;
  const display = window.getComputedStyle(resultView).display;
  return display !== 'none';
}

function isWithinContentArea(target) {
  return Boolean(target?.closest?.('.markdown-panel'));
}

function isWithinChatArea(target) {
  return Boolean(target?.closest?.('.chat-list, .chat-input'));
}

function getInputSelectionText(target) {
  let el = null;
  if (target instanceof HTMLTextAreaElement) {
    el = target;
  } else if (target instanceof HTMLInputElement && target.type !== 'password') {
    el = target;
  } else {
    const container = target?.closest?.('.chat-input');
    if (container) {
      const candidate = container.querySelector('textarea, input[type="text"], input[type="search"], input[type="url"]');
      if (candidate instanceof HTMLTextAreaElement || (candidate instanceof HTMLInputElement && candidate.type !== 'password')) {
        el = candidate;
      }
    }
  }
  if (!el) return null;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return '';
  return el.value.slice(start, end);
}

function extractSelectionText(target, contextType) {
  let raw = '';
  if (contextType === 'chat') {
    const inputSelection = getInputSelectionText(target);
    if (inputSelection !== null) {
      raw = inputSelection;
    } else {
      const selection = window.getSelection();
      raw = selection ? selection.toString() : '';
    }
  } else {
    const selection = window.getSelection();
    raw = selection ? selection.toString() : '';
  }
  return { raw, text: raw.trim() };
}

function updateContextMenuAvailability() {
  ensureContextMenuElement();
  const hasSelection = Boolean(contextMenuState.selectionText);
  ['query', 'copy', 'ask'].forEach(id => {
    const btn = contextMenuButtons[id];
    if (btn) btn.disabled = !hasSelection;
  });
  const highlightBtn = contextMenuButtons.highlight;
  if (highlightBtn) {
    highlightBtn.disabled = contextMenuState.type !== 'content' || !hasSelection;
  }
  const removeBtn = contextMenuButtons['remove-highlight'];
  if (removeBtn) {
    removeBtn.disabled = !contextMenuState.highlightId;
  }
}

function positionContextMenu(x, y) {
  const menu = ensureContextMenuElement();
  menu.style.display = 'block';
  menu.classList.add('show');
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  const margin = 8;
  let left = x;
  let top = y;
  if (left + rect.width + margin > window.innerWidth) {
    left = Math.max(margin, window.innerWidth - rect.width - margin);
  } else {
    left = Math.max(margin, left);
  }
  if (top + rect.height + margin > window.innerHeight) {
    top = Math.max(margin, window.innerHeight - rect.height - margin);
  } else {
    top = Math.max(margin, top);
  }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = 'visible';
  contextMenuState.visible = true;
}

function hideContextMenu() {
  if (!contextMenuEl) return;
  contextMenuEl.classList.remove('show');
  contextMenuEl.style.display = 'none';
  contextMenuEl.style.visibility = 'hidden';
  contextMenuState.visible = false;
  contextMenuState.type = null;
  contextMenuState.fromSecondary = false;
  contextMenuState.selectionText = '';
  contextMenuState.selectionRaw = '';
  contextMenuState.target = null;
  contextMenuState.highlightId = '';
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed', err);
    }
  }
  try {
    const active = document.activeElement;
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    helper.style.transform = 'translate(-9999px, -9999px)';
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(helper);
    if (active && typeof active.focus === 'function') {
      try { active.focus({ preventScroll: true }); }
      catch { active.focus(); }
    }
    return ok;
  } catch (err) {
    console.error('Clipboard fallback failed', err);
    return false;
  }
}

async function runContextMenuAction(actionId) {
  const snapshot = {
    type: contextMenuState.type,
    fromSecondary: contextMenuState.fromSecondary,
    selectionText: contextMenuState.selectionText,
    selectionRaw: contextMenuState.selectionRaw,
    target: contextMenuState.target,
    highlightId: contextMenuState.highlightId
  };
  hideContextMenu();
  switch (actionId) {
    case 'query': {
      const query = snapshot.selectionText;
      if (!query) {
        showToast('請先選取文字', 'info', 1400);
        return;
      }
      if (searchInputEl) {
        searchInputEl.value = query;
        highlightSearchQuery(query);
        try { searchInputEl.focus({ preventScroll: true }); }
        catch { searchInputEl.focus(); }
        showToast('已將選取文字填入搜尋', 'success', 1200);
      } else {
        showToast('找不到搜尋欄位', 'warning', 1600);
      }
      return;
    }
    case 'copy': {
      const text = snapshot.selectionRaw || snapshot.selectionText;
      if (!text) {
        showToast('沒有可複製的文字', 'info', 1400);
        return;
      }
      const ok = await copyTextToClipboard(text);
      showToast(ok ? '已複製到剪貼簿' : '複製失敗', ok ? 'success' : 'error', 1400);
      return;
    }
    case 'highlight': {
      if (snapshot.type !== 'content') {
        showToast('標註僅適用於內容區域', 'info', 1400);
        return;
      }
      selectionState.fromSecondary = snapshot.fromSecondary;
      const captured = handleSelectionCapture(snapshot.fromSecondary);
      const effectiveText = selectionState.text || snapshot.selectionText;
      if (!captured && !effectiveText) {
        showToast('請先選取要標註的內容', 'info', 1400);
        return;
      }
      if (!selectionState.text && effectiveText) {
        selectionState.text = effectiveText;
      }
      if (!selectionState.range) {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
          try {
            const nativeRange = selection.getRangeAt(0);
            const container = selectionState.fromSecondary ? mdContainerSecondary : mdContainer;
            if (container?.contains(nativeRange.commonAncestorContainer)) {
              selectionState.range = nativeRange.cloneRange();
            }
          } catch {}
        }
      }
      if (!selectionState.headingId) {
        const node = selectionState.range?.startContainer || snapshot.target || null;
        selectionState.headingId = findHeadingIdForNode(node || mdContainer, selectionState.fromSecondary) || activeHeadingId || '';
      }
      if (!selectionState.text && effectiveText) {
        selectionState.text = effectiveText;
      }
      if (!selectionState.text) {
        showToast('請先選取要標註的內容', 'info', 1400);
        return;
      }
      createHighlightFromSelection();
      return;
    }
    case 'remove-highlight': {
      const highlightId = snapshot.highlightId;
      if (!highlightId) {
        showToast('找不到要取消的標註', 'info', 1400);
        return;
      }
      const removed = removeHighlightById(highlightId);
      if (removed) {
        if (selectionState.highlightId === highlightId) {
          selectionState.highlightId = null;
          selectionState.text = '';
          selectionState.range = null;
        }
        renderContextChips();
        showToast('標註已移除', 'info', 1400);
      } else {
        showToast('無法移除標註', 'error', 1500);
      }
      return;
    }
    case 'ask': {
      const source = snapshot.selectionText;
      if (!source) {
        showToast('請先選取文字', 'info', 1400);
        return;
      }
      const trimmed = source.length > 1200 ? `${source.slice(0, 1200)}…` : source;
      const prompt = `請針對以下內容說明重點：\n${trimmed}`;
      setWorkspaceTab('chat');
      enqueueChatQuestion(prompt, false);
      if (chatInputEl) {
        try { chatInputEl.focus({ preventScroll: true }); }
        catch { chatInputEl.focus(); }
      }
      showToast('已將選取內容帶入提問', 'success', 1400);
      return;
    }
    default:
      return;
  }
}

function handleContextMenuEvent(event) {
  if (!isResultViewActive()) {
    hideContextMenu();
    return;
  }
  const target = event.target;
  const inContent = isWithinContentArea(target);
  const inChat = !inContent && isWithinChatArea(target);
  if (!inContent && !inChat) {
    hideContextMenu();
    return;
  }
  event.preventDefault();
  ensureContextMenuElement();
  contextMenuState.type = inContent ? 'content' : 'chat';
  contextMenuState.fromSecondary = inContent && Boolean(target?.closest?.('#secondaryPanel'));
  contextMenuState.target = target instanceof Node ? target : null;
  if (contextMenuState.type === 'content') {
    handleSelectionCapture(contextMenuState.fromSecondary);
  }
  const selectionInfo = extractSelectionText(target, contextMenuState.type);
  contextMenuState.selectionRaw = selectionInfo.raw;
  contextMenuState.selectionText = selectionInfo.text;
  const highlightWrapper = target?.closest?.('mark.annotation-highlight');
  if (highlightWrapper) {
    contextMenuState.highlightId = highlightWrapper.dataset?.annotationId || '';
    if (!contextMenuState.selectionText) {
      const ann = annotationState.highlights.find(ann => ann.id === contextMenuState.highlightId);
      const snippet = ann?.snippet || highlightWrapper.textContent || '';
      contextMenuState.selectionRaw = snippet;
      contextMenuState.selectionText = snippet.trim();
    }
    selectionState.highlightId = contextMenuState.highlightId;
  } else {
    contextMenuState.highlightId = '';
  }
  if (contextMenuState.type === 'content' && !contextMenuState.selectionText && selectionState.text) {
    contextMenuState.selectionRaw = selectionState.text;
    contextMenuState.selectionText = selectionState.text.trim();
  }
  if (contextMenuState.type === 'content' && contextMenuState.selectionText) {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      try {
        const nativeRange = selection.getRangeAt(0);
        const container = contextMenuState.fromSecondary ? mdContainerSecondary : mdContainer;
        if (container?.contains(nativeRange.commonAncestorContainer)) {
          selectionState.range = nativeRange.cloneRange();
          selectionState.text = contextMenuState.selectionText;
          selectionState.headingId = findHeadingIdForNode(nativeRange.startContainer, contextMenuState.fromSecondary) || selectionState.headingId || activeHeadingId || '';
          selectionState.fromSecondary = contextMenuState.fromSecondary;
        }
      } catch {}
    }
    if (!selectionState.text) {
      selectionState.text = contextMenuState.selectionText;
    }
    if (!selectionState.headingId) {
      selectionState.headingId = activeHeadingId || '';
    }
    selectionState.fromSecondary = contextMenuState.fromSecondary;
  }
  updateContextMenuAvailability();
  positionContextMenu(event.clientX, event.clientY);
}

function handleContextMenuDocumentClick(event) {
  if (!contextMenuState.visible) return;
  if (contextMenuEl?.contains(event.target)) return;
  hideContextMenu();
}

function handleContextMenuKeydown(event) {
  if (event.key === 'Escape' && contextMenuState.visible) {
    hideContextMenu();
  }
}

function handleContextMenuScroll() {
  if (contextMenuState.visible) hideContextMenu();
}

const WORKSPACE_TABS = new Set(['chat', 'saved']);

function setWorkspaceTab(tab) {
  const next = (tab && WORKSPACE_TABS.has(tab)) ? tab : 'chat';
  activeWorkspaceTab = next;
  workspaceTabButtons.forEach(btn => {
    const isActive = btn.dataset.tab === next;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.setAttribute('aria-selected', 'false');
    }
  });
  workspacePanels.forEach(panel => {
    const isActive = panel.dataset.tab === next;
    if (isActive) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });
  workspaceActionGroups.forEach(group => {
    const isActive = group.dataset.tab === next;
    if (isActive) {
      group.removeAttribute('hidden');
    } else {
      group.setAttribute('hidden', '');
    }
  });
}

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
  chatPrefs: 'pdfhelper.chat.preferences',
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
const chatPrefs = loadFromStorage(STORAGE_KEYS.chatPrefs, { suggestionsCollapsed: false });
const processedDocsState = { items: [], loading: false };
const referenceTrail = [];
const selectionState = { range: null, text: '', headingId: null, fromSecondary: false, highlightId: null };
const processingPrefs = { method: 'auto', language: 'auto' };
const PROCESSING_METHOD_LABELS = { auto: '自動', ocr: 'OCR', txt: '純文字' };
const PROCESSING_LANGUAGE_LABELS = {
  auto: '自動偵測',
  ch: '簡體中文',
  chinese_cht: '繁體中文',
  en: '英文',
  korean: '韓文',
  japan: '日文',
  th: '泰文',
  el: '希臘文',
  latin: '拉丁文',
  arabic: '阿拉伯文',
  east_slavic: '俄文 (烏克蘭文)',
  devanagari: '印度文 (尼泊爾文)'
};
const SUPPORTED_PROCESS_METHODS = new Set(Object.keys(PROCESSING_METHOD_LABELS));
const SUPPORTED_SOURCE_LANGUAGES = new Set(Object.keys(PROCESSING_LANGUAGE_LABELS));
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
    renderMathInContainer(mdContainer);
    enableSplitView(Boolean(readerPrefs.split), false);
    applyAnnotations();
    renderHighlights();
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
  renderMathInContainer(tocListEl);
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
  renderMathInContainer(contextChipsEl);
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
  renderMathInContainer(referenceTrailEl);
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
  renderMathInContainer(mdContainerSecondary);
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
  const textNodes = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      if (!node.textContent) return NodeFilter.FILTER_REJECT;
  if (node.parentElement.closest('.chat-input, mark.search-hit')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach(node => {
    if (!node.parentNode) return;
    const text = node.textContent || '';
    const lower = text.toLowerCase();
    let index = lower.indexOf(needle);
    if (index === -1) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    while (index !== -1) {
      if (index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
      }
      const match = document.createElement('mark');
      match.className = className;
      match.textContent = text.slice(index, index + query.length);
      fragment.appendChild(match);
      hits.push(match);
      lastIndex = index + query.length;
      index = lower.indexOf(needle, lastIndex);
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    node.parentNode.replaceChild(fragment, node);
  });

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
  renderMathInContainer(bookmarkListEl);
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
  setWorkspaceTab('saved');
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
  renderMathInContainer(noteListEl);
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

function renderHighlights() {
  if (!highlightListEl) return;
  if (!annotationState.highlights.length) {
    highlightListEl.innerHTML = '<div class="muted">尚無標註</div>';
    return;
  }
  const items = [...annotationState.highlights].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const html = items.map(ann => {
    const heading = ann.headingText || resultState.headings.find(h => h.id === ann.headingId)?.text || '';
    const timestamp = ann.createdAt ? new Date(ann.createdAt).toLocaleTimeString() : '';
    return `
      <div class="highlight-card" data-id="${escapeHtml(ann.id)}">
        <div class="highlight-snippet">${escapeHtml((ann.snippet || '').slice(0, 240))}</div>
        <div class="highlight-meta">
          <span>${escapeHtml(heading || '標註')}</span>
          <span>${escapeHtml(timestamp)}</span>
        </div>
        <div class="highlight-actions">
          <button class="btn-icon" type="button" data-action="jump">定位</button>
          <button class="btn-icon" type="button" data-action="delete">刪除</button>
        </div>
      </div>`;
  }).join('');
  highlightListEl.innerHTML = html;
  renderMathInContainer(highlightListEl);
}

function focusHighlight(id) {
  ensureReaderContainers();
  if (!id) return;
  const selector = `mark.annotation-highlight[data-annotation-id="${escapeCssId(id)}"]`;
  let container = mdContainer;
  let target = container?.querySelector(selector);
  if (!target && mdContainerSecondary) {
    container = mdContainerSecondary;
    target = mdContainerSecondary.querySelector(selector);
  }
  if (!container || !target) return;
  smoothScrollIntoView(container, target);
  target.classList.add('pulse-highlight');
  setTimeout(() => target.classList.remove('pulse-highlight'), 900);
}

function clearAllHighlights() {
  if (!annotationState.highlights.length) {
    showToast('沒有標註可清除', 'info', 1400);
    return;
  }
  annotationState.highlights = [];
  persistToStorage(STORAGE_KEYS.annotations, annotationState);
  [mdContainer, mdContainerSecondary].forEach(container => {
    container?.querySelectorAll('mark.annotation-highlight').forEach(unwrapHighlightElement);
  });
  renderHighlights();
  renderContextChips();
  showToast('已清除所有標註', 'info', 1400);
}

function createHighlightFromSelection() {
  ensureReaderContainers();
  const snippet = selectionState.text;
  if (!snippet) {
    showToast('請先選取要標註的內容', 'info', 1400);
    return false;
  }
  const headingId = selectionState.headingId || getCurrentHeading()?.id || '';
  const duplicate = annotationState.highlights.some(ann => ann.snippet === snippet && ann.headingId === headingId);
  if (duplicate) {
    showToast('這段內容已經標註過', 'info', 1400);
    return false;
  }
  const id = `ann-${Date.now()}`;
  const container = selectionState.fromSecondary ? mdContainerSecondary : mdContainer;
  if (!container) {
    showToast('無法取得標註區域', 'error', 1500);
    return false;
  }
  const range = selectionState.range?.cloneRange?.() || null;
  let applied = false;
  if (range) {
    try {
      const wrapper = document.createElement('mark');
      wrapper.className = 'annotation-highlight';
      wrapper.dataset.annotationId = id;
      range.surroundContents(wrapper);
      applied = true;
    } catch (err) {
      console.warn('Highlight wrapping failed, fallback to snippet lookup', err);
    }
  }
  if (!applied) {
    wrapSnippetInContainer(container, snippet, id, 'annotation-highlight', selectionState.fromSecondary);
  }
  const markerExists = Boolean(
    mdContainer?.querySelector?.(`mark.annotation-highlight[data-annotation-id="${escapeCssId(id)}"]`) ||
    mdContainerSecondary?.querySelector?.(`mark.annotation-highlight[data-annotation-id="${escapeCssId(id)}"]`)
  );
  if (!markerExists) {
    showToast('無法建立標註', 'error', 1500);
    return false;
  }
  const heading = resultState.headings.find(h => h.id === headingId) || null;
  annotationState.highlights.push({
    id,
    snippet,
    headingId,
    headingText: heading?.text || '',
    createdAt: Date.now()
  });
  persistToStorage(STORAGE_KEYS.annotations, annotationState);
  applyAnnotations();
  renderHighlights();
  selectionState.highlightId = id;
  renderContextChips();
  try { window.getSelection()?.removeAllRanges(); }
  catch {}
  showToast('已建立標註', 'success', 1400);
  return true;
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

function clearSelection() {
  selectionState.range = null;
  selectionState.text = '';
  selectionState.headingId = null;
  selectionState.fromSecondary = false;
  selectionState.highlightId = null;
  renderContextChips();
}

function handleSelectionCapture(fromSecondary = false) {
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
  renderContextChips();
  return Boolean(selectionState.text);
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
  renderHighlights();
  return true;
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

function updateProcessingSummary() {
  if (!processingSummaryEl) return;
  const methodLabel = PROCESSING_METHOD_LABELS[processingPrefs.method] || PROCESSING_METHOD_LABELS.auto;
  const languageLabel = PROCESSING_LANGUAGE_LABELS[processingPrefs.language] || PROCESSING_LANGUAGE_LABELS.auto;
  processingSummaryEl.innerHTML = `<strong>${escapeHtml(methodLabel)}</strong> · ${escapeHtml(languageLabel)}`;
}

function resetProcessingOptions() {
  processingPrefs.method = 'auto';
  processingPrefs.language = 'auto';
  processingMethodInputs.forEach(input => {
    input.checked = input.value === 'auto';
  });
  if (processingLanguageSelect) {
    processingLanguageSelect.value = 'auto';
  }
  updateProcessingSummary();
}

function setProcessingOptionsVisibility(visible) {
  if (!processingOptionsEl) return;
  if (visible) {
    processingOptionsEl.hidden = false;
    processingOptionsEl.removeAttribute('aria-hidden');
    updateProcessingSummary();
  } else {
    processingOptionsEl.hidden = true;
    processingOptionsEl.setAttribute('aria-hidden', 'true');
    resetProcessingOptions();
  }
}

let pendingPdfPaths = [];
function updateActionButtons() {
  const hasFile = pendingPdfPaths.length > 0;
  if (btnStart) btnStart.style.display = hasFile ? 'inline-block' : 'none';
  if (btnDeleteFile) btnDeleteFile.style.display = hasFile ? 'inline-block' : 'none';
  setProcessingOptionsVisibility(hasFile);
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

processingMethodInputs.forEach(input => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    const value = input.value;
    processingPrefs.method = SUPPORTED_PROCESS_METHODS.has(value) ? value : 'auto';
    updateProcessingSummary();
  });
});

processingLanguageSelect?.addEventListener('change', () => {
  const value = processingLanguageSelect.value || 'auto';
  processingPrefs.language = SUPPORTED_SOURCE_LANGUAGES.has(value) ? value : 'auto';
  updateProcessingSummary();
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
  const method = SUPPORTED_PROCESS_METHODS.has(processingPrefs.method) ? processingPrefs.method : 'auto';
  const lang = SUPPORTED_SOURCE_LANGUAGES.has(processingPrefs.language) ? processingPrefs.language : 'auto';
  const result = await window.electronAPI?.startProcessing?.({ filePath, sessionId, method, lang });
    
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
    refreshProcessedDocs();
    
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
  conversations: [], // 初始化為空，稍後從檔案載入
  activeId: null,
  suggestions: [],
  historySelectionId: null
};
const voiceState = {
  recognition: null,
  listening: false,
  utterance: null,
  playing: false,
  paused: false,
  messageText: ''
};
let activeWorkspaceTab = 'chat';

// 從檔案載入聊天記錄
async function loadConversationsFromFile() {
  try {
    const conversations = await window.electronAPI?.loadChatHistory?.();
    if (Array.isArray(conversations) && conversations.length > 0) {
      chatState.conversations = conversations;
      console.log('[Chat] 已從檔案載入', conversations.length, '個對話');
    } else {
      // 如果檔案中沒有資料，嘗試從 localStorage 遷移
      await migrateFromLocalStorage();
    }
  } catch (err) {
    console.error('[Chat] 載入聊天記錄失敗:', err);
    chatState.conversations = [];
  }
}

// 從 localStorage 遷移到檔案系統
async function migrateFromLocalStorage() {
  try {
    const oldData = loadFromStorage(STORAGE_KEYS.chatHistory, []);
    if (Array.isArray(oldData) && oldData.length > 0) {
      console.log('[Chat] 發現 localStorage 中的舊資料，正在遷移...', oldData.length, '個對話');
      chatState.conversations = oldData;
      await saveConversations();
      // 清除 localStorage 中的資料
      localStorage.removeItem(STORAGE_KEYS.chatHistory);
      console.log('[Chat] 遷移完成，已清除 localStorage 中的舊資料');
    } else {
      chatState.conversations = [];
    }
  } catch (err) {
    console.error('[Chat] 從 localStorage 遷移失敗:', err);
    chatState.conversations = [];
  }
}

function persistChatPrefs() {
  persistToStorage(STORAGE_KEYS.chatPrefs, chatPrefs);
}

function applySuggestionsVisibility() {
  const collapsed = Boolean(chatPrefs.suggestionsCollapsed);
  suggestionContainerEl?.classList.toggle('collapsed', collapsed);
  if (suggestedQuestionsEl) {
    if (collapsed) {
      suggestedQuestionsEl.setAttribute('aria-hidden', 'true');
    } else {
      suggestedQuestionsEl.removeAttribute('aria-hidden');
    }
  }
  if (btnToggleSuggestions) {
    btnToggleSuggestions.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btnToggleSuggestions.textContent = collapsed ? '▸' : '▾';
    btnToggleSuggestions.title = collapsed ? '顯示推薦問題' : '隱藏推薦問題';
  }
}

function setSuggestionsCollapsed(collapsed) {
  chatPrefs.suggestionsCollapsed = Boolean(collapsed);
  persistChatPrefs();
  applySuggestionsVisibility();
}

function autoCollapseSuggestions() {
  if (chatPrefs.suggestionsCollapsed) return;
  setSuggestionsCollapsed(true);
}

function renderChat() {
  if (!chatListEl) return;
  const html = chatState.messages.map(msg => {
    const roleClass = msg.role === 'assistant' ? 'assistant' : (msg.role === 'user' ? 'user' : 'system');
    const body = `<div class="msg-content">${formatChatHtml(msg.content || '')}</div>`;
    const referenceList = Array.isArray(msg.references)
      ? msg.references.filter(ref => ref && ref.headingId)
      : [];
    const references = referenceList.length
      ? `<div class="msg-references">${referenceList.map(ref => `<button class="reference-chip" type="button" data-heading="${escapeHtml(ref.headingId || '')}">${escapeHtml(ref.label || ref.headingText || '引用')}</button>`).join('')}</div>`
      : '';
    const followups = (msg.followups && msg.followups.length)
      ? `<div class="followup-list">${msg.followups.map(text => `<button class="followup-btn" type="button" data-followup="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}</div>`
      : '';
    return `<div class="msg ${roleClass}">${body}${references}${followups}</div>`;
  }).join('');
  chatListEl.innerHTML = html;
  renderMathInContainer(chatListEl);
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
  stopChatPlayback();
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
  stopChatPlayback();
  renderChat();
  saveConversations();
  renderChatHistoryList(conv.id);
  return conv;
}

function saveConversations() {
  // 改用檔案系統儲存
  if (window.electronAPI?.saveChatHistory) {
    return window.electronAPI.saveChatHistory(chatState.conversations).catch(err => {
      console.error('[Chat] 儲存聊天記錄失敗:', err);
      return false;
    });
  } else {
    console.warn('[Chat] saveChatHistory API 未可用');
    return Promise.resolve(false);
  }
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
  stopChatPlayback();
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
    if (!headingId) continue;
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
  if (!suggestedQuestionsEl) {
    applySuggestionsVisibility();
    return;
  }
  if (!chatState.suggestions.length) {
    suggestedQuestionsEl.innerHTML = '<div class="muted" style="font-size:12px;">尚無建議問題</div>';
    applySuggestionsVisibility();
    return;
  }
  suggestedQuestionsEl.innerHTML = chatState.suggestions.map(text => `<button class="suggestion-item" type="button" data-suggestion="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('');
  applySuggestionsVisibility();
}

function enqueueChatQuestion(text, autoSend = false) {
  if (!chatInputEl) return;
  const value = String(text || '').trim();
  if (!value) return;
  chatInputEl.value = value;
  chatInputEl.focus();
  if (autoSend) sendChat();
}

function showChatPlaybackControls(text) {
  if (!chatPlaybackEl || !chatPlaybackSnippet) return;
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  chatPlaybackSnippet.textContent = cleaned
    ? (cleaned.length > 160 ? `${cleaned.slice(0, 160)}...` : cleaned)
    : '內容不可用';
  chatPlaybackEl.hidden = false;
  chatPlaybackEl.setAttribute('aria-hidden', 'false');
}

function hideChatPlaybackControls() {
  if (!chatPlaybackEl) return;
  chatPlaybackEl.hidden = true;
  chatPlaybackEl.setAttribute('aria-hidden', 'true');
  if (chatPlaybackSnippet) chatPlaybackSnippet.textContent = '';
  updateChatPlaybackControls();
}

function updateChatPlaybackControls() {
  if (!btnPlaybackToggle || !btnPlaybackStop || !chatPlaybackToggleIcon || !chatPlaybackToggleText) return;
  const hasUtterance = Boolean(voiceState.utterance);
  btnPlaybackToggle.disabled = !hasUtterance;
  btnPlaybackStop.disabled = !hasUtterance;
  if (!hasUtterance) {
    chatPlaybackToggleIcon.textContent = '▶';
    chatPlaybackToggleText.textContent = '播放';
    return;
  }
  if (voiceState.paused) {
    chatPlaybackToggleIcon.textContent = '▶';
    chatPlaybackToggleText.textContent = '播放';
  } else {
    chatPlaybackToggleIcon.textContent = '⏸';
    chatPlaybackToggleText.textContent = '暫停';
  }
}

function startChatPlayback(text) {
  const synth = window.speechSynthesis;
  if (!synth) {
    showToast('裝置不支援語音播放', 'warning', 1600);
    return;
  }
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    showToast('訊息內容為空，無法播放', 'warning', 1400);
    return;
  }

  synth.cancel();

  const utter = new SpeechSynthesisUtterance(cleaned);
  voiceState.utterance = utter;
  voiceState.playing = true;
  voiceState.paused = false;
  voiceState.messageText = cleaned;

  utter.onstart = () => {
    if (voiceState.utterance !== utter) return;
    voiceState.playing = true;
    voiceState.paused = false;
    updateChatPlaybackControls();
  };
  utter.onend = () => {
    if (voiceState.utterance !== utter) return;
    voiceState.playing = false;
    voiceState.paused = false;
    voiceState.utterance = null;
    voiceState.messageText = '';
    hideChatPlaybackControls();
  };
  utter.onpause = () => {
    if (voiceState.utterance !== utter) return;
    voiceState.paused = true;
    updateChatPlaybackControls();
  };
  utter.onresume = () => {
    if (voiceState.utterance !== utter) return;
    voiceState.paused = false;
    updateChatPlaybackControls();
  };
  utter.onerror = () => {
    if (voiceState.utterance !== utter) return;
    showToast('語音播放時發生錯誤', 'error', 1600);
    voiceState.playing = false;
    voiceState.paused = false;
    voiceState.utterance = null;
    voiceState.messageText = '';
    hideChatPlaybackControls();
  };

  showChatPlaybackControls(cleaned);
  synth.speak(utter);
  updateChatPlaybackControls();
}

function toggleChatPlayback() {
  const synth = window.speechSynthesis;
  if (!synth || !voiceState.utterance) return;
  if (voiceState.paused) {
    synth.resume();
    voiceState.paused = false;
  } else if (voiceState.playing) {
    synth.pause();
    voiceState.paused = true;
  } else if (voiceState.messageText) {
    startChatPlayback(voiceState.messageText);
    return;
  }
  updateChatPlaybackControls();
}

function stopChatPlayback() {
  const synth = window.speechSynthesis;
  if (synth) synth.cancel();
  voiceState.playing = false;
  voiceState.paused = false;
  voiceState.utterance = null;
  voiceState.messageText = '';
  hideChatPlaybackControls();
}

function speakLastAssistantMessage() {
  const assistantMsg = [...chatState.messages].reverse().find(m => m.role === 'assistant');
  if (!assistantMsg || !assistantMsg.content) {
    showToast('尚無可朗讀的回覆', 'warning', 1400);
    return;
  }
  startChatPlayback(assistantMsg.content);
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
  const hadUserMessage = conv?.messages?.some(m => m.role === 'user');
  const userMessage = { role: 'user', content: text };
  conv.messages.push(userMessage);
  if (!hadUserMessage && !chatPrefs.suggestionsCollapsed) {
    autoCollapseSuggestions();
  }
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

workspaceTabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab) setWorkspaceTab(tab);
  });
});

highlightListEl?.addEventListener('click', (event) => {
  const actionBtn = event.target.closest('button[data-action]');
  if (!actionBtn) return;
  const card = event.target.closest('.highlight-card');
  if (!card) return;
  const id = card.getAttribute('data-id');
  if (!id) return;
  const action = actionBtn.getAttribute('data-action');
  if (action === 'delete') {
    const removed = removeHighlightById(id);
    if (removed) {
      renderContextChips();
      showToast('標註已移除', 'info', 1400);
    }
  } else if (action === 'jump') {
    focusHighlight(id);
  }
});

btnClearHighlights?.addEventListener('click', clearAllHighlights);

btnChatNew?.addEventListener('click', () => startNewConversation());

btnToggleSuggestions?.addEventListener('click', () => {
  setSuggestionsCollapsed(!chatPrefs.suggestionsCollapsed);
});

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

btnVoiceOutput?.addEventListener('click', speakLastAssistantMessage);
btnPlaybackToggle?.addEventListener('click', toggleChatPlayback);
btnPlaybackStop?.addEventListener('click', stopChatPlayback);

// 初始化聊天記錄（從檔案載入）
loadConversationsFromFile().then(() => {
  ensureActiveConversation();
  renderChat();
  renderChatHistoryList();
}).catch(err => {
  console.error('[Chat] 初始化失敗:', err);
  ensureActiveConversation();
  renderChat();
  renderChatHistoryList();
});

resetProcessingOptions();
setProcessingOptionsVisibility(false);
applySuggestionsVisibility();
refreshSuggestedQuestions();
ensureReaderContainers();
hideChatPlaybackControls();
updateChatPlaybackControls();
setWorkspaceTab(activeWorkspaceTab);
const tocInitiallyVisible = Boolean(readerPrefs.tocVisible);
if (tocSidebar) tocSidebar.classList.toggle('hidden', !tocInitiallyVisible);
if (readerContentEl) readerContentEl.classList.toggle('toc-hidden', !tocInitiallyVisible);
if (btnToggleToc) {
  btnToggleToc.textContent = tocInitiallyVisible ? '隱藏目錄' : '顯示目錄';
  btnToggleToc.classList.toggle('active', tocInitiallyVisible);
}
btnToggleSplit?.classList.toggle('active', Boolean(readerPrefs.split));
btnSyncScroll?.classList.toggle('active', Boolean(readerPrefs.syncScroll));

document.addEventListener('contextmenu', handleContextMenuEvent);
document.addEventListener('click', handleContextMenuDocumentClick);
document.addEventListener('keydown', handleContextMenuKeydown);
window.addEventListener('blur', hideContextMenu);
window.addEventListener('resize', hideContextMenu);
document.addEventListener('scroll', handleContextMenuScroll, true);

mdContainer?.addEventListener('mouseup', () => handleSelectionCapture(false));
mdContainer?.addEventListener('keyup', () => handleSelectionCapture(false));
mdContainerSecondary?.addEventListener('mouseup', () => handleSelectionCapture(true));
mdContainerSecondary?.addEventListener('keyup', () => handleSelectionCapture(true));

mdContainer?.addEventListener('scroll', () => {
  updateScrollProgressIndicator();
});

mdContainerSecondary?.addEventListener('scroll', () => {
  updateScrollProgressIndicator();
});

renderBookmarks();
renderNotes();
renderHighlights();

// 歷史按鈕（已處理文件檢視）
const btnHistory = document.getElementById('btnHistory');
const historyBackdrop = document.getElementById('historyBackdrop');
const btnHistoryClose = document.getElementById('btnHistoryClose');
const btnHistoryClose2 = document.getElementById('btnHistoryClose2');
const btnHistoryClear = document.getElementById('btnHistoryClear');
const historyListEl = document.getElementById('historyList');
const historyConfirmEl = document.getElementById('historyConfirm');
const historyConfirmTitleEl = document.getElementById('historyConfirmTitle');
const btnHistoryConfirmCancel = document.getElementById('btnHistoryConfirmCancel');
const btnHistoryConfirmDelete = document.getElementById('btnHistoryConfirmDelete');
const historyConfirmDeleteLabel = btnHistoryConfirmDelete?.textContent || '移除';
const historyConfirmClearLabel = '清除';
let pendingHistoryRemovalId = null;
let pendingHistoryRemovalAll = false;

function normalizeProcessedDoc(item, index) {
  const id = item?.id || item?.documentId || item?.sessionId || item?.collectionName || `doc-${index}`;
  const filePath = item?.filePath || item?.path || '';
  const title = item?.title || item?.displayName || (filePath ? pathBasename(filePath) : '') || item?.name || `文件 ${index + 1}`;
  const updatedAt = item?.updatedAt || item?.finishedAt || item?.completedAt || item?.createdAt || item?.timestamp || null;
  const translator = item?.translator || item?.company || '';
  const model = item?.model || item?.translatorModel || '';
  const state = item?.state || item?.rawStatus || '';
  const status = item?.status || (state === 'error' ? '錯誤' : (state === 'done' ? '完成' : (item?.error ? '錯誤' : (item?.done ? '完成' : ''))));
  const language = item?.lang || item?.language || '';
  const collection = item?.collection || item?.collectionName || '';
  const errorMessage = item?.errorMessage || item?.error || '';
  const lastStatus = item?.lastStatus || '';
  const isError = state === 'error' || /錯誤/.test(status);
  return { id, title, filePath, updatedAt, translator, model, status, language, collection, state, isError, errorMessage, lastStatus, raw: item };
}

function formatDocTime(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  } catch {
    return '';
  }
}

function renderProcessedDocs() {
  if (!historyListEl) return;
  if (processedDocsState.loading) {
    historyListEl.innerHTML = '<div class="doc-history-empty">正在載入…</div>';
    return;
  }
  if (!processedDocsState.items.length) {
    historyListEl.innerHTML = '<div class="doc-history-empty">尚無已處理文件</div>';
    return;
  }
  const html = processedDocsState.items.map(doc => {
    const metaParts = [];
    const time = formatDocTime(doc.updatedAt);
    if (time) metaParts.push(`<span>🕒 ${escapeHtml(time)}</span>`);
    if (doc.status) metaParts.push(`<span>狀態：${escapeHtml(doc.status)}</span>`);
    const modelLabel = [doc.translator, doc.model].filter(Boolean).join(' / ');
    if (modelLabel) metaParts.push(`<span>模型：${escapeHtml(modelLabel)}</span>`);
    if (doc.language) metaParts.push(`<span>語言：${escapeHtml(doc.language)}</span>`);
    if (doc.collection) metaParts.push(`<span>集合：${escapeHtml(doc.collection)}</span>`);
    if (doc.isError) {
      if (doc.lastStatus) metaParts.push(`<span class="doc-history-error">⚠ ${escapeHtml(doc.lastStatus)}</span>`);
      if (doc.errorMessage) metaParts.push(`<span class="doc-history-error">⚠ ${escapeHtml(doc.errorMessage)}</span>`);
    }
    const metaHtml = metaParts.length ? `<div class="doc-history-meta">${metaParts.join('<span>•</span>')}</div>` : '';
    const classes = ['doc-history-item'];
    if (doc.isError) classes.push('error');
  return `<div class="${classes.join(' ')}" role="button" tabindex="0" data-id="${escapeHtml(doc.id)}" data-status="${escapeHtml(doc.state || '')}" data-error="${doc.isError ? 'true' : 'false'}" data-error-message="${doc.errorMessage ? escapeHtml(doc.errorMessage) : ''}" data-last-status="${doc.lastStatus ? escapeHtml(doc.lastStatus) : ''}" aria-disabled="${doc.isError ? 'true' : 'false'}">
      <div class="doc-history-title">${escapeHtml(doc.title)}</div>
      ${metaHtml}
      <button class="doc-history-remove" type="button" data-action="remove" title="移除此文件">×</button>
    </div>`;
  }).join('');
  historyListEl.innerHTML = html;
}

function showHistoryRemovalConfirm(id, title, options = {}) {
  if (!historyConfirmEl) return;
  const isClearAll = Boolean(options.clearAll);
  pendingHistoryRemovalAll = isClearAll;
  pendingHistoryRemovalId = isClearAll ? null : (id || null);
  const label = isClearAll ? '全部歷程紀錄' : ((title || '').trim() || '這筆記錄');
  if (historyConfirmTitleEl) historyConfirmTitleEl.textContent = label;
  historyConfirmEl.removeAttribute('hidden');
  historyConfirmEl.setAttribute('aria-hidden', 'false');
  historyConfirmEl.setAttribute('data-mode', isClearAll ? 'clear-all' : 'single');
  if (btnHistoryConfirmDelete) {
    btnHistoryConfirmDelete.textContent = isClearAll ? historyConfirmClearLabel : historyConfirmDeleteLabel;
  }
  requestAnimationFrame(() => historyConfirmEl.classList.add('show'));
  if (btnHistoryConfirmCancel) {
    try {
      btnHistoryConfirmCancel.focus({ preventScroll: true });
    } catch {
      btnHistoryConfirmCancel.focus();
    }
  }
}

function hideHistoryRemovalConfirm() {
  if (!historyConfirmEl) return;
  historyConfirmEl.classList.remove('show');
  historyConfirmEl.setAttribute('aria-hidden', 'true');
  historyConfirmEl.removeAttribute('data-mode');
  pendingHistoryRemovalId = null;
  pendingHistoryRemovalAll = false;
  if (btnHistoryConfirmDelete) {
    btnHistoryConfirmDelete.disabled = false;
    btnHistoryConfirmDelete.textContent = historyConfirmDeleteLabel;
  }
  setTimeout(() => {
    if (historyConfirmEl) historyConfirmEl.setAttribute('hidden', '');
  }, 180);
}

async function refreshProcessedDocs() {
  processedDocsState.loading = true;
  renderProcessedDocs();
  try {
    const res = await window.electronAPI?.processedList?.();
    if (res?.ok === false) {
      processedDocsState.items = [];
      if (res?.error) showToast(res.error, 'warning', 2600);
    } else {
      const source = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      processedDocsState.items = source.map((item, index) => normalizeProcessedDoc(item, index));
    }
  } catch (err) {
    console.error('載入已處理文件列表失敗:', err);
    processedDocsState.items = [];
    showToast('無法載入已處理文件清單', 'error', 2200);
  } finally {
    processedDocsState.loading = false;
    renderProcessedDocs();
  }
}

function applyHistoricalDocument(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const mdPrimary = typeof payload.markdown === 'string' ? payload.markdown : '';
  const mdZh = typeof payload.zh === 'string' ? payload.zh : (typeof payload.contentZh === 'string' ? payload.contentZh : '');
  const mdEn = typeof payload.en === 'string' ? payload.en : (typeof payload.contentEn === 'string' ? payload.contentEn : '');
  if (!mdPrimary && !mdZh && !mdEn) return false;
  if (mdZh) resultState.zh = mdZh;
  if (mdEn) resultState.en = mdEn;
  if (mdPrimary || mdZh || mdEn) resultState.markdown = mdPrimary || mdEn || mdZh || resultState.markdown;
  resultState.meta = payload.meta || payload.metadata || payload.info || resultState.meta;
  if (payload.lang) resultState.lang = payload.lang;
  clearSelection();
  renderMarkdown();
  if (wrapUpload) wrapUpload.style.display = 'none';
  if (processingView) processingView.style.display = 'none';
  if (resultView) resultView.style.display = 'block';
  return true;
}

async function openProcessedDocumentById(id) {
  if (!id) return;
  hideHistoryRemovalConfirm();
  const fallbackEntry = processedDocsState.items.find(doc => doc.id === id);
  try {
    const res = await window.electronAPI?.loadProcessedDoc?.(id);
    let doc = null;
    if (res?.ok === false) {
      if (res?.error) showToast(res.error, 'warning', 2400);
    } else if (res) {
      doc = res.document || res.data || res.payload || res;
    }
    if (!doc && fallbackEntry?.raw) {
      doc = fallbackEntry.raw;
    }
    if (doc && applyHistoricalDocument(doc)) {
      closeHistory();
      showToast('已載入歷程文件', 'success', 1400);
    } else {
      showToast('尚未取得已處理文件內容', 'warning', 2000);
    }
  } catch (err) {
    console.error('載入歷程文件失敗:', err);
    showToast('載入歷程文件時發生錯誤', 'error', 2200);
  }
}

async function removeProcessedDocumentById(id) {
  if (!id) return;
  const deleteBtn = btnHistoryConfirmDelete;
  const originalLabel = deleteBtn?.textContent || historyConfirmDeleteLabel;
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '移除中…';
  }
  try {
    const res = await window.electronAPI?.removeProcessedDoc?.(id);
    if (!res) {
      showToast('尚未設定刪除接口', 'warning', 2200);
      return;
    }
    if (res.ok === false) {
      showToast(res.error || '無法移除文件', 'error', 2200);
      return;
    }
    showToast('已移除文件記錄', 'success', 1400);
    hideHistoryRemovalConfirm();
    await refreshProcessedDocs();
  } catch (err) {
    console.error('移除歷程文件失敗:', err);
    showToast('移除歷程文件時發生錯誤', 'error', 2200);
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      const mode = historyConfirmEl?.getAttribute('data-mode');
      deleteBtn.textContent = mode === 'clear-all' ? historyConfirmClearLabel : historyConfirmDeleteLabel;
    }
  }
}

async function clearAllProcessedDocuments() {
  const deleteBtn = btnHistoryConfirmDelete;
  const originalLabel = deleteBtn?.textContent || historyConfirmClearLabel;
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '清除中…';
  }
  try {
    const cleared = await window.electronAPI?.historyClear?.();
    if (cleared) {
      showToast('已清除所有歷程記錄', 'info', 1600);
    } else {
      showToast('沒有變更或歷程已為空', 'info', 1600);
    }
    hideHistoryRemovalConfirm();
    await refreshProcessedDocs();
  } catch (err) {
    console.error('清除歷程記錄失敗:', err);
    showToast('清除歷程記錄時發生錯誤', 'error', 2200);
  } finally {
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.textContent = originalLabel;
    }
  }
}

function openHistory() {
  if (!historyBackdrop) return;
  hideHistoryRemovalConfirm();
  processedDocsState.loading = true;
  renderProcessedDocs();
  historyBackdrop.style.display = 'flex';
  requestAnimationFrame(() => {
    historyBackdrop.classList.add('show');
    historyBackdrop.querySelector('.modal')?.classList.add('open');
  });
  refreshProcessedDocs();
}

function closeHistory() {
  if (!historyBackdrop) return;
  hideHistoryRemovalConfirm();
  historyBackdrop.classList.remove('show');
  historyBackdrop.querySelector('.modal')?.classList.remove('open');
  setTimeout(() => { historyBackdrop.style.display = 'none'; }, 180);
}

btnHistory?.addEventListener('click', openHistory);
btnHistoryClose?.addEventListener('click', closeHistory);
btnHistoryClose2?.addEventListener('click', closeHistory);
btnHistoryClear?.addEventListener('click', () => {
  showHistoryRemovalConfirm(null, '全部歷程紀錄', { clearAll: true });
});

historyListEl?.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('.doc-history-remove');
  if (removeBtn) {
    event.stopPropagation();
    const item = removeBtn.closest('.doc-history-item');
    const id = item?.getAttribute('data-id');
    if (!id) return;
    const title = item?.querySelector('.doc-history-title')?.textContent || '';
    showHistoryRemovalConfirm(id, title);
    return;
  }
  const item = event.target.closest('.doc-history-item');
  if (!item) return;
  if (pendingHistoryRemovalId) hideHistoryRemovalConfirm();
  const isError = item.getAttribute('data-error') === 'true';
  if (isError) {
    const lastStatus = item.getAttribute('data-last-status') || '';
    const errMsg = item.getAttribute('data-error-message') || '';
    const message = [lastStatus, errMsg].filter(Boolean).join('｜') || '此紀錄因處理失敗無法開啟';
    showToast(message, 'warning', 2400);
    return;
  }
  const id = item.getAttribute('data-id');
  openProcessedDocumentById(id);
});

historyListEl?.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const item = event.target.closest('.doc-history-item');
  if (!item) return;
  event.preventDefault();
  if (item.getAttribute('data-error') === 'true') {
    const lastStatus = item.getAttribute('data-last-status') || '';
    const errMsg = item.getAttribute('data-error-message') || '';
    const message = [lastStatus, errMsg].filter(Boolean).join('｜') || '此紀錄因處理失敗無法開啟';
    showToast(message, 'warning', 2400);
    return;
  }
  const id = item.getAttribute('data-id');
  openProcessedDocumentById(id);
});

btnHistoryConfirmCancel?.addEventListener('click', () => {
  hideHistoryRemovalConfirm();
});

btnHistoryConfirmDelete?.addEventListener('click', () => {
  if (pendingHistoryRemovalAll) {
    clearAllProcessedDocuments();
    return;
  }
  if (!pendingHistoryRemovalId) {
    hideHistoryRemovalConfirm();
    return;
  }
  removeProcessedDocumentById(pendingHistoryRemovalId);
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
const btnDownloadUpdate = document.getElementById('btnDownloadUpdate');
const DEFAULT_RELEASE_URL = 'https://github.com/TaiyakiVenturer/PDFHelper/releases/latest';
let latestReleaseInfo = null;

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

// 模型列表快取，避免每次開啟設定都重新向後端取資料
const MODEL_CACHE_TTL = 5 * 60 * 1000; // 5 分鐘
const modelCache = new Map(); // key => { timestamp, items, error }

async function getCachedModels(company, apiKey, modelType) {
  const cacheKey = `${modelType}:${company || ''}:${apiKey || ''}`;
  const now = Date.now();
  const cached = modelCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < MODEL_CACHE_TTL) {
    return cached;
  }

  const res = await window.electronAPI?.listModels?.(company, apiKey, modelType);
  const payload = {
    timestamp: now,
    items: res?.models || [],
    error: res?.error || null
  };
  modelCache.set(cacheKey, payload);
  return payload;
}

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

function resetUpdateControls() {
  latestReleaseInfo = null;
  if (updateStatus) {
    updateStatus.classList.remove('show', 'ok', 'info', 'error');
    updateStatus.textContent = '尚未檢查更新';
  }
  if (btnDownloadUpdate) {
    btnDownloadUpdate.hidden = true;
    btnDownloadUpdate.disabled = false;
    btnDownloadUpdate.dataset.releaseUrl = DEFAULT_RELEASE_URL;
    btnDownloadUpdate.textContent = '下載更新';
  }
}

function setProviderBadge(badgeEl, company) {
  if (!badgeEl) return;
  badgeEl.className = 'provider-badge';
  const map = { openai: 'OpenAI', google: 'Google', xai: 'xAI', anthropic: 'Anthropic', ollama: 'Ollama' };
  if (!company) { badgeEl.textContent = ''; return; }
  badgeEl.textContent = map[company] || '';
  badgeEl.classList.add(company);
}

async function loadModels(elements, company, selectedModel) {
  if (!elements.model) return;
  setProviderBadge(elements.badge, company);
  if (!company) {
    elements.model.innerHTML = '<option value="">請先選公司</option>';
    return;
  }
  // 若沒有 API Key（如未填寫或為 Ollama），只顯示原值即可
  const needsKey = company && company !== 'ollama';
  const placeholderText = needsKey ? '載入中…' : '不需設定模型';
  elements.model.innerHTML = `<option value="">${placeholderText}</option>`;
  
  // 讀取當前輸入的 API Key（如果有的話）
  const currentApiKey = elements.apiKey?.value || '';
  // 傳遞 modelType 以區分語言模型和 embedding 模型
  const modelType = elements.modelType || 'language';
  const requestToken = Symbol('loadModels');
  elements._activeRequest = requestToken;

  const { items, error } = await getCachedModels(company, currentApiKey, modelType).catch((err) => ({ items: [], error: err?.message || '載入失敗' }));
  if (elements._activeRequest !== requestToken) return; // 有較新的請求，忽略本次結果

  if (error) {
    elements.model.innerHTML = `<option value="">${error}</option>`;
    return;
  }

  if (!items.length) {
    const typeStr = modelType === 'embedding' ? 'Embedding 模型' : '語言模型';
    elements.model.innerHTML = `<option value="">未取得任何${typeStr}，請確認 API Key 或權限</option>`;
    return;
  }

  const optionsHtml = items.map((m) => `<option value="${m}">${m}</option>`).join('');
  elements.model.innerHTML = `<option value="">請選擇模型</option>${optionsHtml}`;

  if (selectedModel) {
    if (items.includes(selectedModel)) {
      elements.model.value = selectedModel;
    } else {
      const fallbackOption = document.createElement('option');
      fallbackOption.value = selectedModel;
      fallbackOption.textContent = `（未在清單中）${selectedModel}`;
      fallbackOption.selected = true;
      elements.model.appendChild(fallbackOption);
    }
  }
}

async function populateService(elements, config) {
  if (!elements) return;
  const { company = '', model = '', apiKey = '' } = config || {};
  if (elements.apiKey) elements.apiKey.value = apiKey;
  if (elements.apiKey instanceof HTMLInputElement) elements.apiKey.type = 'password';
  if (elements.toggleBtn) elements.toggleBtn.textContent = '顯示';
  if (elements.company) elements.company.value = company;
  updateApiKeyFieldVisibility(elements, company);
  if (elements.model) elements.model.disabled = true;
  await loadModels(elements, company, model);
  if (elements.model) elements.model.disabled = false;
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
  openModal();

  // 重置 UI
  document.querySelectorAll('input[name="theme"]').forEach((el) => {
    if (el instanceof HTMLInputElement) el.checked = false;
  });
  resetUpdateControls();
  if (lblVersion) lblVersion.textContent = '-';

  const services = [translatorElements, embeddingElements, ragElements];
  services.forEach((elements) => {
    if (!elements) return;
    if (elements.company) elements.company.value = '';
    if (elements.apiKey) {
      elements.apiKey.value = '';
      if (elements.apiKey instanceof HTMLInputElement) elements.apiKey.type = 'password';
    }
    if (elements.toggleBtn) elements.toggleBtn.textContent = '顯示';
    if (elements.model) {
      elements.model.disabled = true;
      elements.model.innerHTML = '<option value="">載入中…</option>';
    }
    updateApiKeyFieldVisibility(elements, '');
  });

  const updatePromise = window.electronAPI?.checkUpdates?.().catch((err) => {
    console.warn('取得版本資訊失敗', err);
    return null;
  });

  try {
    const settings = await window.electronAPI?.loadSettings?.();

    if (settings) {
      await Promise.all([
        populateService(translatorElements, settings.translator),
        populateService(embeddingElements, settings.embedding),
        populateService(ragElements, settings.rag)
      ]);

      const theme = settings.theme || 'dark';
      document.querySelectorAll('input[name="theme"]').forEach((el) => {
        if (el instanceof HTMLInputElement) el.checked = (el.value === theme);
      });
    }
  } catch (error) {
    console.error('載入設定時發生錯誤', error);
    services.forEach((elements) => {
      if (elements?.model) {
        elements.model.disabled = false;
        elements.model.innerHTML = '<option value="">請先選公司</option>';
      }
    });
    showToast('讀取設定失敗，請稍後再試', 'error', 2200);
  }

  updatePromise?.then((info) => {
    if (!lblVersion) return;
    if (info?.currentVersion) {
      lblVersion.textContent = info.currentVersion;
    } else {
      lblVersion.textContent = '-';
    }
  });
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
  if (btnDownloadUpdate) {
    btnDownloadUpdate.hidden = true;
    btnDownloadUpdate.disabled = true;
  }
  updateStatus.classList.remove('ok', 'error', 'info');
  updateStatus.classList.add('show', 'info');
  updateStatus.innerHTML = `<span class="spinner" aria-hidden="true"></span> 正在檢查更新…`;
  try {
    const res = await window.electronAPI?.checkUpdates?.();
    if (!res) throw new Error('無回應');
    latestReleaseInfo = res;
    const { currentVersion, hasUpdate, message, latestVersion, releaseName, releaseUrl, assets } = res;
    const latestLabel = latestVersion || releaseName || '';
    if (hasUpdate) {
      updateStatus.classList.remove('info', 'error');
      updateStatus.classList.add('ok');
      const labelText = latestLabel ? `發現新版本 ${latestLabel}（目前 ${currentVersion}）` : `有新版本可用！目前版本 ${currentVersion}`;
      updateStatus.textContent = labelText;
      if (btnDownloadUpdate) {
        const targetUrl = releaseUrl || DEFAULT_RELEASE_URL;
        btnDownloadUpdate.dataset.releaseUrl = targetUrl;
        btnDownloadUpdate.textContent = Array.isArray(assets) && assets.length ? '下載更新' : '開啟發布頁面';
        btnDownloadUpdate.hidden = false;
        btnDownloadUpdate.disabled = false;
      }
    } else {
      updateStatus.classList.remove('ok', 'error');
      updateStatus.classList.add('info');
      const fallback = latestLabel ? `最新版本為 ${latestLabel}` : '';
      updateStatus.textContent = message || `目前版本 ${currentVersion}，已是最新${fallback ? `（${fallback}）` : ''}`;
      if (btnDownloadUpdate) {
        btnDownloadUpdate.hidden = true;
        btnDownloadUpdate.disabled = false;
      }
    }
  } catch (err) {
    console.error('檢查更新失敗', err);
    latestReleaseInfo = null;
    updateStatus.classList.remove('ok', 'info');
    updateStatus.classList.add('show', 'error');
    updateStatus.textContent = '檢查更新失敗，請稍後再試';
    if (btnDownloadUpdate) {
      btnDownloadUpdate.hidden = true;
      btnDownloadUpdate.disabled = false;
    }
  } finally {
    btnUpdateInModal.disabled = false;
  }
});

btnDownloadUpdate?.addEventListener('click', async () => {
  if (!btnDownloadUpdate) return;
  const target = btnDownloadUpdate.dataset.releaseUrl || latestReleaseInfo?.releaseUrl || DEFAULT_RELEASE_URL;
  if (!target) return;
  btnDownloadUpdate.disabled = true;
  try {
    await window.electronAPI?.openReleasePage?.(target);
  } catch (err) {
    console.error('開啟更新頁面失敗', err);
    showToast('無法開啟更新頁面', 'error', 2000);
  } finally {
    btnDownloadUpdate.disabled = false;
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
