# CBIメタバース印西 引継ぎ

## 2026-09-13 🏠 武蔵屋めぐり（11/3 武蔵屋マルシェ用）

実装は `musashiya.js`（別ファイル）＋文面 `musashiya-texts.json`（キー＝bunkazai.json の reportId、kids／adult の2種）。index.html 側は ☰「あそぶ」の `#musashiyaBtn`・`CLOSE_AFTER`・`applyMode` の表示リスト・`<script src="musashiya.js">` の4点だけ。武蔵屋（岩井家住宅主屋）→ 4km以内の19件から座標の重複を除いてランダムに3か所（武蔵屋から最近傍順）→ 武蔵屋ゴール。**タイムトライアルの仕組み（ttActive／ttCourse／ttPos／onTick の通過判定）をそのまま使い**、`ttServerStart`／`ttServerCheckpoint`（何もしない＝サーバーに記録しない）・`ttSpiritPass`（通過ポップアップ）・`ttShowCard`（次の目的地カード）・`ttFinish`（ゴールのポップアップを残す）・`ttAbort` を `msyState.on` の間だけ差し替える。**これらの関数名や onTick の順序（ttSpiritPass → ttPos++ → ttFinish）を変えるときは musashiya.js も直すこと**。会場では `?mode=event&event=musashiya` で、受付（CiDAO照合）後に開始画面が自動で出る。開始画面・ポップアップはコントローラー（○＝決定、←→＝こども／おとな）と Enter／Esc でも操作できる。検証は `?notiles=1` で `msyStart('kids')` → `ttCountdownEnd=0` → 目標へ `camera.setView` → `viewer.clock.onTick.raiseEvent(viewer.clock)` を4回（ペインが非表示でも通る）。**同日追記（版 b）**：開始位置は `goHome()`＝武蔵屋の南約50m（`HOME_BACK_DEG`）・地面＋14m（`sampleHeightMostDetailed`、取れなければ楕円体高60m）で北向き。`eventLook()` が白鳥（`setSwanVisible(true)`）と BGM（`bgmPreset="swanlake"`・`bgmCustom=null`。localStorage は書き換えない・`bgmUserOff` なら流さない）を設定。イベントURLでは自動再生の制限のため最初の pointerdown/keydown で流す。**版 c**：`ttShowCard` の差し替えはカードを出さない（開始直後に精霊の絵が大きく出たため）。`#ttHud` は `placeHud()` で `#topLeftBar` の下へ（`body.msyOn` の間）。こども用は `speakKids()` が `speechSynthesis` で読み上げ（声は ja の Keita→Ichiro→先頭。`speechText()` が「漢字（よみ）」を読みだけにする）。`?event=musashiya` では `showEncounter` を無効化。**版 d（モード分離）**：`MODE_LIST` に `musashiya` を追加し、モード選択画面にも「🏠 武蔵屋イベント」を置いた。`applyMode("musashiya")` は `body.modeMusashiya` を付け、`#musashiyaBtn`（`#topLeftBar` 直下・常時表示枠）だけを出し、`ttBtn`／`nightBtn`／`nightTourBtn`／`nightTtBtn`／`tbGroupPins`／`tbGroupPlay`／`panelToggle`／`puzzleBtn`／`tonbiToggleBtn`／`shopToggleBtn` を隠して `window.msyEnterMode()` を呼ぶ（別モードへ移ると `msyLeaveMode()`＝走行中なら中止）。musashiya.js は `inEventMode()`（body クラス、または旧 `?event=musashiya`）で判定する。**会場URLは `?mode=musashiya`**。**版 f**：開始は `start()`→`state.waiting`（`ttActive=false`・HUDに「○でスタート」）→ `readyGo()`（○／Enter）で `ttActive=true`・3.5秒カウントダウン。開始位置は地面＋3m（`HOME_CLEARANCE_M`）、index.html の `keepAboveGround` は `window.flightClearanceM`（モード中 3）を見る。地面が取れないときは楕円体高45mに置き、`settleToGround()` が取れ次第降ろす。`startAltTimer()` が `#ttHud` に `#msyAlt`（地上からの高さ）を足す。`placeSwanBtn()` が `#swanToggleBtn` を常時表示列へ移す（離脱時に戻す）。声は `state.voice`（male/female・`VOICE_NAMES`）、`speak()` が `bgmDuck()` で BGM を 0.08 に下げ、終了で戻す。説明文は2026-09-13時点で**下書き（中司さん確認前）**。武蔵屋自身の写真は無く精霊カードで代用中（9/19の現地確認で岩井さんの許可を得て撮影予定）。

## 2026-09-10 地面侵入ガード

flight-ground.js共通化。通常/2Pとも描画前に高さを確認し、移動距離8mごと（最大8点）に地表を確認。飛行では地表+12m、歩行は目線高。地形不明は直前位置へ戻し下降を止める（見回し・上昇可）。静止中も150msごと再取得して到着タイルを反映。モデルEntityを高さ取得から除外。500m超の位置ジャンプは移動経路ではなく終点を確認。notiles検証モードは除外。位置補正でdirection/upを保持し宙返りを維持。

verify-swan-flight.cjsで下降/地形不明/遅延地形取得/姿勢保持と、PC・縦画面追従、BGM9項目・白鳥アイコンを確認。既存の後退禁止（95efbc2）は維持。実地の全地形を網羅した衝突保証ではなく、読込済みタイルの高さによる保護。

## 2026-09-10 2P受付を後段へ・BGM管弦楽版

通常の受付と右上チップは本人のみ。vsRaceModeEnabled時だけ2人目タブを出す。vs-raceのモード開始イベントで未受付P2へ案内し、「1人目と同じ登録」または「別の人（会員証QR・表示名）」を選択。P2のLINEログインは従来どおり提供しない（P1のLINEセッションを上書きしないため）。beginCountdownにも共通ensureVsReceptionを追加し、ボタン以外の開始経路も受付を確認。練習モードはP1のみ。モード退出でチップを本人表示へ戻す。版20260910-2。

ユーザー指定でオルゴール版MP3を削除。選曲キーswanlakeはそのまま、CMSL/ANDO TOWAの第2幕「情景」2023（管弦楽デジタル音源、202.632秒）へ交換。無加工MP3、CC BY 2.1 JP、出典とライセンスを曲選択画面・audio/README.mdへ記載。追加課金0。Playwright: ../_workspace/verify-reception-bgm.cjs に通常受付→別人P2→同一登録→未受付開始阻止→開始→退出、スマホ表示、BGM再生停止のテスト。全通過、有料タイル要求0。

## 2026-09-10 白鳥の画面追従・白鳥の湖BGM

