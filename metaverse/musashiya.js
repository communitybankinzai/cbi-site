// 武蔵屋めぐり（2026-11-03 武蔵屋マルシェ会場用のイベントモード・2026-09-13 追加）
// 本埜の白鳥の郷をスタートし、千葉ニュータウン中央駅（3Dの街並みを見せる区間）を通って、武蔵屋から4km以内の文化財から
// ランダムに3か所をめぐり、武蔵屋（岩井家住宅主屋）でゴール（2026-09-13 中司さん指示でコース変更）。
// 通過するたびに写真（無ければ精霊カード）と説明文をポップアップし、ゴールでは武蔵屋のポップアップを画面に残す。
// 説明文は「こども（小学3〜4年生向け）／おとな」をスタート前に選ぶ。文面は musashiya-texts.json。
//
// カウントダウン・方向案内・通過判定は index.html のタイムトライアル（ttActive／ttCourse／onTick）をそのまま使い、
// サーバー記録・通過演出・目的地カード・ゴール処理だけをこのファイルで差し替える。
// 記録はサーバーに残さない（毎回コースが変わり順位の比較が公平にならないため。2026-09-13 中司さん決定）。
// 入口：モード「🏠 武蔵屋イベント」（?mode=musashiya。文化財めぐりとは別のモード・2026-09-13）。会場ではこのURLで開くと
// 白鳥・白鳥の湖・武蔵屋の前への移動のあと、開始画面が自動で出る。旧 ?event=musashiya も同じ扱い
(function () {
  "use strict";
  const MSY_VERSION = "2026-09-13h";
  const POOL_RADIUS_M = 4000; // 武蔵屋からこの距離以内の文化財から選ぶ（19件）
  const PICK = 3;             // めぐる数
  const AGE_KEY = "cbi-meta-msy-age-v1";
  const params = new URLSearchParams(location.search);
  const state = { on: false, age: loadAge(), home: -1, texts: {}, popTimer: null, popFinal: false, lastCourse: [], entered: false,
    waiting: false, settled: false, voice: loadVoice(), voiceName: loadVoiceName(), altTimer: null,
    leg0: null, leg0Timer: null, utter: null };
  // スタートと経由地（2026-09-13 中司さん「白鳥の郷から千葉ニュータウン中央駅を経由して3文化財を回り武蔵屋をゴールに」）
  // 白鳥の郷の座標は国土地理院の住所検索「印西市笠神2373」の代表点（要現地確認）。駅は index.html の SPOTS[0] を使う
  const SWAN_HOME = { name: "本埜の白鳥の郷", kana: "もとののはくちょうのさと", lon: 140.20665, lat: 35.813423 };
  const STATION_FALLBACK = { name: "千葉ニュータウン中央駅", lon: 140.116119, lat: 35.799983 };
  const STATION_RADIUS_M = 150;
  function station() {
    try { if (typeof SPOTS !== "undefined" && SPOTS[0] && /中央駅/.test(SPOTS[0].name)) return SPOTS[0]; } catch (e) {}
    return STATION_FALLBACK;
  }
  const VOICE_NAME_KEY = "cbi-meta-msy-voicename-v1";
  function loadVoiceName() { try { return localStorage.getItem(VOICE_NAME_KEY) || ""; } catch (e) { return ""; } }
  function saveVoiceName(n) { try { if (n) localStorage.setItem(VOICE_NAME_KEY, n); else localStorage.removeItem(VOICE_NAME_KEY); } catch (e) {} }
  const VOICE_KEY = "cbi-meta-msy-voice-v1";
  function loadVoice() { try { return localStorage.getItem(VOICE_KEY) === "female" ? "female" : "male"; } catch (e) { return "male"; } }
  function saveVoice(v) { try { localStorage.setItem(VOICE_KEY, v); } catch (e) {} }
  // 武蔵屋イベントモードか（index.html の applyMode が body.modeMusashiya を付ける）。旧URL ?event=musashiya も可
  const inEventMode = () => document.body.classList.contains("modeMusashiya") || params.get("event") === "musashiya";
  window.msyState = state; // 検証用

  function loadAge() { try { return localStorage.getItem(AGE_KEY) === "adult" ? "adult" : "kids"; } catch (e) { return "kids"; } }
  function saveAge(a) { try { localStorage.setItem(AGE_KEY, a); } catch (e) {} }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  fetch("musashiya-texts.json?v=" + MSY_VERSION)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j && j.spots) state.texts = j.spots; })
    .catch(() => {});

  // ---- コース ----
  function homeIdx() {
    for (let i = 0; i < BUNKAZAI.length; i++) if (BUNKAZAI[i].name.indexOf("岩井家住宅主屋") >= 0) return i;
    return -1;
  }
  function distM(a, b) {
    const R = 6371000, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    const dp = p2 - p1, dl = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function pickCourse(home, from) {
    const h = BUNKAZAI[home];
    const pool = [];
    for (let i = 0; i < BUNKAZAI.length; i++) if (i !== home && distM(h, BUNKAZAI[i]) <= POOL_RADIUS_M) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    // 同じ住所（同じ座標）の文化財が複数あるため、1回のコースで同じ地点を2度選ばない
    const seen = new Set(), picked = [];
    for (const i of pool) {
      const k = BUNKAZAI[i].lat.toFixed(5) + "," + BUNKAZAI[i].lon.toFixed(5);
      if (seen.has(k)) continue;
      seen.add(k); picked.push(i);
      if (picked.length === PICK) break;
    }
    // 手前の地点（駅）から近い順につなぐ（遠回りで1周が長くならないように）
    const out = [];
    let cur = from || h;
    const rest = picked.slice();
    while (rest.length) {
      rest.sort((a, b) => distM(cur, BUNKAZAI[a]) - distM(cur, BUNKAZAI[b]));
      const n = rest.shift();
      out.push(n); cur = BUNKAZAI[n];
    }
    return out;
  }

  // ---- 表示の部品 ----
  function imgFor(b) {
    if (b.photo) return { src: b.photo, alt: b.photoAlt || b.name, credit: "写真出典：印西市ホームページ" };
    if (b.cardImage) return { src: b.cardImage, alt: b.name + "の精霊カード", credit: "画像：文化財の精霊カード（市公式ページに写真はありません）" };
    return null;
  }
  function textFor(b) {
    const t = state.texts[b.reportId] || {};
    return (state.age === "kids" ? t.kids : t.adult) || b.description || "";
  }
  const isKids = () => state.age === "kids";

  const css = document.createElement("style");
  css.textContent =
    "#msyModal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:130}" +
    "#msyModal.show{display:flex}" +
    "#msyModal .msyBox{background:#10233a;color:#fff;border:2px solid #ffd166;border-radius:16px;padding:18px 20px;width:min(560px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.5)}" +
    "#msyModal h2{margin:0 0 8px;font-size:22px;color:#ffd166}" +
    "#msyModal p{margin:6px 0;line-height:1.7;font-size:15px}" +
    ".msyAge{display:flex;gap:12px;margin:14px 0 6px}" +
    ".msyAge button{flex:1;font-size:20px;padding:16px 8px;border-radius:12px;border:2px solid #7fc8ff;background:#1b3553;color:#fff;cursor:pointer}" +
    ".msyAge button.sel{background:#ffd166;color:#10233a;border-color:#ffd166;font-weight:bold}" +
    ".msyRow{display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}" +
    ".msyRow button{font-size:16px;padding:10px 16px;border-radius:10px;border:2px solid #7fc8ff;background:#1b3553;color:#fff;cursor:pointer}" +
    ".msyRow button.go{background:#ffd166;color:#10233a;border-color:#ffd166;font-weight:bold}" +
    ".msyVer{font-size:10px;color:#7f93a8;text-align:right;margin-top:6px}" +
    "#msyPop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:125;width:min(780px,94vw);max-height:86vh;overflow:auto;" +
      "background:rgba(12,24,40,.95);color:#fff;border:3px solid #ffd166;border-radius:18px;padding:16px 18px;display:none;box-shadow:0 10px 40px rgba(0,0,0,.55)}" +
    "#msyPop.show{display:block}" +
    "#msyPop .msyHead{font-size:20px;font-weight:bold;color:#ffd166;margin-bottom:10px}" +
    "#msyPop .msyBody{display:flex;gap:16px;align-items:flex-start}" +
    "#msyPop .msyBody img{width:42%;max-height:46vh;object-fit:contain;border-radius:10px;background:#000;flex:none}" +
    "#msyPop .msyName{font-size:22px;font-weight:bold;line-height:1.3}" +
    "#msyPop .msyKana{font-size:13px;color:#cfe6ff}" +
    "#msyPop .msyDesig{display:inline-block;font-size:12px;border:1px solid #7fc8ff;border-radius:8px;padding:1px 8px;margin:6px 0 2px}" +
    "#msyPop .msyText{line-height:1.85;margin-top:6px;font-size:16px}" +
    "#msyPop.kids .msyText{font-size:20px}" +
    "#msyPop .msyCredit{font-size:11px;color:#9fb6cc;margin-top:8px}" +
    "#msyPop .msyTime{font-size:18px;margin:0 0 10px}" +
    "#msyPop .msyTime b{color:#7fc8ff;font-size:24px}" +
    "@media (max-width:640px){#msyPop .msyBody{flex-direction:column}#msyPop .msyBody img{width:100%;max-height:34vh}#msyPop.kids .msyText{font-size:17px}}";
  document.head.appendChild(css);

  const modal = document.createElement("div");
  modal.id = "msyModal";
  document.body.appendChild(modal);
  const pop = document.createElement("div");
  pop.id = "msyPop";
  document.body.appendChild(pop);

  // ---- 開始画面（こども／おとな） ----
  function openModal() {
    if (typeof ttActive !== "undefined" && ttActive) { if (typeof showPickResult === "function") showPickResult("いまは計測中です。終わってから選んでください。", 3000); return; }
    hidePop();
    const tm = document.getElementById("ttModal");
    if (tm) tm.classList.remove("show");
    renderModal();
    modal.classList.add("show");
    padArm();
  }
  function renderModal() {
    modal.innerHTML =
      '<div class="msyBox">' +
        "<h2>🏠 武蔵屋めぐり</h2>" +
        "<p>本埜（もとの）の<b>白鳥の郷</b>から飛び立ち、<b>千葉ニュータウン中央駅</b>の上を通って、武蔵屋の近くの文化財を<b>3か所</b>めぐり、<b>武蔵屋</b>にとうちゃくしたらゴール！<br>" +
        "めぐる文化財は毎回かわります。とうちゃくすると、写真と説明が出ます。</p>" +
        '<p style="font-size:13px;color:#cfe6ff">説明文をえらんでください（コントローラーは ← → でえらんで ○ でスタート）</p>' +
        '<div class="msyAge">' +
          '<button type="button" data-age="kids" class="' + (isKids() ? "sel" : "") + '">👦 こども</button>' +
          '<button type="button" data-age="adult" class="' + (isKids() ? "" : "sel") + '">🧑 おとな</button>' +
        "</div>" +
        '<p style="font-size:13px;color:#cfe6ff;margin-top:10px">こども用の読み上げの声（十字キー ↑↓ でも切替）</p>' +
        '<div class="msyAge msyVoice">' +
          '<button type="button" data-voice="male" class="' + (state.voice === "male" ? "sel" : "") + '">👨 男性</button>' +
          '<button type="button" data-voice="female" class="' + (state.voice === "female" ? "sel" : "") + '">👩 女性</button>' +
          '<button type="button" data-act="voicetest" style="flex:.7">🔊 ためしに聞く</button>' +
        "</div>" +
        '<div style="font-size:12px;color:#cfe6ff;margin-top:4px">声をえらぶ：<select id="msyVoiceSel" style="font-size:13px;max-width:100%">' + voiceOptionsHtml() + "</select></div>" +
        '<div id="msyVoiceName" style="font-size:11px;color:#9fb6cc;min-height:1.2em"></div>' +
        '<div class="msyRow"><button type="button" data-act="close">とじる</button><button type="button" class="go" data-act="start">🚀 スタート</button></div>' +
        '<div class="msyVer">版 ' + MSY_VERSION + "</div>" +
      "</div>";
  }
  // 端末にある日本語の声の一覧（Edge なら Keita／Nanami の Online (Natural) が入る）。空なら準備待ち
  function voiceOptionsHtml() {
    const vs = jaVoices();
    let html = '<option value="">おまかせ（' + (state.voice === "male" ? "男性" : "女性") + "の声を自動で選ぶ）</option>";
    vs.forEach((v) => { html += '<option value="' + esc(v.name) + '"' + (v.name === state.voiceName ? " selected" : "") + ">" + esc(v.name.replace(/^Microsoft /, "").replace(/ - Japanese \(Japan\)$/, "")) + "</option>"; });
    if (!vs.length) html += '<option value="" disabled>（日本語の声が見つかりません）</option>';
    return html;
  }
  modal.addEventListener("change", function (e) {
    if (e.target && e.target.id === "msyVoiceSel") { state.voiceName = e.target.value; saveVoiceName(state.voiceName); }
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { closeModal(); return; }
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.age) { state.age = b.dataset.age; saveAge(state.age); renderModal(); return; }
    if (b.dataset.voice) { state.voice = b.dataset.voice; saveVoice(state.voice); state.voiceName = ""; saveVoiceName(""); renderModal(); return; }
    if (b.dataset.act === "voicetest") { speakSample(); return; }
    if (b.dataset.act === "close") closeModal();
    if (b.dataset.act === "start") start(state.age);
  });
  function closeModal() { modal.classList.remove("show"); }

  // ---- 武蔵屋の前（地上）へ移動する ----
  // 2026-09-13 中司さん「開始位置の高度が高すぎる、地上で武蔵屋からスタートにして」。
  // 通りに南面する建物なので、南へ約50mの地点から北（武蔵屋）を向く。高さは地面＋14m
  // （白鳥で飛ぶ飛行モードは地表＋12mより下へ下がれないため、その少し上）。地面の高さは3D街並みから取り、
  // 取れないとき（検証モード・読み込み待ちが長いとき）は楕円体高60m（木下の低地の目安）を使う
  const HOME_BACK_DEG = 0.00045, HOME_CLEARANCE_M = 3, HOME_FALLBACK_H = 45, FLIGHT_CLEARANCE_M = 3;
  function homeSpot() { return { lon: SWAN_HOME.lon, lat: SWAN_HOME.lat }; } // スタート地点＝白鳥の郷
  function flyHome(height) {
    const s = homeSpot();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, height),
      orientation: { heading: bearingRad(s, station()), pitch: Cesium.Math.toRadians(-6), roll: 0 }, // 駅の方を向く
      duration: 1.5,
    });
    state.homeHeight = height;
  }
  function bearingRad(a, b) {
    const dy = (b.lat - a.lat) * 111320, dx = (b.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return Math.atan2(dx, dy);
  }
  // 自分の向きを基準にした、目標への方向（index.html の ttBearingToNext と同じ言葉）
  function bearingTo(target) {
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
    const me = { lat: Cesium.Math.toDegrees(carto.latitude), lon: Cesium.Math.toDegrees(carto.longitude) };
    const bearing = bearingRad(me, target);
    let rel = bearing - viewer.camera.heading;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const relDeg = Cesium.Math.toDegrees(rel), a = Math.abs(relDeg);
    const abs = ((Cesium.Math.toDegrees(bearing) % 360) + 360) % 360;
    const compass = ["北", "北東", "東", "南東", "南", "南西", "西", "北西"][Math.round(abs / 45) % 8];
    const word = a < 20 ? "正面" : a < 70 ? (relDeg > 0 ? "右前" : "左前") : a < 110 ? (relDeg > 0 ? "右" : "左") : a < 160 ? (relDeg > 0 ? "右後ろ" : "左後ろ") : "後ろ";
    return { relDeg, word, compass, dist: distM(me, target) };
  }
  function goHome() {
    const s = homeSpot();
    let done = false;
    const finish = (ground) => {
      if (done) return;
      done = true;
      const ok = ground != null && isFinite(ground);
      flyHome(ok ? ground + HOME_CLEARANCE_M : HOME_FALLBACK_H);
      if (ok) state.settled = true;
    };
    state.settled = false; // 地面が取れないまま仮の高さに置いたときは、取れ次第 settleToGround() が降ろす
    const timer = setTimeout(() => finish(null), 3000);
    try {
      if (!params.has("notiles") && viewer.scene.sampleHeightSupported && viewer.scene.sampleHeightMostDetailed) {
        const c = [Cesium.Cartographic.fromDegrees(s.lon, s.lat)];
        viewer.scene.sampleHeightMostDetailed(c, viewer.entities.values.filter((e) => e.model))
          .then((r) => { clearTimeout(timer); finish(r && r[0] ? r[0].height : null); })
          .catch(() => { clearTimeout(timer); finish(null); });
      } else { clearTimeout(timer); finish(null); }
    } catch (e) { clearTimeout(timer); finish(null); }
  }

  // ---- HUD の高度表示（地上からの高さ。地面が測れないときは海抜）と、地面が取れ次第の降下 ----
  function groundAt(carto) {
    try {
      if (params.has("notiles") || !viewer.scene.sampleHeightSupported) return null;
      const g = viewer.scene.sampleHeight(carto, viewer.entities.values.filter((e) => e.model));
      return (g !== undefined && g !== null && isFinite(g)) ? g : null;
    } catch (e) { return null; }
  }
  function startAltTimer() {
    stopAltTimer();
    const hud = document.getElementById("ttHud");
    let el = document.getElementById("msyAlt");
    if (!el) { el = document.createElement("div"); el.id = "msyAlt"; el.style.cssText = "font-size:12px;color:#cfe6ff;margin-top:2px"; hud.appendChild(el); }
    state.altTimer = setInterval(function () {
      if (!state.on) { stopAltTimer(); return; }
      try {
        const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
        const g = groundAt(carto);
        if (g !== null) {
          el.textContent = "⛰ 地上から " + Math.round(Math.max(0, carto.height - g)) + "m";
          settleToGround(g);
        } else {
          el.textContent = "⛰ 海抜 " + Math.round(Math.max(0, carto.height - INZAI_GEOID_HEIGHT_M)) + "m";
        }
      } catch (e) {}
    }, 500);
  }
  function stopAltTimer() { clearInterval(state.altTimer); state.altTimer = null; const el = document.getElementById("msyAlt"); if (el) el.remove(); }
  // スタート待ちの間に地面の高さが取れたら、仮の高さから地面＋3m へ降りる（通信が遅く3D街並みが遅れて届いたとき）
  function settleToGround(g) {
    if (state.settled || !state.waiting) return;
    state.settled = true;
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
    if (carto.height - g <= HOME_CLEARANCE_M + 3) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), g + HOME_CLEARANCE_M),
      orientation: { heading: viewer.camera.heading, pitch: Cesium.Math.toRadians(-6), roll: 0 },
      duration: 1.2,
    });
  }
  // 白鳥のON/OFFボタンは「あそぶ」メニューの中にあり、武蔵屋モードでは隠れる。モード中は常時表示の列へ移す
  // 2Pレース（2人対戦タイムレース）のボタンも同じく出す（2026-09-13 中司さん「二人でタイムトライアルモードを復活させて」）
  function placeSwanBtn(inMode) {
    const anchor = document.getElementById("musashiyaBtn");
    const menu = document.querySelector("#tbGroupPlay .tbMenu");
    if (!anchor) return;
    ["swanToggleBtn", "vsRaceBtn"].forEach(function (id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (inMode) { if (btn.parentNode !== anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling); btn.style.display = ""; } // applyMode が消した display を戻す
      else if (menu && btn.parentNode !== menu) menu.appendChild(btn);
    });
  }

  // ---- 白鳥と「白鳥の湖」（2026-09-13 中司さん「武蔵屋イベントでは白鳥をデフォルトに、白鳥の湖を流して」） ----
  // 端末に保存されている曲の設定は書き換えない（この画面の間だけ白鳥の湖にする）。BGMを手で止めた人には流さない
  function eventLook(withMusic) {
    if (!window.vsRaceModeEnabled && typeof setSwanVisible === "function" && typeof swanEntity !== "undefined" && !swanEntity) setSwanVisible(true);
    if (!withMusic || window.bgmUserOff || typeof bgmStart !== "function") return;
    bgmCustom = null;
    bgmPreset = "swanlake";
    const pick = document.getElementById("bgmPickBtn");
    const pr = BGM_PRESETS.find((x) => x.key === "swanlake");
    if (pick && pr) pick.textContent = "🎵 曲をえらぶ（全" + BGM_PRESETS.length + "曲）｜いま: " + pr.name.replace(/（.*$/, "").slice(0, 14);
    bgmStart();
  }

  // ---- 開始 ----
  function start(age) {
    if (age) { state.age = age === "adult" ? "adult" : "kids"; saveAge(state.age); }
    const home = homeIdx();
    if (home < 0 || !BUNKAZAI.length) return;
    const course = pickCourse(home, station());
    if (course.length < PICK) return;
    state.home = home;
    state.lastCourse = course.slice();
    closeModal();
    hidePop();
    ttEntry = { name: "武蔵屋めぐり", ageLabel: isKids() ? "こども" : "おとな", level: "musashiya", courseKey: "musashiya", rate: 0, answers: 0, reqRatePct: 0 };
    ttCourse = course.concat([home]);
    ttPos = 0;
    // コントローラーの準備が整う前に計測が始まらないよう、○（Enter）を押すまで待つ（2026-09-13 中司さん）
    ttActive = false;
    state.on = true;
    state.waiting = true;
    const pp = document.getElementById("puzzlePanel");
    if (pp) pp.style.display = "none";
    eventLook(true);
    goHome();
    ttStartMs = 0;
    const hud = document.getElementById("ttHud");
    hud.style.display = "block";
    document.getElementById("ttHudTime").textContent = "🚦 じゅんび";
    document.getElementById("ttHudNext").innerHTML = "<b>○ボタン（Enter）でスタート！</b><br>まず " + esc(station().name) + " へ";
    document.body.classList.add("msyOn");
    placeHud();
    startAltTimer();
    ttShowCard();
    padArm();
  }
  // 準備OK → 3秒のカウントダウン → 計測（index.html の onTick に任せる）
  function readyGo() {
    if (!state.waiting) return;
    state.waiting = false;
    // 第1区間（白鳥の郷→駅）は駅が文化財でないため index.html の計測を使えない。ここで自前に数え、駅を通過したら
    // 文化財の区間を index.html の onTick に引き継ぐ（ttStartMs を渡すので時間は続きになる）
    state.leg0 = { countdownEnd: performance.now() + 3500, startMs: 0 };
    ttActive = false;
    ttApplyPinFocus();
    clearInterval(state.leg0Timer);
    state.leg0Timer = setInterval(leg0Tick, 100);
  }
  function leg0Tick() {
    const L = state.leg0;
    if (!L || !state.on) { clearInterval(state.leg0Timer); state.leg0Timer = null; return; }
    const now = performance.now();
    const hudTime = document.getElementById("ttHudTime"), hudNext = document.getElementById("ttHudNext");
    const st = station();
    const dir = bearingTo(st);
    document.getElementById("ttHudArrow").style.transform = "rotate(" + dir.relDeg.toFixed(0) + "deg)";
    if (now < L.countdownEnd) {
      hudTime.textContent = "🚦 " + Math.ceil((L.countdownEnd - now) / 1000);
      hudNext.textContent = "スタート準備中… まず " + st.name + " へ";
      return;
    }
    if (!L.startMs) L.startMs = now;
    hudTime.textContent = "⏱ " + ttFormat(now - L.startMs);
    hudNext.innerHTML = "つぎ（1/" + (ttCourse.length + 1) + "）: " + esc(st.name) + '<br><span class="ttDir">' + dir.word + "（" + dir.compass + "）</span> 約" +
      (dir.dist >= 1000 ? (dir.dist / 1000).toFixed(1) + "km" : Math.round(dir.dist) + "m");
    if (dir.dist <= STATION_RADIUS_M) {
      clearInterval(state.leg0Timer); state.leg0Timer = null;
      const startMs = L.startMs; state.leg0 = null;
      showStationPop();
      ttStartMs = startMs;      // 時間は続き
      ttCountdownEnd = 0;
      ttActive = true;          // ここから文化財3か所→武蔵屋は index.html の onTick
      ttApplyPinFocus();
    }
  }
  function showStationPop() {
    const st = station();
    const head = isKids() ? "✅ 千葉ニュータウン中央駅に とうちゃく！" : "✅ 千葉ニュータウン中央駅 通過";
    const text = isKids()
      ? "ここは千葉ニュータウン中央駅（ちばニュータウンちゅうおうえき）。まわりのビルや道路が、本物そっくりの3Dで見えるよ。ここから、武蔵屋（むさしや）の近くの文化財へ向かおう！"
      : "千葉ニュータウン中央駅の上空です。周囲の建物や道路は Google の3D都市データで、実際の街並みがそのまま再現されています。ここから武蔵屋の近くの文化財へ向かいます。";
    pop.className = "show " + state.age;
    pop.innerHTML = '<div class="msyHead">' + head + "</div>" +
      '<div class="msyBody"><div><div class="msyName">' + esc(st.name) + '</div><div class="msyText">' + esc(text) + "</div></div></div>" +
      '<div class="msyRow"><button type="button" class="go" data-act="next">' + (isKids() ? "つぎへ ▶（○ボタン）" : "次へ ▶（○ボタン）") + "</button></div>";
    state.popFinal = false;
    clearTimeout(state.popTimer);
    state.popTimer = setTimeout(hidePop, 20000);
    padArm();
    if (isKids()) speak(text.replace("千葉ニュータウン中央駅（ちばニュータウンちゅうおうえき）", "ちばニュータウンちゅうおうえき").replace("武蔵屋（むさしや）", "むさしや"));
  }
  // タイムのHUD（#ttHud）は上部メニューの2段目と重なって押せなくなる（2026-09-13 中司さん）。めぐり中はメニューの下に置く
  function placeHud() {
    if (!state.on) return;
    const bar = document.getElementById("topLeftBar");
    const hud = document.getElementById("ttHud");
    if (!bar || !hud) return;
    const r = bar.getBoundingClientRect();
    const mobile = window.matchMedia("(pointer: coarse), (max-width: 640px)").matches;
    hud.style.top = (mobile ? 92 : Math.max(52, Math.round(r.bottom + 6))) + "px";
  }
  window.addEventListener("resize", placeHud);
  function leaveHudPlace() {
    document.body.classList.remove("msyOn");
    const hud = document.getElementById("ttHud");
    if (hud) hud.style.top = "";
  }

  // ---- 通過・ゴールのポップアップ ----
  function popHtml(idx, head, extra) {
    const b = BUNKAZAI[idx];
    const img = imgFor(b);
    return '<div class="msyHead">' + head + "</div>" + (extra || "") +
      '<div class="msyBody">' +
        (img ? '<img src="' + esc(img.src) + '" alt="' + esc(img.alt) + '">' : "") +
        "<div>" +
          (isKids() && b.kana ? '<div class="msyKana">' + esc(b.kana) + "</div>" : "") +
          '<div class="msyName">' + esc(b.name) + "</div>" +
          (b.designation ? '<span class="msyDesig">' + esc(b.designation) + "</span>" : "") +
          '<div class="msyText">' + esc(textFor(b)) + "</div>" +
          (img ? '<div class="msyCredit">' + esc(img.credit) + "</div>" : "") +
        "</div>" +
      "</div>";
  }
  function showPassPop(idx, n, total) {
    const head = isKids() ? "✅ " + n + "か所目に とうちゃく！（のこり " + (total - n) + "）" : "✅ " + n + "か所目 通過（残り " + (total - n) + "）";
    pop.className = "show " + state.age;
    pop.innerHTML = popHtml(idx, head) +
      '<div class="msyRow"><button type="button" class="go" data-act="next">' + (isKids() ? "つぎへ ▶（○ボタン）" : "次へ ▶（○ボタン）") + "</button></div>";
    state.popFinal = false;
    clearTimeout(state.popTimer);
    state.popTimer = setTimeout(hidePop, isKids() ? 30000 : 25000); // 読み終わる前に消えないよう長め。○で先へ進める
    padArm();
    if (isKids()) speakKids(BUNKAZAI[idx]);
  }
  function showFinalPop(ms) {
    const head = isKids() ? "🎉 ゴール！ 武蔵屋に とうちゃく！" : "🎉 ゴール！ 武蔵屋に到着";
    const names = state.lastCourse.map((i) => esc(BUNKAZAI[i].name)).join(" → ");
    const extra = '<p class="msyTime">' + (isKids() ? "かかった時間" : "所要時間") + "：<b>" + ttFormat(ms) + "</b></p>" +
      '<p style="font-size:13px;color:#cfe6ff;margin:0 0 10px">' + esc(SWAN_HOME.name) + " → " + esc(station().name) + " → " + names + " → 武蔵屋</p>";
    pop.className = "show " + state.age;
    pop.innerHTML = popHtml(state.home, head, extra) +
      '<div class="msyRow"><button type="button" data-act="close">とじる</button><button type="button" class="go" data-act="again">🔁 もういちど（ちがう3か所）</button></div>';
    state.popFinal = true;
    clearTimeout(state.popTimer); // ゴールの画面は消さずに残す
    padArm();
  }
  function hidePop() { pop.classList.remove("show"); clearTimeout(state.popTimer); speakStop(); }

  // ---- 読み上げ（こども用の説明文を、Edge に入っている男性の声で。2026-09-13 中司さん指示） ----
  // Edge の日本語男性は「Microsoft Keita Online (Natural)」（自然な声・ネット必要）と「Microsoft Ichiro」（端末内）。
  // 無ければ日本語の声のどれか。声は読み上げのたびに探す（一覧の準備が遅れて最初は空のことがあるため）
  // 女性は「Microsoft Nanami Online (Natural)」（自然な声）、無ければ Ayumi／Haruka／Sayaka（端末内）。2026-09-13 中司さん「男性のなまりが強いので女性にも変更したい」
  const VOICE_NAMES = { male: ["Keita", "Ichiro"], female: ["Nanami", "Ayumi", "Haruka", "Sayaka"] };
  function jaVoices() {
    if (!window.speechSynthesis) return [];
    try { return speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang)); } catch (e) { return []; }
  }
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const vs = jaVoices();
    if (state.voiceName) { const v = vs.find((x) => x.name === state.voiceName); if (v) return v; }
    const order = VOICE_NAMES[state.voice] || VOICE_NAMES.male;
    for (const key of order) { const v = vs.find((x) => x.name.indexOf(key) >= 0); if (v) return v; }
    return vs[0] || null;
  }
  // 読み上げ中は BGM を小さくする（2026-09-13 中司さん）。終わったら元の大きさへ
  const BGM_DUCK = 0.08;
  const SPEECH_RATE = 1.2; // 読み上げの速さ（1.0 が標準。2026-09-13 中司さん「スピードを上げられないか」→ 0.95 から 1.2 へ）
  function bgmDuck(on) {
    try {
      if (typeof bgmAudio === "undefined" || !bgmAudio) return;
      if (on) { if (state.bgmVol == null) state.bgmVol = bgmAudio.volume; bgmAudio.volume = Math.min(bgmAudio.volume, BGM_DUCK); }
      else if (state.bgmVol != null) { bgmAudio.volume = state.bgmVol; state.bgmVol = null; }
    } catch (e) {}
  }
  // 読まれない文化財があった（2026-09-13 中司さん）。原因として (1) cancel() の直後の speak() が捨てられる、
  // (2) 参照を持たない utterance が途中で回収される、の2つが知られているので、少し待ってから読み、参照を state に残す
  function speak(text) {
    if (!window.speechSynthesis) return null;
    speakStop();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = SPEECH_RATE;
    u.onend = u.onerror = function () { if (state.utter === u) { bgmDuck(false); state.utter = null; } };
    state.lastSpeech = { text: u.text, voice: v ? v.name : null };
    state.utter = u;
    bgmDuck(true);
    clearTimeout(state.speakTimer);
    state.speakTimer = setTimeout(function () { if (state.utter === u) speechSynthesis.speak(u); }, 150);
    return v;
  }
  function speakSample() {
    const v = speak("こんにちは。武蔵屋めぐりへ ようこそ。白鳥になって、印西の空を飛びましょう。");
    const el = document.getElementById("msyVoiceName");
    if (el) el.textContent = v ? "使う声：" + v.name : "日本語の声が見つかりません（Edge で開くと男性 Keita・女性 Nanami が使えます）";
  }
  // 「利根川（とねがわ）」のように漢字の直後に（ひらがな）が付く所は読みだけを読む（二度読み防止）
  function speechText(b) {
    const t = textFor(b).replace(/[一-鿿々〆ヵヶ]+（([ぁ-ゖー]+)）/g, "$1");
    return (b.kana || b.name) + "。" + t;
  }
  function speakKids(b) { speak(speechText(b)); }
  function speakStop() { clearTimeout(state.speakTimer); state.utter = null; try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} bgmDuck(false); }
  // 画面を閉じる・別のページへ移るときは音楽と読み上げを止める（2026-09-13 中司さん「ブラウザ閉じても白鳥の湖が止まらない」。
  // 同じサイトを別のタブでも開いていた可能性が高いが、念のためこの画面の分は確実に止める）
  window.addEventListener("pagehide", function () {
    speakStop();
    try { if (typeof bgmAudio !== "undefined" && bgmAudio) bgmAudio.pause(); } catch (e) {}
  });
  if (window.speechSynthesis) { speechSynthesis.getVoices(); speechSynthesis.addEventListener("voiceschanged", () => speechSynthesis.getVoices()); }
  pop.addEventListener("click", function (e) {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "next" || b.dataset.act === "close") hidePop();
    if (b.dataset.act === "again") openModal();
  });

  // ---- タイムトライアルの差し替え（武蔵屋めぐり中だけ） ----
  function wrap(name, fn) {
    const orig = window[name];
    if (typeof orig !== "function") { console.warn("[musashiya] " + name + " が見つかりません"); return; }
    window[name] = function () { return state.on ? fn.apply(this, arguments) : orig.apply(this, arguments); };
  }
  wrap("ttServerStart", function () {});      // サーバーに記録しない
  wrap("ttServerCheckpoint", function () {});
  wrap("ttSpiritPass", function (idx) {
    if (pieces[idx] === undefined) awardPiece(idx); // 通常の文化財めぐりと同じくピースも獲得
    if (ttPos >= ttCourse.length - 1) return;     // 最後（武蔵屋）はゴールのポップアップで出す
    showPassPop(idx, ttPos + 1, ttCourse.length - 1);
  });
  // 次の目的地カード（左下の写真つきカード）は出さない。開始した瞬間に精霊の絵が大きく出て
  // 「いきなり精霊が出てきた」と見えたため（2026-09-13 中司さん）。次の場所の名前と方向は上のHUDが示す
  wrap("ttShowCard", function () {
    const card = document.getElementById("ttCard");
    card.innerHTML = "";
    card.classList.remove("shown", "open");
  });
  wrap("ttFinish", function (ms) {
    ttActive = false;
    state.on = false;
    state.waiting = false;
    state.leg0 = null; clearInterval(state.leg0Timer); state.leg0Timer = null;
    stopAltTimer();
    leaveHudPlace();
    document.getElementById("ttHud").style.display = "none";
    ttRestorePins();
    ttHideCard();
    if (pieces[state.home] === undefined) awardPiece(state.home);
    showFinalPop(ms);
  });
  (function () { // 中止（HUDの中止ボタン・モード切替など）
    const orig = window.ttAbort;
    if (typeof orig !== "function") return;
    window.ttAbort = function () { state.on = false; state.waiting = false; state.leg0 = null; clearInterval(state.leg0Timer); state.leg0Timer = null; stopAltTimer(); leaveHudPlace(); hidePop(); return orig.apply(this, arguments); };
  })();

  // ---- コントローラー・キーボード（開始画面とポップアップを開いているときだけ） ----
  let padRaf = 0, padPrev = {};
  function uiOpen() { return modal.classList.contains("show") || pop.classList.contains("show") || state.waiting; }
  window.msyAbort = function () { if (state.on) ttAbort(); };
  function readPads() {
    const out = [];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      out.push({ i: p.index, ok: btn(0), l: btn(14) || p.axes[0] < -0.6, r: btn(15) || p.axes[0] > 0.6, ud: btn(12) || btn(13) });
    }
    return out;
  }
  function padArm() {
    padPrev = {};
    readPads().forEach((s) => { padPrev[s.i] = s; }); // 押しっぱなしのボタンで即反応しないよう、今の状態を覚えてから見る
    if (!padRaf) padRaf = requestAnimationFrame(padLoop);
  }
  function padLoop() {
    if (!uiOpen()) { padRaf = 0; return; }
    readPads().forEach((s) => {
      const p = padPrev[s.i] || {};
      if (s.ok && !p.ok) onOk();
      if (s.l && !p.l) onLR();
      if (s.r && !p.r) onLR();
      if (s.ud && !p.ud) onUD();
      padPrev[s.i] = s;
    });
    padRaf = requestAnimationFrame(padLoop);
  }
  function onOk() {
    if (modal.classList.contains("show")) { start(state.age); return; }
    if (state.waiting) { readyGo(); return; }
    if (pop.classList.contains("show")) { if (state.popFinal) openModal(); else hidePop(); }
  }
  function onLR() {
    if (!modal.classList.contains("show")) return;
    state.age = isKids() ? "adult" : "kids";
    saveAge(state.age);
    renderModal();
  }
  function onUD() {
    if (!modal.classList.contains("show")) return;
    state.voice = state.voice === "male" ? "female" : "male";
    saveVoice(state.voice);
    renderModal();
  }
  document.addEventListener("keydown", function (e) {
    if (!uiOpen()) return;
    if (e.key === "Enter") { e.preventDefault(); onOk(); }
    else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && modal.classList.contains("show")) { e.preventDefault(); onUD(); }
    else if (e.key === "Escape") { if (modal.classList.contains("show")) closeModal(); else if (!state.popFinal) hidePop(); }
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && modal.classList.contains("show")) { e.preventDefault(); onLR(); }
  }, true);

  // 会場URL（?event=musashiya）では通常の精霊出現を止める。開始前に武蔵屋の前へ移動するので、
  // ピース未取得の端末では武蔵屋の精霊がすぐ出てしまうため。ピースは武蔵屋めぐりの通過で獲得できる
  (function () {
    const origEnc = window.showEncounter;
    if (typeof origEnc !== "function") return;
    window.showEncounter = function () { if (inEventMode()) return; return origEnc.apply(this, arguments); };
  })();

  // ---- 入口 ----
  const btn = document.getElementById("musashiyaBtn");
  if (btn) btn.addEventListener("click", openModal);
  window.msyOpen = openModal;
  window.msyHomeHeight = () => state.homeHeight; // 検証用
  // ブラウザは画面に一度触れるまで音を出せないため、武蔵屋イベントモードでは最初のクリック・キー操作（受付の操作を含む）で白鳥の湖を流す
  (function () {
    const first = function () {
      if (!inEventMode()) return; // 別のモードのときは何もせず、次の操作でまた見る
      document.removeEventListener("pointerdown", first, true);
      document.removeEventListener("keydown", first, true);
      eventLook(true);
    };
    document.addEventListener("pointerdown", first, true);
    document.addEventListener("keydown", first, true);
  })();
  window.msyStart = start;
  // モードに入ったとき（URL・モード切替のどちらでも）：白鳥・武蔵屋の前へ移動・開始画面。1回だけ
  // 他の利用者の光点・同行者リストを出さない（2026-09-13 中司さん「利用者640がいつもいて邪魔」）
  function rtDetach(on) {
    try {
      if (on) {
        if (typeof rtChannel !== "undefined" && rtChannel) { rtChannel.unsubscribe(); rtChannel = null; rtReady = false; }
        if (typeof rtOthers !== "undefined") Object.keys(rtOthers).forEach((k) => { try { rtRemove(k); } catch (e) {} });
        const peers = document.getElementById("rtPeers"); if (peers) peers.style.display = "none";
        const bar = document.getElementById("stampBar"); if (bar) bar.style.display = "none";
      } else if (typeof rtConnect === "function" && (typeof rtChannel === "undefined" || !rtChannel)) rtConnect();
    } catch (e) {}
  }
  function enterMode() {
    placeSwanBtn(true);
    rtDetach(true); // 会場では他の利用者の光点・同行者リストを出さない
    window.flightClearanceM = FLIGHT_CLEARANCE_M; // 飛行中に地面へ近づける（index.html の keepAboveGround が見る）
    if (state.entered) return;
    const loaded = typeof BUNKAZAI !== "undefined" && BUNKAZAI.length > 0;
    const received = params.has("notiles") || params.has("cinema") || typeof window.nightLogin !== "function" || !!window.nightLogin(1);
    if (!loaded || !received) return; // 読み込み・受付（CiDAO照合）待ち。下の巡回が呼び直す
    state.entered = true;
    eventLook(false);
    goHome();
    setTimeout(openModal, 800);
  }
  window.msyEnterMode = enterMode;
  window.msyLeaveMode = function () { // 別のモードへ切り替えたとき
    state.entered = false;
    placeSwanBtn(false);
    rtDetach(false);
    delete window.flightClearanceM;
    if (state.on && typeof ttAbort === "function") ttAbort();
    hidePop(); closeModal();
  };
  // 会場用：?mode=musashiya で開いたときは、文化財データの読み込みと受付が済んだところで開始画面を出す
  (function () {
    let tries = 0;
    const t = setInterval(function () {
      tries++;
      if (inEventMode()) enterMode();
      if (state.entered || tries > 1200) clearInterval(t); // 10分で諦める
    }, 500);
  })();
})();
