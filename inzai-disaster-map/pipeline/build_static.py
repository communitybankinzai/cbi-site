"""印西市 内水リスク推定（地形モデル）の格子データを作る。

もとの生成スクリプトは外部環境にあり回収できなかったため、
公開データから逆算した仕様（合成式・重み・スケール・しきい値）に基づいて書き直したもの。
逆算と検証の経緯は ../simulation-spec.html を参照。

■ 前の版（topo-0.1.0）からの主な変更
  1. 面積と距離を「真の地上値」に直した。
     前の版は Web メルカトルの100mをそのまま地上100mとして扱っていたため、
     集水面積が約1.52倍に過大、傾斜が約19%過小だった。
     格子そのものは Web メルカトルのまま（表示側の重ね位置を変えないため）で、
     面積・距離の計算時にだけ緯度ごとの縮尺係数 cos(φ) を掛ける。
  2. 標高タイルをズーム13（約15.5m画素）で取り、1セルに入る画素の平均を採る。
     前の版はズーム12（約31m画素）だった。
  3. 相対標高の近傍を「半径3セルの円形」と明示した（前の版の定義は復元できなかった）。

■ 使い方
    python build_static.py [--out ../simulation-data] [--zoom 13] [--cache ./_demcache]
    タイルはキャッシュするので、2回目以降は地理院サーバーへ取りに行かない。

出典：国土地理院 標高タイル（https://maps.gsi.go.jp/development/ichiran.html）
"""

import argparse
import hashlib
import heapq
import io
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

import numpy as np
from PIL import Image

# ── 解析範囲と格子（前の版と同一にして差し替え可能にする） ─────────────
WEST = 140.06778170298216
SOUTH = 35.71790967909823
EAST = 140.322004928388
NORTH = 35.911678605516755
GRID_W = 283
GRID_H = 266
CELL_MERCATOR_M = 100.0  # Web メルカトル上の1セル（地上寸法ではない）

# ── 合成のパラメータ（逆算で確定。根拠のない仮設定である点は変わらない） ──
WEIGHTS = {"relative": 0.25, "depression": 0.35, "accumulation": 0.25, "flatness": 0.15}
SCALES = {"relative_m": 5.0, "depression_m": 2.0, "accumulation_m2": 1_000_000.0, "slope_degrees": 10.0}
SCORE_THRESHOLDS = [25, 50, 75]
RELATIVE_RADIUS_CELLS = 3  # 相対標高を測る近傍（円形）

MODEL_VERSION = "topo-0.2.0"
DEM_PRIORITY = ["dem1a_png", "dem5a_png", "dem5b_png", "dem5c_png", "dem_png"]
DEM_URL = "https://cyberjapandata.gsi.go.jp/xyz/{name}/{z}/{x}/{y}.png"
USER_AGENT = "cbi-inzai-pluvial-map/2.0 (communitybankinzai@gmail.com)"
EARTH_R = 6378137.0

# ── 座標変換（Web メルカトル） ──────────────────────────────────


def merc_x(lon):
    return math.radians(lon) * EARTH_R


def merc_y(lat):
    return EARTH_R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def inv_merc_y(y):
    return math.degrees(2 * math.atan(math.exp(y / EARTH_R)) - math.pi / 2)


def inv_merc_x(x):
    return math.degrees(x / EARTH_R)


# ── 標高タイル ────────────────────────────────────────────────


def fetch_tile(name, z, x, y, cache_dir, sources):
    """1枚の標高タイルを取り、標高の配列（欠測は NaN）で返す。取れなければ None。"""
    key = "%s_%d_%d_%d.png" % (name, z, x, y)
    path = os.path.join(cache_dir, key)
    url = DEM_URL.format(name=name, z=z, x=x, y=y)
    body = None
    if os.path.exists(path):
        body = open(path, "rb").read()
    else:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # そのタイル種別には無い（想定内）
            raise
        except Exception:
            return None
        open(path, "wb").write(body)
        time.sleep(0.1)  # 公共サーバーなので間隔を空ける

    try:
        img = np.asarray(Image.open(io.BytesIO(body)).convert("RGB"), dtype=np.int64)
    except Exception:
        return None
    v = img[:, :, 0] * 65536 + img[:, :, 1] * 256 + img[:, :, 2]
    h = np.where(v < 8388608, v * 0.01, (v - 16777216) * 0.01)
    h = np.where(v == 8388608, np.nan, h)  # 無効値
    used = int(np.count_nonzero(~np.isnan(h)))
    if used == 0:
        return None
    sources.append({
        "source_name": name,
        "source_url": url,
        "download_date": datetime.now(timezone.utc).isoformat(),
        "license": "国土地理院コンテンツ利用規約",
        "resolution": {"tile_zoom": z},
        "coordinate_reference_system": "EPSG:3857",
        "processed": True,
        "processing_script": "pipeline/build_static.py",
        "checksum": hashlib.sha256(body).hexdigest(),
        "used_pixels": used,
    })
    return h


