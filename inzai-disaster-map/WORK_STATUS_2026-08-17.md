# 印西市 災害状況整合MAP 作業チェックポイント

記録日: 2026-08-17
状態: 実装途中・未公開

## 今回の目的

- SNS新着巡回の検索語をMAP上で確認し、CIDAO管理画面から変更できるようにする。
- 自動巡回で取得できない投稿を手動検索し、投稿URLを未確認候補として登録する。
- Facebookは一般公開投稿の自動全文検索に対応できないため、手動検索・URL登録で補完する。
- 印西市公式の避難所を地図へ表示し、災害別対応可否、開設発表、洪水・内水想定を2Dで照合する。

## 実装済み（未検証を含む）

### CIDAO

- `src/app/api/disaster/inzai-shelters/route.ts` を追加。
  - 印西市わが街ガイドの指定避難所、特別避難所、広域避難場所CSVを取得する。
  - 印西市防災速報を確認し、施設名と開設・閉鎖表現が一致した場合だけ開設状況へ反映する。
  - 公式発表がない施設は「開設発表なし」とし、閉鎖扱いにはしない。
  - ローカルAPIで55施設、HTTP 200を確認済み。
- `csv-parse` と `fast-xml-parser` を依存関係へ追加。
- SNS巡回APIが、有効・無効を含む現在の検索ルールを公開MAPへ返すよう変更。
- CIDAO管理画面用の `DisasterSnsMonitorRules.tsx` を追加。
  - Threads、Instagram、Blueskyを1行1検索語で編集する。
  - 各媒体12件、2〜50文字に制限する。
  - 管理者確認後、service roleで既存ルールを無効化・再有効化する。
  - Facebookの一般公開投稿検索は対象外であることを表示する。

### 災害MAP

- SNS新着巡回カードへ以下のUIを追加。
  - 現在の巡回検索語表示。
  - 各検索語を使った手動検索リンク。
  - Facebook手動検索リンク。
  - 見つけた投稿URLを入力して、既存のSNS投稿登録画面へ引き継ぐ導線。
  - CIDAO管理画面の検索語設定へのリンク。
- 避難所レイヤーと確認UIを追加。
  - 避難所種別、確認する災害、開設情報、名称・住所で絞り込み。
  - 開設中、開設発表なし、災害対象外を別の表示で識別。
  - 避難所一覧から地図へ移動し、公式情報をポップアップ表示。
  - 洪水最大規模・内水浸水想定・避難所を一括で重ねる操作。
  - 2D表示は公式ハザードの視覚的照合であり、流体計算ではない旨を明記。

## 未完了

- MAPの `config.js` へ本番避難所API URLを追加する。
- CSS・JSのキャッシュ番号とアプリバージョンを更新する。
- CIDAOの型チェック、lint、production buildを実行して修正する。
- MAPのJavaScript構文確認を行う。
- ローカルでPC・スマホ幅を表示し、避難所ピン、一覧、SNS検索語、URL引継ぎを操作確認する。
- CIDAOをVercelへ、MAPをGitHub Pagesへ公開する。
- 本番APIのCORS、公式CSV取得、公式発表なし時の表示を確認する。
- `CLAUDE_HANDOFF.md` と関連ドキュメントを最終仕様へ更新する。

## 現時点の注意

- 今回の変更はコミット・公開していない。
- CIDAOのローカル開発サーバーは `http://localhost:3012` で起動中。
- CIDAO作業ツリーには今回と無関係な分析画面・レイアウト・地図タイル使用量関連の変更がある。防災MAPのコミット時に混ぜない。
- CBIサイト側には今回と無関係な未追跡画像・`.claude/` がある。変更・削除・ステージしない。

## 次に再開する位置

1. `config.js` へ `shelterEndpoint: "https://cidao.vercel.app/api/disaster/inzai-shelters"` を追加する。
2. CIDAOの型チェックで、管理画面のルール型とserver actionを確認する。
3. MAPの構文確認後、ローカル画面をPC・スマホで操作確認する。
4. 防災MAP関連ファイルだけを選んでコミットし、CIDAOとGitHub Pagesへ順番に公開する。

## 公式データ参照先

- 印西市わが街ガイド オープンデータ: https://www2.wagmap.jp/inzai/OpenData
- オープンデータ利用規約: https://www2.wagmap.jp/inzai/OpenDataAgreement
- 印西市防災ポータル: https://www.city.inzai.lg.jp/bousaiportal/
- 印西市の避難所: https://www.city.inzai.lg.jp/bousaiportal/0000008839.html
