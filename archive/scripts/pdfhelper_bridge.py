"""這是一個在 Electron 輔助腳本與 PDFHelper 後端之間的實用橋樑模組。

這個模組隱藏了 PDFHelper 專案的內部結構細節，並向 Electron 的 Python 腳本提供了一個輕量級 API。
其目標包括：

將原始 PDF 檔案放入 PDFHelper 的實例目錄結構中

執行 MinerU，以產生 JSON／Markdown 格式的輸出檔案

提供便捷的輔助功能，用於讀取產生的 Markdown 內容

這裡的函式設計成同步執行，因為它們在從 Electron 主程序啟動的專用 Python 子程序中運行。
"""

from __future__ import annotations
import os
import re
import shutil
import sys
# ---------------------------------------------------------------------------
# 高階 PDFHelper/RAG 工具
# ---------------------------------------------------------------------------
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Callable


# ---------------------------------------------------------------------------
# Locate the PDFHelper backend package
# ---------------------------------------------------------------------------

THIS_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = THIS_DIR.parent.parent  # 預期: <repo_root>


def _resolve_path(path: Path) -> Path:
	"""Return a resolved path without requiring it to exist."""
	try:
		return path.expanduser().resolve()
	except FileNotFoundError:
		return path.expanduser()


def _discover_pdfhelper_root() -> Path:
	"""Locate the PDFHelper project root, supporting legacy layouts."""
	env_root = os.getenv("PDFHELPER_ROOT")
	if env_root:
		candidate = _resolve_path(Path(env_root))
		if candidate.is_dir():
			return candidate

	# 新版預設：frontend 與 backend 為並列目錄
	backend_sibling = WORKSPACE_ROOT / "backend"
	if backend_sibling.is_dir():
		return _resolve_path(WORKSPACE_ROOT)

	# 舊版備援：PDFHelper-master/PDFHelper-master/backend 結構
	legacy_root = WORKSPACE_ROOT / "PDFHelper-master"
	if legacy_root.is_dir() and (legacy_root / "backend").is_dir():
		return _resolve_path(legacy_root)

	return _resolve_path(WORKSPACE_ROOT)


def _discover_backend_root(pdfhelper_root: Path) -> Path:
	"""Determine the backend directory based on environment hints and defaults."""
	env_backend = os.getenv("PDFHELPER_BACKEND")
	if env_backend:
		candidate = _resolve_path(Path(env_backend))
		if candidate.is_dir():
			return candidate

	candidates = [
		pdfhelper_root / "backend",
		WORKSPACE_ROOT / "backend",
		pdfhelper_root.parent / "backend",
	]

	seen: set[Path] = set()
	for candidate in candidates:
		candidate = _resolve_path(candidate)
		if candidate in seen:
			continue
		seen.add(candidate)
		if candidate.is_dir():
			return candidate

	return _resolve_path(pdfhelper_root / "backend")


PDFHELPER_ROOT = _discover_pdfhelper_root()
BACKEND_ROOT = _discover_backend_root(PDFHELPER_ROOT)
INSTANCE_ROOT = _resolve_path(
	Path(os.getenv("PDFHELPER_INSTANCE", BACKEND_ROOT / "instance"))
)

# 將 PDF 檔案上傳到 backend/instance/pdfs
PDF_STORAGE_DIR = INSTANCE_ROOT / "pdfs"

if not BACKEND_ROOT.exists():
	raise RuntimeError(
		"找不到 PDFHelper backend 目錄。請確認 frontend 與 backend 位於同一層，"
		"或設定環境變數 PDFHELPER_ROOT / PDFHELPER_BACKEND 指向正確路徑。"
		f"目前偵測到: {BACKEND_ROOT}"
	)

if str(PDFHELPER_ROOT) not in sys.path:
	sys.path.insert(0, str(PDFHELPER_ROOT))

if str(BACKEND_ROOT) not in sys.path:
	sys.path.insert(0, str(BACKEND_ROOT))


