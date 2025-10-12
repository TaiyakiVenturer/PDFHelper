/**
 * 定義伺服器相關的類型
 */
/**
 * 伺服器選項
 *
 * port: 伺服器監聽的端口號，預設為 30000
 * timeout: 伺服器啟動的超時時間（毫秒），預設為 10000 毫秒（10 秒）
 * debug: 是否啟用除錯模式，預設為 false
 */
export interface ServerOptions {
    port?: number;
    timeout?: number;
    debug?: boolean;
}
/**
 * 伺服器進程狀態
 */
export declare enum ServerProcessStatus {
    STARTING = "starting",// 正在啟動
    RUNNING = "running",// 正在運行
    ERROR = "error",// 出錯了
    STOPPED = "stopped"
}
