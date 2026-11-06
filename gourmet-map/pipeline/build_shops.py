# 印西市と周辺の飲食店を OpenStreetMap（Overpass）から1回だけ取得し、地図用の osm-shops.json を作る。
# 先方は無償の共有サーバーなので、取得済みの _cache/osm_raw.json があれば再取得しない（作り直すときは消してから実行）。
# データは ODbL 1.0。画面と JSON に「© OpenStreetMap contributors」を必ず出す。
import io, json, os, sys, time, urllib.request
from collections import Counter
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '_cache', 'osm_raw.json')
OUT = os.path.join(os.path.dirname(HERE), 'osm-shops.json')
# 印西市と周辺（白井・栄町・佐倉北部・成田西部・我孫子南部・柏東部）（南,西,北,東）
BBOX = (35.70, 140.02, 35.90, 140.32)
AMENITY = 'restaurant|cafe|fast_food|bar|pub|izakaya|ice_cream|food_court|biergarten'
SHOP = 'bakery|confectionery|pastry'
QUERY = ('[out:json][timeout:180];('
         'nwr["amenity"~"^(%s)$"](%s);'
         'nwr["shop"~"^(%s)$"](%s);'
         ');out center tags;') % (AMENITY, '%s,%s,%s,%s' % BBOX, SHOP, '%s,%s,%s,%s' % BBOX)
ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]
KIND = {
    'restaurant': 'レストラン', 'cafe': 'カフェ', 'fast_food': 'ファストフード', 'bar': 'バー',
    'pub': '居酒屋・パブ', 'izakaya': '居酒屋', 'ice_cream': 'アイス', 'food_court': 'フードコート',
    'biergarten': 'ビアガーデン', 'bakery': 'パン', 'confectionery': '菓子', 'pastry': '洋菓子',
}


def fetch():
    if os.path.exists(CACHE) and os.path.getsize(CACHE) > 1000:
        print('取得済み:', CACHE, '（再取得しません）')
        return io.open(CACHE, 'rb').read()
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    for ep in ENDPOINTS:
        for attempt in (1, 2):
            t0 = time.time()
            try:
                req = urllib.request.Request(
                    ep, data=('data=' + QUERY).encode('utf-8'),
                    headers={'User-Agent': 'cbi-gourmet-map/1.0 (communitybankinzai@gmail.com)',
                             'Content-Type': 'application/x-www-form-urlencoded'})
                with urllib.request.urlopen(req, timeout=300) as r:
                    body = r.read()
                json.loads(body)
                print('取得完了 %s %.1f秒 %d bytes' % (ep, time.time() - t0, len(body)))
                io.open(CACHE, 'wb').write(body)
                return body
            except Exception as e:
                print('失敗 %s (%d回目) %.0f秒: %s' % (ep, attempt, time.time() - t0, e))
                time.sleep(15)
    print('すべての Overpass で取得できませんでした')
    sys.exit(1)


def address(t):
    parts = [t.get('addr:province', ''), t.get('addr:city', ''), t.get('addr:suburb', ''),
             t.get('addr:quarter', ''), t.get('addr:neighbourhood', ''), t.get('addr:block_number', ''),
             t.get('addr:housenumber', '')]
    full = t.get('addr:full', '')
    return full or ''.join(p for p in parts if p)


def main():
    data = json.loads(fetch())
    shops = []
    for e in data.get('elements', []):
        t = e.get('tags') or {}
        name = (t.get('name:ja') or t.get('name') or '').strip()
        if not name:
            continue  # 名前の無い店は探せないので載せない
        lat = e.get('lat', (e.get('center') or {}).get('lat'))
        lon = e.get('lon', (e.get('center') or {}).get('lon'))
        if lat is None or lon is None:
            continue
        kind = t.get('amenity') or t.get('shop') or ''
        row = {
            'id': 'osm:%s%d' % (e['type'][0], e['id']),
            'name': name,
            'lat': round(lat, 6),
            'lon': round(lon, 6),
            'kind': KIND.get(kind, kind),
        }
        if t.get('branch'):
            row['branch'] = t['branch']
        if t.get('name:en') and t.get('name:en') != name:
            row['nameEn'] = t['name:en']
        if t.get('cuisine'):
            row['cuisine'] = t['cuisine']
        a = address(t)
        if a:
            row['address'] = a
        for k in ('website', 'contact:website'):
            if t.get(k, '').startswith('http'):
                row['website'] = t[k]
                break
        shops.append(row)
    shops.sort(key=lambda s: (s['lat'], s['lon']))
    jst = timezone(timedelta(hours=9))
    out = {
        'attribution': '© OpenStreetMap contributors（ODbL 1.0）',
        'license': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'generatedAt': datetime.now(jst).isoformat(timespec='seconds'),
        'bbox': list(BBOX),
        'shops': shops,
    }
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('書き出し:', OUT, len(shops), '件', os.path.getsize(OUT), 'bytes')
    for k, v in Counter(s['kind'] for s in shops).most_common():
        print('   ', k, v)


if __name__ == '__main__':
    main()
