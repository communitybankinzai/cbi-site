# 更新履歴の承認掲載とSNS告知（GAS側セットアップ）

サイトの「活動報告・お知らせ」に、**メール返信で承認したものだけ**を掲載し、
希望すれば Threads でも告知する仕組み。ns-factory で運用中の方式の CBI 版。

## 全体の経路

```
候補メール送信（sendNewsCandidate を手動 or 自動検知から呼ぶ）
  → 事業主がメールに返信（1行目: 掲載 / 告知 / 不要）
  → 10分おきトリガー checkNewsReplies が返信を拾う
  → postNewsToSite: GitHub repository_dispatch（news-publish）
  → cbi-site の Actions → tools/add_news.js が news-data.json に追記（冪等）
  → index.html の「活動報告・お知らせ」に足し込み描画
  →（「告知」のときだけ）announceNewsOnSns_: Threads へ即時投稿
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
| SNS投稿 | `postToThreads` ＋頻度ガード回避の専用呼び口 | `SnsQueue.gs` の `postQueueToThreads_` を再利用。**頻度ガード・KillSwitch がそもそも存在しない**ので専用呼び口は不要 |
| 成否の記録 | `_recordPostSuccess/_recordPostFailure` | **「SNS予約投稿」シートに行を追記**（通常投稿と同じ記録場所） |
| PAT | `GITHUB_PAT_NS_FACTORY`（ns-factory 限定） | **`GITHUB_PAT_CBI_SITE` を新規作成**（下記） |

### 事前準備（スクリプトプロパティ）

| 名前 | 値 |
| --- | --- |
| `GITHUB_PAT_CBI_SITE` | **新規作成する** Fine-grained PAT。Resource owner: `communitybankinzai`、Repository: `cbi-site` のみ、Permissions: **Contents: Read and write**（`dispatches` はこの権限で通る）。⚠️ ns-factory の PAT はリポジトリ限定スコープなので使い回せない |
| `NEWS_APPROVAL_EMAIL_TO` | 候補メールの宛先（承認者のメールアドレス） |
| `THREADS_ACCESS_TOKEN` / `THREADS_USER_ID` | 設定済み（SnsQueue が使用中のもの） |

### NewsPublish.gs（新規作成・全文）

```js
// ============================================================
// サイト更新履歴の「メール返信」承認 → 掲載＋Threads告知
//   候補メールへの返信の1行目:
//     掲載                       → サイトの更新履歴に載せる
//     告知                       → サイトに載せる ＋ Threadsにも投稿
//     不要                       → 載せない
//     掲載 2026-08-08 【タグ】 本文 → 文面を差し替えて掲載（告知も同様）
//   10分おきのトリガーで checkNewsReplies を回す。
//   掲載先: cbi-site の news-data.json（repository_dispatch 経由・冪等）
// ============================================================

var NEWS_REPLY_SUBJECT = '【CBIサイト 更新履歴】掲載候補';
var NEWS_REPLY_LABEL   = 'CBI更新履歴処理済み';
var NEWS_GITHUB_OWNER  = 'communitybankinzai';
var NEWS_GITHUB_REPO   = 'cbi-site';
var NEWS_SITE_URL      = 'https://communitybankinzai.github.io/cbi-site/';

// ──────────────────────────────────────────────
// 候補メールの送信（手動 or 自動検知から呼ぶ）
// ──────────────────────────────────────────────

/**
 * 掲載候補メールを送る。
 * @param {string} line 「2026-08-08 【お知らせ】 本文」の1行。
 *                      日付を省略した場合（「【お知らせ】 本文」や「本文」）は今日を付ける。
 */
function sendNewsCandidate(line) {
  line = String(line || '').trim();
  if (!line) throw new Error('掲載文が空です');
  if (!/^\d{4}-\d{2}-\d{2}\s/.test(line)) {
    line = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd') + ' ' + line;
  }
  var to = PropertiesService.getScriptProperties().getProperty('NEWS_APPROVAL_EMAIL_TO');
  if (!to) throw new Error('NEWS_APPROVAL_EMAIL_TO が Script Properties に未設定です');

  var body =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:20px;line-height:1.8">' +
    '<h2 style="font-size:18px;margin:0 0 4px">CBIサイト 更新履歴の掲載候補</h2>' +
    '<p style="margin:0 0 16px;color:#555;font-size:14px">承認されたものだけがサイトに載ります。</p>' +

    '<div style="background:#f5f5f5;padding:16px;border-radius:8px;white-space:pre-wrap;margin-bottom:20px">' +
    escapeNewsHtml_(line) + '</div>' +

    '<div style="border:2px solid #1a3a5c;border-radius:8px;padding:16px;margin-bottom:24px">' +
    '<p style="margin:0 0 12px;font-weight:bold">このメールに<u>返信</u>して、1行目に次のどれかを書いてください</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:15px">' +
    '<tr><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-weight:bold;white-space:nowrap;background:#fafafa">掲載</td>' +
    '<td style="padding:8px 10px;border-bottom:1px solid #ddd">サイトの更新履歴に載せる</td></tr>' +
    '<tr><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-weight:bold;white-space:nowrap;background:#fafafa">告知</td>' +
    '<td style="padding:8px 10px;border-bottom:1px solid #ddd">サイトに載せる ＋ Threads にも投稿する</td></tr>' +
    '<tr><td style="padding:8px 10px;border-bottom:1px solid #ddd;font-weight:bold;white-space:nowrap;background:#fafafa">不要</td>' +
    '<td style="padding:8px 10px;border-bottom:1px solid #ddd">載せない</td></tr>' +
    '<tr><td style="padding:8px 10px;font-weight:bold;white-space:nowrap;background:#fafafa">返信しない</td>' +
    '<td style="padding:8px 10px">何も起きません</td></tr>' +
    '</table>' +
    '<p style="margin:14px 0 0;font-size:14px;color:#555">' +
    '文面を直したいときは<br><b>掲載 2026-08-08 【お知らせ】 直した本文</b><br>' +
    'のように、コマンドの後ろに続けて書いてください。<br><br>' +
    '10分以内に処理して、結果をこのスレッドに返信します。</p>' +
    '</div>' +
    '</body></html>';

  GmailApp.sendEmail(to, NEWS_REPLY_SUBJECT, line + '\n\n（このメールはHTML表示で確認し、返信で承認してください）', {
    htmlBody: body,
    name: 'CBIサイト更新係'
  });
  Logger.log('候補メールを送信しました: ' + line);
}

function escapeNewsHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────────
// 返信の処理（10分おきトリガー）
// ──────────────────────────────────────────────

/** 返信本文の先頭行からコマンドを取り出す。引用に入ったら打ち切る。 */
function _parseNewsReply_(body) {
  var lines = String(body || '').split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^[\s　]+|[\s　]+$/g, '');
    if (!line) continue;
    if (line.charAt(0) === '>') return null;                          // 引用
    if (/^\d{4}年\d{1,2}月\d{1,2}日.*[:：]$/.test(line)) return null; // 引用ヘッダ
    if (/wrote:$/.test(line)) return null;
    var m = line.match(/^(掲載|告知|不要)(?:[\s　]+([\s\S]+))?$/);
    if (!m) return null;
    return { cmd: m[1], text: m[2] ? m[2].replace(/^[\s　]+|[\s　]+$/g, '') : '' };
  }
  return null;
}

/** 候補メール本文から掲載文を取り出す（グレーの枠の中身） */
function _extractNewsText_(htmlBody) {
  var m = String(htmlBody || '').match(/white-space:pre-wrap[^>]*>([\s\S]*?)<\/div>/);
  if (!m) return '';
  return m[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/^[\s　]+|[\s　]+$/g, '');
}

/**
 * 候補メールへの返信を拾って掲載する。10分おきのトリガーから呼ぶ。
 * どのコマンドでも必ず結果を返信する（返信が来ないと動いたか分からないため）。
 */
function checkNewsReplies() {
  var label = GmailApp.getUserLabelByName(NEWS_REPLY_LABEL) || GmailApp.createLabel(NEWS_REPLY_LABEL);
  var query = 'subject:"' + NEWS_REPLY_SUBJECT + '" newer_than:14d -label:"' + NEWS_REPLY_LABEL + '"';
  var threads = GmailApp.search(query, 0, 20);

  for (var i = 0; i < threads.length; i++) {
    var th = threads[i];
    var msgs = th.getMessages();
    if (msgs.length < 2) continue;                       // まだ返信が無い

    var cmd = _parseNewsReply_(msgs[msgs.length - 1].getPlainBody());
    if (!cmd) continue;                                  // コマンドではない返信は無視

    if (cmd.cmd === '不要') {
      th.addLabel(label);
      th.reply('破棄しました。この更新履歴は掲載しません。');
      continue;
    }

    var text = cmd.text || _extractNewsText_(msgs[0].getBody());
    if (!text) {
      th.addLabel(label);
      th.reply('掲載文を読み取れませんでした。「掲載 2026-08-08 【お知らせ】 本文」の形で本文も一緒に返信してください。');
      continue;
    }

    // 先にラベルを付けて多重処理を防ぐ。失敗したら外して返信し直せるようにする。
    th.addLabel(label);
    try {
      postNewsToSite(text);
    } catch (err) {
      th.removeLabel(label);
      th.reply('掲載に失敗しました。もう一度返信すると再試行します。\n\n' + err);
      continue;
    }

    // ⛔ 告知は必ず try/catch で囲む。告知の失敗で掲載処理まで落とすと、
    // サイトには反映済みなのにエラーに見えて押し直しが起き、二重掲載を招く。
    var note = '';
    if (cmd.cmd === '告知') {
      try {
        announceNewsOnSns_(text);
        note = '\nThreadsにも告知しました。';
      } catch (err2) {
        note = '\n※Threads告知は失敗しました: ' + err2;
        Logger.log('Threads告知失敗: ' + err2);
      }
    }
    th.reply('掲載を受け付けました。数分でサイトに反映されます。\n\n' + text + note);
  }
}

// ──────────────────────────────────────────────
// サイトへの掲載（repository_dispatch）
// ──────────────────────────────────────────────

