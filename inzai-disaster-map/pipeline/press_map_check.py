"""県の復旧見込みPDFの位置図（分割図1/3〜3/3）を読み、区間カードの結果（press_cards.py）と突き合わせる。あわせて区間の位置を印で精密にする。

位置図：赤線＝規制中の道路、青線＝規制解除後（被災区間のみ）。規制中の区間には必ず印が付く（◎赤い輪＝大規模・●橙の円＝中規模・▲青い三角＝小規模）。
印の数は「規制中の区間の数」と一致する（2026-10-04：大規模29・中規模8・小規模11＝規制中48）。

やること
 ①印を色と形で見つけ（輪 約30px・円 約21px・三角 約19×17px。路線番号の六角形は暗い青で別）、地理院タイルへの位置合わせで緯度経度にする。
   ページ（図）の重なりで同じ印が2回出る（図の間で最大約440mずれる）ので、図をまたいだ同じ種類の500m以内は1つにする。
 ②規制中の区間と同じ規模の印を、距離の合計が最小になる1対1で割り当て（ハンガリー法）、区間の位置（mark）を印の位置にする（apply=True のとき）。
   町名の代表点だった位置が、道路上の印になる。位置が引けていなかった区間（市野々）は、余った印が1つなら、その位置を使う。
 ③検算（一覧の状態は変えない）：規模ごとの印の数と規制中の数が合わない／解除のカードなのに近くに印が残っている／規制中なのに赤線から遠い／解除なのに赤線が近い。
   印のある規制中の区間は印が根拠なので赤線は見ない（小規模・中規模の線は橙寄りの赤で抽出から漏れる）。食い違いは watch.mapCheck.contradict に残り、画面の注意書きと手元の見張りの声に出る。

⚠ 精度の限界：位置合わせは図ごとに最大数百mずれる。印の位置は道路上の目安であり、公式の座標ではない。
青線は解除済みの全区間（今回の56より多い）が描かれるので、検算には使わない。

使い方（試験）：python press_map_check.py 新PDF [--json 一覧] [--apply 一覧へ印を書く]
"""
import argparse
import json
import math
import sys

import cv2
import fitz  # PyMuPDF
import numpy as np

import assign_recovery_marks as A
import build_pref_road_kisei as K

NAMES = A.FIGURES
DPI = 170
LEGEND_CUT = 0.855      # ページ下端の凡例の枠（赤い見本の線・見本の印）を除く割合
MIN_SCORE = 0.45        # 位置合わせの相関がこれ未満なら、その図は使わない
DEDUP_M = 500           # 図をまたいだ同じ種類の印をこの距離以内は1つにする
MARK_MAX_M = 4500       # 区間の町名の代表点からこれ以内の印だけ、区間の位置にする
ACTIVE_FAR_M = 3500     # 規制中なのに（印が無く町名の位置で見て）赤線がここより遠い＝食い違い
CLEARED_NEAR_M = 300    # 解除なのに赤線がここより近い＝食い違い
SAME_PLACE_M = 800      # 同じ場所に規制中の別区間があるときは除く
LEFTOVER_CLEARED_M = 2500  # 余った印が、解除済みの区間の町名からこの距離以内なら「解除なのに印が残る」


def _norm(s):
    return s.replace(" ", "").replace("　", "").replace("(", "（").replace(")", "）")


