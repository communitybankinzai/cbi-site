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
import difflib
import json
import re
import sys
import unicodedata
from collections import Counter

import fitz  # PyMuPDF

TITLE_RE = re.compile(r"復旧見込み\(\d+/\d+\)")  # 「…と復旧見込み（１／３）」。位置図のページ（分割図）とは区別する
# 見出しの路線名。括弧が付く「(主)五井本納線」のほか、括弧が欠けた「主久留里鹿野山湊線」「一勝浦上野大多喜線」の形もある（2026-10-05 版）
ROAD_RE = re.compile(r"^(\((主|一|国)\)|[主一国](?=[^\s\d（）()]{2}))")
WORKS = ("土砂撤去中", "倒木撤去中", "排水作業中", "土砂撤去済")
SCALES = {"大規模": "large", "中規模": "medium"}  # 規模の札が無いカードは小規模（1〜3週間程度）
# カードの幅・高さ（pt）。見出しの左端 ax から photo の左端が ax-25、右端が ax+98。いずれも幅 780pt のページでの値で、
# ページの大きさが変わったら（10/5 版は 842pt）幅の比で拡縮する
BASE_PAGE_W = 780.0
COL_W, ROW_H = 129.5, 124.0
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


FUZZY_MIN = 0.75  # 場所の名前の類似度（OCR の読み違いを吸収する予備照合の下限）


def place_similarity(a, b):
    """場所（市町村＋場所）の名前の類似度 0〜1。ケ（ヶ・久・夕…）や蔵／藏のような見分けにくい字は同じ字とみなす"""
    return difflib.SequenceMatcher(None, place_key(a).translate(PLACE_CANON), place_key(b).translate(PLACE_CANON)).ratio()


def parse_card(words, ax, ay, cl, rt, f=1.0):
    reg = [w for w in words if cl <= w[0] < cl + COL_W * f and rt <= w[1] < rt + ROW_H * f]
    anchor = next((w for w in reg if abs(w[0] - ax) < 1 and abs(w[1] - ay) < 1), None)
    return card_from_region(reg, anchor, ax, ay, f)


def card_from_region(reg, anchor, ax, ay, f=1.0, over_to=112):
    """カードの範囲に入った語 reg から区分を読む。anchor は見出し（路線名）の語（OCR で見出しが読めなかったときは None）。
    ax, ay は見出しの左端・上端（OCR 経路では路線番号の六角形から割り出した位置）"""
    nums = [w for w in reg if re.fullmatch(r"\d+", N(w[4])) and w[0] < ax and ay - 8 * f <= w[1] < ay + 14 * f]
    route_no = N(min(nums, key=lambda w: w[0])[4]) if nums else None
    place_words = sorted((w for w in reg if ay + 6 * f <= w[1] < ay + 22 * f and w is not anchor and not re.fullmatch(r"\d+", N(w[4]))),
                         key=lambda w: (round(w[1] / 4), w[0]))
    place = "".join(N(w[4]) for w in place_words)
    over = [N(w[4]) for w in reg if ay + 22 * f <= w[1] < ay + over_to * f]
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
    scale, work_out = scale or ("small" if outlook else None), work or label
    # 規模は「復旧見込み」で決める：大規模＝調査中／中規模＝◯カ月程度／小規模＝◯週間程度（作業名の文字が取れなくても決まる）。
    # 2026-10-05 版では養老の「土砂撤去中」が文字として取れず、隠れた「大規模」だけが残った。作業名が取れなければ None（一覧の既存の値を保つ）
    if outlook == "調査中":
        scale, work_out = "large", "大規模"
    elif outlook and outlook.endswith("カ月程度"):
        # 作業名の札（土砂撤去中など）が読めていればそれを残す（2026-10-08 古敷谷「土砂撤去中・1カ月程度」。規模は中規模のまま）
        scale, work_out = "medium", work or "中規模"
    elif outlook and outlook.endswith("週間程度"):
        scale, work_out = "small", work
    return {"routeNo": route_no, "road": N(anchor[4]) if anchor else None, "place": place, "cleared": cleared, "clearedMD": cleared_md,
            "scale": scale, "work": work_out, "outlook": outlook}


