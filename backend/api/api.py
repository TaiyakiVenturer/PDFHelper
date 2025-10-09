from flask import Flask, request, jsonify
from flask_cors import CORS
from threading import Lock, Thread

import sys
from pathlib import Path

# 🔧 自動修正 PYTHONPATH - 確保無論如何執行都能找到模組
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數
setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

# 現在可以安全地使用絕對導入
from backend.api.pdf_helper import PDFHelper
from backend.api.config import Config, MinerUConfig, TranslatorConfig, EmbeddingServiceConfig, RAGConfig

from backend.api import ProgressManager  # 導入進度管理器

app = Flask(__name__)
CORS(app)

# 全域進度變數 - 保留在 api.py 中
current_progress = {
    "is_processing": False,
    "progress": float(0),
    "stage": "idle",  # 初始階段為 idle
    "message": "",
    "error": None,
    "result": None
}

# PDFHelper 實例
pdf_helper = PDFHelper(
    config=Config(
        mineru_config=MinerUConfig(verbose=True),
        translator_config=TranslatorConfig(verbose=True),
        embedding_service_config=EmbeddingServiceConfig(
            llm_service="ollama",
            verbose=True
        ),
        rag_config=RAGConfig(verbose=True),
    ), 
    verbose=True
)

# 初始化進度管理器 （單例模式，不需要保存實例引用）
progress_lock = Lock()
ProgressManager(current_progress, progress_lock)

# ==================== API 端點 ====================

@app.route('/api/get-progress', methods=['GET'])
def get_progress_endpoint():
    """前端獲取當前進度"""
    with progress_lock:
        return jsonify(current_progress)

@app.route('/api/full-process-async', methods=['POST'])
def full_process_async_endpoint():
    """非同步處理 PDF 到 RAG 的完整流程"""
    allow = ProgressManager.progress_start()
    if not allow:
        return jsonify({"success": False, "message": "已有任務在處理中，請稍後再試"}), 429  # Too Many Requests

    data = request.json
    pdf_name = data.get('pdf_name')
    method = data.get('method')
    lang = data.get('lang')
    device = data.get('device')

    # 在這裡啟動一個新線程來處理請求
    Thread(
        target=pdf_helper.from_pdf_to_rag,
        args=(
            pdf_name,
            method,
            lang,
            device
        ),
        daemon=True
    ).start()
    return jsonify({"success": True, "message": "任務已受理，正在處理中"})

@app.route('/api/process-pdf', methods=['POST'])
def process_pdf_endpoint():
    """處理 PDF 檔案"""
    try:
        data = request.json
        pdf_name = data.get('pdf_name')
        method = data.get('method')
        lang = data.get('lang')
        device = data.get('device')
        
        if not pdf_name:
            return jsonify({"success": False, "message": "缺少 pdf_name 參數"}), 400

        result = pdf_helper.process_pdf_to_json(
            pdf_name=pdf_name,
            method=method,
            lang=lang,
            device=device
        )
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'data': result.data
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"錯誤: {str(e)}"}), 500

@app.route('/api/translate-json', methods=['POST'])
def translate_json_endpoint():
    """翻譯 JSON 內容"""
    try:
        data = request.json
        json_path = data.get('json_path')
        
        if not json_path:
            return jsonify({"success": False, "message": "缺少 json_path 參數"}), 400

        result = pdf_helper.translate_json_content(json_path)
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'data': result.data
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"錯誤: {str(e)}"}), 500

@app.route('/api/add-to-rag', methods=['POST'])
def add_to_rag_endpoint():
    """將 JSON 加入 RAG 向量資料庫"""
    try:
        data = request.json
        json_name = data.get('json_name')
        
        if not json_name:
            return jsonify({"success": False, "message": "缺少 json_name 參數"}), 400

        result = pdf_helper.add_json_to_rag(json_name)
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'data': result.data
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"錯誤: {str(e)}"}), 500

@app.route('/api/ask-question', methods=['POST'])
def ask_question_endpoint():
    """向 RAG 系統提問"""
    try:
        data = request.json
        question = data.get('question')
        document_name = data.get('document_name')
        top_k = data.get('top_k', 10)
        include_sources = data.get('include_sources', True)
        
        if not question or not document_name:
            return jsonify({"success": False, "message": "缺少 question 或 document_name 參數"}), 400

        result = pdf_helper.ask_question(
            question=question,
            document_name=document_name,
            top_k=top_k,
            include_sources=include_sources
        )
        
        # 注意: answer 可能是 Generator,需要轉成字串
        answer_text = ""
        if result.success and result.data:
            answer_generator = result.data.get('answer')
            if answer_generator:
                # 收集所有 chunk
                answer_text = "".join([chunk.text for chunk in answer_generator])
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'data': {
                'answer': answer_text,
                'sources': result.data.get('sources') if result.data else []
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"錯誤: {str(e)}"}), 500

@app.route('/api/reconstruct-markdown', methods=['POST'])
def reconstruct_markdown_endpoint():
    """重建 Markdown 檔案"""
    try:
        data = request.json
        file_name = data.get('file_name')
        method = data.get('method', 'auto')
        lang = data.get('lang', 'zh')
        
        if not file_name:
            return jsonify({"success": False, "message": "缺少 file_name 參數"}), 400

        result = pdf_helper.reconstruct_markdown(
            file_name=file_name,
            method=method,
            lang=lang
        )
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'data': result.data
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"錯誤: {str(e)}"}), 500

@app.route('/api/system-health', methods=['GET'])
def system_health_endpoint():
    """獲取系統健康狀態"""
    try:
        result = pdf_helper.get_system_health()
        
        return jsonify({
            'success': result.success,
            'message': result.message,
            'data': result.data
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"錯誤: {str(e)}"}), 500

if __name__ == '__main__':
    host = "localhost"
    port = 13635
    app.run(host=host, port=port, debug=True)