def _dist_m(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 111320
    dx = (lon2 - lon1) * 111320 * math.cos(math.radians(lat1))
    return math.hypot(dx, dy)


def _components(mask, wr, hr, fr, ar):
    n, _lab, st, ce = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    out = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if wr[0] <= w <= wr[1] and hr[0] <= h <= hr[1] and fr[0] <= a / (w * h) <= fr[1] and ar[0] <= a <= ar[1]:
            out.append((float(ce[i][0]), float(ce[i][1])))
    return out


def find_marks(hsv, keep):
    """印を見つける。{scale: [(x, y), …]}（画像の画素）"""
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    red = (((h <= 6) | (h >= 172)) & (s >= 170) & (v >= 170)).astype(np.uint8) * keep
    orange = ((h >= 10) & (h <= 24) & (s >= 170) & (v >= 190)).astype(np.uint8) * keep
    tri = ((h >= 117) & (s >= 235) & (v >= 225)).astype(np.uint8) * keep  # 純青。路線番号の六角形は暗い青（v≈160）で除かれる
    return {"large": _components(red, (26, 34), (26, 34), (0.2, 0.45), (200, 340)),
            "medium": _components(orange, (18, 25), (18, 25), (0.65, 0.9), (300, 400)),
            "small": _components(tri, (14, 24), (12, 22), (0.4, 0.7), (110, 260))}


def read_layers(pdf_bytes):
    """各図を位置合わせし、赤線の点・印・図の範囲を返す。戻り値 (layers, notes)"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = {}
    for page in doc:
        t = _norm(page.get_text())
        for name in NAMES:
            if _norm(name) in t:
                pages[name] = page
    K.BBOX = A.BBOX
    mos, ox, oy = K.build_mosaic()
    layers, notes = [], []
    for name in NAMES:
        page = pages.get(name)
        if page is None:
            notes.append(f"{name}：図が見つかりません")
            continue
        pix = page.get_pixmap(dpi=DPI, clip=fitz.Rect(0, 40, page.rect.width, page.rect.height))
        shot = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3][:, :, ::-1].copy()
        found = A.locate_water(shot, mos)
        if not found or found[0] < MIN_SCORE:
            notes.append(f"{name}：位置合わせに失敗（相関 {round(found[0], 2) if found else None}）")
            continue
        score, scale, mx, my = found
        h, w = shot.shape[:2]
        keep = np.zeros((h, w), np.uint8)
        keep[: int(h * LEGEND_CUT), :] = 1
        hsv = cv2.cvtColor(shot, cv2.COLOR_BGR2HSV)
        red = K.red_mask(shot) * keep

        def to_deg(x, y):
            return K.px2deg(ox + mx + float(x) * scale, oy + my + float(y) * scale, K.TILE_Z)

        ys, xs = np.nonzero(red)
        sel = (ys % 3 == 0) & (xs % 3 == 0)
        red_pts = np.array([to_deg(x, y) for x, y in zip(xs[sel], ys[sel])]).reshape(-1, 2)
        marks = [(cls, *to_deg(x, y)) for cls, lst in find_marks(hsv, keep).items() for x, y in lst]
        c = [to_deg(0, 0), to_deg(w, int(h * LEGEND_CUT))]
        layers.append({"name": name, "score": round(float(score), 3), "red": red_pts, "marks": marks,
                       "bounds": (min(a[0] for a in c), max(a[0] for a in c), min(a[1] for a in c), max(a[1] for a in c))})
    return layers, notes


def dedupe_marks(layers):
    """図の重なりで二重に出た印を1つにする（別の図・同じ種類・500m以内）。戻り値 [(scale, lat, lon, 図名)]"""
    uniq = []
    for l in layers:
        for cls, lat, lon in l["marks"]:
            if any(u[0] == cls and u[3] != l["name"] and _dist_m(u[1], u[2], lat, lon) < DEDUP_M for u in uniq):
                continue
            uniq.append((cls, lat, lon, l["name"]))
    return uniq


def hungarian(cost):
    """距離の合計が最小になる割り当て（行≦列の長方形）。戻り値 [(行, 列)]。O(n^3)・追加のライブラリなし"""
    n, m = len(cost), len(cost[0])
    INF = float("inf")
    u, v, p, way = [0.0] * (n + 1), [0.0] * (m + 1), [0] * (m + 1), [0] * (m + 1)
    for i in range(1, n + 1):
        p[0] = i
        j0 = 0
        minv, used = [INF] * (m + 1), [False] * (m + 1)
        while True:
            used[j0] = True
            i0, delta, j1 = p[j0], INF, 0
            for j in range(1, m + 1):
                if used[j]:
                    continue
                cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
                if cur < minv[j]:
                    minv[j], way[j] = cur, j0
                if minv[j] < delta:
                    delta, j1 = minv[j], j
            for j in range(m + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while j0:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
    return [(p[j] - 1, j - 1) for j in range(1, m + 1) if p[j]]


def _nearest(lat, lon, arr):
    if len(arr) == 0:
        return None
    dy = (arr[:, 0] - lat) * 111320
    dx = (arr[:, 1] - lon) * 111320 * math.cos(math.radians(lat))
    return float(np.sqrt(dx * dx + dy * dy).min())


def _label(it):
    return f"{it['road'] if it.get('road') else it['routeNo']} {it['municipality']}{it['place']}"


def check(pdf_bytes, data, apply=False):
    """位置図を読み、印で区間の位置を精密にし（apply=True のとき一覧へ書く）、状態の食い違いを返す。区間の status は変えない。"""
    layers, notes = read_layers(pdf_bytes)
    figs = [{"name": l["name"], "score": l["score"]} for l in layers]
    if len(layers) < len(NAMES):
        return {"ok": False, "reason": "位置図を読めませんでした（" + "／".join(notes) + "）", "figures": figs}
    items = data["items"]
    marks = dedupe_marks(layers)
    out = {"ok": True, "figures": figs, "redPoints": sum(len(l["red"]) for l in layers), "marks": {}, "assigned": 0, "contradict": []}
    assigned = {}  # item index -> (lat, lon, distM, 図名)
    left_marks = []
    for cls in ("large", "medium", "small"):
        ms = [m for m in marks if m[0] == cls]
        act = [(i, it) for i, it in enumerate(items) if it.get("status") == "active" and it.get("scale") == cls]
        out["marks"][cls] = {"marks": len(ms), "active": len(act)}
        with_pos = [(i, it) for i, it in act if it.get("lat") is not None]
        used_m = set()
        if with_pos and ms:
            cost = [[_dist_m(it["lat"], it["lon"], m[1], m[2]) for m in ms] for _, it in with_pos]
            if len(with_pos) <= len(ms):
                pairs = hungarian(cost)
            else:  # 印が足りない：転置して印ごとに区間を選ぶ
                pairs = [(r, c) for c, r in hungarian([[cost[r][c] for r in range(len(with_pos))] for c in range(len(ms))])]
            for r, c in pairs:
                i, it = with_pos[r]
                d = cost[r][c]
                used_m.add(c)
                if d <= MARK_MAX_M:
                    assigned[i] = (ms[c][1], ms[c][2], round(d), ms[c][3])
        rest_m = [m for c, m in enumerate(ms) if c not in used_m]
        rest_i = [(i, it) for i, it in act if it.get("lat") is None]
        if rest_i and len(rest_i) == len(rest_m):  # 位置が引けていない区間は、余った印の位置を使う
            for (i, it), m in zip(rest_i, rest_m):
                assigned[i] = (m[1], m[2], None, m[3])
            rest_m = []
        left_marks += rest_m
        out["marks"][cls]["unexplained"] = len(ms) - len(act)  # 印が多い(+)・少ない(-)。下で解除済みの区間の印と分かったぶんを引く
    cleared = [it for it in items if it.get("status") == "cleared" and it.get("lat") is not None]
    for m in left_marks:
        near = min(((_dist_m(it["lat"], it["lon"], m[1], m[2]), it) for it in cleared), key=lambda x: x[0], default=None)
        if near and near[0] <= LEFTOVER_CLEARED_M:
            out["contradict"].append(f"{_label(near[1])}：解除のカードですが、位置図に印が残っています（県の資料の食い違い）")
            out["marks"][m[0]]["unexplained"] -= 1
    for cls, names in (("large", "大規模（◎）"), ("medium", "中規模（●）"), ("small", "小規模（▲）")):
        g = out["marks"][cls]
        if g["unexplained"] != 0:
            out["contradict"].append(f"位置図の{names}の印が{g['marks']}個ですが、一覧の規制中は{g['active']}区間です")
    out["assigned"] = len(assigned)
    if apply:
        for i, (lat, lon, d, fig) in assigned.items():
            it = items[i]
            if it.get("lat") is None:
                it["lat"], it["lon"], it["geocode"] = round(lat, 6), round(lon, 6), "位置図の印"
            it["mark"] = {"lat": round(lat, 5), "lon": round(lon, 5), "distM": d, "figure": fig}
    # 赤線との突き合わせ。印を割り当てた規制中の区間は印そのものが根拠なので見ない（小規模・中規模の線は橙寄りの赤で、赤線の抽出から漏れる）
    act_all = [it for it in items if it.get("status") == "active" and it.get("lat") is not None]
    for i, it in enumerate(items):
        if it.get("lat") is None or (i in assigned and it.get("status") == "active"):
            continue
        lat, lon, tol = it["lat"], it["lon"], ACTIVE_FAR_M
        cov = [l for l in layers if l["bounds"][0] <= lat <= l["bounds"][1] and l["bounds"][2] <= lon <= l["bounds"][3]]
        if not cov:
            continue
        near = min((x for x in (_nearest(lat, lon, l["red"]) for l in cov) if x is not None), default=None)
        if it.get("status") == "active":
            if near is None or near > tol:
                out["contradict"].append(f"{_label(it)}：規制中のはずが赤線が見当たりません")
        elif it.get("lat") is not None:
            same = any(_dist_m(it["lat"], it["lon"], o["lat"], o["lon"]) <= SAME_PLACE_M for o in act_all)
            if near is not None and near <= CLEARED_NEAR_M and not same:
                out["contradict"].append(f"{_label(it)}：解除のはずが赤線があります")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--json", default="../pref-recovery-outlook.json")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    data = json.load(open(a.json, encoding="utf-8"))
    res = check(open(a.pdf, "rb").read(), data, apply=a.apply)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    if a.apply and res.get("ok"):
        with open(a.json, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("書き込みました")
    return 0 if res.get("ok") and not res.get("contradict") else 1


if __name__ == "__main__":
    sys.exit(main())