# pylint: disable=wrong-import-position,import-error
from backend.api.pdf_helper import PDFHelper, HelperResult  # type: ignore
from backend.api.config import (
	Config,
	TranslatorConfig,
	EmbeddingServiceConfig,
	RAGConfig,
)
from backend.services.translation_service import GeminiTranslator, OllamaTranslator  # type: ignore

try:  # 可選的擴充翻譯器
	from backend.services.translation_service.translator_chatgpt import ChatGPTTranslator  # type: ignore
except ModuleNotFoundError:
	ChatGPTTranslator = None  # type: ignore

try:
	from backend.services.translation_service.translator_claude import ClaudeTranslator  # type: ignore
except ModuleNotFoundError:
	ClaudeTranslator = None  # type: ignore

try:
	from backend.services.translation_service.translator_xai import XaiTranslator  # type: ignore
except ModuleNotFoundError:
	XaiTranslator = None  # type: ignore


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class StagedPDF:
	"""A PDF copied into the PDFHelper instance tree."""

	original_path: Path
	staged_path: Path
	display_name: str

	@property
	def pdf_name(self) -> str:
		return self.staged_path.name


@dataclass
class MinerUArtifacts:
	"""Result of running MinerU through the backend PDFHelper API."""

	output_path: Path
	output_files: Dict[str, Optional[str]]
	processing_time: float

	@property
	def markdown_path(self) -> Optional[Path]:
		md = self.output_files.get("markdown")
		return Path(md) if md else None

	@property
	def json_path(self) -> Optional[Path]:
		js = self.output_files.get("json")
		return Path(js) if js else None

	@property
	def image_paths(self) -> List[Path]:
		return [Path(p) for p in self.output_files.get("images") or []]


@dataclass
class RAGIngestionResult:
	"""Metadata produced after translating JSON and存入向量資料庫."""

	translated_json_path: Optional[Path]
	translated_json_name: Optional[str]
	collection_name: Optional[str]
	translation_seconds: Optional[float]
	ingestion_seconds: Optional[float]
	translator_provider: str
	raw_translator_model: Optional[str]
	embedding_provider: str
	rag_provider: str
	extra: Dict[str, Any]


# ---------------------------------------------------------------------------
# Helper class
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# PDFHelper high-level helpers (translation + RAG)
# ---------------------------------------------------------------------------

_PDFHELPER_CACHE: Dict[Tuple[str, ...], PDFHelper] = {}


