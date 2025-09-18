"""
Embedding服務 - 基於Ollama的向量化服務
"""
import time
from typing import List, Optional

from ..llm_service import OllamaService

class EmbeddingService(OllamaService):
    """基於Ollama的Embedding服務"""
    
    def __init__(
        self,
        model_name: str = "nomic-embed-v2-text-moe",
        max_retries: int = 3,
        retry_delay: int = 1,
        verbose: bool = False
    ):
        """
        初始化Embedding服務
        
        Args:
            model_name: 使用的embedding模型名稱
            ollama_host: Ollama服務地址
            max_retries: 最大重試次數
            retry_delay: 重試延遲(秒)
        """
        super().__init__(model_name=model_name, model_uses="embedding", verbose=verbose)
        if not self.is_available():
            raise ValueError(f"Ollama服務不可用，請確保Ollama正在運行且已安裝{model_name}模型")

        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.verbose = verbose

    def _get_single_embedding_with_retry(self, text: str) -> Optional[List[float]]:
        """
        附帶重試機制的單個embedding處理
        
        Args:
            text: 需要向量化的字串

        Returns:
            List[float]: 向量化結果 (出現錯誤則返回 None)
        """
        for attempt in range(self.max_retries):
            embedding = self.send_single_request(text)
            if embedding is not None:
                return embedding
            else:
                print(f"⚠️ 第 {attempt + 1} 次嘗試獲取embedding失敗，正在重試...")

            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))

        print(f"所有重試都失敗，無法獲取embedding")
        return None

    def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        獲取單個字串的embedding
        
        Args:
            text: 需要向量化的字串

        Returns:
            List[float]: 向量化結果 (出現錯誤則返回 None)
        """
        embedding = self._get_single_embedding_with_retry(text)
        if embedding is None:
            print(f"❌ 無法為文本獲取embedding: {text[:30]}...")
        if self.verbose and embedding is not None:
            print(f"✅ 獲取單個embedding完成")
        return embedding

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        批量處理字串的embeddings

        Args:
            texts: 字串列表

        Returns:
            List[Optional[List[float]]]: 向量化結果列表
        """
        embeddings = []
        error_counter = 0
        for text in texts:
            embedding = self._get_single_embedding_with_retry(text)

            # 紀錄embedding獲取失敗的字串，並過濾掉失敗的結果
            if embedding is None:
                print(f"❌ 無法為字串處理embedding: {text[:30]}...")
                error_counter += 1
            else:
                embeddings.append(embedding)
        
        if error_counter > 0:
            print(f"⚠️ 總共有 {error_counter} 條字串未能成功處理embedding")
        if self.verbose:
            print(f"✅ 批量處理embedding完成，共處理 {len(texts)} 條字串")
        return embeddings
