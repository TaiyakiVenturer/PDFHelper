#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RAG 聊天腳本：從 stdin 接收 JSON，回傳 PDFHelper RAG 的問答結果。"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict

from pdfhelper_rag import ask_question as rag_ask


def _configure_stdio() -> None:
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        except Exception:
            continue


def _read_request() -> Dict[str, Any]:
    raw = sys.stdin.readline()
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _make_followups(answer: str) -> list[str]:
    suggestions: list[str] = []
    if not answer:
        return suggestions
    if "例如" in answer or "例如" in answer:
        suggestions.append("可以再提供更多範例嗎？")
    suggestions.append("這份文件的核心結論是什麼？")
    suggestions.append("還有哪些段落與上述問題相關？")
    # 保持唯一且最多三個
    deduped: list[str] = []
    seen = set()
    for item in suggestions:
        item = item.strip()
        if not item or item in seen:
            continue
        seen.add(item)
        deduped.append(item)
        if len(deduped) >= 3:
            break
    return deduped


def main() -> int:
    _configure_stdio()

    request = _read_request()
    question = str(request.get("question") or "").strip()
    if not question:
        print(json.dumps({"success": False, "error": "缺少問題內容"}, ensure_ascii=False))
        return 0

    collection = request.get("collection") or None
    translated_json_path = request.get("translatedJsonPath") or None
    source = request.get("source") or None
    top_k = request.get("topK") or request.get("top_k")
    try:
        top_k_int = int(top_k) if top_k is not None else 7
    except (TypeError, ValueError):
        top_k_int = 7

    rag_response = rag_ask(
        question,
        collection=collection,
        translated_json_path=translated_json_path,
        source=source,
        top_k=top_k_int,
        include_sources=True,
    )

    if not rag_response.get("success"):
        print(json.dumps({
            "success": False,
            "error": rag_response.get("error") or "RAG 問答失敗",
        }, ensure_ascii=False))
        return 0

    answer = str(rag_response.get("answer") or "")
    payload = {
        "success": True,
        "answer": answer,
        "text": answer,
        "sources": rag_response.get("sources") or [],
        "collection": rag_response.get("collection"),
        "followups": _make_followups(answer),
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
