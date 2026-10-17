/* CBI Vercel 使用量タイムライン（共通部品）
 *
 * CBI サイトの資料（admin/proposals）と、Jarvis の定時報告の両方で使う。
 * 外部ライブラリ・インライン style・eval を使わない（Jarvis の CSP は script/style とも 'self' のみ）。
 * 値はすべて textContent と属性で入れる（HTML として解釈しない）。色・文字の大きさは vercel-timeline.css が決める。
 *
 * 使い方:
 *   CbiVercelTimeline.renderTimeline(要素, timeline, { theme: 'light' | 'dark' })   時系列グラフ（項目ごとのレーン）
 *   CbiVercelTimeline.renderUsage(要素, timeline, { theme })                         いまの使用率の棒グラフ
 *   CbiVercelTimeline.renderMailList(要素, timeline, { order: 'asc' | 'desc', limit: 件数 })   警告メールの時系列の表（limit は省略可）
 *
 * データの形（timeline）。作るのは CBI の scripts/vercel_monitor.py（状態ファイルの "timeline"）:
 * {
 *   "asOf":  "2026-10-18T06:30+09:00",
 *   "start": "2026-08-24", "end": "2026-11-06",                      日付は日本時間
 *   "lanes": [{ "id": "cpu", "name": "Fluid Active CPU", "short": "CPU", "limit": "無料枠 4時間",
 *               "events": [{ "t": "2026-08-26T07:03+09:00", "pct": 75, "predicted": false }] }],
 *   "markers": [{ "t": "2026-10-18T06:30+09:00", "label": "今日 10/18", "kind": "now" },
 *                { "t": "2026-11-03T12:00+09:00", "label": "11/3 武蔵屋イベント", "kind": "event" }],
 *   "usage": { "asOf": "2026-10-18T05:55+09:00", "window": "直近30日（9/17〜10/17）", "stale": false,
 *              "bars": [{ "label": "CPU（4時間）", "percent": 273 }] }
 * }
 * 仕様を変えるときは、CBI サイトと Jarvis の static/ の両方の複製を同じ内容にそろえること（同じ内容かは、テストで確かめる）。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CbiVercelTimeline = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 86400000;
  const JST = 9 * 3600000;
  const MAX_LANES = 8, MAX_EVENTS = 60, MAX_MARKERS = 6, MAX_BARS = 10;
  const p2 = (n) => (n < 10 ? '0' : '') + n;

  // ---- 時刻（すべて日本時間で表示。端末の時間帯に左右されない） ----
  function toMs(s) { const t = Date.parse(s); return Number.isFinite(t) ? t : null; }
  function dateMs(s) { return toMs(String(s) + 'T00:00:00+09:00'); }
  function jst(ms) {
    const d = new Date(ms + JST);
    return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: p2(d.getUTCHours()), mm: p2(d.getUTCMinutes()) };
  }
  function md(ms) { const j = jst(ms); return j.m + '/' + j.d; }
  function mdhm(ms) { const j = jst(ms); return j.m + '/' + j.d + ' ' + j.hh + ':' + j.mm; }
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // ---- 入力の整え（壊れたデータでも描画を止めない。数字と文字だけ受け付ける） ----
  function clean(data) {
    const d = data && typeof data === 'object' ? data : {};
    const lanes = [];
    (Array.isArray(d.lanes) ? d.lanes : []).slice(0, MAX_LANES).forEach((ln, i) => {
      if (!ln || typeof ln !== 'object') return;
      const events = [];
      (Array.isArray(ln.events) ? ln.events : []).slice(0, MAX_EVENTS).forEach((ev) => {
        const t = ev && toMs(ev.t), pct = ev && num(ev.pct);
        if (t !== null && pct !== null) events.push({ t, pct, predicted: !!ev.predicted });
      });
      events.sort((a, b) => a.t - b.t);
      lanes.push({ id: str(ln.id, 40) || 'lane' + i, name: str(ln.name, 40), short: str(ln.short, 16) || str(ln.name, 16),
                   limit: str(ln.limit, 40), events });
    });
    const markers = [];
    (Array.isArray(d.markers) ? d.markers : []).slice(0, MAX_MARKERS).forEach((mk) => {
      const t = mk && toMs(mk.t);
      if (t !== null) markers.push({ t, label: str(mk.label, 30), kind: mk.kind === 'now' ? 'now' : 'event' });
    });
    let start = dateMs(d.start), end = dateMs(d.end);
    const all = lanes.flatMap((l) => l.events.map((e) => e.t)).concat(markers.map((m) => m.t));
    if (start === null || end === null || end <= start) {
      if (!all.length) { start = null; end = null; }
      else { start = Math.min.apply(null, all) - 2 * DAY; end = Math.max.apply(null, all) + 3 * DAY; }
    }
    const u = d.usage && typeof d.usage === 'object' ? d.usage : null;
    const bars = [];
    if (u) (Array.isArray(u.bars) ? u.bars : []).slice(0, MAX_BARS).forEach((b) => {
      const p = b && num(b.percent);
      if (p !== null) bars.push({ label: str(b.label, 40), percent: p });
    });
    return { asOf: toMs(d.asOf), start, end, lanes, markers,
             usage: u && bars.length ? { asOf: toMs(u.asOf), window: str(u.window, 60), stale: !!u.stale, bars } : null };
  }

  // 文字の幅の見積もり（全角＝1文字ぶん、半角＝約0.58文字ぶん）。重なりの判定だけに使う
  function textWidth(s, size) {
    let w = 0;
    for (const ch of String(s)) w += ch.charCodeAt(0) > 255 ? size : size * 0.58;
    return w;
  }

  // ---- 位置の計算（画面に出さない部分。単体で検証できる） ----
  function buildModel(data, opts) {
    const c = clean(data);
    const o = opts || {};
    const compact = !!o.compact;
    // 狭い画面（スマホ）では、項目名を各行の上に置き、横幅をまるごと時間軸に使う
    const W = compact ? 420 : 1000;
    const L = compact ? 16 : 232, R = compact ? 16 : 40, TOP = compact ? 110 : 100;
    const LANE_H = compact ? 124 : 104, BOTTOM = compact ? 40 : 46;
    const dotY = compact ? 78 : LANE_H / 2;                 // 行の上端から点までの高さ
    const minGap = compact ? 54 : 48;                       // 日付の文字が重ならない最小の間隔（px）
    const H = TOP + Math.max(c.lanes.length, 1) * LANE_H + BOTTOM;
    const model = { W, H, L, R, TOP, LANE_H, compact, start: c.start, end: c.end, ticks: [], lanes: [], markers: [], legend: { x: compact ? 14 : L, y: compact ? 20 : 24 },
                    empty: c.start === null };
    if (model.empty) return model;
    const span = c.end - c.start;
    const x = (t) => L + ((t - c.start) / span) * (W - L - R);
    model.x = x;
    // 週ごとの目盛り（開始日から7日おき）
    for (let t = c.start, ti = 0; t <= c.end; t += 7 * DAY, ti++) {
      if (compact && ti % 2) continue;                      // 狭い画面は日付が重なるので2週おき
      model.ticks.push({ x: x(t), label: md(t) });
    }
    c.lanes.forEach((ln, i) => {
      const y = TOP + i * LANE_H + dotY;
      let lastAbove = -1e9, lastBelow = -1e9;
      const events = ln.events.map((ev) => {
        const ex = x(ev.t);
        let side = 'above';
        if (ex - lastAbove >= minGap) lastAbove = ex;
        else if (ex - lastBelow >= minGap) { side = 'below'; lastBelow = ex; }
        else lastAbove = ex;                                // どちらも詰まっているときは上に置く（重なりは許す）
        return { x: ex, y, t: ev.t, pct: ev.pct, predicted: ev.predicted, side,
                 labelY: side === 'above' ? y - 18 : y + 32, label: md(ev.t) + (ev.predicted && !compact ? 'ごろ' : ''),
                 title: ln.name + ' ' + ev.pct + '%の通知' + (ev.predicted ? '（予測）' : '') + ' ' + mdhm(ev.t) };
      });
      const links = [];
      for (let k = 1; k < events.length; k++) {
        const gap = (events[k].t - events[k - 1].t) / DAY;
        if (gap < 3) continue;                              // 近すぎる2点は結ばない
        links.push({ x1: events[k - 1].x, x2: events[k].x, y, gapLabel: Math.round(gap) + '日', predicted: events[k].predicted,
                     showGap: !compact || (events[k].x - events[k - 1].x) >= 46 });   // 狭い画面では、短い線の「N日」を省く（日付の文字と重なるため）
      }
      model.lanes.push({ id: ln.id, name: ln.name, short: ln.short, limit: ln.limit, y, top: TOP + i * LANE_H, ty: TOP + i * LANE_H + 28, events, links });
    });
    // 縦線（今日・イベント）。文字の幅を見積もって、重なるときだけ上の段へ送る（段は2つまで）
    const fontPx = compact ? 15 : 14;
    const rowsEnd = [-1e9, -1e9];
    c.markers.slice().sort((a, b) => a.t - b.t).forEach((mk) => {
      const mx = x(mk.t);
      const tw = textWidth(mk.label, fontPx);
      const nearRight = mx + tw / 2 > W - R;                 // 右端からはみ出すときは、線の左へ寄せる
      const dx = nearRight ? 6 : 0;
      const x0 = (nearRight ? mx + dx - tw : mx - tw / 2), x1 = x0 + tw;
      let row = rowsEnd.findIndex((end) => x0 >= end + 10);
      if (row < 0) row = rowsEnd.length - 1;
      rowsEnd[row] = x1;
      model.markers.push({ x: mx, kind: mk.kind, label: mk.label, y1: TOP - 28, y2: TOP + c.lanes.length * LANE_H,
                           labelY: TOP - 36 - row * (fontPx + 6), anchor: nearRight ? 'end' : 'middle', dx });
    });
    return model;
  }

  // ---- 描画の道具 ----
  function el(tag, attrs, text, ns) {
    const n = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, String(attrs[k])));
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  const svgEl = (tag, attrs, text) => el(tag, attrs, text, true);
  function prepare(host, opts) {
    host.textContent = '';
    host.classList.add('cvt');
    host.setAttribute('data-theme', (opts && opts.theme) === 'dark' ? 'dark' : 'light');
  }
  function isCompact(host, opts) {
    if (opts && typeof opts.compact === 'boolean') return opts.compact;
    const w = host.clientWidth || (host.parentElement && host.parentElement.clientWidth) || 1000;
    return w < 600;
  }

  // ---- 時系列グラフ ----
  function renderTimeline(host, data, opts) {
    prepare(host, opts);
    const model = buildModel(data, { compact: isCompact(host, opts) });
    host.classList.toggle('cvt-compact', model.compact);
    if (model.empty) { host.appendChild(el('p', { class: 'cvt-empty' }, '表示できる通知がありません。')); return host; }
    const svg = svgEl('svg', { viewBox: '0 0 ' + model.W + ' ' + model.H, role: 'img', class: 'cvt-svg',
                               'aria-label': '使用量の警告メールの時系列。項目ごとに通知の日を並べ、前回から14日後の予測を点線で示す' });
    const add = (tag, attrs, text) => { const n = svgEl(tag, attrs, text); svg.appendChild(n); return n; };
    const bottom = model.TOP + Math.max(model.lanes.length, 1) * model.LANE_H;
    model.ticks.forEach((tk) => {
      add('line', { x1: tk.x, y1: model.TOP - 14, x2: tk.x, y2: bottom, class: 'cvt-grid' });
      add('text', { x: tk.x, y: bottom + 28, class: 'cvt-tick', 'text-anchor': 'middle' }, tk.label);
    });
    // 凡例
    const lg = model.legend;
    [['cvt-dot cvt-full', '100%の通知'], ['cvt-dot cvt-part', '75%の通知'],
     ['cvt-dot cvt-pred', model.compact ? '予測（14日後）' : '予測（前回から14日後）']].reduce((cx, it) => {
      add('circle', { cx: cx, cy: lg.y, r: 8, class: it[0] });
      add('text', { x: cx + 16, y: lg.y + 5, class: 'cvt-leg' }, it[1]);
      return model.compact ? cx + 24 + textWidth(it[1], 14) + 16 : cx + 40 + it[1].length * 15 + 14;
    }, lg.x);
    // レーン
    model.lanes.forEach((ln) => {
      add('line', { x1: model.L - 12, y1: ln.top, x2: model.W - model.R, y2: ln.top, class: 'cvt-lane' });
      // 日本語の短い名前を主役に、無料枠、英語の正式名（Vercel の画面の名前）の順に小さく添える
      const main = ln.short || ln.name;
      if (model.compact) {
        add('text', { x: 8, y: ln.ty, class: 'cvt-lane-name' }, main);
        if (ln.limit) add('text', { x: 8 + textWidth(main, 16) + 12, y: ln.ty, class: 'cvt-lane-limit' }, ln.limit);
        return;
      }
      add('text', { x: model.L - 22, y: ln.y - 6, class: 'cvt-lane-name', 'text-anchor': 'end' }, main);
      if (ln.limit) add('text', { x: model.L - 22, y: ln.y + 14, class: 'cvt-lane-limit', 'text-anchor': 'end' }, ln.limit);
      if (!model.compact && ln.name && ln.name !== main) add('text', { x: model.L - 22, y: ln.y + 31, class: 'cvt-lane-en', 'text-anchor': 'end' }, ln.name);
    });
    add('line', { x1: model.L - 12, y1: bottom, x2: model.W - model.R, y2: bottom, class: 'cvt-lane' });
    // 縦線
    model.markers.forEach((mk) => {
      add('line', { x1: mk.x, y1: mk.y1, x2: mk.x, y2: mk.y2, class: mk.kind === 'now' ? 'cvt-now' : 'cvt-evt' });
      add('text', { x: mk.x + mk.dx, y: mk.labelY, class: 'cvt-marker-text', 'text-anchor': mk.anchor }, mk.label);
    });
    // 線 → 点 → 日付（後から描くものが上に重なる）
    model.lanes.forEach((ln) => {
      ln.links.forEach((lk) => {
        add('line', { x1: lk.x1, y1: lk.y, x2: lk.x2, y2: lk.y, class: lk.predicted ? 'cvt-link cvt-link-pred' : 'cvt-link' });
        if (lk.showGap) add('text', { x: (lk.x1 + lk.x2) / 2, y: lk.y + 24, class: 'cvt-gap', 'text-anchor': 'middle' }, lk.gapLabel);
      });
    });
    model.lanes.forEach((ln) => {
      ln.events.forEach((ev) => {
        const g = add('g', {});
        g.appendChild(svgEl('title', {}, ev.title));
        g.appendChild(svgEl('circle', { cx: ev.x, cy: ev.y, r: 8, class: 'cvt-dot ' + (ev.predicted ? 'cvt-pred' : (ev.pct >= 100 ? 'cvt-full' : 'cvt-part')) }));
        add('text', { x: ev.x, y: ev.labelY, class: ev.predicted ? 'cvt-dl cvt-dl-pred' : 'cvt-dl', 'text-anchor': 'middle' }, ev.label);
      });
    });
    host.appendChild(svg);
    return host;
  }

  // ---- いまの使用率（棒グラフ） ----
  function renderUsage(host, data, opts) {
    prepare(host, opts);
    const c = clean(data);
    if (!c.usage) { host.appendChild(el('p', { class: 'cvt-empty' }, '使用率の実測がありません。')); return host; }
    const compact = isCompact(host, opts);
    host.classList.toggle('cvt-compact', compact);
    const W = compact ? 420 : 1000, rowH = compact ? 62 : 46, LB = compact ? 8 : 270, RB = compact ? 8 : 300;
    const bars = c.usage.bars, H = bars.length * rowH + 14;
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', class: 'cvt-svg', 'aria-label': 'いまの使用率。上限に対する割合' });
    bars.forEach((b, i) => {
      const y = 8 + i * rowH, tw = W - LB - RB;
      const w = Math.max(tw * Math.min(Math.max(b.percent, 0), 100) / 100, 1);
      const cls = c.usage.stale ? 'cvt-bar-stale' : (b.percent >= 80 ? 'cvt-bar-warn' : 'cvt-bar-ok');
      const by = compact ? y + 30 : y + 6, bh = compact ? 16 : rowH - 18;
      if (compact) svg.appendChild(svgEl('text', { x: LB, y: y + 20, class: 'cvt-bar-label' }, b.label));
      else svg.appendChild(svgEl('text', { x: LB - 12, y: y + rowH / 2 + 5, class: 'cvt-bar-label', 'text-anchor': 'end' }, b.label));
      svg.appendChild(svgEl('rect', { x: LB, y: by, width: tw, height: bh, rx: 4, class: 'cvt-track' }));
      svg.appendChild(svgEl('rect', { x: LB, y: by, width: w, height: bh, rx: 4, class: cls }));
      let v = Math.round(b.percent) + '%';
      if (b.percent > 100) v += '（上限の約' + (Math.round(b.percent / 10) / 10).toFixed(1) + '倍）';
      if (c.usage.stale) v += '（古い数字）';
      if (compact) svg.appendChild(svgEl('text', { x: W - 8, y: y + 20, class: 'cvt-bar-value ' + cls + '-text', 'text-anchor': 'end' }, v));
      else svg.appendChild(svgEl('text', { x: LB + tw + 12, y: y + rowH / 2 + 5, class: 'cvt-bar-value ' + cls + '-text' }, v));
    });
    host.appendChild(svg);
    const note = [c.usage.window, c.usage.asOf ? mdhm(c.usage.asOf) + ' 時点の実測（画面の数字を書き写した手入力）' : ''].filter(Boolean).join('　');
    if (note) host.appendChild(el('p', { class: 'cvt-note' }, note));
    host.appendChild(el('p', { class: 'cvt-note' }, '赤＝80%以上。棒は100%で止まり、数字は実際の率。'));
    return host;
  }

  // ---- 警告メールの時系列の表 ----
  function kindOf(prev, ev) {
    if (ev.predicted) return '予測（再送の予定日）';
    if (!prev) return ev.pct >= 100 ? '最初の通知（上限に到達）' : '最初の通知（' + ev.pct + '%に到達）';
    if (ev.pct > prev.pct) return ev.pct >= 100 ? '上限（100%）に到達' : ev.pct + '%に到達';
    const gap = (ev.t - prev.t) / DAY;
    return gap >= 13 && gap <= 15 ? '再通知（14日後）' : '再通知';
  }
  function mailRows(data) {
    const c = clean(data), rows = [];
    c.lanes.forEach((ln) => ln.events.forEach((ev, i) => {
      const prev = i > 0 ? ln.events[i - 1] : null;
      rows.push({ t: ev.t, when: mdhm(ev.t), lane: ln.short || ln.name, pct: ev.pct, predicted: ev.predicted,
                  kind: kindOf(prev, ev), gap: prev ? Math.round((ev.t - prev.t) / DAY) + '日' : '—' });
    }));
    return rows.sort((a, b) => a.t - b.t);
  }
  function renderMailList(host, data, opts) {
    prepare(host, opts);
    let rows = mailRows(data);
    if (!rows.length) { host.appendChild(el('p', { class: 'cvt-empty' }, '警告メールはありません。')); return host; }
    if (opts && opts.order === 'desc') rows = rows.reverse();
    if (opts && opts.limit > 0) rows = rows.slice(0, opts.limit);   // 先頭から数える（新しい順なら最新から）
    const table = el('table', { class: 'cvt-table' });
    const head = el('tr');
    ['受信日時（日本時間）', '項目', '率', 'できごと', '前回から'].forEach((h) => head.appendChild(el('th', { scope: 'col' }, h)));
    table.appendChild(el('thead')).appendChild(head);
    const body = el('tbody');
    rows.forEach((r) => {
      const tr = el('tr', { class: r.predicted ? 'cvt-row-pred' : '' });
      tr.appendChild(el('td', { class: 'cvt-td-when' }, r.when + (r.predicted ? 'ごろ' : '')));
      tr.appendChild(el('td', {}, r.lane));
      const tdPct = el('td');
      tdPct.appendChild(el('span', { class: 'cvt-badge ' + (r.predicted ? 'cvt-badge-pred' : (r.pct >= 100 ? 'cvt-badge-full' : 'cvt-badge-part')) }, r.pct + '%'));
      tr.appendChild(tdPct);
      tr.appendChild(el('td', {}, r.kind));
      tr.appendChild(el('td', { class: 'cvt-td-gap' }, r.gap));
      body.appendChild(tr);
    });
    table.appendChild(body);
    host.appendChild(table);
    return host;
  }

  // 幅が変わって、狭い画面⇔広い画面の境をまたいだら、描き直す（スマホの縦横の切り替えなど）
  const watched = [];
  function watch(host, fn) {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    watched.push({ host, fn, compact: host.classList.contains('cvt-compact') });
    if (watched.length === 1) {
      let timer = null;
      window.addEventListener('resize', () => {
        clearTimeout(timer);
        timer = setTimeout(() => watched.forEach((w) => {
          const now = (w.host.clientWidth || 1000) < 600;
          if (now !== w.compact) { w.compact = now; w.fn(); }
        }), 150);
      });
    }
  }

  function renderAll(root, data, opts) {
    const o = opts || {};
    const q = (name) => root.querySelector('[data-cvt="' + name + '"]');
    const parts = [['timeline', renderTimeline], ['usage', renderUsage], ['mails', renderMailList]];
    parts.forEach((p) => {
      const host = q(p[0]);
      if (!host) return;
      const draw = () => p[1](host, data, o);
      draw();
      if (p[0] !== 'mails') watch(host, draw);
    });
  }

  return { clean, buildModel, mailRows, kindOf, renderTimeline, renderUsage, renderMailList, renderAll, md, mdhm };
});
