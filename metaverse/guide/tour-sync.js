/* 文化財ガイド帳（guide/）とスタンプラリー（rally/）の「ツアー同期」共通部品（2026-11-09）
 *
 * ガイドが文化財を選ぶと、同じツアーに参加した観光客の画面がその文化財に切り替わる。
 * 仕組みは Supabase Realtime の Broadcast / Presence（3Dワールド index.html の位置共有と同じ接続先・同じ匿名キー）。
 * DB には何も書かない。チャンネル名は tour:<ツアーコード>。切断すれば消える。
 *
 * 偽装対策（同日・夕方）：チャンネルは公開なので、ツアーコードを知っていれば誰でも送れる。そこで
 *   - ガイドは鍵ペア（ECDSA P-256・WebCrypto）を持ち、配信する spot / say に署名（payload.sig）を付ける
 *   - 観光客は QR の URL にある公開鍵 k で検証し、署名が無い・合わない・古い（10分超）配信は捨てる
 *   - 観光客からの hello / ask は署名しない（ガイド側で受けるだけ・影響が小さい）
 *   公開鍵は URL に乗るので観光客も知っているが、秘密鍵はガイドの端末だけにある。
 *
 * 使い方：
 *   CbiTourSync.loadLib(function () {
 *     CbiTourSync.makeGuideKeys().then(function (keys) {            // ガイド側（keys.pub は URL 用の文字列）
 *       var h = CbiTourSync.connect({ tourId: "ABC234", role: "guide", keys: keys, onHello: ..., onAsk: ... });
 *       h.send("spot", { id: "kioroshi-kaiso", name: "木下貝層", at: Date.now() });   // 自動で署名される
 *     });
 *     var t = CbiTourSync.connect({ tourId: "ABC234", role: "tourist", pubKey: "<URL の k>", onSpot: ..., onSay: ... });
 *   });
 */