通常画面の白鳥はEntity更新と飛行onTickの順序差を吸収するため、scene.preUpdateで実モデルのmodelMatrixを最新カメラへ同期。OFF時にリスナーも解除。表示位置は18m前/4m下から18m前/1.26m下へ移動し、縦画面では距離を調整。scale 0.42・バンク・アニメ・2P判定は維持。検証は ../_workspace/verify-swan-flight.cjs（PC/縦画面で毎フレーム35m前進+旋回、実描画モデルの投影位置を確認）。有料タイル取得は遮断。

音メニューの選曲へ「白鳥の湖（オルゴール）」を追加。ST303のCC0録音（Freesound 171046）公開MP3、約36秒をループ。オーケストラ版ではない。音源取得費0円、出典はassets/audio/README.md。既存選曲と停止設定を変更せず、手動選曲で再生する。会話画面の過去ログは復元していない。

## 2026-09-09 通常画面の白鳥バンク・サイズ

白鳥に旋回バンクがなかったためupdateTonbiの入力・yawTiltを白鳥にも適用。局所前方軸まわり最大22度、時定数0.2秒で傾き・復帰。カメラ姿勢は変更せず宙返りを維持。solo-swan scale 0.65→0.42（約35%縮小）。2Pモデルと捕捉判定は変更なし。

## 2026-09-09 あそぶ白鳥・操作平滑化・宙返り

「あそぶ」に本埜の白鳥を追加。通常画面でカメラ前方18m/下4mに既存swan GLBを表示し羽ばたかせる。トンビと排他、OFF時モデル削除・時計復元、軽量/防災/2P入口で停止。選択時は飛行モードへ。地図を追加取得する処理なし。

flight-input.js共有: スティック中央の感度を穏やかにし、入力追従0.16秒/停止0.07秒の指数平滑化。通常飛行と全2Pイベントの回転はCesiumのローカル軸を使用し、ピッチ制限を撤去。右スティック上下を保持して宙返り可能。歩行の視点制限は維持。通常飛行の自動水平バンク補正は宙返りを打ち消すため停止。1フレームdt上限0.1秒で低FPS時の飛びを軽減（低FPSそのものは解消しない）。足モデルや鳥形状は変更なし。検証: 入力単体・通常画面白鳥/切替/軽量停止・Cesium360度回転通過。有料タイル要求0。

## 2026-09-09 翼・尾の厚みと足

版20260909-4。翼根の半厚0.055→0.145、先端は薄く維持。羽弁の半厚0.003→0.012、丸棒用ではなく扁平断面の法線を維持。尾根の覆羽ボリュームと尾羽の段差を追加。体のbodyメッシュへ左右の足を追加: 鳶は畳んだ脚・3前指と後指・暗い爪、白鳥は後方に伸びる暗い脚・3指・水かき。足は飛行姿勢固定で着陸動作や独立リグは未実装。プレビュー「下から」追加。GLB検証に左右足・翼尾厚みを追加。両種構造・法線・4方向・腹側拡大・羽ばたき・モバイル確認済み。追加購入なし。

## 2026-09-09 くちばしの輪郭修正

版20260909-3。鳶とコハクチョウの既取得の実写顔写真を再確認。楕円体2個のくちばしを廃止し、断面を補間した連続曲面へ変更。鳶は先端が細く下へ曲がる形、白鳥は額から下る長い扁平形と基部側面の黄色斑。鼻孔の暗色面と口の合わせ目を追加。目の突出は0.023から0.009へ減らし頭部表面へ追従。GLBテストに座標有限・法線単位長チェックを追加して両種通過。全体の写実完成ではない。

## 2026-09-09 目の実写比較

版20260909-2。目は浅い曲面に虹彩と瞳孔を頂点色で一体化し、細い上下のまぶたを追加。鳶は黄色い輪を廃止して赤茶の放射状濃淡、白鳥は暗色・横長。別球の瞳孔は廃止。元写真のweb/CUA取得は失敗したが、Playwrightで表示・スクリーンショット取得し実際に比較できた。参照写真はGLB/公開サイトへ転用していない。全身モデルの写実完成を意味しない。

参照: https://commons.wikimedia.org/wiki/File:Milvus_migrans_lineatus_head.JPG / https://www.hlasek.com/cygnus_columbianus_c0540.html 。顔拡大テスト画像は C:/Users/nsfactory/OneDrive/CBI/_workspace/{kite,swan}-eye.png 。

## 2026-09-09 鳶・白鳥の翼形状

20260909-1。鶴ではなく白鳥が対象。種別に肩・肘・手首の翼断面と初列風切の配列を分離。丸棒状の陰影の原因だった羽弁法線を薄い楕円断面に修正。鳶の尾を浅い切れ込みへ変更。既存モーフ・翼回転を維持。GLB約19.5/20.2MB。4方向画像と動作・モバイル幅、構造、捕捉テスト通過。写実完成ではなく、羽毛テクスチャの縮尺と体型の改善余地あり。

調査資料: 日本野鳥の会 https://www.birdfan.net/milvus_migrans/ (鳶のバチ型尾)、https://www.birdfan.net/cygnus_columbianus/ (コハクチョウ)、印西市 https://www.city.inzai.lg.jp/cmsfiles/contents/0000012/12500/09shiryouhen.pdf (白鳥の郷はコハクチョウ中心)。今回の頂点寸法は制作上の近似で、実測復元ではない。参照写真の再配布なし。写真の直接表示取得には失敗しており、写真との厳密照合は未完了。

## 2026-09-08 鳶柔軟翼・表示名称

鳶も承認済生成羽毛PNGと3モーフを適用。6秒周期で羽ばたきから滑空へ移行。JS/GLB版20260908-5。公開表示はユーザー指定「３Dワールド」へ置換。metaverseパスや内部IDは維持、過去の管理作業履歴は改変しない。

## 2026-09-08 白鳥柔軟翼・生成羽毛

JS/GLB版20260908-4。白鳥のみ胴体・頭・首・翼厚を調整。3種のモーフ（曲げ・折り戻し・ねじれ）を左右翼へ追加、肩回転に位相差を付けた2.2秒周期。待機/カウントダウン中も再生。swan-plumage.pngは組み込み画像生成1回の承認済素材。胴体へ適用、鳶は変更なし。GLB約22MB。Three.js4方向とモバイル、Cesium両翼行列の時間変化を確認、有料地図要求0。写実性はまだ試作水準。再生成はnode metaverse/assets/tonbi/build-models.cjs swan。

## 2026-09-08 捕捉2秒・通知・白鳥初期値

