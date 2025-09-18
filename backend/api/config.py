"""
PDFHelper Config 模塊 - 統一管理PDFHelper的設定選項。
"""
import os
from typing import Literal
from dataclasses import dataclass

@dataclass
class MinerUConfig:
    """
    MinerU 文件處理器設定

    Args:
        output_dirname (str): 輸出文件目錄名稱
        verbose (bool): 是否啟用詳細日誌
    """
    output_dirname: str = "mineru_outputs"
    verbose: bool = False

@dataclass
class TranslatorConfig:
    """
    翻譯器設定
    
    Args:
        llm_service (Literal["ollama", "gemini"]): 翻譯請求使用的LLM服務 (預設使用 Gemini)
        model_name (str): 使用的模型名稱
            - Ollama 預設為 "TranslateHelper" (為自訂模型，須依使用者修改使用模型名稱)
            - Gemini 預設為 "gemini-2.5-flash-lite"
        api_key (str): API金鑰（預設從環境變數取得，也可手動設定）
        verbose (bool): 是否啟用詳細日誌
    """
    llm_service: Literal["ollama", "gemini"] = "gemini"
    model_name: str = None
    api_key: str = None
    verbose: bool = False

    def __post_init__(self):
        # 添加驗證
        if self.llm_service not in ["ollama", "gemini"]:
            raise ValueError(f"不支援的LLM服務: {self.llm_service}")
        
        # 依照服務設定預設模型名稱
        if self.llm_service == "ollama" and self.model_name is None:
            self.model_name = "TranslateHelper"
        if self.llm_service == "gemini" and self.model_name is None:
            self.model_name = "gemini-2.5-flash-lite"

@dataclass
class DocumentProcessorConfig:
    """
    文件處理器設定

    Args:
        chunk_size (int): 內容片段大小
        overlap_size (int): 內容片段重疊大小
        verbose (bool): 是否啟用詳細日誌
    """
    min_chunk_size: int = 500
    max_chunk_size: int = 1000
    merge_short_chunks: bool = True
    verbose: bool = False

@dataclass
class EmbeddingServiceConfig:
    """
    Embedding 服務設定

    Args:
        llm_service (Literal["ollama", "gemini"]): 使用的LLM服務 (預設使用 Gemini，強烈建議用Ollama)
        model_name (str): 嵌入處理使用的模型名稱 (如未設定，則依服務自動選擇，可能選擇失敗)
            - Ollama 預設為 "nomic-embed-v2-text-moe" (為自訂模型，須依使用者修改使用模型名稱)
            - Gemini 預設為 "gemini-embedding-001"
        api_key (str): API金鑰（預設從環境變數取得，也可手動設定）
        max_retries (int): 最大重試次數
        retry_delay (int): 重試延遲時間（秒）
        verbose (bool): 是否啟用詳細日誌
    """
    llm_service: Literal["ollama", "gemini"] = "gemini"
    model_name: str = None
    api_key: str = None
    max_retries: int = 3
    retry_delay: int = 1  # 秒
    verbose: bool = False

    def __post_init__(self):
        # 添加驗證
        if self.llm_service not in ["ollama", "gemini"]:
            raise ValueError(f"不支援的LLM服務: {self.llm_service}")
        
        # 依照服務設定預設模型名稱
        if self.llm_service == "ollama" and self.model_name is None:
            self.model_name = "nomic-embed-v2-text-moe"
        if self.llm_service == "gemini" and self.model_name is None:
            self.model_name = "gemini-embedding-001"

@dataclass
class ChromaDBConfig:
    """
    ChromaDB 設定

    Args:
        persist_directory_name (str): 持久化目錄
        collection_name (str): 集合名稱
        collection_cache_size (int): 集合快取大小
        verbose (bool): 是否啟用詳細日誌
    """
    persist_directory_name: str = "chroma_db"
    collection_name: str = "default_collection"
    collection_cache_size: int = 3 # 預設快取3個集合
    verbose: bool = False

@dataclass
class RAGConfig:
    """
    RAG 引擎設定

    Args:
        llm_service (Literal["ollama", "gemini"]): 回答使用的LLM服務 (預設使用 Gemini)
        model_name (str): 回答使用的模型名稱 (如未設定，則依服務自動選擇，可能選擇失敗)
            - Ollama 預設為 "yi-chat" (為自訂模型，須依使用者修改使用模型名稱)
            - Gemini 預設為 "gemini-2.5-flash-lite"
        document_processor_config (DocumentProcessorConfig): 文件處理器設定
        embedding_service_config (EmbeddingServiceConfig): Embedding服務設定
        chromadb_config (ChromaDBConfig): ChromaDB設定
        verbose (bool): 是否啟用詳細日誌
    """
    llm_service: Literal["ollama", "gemini"] = "gemini"
    model_name: str = None
    document_processor_config: DocumentProcessorConfig = DocumentProcessorConfig()
    embedding_service_config: EmbeddingServiceConfig = EmbeddingServiceConfig()
    chromadb_config: ChromaDBConfig = ChromaDBConfig()
    verbose: bool = False

    def __post_init__(self):
        # 添加驗證
        if self.llm_service not in ["ollama", "gemini"]:
            raise ValueError(f"不支援的LLM服務: {self.llm_service}")
        
        # 依照服務設定預設模型名稱
        if self.llm_service == "ollama" and self.model_name is None:
            self.model_name = "yi-chat"
        if self.llm_service == "gemini" and self.model_name is None:
            self.model_name = "gemini-2.5-flash-lite"

class Config:
    """
    設定管理 - 提供所有設定選項的統一接口。
    """
    def __init__(self, 
            instance_path: str = None,
            mineru_config: MinerUConfig = None,
            translator_config: TranslatorConfig = None,
            document_processor_config: DocumentProcessorConfig = None,
            embedding_service_config: EmbeddingServiceConfig = None,
            chromadb_config: ChromaDBConfig = None,
            rag_config: RAGConfig = None,
        ):
        """
        初始化配置管理

        Args:
            instance_path (str): 所有文件的統一儲存路徑 (預設為 "../instance")
            mineru_config (MinerUConfig): MinerU文件處理器設定 (可選)
            translator_config (TranslatorConfig): 翻譯器設定 (可選)
            rag_config (RAGConfig): RAG引擎設定 (可選)
        """
        # 所有文件統一的儲存路徑
        self.instance_path: str = instance_path or os.path.abspath(os.path.join(os.path.dirname(__file__), "../instance"))

        self.mineru_config: MinerUConfig = mineru_config or MinerUConfig()

        self.translator_config: TranslatorConfig = translator_config or TranslatorConfig()

        self.rag_config: RAGConfig = rag_config or RAGConfig(
            document_processor_config=document_processor_config or DocumentProcessorConfig(),
            embedding_service_config=embedding_service_config or EmbeddingServiceConfig(),
            chromadb_config=chromadb_config or ChromaDBConfig(),
        )
    
    def __repr__(self):
        info = f"Config(instance_path={self.instance_path})\n"
        info += f"{self.mineru_config}\n"
        info += f"{self.translator_config}\n"
        info += f"{self.rag_config}\n"
        return info