class PDFHelperBridge:
	"""Thin facade around MinerU for the Electron integration."""

	def __init__(self, verbose: bool = False) -> None:
		self.verbose = verbose
		self._log("初始化 PDFHelperBridge")
		INSTANCE_ROOT.mkdir(parents=True, exist_ok=True)
		PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

		self._ensure_mineru_path()

	# ------------------------------------------------------------------
	# public API
	# ------------------------------------------------------------------

	def stage_pdf(self, source_path: str | os.PathLike[str]) -> StagedPDF:
		"""Copy a user-selected PDF into PDFHelper's expected location."""

		original = Path(source_path).expanduser().resolve(strict=True)
		if original.suffix.lower() != ".pdf":
			raise ValueError(f"僅支援 PDF 檔案，收到: {original}")

		safe_name = self._safe_filename(original.name)
		staged_path = PDF_STORAGE_DIR / safe_name
		if staged_path.exists():
			staged_path = self._deduplicate_filename(safe_name)

		shutil.copy2(original, staged_path)
		self._log(f"PDF 已複製到 {staged_path}")

		return StagedPDF(original_path=original, staged_path=staged_path, display_name=original.name)

	def run_mineru(
			self,
			staged_pdf: StagedPDF,
			*,
			method: str = "auto",
			lang: str = "en",
			device: str = "cpu",
			helper: Optional[PDFHelper] = None,
		) -> MinerUArtifacts:
		"""Execute MinerU via the backend PDFHelper API and gather artifacts."""

		helper_client = helper or get_pdfhelper_client(verbose=self.verbose)
		start = time.time()
		helper_result: HelperResult = helper_client.process_pdf_to_json(
			pdf_name=staged_pdf.pdf_name,
			method=method,
			lang=lang,
			device=device,
		)
		elapsed = time.time() - start

		if not helper_result.success or not helper_result.data:
			raise RuntimeError(helper_result.message or "MinerU 執行失敗")

		data = helper_result.data
		output_path_str = data.get("output_path")
		output_files = data.get("output_file_paths") or {}
		processing_time = data.get("processing_time") or elapsed

		if not output_path_str:
			raise RuntimeError("MinerU 處理結果缺少輸出路徑")

		artifacts = MinerUArtifacts(
			output_path=Path(output_path_str),
			output_files=output_files,
			processing_time=processing_time,
		)
		self._log(
			f"MinerU 完成，耗時 {artifacts.processing_time:.2f} 秒。\n"
			f"Markdown: {artifacts.markdown_path}\nJSON: {artifacts.json_path}"
		)
		return artifacts

	def read_markdown(self, artifacts: MinerUArtifacts) -> Optional[str]:
		"""Return the generated Markdown text if present."""

		md_path = artifacts.markdown_path
		if not md_path or not md_path.exists():
			self._log("MinerU 未產生 Markdown 檔案", level="warning")
			return None
		return md_path.read_text(encoding="utf-8", errors="replace")

	# ------------------------------------------------------------------
	# internal helpers
	# ------------------------------------------------------------------

	def _safe_filename(self, name: str) -> str:
		base, suffix = os.path.splitext(name)
		base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
		base = base.strip("._") or "document"
		return f"{base}{suffix.lower()}"

	def _deduplicate_filename(self, safe_name: str) -> Path:
		stem, suffix = os.path.splitext(safe_name)
		counter = 1
		while True:
			candidate = PDF_STORAGE_DIR / f"{stem}_{counter}{suffix}"
			if not candidate.exists():
				return candidate
			counter += 1

	def _log(self, message: str, *, level: str = "info") -> None:
		if not self.verbose:
			return
		prefix = {
			"info": "[bridge]",
			"warning": "[bridge][警告]",
			"error": "[bridge][錯誤]",
		}.get(level.lower(), "[bridge]")
		print(f"{prefix} {message}", file=sys.stderr)

	def _ensure_mineru_path(self) -> None:
		"""確保 MinerU CLI 可用，並提供友善的錯誤訊息與環境變數支援。"""

		exe_name = "mineru.exe" if os.name == "nt" else "mineru"

		def _prepend_to_path(directory: Path) -> None:
			directory = directory.expanduser()
			if not directory.is_dir():
				return
			directory_str = str(directory)
			current = os.environ.get("PATH", "")
			parts = [p for p in current.split(os.pathsep) if p]
			if directory_str not in parts:
				os.environ["PATH"] = os.pathsep.join([directory_str, *parts]) if parts else directory_str

		def _use_executable(executable: Path, source: str) -> bool:
			executable = executable.expanduser()
			if not executable.is_file():
				return False
			_prepend_to_path(executable.parent)
			self._log(f"使用 {source} 的 MinerU: {executable}")
			return True

		manual_exe = os.getenv("PDFHELPER_MINERU_EXE")
		if manual_exe and _use_executable(Path(manual_exe), "PDFHELPER_MINERU_EXE"):
			return
		elif manual_exe:
			self._log(f"找不到 PDFHELPER_MINERU_EXE 指定的檔案: {manual_exe}", level="warning")

		extra_dirs: List[tuple[str, Path]] = []
		extra_dir_env = os.getenv("PDFHELPER_MINERU_PATH")
		if extra_dir_env:
			dir_path = Path(extra_dir_env).expanduser()
			if dir_path.is_dir():
				extra_dirs.append(("PDFHELPER_MINERU_PATH", dir_path))
			else:
				self._log(f"PDFHELPER_MINERU_PATH 指定的資料夾不存在: {dir_path}", level="warning")

		for label, root in (("VIRTUAL_ENV", os.getenv("VIRTUAL_ENV")), ("CONDA_PREFIX", os.getenv("CONDA_PREFIX"))):
			if not root:
				continue
			root_path = Path(root).expanduser()
			scripts_dir = root_path / ("Scripts" if os.name == "nt" else "bin")
			if scripts_dir.is_dir():
				extra_dirs.append((label, scripts_dir))

		legacy_scripts = Path(r"C:\Users\User\AppData\Roaming\Python\Python311\Scripts")
		if legacy_scripts.is_dir():
			extra_dirs.append(("legacy anaconda", legacy_scripts))

		for label, directory in extra_dirs:
			_prepend_to_path(directory)
			exec_path = directory / exe_name
			if _use_executable(exec_path, label):
				return

		mineru_cmd = "mineru"
		candidate = shutil.which(mineru_cmd)

		if candidate:
			self._log(f"使用 PATH 中的 MinerU: {candidate}")
			return

		raise RuntimeError(
			"找不到 MinerU CLI。\n"
			"• 請先安裝 MinerU (例如 `pip install \"mineru[core]>=2.5.2\"`) 或從官方專案取得可執行檔。\n"
			"• 若已安裝但仍無法找到，請確認 `mineru` 指令可在命令列執行，或設定環境變數 PDFHELPER_MINERU_EXE 或 PDFHELPER_MINERU_PATH 後重新啟動應用。"
		)


