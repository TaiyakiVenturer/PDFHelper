"""
PDFHelper Config 模塊 - 統一管理PDFHelper的設定選項。
"""
import os
from typing import List
from dataclasses import dataclass
import json

from pathlib import Path

def find_project_root(max_attempts: int = 5) -> Path:
    current_dir = Path(__file__).resolve().parent
    attempts = 0
    while attempts < max_attempts:
        backend_path = current_dir / 'backend'
        frontend_path = current_dir / 'frontend'
        if backend_path.is_dir() and frontend_path.is_dir():
            return current_dir
        if current_dir.parent == current_dir:
            break
        current_dir = current_dir.parent
        attempts += 1
    raise FileNotFoundError("找不到包含 'backend' 和 'frontend' 目錄的專案根目錄")

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
        verbose (bool): 是否啟用詳細日誌
    """
    verbose: bool = False

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
        max_retries (int): 最大重試次數
        retry_delay (int): 重試延遲時間（秒）
        verbose (bool): 是否啟用詳細日誌
    """
    max_retries: int = 3
    retry_delay: int = 1  # 秒
    verbose: bool = False

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
    collection_name: str = None
    collection_cache_size: int = 3 # 預設快取3個集合
    verbose: bool = False

@dataclass
class RAGConfig:
    """
    RAG 引擎設定

    Args:
        verbose (bool): 是否啟用詳細日誌
    """
    verbose: bool = False

@dataclass
class MarkdownReconstructorConfig:
    """
    Markdown重組器設定

    Args:
        instance_path (str): 實例路徑
        verbose (bool): 是否啟用詳細日誌
    """
    verbose: bool = False

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
            markdown_reconstructor_config: MarkdownReconstructorConfig = None,
        ):
        """
        初始化配置管理

        Args:
            instance_path (str): 所有文件的統一儲存路徑 (預設為 "../instance")
            mineru_config (MinerUConfig): MinerU文件處理器設定 (可選)
            translator_config (TranslatorConfig): 翻譯器設定 (可選)
            document_processor_config (DocumentProcessorConfig): 文件處理器設定 (可選)
            embedding_service_config (EmbeddingServiceConfig): Embedding服務設定 (可選)
            chromadb_config (ChromaDBConfig): ChromaDB設定 (可選)
            rag_config (RAGConfig): RAG引擎設定 (可選)
        """
        # 所有文件統一的儲存路徑
        self.instance_path: str = instance_path or os.path.join(str(find_project_root()), "backend", "instance")

        self.mineru_config: MinerUConfig = mineru_config or MinerUConfig()

        self.translator_config: TranslatorConfig = translator_config or TranslatorConfig()

        self.document_processor_config: DocumentProcessorConfig = document_processor_config or DocumentProcessorConfig()

        self.embedding_service_config: EmbeddingServiceConfig = embedding_service_config or EmbeddingServiceConfig()

        self.chromadb_config: ChromaDBConfig = chromadb_config or ChromaDBConfig()

        self.rag_config: RAGConfig = rag_config or RAGConfig()

        self.markdown_reconstructor_config: MarkdownReconstructorConfig = markdown_reconstructor_config or MarkdownReconstructorConfig()

    def __repr__(self) -> List[str]:
        info = [
            f"Instance Path: {self.instance_path}",
            f"MinerU Config: {json.dumps(self.mineru_config.__dict__, indent=4)}",
            f"Translator Config: {json.dumps(self.translator_config.__dict__, indent=4)}",
            f"Document Processor Config: {json.dumps(self.document_processor_config.__dict__, indent=4)}",
            f"Embedding Service Config: {json.dumps(self.embedding_service_config.__dict__, indent=4)}",
            f"ChromaDB Config: {json.dumps(self.chromadb_config.__dict__, indent=4)}",
            f"RAG Config: {json.dumps(self.rag_config.__dict__, indent=4)}",
            f"Markdown Reconstructor Config: {json.dumps(self.markdown_reconstructor_config.__dict__, indent=4)}"
        ]
        return info