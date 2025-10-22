from typing import Dict, Literal, Tuple, Optional
import os
import json
import shutil
import re

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class MarkdownReconstructor:
    """
    ### 將翻譯過的.json文件重組回.md檔案
    """
    def __init__(self, instance_path: str, verbose: bool = False):
        """
        初始化Markdown重組器

        Args:
            instance_path: 存放PDF的資料夾路徑
            verbose: 是否啟用詳細模式
        """
        self.verbose = verbose

        self.instance_path = instance_path
        self.pdf_path = os.path.join(self.instance_path, "mineru_outputs")

        self.in_reference = False

        if self.verbose:
            logger.info("Markdown重組器初始化完成")
            logger.info(f"PDF預設讀取路徑: {self.pdf_path}")
            logger.info(f"輸出目錄: {os.path.join(self.instance_path, 'reconstructed_files')}")

    def reconstruct(self, 
            json_name: str, 
            method: Literal['auto', 'ocr', 'text'], 
            mode: Literal['origin', 'translated']
        ) -> Optional[str]:
        """
        重組.md檔案

        Args:
            file_name: 翻譯後的Json檔案名稱含副檔名 (例如: `example_translated.json`)
            method: 處理方法 (auto/ocr/text)
            mode: 模式選擇 (origin/translated)

        Returns:
            str: 重組後的.md檔案路徑，失敗則回傳None
        """
        # 讀取翻譯後的Json檔案
        translated_file_path = os.path.join(self.instance_path, "translated_files", json_name)
        if not os.path.exists(translated_file_path):
            logger.error(f"找不到翻譯後的檔案: {translated_file_path}")
            return None

        with open(translated_file_path, 'r', encoding='utf-8') as f:
            content_list = json.load(f)
        if self.verbose:
            logger.info(f"讀取翻譯後的檔案: {translated_file_path}")

        # 組合完整PDF路徑
        json_name = json_name.replace("_translated.json", "")
        pdf_path = os.path.join(self.pdf_path, json_name, method)

        md_lines = ['<a id="content"></a>']
        for item in content_list:
            content_type, content_value = self._classify_content_type(item, mode)
            if self.verbose:
                logger.info(f"內容類型: {content_type}, 內容: {content_value[:50]}")

            if content_type == 'title':
                md_lines.append(f"# {content_value}")
            elif content_type == 'abstract':
                md_lines.append(f"## 摘要\n{content_value}")
            elif content_type == 'reference':
                md_lines.append(f"### 參考文獻\n{self._create_reference_anchor(content_value, in_reference=True)}")
            elif content_type == 'image':
                md_lines.append(f"![Image]({content_value})")
            elif content_type == 'None':
                continue
            else:
                if re.findall(r'\[(\d+)\]', content_value):
                    content_value = self._create_reference_anchor(content_value, in_reference=False)
                md_lines.append(content_value)

        md_content = "\n\n".join(md_lines)
        md_file_path = os.path.join(self.instance_path, "reconstructed_files", json_name, f"{json_name}.md")
        os.makedirs(os.path.dirname(md_file_path), exist_ok=True)
        with open(md_file_path, 'w', encoding='utf-8') as f:
            f.write(md_content)

        shutil.copytree(
            os.path.join(pdf_path, "images"), 
            os.path.join(os.path.dirname(md_file_path), "images"), 
            dirs_exist_ok=True
        )

        return md_file_path

    def _classify_content_type(self, item: Dict, mode: Literal['origin', 'translated']) -> Tuple[str, str]:
        """
        分類內容類型
        
        Args:
            item: 要分類的內容
            language: 語言選擇 (zh, en)

        Returns:
            Tuple: [type, content]
            - type: 內容類型 (title, abstract, reference, body, image)
            - content: 內容 (如果是圖片，則為圖片路徑，否則為字串內容)
        """
        metadata = item.get('translation_metadata', None)
        metadata_type = metadata.get('content_type') if metadata else None
        original_type = item.get('type')

        # 圖片判斷
        if original_type != 'text':
            return 'image', item.get('img_path', 'img_not_found.jpg')
        elif original_type == 'text':
            return metadata_type, item.get('text' if mode == 'origin' else 'text_zh', '')
        else:
            return 'None', ''

    def _create_reference_anchor(self, content: str, in_reference: bool) -> str:
        """
        創建參考文獻跳轉點

        Args:
            content: 處理的字串
            in_reference: 是否在參考文獻區域

        Returns:
            str: 創建好的參考文獻跳轉點
        """
        # [1], [2]
        pattern = r'\[(\d+)\]'

        if not in_reference:
            def replace_citation(match):
                ref_num = match.group(1)
                return f'[[{ref_num}]](#ref-{ref_num})'

            matches = re.findall(pattern, content)
            if matches:
                result = re.sub(pattern, replace_citation, content)
        else:
            def replace_citation(match):
                ref_num = match.group(1)
                return f'<a id="ref-{ref_num}">[{ref_num}]</a>'

            content_list = content.split('\n')
            results = []
            for text in content_list:
                matches = re.findall(pattern, text)
                if matches:
                    text = re.sub(pattern, replace_citation, text) + " [↩](#content)"
                    results.append(text)
            result = "\n".join(results)

        return result
