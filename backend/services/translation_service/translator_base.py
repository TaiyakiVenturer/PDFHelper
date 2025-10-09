"""
翻譯器基類 - 定義翻譯器的基本接口和通用方法
"""
from typing import Optional, Dict
import json
import os
import time
import requests
from pathlib import Path

from backend.api import ProgressManager

import logging
logger = logging.getLogger(__name__)

class TranslatorBase:
    """
    ### 翻譯器基類

    定義了翻譯器的基本接口和通用方法
    
    ### 繼承需實現以下方法：
    - is_available(self) -> bool: 檢查翻譯器是否可用
    - send_translate_request(self, prompt: str) -> str: 發送翻譯請求
    """
    def __init__(self, instance_path: str, model_name: str, verbose: bool = False):
        """
        初始化翻譯器基類

        Args:
            instance_path: 存放PDF的資料夾路徑
            model_name: 使用的模型名稱 (用於保存翻譯進度及辨識翻譯器類型)
            verbose: 是否啟用詳細模式
        """

        self.model_name = model_name
        self.verbose = verbose
        self.term_dictionary = {}

        self.instance_path = instance_path
        self.progress_path = os.path.join(instance_path, "translated_files", "unfinished_file")

        self.is_reference = False

    def is_available(self) -> bool:
        """
        檢查翻譯器是否可用
        """
        raise NotImplementedError("此方法需由子類別實作")

    def send_translate_request(self, prompt: str) -> str:
        """
        發送翻譯請求 (需要子類別實作)
        Args:
            prompt: 要翻譯的提示詞

        Returns:
            翻譯結果 (如果出現錯誤，返回空字串)
        """
        raise NotImplementedError("此方法需由子類別實作")
    
    def _get_term_dictionary(self) -> dict:
        """
        獲取術語對照表
        """
        return self.term_dictionary

    def _set_term_dictionary(self, term_dictionary: dict):
        """
        設置術語對照表
        """
        self.term_dictionary = term_dictionary

    def _get_relevant_terms(self, text: str) -> str:
        """獲取相關的已翻譯術語"""
        if not self.term_dictionary:
            return ""
            
        relevant = []
        for en_term, zh_term in self.term_dictionary.items():
            if en_term.lower() in text.lower():
                relevant.append(f"{en_term}→{zh_term}")

        return "; ".join(relevant[:5])  # 限制最多5個術語
    
    def _update_term_dictionary(self, original: str, translated: str):
        """更新術語對照表"""
        # 簡單的術語提取邏輯（可以後續改進）
        if len(original.split()) <= 3 and len(translated) <= 20:
            # 短語可能是術語
            self.term_dictionary[original.strip()] = translated.strip()

    def _clean_translation(self, text: str) -> str:
        """清理翻譯結果 (暫時不啟用)"""
        if not text:
            return ""
            
        # 移除可能的前綴說明
        prefixes_to_remove = [
            "翻譯結果：", "翻譯：", "中文翻譯：", "譯文：", "繁體中文：",
            "翻譯如下：", "以下是翻譯：", "Translation:", "Chinese:"
        ]
        
        for prefix in prefixes_to_remove:
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
                
        # 移除多餘的引號
        text = text.strip('"\'')
        
        # 標準化空格
        text = " ".join(text.split())
        
        return text

    def _build_modelfile_prompt(self, text: str, content_type: str) -> str:
        """構建配合modelfile的簡潔提示詞"""
        # 檢查是否有相關術語需要保持一致性
        relevant_terms = self._get_relevant_terms(text)
        terms_context = ""
        if relevant_terms:
            terms_context = f"\n已建立術語對照: {relevant_terms}"
        
        # 根據modelfile格式構建簡潔prompt
        prompt = f"""內容類型：{content_type}; 翻譯內容：{text}; 術語對照表：{terms_context}翻譯輸出："""

        return prompt

    def translate_single_text(self, text: str, content_type: str = "body", max_retries: int = 3) -> str:
        """
        翻譯單一段落文字。
        
        Args:
            text: 要翻譯的文本
            content_type: 內容類型 (title/abstract/body/reference)
            max_retries: 最大重試次數
            
        Returns:
            翻譯後的文本 (如果出現錯誤，返回空字串)
        """
        prompt = self._build_modelfile_prompt(text, content_type)

        for attempt in range(1, max_retries + 1):
            try:
                translation = self.send_translate_request(prompt)
                if not translation:
                    logger.warning(f"翻譯出現錯誤，重新嘗試 (嘗試 {attempt}/{max_retries})")
                    continue

                # 更新術語對照表
                self._update_term_dictionary(text, translation)
                
                return translation
            
            except requests.exceptions.Timeout:
                logger.warning(f"翻譯超時 (嘗試 {attempt}/{max_retries})")
                if attempt < max_retries:
                    time.sleep(2)
                    continue
                else:
                    return ""
            except requests.exceptions.RequestException as e:
                logger.error(f"請求錯誤 (嘗試 {attempt}/{max_retries}): {e}")
                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    logger.info(f"等待 {wait_time} 秒後重試...")
                    time.sleep(wait_time)
                else:
                    logger.error("已達到最大重試次數，放棄翻譯該段落")
                    return ""
            except Exception as e:
                logger.error(f"翻譯錯誤 (嘗試 {attempt}/{max_retries}): {e}")
                if attempt < max_retries:
                    wait_time = 2 ** attempt
                    logger.info(f"等待 {wait_time} 秒後重試...")
                    time.sleep(wait_time)
                else:
                    logger.error("已達到最大重試次數，放棄翻譯該段落")
                    return ""
        if self.verbose:
            logger.info("超過最大重試次數")
        return ""

    def translate_content_list(self, content_list_path: str, 
            output_path: Optional[str] = None, buffer_time: float = 0.5
        ) -> str:
        """
        翻譯content_list.json檔案
        
        Args:
            content_list_path: content_list.json檔案路徑
            output_path: 輸出檔案路徑（可選，默認為原檔名_translated.json）
            buffer_time: 每次請求後的緩衝時間，避免過於頻繁請求
            
        Returns:
            翻譯結果檔案路徑
        """
        # 載入content_list.json
        content_list_path = Path(content_list_path)
        if not content_list_path.exists():
            raise FileNotFoundError(f"檔案不存在: {content_list_path}")

        file_name = '_'.join(str(content_list_path.stem).split("_")[:-2])
        progress_path = os.path.join(self.progress_path, f"{file_name}_progress.json")
        if os.path.exists(progress_path):
            # 載入進度檔案
            with open(progress_path, 'r', encoding='utf-8') as f:
                progress_data = json.load(f)
            content_list = progress_data.get("content_list", [])

            if self.verbose:
                logger.info(f"偵測到翻譯進度: {progress_path}")
                logger.info(f"重新載入翻譯進度: 剩餘 {self._check_translated_progress(content_list)} 個段落")

            self._set_term_dictionary(progress_data.get("term_dictionary", {}))

            if self._check_translated_progress(content_list) == 0:
                logger.info("檔案已全部翻譯完成，無需重複翻譯")
                return self._save_translated_progress(content_list, file_name)
        else:
            # 初次翻譯，載入原始檔案
            with open(content_list_path, 'r', encoding='utf-8') as f:
                content_list = json.load(f)

            # 保存初始進度，再載入進度檔案
            self._save_translated_progress(content_list, file_name)
            with open(progress_path, 'r', encoding='utf-8') as f:
                progress_data = json.load(f)
            content_list = progress_data.get("content_list", [])

            if self.verbose:
                logger.info(f"初次翻譯，建立進度檔案: {progress_path}")
                logger.info(f"總計翻譯項目: {len(content_list)} 個項目")

        # 翻譯處理
        translated_count = 0

        last_progress = 36  # 初始進度
        per_progress = 30 / len(content_list)  # 30%分配給翻譯
        for index, item in enumerate(content_list):
            ProgressManager.progress_update(last_progress + per_progress * index, f"正在翻譯第 {index+1}/{len(content_list)} 個段落", "translating-json")
            if item.get('translation_metadata', {}) != {}:
                continue
            if not (item.get('type') == 'text' and item.get('text')):
                continue

            if translated_count != 0 and translated_count % 10 == 0:
                start_time = time.time()
                logger.info(f"第 {index//10} 個檢查點，正在保存翻譯進度...")
                self._save_translated_progress(content_list, file_name)
                end_time = time.time()

                batch_sleep = buffer_time*5 - (end_time - start_time)
                if batch_sleep > 0:
                    time.sleep(batch_sleep)
            
            # 判斷內容類型
            content_type = self._classify_content_type(item)

            # 翻譯文本
            original_text = item['text']
            translated_text = self.translate_single_text(
                text=original_text,
                content_type=content_type
            )
            if translated_text == "":
                logger.error(f"翻譯失敗，跳過段落: {original_text}")
                continue
            else:
                if self.verbose:
                    logger.info(f"翻譯進度: {index+1}/{len(content_list)} - 第{item.get('page_idx', 0)+1}頁")

            translated_count += 1

            # 保存翻譯結果
            item['text_en'] = original_text
            item['text_zh'] = translated_text
            item['translation_metadata'] = {
                'model': self.model_name,
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                'content_type': content_type
            }
            
            if self.verbose:
                logger.info(f"   原文: {original_text[:50]}...")
                logger.info(f"   譯文: {translated_text[:50]}...")
                logger.info("")

            # 避免請求過於頻繁
            time.sleep(buffer_time)

        # 結束多輪對話
        self.send_translate_request("", end_chat=True)

        # 翻譯結束後，統一移除原始文本
        for item in content_list:
            item.pop('text', None)

        # 保存翻譯結果
        if output_path is None:
            output_path = os.path.join(os.path.dirname(self.progress_path), f"{file_name}_translated.json")
        else:
            output_path = Path(output_path)
        
        # 確保輸出目錄存在
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(content_list, f, ensure_ascii=False, indent=2)

        logger.info("翻譯完成！")
        logger.info(f"翻譯結果已保存: {output_path}")
        logger.info(f"共翻譯 {translated_count} 個段落")

        self._clear_translated_progress(file_name)
        
        return str(output_path)

    def _classify_content_type(self, item: Dict) -> str:
        """分類內容類型"""
        text = item.get('text', '').lower()
        text_level = item.get('text_level')
        
        # 摘要判斷
        if 'abstract' in text:
            return 'abstract'

        # 參考文獻區域判斷
        if 'reference' in text:
            self.is_reference = True

        # 參考文獻判斷
        if self.is_reference and any(ref in text for ref in ['[', 'doi:', 'http://', 'https://', '@']):
            return 'reference'
        
        # 標題判斷
        if text_level == 1:
            return 'title'
        
        # 默認為正文
        return 'body'

    def _save_translated_progress(self, progress_data: list, file_name: str) -> str:
        """
        保存翻譯進度到本地文件
        
        Args:
            progress_data: 包含翻譯進度的list數據
            file_name: 輸出檔案名稱

        Returns:
            str: 輸出檔案的路徑
        """
        output_path = os.path.join(self.progress_path, f"{file_name}_progress.json")

        # 確保進度目錄存在
        os.makedirs(self.progress_path, exist_ok=True)

        # 🔧 修正：創建包含進度信息的新結構，不修改原始數據
        progress_info = {
            "content_list": progress_data,  # 原始翻譯數據
            "save_time": time.strftime('%Y-%m-%d %H:%M:%S'),
            "term_dictionary": self.term_dictionary.copy(),  # 創建副本
            "translator_type": self.model_name
        }

        try:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(progress_info, f, ensure_ascii=False, indent=2)
            return output_path
        except Exception as e:
            logger.error(f"保存翻譯進度時出錯: {e}")
            return ""

    def _load_translated_progress(self, file_name: str) -> Optional[dict]:
        """
        從本地文件加載翻譯進度

        Args:
            file_name: 原始文件名

        Returns:
            包含翻譯進度的字典數據，或None如果加載失敗
        """
        input_path = os.path.join(self.progress_path, f"{file_name}_progress.json")

        try:
            with open(input_path, "r", encoding="utf-8") as f:
                progress_info = json.load(f)
            return progress_info
        except Exception as e:
            logger.error(f"加載翻譯進度時出錯: {e}")
            return None

    def _check_translated_progress(self, content_list: list) -> int:
        """
        檢查翻譯進度

        Args:
            content_list: 原始內容列表

        Returns:
            翻譯缺失數量
        """

        unfinished_count = 0
        for item in content_list:
            if item.get('type') != 'text':
                continue
            if item.get('text') == "":
                continue
            if item.get("translation_metadata") is None:
                unfinished_count += 1
        return unfinished_count

    def _clear_translated_progress(self, file_name: str) -> bool:
        """
        清除翻譯進度檔案

        Args:
            file_name: 原始文件名

        Returns:
            是否成功清除翻譯進度
        """
        progress_path = os.path.join(self.progress_path, f"{file_name}_progress.json")

        try:
            if os.path.exists(progress_path):
                os.remove(progress_path)
                logger.info(f"成功清除翻譯進度檔案: {progress_path}")
            else:
                logger.warning(f"翻譯進度檔案不存在: {progress_path}")
            return True
        except Exception as e:
            logger.error(f"清除翻譯進度時出錯: {e}")
            return False