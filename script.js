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
