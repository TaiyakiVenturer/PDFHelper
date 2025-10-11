import sys
from pathlib import Path

# 🔧 自動修正 PYTHONPATH - 確保無論如何執行都能找到模組
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.api import PDFHelper, Config, MinerUConfig, TranslatorConfig, EmbeddingServiceConfig, RAGConfig
import pprint as pp

def test_pdf_helper():
    # 測試 PDFHelper 的初始化
    pdf_helper = PDFHelper(
        config=Config(
            mineru_config=MinerUConfig(verbose=False),
            translator_config=TranslatorConfig(verbose=True),
            embedding_service_config=EmbeddingServiceConfig(
                llm_service="ollama",
                verbose=True
            ),
            rag_config=RAGConfig(verbose=True),
        ), 
        verbose=True
    )
    assert pdf_helper is not None
    assert pdf_helper.pdf_processor is not None
    assert pdf_helper.translator is not None
    assert pdf_helper.rag_engine is not None

    test_document = "SiLU.pdf"  # 確保這個檔案存在於測試目錄中

    # 1. 一次測試完整流程
    print("1. 測試完整流程")
    # respond = pdf_helper.process_pdf_to_json(test_document)
    # respond = pdf_helper.from_pdf_to_rag(test_document)
    respond = pdf_helper.add_json_to_rag("3_11_translated.json")
    print(respond)

    # collection_name = respond.data.get("collection_name")
    collection_name = "3_11_translated.json"

    # 2. 測試問答功能
    print("2. 測試問答功能")
    question = "請問這個論文是用哪一種深度學習強化演算法?"
    respond = pdf_helper.ask_question(question, document_name=collection_name, top_k=5)
    pp.pprint(respond)
    for chunk in respond.data.get("answer"):
        print(chunk.text, end="", flush=True)
    print()

    # 3. 重組MarkDown檔案
    print("3. 測試重組MarkDown檔案")
    respond = pdf_helper.reconstruct_markdown(collection_name, method="auto")
    pp.pprint(respond)

    # 4. 獲取系統資訊
    print("4. 測試獲取系統資訊")
    respond = pdf_helper.get_system_health()
    pp.pprint(respond)

if __name__ == "__main__":
    test_pdf_helper()
    print("所有測試通過！")