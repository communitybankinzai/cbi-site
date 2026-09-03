# CBIメタバース印西 引継ぎ

最終更新: 2026-09-02

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
- **⏱ 計測中のナビ（2026-09-03追加）**: HUD に次の地点への矢印（`ttBearingToNext`・自分の向き基準の相対角）と「右前（北東）」の言葉、「📍 次の地点のピンだけ表示する」スイッチ（`#ttOnlyNext`・既定ON・`ttApplyPinFocus` で `setPinVisible`）。通過ごとに次のピンへ切り替え、`ttFinish`／`ttAbort` の `ttRestorePins` で📍ボタンの状態へ戻す。次の目的地カード（`#ttCard`・画面左下の独立ボックス・`ttShowCard`：写真 or 精霊カード＋解説要約＋出典、20秒で自動的にたたむ・タップで開閉）と、画面上の目印（`#ttTarget`・`ttUpdateTargetMarker`：見えていれば真上に⬇、画面外なら縁で➜がその方向を向く）も同じタイミングで更新。**順位と期間ランキング（2026-09-03）**：ゴール時に API の `rank`（all／month／event、同じニックネームは1人・ベストで比較）を `ttRankHtml` で表示。エントリー画面の `#ttPeriod` で `?period=` を切り替え（`ttChangePeriod`）、`info.event.active` なら既定 event。イベント期間は CiDAO `/admin/timetrial` の EventForm（`app_settings` key `metaverse_tt_event`）。検証は `?notiles=1` で `ttStart` を直接呼ぶ（`ttNameInput` はモーダル生成時にしか無いので先に作る）
- **⏱ サーバー公式計測（厳密競技モード・2026-08-20追加）**: CIDAO `POST/GET https://cidao.vercel.app/api/metaverse-tt`（`C:\Repos\cidao src/app/api/metaverse-tt/route.ts`）。計測開始の瞬間に start→trialId取得、通過ごとに checkpoint、ゴールで finish。**タイムはサーバー時計（finished_at−started_at）で確定**し、順序違反・物理的に速すぎる通過は flags 記録→status=flagged（証明書と結果画面に「事務局確認対象」表示）。記録コードはサーバー発行。エントリー画面に上位3位ランキング表示（GET、名前はttEscでエスケープ）。API不通時は端末計測の「参考記録」へ自動フォールバック。DB: `metaverse_tt_trials`（migration `20260820120000_metaverse_time_trial.sql`・**2026-08-20適用済み**・RLS有効でanon不可・service_roleのみ）。通過報告は直列キュー（並行送信だと到着順が入れ替わり順序チェックに弾かれるため）。**事務局の記録管理は CiDAO `/admin/timetrial`**（コース別ランキング・フラグ付き記録・未完走一覧・個別削除・全リセット=「リセット」入力＋confirm。実装は `src/app/admin/timetrial/`）。GitHub Pagesの旧HTMLキャッシュ（〜10分）に注意
- **参加要件のイベント別設定**（2026-08-20追加）: 正答率％・最低解答数は CiDAO `/admin/timetrial` の「⚙ 参加要件」から変更（`app_settings` key `metaverse_tt_requirements`）。API GETが `requirements` を返し、サイトの`openTtModal`が参加判定に使用（不通時は TT_CONFIG の既定80%/10問）。サーバーのstart受付も同じ値で判定
- **🔀 用途モード**（2026-08-20追加）: `?mode=event`/`?mode=bousai` で入り口分岐、パラメータなし初回はモード選択画面（localStorage `cbi-meta-mode-v1` に記憶・☰メニュー「🔀 モード切替」で変更）。イベント=文化財系表示・防災系（避難所トグル/floodControls）非表示。防災=ゲーム系（puzzleBtn/reportsBtn/pinToggle/pickMode/ttBtn）非表示・避難所ピン自動ON・浸水シミュ表示・文化財ピンOFF。cinemaパラメータ時は選択画面を出さない。災害MAPヘッダーのリンクは `?mode=bousai` 直行
- **2D災害MAPとのデータ共有**（2026-08-19）: `bunkazai.json`／`kominkan.json` は `inzai-disaster-map/` の「参考: 文化財」「参考: 公民館」レイヤーからも読まれる（相対パス `../metaverse/`）。**ファイル名・キー構成を変える場合は災害MAP側（app.js の ensureBunkazaiLayer/ensureKominkanLayer）も更新すること**。避難所は両者ともCIDAO APIを共有

