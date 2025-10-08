"""
翻譯器服務模塊 - 提供多種翻譯器的接口
"""
from .translator_ollama import OllamaTranslator
from .translator_gemini import GeminiTranslator
from .translator_chatgpt import ChatGPTTranslator
from .translator_claude import ClaudeTranslator
from .translator_xai import XaiTranslator

__all__ = [
    "OllamaTranslator",
    "GeminiTranslator",
    "ChatGPTTranslator",
    "ClaudeTranslator",
    "XaiTranslator",
]