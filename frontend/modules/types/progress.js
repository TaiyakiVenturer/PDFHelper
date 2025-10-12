"use strict";
/**
 * 進度階段相關型別定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressStages = void 0;
/**
 * 進度階段常數 (用於比較和避免拼字錯誤)
 */
exports.ProgressStages = {
    IDLE: "idle",
    PROCESSING_PDF: "processing-pdf",
    TRANSLATING_JSON: "translating-json",
    ADDING_TO_RAG: "adding-to-rag"
};
