# osm-shops.json の各店に area（inzai＝印西市内／near＝周辺の市町）を付け、どちらでもない店を外す（2026-11-13）。
# 何度流しても同じ結果になる（外部の API は取り直さない）。build_shops.py も書き出しの前に同じ判定を通す。
#   python apply_area.py            … 書き換える
#   python apply_area.py --dry-run  … 件数だけ表示
import argparse, json, os
from collections import Counter
from area import area_of, municipality_of

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "osm-shops.json")


def tag_shops(shops):
    kept, dropped = [], Counter()
    for s in shops:
        a = area_of(s["lat"], s["lon"])
        if a is None:
            dropped[municipality_of(s["lat"], s["lon"]) or "（7市町の外）"] += 1
            continue
        kept.append({**s, "area": a})
    return kept, dropped


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    raw = open(OUT, "rb").read()
    d = json.loads(raw.decode("utf-8"))
    before = len(d["shops"])
    kept, dropped = tag_shops(d["shops"])
    c = Counter(s["area"] for s in kept)
    print(f"元 {before} 件 → 市内 {c['inzai']} 件・周辺 {c['near']} 件・外した {before - len(kept)} 件")
    by_city = Counter(municipality_of(s["lat"], s["lon"]) for s in kept)
    print("  市町別", dict(by_city.most_common()))
    print("  外した店の場所（7市町の外はまとめて）", dict(dropped.most_common()))
    if a.dry_run:
        return
    d["shops"] = kept
    d["area"] = {"inzai": "印西市", "near": [x for x in by_city if x != "印西市"], "rule": "座標の市域判定（pipeline/area.py・areas.json）"}
    open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
    print("書き出し", OUT)


if __name__ == "__main__":
    main()