# Convenience singleton -------------------------------------------------------

_BRIDGE: Optional[PDFHelperBridge] = None


def get_bridge(verbose: bool = False) -> PDFHelperBridge:
	global _BRIDGE
	if _BRIDGE is None or (_BRIDGE.verbose is False and verbose):
		_BRIDGE = PDFHelperBridge(verbose=verbose)
	return _BRIDGE


# ---------------------------------------------------------------------------
# 高階 PDFHelper/RAG 工具
# ---------------------------------------------------------------------------

def _normalize_provider(provider: Optional[str], *, default: str) -> str:
	value = (provider or "").strip().lower()
	return value or default


def _translator_overrides(helper: PDFHelper, provider: str, model: Optional[str], api_key: Optional[str], verbose: bool) -> None:
	provider = provider.lower()
	instance_path = helper.config.instance_path

	if provider in {"gemini", "google"}:
		helper.config.translator_config.llm_service = "gemini"
		model_name = model or helper.config.translator_config.model_name or "gemini-2.5-flash-lite"
		helper.translator = GeminiTranslator(
			instance_path=instance_path,
			model_name=model_name,
			api_key=api_key or helper.config.translator_config.api_key or os.getenv("GEMINI_API_KEY", ""),
			verbose=verbose,
		)
		helper.config.translator_config.model_name = helper.translator.model_name
		return

	if provider == "ollama":
		helper.config.translator_config.llm_service = "ollama"
		model_name = model or helper.config.translator_config.model_name or "TranslateHelper"
		helper.translator = OllamaTranslator(
			instance_path=instance_path,
			model_name=model_name,
			verbose=verbose,
		)
		helper.config.translator_config.model_name = helper.translator.model_name
		return

	if provider in {"openai", "chatgpt"}:
		if ChatGPTTranslator is None:
			raise RuntimeError("ChatGPT 翻譯器尚未安裝，請新增 translator_chatgpt.py")
		if not api_key:
			raise RuntimeError("使用 ChatGPT 翻譯需要提供 API Key")
		helper.config.translator_config.llm_service = "gemini"
		model_name = model or "gpt-4o-mini"
		helper.translator = ChatGPTTranslator(
			instance_path=instance_path,
			model_name=model_name,
			api_key=api_key,
			verbose=verbose,
		)
		helper.config.translator_config.model_name = model_name
		return

	if provider in {"anthropic", "claude"}:
		if ClaudeTranslator is None:
			raise RuntimeError("Claude 翻譯器尚未安裝，請新增 translator_claude.py")
		if not api_key:
			raise RuntimeError("使用 Claude 翻譯需要提供 API Key")
		helper.config.translator_config.llm_service = "gemini"
		model_name = model or "claude-3-5-sonnet-latest"
		helper.translator = ClaudeTranslator(
			instance_path=instance_path,
			model_name=model_name,
			api_key=api_key,
			verbose=verbose,
		)
		helper.config.translator_config.model_name = model_name
		return

	if provider in {"xai", "grok"}:
		if XaiTranslator is None:
			raise RuntimeError("xAI 翻譯器尚未安裝，請新增 translator_xai.py")
		if not api_key:
			raise RuntimeError("使用 xAI 翻譯需要提供 API Key")
		helper.config.translator_config.llm_service = "gemini"
		model_name = model or "grok-beta"
		helper.translator = XaiTranslator(
			instance_path=instance_path,
			model_name=model_name,
			api_key=api_key,
			verbose=verbose,
		)
		helper.config.translator_config.model_name = model_name
		return

	raise ValueError(f"不支援的翻譯供應商: {provider}")


