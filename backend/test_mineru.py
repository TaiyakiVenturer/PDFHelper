import sys
from pathlib import Path

# 🔧 自動修正 PYTHONPATH - 確保無論如何執行都能找到模組
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from services.pdf_service import MinerUProcessor

import os
instance_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "instance"))

if __name__ == "__main__":
    print("🚀 MinerU PDF處理測試")
    print("="*50)
    
    # 測試MinerU處理
    processor = MinerUProcessor(instance_path)

    # 測試PDF路徑
    pdf_name = "Toward_Deploying_Parallelized_Service_Function_Chains_Under_Dynamic_Resource_Request_in_Multi-Access_Edge_Computing.pdf"
    
    print(f"🔄 開始處理PDF: {pdf_name}")
    print("="*50)
    
    # 使用MinerU處理PDF
    result = processor.process_pdf_with_mineru(pdf_name)

    if result["success"]:
        print("\n📊 處理結果:")
        print(f"⏱️  處理時間: {result['processing_time']:.2f}秒")
        print(f"📁 輸出目錄: {result['output_path']}")
        print(f"📄 Markdown檔案: {result['output_file_paths'].get('markdown', '未生成')}")
        print(f"📄 JSON檔案: {result['output_file_paths'].get('json', '未生成')}")
        print(f"🖼️  圖片檔案: {result['output_file_paths'].get('images', [])}")

    else:
        print("\n❌ 處理失敗:")