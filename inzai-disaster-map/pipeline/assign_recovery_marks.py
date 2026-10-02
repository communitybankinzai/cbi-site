# -*- coding: utf-8 -*-
"""県の「被災箇所の状況と復旧見込み」PDFの位置図（分割図1/3〜3/3）から ✕印（赤＝大規模・橙＝中規模・青＝小規模）の
位置を取り出し、書き起こした56区間（../pref-recovery-outlook.json）に割り当てる（県がPDFを更新したときに1回だけ流す）。

- 位置図は国土交通省の地図画面の画像なので、build_pref_road_kisei.py と同じ方法で地理院タイルに位置合わせする
- ✕印は色（HSV）と形（正方形に近く、塗りが3〜6割）で見分ける。丸い点（解除後）・路線番号の六角形・線は除く
- 割り当ては「同じ色の印のうち、町名の代表点に近いもの」を全体で距離の短い順に1対1で決める
- 結果は items[].mark {lat, lon, distM} に入れる。印が見つからない区間は mark なし（町名の代表点のまま）

使い方: python assign_recovery_marks.py --pdf fukkyumitoshi.pdf
"""
import argparse
import json
import math
import os
import sys

import cv2
import fitz
import numpy as np

import build_pref_road_kisei as K

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "pref-recovery-outlook.json")
BBOX = dict(west=139.70, east=140.90, north=36.10, south=34.85)
FIGURES = ("分割図（1/3）", "分割図（2/3）", "分割図（3/3）")
MAX_ASSIGN_M = 3000  # 町名の代表点から3km以内の印だけ採用（遠い印は別の区間のもの）


def log(*a):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    print(*a, flush=True)


