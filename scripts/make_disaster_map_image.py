# 災害SNS投稿用の地図画像を自動生成する。
#
# 毎回同じスクリーンショットを貼ると「何も変わっていない」ように見えるため、
# その時刻の状況（キキクルの色・雨雲・開設中の避難所）を焼き込んだ画像を都度つくる。
# 将来の自動投稿でも同じ部品を使う。
#
# 使い方: python scripts/make_disaster_map_image.py [出力パス]
# 出典表記は画像内に必ず入れる（地理院タイル・気象庁・印西市）。
import io
import json
import math
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

from PIL import Image, ImageDraw, ImageFont

JST = timezone(timedelta(hours=9))
UA = {'User-Agent': 'cbi-disaster-map-image/1.0'}

# 印西市がちょうど収まる範囲（西・南・東・北）
WEST, SOUTH, EAST, NORTH = 140.06, 35.755, 140.30, 35.895
ZOOM = 13
TILE = 256

GSI = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'
KIKIKURU = 'https://www.jma.go.jp/bosai/jmatile/data/risk/{base}/{member}/{valid}/surf/{elem}/{z}/{x}/{y}.png'
NOWCAST = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/{base}/none/{valid}/surf/hrpns/{z}/{x}/{y}.png'
SHELTERS = 'https://cidao.vercel.app/api/disaster/inzai-shelters'

# 市の公開CSV（55施設）に無いが、放送で開設が告げられる施設。座標は国土地理院の住所検索
EXTRA_SHELTERS = [
    {'name': '印旛公民館', 'address': '印西市瀬戸1518', 'latitude': 35.780167, 'longitude': 140.224731},
]


def lon2x(lon, z):
    return (lon + 180.0) / 360.0 * (2 ** z)


