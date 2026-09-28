// 防災MAPで「どの機能が押されたか」を数える（2026-09-28 事業主決定A：いらない機能を見極めるため）。
// 端末の中で機能ごとの回数をまとめ、ページを隠す・閉じるときに1回だけ CiDAO /api/cbi-site-features へ送る（sendBeacon）。
// 送るのは「機能の名前と回数・スマホかPCか・訪問数と同じ乱数ID」だけ。押した場所・入力した文字・地図の位置は送らない。
// 本番（github.io）以外・?notiles・?cinema では何もしない。手元の確認は ?trackdebug=1（送らずに window.__featureUsage に貯める）。
(function () {
  'use strict';
  const query = new URLSearchParams(location.search);
  const debug = query.has('trackdebug');
  if (!debug && (query.has('notiles') || query.has('cinema') || !location.hostname.endsWith('github.io'))) return;
  const ENDPOINT = 'https://cidao.vercel.app/api/cbi-site-features';
  const CONTENT = location.pathname.includes('/metaverse/') ? 'world' : 'disaster-map';
  const MAX_KEYS = 120;
  let visitorId;
  try {
    visitorId = localStorage.getItem('cbi-content-visitor-v1');
    if (!visitorId || !/^[0-9a-f-]{36}$/i.test(visitorId)) {
      visitorId = crypto.randomUUID(); localStorage.setItem('cbi-content-visitor-v1', visitorId);
    }
  } catch (_) { if (!debug) return; visitorId = crypto.randomUUID(); }
  const viewId = crypto.randomUUID();
  const device = matchMedia('(pointer: coarse), (max-width: 820px)').matches ? 'mobile' : 'desktop';
  const counts = {}, labels = {};
  let dirty = true; // 何も押さなくても1回は送る（訪問の数＝割合の分母）

  const shortText = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
  // 値が乱数ID・長い文字のときは名前に含めない（記録ごとに別の機能に見えてしまうため）
  const plainValue = v => v && v.length <= 30 && !/^[0-9a-f-]{16,}$/i.test(v) && !/^\d{3,}$/.test(v) ? v : '';

  function add(key, label) {
    if (!key) return;
    key = key.slice(0, 80);
    if (!(key in counts) && Object.keys(counts).length >= MAX_KEYS) return;
    counts[key] = Math.min(5000, (counts[key] || 0) + 1);
    const l = shortText(label, 40);
    if (l) labels[key] = l;
    dirty = true;
    if (debug) window.__featureUsage = { viewId, device, counts: { ...counts }, labels: { ...labels } };
  }

  // 押したものから「機能の名前」を決める。決まらないもの（地図の上のただのクリックなど）は数えない
  function keyOf(el) {
    const d = el.dataset || {};
    if (d.overlay) return 'layer:' + d.overlay;
    if (d.preset) return 'preset:' + d.preset;
    if (el.closest('#map-legend')) {
      for (const name of ['kind', 'when', 'event', 'legend']) if (d[name]) return `legend:${name}=${d[name]}`;
    }
    if (d.range) return 'range:' + d.range;
    if (d.rain || d.rainWindow || d.rainMin) return 'rain:' + (d.rain ? 'verdict' : d.rainWindow ? 'window' : 'min');
    if (d.drawCitizenRoad) return 'draw:' + d.drawCitizenRoad;
    if (el.id) return '#' + el.id;
    if (el.tagName === 'SUMMARY') return 'open:' + shortText(el.textContent, 24);
    const names = Object.keys(d);
    if (names.length) { const v = plainValue(d[names[0]]); return `[${names[0]}${v ? '=' + v : ''}]`; }
    if (el.tagName === 'A' && el.href) {
      try { const u = new URL(el.href, location.href); return u.origin === location.origin ? 'page:' + u.pathname.split('/').pop() : 'link:' + u.hostname; } catch (_) { return ''; }
    }
    return '';
  }

  function labelOf(el) {
    if (el.matches('input, select')) {
      const label = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
      if (!label) return el.getAttribute('aria-label') || el.title || '';
      // レイヤー名だけ（中の「読み込み中」などの状態の文字と ⓘ の説明は入れない）
      const name = label.querySelector('.layer-name');
      if (name) return [...name.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      return label.textContent.split('ⓘ')[0];
    }
    return el.getAttribute('aria-label') && !el.textContent.trim() ? el.getAttribute('aria-label') : el.textContent;
  }

  // 数えるのは利用者が実際に押したものだけ（「見たいもの」がまとめて切り替えたレイヤーなど、プログラムの操作は数えない）
  let lastTrustedTarget = null;
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    lastTrustedTarget = event.target;
    const el = event.target.closest && event.target.closest('button, a, summary, [role="button"]');
    if (!el) return;
    add(keyOf(el), labelOf(el));
  }, true);
  // チェック・日付・選択は「変えたとき」に数える（ラベルを押したときの二重数えを避ける）
  document.addEventListener('change', event => {
    if (!event.isTrusted) return;
    const el = event.target;
    if (!el || !el.matches || !el.matches('input, select')) return;
    // チェックボックスは、利用者が押したそのもの（か、それを包むラベル）の変化だけ数える。
    // 「見たいもの」のボタンが中で el.click() したレイヤーの変化も Chrome では isTrusted になるため
    if (el.type === 'checkbox' || el.type === 'radio') {
      const t = lastTrustedTarget;
      if (!t || !(t === el || (t.closest && t.closest('label') === el.closest('label') && el.closest('label')))) return;
    }
    const key = keyOf(el) || (el.name ? 'input:' + el.name : '');
    if (!key) return;
    add(el.type === 'checkbox' ? `${key}:${el.checked ? 'on' : 'off'}` : key, labelOf(el));
  }, true);

  // 地図の吹き出しを開いた回数（種類ごと＝見出しの「：」「（」より前）。map は app.js の変数
  (function hookPopups(tries) {
    let m = null;
    try { m = typeof map !== 'undefined' ? map : null; } catch (_) { m = null; } // eslint-disable-line no-undef
    if (!m || typeof m.on !== 'function') { if (tries < 40) setTimeout(() => hookPopups(tries + 1), 500); return; }
    m.on('popupopen', e => {
      const strong = e.popup && e.popup.getElement && e.popup.getElement()?.querySelector('.leaflet-popup-content strong');
      const kind = shortText(strong ? strong.textContent : '', 60).split(/[：（(]/)[0].trim().slice(0, 24);
      if (kind) add('popup:' + kind, kind);
    });
  })(0);

  function send() {
    if (!dirty) return;
    dirty = false;
    const body = JSON.stringify({ viewId, visitorId, content: CONTENT, device, counts, labels });
    if (debug) { window.__featureUsageSent = (window.__featureUsageSent || 0) + 1; window.__featureUsageLastBody = body; return; }
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    } catch (_) { /* 下の fetch で送る */ }
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => { dirty = true; });
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send(); });
  addEventListener('pagehide', send);
})();
