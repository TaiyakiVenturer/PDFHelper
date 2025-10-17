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

from backend.services.pdf_service import MarkdownReconstructor

def test_markdown_reconstructor():
    parser = argparse.ArgumentParser(description="測試 Markdown 重建器")
    parser.add_argument("--json", type=str, default="", help="要重建的文檔翻譯後的Json檔案名稱含副檔 (例如: example_translated.json)")
    parser.add_argument("--method", type=str, default="auto", help="重建方法")
    args = parser.parse_args()

    reconstructor = MarkdownReconstructor(instance_path, verbose=True)

    result = reconstructor.reconstruct(args.json, method=args.method)
    print(f"重組後的 .md 檔案路徑: {result}")

if __name__ == "__main__":
    test_markdown_reconstructor()