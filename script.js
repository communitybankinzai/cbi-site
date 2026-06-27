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

  // 人材バンク登録者数を CiDAO から fetch して表示
  const counter = document.getElementById('talentBankCounter');
  const counterValue = document.getElementById('talentBankCount');
  if (counter && counterValue) {
    fetch('https://cidao.vercel.app/api/talent-bank/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.registered === 'number') {
          counterValue.textContent = String(data.registered);
          counter.hidden = false;
          counter.setAttribute('data-counter-loaded', 'true');
        }
      })
      .catch(() => { /* 取得失敗時は表示しない（hidden のまま） */ });
  }
})();
