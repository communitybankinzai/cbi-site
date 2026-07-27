(() => {
  'use strict';

  const header = document.getElementById('site-header');
  const navToggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('site-nav');
  const yearEl = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 描画不具合の切り分け用スイッチ（?deco=off / ?deco=sky / ?deco=photo）
  // deco=off  : 空・太陽・月・星の装飾レイヤーをすべて外す
  // deco=sky  : 空の色レイヤーだけ外す
  // deco=photo: 背景写真の上に重ねるグラデーションを外す
  {
    const mode = new URLSearchParams(location.search).get('deco');
    if (mode === 'off') {
      const d = document.querySelector('.hero-deco');
      if (d) d.style.display = 'none';
    } else if (mode === 'sky') {
      const t = document.querySelector('.sky-tint');
      if (t) t.style.display = 'none';
    } else if (mode === 'photo') {
      const o = document.querySelector('.hero-video-overlay');
      if (o) o.style.display = 'none';
    } else if (mode === 'noanim') {
      // ページ内の CSS アニメーションをすべて停止
      const s = document.createElement('style');
      s.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
      document.head.appendChild(s);
    } else if (mode === 'nophoto') {
      const ph = document.querySelector('.hero-photo');
      if (ph) ph.style.display = 'none';
    } else if (mode === 'plain') {
      // ヒーローを単色背景だけにする（写真・装飾・重ねグラデーションを全部外す）
      ['.hero-photo', '.hero-video-overlay', '.hero-deco'].forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      });
      const s = document.createElement('style');
      s.textContent = '*, *::before, *::after { animation: none !important; }';
      document.head.appendChild(s);
    }
    if (mode) document.documentElement.setAttribute('data-deco', mode);
    // ?debug=outline : 全要素に赤枠を引く。画面上の謎の矩形が
    // DOM要素ならば、その輪郭が赤枠として見えるはず（見えなければDOM外＝ブラウザ/OS側）
    if (new URLSearchParams(location.search).get('debug') === 'outline') {
      const s = document.createElement('style');
      s.textContent = '* { outline: 1px solid rgba(255, 0, 0, 0.6) !important; }';
      document.head.appendChild(s);
    }
  }

  // ヒーローの空を「開いた実時刻」の位相から始める（1日=180秒の周回）
  // CSS 側の keyframes は 0%=午前0時 → 50%=正午 の実時間配分なので、
  // 現在時刻の1日進捗ぶんだけアニメーションを先送りする
  {
    const dayProgressNow = () => {
      const now = new Date();
      return (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    };
    document.documentElement.style.setProperty(
      '--sky-delay',
      `-${(dayProgressNow() * 180).toFixed(1)}s`
    );
    // iOS Safari では CSS 変数経由の負ディレイが効かないことがあるため、
    // Web Animations API でアニメーションの現在位置を直接そろえる（擬似要素分も取れる）
    const SKY_ANIMS = ['logoFlash', 'logoBurstSun', 'logoBurstMoon', 'logoFlare'];
    const syncSky = () => {
      if (typeof document.getAnimations !== 'function') return;
      // 同期のたびに時刻を取り直す（固定値を使うと load 時の再同期で位相が巻き戻る）
      const tSec = dayProgressNow() * 180;
      document.getAnimations().forEach((a) => {
        if (a.animationName && SKY_ANIMS.includes(a.animationName)) {
          // currentTime は delay 込みのタイムライン位置：
          // 実効位相 = currentTime - delay。delay が効いている環境（負値）と
          // 効いていない環境（0）のどちらでも位相 tSec になるよう逆算する
          const dSec = ((a.effect && a.effect.getTiming().delay) || 0) / 1000;
          const ctSec = ((tSec + dSec) % 180 + 180) % 180;
          a.currentTime = ctSec * 1000;
        }
      });
    };
    syncSky();
    window.addEventListener('load', syncSky);

    // 空の色と星は「全画面要素のアニメーション」を避けるため、1秒ごとに値を直接更新する。
    // 1日=180秒の周回なので、1秒刻みでも色の変化は十分なめらかに見える。
    const SKY_STOPS = [
      // 月が出ている夜間は濃い夜空にする（背景写真の青空をほぼ隠す）
      { p: 0.00, c: [5, 7, 22, 0.93] },     // 0時 夜
      { p: 0.20, c: [8, 10, 28, 0.88] },    // 4:48 未明
      { p: 0.27, c: [255, 138, 76, 0.26] }, // 6:29 朝焼け
      { p: 0.35, c: [160, 205, 255, 0.10] },// 8:24 午前
      { p: 0.50, c: [150, 200, 255, 0.07] },// 正午
      { p: 0.68, c: [255, 168, 84, 0.16] }, // 16:19 午後
      { p: 0.75, c: [255, 104, 66, 0.28] }, // 18時 夕焼け
      { p: 0.85, c: [5, 7, 22, 0.93] },     // 20:24 夜
      { p: 1.00, c: [5, 7, 22, 0.93] },
    ];
    const skyColorAt = (p) => {
      let a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
      for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        if (p >= SKY_STOPS[i].p && p <= SKY_STOPS[i + 1].p) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; break; }
      }
      const t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
      const v = a.c.map((x, i) => x + (b.c[i] - x) * t);
      return `rgba(${Math.round(v[0])}, ${Math.round(v[1])}, ${Math.round(v[2])}, ${v[3].toFixed(3)})`;
    };
    // 星：夜（〜4:48 と 20:24〜）だけ見せる
    const starsOpacityAt = (p) => {
      if (p <= 0.20) return 0.9;
      if (p < 0.27) return 0.9 * (1 - (p - 0.20) / 0.07);
      if (p < 0.83) return 0;
      if (p < 0.90) return 0.9 * ((p - 0.83) / 0.07);
      return 0.9;
    };
    const tint = document.querySelector('.sky-tint');
    // 太陽（6→18時）／月（18→翌6時）の横位置と高さ（CSSのsunArc/moonArcと同じ配分）
    const lightAt = (p) => {
      const dayT = (p - 0.25) / 0.5;
      if (dayT >= 0 && dayT <= 1) return { x: -0.04 + dayT * 1.08, up: Math.sin(dayT * Math.PI), day: true };
      const nightT = p < 0.25 ? (p + 0.25) / 0.5 : (p - 0.75) / 0.5;
      return { x: -0.04 + nightT * 1.08, up: Math.sin(nightT * Math.PI), day: false };
    };
    const handShade = document.querySelector('.hero-hand-shade');
    const paintSky = () => {
      const p = dayProgressNow();
      if (tint) tint.style.backgroundColor = skyColorAt(p);
      document.documentElement.style.setProperty('--stars-opacity', String(starsOpacityAt(p).toFixed(3)));
      // 手の影：太陽の反対側が暗くなる。朝夕ほど影が濃く、正午は薄い。夜は全体が青暗く
      if (handShade) {
        const li = lightAt(p);
        const side = li.x < 0.5 ? 'to right' : 'to left'; // 光源の反対側へ向かって暗く
        if (li.day) {
          const strength = (0.12 + 0.30 * (1 - li.up)) * Math.min(1, li.up * 3 + 0.2);
          handShade.style.background =
            'linear-gradient(' + side + ', rgba(20, 25, 50, 0) 42%, rgba(20, 25, 50, ' + strength.toFixed(3) + ') 100%)';
        } else {
          const moon = 0.10 * li.up;
          handShade.style.background =
            'linear-gradient(' + side + ', rgba(8, 12, 30, ' + (0.38 - moon).toFixed(3) + ') 0%, rgba(8, 12, 30, ' + (0.58 - moon).toFixed(3) + ') 100%)';
        }
      }
    };
    if (!prefersReduced) {
      paintSky();
      setInterval(paintSky, 1000);
    }

    // 太陽・月の運行は transform で行う。
    // left/bottom を動かすと毎フレーム画面の再計算・再描画が起きるため使わない。
    const heroEl = document.querySelector('.hero');
    const sunEl = document.querySelector('.hero-sun');
    const moonEl = document.querySelector('.hero-moon');
    if (!prefersReduced && heroEl && sunEl && moonEl) {
      // 弧の形は従来の keyframes と同じ：地平線 -14%、天頂 72%（スマホ 78%）
      const place = (el, t, W, H, peak) => {
        const w = el.offsetWidth;
        // 基準は left:0 / bottom:0。translate は基準からの相対移動で指定する
        const x = (-0.04 + t * 1.08) * W - w / 2;
        const bottomPct = -0.14 + (peak + 0.14) * Math.sin(t * Math.PI);
        const y = -bottomPct * H;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        // 地平線の際でフェードさせる
        const edge = Math.min(t, 1 - t);
        el.style.opacity = String(Math.max(0, Math.min(1, edge / 0.06)));
      };
      let lastOrbit = 0;
      const orbit = (now) => {
        // 太陽・月はゆっくり動くので 30fps で十分
        if (now - lastOrbit < 33) { requestAnimationFrame(orbit); return; }
        lastOrbit = now;
        const p = dayProgressNow();
        const W = heroEl.clientWidth, H = heroEl.clientHeight;
        const peak = window.innerWidth <= 860 ? 0.78 : 0.72;
        const dayT = (p - 0.25) / 0.5;
        const nightT = p < 0.25 ? (p + 0.25) / 0.5 : (p - 0.75) / 0.5;
        if (dayT >= 0 && dayT <= 1) {
          place(sunEl, dayT, W, H, peak);
          moonEl.style.opacity = '0';
        } else {
          sunEl.style.opacity = '0';
        }
        if (!(dayT >= 0 && dayT <= 1)) place(moonEl, nightT, W, H, peak);
        requestAnimationFrame(orbit);
      };
      requestAnimationFrame(orbit);
    }
  }

  // 数字をふわっとカウントアップ（reduced-motion 時は即時表示）
  const animateCount = (el, to, duration = 900) => {
    if (prefersReduced || to <= 0) { el.textContent = String(to); return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // 人材バンク登録者数を CiDAO から fetch して表示
  const counter = document.getElementById('talentBankCounter');
  const counterValue = document.getElementById('talentBankCount');
  if (counter && counterValue) {
    fetch('https://cidao.vercel.app/api/talent-bank/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.registered === 'number') {
          counter.hidden = false;
          counter.setAttribute('data-counter-loaded', 'true');
          animateCount(counterValue, data.registered);
        }
      })
      .catch(() => { /* 取得失敗時は表示しない（hidden のまま） */ });
  }

  // スクロール出現アニメーション（JS無効時は何も付与されず常時表示のまま）
  if (!prefersReduced && 'IntersectionObserver' in window) {
    const targets = document.querySelectorAll(
      '.hero-title, .hero-sub, .hero-cta, .section-eyebrow, .section-title, .section-lead, .card, .join-card, .news-list li, .docs-list a'
    );
    let ioFired = false;
    const io = new IntersectionObserver((entries) => {
      ioFired = true;
      entries.forEach((entry) => {
        // 画面に入るたびに毎回ふわっと再生（出たら次回に備えてリセット）
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((el) => {
      el.classList.add('reveal');
      io.observe(el);
    });
    // 保険：Observer が一度も発火しない環境では3秒後に全表示して以後の制御を放棄する
    setTimeout(() => {
      if (!ioFired) {
        io.disconnect();
        targets.forEach((el) => el.classList.add('is-visible'));
      }
    }, 3000);
  }
})();