def get_pdfhelper_client(
	*,
	translator_settings: Optional[Dict[str, Any]] = None,
	embedding_settings: Optional[Dict[str, Any]] = None,
	rag_settings: Optional[Dict[str, Any]] = None,
	verbose: bool = False,
) -> PDFHelper:
	translator_settings = translator_settings or {}
	embedding_settings = embedding_settings or {}
	rag_settings = rag_settings or {}

	translator_provider = _normalize_provider(translator_settings.get("provider"), default="gemini")
	translator_model = translator_settings.get("model")
	translator_api_key = translator_settings.get("api_key")
	translator_verbose = bool(translator_settings.get("verbose", False))

	embedding_provider = _normalize_provider(
		embedding_settings.get("provider") or os.getenv("PDFHELPER_EMBED_SERVICE"),
		default="gemini",
	)
	embedding_model = embedding_settings.get("model") or os.getenv("PDFHELPER_EMBED_MODEL")
	embedding_api_key = embedding_settings.get("api_key")
	embedding_verbose = bool(embedding_settings.get("verbose", False))

	rag_provider = _normalize_provider(
		rag_settings.get("provider") or os.getenv("PDFHELPER_RAG_SERVICE"),
		default="gemini",
	)
	rag_model = rag_settings.get("model") or os.getenv("PDFHELPER_RAG_MODEL")
	rag_verbose = bool(rag_settings.get("verbose", False))

	cache_key = (
		translator_provider,
		translator_model or "",
		"1" if translator_api_key else "0",
		embedding_provider,
		embedding_model or "",
		rag_provider,
		rag_model or "",
	)
	helper = _PDFHELPER_CACHE.get(cache_key)
	if helper:
		return helper

	translator_llm = "ollama" if translator_provider == "ollama" else "gemini"
	embed_llm = "ollama" if embedding_provider == "ollama" else "gemini"
	rag_llm = "ollama" if rag_provider == "ollama" else "gemini"

	config = Config(
		instance_path=str(INSTANCE_ROOT),
		translator_config=TranslatorConfig(
			llm_service=translator_llm,
			model_name=translator_model,
			api_key=translator_api_key,
			verbose=translator_verbose,
		),
		embedding_service_config=EmbeddingServiceConfig(
			llm_service=embed_llm,
			model_name=embedding_model,
			api_key=embedding_api_key,
			verbose=embedding_verbose,
		),
		rag_config=RAGConfig(
			llm_service=rag_llm,
			model_name=rag_model,
			verbose=rag_verbose,
		),
	)

	try:
		helper = PDFHelper(config=config, verbose=verbose)
	except Exception as exc:
		# 如果預設為 Ollama 但失敗，嘗試退回 Gemini
		if rag_llm == "ollama":
			fallback_config = Config(
				instance_path=str(INSTANCE_ROOT),
				translator_config=config.translator_config,
				embedding_service_config=config.embedding_service_config,
				rag_config=RAGConfig(
					llm_service="gemini",
					model_name=rag_model,
					verbose=rag_verbose,
				),
			)
			helper = PDFHelper(config=fallback_config, verbose=verbose)
			config = fallback_config
		else:
			raise RuntimeError(f"初始化 PDFHelper 失敗: {exc}") from exc

	# 替換翻譯器為使用者指定的供應商
	_translator_overrides(helper, translator_provider, translator_model, translator_api_key, translator_verbose)

	_PDFHELPER_CACHE[cache_key] = helper
	return helper