JS版20260908-3。HOLD=2で自動タッチ+1。被捕捉側の照準上に赤背景警告と進捗、成立後3秒被タッチ通知。8m接触ルールは維持。2P共通makePlayer.aircraft=swan、select初期値も一致。1Pの旧トンビ画像レイヤーは別実装で未変更のため「全イベントの白鳥化」はまだ完全ではない。新要望はオンライン複数人鬼ごっこ（ユーザー参加中はユーザーが鬼、分割不要）。未実装で部屋/権限/同期/退出時処理/課金見積が必要。写実モデルも未完了。

## 2026-09-08 羽ばたき停止修正

JS版20260908-2。runAnimationsは対戦中・非ポーズで常時有効（前後入力条件を撤去）。applyViewerRaceProfileで両viewerのclock.shouldAnimate=true、退出時に元値復元。ローカルPlaywrightで両Cesium ModelのgetNode('leftWing').matrixが無入力で350ms後に変わること、activeAnimations.length>0を確認。画像の見た目はユーザー要求未達で写実モデル置換は未完了。画像生成だけで可動3D完成を約束しない。

## 2026-09-08 開始位置・方向案内・2P地図

SkyTag.placeAtStartで同じ楕円体高240m、南北約600m、互いに正対する配置。vs-raceのSTARTが通常コース位置で上書きしていたためtag時は同じ関数に分岐。照準上に左右上下矢印・後方注意・高度/高度差/距離を追加。高度はCesiumの楕円体高で標高とは異なる。2Pのglobe.showをP1同様falseにし、タイル取得失敗や429の通知を右画面に残す。地図なしテストで検証し、実タイル取得は未検証。JS版20260908-1。写実モデルはユーザーが現モデル品質を却下しており未完了。現環境に3D生成ツールはなく画像生成のみでは可動3Dにならない。有料素材は購入・Web利用ライセンス・軽量化を要確認（VFX Grace鳶候補320USD）。購入未実施。

## 2026-09-07 羽ばたきGLB

鳶・白鳥を `assets/tonbi/*.glb` に変更。PBR羽毛テクスチャと法線、白鳥の連続曲面首、左右翼・首・尾の独立ノード、Wingbeatクリップを同梱。移動/加速入力中にアニメーション有効化。JS版20260907-4。`bird-preview.html` は地図なしのThree.jsモデル確認画面（種別・視点・羽ばたき・速度）。両モデル4方向、翼回転、モバイルをPlaywrightで確認。ゲーム側も有料タイル遮断で2P表示・白鳥切替を確認。まだ実写相当ではなく、写実性改善の余地あり。再生成手順と構造は `assets/tonbi/README.md`。

## 2026-09-07 タッチ・捕捉進捗

鬼ごっこは8m以内の接触で双方1点（練習時はP1だけ）、12m超で接触ラッチ解除。照準の3秒捕捉も維持し、中央に進捗／成功種類を表示。時間切れ後は加点しない。あそぶメニューに直接起動ボタン追加、JS版20260907-3。公開URLの内容で白鳥版の配信を確認済み。

## 2026-09-07 鳶・本埜の白鳥と宙返り

同日追記：新しい標準ゲームパッド2台に合わせ、2Pはnavigator.getGamepadsの標準axes/buttonsを直接使用。左スティック前後左右移動、右スティックピッチ／ヨー、L1/R1ロール、L2/R2下降／上昇、X/□加速。旧padRaw変換を経由しない。下記の左スティック左右ロールという記述はこの追記で置き換える。

`sky-tag.js` のモデルを丸い胴体・頭・目・くちばし・独立した羽へ詳細化し、本埜の白鳥を追加。各Pパネルで選択（相手画面の機体に反映）。鬼ごっこだけ、右スティックでピッチ／ヨー、左スティック左右でロール、上下で前後移動。Cesiumのカメラ局所軸回転を使いピッチ制限なし。相手の姿勢もカメラ基底からQuaternionに変換し宙返り・背面飛行を表現。両機体は同性能、得点条件は従来のまま。JS版 `20260907-2`。

## 2026-09-07 家族参加・ローカル起動

`night.js` の2人目受付に「1人目と同じ会員IDで参加」を追加。確認済み1Pの有効なトークンを2Pへ複製し、同一uidは表示名にP1/P2を付与。2P中も受付モーダルは表示する（操縦席HUDとは別）。`file:` で開くと照合APIのCORS・LINEの戻りURLに対応できないため、indexの先頭で公開HTTPSへ同じquery/hashで移動する。

## 2026-09-07 空中対戦の索敵スコープ

`sky-tag.js` の各Viewerに円形レーダーを追加。自分の水平進行方向が上、背後が下。相手の方向・3D距離・高度差を表示し、水平距離で500m/1km/2kmに自動切替、2km超は円の端に圏外表示。捕捉中は緑と進捗リング。再戦・モード終了で古いスコープを除去する。既存の位置情報だけを使い、追加API通信は行わない。読み込み版 `20260907-1`。

