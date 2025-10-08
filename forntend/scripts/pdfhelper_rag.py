"""高階 RAG 問答工具，供 Electron 腳本呼叫 PDFHelper 後端。"""
from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Any, Dict, List, Optional

import os

from pdfhelper_bridge import get_pdfhelper_client


def _clean_dict(source: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not source:
        return {}
    return {k: v for k, v in source.items() if v not in (None, "", [], {})}


def _env(name: str) -> Optional[str]:
    value = os.getenv(name)
    return value if value not in (None, "") else None


def _load_runtime_settings() -> tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    translator = _clean_dict({
        "provider": (_env("PDFHELPER_TRANSLATOR_PROVIDER") or _env("PDFHELPER_TRANSLATOR_SERVICE")),
        "model": (_env("PDFHELPER_TRANSLATOR_MODEL") or _env("PDFHELPER_TRANSLATOR_NAME")),
        "api_key": (_env("PDFHELPER_TRANSLATOR_KEY") or _env("PDFHELPER_API_KEY")),
    })

    embedding = _clean_dict({
        "provider": _env("PDFHELPER_EMBED_SERVICE"),
        "model": _env("PDFHELPER_EMBED_MODEL"),
        "api_key": _env("PDFHELPER_EMBED_API_KEY"),
    })

    rag = _clean_dict({
        "provider": _env("PDFHELPER_RAG_SERVICE"),
        "model": _env("PDFHELPER_RAG_MODEL"),
    })

    return translator, embedding, rag


def _collapse_answer(answer: Any) -> str:
    if answer is None:
        return ""
    if isinstance(answer, str):
        return answer
    if isinstance(answer, Iterable):
        parts: List[str] = []
        for chunk in answer:
            if chunk is None:
                continue
            parts.append(str(chunk))
        return "".join(parts)
    return str(answer)


def _normalize_sources(sources: Any) -> List[Dict[str, Any]]:
    if not sources:
        return []

    normalized: List[Dict[str, Any]] = []
    for item in sources:
        if item is None:
            continue
        if isinstance(item, dict):
            chunk_id = item.get("chunk_id") or item.get("chunkId") or item.get("id")
            normalized.append({
                "chunkId": chunk_id,
                "content": item.get("content"),
                "documentName": item.get("document_name") or item.get("documentName"),
                "page": item.get("page_num") or item.get("page") or item.get("pageNumber"),
                "score": item.get("score"),
            })
            continue

        chunk_id = getattr(item, "chunk_id", None)
        normalized.append({
            "chunkId": chunk_id,
            "content": getattr(item, "content", None),
            "documentName": getattr(item, "document_name", None),
            "page": getattr(item, "page_num", None),
            "score": getattr(item, "score", None),
        })

    return [entry for entry in normalized if entry.get("content")]


def _derive_collection(
    collection: Optional[str],
    translated_json_path: Optional[str],
    source: Optional[str],
) -> Optional[str]:
    if collection:
        return collection
    if translated_json_path:
        return Path(translated_json_path).name
    if source:
        # 若只有 markdown 路徑，可推測對應 JSON 名稱，但需要使用者後續補齊
        candidate = Path(source)
        return candidate.with_suffix(".json").name
    return None


def ask_question(
    question: str,
    *,
    collection: Optional[str] = None,
    translated_json_path: Optional[str] = None,
    source: Optional[str] = None,
    top_k: int = 7,
    include_sources: bool = True,
) -> Dict[str, Any]:
    """向 RAG 問答系統發送問題，回傳答案與引用片段。"""

    question = (question or "").strip()
    if not question:
        return {"success": False, "error": "問題內容不可為空"}

    translator_settings, embedding_settings, rag_settings = _load_runtime_settings()
    helper = get_pdfhelper_client(
        translator_settings=translator_settings,
        embedding_settings=embedding_settings,
        rag_settings=rag_settings,
        verbose=os.getenv("PDFHELPER_VERBOSE", "0") not in {"0", "false", "False"},
    )

    collection_name = _derive_collection(collection, translated_json_path, source)
    if not collection_name:
        return {"success": False, "error": "找不到相應的 RAG 集合，請先完成 PDF 解析流程"}

    result = helper.ask_question(
        question,
        document_name=collection_name,
        top_k=top_k,
        include_sources=include_sources,
    )

    if not result.success:
        return {"success": False, "error": result.message or "RAG 問答失敗"}

    data = result.data or {}
    answer = _collapse_answer(data.get("answer"))
    sources = _normalize_sources(data.get("sources")) if include_sources else []

    return {
        "success": True,
        "answer": answer,
        "sources": sources,
        "collection": collection_name,
    }


__all__ = ["ask_question"]
