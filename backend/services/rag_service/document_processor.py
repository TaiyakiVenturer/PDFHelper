"""
內容處理器 - 負責將翻譯後的JSON文件轉換為可查詢的內容片段
"""
import os
import json
import hashlib
from typing import Literal, List, Optional
from dataclasses import dataclass

@dataclass
class DocumentChunk:
    """
    內容片段 - 將內容分割為可查詢的片段

    Args:
        content: 內容片段 (text_zh)
        document_name: 來源文件名稱
        page_num: 內容所在頁數
        chunk_index: 片段在內容中的編號，用於排序
        content_type: 內容類型 (使用不同查詢策略)
        chunk_id: 片段ID，用於DB查詢和結果追蹤 (自動生成，不可手動設置)
    """
    content: str
    document_name: str
    page_num: int
    chunk_index: int
    content_type: Literal['title', 'abstract', 'body', 'reference']
    chunk_id: str = ""

    def __post_init__(self):
        """生成唯一的片段ID"""
        content_hash = hashlib.md5(self.content.encode()).hexdigest()[:8]
        # 使用內容名稱、片段編號和內容哈希處理生成唯一的片段ID
        self.chunk_id = f"{self.document_name}_chunk_{self.chunk_index:03d}_{content_hash}"

class DocumentProcessor:
    """文件內容處理器 - 將翻譯後的JSON文件轉換為可查詢的內容片段"""
    def __init__(
            self,
            instance_path: str,                 # 實例路径
            chunk_size_limit: int = 1200,       # 最大片段大小（字符數）
            min_chunk_size: int = 100,          # 最小片段大小 (小於此值會被合併)
            merge_short_chunks: bool = True,    # 是否合併過短的片段
            verbose: bool = False               # 是否輸出詳細日誌
        ):
        """
        初始化文件內容處理器
        
        Args:
            instance_path: 文件讀取及儲存路徑 (包含 translated_files 子目錄)
                - 用途: 存放翻譯後的JSON文件
                - 結構: 
                    instance_path/
                        translated_files/
                            doc1.json
                            doc2.json
                            ...
            chunk_size_limit: 單個片段的最大字數
                - 影響: 太大會影響embedding效果，太小會失去語義完整性
                - 建議: 1000-2000 (學術論文段落較長)

            min_chunk_size: 片段的最小字數
                - 影響: 小於此值的片段會被合併到下一個片段
                - 用途: 避免 "I. 引言" 這種短標題獨立成塊
                
            merge_short_chunks: 是否自動合併短片段
                - True: 短片段會與下一個片段合併，語義更完整
                - False: 保持原始片段，可能有很多短片段

            verbose: 是否輸出詳細日誌
        """
        self.instance_path = instance_path

        self.max_chunk_size = chunk_size_limit
        self.min_chunk_size = min_chunk_size
        self.merge_short_chunks = merge_short_chunks
        
        self.verbose = verbose

        if self.verbose:
            print(f"DocumentProcessor 初始化完成:")
            print(f" - 最大片段大小: {chunk_size_limit} 字")
            print(f" - 最小片段大小: {min_chunk_size} 字")
            print(f" - 合併短片段: {'是' if merge_short_chunks else '否'}")

    def load_translated_json(self, json_file_name: str) -> Optional[List[DocumentChunk]]:
        """
        讀取翻譯後的JSON文件，並生成內容片段列表

        Args:
            json_file_name: 翻譯JSON文件名稱
            
        Returns:
            List[DocumentChunk]: (出現錯誤會返回 None)
        """
        json_file_path = os.path.join(self.instance_path, "translated_files", json_file_name)
        if not os.path.exists(json_file_path):
            print(f"文件不存在: {json_file_path}")
            return None

        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        document_name = json_file_name

        chunks = []
        for index, item in enumerate(data):
            # 過濾掉沒有翻譯核心數據的項目 (圖片、公式、空字串等)
            if item.get("translation_metadata") == None:
                continue

            chunk = DocumentChunk(
                content=item.get("text_zh"),
                document_name=document_name,
                page_num=item.get("page_idx"),
                chunk_index=index,
                content_type=item.get("translation_metadata").get("content_type")
            )
            chunks.append(chunk)
        
        if self.verbose:
            print(f"已讀取並生成初始片段: {len(chunks)} 個 (來自 {json_file_path})")
        return chunks

    def process_chunks(self, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        """
        處理內容片段，根據內容類型進行不同的分段策略
        
        Args:
            chunks: 原始內容片段列表
            
        Returns:
            List[DocumentChunk]: 處理後的內容片段列表
        """
        processed_chunks = []
        
        for chunk in chunks:
            if chunk.content_type == 'title':
                processed = self._process_title(chunk, len(processed_chunks))
            elif chunk.content_type == 'abstract':
                processed = self._process_abstract(chunk, len(processed_chunks))
            elif chunk.content_type == 'body':
                processed = self._process_body(chunk, len(processed_chunks))
            elif chunk.content_type == 'reference':
                processed = self._process_reference(chunk, len(processed_chunks))
            else:
                # 未知類型，保持原樣
                raise ValueError(f"未知的content_type: {chunk}")
            
            processed_chunks.extend(processed)
        
        if self.verbose:
            print(f"處理後的片段總數: {len(processed_chunks)} 個")
        return processed_chunks

    def _process_title(self, base_chunk: DocumentChunk, index_start: int) -> List[DocumentChunk]:
        """
        標題處理：永遠不分段，保持完整

        Args:
            base_chunk: 原始內容片段
            index_start: 起始編號

        Returns:
            List[DocumentChunk]: 處理後的內容片段列表
        """
        base_chunk.chunk_index = index_start

        # 標題永遠保持完整，不管多長
        return [base_chunk]

    def _process_abstract(self, base_chunk: DocumentChunk, index_start: int) -> List[DocumentChunk]:
        """
        摘要處理：根據長度進行分段
        
        Args:
            base_chunk: 原始內容片段
            index_start: 起始編號

        Returns:
            List[DocumentChunk]: 處理後的內容片段列表
        """
        if len(base_chunk.content) <= self.max_chunk_size:
            # 在限制內，保持原樣
            base_chunk.chunk_index = index_start
            return [base_chunk]

        # 以句號分割並過濾空字串
        content_list = []
        for content in base_chunk.content.split("。"):
            if content == "":
                continue
            content_list.append(content)

        remaining = True
        while remaining:
            remaining = False
            combine_contents = []

            for index in range(len(content_list)):
                # 跳過已合併的片段
                if content_list[index] == "":
                    continue

                # 如果是最後一個片段，直接加入
                if index == len(content_list) - 1:
                    combine_contents.append(content_list[index])
                    continue

                for next_index in range(index + 1, len(content_list)):
                    if (len(content_list[index]) + len(content_list[next_index]) + 1) <= self.max_chunk_size \
                        and content_list[next_index] != "":
                        combine_contents.append("。".join([content_list[index], content_list[next_index]]))
                        content_list[index] = content_list[next_index] = ""  # 清空已合併的內容
                        remaining = True    # 記錄還有剩餘內容
                        break   # 一旦找到第一個可合併的就跳出
                    else:
                        pass
                # 過濾掉已合併的內容
                if content_list[index] != "":
                    combine_contents.append(content_list[index])
                    content_list[index] = ""
            content_list = combine_contents
        
        chunks = [
            DocumentChunk(
                content=text,
                document_name=base_chunk.document_name,
                page_num=base_chunk.page_num,
                chunk_index=index_start + index,  # 遞增編號
                content_type=base_chunk.content_type
            ) for index, text in enumerate(content_list)
        ]
        return chunks

    def _process_body(self, base_chunk: DocumentChunk, index_start: int) -> List[DocumentChunk]:
        """
        內容處理：根據長度進行分段

        Args:
            base_chunk: 原始內容片段
            index_start: 起始編號

        Returns:
            List[DocumentChunk]: 處理後的內容片段列表
        """
        content_list = []
        for content in base_chunk.content.split("。"):
            if content == "":
                continue
            content_list.append(content)
        
        if self.merge_short_chunks:
            remaining = True
            while remaining:
                remaining = False
                combine_contents = []

                for index in range(len(content_list)):
                    # 跳過已合併的片段
                    if content_list[index] == "":
                        continue

                    # 如果是最後一個元素，直接添加
                    if index == len(content_list) - 1:
                        combine_contents.append(content_list[index])
                        continue

                    for next_index in range(index + 1, len(content_list)):
                        if content_list[next_index] != "" \
                            and (len(content_list[index]) + len(content_list[next_index]) + 1) > self.min_chunk_size \
                            and (len(content_list[index]) + len(content_list[next_index]) + 1) <= self.max_chunk_size:
                            combine_contents.append("。".join([content_list[index], content_list[next_index]]))
                            content_list[index] = content_list[next_index] = ""  # 清空已合併的內容
                            remaining = True    # 記錄還有剩餘內容
                            break   # 一旦找到第一個可合併的就跳出
                        else:
                            pass
                    # 過濾掉已合併的內容
                    if content_list[index] != "":
                        combine_contents.append(content_list[index])
                        content_list[index] = ""
                content_list = combine_contents

        return [
            DocumentChunk(
                content=text,
                document_name=base_chunk.document_name,
                page_num=base_chunk.page_num,
                chunk_index=index_start + index,
                content_type=base_chunk.content_type
            ) for index, text in enumerate(content_list)
        ]

    def _process_reference(self, base_chunk: DocumentChunk, index_start: int) -> List[DocumentChunk]:
        """
        參考文獻處理：保持完整

        Args:
            base_chunk: 原始內容片段
            index_start: 起始編號

        Returns:
            List[DocumentChunk]: 處理後的內容片段列表
        """
        references = base_chunk.content.split("\n")
        chunks = [
            DocumentChunk(
                content=ref,
                document_name=base_chunk.document_name,
                page_num=base_chunk.page_num,
                chunk_index=index_start + index,
                content_type=base_chunk.content_type
            ) for index, ref in enumerate(references) if ref.strip()
        ]

        return chunks