def lat2y(lat, z):
    r = math.radians(lat)
    return (1.0 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2.0 * (2 ** z)


def fetch(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None


def fetch_json(url):
    body = fetch(url, timeout=30)
    return json.loads(body.decode('utf-8')) if body else None


def build_layer(template, x0, x1, y0, y1, size, opacity=1.0, **kw):
    """タイルを並べて1枚の画像にする。取得できないタイルは透明のまま飛ばす。"""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            url = template.format(z=ZOOM, x=x, y=y, **kw)
            body = fetch(url)
            if not body:
                continue
            try:
                tile = Image.open(io.BytesIO(body)).convert('RGBA')
            except Exception:
                continue
            if opacity < 1.0:
                alpha = tile.getchannel('A').point(lambda v: int(v * opacity))
                tile.putalpha(alpha)
            layer.paste(tile, ((x - x0) * TILE, (y - y0) * TILE), tile)
    return layer


def jma_risk_time():
    data = fetch_json('https://www.jma.go.jp/bosai/jmatile/data/risk/targetTimes.json')
    if not data:
        return None
    latest = data[0]
    return latest.get('basetime'), latest.get('member'), latest.get('validtime')


def jma_nowcast_time():
    data = fetch_json('https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json')
    if not data:
        return None
    for item in data:
        if 'hrpns' in (item.get('elements') or []):
            return item.get('basetime'), item.get('validtime')
    return None


WARNING_URL = 'https://www.jma.go.jp/bosai/warning/data/r8/120000.json'
CITY_CODE = '1223100'
# 気象庁の警報コード→表示名（災害MAPの weatherWarningDefinitions から必要分を抜粋）
WARNING_NAMES = {
    '33': '大雨特別警報', '43': '大雨危険警報', '03': '大雨警報', '10': '大雨注意報',
    '39': '土砂災害特別警報', '49': '土砂災害危険警報', '09': '土砂災害警報', '29': '土砂災害注意報',
    '35': '暴風特別警報', '15': '暴風警報', '16': '強風注意報',
    '04': '洪水警報', '18': '洪水注意報', '14': '雷注意報', '19': '濃霧注意報', '20': '乾燥注意報',
    '05': '高潮警報', '32': '高潮特別警報', '12': '高潮注意報', '13': '波浪注意報', '02': '波浪警報',
}


def city_warnings():
    """印西市に発表中の警報・注意報の名前を返す。取れなければ (None, '')。"""
    data = fetch_json(WARNING_URL)
    if not isinstance(data, list) or not data:
        return None, ''
    latest = max(data, key=lambda e: e.get('reportDatetime') or '')
    names = []
    for item in (latest.get('warning') or {}).get('class20Items', []):
        if str(item.get('areaCode')) != CITY_CODE:
            continue
        for kind in item.get('kinds', []):
            code = str(kind.get('code') or '')
            if code:
                names.append(WARNING_NAMES.get(code, '警報等(' + code + ')'))
    when = str(latest.get('reportDatetime') or '')[11:16]
    return names, when


def kikikuru_state(base, member, valid):
    """印西市域に危険度の色が出ているかを調べる。出ていないこと自体が情報になる。"""
    labels = {(242, 231, 0): '注意', (255, 40, 0): '警戒', (170, 0, 170): '危険', (12, 12, 12): '災害切迫'}
    order = list(labels.values())
    found = {}
    z = 12
    cx, cy = int(lon2x(140.14, z)), int(lat2y(35.83, z))
    for elem, name in (('land', '土砂'), ('inund', '浸水'), ('flood', '洪水')):
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                body = fetch(KIKIKURU.format(z=z, x=cx + dx, y=cy + dy, base=base, member=member, valid=valid, elem=elem))
                if not body:
                    continue
                try:
                    img = Image.open(io.BytesIO(body)).convert('RGBA')
                except Exception:
                    continue
                for px in img.getdata():
                    if px[3] == 0:
                        continue
                    key = min(labels, key=lambda c: sum((c[i] - px[i]) ** 2 for i in range(3)))
                    if sum((key[i] - px[i]) ** 2 for i in range(3)) < 12000:
                        rank = list(labels).index(key)
                        if best is None or rank > best:
                            best = rank
        if best is not None:
            found[name] = order[best]
    return found


def jst_label(valid):
    # 気象庁の validtime は UTC（例 20260906101000）。日本時間に直さないと9時間ずれる
    try:
        utc = datetime.strptime(valid[:14], '%Y%m%d%H%M%S').replace(tzinfo=timezone.utc)
        return utc.astimezone(JST).strftime('%H:%M')
    except Exception:
        return valid[8:10] + ':' + valid[10:12]


def load_font(size, bold=False):
    for name in (['meiryob.ttc', 'YuGothB.ttc'] if bold else ['meiryo.ttc', 'YuGothM.ttc', 'msgothic.ttc']):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


def main(out_path):
    x0, x1 = int(lon2x(WEST, ZOOM)), int(lon2x(EAST, ZOOM))
    y0, y1 = int(lat2y(NORTH, ZOOM)), int(lat2y(SOUTH, ZOOM))
    size = ((x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE)

    canvas = Image.new('RGBA', size, (255, 255, 255, 255))
    canvas.alpha_composite(build_layer(GSI, x0, x1, y0, y1, size))

    notes = []
    risk = jma_risk_time()
    if risk:
        base, member, valid = risk
        for elem in ('land', 'inund', 'flood'):
            canvas.alpha_composite(build_layer(KIKIKURU, x0, x1, y0, y1, size, opacity=0.75,
                                               base=base, member=member, valid=valid, elem=elem))
        notes.append(f'キキクル {jst_label(valid)}時点')

    now = jma_nowcast_time()
    if now:
        base, valid = now
        canvas.alpha_composite(build_layer(NOWCAST, x0, x1, y0, y1, size, opacity=0.5,
                                           base=base, valid=valid))
        notes.append(f'雨雲 {jst_label(valid)}実況')

    # タイル境界のままだと隣接市まで広く写るので、指定した範囲に切り出す
    cx0 = int((lon2x(WEST, ZOOM) - x0) * TILE)
    cx1 = int((lon2x(EAST, ZOOM) - x0) * TILE)
    cy0 = int((lat2y(NORTH, ZOOM) - y0) * TILE)
    cy1 = int((lat2y(SOUTH, ZOOM) - y0) * TILE)
    canvas = canvas.crop((cx0, cy0, cx1, cy1))
    size = canvas.size
    x0 += cx0 / TILE
    y0 += cy0 / TILE

    draw = ImageDraw.Draw(canvas)

    # 開設中の避難所だけを赤で描く。閉じている施設まで描くと現地で迷う原因になる
    shelters = fetch_json(SHELTERS) or {}
    rows = list(shelters.get('shelters') or [])
    # 市の公式55施設CSVに無いが、実際に開設される施設を手当てする。
    # 2026-09-06の大雨で印旛公民館が放送で開設と読み上げられたのにCSVに無く、
    # 地図から抜け落ちた（座標は国土地理院の住所検索による）
    for extra in EXTRA_SHELTERS:
        if any((r.get('name') or '') == extra['name'] for r in rows):
            continue
        if extra['name'] in ' '.join(u.get('message', '') for u in (shelters.get('officialUpdates') or [])):
            rows.append({**extra, 'openingStatus': 'open'})
    open_names = []
    seen = set()
    for s in rows:
        if s.get('openingStatus') != 'open':
            continue
        name = s.get('name') or ''
        try:
            lat, lon = float(s['latitude']), float(s['longitude'])
        except (KeyError, TypeError, ValueError):
            continue
        px = (lon2x(lon, ZOOM) - x0) * TILE
        py = (lat2y(lat, ZOOM) - y0) * TILE
        draw.ellipse([px - 11, py - 11, px + 11, py + 11], fill=(192, 57, 43, 235), outline=(255, 255, 255), width=3)
        if name not in seen:
            seen.add(name)
            open_names.append(name)

    # 「その時点で何が起きているか」を文字で焼き込む。
    # 地図に色が出ていない時間帯は画像がほぼ同じに見え、使い回しと誤解されるため
    warn_names, warn_at = city_warnings()
    if warn_names is None:
        state_line = '警報・注意報の取得に失敗'
    elif warn_names:
        state_line = '印西市に' + '・'.join(warn_names) + '（' + warn_at + '発表）'
    else:
        state_line = '印西市に発表中の警報・注意報なし'
    kiki = kikikuru_state(*risk) if risk else {}
    kiki_line = '／'.join(k + 'キキクル ' + v for k, v in kiki.items()) if kiki else 'キキクル：印西市に危険度の色なし'

    stamp = datetime.now(JST)
    header_h, footer_h = 104, 96
    out = Image.new('RGB', (size[0], size[1] + header_h + footer_h), (255, 255, 255))
    out.paste(canvas.convert('RGB'), (0, header_h))
    d = ImageDraw.Draw(out)

    urgent = any(('警報' in n and '注意報' not in n) for n in (warn_names or []))
    d.rectangle([0, 0, size[0], header_h], fill=(140, 24, 24) if urgent else (22, 50, 79))
    d.text((20, 10), '印西市 災害状況整合MAP', font=load_font(26, True), fill=(255, 255, 255))
    d.text((20, 42), f'{stamp.year}年{stamp.month}月{stamp.day}日 {stamp.strftime("%H:%M")} 時点',
           font=load_font(17), fill=(210, 222, 236))
    d.text((20, 66), state_line, font=load_font(19, True), fill=(255, 236, 150) if warn_names else (255, 255, 255))
    d.text((20, 88), kiki_line, font=load_font(15), fill=(210, 222, 236))

    fy = header_h + size[1]
    d.rectangle([0, fy, size[0], fy + footer_h], fill=(245, 247, 250))
    small, smallb = load_font(16), load_font(16, True)
    if open_names:
        d.ellipse([20, fy + 14, 36, fy + 30], fill=(192, 57, 43), outline=(255, 255, 255), width=2)
        d.text((44, fy + 12), f'開設中の避難所 {len(open_names)}か所', font=smallb, fill=(22, 50, 79))
        # 画像の幅からはみ出すと施設名が切れて読めないので、実測しながら詰める
        names = '／'.join(open_names)
        limit = size[0] - 64
        while names and d.textlength(names + '…', font=small) > limit:
            names = names[:-1]
        d.text((44, fy + 34), names + ('…' if names != '／'.join(open_names) else ''), font=small, fill=(60, 72, 88))
    else:
        d.text((20, fy + 12), '現在、開設中の避難所はありません', font=smallb, fill=(22, 50, 79))
    d.text((20, fy + 62), '出典：国土地理院（淡色地図）／気象庁（' + '・'.join(notes or ['危険度分布']) + '）／印西市（避難所）',
           font=small, fill=(90, 102, 117))
    d.text((20, fy + 78), 'communitybankinzai.github.io/cbi-site/inzai-disaster-map/　※避難の判断は市の公式情報に従ってください',
           font=small, fill=(90, 102, 117))

    out.save(out_path, 'PNG')
    print('saved', out_path, out.size, '| 開設中', len(open_names), '|', ' '.join(notes))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'disaster_map.png')
