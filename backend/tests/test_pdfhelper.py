import os
import sys
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

project_root = find_project_root()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
instance_path = os.path.join(str(project_root), "backend", "instance")

import argparse

from backend.api.pdf_helper import PDFHelper
from backend.api import Config, MinerUConfig, TranslatorConfig, EmbeddingServiceConfig, RAGConfig

def test_pdf_helper():
    parser = argparse.ArgumentParser(description="測試 PDFHelper 全流程")
    parser.add_argument("--json", type=str, default="", help="要加入 RAG 的 JSON 檔案名稱")
    parser.add_argument("--question", type=str, default="你好嗎?", help="測試問答的問題")
    parser.add_argument("--method", type=str, default="auto", help="重建 Markdown 方法")

    parser.add_argument("--provider", type=str, default="", help="LLM 服務提供者 (ollama, google, openai)")
    parser.add_argument("--model", type=str, default="", help="LLM 模型名稱 (例如: llama2, gemini-pro, gpt-4-turbo)")
    parser.add_argument("--apikey", type=str, default="", help="LLM API 金鑰")
    args = parser.parse_args()

    pdf_helper = PDFHelper(
        config=Config(
            instance_path=instance_path,
            mineru_config=MinerUConfig(verbose=False),
            translator_config=TranslatorConfig(verbose=True),
            embedding_service_config=EmbeddingServiceConfig(verbose=True),
            rag_config=RAGConfig(verbose=True),
        ),
        verbose=True
    )
    assert pdf_helper is not None
    assert pdf_helper.pdf_processor is not None
    assert pdf_helper.translator is not None
    assert pdf_helper.rag_engine is not None

    respond = pdf_helper.update_llm_service('translator', args.provider, args.apikey, args.model)
    if not respond['success']:
        raise ValueError(f"更新 LLM 服務失敗: {respond}")
    
    respond = pdf_helper.update_llm_service('embedding', args.provider, args.apikey, args.model)
    if not respond['success']:
        raise ValueError(f"更新 LLM 服務失敗: {respond}")

    respond = pdf_helper.update_llm_service('rag', args.provider, args.apikey, args.model)
    if not respond['success']:
        raise ValueError(f"更新 LLM 服務失敗: {respond}")

    print("1. 測試加入 RAG")
    respond = pdf_helper.add_json_to_rag(args.json)
    print(f"add_json_to_rag 回傳: {respond}")

    print("2. 測試問答功能")
    respond = pdf_helper.ask_question(args.question, document_name=args.json, top_k=5)
    print(f"問答回傳: {respond}")

    print("3. 測試重組 Markdown 檔案")
    respond = pdf_helper.reconstruct_markdown(args.json, method=args.method)
    print(f"重組回傳: {respond}")

    print("4. 測試獲取系統資訊")
    respond = pdf_helper.get_system_health()
    print(f"系統資訊: {respond}")

    print("所有測試通過！")

if __name__ == "__main__":
    test_pdf_helper()