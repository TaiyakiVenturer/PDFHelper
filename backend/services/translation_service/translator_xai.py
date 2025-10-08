"""xAI 翻譯器 - 透過 xAI Grok API 進行翻譯"""
from __future__ import annotations

import logging
import os
from typing import Optional

import requests

from .translator_base import TranslatorBase

logger = logging.getLogger(__name__)


class XaiTranslator(TranslatorBase):
    """使用 xAI Grok Chat Completions API 的翻譯器實作。"""

    def __init__(
        self,
        instance_path: str,
        model_name: str = "grok-beta",
        api_key: str = "",
        base_url: Optional[str] = None,
        verbose: bool = False,
    ) -> None:
        super().__init__(instance_path=instance_path, model_name=model_name, verbose=verbose)
        self._api_key = api_key or os.getenv("XAI_API_KEY") or os.getenv("PDFHELPER_TRANSLATOR_KEY", "")
        self._base_url = (base_url or os.getenv("XAI_BASE_URL") or "https://api.x.ai/v1").rstrip("/")

    def is_available(self) -> bool:
        return bool(self._api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _system_prompt(self) -> str:
        return (
            "You are a professional academic translator. Translate English technical content into Traditional Chinese, "
            "preserving formulas, citations, and terminology consistency."
        )

    def send_translate_request(self, prompt: str, end_chat: bool = False) -> Optional[str]:
        if end_chat:
            return ""
        if not prompt.strip():
            return ""

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": self._system_prompt()},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 1200,
        }

        try:
            response = requests.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            choices = data.get("choices") or []
            if not choices:
                logger.error("xAI 回傳內容為空: %s", data)
                return ""
            content = (choices[0].get("message") or {}).get("content", "").strip()
            return content
        except requests.RequestException as exc:
            logger.error("xAI 翻譯請求失敗: %s", exc)
            return ""