最終更新: 2026-09-05

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
- **🎮 2人対戦タイムレース**（2026-09-04追加）: 実装は **`vs-race.js`（別ファイル）**。`?mode=event&race=vs` は固定の都市コース、`?mode=event&race=cultural-vs` は文化財コース（既定: TT_CONFIG beginner）で起動。既存 `viewer` をP1、`#vsCesium2` の2つ目の Cesium Viewer をP2にして左右分割表示する。P1=Gamepad index 0、P2=Gamepad index 1 固定。`readGamepad(playerIndex)` は引数なし互換を残したまま index 指定対応済み。VS中は `window.vsRaceModeEnabled` により既存1P移動ループを止め、`vs-race.js` 側が2人分を `requestAnimationFrame` で操作する。運営UIはコース選択、P1/P2接続表示、READY、CENTER、INPUT、FPS、Goal数、切断時PAUSE、START、RESET、FULL、END（強制終了）。流れは READY → 3-2-1-START → 順番どおりのCP通過 → 先着を勝者表示 → 両者ゴール後に RESULT。結果は端末内 localStorage `cbi-meta-vs-race-results-v1` に直近50件保存（サーバー公式ランキングは未実装）。`?race=solo` は既存タイムトライアルを直起動。検証はローカル `?notiles=1` でHTML/JS/文化財データ読み込みHTTP 200まで確認。**ゲームパッド2台での実機操作・会場PCでのFPS・本番3D Tiles込み表示は未確認**。
- **⏱ 計測中のナビ（2026-09-03追加）**: HUD に次の地点への矢印（`ttBearingToNext`・自分の向き基準の相対角）と「右前（北東）」の言葉、「📍 次の地点のピンだけ表示する」スイッチ（`#ttOnlyNext`・既定ON・`ttApplyPinFocus` で `setPinVisible`）。通過ごとに次のピンへ切り替え、`ttFinish`／`ttAbort` の `ttRestorePins` で📍ボタンの状態へ戻す。次の目的地カード（`#ttCard`・画面左下の独立ボックス・`ttShowCard`：写真 or 精霊カード＋解説要約＋出典、20秒で自動的にたたむ・タップで開閉）と、画面上の目印（`#ttTarget`・`ttUpdateTargetMarker`：見えていれば真上に⬇、画面外なら縁で➜がその方向を向く）も同じタイミングで更新。**順位と期間ランキング（2026-09-03）**：ゴール時に API の `rank`（all／month／event、同じニックネームは1人・ベストで比較）を `ttRankHtml` で表示。エントリー画面の `#ttPeriod` で `?period=` を切り替え（`ttChangePeriod`）、`info.event.active` なら既定 event。イベント期間は CiDAO `/admin/timetrial` の EventForm（`app_settings` key `metaverse_tt_event`）。検証は `?notiles=1` で `ttStart` を直接呼ぶ（`ttNameInput` はモーダル生成時にしか無いので先に作る）
- **⏱ サーバー公式計測（厳密競技モード・2026-08-20追加）**: CIDAO `POST/GET https://cidao.vercel.app/api/metaverse-tt`（`C:\Repos\cidao src/app/api/metaverse-tt/route.ts`）。計測開始の瞬間に start→trialId取得、通過ごとに checkpoint、ゴールで finish。**タイムはサーバー時計（finished_at−started_at）で確定**し、順序違反・物理的に速すぎる通過は flags 記録→status=flagged（証明書と結果画面に「事務局確認対象」表示）。記録コードはサーバー発行。エントリー画面に上位3位ランキング表示（GET、名前はttEscでエスケープ）。API不通時は端末計測の「参考記録」へ自動フォールバック。DB: `metaverse_tt_trials`（migration `20260820120000_metaverse_time_trial.sql`・**2026-08-20適用済み**・RLS有効でanon不可・service_roleのみ）。通過報告は直列キュー（並行送信だと到着順が入れ替わり順序チェックに弾かれるため）。**事務局の記録管理は CiDAO `/admin/timetrial`**（コース別ランキング・フラグ付き記録・未完走一覧・個別削除・全リセット=「リセット」入力＋confirm。実装は `src/app/admin/timetrial/`）。GitHub Pagesの旧HTMLキャッシュ（〜10分）に注意
- **参加要件のイベント別設定**（2026-08-20追加）: 正答率％・最低解答数は CiDAO `/admin/timetrial` の「⚙ 参加要件」から変更（`app_settings` key `metaverse_tt_requirements`）。API GETが `requirements` を返し、サイトの`openTtModal`が参加判定に使用（不通時は TT_CONFIG の既定80%/10問）。サーバーのstart受付も同じ値で判定
- **🔀 用途モード**（2026-08-20追加）: `?mode=event`/`?mode=bousai` で入り口分岐、パラメータなし初回はモード選択画面（localStorage `cbi-meta-mode-v1` に記憶・☰メニュー「🔀 モード切替」で変更）。イベント=文化財系表示・防災系（避難所トグル/floodControls）非表示。防災=ゲーム系（puzzleBtn/reportsBtn/pinToggle/pickMode/ttBtn）非表示・避難所ピン自動ON・浸水シミュ表示・文化財ピンOFF。cinemaパラメータ時は選択画面を出さない。**災害MAPヘッダーからの `?mode=bousai` リンクは 2026-09-06 に削除**（災害中の画面から3Dへ飛べるのは不適切とユーザー判断。防災モード自体は残すが災害MAPからは導線なし）
- **2D災害MAPとのデータ共有**（2026-08-19）: `bunkazai.json`／`kominkan.json` は `inzai-disaster-map/` の「参考: 文化財」「参考: 公民館」レイヤーからも読まれる（相対パス `../metaverse/`）。**ファイル名・キー構成を変える場合は災害MAP側（app.js の ensureBunkazaiLayer/ensureKominkanLayer）も更新すること**。避難所は両者ともCIDAO APIを共有

- **🛰 他の利用者の位置（光点）＋定型スタンプ**（2026-09-02追加・交流機能の段階2＋3の一部）: Supabase Realtime の Presence チャネル `metaverse-world` に自分の位置（経度・緯度・高さ・向き）を**移動したときだけ約1.5秒ごと**に載せ、他の画面はそれを**向き付きの矢印**（`billboard` の `alignedAxis` に、東北上フレームで作った水平の向きベクトルを渡す）＋「利用者NNN」ラベルで描く（位置も向きも受け手側で1.5秒かけて補間。向きは最短回転）。番号は在席表示と同じ匿名セッションID（`cbi-meta-presence-id`）から作り、名前入力はない。会話は画面下の**定型スタンプ4種のみ**（👋こんにちは／✨ここ面白い／🏛いっしょに行こう／👍いいね）で自由入力なし＝見守り不要の設計。スタンプは Broadcast で送り、相手の光点の上に4秒表示＋画面下のフィードに残す。**DBには何も書かず**（Presence はメモリ上）、切断すれば消える。接続先 URL／anon キーは `index.html` に直書き（cidao の `NEXT_PUBLIC_*` と同じ公開値）。`?cinema=1` では繋がない。CDN（jsdelivr）が読めなくても3D表示は動く。スタンプバーは同行者が1人以上いるときだけ出る。**同行者リスト（2026-09-03）**：`#rtPeers` を `rtRenderPeerList`（1秒おき）で描く。`rtRelTo` で自分の向き基準の方向語・8方位・距離・高低差。行クリックで `camera.setView` の heading をその人へ。印は `RT_BIRD`（上から見たトンビのSVG・頭が進行方向）で `scaleByDistance: NearFarScalar(300,1.0,6000,2.4)`。目的地カードの画像は `TT_CARD_IMG_KEY` で写真／精霊を切り替え（`ttSwitchCardImg`）。**ブラウザペインでは Cesium のフレームが進まず視覚確認できない**ため、2026-09-02時点の検証は JS からの状態確認のみ（実機2台での目視確認は未了）
- **🪶 軽量モード**（2026-09-02追加）: ☰メニューの「🪶 軽量モード」／URL `?lite=1`（`?lite=0` で解除）／描画の10秒平均が12fps未満のとき1回だけ出る案内、の3経路。ON で解像度倍率 0.6・`maximumScreenSpaceError` を 24 以上（管理画面の値より粗い側）・空の大気表現 OFF・FXAA/MSAA OFF・30fps 上限・トンビ OFF。選択は `localStorage` の `cbi-meta-lite` に残る。`applyRenderQuality`（管理画面の描画精度）は `liteApplyTileset()` 経由で反映するようにした。診断パネルに「軽量: あり/なし ／ 同行者: N人」を追加