# ---------------------------------------------------------------------------------------------
# OCR の予備経路（2026-10-08）：県の10/8版（fukkyumitoshi5.pdf）から全ページが1枚の画像になり、get_text が空になった。
# 語が1つも無いページだけ、画像にして rapidocr（onnxruntime・pip のみ）で読み、PDF の pt 座標に戻した語（x0,y0,x1,y1,text）にそろえる。
# OCR は中国語モデルなので、日本語の字を簡体字・似た字に読む（規→规・見込→见达・週→遇／调・カ→力・ケ→久／夕／午）。
# 使う語は少ないので、読み取った文字を日本語へ直す表（ocr_fix）と、決まった語への寄せ（snap_vocab）で受ける。
# 見出し（路線名）は「(主)」が欠けて読めないことがあるので、OCR 経路では路線番号の六角形（数字だけの語）を起点にカードの範囲を決める。
# ---------------------------------------------------------------------------------------------
OCR_DPI = 250  # 200 では「調査中」を読み落とす札があった（10/8版）。250 で58枚すべて一致
OCR_BADGE_W_MAX = 34.0  # 路線番号の六角形の語の幅（pt）の上限
OCR_CARD_L, OCR_CARD_R = 9.0, 118.0  # 六角形の左端 bx からカードの範囲（x0 が bx-9 以上 bx+118 未満）
OCR_ROW_UP, OCR_ROW_DOWN = 15.0, 114.0  # 六角形の上端 by からカードの範囲（y0 が by-15 以上 by+114 未満）。次の行の見出しは by+130 前後
OCR_HEAD_DY = 3.0  # 見出しの上端は六角形の上端より約3pt上
OCR_VOCAB = ("大規模", "中規模", "調査中", "土砂撤去中", "土砂撤去済", "倒木撤去中", "排水作業中")
OCR_CHAR_MAP = str.maketrans({
    "规": "規", "见": "見", "达": "込", "济": "済", "查": "査", "调": "調", "间": "間", "时": "時", "钠": "納", "凑": "湊", "针": "針",
    "锯": "鋸", "鹤": "鶴", "鹫": "鷲", "鸟": "鳥", "总": "総", "馆": "館", "线": "線", "务": "務", "业": "業", "设": "設", "岛": "島",
    "驿": "駅", "桥": "橋", "乡": "郷", "东": "東", "贯": "貫", "气": "気", "单": "単", "龙": "竜",
})
# 場所の名前を寄せ合わせるとき（update の予備照合）に同じ字とみなす表。ケ（ヶ・ヵ）は「久・夕・午・勺・竹」と読まれやすい
PLACE_CANON = str.maketrans({
    "ヶ": "ケ", "ヵ": "ケ", "久": "ケ", "夕": "ケ", "午": "ケ", "勺": "ケ", "竹": "ケ", "个": "ケ",
    "藏": "蔵", "澤": "沢", "邊": "辺", "總": "総", "櫻": "桜", "楼": "桜",
    "规": "規", "钠": "納", "针": "針", "锯": "鋸", "鹤": "鶴", "鹫": "鷲", "总": "総", "馆": "館", "线": "線", "凑": "湊",
})


class OcrUnavailable(Exception):
    pass


_ENGINE = None


def _install_shapely_shim():
    """rapidocr は shapely を面積と周長にしか使わない。shapely の DLL が読めない環境（手元の Windows のアプリ制御）用の代用品。
    shapely が読めるとき（GitHub Actions など）は使わない"""
    import types
    import numpy as np

    class Polygon:
        def __init__(self, pts):
            self.pts = np.asarray(pts, dtype=float).reshape(-1, 2)

        @property
        def area(self):
            x, y = self.pts[:, 0], self.pts[:, 1]
            return abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))) / 2

        @property
        def length(self):
            d = self.pts - np.roll(self.pts, -1, axis=0)
            return float(np.sqrt((d ** 2).sum(1)).sum())

    m, g = types.ModuleType("shapely"), types.ModuleType("shapely.geometry")
    g.Polygon = Polygon
    m.geometry = g
    sys.modules["shapely"], sys.modules["shapely.geometry"] = m, g


