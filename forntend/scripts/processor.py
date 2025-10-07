import io
import json
import os
import sys
import time
import traceback
from typing import Any, Dict

from pdfhelper_bridge import run_pipeline

"""Run PDFHelper's MinerU pipeline and stream JSONL events for Electron."""


# 強制以 UTF-8 輸出，避免在 Windows 管線下出現亂碼
import codecs
import locale

# 設置控制台編碼為 UTF-8
try:
    # 強制設置 UTF-8 編碼
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")  # type: ignore[assignment]
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")  # type: ignore[assignment]
    
    # 設置環境變數確保正確的編碼
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    
except Exception as e:
    print(f"編碼設定警告: {e}", file=sys.stderr)


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def progress(session_id: str, percent: int, status: str, details: str = None) -> None:
    emit({
        "type": "progress",
        "sessionId": session_id,
        "percent": max(0, min(100, percent)),
        "status": status,
        "details": details,
        "timestamp": time.time()
    })


def log_output(session_id: str, message: str) -> None:
    """輸出實時日誌到前端"""
    emit({
        "type": "log",
        "sessionId": session_id,
        "message": message,
        "timestamp": time.time()
    })


def main() -> int:
    if len(sys.argv) < 5:
        emit({"type": "error", "sessionId": None, "error": "missing arguments"})
        return 1

    file_path = sys.argv[1]
    company = sys.argv[2]
    model = sys.argv[3]
    session_id = sys.argv[4]

    method = os.getenv("PDFHELPER_METHOD", "auto")
    lang = os.getenv("PDFHELPER_LANG", "en")
    device = os.getenv("PDFHELPER_DEVICE", "cpu")

    try:
        progress(session_id, 2, "準備環境…", f"使用方法: {method}, 語言: {lang}, 設備: {device}")
        
        # 基本配置（將在後面添加增強版回調）
        pipeline_kwargs = {
            "method": method,
            "lang": lang,
            "device": device,
            "verbose": os.getenv("PDFHELPER_VERBOSE", "0") not in {"0", "false", "False"},
        }

        progress(session_id, 5, "準備 PDFHelper 後端…", f"處理檔案: {os.path.basename(file_path)}")
        
        start_time = time.time()
        log_output(session_id, f"[INFO] 開始處理 PDF 檔案: {os.path.basename(file_path)}")
        log_output(session_id, f"[INFO] 使用參數 - 方法: {method}, 語言: {lang}, 設備: {device}")
        
        # 追蹤處理進度 - 重點放在 PDFHelper 後端處理
        current_progress = 8  # 前端準備只佔 8%
        last_progress_update = time.time()
        progress_keywords_found = set()  # 使用 set 避免重複
        mineru_started = False
        phase_timestamps = {}  # 記錄各階段時間
        
        # 增強版輸出回調，根據 MinerU 輸出更新進度
        def enhanced_output_callback(line: str):
            nonlocal current_progress, last_progress_update, progress_keywords_found, mineru_started, phase_timestamps
            try:
                current_time = time.time()
                
                # 確保 line 是 UTF-8 編碼的字串
                if isinstance(line, bytes):
                    line = line.decode('utf-8', errors='replace')
                
                line_lower = line.lower()
                progress_updated = False
                
                # 階段 1: 啟動檢測 (8%-18%)
                startup_keywords = ["開始執行", "開始處理", "執行命令", "mineru", "processing", "start"]
                if any(keyword in line_lower for keyword in startup_keywords):
                    if not mineru_started:
                        mineru_started = True
                        phase_timestamps['startup'] = current_time
                        current_progress = 18
                        progress(session_id, current_progress, "啟動 PDFHelper MinerU…", f"引擎啟動: {line[:30]}...")
                        progress_updated = True
                
                # 階段 2: 模型載入 (18%-35%)
                loading_keywords = ["loading", "載入", "初始化", "initialize", "model", "weight", "config"]
                if any(keyword in line_lower for keyword in loading_keywords) and mineru_started:
                    if "loading" not in progress_keywords_found:
                        phase_timestamps['loading'] = current_time
                        current_progress = max(current_progress, 35)
                        progress(session_id, current_progress, "載入 AI 模型…", f"模型準備: {line[:30]}...")
                        progress_keywords_found.add("loading")
                        progress_updated = True
                        
                # 階段 3: PDF 解析和分析 (35%-65%)
                parsing_keywords = ["解析", "分析", "parsing", "analyzing", "processing", "page", "document", "pdf"]
                if any(keyword in line_lower for keyword in parsing_keywords) and current_progress >= 18:
                    if "parsing" not in progress_keywords_found:
                        phase_timestamps['parsing'] = current_time
                        current_progress = max(current_progress, 45)
                        progress(session_id, current_progress, "PDFHelper 文檔解析…", f"分析結構: {line[:30]}...")
                        progress_keywords_found.add("parsing")
                        progress_updated = True
                    elif current_progress < 65:
                        # 解析過程中的持續更新
                        increment = min(2, 65 - current_progress)
                        current_progress += increment
                        progress(session_id, int(current_progress), "深度解析進行中…", f"處理: {line[:30]}...")
                        progress_updated = True
                
                # 階段 4: 內容提取和識別 (65%-80%)
                extraction_keywords = ["提取", "extract", "detecting", "識別", "recognition", "detect", "table", "image"]
                if any(keyword in line_lower for keyword in extraction_keywords) and current_progress >= 35:
                    if "extraction" not in progress_keywords_found:
                        phase_timestamps['extraction'] = current_time
                        current_progress = max(current_progress, 70)
                        progress(session_id, current_progress, "智能內容提取…", f"識別元素: {line[:30]}...")
                        progress_keywords_found.add("extraction")
                        progress_updated = True
                    elif current_progress < 80:
                        # 提取過程中的更新
                        increment = min(1.5, 80 - current_progress)
                        current_progress += increment
                        progress(session_id, int(current_progress), "提取結構內容…", f"處理: {line[:30]}...")
                        progress_updated = True
                
                # 階段 5: 格式轉換和生成 (80%-92%)
                conversion_keywords = ["轉換", "convert", "generate", "生成", "markdown", "format", "output", "save"]
                if any(keyword in line_lower for keyword in conversion_keywords) and current_progress >= 65:
                    if "conversion" not in progress_keywords_found:
                        phase_timestamps['conversion'] = current_time
                        current_progress = max(current_progress, 85)
                        progress(session_id, current_progress, "生成 Markdown…", f"格式轉換: {line[:30]}...")
                        progress_keywords_found.add("conversion")
                        progress_updated = True
                    elif current_progress < 92:
                        current_progress = max(current_progress, 88)
                        progress(session_id, int(current_progress), "最終格式化…", f"輸出: {line[:30]}...")
                        progress_updated = True
                
                # 階段 6: 完成 (92%-95%)
                completion_keywords = ["完成", "complete", "finished", "success", "successfully", "done"]
                if any(keyword in line_lower for keyword in completion_keywords) and current_progress >= 80:
                    current_progress = max(current_progress, 95)
                    progress(session_id, current_progress, "PDFHelper 處理完成…", "整理輸出結果")
                    progress_updated = True
                    
                elif any(keyword in line_lower for keyword in ["error", "錯誤", "failed", "exception", "traceback"]):
                    # 發現錯誤時保持當前進度，但更新狀態
                    error_detail = line[:60] + ("..." if len(line) > 60 else "")
                    progress(session_id, current_progress, "處理中遇到問題", error_detail)
                    progress_updated = True
                
                # 時間基礎的進度更新 - 避免長時間無進度更新
                elif current_progress < 90 and current_time - last_progress_update > 8:  # 8秒沒更新就推進
                    if mineru_started:
                        # 根據當前階段決定推進量
                        if current_progress < 40:
                            increment = 2  # 初期階段快一點
                        elif current_progress < 70:
                            increment = 1.5  # 中期穩定推進
                        else:
                            increment = 0.8  # 後期小幅推進
                        
                        increment = min(increment, 90 - current_progress)
                        if increment > 0:
                            current_progress += increment
                            elapsed_time = int(current_time - start_time)
                            
                            # 根據進度階段顯示不同狀態
                            if current_progress < 40:
                                status = "PDFHelper 初始化中…"
                            elif current_progress < 70:
                                status = "AI 深度分析中…"
                            else:
                                status = "生成結果中…"
                                
                            progress(session_id, int(current_progress), status, f"處理進行中 ({elapsed_time}s)")
                            progress_updated = True
                
                # 更新最後進度更新時間
                if progress_updated:
                    last_progress_update = current_time
                
                # 發送到前端 (所有日誌)
                log_output(session_id, line)
                
                # 同時輸出到控制台/終端機
                safe_line = line.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
                print(f"[PDFHelper] {safe_line}", flush=True, file=sys.stderr)
                
            except Exception as e:
                error_msg = f"輸出編碼錯誤: {str(e)}"
                print(f"[PDFHelper-ERROR] {error_msg}", flush=True, file=sys.stderr)
                log_output(session_id, f"[ERROR] {error_msg}")
        
        # 更新 pipeline_kwargs 使用增強版回調
        pipeline_kwargs["output_callback"] = enhanced_output_callback
        
        result = run_pipeline(file_path, **pipeline_kwargs)
        
        processing_time = time.time() - start_time
        log_output(session_id, f"[INFO] PDF 處理完成，總耗時: {processing_time:.2f} 秒")
        
        markdown = result.get("markdown_text") or "# PDFHelper 處理完成\n\n(尚未取得 Markdown 內容)"
        image_count = len(result.get("images", []))
        
        progress(session_id, 100, "完成", f"已產生 Markdown，包含 {image_count} 個圖片")
        log_output(session_id, f"[SUCCESS] 成功產生 Markdown，包含 {image_count} 個圖片")

        emit({
            "type": "done",
            "sessionId": session_id,
            "content": markdown,
            "contentEn": markdown,
            "metadata": {
                "source": result.get("display_name"),
                "processingTime": result.get("processing_time"),
                "markdownPath": result.get("markdown_path"),
                "jsonPath": result.get("json_path"),
                "images": result.get("images", []),
                "company": company,
                "model": model,
                "method": method,
                "lang": lang,
                "device": device,
            },
        })
        return 0
    except Exception as exc:  # pylint: disable=broad-except
        error_message = f"PDFHelper 處理失敗: {exc}"
        if os.getenv("PDFHELPER_VERBOSE", "0") not in {"0", "false", "False"}:
            traceback.print_exc()
        emit({"type": "error", "sessionId": session_id, "error": error_message})
        return 1


if __name__ == "__main__":
    sys.exit(main())
