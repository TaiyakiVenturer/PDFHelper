"""
RAG系統測試文件 - 驗證基礎功能
"""

from services.rag_service import RAGEngine

def test_basic_rag_functionality():
    """測試RAG系統基礎功能"""
    
    print("🚀 開始RAG系統基礎功能測試")
    print("=" * 50)
    
    # 1. 初始化RAG引擎
    print("\n1. 初始化RAG引擎...")
    try:
        rag = RAGEngine(
            instance_path="./instance",
            llm_service="gemini",
            verbose=True
        )
        print("✅ RAG引擎初始化成功")
    except Exception as e:
        print(f"❌ RAG引擎初始化失敗: {e}")
        return False
    
    # 2. 測試基礎embedding功能
    print("\n2. 測試Embedding生成...")
    try:
        test_text = "這是一個測試字串，用於驗證embedding功能。"
        embedding = rag.embedding_service.get_embedding(test_text)

        if embedding:
            print(f"✅ Embedding生成成功，維度: {len(embedding)}")
            print(f"   前5個值: {embedding[:5]}")
        else:
            print("❌ Embedding生成失敗")
            return False
    except Exception as e:
        print(f"❌ 測試Embedding時出錯: {e}")
        return False
    
    # 3. 測試向量數據庫
    print("\n3. 測試向量數據庫...")
    try:
        db_info = rag.vector_store.get_collection_info("SiLU_translated.json")
        print(f"✅ 向量數據庫信息: {db_info}")
    except Exception as e:
        print(f"❌ 向量數據庫測試失敗: {e}")
        return False
    
    # 4. 測試文檔索引 (如果有測試文檔)
    print("\n4. 檢查測試文檔...")
    test_content_paths = [
        "SiLU_translated.json"
    ]
    
    for content_path in test_content_paths:
        try:
            print("   正在索引測試文檔...")
            success = rag.store_document_into_vectordb(content_path)
            if success:
                print("   ✅ 文檔索引成功")
                
                # 測試搜索功能
                print("   測試搜索功能...")
                search_results = rag.search("這個文件的主題?", "SiLU_translated.json", top_k=3)
                print(f"   ✅ 搜索完成，找到 {len(search_results)} 個結果")
                
                if search_results:
                    for i, result in enumerate(search_results[:2]):
                        print(f"   結果 {i+1}: {result.content[:100]}...")
                
                break
            else:
                print("   ❌ 文檔索引失敗")
        except Exception as e:
            print(f"   ❌ 索引文檔時出錯: {e}")
    
    # 5. 設置LLM服務 (可選)
    print("\n5. 測試LLM集成...")
    try:
        print("   測試問答功能...")
        try:
            response = rag.ask("這個文件的主題?", collection_name="SiLU_translated.json", top_k=3, include_sources=False)
            print(f"   ✅ 問答測試完成")
            print(f"   狀態: {response.status}")
            print(f"   查詢: {response.query}")
            print(f"   回答: ", end="")
            for chunk in response.answer:
                print(chunk.text, end="", flush=True)
            print()  # 換行
            print(f"   響應時間: {response.response_time:.2f}秒")
        except Exception as e:
            print(f"   ⚠️ 問答測試失敗: {e}")
        
    except Exception as e:
        print(f"⚠️ LLM服務設置失敗: {e}")
        print("   這是可選功能，不影響基礎檢索功能")
    
    # 6. 系統信息總結
    print("\n6. 系統信息總結")
    try:
        system_info = rag.get_system_info("SiLU_translated.json")
        print("✅ 系統信息:")
        for key, value in system_info.items():
            print(f"   {key}: {value}")
    except Exception as e:
        print(f"❌ 獲取系統信息失敗: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 RAG系統基礎功能測試完成")
    return True


def test_document_processor():
    """測試文檔處理器"""
    print("\n🔧 測試文檔處理器...")
    
    from services.rag_service.document_processor import DocumentProcessor
    
    processor = DocumentProcessor(instance_path="./instance", verbose=True)
    
    # 查找測試文檔
    test_paths = [
        "SiLU_translated.json"
    ]
    
    for test_path in test_paths:
        try:
            chunks = processor.load_translated_json(test_path)
            if not chunks:
                print("   ❌ 加載切片失敗")
                continue
            chunks = processor.process_chunks(chunks)
            print(f"   ✅ 處理完成，生成 {len(chunks)} 個切片")
            
            if chunks:
                print(f"   示例切片:")
                for i, chunk in enumerate(chunks[:2]):
                    print(f"   切片 {i+1}: {chunk.content[:100]}...")
                    print(f"   ID: {chunk.chunk_id}")
                    print(f"   文檔名稱: {chunk.document_name}")
                    print(f"   頁碼: {chunk.page_num}")
            
            return True
        except Exception as e:
            print(f"   ❌ 處理文檔失敗: {e}")
    
    print("   ⚠️ 未找到測試文檔")
    return False


def main():
    """主函數"""
    print("🚀 RAG系統全面測試開始")
    
    # 測試文檔處理器
    test_document_processor()
    
    # 測試完整RAG功能
    test_basic_rag_functionality()


if __name__ == "__main__":
    main()