def ensure_rag_collection(
	json_path: str | os.PathLike[str],
	*,
	translator_settings: Optional[Dict[str, Any]] = None,
	embedding_settings: Optional[Dict[str, Any]] = None,
	rag_settings: Optional[Dict[str, Any]] = None,
	verbose: bool = False,
) -> RAGIngestionResult:
	json_path = Path(json_path).expanduser().resolve(strict=True)
	helper = get_pdfhelper_client(
		translator_settings=translator_settings,
		embedding_settings=embedding_settings,
		rag_settings=rag_settings,
		verbose=verbose,
	)

	translation_start = time.time()
	translation_result: HelperResult = helper.translate_json_content(str(json_path))
	translation_seconds = time.time() - translation_start
	if not translation_result.success:
		raise RuntimeError(f"翻譯 JSON 失敗: {translation_result.message}")

	translated_path: Optional[Path] = None
	translated_name: Optional[str] = None
	if translation_result.data and translation_result.data.get("translated_file_path"):
		translated_path = Path(translation_result.data["translated_file_path"]).expanduser().resolve()
		translated_name = translated_path.name

	ingestion_seconds: Optional[float] = None
	collection_name: Optional[str] = None
	if translated_name:
		ingestion_start = time.time()
		add_result: HelperResult = helper.add_json_to_rag(translated_name)
		ingestion_seconds = time.time() - ingestion_start
		if not add_result.success:
			raise RuntimeError(f"JSON 加入向量資料庫失敗: {add_result.message}")
		collection_name = translated_name

	return RAGIngestionResult(
		translated_json_path=translated_path,
		translated_json_name=translated_name,
		collection_name=collection_name,
		translation_seconds=translation_seconds,
		ingestion_seconds=ingestion_seconds,
		translator_provider=_normalize_provider(
			translator_settings.get("provider") if translator_settings else None,
			default="gemini",
		),
		raw_translator_model=translator_settings.get("model") if translator_settings else None,
		embedding_provider=_normalize_provider(
			embedding_settings.get("provider") if embedding_settings else None,
			default="ollama",
		),
		rag_provider=_normalize_provider(
			rag_settings.get("provider") if rag_settings else None,
			default="ollama",
		),
		extra={
			"translator": translator_settings or {},
			"embedding": embedding_settings or {},
			"rag": rag_settings or {},
		},
	)


