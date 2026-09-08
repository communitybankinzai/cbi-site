# 災害時の画像つき自動SNS配信：設定手順

警戒レベルが上がったとき、防災MAPの実画面を撮って Instagram へ画像つきで投稿する仕組みの設定です。
**この設定をしなくても、Threads への文字の速報は動きます**（画像つきの配信だけが止まります）。

## 全体の流れ

```
CiDAO（10分ごとの巡回）
  └ 印西市の警戒レベルが上がった
       ├ Threads へ文字で即時投稿（数秒）
       └ GitHub Actions を起動
            └ 防災MAPを実際に開いてスクリーンショット
                 （大雨なら 雨雲＋キキクル浸水＋道路冠水目安＋避難所）
                 └ 画像をリポジトリへコミット → 公開されるのを待つ
                      └ CiDAO へ通知 → Instagram へ画像つき投稿（1〜3分後）
```

撮影を GitHub Actions に任せているのは、Vercel ではヘッドレスブラウザを安定して
動かせず、10分ごとの巡回（＝速報の経路）に入れると速報そのものを止めかねないためです。
また **GitHub Actions の「定期実行」は大幅に間引かれる**（実測で1日7回・最長12.4時間の空白）
ので使えません。ここではイベント起動（repository_dispatch）を使っています。

---

## 手順1：GitHub の個人アクセストークンを作る

1. GitHub にログインし、[Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new) を開く
2. 次のとおり設定する

| 項目 | 値 |
|---|---|
| Token name | `cidao-disaster-shot` |
| Expiration | 1年（期限が来たら作り直す） |
| Repository access | **Only select repositories** → `communitybankinzai/cbi-site` |
| Permissions → Repository permissions → **Contents** | **Read and write** |

3. 「Generate token」を押し、表示されたトークン（`github_pat_` で始まる文字列）をコピーする
   **この画面を離れると二度と表示されません。**

## 手順2：Vercel に環境変数を3つ登録する

Vercel の cidao プロジェクト → Settings → Environment Variables で、**Production** に追加します。

| 名前 | 値 |
|---|---|
| `GITHUB_DISPATCH_TOKEN` | 手順1でコピーしたトークン |
| `DISASTER_SHOT_SECRET` | 自分で決めた長い文字列（例：40文字のランダムな英数字） |
| `GITHUB_DISPATCH_REPO` | `communitybankinzai/cbi-site`（省略可。既定値と同じ） |

登録したら **Redeploy** してください（環境変数は再デプロイしないと反映されません）。

## 手順3：GitHub に同じ合言葉を登録する

`communitybankinzai/cbi-site` → Settings → Secrets and variables → Actions → New repository secret

| 名前 | 値 |
|---|---|
| `DISASTER_SHOT_SECRET` | **手順2で決めたものと同じ文字列** |

---

## 動作を確かめる

災害が来る前に、手動で一度通しておくことをおすすめします。

1. `communitybankinzai/cbi-site` → Actions → 「災害MAPのスクショ撮影とSNS配信」→ Run workflow
2. kind に `rain` を入れて実行
3. 撮影とコミットまでは動きます。**ただし Instagram への投稿は行われません**
   （CiDAO 側に本文が用意されていないため、404 で止まります。これは正しい動作です。
   文面を外から自由に渡せると、そこが投稿の抜け道になるため、本文は自動投稿が
   作ったものだけを使う設計にしています）

つまり手動実行で確認できるのは「**撮影と公開まで**」です。Instagram への投稿は、
実際に警戒レベルが上がったときに通しで動きます。

## 関連する設定

自動投稿そのものの入切・しきい値は、CiDAO の
[/admin/disaster-sources](https://cidao.vercel.app/admin/disaster-sources) の
「🚨 警戒レベルによる自動SNS投稿」で変更できます。

- 2026-09-08 現在：**稼働中／レベル3以上で自動投稿／Threads**
- 誤りがあればチェックを外せば即座に止まります

## 撮影する内容を変えたいとき

`tools/shoot_disaster_map.mjs` の `LAYERS` を編集します。

| 種類 | ONにするレイヤー |
|---|---|
| rain（大雨） | 雨雲レーダー、キキクル浸水、**道路の冠水リスク傾向**、避難所 |
| landslide（土砂災害） | キキクル土砂、土砂災害警戒区域、避難所 |
| flood（洪水） | 洪水浸水想定 最大規模、雨雲レーダー、避難所 |
| quake（地震） | 震度分布、避難所 |

レイヤーを増やしすぎると何も読み取れなくなるので、その災害で本当に要るものだけにしてください。