def _ocr_engine():
    global _ENGINE
    if _ENGINE is None:
        try:
            try:
                import shapely.geometry  # noqa: F401
            except Exception:
                _install_shapely_shim()
            from rapidocr_onnxruntime import RapidOCR
            _ENGINE = RapidOCR()
        except Exception as e:  # 部品が無い・読めない。画像のPDFは読めないと返す
            raise OcrUnavailable(f"OCR部品（rapidocr-onnxruntime）を使えません（{type(e).__name__}: {e}）")
    return _ENGINE


def ocr_fix(t):
    """OCR が読んだ文字を日本語の表記へ直す（全角→半角は NFKC）"""
    t = N(t).strip()
    t = re.sub(r"^今和(?=\d)", "令和", t)
    t = re.sub(r"[调遇週周通适逼]\s*[間间]", "週間", t)
    t = t.translate(OCR_CHAR_MAP)
    t = re.sub(r"力\s*月", "カ月", t)
    t = re.sub(r"通\s*行\s*止.{0,2}?\s*解\s*除", "通行止め解除", t)
    t = re.sub(r"^[復旧見込達]{2,5}(?=[:\d])", "復旧見込", t)
    t = re.sub(r"^(復旧見込:?)\d(\d(?:週間|カ月)程度)$", r"\1\2", t)  # コロンを「1」と読んだ「復旧見込11カ月程度」
    return t


def snap_vocab(t):
    """札・作業名・調査中は決まった語。1〜2字の読み違いはいちばん近い語へ寄せる（会社名・数字入りは触らない）"""
    if t in OCR_VOCAB or not (3 <= len(t) <= 6) or re.search(r"[\d()株]|建設|工業|工務|土木|組", t):
        return t
    best = max(OCR_VOCAB, key=lambda v: difflib.SequenceMatcher(None, t, v).ratio())
    return best if difflib.SequenceMatcher(None, t, best).ratio() >= 0.75 else t


def ocr_words(page, clip=None, dpi=OCR_DPI):
    """ページ（または clip の範囲）を画像にして OCR し、get_text("words") と同じ形の語（x0,y0,x1,y1,text,0,0,0）を返す。
    座標は PDF の pt。OcrUnavailable を投げることがある"""
    import numpy as np
    eng = _ocr_engine()
    pix = page.get_pixmap(dpi=dpi, clip=clip, colorspace=fitz.csRGB)
    img = np.ascontiguousarray(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, ::-1])
    res, _ = eng(img)
    sc = 72.0 / dpi
    ox, oy = (clip.x0, clip.y0) if clip is not None else (0.0, 0.0)
    out = []
    for box, text, conf in res or []:
        xs, ys = [p[0] for p in box], [p[1] for p in box]
        t = snap_vocab(ocr_fix(text))
        if not t:
            continue
        x0, y0, x1, y1 = ox + min(xs) * sc, oy + min(ys) * sc, ox + max(xs) * sc, oy + max(ys) * sc
        head = next((v for v in OCR_VOCAB if t.startswith(v) and len(t) > len(v)), None)
        if head:  # 「土砂撤去中(株)佐久間工務店」のように作業名・札と会社名が1つの箱に続けて読まれたとき、語を分ける
            cut = x0 + (x1 - x0) * len(head) / len(t)
            out.append((x0, y0, cut, y1, head, 0, 0, 0))
            out.append((cut, y0, x1, y1, t[len(head):], 0, 0, 0))
        else:
            out.append((x0, y0, x1, y1, t, 0, 0, 0))
    return out


OCR_REFINE = ((300, 200, 0), (400, 200, 0), (300, 200, 1), (400, 200, 1))  # (画像の細かさ dpi, 「白い」とみなす明るさの下限, 文字を細くするか)


def refine_places(page, words, dpi=300):
    """場所の名前（「◯◯市＋地名」）は、ページ全体から読むと「滝の」「笹」のような字を落とすことがある。その語の範囲だけを細かい画像にして読み直し、
    同じかより長く読めたほうを使う"""
    import numpy as np
    eng = _ocr_engine()
    out = []
    for w in words:
        t = w[4]
        if not re.search(r"[市町村]", t) or len(t) > 14 or re.search(r"[株建工業組線号\d/※()]|計測|通行", t):
            out.append(w)
            continue
        pix = page.get_pixmap(dpi=dpi, clip=fitz.Rect(w[0] - 1, w[1] - 1, w[2] + 1, w[3] + 1), colorspace=fitz.csRGB)
        img = np.ascontiguousarray(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, ::-1])
        res, _ = eng(img, use_det=False, use_cls=False, use_rec=True)
        if res:
            r = ocr_fix(res[0][0])
            if len(r) >= len(t) and re.search(r"[市町村]", r):
                t = r
        out.append((w[0], w[1], w[2], w[3], t) + tuple(w[5:]))
    return out