def run_pipeline(
	source_pdf: str | os.PathLike[str],
	*,
	method: str = "auto",
	lang: str = "en",
	device: str = "cpu",
	verbose: bool = False,
	translator_settings: Optional[Dict[str, Any]] = None,
	embedding_settings: Optional[Dict[str, Any]] = None,
	rag_settings: Optional[Dict[str, Any]] = None,
	status_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Optional[str]]:
	"""High-level helper that stages the PDF, runs MinerU, and returns artifacts."""

	translator_settings = translator_settings or {}
	embedding_settings = embedding_settings or {}
	rag_settings = rag_settings or {}

	def emit_status(stage: str, event: str, **kwargs: Any) -> None:
		if not status_callback:
			return
		payload = {"stage": stage, "event": event}
		for key, value in kwargs.items():
			if value is not None:
				payload[key] = value
		status_callback(payload)

	bridge = get_bridge(verbose=verbose)
	helper = get_pdfhelper_client(
		translator_settings=translator_settings,
		embedding_settings=embedding_settings,
		rag_settings=rag_settings,
		verbose=verbose,
	)
	staged = bridge.stage_pdf(source_pdf)
	emit_status(
		"mineru",
		"start",
		message=f"處理 {staged.display_name}",
		file=staged.pdf_name,
	)
	mineru_start = time.time()
	artifacts = bridge.run_mineru(
		staged,
		method=method,
		lang=lang,
		device=device,
		helper=helper,
	)
	mineru_seconds = time.time() - mineru_start
	emit_status(
		"mineru",
		"complete",
		seconds=mineru_seconds,
		markdown=str(artifacts.markdown_path) if artifacts.markdown_path else None,
		json=str(artifacts.json_path) if artifacts.json_path else None,
	)
	markdown = bridge.read_markdown(artifacts)
	json_path = artifacts.json_path

	translated_json_path: Optional[Path] = None
	translation_seconds: Optional[float] = None
	rag_seconds: Optional[float] = None
	collection_name: Optional[str] = None
	markdown_variants: Dict[str, Dict[str, Optional[str]]] = {}

	if json_path:
		json_path_str = str(json_path)
		emit_status("translation", "start", message="開始翻譯 JSON", path=json_path_str)
		translation_start = time.time()
		translation_result: HelperResult = helper.translate_json_content(json_path_str)
		if not translation_result.success or not translation_result.data or not translation_result.data.get("translated_file_path"):
			raise RuntimeError(translation_result.message or "JSON 翻譯失敗")
		translated_json_path = Path(translation_result.data["translated_file_path"]).expanduser()
		translation_seconds = time.time() - translation_start
		emit_status(
			"translation",
			"complete",
			message="翻譯完成",
			seconds=translation_seconds,
			path=str(translated_json_path),
		)

		for language in ("zh", "en"):
			emit_status("markdown", "start", language=language)
			reconstruct_result: HelperResult = helper.reconstruct_markdown(
				json_name=translated_json_path.name,
				method=method,
				mode=language,  # type: ignore[arg-type]
			)
			if reconstruct_result.success and reconstruct_result.data and reconstruct_result.data.get("markdown_path"):
				md_path = Path(reconstruct_result.data["markdown_path"]).expanduser()
				try:
					text = md_path.read_text(encoding="utf-8", errors="replace")
				except OSError:
					text = None
				markdown_variants[language] = {
					"path": str(md_path),
					"text": text,
				}
				emit_status("markdown", "complete", language=language, path=str(md_path))
			else:
				emit_status("markdown", "failed", language=language, message=reconstruct_result.message)

		# docname (without _translated.json)
		collection_name = '_'.join(translated_json_path.name.split('_')[:-2])

		emit_status("rag", "start", collection=collection_name)
		rag_start = time.time()
		rag_result: HelperResult = helper.add_json_to_rag(translated_json_path.name)
		if not rag_result.success:
			raise RuntimeError(rag_result.message or "加入向量資料庫失敗")
		rag_seconds = time.time() - rag_start
		emit_status(
			"rag",
			"complete",
			collection=collection_name,
			seconds=rag_seconds,
		)

	payload = {
		"markdown_text": markdown,
		"markdown_path": str(artifacts.markdown_path) if artifacts.markdown_path else None,
		"markdown_text_en": markdown_variants.get("en", {}).get("text") or markdown,
		"markdown_path_en": markdown_variants.get("en", {}).get("path")
			or (str(artifacts.markdown_path) if artifacts.markdown_path else None),
		"markdown_text_zh": markdown_variants.get("zh", {}).get("text"),
		"markdown_path_zh": markdown_variants.get("zh", {}).get("path"),
		"json_path": str(json_path) if json_path else None,
		"translated_json_path": str(translated_json_path) if translated_json_path else None,
		"rag_collection": collection_name,
		"images": [str(p) for p in artifacts.image_paths],
		"processing_time": artifacts.processing_time,
		"staged_pdf": str(staged.staged_path),
		"display_name": staged.display_name,
		"translation": {
			"provider": _normalize_provider(translator_settings.get("provider"), default="gemini"),
			"model": translator_settings.get("model"),
			"seconds": translation_seconds,
			"json_path": str(translated_json_path) if translated_json_path else None,
		},
		"rag": {
			"collection": collection_name,
			"seconds": rag_seconds,
		},
	}

	return payload

