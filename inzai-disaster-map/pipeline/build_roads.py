# OSM道路に地形指標を割り当て、色分け用の軽量JSONを作る。
#
# 判定はあくまで「その道が通っている地形の傾向」であって、通行可否ではない。
# 排水・路面高・アンダーパスは未考慮なので、区分名も断定を避けた表現にする。
import io, json, math, os

SCR = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# 車が通る道だけ残す。歩道・階段・農道・敷地内通路は対象外。
KEEP = {
    'motorway', 'motorway_link', 'trunk', 'trunk_link',
    'primary', 'primary_link', 'secondary', 'secondary_link',
    'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street',
}

grid = json.load(io.open(SITE + r'\simulation-data\map_grid.json', encoding='utf-8'))
st = json.load(io.open(SITE + r'\simulation-data\status.json', encoding='utf-8'))
W, H = grid['width'], grid['height']
score = grid['values']['score']
(south, west), (north, east) = grid['bounds']

# 格子は Web メルカトルの等間隔。緯度は Web メルカトル Y で引かないと最大数十m ずれる。
def merc_y(lat):
    r = math.radians(lat)
    return math.log(math.tan(r) + 1.0 / math.cos(r))

Y_TOP, Y_BOT = merc_y(north), merc_y(south)

def cell_of(lat, lon):
    if not (south <= lat <= north and west <= lon <= east):
        return None
    col = int((lon - west) / (east - west) * W)
    row = int((Y_TOP - merc_y(lat)) / (Y_TOP - Y_BOT) * H)
    if col < 0 or col >= W or row < 0 or row >= H:
        return None
    return row * W + col

TH = [25, 50, 75]  # status.json の score_thresholds

def klass(lat, lon):
    i = cell_of(lat, lon)
    if i is None:
        return 4
    v = score[i]
    if v is None or not isinstance(v, (int, float)):
        return 4
    if v < TH[0]:
        return 0
    if v < TH[1]:
        return 1
    if v < TH[2]:
        return 2
    return 3

def simplify(points, tol):
    """Douglas-Peucker で、向きがほとんど変わらない点を落とす（端の2点は必ず残す）。
    範囲を広げて点が43万個になり、そのままでは道路ファイルが重くなるため入れた（2026-09-23）。"""
    if len(points) <= 2:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = points[a][1], points[a][0]
        bx, by = points[b][1], points[b][0]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i][1], points[i][0]
            d = (math.hypot(px - ax, py - ay) if den == 0
                 else abs(dy * px - dx * py + bx * ay - by * ax) / den)
            if d > best:
                best, bi = d, i
        if best > tol and bi > 0:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(points, keep) if k]


TOLERANCE_DEG = 4.0 / 111000.0  # 約4m

raw = json.load(io.open(os.path.join(SCR, 'osm_roads_raw.json'), encoding='utf-8'))
ways = [e for e in raw.get('elements', [])
        if e.get('type') == 'way' and e.get('geometry')
        and (e.get('tags') or {}).get('highway') in KEEP]
print('対象way:', len(ways))

Q = 100000  # 1e-5 度（約1.1m）に量子化

lines = []
nodes_in = 0
for w in ways:
    geo = w['geometry']
    nodes_in += len(geo)
    pts = simplify([(p['lat'], p['lon']) for p in geo], TOLERANCE_DEG)
    ks = [klass(la, lo) for la, lo in pts]
    # 区分が変わる所で線を切る（切れ目の点は両方の線に入れて隙間を作らない）
    start = 0
    for i in range(1, len(pts) + 1):
        if i == len(pts) or ks[i] != ks[start]:
            seg = pts[start:i + (1 if i < len(pts) else 0)]
            if len(seg) >= 2:
                lat0 = round(seg[0][0] * Q)
                lon0 = round(seg[0][1] * Q)
                arr = [ks[start], lat0, lon0]
                pl, pn = lat0, lon0
                for la, lo in seg[1:]:
                    cl, cn = round(la * Q), round(lo * Q)
                    if cl == pl and cn == pn:
                        continue  # 重複点は落とす
                    arr.append(cl - pl)
                    arr.append(cn - pn)
                    pl, pn = cl, cn
                if len(arr) > 3:
                    lines.append(arr)
            start = i

from collections import Counter
c = Counter(l[0] for l in lines)
print('線分:', len(lines), '/ 元ノード', nodes_in)
names = ['冠水リスク低', '注意', '冠水リスク高', '使用困難となる可能性あり', '判定保留・情報不足']
for i, n in enumerate(names):
    print('   %-24s %6d' % (n, c[i]))

out = {
    'model': st.get('metadata',{}).get('model_version','unknown'),
    'quantize': Q,
    'thresholds': TH,
    'classes': names,
    'note': '地形指標を道路に割り当てた概略・仮表示。排水能力・路面高・アンダーパスは未考慮で、通行可否ではありません。',
    'source': {
        'roads': 'OpenStreetMap contributors (ODbL 1.0)',
        'terrain': '国土地理院 標高タイル',
    },
    'lines': lines,
}
p = SITE + r'\simulation-data\road_risk.json'
io.open(p, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
import os
print('出力:', p, '%.2f MB' % (os.path.getsize(p) / 1024 / 1024))
