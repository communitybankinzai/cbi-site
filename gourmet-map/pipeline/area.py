# 座標が印西市（inzai）・周辺の市町（near）・範囲外（None）のどれかを返す。areas.json（make_areas.py が作る）を使う
import json, os

_HERE = os.path.dirname(os.path.abspath(__file__))
_AREAS = None


def _load():
    global _AREAS
    if _AREAS is None:
        d = json.load(open(os.path.join(_HERE, "areas.json"), encoding="utf-8"))
        _AREAS = []
        for a in d["areas"]:
            xs = [x for p in a["polygons"] for x, _ in p[0]]; ys = [y for p in a["polygons"] for _, y in p[0]]
            _AREAS.append((a, (min(xs), min(ys), max(xs), max(ys))))
    return _AREAS


def _in_ring(lon, lat, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _in_area(lon, lat, polygons):
    for poly in polygons:
        if _in_ring(lon, lat, poly[0]) and not any(_in_ring(lon, lat, h) for h in poly[1:]):
            return True
    return False


def area_of(lat, lon):
    """'inzai'（印西市内）・'near'（周辺の市町）・None（範囲外）。市内を先に見る"""
    for a, (w, s, e, n) in sorted(_load(), key=lambda t: t[0]["area"] != "inzai"):
        if w <= lon <= e and s <= lat <= n and _in_area(lon, lat, a["polygons"]):
            return a["area"]
    return None


def municipality_of(lat, lon):
    for a, (w, s, e, n) in _load():
        if w <= lon <= e and s <= lat <= n and _in_area(lon, lat, a["polygons"]):
            return a["name"]
    return None
