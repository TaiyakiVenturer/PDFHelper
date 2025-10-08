"""Claude 翻譯器 - 透過 Anthropic Messages API 進行翻譯"""
from __future__ import annotations

import logging
import os
from typing import Optional

import requests

from .translator_base import TranslatorBase

logger = logging.getLogger(__name__)


class ClaudeTranslator(TranslatorBase):
    """使用 Anthropic Claude API 的翻譯器實作。"""

    def __init__(
        self,
        instance_path: str,
        model_name: str = "claude-3-5-sonnet-latest",
        api_key: str = "",
        base_url: Optional[str] = None,
        verbose: bool = False,
    ) -> None:
        super().__init__(instance_path=instance_path, model_name=model_name, verbose=verbose)
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY") or os.getenv("PDFHELPER_TRANSLATOR_KEY", "")
        self._base_url = (base_url or os.getenv("ANTHROPIC_BASE_URL") or "https://api.anthropic.com").rstrip("/")
        self._api_version = os.getenv("ANTHROPIC_API_VERSION", "2023-06-01")

    def is_available(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self._api_key,
            "anthropic-version": self._api_version,
            "content-type": "application/json",
        }

    def _system_prompt(self) -> str:
        return (
            "You are an expert academic translator. Translate English academic passages into Traditional Chinese, "
            "maintaining terminology consistency and preserving technical symbols."
        )

    def send_translate_request(self, prompt: str, end_chat: bool = False) -> Optional[str]:
        if end_chat:
            return ""
        if not prompt.strip():
            return ""

        payload = {
            "model": self.model_name,
            "max_tokens": 1200,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": [{"type": "text", "text": self._system_prompt()}]},
                {"role": "user", "content": [{"type": "text", "text": prompt}]},
            ],
        }

        try:
            response = requests.post(
                f"{self._base_url}/v1/messages",
                headers=self._headers(),
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            content = data.get("content") or []
            if not content:
                logger.error("Anthropic 回傳內容為空: %s", data)
                return ""
            first_block = content[0]
            if isinstance(first_block, dict):
                return str(first_block.get("text", "")).strip()
            return ""
        except requests.RequestException as exc:
            logger.error("Anthropic 翻譯請求失敗: %s", exc)
            return ""

