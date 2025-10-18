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

from backend.api.pdf_helper import PDFHelper
from backend.api import Config, MinerUConfig, TranslatorConfig, EmbeddingServiceConfig, RAGConfig

def test_file_remove():
    parser = argparse.ArgumentParser(description="測試 PDFHelper 全流程")
    parser.add_argument("--file", type=str, default="", help="要移除的檔案名稱")
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

    respond = pdf_helper.remove_file_from_system(args.file)
    print(respond.message)

if __name__ == "__main__":
    test_file_remove()