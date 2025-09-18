"""
PDFHelper API 模塊 - 統一導出所有Service功能和設定，提供簡潔的接口給外部使用。
"""
from typing import Literal, Dict, Any, Optional
import time
import os
from pathlib import Path
from dataclasses import dataclass

from services.pdf_service import MinerUProcessor # 導入MinerU文件處理器
from services.translation_service import OllamaTranslator, GeminiTranslator # 導入翻譯器
from services.rag_service import RAGEngine # 導入RAG引擎
from services.pdf_service.md_reconstructor import MarkdownReconstructor # 導入Markdown重建器

from .config import Config # 導入配置管理

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
            print("🔧 初始化 PDFHelper API...")

        self.pdf_processor = MinerUProcessor(
            self.config.instance_path, 
            self.config.mineru_config.output_dirname, 
            self.config.mineru_config.verbose
        )
        if self.verbose:
            print("✅ PDF處理器初始化完成")

        if self.config.translator_config.llm_service == "ollama":
            self.translator = OllamaTranslator(
                self.config.instance_path,
                self.config.translator_config.model_name,
                self.config.translator_config.verbose
            )
        else:
            self.translator = GeminiTranslator(
                self.config.instance_path,
                self.config.translator_config.model_name,
                self.config.translator_config.api_key,
                self.config.translator_config.verbose
            )
        if self.verbose:
            print("✅ 翻譯器初始化完成")

        self.rag_engine = RAGEngine(
            self.config.instance_path,
            self.config.rag_config.llm_service,
            self.config.rag_config.model_name,
            self.config.rag_config.embedding_model,
            self.config.rag_config.min_chunk_size,
            self.config.rag_config.max_chunk_size,
            self.config.rag_config.merge_short_chunks,
            self.config.rag_config.verbose
        )
        if self.verbose:
            print("✅ RAG引擎初始化完成")

        self.md_constructor = MarkdownReconstructor(
            self.config.instance_path,
            verbose=self.config.mineru_config.verbose
        )
        if self.verbose:
            print("✅ Markdown重建器初始化完成")

        if self.verbose:
            print("✅ PDFHelper API 已完成初始化")
            print("當前設定細項:")
            print(self.config)

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
        mineru_results = self.pdf_processor.process_pdf_with_mineru(
            pdf_name, 
            method=method, 
            lang=lang, 
            device=device
        )
        if mineru_results["success"]:
            if self.verbose:
                print(f"✅ PDF '{pdf_name}' 處理完成，輸出路徑: {mineru_results['output_path']}")
                print(f"🔧 生成的檔案: {mineru_results['output_file_paths']}")
                print(f"⏳ 處理時間: {mineru_results['processing_time']:.2f} 秒")
        else:
            print(f"❌ PDF '{pdf_name}' 處理失敗，錯誤訊息: {mineru_results['error']}")
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
        """
        if not self.translator.is_available():
            print(f"❌ 翻譯服務不可用")
            return HelperResult(
                success=False,
                message="翻譯服務不可用"
            )

        try:
            start = time.time()
            translated_file_path = self.translator.translate_content_list(
                content_list_path=json_path,
                buffer_time=1.8 if self.config.translator_config.llm_service == "gemini" else 0.3,
            )
            if self.verbose:
                print(f"✅ JSON '{json_path}' 翻譯完成，輸出路徑: {translated_file_path}")
                print(f"⏳ 處理時間: {time.time() - start:.2f} 秒")

            return HelperResult(
                success=True,
                message="JSON翻譯完成",
                data={"translated_file_path": translated_file_path}
            )
        except Exception as e:
            print(f"❌ JSON '{json_path}' 翻譯失敗，錯誤訊息: {e}")
            return HelperResult(
                success=False,
                message=f"JSON翻譯失敗: {e}"
            )

    def add_json_to_rag(self, json_name: str) -> HelperResult:
        """
        將JSON內容加入RAG引擎的向量資料庫
        
        Args:
            json_name: JSON檔案名稱
            collection_name: 向量資料庫集合名稱 (可選)
        
        Returns:
            HelperResult: 包含是否成功加入向量資料庫的統一格式
        """
        start = time.time()
        success = self.rag_engine.store_document_into_vectordb(
            json_file_name=json_name
        )
        if success and self.verbose:
            print(f"✅ JSON '{json_name}' 已加入向量資料庫")
            print(f"⏳ 處理時間: {time.time() - start:.2f} 秒")
        else:
            print(f"❌ JSON '{json_name}' 加入向量資料庫失敗")
        return HelperResult(
            success=success,
            message="JSON已加入向量資料庫" if success else "JSON加入向量資料庫失敗"
        )

    def from_pdf_to_rag(self, 
            pdf_name: str, 
            method: Literal["auto", "txt", "ocr"] = "auto", 
            lang: str = "en",
            device: Literal["cuda", "cpu"] = "cuda"
        ) -> HelperResult:
        """
        完整工作流程：從PDF處理到加入RAG引擎
        
        Args:
            pdf_name: PDF檔案名稱
            method: 解析方法 (auto/txt/ocr)
            lang: 語言設定 (預設為英文en)
            device: 設備模式 (cuda/cpu)
        
        Returns:
            HelperResult: 包含是否成功加入向量資料庫及加入資料庫集合名稱的統一格式
        """
        # 提取PDF成JSON格式
        mineru_results = self.process_pdf_to_json(
            pdf_name, 
            method=method, 
            lang=lang, 
            device=device
        )
        if not mineru_results.success:
            return mineru_results
        
        # 獲取生成的JSON檔案路徑
        json_path = mineru_results.data.get("output_file_paths").get("json")
        if not json_path:
            print(f"❌ 未找到生成的JSON檔案，無法進行後續操作")
            return HelperResult(
                success=False,
                message="未找到生成的JSON檔案"
            )
        
        if not os.path.exists(json_path):
            print(f"❌ 生成的JSON檔案不存在: {json_path}，無法進行後續操作")
            return HelperResult(
                success=False,
                message="生成的JSON檔案不存在"
            )
        
        # 翻譯JSON內容
        translated_path = self.translate_json_content(json_path)
        if not translated_path.success:
            return HelperResult(
                success=False,
                message="翻譯JSON內容失敗"
            )
        
        translated_json_path = translated_path.data.get("translated_file_path")
        if not os.path.exists(translated_json_path):
            print(f"❌ 未找到翻譯後的JSON檔案 {translated_json_path}，無法進行後續操作")
            return HelperResult(
                success=False,
                message="未找到翻譯後的JSON檔案"
            )

        # 將翻譯後的JSON加入RAG引擎
        translated_json_name = Path(translated_json_path).name
        success = self.add_json_to_rag(translated_json_name)
        success.data = {"collection_name": translated_json_name}  # 在data中加入RAG新增的集合名稱
        return success

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
                print(f"✅ 問題已提交至RAG引擎")
                print(f"⏳ 處理時間: {time.time() - start:.2f} 秒")
        else:
            print(f"❌ 問題提交失敗，發生錯誤")
        return HelperResult(
            success=ask_results.status == "success",
            message="問答查詢完成" if ask_results.status == "success" else "問答查詢失敗",
            data={
                "answer": ask_results.answer,
                "sources": ask_results.sources
            }
        )

    def reconstruct_markdown(self, 
            file_name: str, 
            method: Literal['auto', 'ocr', 'text'],
            language: Literal['zh', 'en'] = 'zh'
        ) -> HelperResult:
        """
        重組.md檔案

        Args:
            file_name: PDF檔案名稱 (完整檔名含副檔名)
            method: 處理方法 (auto/ocr/text)
            language: 語言選擇 (zh, en)

        Returns:
            HelperResult: 包含重組後的.md檔案路徑的統一格式
        """
        finished_path = self.md_constructor.reconstruct(
            file_name=file_name,
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
            "translator": self.translator.is_available(),
            "rag_engine": self.rag_engine.get_system_info(),
        }
        return HelperResult(
            success=True,
            message="系統健康狀態獲取完成",
            data=health_status
        )
