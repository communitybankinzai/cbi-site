/* 会議メモ：議題ページの各議題の下に、その場で結果を入力する欄を出す。
 *   - 合言葉つきのリンク（#k=…）で開いた人にだけ欄が出る。合言葉は端末に覚える。
 *   - 入力は「種類＋一言」を積み上げる形（同時に書いても消し合わない）。
 *   - 5秒ごとに読み直して、ほかの人の入力を出す。
 * 設定は window.MEETING_NOTES = { base, anon, meeting, sections:[{id,label}] }。
 * 保存先は CiDAO のデータベース（関数 meeting_notes_list / _add / _delete）。 */
(function () {
  'use strict';
  var CFG = window.MEETING_NOTES;
  if (!CFG || !CFG.base || !CFG.anon || !CFG.meeting) return;

  var KINDS = [
    { id: 'decision', label: '決定', hint: '決まったことを一言で' },
    { id: 'todo', label: '宿題', hint: 'だれが・いつまでに・何を' },
    { id: 'carry', label: '持ち越し', hint: '次回へ回すこと' },
    { id: 'memo', label: 'メモ', hint: '出た意見・補足' }
  ];
  var LS = function (k) { return 'mn_' + CFG.meeting + '_' + k; };
  function lsGet(k) { try { return localStorage.getItem(LS(k)) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { v ? localStorage.setItem(LS(k), v) : localStorage.removeItem(LS(k)); } catch (e) {} }

  // 合言葉：リンクの #k=… を優先し、端末に覚える
  var m = (location.hash || '').match(/[#&]k=([A-Za-z0-9_-]{6,64})/);
  if (m) lsSet('key', m[1]);
  var KEY = lsGet('key');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var css = document.createElement('style');
  css.textContent = [
    '.mn-bar{position:sticky;top:0;z-index:5;background:#1f3a6e;color:#fff;padding:7px 10px;margin:0 -16px 10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13px}',
    '.mn-bar input{font-size:16px;padding:4px 8px;border:0;border-radius:6px;width:9em}',
    '.mn-bar .st{margin-left:auto;font-size:12px;opacity:.9}',
    '.mn-bar .st.bad{background:#c0392b;border-radius:999px;padding:1px 10px;opacity:1}',
    '.mn-box{border:2px solid #1f3a6e;border-radius:10px;padding:10px 12px;margin:14px 0 6px;background:#fbfcff}',
    '.mn-box .ttl{font-weight:700;color:#1f3a6e;font-size:14px;margin-bottom:6px}',
    '.mn-list{list-style:none;margin:0 0 8px;padding:0}',
    '.mn-list li{border-bottom:1px dashed #d8dee9;padding:6px 0;font-size:14.5px;display:flex;gap:8px;align-items:flex-start}',
    '.mn-list .txt{flex:1;white-space:pre-wrap}',
    '.mn-list .meta{display:block;font-size:11.5px;color:#4a5663}',
    '.mn-list .del{border:0;background:none;color:#4a5663;font-size:12px;text-decoration:underline;cursor:pointer;padding:2px 0;white-space:nowrap}',
    '.mn-empty{font-size:13px;color:#4a5663;margin:0 0 8px}',
    '.mn-k{display:inline-block;font-size:11.5px;font-weight:700;border-radius:999px;padding:1px 9px;color:#fff;white-space:nowrap;margin-top:2px}',
    '.mn-k.decision{background:#2d7a46}.mn-k.todo{background:#b8650a}.mn-k.carry{background:#6a5a9a}.mn-k.memo{background:#5a6673}',
    '.mn-kinds{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}',
    '.mn-kinds button{font-size:14px;border:1.5px solid #1f3a6e;background:#fff;color:#1f3a6e;border-radius:999px;padding:5px 14px;cursor:pointer}',
    '.mn-kinds button[aria-pressed="true"]{background:#1f3a6e;color:#fff;font-weight:700}',
    '.mn-row{display:flex;gap:6px;align-items:flex-end}',
    '.mn-row textarea{flex:1;font:inherit;font-size:16px;border:1px solid #9aa7b8;border-radius:8px;padding:7px 9px;min-height:44px;resize:vertical}',
    '.mn-row .send{font-size:15px;font-weight:700;border:0;background:#1f3a6e;color:#fff;border-radius:8px;padding:10px 16px;cursor:pointer;white-space:nowrap}',
    '.mn-row .send[disabled]{opacity:.5}',
    '.mn-err{color:#c0392b;font-size:13px;margin-top:4px}',
    '@media print{.mn-bar,.mn-kinds,.mn-row,.mn-list .del,.mn-err{display:none!important}.mn-box{border-width:1px;break-inside:avoid}}'
  ].join('\n');
  document.head.appendChild(css);

  var wrap = document.querySelector('.wrap') || document.body;

  // 合言葉がない人：資料はそのまま。入口の小さなボタンだけ足す
  if (!KEY) {
    var nav = document.querySelector('.nav');
    if (nav) {
      var b = el('button', 'btn', '会議の記録を入力する');
      b.type = 'button';
      b.addEventListener('click', function () {
        var k = (window.prompt('合言葉を入力してください（運営メンバーに配ったリンクの末尾）') || '').trim();
        if (/^[A-Za-z0-9_-]{6,64}$/.test(k)) { lsSet('key', k); location.reload(); }
      });
      nav.appendChild(b);
    }
    return;
  }

  function rpc(fn, body) {
    body.p_meeting = CFG.meeting; body.p_key = KEY;
    return fetch(CFG.base + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: CFG.anon, Authorization: 'Bearer ' + CFG.anon, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  // 上の帯：名前と、つながり具合
  var bar = el('div', 'mn-bar');
  bar.appendChild(el('span', null, '会議の記録　名前'));
  var nameIn = el('input'); nameIn.type = 'text'; nameIn.maxLength = 30; nameIn.placeholder = '（任意）';
  nameIn.setAttribute('aria-label', '入力する人の名前');
  nameIn.value = lsGet('name');
  nameIn.addEventListener('input', function () { lsSet('name', nameIn.value.trim()); });
  bar.appendChild(nameIn);
  var st = el('span', 'st', '読み込み中…');
  bar.appendChild(st);
  wrap.insertBefore(bar, wrap.firstChild);

  var boxes = {};   // agenda -> { list, empty }
  var notes = [];
  var lastSig = '';

  function buildBox(sec) {
    var box = el('div', 'mn-box');
    box.appendChild(el('div', 'ttl', '会議の記録：' + sec.label));
    var empty = el('p', 'mn-empty', 'まだ入力はありません。');
    var list = el('ul', 'mn-list');
    box.appendChild(empty); box.appendChild(list);

    var kind = 'decision';
    var kinds = el('div', 'mn-kinds');
    var ta = el('textarea');
    ta.maxLength = 600; ta.rows = 2;
    ta.setAttribute('aria-label', sec.label + ' の記録');
    ta.value = lsGet('draft_' + sec.id);
    ta.addEventListener('input', function () { lsSet('draft_' + sec.id, ta.value); });
    KINDS.forEach(function (k) {
      var kb = el('button', null, k.label); kb.type = 'button';
      kb.setAttribute('aria-pressed', k.id === kind ? 'true' : 'false');
      kb.addEventListener('click', function () {
        kind = k.id; ta.placeholder = k.hint;
        Array.prototype.forEach.call(kinds.children, function (c) { c.setAttribute('aria-pressed', c === kb ? 'true' : 'false'); });
        ta.focus();
      });
      kinds.appendChild(kb);
    });
    ta.placeholder = KINDS[0].hint;
    box.appendChild(kinds);

    var row = el('div', 'mn-row');
    var send = el('button', 'send', '送る'); send.type = 'button';
    var err = el('div', 'mn-err');
    row.appendChild(ta); row.appendChild(send);
    box.appendChild(row); box.appendChild(err);

    send.addEventListener('click', function () {
      var body = ta.value.trim();
      if (!body) { ta.focus(); return; }
      send.disabled = true; err.textContent = '';
      rpc('meeting_notes_add', { p_agenda: sec.id, p_kind: kind, p_body: body, p_author: nameIn.value.trim() || null })
        .then(function () { ta.value = ''; lsSet('draft_' + sec.id, ''); return load(); })
        .catch(function (e) { err.textContent = '送れませんでした。文はそのまま残っています。もう一度「送る」を押してください。（' + e.message + '）'; })
        .then(function () { send.disabled = false; });
    });

    boxes[sec.id] = { list: list, empty: empty };
    return box;
  }

  (CFG.sections || []).forEach(function (sec) {
    var box = buildBox(sec);
    var before = sec.before ? document.getElementById(sec.before) : null;
    if (!before) {
      var h = document.getElementById(sec.id);
      var n = h ? h.nextElementSibling : null;
      while (n && !(n.matches && n.matches('h2.sec'))) n = n.nextElementSibling;
      before = n;
    }
    if (before && before.parentNode) before.parentNode.insertBefore(box, before);
    else wrap.appendChild(box);
  });

  function hhmm(iso) {
    var d = new Date(iso);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function kindLabel(id) { for (var i = 0; i < KINDS.length; i++) if (KINDS[i].id === id) return KINDS[i].label; return id; }

  function render() {
    var sig = notes.map(function (n) { return n.id + (n.deleted ? 'x' : ''); }).join(',');
    if (sig === lastSig) return;
    lastSig = sig;
    Object.keys(boxes).forEach(function (a) {
      var b = boxes[a];
      while (b.list.firstChild) b.list.removeChild(b.list.firstChild);
      var mine = notes.filter(function (n) { return n.agenda === a && !n.deleted; });
      b.empty.style.display = mine.length ? 'none' : '';
      mine.forEach(function (n) {
        var li = el('li');
        li.appendChild(el('span', 'mn-k ' + n.kind, kindLabel(n.kind)));
        var t = el('span', 'txt', n.body);
        t.appendChild(el('span', 'meta', (n.author ? n.author + '　' : '') + hhmm(n.created_at)));
        li.appendChild(t);
        var del = el('button', 'del', '取り消す'); del.type = 'button';
        del.addEventListener('click', function () {
          if (!window.confirm('この記録を取り消しますか？\n\n' + n.body)) return;
          rpc('meeting_notes_delete', { p_id: n.id }).then(load).catch(function (e) { window.alert('取り消せませんでした（' + e.message + '）'); });
        });
        li.appendChild(del);
        b.list.appendChild(li);
      });
    });
  }

  var loading = false;
  function load() {
    if (loading) return Promise.resolve();
    loading = true;
    return rpc('meeting_notes_list', {}).then(function (rows) {
      notes = rows || [];
      render();
      var d = new Date();
      st.className = 'st';
      st.textContent = '全 ' + notes.filter(function (n) { return !n.deleted; }).length + ' 件・' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2) + ' 更新';
    }).catch(function (e) {
      st.className = 'st bad';
      if (e.status === 403) {
        st.textContent = '合言葉が違います';
        lsSet('key', '');
      } else {
        st.textContent = 'つながっていません（入力は残ります）';
      }
    }).then(function () { loading = false; });
  }

  load();
  setInterval(function () { if (!document.hidden) load(); }, 5000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
})();
