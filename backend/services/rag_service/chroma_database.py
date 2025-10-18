"""
ChromaDB向量存儲服務
"""
import json
import os
from typing import List, Dict, Any, Optional, Literal

import chromadb
from chromadb.config import Settings

from .document_processor import DocumentChunk
from .embedding_service import EmbeddingService

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class ChromaVectorStore:
    """基於ChromaDB的向量儲存服務"""
    
    def __init__(
        self,
        instance_path: str,
        persist_directory_name: str = "chroma_db",
        collection_cache_size: int = 3,
        verbose: bool = False
    ):
        """
        初始化ChromaDB向量儲存服務

        Args:
            instance_path: ChromaDB物件路徑
            persist_directory_name: 資料寫入儲存目錄名稱
            collection_cache_limit: 集合緩存數量上限 (用於避免頻繁加載)
            verbose: 是否啟用詳細日誌
        """
        # 創建持久化目錄
        self.instance_path = instance_path
        self.persist_directory = os.path.join(self.instance_path, persist_directory_name)
        os.makedirs(self.persist_directory, exist_ok=True)

        self.collection_cache_size = max(collection_cache_size, 1)
        self.collection_cache: Dict[str, chromadb.Collection] = {}  # 用於緩存集合物件 (名稱, 物件)

        self.verbose = verbose
        
        # 初始化ChromaDB客戶端
        self.client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )

        if self.verbose:
            logger.info(f"ChromaDB向量儲存服務初始化完成，持久化目錄: {self.persist_directory}")

    def get_create_collection(self, collection_name: str, 
        distance_metric: Literal['cosine', 'l2', 'ip'], load_into_cache: bool = True
    ) -> Optional[chromadb.Collection]:
        """
        獲取集合物件 (並存入緩存)

        Args:
            collection_name: 集合名稱
            distance_metric: 距離計算方法 (cosine/l2/ip)
                - cosine: 適合文本相似度 (0~2，越小越相似)
                - l2: 適合圖像相似度 (0~無限大，越小越相似)
                - ip: 內積，適合某些特定場景 (-無限大~無限大，越大越相似)
            load_into_cache: 是否將獲取的集合存入緩存

        Returns:
            chromadb.Collection: 集合物件 (失敗返回None)
        """
        # 已在緩存中，獲取成功
        if collection_name in self.collection_cache:
            return self.collection_cache[collection_name]

        try:    # 嘗試獲取現有集合
            collection = self.client.get_collection(name=collection_name)
            if self.verbose:
                logger.info(f"獲取現有集合: {collection_name}")

            if not load_into_cache:
                return collection
        except Exception as e:
            try:
                collection = self.client.create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": distance_metric}
                )
                if self.verbose:
                    logger.info(f"創建新集合: {collection_name}")
                
                if not load_into_cache:
                    return collection
            except Exception as e:
                logger.error(f"創建集合時出錯: {e}")
                return None

        if len(self.collection_cache) + 1 > self.collection_cache_size:
            # 超過緩存上限，刪除最舊的集合
            name = next(iter(self.collection_cache))
            del self.collection_cache[name]
            logger.info(f"刪除緩存集合: {name}")

        self.collection_cache[collection_name] = collection
        return collection

    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]], collection_name: str = None) -> bool:
        """
        新增內容片段和對應的embedding向量
        
        Args:
            chunks: 內容片段列表
            embeddings: 對應的embedding向量列表
            collection_name: 向量資料庫集合名稱 (如未提供則使用chunks中的document_name)

        Returns:
            是否成功
        """
        if len(chunks) == 0 or len(embeddings) == 0 or len(chunks) != len(embeddings):
            logger.error(f"片段列表: {chunks} 或embedding列表: {embeddings} 無效或長度不匹配，操作終止")
            return False

        if self.verbose:
            logger.info(f"準備新增 {len(chunks)} 個片段到向量資料庫")
            logger.info(f"第一個片段內容預覽: {chunks[0].content[:100]}...")
            logger.info(f"Embedding維度: {len(embeddings[0]) if embeddings else 0}")

        # 獲取集合
        collection_name = collection_name or chunks[0].document_name
        collection = self.get_create_collection(
            collection_name=collection_name,    # 使用內容名稱作為集合名稱
            distance_metric="cosine"            # 適合文本相似度
        )
        if collection is None:
            logger.error("無法獲取或創建集合，操作終止")
            return False

        try:
            ids = [chunk.chunk_id for chunk in chunks]
            existing_results = collection.get(ids=ids, include=[])['ids']
            existing_ids = set(existing_results['ids']) if existing_results else set()

            filtered_chunks = [chunk for chunk in chunks if chunk.chunk_id not in existing_ids]
            filtered_embeddings = [embed for chunk, embed in zip(chunks, embeddings) if chunk.chunk_id not in existing_ids]

            if len(filtered_chunks) == 0:
                logger.info("所有片段均已存在於資料庫中，無需新增")
                return True

            if self.verbose and len(filtered_chunks) > 0:
                logger.info(f"濾除重複的片段，剩餘 {len(filtered_chunks)} 筆資料將被新增至資料庫")

            # 準備數據
            contents = [chunk.content for chunk in filtered_chunks] # 文本內容
            metadatas = [                                           # 核心數據列表
                {
                    "document_name": chunk.document_name,           # 內容名稱
                    "page_num": chunk.page_num,                     # 頁碼
                    "chunk_index": chunk.chunk_index,               # 片段索引
                }
                for chunk in filtered_chunks
            ]
            ids = [chunk.chunk_id for chunk in filtered_chunks]      # 使用chunk_id作為唯一ID

            # 批次新增到集合
            collection.add(
                ids=ids,
                documents=contents,
                embeddings=filtered_embeddings,
                metadatas=metadatas
            )

            logger.info(f"成功新增 {len(filtered_chunks)} 個內容片段到向量資料庫")
            return True
            
        except Exception as e:
            logger.error(f"新增內容片段時出錯: {e}")
            return False

    def search(self, collection_name: str, searching_embedding: List[float], n_results: int = 10, 
        filter_dict: Optional[Dict[str, Any]] = None, include_distances: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        直接使用embedding向量查詢相似內容
        
        Args:
            collection_name: 集合名稱 (通常為檔案名稱)
            searching_embedding: 查詢的embedding向量
            n_results: 返回結果數量
            filter_dict: 過濾條件
            include_distances: 是否包含距離分數
            
        Returns:
            Dict: 查詢結果 (失敗返回None)
                - ids: List[List[str]] 片段ID列表
                - documents: List[List[str]] 片段內容列表
                - metadatas: List[List[Dict[str, Any]]] 片段核心數據列表
                - distances: List[List[float]] 距離分數列表 (如果include_distances為True)
        """
        try:
            include_list = ["documents", "metadatas"]
            if include_distances:
                include_list.append("distances")
            
            # 獲取集合物件
            collection = self.get_create_collection(
                collection_name=collection_name,
                distance_metric="cosine"
            )
            if collection is None:
                logger.error("無法獲取集合，操作終止")
                return None
            
            # 執行查詢
            results = collection.query(
                query_embeddings=[searching_embedding],
                n_results=n_results,
                where=filter_dict,
                include=include_list
            )
            if len(results['ids'][0]) == 0:
                logger.warning("資料庫內查無關於此內容的資料")
                return None

            logger.info(f"ChromaDB查詢完成，返回 {len(results['ids'][0])} 個結果")
            return results
            
        except Exception as e:
            logger.error(f"查詢時出錯: {e}")
            return None

    def get_collection_info(self, document_name: str) -> Optional[Dict[str, Any]]:
        """
        獲取集合資訊

        Args:
            document_name: 集合名稱 (通常為檔案名稱)
        
        Returns:
            Dict ([str, Any]): 集合資訊字典
                - collection_name: 集合名稱
                - document_count: 內容數量
                - distance_metric: 距離計算方法
                - persist_directory: 持久化目錄
        """
        # 獲取集合物件
        collection = self.get_create_collection(
            collection_name=document_name,
            distance_metric="cosine",
            load_into_cache=False
        )
        if collection is None:
            logger.error("無法獲取集合，操作終止")
            return None

        try:
            return {
                "collection_name": document_name,
                "document_count": collection.count(),
                "distance_metric": collection.metadata.get("hnsw:space", "unknown"),
                "persist_directory": str(self.persist_directory)
            }
        except Exception as e:
            logger.error(f"獲取集合資訊時出錯: {e}")
            return None

    def delete_collection(self, document_name: str) -> bool:
        """
        刪除指定集合
        
        Args:
            document_name: 集合名稱 (通常為檔案名稱)
        
        Returns:
            是否成功
        """
        try:
            # 刪除現有集合
            self.client.delete_collection(name=document_name)

            # 檢查集合是否真的被刪除
            try:
                collection = self.client.get_collection(name="SiLU_translated.json")
                raise ValueError(f"集合 {collection.name} 仍然存在")  # 這不應該出現
            except:
                logger.info(f"集合 {document_name} 已成功刪除")  # 這是正常的
            return True
        except Exception as e:
            logger.error(f"刪除集合時出錯: {e}")
            return False

    def update_chunk(self, update_id: str, new_embedding: List[float], 
        new_content: str = None, new_page_num: int = None, new_chunk_index: int = None
    ) -> bool:
        """
        更新單個內容片段

        Args:
            update_id: 要更新的片段ID
            new_embedding: 新的embedding向量
            new_content: 新的內容
            new_page_num: 新的頁碼
            new_chunk_index: 新的片段索引

        Returns:
            是否成功
        """
        # 從片段ID中提取內容名稱
        document_name = update_id.split("_")[0]

        # 獲取集合物件
        collection = self.get_create_collection(
            collection_name=document_name,
            distance_metric="cosine"
        )
        if collection is None:
            logger.error("無法獲取集合，操作終止")
            return False
        
        if new_embedding is None:
            logger.error("新的embedding無效，操作終止")
            return False

        if new_page_num is None or new_chunk_index is None:
            # 嘗試從現有數據中獲取
            existing = collection.get(ids=[update_id], include=["metadatas"])
            if not existing['ids'] or not existing['metadatas']:
                logger.warning("無法獲取請求片段的核心數據，請提供新的頁碼和片段索引")
                return False
            
            metadata = existing['metadatas'][0]
            if new_page_num is None:
                new_page_num = metadata.get("page_num")
            if new_chunk_index is None:
                new_chunk_index = metadata.get("chunk_index")

        try:
            collection.update(
                ids=[update_id],
                documents=[new_content],
                embeddings=[new_embedding],
                metadatas=[
                    {
                        "document_name": document_name,
                        "page_num": new_page_num,
                        "chunk_index": new_chunk_index,
                    }
                ]
            )
            logger.info(f"成功更新片段 {update_id}")
            return True
                
        except Exception as e:
            logger.error(f"更新片段時出錯: {e}")
            return False

    def export_collection(self, document_name: str, output_file: str) -> bool:
        """
        導出集合數據到JSON文件

        Args:
            document_name: 集合名稱 (通常為檔案名稱)
            output_file: 輸出文件路徑
        
        Returns:
            是否成功
        """
        # 獲取集合物件
        collection = self.get_create_collection(
            collection_name=document_name,
            distance_metric="cosine",
            load_into_cache=False
        )
        if collection is None:
            logger.error("無法獲取集合，操作終止")
            return False

        try:
            # 獲取所有數據
            results = collection.get(
                include=["documents", "metadatas", "embeddings"]
            )
            
            export_data = {
                "collection_name": document_name,
                "distance_metric": collection.metadata.get("hnsw:space", "unknown"),
                "export_timestamp": chromadb.utils.time.now().isoformat(),
                "total_chunks": collection.count(),
                "data": results
            }
            
            # 保存到JSON文件
            output_path = os.path.join(self.persist_directory, output_file)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)

            logger.info(f"集合資料已導出到 {output_path}")
            return True
        except Exception as e:
            logger.error(f"導出集合資料時出錯: {e}")
            return False

    def import_collection(self, input_file_name: str) -> bool:
        """
        從JSON文件導入集合資料

        Args:
            input_file_name: 輸入文件路徑
        
        Returns:
            是否成功
        """
        input_path = os.path.join(self.persist_directory, input_file_name)
        if not os.path.isfile(input_path):
            logger.error(f"輸入文件不存在: {input_path}")
            return False

        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                import_data = json.load(f)
            
            collection_name = import_data.get("collection_name")
            distance_metric = import_data.get("distance_metric")
            data = import_data.get("data")
            
            if not collection_name or not data:
                logger.error("輸入文件格式不正確，缺少必要字段")
                return False
            
            # 獲取或創建集合
            collection = self.get_create_collection(
                collection_name=collection_name,
                distance_metric=distance_metric
            )
            if collection is None:
                logger.error("無法獲取或創建集合，操作終止")
                return False
            
            # 新增數據到集合
            collection.add(
                ids=data.get("ids", []),
                documents=data.get("documents", []),
                embeddings=data.get("embeddings", []),
                metadatas=data.get("metadatas", [])
            )

            logger.info(f"集合數據已從 {input_path} 導入到 {collection_name}")
            return True
        except Exception as e:
            logger.error(f"導入集合數據時出錯: {e}")
            return False

    def list_collections(self) -> List[str]:
        """
        列出所有集合名稱

        Returns:
            List[str]: 集合名稱列表
        """
        try:
            collections = self.client.list_collections()
            collection_names = [col.name for col in collections]
            logger.info(f"目前存在的集合: {collection_names}")
            return collection_names
        except Exception as e:
            logger.error(f"列出集合時出錯: {e}")
            return []
