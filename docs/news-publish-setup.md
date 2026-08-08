# 更新履歴の承認掲載とSNS告知（GAS側セットアップ）

サイトの「活動報告・お知らせ」に、**メール返信で承認したものだけ**を掲載し、
希望すれば Threads＋Instagram でも告知する仕組み。ns-factory で運用中の方式の CBI 版。

2026-08-08 決定事項（§0）: 告知先は **Threads＋Instagram**（IGは告知カード画像を
cidao `/api/og/news` で自動生成）／候補の入口は**手動＋changelog.json 日次検知の両方**／
候補メール宛先は **communitybankinzai@gmail.com**。

## 全体の経路

```
候補メール送信（手動: sendNewsCandidate ／ 自動: checkChangelogForNews 日次）
  → 承認者がメールに返信（1行目: 掲載 / 告知 / 不要）
  → 10分おきトリガー checkNewsReplies が返信を拾う
  → postNewsToSite: GitHub repository_dispatch（news-publish）
  → cbi-site の Actions → tools/add_news.js が news-data.json に追記（冪等）
  → index.html の「活動報告・お知らせ」に足し込み描画
  →（「告知」のときだけ）announceNewsOnSns_:
      Threads（テキスト）＋ Instagram（cidao /api/og/news の告知カード画像付き）へ即時投稿
  → 処理結果をメール返信で通知
```

## リポジトリ側（対応済み・2026-08-08）

| ファイル | 役割 |
| --- | --- |
| `news-data.json` | 更新履歴データ（`items` 配列・日付降順） |
| `tools/add_news.js` | 冪等な追記スクリプト。同じ id / 同じ日付+本文+リンク なら何もせず exit 0 |
| `.github/workflows/news-publish.yml` | `repository_dispatch`（news-publish）と手動実行の受け口 |
| `script.js` | JSON を**足し込み**描画。既存の `<li>` は残し、同じ本文は1件に畳む |

- 年グループはそのまま持たない（フラットなリスト・日付降順）。年のベタ書きは無い。
- 本文は `textContent` で挿入。リンクは href を検査（`javascript:` 等のスキームを弾く）。
- 動作確認は GAS 不要：
  🔗 https://github.com/communitybankinzai/cbi-site/actions/workflows/news-publish.yml
  「Run workflow」→ `line` に `2026-08-08 【お知らせ】 テストです。` → 同じ内容で再実行して
  「既に掲載済みのため何もしません」が出れば冪等性もOK（2026-08-08 に両方実測済み）。

## GAS 側（cbi-admin-gas に同居）

**CBI 専用 GAS プロジェクト（管理画面バックエンド）に `NewsPublish.gs` を1ファイル追加するだけ。**
既存ファイル（Code.gs / SnsQueue.gs 等）には手を入れない。取り消すときはファイルを消せば戻る。

ns-factory との違い：

| 項目 | ns-factory | CBI |
| --- | --- | --- |
| 承認方式 | メール返信（ボタン方式は補助で残存） | **メール返信のみ**（ボタン無し → doGet 改修不要） |
| SNS投稿 | Threads のみ。頻度ガード回避の専用呼び口 | **Threads＋Instagram**。`SnsQueue.gs` の投稿関数を再利用。**頻度ガード・KillSwitch がそもそも存在しない**ので専用呼び口は不要 |
| IG 告知カード | （IG投稿なし） | cidao `/api/og/news` が本文入り 1080x1080 JPEG を動的生成（HMAC署名付き・2026-08-08 実装済み） |
| 候補の自動検知 | 業務日誌から日次判定（news_watcher.py） | `checkChangelogForNews` が changelog.json の feature/content エントリを日次検知（初回は記録のみ・1回3件まで） |
| 成否の記録 | `_recordPostSuccess/_recordPostFailure` | **「SNS予約投稿」シートに行を追記**（通常投稿と同じ記録場所） |
| PAT | `GITHUB_PAT_NS_FACTORY`（ns-factory 限定） | **`GITHUB_PAT_CBI_SITE` を新規作成**（下記） |
| コード反映 | エディタ貼り付け | エディタ貼り付け（⚠️ clasp は不可：ローカルの clasp ログインは you0810jmsdf@gmail.com で、cbi-admin-gas はそのアカウントのスクリプト一覧に無い＝アクセス権なし。2026-08-08 実測） |

### 事前準備（スクリプトプロパティ）

