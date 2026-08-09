# -*- coding: utf-8 -*-
"""CBIサイトTOPのQRコード生成（サイトのフッターとA0ポスターで共用）

使い方: python site/poster/make_qr.py
出力  : site/assets/qr-site.svg
"""
import pathlib

import segno

URL = "https://communitybankinzai.github.io/cbi-site/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "qr-site.svg"

# error='h' = 30%冗長。A0で屋外掲示しても読み取りやすくする
# 白地・紺モジュール。濃紺地に白モジュールの「反転QR」は Android / LINE のリーダーで
# 読めないことがあるため採用しない（2026-08-08 実測でデコード失敗を確認）
qr = segno.make(URL, error="h")
qr.save(str(OUT), kind="svg", scale=10, border=2, dark="#1e3a5f", light="#ffffff")

print(f"wrote {OUT}  ({OUT.stat().st_size} bytes)  version={qr.version}")
