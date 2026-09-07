# 印西市周辺のOSM道路を Overpass から1回だけ取得して保存する。
# 先方は無償の共有サーバーなので、取得済みファイルがあれば再取得しない。
import io, json, os, time, urllib.request, urllib.error

OUT = r'C:\Users\NSFACT~1\AppData\Local\Temp\claude\C--Users-nsfactory-OneDrive-CBI\5bdcc53d-43c1-46ff-96e0-7b8c71bfd341\scratchpad\osm_roads_raw.json'
# status.json の解析範囲と同じ（南,西,北,東）
QUERY = '[out:json][timeout:180];way["highway"](35.72,140.07,35.91,140.32);out body geom;'
ENDPOINT = 'https://overpass-api.de/api/interpreter'

if os.path.exists(OUT) and os.path.getsize(OUT) > 1000:
    print('取得済み:', OUT, os.path.getsize(OUT), 'bytes（再取得しません）')
else:
    req = urllib.request.Request(
        ENDPOINT,
        data=('data=' + urllib.parse.quote(QUERY)).encode() if False else ('data=' + QUERY).encode('utf-8'),
        headers={'User-Agent': 'cbi-inzai-pluvial-map/1.0 (communitybankinzai@gmail.com)',
                 'Content-Type': 'application/x-www-form-urlencoded'},
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
    except urllib.error.HTTPError as e:
        print('HTTPError', e.code, e.read()[:300].decode('utf-8', 'replace'))
        raise SystemExit(1)
    io.open(OUT, 'wb').write(body)
    print('取得完了 %.1f秒 / %d bytes' % (time.time() - t0, len(body)))

d = json.load(io.open(OUT, encoding='utf-8'))
ways = [e for e in d.get('elements', []) if e.get('type') == 'way' and e.get('geometry')]
print('way数:', len(ways))
from collections import Counter
c = Counter((w.get('tags') or {}).get('highway') for w in ways)
for k, v in c.most_common(20):
    print('   ', k, v)
print('総ノード数:', sum(len(w['geometry']) for w in ways))
