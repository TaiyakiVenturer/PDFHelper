import { ServerOptions, ServerProcessStatus } from "../types/server.js";
/**
 * Backend API Server 管理服務
 *
 * @description 負責啟動與管理後端 API 伺服器的生命週期
 */
declare class ServerManager {
    private process;
    private status;
    private readonly defaultPort;
    private readonly defaultTimeout;
    constructor();
    /**
     * 檢查伺服器是否正在運行
     * @returns boolean 是否運行
     */
    isRunning(): boolean;
    /**
     * 獲取當前伺服器狀態
     * @returns ServerProcessStatus
    */
    getStatus(): ServerProcessStatus;
    /**
     * 延遲函數 (輔助方法)
     * @param ms
     * @returns
     */
    private sleep;
    /**
     * 尋找專案的根目錄
     * @param maxAttempts
     * @returns 專案的根目錄的絕對路徑
     * @throws 找不到目錄時拋出錯誤
     */
    private findProjectRoot;
    /**
     * 設定子進程的監聽器
     * @note 如果子進程不存在 則不設置監聽器
     */
    private setupProcessListeners;
    /**
     * 等待伺服器準備就緒
     * @param timeout
     * @param debug
     * @returns boolean 伺服器是否在超時前就緒
     */
    private waitForReady;
    /**
     * 啟動後端伺服器
     * @param options
     * @returns boolean 是否成功啟動
     * @note 如果伺服器已在運行中 則不進行處理 直接返回 true
     */
    startServer(options?: ServerOptions): Promise<boolean>;
    /**
     * 停止後端伺服器
     * @returns boolean 是否成功停止
     * @note 如果伺服器未在運行中 則不進行處理 直接返回 false
     */
    stopServer(): boolean;
}
export declare const serverManager: ServerManager;
export {};
