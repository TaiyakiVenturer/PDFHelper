import os
import sys
from pathlib import Path

# 確保測試環境使用 UTF-8 編碼（與 Electron 環境一致）
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

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

project_root = find_project_root()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
instance_path = os.path.join(str(project_root), "backend", "instance")

import argparse

from backend.services.rag_service import DocumentProcessor, EmbeddingService, ChromaVectorStore, RAGEngine
import backend.services.llm_service as llm_services

def main():
    parser = argparse.ArgumentParser(description="RAG 系統基礎功能測試")
    parser.add_argument("--json", type=str, default="", help="測試用 JSON 檔案名稱")
    parser.add_argument("--question", type=str, default="這個文件的主題?", help="測試搜尋的問題")
    
    parser.add_argument("--model", type=str, default="", help="LLM 模型名稱 (例如: llama2, gemini-pro, gpt-4-turbo)")
    parser.add_argument("--apikey", type=str, default="", help="LLM API 金鑰")
    args = parser.parse_args()

    print("1. 初始化 RAG 引擎")
    try:
        # 初始化 DocumentProcessor
        document_processor = DocumentProcessor(
            instance_path=instance_path,
            min_chunk_size=100,
            max_chunk_size=1200,
            merge_short_chunks=True,
            verbose=True
        )
        # 初始化 LLM Service (Gemini)
        llm_service = llm_services.GoogleService(
            model_name=args.model,
            api_key=args.apikey,
            verbose=True
        )
        # llm_service = llm_services.OllamaService(
        #     model_name=args.model,  # 可依實際 API Key 與模型調整
        #     api_key=args.apikey,
        #     verbose=True
        # )

        # 初始化 EmbeddingService
        embedding_service = EmbeddingService(
            llm_service_obj=llm_service,
            max_retries=3,
            retry_delay=1,
            verbose=True
        )
        # 初始化 ChromaVectorStore
        vector_store = ChromaVectorStore(
            instance_path=instance_path,
            persist_directory_name="chroma_db",
            collection_cache_size=3,
            verbose=True
        )
        # 初始化 RAGEngine
        rag = RAGEngine(
            document_processor_obj=document_processor,
            embedding_service_obj=embedding_service,
            chromadb_obj=vector_store,
            llm_service_obj=llm_service,
            verbose=True
        )
        print("✅ RAG 引擎初始化成功")
    except Exception as e:
        print(f"❌ RAG 引擎初始化失敗: {e}")
        return

    print("2. 測試 Embedding 產生")
    try:
        test_text = "這是一個測試字串，用於驗證embedding功能。"
        embedding = rag.embedding_service.get_embedding(test_text)
        if embedding:
            print(f"✅ Embedding 產生成功，維度: {len(embedding)}")
            print(f"   前5個值: {embedding[:5]}")
        else:
            print("❌ Embedding 產生失敗")
    except Exception as e:
        print(f"❌ 測試 Embedding 時出錯: {e}")

    print("3. 測試向量資料庫索引與搜尋")
    try:
        success = rag.store_document_into_vectordb(args.json)
        if success:
            print("✅ 文件索引成功")
            search_results = rag.search(args.question, args.json, top_k=3)
            print(f"搜尋結果數量: {len(search_results)}")
            for i, result in enumerate(search_results[:2]):
                print(f"結果 {i+1}: {getattr(result, 'content', str(result))[:100]}...")
        else:
            print("❌ 文件索引失敗")
    except Exception as e:
        print(f"❌ 索引或搜尋時出錯: {e}")

    print("4. 測試 LLM 問答功能 (可選)")
    try:
        collection_names = Path(args.json).stem
        response = rag.ask(args.question, collection_name=collection_names, top_k=3, include_sources=True)
        print(f"✅ 問答測試完成")
        print(f"狀態: {getattr(response, 'status', None)}")
        print(f"查詢: {getattr(response, 'query', None)}")
        print(f"回答: ", end="")
        for chunk in getattr(response, 'answer', []):
            print(getattr(chunk, 'text', str(chunk)), end="", flush=True)
        print()  # 換行
        print(f"響應時間: {getattr(response, 'response_time', 0):.2f}秒")
    except Exception as e:
        print(f"⚠️ 問答測試失敗: {e}")

    print("5. 系統信息總結")
    try:
        system_info = rag.get_system_info(args.json)
        print("✅ 系統信息:")
        for key, value in system_info.items():
            print(f"   {key}: {value}")
    except Exception as e:
        print(f"❌ 獲取系統信息失敗: {e}")

    print("\n" + "=" * 50)
    print("🎉 RAG系統基礎功能測試完成")

if __name__ == "__main__":
    main()
