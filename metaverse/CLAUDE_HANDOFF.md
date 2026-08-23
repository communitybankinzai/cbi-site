# CBIメタバース印西 引継ぎ

最終更新: 2026-08-23

## 作業場所と公開先

- リポジトリ: `C:\Users\nsfactory\OneDrive\CBI\site`（GitHub正・push自動）
- 本体: `metaverse/index.html`（単一ファイル。CSS/JSすべてインライン）＋ `metaverse/bunkazai.json`（文化財50件）＋ `metaverse/spirits/`（精霊画像）
- 本番: https://communitybankinzai.github.io/cbi-site/metaverse/
- 技術: Cesium 1.119（CDN）＋ Google Photorealistic 3D Tiles

## プロダクトの位置付け

平時の地形理解・文化財めぐり用の3Dワールド。**災害時利用は想定しない**（3D Tilesは重く、Map Tiles APIは従量課金のため。災害時の情報照合は `inzai-disaster-map/` が担当）。2026-08-17に「COCoLaメタバース印西」から「CBIメタバース印西」へ改名済み。

## 実装済みの主な機能

- **文化財パズルラリー**（左上「🏛 印西市文化財」）: bunkazai.json の50件を精霊キャラとして収集。80m以内接近でピース獲得。パネル見出しは「印西市文化財ずかん」
- **📍 ピン表示切替**: 文化財ピン50件の一括表示/非表示
- **浸水シミュレーション**（右パネル）: 標高0〜50m・0.5m刻みの半透明水面。標高→楕円体高の換算はジオイド高 `INZAI_GEOID_HEIGHT_M = 35.8`（出典未記載・要検証）。ON中は「公式の浸水想定ではない」注意書きを常時表示（**この文言は削らない**）
- **🎯 位置修正モード**（2026-08-17追加）: ずれた文化財ピンの正しい位置をクリックすると座標＋最寄りピン名＋距離を表示・自動コピー。看板クリックは無効化される
- **🏫 避難所ピン表示切替**（2026-08-18追加）: 印西市公式の避難所55施設を種別色分けピンで表示（デフォルトOFF・初回ONで災害MAPと同じCIDAO避難所APIから取得）。CORSは本番オリジンのみ許可のためローカルでは取得不可（エラー案内表示のみ検証可）。開設状況の照合は災害MAP側の担当で、ここでは表示しない。案内ボタンは「使い方」（旧「遊び方」。防災用途を兼ねるため2026-08-18改称）
- **文化財解説・📜年表・🧠クイズ**（2026-08-19追加）: bunkazai.json 全50件に `description`（市公式ページ由来の2〜3行要約・出典は各 `detailUrl`）、`era`（時代ラベル47件）、`eraYear`（年表ソート用46件、伝承・推定含む概数）を追加。文化財パネルに年表タブ（eraYear昇順・未詳は末尾）。**解説文は市公式ページの記載事実のみ・創作禁止**
- **写真・詳細モーダル・レベル別クイズ・認定証**（2026-08-19追加）:
  - `photos/`: 市公式ページ掲載写真20件（転載許可取得済みとユーザー確認 2026-08-19。**残り30件は市ページに写真自体がない**）。表示時は必ず「写真出典：印西市ホームページ」を明記する
  - 個別文化財のクリック（ピン・ずかんセル・パズル一覧の名前）→すべて詳細モーダル（写真＋出典・解説＋出典・公式リンク・▶現地へ行く・クイズ）に統一
  - **レベル別クイズは文化財ごと**（2026-08-19ユーザー指示で全体コース制から変更）: 詳細モーダルの「この文化財のクイズ」→🔰初級/🥈中級/🥇上級を選択→その文化財に関する問題のみ各5問程度・毎回ランダム。初級=区分/種別/場所/説明あて/写真あて、中級=時代/世紀/指定時期（`designatedEra`）、上級=`quiz`手作り問題/指定年（`designatedYear`）/数値穴埋め（descriptionの像高等をregex抽出）。クイズタブは🎲おまかせ全体5問のみ
  - **クイズ成績記録・見直し**（2026-08-19追加）: 全クイズの解答を localStorage `cbi-meta-quiz-log-v1` に1問ずつ記録（直近500問・端末内のみ）。クイズタブ「📒 成績と見直し」でレベル別正答率とまちがい一覧（最大30件・「📖 復習する」で該当文化財の詳細モーダルへ）。消去は confirm 付きボタン
