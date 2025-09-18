"""
翻譯器服務模塊 - 提供多種翻譯器的接口
"""
from .translator_ollama import OllamaTranslator
from .translator_gemini import GeminiTranslator

__all__ = [
    "OllamaTranslator", 
    "GeminiTranslator"
]