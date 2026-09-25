# -*- coding: utf-8 -*-
"""千葉県「県管理道路の通行規制情報」の状況図（PDF）から、規制中（赤線）の区間を地図用の線にする。

県のページ（PAGE_URL）には、国土交通省の地図画面を撮った PDF だけが載る。座標のデータは無い。
そこで分割図（1/3）＝県北部（印西・佐倉・成田・八街など）の地図画像を、国土地理院の標準地図タイルと
画像照合して位置を合わせ、赤く塗られた区間を抜き出して緯度経度の折れ線に直す（2026-09-25 事業主指示）。

- 県のページから PDF のリンクが消えたら（ページ削除も含む）、published=false・線なしにする＝地図から消える
- PDF が前回と同じなら何もしない（毎時コミットしないため）
- 位置合わせの一致度が低い回は線を出さない（ずれた線を出すより出さない方が安全）
- 抜き出した線は図から写したもので、数十m〜100m程度ずれることがある。市町村道は県の図に無い

使い方: python build_pref_road_kisei.py [--pdf ローカルPDF] [--force]
出力: ../pref-road-kisei.json
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import sys
import urllib.parse

import cv2
import fitz  # PyMuPDF
import numpy as np
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "pref-road-kisei.json")
PAGE_URL = "https://www.pref.chiba.lg.jp/doukan/douroiji/kiseijyouhou.html"
PDF_RE = re.compile(r'href="([^"]*documents/kisei[^"]*\.pdf)"', re.I)
# 県ページ本文の「（令和8年9月25日（金曜日）午後2時 時点）」。同じファイル名のまま差し替えられても気づけるよう控える。
# CiDAO の毎時巡回（src/lib/pref-road-kisei-watch.ts）が同じ規則で読み、この値と比べて取り込みを起動する
STAMP_RE = re.compile(r"令和[^<>]{0,40}?時\s*時点")
UA = {"User-Agent": "CBI-inzai-disaster-map/1.0 (+https://communitybankinzai.github.io/cbi-site/inzai-disaster-map/)"}

# 照合に使う地理院タイル（標準地図）。分割図1/3が収まる範囲より少し広く取る
TILE_Z = 12
TILE_URL = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
BBOX = dict(west=139.80, east=140.80, north=36.00, south=35.45)
# 県の画像1pxが z12 タイルの何pxに当たるか。2026-09-25 のPDFで 0.68 前後だった
SCALE_RANGE = (0.50, 1.00)
MIN_SCORE = 0.30  # これ未満は位置合わせ失敗とみなす（9/25の実測は0.4前後、ずらすと0.1台）
MIN_BLOB_PX = 40  # これより小さい赤は、青線の縁や地図記号のにじみとみなして捨てる


def log(*a):
    print(*a, flush=True)


def load_previous():
    try:
        with open(OUT, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def write(data):
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def now_iso():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(timespec="seconds")


def page_stamp(html):
    m = STAMP_RE.search(html)
    return re.sub(r"\s+", "", m.group(0)) if m else ""


def find_pdf_url():
    """県のページから状況図PDFのURLと時点の文字を探す。ページが無い・リンクが無いときは (None, "")"""
    r = requests.get(PAGE_URL, headers=UA, timeout=30)
    if r.status_code == 404:
        return None, ""
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    m = PDF_RE.search(r.text)
    if not m:
        return None, ""
    return urllib.parse.urljoin(PAGE_URL, m.group(1)), page_stamp(r.text)


# ---------------------------------------------------------------- 地理院タイル
def deg2px(lat, lon, z):
    n = 256 * 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def px2deg(x, y, z):
    n = 256 * 2 ** z
    lon = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


def build_mosaic():
    x0, y0 = deg2px(BBOX["north"], BBOX["west"], TILE_Z)
    x1, y1 = deg2px(BBOX["south"], BBOX["east"], TILE_Z)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    mos = np.full(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256, 3), 255, np.uint8)
    s = requests.Session()
    s.headers.update(UA)
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            r = s.get(TILE_URL.format(z=TILE_Z, x=tx, y=ty), timeout=30)
            if r.status_code != 200:
                continue
            t = cv2.imdecode(np.frombuffer(r.content, np.uint8), cv2.IMREAD_COLOR)
            if t is not None:
                mos[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = t
    return mos, tx0 * 256, ty0 * 256


def locate(shot, mos):
    """県の地図画像が、タイルの寄せ集めのどこに・何倍で入っているか。(score, scale, x, y)"""
    g_m = cv2.cvtColor(mos, cv2.COLOR_BGR2GRAY)
    g_s = cv2.cvtColor(shot, cv2.COLOR_BGR2GRAY)

    def score_at(s, k, region=None):
        tw, th = int(g_s.shape[1] * s * k), int(g_s.shape[0] * s * k)
        t = cv2.resize(g_s, (tw, th), interpolation=cv2.INTER_AREA)
        m = cv2.resize(g_m, (int(g_m.shape[1] * k), int(g_m.shape[0] * k)), interpolation=cv2.INTER_AREA)
        ox = oy = 0
        if region:
            rx, ry, pad = int(region[0] * k), int(region[1] * k), int(region[2] * k)
            ox, oy = max(rx - pad, 0), max(ry - pad, 0)
            m = m[oy:ry + pad + th, ox:rx + pad + tw]
        if tw >= m.shape[1] or th >= m.shape[0]:
            return None
        r = cv2.matchTemplate(m, t, cv2.TM_CCOEFF_NORMED)
        _, mx, _, loc = cv2.minMaxLoc(r)
        return mx, s, (loc[0] + ox) / k, (loc[1] + oy) / k

    best = None
    for s in np.arange(SCALE_RANGE[0], SCALE_RANGE[1], 0.01):
        got = score_at(s, 0.25)
        if got and (best is None or got[0] > best[0]):
            best = got
    if best is None:
        return None
    # 近くで倍率を細かく振り、半分の解像度で詰める
    coarse = best
    for s in np.arange(coarse[1] - 0.012, coarse[1] + 0.0121, 0.002):
        got = score_at(s, 0.5, (coarse[2], coarse[3], 24))
        if got and got[0] > best[0]:
            best = got
    return best


# ---------------------------------------------------------------- 赤線の抜き出し
def red_mask(img):
    """規制中の赤（彩度・明度とも高い純赤）。地図の国道（くすんだ赤）とは彩度で分かれる"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (((h <= 6) | (h >= 174)) & (s >= 200) & (v >= 180)).astype(np.uint8)
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))


