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
import time
import json

from backend.services.translation_service import Translator
import backend.services.llm_service as llm_services

def test_single_sentence(translator):
    print("📝 測試模式 1: 單句翻譯")
    test_cases = [
        {"text": "Autonomous Network Optimization and Dynamic Channel Allocation for Cognitive Radio-Based Consumer IoT", "type": "title"},
        {"text": "The heterogeneous environment of next-generation Consumer Internet of Things (CIoT) demands efficient resource utilization and reliable network services.", "type": "abstract"},
        {"text": "Machine learning algorithms enable autonomous decision-making in cognitive radio networks.", "type": "body"},
        {"text": "Zhang, L., & Wang, H. (2023). Cognitive radio networks: A comprehensive survey. IEEE Communications Surveys & Tutorials, 25(2), 1123-1145.", "type": "reference"}
    ]
    for i, case in enumerate(test_cases, 1):
        print(f"\n📝 測試案例 {i} ({case['type']}):")
        print(f"原文: {case['text']}")
        start_time = time.time()
        translated = translator.translate_single_text(
            text=case['text'],
            content_type=case['type']
        )
        end_time = time.time()
        print(f"譯文: {translated}")
        print(f"⏱️  耗時: {end_time - start_time:.2f}秒")
        print("-" * 30)
    if hasattr(translator, 'term_dictionary') and translator.term_dictionary:
        print(f"\n📚 建立的術語對照表:")
        for en, zh in translator.term_dictionary.items():
            print(f"  {en} → {zh}")

def test_partial_content(translator):
    print("📄 測試模式 2: 部分內容翻譯")
    print("=" * 50)
    test_content = [
        {"type": "text", "text": "1. Introduction", "page_idx": 0, "text_level": 1},
        {"type": "text", "text": "Cognitive radio (CR) technology represents a paradigm shift in wireless communications.", "page_idx": 0, "text_level": 2},
        {"type": "text", "text": "The Internet of Things (IoT) ecosystem requires dynamic spectrum management for optimal performance.", "page_idx": 0, "text_level": 2}
    ]
    print(f"📊 測試內容包含 {len(test_content)} 個段落")
    for i, item in enumerate(test_content):
        if item.get('type') == 'text' and item.get('text'):
            print(f"\n📝 段落 {i+1}:")
            print(f"原文: {item['text']}")
            content_type = "title" if item.get('text_level') == 1 else "body"
            context = test_content[i-1]['text'] if i > 0 else ""
            translated = translator.translate_single_text(
                text=item['text'],
                content_type=content_type,
                context=context
            )
            print(f"譯文: {translated}")
            print(f"類型: {content_type}")
            print("-" * 30)

def test_full_document(translator):
    print("📚 測試模式 3: 完整文件翻譯")
    print("=" * 50)
    content_list_path = None
    test_file_name = "SiLU期末報告"
    search_paths = [
        f"instance/mineru_outputs/{test_file_name}/auto/*_content_list.json"
    ]
    for pattern in search_paths:
        files = list(Path(".").glob(pattern))
        if files:
            content_list_path = files[0]
            break
    if not content_list_path:
        print("❌ 找不到content_list.json測試檔案")
        print("💡 請確認以下位置是否有檔案:")
        for pattern in search_paths:
            print(f"   {pattern}")
        return
    print(f"📁 使用測試檔案: {content_list_path}")
    with open(content_list_path, 'r', encoding='utf-8') as f:
        content_list = json.load(f)
    text_items = [item for item in content_list if item.get('type') == 'text' and item.get('text')]
    total_chars = sum(len(item['text']) for item in text_items)
    print(f"📊 文件統計:")
    print(f"   總段落數: {len(text_items)}")
    print(f"   總字符數: {total_chars}")
    print(f"   預估時間: {len(text_items) * 3}秒")
    start_time = time.time()
    output_path = translator.translate_content_list(
        content_list_path=str(content_list_path),
        buffer_time=1.8
    )
    end_time = time.time()
    print(f"\n✅ 翻譯完成！")
    print(f"📁 輸出檔案: {output_path}")
    print(f"⏱️  總耗時: {end_time - start_time:.1f}秒")
    print(f"📚 術語對照表: {len(translator.term_dictionary)} 個術語")

def main():
    parser = argparse.ArgumentParser(description="翻譯服務測試工具")
    parser.add_argument("--mode", type=str, choices=["single", "partial", "full"], default="single", help="測試模式: single/partial/full")
    parser.add_argument("--provider", type=str, default="", help="LLM 服務提供者 (ollama, google, openai)")
    parser.add_argument("--model", type=str, default="", help="LLM 模型名稱 (例如: llama2, gemini-pro, gpt-4-turbo)")
    parser.add_argument("--apikey", type=str, default="", help="LLM API 金鑰")
    args = parser.parse_args()

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
    translator = Translator(instance_path=instance_path, llm_service_obj=llm_service, verbose=args.verbose)

    if args.mode == "single":
        test_single_sentence(translator)
    elif args.mode == "partial":
        test_partial_content(translator)
    elif args.mode == "full":
        test_full_document(translator)

if __name__ == "__main__":
    main()
