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
import re
import sys

import cv2
import fitz  # PyMuPDF
import numpy as np
import requests

import build_pref_road_kisei as K
import press_cards as PC
import press_map_check as MC

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


PREF_PAGE = "https://www.pref.chiba.lg.jp/doukan/douroiji/kiseijyouhou.html"


def latest_press_pdf():
    """県の道路規制ページに載っている復旧見込みPDF（fukkyumitoshi・fukkyumitoshi1・…）のうち、番号が最大のものの URL。
    県は同じ名前で差し替えず、番号を足した別名で出す（2026-10-04：fukkyumitoshi1.pdf）ため、旧名だけでは更新に気づけない"""
    try:
        r = requests.get(PREF_PAGE, headers=K.UA, timeout=60)
        r.raise_for_status()
        found = re.findall(r'href="([^"]*documents/fukkyumitoshi(\d*)\.pdf)"', r.content.decode("utf-8", "replace"))
    except Exception as e:
        log("県のページを読めない（旧URLで見る）", e)
        return None
    if not found:
        return None
    href = max(found, key=lambda x: int(x[1] or 0))[0]
    return requests.compat.urljoin(PREF_PAGE, href)


def check_press(data):
    """県の発表PDF（復旧見込みの一覧そのもの）が更新されたかを sha で見る。更新されたら旗を立てる。
    一覧は手で書き起こしているので、県が更新したら assign_recovery_marks.py と書き起こしの更新が要る。
    地図は旗が立っている間「一覧は古い可能性」と出し、「規制中」と断言しない（2026-10-02 事業主指示）"""
    src = data.get("source") or {}
    url = latest_press_pdf() or src.get("pdf")  # 県は差し替えを fukkyumitoshi1.pdf のように別名で出す（2026-10-04）
    if not url:
        return False
    press = data.setdefault("watch", {}).get("press") or {}
    try:
        r = requests.get(url, headers=K.UA, timeout=60)
        if r.status_code == 404:
            new = {**press, "missingSince": press.get("missingSince") or K.now_iso(), "checkedAt": K.now_iso()}
            changed = press.get("missingSince") is None
            data["watch"]["press"] = new
            return changed
        r.raise_for_status()
        sha = hashlib.sha256(r.content).hexdigest()
    except Exception as e:  # 一時的に読めないだけなら旗は立てない
        log("発表PDFを読めない", e)
        return False
    base = src.get("pdfSha256")
    if not base:
        src["pdfSha256"] = sha  # 初回：書き起こした時点の版として控える
        data["watch"]["press"] = {"sha256": sha, "checkedAt": K.now_iso()}
        return True
    if sha != base and press.get("updatedSha256") != sha:
        data["watch"]["press"] = {"sha256": sha, "checkedAt": K.now_iso(), "updatedSha256": sha, "updatedDetectedAt": K.now_iso(),
                                  "message": "県が発表PDF（復旧見込みの一覧）を更新しました。この一覧は書き起こした版のままなので、assign_recovery_marks.py と書き起こしの更新が必要です"}
        log("⚠ 県の発表PDFが更新された（書き起こしの更新が必要）")
        return True
    if sha == base and press.get("updatedSha256"):
        data["watch"]["press"] = {"sha256": sha, "checkedAt": K.now_iso()}  # 元に戻った
        return True
    return False