def build_elevation(zoom, cache_dir, sources):
    """格子の各セルに、そのセルへ入る標高タイル画素の平均を入れる。"""
    os.makedirs(cache_dir, exist_ok=True)
    x0m, y0m = merc_x(WEST), merc_y(NORTH)

    # セルの中心のメルカトル座標
    cx = x0m + (np.arange(GRID_W) + 0.5) * CELL_MERCATOR_M
    cy = y0m - (np.arange(GRID_H) + 0.5) * CELL_MERCATOR_M

    # タイル座標系（1タイル256画素）での位置
    world = 256 * (2 ** zoom)
    half = EARTH_R * math.pi
    px = (cx + half) / (2 * half) * world
    py = (half - cy) / (2 * half) * world
    tx0, tx1 = int(px.min()) // 256, int(px.max()) // 256
    ty0, ty1 = int(py.min()) // 256, int(py.max()) // 256
    print("  タイル範囲 x %d〜%d / y %d〜%d（%d枚）"
          % (tx0, tx1, ty0, ty1, (tx1 - tx0 + 1) * (ty1 - ty0 + 1)))

    # 必要なタイルを1枚のモザイクにする
    mw = (tx1 - tx0 + 1) * 256
    mh = (ty1 - ty0 + 1) * 256
    mosaic = np.full((mh, mw), np.nan)
    got = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            for name in DEM_PRIORITY:
                tile = fetch_tile(name, zoom, tx, ty, cache_dir, sources)
                if tile is None:
                    continue
                dst = mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256,
                             (tx - tx0) * 256:(tx - tx0 + 1) * 256]
                np.copyto(dst, tile, where=np.isnan(dst) & ~np.isnan(tile))
                got += 1
                if not np.isnan(dst).any():
                    break  # そのタイルは埋まったので次の種別は要らない
    print("  取得タイル %d 枚 / モザイクの有効画素 %.1f%%"
          % (got, 100.0 * np.count_nonzero(~np.isnan(mosaic)) / mosaic.size))

    # 各セルに入る画素を平均する（画素の方が細かいので単純平均でよい）
    col = np.clip((px - tx0 * 256).astype(int), 0, mw - 1)
    row = np.clip((py - ty0 * 256).astype(int), 0, mh - 1)
    # セル境界の画素範囲
    edge_x = (x0m + np.arange(GRID_W + 1) * CELL_MERCATOR_M + half) / (2 * half) * world - tx0 * 256
    edge_y = (half - (y0m - np.arange(GRID_H + 1) * CELL_MERCATOR_M)) / (2 * half) * world - ty0 * 256

    elev = np.full((GRID_H, GRID_W), np.nan)
    for r in range(GRID_H):
        r0, r1 = int(math.floor(edge_y[r])), max(int(math.ceil(edge_y[r + 1])), int(math.floor(edge_y[r])) + 1)
        r0, r1 = max(0, r0), min(mh, r1)
        if r1 <= r0:
            continue
        band = mosaic[r0:r1, :]
        for c in range(GRID_W):
            c0, c1 = int(math.floor(edge_x[c])), max(int(math.ceil(edge_x[c + 1])), int(math.floor(edge_x[c])) + 1)
            c0, c1 = max(0, c0), min(mw, c1)
            if c1 <= c0:
                continue
            block = band[:, c0:c1]
            if np.isnan(block).all():
                continue
            elev[r, c] = float(np.nanmean(block))
    return elev


