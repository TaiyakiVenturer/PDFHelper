/**
 * API 伺服器配置
 *
 * @description 定義與後端 API 伺服器相關的配置參數
 */
export declare const API_CONFIG: {
    HOST: string;
    PORT: number;
    TIMEOUT: number;
    readonly BASE_URL: string;
};
/**
 * API 端點定義
 *
 * @description 定義所有與後端 API 伺服器交互的端點路徑
 */
export declare const API_ENDPOINTS: {
    readonly PROCESS_PDF: "api/process-pdf";
    readonly TRANSLATE_JSON: "api/translate-json";
    readonly ADD_TO_RAG: "api/add-to-rag";
    readonly ASK_QUESTION: "api/ask-question";
    readonly RECONSTRUCT_MARKDOWN: "api/reconstruct-markdown";
    readonly SYSTEM_HEALTH: "api/system-health";
    readonly RESET_PROCESS: "api/reset-process";
    readonly UPDATE_API_KEY: "api/update-api-key";
    readonly FULL_PROCESS: "api/full-process-async";
    readonly GET_PROGRESS: "api/get-progress";
};
import { type ProgressStageNames } from "../types/progress.js";
/**
 * 用於翻譯進度階段名稱
 */
export declare const PROGRESS_STAGE_NAMES: ProgressStageNames;
export { ProgressStages, type ProgressStage } from "../types/progress.js";
/**
 * 用於翻譯伺服器狀態名稱
 */
export declare const SERVER_STATUS_NAMES: {
    stopped: string;
    starting: string;
    running: string;
    error: string;
};