- **スマホUI**（2026-08-20改善）: メディアクエリは `(pointer: coarse), (max-width: 640px)`。左上ボタン群は `#menuToggle`（☰）で開閉する縦メニュー（項目タップで自動クローズ）。`#controlPanel` は max-height＋overflow-y:auto（浸水シミュまでスクロール可・トグルと重ならないよう top:96px）。右下 `#mobileMoveBar`=モード切替（setModeをラップして表示同期）＋⚡速度切替（`speedMultiplier` ×1/×2/×4、Shift加速とは乗算で併用）＋⬆⬇長押し（keys.KeyE/KeyQ を疑似入力）。撮影/告知モードのUI非表示リストに menuToggle/mobileMoveBar/topLeftBar を追加済み。**3D画面の実機見た目は本番でのみ確認可**（スクショ検証はブラウザペイン制約で不可のことあり）
  - ピース50枚達成→completeModalで名前入力→**印西文化財マイスター認定証**（canvas描画・PNG保存・localStorage `cbi-meta-cert-v1` 保存・ずかん上部の🏅ボタンで再表示）。達成日はローカル時間で記録（toISOStringはUTCずれに注意）
- **📄 学習レポート一覧への導線**（2026-08-23追加）: ☰メニューの「📄 学習レポート」（`#reportsBtn`）から `reports.html` を別タブで開く。それまで50件の一覧はサイト内のどこからもリンクされておらず、3D→文化財ピン→詳細モーダル→個別レポート→「もどる」でしか到達できなかった。**レポートを読むだけの利用者に3Dを踏ませない**ことが目的で、root requests の1日枠（30回）の節約にもなる。イベント系UIとして `applyMode` の表示リストに入れてあるため防災モードでは非表示。録画時の非表示リスト（`recStart`）にも登録済み
- **🏢 公民館ピン表示切替**（2026-08-19追加）: `kominkan.json`（公民館5・中央駅前地域交流館・文化ホールの7施設。出典=市公式の施設一覧ページ、座標=GSI住所検索の番地代表点）。クリックで所在地＋市公式ページへのリンク。**本埜公民館のみ大字代表点（番地未収録）のため要目視確認**
- **⏱ タイムトライアル**（2026-08-20追加）: ☰メニューの「⏱ タイムトライアル」。設定は `TT_CONFIG`（参加要件=クイズ10問以上・正答率80%以上／年齢区分→レベル対応／コース=固定の文化財index列: 初級3・中級5・上級7＋**完走コース full=全50か所（最近傍＋2-opt順・約58km・×4飛行で移動のみ約8分）**、どの年齢でも完走コースを選択可／通過判定80m／事務局メール=communitybankinzai@gmail.com）に集約。流れ: 要件判定→年齢選択→ニックネーム→コース選択（レベル別 or 完走）→1か所目へテレポート＋カウントダウン6秒→onTickで計測・HUD表示→通過時は**精霊が出現して通過の合図**（`ttSpiritPass`: encounterバナーを自動クローズ・未入手ピースは自動獲得。通常のshowEncounterはトライアル中抑止のまま）→全通過でttFinish→証明書PNG＋mailto報告。自己ベストは localStorage `cbi-meta-tt-best-v1`（コースキー別）
- **⏱ サーバー公式計測（厳密競技モード・2026-08-20追加）**: CIDAO `POST/GET https://cidao.vercel.app/api/metaverse-tt`（`C:\Repos\cidao src/app/api/metaverse-tt/route.ts`）。計測開始の瞬間に start→trialId取得、通過ごとに checkpoint、ゴールで finish。**タイムはサーバー時計（finished_at−started_at）で確定**し、順序違反・物理的に速すぎる通過は flags 記録→status=flagged（証明書と結果画面に「事務局確認対象」表示）。記録コードはサーバー発行。エントリー画面に上位3位ランキング表示（GET、名前はttEscでエスケープ）。API不通時は端末計測の「参考記録」へ自動フォールバック。DB: `metaverse_tt_trials`（migration `20260820120000_metaverse_time_trial.sql`・**2026-08-20適用済み**・RLS有効でanon不可・service_roleのみ）。通過報告は直列キュー（並行送信だと到着順が入れ替わり順序チェックに弾かれるため）。**事務局の記録管理は CiDAO `/admin/timetrial`**（コース別ランキング・フラグ付き記録・未完走一覧・個別削除・全リセット=「リセット」入力＋confirm。実装は `src/app/admin/timetrial/`）。GitHub Pagesの旧HTMLキャッシュ（〜10分）に注意
- **参加要件のイベント別設定**（2026-08-20追加）: 正答率％・最低解答数は CiDAO `/admin/timetrial` の「⚙ 参加要件」から変更（`app_settings` key `metaverse_tt_requirements`）。API GETが `requirements` を返し、サイトの`openTtModal`が参加判定に使用（不通時は TT_CONFIG の既定80%/10問）。サーバーのstart受付も同じ値で判定
- **🔀 用途モード**（2026-08-20追加）: `?mode=event`/`?mode=bousai` で入り口分岐、パラメータなし初回はモード選択画面（localStorage `cbi-meta-mode-v1` に記憶・☰メニュー「🔀 モード切替」で変更）。イベント=文化財系表示・防災系（避難所トグル/floodControls）非表示。防災=ゲーム系（puzzleBtn/reportsBtn/pinToggle/pickMode/ttBtn）非表示・避難所ピン自動ON・浸水シミュ表示・文化財ピンOFF。cinemaパラメータ時は選択画面を出さない。災害MAPヘッダーのリンクは `?mode=bousai` 直行
- **2D災害MAPとのデータ共有**（2026-08-19）: `bunkazai.json`／`kominkan.json` は `inzai-disaster-map/` の「参考: 文化財」「参考: 公民館」レイヤーからも読まれる（相対パス `../metaverse/`）。**ファイル名・キー構成を変える場合は災害MAP側（app.js の ensureBunkazaiLayer/ensureKominkanLayer）も更新すること**。避難所は両者ともCIDAO APIを共有

