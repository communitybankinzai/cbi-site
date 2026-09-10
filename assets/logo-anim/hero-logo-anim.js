/* CBIロゴ 組み上がりアニメーション（ヒーロー用・自己完結）
   ページを開いたときに1回だけロゴを組み上げ、終わったら元の静止ロゴに戻す。
   既存の logoFlash / logoFlare（180秒周期の時刻連動演出）は、
   組み上がりの間だけ止めて、完了後に再開する。
   生成: tools/pack_for_web.py — 手で編集せず、スクリプトを直すこと。 */
(function () {
  'use strict';
  var PARTS = [{"f": "p00.webp", "l": 20.175, "t": 5.662, "w": 59.49, "h": 24.322, "d": 0.12, "ox": -0.065, "oy": -25.0, "r": 16, "s": 0.93, "g": ""}, {"f": "p01.webp", "l": 26.475, "t": 13.955, "w": 32.775, "h": 39.793, "d": 0.28, "ox": -16.713, "oy": -18.592, "r": -16, "s": 0.93, "g": ""}, {"f": "p02.webp", "l": 14.115, "t": 33.493, "w": 27.113, "h": 36.922, "d": 0.44, "ox": -24.884, "oy": 2.401, "r": 16, "s": 0.93, "g": ""}, {"f": "p03.webp", "l": 58.852, "t": 33.573, "w": 26.794, "h": 36.842, "d": 0.6, "ox": 24.877, "oy": 2.473, "r": -16, "s": 0.93, "g": ""}, {"f": "p04.webp", "l": 17.544, "t": 30.861, "w": 5.423, "h": 5.502, "d": 0.76, "ox": -33.569, "oy": -18.508, "r": 26, "s": 0.86, "g": ""}, {"f": "p05.webp", "l": 76.874, "t": 30.861, "w": 5.502, "h": 5.582, "d": 0.92, "ox": 33.524, "oy": -18.589, "r": -26, "s": 0.86, "g": ""}, {"f": "p06.webp", "l": 62.919, "t": 21.292, "w": 7.177, "h": 27.352, "d": 1.08, "ox": 18.62, "oy": -16.682, "r": 16, "s": 0.93, "g": "letter"}, {"f": "p07.webp", "l": 22.967, "t": 47.368, "w": 19.139, "h": 17.624, "d": 1.24, "ox": -23.309, "oy": 9.037, "r": -16, "s": 0.93, "g": ""}, {"f": "p08.webp", "l": 57.815, "t": 48.006, "w": 19.059, "h": 16.986, "d": 1.4, "ox": 23.203, "oy": 9.308, "r": 16, "s": 0.93, "g": ""}, {"f": "p09.webp", "l": 41.786, "t": 21.292, "w": 18.9, "h": 27.352, "d": 1.56, "ox": 1.49, "oy": -24.956, "r": -16, "s": 0.93, "g": ""}, {"f": "p10.webp", "l": 22.568, "t": 44.179, "w": 5.582, "h": 5.502, "d": 1.72, "ox": -38.028, "oy": -4.83, "r": 26, "s": 0.86, "g": ""}, {"f": "p11.webp", "l": 71.77, "t": 44.099, "w": 5.582, "h": 5.582, "d": 1.88, "ox": 38.024, "oy": -4.859, "r": -26, "s": 0.86, "g": ""}, {"f": "p12.webp", "l": 36.603, "t": 53.27, "w": 26.715, "h": 22.887, "d": 2.04, "ox": -0.049, "oy": 25.0, "r": 16, "s": 0.93, "g": "knot"}, {"f": "p13.webp", "l": 0.0, "t": 76.236, "w": 100.0, "h": 23.764, "d": 2.2, "ox": 0.0, "oy": 7.5, "r": 0.0, "s": 0.96, "g": "wordmark"}];
  var DUR = 1.15;
  var BASE = 'assets/logo-anim/';

  // 動きを減らす設定の人には見せない（静止ロゴのまま）
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function start() {
    var wrap = document.querySelector('.hero-logo-wrap');
    var still = wrap && wrap.querySelector('.hero-logo');
    if (!wrap || !still) return;

    // ⛔ 先に部品を全部読み込んでから始めること。
    // 読み込みを待たずに動かすと、画像が届く前にアニメが終わって何も見えない
    // （実測: 部品一式で約2秒かかり、着地3.4秒のアニメがほぼ空振りした）。
    var imgs = [], loaded = 0, dead = false;
    // 状態を外から見えるようにしておく（不具合の切り分け用。実害のない読み取り専用の目印）
    var st = window.__logoAnim = { phase: 'loading', loaded: 0, total: PARTS.length };
    var giveUp = setTimeout(function () { dead = true; st.phase = 'timeout'; }, 8000);

    function onOne() {
      if (dead) return;
      st.loaded = ++loaded;
      if (loaded === PARTS.length) { clearTimeout(giveUp); run(); }
    }
    function onFail(e) {
      dead = true;
      st.phase = 'error';
      st.failed = (e && e.target && e.target.src) || '?';
      clearTimeout(giveUp);
    }

    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      var im = new Image();
      im.alt = '';
      im.style.cssText = 'position:absolute;left:' + p.l + '%;top:' + p.t + '%;width:' + p.w +
        '%;height:' + p.h + '%;opacity:0;will-change:transform,opacity;';
      im.onload = onOne;
      im.onerror = onFail;
      im.src = BASE + p.f;
      imgs.push(im);
    }
    if (loaded === PARTS.length) { clearTimeout(giveUp); run(); }   // キャッシュ済みの場合

    function run() {
    // ⛔ 出遅れたら組み上げない。
    // ヒーローは海のWebGLや大きな写真を初期化するため、端末が遅いと
    // ページのJSが数秒止まる（計測環境では9秒）。そこから組み上げ始めると
    // 「完成しているロゴが今さらバラけて集まる」不自然な絵になるので、
    // 間に合わなかったときは静止ロゴのままにする。
    if (performance.now() > 3000) { st.phase = 'too-late'; return; }
    st.phase = 'run';
    // 部品を載せる台座。静止ロゴと同じ円形・同じ影にして、切り替わりが見えないようにする
    var stage = document.createElement('div');
    stage.setAttribute('aria-hidden', 'true');
    var cs = getComputedStyle(still);
    stage.style.cssText = 'position:absolute;inset:0;border-radius:50%;overflow:hidden;' +
      'background:' + cs.backgroundColor + ';box-shadow:' + cs.boxShadow + ';';
    for (var k = 0; k < imgs.length; k++) stage.appendChild(imgs[k]);

    still.style.opacity = '0';
    wrap.style.animationPlayState = 'paused';      // 時刻連動の拡大を一時停止
    var flare = wrap.querySelector('.hero-logo-flare');
    if (flare) flare.style.animationPlayState = 'paused';
    wrap.appendChild(stage);

    var t0 = null;
    function ease(t) { return 1 - Math.pow(1 - t, 5); }
    function frame(now) {
      if (t0 === null) t0 = now;
      var t = (now - t0) / 1000;
      var done = true;
      for (var i = 0; i < PARTS.length; i++) {
        var p = PARTS[i];
        var raw = (t - p.d) / DUR;
        raw = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
        if (raw < 1) done = false;
        var e = ease(raw), inv = 1 - e;
        // 移動量はコンテナ基準の%なので、部品自身の幅に対する%へ換算する
        var dx = p.ox * inv / p.w * 100;
        var dy = p.oy * inv / p.h * 100;
        imgs[i].style.transform = 'translate(' + dx + '%,' + dy + '%) rotate(' +
          (p.r * inv) + 'deg) scale(' + (p.s + (1 - p.s) * e) + ')';
        imgs[i].style.opacity = Math.min(1, raw * 3.2);
      }
      if (done) {
        // 静止ロゴへ戻し、時刻連動の演出を再開する
        still.style.opacity = '';
        wrap.style.animationPlayState = '';
        if (flare) flare.style.animationPlayState = '';
        stage.remove();
        st.phase = 'done';
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
