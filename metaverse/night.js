// ============================================================
// 🌃 夜景フライトモード（イルミライINZAI 会場上映向け・2026-09-04）
// ------------------------------------------------------------
// Google Photorealistic 3D Tiles は昼の写真しか無いので、夜は「それらしく」作る。
//  - 街並み：CustomShader で暗く青みがけ、位置で決まる乱数で窓明かりをまばらに灯す
//  - 空　　：大気表現と太陽を消して星空（Cesium 標準のスカイボックス）を出す
//  - 光　　：ブルーム（にじみ）を掛け、光点（PointPrimitive）が電飾に見えるようにする
//  - 主役　：空中に いんザイ君 の光のゲートを **10か所**。印西牧の原（東）から千葉ニュータウン中央駅（西）へ
//            順にくぐり、最後の 10番＝千葉NT中央駅の上空の **クリスマスいんザイ君** がゴール。
//            図柄は手元の線画4種（基本形・音楽・プラカード・クリスマス）を色替え・左右反転で10枚にしている
//            （2026-09-04 中司さん決定）。線画の内側は空いているので、宇宙船（一人称カメラ）でくぐれる
//  - 競技　：⏱ 夜景タイムトライアル。スタート地点から10ゲートを順番にくぐりゴールまでの時間を、
//            既存のタイムトライアル基盤（CiDAO API `metaverse-tt`・コース key `night`）で公式計測し順位を出す。
//            API 不通時は端末内の参考記録。クイズの参加要件は夜景コースだけ免除（サーバー側も同じ）
//  - 演出　：宇宙船コックピットの HUD、くぐった瞬間の光の弾け、自動遊覧（コースをなぞってゴールへ）
//
// 入口：URL `?night=1`（会場は `?night=1&tour=1&mode=event`）／☰メニューの「🌃 夜景」「🛸 夜間遊覧」「⏱ 夜景TT」
//   tour=1 … 起動時に自動遊覧 → そのあと自由操縦。操作が 150 秒無ければ遊覧を再開（放置対策）
//   夜景中はキーボードの T でタイムトライアル画面を開ける
// index.html 側の変数・関数（viewer / tileset / NO_TILES / cinemaFlyTo / CAPTURE_HIDE_IDS / cameraBankEnabled /
// liteOn / INZAI_GEOID_HEIGHT_M / keys / joyState / TT_API / ttApiPost / ttFormat / ttRankHtml / ttEsc / ttMyName 等）を
// そのまま使う。このファイルは index.html の </script> の直後に読み込む（トップレベルの const/let は別スクリプトからも見える）。
//
// いんザイ君のデザイン使用：本番運用の前に印西市への使用申請が要る（2026-09-04 ユーザー方針：
// うまく機能するようなら市役所へ申請）。それまでは検証用途に限る。
// ============================================================
(function () {
  "use strict";
  const q = new URLSearchParams(location.search);
  const NIGHT_PARAM = q.get("night") === "1";
  const TOUR_PARAM = q.get("tour") === "1";
  const IDLE_RESTART_MS = 150000;           // 会場で放置されたら遊覧を再開するまでの秒数（150秒）
  const GATE_MAX_POINTS = 2000;             // 1ゲートあたりの光の粒の上限（10ゲートで最大2万）
  const NIGHT_BEST_KEY = "cbi-meta-night-best-v1";
  const NIGHT_LOCAL_RANK_KEY = "cbi-meta-night-local-v1";
  const LOGIN_TOKEN_KEY = "cbi-meta-cidao-token-v1"; // 1人目（P1）：CiDAO ログイン済みの署名トークン（/api/metaverse-auth が #mtoken= で渡す）
  const LOGIN_TOKEN_KEY_P2 = "cbi-meta-cidao-token-p2-v1"; // 2人目（P2）：2人対戦の相手。会員証QR／表示名の照合のみ（LINE は1人目だけ）
  const ENTRY_PARAM = q.get("entry") === "1";   // 入場時に参加受付を出す（会場向け）
  const NIGHT_VERSION = "2026-09-06i";          // 参加画面に出す版。反映されているかを一目で確かめるため
  // 入場受付の必須化（2026-09-06 中司さん指示）：CiDAO 登録者の確認が済むまで 3D都市データを読み込まない。
  // 撮影モード（cinema）と検証モード（notiles）は対象外。index.html の loadTileset() が ensureMetaverseReception() を待つ
  const RECEPTION_REQUIRED = !q.get("cinema") && q.get("notiles") !== "1";
  const CIDAO_ORIGIN = "https://cidao.vercel.app";
  const SIGNUP_URL = CIDAO_ORIGIN + "/login?utm_source=metaverse&utm_medium=reception&utm_campaign=entry"; // 未登録者の登録導線（LINE ログイン＝登録）
  const NIGHT_FLOOR_HEIGHT = 70;            // 地中ロックの下限（楕円体高・標高約34m。コース一帯の地表は約60〜70m）

  // ---- 図柄（線画SVG） ----
  const DESIGNS = {
    xmas: "assets/night/inzaikun_xmas.svg",       // クリスマス（黒い円盤に線が「抜き」＝透明）
    kihon: "assets/night/inzaikun_kihon.svg",     // 基本形（黒い線＋赤い切り取り線＋下にロゴ文字）
    ongaku: "assets/night/inzaikun_ongaku.svg",   // 音楽（A4の隅に小さく描かれている）
    placard: "assets/night/inzaikun_placard.svg", // プラカード（顔のアップ）
  };
  // 光の色（[主, 副]）
  const PALETTE = {
    gold: ["#fff1c4", "#ffd166"], sky: ["#dff3ff", "#7cc4ff"], green: ["#e8ffe8", "#6ee7a8"],
    pink: ["#ffe6f0", "#ff9ecb"], white: ["#ffffff", "#e8f0ff"], orange: ["#fff0d6", "#ffa447"],
    violet: ["#f0e6ff", "#b48cff"], cyan: ["#e0ffff", "#5ff0ff"], magenta: ["#ffe0ff", "#ff6ad5"],
  };
  // ---- コース：東（印西牧の原）→ 西（千葉ニュータウン中央駅）。高さは楕円体高（地表は約60〜70m）----
  // 最後の 10番 がゴール（千葉NT中央駅の真上・クリスマスいんザイ君・少し大きい）
  // 各ゲートは主要スポット（駅・施設）の真上に置く（座標は index.html の SPOTS と同じ・OpenStreetMap／市の施設一覧由来）。
  // 高さは 160〜480m の間で大きく上下させ、上昇・降下の起伏をつける（2026-09-04 中司さん指示）。
  // 順路：印旛日本医大駅（南東・スタート側）→ 本埜公民館 → 小林駅 → 印西牧の原駅 → ジョイフル本田 → 印西市役所 → 木下駅 → 松山下公園 → イオンモール → 千葉NT中央駅（ゴール）
  const FULL_COURSE = [
    { name: "印旛日本医大駅", lon: 140.203402, lat: 35.787590, height: 200, design: "kihon", color: "gold", size: 130 },
    { name: "本埜公民館", lon: 140.197952, lat: 35.808392, height: 420, design: "ongaku", color: "sky", size: 130 },
    { name: "小林駅", lon: 140.193301, lat: 35.830578, height: 180, design: "placard", color: "green", size: 140 },
    { name: "印西牧の原駅", lon: 140.166716, lat: 35.803497, height: 450, design: "kihon", color: "pink", size: 130, flip: true },
    { name: "ジョイフル本田千葉ニュータウン店", lon: 140.155674, lat: 35.807083, height: 220, design: "ongaku", color: "white", size: 130, flip: true },
    { name: "印西市役所", lon: 140.145795, lat: 35.832338, height: 480, design: "placard", color: "orange", size: 140, flip: true },
    { name: "木下駅", lon: 140.148377, lat: 35.838908, height: 160, design: "kihon", color: "violet", size: 130 },
    { name: "松山下公園", lon: 140.114947, lat: 35.824677, height: 400, design: "ongaku", color: "cyan", size: 130 },
    { name: "イオンモール千葉ニュータウン", lon: 140.111502, lat: 35.800167, height: 240, design: "placard", color: "magenta", size: 140 },
    { name: "千葉ニュータウン中央駅", lon: 140.116119, lat: 35.799983, height: 380, design: "xmas", color: "xmas", size: 160, goal: true },
  ];
  // 短縮コース（会場向け・約6km）：印西牧の原駅 → BIG HOP → ジョイフル本田 → イオンモール → 千葉NT中央駅
  const SHORT_COURSE = [
    { name: "印西牧の原駅", lon: 140.166716, lat: 35.803497, height: 380, design: "kihon", color: "gold", size: 130 },
    { name: "BIG HOPガーデンモール印西", lon: 140.162553, lat: 35.803195, height: 180, design: "ongaku", color: "sky", size: 130 },
    { name: "ジョイフル本田千葉ニュータウン店", lon: 140.155674, lat: 35.807083, height: 440, design: "placard", color: "green", size: 140 },
    { name: "イオンモール千葉ニュータウン", lon: 140.111502, lat: 35.800167, height: 200, design: "kihon", color: "pink", size: 130, flip: true },
    { name: "千葉ニュータウン中央駅", lon: 140.116119, lat: 35.799983, height: 380, design: "xmas", color: "xmas", size: 160, goal: true },
  ];
  // コース一覧。serverKey は CiDAO metaverse-tt のコース key（night=10か所・night5=5か所）。URL ?course=short で短縮を初期選択
  const COURSES = {
    full: { label: "全10か所（印旛日本医大駅→千葉NT中央駅・約20km）", serverKey: "night", gates: FULL_COURSE,
            start: { lon: 140.2105, lat: 35.7845, height: 200 }, startName: "印旛日本医大駅の東" },
    short: { label: "短縮5か所（印西牧の原駅→千葉NT中央駅・約6km）", serverKey: "night5", gates: SHORT_COURSE,
             start: { lon: 140.1745, lat: 35.8040, height: 300 }, startName: "印西牧の原駅の東" },
  };
  const COURSE_KEY_STORE = "cbi-meta-night-course";
  let courseKey = (function () {
    const c = q.get("course");
    if (c === "short" || c === "full") return c;
    try { const v = localStorage.getItem(COURSE_KEY_STORE); if (v === "short" || v === "full") return v; } catch (e) { /* 既定へ */ }
    return "full";
  })();
  let COURSE = COURSES[courseKey].gates;
  let START_POINT = COURSES[courseKey].start;
  const STATION_MAKINOHARA = { lon: 140.166716, lat: 35.803497 };
  const BIGHOP = { lon: 140.162553, lat: 35.803195 };
  const STATION_CNT = { lon: 140.116119, lat: 35.799983 };           // 千葉ニュータウン中央駅
  const AEON = { lon: 140.111502, lat: 35.800167 };

  window.nightOn = false;                   // index.html の applyLite が空の表現を切るかどうかの判断に読む

  // 右スティック（視点）の効きが強く行き過ぎるため、夜景中は 2乗カーブ（小さな倒しはより小さく）＋感度倍率を掛ける。
  // index.html の padNormalize（軸ごとの -1〜1 正規化）を包む形にし、index.html は変更しない
  const LOOK_SENS_KEY = "cbi-meta-night-looksens";
  const LOOK_SENS_OPTIONS = [["0.35", "ゆっくり"], ["0.5", "ふつう（推奨）"], ["0.75", "やや速い"], ["1", "元のまま"]];
  let lookSens = 0.5;
  try { const v = parseFloat(localStorage.getItem(LOOK_SENS_KEY)); if (v > 0 && v <= 1) lookSens = v; } catch (e) { /* 既定へ */ }
  function setLookSens(v) {
    lookSens = v;
    try { localStorage.setItem(LOOK_SENS_KEY, String(v)); } catch (e) { /* 保存できなくても続ける */ }
  }
  window.setNightLookSens = setLookSens;
  if (typeof padNormalize === "function") {
    const origPadNormalize = padNormalize;
    padNormalize = function (raw, ch) {
      const v = origPadNormalize(raw, ch);
      if (!window.nightOn || (ch !== 2 && ch !== 3) || v === 0) return v;
      const a = Math.abs(v);
      return Math.sign(v) * a * a * lookSens;
    };
  }
  function makeGateObjects() {
    return COURSE.map(function (g, i) {
      return { def: g, index: i, points: null, base: [], frame: null, inv: null, halfW: 0, halfH: 0,
               facing: 0, prevSide: null, passes: 0, label: null };
    });
  }
  let gates = makeGateObjects();
  let labels = null;                        // 番号ラベル
  let stringPoints = null, stringBase = [];  // 地上の光の列
  let twinkleTimer = null, chaseTimer = null, chaseTick = 0;
  let passCount = 0;
  let tourRunning = false, tourToken = 0;
  let lastInputAt = performance.now();
  let hudEl = null, capEl = null;
  let uiHidden = [];
  let imgCache = {};

  // ------------------------------------------------------------
  // 地理の小道具
  // ------------------------------------------------------------
  const M_LAT = 111320;
  function mLon(lat) { return 111320 * Math.cos(Cesium.Math.toRadians(lat)); }
  function bearingDeg(a, b) { // a から b を見る方位（度・北=0・時計回り）
    const dx = (b.lon - a.lon) * mLon((a.lat + b.lat) / 2), dy = (b.lat - a.lat) * M_LAT;
    return (Cesium.Math.toDegrees(Math.atan2(dx, dy)) + 360) % 360;
  }
  function distM(a, b) {
    const dx = (b.lon - a.lon) * mLon((a.lat + b.lat) / 2), dy = (b.lat - a.lat) * M_LAT;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function cameraLonLat() {
    const c = Cesium.Cartographic.fromCartesian(viewer.camera.position);
    return { lon: Cesium.Math.toDegrees(c.longitude), lat: Cesium.Math.toDegrees(c.latitude), height: c.height };
  }

  // ------------------------------------------------------------
  // 街並みを夜にするシェーダー
  // ------------------------------------------------------------
  const nightShader = new Cesium.CustomShader({
    mode: Cesium.CustomShaderMode.MODIFY_MATERIAL,
    lightingModel: Cesium.LightingModel.UNLIT,
    fragmentShaderText: [
      "float nightHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }",
      "void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {",
      "  vec3 c = material.diffuse;",
      "  float lum = dot(c, vec3(0.299, 0.587, 0.114));",
      // 写真の色で地表を見分ける（2026-09-06 中司さん指示：人工が密集している地域が分かる程度にあかりを増やし、森や林には灯さない）
      //   植生：緑が赤・青より強い（森・林・芝・畑の作物）。土・畑：暗くて赤み（茶色）。人工物：明るめで色味の薄い面（屋根・道路・駐車場）
      "  float veg = smoothstep(0.0, 0.07, c.g - max(c.r, c.b));",
      "  float soil = (1.0 - veg) * smoothstep(0.42, 0.22, lum) * step(c.b, c.r);",
      "  float mx = max(c.r, max(c.g, c.b)); float sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 0.001);",
      //   暖色で明るい面（ゴルフ場の冬芝・砂地・裸地）は人工物に含めない（本番確認でゴルフ場が光ったため。2026-09-06）
      //   ゴルフ場の冬芝・砂地は「明るくて赤みが青より強い」。住宅地の道路・屋根は暗め（lum 0.3〜0.45）か無彩色なので残る
      "  float warmGround = step(c.b + 0.03, c.r) * smoothstep(0.10, 0.22, sat);",
      //   遠く（1.5〜6km）のタイルは解像度が粗く写真が暗くぼやけるので、明るさの条件を緩めて人工物を拾う（2026-09-06 中司さん指摘「高高度から見たときに光はほとんど見えない」）
      "  float dist = length(fsInput.attributes.positionEC);",
      "  float far = smoothstep(1500.0, 6000.0, dist);",
      "  float built = (1.0 - veg) * (1.0 - soil) * (1.0 - warmGround) * smoothstep(mix(0.22, 0.13, far), mix(0.45, 0.28, far), lum);",
      //   面の向き：画面微分から幾何法線を出し、鉛直（上）方向との角度で壁面（縦）か屋根・地面（横）かを見分ける
      "  vec3 gn = normalize(cross(dFdx(fsInput.attributes.positionEC), dFdy(fsInput.attributes.positionEC)));",
      "  vec3 upEC = normalize(mat3(czm_view3D) * normalize(fsInput.attributes.positionWC));",
      "  float horiz = abs(dot(gn, upEC));",
      "  float wall = 1.0 - smoothstep(0.45, 0.75, horiz);",
      // 昼の写真を暗く・青みがけて夜にする（真っ黒にはせず、街の形が分かる程度に残す）
      "  vec3 night = c * vec3(0.11, 0.14, 0.26) + vec3(0.01, 0.015, 0.045);",
      // 市街地のにじみ：人工物の面に薄い橙色を足す。遠くから見たとき「明るい帯＝街」「暗い塊＝森」に見える主役はこれ
      "  vec3 p = fsInput.attributes.positionWC - vec3(-3960000.0, 3310000.0, 3730000.0);",
      "  float glowVar = 0.6 + 0.4 * nightHash(floor(p / 40.0));",
      //   にじみは遠くほど強く（最大 2.6 倍）。上空から見ると点は消えるので、街の明るさはこのにじみが担う
      //   近距離（〜500m）はにじみを弱めて夜らしく暗くする（近くは窓と街灯が主役）
      "  float nearF = 1.0 - smoothstep(500.0, 1200.0, dist);",
      "  night += vec3(0.26, 0.17, 0.06) * built * glowVar * mix(1.0, 2.6, far) * mix(1.0, 0.45, nearF);",
      // ---- 近距離：壁面に窓の格子（3.2m ごとの階 × 2.8m ごとの窓。約45% を点灯、暖色と白色を混ぜる）。屋根は暗いまま
      //   地表の東・北・上の向きを出し、高さ＝階、壁に沿った方向＝窓の列にする（壁の法線が南北向きなら壁は東西に延びるので東方向の座標を使う）
      "  vec3 up = normalize(fsInput.attributes.positionWC);",
      "  vec3 east = normalize(cross(vec3(0.0, 0.0, 1.0), up));",
      "  vec3 north = cross(up, east);",
      "  float hgt = dot(p, up); float ue = dot(p, east); float un = dot(p, north);",
      "  float along = mix(un, ue, step(0.5, abs(dot(gn, mat3(czm_view3D) * north))));",
      "  float fl = floor(hgt / 3.2); float fy = fract(hgt / 3.2);",
      "  float ca = floor(along / 2.8); float fa = fract(along / 2.8);",
      "  float winShape = step(0.25, fy) * step(fy, 0.75) * step(0.2, fa) * step(fa, 0.8);",
      "  float bId = nightHash(floor(vec3(ue, un, 0.0) / 30.0));",
      "  float lit = step(0.55, nightHash(vec3(ca, fl, bId * 100.0)));",
      "  float winNear = built * wall * winShape * lit;",
      "  vec3 warmNear = mix(vec3(1.0, 0.84, 0.52), vec3(0.78, 0.9, 1.0), step(0.65, nightHash(vec3(fl, ca, bId * 50.0 + 1.0))));",
      // ---- 近距離：地面（道路・駐車場）は街灯の光だまり。18m 間隔の格子の半分に街灯があり、中心から丸く減衰する
      "  vec2 lc = vec2(ue, un) / 18.0;",
      "  vec2 lf = fract(lc) - 0.5;",
      "  float hasLamp = step(0.5, nightHash(vec3(floor(lc), 5.0)));",
      "  float pool = smoothstep(0.5, 0.08, length(lf)) * hasLamp;",
      "  float lampNear = pool * built * smoothstep(0.2, 0.08, sat) * (1.0 - wall);",
      // ---- 遠距離（500m〜）：世界座標をセルに区切り、セルごとの乱数で灯す。遠いほどセルを大きくして、上空からも点が消えないようにする
      "  float cellSize = 6.0 * exp2(floor(log2(max(1.0, dist / 700.0))));",
      "  vec3 cell = floor(p / cellSize);",
      "  float h = nightHash(cell);",
      //   屋根の灯りは近くでは 3%（設備の灯り程度）、遠く（3km 以上）では 22% まで増やす：上空から住宅の密集が光の塊として分かるように
      "  float roofRate = mix(0.03, 0.22, smoothstep(600.0, 3000.0, dist));",
      "  float winFar = built * (step(0.86, h) * wall + step(1.0 - roofRate, h) * (1.0 - wall) * 0.8);",
      "  vec3 warmFar = mix(vec3(1.0, 0.84, 0.52), vec3(0.72, 0.88, 1.0), step(0.6, nightHash(cell + 7.0)));",
      "  vec3 cell2 = floor(p / (cellSize * 2.0));",
      "  float lampFar = step(0.93, nightHash(cell2 + 3.0)) * built * smoothstep(0.18, 0.08, sat) * (1.0 - wall);",
      "  vec3 nearLight = warmNear * winNear * 0.95 + vec3(1.0, 0.75, 0.4) * lampNear * 0.8;",
      "  vec3 farLight = warmFar * winFar * 0.9 + vec3(1.0, 0.72, 0.35) * lampFar * 1.1;",
      "  material.diffuse = night + mix(farLight, nearLight, nearF);",
      "}",
    ].join("\n"),
  });

  // ------------------------------------------------------------
  // 画像 → 光の粒
  //   2段階で読む：①全体を描いて図柄の範囲（余白・A4の隅など）を見つける ②その範囲だけを拡大して描き直し、線の画素を拾う
  //   線の拾い方は画像ごとに自動判定：
  //     「抜き」型（クリスマス）… 不透明な円盤に線が透明な穴 → 円盤の内側の透明画素が線
  //     「インク」型（基本形・音楽・プラカード）… 透明な地に黒い線 → 暗い不透明画素が線（赤い切り取り線は除く）
  //   図柄の下にあるロゴ文字は、行ごとの点の有無を見て「空行が続くところ」で切り落とす
  // ------------------------------------------------------------
  function scanPixels(ctx, W, H) {
    const data = ctx.getImageData(0, 0, W, H).data;
    const opaque = new Uint8Array(W * H), dark = new Uint8Array(W * H), red = new Uint8Array(W * H);
    let nOpaque = 0, minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, k = y * W + x;
      const a = data[i + 3];
      if (a < 128) continue;
      opaque[k] = 1; nOpaque++;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (r > 170 && g < 100 && b < 100) red[k] = 1;
      else if (l < 140) dark[k] = 1;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { opaque: opaque, dark: dark, red: red, nOpaque: nOpaque, minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }
  function sampleImage(img, flip) {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    // ① 全体
    const W0 = 900, H0 = 900;
    cv.width = W0; cv.height = H0;
    ctx.clearRect(0, 0, W0, H0);
    ctx.drawImage(img, 0, 0, W0, H0);
    let s0;
    try { s0 = scanPixels(ctx, W0, H0); } catch (e) { console.warn("夜景: 画像を読めません", e); return null; }
    if (s0.maxX < 0) return null;
    const bw = s0.maxX - s0.minX + 1, bh = s0.maxY - s0.minY + 1;
    const holes = s0.nOpaque > bw * bh * 0.5;          // 図柄の範囲の半分以上が不透明＝「抜き」型
    // ② 図柄の範囲だけを拡大して描き直す（元画像の座標に戻してから）
    const sx = s0.minX / W0 * img.width, sy = s0.minY / H0 * img.height;
    const sw = bw / W0 * img.width, sh = bh / H0 * img.height;
    const W = 480, H = Math.max(120, Math.round(480 * bh / bw));
    cv.width = W; cv.height = H;
    ctx.clearRect(0, 0, W, H);
    if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const s = scanPixels(ctx, W, H);
    const lit = new Uint8Array(W * H);
    const rowCount = new Int32Array(H);
    if (holes) {
      const margin = Math.max(3, Math.round(W * 0.03));
      for (let y = 0; y < H; y++) {
        let L = -1, R = -1;
        for (let x = 0; x < W; x++) if (s.opaque[y * W + x]) { if (L < 0) L = x; R = x; }
        if (L < 0) continue;
        for (let x = L + margin; x <= R - margin; x++) {
          if (!s.opaque[y * W + x]) { lit[y * W + x] = 1; rowCount[y]++; }
        }
      }
    } else {
      for (let k = 0; k < W * H; k++) if (s.dark[k] && !s.red[k]) { lit[k] = 1; rowCount[Math.floor(k / W)]++; }
    }
    // ロゴ文字を切り落とす：上から最初の点のある行を探し、下へたどって空行が続くところで切る
    let top = -1;
    for (let y = 0; y < H; y++) if (rowCount[y] > 0) { top = y; break; }
    if (top < 0) return null;
    let bottom = H - 1, gap = 0;
    const gapNeed = Math.max(4, Math.round(H * 0.02));
    for (let y = top; y < H; y++) {
      if (rowCount[y] === 0) { gap++; if (gap >= gapNeed) { bottom = y - gap; break; } }
      else gap = 0;
    }
    const pts = [];
    let minX = W, maxX = 0;
    for (let y = top; y <= bottom; y++) for (let x = 0; x < W; x++) {
      if (!lit[y * W + x]) continue;
      pts.push([x + Math.random() * 0.8 - 0.4, y + Math.random() * 0.8 - 0.4]);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
    }
    if (pts.length === 0) return null;
    let keep = pts;
    if (pts.length > GATE_MAX_POINTS) {
      const p = GATE_MAX_POINTS / pts.length;
      keep = pts.filter(function () { return Math.random() < p; });
    }
    return { pts: keep, top: top, bottom: bottom, minX: minX, maxX: maxX };
  }
  function loadImage(key) {
    if (imgCache[key]) return imgCache[key];
    imgCache[key] = new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error(DESIGNS[key] + " を読み込めません")); };
      img.src = DESIGNS[key];
    });
    return imgCache[key];
  }

  // ------------------------------------------------------------
  // ゲートを空に組み立てる
  // ------------------------------------------------------------
  function gateColor(g, p, top, charH) {
    const r = Math.random();
    if (g.def.color === "xmas") {
      if (p[1] < top + charH * 0.22) return r < 0.6 ? "#ff5a5a" : "#fff6f0";  // 帽子＝赤と白
      if (r < 0.62) return "#fff1c4";
      if (r < 0.86) return "#ffd166";
      if (r < 0.95) return "#9fd8ff";
      return "#ff9ecb";
    }
    const pal = PALETTE[g.def.color] || PALETTE.gold;
    return r < 0.6 ? pal[0] : pal[1];
  }
  function buildGate(g, sample) {
    const d = g.def;
    const prev = g.index === 0 ? START_POINT : COURSE[g.index - 1];
    g.facing = bearingDeg(d, prev);                       // 図柄は「前のゲート（来る方向）」を向く
    const center = Cesium.Cartesian3.fromDegrees(d.lon, d.lat, d.height);
    g.frame = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    g.inv = Cesium.Matrix4.inverseTransformation(g.frame, new Cesium.Matrix4());
    const f = Cesium.Math.toRadians(g.facing);
    const ux = -Math.cos(f), uy = Math.sin(f);            // 図柄を正面から見る人の「右」（東北上フレーム）
    const charH = sample.bottom - sample.top;
    const scale = d.size / charH;                         // m/px
    const cx = (sample.minX + sample.maxX) / 2, cy = (sample.top + sample.bottom) / 2;
    g.halfW = ((sample.maxX - sample.minX) / 2) * scale;
    g.halfH = (charH / 2) * scale;
    if (g.points) viewer.scene.primitives.remove(g.points);
    g.points = new Cesium.PointPrimitiveCollection();
    g.base = [];
    const local = new Cesium.Cartesian3();
    for (const p of sample.pts) {
      const x = (p[0] - cx) * scale, yUp = (cy - p[1]) * scale;
      local.x = ux * x; local.y = uy * x; local.z = yUp;
      const pos = Cesium.Matrix4.multiplyByPoint(g.frame, local, new Cesium.Cartesian3());
      const c = Cesium.Color.fromCssColorString(gateColor(g, p, sample.top, charH));
      g.base.push(c);
      g.points.add({
        position: pos, color: c, pixelSize: 6,
        scaleByDistance: new Cesium.NearFarScalar(150, 2.2, 4000, 0.45),
      });
    }
    g.points.show = window.nightOn;
    viewer.scene.primitives.add(g.points);
    // 番号ラベル（図柄の上）
    if (!labels) { labels = new Cesium.LabelCollection(); viewer.scene.primitives.add(labels); labels.show = window.nightOn; }
    local.x = 0; local.y = 0; local.z = g.halfH + 18;
    const lpos = Cesium.Matrix4.multiplyByPoint(g.frame, local, new Cesium.Cartesian3());
    g.label = labels.add({
      position: lpos,
      text: (d.goal ? String(g.index + 1) + " GOAL" : String(g.index + 1)) + "\n" + d.name.replace("ガーデンモール印西", "").replace("千葉ニュータウン店", ""),
      font: "bold 30px 'Segoe UI', system-ui, sans-serif",
      fillColor: Cesium.Color.fromCssColorString(d.goal ? "#ffd166" : "#dff3ff"),
      outlineColor: Cesium.Color.fromCssColorString("#0a1020"), outlineWidth: 5,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER, verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      scaleByDistance: new Cesium.NearFarScalar(300, 1.3, 6000, 0.5),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    });
  }
  let gatesLoading = false;
  // コースを切り替える：光の粒とラベルを作り直す（レース中は不可）
  function setCourse(key) {
    if (!COURSES[key] || key === courseKey) return;
    if (tt.active) return;
    courseKey = key;
    COURSE = COURSES[key].gates;
    START_POINT = COURSES[key].start;
    try { localStorage.setItem(COURSE_KEY_STORE, key); } catch (e) { /* 保存できなくても続ける */ }
    gates.forEach(function (g) { if (g.points) viewer.scene.primitives.remove(g.points); });
    if (labels) labels.removeAll();
    gates = makeGateObjects();
    gatesLoading = false;
    if (window.nightOn) loadGates();
    updateHud(true);
  }
  window.setNightCourse = setCourse;
  window.nightCourseKey = function () { return courseKey; };
  function loadGates() {
    if (gatesLoading) return;
    gatesLoading = true;
    gates.forEach(function (g) {
      loadImage(g.def.design).then(function (img) {
        const s = sampleImage(img, !!g.def.flip);
        if (!s) { console.warn("夜景: ゲート" + (g.index + 1) + " の図柄から光の粒を作れませんでした"); return; }
        buildGate(g, s);
      }).catch(function (e) { console.warn("夜景: " + e.message); });
    });
  }

  // ------------------------------------------------------------
  // 地上の光の列（牧の原：駅の周り・駅〜BIG HOP・BIG HOP の周り／千葉NT：駅の周り・駅〜イオン）
  // ------------------------------------------------------------
  const STRING_COLORS = ["#ff5252", "#ffd166", "#6ee7a8", "#7cc4ff", "#fff2e0"];
  function stringPath() {
    const out = [];
    function ring(c, rM, n) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push([c.lon + (Math.cos(a) * rM) / mLon(c.lat), c.lat + (Math.sin(a) * rM) / M_LAT]);
      }
    }
    function line(a, b, n) {
      for (let i = 0; i <= n; i++) { const t = i / n; out.push([a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t]); }
    }
    ring(STATION_MAKINOHARA, 70, 90);
    line(STATION_MAKINOHARA, BIGHOP, 100);
    ring(BIGHOP, 95, 120);
    ring(STATION_CNT, 80, 100);
    line(STATION_CNT, AEON, 110);
    return out;
  }
  async function buildStrings() {
    if (stringPoints) return;
    const path = stringPath();
    const cartos = path.map(function (p) { return Cesium.Cartographic.fromDegrees(p[0], p[1]); });
    let heights = null;
    if (!NO_TILES && viewer.scene.sampleHeightSupported) {
      try {
        const res = await viewer.scene.sampleHeightMostDetailed(cartos);
        heights = res.map(function (c) { return c && isFinite(c.height) ? c.height : null; });
      } catch (e) { heights = null; }
    }
    stringPoints = new Cesium.PointPrimitiveCollection();
    stringBase = [];
    for (let i = 0; i < path.length; i++) {
      const h = (heights && heights[i] !== null) ? heights[i] + 5 : 72;
      const c = Cesium.Color.fromCssColorString(STRING_COLORS[i % STRING_COLORS.length]);
      stringBase.push(c);
      stringPoints.add({
        position: Cesium.Cartesian3.fromDegrees(path[i][0], path[i][1], h),
        color: c, pixelSize: 5,
        scaleByDistance: new Cesium.NearFarScalar(100, 2.0, 3000, 0.4),
      });
    }
    stringPoints.show = window.nightOn;
    viewer.scene.primitives.add(stringPoints);
  }

  // ------------------------------------------------------------
  // またたき・流れる色・くぐったときの弾け・次ゲートの強調
  // ------------------------------------------------------------
  let burstingUntil = {};
  function twinkle() {
    if (!window.nightOn) return;
    const now = performance.now();
    gates.forEach(function (g) {
      if (!g.points || (burstingUntil[g.index] || 0) > now) return;
      const n = g.points.length;
      const nextIdx = tt.active ? tt.pos : -1;
      const dim = tt.active && g.index < tt.pos;          // 通過済みは控えめに
      const emph = g.index === nextIdx;                    // 次のゲートは強めに脈打つ
      const pulse = emph ? (0.8 + 0.5 * Math.sin(now / 180)) : 1;
      const k = emph ? 25 : 10;
      for (let j = 0; j < k; j++) {
        const i = Math.floor(Math.random() * n);
        const p = g.points.get(i);
        const f = (0.35 + Math.random() * 1.1) * pulse * (dim ? 0.5 : 1);
        const b = g.base[i];
        p.color = new Cesium.Color(Math.min(1, b.red * f), Math.min(1, b.green * f), Math.min(1, b.blue * f), 1);
      }
      if (emph !== g._emph || dim !== g._dim) {          // 状態が変わったときだけ全体を塗り直す
        g._emph = emph; g._dim = dim;
        for (let i = 0; i < n; i++) {
          const p = g.points.get(i);
          p.pixelSize = emph ? 8 : 6;
          p.color = dim ? Cesium.Color.multiplyByScalar(g.base[i], 0.45, new Cesium.Color()) : g.base[i];
        }
      }
    });
  }
  function chase() {
    if (!stringPoints || !window.nightOn) return;
    chaseTick++;
    const n = stringPoints.length;
    for (let i = 0; i < n; i++) stringPoints.get(i).color = stringBase[(i + chaseTick) % n];
  }
  function burst(g) {
    if (!g.points) return;
    burstingUntil[g.index] = performance.now() + 1600;
    const start = performance.now();
    const n = g.points.length;
    const white = Cesium.Color.WHITE;
    function step() {
      const t = (performance.now() - start) / 1600;
      if (t >= 1) {
        for (let i = 0; i < n; i++) { const p = g.points.get(i); p.color = g.base[i]; p.pixelSize = 6; }
        g._emph = undefined;                             // 次の twinkle で強調・減光を塗り直す
        return;
      }
      const k = 1 - t;
      for (let i = 0; i < n; i++) {
        const p = g.points.get(i);
        p.color = Cesium.Color.lerp(g.base[i], white, k, new Cesium.Color());
        p.pixelSize = 6 + 10 * k;
      }
      requestAnimationFrame(step);
    }
    step();
  }

  // くぐり判定：各ゲートの平面を、図柄の範囲内で横切ったら
  const localPos = new Cesium.Cartesian3();
  function checkPass() {
    if (!window.nightOn) return;
    const camPos = viewer.camera.position;
    gates.forEach(function (g) {
      if (!g.inv) return;
      Cesium.Matrix4.multiplyByPoint(g.inv, camPos, localPos);
      const f = Cesium.Math.toRadians(g.facing);
      const nx = Math.sin(f), ny = Math.cos(f);
      const ux = -Math.cos(f), uy = Math.sin(f);
      const d = localPos.x * nx + localPos.y * ny;
      const s = localPos.x * ux + localPos.y * uy;
      const side = d >= 0 ? 1 : -1;
      // 面をまたいだ瞬間に判定する。低fps（N95等）でダッシュすると1フレームで60m以上進むため、面からの距離は200mまで許す
      if (g.prevSide !== null && side !== g.prevSide && Math.abs(d) < 200 &&
          Math.abs(s) < g.halfW && Math.abs(localPos.z) < g.halfH) {
        onGatePass(g);
      }
      g.prevSide = side;
    });
  }
  function onGatePass(g) {
    if (tt.active && tt.waiting) return;
    if (tt.active) {
      if (g.index === tt.pos) {
        burst(g);
        tt.pos++;
        ttCheckpoint(tt.pos);
        if (tt.pos >= COURSE.length) { ttFinishNight(); return; }
        caption("✅ " + (g.index + 1) + " 番（" + g.def.name + "）通過！<small>次は <b>" + (tt.pos + 1) + " 番 " + COURSE[Math.min(tt.pos, COURSE.length - 1)].name + "</b>" + (tt.pos === COURSE.length - 1 ? "（ゴール・クリスマスいんザイ君）" : "") + "　" + nextGateGuide() + "</small>", 4000);
      } else if (g.index > tt.pos) {
        caption("⚠ 順番どおりに！<small>次は " + (tt.pos + 1) + " 番のゲート　" + nextGateGuide() + "</small>", 3000);
      }
      return;
    }
    burst(g);
    g.passes++; passCount++;
    caption("✨ " + (g.index + 1) + " 番（" + g.def.name + "の上空）の いんザイ君 をくぐった！<small>" + passCount + "回目" + (g.def.goal ? "・ここが ゴール" : "") + "</small>", 3500);
    updateHud(true);
  }

  // ------------------------------------------------------------
  // 宇宙船コックピット HUD とテロップ
  // ------------------------------------------------------------
  function ensureHud() {
    if (hudEl) return;
    const style = document.createElement("style");
    style.textContent =
      "#shipHud{position:absolute;inset:0;z-index:58;pointer-events:none;display:none;}" +
      "#shipHud.on{display:block;}" +

      "body.nightOn #helpBox{z-index:66;bottom:56px;}" +
      "@media (max-width:640px){#shipReadout{bottom:20%;font-size:12px;} #shipTt{font-size:22px;top:9%;} #nightCaption{font-size:22px;top:20%;} #nightCaption small{font-size:14px;}}" +
      "#shipHud svg{position:absolute;inset:0;width:100%;height:100%;}" +
      "#shipHud .ret{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:2px solid rgba(120,230,255,0.7);border-radius:50%;box-shadow:0 0 12px rgba(120,230,255,0.5);}" +
      "#shipHud .ret:before,#shipHud .ret:after{content:'';position:absolute;background:rgba(120,230,255,0.8);}" +
      "#shipHud .ret:before{left:50%;top:-10px;width:2px;height:14px;margin-left:-1px;}" +
      "#shipHud .ret:after{top:50%;left:-10px;height:2px;width:14px;margin-top:-1px;}" +
      "#shipReadout{position:absolute;left:50%;bottom:4.5%;transform:translateX(-50%);color:#8fe9ff;font:bold 15px/1.5 'Segoe UI',system-ui,sans-serif;letter-spacing:0.08em;text-shadow:0 0 10px rgba(120,230,255,0.8);white-space:nowrap;}" +
      "#shipReadout b{color:#ffd166;text-shadow:0 0 10px rgba(255,209,102,0.8);}" +
      "#shipTt{position:absolute;left:50%;top:5%;transform:translateX(-50%);color:#fff;font:bold 30px/1.3 'Segoe UI',system-ui,sans-serif;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,0.9);display:none;}" +
      "#shipTt.on{display:block;}#shipTt b{color:#ffd166;}#shipTt small{display:block;font-size:17px;font-weight:normal;color:#8fe9ff;}" +
      "#nightCaption{position:absolute;left:50%;top:14%;transform:translateX(-50%);z-index:70;color:#fff;font-size:34px;font-weight:bold;text-align:center;line-height:1.5;width:92%;text-shadow:0 2px 16px rgba(0,0,0,0.95),0 0 6px rgba(0,0,0,0.9);opacity:0;transition:opacity 0.7s;pointer-events:none;}" +
      "#nightCaption.show{opacity:1;}#nightCaption small{display:block;font-size:19px;font-weight:normal;margin-top:6px;}#nightCaption b{color:#ffd166;}" +
      "#nightTourBtn,#nightTtBtn{display:none;}#nightTourBtn.on,#nightTtBtn.on{display:inline-block;}" +
      "#nightHudBtn{display:none !important;}" +
      "#nightTarget{position:absolute;left:0;top:0;z-index:60;display:none;pointer-events:none;text-align:center;}" +
      "#nightTarget .arrow{display:block;font-size:46px;line-height:1;color:#ffd166;text-shadow:0 0 14px rgba(255,209,102,0.9),0 2px 6px rgba(0,0,0,0.9);}" +
      "#nightTarget .label{display:inline-block;margin-top:2px;padding:3px 10px;border-radius:10px;background:rgba(10,16,32,0.8);color:#fff;font:bold 15px 'Segoe UI',system-ui,sans-serif;white-space:nowrap;}" +
      "#nightTtModal .login{background:#06c755;color:#fff;font-weight:bold;font-size:17px;}" +
      "#nightTtModal .box{background:#0a1020;border:1px solid #2a3a55;border-radius:10px;padding:10px 12px;margin:8px 0;}" +
      "#nightTtModal .note{font-size:12px;color:#9fb2c8;margin:4px 0 0;}" +
      "#nightTtModal{position:fixed;inset:0;z-index:120;background:rgba(3,6,16,0.82);display:none;align-items:center;justify-content:center;}" +
      "#nightTtModal.show{display:flex;}" +
      "#nightTtModal .inner{background:#0d1526;color:#e8f0ff;border:1px solid rgba(120,230,255,0.4);border-radius:14px;padding:22px 26px;width:min(92vw,560px);max-height:90vh;overflow:auto;font-size:14px;box-shadow:0 0 40px rgba(120,230,255,0.25);}" +
      "#nightTtModal h2{margin:0 0 8px;color:#ffd166;font-size:20px;}#nightTtModal p{margin:6px 0;line-height:1.6;}" +
      "#nightTtModal input{font-size:18px;padding:8px 10px;border-radius:8px;border:1px solid #4a6a8a;background:#0a1020;color:#fff;width:100%;box-sizing:border-box;}" +
      "#nightTtModal button{font-size:15px;padding:10px 18px;border-radius:10px;border:none;cursor:pointer;margin:6px 6px 0 0;}" +
      "#nightTtModal .go{background:#ffd166;color:#1a2533;font-weight:bold;font-size:18px;}#nightTtModal .sub{background:#2a3a55;color:#fff;}" +
      "#nightTtModal table{border-collapse:collapse;width:100%;margin-top:6px;}#nightTtModal td,#nightTtModal th{padding:3px 6px;border-bottom:1px solid #223;text-align:left;font-size:13px;}" +
      "#nightTtModal .me{color:#ffd166;font-weight:bold;}";
    document.head.appendChild(style);
    hudEl = document.createElement("div");
    hudEl.id = "shipHud";
    hudEl.innerHTML =
      '<div class="ret"></div>' +
      '<div id="shipTt"></div>' +
      '<div id="shipReadout"></div>';
    document.body.appendChild(hudEl);
    capEl = document.createElement("div");
    capEl.id = "nightCaption";
    document.body.appendChild(capEl);
    targetEl = document.createElement("div");
    targetEl.id = "nightTarget";
    targetEl.innerHTML = '<span class="arrow">⬇</span><span class="label"></span>';
    document.body.appendChild(targetEl);
    const modal = document.createElement("div");
    modal.id = "nightTtModal";
    modal.innerHTML = '<div class="inner" id="nightTtInner"></div>';
    document.body.appendChild(modal);
  }
  let capTimer = null;
  function caption(html, ms) {
    ensureHud();
    capEl.innerHTML = html;
    capEl.classList.add("show");
    if (capTimer) clearTimeout(capTimer);
    if (ms) capTimer = setTimeout(function () { capEl.classList.remove("show"); }, ms);
  }
  const ARROWS = ["⬆", "↗", "➡", "↘", "⬇", "↙", "⬅", "↖"];
  function relArrow(bearing) {
    const rel = ((bearing - Cesium.Math.toDegrees(viewer.camera.heading)) % 360 + 360) % 360;
    return ARROWS[Math.round(rel / 45) % 8];
  }
  // 次のゲートの向き（文化財タイムトライアルの ttBearingToNext と同じ言葉づかい）
  function bearingInfo(target) {
    const c = cameraLonLat();
    const abs = bearingDeg(c, target);
    let rel = abs - Cesium.Math.toDegrees(viewer.camera.heading);
    rel = ((rel + 540) % 360) - 180;                       // -180〜180°
    const compass = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"][Math.round(abs / 45) % 8];
    const a = Math.abs(rel);
    let word;
    if (a < 20) word = "正面";
    else if (a < 70) word = rel > 0 ? "右前" : "左前";
    else if (a < 110) word = rel > 0 ? "右" : "左";
    else if (a < 160) word = rel > 0 ? "右後ろ" : "左後ろ";
    else word = "後ろ";
    const dh = Math.round(target.height - c.height);
    return { relDeg: rel, word: word, compass: compass, dist: Math.round(distM(c, target)), arrow: relArrow(abs),
             updown: Math.abs(dh) > 20 ? (dh > 0 ? "↑" + dh + "m" : "↓" + (-dh) + "m") : "" };
  }
  function nextGateGuide() {
    const n = COURSE[Math.min(tt.pos, COURSE.length - 1)];
    const b = bearingInfo(n);
    return b.arrow + " " + b.word + "（" + b.compass + "）" + b.dist + "m" + (b.updown ? " " + b.updown : "");
  }
  // 画面上の目印：次のゲートが見えていれば真上に ⬇、画面外なら縁で ➜ がその方向を向く（文化財TTの ttUpdateTargetMarker と同型）
  let targetEl = null;
  function updateTargetMarker() {
    if (!targetEl) return;
    if (!tt.active || tt.pos >= COURSE.length || !gates[tt.pos].frame) { targetEl.style.display = "none"; return; }
    const canvas = viewer.canvas;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    const g = gates[tt.pos];
    const pos = Cesium.Cartesian3.fromDegrees(g.def.lon, g.def.lat, g.def.height);
    const cam = viewer.camera;
    const toTarget = Cesium.Cartesian3.subtract(pos, cam.position, new Cesium.Cartesian3());
    const inFront = Cesium.Cartesian3.dot(cam.direction, toTarget) > 0;
    const win = inFront ? viewer.scene.cartesianToCanvasCoordinates(pos) : undefined;
    const margin = 40;
    const arrow = targetEl.querySelector(".arrow"), label = targetEl.querySelector(".label");
    const b = bearingInfo(g.def);
    label.textContent = (g.index + 1) + (g.def.goal ? "番 GOAL" : "番") + "　" + b.dist + "m";
    targetEl.style.display = "block";
    if (win && win.x >= margin && win.x <= W - margin && win.y >= margin && win.y <= H - margin) {
      arrow.textContent = "⬇";
      arrow.style.transform = "none";
      targetEl.style.left = win.x + "px";
      targetEl.style.top = Math.max(0, win.y - 96) + "px";
      targetEl.style.transform = "translateX(-50%)";
      return;
    }
    const rel = Cesium.Math.toRadians(b.relDeg);
    const cx = W / 2, cy = H / 2;
    const dx = Math.sin(rel), dy = -Math.cos(rel);
    const tx = dx !== 0 ? (cx - margin) / Math.abs(dx) : Infinity;
    const ty = dy !== 0 ? (cy - margin) / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);
    arrow.textContent = "➜";
    arrow.style.transform = "rotate(" + (b.relDeg - 90).toFixed(0) + "deg)";
    targetEl.style.left = (cx + dx * t) + "px";
    targetEl.style.top = (cy + dy * t) + "px";
    targetEl.style.transform = "translate(-50%, -50%)";
  }
  let hudFrame = 0;
  function updateHud(force) {
    if (!hudEl || !window.nightOn) return;
    if (!force && (hudFrame++ % 10) !== 0) return;
    const c = cameraLonLat();
    const alt = Math.max(0, Math.round(c.height - INZAI_GEOID_HEIGHT_M));
    const hdg = Math.round(Cesium.Math.toDegrees(viewer.camera.heading)) % 360;
    let txt = "標高 <b>" + alt + "</b> m ／ 方位 <b>" + hdg + "</b>°";
    const ttEl = document.getElementById("shipTt");
    if (tt.active) {
      const next = COURSE[Math.min(tt.pos, COURSE.length - 1)];
      const dist = Math.round(distM(c, next));
      const arrow = relArrow(bearingDeg(c, next));
      const dh = Math.round(next.height - c.height);
      txt += " ／ 次 <b>" + (tt.pos + 1) + "</b>/" + COURSE.length + " " + arrow + " <b>" + dist + "</b> m" + (Math.abs(dh) > 20 ? (dh > 0 ? " ↑" : " ↓") + Math.abs(dh) + "m" : "");
      const el = tt.waiting
        ? "<b>READY?</b><small>○ボタン／スペースで スタート</small>"
        : tt.countdownEnd > performance.now()
        ? "<b>" + Math.ceil((tt.countdownEnd - performance.now()) / 1000) + "</b><small>スタートまで</small>"
        : "⏱ <b>" + ttFormat(performance.now() - tt.startMs) + "</b><small>" + tt.name + "　" + (tt.pos) + "/" + COURSE.length + " ゲート通過</small>";
      ttEl.innerHTML = el;
      ttEl.classList.add("on");
    } else {
      txt += " ／ いんザイ君 くぐり <b>" + passCount + "</b> 回";
      ttEl.classList.remove("on");
    }
    document.getElementById("shipReadout").innerHTML = txt;
  }

  // ------------------------------------------------------------
  // 夜景モード ON/OFF
  // ------------------------------------------------------------
  function applyNight(on) {
    window.nightOn = !!on;
    const sc = viewer.scene;
    ensureHud();
    sc.skyAtmosphere.show = !on && !liteOn;
    if (sc.sun) sc.sun.show = !on;
    if (sc.skyBox) sc.skyBox.show = true;
    sc.backgroundColor = on ? Cesium.Color.fromCssColorString("#03050f") : Cesium.Color.BLACK;
    if (tileset) tileset.customShader = on ? nightShader : undefined;
    try {
      const b = sc.postProcessStages.bloom;
      b.enabled = !!on && !liteOn;
      b.uniforms.glowOnly = false;
      b.uniforms.contrast = 128;
      b.uniforms.brightness = -0.3;
      b.uniforms.delta = 1.0;
      b.uniforms.sigma = 2.5;
      b.uniforms.stepSize = 1.0;
    } catch (e) { /* ブルームの無い版でも続ける */ }
    gates.forEach(function (g) { if (g.points) g.points.show = !!on; });
    if (labels) labels.show = !!on;
    if (stringPoints) stringPoints.show = !!on;
    hudEl.classList.toggle("on", !!on);
    document.body.classList.toggle("nightOn", !!on);
    // 右のスポット一覧は夜景中は既定で隠す（画面が狭くなり、レース中は邪魔になるため）。📍ボタンで開ける
    const cp = document.getElementById("controlPanel"), pt = document.getElementById("panelToggle");
    if (cp && pt) {
      if (on) { cp.style.display = "none"; pt.style.display = "inline-block"; }
      else { cp.style.display = ""; pt.style.display = ""; }
    }
    const btn = document.getElementById("nightBtn");
    if (btn) { btn.classList.toggle("off", !on); btn.textContent = on ? "🌃 夜景中" : "🌃 夜景"; }
    ["nightTourBtn", "nightTtBtn"].forEach(function (id) { const b = document.getElementById(id); if (b) b.classList.toggle("on", !!on); });
    if (on) {
      loadGates();
      buildStrings();
      if (!twinkleTimer) twinkleTimer = setInterval(twinkle, 110);
      if (!chaseTimer) chaseTimer = setInterval(chase, 260);
    } else {
      if (twinkleTimer) { clearInterval(twinkleTimer); twinkleTimer = null; }
      if (chaseTimer) { clearInterval(chaseTimer); chaseTimer = null; }
      capEl.classList.remove("show");
      if (tt.active) ttAbortNight("夜景モードを終了したので中止しました");
    }
    sc.requestRender();
  }
  window.nightRefresh = function () { if (window.nightOn) applyNight(true); };
  window.setNight = applyNight;
  window.nightCourse = COURSE;
  window.nightGateCount = function () { return gates.filter(function (g) { return !!g.points; }).length; };
  // 検証用：i 番ゲートの手前（来る方向）から図柄を正面に見る位置へカメラを置く
  window.nightGateView = function (i, distMeters) {
    const g = gates[i]; if (!g || !g.frame) return false;
    const f = Cesium.Math.toRadians(g.facing);
    const dm = distMeters || 450;
    const lon = g.def.lon + Math.sin(f) * dm / mLon(g.def.lat), lat = g.def.lat + Math.cos(f) * dm / M_LAT;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, g.def.height),
      orientation: { heading: Cesium.Math.toRadians((g.facing + 180) % 360), pitch: 0, roll: 0 },
    });
    return true;
  };

  (function waitTileset() {
    if (tileset) { if (window.nightOn) tileset.customShader = nightShader; return; }
    setTimeout(waitTileset, 400);
  })();

  // ------------------------------------------------------------
  // 自動遊覧：東の上空 → 10ゲートを順にくぐる → ゴール（千葉NT中央駅）へ降下
  // ------------------------------------------------------------
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function hideUiForTour(keepIds) {
    if (uiHidden.length) return;
    const keep = keepIds || [];
    CAPTURE_HIDE_IDS.concat(["speedChip", "padHud", "miniMap"]).forEach(function (id) {
      if (keep.indexOf(id) >= 0) return;
      const el = document.getElementById(id);
      if (el && el.style.display !== "none") { uiHidden.push([el, el.style.display]); el.style.display = "none"; }
    });
    const hm = document.getElementById("howtoModal");
    if (hm) hm.classList.remove("show");
  }
  function restoreUi() {
    uiHidden.forEach(function (p) { p[0].style.display = p[1]; });
    uiHidden = [];
  }
  async function startTour() {
    if (tourRunning || tt.active) return;
    tourRunning = true;
    // 夜間遊覧では BGM を自動で流す（2026-09-06 中司さん指示）。曲は「🎵 曲」で選んだもの（おまかせ＝夜景はクリスマス3曲）。
    // 受付のクリックを経ているので自動再生の制限に掛からない。利用者が「🎵 BGM」で止めた後は、再読み込みまで勝手に鳴らさない
    try {
      if (typeof bgmStart === "function" && !window.bgmUserOff && !(typeof bgmAudio !== "undefined" && bgmAudio && !bgmAudio.paused)) bgmStart();
    } catch (e) { /* 音が出なくても遊覧は続ける */ }
    const token = ++tourToken;
    const alive = function () { return token === tourToken; };
    const stop = function () { tourRunning = false; };
    if (!window.nightOn) applyNight(true);
    hideUiForTour();
    const prevBank = cameraBankEnabled;
    cameraBankEnabled = false;
    if (typeof setMode === "function" && walkMode) setMode(false);
    while (!tileset && !NO_TILES && alive()) await sleep(300);
    if (!alive()) return stop();
    await sleep(1500);

    const hdg0 = bearingDeg(START_POINT, COURSE[0]);
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(START_POINT.lon + 0.02, START_POINT.lat - 0.004, 2400),
      orientation: { heading: Cesium.Math.toRadians(hdg0), pitch: Cesium.Math.toRadians(-26), roll: 0 },
    });
    caption("🛸 印西の夜空へ<br><b>ようこそ</b>", 5000);
    await cinemaFlyTo(START_POINT.lon + 0.005, START_POINT.lat - 0.001, 900, -20, hdg0, 7);
    if (!alive()) return stop();
    caption("市内の駅や施設の上に うかぶ 光の <b>いんザイ君</b> を " + COURSE.length + "か所<br>順番に くぐって 千葉ニュータウン中央駅へ", 5000);
    await cinemaFlyTo(START_POINT.lon, START_POINT.lat, START_POINT.height, 0, bearingDeg(START_POINT, COURSE[0]), 5);
    if (!alive()) return stop();
    for (let i = 0; i < COURSE.length; i++) {
      const g = COURSE[i];
      const nxt = COURSE[i + 1];
      // ゲートを通り抜けて 120m 先まで進み、機首は次のゲートへ向け始める
      const hdgIn = bearingDeg(cameraLonLat(), g);
      const hdgOut = nxt ? bearingDeg(g, nxt) : hdgIn;
      const f = Cesium.Math.toRadians(hdgIn);
      const beyond = { lon: g.lon + Math.sin(f) * 120 / mLon(g.lat), lat: g.lat + Math.cos(f) * 120 / M_LAT };
      const dist = distM(cameraLonLat(), g);
      if (g.goal) caption("🏁 ゴールの <b>クリスマスいんザイ君</b>！", 4000);
      else if (i === Math.floor(COURSE.length / 2)) caption("半分まで来た！<small>この先は千葉ニュータウン中央駅まで</small>", 3500);
      await cinemaFlyTo(beyond.lon, beyond.lat, g.height, 0, hdgOut, Math.max(3.5, dist / 110));
      if (!alive()) return stop();
    }
    caption("🏁 <b>千葉ニュータウン中央駅</b> に到着", 4500);
    await cinemaFlyTo(STATION_CNT.lon, STATION_CNT.lat - 0.0028, 170, -25, 0, 6);
    if (!alive()) return stop();
    caption("🎮 ここからは <b>あなたが操縦</b><br><small>左スティックで前後左右・右スティックで見回す・R1でダッシュ<br>⏱ タイムトライアルは T キー</small>", 9000);
    cameraBankEnabled = prevBank;
    tourRunning = false;
    lastInputAt = performance.now();
    if (!TOUR_PARAM) restoreUi();
  }
  function cancelTour() {
    if (!tourRunning) return;
    tourToken++;
    tourRunning = false;
    try { viewer.camera.cancelFlight(); } catch (e) { /* 飛行中でなければ何もしない */ }
    cameraBankEnabled = true;
    if (capEl) capEl.classList.remove("show");
    if (!TOUR_PARAM) restoreUi();
  }
  window.startNightTour = startTour;

  // ------------------------------------------------------------
  // ⏱ 夜景タイムトライアル
  // ------------------------------------------------------------
  const tt = { active: false, waiting: false, pos: 0, startMs: 0, countdownEnd: 0, name: "", trialId: null, queue: Promise.resolve(), official: false, token: "" };
  window.nightTtState = tt;                 // 検証スクリプトから状態を見るため
  function bestKey() { return NIGHT_BEST_KEY + "-" + courseKey; }
  function localKey() { return NIGHT_LOCAL_RANK_KEY + "-" + courseKey; }
  function loadBest() { try { return JSON.parse(localStorage.getItem(bestKey()) || "null"); } catch (e) { return null; } }
  function saveBest(rec) { try { localStorage.setItem(bestKey(), JSON.stringify(rec)); } catch (e) { /* 保存できなくても続ける */ } }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(localKey()) || "[]"); } catch (e) { return []; } }
  function pushLocal(rec) {
    const list = loadLocal();
    list.push(rec);
    list.sort(function (a, b) { return a.elapsedMs - b.elapsedMs; });
    try { localStorage.setItem(localKey(), JSON.stringify(list.slice(0, 50))); } catch (e) { /* 同上 */ }
  }
  let lastInfo = null;
  async function fetchInfo() {
    try {
      const res = await fetch(TT_API);
      if (!res.ok) throw new Error("HTTP " + res.status);
      lastInfo = await res.json();
    } catch (e) { lastInfo = null; }
    return lastInfo;
  }
  function rankingTable(list, myName, title) {
    if (!list || !list.length) return "<p>" + title + "：まだ記録がありません。最初の記録をつくろう！</p>";
    let h = "<p><b>" + title + "</b></p><table><tr><th>順位</th><th>名前</th><th>タイム</th><th>日付</th></tr>";
    list.slice(0, 10).forEach(function (r, i) {
      const me = myName && r.name === myName;
      h += "<tr" + (me ? ' class="me"' : "") + "><td>" + (i + 1) + "</td><td>" + ttEsc(r.name) + "</td><td>" + ttFormat(r.elapsedMs) + "</td><td>" + ttEsc(String(r.date || "").slice(0, 10)) + "</td></tr>";
    });
    return h + "</table>";
  }
  // ---- CiDAO ログイン（このタイムレースは CiDAO 登録者だけ・ランキングはログインの表示名） ----
  // /api/metaverse-auth がログイン後に #mtoken=<署名トークン> を付けて戻してくる。トークンの中身（表示名・期限）は
  // 画面表示にだけ使い、正当性はサーバー（start）が署名で検証する
  const AUTH_URL = TT_API.replace(/metaverse-tt$/, "metaverse-auth");
  function takeTokenFromUrl() {
    const m = /[#&]mtoken=([^&]+)/.exec(location.hash || "");
    if (!m) return;
    try { localStorage.setItem(LOGIN_TOKEN_KEY, decodeURIComponent(m[1])); } catch (e) { /* 保存できなくても続ける */ }
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
  }
  function tokenKey(slot) { return slot === 2 ? LOGIN_TOKEN_KEY_P2 : LOGIN_TOKEN_KEY; }
  function getLogin(slot) {
    let tok = null;
    try { tok = localStorage.getItem(tokenKey(slot)); } catch (e) { return null; }
    if (!tok) return null;
    try {
      const body = tok.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
      const p = JSON.parse(decodeURIComponent(escape(atob(body))));
      if (!p || !p.nick || !p.exp || p.exp < Date.now()) return null;
      return { token: tok, nick: String(p.nick), uid: String(p.uid || "") };
    } catch (e) { return null; }
  }
  function clearLogin(slot) { try { localStorage.removeItem(tokenKey(slot)); } catch (e) { /* 同上 */ } }
  function loginUrl() {
    return AUTH_URL + "?return=" + encodeURIComponent(location.origin + location.pathname + location.search);
  }
  window.nightLogin = getLogin;

  // 2人対戦（vs-race.js）が動いていれば、照合した名前を PLAYER 1／2 に入れる（vs-race.js は触らず、公開されている vsRacePlayers に書く）
  function applyVsNames() {
    const ps = window.vsRacePlayers;
    if (!ps || !ps.length) return;
    const l1 = getLogin(1), l2 = getLogin(2);
    if (ps[0] && l1) ps[0].name = l1.nick;
    if (ps[1] && l2) ps[1].name = l2.nick;
  }
  setInterval(applyVsNames, 1000);
  // 2人対戦（vs-race.js）の START は、1人目・2人目の受付が済むまで通さない（名前がランキング・結果に出るため）。
  // vs-race.js は触らず、START ボタンのクリックを先取り（capture）して受付画面を出す
  let vsGateBound = false;
  function bindVsStartGate() {
    if (vsGateBound) return;
    const btn = document.getElementById("vsStartBtn");
    if (!btn) return;
    vsGateBound = true;
    btn.addEventListener("click", function (e) {
      const l1 = getLogin(1), l2 = getLogin(2);
      if (l1 && l2) return;
      e.stopImmediatePropagation(); e.preventDefault();
      applyVsNames();
      openEntryModal(l1 ? 2 : 1);
      claimMsg("2人対戦を始めるには、1人目と2人目の受付（会員証QR／表示名）が必要です。", false);
    }, true);
  }
  setInterval(bindVsStartGate, 1000);

  // 参加受付：会場の入口で 1人目／2人目 を照合する画面。右上のチップからいつでも開ける
  let entryChip = null;
  function ensureEntryChip() {
    if (entryChip) return;
    const st = document.createElement("style");
    st.textContent = "#nightEntryChip{position:absolute;top:52px;right:10px;z-index:61;background:rgba(20,30,40,0.85);color:#fff;border:1px solid rgba(120,230,255,0.4);border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;line-height:1.5;}" +
      "#nightEntryChip b{color:#ffd166}" +
      "#nightTtModal .tabs button{background:#2a3a55;color:#fff;margin:0 6px 8px 0;}#nightTtModal .tabs button.on{background:#ffd166;color:#1a2533;font-weight:bold;}";
    document.head.appendChild(st);
    entryChip = document.createElement("div");
    entryChip.id = "nightEntryChip";
    entryChip.title = "参加受付（会員証QR／表示名で1人目・2人目を照合）";
    entryChip.onclick = function () { openEntryModal(getLogin(1) ? 2 : 1); };
    document.body.appendChild(entryChip);
    updateEntryChip();
  }
  function updateEntryChip() {
    if (!entryChip) return;
    const l1 = getLogin(1), l2 = getLogin(2);
    entryChip.innerHTML = "👤 受付　1人目：<b>" + (l1 ? ttEsc(l1.nick) : "未") + "</b>　2人目：<b>" + (l2 ? ttEsc(l2.nick) : "未") + "</b>";
  }
  function openEntryModal(slot) {
    ensureHud(); ensureEntryChip();
    if (tourRunning) cancelTour();
    claimSlot = slot === 2 ? 2 : 1; claimFrom = "entry";
    const inner = document.getElementById("nightTtInner");
    const l1 = getLogin(1), l2 = getLogin(2);
    const cur = getLogin(claimSlot);
    inner.innerHTML =
      "<h2>👤 参加受付（CiDAO 登録者の確認）</h2>" +
      "<p>印西市３次元MAP は <b>CiDAO（市民DAO）の登録者</b> が使えます。会員証QR（CiDAO トップページの会員QR）か表示名で確認してください。2人対戦は1人目＝PLAYER 1、2人目＝PLAYER 2 になります。</p>" +
      '<div class="tabs"><button id="nightEntryTab1"' + (claimSlot === 1 ? ' class="on"' : "") + ">1人目" + (l1 ? "：" + ttEsc(l1.nick) : "（未）") + "</button>" +
      '<button id="nightEntryTab2"' + (claimSlot === 2 ? ' class="on"' : "") + ">2人目" + (l2 ? "：" + ttEsc(l2.nick) : "（未）") + "</button></div>" +
      (cur ? '<p>✅ ' + (claimSlot === 2 ? "2人目" : "1人目") + "：<b>" + ttEsc(cur.nick) + '</b> さん　<button class="sub" id="nightEntryClear">この人を外す</button></p>' : "") +
      claimSectionHtml(claimSlot === 2 ? "2人目" : "1人目") +
      (RECEPTION_REQUIRED && !l1
        ? '<div class="box" id="nightSignupBox"><b>🆕 まだ CiDAO に登録していない方</b><br>スマホで下の QR を読んで CiDAO に登録（無料・LINE でログイン）し、表示名を決めたら、この画面で「表示名」か「会員証QR」で入場してください。<br>' +
          '<div id="nightSignupQr" style="display:inline-block;background:#fff;padding:8px;border-radius:8px;margin:8px 0"></div><br><a href="' + SIGNUP_URL + '" target="_blank" rel="noopener" style="color:#8fe9ff">' + CIDAO_ORIGIN + '/login</a></div>' +
          '<p class="note">⛔ 印西市３次元MAP は CiDAO 登録者向けです。1人目の確認が済むまで 3D の街並みは読み込みません（1日の表示枠を大切に使うため）。</p>'
        : '<p><button class="go" id="nightEntryDone">✔ 受付を閉じる</button>' + (claimSlot === 1 && l1 ? '<button class="sub" id="nightEntryToTt">⏱ このままタイムレースへ</button>' : "") + "</p>" +
          '<p class="note">夜景タイムレースは1人目、2人対戦は1人目と2人目の確認が必要です。</p>') +
      '<p class="note" style="text-align:right">版 ' + NIGHT_VERSION + "</p>";
    document.getElementById("nightTtModal").classList.add("show");
    document.getElementById("nightEntryTab1").onclick = function () { stopQrScan(); openEntryModal(1); };
    document.getElementById("nightEntryTab2").onclick = function () { stopQrScan(); openEntryModal(2); };
    if (document.getElementById("nightSignupQr")) drawSignupQr();
    const done = document.getElementById("nightEntryDone");
    if (done) done.onclick = function () {
      closeTtModal(); updateEntryChip();
      // 会場モード：受付を閉じたら自動遊覧を始める（受付中に遊覧が走って噛み合わないのを防ぐ）
      if (TOUR_PARAM && !tt.active && !tourRunning) startTour();
    };
    const clr = document.getElementById("nightEntryClear");
    if (clr) clr.onclick = function () { clearLogin(claimSlot); applyVsNames(); openEntryModal(claimSlot); };
    const toTt = document.getElementById("nightEntryToTt");
    if (toTt) toTt.onclick = function () { stopQrScan(); openTtModal(); };
    lastInputAt = performance.now();   // 受付中は放置とみなさない
    bindClaimSection();
    updateEntryChip();
  }
  window.openNightEntry = openEntryModal;
  let qrLibLoading = null;
  function loadQrLib() {
    if (window.qrcode) return Promise.resolve();
    if (qrLibLoading) return qrLibLoading;
    qrLibLoading = new Promise(function (resolve, reject) {
      const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
      sc.onload = resolve; sc.onerror = function () { reject(new Error("QR ライブラリを読み込めません")); };
      document.head.appendChild(sc);
    });
    return qrLibLoading;
  }
  function drawSignupQr() {
    const box = document.getElementById("nightSignupQr");
    if (!box) return;
    loadQrLib().then(function () {
      const el = document.getElementById("nightSignupQr");
      if (!el || !window.qrcode) return;
      const qr = window.qrcode(0, "M");
      qr.addData(SIGNUP_URL);
      qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0 });   // 白地に黒（反転QRは読めない端末がある）
    }).catch(function () { if (box) box.textContent = "QR を表示できません。URL を直接開いてください。"; });
  }

  // 入場ゲート：index.html の loadTileset() が呼ぶ。1人目の確認が済んでいれば即 true、未確認なら受付を出して確認まで待つ
  let receptionWaiters = [];
  window.ensureMetaverseReception = function () {
    if (!RECEPTION_REQUIRED || getLogin(1)) return Promise.resolve(true);
    return new Promise(function (resolve) {
      receptionWaiters.push(resolve);
      openEntryModal(1);
    });
  };
  function resolveReception() {
    if (!getLogin(1)) return;
    const w = receptionWaiters; receptionWaiters = [];
    w.forEach(function (r) { r(true); });
  }

  // 会員照合の入力欄（QR・表示名・LINE）。ログイン中は「別の人で参加」用に折りたたんで出す
  function claimSectionHtml(who) {
    return '<div class="box"><b>📷 会員証QRを読む</b>（CiDAO のトップページに出る会員QRを、この端末のカメラにかざす）<br>' +
      '<button class="go" id="nightTtScan">📷 カメラで読む</button><button class="sub" id="nightTtScanStop" style="display:none">停止</button>' +
      '<div id="nightTtScanBox" style="display:none;margin-top:6px"><video id="nightTtVideo" playsinline muted style="width:100%;max-height:240px;background:#000;border-radius:8px"></video><canvas id="nightTtCanvas" style="display:none"></canvas><p class="note" id="nightTtScanMsg">QR をカメラの中央に…</p></div></div>' +
      '<div class="box"><b>⌨ CiDAO の表示名（ニックネーム）を入力</b><br>' +
      '<input id="nightTtClaimName" maxlength="40" placeholder="CiDAO に登録した表示名" style="margin:6px 0"><button class="go" id="nightTtClaim">この名前で参加</button>' +
      '<p class="note">登録と一致した表示名だけ参加できます。同じ表示名の人が複数いるときは LINE ログインか会員証QRをお願いします。</p></div>' +
      (claimSlot === 2 ? "" : '<p><button class="login" id="nightTtLogin">🔐 LINE でログインして参加' + (who ? "（" + who + "）" : "（別の方法）") + '</button></p>') +
      '<p class="note" id="nightTtClaimMsg"></p>';
  }
  function bindClaimSection() {
    const login = document.getElementById("nightTtLogin");
    if (login) login.onclick = function () {
      clearLogin(1);
      try { sessionStorage.setItem("cbi-meta-night-login-pending", "1"); } catch (e) { /* 同上 */ }
      location.href = loginUrl();
    };
    const claimBtn = document.getElementById("nightTtClaim"), nameEl = document.getElementById("nightTtClaimName");
    if (claimBtn) claimBtn.onclick = function () { clearLogin(claimSlot); claimByName(nameEl.value); };
    if (nameEl) nameEl.onkeydown = function (e) { if (e.key === "Enter") { clearLogin(claimSlot); claimByName(this.value); } };
    const scan = document.getElementById("nightTtScan"), stop = document.getElementById("nightTtScanStop");
    if (scan) scan.onclick = function () { clearLogin(claimSlot); startQrScan(); };
    if (stop) stop.onclick = stopQrScan;
  }
  async function openTtModal() {
    ensureHud();
    if (tourRunning) cancelTour();
    if (!window.nightOn) applyNight(true);
    const inner = document.getElementById("nightTtInner");
    const best = loadBest();
    const login = getLogin();
    const myName = login ? login.nick : "";
    inner.innerHTML =
      "<h2>⏱ 夜景タイムトライアル（イルミライINZAI タイムレース）</h2>" +
      "<p>スタート地点（" + COURSES[courseKey].startName + "）から、市内の駅や施設の真上にうかぶ <b>いんザイ君の光のゲート" + COURSE.length + "か所</b> を番号順にくぐり、千葉ニュータウン中央駅の上の <b>クリスマスいんザイ君</b>（" + COURSE.length + "番）をくぐったらゴール。順番をとばしたゲートは数えません。R1（Shift）でダッシュ！</p>" +
      '<p>コース：' + Object.keys(COURSES).map(function (k) {
        return '<label style="margin-right:12px;cursor:pointer"><input type="radio" name="nightCourse" value="' + k + '"' + (k === courseKey ? " checked" : "") + " style=\"width:auto;margin-right:4px\">" + COURSES[k].label + "</label>";
      }).join("") + "</p>" +
      (best ? "<p>🏅 この端末のベスト：<b>" + ttFormat(best.elapsedMs) + "</b>（" + ttEsc(best.name) + "・" + ttEsc(best.date) + "）</p>" : "") +
      (login
        ? '<p>👤 ログイン中：<b>' + ttEsc(login.nick) + '</b> さん（ランキングにはこの表示名で載ります）</p>' +
          '<p><button class="go" id="nightTtGo">🛸 スタート</button><button class="sub" id="nightTtClose">閉じる</button></p>' +
          '<details id="nightTtSwitch"><summary style="cursor:pointer;color:#8fe9ff">👥 別の人で参加する（会員証QR／表示名／LINE）</summary>' + claimSectionHtml("別の人") + '</details>'
        : '<p>このタイムレースは <b>CiDAO（市民DAO）の登録者</b> だけが参加できます。次のどれかで参加してください。</p>' +
          claimSectionHtml("") + '<p><button class="sub" id="nightTtClose">閉じる</button></p>') +
      '<p>🎮 右スティック（視点）の速さ：<select id="nightLookSens">' + LOOK_SENS_OPTIONS.map(function (o) {
        return '<option value="' + o[0] + '"' + (parseFloat(o[0]) === lookSens ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + '</select> <small>小さく倒したときは細かく、大きく倒したときだけ速く回ります</small></p>' +
      '<div id="nightTtRank"><p>ランキングを読み込み中…</p></div>' +
      '<p class="note" style="text-align:right">版 ' + NIGHT_VERSION + '</p>';
    document.getElementById("nightTtModal").classList.add("show");
    document.getElementById("nightLookSens").onchange = function () { setLookSens(parseFloat(this.value)); };
    if (login) document.getElementById("nightTtGo").onclick = function () { startTt(login.nick, login.token); };
    claimSlot = 1; claimFrom = "tt";
    bindClaimSection();
    document.getElementById("nightTtClose").onclick = closeTtModal;
    Array.prototype.forEach.call(document.querySelectorAll('input[name="nightCourse"]'), function (r) {
      r.onchange = function () { setCourse(r.value); openTtModal(); };
    });
    const info = await fetchInfo();
    const rankEl = document.getElementById("nightTtRank");
    if (!rankEl) return;
    if (info && info.ranking) {
      rankEl.innerHTML = rankingTable(info.ranking[COURSES[courseKey].serverKey], myName, "🏆 全国ランキング（" + COURSES[courseKey].label.split("（")[0] + "・公式記録・上位10）");
    } else {
      rankEl.innerHTML = rankingTable(loadLocal(), myName, "🏆 この端末の順位表（サーバーに繋がらないため参考記録）");
    }
  }
  function closeTtModal() { stopQrScan(); document.getElementById("nightTtModal").classList.remove("show"); updateEntryChip(); }

  // ---- 会員照合（表示名／会員証QR）：CiDAO API の claim が署名トークンを返す ----
  function claimMsg(text, ok) {
    const el = document.getElementById("nightTtClaimMsg");
    if (el) { el.textContent = text; el.style.color = ok ? "#6ee7a8" : "#ff9ecb"; }
  }
  let claimSlot = 1;               // いま照合している人（1=1人目／2=2人目）
  let claimFrom = "tt";            // 照合後に戻る画面（tt=参加画面／entry=参加受付）
  async function claim(payload) {
    claimMsg("照合しています…", true);
    try {
      const res = await fetch(TT_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: "claim" }, payload)) });
      if (res.status === 404) { claimMsg("CiDAO の登録が見つかりません。表示名を確認するか、LINE ログインで参加してください。", false); return false; }
      if (res.status === 409) { claimMsg("同じ表示名の会員が複数いるため特定できません。LINE ログインで参加してください。", false); return false; }
      if (!res.ok) { claimMsg("照合できませんでした（" + res.status + "）。しばらくして再度お試しください。", false); return false; }
      const d = await res.json();
      try { localStorage.setItem(tokenKey(claimSlot), d.token); } catch (e) { /* 保存できなくても続ける */ }
      stopQrScan();
      caption("👤 <b>" + ttEsc(d.nick) + "</b> さんで参加します" + (claimSlot === 2 ? "<small>（2人目）</small>" : ""), 2500);
      applyVsNames();
      if (claimFrom === "entry") {
        if (claimSlot === 1 && receptionWaiters.length) {
          // 入場待ちだった：受付を閉じて 3D の読み込みへ進む（2人目は受付チップから後で追加できる）
          resolveReception();
          closeTtModal(); updateEntryChip();
          if (TOUR_PARAM && !tt.active && !tourRunning) startTour();
        } else openEntryModal(claimSlot);
      } else openTtModal();
      return true;
    } catch (e) { claimMsg("サーバーに繋がりません。", false); return false; }
  }
  function claimByName(name) {
    name = String(name || "").trim();
    if (!name) { claimMsg("表示名を入力してください。", false); return; }
    claim({ name: name });
  }
  // Webカメラで会員証QR（https://cidao.vercel.app/talent/<uuid>）を読む。jsQR は CDN から必要時に読み込む
  let qrStream = null, qrTimer = null, qrLoading = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (resolve, reject) {
      const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      sc.onload = resolve; sc.onerror = function () { reject(new Error("jsQR を読み込めません")); };
      document.head.appendChild(sc);
    });
    return qrLoading;
  }
  async function startQrScan() {
    const box = document.getElementById("nightTtScanBox"), video = document.getElementById("nightTtVideo"), canvas = document.getElementById("nightTtCanvas"), msg = document.getElementById("nightTtScanMsg");
    if (!box || !video) return;
    try {
      await loadJsQR();
      qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 } }, audio: false });
    } catch (e) {
      claimMsg("カメラを使えません（" + (e && e.message) + "）。表示名の入力か LINE ログインで参加してください。", false);
      return;
    }
    box.style.display = "block";
    document.getElementById("nightTtScan").style.display = "none";
    document.getElementById("nightTtScanStop").style.display = "";
    video.srcObject = qrStream;
    try { await video.play(); } catch (e) { /* 自動再生が拒まれても次の描画で進む */ }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let busy = false;
    qrTimer = setInterval(function () {
      if (busy || !qrStream || video.readyState < 2) return;
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return;
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      let code = null;
      try { code = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" }); } catch (e) { code = null; }
      if (!code || !code.data) return;
      const m = String(code.data).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (!m) { if (msg) msg.textContent = "CiDAO の会員証QRではありません"; return; }
      busy = true;
      if (msg) msg.textContent = "読み取りました。照合しています…";
      claim({ uid: m[0] }).then(function (ok) { busy = false; if (!ok && msg) msg.textContent = "もう一度かざしてください"; });
    }, 300);
  }
  function stopQrScan() {
    if (qrTimer) { clearInterval(qrTimer); qrTimer = null; }
    if (qrStream) { try { qrStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* 無視 */ } qrStream = null; }
    const box = document.getElementById("nightTtScanBox"), b1 = document.getElementById("nightTtScan"), b2 = document.getElementById("nightTtScanStop"), v = document.getElementById("nightTtVideo");
    if (box) box.style.display = "none";
    if (b1) b1.style.display = "";
    if (b2) b2.style.display = "none";
    if (v) v.srcObject = null;
  }
  window.openNightTt = openTtModal;

  function startTt(name, token) {
    closeTtModal();
    hideUiForTour(["helpBox"]);            // 操作方法（左下）はレース中も見えるように残す
    if (typeof setMode === "function" && walkMode) setMode(false);
    gates.forEach(function (g) { g.prevSide = null; g._emph = undefined; });
    tt.active = true; tt.waiting = true; tt.pos = 0; tt.name = name; tt.trialId = null; tt.official = false; tt.token = token || "";
    tt.countdownEnd = 0; tt.startMs = 0;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(START_POINT.lon, START_POINT.lat, START_POINT.height),
      orientation: { heading: Cesium.Math.toRadians(bearingDeg(START_POINT, COURSE[0])), pitch: 0, roll: 0 },
    });
    // すぐにカウントダウンせず、準備の合図を待つ（コントローラーの中心合わせが済む前に始まって焦る、との指摘）
    caption("🎮 準備ができたら <b>○ボタン</b>（スペース／Enter でも可）で スタート<br><small>スティックから手を離して押すと、その位置を中心に合わせ直します。1番のゲート（" + COURSE[0].name + "の上空）は正面</small>", 0);
  }
  // 準備OK → 中心合わせ → 3・2・1 → 計測開始（サーバーへの開始登録もこの瞬間）
  let readyBtnPrev = false;
  function ttReadyGo() {
    if (!tt.active || !tt.waiting) return;
    tt.waiting = false;
    try {
      const pad = (typeof readGamepad === "function") ? readGamepad() : null;
      if (pad && typeof snapPadCenterNow === "function") snapPadCenterNow(pad);
    } catch (e) { /* コントローラーが無ければ何もしない */ }
    gates.forEach(function (g) { g.prevSide = null; });
    tt.countdownEnd = performance.now() + 3500;
    tt.startMs = tt.countdownEnd;
    caption("🛸 <b>3・2・1</b> でスタート<br><small>番号順に くぐろう</small>", 3500);
    tt.queue = ttApiPost({
      action: "start", name: tt.name, ageKey: "night", courseKey: COURSES[courseKey].serverKey, token: tt.token,
      quizRatePct: 100, quizAnswers: 0, checkpoints: COURSE.length,
    }).then(function (d) { tt.trialId = d.trialId || null; tt.official = !!tt.trialId; })
      .catch(function (e) {
        tt.trialId = null; tt.official = false;
        // ログインの期限切れ・偽トークンはサーバーが 401 で断る → 中止してログインし直してもらう
        if (/401/.test(String(e && e.message))) {
          clearLogin(1);
          ttAbortNight("ログインの有効期限が切れました。もう一度ログインしてください");
          setTimeout(openTtModal, 1500);
        }
      });
    setTimeout(function () { if (tt.active) caption("🚀 <b>GO!</b>", 1500); }, 3500);
  }
  window.nightTtReadyGo = ttReadyGo;
  function pollReadyButton() {
    if (!tt.active || !tt.waiting) { readyBtnPrev = false; return; }
    let pressed = false;
    try {
      const pad = (typeof readGamepad === "function") ? readGamepad() : null;
      if (pad) pressed = !!((pad.buttons[0] && pad.buttons[0].pressed) || (pad.buttons[1] && pad.buttons[1].pressed));
    } catch (e) { pressed = false; }
    if (pressed && !readyBtnPrev) ttReadyGo();
    readyBtnPrev = pressed;
  }
  function ttCheckpoint(pos) {
    tt.queue = tt.queue.then(function () {
      if (!tt.trialId) return;
      return ttApiPost({ action: "checkpoint", trialId: tt.trialId, pos: pos });
    }).catch(function () { /* 通過報告に失敗しても計測は続ける（サーバー側で要確認扱いになる） */ });
  }
  async function ttFinishNight() {
    const clientMs = Math.round(performance.now() - tt.startMs);
    tt.active = false;
    caption("🏁 <b>ゴール！</b><br><small>" + ttFormat(clientMs) + "　結果を集計中…</small>", 6000);
    let result = null;
    try {
      await tt.queue;
      if (tt.trialId) result = await ttApiPost({ action: "finish", trialId: tt.trialId });
    } catch (e) { result = null; }
    const official = !!(result && result.elapsedMs);
    const ms = official ? result.elapsedMs : clientMs;
    const date = new Date();
    const dateStr = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    const rec = { name: tt.name, elapsedMs: ms, date: dateStr, official: official };
    const best = loadBest();
    if (!best || ms < best.elapsedMs) saveBest(rec);
    pushLocal(rec);
    if (!TOUR_PARAM) restoreUi();
    // 結果画面
    ensureHud();
    const inner = document.getElementById("nightTtInner");
    let h = "<h2>🏁 ゴール！ " + ttEsc(tt.name) + " さん</h2>" +
      "<p style='font-size:30px;margin:4px 0;'>⏱ <b style='color:#ffd166'>" + ttFormat(ms) + "</b>" +
      (official ? " <small>（公式記録" + (result.flagged ? "・事務局確認対象" : "") + (result.recordCode ? "・記録コード " + ttEsc(result.recordCode) : "") + "）</small>" : " <small>（参考記録・サーバーに繋がりませんでした）</small>") + "</p>";
    if (official && typeof ttRankHtml === "function") h += ttRankHtml(result.rank);
    h += '<p><button class="go" id="nightTtAgain">🔁 もう一度（同じ人）</button><button class="sub" id="nightTtNext">👥 次の人へ（ログイン解除）</button><button class="sub" id="nightTtClose2">閉じる</button></p>' +
      '<div id="nightTtRank2"><p>ランキングを読み込み中…</p></div>';
    inner.innerHTML = h;
    document.getElementById("nightTtModal").classList.add("show");
    document.getElementById("nightTtAgain").onclick = function () { openTtModal(); };
    document.getElementById("nightTtNext").onclick = function () { clearLogin(1); openTtModal(); };
    document.getElementById("nightTtClose2").onclick = closeTtModal;
    const info = await fetchInfo();
    const rankEl = document.getElementById("nightTtRank2");
    if (!rankEl) return;
    rankEl.innerHTML = (info && info.ranking)
      ? rankingTable(info.ranking[COURSES[courseKey].serverKey], tt.name, "🏆 全国ランキング（公式記録・上位10）")
      : rankingTable(loadLocal(), tt.name, "🏆 この端末の順位表（参考記録）");
  }
  function ttAbortNight(reason) {
    if (!tt.active) return;
    tt.active = false; tt.waiting = false;
    tt.trialId = null;
    gates.forEach(function (g) { g._emph = undefined; });
    caption("⏹ タイムトライアル中止<small>" + (reason || "") + "</small>", 3000);
    if (!TOUR_PARAM) restoreUi();
    updateHud(true);
  }
  window.abortNightTt = ttAbortNight;

  // ------------------------------------------------------------
  // 操作の検知（遊覧の中断・放置の判定）とキー操作
  // ------------------------------------------------------------
  function noteInput() {
    lastInputAt = performance.now();
    if (tourRunning) cancelTour();
  }
  ["pointerdown", "wheel", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, noteInput, { passive: true });
  });
  document.addEventListener("keydown", function (e) {
    noteInput();
    if (!window.nightOn) return;
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (typing) return;
    if (e.key === "t" || e.key === "T") { if (!tt.active) openTtModal(); }
    if ((e.key === " " || e.key === "Enter") && tt.active && tt.waiting) { e.preventDefault(); ttReadyGo(); }
    if (e.key === "Escape") {
      if (RECEPTION_REQUIRED && !getLogin(1) && claimFrom === "entry" && document.getElementById("nightTtModal").classList.contains("show")) return; // 入場受付は必須
      if (document.getElementById("nightTtModal").classList.contains("show")) closeTtModal();
      else if (tt.active) ttAbortNight("Esc キー");
    }
  });
  function gamepadActive() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of pads) {
        if (!g) continue;
        for (const a of g.axes) if (Math.abs(a) > 0.35) return true;
        for (const b of g.buttons) if (b && b.pressed) return true;
      }
    } catch (e) { /* 取れない環境では無視 */ }
    return false;
  }
  setInterval(function () {
    if (RECEPTION_REQUIRED && !getLogin(1) && receptionWaiters.length && !document.getElementById("nightTtModal").classList.contains("show")) openEntryModal(1);
    if (!window.nightOn) return;
    const anyKey = Object.keys(keys).some(function (k) { return keys[k]; });
    if (anyKey || (joyState && joyState.active) || gamepadActive()) noteInput();
    if (TOUR_PARAM && !tourRunning && !tt.active &&
        !document.getElementById("nightTtModal").classList.contains("show") &&
        performance.now() - lastInputAt > IDLE_RESTART_MS) { clearLogin(1); clearLogin(2); updateEntryChip(); if (RECEPTION_REQUIRED) openEntryModal(1); else startTour(); }
  }, 500);

  // 地中ロック：夜景モード中は楕円体高 NIGHT_FLOOR_HEIGHT を下限にし、地面（タイルの高さ）が取れるときはその 3m 上を下限にする。
  // 本体の keepAboveGround は12フレームに1回なので、低fpsのダッシュでは地中に入ってから戻る＝画面が真っ黒になる瞬間があった
  let floorFrame = 0;
  function keepAboveFloor() {
    const cam = viewer.camera;
    const carto = Cesium.Cartographic.fromCartesian(cam.position);
    let minH = NIGHT_FLOOR_HEIGHT;
    floorFrame++;
    if (floorFrame % 4 === 0 && !NO_TILES && viewer.scene.sampleHeightSupported) {
      try {
        const ground = viewer.scene.sampleHeight(carto.clone());
        if (ground !== undefined && ground !== null && isFinite(ground)) minH = Math.max(minH, ground + 3);
      } catch (e) { /* 取れないフレームは下限だけで守る */ }
    }
    if (carto.height >= minH) return;
    cam.setView({
      destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), minH),
      orientation: { heading: cam.heading, pitch: Math.max(cam.pitch, Cesium.Math.toRadians(-10)), roll: cam.roll },
    });
  }
  viewer.clock.onTick.addEventListener(function () {
    if (!window.nightOn) return;
    if (!walkMode) keepAboveFloor();
    pollReadyButton();
    checkPass();
    updateHud(tt.active);
    updateTargetMarker();
  });

  // ------------------------------------------------------------
  // ボタン（☰メニュー）
  // ------------------------------------------------------------
  const nightBtn = document.getElementById("nightBtn");
  if (nightBtn) nightBtn.addEventListener("click", function () { applyNight(!window.nightOn); });
  // 操縦席の枠は 2026-09-04 に撤去（見にくいとの指摘）。index.html に残っているボタンは使わないので消す
  const hudBtn = document.getElementById("nightHudBtn");
  if (hudBtn) hudBtn.remove();
  const tourBtn = document.getElementById("nightTourBtn");
  if (tourBtn) tourBtn.addEventListener("click", function () { startTour(); });
  const ttBtn = document.getElementById("nightTtBtn");
  if (ttBtn) ttBtn.addEventListener("click", function () { if (tt.active) ttAbortNight("ボタン"); else openTtModal(); });

  // ------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------
  takeTokenFromUrl();
  // ログインから戻ってきたとき（#mtoken 付き）は、夜景モードを起こしてタイムレース画面を開き直す
  let cameBackFromLogin = false;
  try { cameBackFromLogin = !!getLogin() && sessionStorage.getItem("cbi-meta-night-login-pending") === "1"; sessionStorage.removeItem("cbi-meta-night-login-pending"); } catch (e) { /* 無くても続ける */ }
  if (NIGHT_PARAM) {
    applyNight(true);
    try {
      if (typeof bunkazaiPinsVisible !== "undefined" && bunkazaiPinsVisible) {
        bunkazaiPinsVisible = false; applyBunkazaiPinVisibility();
      }
    } catch (e) { /* 変数が無い版でも続ける */ }
    if (TOUR_PARAM && !cameBackFromLogin && !ENTRY_PARAM) startTour();
  }
  if (cameBackFromLogin && !RECEPTION_REQUIRED) { if (!window.nightOn) applyNight(true); setTimeout(openTtModal, 1200); }
  if (!q.get("cinema")) {
    ensureEntryChip();
    if (ENTRY_PARAM && !cameBackFromLogin && !(RECEPTION_REQUIRED && !getLogin(1))) setTimeout(function () { openEntryModal(getLogin(1) ? 2 : 1); }, 800);
  }
})();