- **🛰 他の利用者の位置（光点）＋定型スタンプ**（2026-09-02追加・交流機能の段階2＋3の一部）: Supabase Realtime の Presence チャネル `metaverse-world` に自分の位置（経度・緯度・高さ・向き）を**移動したときだけ約1.5秒ごと**に載せ、他の画面はそれを**向き付きの矢印**（`billboard` の `alignedAxis` に、東北上フレームで作った水平の向きベクトルを渡す）＋「利用者NNN」ラベルで描く（位置も向きも受け手側で1.5秒かけて補間。向きは最短回転）。番号は在席表示と同じ匿名セッションID（`cbi-meta-presence-id`）から作り、名前入力はない。会話は画面下の**定型スタンプ4種のみ**（👋こんにちは／✨ここ面白い／🏛いっしょに行こう／👍いいね）で自由入力なし＝見守り不要の設計。スタンプは Broadcast で送り、相手の光点の上に4秒表示＋画面下のフィードに残す。**DBには何も書かず**（Presence はメモリ上）、切断すれば消える。接続先 URL／anon キーは `index.html` に直書き（cidao の `NEXT_PUBLIC_*` と同じ公開値）。`?cinema=1` では繋がない。CDN（jsdelivr）が読めなくても3D表示は動く。スタンプバーは同行者が1人以上いるときだけ出る。**同行者リスト（2026-09-03）**：`#rtPeers` を `rtRenderPeerList`（1秒おき）で描く。`rtRelTo` で自分の向き基準の方向語・8方位・距離・高低差。行クリックで `camera.setView` の heading をその人へ。印は `RT_BIRD`（上から見たトンビのSVG・頭が進行方向）で `scaleByDistance: NearFarScalar(300,1.0,6000,2.4)`。目的地カードの画像は `TT_CARD_IMG_KEY` で写真／精霊を切り替え（`ttSwitchCardImg`）。**ブラウザペインでは Cesium のフレームが進まず視覚確認できない**ため、2026-09-02時点の検証は JS からの状態確認のみ（実機2台での目視確認は未了）
- **🪶 軽量モード**（2026-09-02追加）: ☰メニューの「🪶 軽量モード」／URL `?lite=1`（`?lite=0` で解除）／描画の10秒平均が12fps未満のとき1回だけ出る案内、の3経路。ON で解像度倍率 0.6・`maximumScreenSpaceError` を 24 以上（管理画面の値より粗い側）・空の大気表現 OFF・FXAA/MSAA OFF・30fps 上限・トンビ OFF。選択は `localStorage` の `cbi-meta-lite` に残る。`applyRenderQuality`（管理画面の描画精度）は `liteApplyTileset()` 経由で反映するようにした。診断パネルに「軽量: あり/なし ／ 同行者: N人」を追加

- **🛍 お店ピン**（2026-09-02追加）: FreeFree掲示板（CiDAO）で「🗺 メタバース印西にお店のピンを出す」を選び住所を入れた掲載を、`https://cidao.vercel.app/api/metaverse-shops`（公開・CORS=github.io/localhost 8765-8767/4173・サーバー2分キャッシュ）から取得して `shop-N` エンティティで描く。API は掲載中（`status='active'` かつ期限内）のものだけ返すので、期限切れの扱いはメタバース側で持たない。クリックで情報パネルに店名（団体名または掲載者のSNS表示名。個人氏名は出ない）・掲載タイトル・所在地・「📋 FreeFree掲示板の掲載を見る」・リンクボタン（`#spotInfoLinks`。ホームページ／オンラインショップ／SNS）を出す。**`openEntityById` の先頭で `#spotInfoLinks` を空にし `spotInfoLink` の文言を既定に戻す**（他の種類のピンへ残さないため）。住所→緯度経度は CiDAO 側の保存時に国土地理院APIで変換（`src/lib/geocode.ts`）。**CiDAO の Supabase で migration `20260902200000_freefree_metaverse_pin.sql` が未適用だと API は `{shops:[]}` を返す**（メタバースは止まらない）。実装は `C:\Repos\cidao` の `src/app/api/metaverse-shops/route.ts`・`src/app/freefree/actions.ts`・`new/_components/NewFreefreeForm.tsx`
- **🔀 めぐりモード（4択）**（2026-09-02に2択→4択）: `event`（文化財めぐり）／`shop`（お店めぐり：お店ピンのみ、文化財ピンとゲーム系ボタンは隠す）／`bousai`（防災：従来どおり）／`all`（文化財＋お店＋公民館）。`MODE_LIST` が正。`?mode=shop` `?mode=all` も可。個別トグルはどのモードでも使え、モードは初期状態を決めるだけ。在席APIへ送る `mode` は未知の値を `event` に丸めるので `shop`/`all` は3D側の人数に含まれる

