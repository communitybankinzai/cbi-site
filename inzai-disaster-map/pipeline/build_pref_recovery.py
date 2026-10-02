# -*- coding: utf-8 -*-
"""千葉県「県管理道路の被災箇所の状況と復旧見込み」（2026-10-02 発表・56区間）の解除を、県の規制状況図で見張る。

- 一覧（../pref-recovery-outlook.json の items）は県の発表PDFから書き起こしたもの（写真に焼き込まれた文字で、
  機械では読めないため）。位置は市町村＋地名の町名の代表点。
- 県の「県管理道路の通行規制情報」の状況図（build_pref_road_kisei.py と同じPDF）には全県図と分割図3枚がある。
  ここでは分割図（1/3〜3/3）を地理院タイルと照合して赤線（規制中）を全県ぶん取り出し、各区間の代表点から
  WATCH_RADIUS_M 以内に赤線が無くなったら「解除（その図の時点）」と記録する（2026-10-02 事業主決定A）。
- 一度解除にした区間に赤線が戻ったら active に戻す（clearedAt は消す）。判定は図の時点（asOf）で行う。
- PDF が前回と同じなら何もしない。位置合わせに失敗した分割図があれば、その図の範囲の区間は判定を変えない。

使い方: python build_pref_recovery.py [--pdf ローカルPDF] [--force]
出力: ../pref-recovery-outlook.json（items の status / clearedAt / clearedFigure と watch を更新）
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
import sys

import cv2
import fitz  # PyMuPDF
import numpy as np
import requests

import build_pref_road_kisei as K

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "pref-recovery-outlook.json")
WATCH_RADIUS_M = 3500   # 町名の代表点しか無い区間：代表点と被災箇所のずれ（数百m〜数km）を見込む
MARK_RADIUS_M = 800     # 位置図の✕印（assign_recovery_marks.py）がある区間：印から赤線までの許容
# 分割図は3枚とも「千葉県全域」の寄せ集めの中から探す（県北 139.80–140.80／南は 139.70–140.60 あたり）
BBOX = dict(west=139.70, east=140.90, north=36.10, south=34.85)
FIGURES = ("分割図（1/3）", "分割図（2/3）", "分割図（3/3）")


def log(*a):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(*a, flush=True)


def load():
    with open(OUT, encoding="utf-8") as f:
        return json.load(f)


def write(data):
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def pick_pages(doc):
    found = {}
    for page in doc:
        t = page.get_text().replace(" ", "").replace("　", "").replace("(", "（").replace(")", "）").replace("/", "/")
        for name in FIGURES:
            if name in t:
                found[name] = page
    return found


def dist_m(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111320
    dx = (lon2 - lon1) * 111320 * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def point_to_path_m(lat, lon, path):
    """点から折れ線までの最短距離（m）。線分ごとに投影する"""
    best = float("inf")
    kx = 111320 * math.cos(math.radians(lat))
    px, py = lon * kx, lat * 111320
    pts = [(b * kx, a * 111320) for a, b in path]
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] or pts):
        vx, vy = x2 - x1, y2 - y1
        L2 = vx * vx + vy * vy
        t = 0 if L2 == 0 else max(0.0, min(1.0, ((px - x1) * vx + (py - y1) * vy) / L2))
        d = math.hypot(px - (x1 + t * vx), py - (y1 + t * vy))
        best = min(best, d)
    return best


def figure_bounds(lines):
    lats = [p[0] for l in lines for p in l]
    lons = [p[1] for l in lines for p in l]
    return (min(lats), max(lats), min(lons), max(lons)) if lats else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    data = load()
    watch_prev = data.get("watch") or {}

    if args.pdf:
        pdf_url = "file:" + os.path.basename(args.pdf)
        pdf_bytes = open(args.pdf, "rb").read()
        stamp = ""
    else:
        pdf_url, stamp = K.find_pdf_url()
        if not pdf_url:
            # 県のページから図が消えた＝規制の掲載が終わった。判定は変えず、その旨だけ残す
            data["watch"] = {**watch_prev, "checkedAt": K.now_iso(), "message": "県のページに規制状況図が掲載されていないため、解除の判定を止めています"}
            write(data)
            log("状況図なし。判定せず")
            return
        r = requests.get(pdf_url, headers=K.UA, timeout=60)
        r.raise_for_status()
        pdf_bytes = r.content
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    if not args.force and watch_prev.get("pdfSha256") == sha:
        log("前回と同じPDF。変更なし")
        return

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    as_of, as_of_iso = K.parse_as_of(doc[0].get_text())
    pages = pick_pages(doc)
    log("見つかった図:", list(pages))

    K.BBOX = BBOX
    mos, ox, oy = K.build_mosaic()
    lines = []
    figures = []
    for name in FIGURES:
        page = pages.get(name)
        shot = K.map_image(page) if page else None
        if shot is None:
            figures.append({"name": name, "ok": False, "reason": "図が見つからない"})
            continue
        found = K.locate(shot, mos)
        if not found or found[0] < K.MIN_SCORE:
            figures.append({"name": name, "ok": False, "reason": "位置合わせ失敗", "score": round(float(found[0]), 3) if found else None})
            log(name, "位置合わせ失敗", found)
            continue
        score, scale, mx, my = found
        h, w = shot.shape[:2]
        # 図の四隅の緯度経度（この範囲の区間だけ、この図で判定できる）
        lat0, lon0 = K.px2deg(ox + mx, oy + my, K.TILE_Z)
        lat1, lon1 = K.px2deg(ox + mx + w * scale, oy + my + h * scale, K.TILE_Z)
        n0 = len(lines)
        for simp in K.trace_lines(K.red_mask(shot)):
            path = []
            for u, v in simp:
                lat, lon = K.px2deg(ox + mx + float(u) * scale, oy + my + float(v) * scale, K.TILE_Z)
                path.append([round(lat, 6), round(lon, 6)])
            lines.append(path)
        figures.append({"name": name, "ok": True, "score": round(float(score), 3), "scale": round(float(scale), 4),
                        "bounds": [round(lat1, 4), round(lat0, 4), round(lon0, 4), round(lon1, 4)], "lines": len(lines) - n0})
        log(f"{name} score={score:.3f} scale={scale:.4f} 赤線 {len(lines) - n0} 本 範囲 lat {lat1:.3f}〜{lat0:.3f} lon {lon0:.3f}〜{lon1:.3f}")

    covered = [f for f in figures if f.get("ok")]
    changed = []
    for it in data["items"]:
        if it.get("lat") is None:
            it["watch"] = "位置が引けないため判定しない"
            continue
        mark = it.get("mark") or {}
        lat, lon, radius = (mark["lat"], mark["lon"], MARK_RADIUS_M) if mark.get("lat") else (it["lat"], it["lon"], WATCH_RADIUS_M)
        inside = any(f["bounds"][0] <= lat <= f["bounds"][1] and f["bounds"][2] <= lon <= f["bounds"][3] for f in covered)
        if not inside:
            it["watch"] = "読めた図の範囲外（判定せず）"
            continue
        near = min((point_to_path_m(lat, lon, p) for p in lines), default=float("inf"))
        it["nearestRedLineM"] = None if near == float("inf") else round(near)
        it["watchRadiusM"] = radius
        active = near <= radius
        if active and it.get("status") != "active":
            it["status"] = "active"
            it["clearedAt"] = None
            it["clearedFigure"] = None
            changed.append(("再び規制中", it["id"]))
        elif not active and it.get("status") == "active":
            it["status"] = "cleared"
            it["clearedAt"] = as_of_iso or K.now_iso()
            it["clearedFigure"] = as_of
            changed.append(("解除", it["id"]))
        it["watch"] = f"{as_of}の図で判定"
    data["watch"] = {"pdfUrl": pdf_url, "pdfSha256": sha, "pageStamp": stamp, "asOf": as_of, "asOfIso": as_of_iso,
                     "checkedAt": K.now_iso(), "figures": figures, "redLines": len(lines), "radiusM": WATCH_RADIUS_M,
                     "markRadiusM": MARK_RADIUS_M, "note": "位置図の✕印がある区間は印から markRadiusM、無い区間は町名の代表点から radiusM 以内に、県の規制状況図の赤線（規制中）が無くなったら解除とみなす"}
    data["updatedAt"] = K.now_iso()
    write(data)
    n_active = sum(1 for i in data["items"] if i.get("status") == "active")
    log(f"判定 {as_of}: 規制中 {n_active} / 解除 {len(data['items']) - n_active}（変化 {len(changed)} 件）", changed[:10])


if __name__ == "__main__":
    sys.exit(main())