| 名前 | 値 |
| --- | --- |
| `GITHUB_PAT_CBI_SITE` | **新規作成する** Fine-grained PAT。Resource owner: `communitybankinzai`、Repository: `cbi-site` のみ、Permissions: **Contents: Read and write**（`dispatches` はこの権限で通る）。⚠️ ns-factory の PAT はリポジトリ限定スコープなので使い回せない |
| `NEWS_OG_SECRET` | IG 告知カード画像APIの署名キー。**cidao の Vercel 環境変数 `NEWS_OG_SECRET` と同じ値**にする（値は agents/a1-core/credentials.md に記録済み）。未設定でも動く（IG告知だけスキップされ Threads のみになる） |
| `NEWS_APPROVAL_EMAIL_TO` | 候補メールの宛先。未設定時は `communitybankinzai@gmail.com` |
| `THREADS_ACCESS_TOKEN` / `THREADS_USER_ID` / `IG_ACCESS_TOKEN` / `IG_USER_ID` | 設定済み（SnsQueue が使用中のもの） |

### NewsPublish.gs（新規作成）

**コードの正本はローカルの `cbi-admin-gas/NewsPublish.gs`**（OneDrive の CBI フォルダ内）。
このファイルの内容をそのまま Apps Script エディタに「NewsPublish.gs」として貼り付ける。
docs にコードを複製しない（二重管理でずれるため）。

主な関数：

| 関数 | 役割 |
| --- | --- |
| `sendNewsCandidate(line)` | 候補メール送信（手動の入口。日付省略時は今日を前置） |
| `checkChangelogForNews()` | changelog.json の日次検知（自動の入口。feature/content のみ・初回は記録だけ・1回3件まで） |
| `checkNewsReplies()` | 返信処理（10分毎。掲載→告知→結果返信。ラベルで冪等管理） |
| `postNewsToSite(line)` | repository_dispatch 送信（id は本文MD5） |
| `announceNewsOnSns_(line)` | Threads＋IG 告知（CacheService 6hで二重抑止・シートに成否記録・全滅時のみ throw） |
| `setupNewsTriggers()` | トリガー2件作成（何回実行しても増えない） |

検証済み（2026-08-08）: 返信解析・抽出・日付前置 19ケース＋HMAC一致・changelog判定・status判定 11ケースを node スタブで実測。
IG カード API はローカル dev サーバで 200(JPEG)/403(不正署名)/400(text無し) を実測、画像も目視確認。

### セットアップ手順

（communitybankinzai@gmail.com でログインした PC ブラウザで行う）

1. GitHub で Fine-grained PAT を作成（`communitybankinzai` / `cbi-site` のみ /
   Contents: Read and write）→ スクリプトプロパティ `GITHUB_PAT_CBI_SITE` に登録
   → 発行した値は agents/a1-core/credentials.md にも記録
2. Vercel（cidao プロジェクト）の環境変数に `NEWS_OG_SECRET` を追加して **Redeploy**、
   同じ値を cbi-admin-gas のスクリプトプロパティ `NEWS_OG_SECRET` にも登録
   （値は credentials.md に記録済み。後回しにしても IG 告知がスキップされるだけで他は動く）
3. Apps Script エディタで `NewsPublish.gs` を作成し、`cbi-admin-gas/NewsPublish.gs` の内容を貼る
4. **`checkNewsReplies` をエディタで1回手動実行**して Gmail の承認ダイアログを通す
   （これをやらないとトリガーが毎回失敗する）
5. `checkChangelogForNews` を1回手動実行（初回は既存エントリを既知登録するだけ。
   これを飛ばすと翌朝、過去の feature/content が候補メールとして届き始める）
6. `setupNewsTriggers` を1回実行（返信チェック10分毎＋changelog検知 毎日9時台）
7. `sendNewsCandidate('テスト掲載です。')` を実行し、届いたメールに
   `不要` → `掲載` → `告知` の順で通しテスト

### 注意（ns-factory で実際に事故った点の反映状況）

- ✅ 冪等性: `add_news.js` が同 id / 同内容を弾く（Actions 実測済み）。dispatch の `id` は本文の MD5
- ✅ 足し込み描画: `script.js` 実装・Chromium 実測済み（同本文は1件に畳む）
- ✅ 年のベタ書き: 無し（フラットリスト・日付は YYYY-MM-DD データ駆動）
- ✅ 告知は try/catch: `checkNewsReplies` 内。失敗してもラベルは付いたまま＝掲載は完了扱い
- ✅ 頻度ガード: cbi-admin-gas には存在しないため該当なし（KillSwitch も無い）
- ✅ PAT: cbi-site 専用を新規作成（ns-factory の PAT は使えない）
- ✅ workflow は `env:` 経由のみ（`run:` に `${{ }}` を直接展開しない）
- ✅ 本文は textContent、href 検査あり
- ⛔ ラベル名 `CBI更新履歴処理済み` を変えるときは `NEWS_REPLY_LABEL` も必ず揃える。
  ずれると同じ更新履歴を毎回掲載し続ける
- ⛔ 候補メールの文面（`white-space:pre-wrap` の div）を変えるときは
  `_extractNewsText_` も見直すこと
