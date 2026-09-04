// ============================================================
// 🌃 夜景フライトモード（イルミライINZAI 会場上映向け・2026-09-04）
// ------------------------------------------------------------
// Google Photorealistic 3D Tiles は昼の写真しか無いので、夜は「それらしく」作る。
//  - 街並み：CustomShader で暗く青みがけ、位置で決まる乱数で窓明かりをまばらに灯す
//  - 空　　：大気表現と太陽を消して星空（Cesium 標準のスカイボックス）を出す
//  - 光　　：ブルーム（にじみ）を掛け、光点（PointPrimitive）が電飾に見えるようにする
//  - 主役　：空中に いんザイ君（クリスマス版の線画 SVG）を光の粒で浮かべる。
//            線画の内側は空いているので、宇宙船（一人称カメラ）でお腹をくぐれる
//  - 地上　：印西牧の原駅〜BIG HOP に光の列
//  - 演出　：宇宙船コックピットの HUD、くぐった瞬間の光の弾け、自動遊覧コース
//
// 入口：URL `?night=1`（会場は `?night=1&tour=1&mode=event`）／☰メニューの「🌃 夜景」ボタン
//   tour=1 … 起動時に自動遊覧（約50秒）→ そのあと自由操縦。操作が 150 秒無ければ遊覧を再開（放置対策）
// index.html 側の変数・関数（viewer / tileset / NO_TILES / SPOTS / cinemaFlyTo / CAPTURE_HIDE_IDS /
// cameraBankEnabled / liteOn / INZAI_GEOID_HEIGHT_M / keys / joyState / setPinVisible 等）をそのまま使う。
// このファイルは index.html の </script> の直後に読み込む（トップレベルの const/let は別スクリプトからも見える）。
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

  // ---- 空中のいんザイ君（光のゲート） ----
  // 位置は 印西牧の原駅（140.166716, 35.803497）と BIG HOP（140.162553, 35.803195）の間の上空。
  // 高さは楕円体高（この地域の地表は楕円体高で約60〜70m）。facing は図柄が向く方角（270=西向き＝
  // 西の千葉ニュータウン中央側から東へ飛んでくると正面に見える）
  const GATE = { lon: 140.1646, lat: 35.8033, height: 280, sizeM: 150, facing: 270 };
  const GATE_MAX_POINTS = 2400;             // 光の粒の上限（多いほど細かいが重い）
  const GATE_IMG = "assets/night/inzaikun_xmas.svg";

  const STATION = { lon: 140.166716, lat: 35.803497 };
  const BIGHOP = { lon: 140.162553, lat: 35.803195 };

  window.nightOn = false;                   // index.html の applyLite が空の表現を切るかどうかの判断に読む
  let gatePoints = null;                    // PointPrimitiveCollection（いんザイ君）
  let gateBase = [];                        // 各粒の元の色
  let gateFrame = null;                     // ENU 行列（くぐり判定用）
  let gateHalfW = 0, gateHalfH = 0;
  let stringPoints = null;                  // 光の列
  let stringBase = [];
  let twinkleTimer = null, chaseTimer = null, chaseTick = 0;
  let prevSide = null;                      // 前フレームにゲート面のどちら側にいたか
  let passCount = 0;
  let burstUntil = 0;
  let tourRunning = false, tourToken = 0;
  let lastInputAt = performance.now();
  let hudEl = null, capEl = null;
  let uiHidden = [];

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
      // 昼の写真を暗く・青みがけて夜にする（真っ黒にはせず、街の形が分かる程度に残す）
      "  vec3 night = c * vec3(0.11, 0.14, 0.26) + vec3(0.01, 0.015, 0.045);",
      // 窓明かり：世界座標を 6m 角のセルに区切り、セルごとの乱数で 4〜5% を灯す。
      // 座標は印西付近の ECEF 原点を引いて小さくしてから使う（float の精度対策）
      "  vec3 p = fsInput.attributes.positionWC - vec3(-3960000.0, 3310000.0, 3730000.0);",
      "  vec3 cell = floor(p / 6.0);",
      "  float h = nightHash(cell);",
      "  float win = step(0.955, h) * smoothstep(0.30, 0.65, lum);",
      "  vec3 warm = mix(vec3(1.0, 0.84, 0.52), vec3(0.72, 0.88, 1.0), step(0.6, nightHash(cell + 7.0)));",
      "  material.diffuse = night + warm * win * 0.95;",
      "}",
    ].join("\n"),
  });

  // ------------------------------------------------------------
  // 画像 → 光の粒（線画の白い画素を拾う）
  // ------------------------------------------------------------
  function sampleImage(img) {
    const W = 360, H = 360;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    let data;
    try { data = ctx.getImageData(0, 0, W, H).data; } catch (e) { console.warn("夜景: 画像を読めません", e); return null; }
    // 素材はレーザー加工用の図案：黒い円盤に線画が「抜き（透明）」で入っている。
    // そのため「不透明で明るい画素」だけでなく「円盤の内側にある透明な画素」も線として拾う。
    // 行ごとに不透明画素の左端・右端（円盤の縁）を求め、縁から少し内側の透明画素を線とみなす
    const lit = new Uint8Array(W * H);
    const rowCount = new Int32Array(H);
    const margin = Math.round(W * 0.03);      // 縁の赤いカット線との隙間を拾わないための余白
    for (let y = 0; y < H; y++) {
      let L = -1, R = -1;
      for (let x = 0; x < W; x++) { if (data[(y * W + x) * 4 + 3] >= 128) { if (L < 0) L = x; R = x; } }
      if (L < 0) continue;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const a = data[i + 3];
        let on = false;
        if (a >= 128) {
          const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          on = l > 140;
        } else {
          on = x > L + margin && x < R - margin;
        }
        if (on) { lit[y * W + x] = 1; rowCount[y]++; }
      }
    }
    // キャラクターの下にあるロゴ文字を除く：上から最初の点のある行を探し、そこから下へたどって
    // 「空行が続く」ところで切る（足元とロゴの間の隙間）
    let top = -1;
    for (let y = 0; y < H; y++) { if (rowCount[y] > 0) { top = y; break; } }
    if (top < 0) return null;
    let bottom = H - 1, gap = 0;
    for (let y = top; y < H; y++) {
      if (rowCount[y] === 0) { gap++; if (gap >= Math.round(H * 0.02)) { bottom = y - gap; break; } }
      else gap = 0;
    }
    let minX = W, maxX = 0;
    const pts = [];
    for (let y = top; y <= bottom; y += 2) {
      for (let x = 0; x < W; x += 2) {
        if (!lit[y * W + x]) continue;
        pts.push([x + Math.random() * 1.2 - 0.6, y + Math.random() * 1.2 - 0.6]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (pts.length === 0) return null;
    let keep = pts;
    if (pts.length > GATE_MAX_POINTS) {
      const p = GATE_MAX_POINTS / pts.length;
      keep = pts.filter(function () { return Math.random() < p; });
    }
    return { pts: keep, top: top, bottom: bottom, minX: minX, maxX: maxX, W: W, H: H };
  }

  function buildGate(sample) {
    const center = Cesium.Cartesian3.fromDegrees(GATE.lon, GATE.lat, GATE.height);
    gateFrame = Cesium.Transforms.eastNorthUpToFixedFrame(center);
    const f = Cesium.Math.toRadians(GATE.facing);
    // 図柄を正面から見る人の「右」方向（東北上フレーム）
    const ux = -Math.cos(f), uy = Math.sin(f);
    const charH = sample.bottom - sample.top;            // 図柄の高さ（px）
    const scale = GATE.sizeM / charH;                     // m/px
    const cx = (sample.minX + sample.maxX) / 2, cy = (sample.top + sample.bottom) / 2;
    gateHalfW = ((sample.maxX - sample.minX) / 2) * scale;
    gateHalfH = (charH / 2) * scale;

    if (gatePoints) viewer.scene.primitives.remove(gatePoints);
    gatePoints = new Cesium.PointPrimitiveCollection();
    gateBase = [];
    const hatLine = sample.top + charH * 0.22;            // 上 22% は帽子＝赤と白
    const local = new Cesium.Cartesian3();
    for (const p of sample.pts) {
      const x = (p[0] - cx) * scale, yUp = (cy - p[1]) * scale;
      local.x = ux * x; local.y = uy * x; local.z = yUp;
      const pos = Cesium.Matrix4.multiplyByPoint(gateFrame, local, new Cesium.Cartesian3());
      let col;
      const r = Math.random();
      if (p[1] < hatLine) col = r < 0.6 ? "#ff5a5a" : "#fff6f0";
      else if (r < 0.62) col = "#fff1c4";
      else if (r < 0.86) col = "#ffd166";
      else if (r < 0.95) col = "#9fd8ff";
      else col = "#ff9ecb";
      const c = Cesium.Color.fromCssColorString(col);
      gateBase.push(c);
      gatePoints.add({
        position: pos,
        color: c,
        pixelSize: 6,
        scaleByDistance: new Cesium.NearFarScalar(150, 2.2, 4000, 0.45),
        disableDepthTestDistance: 0,
      });
    }
    gatePoints.show = window.nightOn;
    viewer.scene.primitives.add(gatePoints);
  }

  function loadGate() {
    if (gatePoints) return;
    const img = new Image();
    img.onload = function () {
      const s = sampleImage(img);
      if (!s) { console.warn("夜景: いんザイ君の図柄から光の粒を作れませんでした"); return; }
      buildGate(s);
    };
    img.onerror = function () { console.warn("夜景: " + GATE_IMG + " を読み込めません"); };
    img.src = GATE_IMG;
  }

  // ------------------------------------------------------------
  // 地上の光の列（駅の周り・駅〜BIG HOP・BIG HOP の周り）
  // ------------------------------------------------------------
  const STRING_COLORS = ["#ff5252", "#ffd166", "#6ee7a8", "#7cc4ff", "#fff2e0"];
  function stringPath() {
    const out = [];
    const mLat = 111320, mLon = 111320 * Math.cos(Cesium.Math.toRadians(STATION.lat));
    function ring(c, rM, n) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push([c.lon + (Math.cos(a) * rM) / mLon, c.lat + (Math.sin(a) * rM) / mLat]);
      }
    }
    function line(a, b, n) {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push([a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t]);
      }
    }
    ring(STATION, 70, 90);
    line(STATION, BIGHOP, 100);
    ring(BIGHOP, 95, 120);
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
        color: c,
        pixelSize: 5,
        scaleByDistance: new Cesium.NearFarScalar(100, 2.0, 3000, 0.4),
      });
    }
    stringPoints.show = window.nightOn;
    viewer.scene.primitives.add(stringPoints);
  }

  // ------------------------------------------------------------
  // またたき・流れる色・くぐったときの弾け
  // ------------------------------------------------------------
  const twinkled = [];
  function twinkle() {
    if (!gatePoints || !window.nightOn) return;
    const now = performance.now();
    if (now < burstUntil) return;                  // 弾けている間はそちらに任せる
    for (const t of twinkled) t[0].color = gateBase[t[1]];
    twinkled.length = 0;
    const n = gatePoints.length;
    for (let k = 0; k < 70; k++) {
      const i = Math.floor(Math.random() * n);
      const p = gatePoints.get(i);
      const f = 0.35 + Math.random() * 1.1;
      const b = gateBase[i];
      p.color = new Cesium.Color(Math.min(1, b.red * f), Math.min(1, b.green * f), Math.min(1, b.blue * f), 1);
      twinkled.push([p, i]);
    }
  }
  function chase() {
    if (!stringPoints || !window.nightOn) return;
    chaseTick++;
    const n = stringPoints.length;
    for (let i = 0; i < n; i++) {
      stringPoints.get(i).color = stringBase[(i + chaseTick) % n];
    }
  }
  function burst() {
    if (!gatePoints) return;
    passCount++;
    burstUntil = performance.now() + 1600;
    const start = performance.now();
    const n = gatePoints.length;
    const white = Cesium.Color.WHITE;
    function step() {
      const t = (performance.now() - start) / 1600;
      if (t >= 1) {
        for (let i = 0; i < n; i++) { const p = gatePoints.get(i); p.color = gateBase[i]; p.pixelSize = 6; }
        return;
      }
      const k = 1 - t;                             // 1→0 に減衰
      for (let i = 0; i < n; i++) {
        const p = gatePoints.get(i);
        p.color = Cesium.Color.lerp(gateBase[i], white, k, new Cesium.Color());
        p.pixelSize = 6 + 10 * k;
      }
      requestAnimationFrame(step);
    }
    step();
    caption("✨ いんザイ君の光を くぐった！<small>" + passCount + "回目</small>", 3500);
    updateHud();
  }

  // くぐり判定：ゲート面（図柄の平面）を、図柄の範囲内で横切ったら弾ける
  const invFrame = new Cesium.Matrix4();
  const localPos = new Cesium.Cartesian3();
  function checkPass() {
    if (!gateFrame || !window.nightOn) return;
    Cesium.Matrix4.inverseTransformation(gateFrame, invFrame);
    Cesium.Matrix4.multiplyByPoint(invFrame, viewer.camera.position, localPos);
    const f = Cesium.Math.toRadians(GATE.facing);
    const nx = Math.sin(f), ny = Math.cos(f);     // 図柄の正面方向（東北上）
    const ux = -Math.cos(f), uy = Math.sin(f);    // 図柄の横方向
    const d = localPos.x * nx + localPos.y * ny;  // 面からの符号付き距離
    const s = localPos.x * ux + localPos.y * uy;  // 横位置
    const side = d >= 0 ? 1 : -1;
    if (prevSide !== null && side !== prevSide && Math.abs(d) < 60 &&
        Math.abs(s) < gateHalfW && Math.abs(localPos.z) < gateHalfH) {
      burst();
    }
    prevSide = side;
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
      "#shipHud .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 52%,rgba(2,6,14,0.55) 82%,rgba(2,6,14,0.92) 100%);}" +
      "#shipHud svg{position:absolute;inset:0;width:100%;height:100%;}" +
      "#shipHud .ret{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border:2px solid rgba(120,230,255,0.7);border-radius:50%;box-shadow:0 0 12px rgba(120,230,255,0.5);}" +
      "#shipHud .ret:before,#shipHud .ret:after{content:'';position:absolute;background:rgba(120,230,255,0.8);}" +
      "#shipHud .ret:before{left:50%;top:-10px;width:2px;height:14px;margin-left:-1px;}" +
      "#shipHud .ret:after{top:50%;left:-10px;height:2px;width:14px;margin-top:-1px;}" +
      "#shipReadout{position:absolute;left:50%;bottom:4.5%;transform:translateX(-50%);color:#8fe9ff;font:bold 15px/1.5 'Segoe UI',system-ui,sans-serif;letter-spacing:0.08em;text-shadow:0 0 10px rgba(120,230,255,0.8);white-space:nowrap;}" +
      "#shipReadout b{color:#ffd166;text-shadow:0 0 10px rgba(255,209,102,0.8);}" +
      "#nightCaption{position:absolute;left:50%;top:14%;transform:translateX(-50%);z-index:70;color:#fff;font-size:34px;font-weight:bold;text-align:center;line-height:1.5;width:92%;text-shadow:0 2px 16px rgba(0,0,0,0.95),0 0 6px rgba(0,0,0,0.9);opacity:0;transition:opacity 0.7s;pointer-events:none;}" +
      "#nightCaption.show{opacity:1;}#nightCaption small{display:block;font-size:19px;font-weight:normal;margin-top:6px;}#nightCaption b{color:#ffd166;}" +
      "#nightTourBtn{display:none;}#nightTourBtn.on{display:inline-block;}";
    document.head.appendChild(style);
    hudEl = document.createElement("div");
    hudEl.id = "shipHud";
    hudEl.innerHTML =
      '<div class="vig"></div>' +
      '<svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="nhG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1526"/><stop offset="1" stop-color="#05080f"/></linearGradient></defs>' +
      // 左右の支柱
      '<path d="M0,0 L70,0 L215,900 L0,900 Z" fill="url(#nhG)"/>' +
      '<path d="M1600,0 L1530,0 L1385,900 L1600,900 Z" fill="url(#nhG)"/>' +
      '<path d="M70,0 L215,900" stroke="rgba(120,230,255,0.35)" stroke-width="3" fill="none"/>' +
      '<path d="M1530,0 L1385,900" stroke="rgba(120,230,255,0.35)" stroke-width="3" fill="none"/>' +
      // 足元のコンソール
      '<path d="M0,900 L0,760 Q800,830 1600,760 L1600,900 Z" fill="url(#nhG)"/>' +
      '<path d="M0,760 Q800,830 1600,760" stroke="rgba(120,230,255,0.75)" stroke-width="4" fill="none"/>' +
      '<path d="M0,776 Q800,846 1600,776" stroke="rgba(120,230,255,0.18)" stroke-width="2" fill="none"/>' +
      // 天井の細い枠
      '<path d="M70,0 Q800,60 1530,0" stroke="rgba(120,230,255,0.25)" stroke-width="3" fill="none"/>' +
      "</svg>" +
      '<div class="ret"></div>' +
      '<div id="shipReadout"></div>';
    document.body.appendChild(hudEl);
    capEl = document.createElement("div");
    capEl.id = "nightCaption";
    document.body.appendChild(capEl);
  }
  let capTimer = null;
  function caption(html, ms) {
    ensureHud();
    capEl.innerHTML = html;
    capEl.classList.add("show");
    if (capTimer) clearTimeout(capTimer);
    if (ms) capTimer = setTimeout(function () { capEl.classList.remove("show"); }, ms);
  }
  let hudFrame = 0;
  function updateHud() {
    if (!hudEl || !window.nightOn) return;
    if ((hudFrame++ % 10) !== 0) return;
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
    const alt = Math.max(0, Math.round(carto.height - INZAI_GEOID_HEIGHT_M));
    const hdg = Math.round(Cesium.Math.toDegrees(viewer.camera.heading)) % 360;
    document.getElementById("shipReadout").innerHTML =
      "標高 <b>" + alt + "</b> m ／ 方位 <b>" + hdg + "</b>° ／ いんザイ君 くぐり <b>" + passCount + "</b> 回";
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
      b.enabled = !!on && !liteOn;                 // 軽量モードではブルームを掛けない（GPU負荷）
      b.uniforms.glowOnly = false;
      b.uniforms.contrast = 128;
      b.uniforms.brightness = -0.3;
      b.uniforms.delta = 1.0;
      b.uniforms.sigma = 2.5;
      b.uniforms.stepSize = 1.0;
    } catch (e) { /* ブルームの無い版でも続ける */ }
    if (gatePoints) gatePoints.show = !!on;
    if (stringPoints) stringPoints.show = !!on;
    hudEl.classList.toggle("on", !!on);
    const btn = document.getElementById("nightBtn");
    if (btn) { btn.classList.toggle("off", !on); btn.textContent = on ? "🌃 夜景中" : "🌃 夜景"; }
    const tb = document.getElementById("nightTourBtn");
    if (tb) tb.classList.toggle("on", !!on);
    if (on) {
      loadGate();
      buildStrings();
      if (!twinkleTimer) twinkleTimer = setInterval(twinkle, 110);
      if (!chaseTimer) chaseTimer = setInterval(chase, 260);
    } else {
      if (twinkleTimer) { clearInterval(twinkleTimer); twinkleTimer = null; }
      if (chaseTimer) { clearInterval(chaseTimer); chaseTimer = null; }
      capEl.classList.remove("show");
    }
    sc.requestRender();
  }
  // index.html の applyLite（軽量モード）から呼ばれ、空・ブルームの設定を夜景と両立させる
  window.nightRefresh = function () { if (window.nightOn) applyNight(true); };
  window.setNight = applyNight;
  window.nightGate = GATE;                    // 検証スクリプトからゲート位置を参照するため

  // tileset は後から読み込まれるので、来たらシェーダーを付ける
  (function waitTileset() {
    if (tileset) { if (window.nightOn) tileset.customShader = nightShader; return; }
    setTimeout(waitTileset, 400);
  })();

  // ------------------------------------------------------------
  // 自動遊覧（約50秒）：西の上空 → 牧の原へ → いんザイ君をくぐる → 観覧車の街をひとまわり → 駅に到着
  // ------------------------------------------------------------
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function hideUiForTour() {
    if (uiHidden.length) return;
    CAPTURE_HIDE_IDS.concat(["speedChip", "padHud", "miniMap"]).forEach(function (id) {
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
    if (tourRunning) return;
    tourRunning = true;
    const token = ++tourToken;
    const alive = function () { return token === tourToken; };
    if (!window.nightOn) applyNight(true);
    hideUiForTour();
    const prevBank = cameraBankEnabled;
    cameraBankEnabled = false;                   // 旋回の自動バンクは flyTo と喧嘩するので止める
    if (typeof setMode === "function" && walkMode) setMode(false);
    while (!tileset && !NO_TILES && alive()) await sleep(300);
    if (!alive()) { tourRunning = false; return; }
    await sleep(1500);

    const mLon = 111320 * Math.cos(Cesium.Math.toRadians(GATE.lat));
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(140.095, 35.803, 2400),
      orientation: { heading: Cesium.Math.toRadians(90), pitch: Cesium.Math.toRadians(-26), roll: 0 },
    });
    caption("🛸 印西の夜空へ<br><b>ようこそ</b>", 5000);
    await cinemaFlyTo(140.128, 35.803, 1000, -18, 90, 9);
    if (!alive()) { tourRunning = false; return; }

    caption("光の <b>いんザイ君</b> が<br>見えてきた", 5000);
    await cinemaFlyTo(GATE.lon - 900 / mLon, GATE.lat, GATE.height, 0, 90, 8);
    if (!alive()) { tourRunning = false; return; }

    caption("お腹の中を <b>くぐろう</b>", 4000);
    await cinemaFlyTo(GATE.lon + 260 / mLon, GATE.lat, GATE.height, 0, 90, 6);
    if (!alive()) { tourRunning = false; return; }

    caption("観覧車の街を<br><b>ひとまわり</b>", 5000);
    await cinemaFlyTo(BIGHOP.lon, BIGHOP.lat - 0.0035, 260, -30, 0, 6);
    if (!alive()) { tourRunning = false; return; }
    await cinemaFlyTo(BIGHOP.lon + 0.003, BIGHOP.lat, 220, -25, 270, 6);
    if (!alive()) { tourRunning = false; return; }

    caption("<b>印西牧の原駅</b> に到着", 4500);
    await cinemaFlyTo(STATION.lon, STATION.lat - 0.0028, 150, -25, 0, 6);
    if (!alive()) { tourRunning = false; return; }

    caption("🎮 ここからは <b>あなたが操縦</b><br><small>左スティックで前後左右・右スティックで見回す・R1でダッシュ<br>空にうかぶ いんザイ君 をくぐってみよう</small>", 9000);
    cameraBankEnabled = prevBank;
    tourRunning = false;
    lastInputAt = performance.now();
    if (!TOUR_PARAM) restoreUi();               // 会場（tour=1）ではボタン類を出したままにしない
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

  // 操作の検知（遊覧の中断・放置の判定）
  function noteInput() {
    lastInputAt = performance.now();
    if (tourRunning) cancelTour();
  }
  ["keydown", "pointerdown", "wheel", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, noteInput, { passive: true });
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
    if (!window.nightOn) return;
    const anyKey = Object.keys(keys).some(function (k) { return keys[k]; });
    if (anyKey || (joyState && joyState.active) || gamepadActive()) noteInput();
    if (TOUR_PARAM && !tourRunning && performance.now() - lastInputAt > IDLE_RESTART_MS) startTour();
  }, 500);

  // 毎フレーム：くぐり判定と HUD
  viewer.clock.onTick.addEventListener(function () {
    if (!window.nightOn) return;
    checkPass();
    updateHud();
  });

  // ------------------------------------------------------------
  // ボタン（☰メニュー）
  // ------------------------------------------------------------
  const nightBtn = document.getElementById("nightBtn");
  if (nightBtn) nightBtn.addEventListener("click", function () { applyNight(!window.nightOn); });
  const tourBtn = document.getElementById("nightTourBtn");
  if (tourBtn) tourBtn.addEventListener("click", function () { startTour(); });

  // ------------------------------------------------------------
  // 起動
  // ------------------------------------------------------------
  if (NIGHT_PARAM) {
    applyNight(true);
    // 夜空に文化財ピンが浮くと雰囲気が壊れるので、既定では隠す（📍ボタンで戻せる）
    try {
      if (typeof bunkazaiPinsVisible !== "undefined" && bunkazaiPinsVisible) {
        bunkazaiPinsVisible = false; applyBunkazaiPinVisibility();
      }
    } catch (e) { /* 変数が無い版でも続ける */ }
    if (TOUR_PARAM) startTour();
  }
})();
