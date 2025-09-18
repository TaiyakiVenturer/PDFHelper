import os
import subprocess
from typing import Dict, Any, Literal
import time

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

        self._verbose: bool = verbose

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
            device: 設備模式
            verbose: 是否啟用詳細模式

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
        original_pdf_path = os.path.join(self.default_path, pdf_name)
        output_path = os.path.abspath(self.output_dir)
        
        # 處理超長檔名問題 (Windows 260字符路徑限制)
        original_filename = os.path.splitext(pdf_name)[0]
        
        # 檢查完整路徑長度
        test_path = os.path.join(output_path, original_filename, method, f"{original_filename}_layout.pdf")
        
        if len(test_path) > 250:  # 留一些緩衝空間
            # 創建短檔名版本
            import hashlib
            hash_part = hashlib.md5(original_filename.encode()).hexdigest()[:8]
            short_filename = f"doc_{hash_part}"
            short_pdf_name = f"{short_filename}.pdf"
            
            print(f"⚠️  路徑過長，創建短檔名副本:")
            print(f"   原檔名: {original_filename}")
            print(f"   短檔名: {short_filename}")
            
            # 創建短檔名的 PDF 副本
            import shutil
            short_pdf_path = os.path.join(self.default_path, short_pdf_name)
            shutil.copy2(original_pdf_path, short_pdf_path)
            
            # 使用短檔名處理
            pdf_path = short_pdf_path
            processing_filename = short_filename
            
            # 記錄映射關係，以便後續處理
            self._filename_mapping = {
                'original': original_filename,
                'short': short_filename,
                'short_pdf_path': short_pdf_path
            }
        else:
            pdf_path = original_pdf_path
            processing_filename = original_filename
            self._filename_mapping = None
            
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
        
        print(f"執行命令: {' '.join(cmd)}")
        print(f"輸出目錄: {output_path}")
        
        try:
            # 執行MinerU命令 - 即時顯示輸出
            start_time = time.time()
            print(f"🚀 開始執行 MinerU...")
            print("-" * 60)
            
            # 使用 Popen 來即時顯示輸出
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,  # 將 stderr 重定向到 stdout
                text=True,
                cwd=os.path.dirname(__file__),
                universal_newlines=True,
                bufsize=1,
                env=os.environ.copy()  # 複製當前環境變量
            )

            # 收集所有輸出
            all_output = []
            if self._verbose:
                print(f"📋 MinerU 輸出:")
            
            while True:
                output = process.stdout.readline()
                if output == '' and process.poll() is not None:
                    break
                if output:
                    all_output.append(output.strip())
                    if self._verbose:
                        print(output.strip())  # 即時顯示
            
            # 等待進程完成
            return_code = process.poll()
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            if self._verbose:
                print("-" * 60)
                print(f"⏰ MinerU 執行結束，耗時: {processing_time:.2f}秒")
                print(f"📋 返回代碼: {return_code}")
            
            # 將所有輸出合併成字符串
            full_output = '\n'.join(all_output)
            
            if return_code == 0:
                if self._verbose:
                    print(f"✅ MinerU處理成功！")
                    print(f"📁 輸出目錄: {output_path}")
                
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
                        if self._verbose:
                            print(f"🧹 清理臨時檔案: {self._filename_mapping['short_pdf_path']}")
                    except:
                        pass

                    if self._verbose:
                        print(f"📝 檔名映射: {self._filename_mapping['short']} → {self._filename_mapping['original']}")
                else:
                    generated_files = self._find_generated_files(output_path, pdf_name, method=method)

                return {
                    "success": True,
                    "output_path": str(output_path),  # 返回絕對路徑
                    "output_file_paths": generated_files,
                    "processing_time": processing_time,
                    "stdout": full_output,
                    "error": "",
                    "returncode": return_code
                }
            else:
                print(f"❌ MinerU處理失敗！錯誤代碼: {return_code}")
                print(f"完整輸出內容:")
                print(full_output)

                return {
                    "success": False,
                    "error": f"MinerU 執行失敗 (錯誤代碼: {return_code})",
                    "stdout": full_output,
                    "error": "MinerU處理失敗",
                    "returncode": return_code
                }
        except subprocess.TimeoutExpired:
            print("❌ MinerU處理超時！")
            return {
                "success": False,
                "error": "處理超時"
            }
        except Exception as e:
            print(f"❌ 執行MinerU時發生錯誤: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

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
            if self._verbose:
                print(f"📋 找到的檔案: {files_list}")

            for file in files_list:
                full_path = os.path.join(file_path, file)
                if file.endswith(".md"):
                    result_files["markdown"] = full_path
                    if self._verbose:
                        print(f"📄 找到 Markdown: {file}")
                elif file.endswith("content_list.json"):
                    result_files["json"] = full_path
                    if self._verbose:
                        print(f"📄 找到 JSON: {file}")
                elif os.path.isdir(full_path):
                    if self._verbose:
                        print(f"📁 檢查圖片目錄: {file}")
                    try:
                        image_files = [img for img in os.listdir(full_path) if img.endswith((".png", ".jpg", ".jpeg"))]
                        if image_files:
                            result_files["images"] = [os.path.join(full_path, img) for img in image_files]
                            if self._verbose:
                                print(f"🖼️  找到 {len(image_files)} 張圖片")
                    except Exception as e:
                        print(f"⚠️  讀取圖片目錄失敗: {e}")

            return result_files
            
        except Exception as e:
            print(f"❌ 搜尋檔案時發生錯誤: {e}")
            return result_files