- **🛍 お店ピン**（2026-09-02追加）: FreeFree掲示板（CiDAO）で「🗺 メタバース印西にお店のピンを出す」を選び住所を入れた掲載を、`https://cidao.vercel.app/api/metaverse-shops`（公開・CORS=github.io/localhost 8765-8767/4173・サーバー2分キャッシュ）から取得して `shop-N` エンティティで描く。API は掲載中（`status='active'` かつ期限内）のものだけ返すので、期限切れの扱いはメタバース側で持たない。クリックで情報パネルに店名（団体名または掲載者のSNS表示名。個人氏名は出ない）・掲載タイトル・所在地・「📋 FreeFree掲示板の掲載を見る」・リンクボタン（`#spotInfoLinks`。ホームページ／オンラインショップ／SNS）を出す。**`openEntityById` の先頭で `#spotInfoLinks` を空にし `spotInfoLink` の文言を既定に戻す**（他の種類のピンへ残さないため）。住所→緯度経度は CiDAO 側の保存時に国土地理院APIで変換（`src/lib/geocode.ts`）。**CiDAO の Supabase で migration `20260902200000_freefree_metaverse_pin.sql` が未適用だと API は `{shops:[]}` を返す**（メタバースは止まらない）。実装は `C:\Repos\cidao` の `src/app/api/metaverse-shops/route.ts`・`src/app/freefree/actions.ts`・`new/_components/NewFreefreeForm.tsx`
- **🔀 めぐりモード（4択）**（2026-09-02に2択→4択）: `event`（文化財めぐり）／`shop`（お店めぐり：お店ピンのみ、文化財ピンとゲーム系ボタンは隠す）／`bousai`（防災：従来どおり）／`all`（文化財＋お店＋公民館）。`MODE_LIST` が正。`?mode=shop` `?mode=all` も可。個別トグルはどのモードでも使え、モードは初期状態を決めるだけ。在席APIへ送る `mode` は未知の値を `event` に丸めるので `shop`/`all` は3D側の人数に含まれる