- **🎬 プレイ動画モード（`?cinema=3`・2026-09-02追加）**: SNS告知用の「実際に遊んでいる画面」を自動で作る。`startPlayDemo()` が通常の移動処理（`keys["KeyW"]`／`joyState.dy`）と視点回転を自動操縦し、文化財2か所（`?pair=0,39`＝宝珠院観音堂→いなざき獅子舞）を **らせん上昇（旋回しながら＋22°で200m）→滑空（残り距離で上空92mへ）→精霊出現→ゲット** の段階制で通過する。旋回中はカメラを24°ロールしトンビも傾ける（`?roll=0` で画面は水平のまま）。目的地以外の精霊が出てもゲットして進む。テロップと終了画面のフェードは rAF（timeweb の仮想時間では CSS transition が進まないため）。録画は `scripts/promo/record_play.mjs`（puppeteer＋timeweb で1フレームずつ→ffmpeg。本番URLで1回＝root request 1回・実時間20〜30分）。経緯と落とし穴は保管庫ノート [[cidao/2026-09-02_メタバースプレイ動画の自動生成]]
- **🦅 旋回のバンク（通常操作・2026-09-02追加）**: 飛行モードで機首を回す（右スティック・ドラッグ）か横移動すると、トンビが曲がる側へ最大22°傾き、**画面（カメラのロール）も最大20°傾く**。まっすぐ飛ぶと毎秒40°で水平へ戻る。歩行モードでは傾けない。回る速さはフレーム時間で暴れるので 8:2 で平滑化（`yawTiltSmooth`）。Cesium のロールは正で右翼が下がる向き。実装は主ループの `cameraBankEnabled` ブロック（プレイ動画モードは自前で傾けるため false にする）。**実機コントローラーでの確認は未了**

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
2. APIキー（index.html内のGoogle Maps APIキー）は出力・新規ファイルへ複製しない。リファラ制限・API制限は適切に設定済みと確認済み（2026-08-16）。**Map Tiles の課金は¥0**（2026-09-02に請求明細CSVで検証。8月の Photorealistic 3D Tiles は**108回・¥0**で、無料枠1,000回/月の11%）。単価は $6.00/1,000イベント・無料枠1,000/月（SKU C6E1-98B2-DBD0）、無料枠のリセットは**毎月1日 日本時間16:00**（太平洋時間0時／冬時間は17:00）。**⚠ `creators-map` プロジェクトの請求額（8月¥316）を「メタバースの費用」と読まないこと**：その正体は Gemini API の画像生成で、同プロジェクトには20サービスが同居している。予算アラート「メタバース Map Tiles 月額」も名前に反して**スコープはプロジェクト全体**。課金を語るときは請求明細のSKU行を根拠にする。検証の記録は [[cidao/2026-09-02_MapTiles課金の6か月履歴と切り分け]]（2026-09-01の [[cidao/2026-09-01_MapTiles課金の実態と検証モード]] の課金診断は誤りなので参照しない）
3. **UI・ピン・操作の確認は `?notiles=1`（検証モード）で行う。** 3Dワールドは1回開くたびに root request（課金対象・**1日30回まで**）を1回消費するため、街並みが要らない確認では読み込まない方が速く、枠も減らない。〔2026-09-02訂正：導入時に「本番での繰り返し確認が9月予算の10%＝¥100を使った」と書いたが**誤り**。8月のrootは月108回で無料枠1,000の11%にすぎず、その¥100はGemini APIだった〕検証モードでは3D Tilesを読まないため root を消費せず、ピン・メニュー・コントローラー操作・トンビはすべて動く（ローカルでも従来出せなかったピンが表示される）。街並みごと見たいときだけ通常URLを使う
4. 既存機能（図鑑・ピース獲得・歩行/飛行モード・スポット移動）を壊さない。変更後は既存機能の動作確認をする
5. ローカル検証は `python -m http.server` 等でsite/を配信する。**3D TilesはAPIキーのリファラ制限で403**になるため、街並みの見た目は本番でのみ確認可能。ただし `?notiles=1` を付ければピン・UI・操作はローカルで完全に確認できる（403でピンが出ない問題も解消する）
6. `viewer` や `BUNKAZAI` はスクリプトスコープの変数（`window.viewer` ではアクセス不可。コンソールからは裸の識別子で参照）
7. **ブラウザペインが非表示だと canvas サイズが0になり、Cesium の座標計算・pick・`drillPick` がすべて失敗する。** 「ピンが拾えない」ときはまず `document.hidden` と `canvas.clientWidth` を疑うこと（実装の欠陥と誤診しやすい）

