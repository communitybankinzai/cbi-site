# 食レポマップの「範囲」＝印西市（市内）＋周辺の市町（周辺）の市域を作る（2026-11-13 事業主決定・案2）。
#
#   ★ 周辺に含める市町は、下の NEAR の1か所だけで決める。変えるときの手順：
#      1) NEAR を書き換える（市町村コードは気象庁の「市町村等をまとめた地域等」のコード。下の URL で名前を確かめる）
#      2) python make_areas.py --cidao C:\Repos\cidao   … 3つのファイルを書き出す
#           pipeline/areas.json            … ビルド用（正確な形・小数5桁）
#           ../areas-lite.json              … 地図の画面用（約20mで間引いた軽い形）
#           <cidao>/src/lib/gourmet-areas.ts … CiDAO の登録 API 用（正確な形）
#      3) python apply_area.py              … osm-shops.json の各店に area（inzai／near）を付け、範囲外を外す
#      4) 画面の文言（index.html の「周辺（…）も見る」）を合わせ、site と cidao の両方を push
#
# 出典: 気象庁「市町村等をまとめた地域等」（AreaInformationCity_risk・2024-10-25 版）を geoshape（ROIS-DS 人文学オープンデータ共同利用センター）が GeoJSON にしたもの
#   https://geoshape.ex.nii.ac.jp/jma/resource/AreaInformationCity_risk/20241025/<コード>.geojson
# 住所の文字列ではなく座標で判定する（住所の無いお店が多いため）。
import argparse, json, math, os, urllib.request

INZAI = ("1223100", "印西市")
NEAR = [  # 周辺に含める市町（事業主が最初に決めた「印西市と周辺」）。八千代・船橋・富里・鎌ケ谷などは含めない
    ("1223200", "白井市"),
    ("1232900", "栄町"),
    ("1221700", "柏市"),
    ("1222200", "我孫子市"),
    ("1221100", "成田市"),
    ("1221200", "佐倉市"),
]
SOURCE = "https://geoshape.ex.nii.ac.jp/jma/resource/AreaInformationCity_risk/20241025/{code}.geojson"
HERE = os.path.dirname(os.path.abspath(__file__))
LITE_TOL_M = 100  # 画面用の間引き（m）。画面で判定するのは一覧の外から来る少数の店だけ。最終の判定は CiDAO（正確な形）


def fetch(code):
    req = urllib.request.Request(SOURCE.format(code=code), headers={"User-Agent": "cbi-gourmet-map/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    f = d["features"][0] if "features" in d else d
    g = f["geometry"]
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return f.get("properties", {}), [[[[round(x, 5), round(y, 5)] for x, y in ring] for ring in poly] for poly in polys]


def simplify(ring, tol_m):
    # Douglas-Peucker（緯度35.8度付近の m 換算）
    kx, ky = 111320 * math.cos(math.radians(35.8)), 110950
    pts = [(x * kx, y * ky) for x, y in ring]
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            dx, dy = bx - ax, by - ay
            seg = math.hypot(dx, dy)
            # 閉じた輪（始点＝終点）の最初の区間は線にならないので、始点からの距離で分ける
            d = abs(dy * px - dx * py + bx * ay - by * ax) / seg if seg > 0 else math.hypot(px - ax, py - ay)
            if d > best: best, idx = d, i
        if best > tol_m and idx > 0:
            keep[idx] = True; stack += [(a, idx), (idx, b)]
    out = [ring[i] for i, k in enumerate(keep) if k]
    return out if len(out) >= 4 else ring


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cidao", help="CiDAO のリポジトリ（src/lib/gourmet-areas.ts を書き出す）")
    a = ap.parse_args()
    areas = []
    for code, name in [INZAI] + NEAR:
        props, polys = fetch(code)
        assert props.get("regioncode") == code and props.get("name") == name, (code, name, props)
        areas.append({"code": code, "name": name, "area": "inzai" if code == INZAI[0] else "near", "polygons": polys})
        print(code, name, sum(len(r) for p in polys for r in p), "点")
    meta = {"source": "気象庁「市町村等をまとめた地域等」（AreaInformationCity_risk・2024-10-25）／geoshape", "sourceUrl": SOURCE,
            "note": "座標は[経度,緯度]。polygons＝多角形の配列、各多角形は[外周, 穴…]。周辺の市町は make_areas.py の NEAR で決める"}
    json.dump({**meta, "areas": areas}, open(os.path.join(HERE, "areas.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    lite = [{**x, "polygons": [[simplify(r, LITE_TOL_M) for r in p] for p in x["polygons"]]} for x in areas]
    json.dump({**meta, "simplifiedM": LITE_TOL_M, "areas": lite}, open(os.path.join(os.path.dirname(HERE), "areas-lite.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("areas.json", os.path.getsize(os.path.join(HERE, "areas.json")), "bytes / areas-lite.json", os.path.getsize(os.path.join(os.path.dirname(HERE), "areas-lite.json")), "bytes")
    if a.cidao:
        ts = os.path.join(a.cidao, "src", "lib", "gourmet-areas.ts")
        body = json.dumps([{"code": x["code"], "name": x["name"], "area": x["area"], "polygons": x["polygons"]} for x in areas], ensure_ascii=False, separators=(",", ":"))
        with open(ts, "w", encoding="utf-8", newline="\n") as f:
            f.write("// 自動生成（site/gourmet-map/pipeline/make_areas.py）。手で直さないこと。\n")
            f.write("// 食レポマップの範囲＝印西市（inzai）＋周辺の市町（near）の市域。出典: 気象庁「市町村等をまとめた地域等」（2024-10-25）／geoshape\n")
            f.write("// 座標は [経度, 緯度]。polygons は多角形の配列、各多角形は [外周, 穴…]\n")
            f.write("export type GourmetAreaKind = 'inzai' | 'near'\n")
            f.write("export const GOURMET_AREAS: { code: string; name: string; area: GourmetAreaKind; polygons: [number, number][][][] }[] = " + body + "\n")
        print("書き出し", ts, os.path.getsize(ts), "bytes")


if __name__ == "__main__":
    main()
