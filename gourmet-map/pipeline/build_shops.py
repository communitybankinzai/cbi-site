# 印西市と周辺の飲食店の一覧（osm-shops.json）を作る。情報源は2つ：
#  1) OpenStreetMap（Overpass・ODbL 1.0）。先方は無償の共有サーバーなので、取得済みの _cache/osm_raw.json があれば再取得しない
#  2) OpenPOI API（https://docs.openpoiapi.com/ ・2026-11-07 追加）。Overture Maps（CDLA-Permissive-2.0 等）と
#     食品営業許可（Japan Food Facilities・CC BY／PDL1.0）の施設。1回200件が上限なので区画を分けて取り、
#     _cache/openpoi_raw.json に貯める。出典（attributions）とライセンス（licenses）は各件に残す（保存時の条件）
# 作り直すときは _cache の該当ファイルを消してから実行する。
# 画面と JSON に「© OpenStreetMap contributors」と「OpenPOI API」（https://openpoiapi.com/attribution.html）を必ず出す。
import difflib, hashlib, io, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '_cache', 'osm_raw.json')
CACHE_POI = os.path.join(HERE, '_cache', 'openpoi_raw.json')
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
UA = 'cbi-gourmet-map/1.0 (communitybankinzai@gmail.com)'

# ---- OpenPOI API ----
POI_API = 'https://api.openpoiapi.com/v1/search'
POI_LIMIT = 200                 # 1回の上限（docs: limit は 1〜200）
POI_CELL = (0.015, 0.02)        # 区画の大きさ（緯度, 経度）≒ 1.7km × 1.8km
POI_KIND = {'restaurant': 'レストラン', 'cafe': 'カフェ', 'fast_food': 'ファストフード', 'bakery': 'パン', 'bar_izakaya': '居酒屋・バー'}
# 食品営業許可（jff）は、コンビニ・スーパー・給食施設なども「restaurant」で入るので、名前で除く
POI_EXCLUDE_HEAD = re.compile(
    r'^(セブン|ローソン|ファミリーマート|ミニストップ|デイリーヤマザキ|ニューデイズ|マルエツ|イオン(?!モール内)|ヨーカドー|イトーヨーカ|'
    r'ベルク|トライアル|ヤオコー|カスミ|ウエルシア|マツモトキヨシ|サンドラッグ|ドラッグ|西友|ロピア|業務スーパー|コストコ|ジョイフル本田|'
    r'ホームセンター|ケーヨー|カインズ|ドン・?キホーテ|ドンキ|ナリタヤ|タイヨー|オーケー|ライフ|ビッグ・?エー|まいばすけっと|コープ|生活協同組合|'
    r'ユニクロ|ニトリ|ヤマダ|ケーズ|ジャパンミート)')
POI_EXCLUDE_ANY = re.compile(r'(給食|学校|幼稚園|保育|こども園|病院|介護|デイサービス|老人|社員食堂|工場|営業所|葬祭|斎場|自動販売|宅配(?!ピザ)|'
                             r'薬局|ドラッグ|スーパー(?!.*(食堂|カフェ|レストラン))|ガソリン|給油|ゴルフ練習|福祉|事業所|保健|公民館|市役所|役場|体育館|'
                             r'^(クラブ|ラウンジ)(?!ハウス))')
CORP_RE = re.compile(r'^(株式会社|有限会社|合同会社|合資会社|一般社団法人|特定非営利活動法人|NPO法人)\s*|\s*(株式会社|有限会社|合同会社)$')
DEDUP_M = 80                    # この距離以内で名前が似ていれば同じお店とみなす


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
                    headers={'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded'})
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


