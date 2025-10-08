"""
Embedding服務 - 基於Ollama的向量化服務
"""
import time
from typing import List, Optional, Literal, Union

from ..llm_service import OllamaService
from ..llm_service.gemini_service import GeminiService

import logging
logger = logging.getLogger(__name__)

class EmbeddingService:
    """基於Ollama的Embedding服務"""
    
    def __init__(
        self,
        llm_service: Literal["ollama", "gemini"] = "ollama",
        model_name: str = "",
        api_key: Optional[str] = None,
        max_retries: int = 3,
        retry_delay: int = 1,
        verbose: bool = False
    ):
        """
        初始化Embedding服務
        
        Args:
            llm_service: 使用的LLM服務 ("ollama" 或 "gemini")
            model_name: 嵌入處理使用的模型名稱
            api_key: API金鑰 (僅Gemini需要)
            max_retries: 最大重試次數
            retry_delay: 重試延遲時間（秒）
            verbose: 是否啟用詳細日誌
        """
        self.llm_service = llm_service
        self.embedding_service = None
        if llm_service == "ollama":
            assert model_name != "", "請提供Ollama的模型名稱"
            self.embedding_service = OllamaService(
                model_name=model_name,
                verbose=verbose
            )
        elif llm_service == "gemini":
            assert model_name != "", "請提供Gemini的模型名稱"
            self.embedding_service = GeminiService(
                model_name=model_name,
                api_key=api_key,
                verbose=verbose
            )
        else:
            raise ValueError(f"不支援的llm_service: {llm_service}")
        self.model_name = self.embedding_service.model_name
        
        if not self.is_available():
            raise ConnectionError(f"無法連接到 {llm_service} 服務，請檢查配置")

        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.verbose = verbose

    def is_available(self) -> bool:
        """檢查Embedding服務是否可用"""
        return self.embedding_service.is_available()

    def _get_single_embedding_with_retry(self, text: Union[str, List[str]], store: bool) -> Optional[Union[List[float], List[List[float]]]]:
        """
        附帶重試機制的單個embedding處理
        
        Args:
            text: 需要向量化的字串 or 字串列表 (Ollama僅支援單字串，Gemini支援列表)
            store: 是否為存儲用途 True: 存儲, False: 搜索 (僅Gemini適用)

        Returns:
            List[float]: 向量化結果 (出現錯誤則返回 None)
        """
        for attempt in range(self.max_retries):
            embedding = self.embedding_service.send_embedding_request(text, store=store)
            if embedding is not None:
                if self.verbose:
                    logger.info("成功獲取embedding")
                return embedding
            else:
                logger.warning(f"第 {attempt + 1} 次嘗試獲取embedding失敗，正在重試...")

            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))

        logger.error("所有重試都失敗，無法獲取embedding")
        return None

    def get_embedding(self, text: str, store: bool) -> Optional[List[float]]:
        """
        獲取單個字串的embedding
        
        Args:
            text: 需要向量化的字串

        Returns:
            List[float]: 向量化結果 (出現錯誤則返回 None)
        """
        embedding = self._get_single_embedding_with_retry(text, store=store)
        if embedding is None:
            logger.error(f"無法為文本獲取embedding: {text[:30]}...")
        if self.verbose and embedding is not None:
            logger.info("獲取單個embedding完成")
        return embedding

    def get_embeddings(self, texts: List[str], store: bool) -> List[List[float]]:
        """
        批量處理字串的embeddings

        Args:
            texts: 字串列表

        Returns:
            List[Optional[List[float]]]: 向量化結果列表
        """
        buffer_time = 1 if self.llm_service == "gemini" else 0

        embeddings = []
        error_counter = 0
        for text in texts:
            embedding = self._get_single_embedding_with_retry(text, store=store)

            # 紀錄embedding獲取失敗的字串，並過濾掉失敗的結果
            if embedding is None:
                logger.error(f"無法為字串處理embedding: {text[:30]}...")
                error_counter += 1
            else:
                embeddings.append(embedding)
            time.sleep(buffer_time)
        
        if error_counter > 0:
            logger.warning(f"總共有 {error_counter} 條字串未能成功處理embedding")
        if self.verbose:
            logger.info(f"批量處理embedding完成，共處理 {len(texts)} 條字串")
        return embeddings
