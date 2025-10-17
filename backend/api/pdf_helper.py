"""
PDFHelper API 模塊 - 統一導出所有Service功能和設定，提供簡潔的接口給外部使用。
"""
from typing import Literal, Dict, Any, Optional
import time
import os
from pathlib import Path
from dataclasses import dataclass
import json

import backend.services.llm_service as llm_services  # 導入所有LLM服務
from backend.services.pdf_service import MinerUProcessor # 導入MinerU文件處理器
from backend.services.translation_service import Translator # 導入翻譯器
from backend.services.rag_service import DocumentProcessor, EmbeddingService, ChromaVectorStore, RAGEngine # 導入RAG引擎
from backend.services.pdf_service.md_reconstructor import MarkdownReconstructor # 導入Markdown重建器

from backend.api.config import Config # 導入配置管理
from backend.api import ProgressManager # 導入進度管理器

import logging
from backend.api.logger import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

@dataclass
class HelperResult:
    """
    統一的API結果格式

    Args:
        success (bool): 操作是否成功
        message (str): 操作結果訊息 
        data (Optional[Dict[str, Any]]): 可選的附加資料
    """
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

class PDFHelper:
    """
    PDFHelper API - 提供PDF處理、翻譯和RAG功能的統一接口。
    """
    def __init__(self, config: Config = None, verbose: bool = False):
        self.config = config or Config()  # 如果沒有提供config，則創建一個新的Config物件
        self.verbose = verbose

        if self.verbose:
            logger.info("初始化 PDFHelper API...")

        if not os.path.exists(self.config.instance_path):
            raise ValueError(f"❌ 指定的 instance_path 不存在: {self.config.instance_path}")
        if self.verbose:
            logger.info(f"instance_path 已確認: {self.config.instance_path}")

        self.pdf_processor = MinerUProcessor(
            instance_path=self.config.instance_path,
            output_dirname=self.config.mineru_config.output_dirname,
            verbose=self.config.mineru_config.verbose
        )
        if self.verbose:
            logger.info("PDF處理器初始化完成")

        self.translator = Translator(
            instance_path=self.config.instance_path, 
            llm_service_obj=None,
            verbose=self.config.translator_config.verbose
        )
        if self.verbose:
            logger.info("翻譯器初始化完成")

        document_processor = DocumentProcessor(
            instance_path=self.config.instance_path,
            min_chunk_size=self.config.document_processor_config.min_chunk_size,
            max_chunk_size=self.config.document_processor_config.max_chunk_size,
            merge_short_chunks=self.config.document_processor_config.merge_short_chunks,
            verbose=self.config.document_processor_config.verbose
        )
        if self.verbose:
            logger.info("文件處理器初始化完成")

        embedding_service = EmbeddingService(
            llm_service_obj=None,
            max_retries=self.config.embedding_service_config.max_retries,
            retry_delay=self.config.embedding_service_config.retry_delay,
            verbose=self.config.embedding_service_config.verbose
        )
        if self.verbose:
            logger.info("Embedding服務初始化完成")

        vector_store = ChromaVectorStore(
            instance_path=self.config.instance_path,
            persist_directory_name=self.config.chromadb_config.persist_directory_name,
            collection_cache_size=self.config.chromadb_config.collection_cache_size,
            verbose=self.config.chromadb_config.verbose
        )
        if self.verbose:
            logger.info("向量資料庫初始化完成")

        self.rag_engine = RAGEngine(
            document_processor_obj=document_processor,
            embedding_service_obj=embedding_service,
            chromadb_obj=vector_store,
            llm_service_obj=None,
            verbose=self.config.rag_config.verbose
        )
        if self.verbose:
            logger.info("RAG引擎初始化完成")

        self.md_constructor = MarkdownReconstructor(
            instance_path=self.config.instance_path,
            verbose=self.config.markdown_reconstructor_config.verbose
        )
        if self.verbose:
            logger.info("Markdown重建器初始化完成")

        if self.verbose:
            logger.info("PDFHelper API 已完成初始化")
            logger.info("當前設定細項:")
            for line in self.config.__repr__():
                logger.info(f"{line}")

    def _create_llm_service(self, 
            provider: Literal["ollama", "google", "openai"], 
            model_name: str, 
            api_key: str, 
            verbose: bool
        ) -> llm_services.base_service.BaseLLMService:
        """
        根據服務名稱創建對應的LLM服務實例

        Args:
            service (str): 服務名稱 ("ollama", "google", "openai")
            model_name (str): 模型名稱
            api_key (str): API密鑰 (如果需要)
            verbose (bool): 是否啟用詳細日誌

        Returns:
            Any: 返回創建的LLM服務實例
        """
        if provider == "ollama":
            return llm_services.ollama_service.OllamaService(
                model_name=model_name,
                verbose=verbose
            )
        elif provider == "google":
            return llm_services.google_service.GoogleService(
                model_name=model_name,
                api_key=api_key,
                verbose=verbose
            )
        elif provider == "openai":
            return llm_services.openai_service.OpenAIService(
                model_name=model_name,
                api_key=api_key,
                verbose=verbose
            )
        else:
            logger.error(f"不支援的LLM服務: {provider}, {model_name}")

    def update_llm_service(self, 
            service: Literal['translator', 'embedding', 'rag'], 
            provider: Literal["ollama", "google", "openai"],
            api_key: str, 
            model_name: str
        ) -> HelperResult:
        """
        更新API金鑰
        
        Args:
            service: 要更新API金鑰的服務 (translator/embedding/rag)
            api_key: 新的API金鑰
            model_name: 模型名稱
        
        Returns:
            HelperResult: 包含是否成功更新API金鑰的統一格式
        """
        logger.info(f"[update_llm_service] {service}, {provider}, {model_name}")
        if service == "translator":
            self.translator.llm_service = self._create_llm_service(
                provider=provider, 
                model_name=model_name, 
                api_key=api_key,
                verbose=self.translator.verbose
            )
            return HelperResult(
                success=self.translator.llm_service.is_available(),
                message="翻譯服務API金鑰更新成功" if self.translator.llm_service.is_available() else "翻譯服務API金鑰更新失敗，請檢查金鑰或模型名稱是否正確"
            )
        elif service == "embedding":
            self.rag_engine.embedding_service.llm_service = self._create_llm_service(
                provider=provider, 
                model_name=model_name, 
                api_key=api_key,
                verbose=self.rag_engine.embedding_service.verbose
            )
            return HelperResult(
                success=self.rag_engine.embedding_service.llm_service.is_available(),
                message="Embedding服務API金鑰更新成功" if self.rag_engine.embedding_service.llm_service.is_available() else "Embedding服務API金鑰更新失敗，請檢查金鑰或模型名稱是否正確"
            )
        elif service == "rag":
            self.rag_engine.llm_service = self._create_llm_service(
                provider=provider, 
                model_name=model_name, 
                api_key=api_key,
                verbose=self.rag_engine.verbose
            )
            return HelperResult(
                success=self.rag_engine.llm_service.is_available(),
                message="RAG服務API金鑰更新成功" if self.rag_engine.llm_service.is_available() else "RAG服務API金鑰更新失敗，請檢查金鑰或模型名稱是否正確"
            )
        else:
            return HelperResult(
                success=False,
                message="不支援的服務類型"
            )

    def process_pdf_to_json(self, 
            pdf_name: str, 
            method: Literal["auto", "txt", "ocr"] = "auto", 
            lang: str = "en",
            device: Literal["cuda", "cpu"] = "cuda"
        ) -> HelperResult:
        """
        使用MinerU處理PDF並輸出JSON及其他檔案格式
        
        Args:
            pdf_name: PDF檔案名稱
            method: 解析方法 (auto/txt/ocr)
            lang: 語言設定 (預設為英文en)
            device: 設備模式 (cuda/cpu)
        
        Returns:
            HelperResult: 包含處理結果的統一格式
        """
        if self.verbose:
            logger.info(f"開始處理 PDF: {pdf_name}，方法: {method}, 語言: {lang}, 設備: {device}")

        mineru_results = self.pdf_processor.process_pdf_with_mineru(
            pdf_name, 
            method=method, 
            lang=lang, 
            device=device
        )
        if mineru_results["success"]:
            if self.verbose:
                logger.info(f"PDF '{pdf_name}' 處理完成，輸出路徑: {mineru_results['output_path']}")
                logger.info(f"生成的檔案: {json.dumps(mineru_results['output_file_paths'], indent=2, ensure_ascii=False, sort_keys=True)}")
                logger.info(f"處理時間: {mineru_results['processing_time']:.2f} 秒")
        else:
            logger.error(f"PDF '{pdf_name}' 處理失敗，錯誤訊息: {mineru_results['error']}")
        return HelperResult(
            success=mineru_results["success"],
            message="PDF處理完成" if mineru_results["success"] else f"PDF處理失敗: {mineru_results['error']}",
            data=mineru_results if mineru_results["success"] else None
        )

    def translate_json_content(self, json_path: str) -> HelperResult:
        """
        使用LLM服務翻譯JSON內容
        
        Args:
            json_path: JSON檔案路徑
        
        Returns:
            HelperResult: 包含翻譯後的JSON檔案路徑的統一格式
                - data(translated_file_path): 包含翻譯後的JSON檔案路徑
        """
        if not self.translator.is_available():
            logger.error("翻譯服務不可用")
            return HelperResult(
                success=False,
                message="翻譯服務不可用"
            )

        try:
            start = time.time()
            translated_file_path = self.translator.translate_content_list(
                content_list_path=json_path,
                buffer_time=1.8 if hasattr(self.translator.llm_service, 'api_key') else 0,
            )
            if self.verbose:
                logger.info(f"JSON '{json_path}' 翻譯完成，輸出路徑: {translated_file_path}")
                logger.info(f"處理時間: {time.time() - start:.2f} 秒")

            return HelperResult(
                success=True,
                message="JSON翻譯完成",
                data={"translated_file_path": translated_file_path}
            )
        except Exception as e:
            logger.error(f"JSON '{json_path}' 翻譯失敗，錯誤訊息: {e}")
            return HelperResult(
                success=False,
                message=f"JSON翻譯失敗: {e}"
            )

    def add_json_to_rag(self, json_name: str) -> HelperResult:
        """
        將JSON內容加入RAG引擎的向量資料庫
        
        Args:
            json_name: Json檔案名稱含副檔名 (例如: `example_translated.json`)
        
        Returns:
            HelperResult: 包含是否成功加入向量資料庫的統一格式
                - data(collection_name): 包含加入的集合名稱 (如果成功加入)
        """
        start = time.time()
        success, collection_name = self.rag_engine.store_document_into_vectordb(
            json_file_name=json_name
        )
        if success:
            if self.verbose:
                logger.info(f"JSON '{json_name}' 已加入向量資料庫")
                logger.info(f"處理時間: {time.time() - start:.2f} 秒")
        else:
            logger.error(f"JSON '{json_name}' 加入向量資料庫失敗")
        return HelperResult(
            success=success,
            message="JSON已加入向量資料庫" if success else "JSON加入向量資料庫失敗",
            data={"collection_name": collection_name}
        )

    def from_pdf_to_rag(self, 
            pdf_name: str, 
            method: Literal["auto", "txt", "ocr"] = "auto", 
            lang: str = "en"
        ) -> HelperResult:
        """
        完整工作流程：從PDF處理到加入RAG引擎
        
        Args:
            pdf_name: PDF檔案名稱
            method: 解析方法 (auto/txt/ocr)
            lang: 語言設定 (預設為英文en)
        
        Returns:
            HelperResult: 包含是否成功加入向量資料庫及加入資料庫集合名稱的統一格式
        """
        from torch import cuda
        device = "cuda" if cuda.is_available() else "cpu"

        logger.info(f"[from_pdf_to_rag] 開始完整處理流程: {pdf_name}, 方法: {method}, 語言: {lang}, 設備: {device}")

        # 提取PDF成JSON格式
        mineru_results = self.process_pdf_to_json(
            pdf_name, 
            method=method, 
            lang=lang, 
            device=device
        )
        if not mineru_results.success:
            ProgressManager.progress_fail("PDF處理失敗")
            return mineru_results

        # 獲取生成的JSON檔案路徑
        json_path = mineru_results.data.get("output_file_paths").get("json")
        if not json_path:
            logger.error("未找到生成的JSON檔案，無法進行後續操作")
            ProgressManager.progress_fail("未找到生成的JSON檔案")
            return HelperResult(
                success=False,
                message="未找到生成的JSON檔案"
            )
        
        if not os.path.exists(json_path):
            logger.error(f"生成的JSON檔案不存在: {json_path}，無法進行後續操作")
            ProgressManager.progress_fail("生成的JSON檔案不存在")
            return HelperResult(
                success=False,
                message="生成的JSON檔案不存在"
            )
        ProgressManager.progress_update(30, "開始翻譯JSON內容", "translating-json")
        
        # 翻譯JSON內容
        translated_path = self.translate_json_content(json_path)
        if not translated_path.success:
            ProgressManager.progress_fail("翻譯JSON內容遇到錯誤")
            return HelperResult(
                success=False,
                message="翻譯JSON內容失敗"
            )
        ProgressManager.progress_update(67, "JSON內容翻譯完成，開始加入RAG引擎", "adding-to-rag")
        
        translated_json_path = translated_path.data.get("translated_file_path")
        if not os.path.exists(translated_json_path):
            ProgressManager.progress_fail("未找到翻譯後的JSON檔案")
            logger.error(f"未找到翻譯後的JSON檔案 {translated_json_path}，無法進行後續操作")
            return HelperResult(
                success=False,
                message="未找到翻譯後的JSON檔案"
            )
        ProgressManager.progress_update(70, "已獲取翻譯後的JSON檔案，開始加入RAG引擎", "adding-to-rag")

        # 將翻譯後的JSON加入RAG引擎
        translated_json_name = Path(translated_json_path).name
        rag_result = self.add_json_to_rag(translated_json_name)
        if not rag_result.success:
            ProgressManager.progress_fail("加入RAG引擎遇到錯誤")
            logger.error(f"加入RAG引擎失敗: {rag_result.message}")
        else:
            ProgressManager.progress_complete({
                "collection_name": rag_result.data.get("collection_name"),
                "translated_json_name": translated_json_name
            })
            logger.info(f"文件成功加入RAG引擎: {translated_json_name}, 集合名稱: {rag_result.data.get('collection_name')}")

        return rag_result

    def ask_question(self, 
            question: str, 
            document_name: str, 
            top_k: int = 10,
            filter_dict: Dict[str, Any] = None,
            include_sources: bool = True
        ) -> HelperResult:
        """
        向RAG引擎提問並獲取回答
        
        Args:
            question: 提問內容
            document_name: 向量資料庫集合名稱
            top_k: 檢索的相關文件數量 (預設為10)
            filter_dict: 過濾條件 (可選)
            include_source: 是否包含來源文件 (預設為True)
        
        Returns:
            HelperResult: 包含回答和來源的統一格式
        """
        start = time.time()
        ask_results = self.rag_engine.ask(
            question=question,
            collection_name=document_name,
            top_k=top_k,
            filter_dict=filter_dict,
            include_sources=include_sources
        )
        if ask_results.status == "success":
            if self.verbose:
                logger.info("問題已提交至RAG引擎")
                logger.info(f"處理時間: {time.time() - start:.2f} 秒")
                logger.info(f"回答內容: {ask_results.answer}")
        else:
            logger.error("問題提交失敗，發生錯誤")
        return HelperResult(
            success=ask_results.status == "success",
            message="問答查詢完成" if ask_results.status == "success" else "問答查詢失敗",
            data={
                "answer": ask_results.answer,
                "sources": ask_results.sources
            }
        )

    def reconstruct_markdown(self, 
            json_name: str, 
            method: Literal['auto', 'ocr', 'text'],
            language: Literal['zh', 'en'] = 'zh'
        ) -> HelperResult:
        """
        重組.md檔案

        Args:
            file_name: 翻譯後的Json檔案名稱含副檔名 (例如: `example_translated.json`)
            method: 處理方法 (auto/ocr/text)
            language: 語言選擇 (zh, en)

        Returns:
            HelperResult: 包含重組後的.md檔案路徑的統一格式
        """
        finished_path = self.md_constructor.reconstruct(
            json_name=json_name,
            method=method,
            language=language
        )
        return HelperResult(
            success=finished_path is not None,
            message="Markdown重組完成" if finished_path else "Markdown重組失敗",
            data={"markdown_path": finished_path} if finished_path else None
        )

    def get_system_health(self) -> HelperResult:
        """
        獲取系統健康狀態
        
        Returns:
            HelperResult: 包含系統健康狀態資訊的統一格式
        """

        health_status = {
            "pdf_processor": True,  # 假設PDF處理器總是可用
            "translator": self.translator.is_available() if self.translator.llm_service else "未設定",
            "rag_engine": self.rag_engine.get_system_info(),
        }
        return HelperResult(
            success=True,
            message="系統健康狀態獲取完成",
            data=health_status
        )
