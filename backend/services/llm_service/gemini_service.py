from google import genai
from google.genai import types
import time
from typing import Optional, List

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class GeminiService():
    """
    ### Gemini服務基類，使用Google Gemini API進行文本處理。
    """

    def __init__(self, 
            model_name: str,
            api_key: str = None, 
            verbose: bool = False
        ):
        """
        初始化Gemini服務

        Args:
            model_name: 要使用的模型名稱
            api_key: Google Gemini API的API密鑰 (無輸入則使用環境變量中的API_KEY)
            verbose: 是否啟用詳細模式 (預設為False)
        """
        print("[DEBUG] API Key:", api_key)
        self.client = None
        self.model_name = model_name
        self.verbose = verbose

        if self.update_config(api_key=api_key, model_name=model_name):
            if self.verbose:
                logger.info(f"Gemini服務使用模型: {self.model_name}")
        else:
            logger.error("Gemini服務初始化失敗, 請在輸入 API Key 和模型名稱後重試")

        self._in_multi_turn = False  # 是否處於多輪對話中
        self._chat_object = None     # 多輪對話物件

        if self.verbose:
            logger.info("Gemini服務初始化完成")

    def is_available(self, model_name: str = None) -> bool:
        """檢查Gemini服務是否可用"""
        if not self.client:
            logger.warning(f"服務未初始化, 還不可用")
        try:
            # 使用當前實例的模型名稱進行檢查，而非硬編碼模型名稱
            response = self.client.models.get(model=model_name or self.model_name)
            if response:
                if self.verbose:
                    logger.info("Gemini服務可用")
                return True
            else:
                logger.warning(f"Gemini服務不可用: 模型 {self.model_name} 不存在或無法訪問")
                return False
        except Exception as e:
            logger.error(f"檢查Gemini服務可用性時出錯: {e}")
            return False

    def update_config(self, api_key: str, model_name: str) -> bool:
        """動態更新API密鑰和模型名稱"""
        try:
            # 創建新的 client 並測試
            new_client = genai.Client(api_key=api_key)
            
            # 用新 client 測試模型是否可用
            response = new_client.models.get(model=model_name)
            
            if response:
                # 測試成功，更新配置
                self.client = new_client
                self.model_name = model_name
                if self.verbose:
                    logger.info(f"Gemini服務配置更新成功: 模型 {self.model_name}")
                return True
            else:
                logger.warning(f"無法更新Gemini服務配置，模型 {model_name} 不存在或無法訪問")
                return False
                
        except Exception as e:
            logger.error(f"更新Gemini服務配置時出錯: {e}")
            return False

    def send_single_request(self, prompt: str, system_prompt: Optional[str] = None, stream: bool = False) -> Optional[str]:
        """
        發送請求到Gemini服務

        Args:
            prompt: 要發送的文本
            system_prompt: 系統提示文本
            stream: 是否使用流式回應

        Returns:
            str: 模型回覆的文本
        """
        if not self.is_available():
            logger.warning("Gemini服務不可用，無法發送請求")
            return None
        else:
            if self.verbose:
                logger.info(f"發送請求到Gemini服務，模型: {self.model_name}, 流式: {stream}")

        try:
            if stream:
                response = self.client.models.generate_content_stream(
                    model=self.model_name, 
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        top_p=0.8,
                        top_k=30,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                        system_instruction=system_prompt
                    )
                )
                return response
            else:
                response = self.client.models.generate_content(
                    model=self.model_name, 
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.2,
                        top_p=0.8,
                        top_k=30,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                        system_instruction=system_prompt
                    )
                )

                if response.status_code == 200:
                    return response.text
                elif response.status_code == 429:
                    logger.warning("請求過多，請稍後再試")
                    time.sleep(3)  # 簡單的重試機制，等待3秒
                else:
                    logger.error(f"請求失敗: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            logger.error(f"Gemini請求執行時出錯: {e}")
            return None

    def send_multi_request(self, prompt: str, system_prompt: str, end_chat: bool = False) -> Optional[str]:
        """
        發送多輪請求到Gemini服務

        Args:
            prompt: 要發送的文本
            system_prompt: 系統提示文本
            end_chat: 是否立即結束多輪對話 (結束對話回傳 None)

        Returns:
            str: 模型回覆的文本
        """
        if not self.is_available():
            logger.warning("Gemini服務不可用，無法發送多輪請求")
            return None
        else:
            if self.verbose:
                logger.info(f"發送多輪請求到Gemini服務，模型: {self.model_name}")

        # 結束多輪對話
        if end_chat:
            if self.verbose:
                logger.info("結束多輪對話")
            self._in_multi_turn = False
            self._chat_object = None
            return None

        if not self._in_multi_turn:
            self._chat_object = self.client.chats.create(
                model=self.model_name,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    top_p=0.8,
                    top_k=30,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    system_instruction=system_prompt
                )
            )
            self._in_multi_turn = True
            if self.verbose:
                logger.info("初始化多輪對話物件")

        response = self._chat_object.send_message(prompt)
        if response:
            return response.text
        else:
            logger.error("多輪請求失敗")
            return None

    def send_embedding_request(self, text: str, store: bool) -> Optional[List[float]]:
        """
        發送embedding請求到Gemini服務

        Args:
            text: 需要向量化的字串
            store: 是否為存儲用途 True: 存儲, False: 搜索

        Returns:
            list: 向量化結果 (若失敗則返回None)
        """
        if not self.is_available():
            logger.warning("Gemini服務不可用，無法發送embedding請求")
            return None

        try:
            response = self.client.models.embed_content(
                model=self.model_name,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT" if store else "RETRIEVAL_QUERY",
                )
            )
            if response and len(response.embeddings) > 0:
                if self.verbose:
                    logger.info("Gemini獲取embedding成功")
                return response.embeddings[0].values
            else:
                logger.error(f"Gemini未獲取到embedding，響應數據: {response}")
                return None
        except Exception as e:
            logger.error(f"Gemini獲取embedding時出錯: {e}")
            return None