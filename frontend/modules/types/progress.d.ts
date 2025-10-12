/**
 * 進度階段相關型別定義
 */
/**
 * 進度階段字串聯合型別
 *
 * @description 定義後端 API 可能返回的進度階段值, 可讓前端驗證回傳值是否合法
 */
export type ProgressStage = "idle" | "processing-pdf" | "translating-json" | "adding-to-rag";
/**
 * 進度階段常數 (用於比較和避免拼字錯誤)
 */
export declare const ProgressStages: {
    readonly IDLE: "idle";
    readonly PROCESSING_PDF: "processing-pdf";
    readonly TRANSLATING_JSON: "translating-json";
    readonly ADDING_TO_RAG: "adding-to-rag";
};
/**
 * 進度階段中文名稱映射型別 (用於提示翻譯對照表)
 */
export type ProgressStageNames = {
    [K in ProgressStage]: string;
};
