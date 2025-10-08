import io
import json
import os
import sys
import time
import traceback
from typing import Any, Dict, Optional

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
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")  # type: ignore[assignment]
    
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

        def clean_settings(options: Dict[str, Optional[Any]]) -> Dict[str, Any]:
            return {key: value for key, value in options.items() if value not in (None, "", [], {})}

        translator_api_key = os.getenv("PDFHELPER_TRANSLATOR_KEY") or os.getenv("PDFHELPER_API_KEY")
        translator_settings = clean_settings({
            "provider": (company or "").strip().lower() or None,
            "model": model,
            "api_key": translator_api_key,
        })
        embedding_settings = clean_settings({
            "provider": (os.getenv("PDFHELPER_EMBED_SERVICE") or None),
            "model": os.getenv("PDFHELPER_EMBED_MODEL"),
            "api_key": os.getenv("PDFHELPER_EMBED_API_KEY"),
        })
        rag_settings = clean_settings({
            "provider": (os.getenv("PDFHELPER_RAG_SERVICE") or None),
            "model": os.getenv("PDFHELPER_RAG_MODEL"),
        })

        pipeline_kwargs.update({
            "translator_settings": translator_settings,
            "embedding_settings": embedding_settings,
            "rag_settings": rag_settings,
        })

        progress(session_id, 5, "準備 PDFHelper 後端…", f"處理檔案: {os.path.basename(file_path)}")
        
        start_time = time.time()
        log_output(session_id, f"[INFO] 開始處理 PDF 檔案: {os.path.basename(file_path)}")
        log_output(session_id, f"[INFO] 使用參數 - 方法: {method}, 語言: {lang}, 設備: {device}")
        if translator_settings.get("provider"):
            provider_label = translator_settings.get("provider")
            model_label = translator_settings.get("model") or "default"
            log_output(session_id, f"[INFO] 翻譯服務: {provider_label} / {model_label}")
        
        # 追蹤處理進度 - 依照後端回報階段更新
        current_progress = 8  # 前端準備只佔 8%

        def advance_progress(target: int, status_text: str, detail: Optional[str] = None) -> None:
            nonlocal current_progress
            target = int(target)
            if target < current_progress:
                target = current_progress
            if target > 99:
                target = 99
            current_progress = target
            progress(session_id, current_progress, status_text, detail)

        def pipeline_status_handler(update: Dict[str, Any]) -> None:
            if not isinstance(update, dict):
                return

            stage = update.get("stage")
            event = update.get("event")

            if stage == "mineru":
                if event == "start":
                    detail = update.get("message") or (f"檔案: {update.get('file')}" if update.get("file") else "啟動 MinerU")
                    log_output(session_id, f"[INFO] MinerU 啟動: {detail}")
                    advance_progress(12, "啟動 PDFHelper MinerU…", detail)
                elif event == "complete":
                    seconds = update.get("seconds")
                    pieces = []
                    if update.get("markdown"):
                        pieces.append(f"Markdown: {update['markdown']}")
                    if update.get("json"):
                        pieces.append(f"JSON: {update['json']}")
                    if isinstance(seconds, (int, float)):
                        pieces.append(f"耗時 {seconds:.2f} 秒")
                    detail = "；".join(pieces) or "MinerU 完成"
                    log_output(session_id, f"[INFO] MinerU 完成: {detail}")
                    advance_progress(60, "PDF 解析完成", detail)
                return

            if stage == "translation":
                seconds = update.get("seconds")
                if event == "start":
                    base_detail = update.get("message") or "準備翻譯 JSON"
                    path = update.get("path")
                    detail = f"{base_detail}（{path}）" if path else base_detail
                    log_output(session_id, f"[INFO] 翻譯開始: {detail}")
                    advance_progress(70, "翻譯 JSON…", detail)
                elif event == "complete":
                    base_detail = update.get("message") or "翻譯完成"
                    if isinstance(seconds, (int, float)):
                        base_detail += f"（{seconds:.2f} 秒）"
                    path = update.get("path")
                    detail = f"{base_detail} -> {path}" if path else base_detail
                    log_output(session_id, f"[INFO] {detail}")
                    advance_progress(80, "翻譯完成", detail)
                return

            if stage == "markdown":
                language = (update.get("language") or "").upper()
                if event == "start":
                    msg = f"準備重建 {language or 'Markdown'}"
                    log_output(session_id, f"[INFO] {msg}")
                elif event == "complete":
                    path = update.get("path")
                    detail = path or "重建完成"
                    log_output(session_id, f"[INFO] 已重建 {language or 'Markdown'}: {detail}")
                    target = 83 if language == "ZH" else 86 if language == "EN" else 82
                    advance_progress(target, f"{language or 'Markdown'} 重建完成", detail)
                elif event == "failed":
                    warn_msg = update.get("message") or "重建失敗"
                    log_output(session_id, f"[WARNING] {language or 'Markdown'} 重建失敗: {warn_msg}")
                return

            if stage == "rag":
                seconds = update.get("seconds")
                if event == "start":
                    collection = update.get("collection")
                    detail = f"集合: {collection}" if collection else "準備建立向量索引"
                    log_output(session_id, f"[INFO] RAG 處理開始: {detail}")
                    advance_progress(88, "建立向量資料庫…", detail)
                elif event == "complete":
                    collection = update.get("collection")
                    detail = f"集合 {collection} 已準備就緒" if collection else (update.get("message") or "RAG 處理完成")
                    if isinstance(seconds, (int, float)):
                        detail += f"（{seconds:.2f} 秒）"
                    log_output(session_id, f"[INFO] RAG 完成: {detail}")
                    advance_progress(96, "RAG 準備完成", detail)

        pipeline_kwargs["status_callback"] = pipeline_status_handler
        
        result = run_pipeline(file_path, **pipeline_kwargs)
        
        processing_time = time.time() - start_time
        log_output(session_id, f"[INFO] PDF 處理完成，總耗時: {processing_time:.2f} 秒")
        
        fallback_markdown = "# PDFHelper 處理完成\n\n(尚未取得 Markdown 內容)"
        markdown_en = result.get("markdown_text_en") or result.get("markdown_text") or fallback_markdown
        markdown_zh = result.get("markdown_text_zh")
        primary_markdown = markdown_zh or markdown_en or fallback_markdown
        image_count = len(result.get("images", []))

        final_notes = []
        translation_info = result.get("translation", {}) or {}
        rag_info = result.get("rag", {}) or {}
        if translation_info.get("json_path"):
            final_notes.append("翻譯完成")
        if rag_info.get("collection"):
            final_notes.append(f"RAG 集合 {rag_info.get('collection')}")
        final_notes.append(f"圖片 {image_count} 張")

        progress(session_id, 100, "完成", "；".join(final_notes))
        log_output(session_id, f"[SUCCESS] 處理完成，{'；'.join(final_notes)}")

        emit({
            "type": "done",
            "sessionId": session_id,
            "content": primary_markdown,
            "contentZh": markdown_zh,
            "contentEn": markdown_en,
            "metadata": {
                "source": result.get("display_name"),
                "processingTime": result.get("processing_time"),
                "markdownPath": result.get("markdown_path"),
                "markdownPathZh": result.get("markdown_path_zh"),
                "markdownPathEn": result.get("markdown_path_en") or result.get("markdown_path"),
                "jsonPath": result.get("json_path"),
                "translatedJsonPath": result.get("translated_json_path"),
                "ragCollection": result.get("rag_collection"),
                "translation": translation_info,
                "rag": rag_info,
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