def auto_apply_press(data):
    """県ページ上の最新の復旧見込みPDF（区間カード形式）を読み、一覧へ反映する。変更があれば True。
    関門（press_cards.update）を通らなければ一覧は変えず、watch.pressAuto に理由を残す（手元の見張りが声で知らせる）"""
    src = data.get("source") or {}
    url = latest_press_pdf()
    if not url:
        return False
    try:
        r = requests.get(url, headers=K.UA, timeout=60)
        r.raise_for_status()
    except Exception as e:
        log("発表PDFを読めない（自動反映せず）", e)
        return False
    sha = hashlib.sha256(r.content).hexdigest()
    if sha == src.get("pdfSha256"):
        return False
    w = data.setdefault("watch", {})
    try:
        ok, summary = PC.update(data, PC.parse(r.content), url, sha)
    except Exception as e:  # PDFの形が大きく変わったとき。一覧は触らない
        ok, summary = False, {"ok": False, "reason": f"PDFを読み取れませんでした（{type(e).__name__}）", "unmatched": [], "missing": []}
    summary = {k: v for k, v in summary.items() if k != "changeList"}
    summary.update(sha256=sha, url=url, checkedAt=K.now_iso())
    if ok:
        w["press"] = {"sha256": sha, "checkedAt": K.now_iso(), "autoAppliedAt": K.now_iso()}
        w["pressAuto"] = summary
        try:  # 位置図の印・赤線との突き合わせ。区間の位置（mark）は更新するが状態は変えない。失敗しても反映は有効
            mc = MC.check(r.content, data, apply=True)  # 位置図の印で区間の位置を精密にし、状態の食い違いを検算する
        except Exception as e:
            mc = {"ok": False, "reason": f"位置図の検算に失敗（{type(e).__name__}）", "contradict": []}
        w["mapCheck"] = {**mc, "sha256": sha, "checkedAt": K.now_iso()}
        log("位置図の検算：", "食い違い " + str(len(mc.get("contradict") or [])) + "件" if mc.get("ok") else mc.get("reason"), mc.get("contradict") or "")
        data["updatedAt"] = K.now_iso()
        log(f"✅ 発表PDFを自動で反映（規制中 {summary['active']}・解除 {summary['cleared']}・変更 {summary.get('changes')}件）", summary.get("unmatched") or "")
        return True
    prev = w.get("pressAuto") or {}
    if prev.get("sha256") == sha and prev.get("reason") == summary.get("reason"):
        return False  # 同じ失敗を毎時書き直さない
    w["pressAuto"] = summary
    log("⚠ 発表PDFを自動で反映できない（一覧は変更なし）：", summary.get("reason"))
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    data = load()
    watch_prev = data.get("watch") or {}
    press_changed = False if args.pdf else check_press(data)
    if not args.pdf:
        press_changed = auto_apply_press(data) or press_changed

    if args.pdf:
        pdf_url = "file:" + os.path.basename(args.pdf)
        pdf_bytes = open(args.pdf, "rb").read()
        stamp = ""
    else:
        pdf_url, stamp = K.find_pdf_url()
        if not pdf_url:
            # 県のページから図が消えた＝判定の根拠が無い。判定は変えず「止まっている」と記録し、地図は「判定できず」を出す
            w = dict(data.get("watch") or watch_prev)
            w["judgeStoppedSince"] = w.get("judgeStoppedSince") or K.now_iso()
            w["message"] = "県のページに規制状況図が掲載されていないため、解除の判定ができません"
            data["watch"] = w
            write(data)
            log("状況図なし。判定せず")
            return
        r = requests.get(pdf_url, headers=K.UA, timeout=60)
        r.raise_for_status()
        pdf_bytes = r.content
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    if not args.force and watch_prev.get("pdfSha256") == sha:
        if press_changed:
            write(data)
            log("規制状況図は同じ。発表PDFの控えだけ更新")
        else:
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
        it["judgedAtIso"] = as_of_iso or K.now_iso()
    judged_any = bool(covered)
    data["watch"] = {"pdfUrl": pdf_url, "pdfSha256": sha, "pageStamp": stamp, "asOf": as_of, "asOfIso": as_of_iso,
                     "checkedAt": K.now_iso(), "lastSuccessAt": K.now_iso() if judged_any else watch_prev.get("lastSuccessAt"),
                     "lastSuccessAsOfIso": as_of_iso if judged_any else watch_prev.get("lastSuccessAsOfIso"),
                     "judgeStoppedSince": None if judged_any else (watch_prev.get("judgeStoppedSince") or K.now_iso()),
                     "press": (data.get("watch") or {}).get("press"), "pressAuto": (data.get("watch") or {}).get("pressAuto"), "mapCheck": (data.get("watch") or {}).get("mapCheck"),
                     "figures": figures, "redLines": len(lines), "radiusM": WATCH_RADIUS_M,
                     "markRadiusM": MARK_RADIUS_M, "note": "位置図の✕印がある区間は印から markRadiusM、無い区間は町名の代表点から radiusM 以内に、県の規制状況図の赤線（規制中）が無くなったら解除とみなす"}
    data["updatedAt"] = K.now_iso()
    write(data)
    n_active = sum(1 for i in data["items"] if i.get("status") == "active")
    log(f"判定 {as_of}: 規制中 {n_active} / 解除 {len(data['items']) - n_active}（変化 {len(changed)} 件）", changed[:10])


if __name__ == "__main__":
    sys.exit(main())
