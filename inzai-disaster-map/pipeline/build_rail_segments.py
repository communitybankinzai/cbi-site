# 鉄道の「駅と駅のあいだ」データを作る（運休区間の色塗り用）
#
# 市の発表は「成田駅～我孫子駅間が運休」のように駅名で来る。地図でその区間だけを
# 赤く塗るため、OpenStreetMap の路線データを駅ごとに切り分けて rail-segments.json を作る。
#
#   python pipeline/build_rail_segments.py
#
# 出力: site/inzai-disaster-map/rail-segments.json（生成物はコミットする。実行は路線が
#       変わったときだけでよい）
# 出典: OpenStreetMap contributors / ODbL 1.0（表示側で必ず明記すること）

import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, "_railcache")
OUTPUT = os.path.join(os.path.dirname(HERE), "rail-segments.json")

# Overpass は混み具合で 504 を返すため、順に試す
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

# 印西市民の足になる2路線。relation は「片方向の各駅停車」を選ぶ（上下で2本あるため）。
LINES = [
    {
        "id": "jr-narita-abiko",
        "relation": 10928742,
        "name": "JR成田線（我孫子支線）",
        "operator": "JR東日本",
        "infoUrl": "https://traininfo.jreast.co.jp/train_info/line.aspx?gid=1&lineid=naritaline",
    },
    {
        "id": "hokuso",
        "relation": 3340250,
        "name": "北総線",
        "operator": "北総鉄道",
        "infoUrl": "https://www.hokuso-railway.co.jp/",
    },
]

# 駅が線から離れていたら、区間の切れ目としては信用できない
STATION_WARN_M = 200
# 別々に取れた線のつなぎ目として許す距離（駅構内の分岐でできる隙間を埋める）
CHAIN_JOIN_M = 400


def overpass(query, cache_key):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{cache_key}.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fp:
            return json.load(fp)

    last = None
    for endpoint in ENDPOINTS:
        for attempt in range(2):
            try:
                data = urllib.parse.urlencode({"data": query}).encode()
                request = urllib.request.Request(
                    endpoint, data=data, headers={"User-Agent": "CBI-inzai-disaster-map/1.0"}
                )
                payload = json.load(urllib.request.urlopen(request, timeout=300))
                with open(path, "w", encoding="utf-8") as fp:
                    json.dump(payload, fp)
                return payload
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as error:
                last = error
                print(f"  取得失敗（{endpoint} {attempt + 1}回目）: {error}")
                time.sleep(5)
    raise SystemExit(f"Overpass から取得できませんでした: {last}")


def dist_m(a, b):
    lat = math.radians((a[0] + b[0]) / 2)
    dy = (a[0] - b[0]) * 111320
    dx = (a[1] - b[1]) * 111320 * math.cos(lat)
    return math.hypot(dx, dy)


def path_length_m(path):
    return sum(dist_m(path[i], path[i + 1]) for i in range(len(path) - 1))


def chain_ways(ways):
    """線路の断片を端点でつないで、できるだけ長い折れ線にまとめる"""
    pool = [list(way) for way in ways if len(way) >= 2]
    chains = []
    while pool:
        current = pool.pop(0)
        joined = True
        while joined:
            joined = False
            for index, way in enumerate(pool):
                if dist_m(current[-1], way[0]) < 1:
                    current += way[1:]
                elif dist_m(current[-1], way[-1]) < 1:
                    current += list(reversed(way))[1:]
                elif dist_m(current[0], way[-1]) < 1:
                    current = way[:-1] + current
                elif dist_m(current[0], way[0]) < 1:
                    current = list(reversed(way))[1:] + current
                else:
                    continue
                pool.pop(index)
                joined = True
                break
        chains.append(current)
    return chains


