# 災害状況整合MAP 連携仕様（試作）

この画面は、設定が空の間はブラウザの `localStorage` にだけ保存する試作品です。複数の自主防災組織で運用する場合は、CiDAOの認証とCBI側APIを接続し、権限判定を必ずサーバー側でも行います。

## 設定

`config.js` の次の値へ、同一組織で管理するHTTPSエンドポイントを設定します。秘密鍵やOpenAI APIキーはブラウザへ置きません。

- `operatorSessionEndpoint`: ログイン利用者、組織所属、権限の取得
- `sharedRecordsEndpoint`: 共有台帳の取得・保存
- `locationAiEndpoint`: 投稿本文・コメントからの場所候補補完
- `cidaoLoginUrl`: 未ログイン時のCiDAOログイン先

## 利用者セッション

`GET operatorSessionEndpoint`、Cookie認証、JSON応答を想定します。

```json
{
  "userId": "uuid",
  "displayName": "印西自主防災会 担当者",
  "organizationId": "uuid",
  "role": "reviewer",
  "roleLabel": "確認担当",
  "permissions": {
    "canCreate": true,
    "canEdit": true,
    "canReview": true,
    "canPublish": false
  }
}
```

推奨する役割は `viewer`（閲覧）、`operator`（候補登録）、`reviewer`（内容・位置確認）、`publisher`（一般公開承認）です。画面の無効化だけでは権限制御にならないため、共有台帳APIでも毎回、所属組織と権限を検証します。

## 共有台帳

- `GET sharedRecordsEndpoint`: `{ "records": [...] }`
- `PUT sharedRecordsEndpoint`: `{ "version": "1", "records": [...] }`
- Cookie認証を使い、画像は別ストレージへ保存して台帳にはURLと公開区分だけを持たせます。
- 実運用では全件PUTではなく、記録単位の作成・更新API、版番号、変更履歴、論理削除へ移行します。

## AI場所候補

`POST locationAiEndpoint` には、画面側でメールアドレス、電話番号、SNSアカウント名を簡易マスクした本文・コメントを送ります。サーバー側でも再検査し、利用量制限と監査ログを設定します。

```json
{
  "version": "1",
  "targetArea": {
    "name": "千葉県印西市",
    "bounds": [[35.735, 140.055], [35.875, 140.245]]
  },
  "postText": "投稿本文",
  "commentsText": "確認コメント",
  "locationHint": "施設名・道路名",
  "existingCandidates": []
}
```

応答例:

```json
{
  "candidates": [
    {
      "title": "候補名",
      "address": "候補住所",
      "lat": 35.832,
      "lng": 140.145,
      "confidence": 0.78,
      "reason": "本文の施設名とコメントの交差点名が一致",
      "sourceUrl": "https://example.jp/source"
    }
  ]
}
```

AIの応答はピンを自動確定せず、候補として人が地図・根拠を確認します。元画像EXIFまたは連携APIに緯度経度がある場合だけ、その座標を直接ピン留めし、公開前の確認対象にします。

## 公開と緊急情報

- 内部確認中、公開承認待ち、公開承認済みを分けます。
- 一般表示は `?view=public` で公開承認済みだけを表示します。
- 救助・安否確認要請は正確な位置の一般公開を許可せず、概略位置または非公開にします。
- 本サイトは119・110、自治体、気象庁の公式情報を代替しません。緊急時は通報を優先します。
