/* 文化財ガイド帳（guide/）とスタンプラリー（rally/）の「ツアー同期」共通部品（2026-11-09）
 *
 * ガイドが文化財を選ぶと、同じツアーに参加した観光客の画面がその文化財に切り替わる。
 * 仕組みは Supabase Realtime の Broadcast / Presence（3Dワールド index.html の位置共有と同じ接続先・同じ匿名キー）。
 * DB には何も書かない。チャンネル名は tour:<ツアーコード>。切断すれば消える。
 *
 * 使い方：
 *   CbiTourSync.loadLib(function () {
 *     var h = CbiTourSync.connect({ tourId: "ABC234", role: "guide" | "tourist",
 *       onSpot: function (p) {}, onHello: function (p) {}, onSay: function (p) {}, onAsk: function (p) {},
 *       onPresence: function (counts) {}, onStatus: function (status) {} });
 *     h.send("spot", { id: "kioroshi-kaiso", name: "木下貝層", at: Date.now() });
 *     h.leave();
 *   });
 */
window.CbiTourSync = (function () {
  "use strict";
  var RT_URL = "https://oxuxvtuhijnsewivgrje.supabase.co";
  var RT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dXh2dHVoaWpuc2V3aXZncmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjAwOTYsImV4cCI6MjA5NzgzNjA5Nn0.Pd4mIElqYweQuMt4uBARVeWXhSZ9TseVsID9lHB0JI4";
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js";
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 見間違えやすい I O 0 1 L を除く

  function randomChars(n) {
    var out = "", buf = new Uint8Array(n);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) out += ALPHABET[buf[i] % ALPHABET.length];
    return out;
  }
  function newTourId() { return randomChars(6); }
  function normalize(id) {
    var c = String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return (c.length >= 4 && c.length <= 12) ? c : null;
  }
  // 観光客が開く URL（スタンプラリーのツアー参加）
  function tourUrl(tourId, lang) {
    var base = location.origin + location.pathname.replace(/\/(guide|rally)\/?[^/]*$/, "/rally/");
    return base + "?tour=" + encodeURIComponent(tourId) + (lang === "en" ? "&lang=en" : "");
  }

  var libLoading = null;
  function loadLib(cb) {
    if (window.supabase && window.supabase.createClient) { cb(true); return; }
    if (!libLoading) {
      libLoading = new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = LIB; s.crossOrigin = "anonymous";
        s.onload = function () { resolve(!!(window.supabase && window.supabase.createClient)); };
        s.onerror = function () { resolve(false); };
        document.head.appendChild(s);
      });
    }
    libLoading.then(cb);
  }

  function connect(opts) {
    opts = opts || {};
    var tourId = normalize(opts.tourId);
    if (!tourId || !window.supabase || !window.supabase.createClient) { if (opts.onStatus) opts.onStatus("NO_LIB"); return null; }
    var client = window.supabase.createClient(RT_URL, RT_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    var me = opts.key || randomChars(12);
    var ch = client.channel("tour:" + tourId, { config: { presence: { key: me }, broadcast: { self: false } } });
    var status = "CONNECTING";
    function counts() {
      var st = ch.presenceState(), g = 0, t = 0;
      Object.keys(st).forEach(function (k) {
        var metas = st[k]; var p = metas && metas[metas.length - 1];
        if (!p) return;
        if (p.role === "guide") g++; else t++;
      });
      return { guides: g, tourists: t, total: g + t };
    }
    ch.on("broadcast", { event: "spot" }, function (m) { if (opts.onSpot) opts.onSpot(m.payload || {}); })
      .on("broadcast", { event: "hello" }, function (m) { if (opts.onHello) opts.onHello(m.payload || {}); })
      .on("broadcast", { event: "say" }, function (m) { if (opts.onSay) opts.onSay(m.payload || {}); })       // ガイド→観光客：字幕（ja/en）・読み上げ（read）
      .on("broadcast", { event: "ask" }, function (m) { if (opts.onAsk) opts.onAsk(m.payload || {}); })       // 観光客→ガイド：質問（en/ja）
      .on("presence", { event: "sync" }, function () { if (opts.onPresence) opts.onPresence(counts()); })
      .subscribe(function (s) {
        status = s;
        if (opts.onStatus) opts.onStatus(s);
        if (s === "SUBSCRIBED") {
          ch.track({ role: opts.role || "tourist", at: Date.now() }).catch(function () {});
          if (opts.role !== "guide") send("hello", { at: Date.now() }); // 入ったら、いまの文化財を教えてもらう
        }
      });
    function send(event, payload) {
      try { return ch.send({ type: "broadcast", event: event, payload: payload || {} }); } catch (e) { return Promise.resolve("error"); }
    }
    function leave() {
      try { ch.untrack(); } catch (e) {}
      try { client.removeChannel(ch); } catch (e) {}
      status = "CLOSED";
    }
    return { tourId: tourId, me: me, send: send, leave: leave, counts: counts, status: function () { return status; } };
  }

  return { newTourId: newTourId, normalize: normalize, tourUrl: tourUrl, loadLib: loadLib, connect: connect };
})();