/** 二重処理の抑止キー（本文から作るので token を引き回さなくてよい） */
function _newsCacheKey_(text) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, String(text), Utilities.Charset.UTF_8);
  var hex = digest.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return 'news_' + hex;
}

/**
 * GitHub の repository_dispatch を投げて news-data.json を更新させる。
 * 重複チェック・並べ替えはリポジトリ側（tools/add_news.js）が行う。
 * @param {string} line 「2026-08-08 【タグ】 本文」の1行（タグ省略可）
 */
function postNewsToSite(line) {
  var pat = PropertiesService.getScriptProperties().getProperty('GITHUB_PAT_CBI_SITE');
  if (!pat) throw new Error('GITHUB_PAT_CBI_SITE が Script Properties に未設定です');

  var res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + NEWS_GITHUB_OWNER + '/' + NEWS_GITHUB_REPO + '/dispatches',
    {
      method: 'post',
      headers: { Authorization: 'token ' + pat, Accept: 'application/vnd.github+json' },
      contentType: 'application/json',
      payload: JSON.stringify({
        event_type: 'news-publish',
        client_payload: {
          line: String(line),
          id: _newsCacheKey_(line)   // 再送しても二重掲載しないための識別子
        }
      }),
      muteHttpExceptions: true
    }
  );

  var code = res.getResponseCode();
  if (code !== 204) throw new Error('dispatch失敗: ' + code + ' ' + res.getContentText());
  return 'dispatched';
}

// ──────────────────────────────────────────────
// Threads 告知
// ──────────────────────────────────────────────

/** 「2026-08-08 【タグ】 本文」から日付とタグを外して本文だけにする */
function _stripNewsLine_(line) {
  return String(line).replace(/^\s*\d{4}-\d{2}-\d{2}\s*(?:【.+?】)?\s*/, '').trim();
}

/** 更新履歴から Threads 投稿文を組み立てる */
function buildNewsSnsText_(line) {
  return '【お知らせ】' + _stripNewsLine_(line) + '\n\n' +
         'CBIサイトの活動報告・お知らせを更新しました。\n' +
         NEWS_SITE_URL;
}

/**
 * 掲載済みの更新履歴を Threads で告知する。同じ本文の二重投稿は抑止する。
 * SnsQueue.gs の postQueueToThreads_ を再利用し、成否は「SNS予約投稿」シートに
 * 行として残す（通常投稿と同じ記録場所・月次集計に乗る）。
 * ※ cbi-admin-gas には頻度ガード・KillSwitch が存在しないため、
 *    ns-factory のような専用呼び口は不要。
 */
function announceNewsOnSns_(line) {
  var cache = CacheService.getScriptCache();
  var key = 'sns_' + _newsCacheKey_(line);
  if (cache.get(key)) return { posted: false, skipped: '既に告知済み' };

  cache.put(key, '1', 21600);  // 6時間。再処理での二重投稿を防ぐ
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('THREADS_ACCESS_TOKEN');
    var userId = props.getProperty('THREADS_USER_ID');
    if (!token || !userId) throw new Error('Threads認証未設定（THREADS_ACCESS_TOKEN/THREADS_USER_ID）');

    var text = buildNewsSnsText_(line);
    var now = new Date();
    var ok = postQueueToThreads_(userId, token, text, '');

    // 成否をSNS予約投稿シートに記録（H:状態 I:結果メモ。即時投稿だが同じ台帳に乗せる）
    getSnsQueueSheet_().appendRow([
      'news' + now.getTime(), now, now, text, '', true, false,
      ok ? 'posted' : 'failed',
      Utilities.formatDate(now, 'Asia/Tokyo', 'MM/dd HH:mm') + ' 更新履歴の告知（即時） Threads: ' + (ok ? '成功' : '失敗')
    ]);

    if (!ok) throw new Error('Threads投稿失敗（実行ログ参照）');
    return { posted: true };
  } catch (err) {
    cache.remove(key);          // 失敗したら再試行できるように戻す
    throw err;
  }
}

// ──────────────────────────────────────────────
// セットアップ
// ──────────────────────────────────────────────

/** 【1回だけ実行】返信チェックの10分おきトリガーを作る（何回実行しても増えない） */
function setupNewsReplyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkNewsReplies') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkNewsReplies').timeBased().everyMinutes(10).create();
  Logger.log('トリガーを作成しました');
}
```

### セットアップ手順

1. GitHub で Fine-grained PAT を作成（`communitybankinzai` / `cbi-site` のみ /
   Contents: Read and write）→ スクリプトプロパティ `GITHUB_PAT_CBI_SITE` に登録
2. スクリプトプロパティ `NEWS_APPROVAL_EMAIL_TO` に承認者のメールアドレスを登録
3. `NewsPublish.gs` を作成して上のコードを貼る
4. **`checkNewsReplies` をエディタで1回手動実行**して Gmail の承認ダイアログを通す
   （これをやらないとトリガーが毎回失敗する）
5. `setupNewsReplyTrigger` を1回実行（10分おきトリガー作成）
6. `sendNewsCandidate('テスト掲載です。')` を実行し、届いたメールに
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
