// 🏟 会場モード（2026-09-15 中司さん「現地で通信量を節約するためにできることを、全てボタン一つで処置できるように（復旧も）」）
// 11/3 武蔵屋の会場PC（テザリング）向け。武蔵屋モードの ⚙設定 に「🏟 会場モード」を置き、ON で次を一括で行い、OFF で全部元に戻す。
//   1) 街並みの記憶量（Cesium3DTileset.cacheBytes）を既定 512MB → 3GB に（会場PCはメモリ32GB）。いちど読んだ街並みを捨てずに使い回す
//   2) 通信節約：描画精度（maximumScreenSpaceError）を 16 に。白鳥・解像度はそのまま（軽量モードは白鳥を消すので会場では使えない）
//   3) 通信量の上限に達したら、軽量モードでなく描画精度 24 へ（index.html の trafficRender が CbiVenue.tighten() を呼ぶ）
//   4) 「事前読み込み飛行」：白鳥の郷→駅→4km圏の候補すべて→武蔵屋を自動で回り、街並みを読み込んでおく（1人目から軽くする）
// 設定は端末に記憶し（localStorage）、ページを読み直しても効く。PC 側（Windows Update・OneDrive 等）の停止は
// events/2026-11-03_武蔵屋/会場PC/会場モードON.bat が行う（このファイルの範囲外）。
(function () {
  "use strict";
  const VER = "20260915-2";
  const KEY = "cbi-meta-venue-v1";
  const CACHE_GB = 3;                 // 街並みの記憶量（GB）。会場PC＝32GB のうち。ブラウザの使用メモリが増える
  const DEFAULT_CACHE = 536870912;    // Cesium の既定（512MB）。OFF で戻す
  const SSE_SAVE = 16, SSE_TIGHT = 24; // 通信節約の描画精度（既定 8）。tight は通信量の上限到達時
  const VIEW_HIGH = 500, VIEW_LOW = 130; // 事前読み込みで各地点を見る高さ（地上。遊ぶときの巡航 500m と到着前の低い視点の両方を読む）
  const GROUND_H = 60;                // 印西の地表の楕円体高の目安（35〜80m）。地面の高さは測らず概算で置く
  const WAIT_MAX_MS = 40000, WAIT_MIN_MS = 1500; // 1視点あたり街並みを待つ時間（tilesLoaded は直前の視点の値が残るので最短でも待つ）
  const st = { on: false, sse: 0, pre: null, panel: null };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ on: st.on, sse: st.sse })); } catch (e) {} }
  function ts() { try { return typeof tileset !== "undefined" && tileset ? tileset : null; } catch (e) { return null; } }
  const notiles = () => new URLSearchParams(location.search).get("notiles") === "1";
  const fmt = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(1) + "GB" : Math.round(b / 1048576) + "MB";

  // ---- 適用（街並みの記憶量と描画精度）。tileset は読み込み後にしか無いので、無ければ後でもう一度 ----
  function apply() {
    window.venueSse = st.on ? st.sse : 0; // index.html の liteApplyTileset が読む
    const t = ts();
    if (!t) return false;
    const cache = st.on ? CACHE_GB * 1073741824 : DEFAULT_CACHE;
    if (t.cacheBytes !== cache) t.cacheBytes = cache;
    if (t.maximumCacheOverflowBytes !== cache) t.maximumCacheOverflowBytes = cache;
    if (typeof liteApplyTileset === "function") liteApplyTileset();
    try { viewer.scene.requestRender(); } catch (e) {}
    return true;
  }
  function setOn(on) {
    st.on = !!on;
    st.sse = st.on ? SSE_SAVE : 0;
    save();
    apply();
    render();
    if (typeof showPickResult === "function") showPickResult(st.on ? "🏟 会場モード ON：街並みの記憶量 " + CACHE_GB + "GB・通信節約（描画精度 " + SSE_SAVE + "）。白鳥はそのまま" : "🏟 会場モード OFF：記憶量 512MB・描画精度は通常に戻しました", 5000);
  }
  // 通信量の上限に達したとき（index.html）：会場モード中なら白鳥を消さずに街並みをさらに粗くする。戻り値＝引き受けたか
  function tighten() {
    if (!st.on) return false;
    st.sse = SSE_TIGHT; save(); apply(); render();
    return true;
  }

  // ---- 事前読み込み飛行 ----
  function points() { return typeof window.msyPreloadPoints === "function" ? window.msyPreloadPoints() : []; }
  function bearing(a, b) { const dy = (b.lat - a.lat) * 111320, dx = (b.lon - a.lon) * 111320 * Math.cos(a.lat * Math.PI / 180); return Math.atan2(dx, dy); }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitTiles(seq) {
    const t0 = performance.now();
    await sleep(notiles() ? 300 : WAIT_MIN_MS);
    while (!notiles() && performance.now() - t0 < WAIT_MAX_MS) {
      if (!st.pre || st.pre.seq !== seq) return;
      const t = ts();
      if (t && t.tilesLoaded) return;
      await sleep(250);
    }
  }
  async function preload() {
    if (st.pre) { st.pre.abort = true; return; } // もう一度押したら中止
    const pts = points();
    if (!pts.length || typeof viewer === "undefined") { alert("地点の一覧が取れません（文化財データの読み込み前）。少し待ってからもう一度押してください。"); return; }
    if (typeof window.msyOn === "function" && window.msyOn()) { alert("武蔵屋めぐりの最中は行えません。先に「スタート前に戻る」か終わらせてください。"); return; }
    const seq = Date.now();
    const tiles0 = (typeof trafficState !== "undefined" && trafficState) ? trafficState.tiles : 0;
    st.pre = { seq, i: 0, total: pts.length * 2, abort: false, t0: performance.now(), tiles0 };
    render();
    for (let i = 0; i < pts.length && !st.pre.abort; i++) {
      const p = pts[i], nx = pts[i + 1] || pts[i - 1] || p;
      for (const h of [VIEW_HIGH, VIEW_LOW]) {
        if (st.pre.abort) break;
        st.pre.i++; st.pre.name = p.name; render();
        try {
          viewer.camera.cancelFlight(); // 開始位置へのなめらかな移動（flyTo）が残っていると、次の描画でそちらへ戻されるため
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, GROUND_H + h),
            orientation: { heading: bearing(p, nx), pitch: Cesium.Math.toRadians(h === VIEW_HIGH ? -14 : -30), roll: 0 },
          });
        } catch (e) { console.warn("[会場モード] 視点を置けませんでした", p.name, e); }
        await waitTiles(seq);
      }
    }
    const aborted = st.pre.abort;
    const tiles = ((typeof trafficState !== "undefined" && trafficState) ? trafficState.tiles : 0) - st.pre.tiles0;
    const sec = Math.round((performance.now() - st.pre.t0) / 1000);
    st.pre = null;
    st.last = (aborted ? "⏹ 中止" : "✅ 読み込み完了") + "：" + pts.length + "地点・タイル約" + tiles + "枚（推定 " + fmt(tiles * 26 * 1024) + "）・" + Math.floor(sec / 60) + "分" + (sec % 60) + "秒";
    render();
    if (typeof window.msyGoHome === "function") window.msyGoHome(); // スタート地点へ戻す
  }
  // 事前読み込み中は 3D の飛行入力を止める（index.html の onTick が cbiInputHold を見る。操作説明の分と両立させる）
  const prevHold = window.cbiInputHold;
  window.cbiInputHold = () => !!st.pre || !!(prevHold && prevHold());

  // ---- 画面 ----
  const css = document.createElement("style");
  css.textContent =
    "#venuePanel{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:132;font-family:system-ui,sans-serif}" +
    "#venuePanel.show{display:flex}" +
    "#venuePanel .vBox{background:#0e2238;color:#fff;border:2px solid #4a90d9;border-radius:14px;width:min(640px,94vw);max-height:92vh;overflow:auto;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.5);font-size:15px;line-height:1.6}" +
    "#venuePanel h2{margin:0 0 8px;font-size:20px;color:#ffd166}" +
    "#venuePanel button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #6a9fd8;background:#1c3a5c;color:#fff;padding:8px 14px;margin:4px 4px 4px 0}" +
    "#venuePanel button.big{font-size:18px;font-weight:bold;padding:12px 20px}" +
    "#venuePanel button.on{background:#2f6db0;border-color:#ffd166}" +
    "#venuePanel .vRow{margin:10px 0;padding:10px;border:1px solid #2c4d72;border-radius:10px}" +
    "#venuePanel .vStat{color:#9fb6cc;font-size:13px}" +
    "#venuePanel .vBar{height:8px;background:#35557a;border-radius:4px;overflow:hidden;margin:6px 0}" +
    "#venuePanel .vBar i{display:block;height:100%;background:#ffd166;width:0}" +
    "#venuePanel ul{margin:6px 0 0 18px;padding:0}";
  document.head.appendChild(css);
  const panel = document.createElement("div");
  panel.id = "venuePanel";
  panel.innerHTML =
    '<div class="vBox" role="dialog" aria-label="会場モード">' +
      '<h2>🏟 会場モード（11/3 武蔵屋・会場PC用）</h2>' +
      '<div class="vRow"><button type="button" class="big" data-act="toggle"></button><div class="vStat" data-r="status"></div></div>' +
      '<div class="vRow"><b>🛫 事前読み込み飛行</b><div class="vStat">白鳥の郷 → 駅 → 4km圏の候補すべて → 武蔵屋を自動で回り、街並みを読み込んでおきます（数分・通信あり）。開場前に1回。3D を読み直したあとも1回</div>' +
        '<button type="button" data-act="preload"></button><div class="vBar"><i data-r="bar"></i></div><div class="vStat" data-r="pre"></div></div>' +
      '<div class="vRow"><b>PC 側（このボタンではできないこと）</b><ul>' +
        '<li>会場PCの「会場モードON.bat」を管理者で実行（Windows Update・OneDrive・ブラウザ自動更新を止め、Wi-Fi を従量制に）。帰ったら「会場モードOFF.bat」</li>' +
        '<li>「🎮 操作のしかた」の下が「💾 この端末に保存済み」になっていること</li>' +
        '<li>⚙設定「📶 通信量」で1日の上限（GB）を入れておくと、8割で注意・超えたら街並みをさらに粗くします（白鳥は消えません）</li>' +
      '</ul></div>' +
      '<div style="text-align:right"><button type="button" data-act="close">とじる</button><div class="vStat">版 ' + VER + "</div></div>" +
    "</div>";
  document.body.appendChild(panel);
  const $ = (s) => panel.querySelector(s);
  function render() {
    const t = ts();
    const tog = $('[data-act="toggle"]');
    tog.textContent = st.on ? "🏟 会場モード ON（押すと元に戻す）" : "🏟 会場モードにする";
    tog.classList.toggle("on", st.on);
    $('[data-r="status"]').textContent = (st.on ? "街並みの記憶量 " + CACHE_GB + "GB・描画精度 " + st.sse + "（白鳥はそのまま）" : "通常：記憶量 512MB・描画精度は管理画面の値（既定 8）") +
      (t ? "　／　いま：記憶量 " + fmt(t.cacheBytes) + "・精度 " + t.maximumScreenSpaceError : "　／　街並みは未読み込み（読み込めたら自動で適用）");
    const pb = $('[data-act="preload"]');
    pb.textContent = st.pre ? "⏹ 中止する" : "🛫 事前読み込みを始める";
    $('[data-r="bar"]').style.width = st.pre ? Math.round(st.pre.i / st.pre.total * 100) + "%" : "0";
    $('[data-r="pre"]').textContent = st.pre ? st.pre.i + "／" + st.pre.total + "　" + (st.pre.name || "") : (st.last || "");
    const btn = document.getElementById("msyVenueBtn");
    if (btn) btn.textContent = st.on ? "🏟 会場モード ON" : "🏟 会場モード";
  }
  panel.addEventListener("click", function (e) {
    if (e.target === panel) { panel.classList.remove("show"); return; }
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "toggle") setOn(!st.on);
    else if (act === "preload") preload();
    else if (act === "close") panel.classList.remove("show");
  });
  function open() { render(); panel.classList.add("show"); }
  // ⚙設定 のボタン（武蔵屋モードの間だけ。musashiya.js の enterMode／leaveMode が呼ぶ）
  function place(inMode) {
    let btn = document.getElementById("msyVenueBtn");
    const menu = document.querySelector("#tbGroupSettings .tbMenu");
    if (inMode) {
      if (!btn && menu) {
        btn = document.createElement("button");
        btn.id = "msyVenueBtn";
        btn.title = "会場PC用。街並みの記憶量を増やし、白鳥を消さずに通信を節約し、事前読み込み飛行ができます（OFF で元に戻る）";
        btn.addEventListener("click", open);
        const after = document.getElementById("msyVoiceBtn");
        if (after && after.nextSibling) menu.insertBefore(btn, after.nextSibling); else menu.insertBefore(btn, menu.firstChild);
      }
      render();
    } else if (btn) btn.remove();
  }

  // ---- 起動時：URL の指定（会場モードON.bat がこの URL でブラウザを開く。2026-09-15 中司さん「ボタン一つで」）----
  //   ?venue=1   … 会場モードを自動 ON（スマホ・タブレットでは無視。記憶量 3GB は端末に重いため）
  //   ?preload=1 … 街並みが読み込めたら（受付のあと）事前読み込み飛行を自動で始め、進み具合の画面を出す
  const q = new URLSearchParams(location.search);
  const coarse = (() => { try { return matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } })();
  if (q.get("venue") === "1" && !coarse) { st.on = true; st.sse = SSE_SAVE; save(); }
  if (q.get("preload") === "1" && !coarse) {
    const t0 = Date.now();
    const t = setInterval(function () {
      if (Date.now() - t0 > 30 * 60 * 1000) { clearInterval(t); return; } // 受付が済まないまま30分たったら諦める
      if (!(ts() || notiles()) || !points().length || st.pre) return;
      if (typeof window.msyOn === "function" && window.msyOn()) return;
      clearInterval(t);
      open();
      preload();
    }, 1000);
  }
  // ---- 記憶した設定を、街並みが読み込めたところで適用 ----
  const saved = load();
  if (saved.on) {
    st.on = true; st.sse = saved.sse || SSE_SAVE;
    window.venueSse = st.sse;
    const t = setInterval(function () { if (apply()) { clearInterval(t); render(); } }, 500);
    setTimeout(function () { clearInterval(t); }, 15 * 60 * 1000); // 15分で諦める（検証モードなど街並みを読まないとき）
  }
  // 街並みが後から読み直されたとき（別のモードから戻るなど）も適用し続ける
  setInterval(function () { if (st.on) { const t = ts(); if (t && t.cacheBytes !== CACHE_GB * 1073741824) apply(); } }, 5000);

  window.CbiVenue = { open, place, on: () => st.on, tighten, setOn, preload, state: st };
})();
