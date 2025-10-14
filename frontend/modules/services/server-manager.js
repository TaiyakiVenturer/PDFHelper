"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverManager = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const server_js_1 = require("../types/server.js");
const api_client_js_1 = require("./api-client.js");
const config_js_1 = require("./config.js");
/**
 * Backend API Server 管理服務
 *
 * @description 負責啟動與管理後端 API 伺服器的生命週期
 */
class ServerManager {
    constructor() {
        // 目前的伺服器狀態 (沒啟動為 null)
        this.process = null;
        // 目前的伺服器狀態
        this.status = server_js_1.ServerProcessStatus.STOPPED;
        // 預設的伺服器設定
        this.defaultPort = config_js_1.API_CONFIG.PORT;
        this.defaultTimeout = config_js_1.API_CONFIG.TIMEOUT;
    }
    /**
     * 檢查伺服器是否正在運行
     * @returns boolean 是否運行
     */
    isRunning() {
        return this.status === server_js_1.ServerProcessStatus.RUNNING;
    }
    /**
     * 獲取當前伺服器狀態
     * @returns ServerProcessStatus
    */
    getStatus() {
        return this.status;
    }
    /**
     * 延遲函數 (輔助方法)
     * @param ms
     * @returns
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 尋找專案的根目錄
     * @param maxAttempts
     * @returns 專案的根目錄的絕對路徑
     * @throws 找不到目錄時拋出錯誤
     */
    findProjectRoot(maxAttempts = 5) {
        let currentDir = __dirname;
        let attempts = 0;
        while (attempts < maxAttempts) {
            const backendPath = path.join(currentDir, 'backend');
            const frontendPath = path.join(currentDir, 'frontend');
            const isDirectory = (p) => fs.existsSync(p) && fs.lstatSync(p).isDirectory();
            // 檢查 backend 和 frontend 目錄是否存在且為目錄
            if (isDirectory(backendPath) && isDirectory(frontendPath))
                return currentDir;
            // 測試是否已到達根目錄
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) // 已到達根目錄 (C:/ or /)
                break;
            currentDir = parentDir; // 往上一層
            attempts++;
        }
        throw new Error("無法獲取專案後端 backend 目錄");
    }
    /**
     * 設定子進程的監聽器
     * @note 如果子進程不存在 則不設置監聽器
     */
    setupProcessListeners() {
        if (!this.process)
            return;
        // 監聽子進程啟動錯誤
        this.process.on('error', (err) => {
            console.error('[ERROR] 子進程啟動失敗:', err.message);
            this.status = server_js_1.ServerProcessStatus.ERROR;
            this.process = null;
        });
        // 監聽子進程退出事件
        this.process.on('exit', (code) => {
            if (code === 0 || code === null) {
                this.status = server_js_1.ServerProcessStatus.STOPPED;
                console.log("[INFO] 後端伺服器已正常停止");
            }
            else {
                this.status = server_js_1.ServerProcessStatus.ERROR;
                console.error(`[ERROR] 後端伺服器異常退出, 代碼: ${code}`);
            }
            this.process = null; // 清除子進程引用
        });
        // 監聽子進程的輸出訊息
        this.process.stdout?.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[Flask] ${message}`);
        });
        // 監聽子進程的錯誤訊息
        this.process.stderr?.on('data', (data) => {
            const message = data.toString().trim();
            console.error(`[Flask Error] ${message}`);
        });
    }
    /**
     * 等待伺服器準備就緒
     * @param timeout
     * @param debug
     * @returns boolean 伺服器是否在超時前就緒
     */
    async waitForReady(timeout, debug) {
        let attempts = 0;
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if (this.status === server_js_1.ServerProcessStatus.ERROR) {
                console.error("[ERROR] 伺服器啟動失敗");
                return false;
            }
            attempts++;
            if (debug)
                console.log(`[DEBUG] 等待伺服器就緒... (嘗試第 ${attempts} 次)`);
            try {
                const respond = await api_client_js_1.apiClient.checkSystemHealth();
                if (respond.success)
                    return true;
            }
            catch (error) {
                // 忽略錯誤 繼續重試
            }
            await this.sleep(1000); // 每1000ms檢查一次
        }
        return false;
    }
    /**
     * 啟動後端伺服器
     * @param options
     * @returns boolean 是否成功啟動
     * @note 如果伺服器已在運行中 則不進行處理 直接返回 true
     */
    async startServer(options = {}) {
        const { port = this.defaultPort, timeout = this.defaultTimeout, debug = false } = options;
        if (this.isRunning()) {
            console.warn("[WARNING] 後端伺服器正在運行中, 無法重複啟動");
            return true;
        }
        // 更新狀態為啟動中
        this.status = server_js_1.ServerProcessStatus.STARTING;
        try {
            const projectRoot = this.findProjectRoot();
            const apiScriptPath = path.join(projectRoot, 'backend', 'api', 'api.py');
            if (debug)
                console.log("[INFO] 專案根目錄:", projectRoot, ", API 伺服器路徑:", apiScriptPath);
            // 啟動Flask伺服器的子進程
            // Windows: 使用 windowsHide 隱藏控制台視窗
            this.process = (0, child_process_1.spawn)('uv', ['run', apiScriptPath], {
                cwd: projectRoot,
                env: {
                    ...process.env,
                    FLASK_PORT: port.toString(), // Flask 伺服器埠號
                    FLASK_DEBUG: debug.toString(), // Flask 除錯模式
                    PYTHONUNBUFFERED: '1', // 確保即時輸出日誌
                    PYTHONIOENCODING: 'utf-8' // 確保輸出為 UTF-8 編碼
                },
                // Windows 專用選項：隱藏控制台視窗
                shell: false,
                windowsHide: true
            });
            this.setupProcessListeners();
            // 等待伺服器開啟
            const ready = await this.waitForReady(timeout, debug);
            if (!ready) {
                this.status = server_js_1.ServerProcessStatus.ERROR;
                throw new Error("[ERROR] 後端伺服器啟動出現錯誤或超時");
            }
            this.status = server_js_1.ServerProcessStatus.RUNNING;
            console.log("[INFO] 後端伺服器已啟動並運行中");
            return true;
        }
        catch (error) {
            this.status = server_js_1.ServerProcessStatus.ERROR;
            console.error("[ERROR] 啟動後端伺服器失敗:", error);
            // 確保子進程被終止
            if (this.process) {
                this.process.kill();
                this.process = null;
            }
            return false;
        }
    }
    /**
     * 停止後端伺服器
     * @returns boolean 是否成功停止
     * @note 如果伺服器未在運行中 則不進行處理 直接返回 false
     */
    stopServer() {
        if (!this.isRunning()) {
            console.warn("[WARNING] 後端伺服器未在運行中, 無法停止");
            return false;
        }
        console.log("[INFO] 正在停止後端伺服器...");
        if (!this.process) {
            this.status = server_js_1.ServerProcessStatus.STOPPED;
            return false;
        }
        try {
            // Windows 專用：使用 taskkill 終止整個進程樹
            if (process.platform === 'win32') {
                const pid = this.process.pid;
                if (pid) {
                    // 使用 taskkill /F /T /PID 來強制終止進程及其所有子進程
                    // /F = 強制終止, /T = 終止子進程樹, /PID = 指定進程ID
                    (0, child_process_1.execSync)(`taskkill /F /T /PID ${pid}`, {
                        windowsHide: true,
                        stdio: 'ignore' // 忽略輸出
                    });
                    console.log(`[INFO] 已使用 taskkill 終止進程樹 (PID: ${pid})`);
                }
            }
            else {
                // Unix/Linux/Mac: 使用 SIGTERM 優雅終止
                this.process.kill('SIGTERM');
                // 如果 2 秒後還沒終止，使用 SIGKILL 強制終止
                setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        this.process.kill('SIGKILL');
                        console.log('[INFO] 使用 SIGKILL 強制終止進程');
                    }
                }, 2000);
            }
        }
        catch (error) {
            console.error('[ERROR] 終止進程時發生錯誤:', error);
            // 即使發生錯誤，也嘗試清理狀態
        }
        finally {
            this.process = null;
            this.status = server_js_1.ServerProcessStatus.STOPPED;
        }
        return true;
    }
}
exports.serverManager = new ServerManager();
