#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合作方聊天腳本樣板：
從 stdin 讀取一行 JSON：{"question": "...", "context": "..."}
輸出一行 JSON：{"text": "回覆內容"}

請在此整合你的後端邏輯，例如呼叫本地/遠端服務並把回覆文本填入 text。
"""
import sys
import json

def main():
    try:
        sys.stdin.reconfigure(encoding='utf-8')
    except Exception:
        pass
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    line = sys.stdin.readline()
    try:
        data = json.loads(line or '{}')
    except Exception:
        print(json.dumps({"text": "無法解析輸入 JSON"}, ensure_ascii=False))
        sys.exit(0)

    question = str(data.get('question') or '')
    context = str(data.get('context') or '')
    lang = (data.get('lang') or 'zh').lower()

    # TODO: 這裡串接你的後端，得到回覆文字 reply
    # 目前示範：回聲 + 簡單格式
    if lang == 'en':
        reply = f"You asked: {question}\n(Context length: {len(context)})"
    else:
        reply = f"你問：{question}\n（附帶上下文長度：{len(context)}）"

    print(json.dumps({"text": reply}, ensure_ascii=False))

if __name__ == '__main__':
    main()