## 関連文書

- 保管庫ノート: `cidao/proposals/2026-08-16_印西市災害状況整合MAPとSNS巡回.md`（浸水シミュレーションの設計判断・メタバース節）
- 課金監視: `cidao/2026-08-16_GoogleMapTilesAPI課金の監視手順.md`
- 防災MAP側: `inzai-disaster-map/CLAUDE_HANDOFF.md`
- **費用ゼロ運用**（2026-08-21・**✅ 2026-09-02 に Service Usage API で実効値を検証済み**）: Google側で 3D Tiles root requests per day=**30**（利用者上書き30・既定は10,000）。課金対象を無料枠1,000/月以下に構造的に抑える設計で、**8月実績は月108回・¥0**と機能している。renderer の実効値も **500,000/日**（上書き）で記載と一致。**割り当て自動調整（Quota adjuster）は ENABLED なので、rootの上書き30が上書きされ続けていないかを月次で見ること**。確認は画面ではなく `powershell -File scripts/gcp-maptiles-audit.ps1`（既定値・実効値・上書き値が一度に出る）。超過時は root.json が429→`showError` が「本日の3Dワールド利用枠に達しました」を表示（故障表示ではない）。renderer（タイル本体）は無償だが1日の回数上限があり、**Google既定の3万回では8/20・8/23に実際に枯渇したため 2026-08-23 に 500,000回/日 へ引き上げ済み**（Cloud Consoleで即時承認・無償のため費用は増えない。経緯は [[2026-08-23_MapTilesクォータ引き上げ申請]]）。実測1人あたり4,000〜8,000回なので**1日60人程度が目安**。**この値を変えたら CiDAO の `RENDERER_LIMIT_PER_DAY`・`site/admin/admin.js`・`site/metaverse/index.html` のフォールバック値も必ず合わせること**（警告の閾値がずれる）。イベント日は当日朝に **root** を一時引き上げる運用（運営方針ノート参照）。予算アラートは月1,000円・10/50/100%
- **🖼 描画精度（maximumScreenSpaceError）**（2026-08-22）: 既定 **8**（`loadTileset` のオプション）。以前は未指定でCesium既定の16だったため「建物が平べったい」状態だった。**管理画面 CiDAO `/admin/timetrial`「🖼 3Dの描画精度」から 4／8／16／32 に変更でき**（`app_settings` key `metaverse_render_quality`）、`/api/metaverse-usage` の `maximumScreenSpaceError` として配られる。サイト側は `applyRenderQuality()` が実行中の tileset に代入するため**再読み込み不要・開いたままの画面にも5分以内**に反映。`usageFetch` が `loadTileset` より先に走る場合に備えて `pendingSse` に保持し読み込み完了後にも適用する。**値を下げるとタイル取得が2〜4倍に増え renderer の1日上限（3万回）に早く達する。課金は root 単位なので費用は増えない**。イベントで同時利用が多い日は16〜32へ上げること
- **📊 本日の利用状況チップ**（2026-08-21）: `#presenceChip` に人数＋`https://cidao.vercel.app/api/metaverse-usage`（公開・認証不要・CORS=github.io/localhost:8765）の `visitorsToday`（metaverse_presence_daily・JST日）／`rootLimitPerDay`=30（定数・Console設定と手で同期）／`todayRequests`（Cloud Monitoring・**太平洋0時=日本16時リセットのクォータ集計日**基準・サーバー120秒キャッシュ）を5分ごとに表示。実装は `C:\Repos\cidao src/lib/map-tiles-usage.ts`＋`src/app/api/metaverse-usage/route.ts`。root枠をConsoleで変えたら ROOT_LIMIT_PER_DAY も変えること
