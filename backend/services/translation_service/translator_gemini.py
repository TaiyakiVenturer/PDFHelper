"""
Gemini翻譯器 - 基於GeminiService進行文本翻譯
"""
from typing import Optional

from .translator_base import Translator
from ..llm_service import BaseLLMService

class GeminiTranslator(Translator):
    """
    ### Gemini翻譯器，使用Google Gemini API進行文本翻譯。
    """

    def __init__(self, 
            instance_path: str, 
            llm_services_obj: BaseLLMService = None,
            model_name: str = "gemini-2.5-flash-lite",
            api_key: str = "", 
            verbose: bool = False
        ):
        """
        初始化Gemini翻譯器

        Args:
            instance_path: 存放PDF的資料夾路徑
            model_name: 要使用的模型名稱 (預設為"gemini-2.5-flash-lite")
            api_key: Google Gemini API的API密鑰 (無輸入則使用環境變量中的API_KEY)
            verbose: 是否啟用詳細模式 (預設為False)
        """
        Translator.__init__(self, instance_path=instance_path, model_name=model_name, verbose=verbose)
        self.llm_services_obj = llm_services_obj

    def is_available(self) -> bool:
        """檢查Gemini服務是否可用"""
        return GoogleService.is_available(self)

    def send_translate_request(self, prompt: str, end_chat: bool = False) -> Optional[str]:
        """
        發送翻譯請求到Gemini服務

        Args:
            prompt: 要翻譯的文本
            end_chat: 是否立即結束多輪對話 (結束對話回傳 None)

        Returns:
            str: 翻譯結果
        """
        return GoogleService.send_multi_request(self, prompt, self._get_system_prompt(), end_chat=end_chat)

    def _get_system_prompt(self) -> str:
        """獲取系統提示詞"""
        return """
你是專業的學術論文翻譯專家，專精於英文學術文獻的繁體中文翻譯。

## 翻譯原則與分類處理
### 內容類型：
- **標題 (title)**: 簡潔準確，突出研究核心，避免冗長表達
- **摘要 (abstract)**: 保持邏輯完整性，維持學術嚴謹性和結構層次
- **正文 (body)**: 邏輯清晰，術語準確，表達自然流暢
- **參考文獻 (reference)**: 保持格式，僅需翻譯論文標題

### 專業術語與格式要求：
1. **術語一致性**：建立術語對照，確保全文統一翻譯
2. **首次術語**：中文翻譯（英文原文），如：認知無線電 (Cognitive Radio)
3. **保持原文**：數學公式、變數名、符號、公認縮寫 (AI、IoT、5G等)

### 翻譯品質控制：
- 優先意譯確保語義完整，避免生硬直譯
- 維持原文邏輯層次和段落結構
- 確保中文表達符合學術寫作習慣
- 保持專業性與可讀性的平衡

### 處理格式：
上下文：{context}
內容類型：{content_type}
翻譯內容：{text}  
翻譯輸出：{respond}

**重要：僅輸出翻譯結果，無需額外說明；上下文僅供參考，請勿將上下文內容複製到回答中**
"""