# ── 地形解析 ──────────────────────────────────────────────────

NEIGHBORS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def priority_flood(elev, epsilon=1e-5):
    """窪地を埋める（Priority-Flood）。(埋めた標高, 流下計算用の標高) を返す。

    縁と欠測に接するセルから、低い順に内側へ広げる。
    水がどこにも抜けない窪みは、抜け口の高さまで持ち上がる。

    ただし単純に埋めると窪地の跡が「完全に平坦」になり、D8 が下流を1つも
    選べず流れが止まってしまう（実際にそれで集水面積が47分の1になった）。
    そこで Barnes ほかの ε 版にならい、流下計算用には内側へ進むごとに
    ごく小さな高さ（既定 1e-5 m）を足した配列も同時に作る。
    1,000セル進んでも 0.01 m なので、地形の判断には影響しない。
    窪地の深さは ε を足さない方（plain）から求める。
    """
    h, w = elev.shape
    plain = np.where(np.isnan(elev), np.nan, elev).astype(float)
    route = plain.copy()
    closed = np.isnan(elev)
    seen = closed.copy()
    heap = []
    for y in range(h):
        for x in range(w):
            if closed[y, x]:
                continue
            edge = y == 0 or y == h - 1 or x == 0 or x == w - 1
            if not edge:
                for dy, dx in NEIGHBORS:
                    if closed[y + dy, x + dx]:
                        edge = True
                        break
            if edge:
                heapq.heappush(heap, (route[y, x], plain[y, x], y, x))
                seen[y, x] = True
    while heap:
        zr, zp, y, x = heapq.heappop(heap)
        for dy, dx in NEIGHBORS:
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= h or nx < 0 or nx >= w or seen[ny, nx]:
                continue
            seen[ny, nx] = True
            if plain[ny, nx] < zp:
                plain[ny, nx] = zp          # 抜け口の高さまで持ち上げる
            if route[ny, nx] <= zr:
                route[ny, nx] = zr + epsilon  # 平坦にせず、わずかに上流を高くする
            heapq.heappush(heap, (route[ny, nx], plain[ny, nx], ny, nx))
    return plain, route


def d8_accumulation(filled, cell_area_m2):
    """D8（8方向の最急降下1方向）で流向を決め、上流の面積を積算する。"""
    h, w = filled.shape
    valid = ~np.isnan(filled)
    target = np.full((h, w), -1, dtype=np.int64)
    for y in range(h):
        for x in range(w):
            if not valid[y, x]:
                continue
            z = filled[y, x]
            best, bi = 0.0, -1
            for dy, dx in NEIGHBORS:
                ny, nx = y + dy, x + dx
                if ny < 0 or ny >= h or nx < 0 or nx >= w or not valid[ny, nx]:
                    continue
                drop = (z - filled[ny, nx]) / math.hypot(dy, dx)
                if drop > best:
                    best, bi = drop, ny * w + nx
            target[y, x] = bi

    # 上流から順に流す（埋めた標高の高い順）
    acc = np.where(valid, cell_area_m2, np.nan)
    order = np.argsort(np.where(valid, -filled, np.inf), axis=None)
    flat_acc = acc.reshape(-1)
    flat_tgt = target.reshape(-1)
    for idx in order:
        if not valid.reshape(-1)[idx]:
            break
        t = flat_tgt[idx]
        if t >= 0:
            flat_acc[t] += flat_acc[idx]
    return flat_acc.reshape(h, w)


