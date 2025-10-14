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

from backend.services.pdf_service import MinerUProcessor

def test_mineru_processor():
    parser = argparse.ArgumentParser(description="測試 MinerU PDF 處理器")
    parser.add_argument("--pdf", type=str, default="", help="要處理的 PDF 檔案名稱")
    parser.add_argument("--method", type=str, default="auto", help="處理方法")
    parser.add_argument("--device", type=str, default="cpu", help="處理設備")
    args = parser.parse_args()

    processor = MinerUProcessor(instance_path, verbose=True)

    print(f"開始處理 PDF: {args.pdf}")
    result = processor.process_pdf_with_mineru(args.pdf, method=args.method, device=args.device)

    if result["success"]:
        print(f"處理成功，處理時間: {result['processing_time']:.2f} 秒")
        print(f"輸出目錄: {result['output_path']}")
        print(f"Markdown 檔案: {result['output_file_paths'].get('markdown', '未生成')}")
        print(f"JSON 檔案: {result['output_file_paths'].get('json', '未生成')}")
        print(f"圖片檔案: {result['output_file_paths'].get('images', [])}")
    else:
        print(f"處理失敗: {result}")

if __name__ == "__main__":
    test_mineru_processor()