import os
import subprocess
from typing import Dict, Any, Literal, Tuple
import time

from backend.api import ProgressManager # 導入進度管理器

import logging
from backend.api.logger import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class MinerUProcessor:
    """MinerU PDF處理器"""

    def __init__(self, instance_path: str, output_dirname: str = "mineru_outputs", verbose: bool = False):
        """
        初始化MinerU PDF處理器

        Args:
            instance_path: 實例路徑
            output_dirname: 輸出目錄名稱
            verbose: 是否啟用詳細模式
        """
        self.default_path = os.path.join(instance_path, "pdfs")
        self.output_dir = os.path.join(instance_path, output_dirname)
        os.makedirs(self.output_dir, exist_ok=True)

        self.verbose: bool = verbose

        if self.verbose:
            logger.info("MinerU處理器初始化完成")
            logger.info(f"PDF預設讀取路徑: {self.default_path}")
            logger.info(f"輸出目錄: {self.output_dir}")

    def process_pdf_with_mineru(
            self, 
            pdf_name: str,
            method: Literal["auto", "txt", "ocr"] = "auto",
            backend: Literal["pipeline"] = "pipeline",
            lang: str = "en",
            formula: bool = True,
            table: bool = True,
            device: Literal["cuda", "cpu"] = "cuda",
        ) -> Dict[str, Any]:
        """
        使用MinerU處理PDF
        
        Args:
            pdf_name: PDF檔案名稱
            method: 解析方法 (auto/txt/ocr)
            backend: 後端引擎 (pipeline/vlm-*)
            lang: 語言設定
            formula: 是否解析公式
            table: 是否解析表格
            device: 設備模式 (cuda/cpu)

        Returns:
            Dict ([str, Any]): 包含處理結果的字典
                - success (bool): 是否成功
                - output_path (str): 輸出目錄路徑
                - output_file_paths (Dict[str, str]): 生成的檔案路徑
                - processing_time (float): 處理時間（秒）
                - stdout (str): MinerU輸出內容
                - error (str): 錯誤訊息（如果有的話）
                - returncode (int): 返回代碼
        """
        # 準備輸出路徑
        output_path = os.path.abspath(self.output_dir)
        
        # 檢查是否需要使用雜湊檔名
        processing_filename, pdf_path = self._check_hashed_filename(pdf_name)
        
        # 建立輸出子目錄
        expected_output_dir = os.path.join(output_path, processing_filename, method)
        os.makedirs(expected_output_dir, exist_ok=True)

        # 構建MinerU命令
        cmd = [
            "mineru",
            "-p", str(pdf_path),
            "-o", str(output_path),
            "-m", method,
            "-b", backend,
            "-l", lang,
            "-f", str(formula).lower(),
            "-t", str(table).lower(),
            "-d", device
        ]
        
        ProgressManager.progress_update(3, "初始化 MinerU", "processing-pdf")  # 更新進度
        if self.verbose:
            logger.info(f"執行命令: {' '.join(cmd)}")
            logger.info(f"輸出目錄: {output_path}")

        try:
            # 執行MinerU命令 - 即時顯示輸出
            start_time = time.time()
            if self.verbose:
                logger.info(f"開始執行 MinerU...")
                logger.info("-" * 60)

            # 使用 Popen 來即時顯示輸出
            # 編碼處理策略：統一使用 UTF-8 以保證跨平台一致性
            # - 與 Electron (PYTHONIOENCODING='utf-8') 行為一致
            # - 配合 errors='replace' 處理無法解碼的字節（如某些舊版程式的 Big5 輸出）
            # - 確保在 Windows/Linux/Mac 上都能正常運行
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,  # 將 stderr 重定向到 stdout
                text=True,
                encoding='utf-8',  # 明確指定 UTF-8，與 Electron 環境一致
                errors='replace',  # 遇到無法解碼的字節時用替代字符代替（容錯處理）
                cwd=os.path.dirname(__file__),
                universal_newlines=True,
                bufsize=1,
                env=os.environ.copy()  # 複製當前環境變量
            )

            # 收集所有輸出
            all_output = []
            if self.verbose:
                logger.debug(f"MinerU 輸出:")
            
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    self._update_progress(output)  # 更新進度
                    all_output.append(output.strip())
                    if self.verbose:
                        logger.debug(output.strip())  # 即時顯示
            
            # 等待進程完成
            return_code = process.poll()
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            if self.verbose:
                logger.info("-" * 60)
                logger.info(f"MinerU 執行結束，耗時: {processing_time:.2f}秒")
                logger.info(f"返回代碼: {return_code}")

            # 將所有輸出合併成字符串
            full_output = '\n'.join(all_output)
            
            if return_code == 0:
                if self.verbose:
                    logger.info(f"MinerU處理成功！")
                    logger.info(f"輸出目錄: {output_path}")

                # 查找生成的文件
                if self._filename_mapping and hasattr(self, '_filename_mapping'):
                    # 使用短檔名查找文件
                    generated_files = self._find_generated_files(
                        output_path, 
                        f"{self._filename_mapping['short']}.pdf", 
                        method=method
                    )
                    
                    # 清理臨時檔案
                    try:
                        os.remove(self._filename_mapping['short_pdf_path'])
                        if self.verbose:
                            logger.info(f"清理臨時檔案: {self._filename_mapping['short_pdf_path']}")
                    except:
                        pass

                    if self.verbose:
                        logger.info(f"檔名映射: {self._filename_mapping['short']} → {self._filename_mapping['original']}")
                else:
                    generated_files = self._find_generated_files(output_path, pdf_name, method=method)

                return {
                    "success": True,
                    "output_path": str(output_path),  # 返回絕對路徑
                    "output_file_paths": generated_files,
                    "processing_time": processing_time,
                    "stdout": full_output if self.verbose else "未開啟詳細模式，無輸出",
                    "error": "",
                    "returncode": return_code
                }
            else:
                logger.error(f"MinerU處理失敗！錯誤代碼: {return_code}")
                logger.error(f"完整輸出內容:")
                logger.error(full_output)

                return {
                    "success": False,
                    "error": f"MinerU 執行失敗 (錯誤代碼: {return_code})",
                    "stdout": full_output,
                    "error": "MinerU處理失敗",
                    "returncode": return_code
                }
        except subprocess.TimeoutExpired:
            logger.error(f"MinerU處理超時！")
            return {
                "success": False,
                "error": "處理超時"
            }
        except Exception as e:
            logger.error(f"執行MinerU時發生錯誤: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def _check_hashed_filename(self, pdf_name: str) -> Tuple[str, str]:
        """
        檢查是否需要使用雜湊檔名來避免路徑過長或非法字元問題。
        
        Args:
            pdf_name: 原始檔案名稱 (包含副檔名)
            method: 處理方法 (用於檢查路徑長度)
        
        Returns:
            Tuple(processing_filename, pdf_path): 短檔名的PDF路徑和處理用的檔名
                - processing_filename: 用於處理的檔名 (不含副檔名)
                - pdf_path: 短檔名的PDF路徑 (包含副檔名)
        """
        # 移除副檔名取得原始檔名
        original_filename = os.path.splitext(pdf_name)[0]
        # 取得原始PDF路徑
        original_pdf_path = os.path.join(self.default_path, original_filename + ".pdf")
        # 檢查完整路徑長度 (假設method為'auto')
        test_path = os.path.join(os.path.abspath(self.output_dir), original_filename, 'auto', f"{original_filename}_content_list.json")

        import re
        if len(test_path) > 250:  # 留一些緩衝空間
            logger.warning(f"路徑過長，創建雜湊名稱副本:")
        elif not re.match(r"^[a-zA-Z0-9.-]+$", original_filename):  # original_filename != [a-zA-Z0-9.-]
            logger.warning(f"檔案名稱出現非法字元，創建雜湊名稱副本:")
        elif len(original_filename) < 3 or len(original_filename) > 50:
            logger.warning(f"檔案名稱過短或過長，創建雜湊名稱副本:")
        else:   
            self._filename_mapping = None
            return original_filename, original_pdf_path

        # 創建短檔名版本
        import hashlib
        hash_part = hashlib.md5(original_filename.encode()).hexdigest()[:8]
        short_filename = f"doc_{hash_part}"
        short_pdf_name = f"{short_filename}.pdf"
        
        logger.warning(f"原檔名: {original_filename}")
        logger.warning(f"短檔名: {short_filename}")

        # 創建短檔名的 PDF 副本
        import shutil
        short_pdf_path = os.path.join(self.default_path, short_pdf_name)
        if not os.path.exists(original_pdf_path):
            logger.warning(f"原始PDF檔案不存在: {original_pdf_path}")
        elif not os.path.exists(short_pdf_path):
            shutil.copy2(original_pdf_path, short_pdf_path)
        else:
            logger.info(f"短檔名副本已存在: {short_pdf_path}")
        
        # 使用短檔名處理
        pdf_path = short_pdf_path
        processing_filename = short_filename
        
        # 記錄映射關係，以便後續處理
        self._filename_mapping = {
            'original': original_filename,
            'short': short_filename,
            'short_pdf_path': short_pdf_path
        }
        return processing_filename, pdf_path

    def _update_progress(self, message: str):
        """更新處理進度"""
        if not message:
            return

        progress: Tuple[float, str] = (-1.0, "錯誤狀態")
        if "fetching" in message.lower():
            progress = (6.0, "處理中: 獲取頁面")
        elif "layout predict" in message.lower():
            progress = (9.0, "處理中: 版面預測")
        elif "mfd predict" in message.lower():
            progress = (12.0, "處理中: 表格分析")
        elif "mfr predict" in message.lower():
            progress = (15.0, "處理中: 版面分析")
        elif "table-ocr" in message.lower():
            progress = (18.0, "處理中: 表格 OCR 辨識")
        elif "table-wireless" in message.lower():
            progress = (21.0, "處理中: 表格預測")
        elif "ocr-det" in message.lower():
            progress = (24.0, "處理中: OCR 文字辨識")
        elif "processing pages" in message.lower():
            progress = (27.0, "處理中: 最後處理頁面")
        else:
            return  # 無需更新
        ProgressManager.progress_update(*progress, "processing-pdf")

    def _find_generated_files(self, output_path: str, file_name: str, method: str) -> Dict[str, Any]:
        """在輸出目錄中尋找MinerU生成的檔案"""
        result_files = {
            "markdown": None,     # .md檔案路徑
            "json": None,         # .json檔案路徑  
            "images": []          # 所有圖片檔案列表
        }

        try:
            # 使用正確的文件名解析方式
            filename_without_ext = os.path.splitext(file_name)[0]
            file_path = os.path.join(output_path, filename_without_ext, method)
            
            files_list = os.listdir(file_path)
            if self.verbose:
                logger.info(f"找到的檔案: {files_list}")

            for file in files_list:
                full_path = os.path.join(file_path, file)
                if file.endswith(".md"):
                    result_files["markdown"] = full_path
                    if self.verbose:
                        logger.info(f"找到 Markdown: {file}")
                elif file.endswith("content_list.json"):
                    result_files["json"] = full_path
                    if self.verbose:
                        logger.info(f"找到 JSON: {file}")
                elif os.path.isdir(full_path):
                    if self.verbose:
                        logger.info(f"檢查圖片目錄: {file}")
                    try:
                        image_files = [img for img in os.listdir(full_path) if img.endswith((".png", ".jpg", ".jpeg"))]
                        if image_files:
                            result_files["images"] = [os.path.join(full_path, img) for img in image_files]
                            if self.verbose:
                                logger.info(f"找到 {len(image_files)} 張圖片")
                    except Exception as e:
                        logger.error(f"讀取圖片目錄失敗: {e}")

            return result_files
            
        except Exception as e:
            logger.error(f"搜尋檔案時發生錯誤: {e}")
            return result_files