def circular_mean(a, radius):
    """半径 radius セルの円形近傍の平均（欠測は無視）。"""
    h, w = a.shape
    offs = [(dy, dx) for dy in range(-radius, radius + 1)
            for dx in range(-radius, radius + 1) if dy * dy + dx * dx <= radius * radius]
    total = np.zeros((h, w))
    count = np.zeros((h, w))
    v = np.nan_to_num(a, nan=0.0)
    m = (~np.isnan(a)).astype(float)
    for dy, dx in offs:
        ys0, ys1 = max(0, -dy), h - max(0, dy)
        xs0, xs1 = max(0, -dx), w - max(0, dx)
        total[ys0:ys1, xs0:xs1] += v[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
        count[ys0:ys1, xs0:xs1] += m[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    out = np.where(count > 0, total / np.maximum(count, 1e-9), np.nan)
    return np.where(np.isnan(a), np.nan, out)


def horn_slope(elev, spacing_m):
    """Horn 法（3x3）の傾斜（度）。spacing_m は行ごとの地上セル寸法。"""
    z = np.pad(elev, 1, mode="edge")
    dzdx = ((z[:-2, 2:] + 2 * z[1:-1, 2:] + z[2:, 2:])
            - (z[:-2, :-2] + 2 * z[1:-1, :-2] + z[2:, :-2])) / (8 * spacing_m)
    dzdy = ((z[2:, :-2] + 2 * z[2:, 1:-1] + z[2:, 2:])
            - (z[:-2, :-2] + 2 * z[:-2, 1:-1] + z[:-2, 2:])) / (8 * spacing_m)
    return np.degrees(np.arctan(np.sqrt(dzdx ** 2 + dzdy ** 2)))


def clip01(x):
    return np.clip(x, 0.0, 1.0)


# ── 出力 ──────────────────────────────────────────────────────


def to_list(a, digits):
    """NaN を None にして、桁を丸めた一次元配列にする。"""
    flat = a.reshape(-1)
    return [None if math.isnan(v) else round(float(v), digits) for v in flat]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "simulation-data"))
    ap.add_argument("--zoom", type=int, default=13)
    ap.add_argument("--cache", default=os.path.join(os.path.dirname(__file__), "_demcache"))
    args = ap.parse_args()
    out_dir = os.path.abspath(args.out)

    print("1) 標高タイルを取得して %dx%d の格子にします（ズーム%d）"
          % (GRID_W, GRID_H, args.zoom))
    sources = []
    elev = build_elevation(args.zoom, os.path.abspath(args.cache), sources)
    valid = ~np.isnan(elev)
    print("   有効セル %d / %d" % (valid.sum(), GRID_W * GRID_H))
    if valid.sum() == 0:
        print("標高が1セルも取れませんでした。通信とタイル種別を確認してください。")
        return 1

    # 緯度ごとの地上セル寸法。Web メルカトルは cos(φ) 倍すると地上距離になる。
    y0m = merc_y(NORTH)
    lat_center = np.array([inv_merc_y(y0m - (r + 0.5) * CELL_MERCATOR_M) for r in range(GRID_H)])
    ground_cell_m = CELL_MERCATOR_M * np.cos(np.radians(lat_center))  # 行ごと
    spacing = ground_cell_m.reshape(-1, 1)
    cell_area = (ground_cell_m ** 2).reshape(-1, 1)
    print("   地上セル寸法 %.2f〜%.2f m / 面積 %.0f〜%.0f 平方m"
          % (ground_cell_m.min(), ground_cell_m.max(), cell_area.min(), cell_area.max()))

    print("2) 窪地を埋めます（Priority-Flood + ε）")
    filled, routing = priority_flood(elev)
    depression = np.where(valid, filled - elev, np.nan)

    print("3) 流向と集水面積を求めます（D8・平坦部は ε 勾配で解消）")
    # 行ごとに面積が違うので、平均面積で積算してから行の違いを補正するのではなく、
    # セルごとの面積をそのまま初期値にして積算する
    acc = d8_accumulation(routing, np.broadcast_to(cell_area, elev.shape).copy())

    print("4) 相対標高と傾斜を求めます")
    relative = np.where(valid, elev - circular_mean(elev, RELATIVE_RADIUS_CELLS), np.nan)
    slope = np.where(valid, horn_slope(np.nan_to_num(elev, nan=0.0), spacing), np.nan)

    print("5) 合成します")
    score = 100.0 * (
        WEIGHTS["relative"] * clip01(-relative / SCALES["relative_m"])
        + WEIGHTS["depression"] * clip01(depression / SCALES["depression_m"])
        + WEIGHTS["accumulation"] * clip01(
            np.log10(np.maximum(1.0, acc)) / math.log10(SCALES["accumulation_m2"]))
        + WEIGHTS["flatness"] * clip01(1.0 - slope / SCALES["slope_degrees"])
    )
    score = np.where(valid, score, np.nan)
    print("   score %.1f 〜 %.1f（平均 %.1f）"
          % (np.nanmin(score), np.nanmax(score), np.nanmean(score)))

    os.makedirs(out_dir, exist_ok=True)
    grid = {
        "width": GRID_W,
        "height": GRID_H,
        "transform": [CELL_MERCATOR_M, merc_x(WEST), -CELL_MERCATOR_M, merc_y(NORTH)],
        "bounds": [[SOUTH, WEST], [NORTH, EAST]],
        "values": {
            "score": to_list(score, 2),
            "elevation": to_list(elev, 2),
            "slope": to_list(slope, 3),
            "depression_depth": to_list(depression, 3),
            "flow_accumulation_m2": to_list(acc, 0),
            "relative_elevation": to_list(relative, 3),
        },
    }
    p = os.path.join(out_dir, "map_grid.json")
    io.open(p, "w", encoding="utf-8").write(json.dumps(grid, ensure_ascii=False, separators=(",", ":")))
    print("   書き出し %s（%.2f MB）" % (p, os.path.getsize(p) / 1024 / 1024))

    status = {
        "phase": "Phase 1 実装検証中",
        "mode": "静的地形リスク",
        "area": {
            "municipality": {"name": "印西市", "prefecture": "千葉県"},
            "bounding_box": {"north": NORTH, "south": SOUTH, "east": EAST, "west": WEST},
            "boundary_status": "rectangular_extent_not_administrative_boundary",
            "processing_crs": "EPSG:3857",
            "cell_size_mercator_m": CELL_MERCATOR_M,
            "cell_size_ground_m": [round(float(ground_cell_m.min()), 2), round(float(ground_cell_m.max()), 2)],
            "crs_note": (
                "格子は Web メルカトル（EPSG:3857）で、1セルはメルカトル上の100m。"
                "面積・距離・傾斜は行ごとの縮尺係数 cos(φ) を掛けて地上値に直して計算している。"
                "前の版（topo-0.1.0）はこの補正が無く、集水面積が約1.52倍過大・傾斜が約19%過小だった。"
            ),
            "dem_zoom": args.zoom,
            "dem_priority": DEM_PRIORITY,
            "map_center": [(SOUTH + NORTH) / 2, (WEST + EAST) / 2],
            "hazard_reference": {
                "source": "https://www.city.inzai.lg.jp/bousaiportal/0000008837.html",
                "availability": "reference_link_only",
                "processing_method": "公式PDFへの参照のみ。区域GISは未取得。",
            },
        },
        "metadata": {
            "model_version": MODEL_VERSION,
            "parameters": {
                "model_version": MODEL_VERSION,
                "calibration_status": "仮設定・未校正",
                "weights": WEIGHTS,
                "scales": SCALES,
                "relative_neighborhood": {"shape": "circle", "radius_cells": RELATIVE_RADIUS_CELLS},
                "slope_method": "Horn 3x3（地上セル寸法で除算）",
                "depression_method": "Priority-Flood（流下計算はε版で平坦部を解消）",
                "flow_method": "D8",
                "score_thresholds": SCORE_THRESHOLDS,
                "road_impassable_threshold": "UNVERIFIED",
                "drainage": {"mode": "unknown"},
            },
            "assumptions": [
                "100m格子（メルカトル）。地上では約81m。小規模な窪地・道路幅の判定には不十分",
                "地形のみ・仮設定・未校正",
                "市境ではなく周辺を含む矩形範囲",
                "解析境界外からの流入を考慮しない",
                "雨水管・河川氾濫・実雨量は未考慮",
                "リアルタイムXRAIN接続未実装",
                "相対標高の近傍半径3セル（約240m）は本実装で決めた値で、前の版の定義は復元できていない",
            ],
        },
        "cell_count": int(valid.sum()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": "pipeline/build_static.py",
    }
    p = os.path.join(out_dir, "status.json")
    io.open(p, "w", encoding="utf-8").write(json.dumps(status, ensure_ascii=False, separators=(",", ":")))
    print("   書き出し %s" % p)

    p = os.path.join(out_dir, "sources.json")
    io.open(p, "w", encoding="utf-8").write(json.dumps(sources, ensure_ascii=False, separators=(",", ":")))
    print("   書き出し %s（%d件）" % (p, len(sources)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
