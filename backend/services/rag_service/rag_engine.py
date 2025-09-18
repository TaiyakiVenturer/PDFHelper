"""
RAG引擎 - 整合文件處理、向量查詢和答案生成的主引擎
"""
from typing import List, Dict, Any, Optional, Literal, Iterable, Generator
import time
from dataclasses import dataclass

from .document_processor import DocumentProcessor
from .embedding_service import EmbeddingService
from .chroma_database import ChromaVectorStore

from ..llm_service import OllamaService, GeminiService

@dataclass
class SearchResult:
    """
    查詢結果資料結構

    Args:
        chunk_id: 內容片段ID
        content: 內容片段內容
        document_name: 所屬文件名稱
        page_num: 頁數（如果有）
        score: 相似度分數
    """
    chunk_id: str
    content: str
    document_name: str
    page_num: Optional[int]
    score: float  # 相似度分數

@dataclass
class RAGResponse:
    """
    RAG引擎回傳資料結構

    Args:
        status: 回傳狀態
        answer: 生成的答案 (為可迭代物件以支持流式輸出)
        sources: 相關內容片段 (為可選物件)
        query: 用戶查詢
        response_time: 回傳時間
    """
    status: str
    answer: Generator  # 使用 Generator 以支持流式輸出
    sources: Optional[List[SearchResult]]
    query: str
    response_time: float


