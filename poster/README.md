---
aliases: [A0告知ポスター]
tags: [広報, ポスター, CBI]
created: 2026-08-08
status: 運用中
---

# CBI 告知ポスター（A0縦）

A0縦（841×1189mm）の掲示用ポスター。**2案ある**。

| | パターン1（サイト連動版） | パターン2（ポップ版） |
|---|---|---|
| ファイル | `cbi-poster-a0.html` / `.pdf` | `cbi-poster-a0-b.html` / `.pdf` |
| 見た目 | サイトのトップページをそのまま圧縮。上1/3が写真 | 白地に指のイラスト。極太の袋文字 |
| 書体 | Zen Maru Gothic | M PLUS Rounded 1c |
| 向く場所 | 行政・施設への掲示、事業説明を兼ねる掲示 | 商業施設・掲示板・イベント会場 |
| 由来 | サイトLPからの起こし | 2026-08-09 ユーザー提示のデザイン案をHTMLで再現 |

---

## パターン1（サイト連動版）

サイトのトップページ（`site/index.html`）の見た目・配色・文言を、そのまま A0縦 1枚に圧縮したもの。

## 構成（2026-08-08 時点）

| 領域 | 高さ | 内容 |
|---|---|---|
| Hero | 400mm（紙面の約1/3） | 指さす手のメインビジュアル＋タイトル＋一文。**CBIロゴ円とCTAボタンは載せない** |
| ABOUT | 可変 | CBIが目指す３つのこと |
| JOIN | 可変 | 参加方法3ステップ＋できること（準会員／正会員） |
| フッター | 102mm | CBIロゴ・団体名・登録番号／サイトQR（86mm角）＋URL |

**LPにあって載せていないもの**

- 活動報告・お知らせ、団体情報・お問い合わせ … 掲示している間に内容が変わるため（2026-08-08 ユーザー判断）
- HeroのCBIロゴ円、HeroのCTAボタン2つ、JOINカード内の擬似ボタン3つ … 紙面では押せないボタンは不要（同上）

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | 配布ページ。2案のPDF・HTML・画像のダウンロードとCanva取り込み手順（`/poster/` で公開） |
| `cbi-poster-a0.html` / `.pdf` | パターン1の本体と入稿用PDF |
| `cbi-poster-a0-b.html` / `.pdf` | パターン2の本体と入稿用PDF |
| `build.ps1` | HTML → PDF 変換（Chrome headless の `--print-to-pdf`）。`-Name` で対象を切替 |
| `make_qr.py` | QRコード `../assets/qr-site.svg` の再生成（segno）。**サイトのフッターと共用** |
| `preview.png` / `preview-b.png` | 配布ページ用のプレビュー画像（1240×1753px）。PDF更新時は下記で作り直す |

## 作り直す手順

```powershell
powershell -ExecutionPolicy Bypass -File site\poster\build.ps1
powershell -ExecutionPolicy Bypass -File site\poster\build.ps1 -Name cbi-poster-a0-b
```

上がパターン1、下がパターン2。

- **オンラインで実行すること**。書体（Zen Maru Gothic／M PLUS Rounded 1c）を Google Fonts から取得するため、オフラインだと代替書体に置き換わる。
- QRのリンク先を変える場合は `make_qr.py` の `URL` を書き換えて `python site/poster/make_qr.py` を先に実行する。**出力先は `site/assets/qr-site.svg` で、サイトのフッターのQRと同じファイル**なので両方に反映される。
- PDFを更新したら配布ページのプレビュー画像も作り直す。

  ```python
  import fitz
  p = fitz.open('cbi-poster-a0.pdf')[0]
  p.get_pixmap(matrix=fitz.Matrix(1240/p.rect.width, 1240/p.rect.width)).save('preview.png')
  ```

## 設計メモ

- **レイアウトは mm 単位**。`@page { size: 841mm 1189mm }` と `.poster { height: 1189mm }` で用紙に固定し、Hero（400mm固定）とフッター（102mm固定）以外は `flex: 1 1 auto` で余りを分け合わせている。**文字量を増やすと下から静かに切れる**（`overflow: hidden` のため）。
- **切れたかどうかは目視でなく計測する**。高さ制約を外したコピーを作り、フッターの紺色が終わるY座標を測ると実高さが mm で出る。1189mm との差だけ余白を削れば一発で収まる。

  ```python
  # 高さ制約を外したコピーを作る
  s = s.replace('html, body { width: 841mm; height: 1189mm; }', 'html, body { width: 841mm; height: auto; }')
  s = s.replace('  width: 841mm; height: 1189mm;\n  display: flex;', '  width: 841mm; height: auto;\n  display: flex;')
  s = s.replace('  overflow: hidden; position: relative;', '  overflow: visible; position: relative;')
  # → chrome --headless --window-size=3179,6000 --screenshot で撮り、
  #   #14283f が現れる最下端Y(px) × 25.4 / 96 = 実高さ(mm)
  ```

- **Heroのビジュアル**は LP と同じ素材（`assets/hero/hero-photo.jpg`＋`hero-hand.webp`＋雲海グラデ）。LPは時刻で空の色が変わる（`script.js` が1日=180秒で周回）が、ポスターでは正午の色 `rgba(150,200,255,.07)` に固定している。
- **青の面積は紙面の1/3**。3〜5m先から「上＝何の告知か／下＝どう参加するか」を読み分けさせるための比率。黄金比分割（454mm）も候補だが、下部の情報量が多い今回は1/3の方が収まりが良い。

## パターン2（ポップ版）の作り

- **袋文字は3層**。`.ot` に `data-t` で同じ文字を持たせ、`::before`（白の太い `-webkit-text-stroke`）→ `::after`（黒の細い stroke）→ 本体の塗り、の順に `z-index` で重ねている。CSSの `paint-order` はテキストで効かない環境があるためこの方式にした。
- **「このゆびとまれ」のアーチは SVG の `textPath`**。SVGなら `paint-order="stroke"` が確実に効くので、白stroke版と黒stroke版の `<text>` を2つ重ねて袋文字にしている。
  - **viewBox の縦横比はコンテナに合わせる**。`preserveAspectRatio` の既定（meet）だと比率が合わないぶん左右に余白ができ、文字が中央に縮こまる。横幅いっぱいに広げたいときは viewBox の比率を `.arch` の幅高比に一致させる。
- **指の色違いは1枚の画像＋CSSフィルター**。`hero-icon.png` を5回配置し、`hue-rotate` / `saturate` / `brightness` で黄・クリーム・オレンジを作っている。素材の追加は不要。
- **QRは他の要素に一部でも重なると読めなくなる**。制作中、下端がオレンジ帯に8mmかぶっただけでデコードに失敗した。位置を動かしたら必ず再デコードして確認する。

## 既知の制約・注意

- **反転QR（濃紺地に白モジュール）は使わない**。フッターに馴染ませるため一度試したが、生成PDFから OpenCV でデコードできず（白黒反転してからなら成功）、Android や LINE のリーダーで読めない端末が出る。白地・紺モジュールのまま、枠線と影だけ外して馴染ませている。
- Hero背景写真の原寸は 2340px（A0幅で約71dpi）、手のイラストは 1600px（約48dpi）。掲示距離（1〜2m）では実用範囲だが、至近で見るとやや甘い。高解像度の差し替え素材が手に入ったら更新する。

## 関連ノート

- [[site/README|CBIサイト（site/）]]
- [[CLAUDE|CBI作業エージェント指示書]]
- 公開URL： https://communitybankinzai.github.io/cbi-site/
