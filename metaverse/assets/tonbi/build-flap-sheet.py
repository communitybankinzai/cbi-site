# 通常画面のトンビ（写真のコマ送り）の帯を、水平の写真1枚から「翼のしなり」つきで作る（2026-09-19 中司さん）
#   python build-flap-sheet.py        … tonbi_flap_sheet12.webp（12コマ・1コマ 376x284）を作り直す
# 経緯：以前の帯（tonbi_flap_sheet.webp・6コマ＝写真4枚）は動きがぎこちなかった。4枚のうち「打ち下ろし」だけ体の向きが違う
#   写真（尾が上）で、途中で鳥が入れ替わったように見えていた。向きのそろった「水平」の写真を土台に全コマを計算で作る。
# 考え方：後ろから見た鳥。翼を付け根から先へ細かい節に分け、節ごとの角度を theta(u) = AMP * (1+0.35u) * sin(phase - LAG*u)
#   にする（u=付け根0→先1）。LAG があるので翼の先が遅れてついてくる＝しなり。角度を付け根から足し合わせて各節の位置を求め、
#   cv2.remap で写真を曲げる。翼を上げ下げすると、後ろから見た横幅も縮む。打ち下ろすと体が少し浮く（±3px）。
# コマの並び：0＝振り上げの頂点 → 3＝水平を通過（下向き） → 6＝打ち下ろしの底 → 9＝水平を通過（上向き）。
#   index.html の止め絵は、降下＝0、滑空＝4（全体がいちばん平らに見えるコマ）。コマ数や並びを変えたら index.html も直すこと。
# 振れ幅 AMP は 34 度。大きくすると羽の模様が伸びて不自然になる（45 度あたりから目立つ見込み・未検証）。
# 必要：numpy・opencv-python・Pillow。費用はかからない（AI の画像生成は使っていない）。
import os, math
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 376, 284
FRAMES, AMP, LAG = 12, 34.0, 1.0
R0 = 20.0   # 胴体の半幅（ここから外が翼）

level = np.array(Image.open(os.path.join(HERE, "tonbi_flap_level.webp")).convert("RGBA")).astype(np.float32)
a = level[:, :, 3]
cols = a[int(H * 0.72):int(H * 0.86), :].sum(axis=0)             # 尾のあたりの不透明な列
cx = float((cols * np.arange(W)).sum() / max(1.0, cols.sum()))   # 体の中心
L = max(cx, W - cx) - R0 + 6                                     # 翼の長さ（画面の端まで）

def warp(img, phase):
    n = 240
    s = np.linspace(0.0, 1.0, n)
    theta = np.radians(AMP) * (1.0 + 0.35 * s) * np.sin(phase - LAG * s)
    ds = L / (n - 1)
    px = np.concatenate([[0.0], np.cumsum(np.cos(theta[:-1]) * ds)])   # 曲げた後の横の位置（付け根から）
    py = np.concatenate([[0.0], np.cumsum(np.sin(theta[:-1]) * ds)])   # 曲げた後の上への持ち上がり
    xs = np.arange(W, dtype=np.float32)
    d = np.abs(xs - cx) - R0
    inside = d > 0
    dd = np.clip(d, 0, px[-1])
    r_src = np.interp(dd, px, s * L)
    lift = np.where(inside, np.interp(dd, px, py), 0.0).astype(np.float32)
    beyond = d > px[-1]                                                # 翼が縮んで届かなくなった列は透明
    map_x = np.where(inside, cx + np.sign(xs - cx) * (R0 + r_src), xs).astype(np.float32)
    body = -3.0 * math.sin(phase)
    mx = np.tile(map_x[None, :], (H, 1))
    my = (np.arange(H, dtype=np.float32)[:, None] + lift[None, :] + body).astype(np.float32)
    out = cv2.remap(img, mx, my, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    out[:, beyond, 3] = 0
    return out

frames = [warp(level, math.pi / 2 + 2 * math.pi * i / FRAMES) for i in range(FRAMES)]
sheet = np.clip(np.concatenate(frames, axis=1), 0, 255).astype(np.uint8)
out = os.path.join(HERE, "tonbi_flap_sheet%d.webp" % FRAMES)
Image.fromarray(sheet, "RGBA").save(out, "WEBP", quality=84, method=6)
print("sheet", out, sheet.shape[1], "x", sheet.shape[0], os.path.getsize(out), "bytes")
