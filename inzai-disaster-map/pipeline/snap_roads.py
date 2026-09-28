# 県の道路規制状況図から写した赤線を、近くの国道・県道（OpenStreetMap）へ吸い付ける（2026-09-28 事業主決定A）。
# 画像照合の位置合わせは数十m〜100mずれる（神尾橋付近で約80m）。規制区間は主に国道・県道なので、
# 線を細かく区切った各点を、いちばん多く重なる道路に寄せて、道路の形に沿わせる。
# 県が図を差し替えるたびに作り直されるので、手で直すより毎回自動で寄せるほうが崩れない。
#
# 道路データ：data/pref_roads_main.json.gz（trunk=国道・primary=主要地方道・secondary=一般県道、
# 分割図1/3の範囲。© OpenStreetMap contributors・ODbL）。作り直しは fetch_pref_roads.py。
import gzip
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROADS_PATH = os.path.join(HERE, "data", "pref_roads_main.json.gz")
SNAP_MAX_M = 120      # これより遠い道路には寄せない（位置合わせのずれは最大100m程度）
STEP_M = 10           # 線をこの間隔の点に区切ってから寄せる
MIN_SHARE = 0.6       # 線の点のうち、この割合以上が同じ道路の近くにあるときだけ寄せる
PREFER_M = 25         # 主に使う道路が、いちばん近い道路よりこの距離以内なら主に使う道路を選ぶ（並行する道路へ飛ばないため）
CELL = 0.004          # 格子の大きさ（度）。約400m

_cache = None


def _xy(lat, lon, lat0):
    return lon * 111320.0 * math.cos(math.radians(lat0)), lat * 110540.0


def load_roads(path=ROADS_PATH):
    global _cache
    if _cache is not None:
        return _cache
    if not os.path.exists(path):
        _cache = None
        return None
    with gzip.open(path, "rt", encoding="utf-8") as f:
        data = json.load(f)
    grid = {}
    segs = []
    for way in data["ways"]:
        key = way.get("key") or str(way.get("id"))
        pts = way["path"]
        for a, b in zip(pts, pts[1:]):
            i = len(segs)
            segs.append((a[0], a[1], b[0], b[1], key))
            for gy in range(int(min(a[0], b[0]) // CELL), int(max(a[0], b[0]) // CELL) + 1):
                for gx in range(int(min(a[1], b[1]) // CELL), int(max(a[1], b[1]) // CELL) + 1):
                    grid.setdefault((gy, gx), []).append(i)
    _cache = {"grid": grid, "segs": segs}
    return _cache


def _nearest(roads, lat, lon, key=None):
    """点に近い道路の線分（key を指定すればその道路だけ）→ (距離m, 寄せた点, key)"""
    best = None
    gy, gx = int(lat // CELL), int(lon // CELL)
    seen = set()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            for i in roads["grid"].get((gy + dy, gx + dx), ()):
                if i in seen:
                    continue
                seen.add(i)
                la1, lo1, la2, lo2, k = roads["segs"][i]
                if key is not None and k != key:
                    continue
                px, py = _xy(lat, lon, lat)
                ax, ay = _xy(la1, lo1, lat)
                bx, by = _xy(la2, lo2, lat)
                vx, vy = bx - ax, by - ay
                t = ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy) if (vx or vy) else 0.0
                t = max(0.0, min(1.0, t))
                qx, qy = ax + t * vx, ay + t * vy
                d = math.hypot(px - qx, py - qy)
                if best is None or d < best[0]:
                    best = (d, [la1 + t * (la2 - la1), lo1 + t * (lo2 - lo1)], k)
    return best


def _densify(path):
    out = [list(path[0])]
    for a, b in zip(path, path[1:]):
        ax, ay = _xy(a[0], a[1], a[0])
        bx, by = _xy(b[0], b[1], a[0])
        n = max(1, int(math.hypot(bx - ax, by - ay) // STEP_M))
        for i in range(1, n + 1):
            out.append([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n])
    return out


def _simplify(path, tol_m=4.0):
    if len(path) < 3:
        return path
    lat0 = path[0][0]
    xy = [_xy(p[0], p[1], lat0) for p in path]
    keep = [False] * len(path)
    keep[0] = keep[-1] = True
    stack = [(0, len(path) - 1)]
    while stack:
        s, e = stack.pop()
        ax, ay = xy[s]
        bx, by = xy[e]
        vx, vy = bx - ax, by - ay
        L = math.hypot(vx, vy) or 1.0
        far, idx = 0.0, None
        for i in range(s + 1, e):
            d = abs((xy[i][0] - ax) * vy - (xy[i][1] - ay) * vx) / L
            if d > far:
                far, idx = d, i
        if idx is not None and far > tol_m:
            keep[idx] = True
            stack += [(s, idx), (idx, e)]
    return [p for p, k in zip(path, keep) if k]


def snap_line(path, roads):
    """寄せた線と、寄せたかどうか・平均の移動量を返す。寄せられなければ元の線のまま"""
    pts = _densify(path)
    near = [_nearest(roads, p[0], p[1]) for p in pts]
    hits = [n for n in near if n and n[0] <= SNAP_MAX_M]
    if not hits:
        return path, {"snapped": False, "reason": "近くに国道・県道がない"}
    counts = {}
    for n in hits:
        counts[n[2]] = counts.get(n[2], 0) + 1
    main_key, main_count = max(counts.items(), key=lambda kv: kv[1])
    if main_count / len(pts) < MIN_SHARE:
        return path, {"snapped": False, "reason": f"同じ道路に重なる点が{round(100 * main_count / len(pts))}%"}
    out, moved = [], []
    for p, n in zip(pts, near):
        if not n or n[0] > SNAP_MAX_M:
            continue  # 道路から遠い点（区間の端のはみ出しなど）は捨てる
        m = _nearest(roads, p[0], p[1], key=main_key)
        pick = m if (m and m[0] <= SNAP_MAX_M and m[0] <= n[0] + PREFER_M) else n
        out.append(pick[1])
        moved.append(pick[0])
    out = _simplify(out)
    if len(out) < 2:
        return path, {"snapped": False, "reason": "寄せた後の線が短すぎる"}
    return [[round(a, 6), round(b, 6)] for a, b in out], {
        "snapped": True, "road": main_key, "meanShiftM": round(sum(moved) / len(moved)), "maxShiftM": round(max(moved)),
    }
