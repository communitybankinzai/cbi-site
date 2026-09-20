// 📡 回線速度をはかる（2026-09-20 中司さん「Wi-Fiの速度計測の仕方がわからない。3D MAP の設定から計測できるように」）
// 会場（11/3 武蔵屋・2階）で、Wi-Fi とテザリングのどちらが速いかをその場で比べるための道具。
// 測り方：このサイト自身の白鳥データ（assets/tonbi/swan.glb・約25MB）を「範囲指定」で少しだけ取り寄せ、
//   かかった時間から下り速度を出す。Google の街並み（3D Tiles）は使わないので、1日30回の入場枠も課金も消費しない。
// 注意：URL に ?（クエリ）を付けない。付けると sw.js が保存済みの白鳥を返してしまい、通信していないのに速く見える。
//   ブラウザの保存も使わないよう cache:"no-store" と、毎回ちがう範囲（先頭位置をずらす）で取る。
// 判定のめやす（CLAUDE_HANDOFF の 2026-09-14 の検討と同じ）：10Mbps 以上＝快適／5〜10＝会場モードで可／5未満＝上映のみ推奨。
//   3Dの街並みは飛び続けると毎秒約1MB（約8Mbps）使う（2026-09-03 本番実測）。
(function () {
  "use strict";
  const VER = "20260920-1";
  const KEY = "cbi-meta-netcheck-v1";      // 測った記録（この端末に最大10件）
  const SRC = "assets/tonbi/swan.glb";     // 25,129,852 バイト（2026-09-20 実測）
  const SRC_BYTES = 25129852;
  const WARM = 256 * 1024;                 // ためし取り（つなぐまでの時間を除くため、この分は測らない）
  const STEP1 = 2 * 1024 * 1024;           // まず2MB
  const STEP2 = 8 * 1024 * 1024;           // 速ければ追加で8MB（合計10MB）
  const MAX_MS = 20000;                    // これ以上は待たない
  const st = { busy: false, abort: null };

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 10))); } catch (e) {} };
  const mbps = (bytes, ms) => (bytes * 8) / (ms / 1000) / 1e6;
  const fmtMbps = (v) => (v >= 100 ? Math.round(v) : v.toFixed(1)) + " Mbps";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 判定（3段階）
  function verdict(v) {
    if (v >= 10) return { mark: "◎", label: "快適に体験できます", cls: "ok",
      note: "3Dの街並みがすぐ出ます。いつもの設定（会場モードは使っても使わなくても可）で大丈夫です。" };
    if (v >= 5) return { mark: "○", label: "会場モードで体験できます", cls: "warn",
      note: "街並みの読み込みが少し遅れます。⚙設定の「🏟 会場モード」を ON にして、開場前に「🛫 事前読み込み」をしておいてください。" };
    return { mark: "△", label: "上映のみをおすすめします", cls: "ng",
      note: "3Dの街並みが追いつかない可能性が高いです。展示動画・紹介動画の上映を主にして、体験は別の回線（テザリング等）を試してから決めてください。" };
  }

  // 1回ぶんの取り寄せ。戻り値：かかった時間（ミリ秒）
  async function grab(start, len, onProgress) {
    const ctrl = new AbortController();
    st.abort = ctrl;
    const timer = setTimeout(() => ctrl.abort(), MAX_MS);
    const t0 = performance.now();
    try {
      const res = await fetch(SRC, { cache: "no-store", signal: ctrl.signal,
        headers: { Range: "bytes=" + start + "-" + (start + len - 1) } });
      if (!res.ok && res.status !== 206) throw new Error("HTTP " + res.status);
      let got = 0;
      // 途中の機器が「範囲指定」を無視して丸ごと送ってくることがある（206 でなければその可能性）。
      // そのまま受け取ると25MBを落としてしまうので、頼んだ分まで読んだら打ち切る（テザリングの通信量を守る）
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        for (;;) {
          const r = await reader.read();
          if (r.done) break;
          got += r.value.length;
          if (onProgress) onProgress(got, performance.now() - t0);
          if (got >= len) { try { await reader.cancel(); } catch (e) {} break; }
        }
      } else {
        ctrl.abort(); // 読みながら止められない環境では、丸ごと受け取らずにやめる
        throw new Error("この環境では測れません");
      }
      return { ms: performance.now() - t0, bytes: Math.min(got, len), partial: res.status !== 206 };
    } finally {
      clearTimeout(timer);
      st.abort = null;
    }
  }

  // 応答の速さ（小さい取り寄せ3回の中央値）
  async function latency() {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const at = Math.floor(Math.random() * (SRC_BYTES - 1024));
      const t0 = performance.now();
      try {
        await fetch(SRC, { cache: "no-store", headers: { Range: "bytes=" + at + "-" + (at + 1023) } });
        out.push(performance.now() - t0);
      } catch (e) { /* 数えない */ }
    }
    out.sort((a, b) => a - b);
    return out.length ? out[Math.floor(out.length / 2)] : null;
  }

  async function run() {
    if (st.busy) { if (st.abort) st.abort.abort(); return; }
    st.busy = true;
    render();
    const line = (t) => { const el = $("ncNow"); if (el) el.textContent = t; };
    try {
      line("つながり具合をみています…");
      const lat = await latency();
      line("ためし取り中…");
      const at0 = Math.floor(Math.random() * (SRC_BYTES - WARM - STEP1 - STEP2 - 1));
      await grab(at0, WARM);                                   // つなぐまでの時間を除くための助走
      line("速さをはかっています…（0.0 秒）");
      let bytes = 0, ms = 0;
      const prog = (got, elapsed) => line("速さをはかっています…（" + (elapsed / 1000).toFixed(1) + " 秒・" + fmtMbps(mbps(got, Math.max(1, elapsed))) + "）");
      const a = await grab(at0 + WARM, STEP1, prog);
      bytes += a.bytes; ms += a.ms;
      if (ms < 2500) {                                         // 速いときは量を増やして精度を上げる
        const b = await grab(at0 + WARM + STEP1, STEP2, (g, e) => prog(bytes + g, ms + e));
        bytes += b.bytes; ms += b.ms;
      }
      const v = mbps(bytes, ms);
      const rec = { at: new Date().toISOString(), mbps: v, ms: Math.round(ms), bytes: bytes, latency: lat == null ? null : Math.round(lat),
        net: (navigator.connection && navigator.connection.effectiveType) || "" };
      const all = load(); all.unshift(rec); save(all);
      st.last = rec;
    } catch (e) {
      st.last = { at: new Date().toISOString(), error: (e && e.name === "AbortError") ? "時間切れ・中止" : String((e && e.message) || e) };
    }
    st.busy = false;
    render();
  }

  // ---- 画面 ----
  const css = document.createElement("style");
  css.textContent =
    "#ncPanel{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:133;font-family:system-ui,sans-serif}" +
    "#ncPanel.show{display:flex}" +
    "#ncPanel .ncBox{background:#0e2238;color:#fff;border:2px solid #4a90d9;border-radius:14px;width:min(620px,94vw);max-height:92vh;overflow:auto;padding:16px 18px;font-size:15px;line-height:1.6;box-shadow:0 10px 40px rgba(0,0,0,.5)}" +
    "#ncPanel h2{margin:0 0 6px;font-size:20px;color:#ffd166}" +
    "#ncPanel button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #6a9fd8;background:#1c3a5c;color:#fff;padding:8px 14px;margin:4px 6px 4px 0}" +
    "#ncPanel button.big{font-size:18px;font-weight:bold;padding:12px 22px}" +
    "#ncPanel .ncStat{color:#9fb6cc;font-size:13px}" +
    "#ncPanel .ncRow{margin:10px 0;padding:10px;border:1px solid #2c4d72;border-radius:10px}" +
    "#ncPanel .ncBig{font-size:30px;font-weight:bold}" +
    "#ncPanel .ok{color:#7fe08a}#ncPanel .warn{color:#ffd166}#ncPanel .ng{color:#ff9b9b}" +
    "#ncPanel table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}" +
    "#ncPanel td{border-top:1px solid #2c4d72;padding:3px 4px;color:#cfe6ff}";
  document.head.appendChild(css);
  const panel = document.createElement("div");
  panel.id = "ncPanel";
  panel.innerHTML =
    '<div class="ncBox" role="dialog" aria-label="回線速度をはかる">' +
      "<h2>📡 回線速度をはかる</h2>" +
      '<div class="ncStat">いまつながっている回線（Wi-Fi・テザリングなど）の速さを測ります。3Dの街並みは読み込まないので、1日30回の利用枠は減りません。10秒ほどで終わります。</div>' +
      '<div class="ncRow"><button type="button" class="big" data-act="run"></button><div data-r="now" id="ncNow" class="ncStat"></div></div>' +
      '<div class="ncRow" data-r="result"></div>' +
      '<div class="ncRow"><b>これまでの記録（この端末）</b><div data-r="hist"></div>' +
        '<button type="button" data-act="clear" style="font-size:12px;padding:3px 8px;margin-top:6px">記録を消す</button></div>' +
      '<div style="text-align:right"><button type="button" data-act="close">とじる</button><div class="ncStat">版 ' + VER + "</div></div>" +
    "</div>";
  document.body.appendChild(panel);
  const $ = (id) => panel.querySelector('[data-r="' + id.replace(/^nc/, "").toLowerCase() + '"]') || document.getElementById(id);

  function render() {
    panel.querySelector('[data-act="run"]').textContent = st.busy ? "⏹ やめる" : "▶ はかる（約10秒）";
    const box = panel.querySelector('[data-r="result"]');
    const r = st.last;
    if (!r) box.innerHTML = '<span class="ncStat">まだ測っていません。上のボタンを押してください。</span>';
    else if (r.error) box.innerHTML = '<b class="ng">はかれませんでした</b><div class="ncStat">' + esc(r.error) + "（電波が届いていないか、通信が不安定です）</div>";
    else {
      const v = verdict(r.mbps);
      box.innerHTML = '<div class="ncBig ' + v.cls + '">' + v.mark + " " + fmtMbps(r.mbps) + "</div>" +
        '<div class="' + v.cls + '"><b>' + v.label + "</b></div>" +
        '<div class="ncStat">' + v.note + "</div>" +
        '<div class="ncStat">（' + (r.bytes / 1048576).toFixed(1) + "MB を " + (r.ms / 1000).toFixed(1) + "秒で受信" +
        (r.latency != null ? "・応答 " + r.latency + "ms" : "") + "）</div>";
    }
    const h = load();
    panel.querySelector('[data-r="hist"]').innerHTML = h.length
      ? "<table>" + h.map((x) => {
          const d = new Date(x.at);
          const when = (d.getMonth() + 1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          return "<tr><td>" + when + "</td><td>" + (x.error ? "はかれず" : fmtMbps(x.mbps)) + "</td><td>" + (x.error ? "" : verdict(x.mbps).mark + " " + verdict(x.mbps).label) + "</td></tr>";
        }).join("") + "</table>"
      : '<span class="ncStat">まだありません</span>';
  }
  panel.addEventListener("click", function (e) {
    if (e.target === panel) { panel.classList.remove("show"); return; }
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "run") run();
    else if (act === "clear") { save([]); st.last = null; render(); }
    else if (act === "close") { if (st.abort) st.abort.abort(); panel.classList.remove("show"); }
  });
  function open() { st.last = st.last || null; render(); panel.classList.add("show"); }

  // ⚙設定 のボタン（どのモードでも使えるように、読み込み時に置く）
  function place() {
    if (document.getElementById("netCheckBtn")) return true;
    const menu = document.querySelector("#tbGroupSettings .tbMenu");
    if (!menu) return false;
    const btn = document.createElement("button");
    btn.id = "netCheckBtn";
    btn.type = "button";
    btn.textContent = "📡 回線速度";
    btn.title = "いまつながっている回線（Wi-Fi・テザリング）の速さを測ります。3Dの街並みは読み込まないので利用枠は減りません";
    btn.addEventListener("click", open);
    const after = document.getElementById("trafficBtn"); // 「📶 通信量」の隣に置く
    if (after && after.parentElement === menu) menu.insertBefore(btn, after.nextSibling);
    else menu.appendChild(btn);
    return true;
  }
  if (!place()) {
    const t = setInterval(function () { if (place()) clearInterval(t); }, 500);
    setTimeout(function () { clearInterval(t); }, 30000);
  }
  window.CbiNetCheck = { open, run, state: st, history: load };
})();