## 文化財ピンの座標について（重要）

- bunkazai.json の座標は**住所の番地代表点**（国土地理院の住所検索由来）。山林・広い敷地では実際の堂宇と数十〜数百mずれる
- **市の文化財オープンデータ（実座標つき）は存在しない**（わが街ガイドは防災系のみ）。OSMにも寺社の大半は未登録。機械的な一括修正は不可能と調査済み（2026-08-17）
- 修正運用: ユーザーが位置修正モードで正しい位置をクリック →「`位置修正: <名称> lat=xx.xxxxxx lon=xxx.xxxxxx（現ピンから00m）`」形式の行をチャットに貼る → **① bunkazai.json の該当エントリの lat/lon を書き換え、② `position-fixes.json` の `fixes` 先頭へ1件追記して、③ 両方を一緒に commit・push**（これが定型作業）
  - **②を忘れると管理画面の「文化財ピン 位置修正履歴」に残らない。`.githooks/pre-commit` が座標変更だけのコミットを止める**（有効化はPCごとに1回 `git config core.hooksPath .githooks`）
  - 記録済みの修正（2026-08-23時点で10件）: 押付の水塚31m／鳥見神社の神楽96m／月影の井44m／鋳銅鰐口（松虫）92m／鋳銅孔雀文磬92m／泉福寺薬師堂40m／木造薬師如来坐像・立像92m／上宿古墳71m／道作古墳群167m／銅造不動明王立像97m
- **同じ住所の文化財は座標が完全に一致する**（松虫寺に3件、木下交流の杜に2件など計8組・150m以内なら12組）。看板が重なるため `bzSlot` で同一地点のものを16pxずつ縦に積んでいる（2026-08-23）。**座標をずらして回避しないこと**（実態と合わなくなる）
- ピンの描画は `CLAMP_TO_3D_TILE` で3D表面に吸着（固定高だと台地で地中に埋まり視差でずれるため。2026-08-17修正）
- ~~6拠点スポット（SPOTS配列・黄色ピン）は固定高のままで同種のずれの可能性あり~~ → **2026-08-22 対応済み**。低地の木下駅で約20m浮いていたため、文化財ピンと同じ `watchPinClamp` による地表吸着へ統一（`SPOT_BILLBOARD_OFFSET = 40` で看板を地表40m上に出す。`watchPinClamp` に第4引数 offsetM を追加、既定は2m）。吸着できるまでピンは非表示
- **スポットは17か所**（2026-08-22に11か所追加）。`group`（駅／商業・公園／公共施設）でパネルに見出しを出す。**`SPOTS[0]` は初期表示位置（START_SPOT）なので先頭を入れ替えない**。`spot-<index>` を看板クリックで参照するため、並べ替えるときは両方の整合を確認すること。座標の出典は駅・公園・商業がOpenStreetMap（2026-08-22取得）、公民館7施設が `kominkan.json`（市公式の施設一覧）
- **タイムトライアル中は文化財詳細の「▶ 現地へ行く」を無効化**（2026-08-22）。押せると移動時間ゼロでゴールでき記録が成立しないため、競技中はボタンを「⏱ 競技中は現地へ飛べません」に変えて `disabled` にする。**左パネルのスポット移動は競技中も許容**（主要施設まで飛び、そこから自力で文化財を探す運用）