class RAGEngine:
    """RAG查詢增強生成引擎"""
    
    def __init__(self, 
            instance_path: str, 
            llm_service: Literal['ollama', 'gemini'],
            llm_service_model: str = None,
            embedding_model: str = "nomic-embed-v2-text-moe", 
            min_chunk_size: int = 100, 
            max_chunk_size: int = 500,
            merge_short_chunks: bool = True,
            verbose: bool = False,
        ):
        """
        初始化RAG引擎
        
        Args:
            instance_path: 資料路徑 (用於DocumentProcessor和ChromaVectorStore)
            llm_service: 使用的LLM服務 (ollama/gemini)
            llm_service_model: LLM服務模型名稱 (如未提供則使用預設模型)
            embedding_model: Embedding模型名稱
            min_chunk_size: 內容片段最小長度
            max_chunk_size: 內容片段最大長度
            merge_short_chunks: 是否合併過短的內容片段
            verbose: 是否輸出詳細日誌
        """
        self.verbose = verbose
        if self.verbose:
            print("⏳ 正在初始化RAG引擎...")
        
        # 初始化各個組件
        self.document_processor = DocumentProcessor(
            instance_path=instance_path,
            min_chunk_size=min_chunk_size,
            chunk_size_limit=max_chunk_size,
            merge_short_chunks=merge_short_chunks,
            verbose=self.verbose
        )
        
        self.embedding_service = EmbeddingService(
            model_name=embedding_model,
            verbose=self.verbose
        )
        
        self.vector_store = ChromaVectorStore(
            instance_path=instance_path,
            verbose=self.verbose
        )

        # 根據選擇的LLM服務初始化
        self.llm_service = None
        if llm_service == 'ollama':
            self.llm_service = OllamaService(
                llm_service_model or "yi-chat",
                model_uses="chat",
                verbose=self.verbose
            )
            if not self.llm_service.is_available():
                raise ValueError("⚠️ Ollama服務不可用，請檢查設定")
        elif llm_service == 'gemini':
            self.llm_service = GeminiService(
                llm_service_model or "gemini-2.5-flash-lite", 
                verbose=self.verbose
            )
            if not self.llm_service.is_available():
                raise ValueError("⚠️ Gemini服務不可用，請檢查設定")
        else:
            print("⚠️ 未設定LLM服務，將無法生成答案")

        if self.verbose:
            print("✅ RAG引擎初始化完成")

    def store_document_into_vectordb(self, json_file_name: str, collection_name: str = None) -> bool:
        """
        儲存單個文件到向量資料庫
        
        Args:
            json_file_name: JSON檔案名稱 (必須是翻譯後的JSON文件)
            collection_name: 向量資料庫集合名稱 (如未提供則使用json_file_name)

        Returns:
            是否儲存成功
        """
        try:
            if self.verbose:
                print(f"開始儲存文件: {json_file_name}")
            
            # 讀取翻譯資料
            document_chunks = self.document_processor.load_translated_json(json_file_name)
            if not document_chunks:
                print("未讀取到任何內容片段，請檢查翻譯文件")
                return False

            # 處理文件生成片段
            chunks = self.document_processor.process_chunks(document_chunks)
            if len(chunks) == 0:
                print("未生成任何內容片段")
                return False
            
            # 檢查embedding服務可用性
            if not self.embedding_service.is_available():
                print("Embedding服務不可用")
                return False

            # 生成embedding向量
            texts = [chunk.content for chunk in chunks]
            embeddings = self.embedding_service.get_embeddings(texts)
            
            # 如果文件已存在，先刪除
            collection_name = collection_name or json_file_name
            if self.vector_store.get_collection_info(collection_name)['document_count'] > 0:
                self.vector_store.delete_collection(collection_name)

            # 新增到向量資料庫
            success = self.vector_store.add_chunks(chunks, embeddings, collection_name=collection_name)

            if success and self.verbose:
                print(f"文件向量化儲存完成: {collection_name}, 集合包含 {len(chunks)} 個片段")
                return True
            else:
                print("向量資料庫新增失敗")
                return False
                
        except Exception as e:
            print(f"文件向量化儲存時出錯: {e}")
            return False

    def search(self, searching_content: str, collection_name: str,
        top_k: int = 7, filter_dict: Optional[Dict[str, Any]] = None,
    ) -> Optional[List[SearchResult]]:
        """
        查詢相關文件片段
        
        Args:
            collection_name: 向量資料庫集合名稱
            searching_content: 查詢內容
            top_k: 返回結果數量
            filter_dict: 過濾條件
            
        Returns:
            List[SearchResult]: 查詢結果列表 (如查無結果則為 None)
        """
        try:
            if self.verbose:
                print(f"開始查詢，查詢內容: {searching_content}, top_k: {top_k}, filter: {filter_dict}")

            # 獲取查詢的embedding向量
            content_embedding = self.embedding_service.get_embedding(searching_content)

            if content_embedding is None:
                print("無法獲取查詢的embedding向量")
                return None

            # 在向量資料庫中查詢
            results = self.vector_store.search(
                collection_name=collection_name,
                searching_embedding=content_embedding,
                n_results=top_k,
                filter_dict=filter_dict,
                include_distances=True
            )
            if results is None or not results['ids'][0]:
                if self.verbose:
                    print("未找到相關文件")
                return None

            # 轉換為SearchResult物件
            search_results = []
            for i in range(len(results['ids'][0])):
                chunk_id = results['ids'][0][i]
                content = results['documents'][0][i]
                metadata = results['metadatas'][0][i]
                distance = results['distances'][0][i]
                
                # 計算相似度分數 (距離越小，相似度越高)
                similarity_score = 1.0 - distance
                
                search_result = SearchResult(
                    chunk_id=chunk_id,
                    content=content,
                    document_name=metadata.get('document_name'),
                    page_num=metadata.get('page_num'),
                    score=similarity_score
                )
                search_results.append(search_result)
            
            if self.verbose:
                print(f"✅ RAGEngine查詢完成，返回 {len(search_results)} 個結果")
            return search_results
        except Exception as e:
            print(f"查詢時出錯: {e}")
            return None

    def _generate_answer(self, question: str, search_results: List[SearchResult]) -> Iterable[str]:
        """
        基於查詢結果生成答案
        
        Args:
            question: 用戶問題
            search_results: 查詢結果
            
        Returns:
            str: 生成的答案
        """
        if not self.llm_service:
            return "抱歉，無法生成答案。LLM服務未設定。"
        
        if not search_results:
            return "抱歉，沒有找到相關的文件內容來回答您的問題。"
        
        try:
            # 構建上下文
            context = self._generate_context(search_results)
            if self.verbose:
                print(f"生成的上下文:\n{context}")
            
            # 構建提示詞
            prompt = f"""基於以下文件內容回答問題。請提供準確、詳細的答案，並在適當的地方引用文件片段。

問題: {question}

相關文件內容:
{context}

請基於上述文件內容回答問題。如果文件中沒有足夠的資訊來完全回答問題，請說明這一點。在答案中適當引用文件片段編號。

答案:"""
            
            # 使用LLM生成答案
            answer = self.llm_service.send_single_request(prompt, stream=True)
            return answer
        except Exception as e:
            return f"抱歉，生成答案時發生錯誤: {str(e)}"

    def _generate_context(self, search_results: List[SearchResult]) -> str:
        """
        生成上下文提示詞

        Args:
            search_results: 查詢結果
            
        Returns:
            str: 上下文提示詞
        """
        context_parts = []
        for i, result in enumerate(search_results):
            context_piece = f"""[文件片段 {i+1}] (來源: {result.document_name}, 頁數: {result.page_num}, 相似度: {result.score:.3f}) {result.content}"""
            context_parts.append(context_piece)

        return "\n".join(context_parts)

    def ask(self, question: str, collection_name: str, top_k: int = 10, 
        filter_dict: Optional[Dict[str, Any]] = None, include_sources: bool = True
    ) -> RAGResponse:
        """
        完整的RAG查詢流程
        
        Args:
            collection_name: 向量資料庫集合名稱
            question: 用戶問題
            top_k: 查詢結果數量
            filter_dict: 過濾條件
            include_sources: 是否包含來源資訊
            
        Returns:
            RAGResponse: RAG系統回覆物件
                - status: 回傳狀態 ("success" 或 "error")
                - answer: 生成的答案 (可迭代物件)
                - sources: 相關內容片段 (如include_sources為True，否則為None)
                - query: 用戶查詢
        """
        start_time = time.time()
        
        try:
            # 查詢相關文件
            search_results = self.search(
                searching_content=question, 
                collection_name=collection_name, 
                top_k=top_k, 
                filter_dict=filter_dict
            )

            # 生成答案
            answer = self._generate_answer(question, search_results)
            
            response_time = time.time() - start_time
            
            return RAGResponse(
                status="success",
                answer=answer,
                sources=search_results if include_sources else None,
                query=question,
                response_time=response_time
            )
            
        except Exception as e:
            print(f"RAG查詢時出錯: {e}")
            return RAGResponse(
                status="error",
                answer=f"抱歉，處理您的問題時發生錯誤: {str(e)}",
                sources=None,
                query=question,
                response_time=time.time() - start_time
            )

    def get_system_info(self, collection_name: str = None) -> Dict[str, Any]:
        """
        獲取系統資訊

        Args:
            collection_name: 向量資料庫集合名稱 (如提供則返回該集合資訊)

        Returns:
            Dict: [str, Any] 系統資訊字典
                - vector_store_info: 向量資料庫資訊
                - embedding_model: 使用的embedding模型
                - llm_service: 使用的LLM服務
                - document_processor: 文件處理器設定
                - min_chunk_size: 內容片段最小長度
        """
        return {
            "vector_store_info": self.vector_store.get_collection_info(collection_name) if collection_name else "未指定集合",
            "embedding_model": self.embedding_service.model_name,
            "llm_service": self.llm_service.model_name if self.llm_service else "未設定",
            "document_processor": {
                "min_chunk_size": self.document_processor.min_chunk_size,
                "max_chunk_size": self.document_processor.max_chunk_size,
                "merge_short_chunks": self.document_processor.merge_short_chunks,
            }
        }
