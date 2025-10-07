"""Utility bridge between the Electron helper scripts and the PDFHelper backend.

This module hides the PDFHelper project layout details and exposes a
lightweight API for the Electron Python scripts.  The goals are:

* stage source PDFs into the PDFHelper instance directory structure
* run MinerU to produce JSON/Markdown artifacts
* provide convenient helpers to read the generated Markdown content

The functions here are intentionally synchronous because they run in a
dedicated Python child process spawned from the Electron main process.
"""

from __future__ import annotations
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


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


# pylint: disable=wrong-import-position,import-error
from backend.services.pdf_service import MinerUProcessor  # type: ignore


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
	"""Result of running MinerU through :class:`MinerUProcessor`."""

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


# ---------------------------------------------------------------------------
# Helper class
# ---------------------------------------------------------------------------

class PDFHelperBridge:
	"""Thin facade around MinerU for the Electron integration."""

	def __init__(self, verbose: bool = False) -> None:
		self.verbose = verbose
		self._log("初始化 PDFHelperBridge")
		INSTANCE_ROOT.mkdir(parents=True, exist_ok=True)
		PDF_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

		self._ensure_mineru_path()

		self._mineru = MinerUProcessor(
			instance_path=str(INSTANCE_ROOT),
			verbose=verbose,
		)

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
		output_callback=None,
	) -> MinerUArtifacts:
		"""Execute MinerU and gather produced artifact paths."""

		start = time.time()
		result = self._mineru.process_pdf_with_mineru_realtime(
			staged_pdf.pdf_name,
			method=method,
			lang=lang,
			device=device,
			output_callback=output_callback,
		)
		elapsed = time.time() - start

		if not result.get("success"):
			raise RuntimeError(result.get("error") or "MinerU 執行失敗")

		artifacts = MinerUArtifacts(
			output_path=Path(result["output_path"]),
			output_files=result.get("output_file_paths") or {},
			processing_time=result.get("processing_time") or elapsed,
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

		# 優先使用 Anaconda 環境中的 MinerU
		anaconda_mineru = r"C:\Users\User\AppData\Roaming\Python\Python311\Scripts\mineru.exe"
		if Path(anaconda_mineru).exists():
			self._log(f"使用 Anaconda 環境的 MinerU: {anaconda_mineru}")
			# 將 Anaconda Scripts 目錄加到 PATH
			scripts_dir = str(Path(anaconda_mineru).parent)
			current_path = os.environ.get("PATH", "")
			if scripts_dir not in current_path:
				os.environ["PATH"] = f"{scripts_dir}{os.pathsep}{current_path}"
			return

		# 回退到原本的檢查邏輯
		mineru_cmd = "mineru"
		candidate = shutil.which(mineru_cmd)

		if not candidate:
			extra_dir = os.getenv("PDFHELPER_MINERU_PATH")
			if extra_dir:
				extra_path = Path(extra_dir).expanduser()
				if extra_path.is_dir():
					os.environ["PATH"] = f"{str(extra_path)}{os.pathsep}{os.environ.get('PATH', '')}"
					candidate = shutil.which(mineru_cmd)
					if candidate:
						self._log(f"已從 PDFHELPER_MINERU_PATH 加入 MinerU 位置: {candidate}")

		if not candidate:
			raise RuntimeError(
				"找不到 MinerU CLI。\n"
				"• 請先安裝 MinerU (例如 `pip install \"mineru[core]>=2.5.2\"`) 或從官方專案取得可執行檔。\n"
				"• 若已安裝但仍無法找到，請確認 `mineru` 指令可在命令列執行，或設定環境變數 PDFHELPER_MINERU_PATH 指向含有 mineru 的資料夾後重新啟動應用。"
			)


# Convenience singleton -------------------------------------------------------

_BRIDGE: Optional[PDFHelperBridge] = None


def get_bridge(verbose: bool = False) -> PDFHelperBridge:
	global _BRIDGE
	if _BRIDGE is None or (_BRIDGE.verbose is False and verbose):
		_BRIDGE = PDFHelperBridge(verbose=verbose)
	return _BRIDGE


def run_pipeline(
	source_pdf: str | os.PathLike[str],
	*,
	method: str = "auto",
	lang: str = "en",
	device: str = "cpu",
	verbose: bool = False,
	output_callback=None,
) -> Dict[str, Optional[str]]:
	"""High-level helper that stages the PDF, runs MinerU, and returns artifacts."""

	bridge = get_bridge(verbose=verbose)
	staged = bridge.stage_pdf(source_pdf)
	artifacts = bridge.run_mineru(staged, method=method, lang=lang, device=device, output_callback=output_callback)
	markdown = bridge.read_markdown(artifacts)

	payload = {
		"markdown_text": markdown,
		"markdown_path": str(artifacts.markdown_path) if artifacts.markdown_path else None,
		"json_path": str(artifacts.json_path) if artifacts.json_path else None,
		"images": [str(p) for p in artifacts.image_paths],
		"processing_time": artifacts.processing_time,
		"staged_pdf": str(staged.staged_path),
		"display_name": staged.display_name,
	}

	return payload