def thin(mask):
    """Zhang-Suen の細線化（0/1 の配列）。太い線の中心を1pxの線にする"""
    img = np.pad(mask.astype(np.uint8), 1)
    while True:
        changed = False
        for step in (0, 1):
            p2, p3, p4 = img[:-2, 1:-1], img[:-2, 2:], img[1:-1, 2:]
            p5, p6, p7 = img[2:, 2:], img[2:, 1:-1], img[2:, :-2]
            p8, p9 = img[1:-1, :-2], img[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            b = sum(x.astype(np.int16) for x in nb)
            seq = nb + [p2]
            a = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.int16) for i in range(8))
            c = img[1:-1, 1:-1] == 1
            if step == 0:
                cond = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                cond = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            rm = c & (b >= 2) & (b <= 6) & (a == 1) & cond
            if rm.any():
                img[1:-1, 1:-1][rm] = 0
                changed = True
        if not changed:
            return img[1:-1, 1:-1]


NB8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def longest_path(pixels):
    """細線の画素の集まりから、いちばん長い一筆書きの道筋を取り出す（BFSを2回）"""
    def bfs(start):
        prev = {start: None}
        order = [start]
        i = 0
        while i < len(order):
            y, x = order[i]
            i += 1
            for dy, dx in NB8:
                q = (y + dy, x + dx)
                if q in pixels and q not in prev:
                    prev[q] = (y, x)
                    order.append(q)
        return order[-1], prev

    far, _ = bfs(next(iter(pixels)))
    end, prev = bfs(far)
    path = []
    p = end
    while p is not None:
        path.append(p)
        p = prev[p]
    return path


def trace_lines(mask):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    lines = []
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < MIN_BLOB_PX:
            continue
        x, y, w, h = stats[i, :4]
        sub = (lab[y:y + h, x:x + w] == i).astype(np.uint8)
        sk = thin(sub)
        pixels = {(int(py) + y, int(px) + x) for py, px in zip(*np.nonzero(sk))}
        # 枝分かれがあれば、長い順に取り出す（短い枝は捨てる）
        while len(pixels) >= 4:
            path = longest_path(pixels)
            if len(path) < 4 and lines:
                break
            pts = np.array([[p[1], p[0]] for p in path], np.float32).reshape(-1, 1, 2)
            simp = cv2.approxPolyDP(pts, 1.5, False).reshape(-1, 2)
            if len(simp) == 1:
                simp = np.vstack([simp, simp + 0.5])
            lines.append(simp)
            for p in path:
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        pixels.discard((p[0] + dy, p[1] + dx))
            if len(path) < 12:
                break
    return lines


def meters(path):
    total = 0.0
    for (a, b), (c, d) in zip(path, path[1:]):
        dy = (c - a) * 111320
        dx = (d - b) * 111320 * math.cos(math.radians(a))
        total += math.hypot(dx, dy)
    return total


