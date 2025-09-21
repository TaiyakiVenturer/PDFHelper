import logging
import os
from datetime import datetime

class LevelFormatter(logging.Formatter):
    def __init__(self):
        super().__init__()
        
        # 統一的時間格式 - 只到秒，無毫秒
        time_format = '%m-%d %H:%M:%S'
        
        self.formatters = {
            logging.DEBUG: logging.Formatter(
                '%(asctime)s - 🔧 DEBUG ---- [%(filename)s:%(funcName)s:%(lineno)d] - %(message)s',
                datefmt=time_format
            ),
            logging.INFO: logging.Formatter(
                '%(asctime)s - ✅ INFO ----- [%(name)s] - %(message)s',
                datefmt=time_format
            ),
            logging.WARNING: logging.Formatter(
                '%(asctime)s - ⚠️ WARNING -- [%(filename)s:%(funcName)s] - %(message)s',
                datefmt=time_format
            ),
            logging.ERROR: logging.Formatter(
                '%(asctime)s - ❌ ERROR ---- [%(filename)s:%(funcName)s:%(lineno)d] - %(message)s',
                datefmt=time_format
            ),
            logging.CRITICAL: logging.Formatter(
                '%(asctime)s - 🚨 CRITICAL - [%(pathname)s:%(lineno)d] - %(message)s',
                datefmt=time_format
            )
        }
    
    def format(self, record):
        formatter = self.formatters.get(record.levelno)
        if formatter:
            return formatter.format(record)
        return super().format(record)

def setup_project_logger(verbose: bool = False):
    """
    設置專案的全局日誌記錄器
    
    Args:
        verbose: 是否啟用詳細日誌 (預設為False)
    """

    os.makedirs("logs", exist_ok=True)
    log_level = logging.DEBUG if verbose else logging.INFO

    file_handler = logging.FileHandler(
        f"logs/{datetime.now().strftime('%Y-%m-%d_%H-%M')}.log",
        encoding='utf-8'
    )
    file_handler.setFormatter(LevelFormatter())

    std_handler = logging.StreamHandler()
    std_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - [%(filename)s:%(funcName)s] - %(message)s',
        datefmt='%H:%M:%S'
    ))

    logging.basicConfig(
        level=log_level,
        handlers=[
            file_handler,
            std_handler
        ]
    )

    # 抑制第三方庫的調試信息
    third_party_loggers = [
        "requests", "urllib3", "httpcore", "httpx",
        "google", "genai", "google.genai",           # Google API 相關
        "h11", "h2", "hpack",                        # HTTP 相關
        "asyncio", "concurrent.futures",             # 異步相關
        "config"                                     # 可能的配置相關日誌
    ]
    
    for logger_name in third_party_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)

    return