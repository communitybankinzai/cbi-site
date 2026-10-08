# -*- coding: utf-8 -*-
"""press_cards.py の OCR 予備経路の精度確認（2026-10-08）。

  ① 10/8版（fukkyumitoshi5.pdf・全ページ画像）を parse() し、運営が画像を読んで書き起こした正解（press_manual_20261008.py の表 T）と
     58枚を突き合わせる（路線番号・場所・解除／規制中・解除日・規模・作業・見込み）。さらに update() の関門（件数・時点）を通るか、
     今の一覧（pref-recovery-outlook.json・10/8版を反映済み）に当てて差分が0になるか、各カードの pdfPage が 5/6/7 になるかを見る。
  ② 10/7版（fukkyumitoshi4.pdf・文字あり）について「文字版の parse 結果」対「各ページを画像に描き直してから OCR で読んだ結果」を比べる。

press_manual_20261008.py は import すると一覧 JSON を書き換えるので、表 T の文字だけを正規表現で取り出す（実行しない）。
使い方（rapidocr-onnxruntime が入った場所を --libs で足す。GitHub Actions では pip で入っているので不要）：
  python check_ocr_20261008.py --new new.pdf --old old4.pdf [--libs <site-packages 相当のフォルダ>]... [--dpi 200] [--skip-old]
"""
import argparse
import copy
import difflib
import io
import json
import os
import re
import sys
import time
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)


def load_expected(path):
    src = open(path, encoding="utf-8").read()
    m = re.search(r'^T = """\n(.*?)"""', src, re.S | re.M)
    rows = []
    for line in m.group(1).strip().splitlines():
        parts = line.split()
        no, place, kind = parts[0], parts[1], parts[2]
        if kind.startswith("解除:"):
            mo, d = kind[3:].split("/")
            rows.append({"routeNo": no, "place": place, "cleared": True, "clearedMD": (int(mo), int(d)), "scale": None, "work": None, "outlook": None, "note": ""})
            continue
        outlook = parts[3]
        note = ""
        if outlook == "調査中":
            scale, work = "large", "大規模"
        elif outlook.endswith("カ月程度"):
            scale, work = "medium", "中規模"  # parse() の規則（カ月＝中規模）。手作業の表は作業名のまま残した行がある
            if kind != "中規模":
                note = f"手作業の表は作業名「{kind}」を残した（parse は規則どおり中規模）"
        else:
            scale, work = "small", (None if kind == "中規模" else kind)
        rows.append({"routeNo": no, "place": place, "cleared": False, "clearedMD": None, "scale": scale, "work": work, "outlook": outlook, "note": note})
    return rows


FIELDS = ("routeNo", "place", "cleared", "clearedMD", "scale", "work", "outlook")