window.CbiTourSync = (function () {
  "use strict";
  var RT_URL = "https://oxuxvtuhijnsewivgrje.supabase.co";
  var RT_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94dXh2dHVoaWpuc2V3aXZncmplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjAwOTYsImV4cCI6MjA5NzgzNjA5Nn0.Pd4mIElqYweQuMt4uBARVeWXhSZ9TseVsID9lHB0JI4";
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js";
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 見間違えやすい I O 0 1 L を除く
  var SIGNED_EVENTS = { spot: true, say: true };     // ガイドだけが送れる（署名が要る）配信
  var MAX_AGE_MS = 10 * 60 * 1000;                   // これより古い配信は捨てる（再生攻撃と取りこぼしの境目）
  var subtle = (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null;
  var cryptoOk = !!(subtle && window.TextEncoder && window.btoa && window.atob);   // 署名に要る部品がそろっているか
  var FUTURE_MS = 2 * 60 * 1000;                     // 端末の時計のずれとして許す未来側の幅

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
  // 観光客が開く URL（スタンプラリーのツアー参加）。pubKey があれば k に付ける
  function tourUrl(tourId, lang, pubKey) {
    var base = location.origin + location.pathname.replace(/\/(guide|rally)\/?[^/]*$/, "/rally/");
    return base + "?tour=" + encodeURIComponent(tourId) + (pubKey ? "&k=" + encodeURIComponent(pubKey) : "") + (lang === "en" ? "&lang=en" : "");
  }

  /* ---- 署名の部品（base64url・正規化した JSON・ECDSA P-256 / SHA-256） ---- */
  function b64u(bytes) {
    var s = ""; var arr = new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function unb64u(str) {
    var s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s); var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  // キーの順をそろえた JSON（送る側と受ける側で同じ文字列になるように）。sig は含めない
  function canon(obj) {
    if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
    if (Array.isArray(obj)) return "[" + obj.map(canon).join(",") + "]";
    var keys = Object.keys(obj).filter(function (k) { return k !== "sig" && obj[k] !== undefined; }).sort();
    return "{" + keys.map(function (k) { return JSON.stringify(k) + ":" + canon(obj[k]); }).join(",") + "}";
  }
  function strBytes(s) { return new TextEncoder().encode(s); }
  var ALGO_GEN = { name: "ECDSA", namedCurve: "P-256" };
  var ALGO_SIGN = { name: "ECDSA", hash: { name: "SHA-256" } };

  // ガイドの鍵ペアを作る。戻り値 { priv, pub(文字列・URL 用), pubKey(CryptoKey), jwk(保存用) }
  function makeGuideKeys() {
    if (!cryptoOk) return Promise.reject(new Error("WebCrypto が使えません"));
    return subtle.generateKey(ALGO_GEN, true, ["sign", "verify"]).then(function (kp) {
      return Promise.all([subtle.exportKey("raw", kp.publicKey), subtle.exportKey("jwk", kp.privateKey)]).then(function (r) {
        return { priv: kp.privateKey, pubKey: kp.publicKey, pub: b64u(r[0]), jwk: r[1] };
      });
    });
  }
  // 保存しておいた JWK（秘密鍵）から復元する（ページの読み直し用）
  function restoreGuideKeys(jwk) {
    if (!cryptoOk || !jwk) return Promise.reject(new Error("鍵がありません"));
    return subtle.importKey("jwk", jwk, ALGO_GEN, true, ["sign"]).then(function (priv) {
      var pubJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true };
      return subtle.importKey("jwk", pubJwk, ALGO_GEN, true, ["verify"]).then(function (pubKey) {
        return subtle.exportKey("raw", pubKey).then(function (raw) { return { priv: priv, pubKey: pubKey, pub: b64u(raw), jwk: jwk }; });
      });
    });
  }
  function importPub(b64) {
    return Promise.resolve().then(function () {
      if (!cryptoOk) throw new Error("WebCrypto が使えません");
      return subtle.importKey("raw", unb64u(b64), ALGO_GEN, true, ["verify"]);   // 不正な base64 もここで reject になる
    });
  }
  // 署名の対象＝正規化した payload ＋ イベント名 ＋ ツアーコード（say の署名を spot に流用したり、別のツアーで使い回せないように）
  function signedBytes(payload, event, tourId) { return strBytes(canon(payload) + "|" + event + "|" + tourId); }
  function sign(priv, payload, event, tourId) {
    return subtle.sign(ALGO_SIGN, priv, signedBytes(payload, event, tourId)).then(b64u);
  }
  function verify(pubKey, payload, event, tourId) {
    return Promise.resolve().then(function () {
      if (!payload || typeof payload.sig !== "string") return false;
      return subtle.verify(ALGO_SIGN, pubKey, unb64u(payload.sig), signedBytes(payload, event, tourId));
    }).catch(function () { return false; });
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

  // opts: { tourId, role: "guide"|"tourist", keys（ガイド・makeGuideKeys の戻り値）, pubKey（観光客・URL の k）,
  //         onSpot, onSay, onHello, onAsk, onPresence, onStatus, onRejected(理由, payload) }
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
    var isGuide = opts.role === "guide";
    var keys = isGuide ? opts.keys : null;
    var pubKeyPromise = (!isGuide && opts.pubKey) ? importPub(opts.pubKey).catch(function () { return null; }) : Promise.resolve(null);
    var verifying = !isGuide && !!opts.pubKey;   // 公開鍵を持つ観光客は署名を確かめる。無い（古いリンク）ときは従来どおり受ける

    function counts() {
      var st = ch.presenceState(), g = 0, t = 0;
      Object.keys(st).forEach(function (k) {
        var metas = st[k]; var p = metas && metas[metas.length - 1];
        if (!p) return;
        if (p.role === "guide") g++; else t++;
      });
      return { guides: g, tourists: t, total: g + t };
    }
    // ガイドだけが送れる配信は、署名と新しさを確かめてから渡す。同じ at 以下は再生とみなして捨て、退出後は適用しない
    var lastAt = { spot: 0, say: 0 };
    function reject(reason, p) { if (opts.onRejected) opts.onRejected(reason, p); }
    function guarded(event, handler) {
      return function (m) {
        var p = m.payload || {};
        if (!handler) return;
        if (!verifying) { handler(p); return; }
        if (typeof p.at !== "number" || Date.now() - p.at > MAX_AGE_MS || p.at - Date.now() > FUTURE_MS) { reject("stale", p); return; }
        if (p.at <= lastAt[event]) { reject("replay", p); return; }
        pubKeyPromise.then(function (pk) {
          if (status === "CLOSED") return;
          if (!pk) { reject("nokey", p); return; }
          return verify(pk, p, event, tourId).then(function (ok) {
            if (status === "CLOSED") return;
            if (!ok) { reject("badsig", p); return; }
            if (p.at <= lastAt[event]) { reject("replay", p); return; }   // 検証している間に、もっと新しい配信が先に通った
            lastAt[event] = p.at;
            handler(p);
          });
        }).catch(function () { reject("error", p); });
      };
    }
    ch.on("broadcast", { event: "spot" }, guarded("spot", opts.onSpot))
      .on("broadcast", { event: "say" }, guarded("say", opts.onSay))                                                    // ガイド→観光客：字幕（ja/en）・読み上げ（read）・停止（stop）
      .on("broadcast", { event: "hello" }, function (m) { if (opts.onHello) opts.onHello(m.payload || {}); })  // 観光客→ガイド：入室
      .on("broadcast", { event: "ask" }, function (m) { if (opts.onAsk) opts.onAsk(m.payload || {}); })        // 観光客→ガイド：質問（en/ja）
      .on("presence", { event: "sync" }, function () { if (opts.onPresence) opts.onPresence(counts()); })
      .subscribe(function (s) {
        status = s;
        if (opts.onStatus) opts.onStatus(s);
        if (s === "SUBSCRIBED") {
          ch.track({ role: isGuide ? "guide" : "tourist", at: Date.now() }).catch(function () {});
          if (!isGuide) send("hello", { at: Date.now() }); // 入ったら、いまの文化財を教えてもらう
        }
      });
    // 送信。ガイドの spot / say は署名を付ける（鍵が無いときは送らない）
    function send(event, payload) {
      payload = payload || {};
      if (typeof payload.at !== "number") payload.at = Date.now();
      if (SIGNED_EVENTS[event]) {
        if (!isGuide || !keys || !keys.priv) return Promise.resolve("unsigned-not-allowed");
        return sign(keys.priv, payload, event, tourId).then(function (sig) {
          payload.sig = sig;
          try { return ch.send({ type: "broadcast", event: event, payload: payload }); } catch (e) { return "error"; }
        }).catch(function () { return "error"; });
      }
      try { return Promise.resolve(ch.send({ type: "broadcast", event: event, payload: payload })); } catch (e) { return Promise.resolve("error"); }
    }
    function leave() {
      try { ch.untrack(); } catch (e) {}
      try { client.removeChannel(ch); } catch (e) {}
      status = "CLOSED";
    }
    return { tourId: tourId, me: me, pub: keys ? keys.pub : null, verifying: verifying, send: send, leave: leave, counts: counts, status: function () { return status; } };
  }

  return { newTourId: newTourId, normalize: normalize, tourUrl: tourUrl, loadLib: loadLib, connect: connect,
           makeGuideKeys: makeGuideKeys, restoreGuideKeys: restoreGuideKeys, canon: canon, hasCrypto: cryptoOk };
})();