def poi_query(s, w, n, e):
    url = POI_API + '?' + urllib.parse.urlencode({'bbox': '%.5f,%.5f,%.5f,%.5f' % (w, s, e, n), 'limit': POI_LIMIT})
    for attempt in (1, 2, 3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception as ex:
            print('  OpenPOI 失敗 (%d回目) %s: %s' % (attempt, url[-60:], ex))
            time.sleep(3 * attempt)
    raise SystemExit('OpenPOI API から取得できませんでした')


def fetch_openpoi():
    """区画ごとに取り、200件（上限）に達した区画は4分割して取り直す。重なりは name+lat+lng で1つにする"""
    if os.path.exists(CACHE_POI) and os.path.getsize(CACHE_POI) > 1000:
        print('取得済み:', CACHE_POI, '（再取得しません）')
        return json.load(io.open(CACHE_POI, 'r', encoding='utf-8'))
    os.makedirs(os.path.dirname(CACHE_POI), exist_ok=True)
    seen = {}
    stack = []
    s0, w0, n0, e0 = BBOX
    lat = s0
    while lat < n0:
        lon = w0
        while lon < e0:
            stack.append((lat, lon, min(lat + POI_CELL[0], n0), min(lon + POI_CELL[1], e0), 0))
            lon += POI_CELL[1]
        lat += POI_CELL[0]
    requests_made = 0
    while stack:
        s, w, n, e, depth = stack.pop()
        d = poi_query(s, w, n, e); requests_made += 1
        results = d.get('results') or []
        if len(results) >= POI_LIMIT and depth < 6:
            # 上限に当たった：4分割して取り直す（この回の結果は使わない）
            mlat, mlon = (s + n) / 2, (w + e) / 2
            stack += [(s, w, mlat, mlon, depth + 1), (s, mlon, mlat, e, depth + 1), (mlat, w, n, mlon, depth + 1), (mlat, mlon, n, e, depth + 1)]
            continue
        for x in results:
            key = '%s|%s|%.5f|%.5f' % (x.get('source'), x.get('name'), x.get('lat') or 0, x.get('lng') or 0)
            seen.setdefault(key, x)
        time.sleep(0.15)
    print('OpenPOI 取得完了: %d回の問い合わせ・%d件（重なりを除く）' % (requests_made, len(seen)))
    data = {'fetchedAt': datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds'), 'requests': requests_made, 'results': list(seen.values())}
    json.dump(data, io.open(CACHE_POI, 'w', encoding='utf-8'), ensure_ascii=False)
    return data


def address(t):
    parts = [t.get('addr:province', ''), t.get('addr:city', ''), t.get('addr:suburb', ''),
             t.get('addr:quarter', ''), t.get('addr:neighbourhood', ''), t.get('addr:block_number', ''),
             t.get('addr:housenumber', '')]
    full = t.get('addr:full', '')
    return full or ''.join(p for p in parts if p)


def norm(s):
    """名前の比較用：全角半角・大文字小文字・カタカナとひらがな・空白と記号をそろえる"""
    s = unicodedata.normalize('NFKC', s or '').lower()
    s = ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
    s = re.sub(r'[\s\-‐–—・･,.，．/／()（）\[\]「」『』&＆\'’"”]+', '', s)
    s = s.replace('ー', '')
    return s


def same_name(a, b):
    """同じお店とみなす名前か（片方が他方を含む・先頭4文字が同じ・似た文字列）"""
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    if len(a) >= 4 and len(b) >= 4 and a[:4] == b[:4]:
        return True
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.6


def dist_m(a, b):
    return ((a['lat'] - b['lat']) * 111000) ** 2 + ((a['lon'] - b['lon']) * 91000) ** 2


class Grid:
    """近くのお店を探すための升目（約110m）"""
    def __init__(self):
        self.cells = defaultdict(list)

    def key(self, lat, lon):
        return (int(lat * 1000), int(lon * 1000))

    def add(self, row):
        self.cells[self.key(row['lat'], row['lon'])].append(row)

    def near(self, row, m):
        k = self.key(row['lat'], row['lon'])
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for r in self.cells.get((k[0] + dy, k[1] + dx), ()):
                    if dist_m(r, row) <= m * m:
                        yield r


def is_japanese(s):
    return re.search(r'[ぁ-んァ-ヶ一-龥]', s or '') is not None


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
            'src': 'osm',
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
    n_osm = len(shops)

    # ---- OpenPOI API（OSM に無いお店を足す）----
    poi = fetch_openpoi()
    grid = Grid()
    for r in shops:
        r['_n'] = norm(r['name'] + ' ' + r.get('branch', ''))
        grid.add(r)
    stats = Counter()
    cand = []
    for x in poi.get('results') or []:
        cat = x.get('category') or ''
        if cat not in POI_KIND:
            stats['区分外'] += 1
            continue
        name = unicodedata.normalize('NFKC', (x.get('name') or '')).strip()
        name = re.sub(r'\s+', ' ', name)
        name = CORP_RE.sub('', name).strip() or name   # 食品営業許可は会社名で載ることがある（株式会社 ○○ベーカリー）
        lat, lon = x.get('lat'), x.get('lng')
        if not name or lat is None or lon is None:
            stats['名前・位置なし'] += 1
            continue
        if not (BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]):
            stats['範囲外'] += 1
            continue
        if POI_EXCLUDE_HEAD.search(name) or POI_EXCLUDE_ANY.search(name):
            stats['飲食店でない名前'] += 1
            continue
        src = x.get('source') or 'openpoi'
        cand.append({
            'id': 'poi:' + hashlib.sha1(('%s|%s|%.5f|%.5f' % (src, x.get('name'), lat, lon)).encode('utf-8')).hexdigest()[:12],
            'name': name, 'lat': round(lat, 6), 'lon': round(lon, 6), 'kind': POI_KIND[cat], 'src': src,
            'address': (x.get('address') or '').strip() or None,
            'website': x.get('website') if str(x.get('website') or '').startswith('http') else None,
            'lic': x.get('licenses') or [], 'attr': x.get('attributions') or [],
            '_n': norm(name),
        })
    # 日本語の名前を先に（同じお店が英語名と日本語名で来たとき、日本語名を残す）
    cand.sort(key=lambda r: (0 if is_japanese(r['name']) else 1, r['lat'], r['lon']))
    added = 0
    for r in cand:
        dup = next((o for o in grid.near(r, DEDUP_M) if same_name(o['_n'], r['_n'])), None)
        if dup:
            stats['重複（OSMか先に入れた件）'] += 1
            continue
        grid.add(r)
        shops.append(r)
        added += 1
    # ライセンス・出典の文字列は長く、何千件も同じなので参照表（番号）にする（JSON の sources.openpoi.licenses / attributions）
    lic_table, attr_table = [], []
    def idx(table, v):
        if v not in table:
            table.append(v)
        return table.index(v)
    for r in shops:
        r.pop('_n', None)
        if 'lic' in r:
            r['lic'] = [idx(lic_table, v) for v in r['lic']]
        if 'attr' in r:
            r['attr'] = [idx(attr_table, v) for v in r['attr']]
        for k in list(r):
            if r[k] is None:
                del r[k]
    shops.sort(key=lambda s: (s['lat'], s['lon']))
    # 範囲を印西市（inzai）＋周辺の市町（near）の市域に絞る（2026-11-13 事業主決定・案2）。
    # BBOX は取得のための四角形で、その中の 7市町の外（八千代・船橋・富里・鎌ケ谷など）は外す。周辺の市町は make_areas.py の NEAR
    from apply_area import tag_shops
    shops, dropped = tag_shops(shops)
    print('範囲の外として外した:', sum(dropped.values()), '件 / 市内', sum(1 for s in shops if s['area'] == 'inzai'), '件・周辺', sum(1 for s in shops if s['area'] == 'near'), '件')
    jst = timezone(timedelta(hours=9))
    out = {
        'attribution': '© OpenStreetMap contributors（ODbL 1.0）／ OpenPOI API（https://openpoiapi.com/attribution.html）: Overture Maps Foundation, overturemaps.org（CDLA-Permissive-2.0 ほか）・Japan Food Facilities（各自治体・厚生労働省のオープンデータを加工して作成）のデータを加工して作成',
        'license': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'sources': {
            'osm': {'name': 'OpenStreetMap', 'license': 'ODbL 1.0', 'url': 'https://www.openstreetmap.org/copyright', 'attribution': '© OpenStreetMap contributors'},
            'openpoi': {'name': 'OpenPOI API', 'url': 'https://docs.openpoiapi.com/', 'attributionUrl': 'https://openpoiapi.com/attribution.html',
                        'note': '各件の lic（ライセンス）と attr（出典）は下の表の番号。src は overture（Overture Maps）か jff（食品営業許可・Japan Food Facilities）',
                        'licenses': lic_table, 'attributions': attr_table,
                        'fetchedAt': poi.get('fetchedAt')},
        },
        'generatedAt': datetime.now(jst).isoformat(timespec='seconds'),
        'bbox': list(BBOX),
        'shops': shops,
    }
    io.open(OUT, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print('書き出し:', OUT, len(shops), '件（OSM %d・OpenPOI から %d 追加）' % (n_osm, added), os.path.getsize(OUT), 'bytes')
    print('OpenPOI の内訳:', dict(stats), '/ 追加の内訳:', dict(Counter(s['src'] for s in shops if s['src'] != 'osm')))
    for k, v in Counter(s['kind'] for s in shops).most_common():
        print('   ', k, v)


if __name__ == '__main__':
    main()