def refine_digits(page, words):
    """写真の上の白い文字は、そのまま読むと数字を読み違える（実例：「3週間」を「8週間」）。「復旧見込：◯週間／◯カ月程度」と「M/D 通行止め解除」の行だけ、
    白い画素だけを黒で取り出した画像で4通りに読み直し、数字を多数決で決める（2票以上そろわなければ元の読みのまま）"""
    import numpy as np
    import cv2
    eng = _ocr_engine()
    out = []
    for w in words:
        t = w[4]
        kind = "out" if re.search(r"(週間|カ月)程度", t) else ("clr" if "通行止め解除" in t else None)
        if kind is None:
            out.append(w)
            continue
        votes = Counter()
        clip = fitz.Rect(w[0] - 4, w[1] - 3, w[2] + 4, w[3] + 3)
        for dpi, thr, er in OCR_REFINE:
            pix = page.get_pixmap(dpi=dpi, clip=clip, colorspace=fitz.csRGB)
            rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
            bw = 255 - (rgb.min(axis=2) >= thr).astype(np.uint8) * 255
            if er:
                bw = cv2.erode(bw, np.ones((2, 2), np.uint8))
            res, _ = eng(cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR), use_det=False, use_cls=False, use_rec=True)
            if res:
                toks = tuple(re.findall(r"\d+", ocr_fix(res[0][0])))
                if toks:
                    votes[toks] += 1
        win = votes.most_common(1)
        if win and win[0][1] >= 2:
            toks = win[0][0]
            unit = re.search(r"(週間|カ月)", t)
            if kind == "out" and len(toks) == 1 and unit:
                t = f"復旧見込:{toks[0]}{unit.group(1)}程度"
            elif kind == "clr" and len(toks) == 2:
                t = f"{toks[0]}/{toks[1]}通行止め解除"
        out.append((w[0], w[1], w[2], w[3], t) + tuple(w[5:]))
    return out


def _ocr_text(words):
    """読み順（上から・左から）につないだ文字列"""
    return " ".join(w[4] for w in sorted(words, key=lambda w: (round(w[1] / 5), w[0])))


def ocr_cards(words, page_w):
    """OCR の語から区間カードを読む。路線番号の六角形（数字だけの語）を起点にする"""
    f = page_w / BASE_PAGE_W
    badges = [w for w in words if re.fullmatch(r"\d{1,3}", w[4]) and (w[2] - w[0]) <= OCR_BADGE_W_MAX * f]
    cards = []
    for b in sorted(badges, key=lambda w: (round(w[1] / (30 * f)), w[0])):
        bx, by = b[0], b[1]
        right = min([bx + OCR_CARD_R * f] + [o[0] - 6 * f for o in badges if o is not b and abs(o[1] - by) < 20 * f and o[0] > bx + 40 * f])
        reg = [w for w in words if bx - OCR_CARD_L * f <= w[0] < right and by - OCR_ROW_UP * f <= w[1] < by + OCR_ROW_DOWN * f]
        ay = by - OCR_HEAD_DY * f
        ax = bx + 22 * f
        heads = [w for w in reg if w is not b and not re.fullmatch(r"\d+", w[4]) and abs(w[1] - ay) < 7 * f and w[0] > bx + 12 * f]
        anchor = min(heads, key=lambda w: abs(w[1] - ay)) if heads else None
        card = card_from_region(reg, anchor, ax, ay, f, over_to=116)
        if anchor is None:
            card["road"] = None
        if card["outlook"] is not None and not OCR_OUTLOOK_RE.match(card["outlook"]):
            card["outlook"] = None  # 読み違えた文字をそのまま一覧へ書かない（None なら一覧の既存の値を保つ）
        cards.append(card)
    return cards