def masks(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = (((h <= 6) | (h >= 172)) & (s >= 170) & (v >= 170)).astype(np.uint8)
    orange = ((h >= 10) & (h <= 24) & (s >= 170) & (v >= 190)).astype(np.uint8)
    blue = ((h >= 95) & (h <= 125) & (s >= 150) & (v >= 150)).astype(np.uint8)
    return {"large": red, "medium": orange, "small": blue}


def water_mask(img):
    """海・川・湖の淡い青（地理院の標準地図も位置図も同じ系統の色）"""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return ((h >= 90) & (h <= 125) & (s >= 25) & (s <= 140) & (v >= 170)).astype(np.float32)


def locate_water(shot, mos):
    """位置図は規制状況図と描き方が違い、濃淡の照合（K.locate）では合わない。海岸線の形（水面のマスク）で合わせる"""
    wm = water_mask(mos)
    ws = water_mask(shot)
    k = 0.25
    m = cv2.resize(wm, (int(wm.shape[1] * k), int(wm.shape[0] * k)), interpolation=cv2.INTER_AREA)

    def run(scales):
        best = None
        for s in scales:
            tw, th = int(ws.shape[1] * s * k), int(ws.shape[0] * s * k)
            if tw >= m.shape[1] or th >= m.shape[0] or tw < 20:
                continue
            t = cv2.resize(ws, (tw, th), interpolation=cv2.INTER_AREA)
            r = cv2.matchTemplate(m, t, cv2.TM_CCOEFF_NORMED)
            _, mx, _, loc = cv2.minMaxLoc(r)
            if best is None or mx > best[0]:
                best = (float(mx), float(s), loc[0] / k, loc[1] / k)
        return best

    coarse = run(np.arange(0.30, 1.31, 0.02))
    if not coarse:
        return None
    return run(np.arange(coarse[1] - 0.03, coarse[1] + 0.031, 0.005)) or coarse


def is_cross(sub):
    """✕印か（対角線はよく塗られ、横・縦の中央線は中央以外が空いている）。丸い点や六角形の番号札を除く"""
    h, w = sub.shape
    if h < 8 or w < 8:
        return False
    d1 = np.mean([sub[int(i * (h - 1) / (w - 1)), i] for i in range(w)])
    d2 = np.mean([sub[int((w - 1 - i) * (h - 1) / (w - 1)), i] for i in range(w)])
    row = sub[h // 2, :]
    col = sub[:, w // 2]
    q = w // 4
    edge_row = np.mean(np.concatenate([row[:q], row[-q:]]))
    edge_col = np.mean(np.concatenate([col[:q], col[-q:]]))
    return d1 >= 0.55 and d2 >= 0.55 and edge_row <= 0.45 and edge_col <= 0.45


def cross_marks(mask, allow_split=True):
    """✕印らしい塊の中心 (x, y) を返す。凡例（下端の枠）は除く。隣の✕と重なった塊は面積から個数を推定して分ける"""
    k = np.ones((3, 3), np.uint8)
    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k)
    H = m.shape[0]
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m)
    singles, blobs = [], []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if not (14 <= max(w, h) <= 170) or y + h > H * 0.86:
            continue
        sub = m[y:y + h, x:x + w]
        fill = area / float(w * h)
        if 0.6 <= w / h <= 1.6 and 0.15 <= fill <= 0.65 and max(w, h) <= 70 and is_cross(sub):
            singles.append((float(cent[i][0]), float(cent[i][1]), int(w), int(h), round(float(fill), 2)))
        else:
            blobs.append((i, x, y, w, h, int(area)))
    out = list(singles)
    typ = float(np.median([s[2] * s[3] * s[4] for s in singles])) if singles else 0  # 1個ぶんの面積
    for i, x, y, w, h, area in blobs:
        # 重なりの分割は赤・橙だけ（青は解除後の丸い点が密集して誤って✕に数えるため）。塗りが濃い塊（点の集まり）も除く
        if not allow_split or typ <= 0 or area < typ * 1.5 or area / float(w * h) > 0.6:
            continue
        kk = int(round(area / typ))
        if kk < 2 or kk > 4:
            continue
        ys, xs = np.nonzero(lab[y:y + h, x:x + w] == i)
        pts = np.column_stack([xs + x, ys + y]).astype(np.float32)
        _, _, centers = cv2.kmeans(pts, kk, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
        for cx, cy in centers:
            out.append((float(cx), float(cy), int(w), int(h), -kk))
    return out


def pick_pages(doc):
    found = {}
    for page in doc:
        t = page.get_text().replace(" ", "").replace("　", "").replace("(", "（").replace(")", "）")
        for name in FIGURES:
            if name in t:
                found[name] = page
    return found


def dist_m(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111320
    dx = (lon2 - lon1) * 111320 * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    args = ap.parse_args()
    data = json.load(open(OUT, encoding="utf-8"))
    doc = fitz.open(args.pdf)
    pages = pick_pages(doc)
    if not pages:
        # 位置図のページは見出しも画像で文字が無い（2026-10-02 のPDF）。3〜5ページ目が 1/3・2/3・3/3 の順
        pages = {name: doc[i] for name, i in zip(FIGURES, (2, 3, 4)) if i < len(doc)}
    log("図:", list(pages))
    K.BBOX = BBOX
    mos, ox, oy = K.build_mosaic()
    marks = {"large": [], "medium": [], "small": []}
    for name in FIGURES:
        page = pages.get(name)
        shot = K.map_image(page) if page else None
        if shot is None:
            log(name, "図なし")
            continue
        found = locate_water(shot, mos)
        if not found or found[0] < 0.45:
            log(name, "位置合わせ失敗", found)
            continue
        score, scale, mx, my = found
        ms = masks(shot)
        for cls, mask in ms.items():
            pts = cross_marks(mask, allow_split=(cls != "small"))
            for x, y, w, h, fill in pts:
                lat, lon = K.px2deg(ox + mx + x * scale, oy + my + y * scale, K.TILE_Z)
                marks[cls].append({"lat": round(lat, 5), "lon": round(lon, 5), "fig": name, "w": w, "h": h, "fill": fill})
        log(f"{name} score={score:.3f} 印 赤{len([m for m in marks['large'] if m['fig']==name])} 橙{len([m for m in marks['medium'] if m['fig']==name])} 青{len([m for m in marks['small'] if m['fig']==name])}")

    items = data["items"]
    for it in items:
        it.pop("mark", None)  # 前回の割り当ては捨てる
    want = {c: sum(1 for i in items if i["scale"] == c) for c in marks}
    log("書き起こしの数", want, "見つけた印の数", {c: len(v) for c, v in marks.items()})

    # 全体で距離の短い順に1対1で割り当て
    pairs = []
    for idx, it in enumerate(items):
        if it.get("lat") is None:
            continue
        for j, m in enumerate(marks[it["scale"]]):
            pairs.append((dist_m(it["lat"], it["lon"], m["lat"], m["lon"]), idx, j))
    pairs.sort()
    used_i, used_m = set(), set()
    for d, idx, j in pairs:
        if idx in used_i or (items[idx]["scale"], j) in used_m or d > MAX_ASSIGN_M:
            continue
        m = marks[items[idx]["scale"]][j]
        items[idx]["mark"] = {"lat": m["lat"], "lon": m["lon"], "distM": round(d), "figure": m["fig"]}
        used_i.add(idx)
        used_m.add((items[idx]["scale"], j))
    for it in items:
        if "mark" not in it and it.get("lat") is not None:
            it["mark"] = None
    assigned = sum(1 for i in items if i.get("mark"))
    log(f"割り当て {assigned}/{len(items)}")
    for it in items:
        m = it.get("mark")
        log(f"  {it['id']:<24} {it['scale']:<6} ", f"印まで {m['distM']}m" if m else "印なし")
    data["marks"] = {"source": "県の発表PDFの位置図（分割図）の✕印を画像から読んだ位置。✕印そのものが被災箇所の目安（数百mの誤差）",
                     "found": {c: len(v) for c, v in marks.items()}, "assigned": assigned}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


if __name__ == "__main__":
    sys.exit(main())
