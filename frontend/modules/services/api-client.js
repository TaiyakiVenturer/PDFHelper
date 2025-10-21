"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
const config_1 = require("./config");
/**
 * PDFHelper API Client
 *
 * @description 提供與後端 Flask API 的完整對接功能
 * @note 方法參數使用 snake_case 與後端 Python API 保持一致,便於對照維護
 */
class APIClient {
    constructor() {
        this.baseURL = config_1.API_CONFIG.BASE_URL;
        this.requestTimeout = config_1.API_CONFIG.TIMEOUT;
    }
    async request(endpoint, options = {}, showError = true) {
        // 創建超時控制器
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        try {
            // 發送POST請求 並接上超時控制器的控制
            const response = await fetch(`${this.baseURL}/${endpoint}`, {
                ...options, // 包含 method, headers, body 等
                signal: controller.signal
            });
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.message)
                        errorMsg = errorData.message;
                }
                catch (error) {
                    // 無法解析JSON錯誤訊息，保持原有錯誤訊息
                }
                throw new Error(errorMsg);
            }
            // 等待response的JSON資料
            const data = await response.json();
            return data;
        }
        catch (error) {
            if (showError)
                console.error("API request error:", error);
            // 確認error是Error類型 再檢查哪一種Error類型
            if (!(error instanceof Error))
                throw new Error("Unknown error occurred");
            else if (error.name === 'AbortError')
                throw new Error("Request timed out");
            else
                throw error;
        }
        finally {
            // 清除超時計時器
            clearTimeout(timeoutId);
        }
    }
    // ==================== API 方法 ====================
    /**
     * 使用 MinerU 處理 PDF 並輸出 JSON
     * @param pdf_name - PDF 檔案名稱
     * @param method - 解析方法 (auto/txt/ocr)
     * @param lang - 語言設定 (預設: en)
     * @param device - 計算設備 (cuda/cpu)
     * @returns Promise<ProcessPDFResult>
     */
    async processPDF(pdf_name, method = "auto", lang = "en", device = "cpu") {
        return this.request(config_1.API_ENDPOINTS.PROCESS_PDF, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                pdf_name: pdf_name,
                method: method,
                lang: lang,
                device: device
            })
        });
    }
    /**
     * 翻譯 JSON 內容
     * @param json_path - JSON 檔案路徑
     * @returns Promise<TranslateJSONContentResult>
     */
    async translateJSONContent(json_path) {
        return this.request(config_1.API_ENDPOINTS.TRANSLATE_JSON, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ json_path: json_path })
        });
    }
    /**
     * 將 JSON 加入 RAG 向量資料庫
     * @param json_name - JSON 檔案名稱
     * @returns Promise<AddJSONToRAGResult>
     */
    async addJSONToRAG(json_name) {
        return this.request(config_1.API_ENDPOINTS.ADD_TO_RAG, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ json_name: json_name })
        });
    }
    /**
     * 向 RAG 系統提問
     * @param question - 問題內容
     * @param document_name - 文件名稱
     * @param top_k - 檢索相關文件數量 (預設: 10)
     * @param include_sources - 是否包含來源文件 (預設: true)
     * @returns Promise<AskQuestionResult>
     */
    async askQuestion(question, document_name, top_k = 10, include_sources = true) {
        return this.request(config_1.API_ENDPOINTS.ASK_QUESTION, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: question,
                document_name: document_name,
                top_k: top_k,
                include_sources: include_sources
            })
        });
    }
    /**
     * 重組 Markdown 文件
     * @param json_name - 翻譯後的Json檔案名稱含副檔名 (例如: `example_translated.json`)
     * @param method - 解析方法 (auto/txt/ocr)
     * @param lang - 語言設定 (預設: zh)
     * @returns Promise<ReconstructMarkdownResult>
     */
    async reconstructMarkdown(json_name, method, lang) {
        return this.request(config_1.API_ENDPOINTS.RECONSTRUCT_MARKDOWN, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                json_name: json_name,
                method: method,
                lang: lang
            })
        });
    }
    /**
     * 獲取系統健康狀態
     * @param showError - 是否顯示錯誤訊息
     * @returns Promise<GetSystemHealthResult>
     */
    async checkSystemHealth(showError = true) {
        return this.request(config_1.API_ENDPOINTS.SYSTEM_HEALTH, { method: "GET" }, showError);
    }
    /**
     * 非同步完整處理流程 (上傳 PDF -> 處理 PDF -> 翻譯 JSON -> 加入 RAG)
     * @param pdf_name - PDF 檔案名稱
     * @param method - 解析方法 (auto/txt/ocr)
     * @param lang - 語言設定 (預設: en)
     * @param device - 計算設備 (cuda/cpu)
     * @returns Promise<{ success: boolean; message: string; }>
     * @note 此方法會觸發後端的非同步任務, 前端應定期調用 getProcessingProgress 以獲取進度
     */
    async startFullProcessAsync(pdf_name, method, lang = "en") {
        return this.request(config_1.API_ENDPOINTS.FULL_PROCESS, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                pdf_name: pdf_name,
                method: method,
                lang: lang
            })
        });
    }
    /**
     * 請求目前處理進度
     * @returns Promise<GetProgressResult>
     */
    async getProcessingProgress() {
        return this.request(config_1.API_ENDPOINTS.GET_PROGRESS, { method: "GET" });
    }
    /**
     * 重置處理進度 (停止當前任務並重置狀態)
     * @returns Promise<HelperResult<null>>
     */
    async resetProcess() {
        return this.request(config_1.API_ENDPOINTS.RESET_PROCESS, { method: "POST" });
    }
    /**
     * 更新 LLM 服務的 API Key
     * @param service
     * @param provider
     * @param model_name
     * @param api_key
     * @returns Promise<HelperResult<null>>
     */
    async updateAPIKey(service, provider, api_key, model_name) {
        return this.request(config_1.API_ENDPOINTS.UPDATE_API_KEY, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                service: service,
                provider: provider,
                api_key: api_key,
                model_name: model_name
            })
        });
    }
    /**
     * 移除 PDFHelper 儲存的檔案及資料
     * @param target - 要移除的檔案名稱 (不含路徑)
     * @returns Promise<HelperResult<null>>
     */
    async removeFile(target) {
        return this.request(config_1.API_ENDPOINTS.REMOVE_FILE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                file_name: target
            })
        });
    }
}
exports.apiClient = new APIClient();
