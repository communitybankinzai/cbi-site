"""県の復旧見込みPDF（位置図付き・区間カード形式）を読み、pref-recovery-outlook.json の一覧を更新する。

2026-10-04 県が規制状況図を取り下げ、「被災箇所の状況と復旧見込み（位置図付き）」PDF（fukkyumitoshi1.pdf）に切り替えた。
このPDFの5ページ目以降は、1区間＝1枚のカード（路線・場所の見出し＋写真＋規模／作業／復旧見込み／通行止め解除の日付）で、
文字として読める。手で書き起こしていた更新（豊成・鶴舞など解除の反映）をこの読み取りで自動にする。

安全側の方針：読み取った内容を一覧へ反映するのは、次の関門を全部通ったときだけ。通らなければ一覧は変えず、理由を返す。
  ①カードが30枚以上 ②全カードの区分（規模・作業・見込み・解除）を読めた ③PDFの「全面通行止め箇所」件数と規制中の枚数が一致
  ④全カードが既存の一覧に対応する（未登録の新区間は反映せず警告として返す）
使い方（試験）：python press_cards.py 新PDF [--apply]   既定は差分の表示だけ（ファイルは書かない）
"""
import argparse
import datetime as dt
import json
import re
import sys
import unicodedata

import fitz  # PyMuPDF

TITLE_RE = re.compile(r"復旧見込み\(\d+/\d+\)")  # 「…と復旧見込み（１／３）」。位置図のページ（分割図）とは区別する
ROAD_RE = re.compile(r"^\((主|一|国)\)")
WORKS = ("土砂撤去中", "倒木撤去中", "排水作業中", "土砂撤去済")
SCALES = {"大規模": "large", "中規模": "medium"}  # 規模の札が無いカードは小規模（1〜3週間程度）
COL_W, ROW_H = 129.5, 124.0  # カードの幅・高さ（pt）。見出しの左端 ax から photo の左端が ax-25、右端が ax+98
COL_LEFT_OFF, ROW_TOP_OFF = 35.0, 12.0
MIN_CARDS = 30


def N(s):
    return unicodedata.normalize("NFKC", s)


def _cluster(vals, gap):
    out = []
    for v in sorted(vals):
        if out and v - out[-1][-1] <= gap:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(c) / len(c) for c in out]


def _nearest(centers, v):
    return min(range(len(centers)), key=lambda i: abs(centers[i] - v))


def place_key(s):
    return re.sub(r"\s+", "", N(s))


def parse_card(words, ax, ay, cl, rt):
    reg = [w for w in words if cl <= w[0] < cl + COL_W and rt <= w[1] < rt + ROW_H]
    anchor = next((w for w in reg if abs(w[0] - ax) < 1 and abs(w[1] - ay) < 1), None)
    nums = [w for w in reg if re.fullmatch(r"\d+", N(w[4])) and w[0] < ax and ay - 8 <= w[1] < ay + 14]
    route_no = N(min(nums, key=lambda w: w[0])[4]) if nums else None
    place_words = sorted((w for w in reg if ay + 6 <= w[1] < ay + 22 and w is not anchor and not re.fullmatch(r"\d+", N(w[4]))),
                         key=lambda w: (round(w[1] / 4), w[0]))
    place = "".join(N(w[4]) for w in place_words)
    over = [N(w[4]) for w in reg if ay + 22 <= w[1] < ay + 112]
    scale = next((SCALES[t] for t in over if t in SCALES), None)
    work = next((t for t in over if t in WORKS), None)
    outlook = None
    for t in over:
        m = re.match(r"^復旧見込[:：]?(.+)$", t)
        if m:
            outlook = m.group(1)
    if outlook is None and "調査中" in over:
        outlook = "調査中"
    cleared = any("通行止め解除" in t for t in over)
    cleared_md = None
    if cleared:
        for t in over:
            m = re.search(r"(\d{1,2})/(\d{1,2})", t)
            if m:
                cleared_md = (int(m.group(1)), int(m.group(2)))
    label = next((t for t in over if t in ("大規模", "中規模")), None)
    # PDF には、画面に出ていない「大規模」の文字が残るカードがある（2026-10-04 養老）。作業名があれば小規模として作業名を優先する
    if work:
        scale, label = "small", None
    return {"routeNo": route_no, "road": N(anchor[4]) if anchor else None, "place": place, "cleared": cleared, "clearedMD": cleared_md,
            "scale": scale or ("small" if outlook else None), "work": work or label, "outlook": outlook}


