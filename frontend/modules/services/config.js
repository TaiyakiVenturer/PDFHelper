"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_STATUS_NAMES = exports.ProgressStages = exports.PROGRESS_STAGE_NAMES = exports.LANGUAGE_MAP = exports.API_ENDPOINTS = exports.API_CONFIG = void 0;
/**
 * API 伺服器配置
 *
 * @description 定義與後端 API 伺服器相關的配置參數
 */
exports.API_CONFIG = {
    HOST: "localhost",
    PORT: 13635,
    TIMEOUT: 30000,
    get BASE_URL() {
        return `http://${this.HOST}:${this.PORT}`;
    }
};
/**
 * API 端點定義
 *
 * @description 定義所有與後端 API 伺服器交互的端點路徑
 */
exports.API_ENDPOINTS = {
    PROCESS_PDF: "api/process-pdf",
    TRANSLATE_JSON: "api/translate-json",
    ADD_TO_RAG: "api/add-to-rag",
    ASK_QUESTION: "api/ask-question",
    RECONSTRUCT_MARKDOWN: "api/reconstruct-markdown",
    SYSTEM_HEALTH: "api/system-health",
    RESET_PROCESS: "api/reset-process",
    UPDATE_API_KEY: "api/update-api-key",
    FULL_PROCESS: "api/full-process-async",
    GET_PROGRESS: "api/get-progress",
    REMOVE_FILE: "api/remove-file"
};
/**
 * 語言對應表
 */
exports.LANGUAGE_MAP = {
    "ch": "簡體中文",
    "chinese_cht": "繁體中文",
    "en": "英文",
    "korean": "韓文",
    "japan": "日文",
    "th": "泰文",
    "el": "希臘文",
    "latin": "拉丁文",
    "arabic": "阿拉伯文",
    "east_slavic": "俄文 (烏克蘭文)",
    "devanagari": "印度文 (尼泊爾文)"
};
const progress_js_1 = require("../types/progress.js");
/**
 * 用於翻譯進度階段名稱
 */
exports.PROGRESS_STAGE_NAMES = {
    [progress_js_1.ProgressStages.IDLE]: "閒置",
    [progress_js_1.ProgressStages.PROCESSING_PDF]: "處理 PDF",
    [progress_js_1.ProgressStages.TRANSLATING_JSON]: "翻譯 JSON",
    [progress_js_1.ProgressStages.ADDING_TO_RAG]: "加入 RAG 資料庫"
};
// 重新導出以便使用
var progress_js_2 = require("../types/progress.js");
Object.defineProperty(exports, "ProgressStages", { enumerable: true, get: function () { return progress_js_2.ProgressStages; } });
const server_js_1 = require("../types/server.js");
/**
 * 用於翻譯伺服器狀態名稱
 */
exports.SERVER_STATUS_NAMES = {
    [server_js_1.ServerProcessStatus.STOPPED]: "已停止",
    [server_js_1.ServerProcessStatus.STARTING]: "啟動中",
    [server_js_1.ServerProcessStatus.RUNNING]: "運行中",
    [server_js_1.ServerProcessStatus.ERROR]: "錯誤"
};