def join_nearby(chains, limit_m=CHAIN_JOIN_M):
    """駅構内などでできた隙間をまたいで、いちばん長い線へつなぐ"""
    chains = sorted(chains, key=path_length_m, reverse=True)
    main, rest = chains[0], chains[1:]
    merged = True
    while merged and rest:
        merged = False
        best = None
        for index, chain in enumerate(rest):
            for main_end, main_point in ((-1, main[-1]), (0, main[0])):
                for chain_end, chain_point in ((0, chain[0]), (-1, chain[-1])):
                    gap = dist_m(main_point, chain_point)
                    if gap <= limit_m and (best is None or gap < best[0]):
                        best = (gap, index, main_end, chain_end)
        if best:
            _, index, main_end, chain_end = best
            chain = rest.pop(index)
            if chain_end == -1:
                chain = list(reversed(chain))
            main = main + chain if main_end == -1 else list(reversed(chain)) + main
            merged = True
    return main, rest


def build_line(spec):
    print(f"[{spec['id']}] {spec['name']} を取得します")
    geom = overpass(
        f"[out:json][timeout:300];rel(id:{spec['relation']});out geom;", f"rel_{spec['relation']}_geom"
    )
    relation = geom["elements"][0]

    ways, stop_refs = [], []
    for member in relation.get("members", []):
        if member["type"] == "way" and member.get("geometry"):
            ways.append([(point["lat"], point["lon"]) for point in member["geometry"]])
        elif member["type"] == "node" and member.get("role") == "stop":
            stop_refs.append({"id": member["ref"], "lat": member["lat"], "lon": member["lon"]})

    names = overpass(
        f"[out:json][timeout:120];node(id:{','.join(str(s['id']) for s in stop_refs)});out tags;",
        f"rel_{spec['relation']}_stops",
    )
    name_by_id = {e["id"]: (e.get("tags", {}).get("name") or "") for e in names["elements"]}

    main, dropped = join_nearby(chain_ways(ways))
    print(f"  線路: {len(ways)}本 → 折れ線 {len(main)}点（使わなかった枝 {len(dropped)}本）")

    # 駅を折れ線上の最寄り点へ対応づけ、進行方向に並べ直す
    stations = []
    for stop in stop_refs:
        point = (stop["lat"], stop["lon"])
        index = min(range(len(main)), key=lambda i: dist_m(point, main[i]))
        gap = dist_m(point, main[index])
        name = name_by_id.get(stop["id"], "")
        if gap > STATION_WARN_M:
            print(f"  ⚠ {name or stop['id']} が線路から {gap:.0f}m 離れています（区間の端がずれます）")
        stations.append({"name": name, "osmId": stop["id"], "lat": stop["lat"], "lon": stop["lon"],
                         "index": index, "gapM": round(gap, 1)})
    stations.sort(key=lambda s: s["index"])

    segments = []
    for left, right in zip(stations, stations[1:]):
        if right["index"] <= left["index"]:
            print(f"  ⚠ {left['name']}→{right['name']} の順序が取れません（読み飛ばします）")
            continue
        path = [[round(lat, 6), round(lon, 6)] for lat, lon in main[left["index"]:right["index"] + 1]]
        segments.append({
            "id": f"{spec['id']}:{left['name']}-{right['name']}",
            "from": left["name"],
            "to": right["name"],
            "lengthM": round(path_length_m(main[left["index"]:right["index"] + 1])),
            "path": path,
        })

    print(f"  駅 {len(stations)}・区間 {len(segments)}（{stations[0]['name']}〜{stations[-1]['name']}）")
    return {
        "id": spec["id"],
        "name": spec["name"],
        "operator": spec["operator"],
        "infoUrl": spec["infoUrl"],
        "osmRelation": spec["relation"],
        "stations": [{"name": s["name"], "lat": s["lat"], "lon": s["lon"]} for s in stations],
        "segments": segments,
    }


def main():
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "source": "OpenStreetMap contributors",
        "license": "ODbL 1.0",
        "note": "駅の位置と線路の形は OpenStreetMap 由来です。運行の可否を示すものではありません。",
        "lines": [build_line(spec) for spec in LINES],
    }
    with open(OUTPUT, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, indent=1)
    size = os.path.getsize(OUTPUT) / 1024
    print(f"書き出し: {OUTPUT}（{size:.0f}KB）")


if __name__ == "__main__":
    main()
