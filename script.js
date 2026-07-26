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
    const SKY_ANIMS = ['sunArc', 'sunGlow', 'moonArc', 'moonGlow', 'skyNight', 'skyDawn', 'skyDay', 'skyDusk', 'starsCycle', 'logoFlash', 'logoBurstSun', 'logoBurstMoon'];
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