def ocr_counts(words):
    """1ページ目の「全面通行止め箇所の推移」：「M月D日（…時点）」の真下にある「N区間」を対にして [(月, 日, 件数)] を返す。
    OCR は表を1行ずつ読むので、文字列をつないだだけでは日付と件数が離れてしまう"""
    out = []
    for d in words:
        m = re.match(r"^(\d{1,2})月(\d{1,2})日", d[4])
        if not m:
            continue
        cx = (d[0] + d[2]) / 2
        below = [w for w in words if re.search(r"(\d+)\s*区[間問间]?$", w[4]) and 0 < w[1] - d[1] < 40 and w[0] - 12 <= cx <= w[2] + 12]
        if below:
            w = min(below, key=lambda w: w[1] - d[1])
            out.append((int(m.group(1)), int(m.group(2)), int(re.search(r"(\d+)\s*区", w[4]).group(1))))
    return out


OCR_OUTLOOK_RE = re.compile(r"^(調査中|\d{1,2}(週間|カ月)程度)$")
OCR_TITLE_RE = re.compile(r"復旧.{0,4}\(\d+/\d+\)")  # 「…と復旧見込み（１／３）」（OCR は「込」を落とすことがある）。位置図のページ（「復旧見込み 位置図 - 分割図(1/3)」）は OCR_MAP_RE で除く
OCR_MAP_RE = re.compile(r"位置|分割")
OCR_ASOF_RE = re.compile(r"令和\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日\s*時点")


