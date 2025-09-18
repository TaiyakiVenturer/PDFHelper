"""
Ollama翻譯器 - 基於OllamaService進行文本翻譯
"""
from typing import Optional

from .translator_base import TranslatorBase
from ..llm_service import OllamaService

class OllamaTranslator(TranslatorBase, OllamaService):
    """
    ### 基於Ollama的本地學術論文翻譯器
    """

    def __init__(self,
            instance_path: str,
            model_name: str = "TranslateHelper",  # 預設使用自定義模型
            verbose: bool = False
        ):
        """
        初始化Ollama翻譯器
        
        Args:
            instance_path: 存放PDF的資料夾路徑
            model_name: 使用的模型名稱 (建議使用自定義的TranslateHelper模型)
            verbose: 是否顯示詳細日誌
        """
        TranslatorBase.__init__(self, instance_path=instance_path, model_name=model_name, verbose=verbose)
        OllamaService.__init__(self, model_name=model_name, model_uses="translate", verbose=verbose)

    def is_available(self) -> bool:
        """檢查Ollama服務是否可用"""
        return OllamaService.is_available(self)

    def send_translate_request(self, prompt: str, end_chat: bool = False) -> Optional[str]:
        """
        發送翻譯請求到Ollama服務

        Args:
            prompt: 要翻譯的文本
            end_chat: 是否結束對話 (預設為False)

        Returns:
            翻譯後的文本
        """
        return OllamaService.send_multi_request(self, prompt, end_chat=end_chat)
