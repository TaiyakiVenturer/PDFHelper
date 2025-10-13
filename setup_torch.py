#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDFHelper PyTorch 一鍵安裝腳本（setup_torch.py）
- 自動偵測 CUDA 是否可用與版本
- 根據 CUDA 版本自動安裝對應 PyTorch
- 若無 CUDA 則安裝 CPU 版本
- 僅支援 uv --reinstall
"""
import subprocess
import sys
import shutil
import re

CUDA_PYTORCH_INDEX = {
    '12.8': 'https://download.pytorch.org/whl/cu128',
    '12.6': 'https://download.pytorch.org/whl/cu126',
    '11.8': 'https://download.pytorch.org/whl/cu118',
}

CPU_INDEX = 'https://download.pytorch.org/whl/cpu'

def run(cmd):
    print(f"執行: {cmd}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"\n❌ 指令失敗: {cmd}")
        sys.exit(result.returncode)

def detect_cuda_version():
    nvcc = shutil.which('nvcc')
    if not nvcc:
        return None
    try:
        output = subprocess.check_output(['nvcc', '--version'], encoding='utf-8')
        match = re.search(r'release ([0-9]+\.[0-9]+)', output)
        if match:
            return match.group(1)
    except Exception:
        pass
    return None

def choose_index(cuda_version):
    if not cuda_version:
        return 'cpu', CPU_INDEX
    cuda_float = None
    try:
        cuda_float = float('.'.join(cuda_version.split('.')[:2]))
    except Exception:
        pass
    if cuda_float:
        supported = sorted([float(k) for k in CUDA_PYTORCH_INDEX.keys()], reverse=True)
        for ver in supported:
            if cuda_float >= ver:
                ver_str = str(ver)
                return f'cu{ver_str.replace(".", "")}', CUDA_PYTORCH_INDEX[ver_str]
    return 'cpu', CPU_INDEX

def get_installer():
    if shutil.which('uv'):
        return 'uv pip install --reinstall'
    else:
        print("❌ 找不到 uv，請先安裝 uv (https://github.com/astral-sh/uv)")
        sys.exit(1)

def main():
    print("\n==== PDFHelper PyTorch 一鍵安裝工具 ====")
    cuda_version = detect_cuda_version()
    if cuda_version:
        print(f"✔ 偵測到 CUDA: {cuda_version}")
    else:
        print("⚠ 未偵測到 CUDA，將安裝 CPU 版本。")
    gpu_type, index_url = choose_index(cuda_version)
    installer = get_installer()
    print(f"\n將安裝 PyTorch 版本: {gpu_type}")
    print(f"使用來源: {index_url}")
    cmd = f"{installer} torch torchvision torchaudio --index-url {index_url}"
    run(cmd)
    print("\n✅ PyTorch 安裝完成！")

if __name__ == '__main__':
    main()
