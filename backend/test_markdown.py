import sys
from pathlib import Path

# 🔧 自動修正 PYTHONPATH - 確保無論如何執行都能找到模組
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import os

from services.pdf_service import MarkdownReconstructor

def test_markdown_reconstructor():
    instance_path = os.path.join(os.path.dirname(__file__), "instance")

    reconstructor = MarkdownReconstructor(instance_path, verbose=True)

    print("重組後的.md檔案路徑:", reconstructor.reconstruct("doc_f6a48d55", method="auto"))

if __name__ == "__main__":
    test_markdown_reconstructor()