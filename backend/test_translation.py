#!/usr/bin/env python3
"""
Ollama翻譯服務測試腳本 - 支援自定義TranslateHelper模型
"""

import json
import time
from pathlib import Path
from services.translation_service import OllamaTranslator, GeminiTranslator

import os

instance_path = os.path.join(os.path.dirname(__file__), "instance")

def test_single_sentence():
    """測試單句翻譯"""
    print("🔤 測試模式 1: 單句翻譯")
    print("=" * 50)
    
    # 測試用例
    test_cases = [
        {
            "text": "Autonomous Network Optimization and Dynamic Channel Allocation for Cognitive Radio-Based Consumer IoT",
            "type": "title"
        },
        {
            "text": "The heterogeneous environment of next-generation Consumer Internet of Things (CIoT) demands efficient resource utilization and reliable network services.",
            "type": "abstract"
        },
        {
            "text": "Machine learning algorithms enable autonomous decision-making in cognitive radio networks.",
            "type": "body"
        },
        {
            "text": "Zhang, L., & Wang, H. (2023). Cognitive radio networks: A comprehensive survey. IEEE Communications Surveys & Tutorials, 25(2), 1123-1145.",
            "type": "reference"
        }
    ]
    
    try:
        translator = OllamaTranslator(
            instance_path=instance_path,
            verbose=True
        )
        
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
        
        # 顯示術語字典
        if translator.term_dictionary:
            print(f"\n📚 建立的術語對照表:")
            for en, zh in translator.term_dictionary.items():
                print(f"  {en} → {zh}")
    
    except Exception as e:
        print(f"❌ 測試失敗: {e}")


def test_partial_content():
    """測試部分文件翻譯"""
    print("📄 測試模式 2: 部分內容翻譯")
    print("=" * 50)
    
    # 模擬content_list格式的測試數據
    test_content = [
        {
            "type": "text",
            "text": "1. Introduction",
            "page_idx": 0,
            "text_level": 1
        },
        {
            "type": "text", 
            "text": "Cognitive radio (CR) technology represents a paradigm shift in wireless communications.",
            "page_idx": 0,
            "text_level": 2
        },
        {
            "type": "text",
            "text": "The Internet of Things (IoT) ecosystem requires dynamic spectrum management for optimal performance.",
            "page_idx": 0,
            "text_level": 2
        }
    ]
    
    try:
        translator = OllamaTranslator(
            instance_path=instance_path,
            verbose=True
        )
        
        print(f"📊 測試內容包含 {len(test_content)} 個段落")
        
        for i, item in enumerate(test_content):
            if item.get('type') == 'text' and item.get('text'):
                print(f"\n📝 段落 {i+1}:")
                print(f"原文: {item['text']}")
                
                # 判斷內容類型
                content_type = "title" if item.get('text_level') == 1 else "body"
                
                # 提供上下文
                context = test_content[i-1]['text'] if i > 0 else ""
                
                translated = translator.translate_single_text(
                    text=item['text'],
                    content_type=content_type,
                    context=context
                )
                
                print(f"譯文: {translated}")
                print(f"類型: {content_type}")
                print("-" * 30)
    
    except Exception as e:
        print(f"❌ 測試失敗: {e}")


def test_full_document():
    """測試完整文件翻譯"""
    print("📚 測試模式 3: 完整文件翻譯")
    print("=" * 50)
    
    # 尋找測試用的content_list.json
    content_list_path = None
    test_file_name = "SiLU期末報告"  # doc_f6a48d55
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
    

    translator = GeminiTranslator(
        instance_path=instance_path,
        verbose=True
    )
    # translator = OllamaTranslator(
    #     instance_path=instance_path,
    #     verbose=True
    # )
    
    # 先載入檔案查看基本資訊
    with open(content_list_path, 'r', encoding='utf-8') as f:
        content_list = json.load(f)
    
    text_items = [item for item in content_list if item.get('type') == 'text' and item.get('text')]
    total_chars = sum(len(item['text']) for item in text_items)
    
    print(f"📊 文件統計:")
    print(f"   總段落數: {len(text_items)}")
    print(f"   總字符數: {total_chars}")
    print(f"   預估時間: {len(text_items) * 3}秒")
    
    confirm = input("\n❓ 是否繼續完整翻譯？(y/N): ").strip().lower()
    if confirm != 'y':
        print("⏹️  已取消完整翻譯測試")
        return
    
    # 執行翻譯
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
    """主測試選單"""
    print("🧪 Ollama自定義翻譯模型測試工具")
    print("使用模型: TranslateHelper")
    print("=" * 60)
    
    while True:
        print("\n📋 測試選項:")
        print("1. 單句翻譯測試")
        print("2. 部分內容翻譯測試") 
        print("3. 完整文件翻譯測試")
        print("4. 退出")
        
        choice = input("\n❓ 請選擇測試模式 (1-4): ").strip()
        
        if choice == '1':
            test_single_sentence()
        elif choice == '2':
            test_partial_content()
        elif choice == '3':
            test_full_document()
        elif choice == '4':
            print("👋 測試結束")
            break
        else:
            print("❌ 無效選項，請重新選擇")
        
        input("\n⏎ 按Enter鍵繼續...")


if __name__ == "__main__":
    main()
