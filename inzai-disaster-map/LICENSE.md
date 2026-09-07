# 印西市 災害状況整合MAP／内水リスク推定 の利用条件

このフォルダ（`inzai-disaster-map/`）に含まれるものの利用条件です。
**適用範囲はこのフォルダの中だけ**で、リポジトリの他の場所には及びません
（例：`metaverse/photos/` は印西市ホームページ掲載写真を許可を得て掲載しているもので、
再配布はできません）。

作成：Community Bank INZAI（印西市市民活動団体登録 ０８－００１）／非営利・無償公開

---

## 1. コード — MIT License

`*.html` `*.js` `*.css` `pipeline/*.py` など、当団体が書いたプログラムが対象です。

```
MIT License

Copyright (c) 2026 Community Bank INZAI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**他の市区町村で使う場合**：`pipeline/build_static.py` の冒頭にある範囲（緯度経度・格子の大きさ）を
書き換えれば、同じ手順でその地域の地形指標を作れます。標高データは国土地理院が全国で配信しています。

---

## 2. データ — 元データごとに条件が違います

| ファイル | 元データ | 条件 |
|---|---|---|
| `simulation-data/road_risk.json` | **OpenStreetMap**（道路） | **ODbL 1.0** |
| `simulation-data/map_grid.json`<br>`simulation-data/status.json`<br>`simulation-data/sources.json` | 国土地理院 標高タイル | 国土地理院コンテンツ利用規約（出典明示） |
| `past-flood-points.json` | 千葉県 災害対策本部会議資料 | 出典明示。事実の記録 |

### `road_risk.json` について（重要）

このファイルは **OpenStreetMap のデータから作った派生データベース**です。
OpenStreetMap の [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) に従い、
**このファイルも ODbL 1.0 の下で提供します**。利用する場合は、

- 出典として `© OpenStreetMap contributors` を明記してください
- このファイルを改変して公開する場合は、**同じく ODbL 1.0 で提供**してください

道路の区分（冠水リスク低／注意／冠水リスク高／使用困難となる可能性あり）は、
当団体が地形指標から機械的に付けた値で、**実際の通行可否ではありません**。

### 国土地理院のデータについて

標高タイルの利用は[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従います。
出典（国土地理院 標高タイル）を明示すれば、複製・改変・再配布ができます。
`map_grid.json` は標高タイルを加工して作ったものです。

### 地図上で重ねている外部データ

以下は当団体が再配布しているものではなく、**閲覧時に各配信元から直接読み込んでいます**。

- 地理院タイル（背景地図・色別標高図・治水地形分類図）— 国土地理院
- 気象庁（警報・注意報・雨雲・キキクル・アメダス・地震）
- ハザードマップポータルサイト（洪水・内水浸水想定）
- J-SHIS（防災科学技術研究所）
- 避難所（印西市 わが街ガイド 公開CSV）
- 冠水した道路（**みんなでつくる千葉豪雨冠水道路マップ**）— 運営者の許可を得て、
  印西市周辺のみを当団体のサーバー経由（10分キャッシュ）で表示しています。
  **新しい冠水情報の投稿は本家サイトへお願いします**：https://mintsuku-chiba-kansuimap.com/

---

## 3. 免責

このモデルは**未校正**です。浸水の深さ・冠水する確率・通行可否のいずれも出力しません。
重み・しきい値はいずれも根拠のない仮の値で、実際の冠水実績との照合は行っていません。
限界と既知の誤りは [技術仕様](./simulation-spec.html) に全て記載しています。

**避難や通行の判断は、必ず印西市および気象庁の公式情報に従ってください。**

ご指摘・照会先：communitybankinzai@gmail.com