def parse(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text1 = N(doc[0].get_text())
    cards = []
    for pi, page in enumerate(doc):
        if not TITLE_RE.search(N(page.get_text())):
            continue
        words = page.get_text("words")
        anchors = [w for w in words if ROAD_RE.match(N(w[4]))]
        if not anchors:
            continue
        cols = _cluster([a[0] for a in anchors], 40)
        rows = _cluster([a[1] for a in anchors], 30)
        for a in sorted(anchors, key=lambda w: (round(w[1] / 30), w[0])):
            c, r = cols[_nearest(cols, a[0])], rows[_nearest(rows, a[1])]
            card = parse_card(words, a[0], a[1], c - COL_LEFT_OFF, r - ROW_TOP_OFF)
            card["page"] = pi + 1
            cards.append(card)
    m = re.search(r"令和(\d+)年(\d+)月(\d+)日時点", " ".join(N(p.get_text()) for p in doc))
    as_of = dt.date(2018 + int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None
    hh = re.search(r"(\d+)月(\d+)日\s*\((\d+)時(\d+)分\s*時点\)", text1)
    as_of_iso = None
    if as_of:
        hour, minute = (int(hh.group(3)), int(hh.group(4))) if hh and (int(hh.group(1)), int(hh.group(2))) == (as_of.month, as_of.day) else (0, 0)
        as_of_iso = f"{as_of.isoformat()}T{hour:02d}:{minute:02d}:00+09:00"
    counts = [(int(a), int(b), int(c)) for a, b, c in re.findall(r"(\d+)月(\d+)日\s*(?:\([^)]*\))?\s*(\d+)\s*区間", text1)]
    stated_active = max(counts)[2] if counts else None
    return {"asOfDate": as_of.isoformat() if as_of else None, "asOfIso": as_of_iso, "statedActive": stated_active, "cards": cards}


def update(data, parsed, url=None, sha=None, dry=False):
    """parse() の結果を data（pref-recovery-outlook.json の中身）へ反映する。(ok, summary) を返す。ok でなければ data は変えない。"""
    cards = parsed["cards"]
    items = data["items"]
    idx = {(it["routeNo"], place_key(it["municipality"] + it["place"])): it for it in items}
    bad = [c for c in cards if not c["routeNo"] or not c["place"] or not (c["cleared"] or c["scale"] or c["outlook"] or c["work"])]
    matched, unmatched = [], []
    for c in cards:
        it = idx.get((c["routeNo"], place_key(c["place"])))
        (matched if it else unmatched).append((c, it) if it else c)
    n_active = sum(1 for c in cards if not c["cleared"])
    reason = None
    if len(cards) < MIN_CARDS:
        reason = f"区間カードが{len(cards)}枚しか読めません"
    elif bad:
        reason = f"区分を読めないカードが{len(bad)}枚あります（{bad[0].get('road')}・{bad[0].get('place')}）"
    elif not parsed["asOfIso"]:
        reason = "PDFの時点（令和◯年◯月◯日時点）を読めません"
    elif parsed["statedActive"] is not None and parsed["statedActive"] != n_active:
        reason = f"PDFの件数（{parsed['statedActive']}区間）と読み取った規制中の枚数（{n_active}）が合いません"
    seen = {id(it) for _, it in matched}
    missing = [it["id"] for it in items if id(it) not in seen and it.get("status") == "active"]  # 一覧にあるのにPDFのカードが無い規制中の区間
    summary = {"cards": len(cards), "cleared": len(cards) - n_active, "active": n_active, "unmatched": [f"{c['road']} {c['place']}" for c in unmatched],
               "missing": missing,
               "asOfIso": parsed["asOfIso"], "ok": reason is None, "reason": reason}
    if reason:
        return False, summary
    asof_iso = parsed["asOfIso"]
    fig_iso = (data.get("watch") or {}).get("lastSuccessAsOfIso")
    fig_newer = bool(fig_iso) and dt.datetime.fromisoformat(fig_iso) >= dt.datetime.fromisoformat(asof_iso)
    d0 = dt.datetime.fromisoformat(asof_iso)
    label = f"{d0.month}月{d0.day}日{d0.hour}時"
    changes = []
    for c, it in matched:
        before = (it.get("status"), it.get("work"), it.get("outlook"), it.get("scale"))
        if c["cleared"]:
            md = c["clearedMD"] or (int(parsed["asOfDate"][5:7]), int(parsed["asOfDate"][8:10]))
            year = int(parsed["asOfDate"][:4]) - (1 if md[0] > int(parsed["asOfDate"][5:7]) else 0)
            day = f"{year}-{md[0]:02d}-{md[1]:02d}"
            if it.get("status") != "cleared" or it.get("clearedBy") != "announced" or it.get("clearedDate") != day:
                it.update(status="cleared", clearedAt=day + "T00:00:00+09:00", clearedFigure=None, clearedBy="announced", clearedDate=day,
                          watch=f"県の発表（{label}時点のPDF）で通行止め解除")
        else:
            if it.get("status") != "active":
                it.update(status="active", clearedAt=None, clearedFigure=None, clearedBy=None, clearedDate=None)
            it["work"], it["outlook"] = c["work"] or it.get("work"), c["outlook"] or it.get("outlook")
            if c["scale"]:
                it["scale"] = c["scale"]
            if not fig_newer:
                it["watch"] = f"県の発表（{label}時点）で規制中"
                it["nearestRedLineM"] = None
        if (it.get("status"), it.get("work"), it.get("outlook"), it.get("scale")) != before:
            changes.append((it["id"], before, (it.get("status"), it.get("work"), it.get("outlook"), it.get("scale"))))
    summary["changes"] = len(changes)
    summary["changeList"] = [f"{i}: {b} → {a}" for i, b, a in changes]
    src = data.setdefault("source", {})
    if url:
        src["pdf"] = url
    if sha:
        src["pdfSha256"] = sha
    src.update(asOf=parsed["asOfDate"], asOfIso=asof_iso, published=parsed["asOfDate"])
    return True, summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--json", default="../pref-recovery-outlook.json")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    parsed = parse(open(a.pdf, "rb").read())
    data = json.load(open(a.json, encoding="utf-8"))
    ok, s = update(data, parsed)
    out = {k: v for k, v in s.items() if k != "changeList"}
    print(json.dumps(out, ensure_ascii=False))
    for line in s.get("changeList", []):
        print("  変更", line)
    if ok and a.apply:
        with open(a.json, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("書き込みました")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
