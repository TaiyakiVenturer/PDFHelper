from google import genai
from google.genai import types
import time
from typing import Optional, List

class GeminiService():
    """
    ### Gemini服務基類，使用Google Gemini API進行文本處理。
    """

    def __init__(self, 
            model_name: str,
            api_key: str = "", 
            verbose: bool = False
        ):
        """
        初始化Gemini服務

        Args:
            model_name: 要使用的模型名稱
            api_key: Google Gemini API的API密鑰 (無輸入則使用環境變量中的API_KEY)
            verbose: 是否啟用詳細模式 (預設為False)
        """
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name
        self.verbose = verbose

        self.in_multi_turn = False  # 是否處於多輪對話中
        self.chat_object = None     # 多輪對話物件

    def is_available(self) -> bool:
        """檢查Gemini服務是否可用"""
        try:
            response = self.client.models.get(model="gemini-2.5-flash-lite")
            if response:
                if self.verbose:
                    print("✅ Gemini服務可用")
                return True
            else:
                print(f"❌ Gemini服務不可用: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ 檢查Gemini服務可用性時出錯: {e}")
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
        response = None
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
                print("❌ 請求過多，請稍後再試")
                time.sleep(3)  # 簡單的重試機制，等待3秒
            else:
                print(f"❌ 請求失敗: {response.status_code} - {response.text}")
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
        if end_chat:
            self.in_multi_turn = False
            self.chat_object = None
            return None

        if not self.in_multi_turn:
            self.chat_object = self.client.chats.create(
                model=self.model_name,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    top_p=0.8,
                    top_k=30,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                    system_instruction=system_prompt
                )
            )
            self.in_multi_turn = True

        response = self.chat_object.send_message(prompt)
        if response:
            return response.text
        else:
            print("❌ 多輪請求失敗")
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
        try:
            response = self.client.models.embed_content(
                model=self.model_name,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT" if store else "RETRIEVAL_QUERY",
                )
            )
            if response and len(response.embeddings) > 0:
                return response.embeddings[0].values
            else:
                print(f"❌ 未獲取到embedding，響應數據: {response}")
                return None
        except Exception as e:
            print(f"❌ 獲取embedding時出錯: {e}")
            return None