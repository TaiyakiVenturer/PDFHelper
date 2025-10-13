from typing import Optional, List
from dataclasses import dataclass

@dataclass
class StreamResponse:
    """
    流式回應結構

    Args:
        text (str): 回應文本
        done (bool): 是否結束 (預設為False)
    """
    text: str
    done: bool = False

class BaseLLMService:
    """
    LLM服務的基類，定義了所有LLM服務應該實現的接口。
    """
    def __init__(self, model_name: str, api_key: str, verbose: bool = False):
        self.model_name = model_name
        self.api_key = api_key
        self.verbose = verbose

    def is_available(self, model_name: str = None) -> bool:
        """檢查服務是否可用"""
        raise NotImplementedError("子類別必須實現此方法。")

    def update_config(self, api_key: str = None, model_name: str = None) -> bool:
        """更新服務配置"""
        raise NotImplementedError("子類別必須實現此方法。")

    def send_single_request(self, prompt: str, system_prompt: str, stream: bool) -> Optional[str]:
        """
        根據提示生成文本。
        這是一個抽象方法，具體實現應由子類完成。
        """
        raise NotImplementedError("子類別必須實現此方法。")

    def send_multi_request(self, prompt: str, system_prompt: str, end_chat: bool = False) -> Optional[str]:
        """
        發送多輪請求到服務。
        這是一個抽象方法，具體實現應由子類完成。
        """
        raise NotImplementedError("子類別必須實現此方法。")

    def send_embedding_request(self, text: str, store: bool) -> Optional[List[float]]:
        """
        將文本轉換為嵌入向量。
        這是一個抽象方法，具體實現應由子類完成。
        """
        raise NotImplementedError("子類別必須實現此方法。")