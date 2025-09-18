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
        llm_service (Literal["Ollama", "Gemini"]): 使用的LLM服務
        model_name (str): 使用的模型名稱
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
class RAGConfig:
    """
    RAG 引擎設定

    Args:
        llm_service (Literal["ollama", "gemini"]): 使用的LLM服務
        llm_service_model (str): LLM服務模型名稱
        embedding_model (str): 使用的Embedding模型名稱
        min_chunk_size (int): 內容片段最小長度
        max_chunk_size (int): 內容片段最大長度
        merge_short_chunks (bool): 是否合併過短的內容片段
        verbose (bool): 是否啟用詳細日誌
    """
    llm_service: Literal["ollama", "gemini"] = "gemini"
    model_name: str = None
    embedding_model: str = "nomic-embed-v2-text-moe"
    min_chunk_size: int = 100
    max_chunk_size: int = 1200
    merge_short_chunks: bool = True
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

        self.rag_config: RAGConfig = rag_config or RAGConfig()
    
    def __repr__(self):
        info = f"Config(instance_path={self.instance_path})\n"
        info += f"{self.mineru_config}\n"
        info += f"{self.translator_config}\n"
        info += f"{self.rag_config}\n"
        return info