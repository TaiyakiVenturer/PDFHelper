"""
進度管理模組
用於管理非同步任務的進度狀態，避免循環導入問題
"""
from threading import Lock
from typing import Dict, Any, Optional

import logging
from backend.api import setup_project_logger  # 導入日誌設置函數

setup_project_logger(verbose=True)  # 設置全局日誌記錄器
logger = logging.getLogger(__name__)

class ProgressManager:
    """進度管理器類別，封裝進度管理功能"""
    
    _instance = None  # 單例實例
    def __init__(self, state_dict: Dict[str, Any], lock: Lock):
        self._state = state_dict
        self._lock = lock
        ProgressManager._instance = self  # 保存到類變數 (全部類共享)
        logger.info("[ProgressManager] 進度狀態已初始化")

    @classmethod
    def get_state(cls) -> Optional[Dict[str, Any]]:
        """獲取當前進度狀態"""
        if cls._instance is None:
            logger.error("[獲取進度狀態] ProgressManager 未初始化！")
            return None
        with cls._instance._lock:
            return cls._instance._state.copy()

    @classmethod
    def progress_start(cls) -> bool:
        """
        標記處理開始
        
        Returns:
            bool: 如果成功開始返回 True，如果已有任務在處理返回 False
        """
        if cls._instance is None:
            logger.error("[進度開始] ProgressManager 未初始化！")
            return False
        
        if cls._instance._state["is_processing"]:
            logger.warning("[進度開始] 已有任務在處理中，拒絕新請求")
            return False

        with cls._instance._lock:
            cls._instance._state["is_processing"] = True
            cls._instance._state["progress"] = 0
            cls._instance._state["stage"] = "idle"
            cls._instance._state["message"] = "開始處理"
            cls._instance._state["error"] = None
            cls._instance._state["result"] = None

        logger.info("[進度開始] is_processing 設置為 True")
        return True

    @classmethod
    def progress_complete(cls, result: Optional[Dict[str, Any]] = None):
        """
        標記處理完成
        
        Args:
            result: 處理結果，可選 例如 {"collection_name": "doc_name"}
        """
        if cls._instance is None:
            logger.error("[進度完成] 進度狀態未初始化！")
            return
        
        with cls._instance._lock:
            cls._instance._state["is_processing"] = False
            cls._instance._state["progress"] = 100
            cls._instance._state["message"] = "處理完成"
            cls._instance._state["stage"] = "idle"
            cls._instance._state["result"] = result
        
        logger.info("[進度完成] 處理完成")

    @classmethod
    def progress_update(cls, progress: float, message: str, stage: str):
        """
        更新進度
        
        Args:
            progress: 進度百分比 (0-100)
            message: 狀態訊息
            stage: 當前階段 ("idle", "process-pdf", "translating-json", "adding-to-rag")
        """
        if cls._instance is None:
            logger.warning("[進度更新] ProgressManager 未初始化，忽略更新")
            return
        
        if cls._instance._state["is_processing"] is False:
            logger.warning(f"[進度更新被拒絕] 當前沒有任務在處理中，無法更新進度")
            return
        
        with cls._instance._lock:
            cls._instance._state["progress"] = progress
            cls._instance._state["message"] = message
            cls._instance._state["stage"] = stage

        logger.info(f"[進度更新] progress={progress}%, stage={stage}, message={message}")

    @classmethod
    def progress_fail(cls, error_message: str):
        """
        標記處理失敗
        
        Args:
            error_message: 錯誤訊息
        """
        if cls._instance is None:
            logger.error("[進度失敗] 進度狀態未初始化！")
            return
        
        with cls._instance._lock:
            cls._instance._state["is_processing"] = False
            cls._instance._state["message"] = "處理遇到錯誤"
            cls._instance._state["stage"] = "idle"
            cls._instance._state["error"] = error_message

        logger.error(f"[進度失敗] {error_message}")

        logger.error(f"[進度失敗] {error_message}")
