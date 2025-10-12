/**
 * 統一定義所有後端的回傳介面
 */
/**
 * @function PDFHelperAPI的統一回傳格式
 * @description 參照backend/api/pdf_helper.py
 */
export interface HelperResult<T> {
    success: boolean;
    message: string;
    data?: T;
}
/**
 * @function 經過MinerU處理後的回傳格式
 * @description 參照backend/api/pdf_helper.py/process_pdf_to_json
 */
export interface ProcessPDFData {
    output_path?: string;
    output_file_paths?: {
        markdown: string;
        json: string;
        images: string[];
    };
    processing_time?: number;
    stdout?: string;
    error: string;
    returncode?: number;
}
/**
 * @function LLM服務回傳的翻譯結果格式
 * @description 參照backend/api/pdf_helper.py/translate_json_content
 */
export interface TranslateJSONContentData {
    translated_file_path: string;
}
/**
 * @function 資料加入向量資料庫的回傳格式
 * @description 參照backend/api/pdf_helper.py/add_json_to_rag
 */
export interface AddJSONToRAGData {
    collection_name: string;
}
/**
 * @function 向RAG系統查詢問題的回傳格式
 * @description 參照backend/api/pdf_helper.py/ask_question
 */
export interface AskQuestionData {
    answer: string;
    sources?: Array<{
        chunk_id: string;
        content: string;
        document_name: string;
        page_num?: number;
        score: number;
    }>;
}
/**
 * @function Markdown重組回傳結果格式
 * @description 參照backend/api/pdf_helper.py/restructure_markdown
 */
export interface ReconstructMarkdownData {
    markdown_path: string;
}
/**
 * @function 取得目前PDFHelper系統狀態的回傳格式
 * @description 參照backend/api/pdf_helper.py/get_system_health
 */
export interface GetSystemHealthData {
    pdf_processor: boolean;
    translator: boolean;
    rag_engine: RAGSystemInfo_Data;
}
/**
 * @function RAG引擎的系統資訊格式
 * @description 參照backend/services/rag_service/rag_engine.py/get_system_info
 */
export interface RAGSystemInfo_Data {
    vector_store_info: {
        collection_name: string;
        document_count: number;
        distance_metric: string;
        persist_directory: string;
    };
    embedding_model: string;
    llm_service: string;
    document_processor: {
        min_chunk_size: number;
        max_chunk_size: number;
        merge_short_chunks: boolean;
    };
}
/**
 * @function 取得非同步完整處理進度的回傳格式
 * @description 參照backend/api/api.py/current_progress
 * @note result 包含 collection_name (RAG集合名稱) 和 translated_json_name (翻譯後的JSON檔案名稱)
 */
export interface GetProgressResult {
    is_processing: boolean;
    progress: number;
    stage: "idle" | "process-pdf" | "translating-json" | "adding-to-rag";
    message: string;
    error?: string | null;
    result?: Record<string, any> | null;
}
export type ProcessPDFResult = HelperResult<ProcessPDFData>;
export type TranslateJSONContentResult = HelperResult<TranslateJSONContentData>;
export type AddJSONToRAGResult = HelperResult<AddJSONToRAGData>;
export type AskQuestionResult = HelperResult<AskQuestionData>;
export type ReconstructMarkdownResult = HelperResult<ReconstructMarkdownData>;
export type GetSystemHealthResult = HelperResult<GetSystemHealthData>;
