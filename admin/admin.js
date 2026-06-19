/* =========================================================
   CBI 管理画面 — admin.js
   通信先: GAS WebApp（cbi-admin-gas/Code.gs）
   機能: 認証 / アイデアCRUD / コメント / 未読バッジ / ユーザー識別
   ========================================================= */

// GAS WebApp URL（2026-06-19 v1: 初回デプロイ）
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz0UJbV1ZqGEThNqj_LSTHe82ws6lni5EjYXZSDYuN43NTwo1ugrdjmrKWZ-XBf9yV3/exec';

const STORAGE_KEYS = {
  PW:        'cbi_admin_pw',
  ME:        'cbi_admin_me',
  LAST_SEEN: 'cbi_admin_last_seen',
};

const UNREAD_POLL_MS = 30000;

(() => {
  'use strict';

  const state = {
    password: '',
    me: '',
    ideas: [],
    commentsByIdea: {},
    openIdeas: new Set(),
    editingId: null,
    lastSeen: '1970-01-01T00:00:00Z',
    unreadEvents: [],
    pollTimer: null,
    agents: [],
    agentPhaseLabels: {},
    currentAgentId: '',
    agentsLoaded: false,
    changelogLoaded: false,
    worklog: null,
    worklogLoaded: false,
  };

  const $ = id => document.getElementById(id);
  const screenLogin = $('screen-login');
  const screenAdmin = $('screen-admin');

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindLogin();
    bindAdmin();
    const pw = localStorage.getItem(STORAGE_KEYS.PW);
    if (pw) {
      state.password = pw;
      enterAdmin();
    }
  }

  // =========================================================
  // ログイン
  // =========================================================
  function bindLogin() {
    $('login-form').addEventListener('submit', e => {
      e.preventDefault();
      const pw = $('login-password').value.trim();
      const remember = $('remember-me').checked;
      if (!pw) return;
      tryLogin(pw, remember);
    });
  }

  async function tryLogin(pw, remember) {
    const btn = $('login-btn');
    const errEl = $('login-error');
    btn.disabled = true;
    btn.textContent = 'ログイン中…';
    errEl.hidden = true;

    if (!GAS_WEBAPP_URL) {
      if (pw === 'cbi20260604') {
        state.password = pw;
        if (remember) localStorage.setItem(STORAGE_KEYS.PW, pw);
        enterAdmin();
      } else {
        showLoginError('パスワードが違います（GAS未接続・ローカル照合）');
      }
      btn.disabled = false;
      btn.textContent = 'ログイン';
      return;
    }

    try {
      const r = await gasCall({ action: 'ping', password: pw });
      if (r && r.ok) {
        state.password = pw;
        if (remember) localStorage.setItem(STORAGE_KEYS.PW, pw);
        enterAdmin();
      } else {
        showLoginError(r && r.error === 'auth_failed' ? 'パスワードが違います' : ('エラー: ' + (r.error || 'unknown')));
      }
    } catch (err) {
      showLoginError('通信エラー: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'ログイン';
    }
  }

  function showLoginError(msg) {
    const el = $('login-error');
    el.textContent = msg;
    el.hidden = false;
  }

  // =========================================================
  // 画面切替
  // =========================================================
  function enterAdmin() {
    screenLogin.classList.remove('active');
    screenAdmin.classList.add('active');
    state.me = localStorage.getItem(STORAGE_KEYS.ME) || '';
    state.lastSeen = localStorage.getItem(STORAGE_KEYS.LAST_SEEN) || '1970-01-01T00:00:00Z';
    if (!state.me) {
      openMeModal();
    } else {
      $('me-name').textContent = state.me;
    }
    loadAll();
    startUnreadPolling();
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEYS.PW);
    state.password = '';
    state.ideas = [];
    state.commentsByIdea = {};
    state.openIdeas.clear();
    state.editingId = null;
    stopUnreadPolling();
    $('login-password').value = '';
    screenAdmin.classList.remove('active');
    screenLogin.classList.add('active');
  }

  // =========================================================
  // 管理画面イベント
  // =========================================================
  function bindAdmin() {
    $('btn-logout').addEventListener('click', logout);
    $('btn-refresh').addEventListener('click', loadAll);
    $('btn-export').addEventListener('click', exportIdeas);

    $('idea-form').addEventListener('submit', onSubmitForm);
    $('form-cancel').addEventListener('click', resetForm);

    $('idea-author').addEventListener('change', e => {
      const custom = $('idea-author-custom');
      custom.hidden = e.target.value !== '__custom__';
      if (e.target.value === '__custom__') custom.focus();
    });

    $('search-keyword').addEventListener('input', renderList);
    $('filter-category').addEventListener('change', renderList);
    $('filter-status').addEventListener('change', renderList);

    // ユーザー識別モーダル
    $('btn-change-me').addEventListener('click', openMeModal);
    document.querySelectorAll('.me-option').forEach(b => {
      b.addEventListener('click', () => setMe(b.dataset.me));
    });
    $('me-custom-ok').addEventListener('click', () => {
      const v = $('me-custom').value.trim();
      if (v) setMe(v);
    });
    $('me-custom').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); $('me-custom-ok').click(); }
    });

    // 未読パネル
    $('btn-unread').addEventListener('click', openUnreadPanel);
    $('unread-close').addEventListener('click', closeUnreadPanel);
    $('btn-mark-read').addEventListener('click', markAllRead);

    // モーダル背景クリックで閉じる
    document.querySelectorAll('.modal').forEach(m => {
      const backdrop = m.querySelector('.modal-backdrop');
      if (backdrop) backdrop.addEventListener('click', () => { m.hidden = true; });
    });
    // ESCキーで閉じる
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not([hidden])').forEach(m => { m.hidden = true; });
      }
    });

    // タブ切替
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.addEventListener('click', () => switchTab(b.dataset.tab));
    });
  }

  // =========================================================
  // タブ切替（アイデア / エージェント / 更新履歴）
  // =========================================================
  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ['ideas', 'agents', 'changelog'].forEach(t => {
      $('tab-' + t).hidden = (t !== name);
    });
    if (name === 'agents' && !state.agentsLoaded) loadAgents();
    if (name === 'changelog' && !state.changelogLoaded) loadChangelog();
  }

  // =========================================================
  // エージェント体制
  // =========================================================
  async function loadAgents() {
    try {
      const [resAg, resWl] = await Promise.all([
        fetch('agents.json', { cache: 'no-store' }),
        fetch('agents-worklog.json', { cache: 'no-store' }),
      ]);
      const data = await resAg.json();
      state.agents = data.agents || [];
      state.agentPhaseLabels = data.phaseLabels || {};
      $('agent-source').textContent = data.updatedAt ? ('更新: ' + data.updatedAt) : '';
      try {
        state.worklog = await resWl.json();
        state.worklogLoaded = true;
      } catch (_) {
        state.worklog = { agents: {} };
      }
      state.agentsLoaded = true;
      renderAgentTabs();
      if (state.agents.length) selectAgent(state.agents[0].id);
    } catch (err) {
      $('agent-detail').innerHTML = '<p class="empty">エージェント定義を読み込めませんでした（' + escape(err.message) + '）</p>';
    }
  }

  function renderAgentTabs() {
    const nav = $('agent-tabs');
    nav.innerHTML = '';
    state.agents.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'agent-tab' + (a.phase === 'active' ? ' is-active-phase' : '');
      btn.dataset.id = a.id;
      btn.innerHTML =
        '<span class="at-id">' + escape(a.id) + '</span>' +
        '<span class="at-name">' + escape(a.codename) + '</span>' +
        '<span class="at-role">' + escape(a.role) + '</span>';
      btn.addEventListener('click', () => selectAgent(a.id));
      nav.appendChild(btn);
    });
  }

  function selectAgent(id) {
    state.currentAgentId = id;
    document.querySelectorAll('.agent-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.id === id);
    });
    const a = state.agents.find(x => x.id === id);
    if (!a) return;
    const phaseLabel = state.agentPhaseLabels[a.phase] || a.phase;

    const dutiesHtml = (a.duties || []).map(d => '<li>' + escape(d) + '</li>').join('');
    const metricsHtml = (a.metrics || []).length
      ? '<div class="ad-section"><h4>評価指標</h4><ul class="ad-duties">' +
          a.metrics.map(m => '<li>' + escape(m) + '</li>').join('') + '</ul></div>'
      : '';
    const relHtml = (a.related || []).length
      ? '<div class="ad-section"><h4>関連エージェント</h4><div class="ad-related">' +
          a.related.map(r => {
            const t = state.agents.find(x => x.id === r);
            return '<span class="rel-chip">' + escape(r + (t ? ' ' + t.codename : '')) + '</span>';
          }).join('') + '</div></div>'
      : '';

    const wl = getWorklogFor(a.id);
    const actuals = wl.actuals || [];
    const plans = wl.plans || [];
    const totalHours = actuals.reduce((s, x) => s + (Number(x.hours) || 0), 0);
    const summaryHtml =
      '<div class="worklog-summary">' +
        '<span class="ws-chip">実績 <strong>' + actuals.length + '</strong> 件</span>' +
        '<span class="ws-chip">予定 <strong>' + plans.length + '</strong> 件</span>' +
        '<span class="ws-chip">累計工数 <strong>' + totalHours.toFixed(1) + '</strong> h</span>' +
      '</div>';

    const actualsHtml = '<div class="ad-section"><h4>実績（過去）</h4>' +
      (actuals.length
        ? '<div class="wl-list">' + actuals.map(renderWorklogActual).join('') + '</div>'
        : '<p class="wl-empty">まだ実績の記録はありません</p>') +
      '</div>';
    const plansHtml = '<div class="ad-section"><h4>予定（今後）</h4>' +
      (plans.length
        ? '<div class="wl-list">' + plans.map(renderWorklogPlan).join('') + '</div>'
        : '<p class="wl-empty">予定はまだ登録されていません</p>') +
      '</div>';

    $('agent-detail').innerHTML =
      '<div class="ad-actions-row">' +
        '<button type="button" class="btn btn-ghost btn-sm" id="btn-print-this">📄 このエージェントを提出用PDF</button>' +
        '<button type="button" class="btn btn-primary btn-sm" id="btn-print-all">📄 全エージェント一括PDF</button>' +
      '</div>' +
      '<div class="ad-head">' +
        '<h3>' + escape(a.id) + ' ' + escape(a.codename) + '</h3>' +
        '<span class="badge p-' + escape(a.phase) + '">' + escape(phaseLabel) + '</span>' +
      '</div>' +
      '<p class="ad-summary">' + escape(a.summary || '') + '</p>' +
      summaryHtml +
      '<dl class="ad-grid">' +
        '<div><dt>人間パートナー</dt><dd>' + escape(a.partner || '—') + '</dd></div>' +
        '<div><dt>想定モデル</dt><dd>' + escape(a.model || '—') + '</dd></div>' +
        '<div><dt>役割</dt><dd>' + escape(a.role || '—') + '</dd></div>' +
        '<div><dt>導入段階</dt><dd>' + escape(phaseLabel) + '</dd></div>' +
      '</dl>' +
      (dutiesHtml ? '<div class="ad-section"><h4>主要業務</h4><ul class="ad-duties">' + dutiesHtml + '</ul></div>' : '') +
      metricsHtml +
      actualsHtml +
      plansHtml +
      relHtml;

    const pThis = $('btn-print-this');
    const pAll  = $('btn-print-all');
    if (pThis) pThis.addEventListener('click', () => openPrintView([a.id]));
    if (pAll)  pAll.addEventListener('click', () => openPrintView(state.agents.map(x => x.id)));
  }

  // ---------- Worklog helpers ----------
  function getWorklogFor(agentId) {
    if (!state.worklog || !state.worklog.agents) return { actuals: [], plans: [] };
    return state.worklog.agents[agentId] || { actuals: [], plans: [] };
  }

  function renderWorklogActual(x) {
    const outputsHtml = (x.outputs && x.outputs.length)
      ? '<div class="wl-outputs">成果物: ' + x.outputs.map(o => '<code>' + escape(o) + '</code>').join(' ') + '</div>'
      : '';
    const approveHtml = x.partnerApproved
      ? '<span class="wl-approve">承認済</span>'
      : '<span class="wl-approve is-pending">承認待</span>';
    const hoursHtml = x.hours ? '<span class="wl-tag">' + Number(x.hours).toFixed(1) + 'h</span>' : '';
    return '<div class="wl-item is-actual">' +
      '<span class="wl-date">' + escape(x.date || '') + '</span>' +
      '<div class="wl-main">' +
        '<div class="wl-title">' + escape(x.title || '') + '</div>' +
        (x.note ? '<div class="wl-note">' + escape(x.note) + '</div>' : '') +
        outputsHtml +
      '</div>' +
      '<div class="wl-tags">' +
        '<span class="wl-tag c-' + escape(x.category || 'その他') + '">' + escape(x.category || 'その他') + '</span>' +
        hoursHtml +
        approveHtml +
      '</div>' +
    '</div>';
  }

  function renderWorklogPlan(x) {
    return '<div class="wl-item is-plan">' +
      '<span class="wl-date">〜' + escape(x.due || '') + '</span>' +
      '<div class="wl-main">' +
        '<div class="wl-title">' + escape(x.title || '') + '</div>' +
        (x.note ? '<div class="wl-note">' + escape(x.note) + '</div>' : '') +
      '</div>' +
      '<div class="wl-tags">' +
        '<span class="wl-tag c-' + escape(x.category || 'その他') + '">' + escape(x.category || 'その他') + '</span>' +
        (x.priority ? '<span class="wl-prio p-' + escape(x.priority) + '">優先度 ' + escape(x.priority) + '</span>' : '') +
      '</div>' +
    '</div>';
  }

  // =========================================================
  // 印刷ビュー（提出用PDF）
  // =========================================================
  function openPrintView(agentIds) {
    const view = $('print-view');
    if (!view) return;
    if (!state.printBound) {
      $('print-close').addEventListener('click', () => { view.hidden = true; });
      $('print-do').addEventListener('click', () => window.print());
      $('print-refresh').addEventListener('click', () => renderPrintPaper(state.lastPrintTargets || agentIds));
      state.printBound = true;
    }
    state.lastPrintTargets = agentIds;
    if (!$('print-from').value) $('print-from').value = '2026-04-01';
    if (!$('print-to').value)   $('print-to').value   = '2027-03-31';
    renderPrintPaper(agentIds);
    view.hidden = false;
    view.scrollTop = 0;
  }

  function renderPrintPaper(agentIds) {
    const from = $('print-from').value || '0000-01-01';
    const to   = $('print-to').value   || '9999-12-31';
    const inRange = d => (d || '') >= from && (d || '') <= to;

    const today = state.worklog && state.worklog.updatedAt ? state.worklog.updatedAt : '';
    const periodText = '期間：' + from + '　〜　' + to;

    let html =
      '<div class="pp-head">' +
        '<p class="pp-eyebrow">COMMUNITY BANK INZAI / 印西「あなたの出番」プロジェクト</p>' +
        '<h1 class="pp-title">AIエージェント 作業実績報告書</h1>' +
        '<p class="pp-period">' + escape(periodText) + '</p>' +
        '<div class="pp-meta">' +
          '<span>団体名: Community Bank INZAI（CBI）</span>' +
          '<span>登録番号: ０８－００１</span>' +
          '<span>代表者: 新井 則夫</span>' +
          (today ? '<span>データ更新: ' + escape(today) + '</span>' : '') +
        '</div>' +
      '</div>';

    agentIds.forEach(id => {
      const a = state.agents.find(x => x.id === id);
      if (!a) return;
      const wl = getWorklogFor(id);
      const actuals = (wl.actuals || []).filter(x => inRange(x.date));
      const plans   = (wl.plans   || []).filter(x => inRange(x.due));

      html += '<section class="pp-agent-block">' +
        '<div class="pp-agent-head">' +
          '<h2>' + escape(a.id + ' ' + a.codename) + '</h2>' +
          '<span class="pp-agent-role">' + escape(a.role || '') + '　／　人間パートナー: ' + escape(a.partner || '') + '</span>' +
        '</div>';

      html += '<div class="pp-section-title">作業実績（' + actuals.length + '件）</div>';
      if (actuals.length) {
        html += '<table class="pp-table"><thead><tr>' +
          '<th class="t-date">日付</th><th class="t-cat">区分</th><th>件名・内容</th><th class="t-hours">工数</th>' +
          '</tr></thead><tbody>' +
          actuals.map(x =>
            '<tr>' +
              '<td class="t-date">' + escape(x.date || '') + '</td>' +
              '<td class="t-cat">' + escape(x.category || '') + '</td>' +
              '<td>' + escape(x.title || '') + (x.note ? '<br><span style="color:#4a5663;font-size:10.5px">' + escape(x.note) + '</span>' : '') + '</td>' +
              '<td class="t-hours">' + (x.hours ? Number(x.hours).toFixed(1) : '') + '</td>' +
            '</tr>'
          ).join('') +
          '</tbody></table>';
      } else {
        html += '<p class="pp-empty">期間内の実績はありません</p>';
      }

      html += '<div class="pp-section-title">作業予定（' + plans.length + '件）</div>';
      if (plans.length) {
        html += '<table class="pp-table"><thead><tr>' +
          '<th class="t-date">期限</th><th class="t-cat">区分</th><th>件名・内容</th><th class="t-prio">優先</th>' +
          '</tr></thead><tbody>' +
          plans.map(x =>
            '<tr>' +
              '<td class="t-date">' + escape(x.due || '') + '</td>' +
              '<td class="t-cat">' + escape(x.category || '') + '</td>' +
              '<td>' + escape(x.title || '') + (x.note ? '<br><span style="color:#4a5663;font-size:10.5px">' + escape(x.note) + '</span>' : '') + '</td>' +
              '<td class="t-prio">' + escape(x.priority || '') + '</td>' +
            '</tr>'
          ).join('') +
          '</tbody></table>';
      } else {
        html += '<p class="pp-empty">期間内の予定はありません</p>';
      }
      html += '</section>';
    });

    html +=
      '<div class="pp-foot">' +
        '<div><div>作成日: ' + escape(today || '____年__月__日') + '</div>' +
              '<div>本書はCBI管理画面（site/admin/）から自動生成されました。</div></div>' +
        '<div class="pp-sign-block">' +
          '<div>代表者署名: <span class="pp-sign-line"></span><span class="pp-stamp">代表者<br>印</span></div>' +
        '</div>' +
      '</div>';

    $('print-paper').innerHTML = html;
  }

  // =========================================================
  // 更新履歴（changelog.json）
  // =========================================================
  async function loadChangelog() {
    try {
      const res = await fetch('changelog.json', { cache: 'no-store' });
      const data = await res.json();
      const entries = data.entries || [];
      $('changelog-updated').textContent = data.updatedAt ? ('更新: ' + data.updatedAt) : '';
      state.changelogLoaded = true;
      const list = $('changelog-list');
      list.innerHTML = '';
      if (!entries.length) {
        list.innerHTML = '<p class="empty">更新履歴はまだありません</p>';
        return;
      }
      entries.forEach(e => list.appendChild(renderChangelogItem(e)));
    } catch (err) {
      $('changelog-list').innerHTML = '<p class="empty">更新履歴を読み込めませんでした（' + escape(err.message) + '）</p>';
    }
  }

  function renderChangelogItem(e) {
    const item = document.createElement('div');
    item.className = 'cl-item t-' + (e.type || 'feature');
    item.innerHTML =
      '<div class="cl-side">' +
        '<span class="cl-date">' + escape(e.date || '') + '</span>' +
        '<span class="cl-type">' + escape(labelForType(e.type)) + '</span>' +
      '</div>' +
      '<div class="cl-main">' +
        (e.target ? '<span class="cl-target">' + escape(e.target) + '</span>' : '') +
        '<div class="cl-title">' + escape(e.title || '') + '</div>' +
        (e.detail ? '<div class="cl-detail">' + escape(e.detail) + '</div>' : '') +
        (e.author ? '<div class="cl-author">記録: ' + escape(e.author) + '</div>' : '') +
      '</div>';
    return item;
  }

  function labelForType(t) {
    switch (t) {
      case 'feature': return '機能';
      case 'fix':     return '修正';
      case 'content': return '内容';
      case 'docs':    return '資料';
      case 'deploy':  return '公開';
      default:        return t || '更新';
    }
  }

  // =========================================================
  // ユーザー識別
  // =========================================================
  function openMeModal() {
    $('me-modal').hidden = false;
    $('me-custom').value = '';
    setTimeout(() => $('me-custom').focus(), 100);
  }
  function closeMeModal() { $('me-modal').hidden = true; }
  function setMe(name) {
    state.me = name;
    localStorage.setItem(STORAGE_KEYS.ME, name);
    $('me-name').textContent = name;
    closeMeModal();
    // 投稿フォームの「投稿者」も自動補完
    const sel = $('idea-author');
    const presets = Array.from(sel.options).map(o => o.value);
    if (presets.includes(name)) {
      sel.value = name;
      $('idea-author-custom').hidden = true;
    } else {
      sel.value = '__custom__';
      $('idea-author-custom').hidden = false;
      $('idea-author-custom').value = name;
    }
    renderList();
    refreshUnread();
  }

  // =========================================================
  // データ取得（アイデア＋コメント）
  // =========================================================
  async function loadAll() {
    setStatus('読み込み中…');
    if (!GAS_WEBAPP_URL) {
      $('idea-empty').textContent = 'GAS未接続のためデータを読み込めません';
      $('filter-count').textContent = '0件';
      setStatus('GAS未接続', 'err');
      return;
    }
    try {
      const [ri, rc] = await Promise.all([
        gasCall({ action: 'list', password: state.password }),
        gasCall({ action: 'listComments', password: state.password }),
      ]);
      if (ri && ri.ok) {
        state.ideas = (ri.ideas || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      }
      if (rc && rc.ok) {
        state.commentsByIdea = {};
        (rc.comments || []).forEach(c => {
          if (!state.commentsByIdea[c.ideaId]) state.commentsByIdea[c.ideaId] = [];
          state.commentsByIdea[c.ideaId].push(c);
        });
        Object.keys(state.commentsByIdea).forEach(k => {
          state.commentsByIdea[k].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        });
      }
      renderList();
      setStatus('接続OK（' + state.ideas.length + '件）', 'ok');
      refreshUnread();
    } catch (err) {
      setStatus('通信エラー: ' + err.message, 'err');
    }
  }

  // =========================================================
  // 一覧描画
  // =========================================================
  function renderList() {
    const kw = $('search-keyword').value.trim().toLowerCase();
    const cat = $('filter-category').value;
    const st = $('filter-status').value;

    const filtered = state.ideas.filter(i => {
      if (cat && i.category !== cat) return false;
      if (st && i.status !== st) return false;
      if (kw) {
        const hay = [i.title, i.body, i.author].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    $('filter-count').textContent = filtered.length + '件 / 全' + state.ideas.length + '件';

    const list = $('idea-list');
    list.innerHTML = '';
    if (!filtered.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = state.ideas.length ? '該当するアイデアがありません' : 'まだアイデアが投稿されていません';
      list.appendChild(p);
      return;
    }
    filtered.forEach(i => list.appendChild(renderCard(i)));
  }

  function renderCard(idea) {
    const card = document.createElement('article');
    card.className = 'idea-card is-status-' + (idea.status || '検討中');
    if (state.openIdeas.has(idea.id)) card.classList.add('is-open');

    // ヘッダー
    const head = document.createElement('div');
    head.className = 'idea-card-head';

    const title = document.createElement('h3');
    title.className = 'idea-title-text';
    title.textContent = idea.title || '(無題)';
    head.appendChild(title);

    if (idea.category) {
      const cat = document.createElement('span');
      cat.className = 'idea-tag tag-category';
      cat.textContent = idea.category;
      head.appendChild(cat);
    }
    const st = document.createElement('span');
    st.className = 'idea-tag tag-status s-' + (idea.status || '検討中');
    st.textContent = idea.status || '検討中';
    head.appendChild(st);
    card.appendChild(head);

    // メタ
    const meta = document.createElement('div');
    meta.className = 'idea-meta';
    meta.innerHTML =
      '<span>👤 ' + escape(idea.author || '匿名') + '</span>' +
      '<span>📅 ' + formatDate(idea.createdAt) + '</span>' +
      (idea.updatedAt && idea.updatedAt !== idea.createdAt ? '<span>✏ ' + formatDate(idea.updatedAt) + '</span>' : '') +
      '<span class="idea-id">' + escape(idea.id || '') + '</span>';
    card.appendChild(meta);

    // 本文
    const body = document.createElement('p');
    body.className = 'idea-body';
    body.textContent = idea.body || '';
    card.appendChild(body);

    // アクション行
    const actions = document.createElement('div');
    actions.className = 'idea-card-actions';

    const commentCount = (state.commentsByIdea[idea.id] || []).length;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'idea-card-toggle';
    toggleBtn.innerHTML = '💬 コメント (' + commentCount + ') <span class="arrow">▾</span>';
    toggleBtn.addEventListener('click', () => toggleIdeaOpen(idea.id));
    actions.appendChild(toggleBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = '編集';
    editBtn.addEventListener('click', () => startEdit(idea));
    actions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => onDelete(idea));
    actions.appendChild(delBtn);

    card.appendChild(actions);

    // 展開コメントスレッド
    const wrap = document.createElement('div');
    wrap.className = 'idea-comments-wrap';
    const inner = document.createElement('div');
    inner.className = 'idea-comments-inner';
    inner.appendChild(renderThread(idea.id));
    wrap.appendChild(inner);
    card.appendChild(wrap);

    return card;
  }

  function toggleIdeaOpen(id) {
    if (state.openIdeas.has(id)) state.openIdeas.delete(id);
    else state.openIdeas.add(id);
    renderList();
  }

  // =========================================================
  // コメントスレッド
  // =========================================================
  function renderThread(ideaId) {
    const wrap = document.createElement('div');
    wrap.className = 'comment-thread';

    const comments = state.commentsByIdea[ideaId] || [];
    if (!comments.length) {
      const empty = document.createElement('p');
      empty.className = 'comment-empty';
      empty.textContent = 'まだコメントはありません。最初のコメントを送ってみましょう。';
      wrap.appendChild(empty);
    } else {
      comments.forEach(c => wrap.appendChild(renderBubble(c)));
    }

    // 入力欄
    const row = document.createElement('div');
    row.className = 'comment-input-row';
    const ta = document.createElement('textarea');
    ta.placeholder = state.me ? (state.me + ' としてコメントを送る…') : 'コメント…';
    ta.rows = 1;
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        send();
      }
    });
    const btn = document.createElement('button');
    btn.className = 'comment-send';
    btn.type = 'button';
    btn.textContent = '送信';
    async function send() {
      const body = ta.value.trim();
      if (!body) return;
      if (!state.me) {
        toast('まず「私」を選択してください', 'err');
        openMeModal();
        return;
      }
      btn.disabled = true;
      ta.disabled = true;
      try {
        const r = await gasCall({
          action: 'addComment',
          password: state.password,
          actor: state.me,
          comment: { ideaId, author: state.me, body },
        });
        if (r && r.ok) {
          ta.value = '';
          toast('コメントを送信しました', 'ok');
          await loadAll();
          state.openIdeas.add(ideaId);
          renderList();
        } else {
          toast('エラー: ' + (r && r.error), 'err');
        }
      } catch (err) {
        toast('通信エラー: ' + err.message, 'err');
      } finally {
        btn.disabled = false;
        ta.disabled = false;
      }
    }
    btn.addEventListener('click', send);
    row.appendChild(ta);
    row.appendChild(btn);
    wrap.appendChild(row);

    return wrap;
  }

  function renderBubble(c) {
    const row = document.createElement('div');
    const isMe = state.me && c.author === state.me;
    row.className = 'comment-bubble-row' + (isMe ? ' is-me' : '');

    const av = document.createElement('div');
    av.className = 'comment-avatar';
    av.textContent = (c.author || '?').slice(0, 1);
    row.appendChild(av);

    const bub = document.createElement('div');
    bub.className = 'comment-bubble';
    const meta = document.createElement('div');
    meta.className = 'comment-meta';
    meta.innerHTML =
      '<span>' + escape(c.author || '匿名') + '</span>' +
      '<span>' + formatDate(c.createdAt) + '</span>';

    if (isMe) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'comment-del';
      del.textContent = '削除';
      del.addEventListener('click', () => deleteComment(c));
      meta.appendChild(del);
    }
    bub.appendChild(meta);

    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = c.body || '';
    bub.appendChild(text);
    row.appendChild(bub);

    return row;
  }

  async function deleteComment(c) {
    if (!confirm('このコメントを削除しますか？')) return;
    try {
      const r = await gasCall({ action: 'deleteComment', password: state.password, actor: state.me, id: c.id });
      if (r && r.ok) {
        toast('削除しました', 'ok');
        await loadAll();
        state.openIdeas.add(c.ideaId);
        renderList();
      } else {
        toast('エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  // =========================================================
  // アイデア投稿/編集
  // =========================================================
  function startEdit(idea) {
    state.editingId = idea.id;
    $('idea-id').value = idea.id;
    setAuthor(idea.author);
    $('idea-category').value = idea.category || '';
    $('idea-status').value = idea.status || '検討中';
    $('idea-title').value = idea.title || '';
    $('idea-body').value = idea.body || '';
    $('form-title-label').textContent = '編集中：' + (idea.title || '(無題)');
    $('form-submit').textContent = '更新する';
    $('form-cancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setAuthor(name) {
    const sel = $('idea-author');
    const custom = $('idea-author-custom');
    const presets = Array.from(sel.options).map(o => o.value);
    if (presets.includes(name)) {
      sel.value = name;
      custom.hidden = true;
      custom.value = '';
    } else if (name) {
      sel.value = '__custom__';
      custom.hidden = false;
      custom.value = name;
    } else {
      sel.value = '';
      custom.hidden = true;
      custom.value = '';
    }
  }

  function resetForm() {
    state.editingId = null;
    $('idea-form').reset();
    $('idea-id').value = '';
    $('idea-author-custom').hidden = true;
    $('form-title-label').textContent = '新規アイデア投稿';
    $('form-submit').textContent = '投稿する';
    $('form-cancel').hidden = true;
  }

  async function onSubmitForm(e) {
    e.preventDefault();
    if (!GAS_WEBAPP_URL) { toast('GAS未接続のため保存できません', 'err'); return; }
    const authorRaw = $('idea-author').value;
    const author = authorRaw === '__custom__' ? $('idea-author-custom').value.trim() : authorRaw;
    if (!author) { toast('投稿者を選んでください', 'err'); return; }
    const idea = {
      author,
      category: $('idea-category').value,
      status: $('idea-status').value,
      title: $('idea-title').value.trim(),
      body: $('idea-body').value.trim(),
    };
    if (state.editingId) idea.id = state.editingId;

    const btn = $('form-submit');
    btn.disabled = true;
    btn.textContent = state.editingId ? '更新中…' : '投稿中…';

    try {
      const action = state.editingId ? 'update' : 'add';
      const r = await gasCall({ action, password: state.password, actor: state.me || author, idea });
      if (r && r.ok) {
        toast(state.editingId ? '更新しました' : '投稿しました', 'ok');
        resetForm();
        loadAll();
      } else {
        toast('エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = state.editingId ? '更新する' : '投稿する';
    }
  }

  async function onDelete(idea) {
    if (!confirm('「' + (idea.title || '(無題)') + '」を削除しますか？\n（取消できません）')) return;
    try {
      const r = await gasCall({ action: 'delete', password: state.password, actor: state.me, id: idea.id });
      if (r && r.ok) {
        toast('削除しました', 'ok');
        loadAll();
      } else {
        toast('エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  // =========================================================
  // エクスポート
  // =========================================================
  function exportIdeas() {
    if (!state.ideas.length) { toast('エクスポート対象がありません', 'err'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const payload = {
      exportedAt: new Date().toISOString(),
      ideas: state.ideas,
      comments: state.commentsByIdea,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cbi-ideas-' + ts + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('エクスポートしました', 'ok');
  }

  // =========================================================
  // 未読
  // =========================================================
  async function refreshUnread() {
    if (!GAS_WEBAPP_URL || !state.password) return;
    try {
      const r = await gasCall({
        action: 'unreadCount',
        password: state.password,
        since: state.lastSeen,
        actor: state.me || '',
      });
      if (r && r.ok) {
        const count = r.unread || 0;
        state.unreadEvents = r.events || [];
        const badge = $('badge-count');
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : String(count);
          badge.hidden = false;
        } else {
          badge.hidden = true;
        }
      }
    } catch (err) {
      // 静かに失敗
    }
  }

  function startUnreadPolling() {
    stopUnreadPolling();
    state.pollTimer = setInterval(refreshUnread, UNREAD_POLL_MS);
  }
  function stopUnreadPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function openUnreadPanel() {
    $('unread-panel').hidden = false;
    renderUnreadList();
  }
  function closeUnreadPanel() { $('unread-panel').hidden = true; }

  function renderUnreadList() {
    const list = $('unread-list');
    list.innerHTML = '';
    if (!state.unreadEvents.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = '未読はありません';
      list.appendChild(p);
      return;
    }
    state.unreadEvents.slice().reverse().forEach(ev => {
      const item = document.createElement('div');
      item.className = 'unread-item';
      const tag = document.createElement('span');
      tag.className = 'u-tag t-' + (ev.type || '');
      tag.textContent = labelForEvent(ev.type);
      item.appendChild(tag);
      const det = document.createElement('span');
      det.className = 'u-detail';
      det.textContent = (ev.actor || '?') + ' : ' + (ev.detail || ev.ideaId || '');
      item.appendChild(det);
      const meta = document.createElement('span');
      meta.className = 'u-meta';
      meta.textContent = formatDate(ev.createdAt);
      item.appendChild(meta);
      list.appendChild(item);
    });
  }

  function labelForEvent(type) {
    switch (type) {
      case 'idea_added':    return '新規投稿';
      case 'idea_edited':   return '本文編集';
      case 'idea_deleted':  return 'アイデア削除';
      case 'status_changed': return '状態変更';
      case 'comment_added': return 'コメント';
      case 'comment_deleted': return 'コメント削除';
      default: return type || 'イベント';
    }
  }

  function markAllRead() {
    const now = new Date().toISOString();
    state.lastSeen = now;
    localStorage.setItem(STORAGE_KEYS.LAST_SEEN, now);
    state.unreadEvents = [];
    $('badge-count').hidden = true;
    closeUnreadPanel();
    toast('既読にしました', 'ok');
  }

  // =========================================================
  // GAS通信
  // =========================================================
  async function gasCall(body) {
    const res = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
    });
    return res.json();
  }

  // =========================================================
  // UI helpers
  // =========================================================
  function setStatus(text, kind) {
    const el = $('admin-status');
    el.textContent = text;
    el.classList.remove('is-ok', 'is-err');
    if (kind === 'ok') el.classList.add('is-ok');
    if (kind === 'err') el.classList.add('is-err');
  }

  let toastTimer = null;
  function toast(msg, kind, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast' + (kind === 'ok' ? ' is-ok' : kind === 'err' ? ' is-err' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || 2800);
  }

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return s;
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
})();
