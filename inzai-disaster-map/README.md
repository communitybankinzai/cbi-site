# 印西市 災害状況整合MAP

案2（低コスト半自動OSINT MAP）の初期プロトタイプです。

現在は「この仕組みが地域で役立つか」を検討する構想検証版であり、市民投稿の収集・公開運用は開始していません。入力データはブラウザ内だけに保存されます。

## できること

- 国土地理院地図を背景に、洪水浸水想定、内水浸水想定、土砂災害警戒区域を重ねる
- 千葉県内の道路冠水注意箇所から、印西市の「六軒ガード下」を任意の参考レイヤーとして表示する（初期OFF、座標は暫定位置）
- SNS、Web、住民通報、職員確認、公式発表を同じ台帳に登録する
- 被害地点ごとに、想定内被害、想定外被害、高リスク未確認、情報不確実を表示する
- 写真待ち、写真リンクあり、職員写真確認済、取得不可を管理する
- Instagram、ThreadsなどAPIで広域取得しにくい検索結果を、画面キャプチャ・貼り付け・画像選択からスクリーンショット証跡として切り出し、被害候補に登録する
- Instagram、Threads、X、Yahoo!リアルタイム検索、Web検索の検索画面を検索語付きで開く
- スクリーンショットの切り出し範囲から日本語・英語OCRを行い、抽出文字を証跡として保存する
- 確認者、検索・確認時刻、投稿・発生時刻、検索履歴を記録する
- 投稿URL、投稿ID、OCR本文、近接地点から重複候補を警告する
- CBI側のサーバーAPIまたは手動JSONからThreads/Instagram等の投稿候補を取り込む
- CSV取込、CSV出力、GeoJSON出力、印刷用表示に対応する
- SNS投稿URLだけで先に登録し、場所未特定の候補を「場所確認待ち」で管理する
- 元投稿を開くと同時に、撮影場所を尋ねるコメント・DM文をクリップボードへ用意する
- 投稿者から回答を得た後、地図クリックでピンを設定する
- スクリーンショット内の「3時間前」などを確認時刻から逆算し、推定投稿時刻として記録する
- 画面キャプチャはブラウザ上で取得するため、スクリーンショットファイルを事前保存する必要はない
- 上部の「公式情報」から、印西市、千葉県、気象庁、国土交通省の防災情報へ直接移動できる

## 無料で利用できる範囲

- 地図表示とピン設定は Leaflet と国土地理院タイルを利用し、Google Maps の有料APIは使用しない
- 登録データと切り出した証跡画像は、現在の構成ではブラウザのローカルストレージへ保存する
- CSV/GeoJSONの入出力、投稿リンク登録、場所確認待ち、相対時刻の逆算は無料で利用できる

複数端末でのリアルタイム共有、画像のサーバー保管、公式SNS APIの利用を追加する場合は、別途バックエンドやAPI利用料が発生する可能性があります。

## SNS投稿の登録手順

1. `SNS収集`を開き、分かっている投稿URLを貼って`場所未特定で登録`を押す
2. 投稿URLが分からない場合はSNS検索を開き、投稿を表示したまま`投稿画面を自動取込`を押す
3. 場所が不明な候補で`場所を質問（コメント / DM）`を押し、確認手段を選んで用意された文面を貼る
4. 回答後に`地図でピンを置く`を押し、確認できた位置を地図上でクリックする
5. 分類、重要度、写真状態、推定時刻を確認して保存する

## 注意

初期状態では実被害データは登録していません。画面右側の「サンプル表示」は挙動確認用であり、実被害ではありません。

SNSやWeb由来の情報は確認候補です。行政判断や公開判断に使う前に、公式発表、現地確認、写真確認、複数根拠で確認してください。

## CSVヘッダー

```csv
title,category,locationName,lat,lng,locationStatus,locationAskedAt,locationAskedBy,locationContactMethod,locationAnsweredAt,locationAnswerNote,observedAt,sourceType,sourceUrl,status,severity,photoStatus,photoUrl,photoPrivacy,hazardFlood,hazardInland,hazardRoad,hazardLandslide,assignedTo,notes
```

スクリーンショット証跡はブラウザのローカル保存です。CSV/GeoJSONには巨大な画像本体は含めず、`evidenceHasImage`、`evidencePlatform`、`evidenceQuery` を出力します。

## CBIサイト連携

CBIトップページから `inzai-disaster-map/` へリンクしています。`?embed=1` を付けると埋め込み表示向けになります。

`config.js` の `snsSearchEndpoint` にサーバー側の検索API URLを設定すると、「SNS収集」画面から連携APIを呼び出します。Metaのアクセストークンをブラウザへ保存しないでください。

リクエスト例:

```json
{
  "platform": "threads",
  "query": "印西市 冠水",
  "since": "2026-08-13T00:00",
  "until": "2026-08-13T23:59"
}
```

レスポンスは `items`、`data`、`results` のいずれかの配列を受け付けます。

```json
{
  "items": [
    {
      "id": "投稿ID",
      "platform": "threads",
      "text": "投稿本文",
      "permalink": "https://...",
      "mediaUrl": "https://...",
      "timestamp": "2026-08-13T08:40:00+09:00",
      "username": "投稿者名",
      "locationName": "場所名",
      "lat": 35.83,
      "lng": 140.14
    }
  ]
}
```

同一オリジンの親画面へ、件数変更時に `cbi:disaster-map:records-changed` メッセージを送ります。画像を除く台帳は `window.CBIDisasterMap.getRecords()` でも参照できます。

## 主な分類値

- `category`: `road_flood`, `inundation`, `river`, `landslide`, `traffic`, `lifeline`, `shelter`, `other`
- `sourceType`: `official`, `staff`, `citizen`, `sns`, `news`, `web`
- `status`: `unconfirmed`, `corroborated`, `verified`, `actioning`, `resolved`
- `photoStatus`: `needs-photo`, `has-photo`, `official-verified`, `unavailable`
- `photoPrivacy`: `internal`, `public-blurred`, `public`

## 主な参照元

- ハザードマップポータルサイト オープンデータ
- 国土地理院 地理院タイル
- 国土交通省 関東地方整備局 千葉国道事務所 道路冠水注意箇所マップ
- 印西市防災ポータル
- 気象庁キキクル
