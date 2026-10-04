"""県の復旧見込みPDFの位置図（分割図1/3〜3/3）の赤線（規制中）・青線（解除後）を読み、区間カードの結果（press_cards.py）と突き合わせる検算。

位置図は赤線＝規制中の道路、青線＝規制解除後（被災区間のみ）。区間カードのほうが確実なので、**この検算は一覧の状態を変えない**。
カードの読み間違い・位置ずれを見つけるための独立した確認で、食い違いは watch.mapCheck に残し、画面の注意書きと手元の見張りの声に出す。

精度の限界（2026-10-04 の実測）：区間の位置の多くは町名の代表点で、道路の線とは数百m〜数kmずれる。
そのため「赤線まで ≤800m」で規制中と決める判定は規制中の約1割を取りこぼした（見込み超過の判定には使えない）。
食い違いと言ってよいのは次の2つだけ（ゆるい基準）：
  ①規制中のカードなのに、位置から3.5km以内に赤線が1本も無い
  ②解除のカードなのに、位置から300m以内に赤線がある（同じ場所に規制中の別区間があるときは除く）
青線は解除済みの区間（被災した133区間のうち解除したもの）がすべて描かれ、今回の56区間より多いので、検算には使わない（数だけ控える）。

使い方（試験）：python press_map_check.py 新PDF [--json 一覧]
"""
import argparse
import json
import math
import sys

import cv2
import fitz  # PyMuPDF
import numpy as np

import assign_recovery_marks as A
import build_pref_road_kisei as K

NAMES = A.FIGURES
DPI = 170
LEGEND_CUT = 0.855      # ページ下端の凡例の枠（赤い見本の線が入る）を除く割合
MIN_SCORE = 0.45        # 位置合わせの相関がこれ未満なら、その図は使わない
ACTIVE_FAR_M = 3500     # ①規制中なのに赤線がここより遠い＝食い違い
CLEARED_NEAR_M = 300    # ②解除なのに赤線がここより近い＝食い違い
SAME_PLACE_M = 800      # 同じ場所に規制中の別区間があるときは②から除く


def _norm(s):
    return s.replace(" ", "").replace("　", "").replace("(", "（").replace(")", "）")


def _dist_m(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111320
    dx = (lon2 - lon1) * 111320 * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def read_layers(pdf_bytes):
    """各図を地理院タイルに位置合わせし、赤線・青線の点（緯度経度）と図の範囲を返す。戻り値 (layers, notes)"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = {}
    for page in doc:
        t = _norm(page.get_text())
        for name in NAMES:
            if _norm(name) in t:
                pages[name] = page
    K.BBOX = A.BBOX
    mos, ox, oy = K.build_mosaic()
    layers, notes = [], []
    for name in NAMES:
        page = pages.get(name)
        if page is None:
            notes.append(f"{name}：図が見つかりません")
            continue
        pix = page.get_pixmap(dpi=DPI, clip=fitz.Rect(0, 40, page.rect.width, page.rect.height))
        shot = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3][:, :, ::-1].copy()
        found = A.locate_water(shot, mos)
        if not found or found[0] < MIN_SCORE:
            notes.append(f"{name}：位置合わせに失敗（相関 {round(found[0], 2) if found else None}）")
            continue
        score, scale, mx, my = found
        h, w = shot.shape[:2]
        keep = np.zeros((h, w), np.uint8)
        keep[: int(h * LEGEND_CUT), :] = 1
        hsv = cv2.cvtColor(shot, cv2.COLOR_BGR2HSV)
        hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        red = K.red_mask(shot) * keep
        blue = (((hh >= 100) & (hh <= 135) & (ss >= 110) & (vv >= 90)).astype(np.uint8)) * keep

        def pts(mask, step=3):
            ys, xs = np.nonzero(mask)
            sel = (ys % step == 0) & (xs % step == 0)
            return np.array([K.px2deg(ox + mx + float(x) * scale, oy + my + float(y) * scale, K.TILE_Z) for x, y in zip(xs[sel], ys[sel])]).reshape(-1, 2)

        c = [K.px2deg(ox + mx + x * scale, oy + my + y * scale, K.TILE_Z) for x, y in ((0, 0), (w, int(h * LEGEND_CUT)))]
        layers.append({"name": name, "score": round(float(score), 3), "red": pts(red), "blueN": int(blue.sum()),
                       "bounds": (min(a[0] for a in c), max(a[0] for a in c), min(a[1] for a in c), max(a[1] for a in c))})
    return layers, notes


def _nearest(lat, lon, arr):
    if len(arr) == 0:
        return None
    dy = (arr[:, 0] - lat) * 111320
    dx = (arr[:, 1] - lon) * 111320 * math.cos(math.radians(lat))
    return float(np.sqrt(dx * dx + dy * dy).min())


def check(pdf_bytes, data):
    """一覧（data["items"]）の状態を位置図の赤線と突き合わせる。一覧は変えない。"""
    layers, notes = read_layers(pdf_bytes)
    if len(layers) < len(NAMES):
        return {"ok": False, "reason": "位置図を読めませんでした（" + "／".join(notes) + "）", "figures": [{"name": l["name"], "score": l["score"]} for l in layers]}
    items = data["items"]
    active_items = [i for i in items if i.get("status") == "active" and i.get("lat") is not None]
    out = {"ok": True, "figures": [{"name": l["name"], "score": l["score"]} for l in layers], "redPoints": sum(len(l["red"]) for l in layers),
           "checkedActive": 0, "checkedCleared": 0, "contradict": []}
    for it in items:
        if it.get("lat") is None:
            continue
        m = it.get("mark") or {}
        lat, lon = (m["lat"], m["lon"]) if m.get("lat") else (it["lat"], it["lon"])
        cov = [l for l in layers if l["bounds"][0] <= lat <= l["bounds"][1] and l["bounds"][2] <= lon <= l["bounds"][3]]
        if not cov:
            continue
        near = min((x for x in (_nearest(lat, lon, l["red"]) for l in cov) if x is not None), default=None)
        label = f"{it['road'] if it.get('road') else it['routeNo']} {it['municipality']}{it['place']}"
        if it.get("status") == "active":
            out["checkedActive"] += 1
            if near is None or near > ACTIVE_FAR_M:
                out["contradict"].append(f"{label}：規制中のはずが赤線が見当たりません")
        else:
            out["checkedCleared"] += 1
            same = any(_dist_m(it["lat"], it["lon"], o["lat"], o["lon"]) <= SAME_PLACE_M for o in active_items)
            if near is not None and near <= CLEARED_NEAR_M and not same:
                out["contradict"].append(f"{label}：解除のはずが赤線があります")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--json", default="../pref-recovery-outlook.json")
    a = ap.parse_args()
    data = json.load(open(a.json, encoding="utf-8"))
    res = check(open(a.pdf, "rb").read(), data)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    return 0 if res.get("ok") and not res.get("contradict") else 1


if __name__ == "__main__":
    sys.exit(main())
