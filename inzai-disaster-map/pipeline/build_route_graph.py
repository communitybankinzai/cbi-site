# 道順チェック（route-check.js）用の道路網を作る（2026-11-27）。
#
# ⚠ simulation-data/road_risk.json は色分け用で、道ごとに Douglas-Peucker で点を間引いている。
#   そのとき「別の道が途中でつながる点（交差点）」も落ちるため、道路網としては 22,072 個に切れていた
#   （いちばん大きなかたまりでも点の46%）。道順には使えないので、元の OSM（交差点の node id を持つ）から作り直す。
#
# 中身：交差点と道の端だけを「点」にし、点と点の間を「区間」にする。区間の形は 4m の間引き（線を描く・避ける線との照合に使う）。
#       一方通行（oneway=yes/1/true/-1、motorway、roundabout）は区間の向きとして持つ。
# 入力：pipeline/osm_roads_raw.json（fetch_roads.py が取った OSM・git 管理外・45MB）
# 出力：simulation-data/route_graph.json
#
#   python pipeline/build_route_graph.py [入力の osm_roads_raw.json]
import io, json, math, os, sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'osm_roads_raw.json')
OUT = os.path.join(SITE, 'simulation-data', 'route_graph.json')

KEEP = {
    'motorway', 'motorway_link', 'trunk', 'trunk_link',
    'primary', 'primary_link', 'secondary', 'secondary_link',
    'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street',
}
Q = 100000
TOL_DEG = 4.0 / 111000.0


def simplify(points, tol):
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
            d = math.hypot(px - ax, py - ay) if den == 0 else abs(dy * px - dx * py + bx * ay - by * ax) / den
            if d > best:
                best, bi = d, i
        if best > tol and bi > 0:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(points, keep) if k]


def oneway_of(tags):
    v = str(tags.get('oneway', '')).lower()
    if v in ('yes', 'true', '1'):
        return 1
    if v == '-1':
        return -1
    if v == 'no':
        return 0
    if tags.get('highway') in ('motorway', 'motorway_link') or tags.get('junction') in ('roundabout', 'circular'):
        return 1
    return 0


raw = json.load(io.open(SRC, encoding='utf-8'))
ways = [e for e in raw.get('elements', [])
        if e.get('type') == 'way' and e.get('geometry') and e.get('nodes')
        and len(e['nodes']) == len(e['geometry'])
        and (e.get('tags') or {}).get('highway') in KEEP]
print('対象 way:', len(ways))

use = Counter()
for w in ways:
    for nid in w['nodes']:
        use[nid] += 1
    use[w['nodes'][0]] += 1   # 端は必ず点にする
    use[w['nodes'][-1]] += 1

node_index, node_q = {}, []
def node(nid, lat, lon):
    i = node_index.get(nid)
    if i is None:
        i = len(node_q)
        node_index[nid] = i
        node_q.append((round(lat * Q), round(lon * Q)))
    return i

edges = []
for w in ways:
    ow = oneway_of(w.get('tags') or {})
    ids, geo = w['nodes'], w['geometry']
    start = 0
    for i in range(1, len(ids)):
        if use[ids[i]] >= 2 or i == len(ids) - 1:
            pts = [(geo[k]['lat'], geo[k]['lon']) for k in range(start, i + 1)]
            shape = simplify(pts, TOL_DEG)
            a = node(ids[start], *pts[0])
            b = node(ids[i], *pts[-1])
            if a != b or len(shape) > 2:
                arr = [a, b, ow]
                pl, pn = node_q[a]
                for la, lo in shape[1:-1]:
                    cl, cn = round(la * Q), round(lo * Q)
                    arr += [cl - pl, cn - pn]
                    pl, pn = cl, cn
                edges.append(arr)
            start = i

# 点の座標は差分で詰める
flat, pl, pn = [], 0, 0
for la, lo in node_q:
    flat += [la - pl, lo - pn]
    pl, pn = la, lo

# つながりの確認（向きは見ない）
parent = list(range(len(node_q)))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
for e in edges:
    ra, rb = find(e[0]), find(e[1])
    if ra != rb:
        parent[ra] = rb
comp = Counter(find(i) for i in range(len(node_q)))
largest = comp.most_common(1)[0][1]
print('点:', len(node_q), '区間:', len(edges), 'かたまり:', len(comp), 'いちばん大きなかたまり:', largest, f'({largest / len(node_q):.1%})')
print('一方通行の区間:', sum(1 for e in edges if e[2] != 0))

out = {
    'note': '道順チェック用の道路網（交差点と道の端が点・その間が区間）。車が通る道のみ。一方通行は区間の向き（1＝点a→bだけ、-1＝b→aだけ）。',
    'source': 'OpenStreetMap contributors (ODbL 1.0)',
    'quantize': Q,
    'nodes': flat,
    'edges': edges,
}
with io.open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('書き出し:', OUT, os.path.getsize(OUT), 'bytes')
