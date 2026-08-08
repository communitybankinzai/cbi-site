/* =========================================================
   CBI 管理画面 — admin.js
   通信先: GAS WebApp（cbi-admin-gas/Code.gs）
   機能: 認証 / アイデアCRUD / コメント / 未読バッジ / ユーザー識別
   ========================================================= */

// GAS WebApp URL（2026-06-19 v1: 初回デプロイ）
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz0UJbV1ZqGEThNqj_LSTHe82ws6lni5EjYXZSDYuN43NTwo1ugrdjmrKWZ-XBf9yV3/exec';

// CBI Gmail共有 WebApp URL（communitybankinzai@gmail.com でデプロイしたGASの /exec URL）
// 2026-06-20 v1: 初回デプロイ
const GAS_MAIL_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbz-54I_6bxh04SMKbNM3pKekp0fhW6CCsl44_a4qSUpenLiaL7ubwcXLEuUE8jSvRFvKg/exec';

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
    actualsDynamic: [],
    plansDynamic: [],
    bugReports: [],
    mail: {
      label: 'inbox',
      query: '',
      threads: [],
      selectedId: '',
      labelsLoaded: false,
      loading: false,
      mobileView: 'list', // 'labels' | 'list' | 'detail'
      currentThread: null,
      compose: {
        mode: 'new',      // 'new' | 'reply'
        threadId: '',
        attachments: [],  // [{ name, type, size, data(base64) }]
        sending: false,
        initialBody: '',  // 引用文など、開いた直後の本文（破棄確認の判定に使う）
      },
    },
  };

  const $ = id => document.getElementById(id);
  const screenLogin = $('screen-login');
  const screenAdmin = $('screen-admin');

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bindLogin();
    bindAdmin();
    initSnsTab();
    initFreefreeSnsUI();
    initBugReportsTab();
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
    // カテゴリ動的生成のため agents.json を先行ロード
    if (!state.agentsLoaded) loadAgents();
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
      updateAiSuggestButton();
    });

    $('form-ai-suggest').addEventListener('click', onAiSuggest);

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
    ['ideas', 'mail', 'agents', 'changelog', 'docs', 'doc-comments', 'sns', 'bug-reports'].forEach(t => {
      $('tab-' + t).hidden = (t !== name);
    });
    document.body.classList.toggle('mail-fullwidth', name === 'mail');
    if (name !== 'mail') {
      document.body.classList.remove('mail-view-labels', 'mail-view-list', 'mail-view-detail');
    }
    if (name === 'agents' && !state.agentsLoaded) loadAgents();
    if (name === 'changelog' && !state.changelogLoaded) loadChangelog();
    if (name === 'changelog') loadNewsAdmin();
    if (name === 'mail') openMailTab();
    if (name === 'doc-comments' && !state.documentsLoaded) initDocComments();
    if (name === 'sns' && !state.snsLoaded) { loadSnsConfig(); loadSnsQueue(); loadFreefreeSnsConfig(); }
    if (name === 'bug-reports') loadBugReports();
  }

  // =========================================================
  // 自動投稿（Threads）設定
  // =========================================================
  function snsParseList(text) {
    return String(text || '').split(/[,、\n]/).map(s => s.trim()).filter(Boolean);
  }

  function snsFillForm(cfg) {
    $('sns-enabled').checked = !!cfg.enabled;
    $('sns-sync-cocola').checked = !!cfg.syncFromCocola;
    $('sns-priority-include').value = (cfg.priorityInclude || []).join(', ');
    $('sns-exclude').value = (cfg.exclude || []).join(', ');
    $('sns-include').value = (cfg.include || []).join(', ');
    $('sns-source-always').value = (cfg.sourceAlwaysInclude || []).join(', ');
    $('sns-hashtags').value = cfg.hashtags || '';
    $('sns-events-url').value = cfg.eventsPageUrl || '';
    $('sns-preview-email').value = cfg.previewEmail || '';
  }

  function snsReadForm() {
    return {
      enabled: $('sns-enabled').checked,
      syncFromCocola: $('sns-sync-cocola').checked,
      priorityInclude: snsParseList($('sns-priority-include').value),
      exclude: snsParseList($('sns-exclude').value),
      include: snsParseList($('sns-include').value),
      sourceAlwaysInclude: snsParseList($('sns-source-always').value),
      hashtags: $('sns-hashtags').value.trim(),
      eventsPageUrl: $('sns-events-url').value.trim(),
      previewEmail: $('sns-preview-email').value.trim(),
    };
  }

  async function loadSnsConfig() {
    if (!GAS_WEBAPP_URL) { toast('GAS未接続のため自動投稿設定を利用できません', 'err'); return; }
    try {
      const r = await gasCall({ action: 'getSnsConfig', password: state.password });
      if (r && r.ok) {
        state.snsDefaults = r.defaults || null;
        snsFillForm(r.config || {});
        state.snsLoaded = true;
      } else {
        toast('設定の取得に失敗: ' + (r && r.error || 'unknown'), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  async function saveSnsConfig() {
    const btn = $('sns-save');
    btn.disabled = true;
    try {
      const r = await gasCall({ action: 'saveSnsConfig', password: state.password, config: snsReadForm() });
      if (r && r.ok) {
        snsFillForm(r.config || {});
        toast('自動投稿設定を保存しました', 'ok');
      } else {
        toast('保存に失敗: ' + (r && r.error || 'unknown'), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function previewSnsPost(offsetDays) {
    const wrap = $('sns-preview-wrap');
    const pre = $('sns-preview-text');
    wrap.hidden = false;
    pre.textContent = '生成中…（保存済みの設定で判定されます）';
    try {
      const r = await gasCall({ action: 'previewSnsPost', password: state.password, offsetDays });
      if (r && r.ok) {
        pre.textContent = r.text || '（対象イベントなし — この日は投稿がスキップされます）';
      } else {
        pre.textContent = 'エラー: ' + (r && r.error || 'unknown');
      }
    } catch (err) {
      pre.textContent = '通信エラー: ' + err.message;
    }
  }

  function initSnsTab() {
    const save = $('sns-save');
    if (!save) return;
    save.addEventListener('click', saveSnsConfig);
    $('sns-preview-today').addEventListener('click', () => previewSnsPost(0));
    $('sns-preview-tomorrow').addEventListener('click', () => previewSnsPost(1));
    $('sns-reset-defaults').addEventListener('click', () => {
      if (!state.snsDefaults) { toast('初期値が未取得です（設定を一度読み込んでください）', 'err'); return; }
      if (!confirm('フォームを初期値に戻します（保存するまで反映されません）。よろしいですか？')) return;
      snsFillForm(state.snsDefaults);
    });
    $('snsq-add').addEventListener('click', addSnsQueuePost);
    $('snsq-refresh').addEventListener('click', loadSnsQueue);
    const snsqFile = $('snsq-file');
    if (snsqFile) {
      snsqFile.addEventListener('change', (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (f) uploadSnsQueueImage(f);
      });
    }
  }

  // ---------------------------------------------------------
  // 予約投稿キュー
  // ---------------------------------------------------------
  const SNSQ_STATUS_LABEL = {
    scheduled: '⏳ 予約中', posted: '✅ 投稿済み', partial: '⚠️ 一部成功',
    failed: '❌ 失敗', canceled: '― 取消済み',
  };
  const esc = (s) => escapeHtml(s);

  async function loadSnsQueue() {
    const wrap = $('snsq-list');
    try {
      const r = await gasCall({ action: 'listSnsQueue', password: state.password });
      if (!r || !r.ok) { wrap.innerHTML = '<p class="meta-note">取得失敗: ' + esc((r && r.error) || 'unknown') + '</p>'; return; }
      if (!r.queue.length) { wrap.innerHTML = '<p class="meta-note">予約はまだありません</p>'; return; }
      wrap.innerHTML = r.queue.map(q => `
        <div style="border: 1px solid var(--c-line); border-radius: var(--radius); padding: 10px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; gap: 8px; align-items: baseline;">
            <strong style="font-size: 0.85rem;">${esc(q.scheduledAt)}</strong>
            <span style="font-size: 0.75rem;">${esc(SNSQ_STATUS_LABEL[q.status] || q.status)}
              ${q.threads ? ' / Threads' : ''}${q.instagram ? ' / Instagram' : ''}</span>
          </div>
          <p style="font-size: 0.8rem; white-space: pre-wrap; margin: 6px 0; color: var(--c-ink-sub);">${esc(q.text)}</p>
          ${q.imageUrl ? `<a href="${esc(q.imageUrl)}" target="_blank" rel="noopener"><img src="${esc(q.imageUrl)}" alt="投稿画像" style="max-width: 160px; max-height: 160px; border-radius: 8px; margin: 4px 0; border: 1px solid var(--c-line);"></a>` : ''}
          ${q.note ? `<p style="font-size: 0.7rem; color: var(--c-ink-sub);">${esc(q.note)}</p>` : ''}
          ${q.status === 'scheduled' ? `<button type="button" class="btn btn-ghost btn-sm" data-snsq-cancel="${esc(q.id)}">取消</button>` : ''}
        </div>`).join('');
      wrap.querySelectorAll('[data-snsq-cancel]').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('この予約を取り消しますか？')) return;
          const res = await gasCall({ action: 'cancelSnsQueuePost', password: state.password, id: b.dataset.snsqCancel });
          if (res && res.ok) { toast('取り消しました', 'ok'); loadSnsQueue(); }
          else toast('取消失敗: ' + ((res && res.error) || 'unknown'), 'err');
        });
      });
    } catch (err) {
      wrap.innerHTML = '<p class="meta-note">通信エラー: ' + esc(err.message) + '</p>';
    }
  }

  // スマホで撮った写真をその場で保存し、公開URLを画像URL欄に自動で入れる。
  // 保存先は Supabase Storage の公開バケット。GAS を経由するのは、
  // このページが静的サイトで、保存用の鍵をページに置けないため。
  const SNSQ_MAX_BYTES = 10 * 1024 * 1024;

  async function uploadSnsQueueImage(file) {
    const status = $('snsq-file-status');
    const preview = $('snsq-file-preview');
    const addBtn = $('snsq-add');
    const setStatus = (msg) => { if (status) status.textContent = msg; };

    if (!GAS_WEBAPP_URL) { toast('GAS未接続のため画像を保存できません', 'err'); return; }
    if (file.size > SNSQ_MAX_BYTES) {
      setStatus('');
      toast(`画像が大きすぎます（${(file.size / 1048576).toFixed(1)}MB / 上限10MB）`, 'err');
      return;
    }

    if (addBtn) addBtn.disabled = true;
    setStatus('アップロード中…');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('画像を読み込めませんでした'));
        // data:image/jpeg;base64,XXXX → XXXX だけ取り出す
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.readAsDataURL(file);
      });

      const r = await gasCall({
        action: 'uploadSnsMedia', password: state.password,
        base64, mime: file.type,
      });

      if (r && r.ok && r.imageUrl) {
        $('snsq-image').value = r.imageUrl;
        if (preview) { preview.src = r.imageUrl; preview.hidden = false; }
        setStatus('アップロード完了');
        toast('画像を保存しました', 'ok');
      } else {
        setStatus('');
        toast('画像の保存に失敗: ' + ((r && r.error) || 'unknown'), 'err');
      }
    } catch (err) {
      setStatus('');
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      if (addBtn) addBtn.disabled = false;
    }
  }

  async function addSnsQueuePost() {
    const text = $('snsq-text').value.trim();
    const imageUrl = $('snsq-image').value.trim();
    const when = $('snsq-when').value; // datetime-local: YYYY-MM-DDTHH:MM
    const threads = $('snsq-threads').checked;
    const instagram = $('snsq-instagram').checked;
    if (!text) { toast('本文を入力してください', 'err'); return; }
    if (!when) { toast('投稿日時を指定してください', 'err'); return; }
    if (!threads && !instagram) { toast('投稿先を選んでください', 'err'); return; }
    if (instagram && !imageUrl) { toast('Instagramに投稿する場合は画像URLが必須です', 'err'); return; }
    const btn = $('snsq-add');
    btn.disabled = true;
    try {
      const r = await gasCall({
        action: 'addSnsQueuePost', password: state.password,
        post: { text, imageUrl, scheduledAt: when.replace('T', ' '), threads, instagram },
      });
      if (r && r.ok) {
        toast('予約を追加しました', 'ok');
        $('snsq-text').value = ''; $('snsq-image').value = '';
        const f = $('snsq-file'); if (f) f.value = '';
        const p = $('snsq-file-preview'); if (p) { p.hidden = true; p.removeAttribute('src'); }
        const s = $('snsq-file-status'); if (s) s.textContent = '';
        loadSnsQueue();
      } else {
        const msg = { text_required: '本文が空です', invalid_scheduledAt: '日時の形式が不正です', instagram_requires_image: 'Instagramは画像URL必須です' }[r && r.error] || (r && r.error) || 'unknown';
        toast('追加失敗: ' + msg, 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  // =========================================================
  // FreeFree自動配信（Instagram）設定
  // =========================================================
  function initFreefreeSnsUI() {
    const save = $('ffsns-save');
    if (!save) return;
    const hourSel = $('ffsns-hour');
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = String(h);
      opt.textContent = h + ':00';
      hourSel.appendChild(opt);
    }
    save.addEventListener('click', saveFreefreeSnsConfig);
    $('ffsns-preview').addEventListener('click', previewFreefreeSns);
  }

  function ffsnsFillForm(cfg) {
    $('ffsns-enabled').checked = !!cfg.enabled;
    $('ffsns-hour').value = String(cfg.hour ?? 12);
    $('ffsns-hashtags').value = cfg.hashtags || '';
    document.querySelectorAll('#ffsns-days input[type="checkbox"]').forEach(cb => {
      cb.checked = (cfg.days || []).includes(Number(cb.value));
    });
  }

  function ffsnsReadForm() {
    const days = [];
    document.querySelectorAll('#ffsns-days input[type="checkbox"]').forEach(cb => {
      if (cb.checked) days.push(Number(cb.value));
    });
    // 配信対象リストが読み込み済みなら、チェックを外したIDを除外リストにする。
    // 未読み込み時は前回の除外リストを保持（誤って全許可にしない）
    let excludedIds = (state.ffsnsConfig && state.ffsnsConfig.excludedIds) || [];
    if (state.ffsnsTargetsLoaded) {
      excludedIds = [];
      document.querySelectorAll('[data-ffsns-target]').forEach(cb => {
        if (!cb.checked) excludedIds.push(cb.dataset.ffsnsTarget);
      });
    }
    return {
      enabled: $('ffsns-enabled').checked,
      days,
      hour: Number($('ffsns-hour').value),
      hashtags: $('ffsns-hashtags').value.trim(),
      excludedIds,
    };
  }

  async function loadFreefreeSnsConfig() {
    if (!$('ffsns-save')) return;
    try {
      const r = await gasCall({ action: 'getFreefreeSnsConfig', password: state.password });
      if (r && r.ok) {
        state.ffsnsConfig = r.config || {};
        ffsnsFillForm(state.ffsnsConfig);
      }
    } catch (err) {
      toast('FreeFree配信設定の取得に失敗: ' + err.message, 'err');
    }
    loadFreefreeSnsTargets();
  }

  async function loadFreefreeSnsTargets() {
    const wrap = $('ffsns-targets');
    if (!wrap) return;
    wrap.innerHTML = '<p class="meta-note">読み込み中…</p>';
    state.ffsnsTargetsLoaded = false;
    try {
      const r = await gasCall({ action: 'listFreefreeSnsTargets', password: state.password });
      if (!r || !r.ok) { wrap.innerHTML = '<p class="meta-note">取得失敗: ' + esc((r && r.error) || 'unknown') + '</p>'; return; }
      if (!r.targets.length) { wrap.innerHTML = '<p class="meta-note">配信候補がありません（掲載中・画像あり・SNS許可の掲示物が0件）</p>'; return; }
      wrap.innerHTML = r.targets.map(t => `
        <label class="field-check" style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--c-line);">
          <input type="checkbox" data-ffsns-target="${esc(t.id)}" ${t.excluded ? '' : 'checked'}>
          <img src="${esc(t.imageUrl)}" alt="" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px;">
          <span style="font-size: 0.85rem;">${esc(t.title)}</span>
        </label>`).join('');
      state.ffsnsTargetsLoaded = true;
    } catch (err) {
      wrap.innerHTML = '<p class="meta-note">通信エラー: ' + esc(err.message) + '</p>';
    }
  }

  async function saveFreefreeSnsConfig() {
    const btn = $('ffsns-save');
    btn.disabled = true;
    try {
      const r = await gasCall({ action: 'saveFreefreeSnsConfig', password: state.password, config: ffsnsReadForm() });
      if (r && r.ok) {
        state.ffsnsConfig = r.config || {};
        ffsnsFillForm(state.ffsnsConfig);
        toast('FreeFree配信設定を保存しました', 'ok');
      } else {
        toast('保存に失敗: ' + ((r && r.error) || 'unknown'), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function previewFreefreeSns() {
    const wrap = $('ffsns-preview-wrap');
    const pre = $('ffsns-preview-text');
    const img = $('ffsns-preview-image');
    wrap.hidden = false;
    pre.textContent = '取得中…';
    img.style.display = 'none';
    try {
      const r = await gasCall({ action: 'previewFreefreeSnsPost', password: state.password });
      if (r && r.ok) {
        if (r.empty) {
          pre.textContent = r.message || '配信対象がありません';
        } else {
          pre.textContent = r.caption || '';
          if (r.imageUrl) {
            img.src = r.imageUrl;
            img.style.display = 'block';
          }
        }
      } else {
        pre.textContent = 'エラー: ' + ((r && r.error) || 'unknown');
      }
    } catch (err) {
      pre.textContent = '通信エラー: ' + err.message;
    }
  }

  // =========================================================
  // 不具合・要望レポート（CiDAO Supabase bug_reports 経由）
  // =========================================================
  const BUGREPORT_STATUS_LABEL = { open: '未対応', in_progress: '対応中', resolved: '解決済み', closed: 'クローズ' };
  const BUGREPORT_CATEGORY_LABEL = { bug: '不具合', feature_request: '要望', other: 'その他' };
  const BUGREPORT_SOURCE_LABEL = { cbi_site: 'CBIサイト', cidao_app: 'CiDAOアプリ' };

  function initBugReportsTab() {
    const search = $('bugreports-search');
    const filterStatus = $('bugreports-filter-status');
    const refresh = $('bugreports-refresh');
    if (!search) return;
    search.addEventListener('input', renderBugReports);
    filterStatus.addEventListener('change', renderBugReports);
    refresh.addEventListener('click', loadBugReports);
  }

  async function loadBugReports() {
    const wrap = $('bugreports-list');
    wrap.innerHTML = '<p class="meta-note">読み込み中…</p>';
    try {
      const r = await gasCall({ action: 'listBugReports', password: state.password });
      if (!r || !r.ok) { wrap.innerHTML = '<p class="meta-note">取得失敗: ' + esc((r && r.error) || 'unknown') + '</p>'; return; }
      state.bugReports = r.reports || [];
      renderBugReports();
    } catch (err) {
      wrap.innerHTML = '<p class="meta-note">通信エラー: ' + esc(err.message) + '</p>';
    }
  }

  function renderBugReports() {
    const wrap = $('bugreports-list');
    const q = ($('bugreports-search').value || '').trim().toLowerCase();
    const statusFilter = $('bugreports-filter-status').value;
    let rows = state.bugReports;
    if (statusFilter) rows = rows.filter(r => r.status === statusFilter);
    if (q) {
      rows = rows.filter(r =>
        (r.description || '').toLowerCase().includes(q) ||
        (r.reporter_name || '').toLowerCase().includes(q) ||
        (r.reporter_email || '').toLowerCase().includes(q)
      );
    }
    if (!rows.length) { wrap.innerHTML = '<p class="meta-note">該当する報告はありません</p>'; return; }

    wrap.innerHTML = rows.map(r => `
      <div style="border: 1px solid var(--c-line); border-radius: var(--radius); padding: 10px; margin-bottom: 8px;">
        <div style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.72rem; margin-bottom: 6px;">
          <span style="padding: 2px 6px; border-radius: 4px; background: var(--c-bg-alt);">${esc(BUGREPORT_SOURCE_LABEL[r.source] || r.source)}</span>
          <span style="padding: 2px 6px; border-radius: 4px; background: var(--c-bg-alt);">${esc(BUGREPORT_CATEGORY_LABEL[r.category] || r.category)}</span>
          <span style="padding: 2px 6px; border-radius: 4px; background: var(--c-bg-alt); font-weight: 600;">${esc(BUGREPORT_STATUS_LABEL[r.status] || r.status)}</span>
          <span style="color: var(--c-ink-sub);">${esc(new Date(r.created_at).toLocaleString('ja-JP'))}</span>
        </div>
        <p style="font-size: 0.85rem; white-space: pre-wrap; margin: 0 0 6px;">${esc(r.description)}</p>
        <p style="font-size: 0.72rem; color: var(--c-ink-sub); margin: 0 0 8px;">
          ${r.page_url ? ('ページ: ' + esc(r.page_url) + ' / ') : ''}報告者: ${esc(r.reporter_name || '(未入力)')}${r.reporter_email ? (' / ' + esc(r.reporter_email)) : ''}
        </p>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <select data-bugreport-status="${esc(r.id)}" style="font-size: 0.75rem;">
            ${Object.keys(BUGREPORT_STATUS_LABEL).map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${BUGREPORT_STATUS_LABEL[s]}</option>`).join('')}
          </select>
          <input type="text" data-bugreport-note="${esc(r.id)}" value="${esc(r.admin_note || '')}" placeholder="対応メモ" style="flex: 1; min-width: 140px; font-size: 0.75rem;">
          <button type="button" class="btn btn-ghost btn-sm" data-bugreport-save="${esc(r.id)}">更新</button>
        </div>
      </div>`).join('');

    wrap.querySelectorAll('[data-bugreport-save]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bugreportSave;
        const status = wrap.querySelector(`[data-bugreport-status="${id}"]`).value;
        const note = wrap.querySelector(`[data-bugreport-note="${id}"]`).value;
        btn.disabled = true;
        try {
          const res = await gasCall({ action: 'updateBugReportStatus', password: state.password, id, status, admin_note: note });
          if (res && res.ok) {
            toast('更新しました', 'ok');
            const target = state.bugReports.find(x => x.id === id);
            if (target) { target.status = status; target.admin_note = note; }
            renderBugReports();
          } else {
            toast('更新失敗: ' + ((res && res.error) || 'unknown'), 'err');
          }
        } catch (err) {
          toast('通信エラー: ' + err.message, 'err');
        } finally {
          btn.disabled = false;
        }
      });
    });
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
      const ageSrc = $('agent-source');
      if (ageSrc) ageSrc.textContent = data.updatedAt ? ('更新: ' + data.updatedAt) : '';
      try {
        state.worklog = await resWl.json();
        state.worklogLoaded = true;
      } catch (_) {
        state.worklog = { agents: {} };
      }
      state.agentsLoaded = true;
      // 動的実績・動的予定（GAS スプレッドシート）を先にロードしてから描画
      await Promise.all([loadActualsDynamic(), loadPlansDynamic()]);
      // カテゴリプルダウンを agents.json から動的生成（ログイン直後に必要）
      populateCategorySelects();
      // 以下はエージェントタブ用UI（DOM存在時のみ）
      if ($('agent-tabs')) {
        renderAgentTabs();
        if (state.agents.length) selectAgent(state.agents[0].id);
      }
      populateAuthorAgents();
    } catch (err) {
      const detailEl = $('agent-detail');
      if (detailEl) detailEl.innerHTML = '<p class="empty">エージェント定義を読み込めませんでした（' + escape(err.message) + '）</p>';
    }
  }

  // カテゴリ表記 = AIエージェント区分（B案：role の括弧前まで）
  function buildCategoryLabel(agent) {
    const roleShort = String(agent.role || '').split('（')[0].trim();
    return (agent.id + ' ' + roleShort).trim();
  }

  function populateCategorySelects() {
    if (!state.agents || !state.agents.length) return;
    const cats = state.agents.map(buildCategoryLabel);
    // 投稿フォーム側
    const formSel = $('idea-category');
    if (formSel) {
      const current = formSel.value;
      // 先頭の placeholder option（value=""）は維持、それ以降を入れ替え
      [...formSel.querySelectorAll('option:not([value=""])')].forEach(o => o.remove());
      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        formSel.appendChild(o);
      });
      if (cats.includes(current)) formSel.value = current;
    }
    // フィルタ側
    const filterSel = $('filter-category');
    if (filterSel) {
      const current = filterSel.value;
      [...filterSel.querySelectorAll('option:not([value=""])')].forEach(o => o.remove());
      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c; o.textContent = c;
        filterSel.appendChild(o);
      });
      if (cats.includes(current)) filterSel.value = current;
    }
  }

  function populateAuthorAgents() {
    const group = document.getElementById('agent-optgroup');
    if (!group || !state.agents || !state.agents.length) return;
    group.innerHTML = '';
    state.agents.forEach(a => {
      const opt = document.createElement('option');
      const value = agentAuthorLabel(a);
      opt.value = value;
      opt.textContent = value + '（' + (a.role || '').slice(0, 24) + '）';
      opt.dataset.agentId = a.id;
      group.appendChild(opt);
    });
    populateMeAgents();
  }

  function agentAuthorLabel(a) {
    return ('🤖 ' + a.id + ' ' + (a.codename || '')).trim();
  }

  function populateMeAgents() {
    const wrap = document.getElementById('me-agent-options');
    if (!wrap || !state.agents || !state.agents.length) return;
    wrap.innerHTML = '';
    state.agents.forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'me-option me-option-agent';
      const label = agentAuthorLabel(a);
      b.dataset.me = label;
      b.dataset.agentId = a.id;
      b.innerHTML = '<strong>' + escape(label) + '</strong><span class="me-option-sub">' + escape((a.role || '').slice(0, 32)) + '</span>';
      b.addEventListener('click', () => setMe(label));
      wrap.appendChild(b);
    });
  }

  function findAgentByMeName(name) {
    if (!name || !state.agents) return null;
    return state.agents.find(a => agentAuthorLabel(a) === name) || null;
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
    const wlActuals = (wl.actuals || []).map(x => Object.assign({ _source: 'json' }, x));
    const dynActuals = (state.actualsDynamic || [])
      .filter(x => x.agentId === a.id)
      .map(x => Object.assign({}, x, {
        _source: 'dynamic',
        outputs: typeof x.outputs === 'string' && x.outputs ? x.outputs.split(' / ') : (x.outputs || []),
      }));
    const actuals = [].concat(dynActuals, wlActuals)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const wlPlans = (wl.plans || []).map(x => Object.assign({ _source: 'json' }, x));
    const dynPlans = (state.plansDynamic || [])
      .filter(x => x.agentId === a.id)
      .map(x => Object.assign({}, x, { _source: 'dynamic' }));
    const plans = [].concat(dynPlans, wlPlans)
      .sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const totalHours = actuals.reduce((s, x) => s + (Number(x.hours) || 0), 0);
    const summaryHtml =
      '<div class="worklog-summary">' +
        '<span class="ws-chip">実績 <strong>' + actuals.length + '</strong> 件</span>' +
        '<span class="ws-chip">予定 <strong>' + plans.length + '</strong> 件</span>' +
        '<span class="ws-chip">累計工数 <strong>' + totalHours.toFixed(1) + '</strong> h</span>' +
      '</div>';

    const actualsHtml = '<div class="ad-section">' +
        '<h4>実績（過去）<button type="button" class="ad-add-actual-btn" id="ad-add-actual" title="リアルタイムで実績を追加">＋ 実績を追加</button></h4>' +
        '<div id="ad-add-actual-slot"></div>' +
        (actuals.length
          ? '<div class="wl-list">' + actuals.map(renderWorklogActual).join('') + '</div>'
          : '<p class="wl-empty">まだ実績の記録はありません</p>') +
      '</div>';
    const plansHtml = '<div class="ad-section">' +
        '<h4>予定（今後）<button type="button" class="ad-add-actual-btn" id="ad-add-plan" title="メンバーからの作業依頼を追加">＋ 予定を追加</button></h4>' +
        '<div id="ad-add-plan-slot"></div>' +
        '<div id="ad-complete-plan-slot"></div>' +
        (plans.length
          ? '<div class="wl-list">' + plans.map(renderWorklogPlan).join('') + '</div>'
          : '<p class="wl-empty">予定はまだ登録されていません</p>') +
      '</div>';

    const isA8 = (a.id === 'A8');
    const a8SlotHtml = isA8 ? '<div id="a8-ai-usage-slot" class="ad-section a8-usage"><h4>📊 AI利用量モニタリング</h4><p class="wl-empty">読み込み中…</p></div>' : '';

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
      a8SlotHtml +
      actualsHtml +
      plansHtml +
      relHtml;

    const pThis = $('btn-print-this');
    const pAll  = $('btn-print-all');
    if (pThis) pThis.addEventListener('click', () => openPrintView([a.id]));
    if (pAll)  pAll.addEventListener('click', () => openPrintView(state.agents.map(x => x.id)));

    // 実績追加ボタンと削除ボタンのバインド
    const addBtn = document.getElementById('ad-add-actual');
    if (addBtn) addBtn.addEventListener('click', () => openActualForm(a.id));
    document.querySelectorAll('.wl-del-dyn').forEach(b => {
      b.addEventListener('click', () => onDeleteActual(b.dataset.actualId));
    });

    // 予定追加ボタンと予定の各操作ボタンのバインド
    const addPlanBtn = document.getElementById('ad-add-plan');
    if (addPlanBtn) addPlanBtn.addEventListener('click', () => openPlanForm(a.id));
    document.querySelectorAll('.wl-del-plan').forEach(b => {
      b.addEventListener('click', () => onDeletePlan(b.dataset.planId));
    });
    document.querySelectorAll('.wl-complete-plan').forEach(b => {
      b.addEventListener('click', () => openCompletePlanForm(b.dataset.planId, a.id));
    });

    if (isA8) loadA8Usage();
  }

  function openActualForm(agentId) {
    const slot = document.getElementById('ad-add-actual-slot');
    if (!slot) return;
    const today = new Date().toISOString().slice(0, 10);
    slot.innerHTML =
      '<form id="ad-actual-form" class="ad-actual-form">' +
        '<div class="ad-actual-grid">' +
          '<label><span>日付</span><input type="date" id="ad-actual-date" value="' + today + '" required></label>' +
          '<label><span>工数 (h)</span><input type="number" id="ad-actual-hours" step="0.1" min="0" value="0.5" required></label>' +
          '<label><span>カテゴリ</span><select id="ad-actual-category" required>' +
            ['実装','保守','レポート','分析','会議','広報','事務','調査','その他']
              .map(c => '<option value="' + c + '">' + c + '</option>').join('') +
          '</select></label>' +
        '</div>' +
        '<label class="ad-actual-full"><span>タイトル</span><input type="text" id="ad-actual-title" required placeholder="例: 月次収支レポート作成" maxlength="120"></label>' +
        '<label class="ad-actual-full"><span>成果物（カンマ区切り、任意）</span><input type="text" id="ad-actual-outputs" placeholder="例: site/admin/budgets/a8.json, cbi-admin-gas/Code.gs"></label>' +
        '<label class="ad-actual-full"><span>メモ（任意）</span><textarea id="ad-actual-note" rows="2" placeholder="補足説明"></textarea></label>' +
        '<div class="ad-actual-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="ad-actual-cancel">キャンセル</button>' +
          '<button type="submit" class="btn btn-primary btn-sm">保存</button>' +
        '</div>' +
      '</form>';
    document.getElementById('ad-actual-title').focus();
    document.getElementById('ad-actual-cancel').addEventListener('click', () => { slot.innerHTML = ''; });
    document.getElementById('ad-actual-form').addEventListener('submit', e => {
      e.preventDefault();
      submitActual(agentId);
    });
  }

  async function submitActual(agentId) {
    if (!state.me) { toast('まず「私」を選択してください', 'err'); openMeModal(); return; }
    const actual = {
      agentId,
      date: document.getElementById('ad-actual-date').value,
      hours: Number(document.getElementById('ad-actual-hours').value) || 0,
      category: document.getElementById('ad-actual-category').value,
      title: document.getElementById('ad-actual-title').value.trim(),
      outputs: document.getElementById('ad-actual-outputs').value.split(',').map(s => s.trim()).filter(Boolean),
      note: document.getElementById('ad-actual-note').value.trim(),
    };
    if (!actual.title) { toast('タイトルを入力してください', 'err'); return; }
    try {
      const r = await gasCall({ action: 'addActual', password: state.password, actor: state.me, actual });
      if (r && r.ok) {
        toast('実績を追加しました', 'ok');
        await loadActualsDynamic();
        selectAgent(agentId);
      } else {
        toast('保存エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  async function onDeleteActual(id) {
    if (!id) return;
    if (!confirm('この実績を削除しますか？')) return;
    try {
      const r = await gasCall({ action: 'deleteActual', password: state.password, actor: state.me, id });
      if (r && r.ok) {
        toast('削除しました', 'ok');
        await loadActualsDynamic();
        if (state.currentAgentId) selectAgent(state.currentAgentId);
      } else {
        toast('エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  async function loadActualsDynamic() {
    if (!GAS_WEBAPP_URL) return;
    try {
      const r = await gasCall({ action: 'listActuals', password: state.password });
      if (r && r.ok) state.actualsDynamic = r.actuals || [];
    } catch (_) {}
  }

  async function loadPlansDynamic() {
    if (!GAS_WEBAPP_URL) return;
    try {
      const r = await gasCall({ action: 'listPlans', password: state.password });
      if (r && r.ok) state.plansDynamic = r.plans || [];
    } catch (_) {}
  }

  function openPlanForm(agentId) {
    const slot = document.getElementById('ad-add-plan-slot');
    if (!slot) return;
    const dueDefault = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    slot.innerHTML =
      '<form id="ad-plan-form" class="ad-actual-form">' +
        '<div class="ad-actual-grid">' +
          '<label><span>期限</span><input type="date" id="ad-plan-due" value="' + dueDefault + '" required></label>' +
          '<label><span>優先度</span><select id="ad-plan-priority" required>' +
            ['中','高','低'].map(p => '<option value="' + p + '">' + p + '</option>').join('') +
          '</select></label>' +
          '<label><span>カテゴリ</span><select id="ad-plan-category" required>' +
            ['実装','保守','レポート','分析','会議','広報','事務','調査','その他']
              .map(c => '<option value="' + c + '">' + c + '</option>').join('') +
          '</select></label>' +
        '</div>' +
        '<label class="ad-actual-full"><span>タイトル（やってほしいこと）</span><input type="text" id="ad-plan-title" required placeholder="例: 7月の活動を Threads 用に告知文化" maxlength="120"></label>' +
        '<label class="ad-actual-full"><span>詳細メモ（具体的な要件・参考情報）</span><textarea id="ad-plan-note" rows="3" placeholder="背景・希望する成果・参考リンク等"></textarea></label>' +
        '<div class="ad-actual-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="ad-plan-cancel">キャンセル</button>' +
          '<button type="submit" class="btn btn-primary btn-sm">＋ 依頼を送信（メール通知）</button>' +
        '</div>' +
      '</form>';
    document.getElementById('ad-plan-title').focus();
    document.getElementById('ad-plan-cancel').addEventListener('click', () => { slot.innerHTML = ''; });
    document.getElementById('ad-plan-form').addEventListener('submit', e => {
      e.preventDefault();
      submitPlan(agentId);
    });
  }

  async function submitPlan(agentId) {
    if (!state.me) { toast('まず「私」を選択してください', 'err'); openMeModal(); return; }
    const plan = {
      agentId,
      createdBy: state.me,
      due: document.getElementById('ad-plan-due').value,
      title: document.getElementById('ad-plan-title').value.trim(),
      category: document.getElementById('ad-plan-category').value,
      priority: document.getElementById('ad-plan-priority').value,
      note: document.getElementById('ad-plan-note').value.trim(),
      status: 'pending',
    };
    if (!plan.title) { toast('タイトルを入力してください', 'err'); return; }
    try {
      const r = await gasCall({ action: 'addPlan', password: state.password, actor: state.me, plan });
      if (r && r.ok) {
        const mailMsg = r.mail && r.mail.sent
          ? '依頼を追加しました（メール通知済）'
          : '依頼を追加しました（メール通知は失敗：NOTIFY_EMAIL 未設定の可能性）';
        toast(mailMsg, 'ok');
        await loadPlansDynamic();
        selectAgent(agentId);
      } else {
        toast('保存エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  async function onDeletePlan(id) {
    if (!id) return;
    if (!confirm('この予定を削除しますか？（依頼を取り下げる場合）')) return;
    try {
      const r = await gasCall({ action: 'deletePlan', password: state.password, actor: state.me, id });
      if (r && r.ok) {
        toast('削除しました', 'ok');
        await loadPlansDynamic();
        if (state.currentAgentId) selectAgent(state.currentAgentId);
      } else {
        toast('エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  function openCompletePlanForm(planId, agentId) {
    const slot = document.getElementById('ad-complete-plan-slot');
    if (!slot) return;
    const plan = (state.plansDynamic || []).find(p => p.id === planId);
    if (!plan) { toast('予定が見つかりません', 'err'); return; }
    const today = new Date().toISOString().slice(0, 10);
    slot.innerHTML =
      '<form id="ad-complete-plan-form" class="ad-actual-form is-complete">' +
        '<div class="ad-complete-banner">完了として記録: <strong>' + escape(plan.title || '') + '</strong></div>' +
        '<div class="ad-actual-grid">' +
          '<label><span>実施日</span><input type="date" id="ad-cp-date" value="' + today + '" required></label>' +
          '<label><span>工数 (h)</span><input type="number" id="ad-cp-hours" step="0.1" min="0" value="0.5" required></label>' +
          '<label><span>カテゴリ</span><select id="ad-cp-category" required>' +
            ['実装','保守','レポート','分析','会議','広報','事務','調査','その他']
              .map(c => '<option value="' + c + '"' + (c === plan.category ? ' selected' : '') + '>' + c + '</option>').join('') +
          '</select></label>' +
        '</div>' +
        '<label class="ad-actual-full"><span>タイトル（実績として）</span><input type="text" id="ad-cp-title" required value="' + escape(plan.title || '') + '" maxlength="120"></label>' +
        '<label class="ad-actual-full"><span>成果物（カンマ区切り）</span><input type="text" id="ad-cp-outputs" placeholder="例: site/admin/admin.js, cbi-admin-gas/Code.gs"></label>' +
        '<label class="ad-actual-full"><span>補足メモ</span><textarea id="ad-cp-note" rows="2" placeholder="完了時の所感・残課題">' + escape(plan.note || '') + '</textarea></label>' +
        '<div class="ad-actual-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="ad-cp-cancel">キャンセル</button>' +
          '<button type="submit" class="btn btn-primary btn-sm">✅ 完了として記録（実績に移動）</button>' +
        '</div>' +
      '</form>';
    document.getElementById('ad-cp-title').focus();
    document.getElementById('ad-cp-cancel').addEventListener('click', () => { slot.innerHTML = ''; });
    document.getElementById('ad-complete-plan-form').addEventListener('submit', e => {
      e.preventDefault();
      submitCompletePlan(planId, agentId);
    });
  }

  async function submitCompletePlan(planId, agentId) {
    if (!state.me) { toast('まず「私」を選択してください', 'err'); openMeModal(); return; }
    const actual = {
      date: document.getElementById('ad-cp-date').value,
      hours: Number(document.getElementById('ad-cp-hours').value) || 0,
      category: document.getElementById('ad-cp-category').value,
      title: document.getElementById('ad-cp-title').value.trim(),
      outputs: document.getElementById('ad-cp-outputs').value.split(',').map(s => s.trim()).filter(Boolean),
      note: document.getElementById('ad-cp-note').value.trim(),
    };
    if (!actual.title) { toast('タイトルを入力してください', 'err'); return; }
    try {
      const r = await gasCall({ action: 'completePlan', password: state.password, actor: state.me, id: planId, actual });
      if (r && r.ok) {
        toast('完了として記録し、実績に移動しました', 'ok');
        await Promise.all([loadPlansDynamic(), loadActualsDynamic()]);
        selectAgent(agentId);
      } else {
        toast('エラー: ' + (r && r.error), 'err');
      }
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    }
  }

  async function loadA8Usage() {
    const slot = document.getElementById('a8-ai-usage-slot');
    if (!slot || !GAS_WEBAPP_URL) return;
    try {
      const budgetOverride = Number(localStorage.getItem('cbi_a8_budget_override')) || 0;
      const r = await gasCall({
        action: 'getAiUsage',
        password: state.password,
        budgetOverride: budgetOverride > 0 ? budgetOverride : undefined,
      });
      if (!r || !r.ok) {
        slot.innerHTML = '<h4>📊 AI利用量モニタリング</h4><p class="wl-empty">取得失敗: ' + escape((r && r.error) || 'unknown') + '</p>';
        return;
      }
      slot.innerHTML = renderA8UsageHtml(r);
      bindA8BudgetEditor(r);
    } catch (err) {
      slot.innerHTML = '<h4>📊 AI利用量モニタリング</h4><p class="wl-empty">通信エラー: ' + escape(err.message) + '</p>';
    }
  }

  function bindA8BudgetEditor(usageData) {
    const editBtn = document.getElementById('a8-budget-edit');
    const resetBtn = document.getElementById('a8-budget-reset');
    const notifyBtn = document.getElementById('a8-notify-test');
    if (editBtn) editBtn.addEventListener('click', () => openA8BudgetInput(usageData.budgetJPY));
    if (resetBtn) resetBtn.addEventListener('click', () => {
      localStorage.removeItem('cbi_a8_budget_override');
      toast('予算枠の上書きを解除しました', 'ok');
      loadA8Usage();
    });
    if (notifyBtn) notifyBtn.addEventListener('click', () => onA8NotifyTest(notifyBtn));
    // 通知先情報を取得して表示
    loadA8NotifyConfig();
  }

  async function loadA8NotifyConfig() {
    const slot = document.getElementById('a8-notify-status');
    if (!slot) return;
    try {
      const r = await gasCall({ action: 'getNotifyConfig', password: state.password });
      if (!r || !r.ok) return;
      const recipients = r.recipients || [];
      if (!recipients.length) {
        slot.innerHTML = '<span class="a8-notify-warn">⚠ 通知先未設定（GASのスクリプトプロパティ <code>NOTIFY_EMAIL</code> を設定）</span>';
      } else {
        slot.innerHTML = '通知先: <strong>' + escape(recipients.join(', ')) + '</strong>' +
          (r.quotaRemaining >= 0 ? ' <span class="a8-notify-quota">本日の送信可能数: ' + r.quotaRemaining + '通</span>' : '');
      }
    } catch (_) {}
  }

  async function onA8NotifyTest(btn) {
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ 送信中…';
    try {
      const budgetOverride = Number(localStorage.getItem('cbi_a8_budget_override')) || 0;
      const r = await gasCall({
        action: 'notifyTest',
        password: state.password,
        budgetOverride: budgetOverride > 0 ? budgetOverride : undefined,
      });
      if (!r || !r.ok) {
        const msg = r && (r.hint || r.error) || '不明なエラー';
        toast('通知エラー: ' + msg, 'err');
        if (r && r.error === 'no_recipients') {
          alert('通知先メールが未設定です。\n\nGASエディタで\n「プロジェクトの設定 → スクリプトプロパティ」\nに NOTIFY_EMAIL = メールアドレス を追加してください。\n（複数指定はカンマ区切り：a@x.com,b@x.com）');
        }
        return;
      }
      toast('テスト通知を送信しました（' + (r.sentTo || []).join(', ') + '）', 'ok');
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  function openA8BudgetInput(currentJPY) {
    const row = document.getElementById('a8-budget-row');
    if (!row) return;
    row.innerHTML =
      '<form id="a8-budget-form" class="a8-budget-form">' +
        '<label>月予算 ¥</label>' +
        '<input type="number" id="a8-budget-input" min="0.01" step="0.01" value="' + Number(currentJPY) + '" autofocus>' +
        '<button type="submit" class="btn btn-primary btn-sm">保存</button>' +
        '<button type="button" id="a8-budget-cancel" class="btn btn-ghost btn-sm">キャンセル</button>' +
        '<span class="a8-budget-hint">テスト用に小数も可（例: 0.5 で約128% → 赤アラート）</span>' +
      '</form>';
    document.getElementById('a8-budget-input').focus();
    document.getElementById('a8-budget-input').select();
    document.getElementById('a8-budget-cancel').addEventListener('click', () => loadA8Usage());
    document.getElementById('a8-budget-form').addEventListener('submit', e => {
      e.preventDefault();
      const v = Number(document.getElementById('a8-budget-input').value);
      if (!v || v <= 0) { toast('0より大きい数値を入力してください', 'err'); return; }
      localStorage.setItem('cbi_a8_budget_override', String(v));
      toast('月予算を ¥' + v.toLocaleString('ja-JP') + ' に上書きしました', 'ok');
      loadA8Usage();
    });
  }

  function renderA8UsageHtml(d) {
    const fmt = n => Number(n || 0).toLocaleString('ja-JP');
    const yen = n => '¥' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString('ja-JP');
    const alertClass = 'a8-alert a8-alert-' + (d.alert && d.alert.level || 'normal');
    const alertMsg = ({
      normal:   '✅ 予算枠の80%未満で安全圏内',
      caution:  '⚠ 予算枠の80%超過。今月の支出を注視',
      warning:  '⚠ 予算枠の100%に到達。次月以降の調整検討',
      critical: '🚨 予算枠120%超過。即座に対応が必要',
    })[(d.alert && d.alert.level) || 'normal'];

    const tm = d.thisMonth || {};
    const lm = d.lastMonth || {};
    const at = d.allTime || {};

    const byActionRows = Object.keys(tm.byAction || {}).map(k =>
      '<tr><td>' + escape(k) + '</td><td class="num">' + fmt(tm.byAction[k]) + '</td></tr>'
    ).join('');
    const byAgentRows = Object.keys(tm.byAgent || {}).sort().map(k =>
      '<tr><td>' + escape(k) + '</td><td class="num">' + fmt(tm.byAgent[k]) + '</td></tr>'
    ).join('');

    const recentRows = (d.recent || []).map(r =>
      '<tr><td>' + escape(String(r.createdAt || '').slice(0, 16).replace('T', ' ')) + '</td>' +
      '<td>' + escape(r.action || '') + '</td>' +
      '<td>' + escape(r.agentId || '—') + '</td>' +
      '<td class="num">' + fmt(r.totalTokens) + '</td>' +
      '<td class="num">' + yen(r.estimatedCostJPY) + '</td></tr>'
    ).join('');

    const isOverride = (d.budget && d.budget.source === 'inline_override');
    const budgetRowHtml = '<div id="a8-budget-row" class="a8-budget-row">' +
      '月予算 <strong>' + yen(d.budgetJPY) + '</strong>' +
      (isOverride ? '<span class="a8-budget-override-tag">テスト上書き中</span>' : '') +
      ' <button type="button" id="a8-budget-edit" class="a8-budget-btn" title="月予算を変更">✎ 編集</button>' +
      (isOverride ? ' <button type="button" id="a8-budget-reset" class="a8-budget-btn a8-budget-reset" title="本来の予算枠に戻す">↺ 解除</button>' : '') +
      ' <button type="button" id="a8-notify-test" class="a8-budget-btn" title="現在の状態でアラート通知メールを送信">📧 テスト通知</button>' +
      ' <span id="a8-notify-status" class="a8-notify-status"></span>' +
      '</div>';

    return '<h4>📊 AI利用量モニタリング</h4>' +
      budgetRowHtml +
      '<div class="' + alertClass + '"><strong>' + escape(alertMsg) + '</strong><br>' +
        '今月利用率: <strong>' + (d.alert && d.alert.usageRate || 0) + '%</strong>' +
        '（月予算 ' + yen(d.budgetJPY) + ' に対する概算）</div>' +
      '<div class="a8-card-grid">' +
        '<div class="a8-card"><div class="a8-card-label">今月（' + escape(tm.label || '') + '）</div>' +
          '<div class="a8-card-big">' + fmt(tm.totalTokens) + ' <span class="a8-card-unit">tokens</span></div>' +
          '<div class="a8-card-sub">' + fmt(tm.count) + ' 回 / 概算 ' + yen(tm.costJPY) + '</div></div>' +
        '<div class="a8-card"><div class="a8-card-label">前月（' + escape(lm.label || '') + '）</div>' +
          '<div class="a8-card-big">' + fmt(lm.totalTokens) + ' <span class="a8-card-unit">tokens</span></div>' +
          '<div class="a8-card-sub">' + fmt(lm.count) + ' 回 / 概算 ' + yen(lm.costJPY) + '</div></div>' +
        '<div class="a8-card"><div class="a8-card-label">累計</div>' +
          '<div class="a8-card-big">' + fmt(at.totalTokens) + ' <span class="a8-card-unit">tokens</span></div>' +
          '<div class="a8-card-sub">' + fmt(at.count) + ' 回 / 概算 ' + yen(at.costJPY) + '</div></div>' +
      '</div>' +
      (byActionRows ? '<div class="a8-tables">' +
        '<div><h5>今月：機能別トークン数</h5><table class="a8-table"><thead><tr><th>機能</th><th class="num">トークン</th></tr></thead><tbody>' + byActionRows + '</tbody></table></div>' +
        (byAgentRows ? '<div><h5>今月：エージェント別トークン数</h5><table class="a8-table"><thead><tr><th>エージェント</th><th class="num">トークン</th></tr></thead><tbody>' + byAgentRows + '</tbody></table></div>' : '') +
        '</div>' : '') +
      (recentRows ? '<details class="a8-recent"><summary>直近の利用ログ（最新7件）</summary>' +
        '<table class="a8-table"><thead><tr><th>時刻</th><th>機能</th><th>エージェント</th><th class="num">トークン</th><th class="num">概算</th></tr></thead><tbody>' + recentRows + '</tbody></table>' +
        '</details>' : '') +
      '<p class="a8-note">' + escape(d.pricingNote || '') + '</p>';
  }

  // ---------- Worklog helpers ----------
  function getWorklogFor(agentId) {
    if (!state.worklog || !state.worklog.agents) return { actuals: [], plans: [] };
    return state.worklog.agents[agentId] || { actuals: [], plans: [] };
  }

  function renderWorklogActual(x) {
    const outputsList = Array.isArray(x.outputs) ? x.outputs : (x.outputs ? [x.outputs] : []);
    const outputsHtml = outputsList.length
      ? '<div class="wl-outputs">成果物: ' + outputsList.map(o => '<code>' + escape(o) + '</code>').join(' ') + '</div>'
      : '';
    const hoursHtml = x.hours ? '<span class="wl-tag">' + Number(x.hours).toFixed(1) + 'h</span>' : '';
    const isDynamic = (x._source === 'dynamic');
    const sourceBadge = isDynamic
      ? '<span class="wl-source-tag wl-source-dyn" title="リアルタイム記録">📝 動的</span>'
      : '<span class="wl-source-tag wl-source-json" title="worklog.json で手動管理">📄 静的</span>';
    const approveHtml = isDynamic
      ? '<button type="button" class="wl-del-dyn" data-actual-id="' + escape(x.id || '') + '" title="この実績を削除">✕</button>'
      : (x.partnerApproved
          ? '<span class="wl-approve">承認済</span>'
          : '<span class="wl-approve is-pending">承認待</span>');
    return '<div class="wl-item is-actual' + (isDynamic ? ' is-dynamic' : '') + '">' +
      '<span class="wl-date">' + escape(x.date || '') + '</span>' +
      '<div class="wl-main">' +
        '<div class="wl-title">' + escape(x.title || '') + ' ' + sourceBadge + '</div>' +
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
    const isDynamic = (x._source === 'dynamic');
    const sourceBadge = isDynamic
      ? '<span class="wl-source-tag wl-source-dyn" title="管理画面から追加された依頼">📝 依頼</span>'
      : '<span class="wl-source-tag wl-source-json" title="worklog.json で手動管理">📄 静的</span>';
    const createdByHtml = isDynamic && x.createdBy
      ? '<div class="wl-by">依頼者: ' + escape(x.createdBy) + '</div>'
      : '';
    const actionsHtml = isDynamic
      ? '<button type="button" class="wl-complete-plan" data-plan-id="' + escape(x.id || '') + '" title="完了として記録（実績に移動）">✅</button>' +
        '<button type="button" class="wl-del-plan" data-plan-id="' + escape(x.id || '') + '" title="この予定を削除">✕</button>'
      : '';
    return '<div class="wl-item is-plan' + (isDynamic ? ' is-dynamic' : '') + '">' +
      '<span class="wl-date">〜' + escape(x.due || '') + '</span>' +
      '<div class="wl-main">' +
        '<div class="wl-title">' + escape(x.title || '') + ' ' + sourceBadge + '</div>' +
        (x.note ? '<div class="wl-note">' + escape(x.note) + '</div>' : '') +
        createdByHtml +
      '</div>' +
      '<div class="wl-tags">' +
        '<span class="wl-tag c-' + escape(x.category || 'その他') + '">' + escape(x.category || 'その他') + '</span>' +
        (x.priority ? '<span class="wl-prio p-' + escape(x.priority) + '">優先度 ' + escape(x.priority) + '</span>' : '') +
        actionsHtml +
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
        '<p class="pp-eyebrow">COMMUNITY BANK INZAI / 印西「このゆびとまれ」プロジェクト</p>' +
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
  // サイト掲載中のお知らせ（news-data.json）一覧＋削除。
  // 削除は GAS 経由で repository_dispatch（news-delete）→ Actions が反映（数分かかる）。
  async function loadNewsAdmin() {
    const list = $('news-admin-list');
    try {
      const res = await fetch('../news-data.json', { cache: 'no-store' });
      const data = await res.json();
      const items = data.items || [];
      $('news-admin-updated').textContent = data.updated ? ('更新: ' + data.updated) : '';
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<p class="empty">自動掲載されたお知らせはまだありません</p>';
        return;
      }
      items.forEach(item => list.appendChild(renderNewsAdminItem(item)));
    } catch (err) {
      list.innerHTML = '<p class="empty">お知らせを読み込めませんでした（' + escape(err.message) + '）</p>';
    }
  }

  function renderNewsAdminItem(item) {
    const fullText = (item.text || '') +
      (item.link && item.link.label ? item.link.label : '') +
      (item.text_after || '');
    const row = document.createElement('div');
    row.className = 'cl-item t-content';
    row.innerHTML =
      '<div class="cl-side">' +
        '<span class="cl-date">' + escape(item.date || '') + '</span>' +
        '<span class="cl-type">' + escape(item.tag || 'お知らせ') + '</span>' +
      '</div>' +
      '<div class="cl-main">' +
        '<div class="cl-title">' + escape(fullText) + '</div>' +
        '<div class="cl-author"><button type="button" class="btn btn-sm news-del-btn">🗑 サイトから削除</button></div>' +
      '</div>';
    row.querySelector('.news-del-btn').addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      if (!confirm('「' + fullText + '」をサイトから削除しますか？\n（反映まで数分かかります）')) return;
      btn.disabled = true;
      btn.textContent = '送信中…';
      try {
        const r = await gasCall({
          action: 'newsDelete',
          password: state.password,
          id: item.id || '',
          date: item.date || '',
          text: item.text || '',
        });
        if (r.ok) {
          btn.textContent = '削除受付済み（数分で反映）';
          row.style.opacity = '0.45';
          toast('削除を受け付けました。数分でサイトと一覧から消えます', 'ok');
        } else {
          btn.disabled = false;
          btn.textContent = '🗑 サイトから削除';
          toast('削除に失敗: ' + (r.error || '不明なエラー'), 'err');
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '🗑 サイトから削除';
        toast('削除に失敗: ' + err.message, 'err');
      }
    });
    return row;
  }

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
      // エージェント定義をバックグラウンドで読み込み（投稿者プルダウン用）
      if (!state.agentsLoaded) loadAgents();
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

    // 全カード追加後に本文クランプ判定（DOM追加 → CSS適用 → レイアウト確定後でないとscrollHeight等が誤値）
    // setTimeout でフォント・CSS適用完了を確実に待つ
    setTimeout(() => {
      list.querySelectorAll('.idea-card').forEach(card => {
        const body = card.querySelector('.idea-body');
        const bt = card.querySelector('.idea-body-toggle');
        if (!body || !bt) return;
        void body.offsetHeight; // 強制reflow
        if (body.scrollHeight - body.clientHeight > 2) {
          bt.classList.remove('is-hidden');
        }
      });
    }, 50);
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

    // 本文展開トグル（3行を超える場合のみ表示）
    const bodyToggle = document.createElement('button');
    bodyToggle.type = 'button';
    bodyToggle.className = 'idea-body-toggle is-hidden';
    bodyToggle.textContent = '本文を全文表示';
    bodyToggle.addEventListener('click', () => {
      const expanded = card.classList.toggle('is-body-expanded');
      bodyToggle.textContent = expanded ? '本文を折りたたむ' : '本文を全文表示';
    });
    card.appendChild(bodyToggle);
    // 省略判定はrenderListの末尾で一括実行（DOM追加後でないとscrollHeight等が0になるため）

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

    const aiBtn = document.createElement('button');
    aiBtn.className = 'btn btn-ai btn-sm';
    aiBtn.title = 'コメント全員の主張を踏まえてAIが最終とりまとめ本文を生成します';
    aiBtn.innerHTML = '🤝 AIで最終とりまとめ';
    aiBtn.disabled = commentCount === 0;
    if (commentCount === 0) aiBtn.title = 'コメントが付くと使えます';
    aiBtn.addEventListener('click', () => onAiRevise(idea, aiBtn));
    actions.appendChild(aiBtn);

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
      const author = currentAgent ? agentAuthorLabel(currentAgent) : state.me;
      if (!author) {
        toast('まず「私」を選択するか、エージェントに聞いてください', 'err');
        openMeModal();
        return;
      }
      btn.disabled = true;
      ta.disabled = true;
      try {
        const r = await gasCall({
          action: 'addComment',
          password: state.password,
          actor: state.me || author, // 操作ログ用（誰が押したか）
          comment: { ideaId, author, body },
        });
        if (r && r.ok) {
          ta.value = '';
          toast(currentAgent ? (currentAgent.id + ' として投稿しました') : 'コメントを送信しました', 'ok');
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

    // クロージャで「このコメントを誰として送るか」を保持
    // null なら state.me（人間）、agentオブジェクトならその名義で送信
    let currentAgent = findAgentByMeName(state.me); // 「私」がAIならそれを初期値に

    function updateUiForAgent() {
      if (currentAgent) {
        ta.placeholder = '🤖 ' + currentAgent.id + ' ' + (currentAgent.codename || '') + ' として送信…';
        btn.textContent = '🤖 ' + currentAgent.id + ' として送信';
        btn.classList.add('comment-send-agent');
        cancelBtn.hidden = false;
      } else {
        ta.placeholder = state.me ? (state.me + ' としてコメントを送る…') : 'コメント…';
        btn.textContent = '送信';
        btn.classList.remove('comment-send-agent');
        cancelBtn.hidden = true;
      }
    }

    // エージェント選択ボタン＋ドロップダウン
    const askWrap = document.createElement('div');
    askWrap.className = 'comment-ask-wrap';
    const askBtn = document.createElement('button');
    askBtn.type = 'button';
    askBtn.className = 'comment-ai-btn';
    askBtn.innerHTML = '✨ エージェントに聞く <span class="ask-caret">▾</span>';
    askBtn.title = 'エージェントを選ぶと、その立場の意見をAIが生成→そのエージェント名義で投稿できます';
    const menu = document.createElement('div');
    menu.className = 'comment-ask-menu';
    menu.hidden = true;

    function buildMenu() {
      menu.innerHTML = '';
      const agents = (state.agents || []);
      if (!agents.length) {
        const empty = document.createElement('div');
        empty.className = 'comment-ask-empty';
        empty.textContent = 'エージェント定義を読み込み中…';
        menu.appendChild(empty);
        return;
      }
      agents.forEach(a => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'comment-ask-item';
        item.innerHTML =
          '<strong>🤖 ' + escape(a.id) + ' ' + escape(a.codename || '') + '</strong>' +
          '<span class="comment-ask-item-sub">' + escape((a.role || '').slice(0, 36)) + '</span>';
        item.addEventListener('click', async () => {
          menu.hidden = true;
          currentAgent = a;
          updateUiForAgent();
          await onAiComment(ideaId, ta, askBtn, a);
        });
        menu.appendChild(item);
      });
    }

    askBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (menu.hidden) buildMenu();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', () => { menu.hidden = true; });

    askWrap.appendChild(askBtn);
    askWrap.appendChild(menu);

    // 解除ボタン（エージェントモード時のみ表示）
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'comment-agent-cancel';
    cancelBtn.title = 'エージェント名義を解除';
    cancelBtn.textContent = '✕';
    cancelBtn.hidden = true;
    cancelBtn.addEventListener('click', () => {
      currentAgent = findAgentByMeName(state.me); // state.me がAIなら戻す、それ以外はクリア
      updateUiForAgent();
    });

    row.appendChild(askWrap);
    row.appendChild(ta);
    row.appendChild(cancelBtn);
    row.appendChild(btn);
    wrap.appendChild(row);

    updateUiForAgent();
    return wrap;

    // send関数内で参照するため、ここに上書き定義
    function _ignored() {} // dummy to keep linter happy with hoisting note
  }

  async function onAiComment(ideaId, ta, btn, agent) {
    if (!GAS_WEBAPP_URL) { toast('GAS未接続のためAI機能を利用できません', 'err'); return; }
    const wl = state.worklog && state.worklog.agents && state.worklog.agents[agent.id];
    const agentInfo = {
      id: agent.id,
      codename: agent.codename || '',
      role: agent.role || '',
      partner: agent.partner || '',
      summary: agent.summary || '',
      duties: agent.duties || [],
      knowledge_summary: agent.knowledge_summary || '',
      actuals: (wl && wl.actuals) || [],
    };

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳';
    ta.disabled = true;
    try {
      const r = await gasCall({
        action: 'aiComment',
        password: state.password,
        actor: state.me,
        ideaId,
        agentInfo,
      });
      if (!r || !r.ok) {
        const errMsg = r && (r.hint || r.error) || '不明なエラー';
        toast('AIエラー: ' + errMsg, 'err');
        console.error('[aiComment] error response:', r);
        if (r && r.detail) {
          alert('AIエラー詳細：\n\nerror: ' + r.error + '\nstatus: ' + (r.status || 'n/a') + '\n\ndetail:\n' + r.detail);
        }
        return;
      }
      ta.value = (r.comment || '').trim();
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
      ta.focus();
      toast('AI意見を生成しました。確認して送信してください', 'ok');
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
      ta.disabled = false;
    }
  }

  function renderBubble(c) {
    const row = document.createElement('div');
    const isMe = state.me && c.author === state.me;
    row.className = 'comment-bubble-row' + (isMe ? ' is-me' : '');

    const av = document.createElement('div');
    av.className = 'comment-avatar';
    const isAgent = /\bA\d+\b/.test(String(c.author || ''));
    if (isAgent) {
      av.textContent = String(c.author).match(/\bA\d+\b/)[0];
      av.classList.add('comment-avatar-agent');
    } else {
      av.textContent = (c.author || '?').slice(0, 1);
    }
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
  // AI でエージェントから新規アイデアを提案させる（Gemini）
  // =========================================================
  function getSelectedAgent() {
    const sel = $('idea-author');
    if (!sel || !state.agents) return null;
    const opt = sel.selectedOptions && sel.selectedOptions[0];
    const id = opt && opt.dataset && opt.dataset.agentId;
    if (!id) return null;
    return state.agents.find(a => a.id === id) || null;
  }

  function updateAiSuggestButton() {
    const btn = document.getElementById('form-ai-suggest');
    if (!btn) return;
    const agent = getSelectedAgent();
    btn.disabled = !agent;
    btn.title = agent
      ? agent.id + ' ' + (agent.codename || '') + ' として今後実施すべきアイデアを生成します'
      : 'AIエージェントを投稿者に選ぶと有効になります';
  }

  async function onAiSuggest() {
    const btn = document.getElementById('form-ai-suggest');
    const agent = getSelectedAgent();
    if (!agent) { toast('AIエージェントを投稿者に選んでください', 'err'); return; }
    if (!GAS_WEBAPP_URL) { toast('GAS未接続のためAI機能を利用できません', 'err'); return; }

    // 該当エージェントのワーキングログから実績・予定を抽出
    const wl = state.worklog && state.worklog.agents && state.worklog.agents[agent.id];
    const agentInfo = {
      id: agent.id,
      codename: agent.codename || '',
      role: agent.role || '',
      partner: agent.partner || '',
      summary: agent.summary || '',
      duties: agent.duties || [],
      knowledge_summary: agent.knowledge_summary || '',
      actuals: (wl && wl.actuals) || [],
      plans: (wl && wl.plans) || [],
    };

    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ AI生成中…';
    try {
      const r = await gasCall({
        action: 'aiSuggest',
        password: state.password,
        actor: state.me,
        agentInfo,
      });
      if (!r || !r.ok) {
        const errMsg = r && (r.hint || r.error) || '不明なエラー';
        toast('AIエラー: ' + errMsg, 'err');
        console.error('[aiSuggest] error response:', r);
        if (r && r.detail) {
          alert('AIエラー詳細：\n\nerror: ' + r.error + '\nstatus: ' + (r.status || 'n/a') + '\n\ndetail:\n' + r.detail);
        }
        return;
      }
      const s = r.suggestion || {};
      $('idea-title').value = s.title || '';
      $('idea-body').value = s.body || '';
      const catSel = $('idea-category');
      const catValues = Array.from(catSel.options).map(o => o.value);
      catSel.value = catValues.includes(s.category) ? s.category : 'その他';
      $('idea-status').value = s.status || '検討中';
      $('idea-title').focus();
      toast('AI提案を生成しました。内容を確認して投稿してください', 'ok');
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
      updateAiSuggestButton();
    }
  }

  // =========================================================
  // AI でコメントを本文に反映（Gemini）
  // =========================================================
  async function onAiRevise(idea, btn) {
    if (!GAS_WEBAPP_URL) { toast('GAS未接続のためAI機能を利用できません', 'err'); return; }
    if (!state.me) { toast('まず「私」を選択してください', 'err'); openMeModal(); return; }
    const commentCount = (state.commentsByIdea[idea.id] || []).length;
    if (!commentCount) { toast('コメントがありません', 'err'); return; }

    const originalLabel = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ AI生成中…'; }

    try {
      const r = await gasCall({
        action: 'aiRevise',
        password: state.password,
        actor: state.me,
        ideaId: idea.id,
      });
      if (!r || !r.ok) {
        const errMsg = r && (r.hint || r.error) || '不明なエラー';
        toast('AIエラー: ' + errMsg, 'err');
        console.error('[aiRevise] error response:', r);
        if (r && r.error === 'no_api_key') {
          alert('Gemini APIキーが未設定です。\n\nGoogle AI Studio (https://aistudio.google.com/) でAPIキーを取得し、\nGASの「プロジェクトの設定」→「スクリプトプロパティ」で\nGEMINI_API_KEY として保存してください。');
        } else if (r && r.detail) {
          alert('AIエラー詳細：\n\nerror: ' + r.error + '\nstatus: ' + (r.status || 'n/a') + '\n\ndetail:\n' + r.detail);
        }
        return;
      }
      openAiDiffModal(idea, r.originalBody || '', r.revisedBody || '');
    } catch (err) {
      toast('通信エラー: ' + err.message, 'err');
    } finally {
      if (btn) { btn.disabled = commentCount === 0; btn.innerHTML = originalLabel; }
    }
  }

  function openAiDiffModal(idea, original, revised) {
    const modal = $('ai-diff-modal');
    if (!modal) { console.error('ai-diff-modal not found'); return; }
    $('ai-diff-title').textContent = idea.title || '(無題)';
    $('ai-diff-original').textContent = original;
    $('ai-diff-revised').textContent = revised;
    renderAiDiff(original, revised);
    modal.hidden = false;

    const okBtn = $('ai-diff-apply');
    const cancelBtn = $('ai-diff-cancel');
    const closeBtn = $('ai-diff-close');

    const close = () => {
      modal.hidden = true;
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
    };
    cancelBtn.onclick = close;
    closeBtn.onclick = close;

    okBtn.onclick = async () => {
      okBtn.disabled = true;
      okBtn.textContent = '保存中…';
      try {
        const r = await gasCall({
          action: 'update',
          password: state.password,
          actor: state.me,
          idea: { id: idea.id, body: revised },
        });
        if (r && r.ok) {
          toast('本文を更新しました', 'ok');
          close();
          await loadAll();
        } else {
          toast('保存エラー: ' + (r && r.error), 'err');
        }
      } catch (err) {
        toast('通信エラー: ' + err.message, 'err');
      } finally {
        okBtn.disabled = false;
        okBtn.textContent = '✓ この修正案で更新';
      }
    };
  }

  // 行単位の簡易diff（LCSベース）
  function renderAiDiff(original, revised) {
    const a = (original || '').split(/\r?\n/);
    const b = (revised || '').split(/\r?\n/);
    const n = a.length, m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const left = [], right = [];
    let i = n, j = m;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) { left.unshift({ t: 'eq', s: a[i - 1] }); right.unshift({ t: 'eq', s: b[j - 1] }); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) { left.unshift({ t: 'del', s: a[i - 1] }); right.unshift({ t: 'gap', s: '' }); i--; }
      else { left.unshift({ t: 'gap', s: '' }); right.unshift({ t: 'add', s: b[j - 1] }); j--; }
    }
    while (i > 0) { left.unshift({ t: 'del', s: a[i - 1] }); right.unshift({ t: 'gap', s: '' }); i--; }
    while (j > 0) { left.unshift({ t: 'gap', s: '' }); right.unshift({ t: 'add', s: b[j - 1] }); j--; }

    const toHtml = arr => arr.map(x =>
      '<div class="diff-line diff-' + x.t + '">' + (x.s ? escape(x.s) : '&nbsp;') + '</div>'
    ).join('');

    $('ai-diff-original').innerHTML = toHtml(left);
    $('ai-diff-revised').innerHTML = toHtml(right);
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

  // =========================================================
  // メールタブ（communitybankinzai@gmail.com 共有）
  // =========================================================
  const MAIL_LISTW_KEY = 'cbi_admin_mail_listw';

  let mailBound = false;
  function openMailTab() {
    bindMailUI();
    setMobileView('list');       // タブを開いたら一覧画面
    applyMailListWidth();        // 保存幅を復元
    loadMailList();              // 開くたびに最新化
    if (!state.mail.labelsLoaded) loadMailLabels();
  }

  function applyMailListWidth() {
    const layout = document.querySelector('.mail-layout');
    if (!layout) return;
    const saved = parseInt(localStorage.getItem(MAIL_LISTW_KEY) || '0', 10);
    if (saved > 200 && saved < 1200) {
      layout.style.gridTemplateColumns = `220px ${saved}px 6px minmax(360px, 1fr)`;
    }
  }

  function bindMailSplitter() {
    const splitter = $('mail-splitter');
    const layout = document.querySelector('.mail-layout');
    if (!splitter || !layout) return;

    const startDrag = (clientX) => {
      const listPane = layout.querySelector('.mail-list-pane');
      if (!listPane) return null;
      return {
        startX: clientX,
        startW: listPane.getBoundingClientRect().width,
        layoutLeft: layout.getBoundingClientRect().left,
      };
    };

    let ctx = null;

    const onMove = (clientX) => {
      if (!ctx) return;
      const dx = clientX - ctx.startX;
      // 左サイドバー(220px) 分は差し引いて、リスト幅の最小/最大を制限
      const minW = 240;
      const maxW = Math.max(minW + 1, layout.getBoundingClientRect().width - 220 - 6 - 280);
      let w = Math.round(ctx.startW + dx);
      if (w < minW) w = minW;
      if (w > maxW) w = maxW;
      layout.style.gridTemplateColumns = `220px ${w}px 6px minmax(360px, 1fr)`;
    };

    const onMouseMove = (e) => onMove(e.clientX);
    const onTouchMove = (e) => { if (e.touches[0]) onMove(e.touches[0].clientX); };

    const endDrag = () => {
      if (!ctx) return;
      const listPane = layout.querySelector('.mail-list-pane');
      if (listPane) {
        const w = Math.round(listPane.getBoundingClientRect().width);
        localStorage.setItem(MAIL_LISTW_KEY, String(w));
      }
      ctx = null;
      splitter.classList.remove('dragging');
      document.body.classList.remove('mail-splitting');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endDrag);
    };

    splitter.addEventListener('mousedown', (e) => {
      ctx = startDrag(e.clientX);
      if (!ctx) return;
      splitter.classList.add('dragging');
      document.body.classList.add('mail-splitting');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', endDrag);
      e.preventDefault();
    });
    splitter.addEventListener('touchstart', (e) => {
      if (!e.touches[0]) return;
      ctx = startDrag(e.touches[0].clientX);
      if (!ctx) return;
      splitter.classList.add('dragging');
      document.body.classList.add('mail-splitting');
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', endDrag);
    }, { passive: true });

    // ダブルクリックでリセット
    splitter.addEventListener('dblclick', () => {
      layout.style.gridTemplateColumns = '';
      localStorage.removeItem(MAIL_LISTW_KEY);
    });
  }

  function setMobileView(view) {
    state.mail.mobileView = view;
    document.body.classList.remove('mail-view-labels', 'mail-view-list', 'mail-view-detail');
    document.body.classList.add('mail-view-' + view);
    const back = $('mail-mobile-back');
    if (back) back.hidden = (view === 'list');
  }

  function bindMailUI() {
    if (mailBound) return;
    mailBound = true;
    bindMailSplitter();

    document.querySelectorAll('.mail-label-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lbl = btn.dataset.label;
        state.mail.label = lbl;
        state.mail.selectedId = '';
        highlightMailLabel(lbl);
        renderMailDetail(null);
        setMobileView('list');     // ラベル選択後は一覧へ
        loadMailList();
      });
    });

    const refresh = $('mail-refresh');
    if (refresh) refresh.addEventListener('click', loadMailList);

    const compose = $('mail-compose');
    if (compose) compose.addEventListener('click', () => openCompose('new'));
    bindComposeUI();

    const menuBtn = $('mail-mobile-menu');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      setMobileView(state.mail.mobileView === 'labels' ? 'list' : 'labels');
    });
    const backBtn = $('mail-mobile-back');
    if (backBtn) backBtn.addEventListener('click', () => setMobileView('list'));

    const search = $('mail-search');
    if (search) {
      let t = null;
      search.addEventListener('input', () => {
        state.mail.query = search.value.trim();
        clearTimeout(t);
        t = setTimeout(loadMailList, 300);
      });
    }
  }

  function highlightMailLabel(label) {
    document.querySelectorAll('.mail-label-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.label === label);
    });
  }

  async function mailCall(payload) {
    if (!GAS_MAIL_WEBAPP_URL) {
      throw new Error('GAS_MAIL_WEBAPP_URL が未設定です。gas-mail-share/README.md の手順でデプロイしてURLを設定してください。');
    }
    const body = Object.assign({ password: state.password }, payload || {});
    const res = await fetch(GAS_MAIL_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function loadMailList() {
    const listEl = $('mail-list');
    const emptyEl = $('mail-empty');
    const updatedEl = $('mail-updated');
    if (!listEl) return;

    state.mail.loading = true;
    listEl.innerHTML = '<p class="empty">読み込み中…</p>';

    try {
      const r = await mailCall({
        action: 'list',
        label: state.mail.label,
        q: state.mail.query,
      });
      if (!r.ok) throw new Error(r.error || 'unknown');
      state.mail.threads = r.threads || [];
      renderMailList();
      if (updatedEl) updatedEl.textContent = '更新: ' + formatDate(r.fetchedAt);
    } catch (err) {
      listEl.innerHTML = '<p class="empty mail-error">読み込みに失敗しました：' + escapeHtml(err.message) + '</p>';
    } finally {
      state.mail.loading = false;
    }
  }

  async function loadMailLabels() {
    const ul = $('mail-labels-custom');
    if (!ul) return;
    try {
      const r = await mailCall({ action: 'labels' });
      if (!r.ok) throw new Error(r.error || 'unknown');
      const labels = r.labels || [];
      if (!labels.length) {
        ul.innerHTML = '<li class="empty">（ラベルなし）</li>';
      } else {
        ul.innerHTML = labels.map(name =>
          '<li><button type="button" class="mail-label-btn" data-label="' + escapeAttr(name) + '">🏷 ' + escapeHtml(name) + '</button></li>'
        ).join('');
        ul.querySelectorAll('.mail-label-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            state.mail.label = btn.dataset.label;
            state.mail.selectedId = '';
            highlightMailLabel(btn.dataset.label);
            renderMailDetail(null);
            setMobileView('list');
            loadMailList();
          });
        });
      }
      state.mail.labelsLoaded = true;
    } catch (err) {
      ul.innerHTML = '<li class="empty">ラベル取得失敗</li>';
    }
  }

  function renderMailList() {
    const listEl = $('mail-list');
    if (!listEl) return;
    const threads = state.mail.threads;
    if (!threads.length) {
      listEl.innerHTML = '<p class="empty">メールはありません</p>';
      return;
    }
    listEl.innerHTML = threads.map(t => {
      const cls = ['mail-row'];
      if (t.unread) cls.push('unread');
      if (t.id === state.mail.selectedId) cls.push('selected');
      return '<div class="' + cls.join(' ') + '" data-id="' + escapeAttr(t.id) + '">' +
        '<div class="mail-row-from">' +
          (t.starred ? '<span class="mail-star">★</span>' : '') +
          escapeHtml(t.from) +
          (t.msgCount > 1 ? ' <span class="mail-count">(' + t.msgCount + ')</span>' : '') +
        '</div>' +
        '<div class="mail-row-main">' +
          '<div class="mail-row-subject">' + escapeHtml(t.subject) + (t.hasAttach ? ' 📎' : '') + '</div>' +
          '<div class="mail-row-snippet">' + escapeHtml(t.snippet) + '</div>' +
        '</div>' +
        '<div class="mail-row-meta">' +
          '<div class="mail-row-date">' + escapeHtml(formatMailDate(t.date)) + '</div>' +
          (t.labels && t.labels.length ? '<div class="mail-row-labels">' + t.labels.slice(0, 2).map(l => '<span class="mail-tag">' + escapeHtml(l) + '</span>').join('') + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.mail-row').forEach(row => {
      row.addEventListener('click', () => openMailDetail(row.dataset.id));
    });
  }

  async function openMailDetail(id) {
    state.mail.selectedId = id;
    document.querySelectorAll('.mail-row').forEach(r => r.classList.toggle('selected', r.dataset.id === id));
    setMobileView('detail');
    const det = $('mail-detail');
    if (det) det.innerHTML = '<p class="empty">読み込み中…</p>';
    try {
      const r = await mailCall({ action: 'detail', id });
      if (!r.ok) throw new Error(r.error || 'unknown');
      renderMailDetail(r);
    } catch (err) {
      if (det) det.innerHTML = '<p class="empty mail-error">本文取得失敗：' + escapeHtml(err.message) + '</p>';
    }
  }

  function renderMailDetail(data) {
    const det = $('mail-detail');
    if (!det) return;
    state.mail.currentThread = data || null;
    if (!data) {
      det.innerHTML = '<p class="empty mail-detail-empty">← 左の一覧からメールを選択してください</p>';
      return;
    }
    const msgs = data.messages || [];
    det.innerHTML =
      '<div class="mail-detail-head">' +
        '<h3 class="mail-detail-subject">' + escapeHtml(data.subject || '(件名なし)') + '</h3>' +
        '<div class="mail-detail-count">' + msgs.length + ' 通</div>' +
        '<div class="mail-detail-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" id="mail-reply">↩ 返信</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="mail-reply-all">↩↩ 全員に返信</button>' +
        '</div>' +
      '</div>' +
      '<div class="mail-detail-msgs">' +
        msgs.map(m =>
          '<article class="mail-msg">' +
            '<header class="mail-msg-head">' +
              '<div class="mail-msg-from"><strong>' + escapeHtml(m.from) + '</strong></div>' +
              '<div class="mail-msg-date">' + escapeHtml(formatDate(m.date)) + '</div>' +
              '<div class="mail-msg-to">宛先: ' + escapeHtml(m.to || '') + '</div>' +
              (m.cc ? '<div class="mail-msg-to">CC: ' + escapeHtml(m.cc) + '</div>' : '') +
            '</header>' +
            '<div class="mail-msg-body">' + linkify(escapeHtml(m.body || '')) + '</div>' +
            (m.attachments && m.attachments.length
              ? '<div class="mail-msg-attach">📎 ' + m.attachments.map(a =>
                  '<span class="mail-attach-item">' + escapeHtml(a.name) + ' <small>(' + formatSize(a.size) + ')</small></span>'
                ).join('') + '</div>'
              : '') +
          '</article>'
        ).join('') +
      '</div>';

    const rep = $('mail-reply');
    const repAll = $('mail-reply-all');
    if (rep)    rep.addEventListener('click', () => openCompose('reply', { replyAll: false }));
    if (repAll) repAll.addEventListener('click', () => openCompose('reply', { replyAll: true }));
  }

  // ---------- メール作成／返信モーダル ----------
  const MAX_ATTACH_TOTAL = 8 * 1024 * 1024;

  function bindComposeUI() {
    const modal = $('mail-compose-modal');
    if (!modal) return;

    ['mail-compose-close', 'mail-compose-cancel'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('click', closeCompose);
    });
    const backdrop = modal.querySelector('.modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeCompose);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) closeCompose();
    });

    const ccToggle = $('mail-compose-cc-toggle');
    if (ccToggle) ccToggle.addEventListener('change', () => {
      $('mail-compose-cc-row').hidden  = !ccToggle.checked;
      $('mail-compose-bcc-row').hidden = !ccToggle.checked;
    });

    const files = $('mail-compose-files');
    if (files) files.addEventListener('change', () => {
      addAttachments(Array.from(files.files || []));
      files.value = '';
    });

    const sendBtn  = $('mail-compose-send');
    const draftBtn = $('mail-compose-draft');
    if (sendBtn)  sendBtn.addEventListener('click',  () => submitCompose(false));
    if (draftBtn) draftBtn.addEventListener('click', () => submitCompose(true));

    const body = $('mail-compose-body');
    if (body) body.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitCompose(false);
    });
  }

  function openCompose(mode, opts) {
    const modal = $('mail-compose-modal');
    if (!modal) return;
    opts = opts || {};
    const c = state.mail.compose;

    if (mode === 'reply' && !state.mail.currentThread) {
      toast('返信するメールを先に選択してください', 'err');
      return;
    }

    c.mode = mode;
    c.threadId = '';
    c.attachments = [];
    c.sending = false;

    $('mail-compose-to').value = '';
    $('mail-compose-cc').value = '';
    $('mail-compose-bcc').value = '';
    $('mail-compose-subject').value = '';
    $('mail-compose-body').value = '';
    $('mail-compose-sign').checked = true;
    $('mail-compose-cc-toggle').checked = false;
    $('mail-compose-cc-row').hidden = true;
    $('mail-compose-bcc-row').hidden = true;
    setComposeStatus('');
    renderAttachList();

    if (mode === 'reply') {
      const thread = state.mail.currentThread;
      const msgs = thread.messages || [];
      const last = msgs[msgs.length - 1] || {};
      c.threadId = thread.id || state.mail.selectedId;
      $('mail-compose-title').textContent = opts.replyAll ? '↩↩ 全員に返信' : '↩ 返信';
      const th = $('mail-compose-thread');
      th.hidden = false;
      th.innerHTML = '返信先: <strong>' + escapeHtml(last.from || '') + '</strong>' +
                     '　件名: ' + escapeHtml(thread.subject || '(件名なし)');
      $('mail-compose-to-row').hidden = true;
      $('mail-compose-subject-row').hidden = true;
      $('mail-compose-replyall-row').hidden = false;
      $('mail-compose-replyall').checked = !!opts.replyAll;
      $('mail-compose-body').value = '\n\n' + quoteBody(last);
      c.initialBody = $('mail-compose-body').value;
    } else {
      $('mail-compose-title').textContent = '✏️ 新規メール';
      $('mail-compose-thread').hidden = true;
      $('mail-compose-to-row').hidden = false;
      $('mail-compose-subject-row').hidden = false;
      $('mail-compose-replyall-row').hidden = true;
      $('mail-compose-replyall').checked = false;
      c.initialBody = '';
    }

    modal.hidden = false;
    setTimeout(() => {
      if (mode === 'reply') {
        const b = $('mail-compose-body');
        if (b) { b.focus(); b.setSelectionRange(0, 0); }
      } else {
        const t = $('mail-compose-to');
        if (t) t.focus();
      }
    }, 30);
  }

  // force=true（送信成功後）以外は、書きかけの本文があれば確認する
  function closeCompose(force) {
    const c = state.mail.compose;
    if (c.sending) return;   // 送信中は閉じさせない
    const modal = $('mail-compose-modal');
    if (!modal || modal.hidden) return;
    if (force !== true) {
      const body = ($('mail-compose-body').value || '').trim();
      const dirty = body && body !== (c.initialBody || '').trim();
      if (dirty && !confirm('書きかけの内容は破棄されます。閉じてよろしいですか？')) return;
    }
    modal.hidden = true;
  }

  function quoteBody(m) {
    const when = m.date ? formatDate(m.date) : '';
    const lines = String(m.body || '').split('\n').map(l => '> ' + l).join('\n');
    return when + ' ' + (m.from || '') + ' さんは書きました:\n' + lines + '\n';
  }

  function addAttachments(files) {
    const c = state.mail.compose;
    let total = c.attachments.reduce((s, a) => s + a.size, 0);
    const accepted = [];
    files.forEach(f => {
      if (total + f.size > MAX_ATTACH_TOTAL) {
        toast('「' + f.name + '」は合計8MBを超えるため添付できません', 'err');
        return;
      }
      total += f.size;
      accepted.push(f);
    });
    accepted.forEach(f => {
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result || '');
        c.attachments.push({
          name: f.name,
          type: f.type || 'application/octet-stream',
          size: f.size,
          data: s.slice(s.indexOf(',') + 1),
        });
        renderAttachList();
      };
      reader.onerror = () => toast('「' + f.name + '」の読み込みに失敗しました', 'err');
      reader.readAsDataURL(f);
    });
  }

  function renderAttachList() {
    const ul = $('mail-compose-attach-list');
    if (!ul) return;
    const list = state.mail.compose.attachments;
    if (!list.length) { ul.innerHTML = ''; return; }
    ul.innerHTML = list.map((a, i) =>
      '<li class="mail-attach-row">📎 ' + escapeHtml(a.name) +
      ' <small>(' + formatSize(a.size) + ')</small>' +
      ' <button type="button" class="mail-attach-del" data-i="' + i + '" aria-label="添付を削除">×</button></li>'
    ).join('');
    ul.querySelectorAll('.mail-attach-del').forEach(b => {
      b.addEventListener('click', () => {
        state.mail.compose.attachments.splice(parseInt(b.dataset.i, 10), 1);
        renderAttachList();
      });
    });
  }

  function setComposeStatus(text) {
    const el = $('mail-compose-status');
    if (el) el.textContent = text || '';
  }

  function setComposeBusy(busy) {
    ['mail-compose-send', 'mail-compose-draft', 'mail-compose-cancel', 'mail-compose-close'].forEach(id => {
      const el = $(id);
      if (el) el.disabled = busy;
    });
  }

  function isValidAddressList(s) {
    const list = String(s).split(',').map(x => x.trim()).filter(Boolean);
    if (!list.length) return false;
    return list.every(x => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(x));
  }

  function mailErrorText(code) {
    const map = {
      auth_failed:      'パスワードが違います',
      to_required:      '宛先が空です',
      thread_not_found: '返信先のスレッドが見つかりません（削除済みの可能性）',
      quota_exceeded:   '本日の送信上限（100通）に達しました。明日以降に再送してください',
      unknown_action:   'GAS側が古いバージョンです。gas-mail-share/README.md の手順で再デプロイしてください',
    };
    return map[code] || code || 'unknown';
  }

  async function submitCompose(asDraft) {
    const c = state.mail.compose;
    if (c.sending) return;

    const body = $('mail-compose-body').value;
    const cc   = $('mail-compose-cc').value.trim();
    const bcc  = $('mail-compose-bcc').value.trim();

    let payload;
    let destLabel;

    if (c.mode === 'reply') {
      if (!c.threadId) { toast('返信先が不明です', 'err'); return; }
      if (!body.trim()) { toast('本文を入力してください', 'err'); return; }
      payload = { action: 'reply', id: c.threadId, replyAll: $('mail-compose-replyall').checked };
      destLabel = ($('mail-compose-replyall').checked ? '全員（このスレッド）' : 'このスレッドの差出人');
    } else {
      const to = $('mail-compose-to').value.trim();
      if (!to) { toast('宛先を入力してください', 'err'); $('mail-compose-to').focus(); return; }
      if (!isValidAddressList(to)) { toast('宛先のアドレス形式が正しくありません', 'err'); return; }
      if (cc && !isValidAddressList(cc))   { toast('CCのアドレス形式が正しくありません', 'err'); return; }
      if (bcc && !isValidAddressList(bcc)) { toast('BCCのアドレス形式が正しくありません', 'err'); return; }
      const subject = $('mail-compose-subject').value.trim();
      if (!asDraft && !subject && !confirm('件名が空です。このまま送信しますか？')) return;
      payload = { action: 'send', to, subject };
      destLabel = to;
    }

    if (cc)  payload.cc  = cc;
    if (bcc) payload.bcc = bcc;
    payload.body      = body;
    payload.signature = $('mail-compose-sign').checked;
    payload.draft     = !!asDraft;
    if (c.attachments.length) {
      payload.attachments = c.attachments.map(a => ({ name: a.name, type: a.type, data: a.data }));
    }

    // 送信は取り消せないため最終確認
    if (!asDraft) {
      const msg = 'communitybankinzai@gmail.com から送信します。\n\n宛先: ' + destLabel +
                  (c.attachments.length ? '\n添付: ' + c.attachments.length + '件' : '') +
                  '\n\n送信は取り消せません。よろしいですか？';
      if (!confirm(msg)) return;
    }

    c.sending = true;
    setComposeBusy(true);
    setComposeStatus(asDraft ? '下書き保存中…' : '送信中…');
    try {
      const r = await mailCall(payload);
      if (!r.ok) throw new Error(mailErrorText(r.error));
      c.sending = false;
      setComposeBusy(false);
      toast(asDraft ? 'Gmailの下書きに保存しました' : 'メールを送信しました', 'ok');
      closeCompose(true);
      if (!asDraft) {
        if (c.mode === 'reply' && state.mail.selectedId) openMailDetail(state.mail.selectedId);
        loadMailList();
      }
    } catch (err) {
      setComposeStatus('失敗: ' + err.message);
      toast((asDraft ? '下書き保存' : '送信') + 'に失敗しました：' + err.message, 'err');
    } finally {
      c.sending = false;
      setComposeBusy(false);
    }
  }

  function formatMailDate(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return s;
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    const pad = n => String(n).padStart(2, '0');
    if (sameDay) return pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '/' + d.getDate();
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
  }

  function formatSize(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + 'B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + 'KB';
    return (n / 1024 / 1024).toFixed(1) + 'MB';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function linkify(html) {
    return html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
               .replace(/\n/g, '<br>');
  }

  // =========================================================
  // 資料コメント機能（doc-comments タブ）
  // =========================================================
  async function initDocComments() {
    try {
      const res = await fetch('data/documents.json', { cache: 'no-store' });
      const data = await res.json();
      state.documents = data.documents || [];
      state.documentsLoaded = true;
      renderDocumentSelector();
      bindDocCommentEvents();
      populateDocCommentSelects();
    } catch (e) {
      console.error('[initDocComments] error:', e);
      const sel = $('dc-document-select');
      if (sel) sel.innerHTML = '<option value="">読み込みに失敗しました</option>';
    }
  }

  function renderDocumentSelector() {
    const sel = $('dc-document-select');
    if (!sel) return;
    let html = '<option value="">資料を選択してください</option>';
    state.documents.forEach(d => {
      html += `<option value="${escapeAttr(d.id)}">${escapeHtml(d.title)}</option>`;
    });
    sel.innerHTML = html;
  }

  function populateDocCommentSelects() {
    // カテゴリ（エージェント区分）を agents.json から流用
    const catSel = $('dc-category');
    const ideaCat = $('idea-category');
    if (catSel && ideaCat && catSel.children.length <= 1) {
      Array.from(ideaCat.children).forEach(opt => {
        if (opt.value) catSel.appendChild(opt.cloneNode(true));
      });
    }
    // 投稿者のAIエージェント候補
    const agentGroup = $('dc-agent-optgroup');
    const ideaAgentGroup = $('agent-optgroup');
    if (agentGroup && ideaAgentGroup && agentGroup.children.length === 0) {
      Array.from(ideaAgentGroup.children).forEach(opt => {
        agentGroup.appendChild(opt.cloneNode(true));
      });
    }
  }

  function bindDocCommentEvents() {
    if (state.docCommentsBound) return;
    state.docCommentsBound = true;

    $('dc-document-select').addEventListener('change', (e) => {
      onDocumentChange(e.target.value);
    });
    $('dc-author').addEventListener('change', (e) => {
      const isCustom = e.target.value === '__custom__';
      $('dc-author-custom').hidden = !isCustom;
      const isAgent = e.target.value && /^A\d+/.test(e.target.value);
      $('dc-ai-suggest').disabled = !isAgent;
    });
    $('dc-form').addEventListener('submit', (e) => {
      e.preventDefault();
      submitDocComment();
    });
    $('dc-ai-suggest').addEventListener('click', aiSuggestDocComment);
    $('dc-ai-revise').addEventListener('click', aiReviseDocument);
    $('dc-revise-close').addEventListener('click', () => {
      $('dc-revise-wrap').hidden = true;
    });
    $('dc-revise-copy').addEventListener('click', copyReviseToClipboard);
    $('dc-revise-mark-all').addEventListener('click', markAllCommentsReflected);
    // コメントリスト内の個別ボタンへのイベント委譲
    $('dc-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="toggle-reflected"]');
      if (btn) {
        const id = btn.getAttribute('data-comment-id');
        const toReflected = btn.getAttribute('data-to') === 'reflected';
        toggleCommentReflected(id, toReflected);
      }
    });
  }

  function onDocumentChange(docId) {
    state.currentDocumentId = docId;
    const meta = $('dc-document-meta');
    const formWrap = $('dc-form-wrap');
    const listWrap = $('dc-list-wrap');
    $('dc-revise-wrap').hidden = true;
    if (!docId) {
      meta.hidden = true;
      formWrap.hidden = true;
      listWrap.hidden = true;
      return;
    }
    const doc = state.documents.find(d => d.id === docId);
    if (doc) {
      $('dc-document-desc').innerHTML = `<strong>${escapeHtml(doc.category || '')}</strong>　${escapeHtml(doc.description || '')}`;
      $('dc-document-link').href = doc.path;
      meta.hidden = false;
    }
    $('dc-document-id').value = docId;
    formWrap.hidden = false;
    listWrap.hidden = false;
    loadDocComments(docId);
  }

  async function loadDocComments(docId) {
    const list = $('dc-list');
    const empty = $('dc-empty');
    const count = $('dc-count');
    list.innerHTML = '<p class="empty">読み込み中…</p>';
    try {
      const r = await gasCall({ action: 'listComments', password: state.password });
      if (!r.ok) throw new Error(r.error || 'fetch_failed');
      const target = `doc:${docId}`;
      const filtered = (r.comments || []).filter(c => c.ideaId === target);
      // 古い順に並べ替え
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      state.docComments = filtered;
      renderDocCommentList(filtered);
      count.textContent = `${filtered.length}件`;
      $('dc-ai-revise').disabled = filtered.length < 1;
      $('dc-ai-revise').title = filtered.length < 1 ? 'コメントが1件以上必要です' : 'AIで改善案にとりまとめる';
    } catch (e) {
      console.error('[loadDocComments] error:', e);
      list.innerHTML = `<p class="empty">読み込み失敗：${escapeHtml(e.message || '')}</p>`;
    }
  }

  function renderDocCommentList(comments) {
    const list = $('dc-list');
    if (comments.length === 0) {
      list.innerHTML = '<p class="empty">まだコメントがありません。最初のコメントを投稿してください。</p>';
      return;
    }
    let html = '';
    comments.forEach(c => {
      const dt = c.createdAt ? new Date(c.createdAt).toLocaleString('ja-JP') : '';
      const author = c.author || '匿名';
      const rawBody = c.body || '';
      // body 先頭の [カテゴリ/状態] プレフィックスを解析
      const m = rawBody.match(/^\[([^\/\]]+)\/([^\]]+)\]\s*([\s\S]*)$/);
      const cat = m ? m[1].trim() : (c.category || '');
      const stat = m ? m[2].trim() : (c.status || '');
      const text = m ? m[3] : rawBody;
      const body = linkify(escapeHtml(text));
      const isAgent = /^A\d+/.test(author);
      const badge = isAgent ? '🤖' : '👥';
      const isReflected = stat === '反映済';
      const borderColor = isReflected ? '#2d5a3d' : (isAgent ? '#2d5a3d' : '#c9a55c');
      const bgColor = isReflected ? '#f0f5f1' : '#fff';
      const statBadgeColor = isReflected
        ? 'background:#2d5a3d; color:#fff;'
        : 'background:#f1ece0; color:#4a5663;';
      const btnLabel = isReflected ? '⏪ 検討中に戻す' : '✅ 反映済にする';
      const btnTo = isReflected ? 'pending' : 'reflected';
      const btnStyle = isReflected
        ? 'background:#fff; color:#4a5663; border:1px solid #e0d9c6;'
        : 'background:#2d5a3d; color:#fff; border:none;';
      html += `
        <article style="background:${bgColor}; border:1px solid #e0d9c6; border-left:4px solid ${borderColor}; border-radius:8px; padding:14px 18px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:start; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
            <div style="font-size:13px;">
              <strong style="color:#1e3a5f;">${badge} ${escapeHtml(author)}</strong>
              ${cat ? `<span style="display:inline-block; font-size:11px; padding:2px 8px; background:#faf3e3; color:#c9a55c; border-radius:999px; margin-left:8px;">${escapeHtml(cat)}</span>` : ''}
              ${stat ? `<span style="display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px; margin-left:4px; ${statBadgeColor}">${escapeHtml(stat)}</span>` : ''}
            </div>
            <div style="font-size:11px; color:#4a5663;">${dt}</div>
          </div>
          <div style="font-size:14px; line-height:1.75; color:#1a2330;">${body}</div>
          <div style="margin-top:10px; text-align:right;">
            <button type="button" data-action="toggle-reflected" data-comment-id="${escapeAttr(c.id)}" data-to="${btnTo}" style="font-size:12px; padding:5px 12px; border-radius:999px; cursor:pointer; font-weight:700; letter-spacing:0.05em; ${btnStyle}">${btnLabel}</button>
          </div>
        </article>
      `;
    });
    list.innerHTML = html;
  }

  // 個別コメントの状態をトグル（反映済 ⇔ 検討中）
  async function toggleCommentReflected(commentId, toReflected) {
    const comment = (state.docComments || []).find(c => c.id === commentId);
    if (!comment) return;
    const rawBody = comment.body || '';
    const m = rawBody.match(/^\[([^\/\]]+)\/([^\]]+)\]\s*([\s\S]*)$/);
    let newBody;
    const newStatus = toReflected ? '反映済' : '検討中';
    if (m) {
      newBody = `[${m[1]}/${newStatus}] ${m[3]}`;
    } else {
      // プレフィックスがない古いコメント
      newBody = `[未分類/${newStatus}] ${rawBody}`;
    }
    try {
      const r = await gasCall({
        action: 'updateComment',
        password: state.password,
        id: commentId,
        body: newBody,
        actor: state.me || '中司 祐樹',
      });
      if (!r.ok) throw new Error(r.error || 'update_failed');
      await loadDocComments(state.currentDocumentId);
    } catch (e) {
      console.error('[toggleCommentReflected] error:', e);
      alert('状態更新に失敗しました：' + (e.message || ''));
    }
  }

  // AI改善案エリアの「全コメントを反映済にマーク」
  async function markAllCommentsReflected() {
    const comments = state.docComments || [];
    const targets = comments.filter(c => {
      const m = (c.body || '').match(/^\[([^\/\]]+)\/([^\]]+)\]/);
      return !m || m[2].trim() !== '反映済';
    });
    if (targets.length === 0) {
      alert('反映済にできるコメントがありません（全件すでに反映済）');
      return;
    }
    if (!confirm(`${targets.length}件のコメントを「反映済」にマークします。よろしいですか？`)) return;
    const btn = $('dc-revise-mark-all');
    btn.disabled = true;
    btn.textContent = '更新中…';
    let ok = 0, fail = 0;
    for (const c of targets) {
      const rawBody = c.body || '';
      const m = rawBody.match(/^\[([^\/\]]+)\/([^\]]+)\]\s*([\s\S]*)$/);
      const newBody = m
        ? `[${m[1]}/反映済] ${m[3]}`
        : `[未分類/反映済] ${rawBody}`;
      try {
        const r = await gasCall({
          action: 'updateComment',
          password: state.password,
          id: c.id,
          body: newBody,
          actor: state.me || '中司 祐樹',
        });
        if (r.ok) ok++; else fail++;
      } catch (e) {
        fail++;
        console.error('[markAllCommentsReflected] error:', e);
      }
    }
    btn.disabled = false;
    btn.textContent = '✅ 全コメントを反映済にマーク';
    await loadDocComments(state.currentDocumentId);
    alert(`完了：${ok}件成功 / ${fail}件失敗`);
  }

  async function submitDocComment() {
    const docId = $('dc-document-id').value;
    if (!docId) { alert('資料を選択してください'); return; }
    let author = $('dc-author').value;
    if (author === '__custom__') author = $('dc-author-custom').value.trim();
    const category = $('dc-category').value;
    const status = $('dc-status').value;
    const body = $('dc-body').value.trim();
    if (!author || !category || !body) { alert('投稿者・カテゴリ・本文は必須です'); return; }

    const btn = $('dc-submit');
    btn.disabled = true;
    btn.textContent = '投稿中…';
    try {
      const r = await gasCall({
        action: 'addComment',
        password: state.password,
        comment: {
          ideaId: `doc:${docId}`,
          author: author,
          body: `[${category}/${status}] ${body}`,
        },
        actor: author,
      });
      if (!r.ok) throw new Error(r.error || 'submit_failed');
      $('dc-body').value = '';
      await loadDocComments(docId);
    } catch (e) {
      console.error('[submitDocComment] error:', e);
      alert('投稿に失敗しました：' + (e.message || ''));
    } finally {
      btn.disabled = false;
      btn.textContent = '投稿する';
    }
  }

  async function aiSuggestDocComment() {
    const docId = $('dc-document-id').value;
    const author = $('dc-author').value;
    if (!docId || !author || !/^A\d+/.test(author)) { alert('資料とAIエージェントを選択してください'); return; }
    const doc = state.documents.find(d => d.id === docId);
    const btn = $('dc-ai-suggest');
    btn.disabled = true;
    btn.textContent = 'AI生成中…';
    try {
      const r = await gasCall({
        action: 'aiSuggest',
        password: state.password,
        agentId: author.match(/^(A\d+)/)[1],
        context: `資料『${doc?.title || docId}』に対する意見・改善提案を、このエージェントの立場で1案考えてください。資料の説明：${doc?.description || ''}`,
      });
      if (!r.ok) throw new Error(r.error || 'ai_failed');
      const suggestion = r.suggestion || r.body || r.text || '';
      if (suggestion) {
        $('dc-body').value = suggestion;
      } else {
        alert('AIの応答が空でした');
      }
    } catch (e) {
      console.error('[aiSuggestDocComment] error:', e);
      alert('AI提案に失敗しました：' + (e.message || ''));
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ AIに意見させる';
    }
  }

  async function aiReviseDocument() {
    const docId = state.currentDocumentId;
    const comments = state.docComments || [];
    if (!docId || comments.length < 1) return;
    const doc = state.documents.find(d => d.id === docId);
    const btn = $('dc-ai-revise');
    btn.disabled = true;
    btn.textContent = 'AI処理中…';
    try {
      const r = await gasCall({
        action: 'aiReviseDocument',
        password: state.password,
        documentId: docId,
        documentTitle: doc?.title || docId,
        documentDescription: doc?.description || '',
        comments: comments.map(c => ({ author: c.author, body: c.body, createdAt: c.createdAt })),
      });
      if (!r.ok) throw new Error(r.error || 'ai_failed');
      $('dc-revise-output').textContent = r.revised || r.text || '（応答なし）';
      $('dc-revise-wrap').hidden = false;
      $('dc-revise-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error('[aiReviseDocument] error:', e);
      alert('AI改善案の生成に失敗しました：' + (e.message || ''));
    } finally {
      btn.disabled = false;
      btn.textContent = '🤝 AIで改善案にとりまとめる';
    }
  }

  function copyReviseToClipboard() {
    const text = $('dc-revise-output').textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      const btn = $('dc-revise-copy');
      const orig = btn.textContent;
      btn.textContent = '✅ コピーしました';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }).catch(e => {
      alert('コピーに失敗しました：' + e.message);
    });
  }

  // 📑 資料タブのカードから直接 💬 資料コメントタブへ飛ぶグローバル関数
  window.openDocComments = async function(docId) {
    if (!state.password) {
      alert('先にログインしてください');
      return;
    }
    switchTab('doc-comments');
    // initDocComments は switchTab 内で呼ばれる（未ロード時のみ）
    // ロード完了を待ってから資料セレクタを設定
    let tries = 0;
    while (!state.documentsLoaded && tries < 30) {
      await new Promise(r => setTimeout(r, 100));
      tries++;
    }
    const sel = $('dc-document-select');
    if (sel && state.documents.some(d => d.id === docId)) {
      sel.value = docId;
      onDocumentChange(docId);
      // スムーズスクロールでフォーム位置へ
      setTimeout(() => {
        const target = $('dc-form-wrap');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } else {
      console.warn('[openDocComments] docId not found:', docId);
    }
  };

})();
