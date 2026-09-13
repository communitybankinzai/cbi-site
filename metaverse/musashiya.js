// 武蔵屋めぐり（2026-11-03 武蔵屋マルシェ会場用のイベントモード・2026-09-13 追加）
// 武蔵屋（岩井家住宅主屋）をスタートし、武蔵屋から4km以内の文化財からランダムに3か所をめぐって武蔵屋へ戻る。
// 通過するたびに写真（無ければ精霊カード）と説明文をポップアップし、ゴールでは武蔵屋のポップアップを画面に残す。
// 説明文は「こども（小学3〜4年生向け）／おとな」をスタート前に選ぶ。文面は musashiya-texts.json。
//
// カウントダウン・方向案内・通過判定は index.html のタイムトライアル（ttActive／ttCourse／onTick）をそのまま使い、
// サーバー記録・通過演出・目的地カード・ゴール処理だけをこのファイルで差し替える。
// 記録はサーバーに残さない（毎回コースが変わり順位の比較が公平にならないため。2026-09-13 中司さん決定）。
// 入口：☰「あそぶ」→「🏠 武蔵屋めぐり」、または URL に ?event=musashiya（会場用。読み込み後に自動で開く）
(function () {
  "use strict";
  const MSY_VERSION = "2026-09-13a";
  const POOL_RADIUS_M = 4000; // 武蔵屋からこの距離以内の文化財から選ぶ（19件）
  const PICK = 3;             // めぐる数
  const AGE_KEY = "cbi-meta-msy-age-v1";
  const params = new URLSearchParams(location.search);
  const state = { on: false, age: loadAge(), home: -1, texts: {}, popTimer: null, popFinal: false, lastCourse: [] };
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
  function pickCourse(home) {
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
    // 武蔵屋から近い順につなぐ（遠回りで1周が長くならないように）
    const out = [];
    let cur = h;
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
        "<p>武蔵屋（むさしや）をスタートして、近くの文化財を<b>3か所</b>めぐり、武蔵屋にもどってきたらゴール！<br>" +
        "めぐる場所は毎回かわります。とうちゃくすると、その文化財の写真と説明が出ます。</p>" +
        '<p style="font-size:13px;color:#cfe6ff">説明文をえらんでください（コントローラーは ← → でえらんで ○ でスタート）</p>' +
        '<div class="msyAge">' +
          '<button type="button" data-age="kids" class="' + (isKids() ? "sel" : "") + '">👦 こども</button>' +
          '<button type="button" data-age="adult" class="' + (isKids() ? "" : "sel") + '">🧑 おとな</button>' +
        "</div>" +
        '<div class="msyRow"><button type="button" data-act="close">とじる</button><button type="button" class="go" data-act="start">🚀 スタート</button></div>' +
        '<div class="msyVer">版 ' + MSY_VERSION + "</div>" +
      "</div>";
  }
  modal.addEventListener("click", function (e) {
    if (e.target === modal) { closeModal(); return; }
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.age) { state.age = b.dataset.age; saveAge(state.age); renderModal(); return; }
    if (b.dataset.act === "close") closeModal();
    if (b.dataset.act === "start") start(state.age);
  });
  function closeModal() { modal.classList.remove("show"); }

  // ---- 開始 ----
  function start(age) {
    if (age) { state.age = age === "adult" ? "adult" : "kids"; saveAge(state.age); }
    const home = homeIdx();
    if (home < 0 || !BUNKAZAI.length) return;
    const course = pickCourse(home);
    if (course.length < PICK) return;
    state.home = home;
    state.lastCourse = course.slice();
    closeModal();
    hidePop();
    ttEntry = { name: "武蔵屋めぐり", ageLabel: isKids() ? "こども" : "おとな", level: "musashiya", courseKey: "musashiya", rate: 0, answers: 0, reqRatePct: 0 };
    ttCourse = course.concat([home]);
    ttPos = 0;
    ttActive = true;
    state.on = true;
    const pp = document.getElementById("puzzlePanel");
    if (pp) pp.style.display = "none";
    teleportNear(BUNKAZAI[home]);
    ttCountdownEnd = performance.now() + 6000; // テレポート約3秒＋カウントダウン3秒（通常のタイムトライアルと同じ）
    ttStartMs = 0;
    document.getElementById("ttHud").style.display = "block";
    ttApplyPinFocus();
    ttShowCard();
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
  }
  function showFinalPop(ms) {
    const head = isKids() ? "🎉 ゴール！ 武蔵屋に もどってきたよ" : "🎉 ゴール！ 武蔵屋に戻りました";
    const names = state.lastCourse.map((i) => esc(BUNKAZAI[i].name)).join(" → ");
    const extra = '<p class="msyTime">' + (isKids() ? "かかった時間" : "所要時間") + "：<b>" + ttFormat(ms) + "</b></p>" +
      '<p style="font-size:13px;color:#cfe6ff;margin:0 0 10px">めぐった文化財：' + names + "</p>";
    pop.className = "show " + state.age;
    pop.innerHTML = popHtml(state.home, head, extra) +
      '<div class="msyRow"><button type="button" data-act="close">とじる</button><button type="button" class="go" data-act="again">🔁 もういちど（ちがう3か所）</button></div>';
    state.popFinal = true;
    clearTimeout(state.popTimer); // ゴールの画面は消さずに残す
    padArm();
  }
  function hidePop() { pop.classList.remove("show"); clearTimeout(state.popTimer); }
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
  wrap("ttShowCard", function () {
    const card = document.getElementById("ttCard");
    const idx = ttCourse[ttPos];
    const b = BUNKAZAI[idx];
    if (!b) { card.innerHTML = ""; return; }
    const goal = ttPos === ttCourse.length - 1;
    const img = imgFor(b);
    const hint = goal
      ? (isKids() ? "さいごは 武蔵屋に もどろう！" : "最後は武蔵屋へ戻ります。")
      : (isKids() ? "とうちゃくすると、写真と説明が出るよ。" : "到着すると写真と解説が表示されます。");
    card.innerHTML =
      '<div class="ttCardHead">▾ ' + (goal ? "ゴール：" : (isKids() ? "つぎの場所：" : "次の目的地：")) + esc(b.name) + "</div>" +
      '<div class="ttCardBody">' +
        (img ? '<img src="' + esc(img.src) + '" alt="' + esc(img.alt) + '" loading="lazy">' : "") +
        '<div class="ttCardText"><span class="ttCardName">' + esc(b.name) + "</span>" +
          '<div class="ttCardDesc">' + hint + "</div>" +
          (img ? '<div class="ttCardCredit">' + esc(img.credit) + "</div>" : "") +
        "</div>" +
      "</div>";
    card.classList.add("shown");
    if (window.matchMedia("(pointer: coarse), (max-width: 640px)").matches) { card.classList.remove("open"); return; }
    card.classList.add("open");
    clearTimeout(ttCardTimer);
    ttCardTimer = setTimeout(function () { card.classList.remove("open"); }, 20000);
  });
  wrap("ttFinish", function (ms) {
    ttActive = false;
    state.on = false;
    document.getElementById("ttHud").style.display = "none";
    ttRestorePins();
    ttHideCard();
    if (pieces[state.home] === undefined) awardPiece(state.home);
    showFinalPop(ms);
  });
  (function () { // 中止（HUDの中止ボタン・モード切替など）
    const orig = window.ttAbort;
    if (typeof orig !== "function") return;
    window.ttAbort = function () { state.on = false; hidePop(); return orig.apply(this, arguments); };
  })();

  // ---- コントローラー・キーボード（開始画面とポップアップを開いているときだけ） ----
  let padRaf = 0, padPrev = {};
  function uiOpen() { return modal.classList.contains("show") || pop.classList.contains("show"); }
  function readPads() {
    const out = [];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      out.push({ i: p.index, ok: btn(0), l: btn(14) || p.axes[0] < -0.6, r: btn(15) || p.axes[0] > 0.6 });
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
      padPrev[s.i] = s;
    });
    padRaf = requestAnimationFrame(padLoop);
  }
  function onOk() {
    if (modal.classList.contains("show")) { start(state.age); return; }
    if (pop.classList.contains("show")) { if (state.popFinal) openModal(); else hidePop(); }
  }
  function onLR() {
    if (!modal.classList.contains("show")) return;
    state.age = isKids() ? "adult" : "kids";
    saveAge(state.age);
    renderModal();
  }
  document.addEventListener("keydown", function (e) {
    if (!uiOpen()) return;
    if (e.key === "Enter") { e.preventDefault(); onOk(); }
    else if (e.key === "Escape") { if (modal.classList.contains("show")) closeModal(); else if (!state.popFinal) hidePop(); }
    else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && modal.classList.contains("show")) { e.preventDefault(); onLR(); }
  }, true);

  // ---- 入口 ----
  const btn = document.getElementById("musashiyaBtn");
  if (btn) btn.addEventListener("click", openModal);
  window.msyOpen = openModal;
  window.msyStart = start;
  // 会場用：?event=musashiya なら、文化財データの読み込みと受付（CiDAO照合）が済んだところで開始画面を出す
  if (params.get("event") === "musashiya") {
    let tries = 0;
    const t = setInterval(function () {
      tries++;
      const loaded = typeof BUNKAZAI !== "undefined" && BUNKAZAI.length > 0;
      const received = params.has("notiles") || params.has("cinema") || typeof window.nightLogin !== "function" || !!window.nightLogin(1);
      if (loaded && received) { clearInterval(t); setTimeout(openModal, 800); }
      if (tries > 1200) clearInterval(t); // 10分で諦める
    }, 500);
  }
})();
