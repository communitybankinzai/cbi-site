# 県の道路規制状況図の赤線を寄せる先（国道・県道）を OpenStreetMap から取り、data/pref_roads_main.json.gz に保存する。
# 道路は頻繁には変わらないので、手で時々作り直せばよい（毎時の取り込みでは読むだけ。Overpass に負担を掛けない）。
#   python fetch_pref_roads.py            … Overpass API から取得
#   python fetch_pref_roads.py --from x.json … 取得済みの Overpass の応答から作る
# © OpenStreetMap contributors（ODbL）。範囲は build_pref_road_kisei.py の BBOX（分割図1/3）と同じ。
import argparse
import gzip
import json
import os

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "pref_roads_main.json.gz")
BBOX = dict(west=139.80, east=140.80, north=36.00, south=35.45)
QUERY = ('[out:json][timeout:150];way["highway"~"^(trunk|primary|secondary)$"]'
         f'({BBOX["south"]},{BBOX["west"]},{BBOX["north"]},{BBOX["east"]});out tags geom;')
UA = {"User-Agent": "CBI-inzai-disaster-map/1.0 (+https://communitybankinzai.github.io/cbi-site/inzai-disaster-map/)"}


def road_key(tags, way_id):
    # 同じ道路を1つにまとめる鍵。番号（ref）があれば種別＋番号、無ければ名前、それも無ければ way の番号
    ref = (tags.get("ref") or "").split(";")[0].strip()
    if ref:
        return f'{tags.get("highway")}:{ref}'
    name = (tags.get("name") or "").strip()
    return f"name:{name}" if name else f"id:{way_id}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src")
    args = ap.parse_args()
    if args.src:
        data = json.load(open(args.src, encoding="utf-8"))
    else:
        r = requests.post("https://overpass-api.de/api/interpreter", data={"data": QUERY}, headers=UA, timeout=240)
        r.raise_for_status()
        data = r.json()
    ways = []
    for el in data.get("elements", []):
        geom = el.get("geometry") or []
        if el.get("type") != "way" or len(geom) < 2:
            continue
        ways.append({"key": road_key(el.get("tags", {}), el["id"]),
                     "path": [[round(g["lat"], 5), round(g["lon"], 5)] for g in geom]})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    body = {"source": "© OpenStreetMap contributors (ODbL)", "query": QUERY, "ways": ways}
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(ways)} ways → {OUT} ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
