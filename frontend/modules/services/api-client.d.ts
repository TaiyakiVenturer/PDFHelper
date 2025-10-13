import { ProcessPDFResult, TranslateJSONContentResult, AddJSONToRAGResult, AskQuestionResult, ReconstructMarkdownResult, GetSystemHealthResult, GetProgressResult, HelperResult } from "../types/results";
/**
 * PDFHelper API Client
 *
 * @description 提供與後端 Flask API 的完整對接功能
 * @note 方法參數使用 snake_case 與後端 Python API 保持一致,便於對照維護
 */
declare class APIClient {
    private baseURL;
    private requestTimeout;
    constructor();
    private request;
    /**
     * 使用 MinerU 處理 PDF 並輸出 JSON
     * @param pdf_name - PDF 檔案名稱
     * @param method - 解析方法 (auto/txt/ocr)
     * @param lang - 語言設定 (預設: en)
     * @param device - 計算設備 (cuda/cpu)
     * @returns Promise<ProcessPDFResult>
     */
    processPDF(pdf_name: string, method?: "auto" | "txt" | "ocr", lang?: string, device?: "cuda" | "cpu"): Promise<ProcessPDFResult>;
    /**
     * 翻譯 JSON 內容
     * @param json_path - JSON 檔案路徑
     * @returns Promise<TranslateJSONContentResult>
     */
    translateJSONContent(json_path: string): Promise<TranslateJSONContentResult>;
    /**
     * 將 JSON 加入 RAG 向量資料庫
     * @param json_name - JSON 檔案名稱
     * @returns Promise<AddJSONToRAGResult>
     */
    addJSONToRAG(json_name: string): Promise<AddJSONToRAGResult>;
    /**
     * 向 RAG 系統提問
     * @param question - 問題內容
     * @param document_name - 文件名稱
     * @param top_k - 檢索相關文件數量 (預設: 10)
     * @param include_sources - 是否包含來源文件 (預設: true)
     * @returns Promise<AskQuestionResult>
     */
    askQuestion(question: string, document_name: string, top_k?: number, include_sources?: boolean): Promise<AskQuestionResult>;
    /**
     * 重組 Markdown 文件
     * @param json_name - 翻譯後的Json檔案名稱含副檔名 (例如: `example_translated.json`)
     * @param method - 解析方法 (auto/txt/ocr)
     * @param lang - 語言設定 (預設: zh)
     * @returns Promise<ReconstructMarkdownResult>
     */
    reconstructMarkdown(json_name: string, method: "auto" | "txt" | "ocr", lang: "zh" | "en"): Promise<ReconstructMarkdownResult>;
    /**
     * 獲取系統健康狀態
     * @returns Promise<GetSystemHealthResult>
     */
    checkSystemHealth(): Promise<GetSystemHealthResult>;
    /**
     * 非同步完整處理流程 (上傳 PDF -> 處理 PDF -> 翻譯 JSON -> 加入 RAG)
     * @param pdf_name - PDF 檔案名稱
     * @param method - 解析方法 (auto/txt/ocr)
     * @param lang - 語言設定 (預設: en)
     * @param device - 計算設備 (cuda/cpu)
     * @returns Promise<{ success: boolean; message: string; }>
     * @note 此方法會觸發後端的非同步任務, 前端應定期調用 getProcessingProgress 以獲取進度
     */
    startFullProcessAsync(pdf_name: string, method: "auto" | "txt" | "ocr", lang?: string, device?: "cuda" | "cpu"): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * 請求目前處理進度
     * @returns Promise<GetProgressResult>
     */
    getProcessingProgress(): Promise<GetProgressResult>;
    /**
     * 重置處理進度 (停止當前任務並重置狀態)
     * @returns Promise<HelperResult<null>>
     */
    resetProcess(): Promise<HelperResult<null>>;
    /**
     * 更新 LLM 服務的 API Key
     * @param service
     * @param provider
     * @param model_name
     * @param api_key
     * @returns Promise<HelperResult<null>>
     */
    updateAPIKey(service: "translator" | "embedding" | "rag", provider: "ollama" | "google" | "openai", api_key: string, model_name: string): Promise<HelperResult<null>>;
}
export declare const apiClient: APIClient;
export {};
