// preload.js - 可在此安全地暴露 API 給 renderer
const { contextBridge, ipcRenderer, nativeTheme } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizeState: (callback) => {
    const listener = (_event, isMax) => callback(Boolean(isMax));
    ipcRenderer.on('window:isMaximized', listener);
    // 回傳取消監聽的方法
    return () => ipcRenderer.removeListener('window:isMaximized', listener);
  },
  openFileDialog: (options) => ipcRenderer.invoke('dialog:open-file', options),
  sendFilePath: (filePath) => ipcRenderer.send('file:chosen', filePath),
  deleteFile: (fileName) => ipcRenderer.invoke('file:delete', fileName),
  startProcessing: (payload) => ipcRenderer.invoke('process:start', payload),
  onProcessEvent: (callback) => {
    const listener = (_e, evt) => callback(evt);
    ipcRenderer.on('process:evt', listener);
    return () => ipcRenderer.removeListener('process:evt', listener);
  },
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  setTheme: (theme) => {
    // theme: 'dark' | 'light' | 'system'
    if (theme === 'dark') nativeTheme.themeSource = 'dark';
    else if (theme === 'light') nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'system';
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  },
  checkUpdates: () => ipcRenderer.invoke('app:check-updates')
  ,openReleasePage: (url) => ipcRenderer.invoke('app:open-release-page', url)
  ,listModels: (company, apiKey, modelType) => ipcRenderer.invoke('models:list', company, apiKey, modelType)
  ,historyList: () => ipcRenderer.invoke('history:list')
  ,historyClear: () => ipcRenderer.invoke('history:clear')
  ,processedList: () => ipcRenderer.invoke('processed-docs:list')
  ,loadProcessedDoc: (id) => ipcRenderer.invoke('processed-docs:load', id)
  ,removeProcessedDoc: (id) => ipcRenderer.invoke('processed-docs:remove', id)
  ,getNativeTheme: () => ({
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    themeSource: nativeTheme.themeSource
  }),
  // 聊天：轉呼叫主程序，實際請求交由合作方 Python 腳本處理
  chatAsk: (payload) => ipcRenderer.invoke('chat:ask', payload),
  // 外部內容注入：可由 renderer 或嵌入的外部腳本呼叫，將 markdown 注入結果畫面
  // 用法：window.electronAPI.externalInject('# 標題\n\n內容...')
  // 或傳遞附帶中繼資料：window.electronAPI.externalInject({ markdown: '...', meta: { source: 'backend' } })
  externalInject: (markdownOrPayload) => {
    const payload = (typeof markdownOrPayload === 'string')
      ? { markdown: markdownOrPayload }
      : (markdownOrPayload || {});
    ipcRenderer.send('external:content', payload);
  },
  onNativeThemeUpdated: (callback) => {
    const listener = () => callback({
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      themeSource: nativeTheme.themeSource
    });
    nativeTheme.on('updated', listener);
    return () => nativeTheme.removeListener('updated', listener);
  },
  onApplyTheme: (callback) => {
    const listener = (_e, theme) => callback(theme);
    ipcRenderer.on('app:applyTheme', listener);
    return () => ipcRenderer.removeListener('app:applyTheme', listener);
  },
  onStartupStatus: (callback) => {
    const listener = (_e, payload) => callback(payload);
    ipcRenderer.on('app:startup-status', listener);
    return () => ipcRenderer.removeListener('app:startup-status', listener);
  },
  // 拖放除錯日誌
  logDropDebug: (data) => ipcRenderer.send('debug:drop-log', data)
  ,importTempFile: (name, bytes) => ipcRenderer.invoke('file:import-temp', { name, bytes })
  ,dropClipboardPaths: () => ipcRenderer.invoke('drop:clipboard-paths')
  // 聊天記錄檔案操作
  ,loadChatHistory: () => ipcRenderer.invoke('chat:load-history')
  ,saveChatHistory: (conversations) => ipcRenderer.invoke('chat:save-history', conversations)
});
