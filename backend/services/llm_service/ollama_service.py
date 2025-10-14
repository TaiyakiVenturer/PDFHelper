import requests
from typing import Optional, Generator, List, Union
import os
import json

from .base_service import BaseLLMService

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class OllamaService(BaseLLMService):
    """
    ### Ollama LLM服務
    """
    def __init__(self,
            model_name: str,
            verbose: bool = False
        ):
        """
        初始化Ollama服務
        
        Args:
            model_name: 使用的模型名稱
            verbose: 是否顯示詳細日誌
        """
        super().__init__(model_name=model_name, api_key=None, verbose=verbose)

        self.session = requests.Session()
        self.base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")

        self._in_multi_turn = False  # 是否處於多輪對話中
        self._chat = None

        if self.verbose:
            logger.info("Ollama服務初始化完成")

    def is_available(self, model_name: str = None) -> bool:
        """檢查Ollama服務是否可用 (model_name 參數目前未使用)"""
        try:
            response = self.session.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                if self.verbose:
                    logger.info("Ollama服務可用")
                return True
            else:
                logger.error(f"Ollama服務不可用: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.Timeout:
            logger.error("Ollama服務檢查超時")
            return False
        except requests.exceptions.ConnectionError:
            logger.error("無法連接到Ollama服務")
            return False
        except Exception as e:
            logger.error(f"檢查Ollama服務可用性時出錯: {e}")
            return False

    def update_config(self, api_key: str = None, model_name: str = None) -> bool:
        """
        更新Ollama服務配置 (Ollama目前不需要API Key)

        Args:
            api_key: API密鑰 (Ollama不使用此參數)
            model_name: 要使用的模型名稱

        Returns:
            bool: 配置是否更新成功且服務可用
        """
        if self.is_available():
            if model_name:
                self.model_name = model_name
            if self.verbose:
                logger.info(f"Ollama服務配置更新成功: 模型 {self.model_name}")
            return True
        else:
            logger.error("Ollama服務不可用，無法更新配置")
            return False

    def _handle_stream_response(self, response: requests.Response) -> Generator[str, None, None]:
        """
        處理Ollama的流式回應

        Args:
            response: 來自Ollama的HTTP回應對象

        Returns:
            str: 模型回覆的文本 (若失敗則返回None)
        """
        def generate() -> Generator[str, None, None]:
            try:
                for line in response.iter_lines():
                    if not line:
                        continue

                    data = json.loads(line.decode('utf-8'))
                    if data.get('done'):
                        break
                    if 'response' in data:
                        chunk = data['response']
                        if chunk:
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
        發送請求到Ollama服務

        Args:
            prompt: 要發送的文本
            system_prompt: 系統提示文本 (Ollama目前不支持此參數)
            stream: 是否使用流式回應

        Returns:
            (str | Generator[OllamaStreamResponse, None, None]): 模型回覆的文本，若使用流式回應則返回生成器 (若失敗則返回None)
        """
        if not self.is_available():
            logger.warning("Ollama服務不可用，無法發送請求")
            return None
        else:
            if self.verbose:
                logger.info(f"發送請求到Ollama服務，模型: {self.model_name}, 流式: {stream}")

        # 發送請求
        try:
            if not self._in_multi_turn:
                response = self.session.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": prompt,
                        "stream": stream
                    },
                    stream=stream,
                    timeout=90 if not stream else 30  # 增加超時時間以適應自定義模型
                )
            else:
                self._chat.append({"role": "user", "content": prompt})
                response = self.session.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model_name,
                        "messages": self._chat,
                        "stream": stream
                    },
                    stream=stream,
                    timeout=90 if not stream else 30  # 增加超時時間以適應自定義模型
                )
            if stream:
                if response.status_code == 200:
                    return self._handle_stream_response(response)
                else:
                    logger.error(f"Ollama流式回應錯誤: {response.status_code} - {response.text}")
                    return None

            if response.status_code == 200:
                result = response.json()
                respond_text = result.get("response", "").strip()
                if respond_text:
                    if self.verbose:
                        logger.info("Ollama獲取回覆成功")
                    return respond_text
                else:
                    logger.error(f"Ollama未獲取到回覆，響應數據: {result}")
                    return None
            elif response.status_code == 429:
                logger.warning("Ollama請求過於頻繁")
            else:
                logger.error(f"Ollama請求錯誤: {response.status_code} - {response.text}")

        except requests.exceptions.Timeout:
            logger.error("Ollama請求超時")
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama請求錯誤: {e}")
        except Exception as e:
            logger.error(f"Ollama未知錯誤: {e}")

        return None

    def send_multi_request(self, 
            prompt: str, 
            system_prompt: Optional[str] = None,
            end_chat: bool = False
        ) -> Optional[str]:
        """
        發送多輪請求到Ollama服務

        Args:
            prompt: 要發送的文本
            end_chat: 是否立即結束多輪對話 (結束對話回傳 None)

        Returns:
            str: 模型回覆的文本 (若失敗則返回None)
        """
        if not self.is_available():
            logger.warning("Ollama服務不可用，無法發送請求")
            return None
        else:
            if self.verbose:
                logger.info(f"Ollama發送請求，模型: {self.model_name}, 流式: {True}")
        
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

    def send_embedding_request(self, text: str, store: bool) -> Optional[List[float]]:
        """
        發送embedding請求到Ollama服務

        Args:
            text: 需要向量化的字串
            store: 是否為存儲用途 True: 存儲, False: 搜索 (僅Gemini適用，Ollama忽略)

        Returns:
            List[float]: 向量化結果 (出現錯誤則返回 None)
        """
        try:
            response = self.session.post(
                f"{self.base_url}/api/embeddings",
                json={
                    "model": self.model_name,
                    "prompt": text,
                    "stream": False
                }, 
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()
                embedding = result.get('embedding')
                if embedding:
                    if self.verbose:
                        logger.info("Ollama獲取embedding成功")
                    return embedding
                else:
                    logger.error(f"Ollama未獲取到embedding，響應數據: {result}")
                    return None
            else:
                logger.error(f"Ollama請求錯誤: {response.status_code} - {response.text}")

        except requests.exceptions.Timeout:
            logger.error("Ollama請求超時")
        except requests.exceptions.RequestException as e:
            logger.error(f"Ollama請求錯誤: {e}")
        except Exception as e:
            logger.error(f"Ollama未知錯誤: {e}")

        return None