def parse(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text1 = N(doc[0].get_text())
    cards = []
    ocr_texts, ocr_error, ocr_pages = [], None, 0
    counts_ocr = None
    for pi, page in enumerate(doc):
        if not page.get_text("words"):  # 画像だけのページ（10/8版から）：OCR の予備経路
            try:
                if pi == 0:
                    w1 = ocr_words(page)
                    ocr_texts.append(_ocr_text(w1))
                    counts_ocr = ocr_counts(w1)
                    ocr_pages += 1
                    continue
                strip = ocr_words(page, clip=fitz.Rect(0, 0, page.rect.width, 48 * page.rect.width / BASE_PAGE_W))
                title = _ocr_text(strip)
                ocr_texts.append(title)
                if not OCR_TITLE_RE.search(title) or OCR_MAP_RE.search(title):
                    continue
                words = refine_places(page, refine_digits(page, ocr_words(page)))
                ocr_texts.append(_ocr_text(words))
                ocr_pages += 1
                for card in ocr_cards(words, page.rect.width):
                    card["page"] = pi + 1
                    cards.append(card)
            except OcrUnavailable as e:
                ocr_error = str(e)
                break
            continue
        if not TITLE_RE.search(N(page.get_text())):
            continue
        words = page.get_text("words")
        anchors = [w for w in words if ROAD_RE.match(N(w[4]))]
        if not anchors:
            continue
        f = page.rect.width / BASE_PAGE_W
        cols = _cluster([a[0] for a in anchors], 40 * f)
        rows = _cluster([a[1] for a in anchors], 30 * f)
        for a in sorted(anchors, key=lambda w: (round(w[1] / (30 * f)), w[0])):
            c, r = cols[_nearest(cols, a[0])], rows[_nearest(rows, a[1])]
            card = parse_card(words, a[0], a[1], c - COL_LEFT_OFF * f, r - ROW_TOP_OFF * f, f)
            card["page"] = pi + 1
            cards.append(card)
    ocr_all = " ".join(ocr_texts)
    m = re.search(r"令和(\d+)年(\d+)月(\d+)日時点", " ".join(N(p.get_text()) for p in doc)) or OCR_ASOF_RE.search(ocr_all)
    as_of = dt.date(2018 + int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None
    hh = re.search(r"(\d+)月(\d+)日\s*\((\d+)時(\d+)分\s*時点\)", text1 or (ocr_texts[0] if ocr_texts else ""))
    as_of_iso = None
    if as_of:
        hour, minute = (int(hh.group(3)), int(hh.group(4))) if hh and (int(hh.group(1)), int(hh.group(2))) == (as_of.month, as_of.day) else (0, 0)
        as_of_iso = f"{as_of.isoformat()}T{hour:02d}:{minute:02d}:00+09:00"
    counts = [(int(a), int(b), int(c)) for a, b, c in re.findall(r"(\d+)月(\d+)日\s*(?:\([^)]*\))?\s*(\d+)\s*区間", text1)] or (counts_ocr or [])
    stated_active = max(counts)[2] if counts else None
    out = {"asOfDate": as_of.isoformat() if as_of else None, "asOfIso": as_of_iso, "statedActive": stated_active, "cards": cards}
    if ocr_pages or ocr_error:  # 画像のページを OCR で読んだ（件数の関門は必須にする）
        out["ocr"], out["ocrError"] = bool(ocr_pages), ocr_error
    return out


def update(data, parsed, url=None, sha=None, dry=False):
    """parse() の結果を data（pref-recovery-outlook.json の中身）へ反映する。(ok, summary) を返す。ok でなければ data は変えない。"""
    cards = parsed["cards"]
    items = data["items"]
    idx = {(it["routeNo"], place_key(it["municipality"] + it["place"])): it for it in items}
    bad = [c for c in cards if not c["routeNo"] or not c["place"] or not (c["cleared"] or c["scale"] or c["outlook"] or c["work"])]
    matched, unmatched, fuzzy = [], [], []
    for c in cards:
        it = idx.get((c["routeNo"], place_key(c["place"])))
        (matched if it else unmatched).append((c, it) if it else c)
    # 路線番号＋場所の完全一致で見つからないカードは、同じ路線番号の（まだ対応していない）区間の中で名前の似ているものへ寄せる。
    # OCR は1〜2字読み違えるため（袖ケ浦→袖久浦 など）。類似度 FUZZY_MIN 以上のものだけ・1区間に1枚・似ている順
    if unmatched:
        taken = {id(it) for _, it in matched}
        pairs = []
        for ci, c in enumerate(unmatched):
            for it in items:
                if id(it) in taken or it["routeNo"] != c["routeNo"]:
                    continue
                r = place_similarity(c["place"], it["municipality"] + it["place"])
                if r >= FUZZY_MIN:
                    pairs.append((r, ci, it))
        used_c = set()
        for r, ci, it in sorted(pairs, key=lambda x: -x[0]):
            if ci in used_c or id(it) in taken:
                continue
            used_c.add(ci)
            taken.add(id(it))
            matched.append((unmatched[ci], it))
            fuzzy.append(f"{unmatched[ci]['routeNo']} {unmatched[ci]['place']} → {it['municipality']}{it['place']}（{r:.2f}）")
        unmatched = [c for ci, c in enumerate(unmatched) if ci not in used_c]
    n_active = sum(1 for c in cards if not c["cleared"])
    reason = None
    if len(cards) < MIN_CARDS:
        reason = f"区間カードが{len(cards)}枚しか読めません" + (f"（{parsed['ocrError']}）" if parsed.get("ocrError") else "")
    elif bad:
        reason = f"区分を読めないカードが{len(bad)}枚あります（{bad[0].get('road')}・{bad[0].get('place')}）"
    elif not parsed["asOfIso"]:
        reason = "PDFの時点（令和◯年◯月◯日時点）を読めません"
    elif parsed["statedActive"] is not None and parsed["statedActive"] != n_active:
        reason = f"PDFの件数（{parsed['statedActive']}区間）と読み取った規制中の枚数（{n_active}）が合いません"
    elif parsed.get("ocr") and parsed["statedActive"] is None:
        reason = "画像のPDFをOCRで読みましたが、1ページ目の件数（◯区間）を読めません"
    seen = {id(it) for _, it in matched}
    missing = [it["id"] for it in items if id(it) not in seen and it.get("status") == "active"]  # 一覧にあるのにPDFのカードが無い規制中の区間
    summary = {"cards": len(cards), "cleared": len(cards) - n_active, "active": n_active, "unmatched": [f"{c['road']} {c['place']}" for c in unmatched],
               "missing": missing, "fuzzy": fuzzy, "ocr": bool(parsed.get("ocr")),
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
        if c.get("page"):
            it["pdfPage"] = c["page"]  # 県PDFの該当ページ（画面が ${source.pdf}#page=N へリンクする）
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
    if url:
        data["pdfPagesFor"] = url  # pdfPage がどの版のPDFのページ番号か（画面は source.pdf と一致するときだけ直リンクを出す）
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
