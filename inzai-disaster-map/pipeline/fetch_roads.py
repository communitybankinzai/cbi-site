# 解析範囲の OSM 道路を Overpass から1回だけ取得して保存する。
# 先方は無償の共有サーバーなので、取得済みファイルがあれば再取得しない。
# 2026-09-23 に範囲を近隣市まで広げ、車が通る道だけに絞った（歩道・農道・敷地内通路は対象外）。
import io, json, os, sys, time, urllib.request, urllib.error
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'osm_roads_raw.json')
# status.json の解析範囲と同じ（南,西,北,東）
BBOX = '35.64,139.98,35.93,140.40'
TYPES = ('motorway|motorway_link|trunk|trunk_link|primary|primary_link|'
         'secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street')
QUERY = '[out:json][timeout:600];way["highway"~"^(%s)$"](%s);out body geom;' % (TYPES, BBOX)
ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]

if os.path.exists(OUT) and os.path.getsize(OUT) > 1000:
    print('取得済み:', OUT, os.path.getsize(OUT), 'bytes（再取得しません）')
else:
    body = None
    for ep in ENDPOINTS:
        for attempt in (1, 2):
            t0 = time.time()
            try:
                req = urllib.request.Request(
                    ep, data=('data=' + QUERY).encode('utf-8'),
                    headers={'User-Agent': 'cbi-inzai-pluvial-map/2.1 (communitybankinzai@gmail.com)',
                             'Content-Type': 'application/x-www-form-urlencoded'})
                with urllib.request.urlopen(req, timeout=900) as r:
                    body = r.read()
                print('取得完了 %s %.1f秒 %d bytes' % (ep, time.time() - t0, len(body)))
                break
            except Exception as e:
                print('失敗 %s (%d回目) %.0f秒: %s' % (ep, attempt, time.time() - t0, e))
                time.sleep(20)
        if body:
            break
    if not body:
        print('すべての Overpass で取得できませんでした')
        sys.exit(1)
    io.open(OUT, 'wb').write(body)

d = json.load(io.open(OUT, encoding='utf-8'))
ways = [e for e in d.get('elements', []) if e.get('type') == 'way' and e.get('geometry')]
print('way数:', len(ways), '/ ノード数:', sum(len(w['geometry']) for w in ways))
for k, v in Counter((w.get('tags') or {}).get('highway') for w in ways).most_common(20):
    print('   ', k, v)