## 作業ルール

1. 変更したら `site/admin/changelog.json` へ追記し、git push まで自動実行（親 `CLAUDE.md` のルールに従う）
2. APIキー（index.html内のGoogle Maps APIキー）は出力・新規ファイルへ複製しない。リファラ制限・API制限は適切に設定済みと確認済み（2026-08-16）。課金は実測¥0、Map Tiles API無料枠内
3. 既存機能（図鑑・ピース獲得・歩行/飛行モード・スポット移動）を壊さない。変更後は既存機能の動作確認をする
4. ローカル検証は `localhost:4173`（`python -m http.server` 等でsite/を配信）。ただし**3D TilesはAPIキーのリファラ制限で403**になるため、3D描画の見た目は本番でのみ確認可能。エンティティやUIのロジック検証はテストデータ注入で可能
5. `viewer` や `BUNKAZAI` はスクリプトスコープの変数（`window.viewer` ではアクセス不可。コンソールからは裸の識別子で参照）

## 関連文書

- 保管庫ノート: `cidao/proposals/2026-08-16_印西市災害状況整合MAPとSNS巡回.md`（浸水シミュレーションの設計判断・メタバース節）
- 課金監視: `cidao/2026-08-16_GoogleMapTilesAPI課金の監視手順.md`
- 防災MAP側: `inzai-disaster-map/CLAUDE_HANDOFF.md`
- **費用ゼロ運用**（2026-08-21）: Google側で 3D Tiles root requests per day=**30**（課金対象を無料枠1,000/月以下に構造的に抑える）。超過時は root.json が429→`showError` が「本日の3Dワールド利用枠に達しました」を表示（故障表示ではない）。renderer（タイル本体）は無償だが1日の回数上限があり、**Google既定の3万回では8/20・8/23に実際に枯渇したため 2026-08-23 に 500,000回/日 へ引き上げ済み**（Cloud Consoleで即時承認・無償のため費用は増えない。経緯は [[2026-08-23_MapTilesクォータ引き上げ申請]]）。実測1人あたり4,000〜8,000回なので**1日60人程度が目安**。**この値を変えたら CiDAO の `RENDERER_LIMIT_PER_DAY`・`site/admin/admin.js`・`site/metaverse/index.html` のフォールバック値も必ず合わせること**（警告の閾値がずれる）。イベント日は当日朝に **root** を一時引き上げる運用（運営方針ノート参照）。予算アラートは月1,000円・10/50/100%
- **🖼 描画精度（maximumScreenSpaceError）**（2026-08-22）: 既定 **8**（`loadTileset` のオプション）。以前は未指定でCesium既定の16だったため「建物が平べったい」状態だった。**管理画面 CiDAO `/admin/timetrial`「🖼 3Dの描画精度」から 4／8／16／32 に変更でき**（`app_settings` key `metaverse_render_quality`）、`/api/metaverse-usage` の `maximumScreenSpaceError` として配られる。サイト側は `applyRenderQuality()` が実行中の tileset に代入するため**再読み込み不要・開いたままの画面にも5分以内**に反映。`usageFetch` が `loadTileset` より先に走る場合に備えて `pendingSse` に保持し読み込み完了後にも適用する。**値を下げるとタイル取得が2〜4倍に増え renderer の1日上限（3万回）に早く達する。課金は root 単位なので費用は増えない**。イベントで同時利用が多い日は16〜32へ上げること
- **📊 本日の利用状況チップ**（2026-08-21）: `#presenceChip` に人数＋`https://cidao.vercel.app/api/metaverse-usage`（公開・認証不要・CORS=github.io/localhost:8765）の `visitorsToday`（metaverse_presence_daily・JST日）／`rootLimitPerDay`=30（定数・Console設定と手で同期）／`todayRequests`（Cloud Monitoring・**太平洋0時=日本16時リセットのクォータ集計日**基準・サーバー120秒キャッシュ）を5分ごとに表示。実装は `C:\Repos\cidao src/lib/map-tiles-usage.ts`＋`src/app/api/metaverse-usage/route.ts`。root枠をConsoleで変えたら ROOT_LIMIT_PER_DAY も変えること