# ---------------------------------------------------------------- 本体
def parse_as_of(text):
    m = re.search(r"令和\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日\s*(\d+)\s*時", text)
    if not m:
        return "", ""
    y, mo, d, h = (int(g) for g in m.groups())
    iso = dt.datetime(2018 + y, mo, d, h, tzinfo=dt.timezone(dt.timedelta(hours=9))).isoformat()
    return f"{mo}月{d}日{h}時時点", iso


def pick_page(doc):
    for page in doc:
        t = re.sub(r"\s", "", page.get_text())
        if "分割図（1/3）" in t or "分割図(1/3)" in t:
            return page
    return None


def map_image(page):
    """地図の画像（横幅いっぱいの帯を縦に並べたもの）の範囲を、元の解像度で描き出す"""
    boxes = [fitz.Rect(i["bbox"]) for i in page.get_image_info() if i["width"] >= 1500]
    if not boxes:
        return None
    area = boxes[0]
    for b in boxes[1:]:
        area |= b
    widest = max(i["width"] for i in page.get_image_info())
    k = widest / area.width
    pix = page.get_pixmap(matrix=fitz.Matrix(k, k), clip=area)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3][:, :, ::-1].copy()
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", help="県のページを見ずに、手元のPDFで試す")
    ap.add_argument("--force", action="store_true", help="前回と同じPDFでも作り直す")
    args = ap.parse_args()
    prev = load_previous() or {}

    base = {
        "source": {"name": "千葉県 県管理道路の通行規制情報", "pageUrl": PAGE_URL},
        "area": "分割図（1/3）県北部",
        "note": "県の状況図（PDF）の赤線＝規制中（被災）区間を、CBIが地図に写したもの。数十m〜100m程度ずれることがある。主に国道・県道で、市町村道は含まない。",
    }

    stamp = ""
    if args.pdf:
        pdf_url = "file:" + os.path.basename(args.pdf)
        pdf_bytes = open(args.pdf, "rb").read()
    else:
        pdf_url, stamp = find_pdf_url()
        if not pdf_url:
            if prev.get("published") is False:
                log("県のページにPDFなし（前回も掲載なし）。変更なし")
                return
            write({**base, "published": False, "checkedAt": now_iso(), "lines": [],
                   "message": "県のページに状況図が掲載されていません"})
            log("県のページにPDFなし → 掲載終了として線を消した")
            return
        r = requests.get(pdf_url, headers=UA, timeout=60)
        r.raise_for_status()
        pdf_bytes = r.content

    sha = hashlib.sha256(pdf_bytes).hexdigest()
    if not args.force and prev.get("published") and prev.get("pdfSha256") == sha:
        if stamp and prev.get("pageStamp") != stamp:
            # PDFは同じで時点の文字だけ変わった。控えを直さないと CiDAO が毎時起動し続ける
            write({**prev, "pageStamp": stamp})
            log("前回と同じPDF。時点の控えだけ更新")
        else:
            log("前回と同じPDF。変更なし")
        return

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    as_of, as_of_iso = parse_as_of(doc[0].get_text())
    out = {**base, "published": True, "pdfUrl": pdf_url, "pageStamp": stamp, "pdfSha256": sha,
           "asOf": as_of, "asOfIso": as_of_iso, "checkedAt": now_iso(), "lines": []}

    page = pick_page(doc)
    shot = map_image(page) if page else None
    if shot is None:
        out["message"] = "県の図の形式が変わり、読み取れませんでした"
        write(out)
        log("分割図（1/3）が見つからない")
        return

    mos, ox, oy = build_mosaic()
    found = locate(shot, mos)
    if not found or found[0] < MIN_SCORE:
        out["message"] = "県の図と地図の位置合わせができませんでした"
        out["match"] = {"score": round(found[0], 3) if found else None}
        write(out)
        log("位置合わせ失敗", found)
        return
    score, scale, mx, my = found
    out["match"] = {"score": round(float(score), 3), "scale": round(float(scale), 4)}
    log(f"位置合わせ score={score:.3f} scale={scale:.4f} at=({mx:.0f},{my:.0f})")

    for simp in trace_lines(red_mask(shot)):
        path = []
        for u, v in simp:
            lat, lon = px2deg(ox + mx + float(u) * scale, oy + my + float(v) * scale, TILE_Z)
            path.append([round(lat, 6), round(lon, 6)])
        out["lines"].append({"path": path, "lengthM": round(meters(path))})
    out["lines"].sort(key=lambda l: -l["lengthM"])
    write(out)
    log(f"規制中の線 {len(out['lines'])}本を書き出し（{as_of}）")


if __name__ == "__main__":
    sys.exit(main())