def sim(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def align(exp, got):
    """正解の各行に、読み取ったカードを1対1で当てる（まず路線番号＋場所の完全一致、次に同じ路線番号で似ている順、最後は場所だけで似ている順）"""
    pairs, used_e, used_g = [], set(), set()
    for i, e in enumerate(exp):
        for j, g in enumerate(got):
            if j not in used_g and g["routeNo"] == e["routeNo"] and g["place"] == e["place"]:
                pairs.append((i, j)); used_e.add(i); used_g.add(j); break
    for same_route in (True, False):
        cand = sorted(((sim(e["place"], g["place"]), i, j) for i, e in enumerate(exp) if i not in used_e for j, g in enumerate(got)
                       if j not in used_g and (g["routeNo"] == e["routeNo"] or not same_route)), reverse=True)
        for r, i, j in cand:
            if i in used_e or j in used_g or r < 0.4:
                continue
            pairs.append((i, j)); used_e.add(i); used_g.add(j)
    return pairs, [i for i in range(len(exp)) if i not in used_e], [j for j in range(len(got)) if j not in used_g]


def compare(exp, got, title):
    pairs, miss_e, extra_g = align(exp, got)
    print(f"\n== {title}")
    print(f"正解 {len(exp)}枚 / 読み取り {len(got)}枚 / 対応づけ {len(pairs)}枚 / 読めなかった正解 {len(miss_e)}枚 / 余分な読み取り {len(extra_g)}枚")
    ok_field = Counter()
    bad = []
    all_ok = 0
    for i, j in pairs:
        e, g = exp[i], got[j]
        diffs = []
        for k in FIELDS:
            if e[k] == g.get(k):
                ok_field[k] += 1
            else:
                diffs.append(f"{k}: 正解={e[k]!r} 読取={g.get(k)!r}")
        if diffs:
            bad.append((e, diffs))
        else:
            all_ok += 1
    print("項目ごとの一致（対応づけた%d枚中）:" % len(pairs), "  ".join(f"{k} {ok_field[k]}" for k in FIELDS))
    print(f"全項目が一致したカード: {all_ok} / {len(exp)}")
    for e, diffs in bad:
        print(f"  不一致 {e['routeNo']} {e['place']}: " + " | ".join(diffs))
    for i in miss_e:
        print(f"  読めなかった正解 {exp[i]['routeNo']} {exp[i]['place']}")
    for j in extra_g:
        print(f"  余分な読み取り {got[j]['routeNo']} {got[j]['place']} {got[j].get('road')}")
    return all_ok, len(exp), bad


def image_only_pdf(src_bytes, dpi):
    import fitz
    src = fitz.open(stream=src_bytes, filetype="pdf")
    out = fitz.open()
    for page in src:
        pix = page.get_pixmap(dpi=dpi)
        np_ = out.new_page(width=page.rect.width, height=page.rect.height)
        np_.insert_image(np_.rect, stream=pix.tobytes("png"))
    return out.tobytes()


def card_key(c):
    return (c["routeNo"], c["place"], c["cleared"], c["clearedMD"], c["scale"], c["work"], c["outlook"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", required=True, help="10/8版 fukkyumitoshi5.pdf（画像のみ）")
    ap.add_argument("--old", help="10/7版 fukkyumitoshi4.pdf（文字あり）")
    ap.add_argument("--json", default=os.path.join(PIPE, "..", "pref-recovery-outlook.json"))
    ap.add_argument("--manual", default=os.path.join(HERE, "press_manual_20261008.py"))
    ap.add_argument("--libs", action="append", default=[], help="rapidocr-onnxruntime などを入れたフォルダ（何度でも指定可）")
    ap.add_argument("--dpi", type=int, default=None)
    ap.add_argument("--skip-old", action="store_true")
    a = ap.parse_args()
    for d in reversed(a.libs):
        sys.path.insert(0, d)
    sys.path.insert(0, PIPE)
    import warnings
    warnings.filterwarnings("ignore")
    import press_cards as PC
    if a.dpi:
        PC.OCR_DPI = a.dpi
        PC.ocr_words.__defaults__ = (None, a.dpi)

    exp = load_expected(a.manual)
    print(f"正解の表: {len(exp)}枚（規制中 {sum(1 for e in exp if not e['cleared'])}・解除 {sum(1 for e in exp if e['cleared'])}）")

    # ① 10/8版
    pdf = open(a.new, "rb").read()
    t = time.time()
    parsed = PC.parse(pdf)
    sec = time.time() - t
    print(f"parse（OCR）の処理時間: {sec:.1f}秒  ocr={parsed.get('ocr')} ocrError={parsed.get('ocrError')}")
    print(f"時点 asOfIso={parsed['asOfIso']}  件数 statedActive={parsed['statedActive']}  読めたカード {len(parsed['cards'])}枚（ページ別 {dict(Counter(c['page'] for c in parsed['cards']))}）")
    all_ok, n, bad = compare(exp, parsed["cards"], "10/8版（OCR）対 運営が書き起こした正解")
    known = [e["note"] for e in exp if e["note"]]
    if known:
        print("  （参考）正解の表と parse の規則が違う行:", "; ".join(known))

    data = json.load(open(a.json, encoding="utf-8"))
    d2 = copy.deepcopy(data)
    before_pages = {it["id"]: it.pop("pdfPage") for it in d2["items"] if "pdfPage" in it}  # 既にある値は外し、update() が書いた分だけを見る
    d2.pop("pdfPagesFor", None)
    url = "https://www.pref.chiba.lg.jp/doukan/douroiji/documents/fukkyumitoshi5.pdf"
    ok, s = PC.update(d2, parsed, url, "check")
    print("\n== update() の関門（今の一覧＝10/8版を反映済みのものに当てる。差分0なら正解どおり）")
    print({k: v for k, v in s.items() if k != "changeList"})
    for line in s.get("changeList", []):
        print("  変更", line)
    pages = Counter(it.get("pdfPage") for it in d2["items"] if it.get("pdfPage"))
    print("pdfPage の分布（update() が書いた分）:", dict(sorted(pages.items())), " pdfPagesFor:", d2.get("pdfPagesFor"), " / pdfPage が付かなかった区間:",
          [it["id"] for it in d2["items"] if not it.get("pdfPage")])
    if before_pages:
        diff = [(i, before_pages[i], it.get("pdfPage")) for it in d2["items"] for i in [it["id"]] if i in before_pages and before_pages[i] != it.get("pdfPage")]
        print(f"一覧にもともと入っていた pdfPage {len(before_pages)}件との食い違い: {len(diff)}件", diff[:5])
    gate = ok and parsed["asOfIso"] == "2026-10-08T14:00:00+09:00" and parsed["statedActive"] == 48
    print(f"関門の判定: ok={ok} 時点={parsed['asOfIso']} 件数={parsed['statedActive']}  → {'通過' if gate else '通過せず'}")

    # ② 10/7版：文字版 対 画像に描き直して OCR
    if a.old and not a.skip_old:
        pdf_old = open(a.old, "rb").read()
        t = time.time()
        p_text = PC.parse(pdf_old)
        s_text = time.time() - t
        img = image_only_pdf(pdf_old, 200)
        t = time.time()
        p_ocr = PC.parse(img)
        s_ocr = time.time() - t
        print(f"\n== 10/7版：文字版の parse（{s_text:.1f}秒）対 画像に描き直して OCR（{s_ocr:.1f}秒）")
        print(f"文字版 カード{len(p_text['cards'])}枚 時点{p_text['asOfIso']} 件数{p_text['statedActive']} ocr={p_text.get('ocr')} / OCR カード{len(p_ocr['cards'])}枚 時点{p_ocr['asOfIso']} 件数{p_ocr['statedActive']} ocr={p_ocr.get('ocr')}")
        tx = [dict(c) for c in p_text["cards"]]
        compare(tx, p_ocr["cards"], "10/7版（文字版の結果を正解として・画像から OCR）")
        d3 = copy.deepcopy(data)
        ok3, s3 = PC.update(d3, p_ocr, url, "check")
        print("OCR 結果を update() に当てる:", {k: v for k, v in s3.items() if k not in ("changeList",)})


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