- **🎬 プレイ動画モード（`?cinema=3`・2026-09-02追加）**: SNS告知用の「実際に遊んでいる画面」を自動で作る。`startPlayDemo()` が通常の移動処理（`keys["KeyW"]`／`joyState.dy`）と視点回転を自動操縦し、文化財2か所（`?pair=0,39`＝宝珠院観音堂→いなざき獅子舞）を **らせん上昇（旋回しながら＋22°で200m）→滑空（残り距離で上空92mへ）→精霊出現→ゲット** の段階制で通過する。旋回中はカメラを24°ロールしトンビも傾ける（`?roll=0` で画面は水平のまま）。目的地以外の精霊が出てもゲットして進む。テロップと終了画面のフェードは rAF（timeweb の仮想時間では CSS transition が進まないため）。録画は `scripts/promo/record_play.mjs`（puppeteer＋timeweb で1フレームずつ→ffmpeg。本番URLで1回＝root request 1回・実時間20〜30分）。経緯と落とし穴は保管庫ノート [[cidao/2026-09-02_メタバースプレイ動画の自動生成]]
- **🌃 夜景フライトモード（`?night=1`・2026-09-04追加・イルミライINZAI 会場上映向け）**: 実装は **`night.js`（別ファイル）**。index.html 側は ☰メニューの「🌃 夜景」「🛸 夜間遊覧」ボタン・`applyLite` の空処理（`window.nightOn` を見る）・`?night=1` でモード選択画面を出さない・`<script src="night.js">` の4点だけ。中身：CustomShader で 3D Tiles を暗く青みがけ＋世界座標6m角セルの乱数で窓明かり／大気と太陽を切って星空／ブルーム（軽量モード中は OFF）／**空中のいんザイ君**（`assets/night/inzaikun_xmas.svg`＝クリスマス版の線画を canvas で画素サンプリングし最大2,400個の光点に。**素材はレーザー加工図案で線が「抜き（透明）」なので、円盤の内側の透明画素を線として拾う**）／くぐり判定（図柄平面の符号付き距離の反転）→弾け＋回数／駅〜BIG HOP の光の列（`sampleHeightMostDetailed` で地表高）／宇宙船コックピット HUD（CSS/SVG）／自動遊覧（`cinemaFlyTo` 流用・約50秒・操作で中断）。会場は `?night=1&tour=1&mode=event` で開くと UI を隠し、操作が150秒無いと遊覧を再開。**いんザイ君の図柄は市への使用申請が前提**（2026-09-04 方針：うまく機能したら申請）。ゲート位置・大きさは `GATE` 定数（`window.nightGate` で参照可）。検証はヘッドレス Chrome（`C:/COCoLa/scripts/promo` の puppeteer）で行い、ローカルはリファラ制限で 3D Tiles が 403 なので街並み込みは本番URLで確認する。保管庫ノート [[cidao/2026-09-04_メタバース夜景フライトモード（イルミライ向け）]]
- **🌃 夜景モード 第2版（同日追記）：いんザイ君ゲート10か所コース＋⏱ 夜景タイムトライアル**: 空中のいんザイ君は `night.js` の `COURSE`（10件・東の印西牧の原→西の千葉NT中央駅、各 lon/lat/height/design/color/size/flip）。図柄は `assets/night/inzaikun_{xmas,kihon,ongaku,placard}.svg` の4種を色替え・左右反転で10枚にし、**10番（`goal:true`）＝千葉NT中央駅の真上のクリスマスいんザイ君がゴール**。画像の読み方は自動判定（`sampleImage`：不透明率で「抜き」型／「インク」型を切り替え、赤い切り取り線は除外、図柄下のロゴ文字は空行で切る、A4の隅の小さな図柄は範囲を見つけて拡大し直す）。各ゲートは来る方向（前のゲート）を向き、番号ラベル（`LabelCollection`）付き。**通過判定は面をまたいだ距離200mまで許容**（60mだと低fps＋ダッシュで取りこぼした）。⏱ 夜景TT：`openNightTt()`（☰「⏱ 夜景TT」／T キー）→ニックネーム→`START_POINT` へテレポート→3.5秒カウント→順番どおりの通過のみ数え（順番違いは警告）、サーバーは既存 `TT_API` の **コース key `night`**（CiDAO 9f4359d：`COURSES.night = {checkpoints:10, minSecondsPerLeg:3, noQuiz:true}`、start で参加要件を免除、管理画面 `/admin/timetrial` に「🌃 夜景 いんザイ君ゲート（10か所）」）。結果は `ttRankHtml` と `ranking.night` の上位10を自前モーダル `#nightTtModal` に表示、端末内ベストは `cbi-meta-night-best-v1`。自動遊覧はコースをなぞって10ゲートをくぐり千葉NT中央駅へ降りる（約70秒）。検証は scratchpad の `night_tt_check.mjs`（`?notiles=1` で10ゲートを正面から撮影→TTをテレポートで通し→サーバー公式記録まで確認。**本番DBに記録が残るので、テスト行は `metaverse_tt_trials` から削除すること**（2026-09-04 は psycopg2 で削除済み））。検証用フック：`window.nightGateView(i)`／`nightGateCount()`／`nightCourse`／`nightTtState`
- **🌃 夜景モード 第3版（同日夕方）：CiDAO 登録者限定・方位案内・地中ロック**: ⏱ 夜景TT は **CiDAO ログイン必須**。入口の「🔐 CiDAO でログインして参加」→ `https://cidao.vercel.app/api/metaverse-auth?return=<メタバースURL>`（`TT_API` から導出）→ 未ログインなら戻り先を Cookie `mv_return` に覚えて `/login` → `auth/callback` が Cookie を見て `/api/metaverse-auth` へ → 会員の `display_name` 入り署名トークン（HMAC-SHA256・鍵は `METAVERSE_TOKEN_SECRET` か `SUPABASE_SERVICE_ROLE_KEY`・24時間）を **`#mtoken=` で付けて戻す**。night.js は `takeTokenFromUrl()` で localStorage `cbi-meta-cidao-token-v1` に保存しハッシュを消す。`start` に `token` を付け、サーバー（`COURSES.night.loginRequired`）が検証して **名前はログインの表示名で固定**（未ログイン・偽物は 401 → クライアントはトークンを捨てて中止しログイン画面へ）。⛔ 初回ログイン（表示名未設定→`/me/edit?welcome=1`）と退会復元の分岐が callback で先に走るため、その人はメタバースへ戻れない（plans 登録済み）。**方位案内**：通過テロップに `nextGateGuide()`（⬆右前（北西）642m ↑40m・文化財TTと同じ言葉）、画面上の目印 `#nightTarget`（`updateTargetMarker`：見えていれば真上に⬇、画面外なら縁で➜。文化財TTの `ttUpdateTargetMarker` と同型）。**地中ロック** `keepAboveFloor()`：夜景中は毎フレーム楕円体高 `NIGHT_FLOOR_HEIGHT`=70m（標高約34m）を下限、4フレームに1回 `sampleHeight`+3m も下限に（本体の `keepAboveGround` は12フレームに1回で低fpsのダッシュに間に合わなかった）。検証は scratchpad `night_tt_check2.mjs`（cidao の `.env.local` の鍵で正規／偽トークンを作って通す。**テスト行は削除すること**）。版 2026-09-04n・CiDAO 9ecdf8a
- **🌃 夜景モード 第4版（同日夜）：ゲートを10スポットの真上へ・操縦席の枠を撤去**（fe1617c）: `COURSE` は `name` 付きで、印旛日本医大駅→本埜公民館→小林駅→印西牧の原駅→ジョイフル本田→印西市役所→木下駅→松山下公園→イオンモール→千葉NT中央駅（ゴール）。座標は `SPOTS` と同じ値、高さは楕円体高160〜480m で交互に上下（標高約120〜445m）。`START_POINT` は印旛日本医大駅の東南東約700m。全長約20km（ダッシュ約3分・通常約11分）。番号ラベルにスポット名、通過テロップにもスポット名。**操縦席の枠（支柱・コンソール・周辺の暗いぼかし）と切替ボタン `#nightHudBtn` は撤去**（見にくいとの指摘。index.html のボタン要素は他セッションの未コミット変更を避けるため残し、night.js が `remove()` している。次に index.html を触るときに削ってよい）。左下の操作方法は `body.nightOn #helpBox{z-index:66;bottom:56px}`、夜景中は `#controlPanel` を隠し `#panelToggle` を出す。⛔ index.html の版表記は他セッション（2人プレース vs-race.js）の作業中で更新できず 2026-09-04p のまま。設計書・企画書は `_設計書の生成スクリプト_build_design_doc.py` が COURSE から再生成する
- **🌃 夜景モード 第5版：コース2本**: `COURSES = { full: 10か所（serverKey night）, short: 5か所（serverKey night5・牧の原駅→BIG HOP→ジョイフル→イオン→NT中央駅・約6km）}`。`courseKey` は `?course=short|full` → localStorage `cbi-meta-night-course` → 既定 full。`setCourse(key)`（`window.setNightCourse`）が光の粒とラベルを作り直す（レース中は不可）。参加画面のラジオで切替、ランキング・端末内ベストはコース別（key に `-full`/`-short` を付ける）。CiDAO 7995e6b で `COURSES.night5` と管理画面ラベルを追加。設計書の生成スクリプトは FULL_COURSE の正規表現に依存しているので、コース定義の形を変えたら合わせること
- **🌃 夜景モード 第6版（2026-09-05）：会場PC向けの参加方法・操作の改善**: (1) **右スティック**は夜景中だけ `padNormalize`（index.html の関数）を night.js が包み、軸2・3に「2乗×感度 `lookSens`（既定0.5）」を掛ける。感度は参加画面の select（localStorage `cbi-meta-night-looksens`）。(2) **タイムレースは準備OKの合図待ち**：`startTt` は `tt.waiting=true` でスタート地点に置くだけ、○／×ボタン（buttons[0|1]・`pollReadyButton`）かスペース／Enter で `ttReadyGo()` → `snapPadCenterNow(readGamepad())` で中心合わせ → 3.5秒 → 計測（サーバー start もこの時点）。待機中はゲート通過を数えない。(3) **参加方法を3つに**：`claim`（CiDAO API `metaverse-tt` の action）で **会員証QR（`/talent/<uuid>`・Webカメラ＋jsQR を jsdelivr から必要時読込）** または **表示名の入力**（両側 NFKC 正規化で比較・同名複数は 409 で断る）から12時間トークンを発行。LINE ログインは「別の方法」。CiDAO 8879b25／dfe86cb／9a60f0b。⛔ 表示名照合は本人確認が弱いので会場ではスタッフ立会い前提。members.display_name に一意制約は無い
- **🌃 夜景モード 第7版（2026-09-05）：参加受付（1人目／2人目）**: `?entry=1` で入場時に `openEntryModal()`、右上チップ `#nightEntryChip`（cinema 以外で常設）。トークンは1人目 `cbi-meta-cidao-token-v1`／2人目 `cbi-meta-cidao-token-p2-v1`（`getLogin(slot)`／`clearLogin(slot)`）。照合 `claim()` は `claimSlot`／`claimFrom` で戻り先を切り替える。**2人対戦への反映は vs-race.js を触らず、`window.vsRacePlayers[0|1].name` を1秒ごとに上書き**（`applyVsNames`）。vs-race 側が名前を保持・保存する仕様に変えるときは night.js のこの上書きと調整すること。版表示 `NIGHT_VERSION`（参加画面・受付画面の右下）
- **🌃 夜景モード 第8版（2026-09-05 夜）：受付の方針＝案B**：入場時の受付（`?entry=1`）は任意（閉じられる）。**会員照合が必須なのは、夜景タイムレース（1人目）と 2人対戦（1人目＋2人目）だけ**。2人対戦は night.js の `bindVsStartGate()` が `#vsStartBtn` の click を capture で先取りし、未受付なら受付画面を出す（vs-race.js は未変更）。一時的に入れた「entry=1 で受付必須」は 4507e36 で取り下げ。版表示 `NIGHT_VERSION`=2026-09-05g
- **🧭 上部ボタン群のカテゴリ別メニュー（2026-09-05整理・版 2026-09-05a）**: `#topLeftBar` は常時表示5個（`puzzleBtn`／`ttBtn`／`nightBtn`(+夜景ON時のみ `nightTourBtn`・`nightTtBtn`)／`modeSwitchBtn`／`howtoBtn`）＋4つの `.tbGroup`（`#tbGroupPins` ピン表示＝pinToggle/shelter/kominkan/shop、`#tbGroupPlay` あそぶ＝reports/map/vsRace/pickMode/tonbi、`#tbGroupSound` 音＝bgm/bgmPick/bgmFile、`#tbGroupSettings` 設定＝lite/traffic/pad*/noTiles/grid/shot/rec）。**ボタンの id・ハンドラは不変**（`applyMode` の display 切替や night.js の `.on` もそのまま効く）。PC は `.tbGroupBtn` クリックで `.open`（他は閉じる・外側クリック／Esc で閉じる・別画面を開く項目 `CLOSE_AFTER` は押した時点で畳む）、スマホの ☰ 内は CSS で見出し付きの縦一覧に平坦化（`.tbGroupBtn` は pointer-events:none）。**新しいボタンを足すときは該当グループの `.tbMenu` に入れる**（最上位に置くと1行に収まらなくなる）。録画中は `recStart` が `#recBtn` を最上位へ移し `#topLeftBar.recording` でグループを隠す（停止時 `recHome` で戻す）。右の `#controlPanel` は既定非表示で `body.spotOpen` のとき表示（`setSpotPanel`・localStorage `cbi-meta-spotpanel-v1`・PCのみ復元・防災モードは自動で開く）。`#panelToggle` は `#mvHeader .hdrRight`（戻るリンクの隣）へ移動（night.js の受付チップ `#nightEntryChip` が top:52px right:10px を使うため）。スマホでは従来どおり右上 52px に absolute。⛔ 既知の不具合（未修正・plans 登録）：`recStart` が `CAPTURE_HIDE_IDS` と個別リストの両方で `puzzleBtn`／`howtoBtn` を隠すため、復元順の都合で録画停止後もこの2つが消えたまま（HEAD 以前から）
- **🎫 入場枠（`admission.js`・2026-09-06 引き継ぎ採用）**: `loadTileset()` の先頭で `await window.ensureMetaverseAdmission()`。CiDAO `POST /api/metaverse-admission`（`launchId` UUID・同じIDの再送は枠を消費しない）が app_settings `metaverse_admissions_<太平洋日付>` に launchId を積んで数え、上限（既定30・app_settings `metaverse_admission` の `{limit:N}` で変更）に達すると 429 → お断り画面。サーバー不通も fail closed（要求しない）。`?notiles=1` は素通り。⚠ ヘッドレス検証でも枠を1回消費する。イベント日は Google の root 枠と一緒に `metaverse_admission.limit` も上げること（psycopg で `insert ... on conflict`、削除で既定30に戻る）。元は Codex セッションの「累計30回」実装（二度と入れなくなる設計）を日単位に直した
- **🎮 2人対戦 第2版（2026-09-06 引き継ぎ採用・Codex 作）**: `?race=tag` で「印西の空でおにごっこ」（`sky-tag.js`：2分間・前方7°／350m以内に相手を3秒とらえて1点・相手は自前の鳥 glTF）、`?practice=1`／運営パネル「P2なし確認」で P1 だけで開始確認。運営パネルの `#vsGameSelect` で race/tag 切替。対戦中は `hideRaceExternalUi()` が controlPanel・panelToggle・menuToggle・spotInfo・shipHud・nightTarget・nightTtModal・nightCap を隠し、`setNormalSpotEntities(false)` でスポット看板を隠す（`refreshPinShow` も vsRaceModeEnabled 中は spot- を出さない）。ヘッドレスで race/tag の起動を確認。**実機（パッド2台）未確認**
- **🌃 夜景の地上のあかり（2026-09-06・版 g）**: `nightShader` は写真の色で地表を分類する。`veg`（緑が赤・青より強い）／`soil`（暗い茶色）／`warmGround`（`step(c.b+0.03,c.r)*smoothstep(0.10,0.22,sat)`＝ゴルフ場の冬芝・砂地）を除いた明るめの面が `built`。`built` に市街地のにじみ（橙 0.26,0.17,0.06 × 40m セルの乱数）、壁面（`dFdx/dFdy(positionEC)` の幾何法線と `mat3(czm_view3D)*up` の内積で判定）に窓明かり 14%、屋根は近くで 3%・2.5km 以上で 14%（`roofRate`）、水平の無彩色面に街灯 7%。セルの大きさは距離で倍々（700m ごとに 2 倍）にして上空でも点が消えないようにした。**調整の経緯（同じ失敗をしないため）**: c 版＝屋根も窓扱い → 倉庫の屋根が窓だらけ・ゴルフ場が光る／d 版＝壁面のみ＋彩度除外 → ゴルフ場は消えたが住宅地まで暗い／e・f 版＝除外を赤み・明度で判定 → ゴルフ場が再び光る／g 版＝d の彩度除外＋距離で増える屋根の灯り＝採用。検証は本番でしか出来ない（localhost は Tiles 403）。`scratchpad/night_lights_check.mjs` の要領（受付を表示名で通す→`tileset.statistics.selected>0` を待つ→`setView`→撮影）で 1 回につき入場枠 1 を使う
- **🌃 高高度の明かり（2026-09-06・版 h）**: `far = smoothstep(1500, 6000, dist)` で、遠いほど `built` の明度条件を `0.22–0.45 → 0.13–0.28` に緩め、にじみを `mix(1.0, 2.6, far)` 倍、`roofRate` を最大 0.22 に。中司さんの「2,900m・斜め視点で光がほとんど見えない」指摘への対応。斜め視点はヘッドレス（swiftshader）ではタイルが 90 秒で揃わず撮れない（真下寄りの 4,000m は撮れる）。GLSL の文法確認は `scratchpad/glsl_check.mjs`（fragmentShaderText を抜き出して WebGL2 で単体コンパイル。Cesium 抜きで数秒・入場枠を使わない）
- **🏙 近距離の灯り（2026-09-06・版 i/j）**: `nearF = 1 - smoothstep(500, 1200, dist)` で近距離と遠距離の灯りを `mix(farLight, nearLight, nearF)`。近距離＝壁面の窓格子（`hgt = dot(p, up)` を 3.2m、壁に沿う座標 `along`（壁の法線が南北向きなら `ue`、東西向きなら `un`）を 2.8m で刻み、`winShape` で窓形に切り、建物ごとの `bId` を混ぜたハッシュで 45% 点灯）＋街灯の光だまり（`vec2(ue, un)/18` の格子、半分に街灯、`smoothstep(0.5, 0.08, length)` で丸く減衰。**明るい屋根に付かないよう `lum < 0.52` の暗いアスファルトだけ**）。近距離ではにじみを 0.45 倍。中司さんの「灯りの点は不自然」（ホテル前 97m）への対応。**壁面を正面から見る視点はヘッドレスで撮れていない**（斜め・低高度はタイルが 90 秒で揃わない）ので、実機で要確認。次の改善余地：窓の大きさ・点灯率・色は `3.2 / 2.8 / 0.55 / 0.65` の定数
- **🎵 夜間遊覧の BGM 自動再生（2026-09-06）**: `startTour()` 冒頭で `bgmStart()`（index.html のグローバル）を呼ぶ。`window.bgmUserOff`（BGM ボタンで止めたら true）が立っていれば鳴らさない。曲の選択は従来どおり `bgmPreset`／`bgmCustom`
- **👥 光点の名前（2026-09-06）**: `rtSendTick` が Presence の payload に `n`（`window.nightLogin(1).nick`、20文字）を載せ、受け手は `o.nick` を `rtName(o)` で表示（無ければ「利用者NNN」）。HTML に出す所は `rtEsc` でエスケープ。名前が変わったときも `rtMoved` が送り直す
- **📈 受付経由の登録数（2026-09-06・CiDAO 側）**: `/login` が utm を Cookie `cidao_signup_src`（24h）に覚え、`/api/metaverse-auth` の未ログイン分岐も `metaverse:auth:line` を置く。`auth/callback` は作成 30 分以内の会員で `signup_source` が空のときだけ `members.signup_source` に書く（既存会員が QR を読んでも数えない）。集計は `/admin/timetrial` 先頭。**初回ログインの戻り**: `auth/callback` の welcome 分岐は `/me/edit?welcome=1` のまま、`/me/edit` の保存後（と退会復元時）に `mv_return` Cookie があれば `/api/metaverse-auth` へ。Cookie は 30 分
- **🔐 入場受付の必須化（2026-09-06・CiDAO 加入の導線）**: `loadTileset()` の先頭 → `window.ensureMetaverseReception()`（night.js が定義するまで最大10秒待つ）→ `ensureMetaverseAdmission()`（入場枠）→ tiles の順。`RECEPTION_REQUIRED = !cinema && !notiles`。未確認なら受付（`openEntryModal(1)`）を必須モードで出し（閉じるボタン無し・Esc 無効・閉じられても0.5秒で再表示）、1人目の照合で `resolveReception()` → 読み込み再開（会場モードは遊覧も開始）。未登録者向けに登録QR（`SIGNUP_URL`＝cidao.vercel.app/login に utm_source=metaverse。qrcode-generator を jsdelivr から必要時読込・白地黒）。LINE ログインから戻った場合は `takeTokenFromUrl` が先に走るので受付を通る。放置解除（150秒）後は遊覧ではなく受付を出す。**防災モード（?mode=bousai）も受付必須になっている**（要判断：災害MAPからの平時導線）。効果測定（メタバース経由の登録数）は未実装：CiDAO 側で utm を members に残すか日次集計する予定
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
- **🎬 プレイ動画モードの落とし穴（2026-09-04）**: `?pair=full` の全50か所録画で、**同じ座標の2件**（観音寺鋳造鰐口30と弥陀一尊武蔵型板碑23）に着いたとき、近接判定が index 順に先の 23 を出現させて「目的地以外」としてゲット→次の目的地 23 が二度と出ず、周りを回り続けて33分の動画が無駄になった。`advanceTarget()` でゲット済みの目的地を飛ばすように修正。長い録画は `%LOCALAPPDATA%\cbi-partial-encode.sh`（30分ごとに途中経過を `_partial.mp4` へ書き出す）を並走させる。録画の制御は `cbi-rec-ctl.ps1 -Mode kill|start|status`
- **📶 通信量の実測（2026-09-03）**: 本番で `?cinema=3`（速さ×2.4の自動飛行）を90秒＝タイル3,730枚・**93MB**（圧縮後転送量・平均26KB/枚・描画精度8・1280x720）。飛び続けると約1MB/秒。イベントでテザリングするときの目安は1時間1〜2GB、10GBで4〜6時間。描画精度を24（軽量モード）にすると枚数が大きく減る。計測スクリプトは scratchpad の datameter.mjs（CDP Network の encodedDataLength を tile.googleapis.com で集計）
- **🖼 描画精度（maximumScreenSpaceError）**（2026-08-22）: 既定 **8**（`loadTileset` のオプション）。以前は未指定でCesium既定の16だったため「建物が平べったい」状態だった。**管理画面 CiDAO `/admin/timetrial`「🖼 3Dの描画精度」から 4／8／16／32 に変更でき**（`app_settings` key `metaverse_render_quality`）、`/api/metaverse-usage` の `maximumScreenSpaceError` として配られる。サイト側は `applyRenderQuality()` が実行中の tileset に代入するため**再読み込み不要・開いたままの画面にも5分以内**に反映。`usageFetch` が `loadTileset` より先に走る場合に備えて `pendingSse` に保持し読み込み完了後にも適用する。**値を下げるとタイル取得が2〜4倍に増え renderer の1日上限（3万回）に早く達する。課金は root 単位なので費用は増えない**。イベントで同時利用が多い日は16〜32へ上げること
- **📊 本日の利用状況チップ**（2026-08-21）: `#presenceChip` に人数＋`https://cidao.vercel.app/api/metaverse-usage`（公開・認証不要・CORS=github.io/localhost:8765）の `visitorsToday`（metaverse_presence_daily・JST日）／`rootLimitPerDay`=30（定数・Console設定と手で同期）／`todayRequests`（Cloud Monitoring・**太平洋0時=日本16時リセットのクォータ集計日**基準・サーバー120秒キャッシュ）を5分ごとに表示。実装は `C:\Repos\cidao src/lib/map-tiles-usage.ts`＋`src/app/api/metaverse-usage/route.ts`。root枠をConsoleで変えたら ROOT_LIMIT_PER_DAY も変えること
