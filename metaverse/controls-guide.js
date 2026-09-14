// 3Dワールド「🎮 操作のしかた」ポップアップ（2026-09-13 中司さん：武蔵屋イベント）
// 左に鳥（白鳥／鳶の GLB を Three.js で表示）、右にコントローラーの図。手順ごとに、ずんだもんの声・光るボタン・鳥の姿勢を同時に切り替える。
// コントローラーを動かすと、図のボタンが光り、鳥も同じ姿勢になる（練習）。開いている間は index.html の飛行入力を止める（window.cbiInputHold）。
// 武蔵屋めぐりのスタート待ち（街並みの読み込み中）に musashiya.js が自動で開く。読み込めたら A（○）でそのままスタートできる。
// 文面と声：assets/narration/controls-guide.json、音声は assets/narration/build_controls_voicevox.py（VOICEVOX:ずんだもん・クレジット必須）
(function () {
  "use strict";
  const VER = "20260914-6";
  // 声と手順データの版。文を変えて音声を作り直したときだけ上げる（上げると端末に保存済みの声も取り直しになる。JS を直しただけでは上げない）
  const VOICE_VER = "20260913-1";
  // 手順データ（controls-guide.json）の版。JSON を変えたら必ず上げる（上げないと端末に保存済みの古い JSON が使われ続ける。2026-09-14 実際に起きた）
  const STEPS_VER = "20260914-1";
  const HOLD_MS = 1000; // 操作説明の中では A（○）を1秒長押しでスタート（2026-09-14 中司さん：説明中の誤スタート防止）
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/+esm";
  const GLTF_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js/+esm";
  // ゲーム本体（index.html の白鳥）と同じ URL にして、ブラウザのキャッシュを使い回す（通信を増やさない）
  const GLB = { swan: "assets/tonbi/swan.glb?v=20260909-4", kite: "assets/tonbi/kite.glb?v=20260909-4" };
  const VOICE_BASE = "assets/narration/zundamon/guide_";
  const BGM_DUCK = 0.08;
  // 標準配列のボタン番号（Xbox 配列・PlayStation とも同じ）
  const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9 };

  // ---- 手順ごとのお手本の動き（t＝秒。入力の形は live のコントローラーと同じ）----
  const DEMO = {
    intro: { T: 4, f: () => ({ ly: -0.5 }) },
    lstick: { T: 7, f: (t) => t < 2.2 ? { ly: -1 } : t < 3.7 ? { ly: -0.5, lx: -1 } : t < 5.2 ? { ly: -0.5, lx: 1 } : { ly: -0.3 } },
    rstick: { T: 7, f: (t) => t < 1.5 ? { rx: -1 } : t < 1.8 ? {} : t < 3.3 ? { rx: 1 } : t < 3.6 ? {} : t < 5 ? { ry: -1 } : t < 5.3 ? {} : t < 6.7 ? { ry: 1 } : {} },
    trig: { T: 6.5, f: (t) => t < 2.6 ? { rt: 1, ly: -0.4 } : t < 3.2 ? { ly: -0.4 } : t < 5.8 ? { lt: 1, ly: -0.4 } : { ly: -0.4 } },
    bump: { T: 6.5, f: (t) => t < 2.6 ? { lb: 1, ly: -0.5 } : t < 3.2 ? { ly: -0.5 } : t < 5.8 ? { rb: 1, ly: -0.5 } : { ly: -0.5 } },
    boost: { T: 6, f: (t) => t < 1.2 ? { ly: -1 } : t < 3.8 ? { ly: -1, x: 1 } : t < 4.6 ? { ly: -1 } : t < 5 ? { ly: -1, y: 1 } : { ly: -1 } },
    ok: { T: 6, f: (t) => (t > 0.6 && t < 1) || (t > 2.2 && t < 2.6) ? { a: 1 } : t > 3.8 && t < 4.6 ? { menu: 1 } : {} },
    end: { T: 4, f: (t) => ({ ly: -1, x: t > 1.5 && t < 3.3 ? 1 : 0 }) },
    // ほかのモード用（controls-guide.json の general.voiceId）
    "ok-gen": { T: 7, f: (t) => t > 0.5 && t < 0.9 ? { a: 1 } : t > 2 && t < 2.4 ? { b: 1 } : t > 3.4 && t < 3.8 ? { dl: 1 } : t > 4.2 && t < 4.6 ? { dr: 1 } : t > 5.4 && t < 6.2 ? { menu: 1 } : {} },
    "end-gen": { T: 4, f: (t) => ({ ly: -1, menu: t > 2.2 && t < 3.4 ? 1 : 0 }) },
  };
  // 手順ごとの見る向き（鳥の +X＝前・+Y＝上・+Z＝右）。上下は横から、傾きは後ろから見ると分かりやすい
  const VIEW = { def: [-9.5, 3.8, 6.5], rstick: [-8.5, 6.5, 6.5], trig: [-1.5, 2, 12.5], bump: [-12.5, 3, 1.5] };

  // 手順の文面はモードで切り替える：武蔵屋モードは手順そのもの、ほかのモードは general（決定・おしまいの2手順だけ持つ）で上書き
  const inMsy = () => document.body.classList.contains("modeMusashiya");
  const variant = (s) => (!inMsy() && s.general ? Object.assign({}, s, s.general) : s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const st = { open: false, steps: null, idx: 0, kind: "xbox", bird: "swan", audio: null, stepTimer: 0, stepStart: 0, ended: false,
    raf: 0, last: 0, liveUntil: 0, prev: [], bgmVol: null, opts: {}, three: null,
    birdWait: false, waitSeq: 0, birdWaitMs: 30000 }; // birdWaitMs：鳥を待つ最長時間（検証では短くできる）

  // ---- 見た目 ----
  const css = document.createElement("style");
  css.textContent =
    "#cgModal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:129;font-family:system-ui,sans-serif}" +
    "#cgModal.show{display:flex}" +
    "#cgModal .cgBox{background:#0e2238;color:#fff;border:2px solid #4a90d9;border-radius:14px;width:min(980px,96vw);max-height:94vh;overflow:auto;padding:14px 16px;box-shadow:0 10px 40px rgba(0,0,0,.5)}" +
    "#cgModal .cgHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
    "#cgModal .cgHead b{font-size:22px;color:#ffd166;margin-right:auto}" +
    "#cgModal button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #6a9fd8;background:#1c3a5c;color:#fff;padding:6px 12px}" +
    "#cgModal button.sel{background:#2f6db0;border-color:#ffd166}" +
    "#cgModal .cgMain{display:flex;gap:14px;margin-top:10px}" +
    "#cgModal .cgStage{position:relative;flex:1.25;min-height:340px;border-radius:10px;overflow:hidden;background:linear-gradient(#8fc3ee,#dcefff)}" +
    "#cgModal .cgStage canvas{display:block;width:100%;height:100%;position:absolute;inset:0}" +
    "#cgModal .cgStageMsg{position:absolute;inset:auto 0 44%;text-align:center;color:#24476a;font-size:15px}" +
    "#cgModal .cgLive{position:absolute;left:8px;top:8px;background:rgba(14,34,56,.75);border-radius:6px;padding:3px 8px;font-size:13px}" +
    "#cgModal .cgSide{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}" +
    "#cgModal .cgPad svg{width:100%;height:auto;display:block}" +
    "#cgModal .cgLayout{font-size:12px;color:#9fb6cc;display:flex;align-items:center;gap:6px;flex-wrap:wrap}" +
    "#cgModal .cgLayout button{font-size:12px;padding:2px 8px}" +
    "#cgModal .cgStepTitle{font-size:20px;font-weight:bold;color:#7fc8ff}" +
    "#cgModal .cgSub{font-size:19px;line-height:1.6;min-height:4.8em}" +
    "#cgModal .cgNav{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}" +
    "#cgModal .cgDots{display:flex;gap:6px;margin:0 6px}" +
    "#cgModal .cgDots i{width:11px;height:11px;border-radius:50%;background:#35557a;display:inline-block}" +
    "#cgModal .cgDots i.on{background:#ffd166}" +
    "#cgModal .cgFoot{display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #2c4d72;flex-wrap:wrap}" +
    "#cgModal .cgStatus{font-size:16px;margin-right:auto}" +
    // 長押しの進み具合（--p）を明るい色で左から塗る
    "#cgModal .cgGo{font-size:18px;font-weight:bold;background:linear-gradient(90deg,#fff3c4 var(--p,0%),#e8a317 var(--p,0%));border-color:#ffd166;color:#1a1a1a;padding:8px 18px}" +
    "#cgModal .cgGo.ready{animation:cgPulse 1s infinite}" +
    "#cgModal .cgCredit{font-size:11px;color:#9fb6cc;margin-top:6px;text-align:right}" +
    "@keyframes cgPulse{50%{box-shadow:0 0 0 6px rgba(255,209,102,.45)}}" +
    // コントローラー図：光らせる対象＝黄色の点滅、押している＝緑
    "#cgModal .k .sh{fill:#2a3b4f;stroke:#9fb6cc;stroke-width:2;transition:fill .08s}" +
    "#cgModal .k.tgt .sh{stroke:#ffd166;stroke-width:5;animation:cgBlink .9s infinite}" +
    "#cgModal .k.on .sh{fill:#3fbf6f}" +
    "#cgModal .k text{fill:#fff;font:bold 15px system-ui;text-anchor:middle;dominant-baseline:central;pointer-events:none}" +
    "#cgModal .k .fill{fill:#3fbf6f}" +
    "@keyframes cgBlink{50%{stroke:#fff3c4}}" +
    "@media (max-width:760px){#cgModal .cgMain{flex-direction:column}#cgModal .cgStage{min-height:240px}#cgModal .cgSub{font-size:16px;min-height:0}}";
  document.head.appendChild(css);

  const modal = document.createElement("div");
  modal.id = "cgModal";
  modal.innerHTML =
    '<div class="cgBox" role="dialog" aria-label="コントローラーの操作のしかた">' +
      '<div class="cgHead"><b>🎮 操作のしかた</b>' +
        '<button type="button" data-bird="swan">🦢 白鳥</button><button type="button" data-bird="kite">🦅 鳶</button>' +
        '<button type="button" data-act="close" title="とじる（Esc）">✕</button></div>' +
      '<div class="cgMain">' +
        '<div class="cgStage"><div class="cgStageMsg">鳥を よみこみ中…</div><div class="cgLive" hidden>🎮 コントローラーで操作中</div></div>' +
        '<div class="cgSide"><div class="cgPad"></div><div class="cgLayout"></div><div class="cgStepTitle"></div><div class="cgSub"></div></div>' +
      "</div>" +
      '<div class="cgNav"><button type="button" data-act="prev">◀ まえ</button><span class="cgDots"></span><button type="button" data-act="next">つぎ ▶</button>' +
        '<button type="button" data-act="replay">🔊 もう一度</button><span style="font-size:12px;color:#9fb6cc">十字キーの ←→ でも えらべます</span></div>' +
      '<div class="cgFoot"><span class="cgStatus"></span><button type="button" class="cgGo" data-act="go" hidden></button></div>' +
      '<div class="cgCredit"><span class="cgOffline" style="float:left"></span>音声：VOICEVOX:ずんだもん（VOICEVOX ENGINE で生成）　版 ' + VER + "</div>" +
    "</div>";
  document.body.appendChild(modal);
  const $ = (s) => modal.querySelector(s);

  // ---- コントローラーの種類（つないでいなければ会場の GameSir T3 Lite＝Xbox 配列）----
  function padKind() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const id = String(p.id).toLowerCase();
      return isPsId(id) ? "ps" : "xbox";
    }
    return "xbox";
  }
  // PS 系か。純正 Xbox を Bluetooth でつなぐと「Xbox Wireless Controller」になり「wireless controller」を含むので、xbox／045e は除く
  function isPsId(id) { return /dualshock|dualsense|playstation|054c/.test(id) || (/wireless controller/.test(id) && !/xbox|045e/.test(id)); }
  // ---- 図の形（2026-09-14 中司さん「Xbox型で配置が異なるものがあるなら、それを認識して適切なコントローラーの画面を」）----
  // sym＝左右対称（十字キー左上・スティック下に2本：PS・GameSir T3 Lite）、asym＝Xbox型（左スティック左上・十字キー左下）。
  // Windows の XInput（PC）モードでは純正 Xbox も GameSir も「Xbox 360 Controller (XInput STANDARD GAMEPAD)」になり見分けられない。
  // そのときは端末に記憶した形（無ければ左右対称＝会場の GameSir）を使い、操作説明の中で切り替えられるようにする
  const LAYOUT_KEY = "cbi-meta-pad-layout-v1";
  function detectLayout(id) {
    if (isPsId(id)) return "sym";
    if (/gamesir/.test(id)) return "sym";                                   // GameSir（Bluetooth 等では名前が見える）
    if (/045e|xbox wireless|xbox one|xbox series|xbox elite/.test(id)) return "asym"; // Microsoft 純正（製造元番号 045e）
    return null;                                                            // XInput の一般名など：見分けられない
  }
  function layoutInfo() {
    const p = firstPad(), id = p ? String(p.id).toLowerCase() : "";
    const auto = p ? detectLayout(id) : null;
    let saved = null;
    try { saved = localStorage.getItem(LAYOUT_KEY); } catch (e) {}
    return { layout: auto || (saved === "asym" ? "asym" : "sym"), auto: !!auto, id: p ? String(p.id) : "" };
  }
  function firstPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p) return p;
    return null;
  }

  // ---- コントローラーの図（SVG）。data-k＝ボタン名、data-knob＝スティック、data-fill＝トリガーの押し込み量 ----
  function padSvg(kind, layout) {
    const ps = kind === "ps";
    const face = ps ? { Y: ["△", "#3fbf8f"], X: ["□", "#e27bb7"], B: ["○", "#e5534b"], A: ["×", "#5b8def"] }
      : { Y: ["Y", "#e6c229"], X: ["X", "#3b82f6"], B: ["B", "#e5534b"], A: ["A", "#3fae49"] };
    const L = ps ? { LT: "L2", RT: "R2", LB: "L1", RB: "R1", MENU: "OPT", VIEW: "SH" } : { LT: "LT", RT: "RT", LB: "LB", RB: "RB", MENU: "≡", VIEW: "⧉" };
    // 形は layout で決める（sym＝左右対称：会場の GameSir T3 Lite・PS、asym＝Xbox型）。2026-09-14 中司さん「スティック配置が違う」
    const asym = layout === "asym";
    const ls = asym ? [108, 112] : [150, 172], dp = asym ? [150, 172] : [108, 112], rs = [250, 172], fc = [292, 112];
    const trig = (k, x) => '<g class="k" data-k="' + k + '"><rect class="sh" x="' + x + '" y="6" width="74" height="30" rx="12"/>' +
      '<rect class="fill" data-fill="' + k + '" x="' + (x + 3) + '" y="33" width="68" height="0" rx="4"/><text x="' + (x + 37) + '" y="21">' + L[k] + "</text></g>";
    const bump = (k, x) => '<g class="k" data-k="' + k + '"><rect class="sh" x="' + x + '" y="42" width="92" height="18" rx="9"/><text x="' + (x + 46) + '" y="51" style="font-size:13px">' + L[k] + "</text></g>";
    const stick = (k, c) => '<g class="k" data-k="' + k + '"><circle class="sh" cx="' + c[0] + '" cy="' + c[1] + '" r="27"/>' +
      '<g data-knob="' + k + '"><circle cx="' + c[0] + '" cy="' + c[1] + '" r="17" fill="#50657c" stroke="#cfe0f0" stroke-width="2"/></g>' +
      '<text x="' + c[0] + '" y="' + (c[1] + 40) + '" style="font-size:12px;fill:#cfe0f0">' + (k === "LS" ? "左スティック" : "右スティック") + "</text></g>";
    const fb = (k, dx, dy) => '<g class="k" data-k="' + k + '"><circle class="sh" cx="' + (fc[0] + dx) + '" cy="' + (fc[1] + dy) + '" r="14" style="stroke:' + face[k][1] + '"/>' +
      '<text x="' + (fc[0] + dx) + '" y="' + (fc[1] + dy) + '" style="fill:' + face[k][1] + '">' + face[k][0] + "</text></g>";
    const small = (k, x) => '<g class="k" data-k="' + k + '"><rect class="sh" x="' + (x - 17) + '" y="84" width="34" height="18" rx="9"/><text x="' + x + '" y="93" style="font-size:11px">' + L[k] + "</text></g>";
    const d = dp;
    const dpad = '<g class="k" data-k="DPAD"><path class="sh" d="M' + (d[0] - 8) + " " + (d[1] - 24) + "h16v16h16v16h-16v16h-16v-16h-16v-16h16z\"/></g>";
    return '<svg viewBox="0 0 400 250" aria-hidden="true">' +
      trig("LT", 68) + trig("RT", 258) + bump("LB", 58) + bump("RB", 250) +
      '<path d="M110 62 H290 C340 62 370 92 380 142 L392 204 C398 240 360 254 335 229 L300 196 H100 L65 229 C40 254 2 240 8 204 L20 142 C30 92 60 62 110 62 Z" fill="#1b2a3a" stroke="#6a9fd8" stroke-width="2"/>' +
      stick("LS", ls) + stick("RS", rs) + dpad + fb("Y", 0, -26) + fb("X", -26, 0) + fb("B", 26, 0) + fb("A", 0, 26) + small("VIEW", 172) + small("MENU", 228) +
      "</svg>";
  }
  function renderPad() {
    const L = layoutInfo();
    st.layout = L.layout;
    $(".cgPad").innerHTML = padSvg(st.kind, L.layout);
    // 見分けられないときだけ、形を手で選べるようにする（選んだ形はこの端末に記憶）
    $(".cgLayout").innerHTML = (L.auto ? "" :
      '図の形：<button type="button" data-layout="sym" class="' + (L.layout === "sym" ? "sel" : "") + '">左右対称</button>' +
      '<button type="button" data-layout="asym" class="' + (L.layout === "asym" ? "sel" : "") + '">Xbox型</button> ') +
      '<span class="cgPadId">' + (L.id ? "機種：" + esc(L.id.slice(0, 48)) + (L.auto ? "（自動で判定）" : "（自動では見分けられない種類）") : "コントローラー未接続") + "</span>";
    markTargets();
  }
  function markTargets() {
    const s = st.steps && st.steps[st.idx];
    const want = s ? variant(s).pads : [];
    modal.querySelectorAll(".cgPad .k").forEach((g) => g.classList.toggle("tgt", want.indexOf(g.dataset.k) >= 0));
  }

  // ---- 入力（お手本 or 実際のコントローラー）----
  const ZERO = { lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, lb: 0, rb: 0, a: 0, b: 0, x: 0, y: 0, menu: 0, view: 0, dl: 0, dr: 0 };
  function liveInput(p) {
    if (!p) return null;
    const ax = (i) => { const v = p.axes[i] || 0; return Math.abs(v) < 0.25 ? 0 : v; };
    const b = (i) => (p.buttons[i] && p.buttons[i].pressed ? 1 : 0);
    const tv = (i) => (p.buttons[i] ? Math.max(p.buttons[i].value || 0, p.buttons[i].pressed ? 1 : 0) : 0);
    const inp = { lx: ax(0), ly: ax(1), rx: ax(2), ry: ax(3), lt: tv(BTN.LT), rt: tv(BTN.RT), lb: b(BTN.LB), rb: b(BTN.RB),
      a: b(BTN.A), b: b(BTN.B), x: b(BTN.X), y: b(BTN.Y), menu: b(BTN.MENU), view: b(BTN.VIEW), dl: b(14), dr: b(15) };
    const any = Object.keys(inp).some((k) => Math.abs(inp[k]) > 0.05);
    return any ? inp : null;
  }
  function demoInput(now) {
    if (st.birdWait) return Object.assign({}, ZERO); // 鳥を待っている間はお手本も止める
    const s = st.steps && st.steps[st.idx];
    const v = s && variant(s);
    const d = v && DEMO[v.voiceId || v.id];
    if (!d) return Object.assign({}, ZERO);
    const t = ((now - st.stepStart) / 1000) % d.T;
    return Object.assign({}, ZERO, d.f(t));
  }
  function drawInput(inp) {
    const on = { A: inp.a, B: inp.b, X: inp.x, Y: inp.y, LB: inp.lb, RB: inp.rb, LT: inp.lt > 0.1, RT: inp.rt > 0.1, MENU: inp.menu, VIEW: inp.view,
      LS: inp.lx || inp.ly, RS: inp.rx || inp.ry, DPAD: inp.dl || inp.dr };
    modal.querySelectorAll(".cgPad .k").forEach((g) => g.classList.toggle("on", !!on[g.dataset.k]));
    const knob = (k, x, y) => { const el = modal.querySelector('[data-knob="' + k + '"]'); if (el) el.setAttribute("transform", "translate(" + (x * 11).toFixed(1) + " " + (y * 11).toFixed(1) + ")"); };
    knob("LS", inp.lx, inp.ly); knob("RS", inp.rx, inp.ry);
    ["LT", "RT"].forEach((k) => { const el = modal.querySelector('[data-fill="' + k + '"]'); if (!el) return; const h = 26 * (k === "LT" ? inp.lt : inp.rt); el.setAttribute("height", h.toFixed(1)); el.setAttribute("y", (35 - h).toFixed(1)); });
  }

  // ---- 鳥の3D（Three.js）----
  async function ensureThree() {
    if (st.three) return st.three;
    const stage = $(".cgStage");
    try {
      const THREE = await import(THREE_URL);
      const { GLTFLoader } = await import(GLTF_URL);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      stage.insertBefore(renderer.domElement, stage.firstChild);
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xdcefff, 30, 90);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
      camera.position.set(...VIEW.def);
      scene.add(new THREE.HemisphereLight(0xd9efff, 0x747066, 2));
      for (const [pos, inten, col] of [[[4, 8, 5], 3.2, 0xfff5e1], [[-3, 4, -6], 2, 0xd5e8ff]]) { const l = new THREE.DirectionalLight(col, inten); l.position.set(...pos); scene.add(l); }
      // 地面（格子を流して前へ進んでいるように見せる）と雲
      const ground = new THREE.GridHelper(160, 40, 0x5d8a4e, 0x7fae6a);
      ground.position.y = -7;
      scene.add(ground);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0xa9cf8f }));
      plane.rotation.x = -Math.PI / 2; plane.position.y = -7.05;
      scene.add(plane);
      const clouds = [];
      const cmat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      for (let i = 0; i < 9; i++) {
        const g = new THREE.Group();
        for (let j = 0; j < 3; j++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random(), 12, 10), cmat); m.position.set(j * 1.4 - 1.4, Math.random() * 0.5, Math.random() * 0.8); g.add(m); }
        g.position.set(-40 + i * 10, 7 + Math.random() * 6, (i % 2 ? 1 : -1) * (14 + Math.random() * 16)); // カメラの前を横切って鳥を隠さないよう、上と左右の遠くに置く
        scene.add(g); clouds.push(g);
      }
      // 速く飛ぶときの風の線
      const lineGeo = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 40; i++) { const y = -4 + Math.random() * 9, z = -9 + Math.random() * 18, x = -30 + Math.random() * 60; pts.push(x, y, z, x + 3, y, z); }
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      scene.add(lines);
      const rig = new THREE.Group();
      rig.rotation.order = "YZX"; // 向き（Y）→ 機首の上下（Z）→ 左右の傾き（X）の順にかける
      scene.add(rig);
      const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      new ResizeObserver(fit).observe(stage);
      fit();
      st.three = { THREE, GLTFLoader, renderer, scene, camera, ground, clouds, lines, rig, models: {}, mixer: null, action: null, cur: null,
        pose: { yaw: 0, pitch: 0, roll: 0, y: 0, z: 0 }, dist: 0, lat: 0, camPos: new THREE.Vector3(...VIEW.def) };
    } catch (e) {
      console.warn("[操作のしかた] Three.js を読み込めませんでした", e);
      $(".cgStageMsg").textContent = "（鳥の3Dを読み込めませんでした。図と声で説明します）";
      st.three = null;
      return null;
    }
    return st.three;
  }
  async function showBird(kind) {
    st.bird = kind;
    modal.querySelectorAll("[data-bird]").forEach((b) => b.classList.toggle("sel", b.dataset.bird === kind));
    const T = await ensureThree();
    if (!T) return false;       // 戻り値：映ったら true（waitBird が見る）
    if (T.cur === kind) return true;
    const msg = $(".cgStageMsg");
    msg.textContent = (kind === "kite" ? "鳶" : "白鳥") + "を よみこみ中…";
    msg.hidden = false;
    try {
      let m = T.models[kind];
      if (!m) {
        const gltf = await new T.GLTFLoader().loadAsync(GLB[kind]);
        const obj = gltf.scene;
        const box = new T.THREE.Box3().setFromObject(obj);
        const size = box.getSize(new T.THREE.Vector3()), center = box.getCenter(new T.THREE.Vector3());
        const s = 7 / Math.max(size.x, size.y, size.z);
        const holder = new T.THREE.Group();
        obj.position.sub(center);
        holder.add(obj);
        holder.scale.setScalar(s);
        m = T.models[kind] = { holder, obj, clip: gltf.animations[0] };
      }
      if (st.bird !== kind) return false; // 読み込み中に切り替えられた
      T.rig.clear();
      T.rig.add(m.holder);
      T.mixer = new T.THREE.AnimationMixer(m.obj);
      T.action = m.clip ? T.mixer.clipAction(m.clip) : null;
      if (T.action) T.action.play();
      T.cur = kind;
      msg.hidden = true;
      return true;
    } catch (e) {
      console.warn("[操作のしかた] 鳥のモデルを読み込めませんでした", e);
      msg.textContent = "（鳥のモデルを読み込めませんでした）";
      return false;
    }
  }
  // 鳥が映るまで声・手順・お手本の動きを止める（2026-09-14 中司さん「白鳥を読み込むまで案内を進めないように」）。
  // 開いたときと、鳶／白鳥に切り替えたとき（その手順を頭から）。最長 st.birdWaitMs 待ち、失敗・時間切れなら鳥なしで進む
  async function waitBird(kind) {
    const seq = ++st.waitSeq;
    st.birdWait = true;
    playStep(st.idx); // 待っている間は表示だけ（声は出さない）
    let timer = 0;
    const ok = await Promise.race([showBird(kind), new Promise((r) => { timer = setTimeout(() => r("timeout"), st.birdWaitMs); })]);
    clearTimeout(timer);
    if (seq !== st.waitSeq || !st.open) return; // 待っている間に閉じた・別の鳥に切り替えた
    st.birdWait = false;
    if (ok === "timeout") { // 読み込みは裏で続け、映ったら出す（showBird が案内を消す）
      const msg = $(".cgStageMsg");
      msg.textContent = "（鳥の読み込みに時間がかかっているので、先に説明するのだ）";
      msg.hidden = false;
    }
    playStep(st.idx);
  }
  function animateBird(inp, dt, stepId) {
    const T = st.three;
    if (!T) return;
    const up = inp.rt - inp.lt, fwd = Math.max(0, -inp.ly), boost = inp.x ? 1 : 0;
    const tgt = { yaw: -inp.rx * 0.6, pitch: -inp.ry * 0.45 + up * 0.35, roll: (inp.rb - inp.lb) * 0.75 + inp.lx * 0.25 + inp.rx * 0.2, y: up * 1.6, z: inp.lx * 1.8 };
    const a = 1 - Math.exp(-dt / 0.25);
    for (const k in tgt) T.pose[k] += (tgt[k] - T.pose[k]) * a;
    T.rig.rotation.set(T.pose.roll, T.pose.yaw, T.pose.pitch);
    T.rig.position.set(0, T.pose.y, T.pose.z);
    const speed = (3 + fwd * 10) * (1 + boost * 2);
    T.dist += speed * dt;
    T.lat += inp.lx * 4 * dt;
    T.ground.position.x = -(T.dist % 4);
    T.ground.position.z = -(T.lat % 4);
    T.ground.position.y = -7 - up * 0.8;
    T.clouds.forEach((c) => { c.position.x -= speed * 0.6 * dt; c.position.z -= inp.lx * 3 * dt; if (c.position.x < -50) c.position.x += 90; });
    T.lines.material.opacity += ((boost ? 0.8 : 0) - T.lines.material.opacity) * a;
    T.lines.position.x = -((T.dist * 2) % 30);
    if (T.mixer) { T.mixer.timeScale = Math.max(0.25, 0.7 + fwd * 0.5 + boost * 1.2 - inp.lt * 0.4); T.mixer.update(dt); }
    const v = VIEW[stepId] || VIEW.def;
    T.camPos.lerp(new T.THREE.Vector3(...v), 1 - Math.exp(-dt / 0.6));
    T.camera.position.copy(T.camPos);
    T.camera.lookAt(1, 0, 0);
    T.renderer.render(T.scene, T.camera);
  }

  // ---- 声（BGM は読み上げ中だけ小さく）----
  function bgmDuck(on) {
    try {
      if (typeof bgmAudio === "undefined" || !bgmAudio) return;
      if (on) { if (st.bgmVol == null) st.bgmVol = bgmAudio.volume; bgmAudio.volume = Math.min(bgmAudio.volume, BGM_DUCK); }
      else if (st.bgmVol != null) { bgmAudio.volume = st.bgmVol; st.bgmVol = null; }
    } catch (e) {}
  }
  function voiceUrl(s) { return VOICE_BASE + (s.voiceId || s.id) + "_" + (s.voice.common ? "common" : st.kind) + ".mp3?v=" + VOICE_VER; }
  function stopVoice() { clearTimeout(st.stepTimer); if (st.audio) { try { st.audio.pause(); } catch (e) {} st.audio = null; } bgmDuck(false); }
  function playStep(i) {
    stopVoice();
    st.idx = Math.max(0, Math.min(st.steps.length - 1, i));
    st.stepStart = performance.now();
    const s = variant(st.steps[st.idx]);
    $(".cgStepTitle").textContent = (st.idx + 1) + "／" + st.steps.length + "　" + s.title;
    $(".cgSub").textContent = s.sub.common || s.sub[st.kind] || "";
    $(".cgDots").innerHTML = st.steps.map((_, j) => '<i class="' + (j === st.idx ? "on" : "") + '"></i>').join("");
    markTargets();
    if (st.birdWait) { // 鳥を待っている間は字幕で知らせるだけ
      $(".cgSub").textContent = "🦢 " + (st.bird === "kite" ? "鳶" : "白鳥") + "を よみこみ中…　映ったら説明をはじめるのだ";
      return;
    }
    if (st.idx === st.steps.length - 1) st.ended = true;
    const next = () => { if (st.open && st.idx < st.steps.length - 1) st.stepTimer = setTimeout(() => playStep(st.idx + 1), 700); };
    // 録画（scripts/promo/record_musashiya.mjs が window.cbiRec を入れたときだけ）：1コマずつ撮るので音は鳴らさず、
    // 「いつ・どの声か」を記録して後で重ねる。次の手順へは声の長さで進む（2026-09-14 関係者向けの紹介動画）
    if (window.cbiRec) {
      const sec = window.cbiRec.audio(voiceUrl(s), "guide");
      st.stepTimer = setTimeout(next, Math.round((sec || 5) * 1000));
      updateFoot();
      return;
    }
    const a = new Audio(voiceUrl(s));
    st.audio = a;
    bgmDuck(true);
    a.onended = () => { if (st.audio !== a) return; st.audio = null; bgmDuck(false); next(); };
    const fail = () => { if (st.audio !== a) return; st.audio = null; bgmDuck(false); st.stepTimer = setTimeout(next, Math.max(5000, ($(".cgSub").textContent.length * 180))); };
    a.onerror = fail;
    const pr = a.play();
    if (pr && pr.catch) pr.catch(fail);
    updateFoot();
  }

  // ---- 下の帯：武蔵屋めぐりのスタート待ちなら「読み込み中／A でスタート」、それ以外は最後まで見たら「A でとじる」----
  function waitingForStart() { return typeof window.msyWaiting === "function" && window.msyWaiting(); }
  // 夜景などで「街並みの読み込み待ち」に自動で開いたとき（open({auto:"tiles"})）は、読み込めたら閉じられる（2026-09-14 中司さん）
  function tilesDone() { try { return typeof tileset === "undefined" || !tileset || !!tileset.tilesLoaded; } catch (e) { return true; } }
  function action() {
    if (waitingForStart()) return typeof window.msyCanStart === "function" && window.msyCanStart() ? "start" : "";
    if (st.opts.auto === "tiles" && tilesDone()) return "close";
    return st.ended ? "close" : "";
  }
  // 長押しが要るか：スタートと、最後の手順まで見る前に閉じるとき（説明で A をためして押しても始まったり閉じたりしないように）
  function needHold() { const a = action(); return a === "start" || (a === "close" && !st.ended); }
  function updateFoot() {
    const okName = st.kind === "ps" ? "○" : "A";
    const act = action(), go = $(".cgGo"), status = $(".cgStatus");
    if (waitingForStart()) {
      if (act === "start") { status.innerHTML = "✅ <b>じゅんびOK！</b>"; go.textContent = "🚀 " + okName + " ボタンを長押しでスタート（Enter）"; }
      else { status.innerHTML = "🌏 街並みを読み込み中…　読み込めたら " + okName + " ボタンの長押しでスタートできます"; }
    } else if (st.opts.auto === "tiles" && !tilesDone()) {
      status.innerHTML = "🌏 街並みを読み込み中…　コントローラーを動かして、ためしてみよう";
    } else {
      status.innerHTML = act === "close" ? (st.opts.auto === "tiles" ? "✅ <b>街並みの準備OK！</b>" : "") : "コントローラーを動かして、ためしてみよう";
      go.textContent = okName + (needHold() ? " ボタンを長押しでとじる（Enter）" : " ボタン（Enter）でとじる");
    }
    go.hidden = !act;
    go.classList.toggle("ready", act === "start");
  }
  function doAction() {
    const act = action();
    if (act === "start") { close(); if (typeof window.msyReadyGo === "function") window.msyReadyGo(); }
    else if (act === "close") close();
  }

  // ---- 毎フレーム ----
  function loop(now) {
    if (!st.open) { st.raf = 0; return; }
    const dt = Math.min(0.1, (now - (st.last || now)) / 1000);
    st.last = now;
    const p = firstPad();
    if (p) {
      const k = padKind();
      if (k !== st.kind) { st.kind = k; renderPad(); playStep(st.idx); }
      else if (layoutInfo().layout !== st.layout) renderPad(); // 別の形のコントローラーに差し替えたとき
    }
    const live = liveInput(p);
    if (live) st.liveUntil = now + 1500;
    const inp = live || (now < st.liveUntil ? Object.assign({}, ZERO) : demoInput(now));
    $(".cgLive").hidden = !(now < st.liveUntil);
    drawInput(inp);
    // A／○（0・1）：スタートは1秒長押し（説明の中で A をためして押しても始まらないように）、とじるは押した瞬間。十字キー←→＝手順を選ぶ
    if (p) {
      const down = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const edge = (i) => down(i) && !st.prev[i];
      const go = $(".cgGo");
      if (needHold()) {
        if (edge(0) || edge(1)) st.holdFrom = now; // 開く前から押しっぱなしのボタンでは数えない
        if (!(down(0) || down(1))) st.holdFrom = 0;
        const held = st.holdFrom ? Math.min(1, (now - st.holdFrom) / HOLD_MS) : 0;
        go.style.setProperty("--p", Math.round(held * 100) + "%");
        if (held >= 1) { st.holdFrom = 0; go.style.setProperty("--p", "0%"); doAction(); }
      } else {
        st.holdFrom = 0;
        go.style.setProperty("--p", "0%");
        if (edge(0) || edge(1)) doAction();
      }
      if (edge(14)) playStep(st.idx - 1);
      if (edge(15)) playStep(st.idx + 1);
      st.prev = p.buttons.map((b) => b.pressed);
    }
    if (now - (st.footAt || 0) > 300) { st.footAt = now; updateFoot(); } // 街並みの読み込みが終わったかを見る
    animateBird(inp, dt, st.steps[st.idx].id);
    st.raf = requestAnimationFrame(loop);
  }

  // ---- 開く・とじる ----
  async function loadSteps() {
    if (st.steps) return st.steps;
    const r = await fetch("assets/narration/controls-guide.json?v=" + STEPS_VER);
    st.steps = (await r.json()).steps;
    return st.steps;
  }
  async function open(opts) {
    st.opts = opts || {};
    try { await loadSteps(); } catch (e) { console.warn("[操作のしかた] 手順を読み込めませんでした", e); return; }
    if (st.open) return;
    st.open = true;
    st.ended = false;
    st.kind = padKind();
    const p = firstPad();
    st.prev = p ? p.buttons.map((b) => b.pressed) : []; // 開いたときに押していたボタンでは反応しない
    renderPad();
    renderOffline();
    modal.classList.add("show");
    st.idx = 0;
    const inGame = typeof tonbiOn !== "undefined" && tonbiOn ? "kite" : "swan"; // いまゲームで使っている鳥
    waitBird(st.opts.bird || inGame); // 鳥が映ってから手順1を始める
    prepareOffline(); // 開いた端末は、どのモードでも白鳥・鳶・描画部品・声を保存する（2026-09-14 中司さん。2回目から通信なし）
    st.last = 0;
    if (!st.raf) st.raf = requestAnimationFrame(loop);
  }
  function close() {
    if (!st.open) return;
    st.open = false;
    stopVoice();
    modal.classList.remove("show");
    const btn = document.getElementById("ctlGuideBtn");
    if (btn) btn.focus && btn.blur();
  }
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { close(); return; }
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.bird) { // 切り替えたら、映るまで止めてその手順を頭から
      if (!(b.dataset.bird === st.bird && st.three && st.three.cur === st.bird)) waitBird(b.dataset.bird);
      return;
    }
    if (b.dataset.layout) { try { localStorage.setItem(LAYOUT_KEY, b.dataset.layout); } catch (e) {} renderPad(); return; }
    const act = b.dataset.act;
    if (act === "close") close();
    else if (act === "prev") playStep(st.idx - 1);
    else if (act === "next") playStep(st.idx + 1);
    else if (act === "replay") playStep(st.idx);
    else if (act === "go") doAction();
  });
  // 開いている間のキーは、ここで受けて他（武蔵屋めぐりの Enter＝スタート、3D の移動キー）へ渡さない
  document.addEventListener("keydown", function (e) {
    if (!st.open) return;
    if (e.key === "Escape") close();
    else if (e.key === "Enter") doAction();
    else if (e.key === "ArrowLeft") playStep(st.idx - 1);
    else if (e.key === "ArrowRight") playStep(st.idx + 1);
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  window.addEventListener("pagehide", stopVoice);

  // ---- この端末に保存（2026-09-14 中司さん「2回目以降はテザリング通信を食わないように。鳶も同様」）----
  // sw.js（Service Worker）が保存領域から返す。保存するのは、武蔵屋モードに入ったとき（musashiya.js の enterMode）と、
  // どのモードでも操作説明を開いたとき（open）だけ（2026-09-14 中司さん）。開かない一般の閲覧者には何もしない。
  // 会場PCは事前に自宅の Wi-Fi で1回武蔵屋モードを開けば準備完了
  const OFFLINE_CACHE = "cbi-meta-offline-v1"; // sw.js の CACHE と同じ名前にする
  const off = { started: false, total: 0, done: 0, failed: 0, persisted: null, error: false };
  function offlineUrls(steps) {
    const rel = [GLB.swan, GLB.kite, "assets/narration/controls-guide.json?v=" + STEPS_VER];
    steps.forEach((s) => [s].concat(s.general ? [s.general] : []).forEach((v) => // 武蔵屋用とほかのモード用の両方
      Object.keys(v.voice).forEach((k) => rel.push(VOICE_BASE + (v.voiceId || s.id) + "_" + k + ".mp3?v=" + VOICE_VER))));
    return [THREE_URL, GLTF_URL].concat(rel.map((u) => new URL(u, location.href).href));
  }
  function offlineText() {
    if (!off.started) return "";
    if (off.error) return "⚠ この端末に保存できませんでした";
    if (off.done + off.failed < off.total) return "💾 この端末に保存中… " + off.done + "／" + off.total + "（白鳥・鳶・描画部品・声）";
    if (off.failed) return "⚠ " + off.failed + "件を保存できませんでした。通信のよい所で開き直してください";
    return "💾 この端末に保存済み（次回からは通信なしで表示）" + (off.persisted === false ? "・容量が足りないとブラウザが消すことがあります" : "");
  }
  function renderOffline() { const el = $(".cgOffline"); if (el) el.textContent = offlineText(); }
  async function prepareOffline() {
    if (off.started || !("caches" in window) || !("serviceWorker" in navigator)) return;
    if (window.cbiRec) return; // 録画用のブラウザには保存しない（毎回まっさらなので約53MBを無駄に落とすだけ）
    off.started = true;
    try {
      // 登録と「消さないで」の申請は返事を待たない（どちらも返事に数秒かかることがあり、その間保存が始まらなかった。2026-09-14 実測）。
      // 保存領域への書き込みは Service Worker が無くてもできる（次に開いたときから Service Worker が保存分を返す）
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch((e) => console.warn("[操作のしかた] Service Worker を登録できませんでした", e));
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((v) => { off.persisted = v; renderOffline(); }, () => { off.persisted = false; });
      const urls = offlineUrls(await loadSteps());
      off.total = urls.length;
      const c = await caches.open(OFFLINE_CACHE);
      for (const req of await c.keys()) if (urls.indexOf(req.url) < 0) await c.delete(req); // 版が変わって使わなくなった分を消す
      for (const u of urls) { // 1本ずつ（街並みの読み込みと通信を取り合わないように）
        try {
          if (!(await c.match(u))) { const res = await fetch(u); if (res.status !== 200) throw new Error("HTTP " + res.status); await c.put(u, res); }
          off.done++;
        } catch (e) { off.failed++; console.warn("[操作のしかた] 保存できませんでした", u, e); }
        renderOffline();
      }
    } catch (e) { off.error = true; console.warn("[操作のしかた] 端末への保存を始められませんでした", e); }
    renderOffline();
  }

  // ≡（メニュー／PS は OPTIONS）を1秒長押しで開く（どのモードでも。2026-09-14 中司さん「他モードでも使いまわす」）。
  // 武蔵屋めぐりの最中は musashiya.js が同じ長押しで「スタート前に戻る」を行うので、ここでは見ない。2Pレース中も見ない
  let menuFrom = 0;
  setInterval(function () {
    const busy = st.open || window.vsRaceModeEnabled || (typeof window.msyOn === "function" && window.msyOn());
    const p = busy ? null : firstPad();
    if (!(p && p.buttons[BTN.MENU] && p.buttons[BTN.MENU].pressed)) { menuFrom = 0; return; }
    if (!menuFrom) {
      menuFrom = performance.now();
      if (typeof showPickResult === "function") showPickResult((padKind() === "ps" ? "OPTIONS" : "≡（メニュー）") + " を押したままにすると、操作のしかたが開きます…", 1500);
      return;
    }
    if (performance.now() - menuFrom >= 1000) { menuFrom = 0; open(); }
  }, 100);

  // 3D の飛行入力を止めるか（index.html の毎フレームの処理が見る）
  window.cbiInputHold = () => st.open;
  window.CbiControlsGuide = { open, close, isOpen: () => st.open, prepareOffline, offline: off, state: st };
})();
