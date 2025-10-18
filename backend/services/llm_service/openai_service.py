from openai import OpenAI
import requests
from typing import Optional, List, Generator, Union

from .base_service import BaseLLMService

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class OpenAIService(BaseLLMService):
    """
    ### OpenAI服務基類，使用OpenAI API進行文本處理。
    """

    def __init__(self, 
            model_name: str,
            api_key: str = None, 
            verbose: bool = False
        ):
        """
        初始化OpenAI服務

        Args:
            model_name: 要使用的模型名稱
            api_key: OpenAI API的API密鑰 (無輸入則使用環境變量中的API_KEY)
            verbose: 是否啟用詳細模式 (預設為False)
        """
        super().__init__(model_name=model_name, api_key=api_key, verbose=verbose)

        self._in_multi_turn = False  # 是否處於多輪對話中
        self._chat = None     # 多輪對話物件
        self.client = None

        if self.update_config(api_key=api_key, model_name=model_name):
            if self.verbose:
                logger.info(f"OpenAI服務使用模型: {self.model_name}")
        else:
            logger.error("OpenAI服務初始化失敗, 請在輸入 API Key 和模型名稱後重試")

        if self.verbose:
            logger.info("OpenAI服務初始化完成")

    def is_available(self, model_name: str = None) -> bool:
        """檢查OpenAI服務是否可用"""
        try:
            response = requests.Session().get(
                f"https://api.openai.com/v1/models/{model_name or self.model_name}", 
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5
            )
            if response:
                if self.verbose:
                    logger.info("OpenAI服務可用")
                return True
            else:
                logger.warning(f"OpenAI服務不可用: 模型 {self.model_name} 不存在或無法訪問")
                return False
        except Exception as e:
            logger.error(f"檢查OpenAI服務可用性時出錯: {e}")

    def update_config(self, api_key: str, model_name: str) -> bool:
        """
        更新OpenAI服務配置

        Args:
            api_key: OpenAI API的API密鑰
            model_name: 要使用的模型名稱

        Returns:
            bool: 配置是否成功更新
        """
        try:
            # 創建新的 client 並測試
            new_client = OpenAI(api_key=api_key)
            
            # 用新 client 測試模型是否可用
            response = self.is_available(model_name=model_name)
            
            if response:
                # 測試成功，更新配置
                self.client = new_client
                self.model_name = model_name
                if self.verbose:
                    logger.info(f"OpenAI服務配置更新成功: 模型 {self.model_name}")
                return True
            else:
                logger.error(f"OpenAI服務配置更新失敗: 模型 {model_name} 不存在或無法訪問")
                return False
        except Exception as e:
            logger.error(f"更新OpenAI服務配置時出錯: {e}")
            return False

    def _handle_stream_response(self, response: Generator) -> Generator[str, None, None]:
        """
        處理Google的流式回應

        Args:
            response: 來自Google的HTTP回應對象

        Returns:
            str: 模型回覆的文本 (若失敗則返回None)
        """
        def generate() -> Generator[str, None, None]:
            try:
                for line in response:
                    if not line:
                        continue

                    if line.choices[0].delta.content is not None:
                        chunk = line.choices[0].delta.content
                    yield chunk
                yield ""
            except Exception as e:
                logger.error(f"處理流式回應時出錯: {e}")
                yield None
        return generate()

    def send_single_request(self, 
            prompt: str, 
            system_prompt: Optional[str] = None, 
            stream: bool = False
        ) -> Union[Optional[str], Generator[str, None, None]]:
        """
        發送請求到OpenAI服務

        Args:
            prompt: 要發送的文本
            system_prompt: 系統提示文本
            stream: 是否使用流式回應

        Returns:
            str: 模型回覆的文本 (若失敗則返回None)
        """
        if not self.is_available():
            logger.warning("OpenAI服務不可用，無法發送請求")
            return None
        else:
            if self.verbose:
                logger.info(f"OpenAI發送請求，模型: {self.model_name}, 流式: {stream}")
        
        if not prompt.strip():
            return ""

        try:
            if not self._in_multi_turn:
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=1200,
                    stream=stream,
                )
            else:
                self._chat.append({"role": "user", "content": prompt})
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=self._chat,
                    temperature=0.2,
                    max_tokens=1200,
                    stream=stream,
                )

            if stream:
                if hasattr(response, '__iter__'):
                    return self._handle_stream_response(response)
                else:
                    logger.error(f"OpenAI流式回應錯誤: 無法迭代的響應對象")
                    return None

            if hasattr(response, 'choices') and response.choices:
                content = response.choices[0].message.content.strip()
                if content:
                    if self.verbose:
                        logger.info("OpenAI獲取回覆成功")
                    return content
                else:
                    logger.error(f"OpenAI未獲取到回覆，響應數據: {response}")
                    return None
            else:
                logger.error(f"OpenAI請求錯誤或無效響應: {response}")

        except Exception as e:
            logger.error(f"OpenAI請求錯誤: {e}")
            return None

    def send_multi_request(self, 
            prompt: str, 
            system_prompt: Optional[str] = None,
            end_chat: bool = False
        ) -> Optional[str]:
        """
        發送多輪請求到OpenAI服務

        Args:
            prompt: 要發送的文本
            end_chat: 是否立即結束多輪對話 (結束對話回傳 None)

        Returns:
            str: 模型回覆的文本 (若失敗則返回None)
        """
        if not self.is_available():
            logger.warning("OpenAI服務不可用，無法發送請求")
            return None
        else:
            if self.verbose:
                logger.info(f"OpenAI發送多輪請求，模型: {self.model_name}, 流式: {False}")
        
        if end_chat:
            if self.verbose:
                logger.info("結束多輪對話")
            self._in_multi_turn = False
            self._chat = None
            return None

        if not self._in_multi_turn:
            self._chat = []
            self._in_multi_turn = True
            if self.verbose:
                logger.info("開始多輪對話")

        self._chat.append({"role": "user", "content": prompt})
        response = self.send_single_request(prompt, system_prompt=system_prompt, stream=False)
        if response is not None:
            self._chat.append({"role": "assistant", "content": response})
            return response
        else:
            return None

    def send_embedding_request(self, text: Union[str, List[str]], store: bool) -> Optional[List[List[float]]]:
        """
        發送embedding請求到OpenAI服務

        Args:
            text: 需要向量化的字串
            store: 是否為存儲用途 True: 存儲, False: 搜索 (僅Gemini適用，OpenAI忽略)

        Returns:
            Union (List[float] | List[List[float]]): 單個或多個向量化結果 (出現錯誤則返回 None)
        """
        try:
            if not self.is_available():
                logger.warning("OpenAI服務不可用，無法發送embedding請求")
                return None
            else:
                if self.verbose:
                    logger.info(f"OpenAI發送embedding請求，模型: {self.model_name}")

            response = self.client.embeddings.create(
                model=self.model_name,
                input=text
            )

            if hasattr(response, 'data') and response.data:
                embedding = [embed.embedding for embed in response.data]
                if embedding:
                    if self.verbose:
                        logger.info("OpenAI獲取embedding成功")
                    return embedding
                else:
                    logger.error(f"OpenAI未獲取到embedding，響應數據: {response}")
                    return None
            else:
                logger.error(f"OpenAI embedding請求錯誤或無效響應: {response}")
                return None

        except Exception as e:
            logger.error(f"OpenAI embedding請求錯誤: {e}")
            return None