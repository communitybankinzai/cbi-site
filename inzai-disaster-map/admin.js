const WORK_LOG_KEY = "inzai-disaster-work-log-v1";
const WORK_LOG_SEED_KEY = "inzai-disaster-work-log-seed-20260822-v7";
const statusLabels = {
  planned: "検討中",
  testing: "試験中",
  blocked: "未実現・要対応",
  completed: "対応済"
};

const initialRecords = [
  {
    id: "seed-meta-api",
    feature: "Instagram・Threadsの広域API取込",
    status: "blocked",
    owner: "",
    loggedAt: "2026-08-15T09:00:00+09:00",
    summary: "現在の構成では、印西市に関する第三者の公開投稿を公式APIから横断取得する接続・権限を用意できていない。投稿リンク、本文要約、画面証跡で候補登録する。",
    nextAction: "Meta側の利用可能な検索範囲、審査、アプリ権限を確認し、CBI側サーバーで扱える場合のみ連携する。",
    referenceUrl: "https://developers.facebook.com/",
    origin: "seed"
  },
  {
    id: "seed-x-api",
    feature: "X投稿の自動検索API取込",
    status: "blocked",
    owner: "",
    loggedAt: "2026-08-15T09:05:00+09:00",
    summary: "検索画面は利用できるが、APIによる継続的な自動取得は契約プラン、利用料、取得条件を確認できていないため未接続。",
    nextAction: "想定件数と頻度を決め、X APIの現行プランと費用を確認する。",
    referenceUrl: "https://developer.x.com/",
    origin: "seed"
  },
  {
    id: "seed-capture-ocr",
    feature: "SNS画面キャプチャ・OCR",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T09:10:00+09:00",
    summary: "ブラウザの画面共有でSNSタブを選び、投稿部分を切り出してOCRする方式を試験中。サイト側から別タブを無断で自動取得することはできない。",
    nextAction: "PCとスマートフォンで、白紙取得、共有画面の選び方、OCR精度を継続確認する。",
    referenceUrl: "",
    origin: "seed"
  },
  {
    id: "seed-jartic",
    feature: "JARTIC道路情報の地図反映",
    status: "planned",
    owner: "",
    loggedAt: "2026-08-15T09:15:00+09:00",
    summary: "公式サイトへの参照は可能。リアルタイムデータを直接取り込む場合は、提供条件、利用許諾、契約方法、対象道路の粒度を確認する必要がある。",
    nextAction: "JARTICへ二次利用とデータ提供条件を照会し、利用可能な形式を確認する。",
    referenceUrl: "https://www.jartic.or.jp/",
    origin: "seed"
  },
  {
    id: "seed-toyota",
    feature: "TOYOTA通れた道データの取込",
    status: "planned",
    owner: "",
    loggedAt: "2026-08-15T09:20:00+09:00",
    summary: "参考リンクの表示に留まり、走行実績データそのものを取り込む公開API・利用許諾は未確認。通れた実績は現在の安全を保証しないため、表示時刻と注意書きも必要。",
    nextAction: "データ提供窓口、災害時利用条件、更新頻度、二次表示可否を確認する。",
    referenceUrl: "https://www.toyota.co.jp/jpn/auto/passable_route/map/",
    origin: "seed"
  },
  {
    id: "seed-road-line",
    feature: "通行止め・通行不能区間の線表示",
    status: "planned",
    owner: "",
    loggedAt: "2026-08-15T09:25:00+09:00",
    summary: "現在は地点と通行状態の登録が中心。道路区間を始点・経由点・終点で線として登録する編集機能は未実装。",
    nextAction: "道路線形の入力方法、同一路線の更新、解除時の履歴保持を設計して実装する。",
    referenceUrl: "",
    origin: "seed"
  },
  {
    id: "seed-shared-storage",
    feature: "CBIサイトでの共有台帳・画像保管",
    status: "planned",
    owner: "",
    loggedAt: "2026-08-15T09:30:00+09:00",
    summary: "現在の被害候補と作業記録は各ブラウザの端末内保存。複数担当者で同じ台帳を更新するバックエンド、権限管理、画像保管は未接続。",
    nextAction: "運用担当、公開範囲、個人情報、保存期間、バックアップ方針を決めてからCBI側APIを設計する。",
    referenceUrl: "",
    origin: "seed"
  },
  {
    id: "seed-rain-nowcast",
    feature: "リアルタイム降水レイヤー",
    status: "completed",
    owner: "",
    loggedAt: "2026-08-15T13:00:00+09:00",
    summary: "気象庁の高解像度降水ナウキャスト実況タイルを、利用者が選択したときに地図へ重ねる機能を追加。最新時刻を取得し5分ごとに更新する。",
    nextAction: "実運用前に長時間表示時の安定性、出典表示、気象庁側の配信変更を継続確認する。",
    referenceUrl: "https://www.jma.go.jp/bosai/nowc/",
    origin: "seed"
  },
  {
    id: "seed-inzai-open-data",
    feature: "印西市わが街ガイド公開データのレイヤー化",
    status: "completed",
    owner: "",
    loggedAt: "2026-08-22T18:00:00+09:00",
    summary: "公開11データセットをすべて取り込み。避難所55（既存）に加え、災害用井戸8、消防署6、警察機関10、市役所・支所3、市公表の土砂災害警戒区域634・特別警戒区域648を点で、緊急輸送路5本・鉄道43本をKMLの線で表示。利用条件はCC BY 2.1 JP、文字コードUTF-8（BOM）、座標は緯度経度でそのまま利用可を確認し、出典・ライセンスをポップアップに明記した。土砂災害は件数が多いためズーム13以上かつ画面内のみ描画。国土地理院版と市公表版は指定時期のずれで境界が異なりうるため、どちらかに寄せず別レイヤーで並記する方針とした。",
    nextAction: "揺れやすさマップ・液状化マップはカテゴリ名のみでダウンロード可能なファイルが存在せず、J-SHISでの代替表示を継続する。市がファイルを公開した時点で取り込む。更新検知は未実装のため、市の掲載日を定期確認する。",
    referenceUrl: "https://www2.wagmap.jp/inzai/OpenData",
    origin: "seed"
  },
  {
    id: "seed-incident-date-filter",
    feature: "災害対象日による表示分離",
    status: "completed",
    owner: "",
    loggedAt: "2026-08-15T13:45:00+09:00",
    summary: "投稿・発生時刻または登録時の災害対象日が一致する記録だけを、地図、一覧、集計、写真・場所確認キューへ表示する。過去記録は明示的にONにした場合だけ表示する。",
    nextAction: "複数日にわたる災害へ対応する場合は、対象開始・終了日時の範囲指定へ拡張する。",
    referenceUrl: "",
    origin: "seed"
  },
  {
    id: "seed-image-gps",
    feature: "元画像GPSによる自動ピン留め",
    status: "completed",
    owner: "",
    loggedAt: "2026-08-15T16:00:00+09:00",
    summary: "選択・貼り付け・ドロップした元画像にEXIF GPSが残っている場合、緯度経度を読み取り、その座標でピン留めする。GPSがない画像や画面キャプチャは自動確定しない。",
    nextAction: "実機のスマートフォン写真でGPSあり・なしの両方を確認し、公開前の位置確認を運用手順に含める。",
    referenceUrl: "https://github.com/MikeKovarik/exifr",
    origin: "seed"
  },
  {
    id: "seed-location-ai",
    feature: "投稿本文・コメントからの場所候補検索",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T16:05:00+09:00",
    summary: "本文・コメント・場所の手掛かりから地名を抽出し、無料の国土地理院検索で候補を提示する機能を実装。AI補完はCBI側APIの接続先が設定された場合だけ利用でき、候補は人が確認して採用する。",
    nextAction: "市内外の同名地名、道路名だけの投稿、コメントで追記された住所を使って候補精度を検証する。",
    referenceUrl: "https://msearch.gsi.go.jp/address-search/",
    origin: "seed"
  },
  {
    id: "seed-operator-auth",
    feature: "自主防災組織の利用登録・権限管理",
    status: "planned",
    owner: "",
    loggedAt: "2026-08-15T16:10:00+09:00",
    summary: "画面側に利用者セッション、編集権限、共有台帳APIの接続口を追加。現在は端末内保存の試作であり、CiDAOログイン・組織所属・役割を検証するサーバーAPIは未接続。",
    nextAction: "CiDAOのSupabase認証と組織所属を使い、閲覧・登録・確認・公開承認の権限をサーバー側で強制する。",
    referenceUrl: "https://cidao.vercel.app/login",
    origin: "seed"
  },
  {
    id: "seed-earthquake-info",
    feature: "気象庁の地震情報表示",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T16:15:00+09:00",
    summary: "気象庁の地震情報一覧から最新の全国情報と印西市の震度情報を取得し、地図脇に要約表示する機能を追加。被害投稿とは別の公式参考情報として扱う。",
    nextAction: "気象庁側の配信変更、通信障害、同一地震の更新報の表示を継続確認する。",
    referenceUrl: "https://www.data.jma.go.jp/developer/",
    origin: "seed"
  },
  {
    id: "seed-rescue-publication",
    feature: "救助・安否確認要請の登録・公開承認",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T16:20:00+09:00",
    summary: "救助・安否確認要請を内部台帳に登録し、確認後だけ公開対象にできる基礎機能を追加。救助要請の正確な位置は一般公開できない制御と、119・110を優先する注意表示を設けた。",
    nextAction: "消防・警察・自治体との役割分担、個人情報、公開遅延、削除基準を合意するまで一般向けの実運用公開は行わない。",
    referenceUrl: "https://www.fdma.go.jp/",
    origin: "seed"
  },
  {
    id: "seed-pin-sns-popup",
    feature: "地図ピンからSNS証跡・質問導線を表示",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T17:00:00+09:00",
    summary: "被害ピンのポップアップに登録済み証跡写真、SNS媒体、元投稿リンク、質問文をコピーして投稿を開くボタンを追加。送信前にSNS画面で内容を確認する。",
    nextAction: "実在投稿で写真の公開区分、リンク切れ、スマートフォンのコメント入力、質問後の回答記録を確認する。SNS APIによるコメント自動送信は権限・誤送信リスクを確認するまで接続しない。",
    referenceUrl: "",
    origin: "seed"
  },
  {
    id: "seed-inzai-weather-warning",
    feature: "印西市の警報・注意報表示",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T17:30:00+09:00",
    summary: "気象庁の2026年新体系の警報・注意報データから印西市だけを抽出し、右側最上段に発表中の種別、警戒レベル相当、行動の目安、発表・取得時刻を表示する。発表なしと取得失敗は明確に区別する。",
    nextAction: "実際の注意報・警報発表時に表示内容、更新間隔、気象庁ページとの差異を確認する。河川ごとの氾濫情報と市の避難情報は別情報として公式ページへの導線を維持する。",
    referenceUrl: "https://www.jma.go.jp/bosai/warning/#area_type=class20s&area_code=1223100",
    origin: "seed"
  },
  {
    id: "seed-jshis-wms",
    feature: "J-SHIS地震ハザードレイヤー",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T17:45:00+09:00",
    summary: "J-SHISが公式提供するWMSから、2024年版の今後30年間に震度6弱以上となる確率と、V4表層地盤の揺れの増幅率を地図へ重ねるチェックボックスを追加。公式凡例、出典、読込状態、共通透過度調整を表示する。",
    nextAction: "J-SHIS側の版更新とWMS稼働状況を継続確認する。将来予測・地盤特性であり、現在の震度や実被害ではないことを運用時にも周知する。",
    referenceUrl: "https://www.j-shis.bosai.go.jp/wms-list",
    origin: "seed"
  },
  {
    id: "seed-road-section-workflow",
    feature: "通行止め・通行不能の道路区間表示",
    status: "testing",
    owner: "",
    loggedAt: "2026-08-15T18:35:00+09:00",
    summary: "始点と終点の交差点を地図上で選び、通行止め・不能、規制、再開、通行実績の状態色で道路区間を表示する機能を追加。区間未設定の通行止め・不能は赤い×で表示し、線または×から情報源、根拠URL、最終確認時刻を参照できる。",
    nextAction: "実災害時の道路管理担当者による入力手順と更新間隔を確認する。JARTICリアルタイム情報の自動連携は契約・提供条件を確認するまで未接続とし、公式画面の確認記録で運用試験する。",
    referenceUrl: "https://www.jartic.or.jp/",
    origin: "seed"
  }
];

let records = loadRecords();

document.addEventListener("DOMContentLoaded", () => {
  ensureInitialRecords();
  bindEvents();
  resetForm();
  render();
});

function bindEvents() {
  document.getElementById("work-log-form").addEventListener("submit", saveRecord);
  document.getElementById("reset-form-button").addEventListener("click", resetForm);
  document.getElementById("keyword-filter").addEventListener("input", render);
  document.getElementById("status-filter").addEventListener("change", render);
  document.getElementById("records-list").addEventListener("click", handleRecordAction);
  document.getElementById("export-csv-button").addEventListener("click", exportCsv);
  document.getElementById("export-json-button").addEventListener("click", exportJson);
  document.getElementById("import-json-file").addEventListener("change", importJson);
}

function ensureInitialRecords() {
  if (localStorage.getItem(WORK_LOG_SEED_KEY)) return;
  const ids = new Set(records.map(item => item.id));
  const missing = initialRecords.filter(item => !ids.has(item.id));
  if (missing.length) {
    records = [...records, ...missing];
  }
  // 既に端末へ保存済みのシード記録は、運営が手で編集していない限り最新のシード内容へ更新する。
  // 完了した課題が「検討中」のまま残り続けるのを防ぐため（手編集分は origin が seed 以外になる）。
  records = records.map(record => {
    if (record.origin !== "seed") return record;
    const latest = initialRecords.find(item => item.id === record.id);
    return latest ? { ...record, ...latest } : record;
  });
  persistRecords();
  localStorage.setItem(WORK_LOG_SEED_KEY, "true");
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORK_LOG_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeRecord).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeRecord(item) {
  if (!item || !item.feature || !statusLabels[item.status]) return null;
  return {
    id: String(item.id || `work-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    feature: String(item.feature),
    status: item.status,
    owner: String(item.owner || ""),
    loggedAt: String(item.loggedAt || new Date().toISOString()),
    summary: String(item.summary || ""),
    nextAction: String(item.nextAction || ""),
    referenceUrl: String(item.referenceUrl || ""),
    origin: String(item.origin || "manual")
  };
}

function persistRecords() {
  localStorage.setItem(WORK_LOG_KEY, JSON.stringify(records.slice(0, 500)));
}

function saveRecord(event) {
  event.preventDefault();
  const id = getValue("record-id");
  const existing = records.find(item => item.id === id);
  const record = normalizeRecord({
    id: id || `work-${Date.now()}`,
    feature: getValue("feature"),
    status: getValue("status"),
    owner: getValue("owner"),
    loggedAt: new Date(getValue("logged-at")).toISOString(),
    summary: getValue("summary"),
    nextAction: getValue("next-action"),
    referenceUrl: getValue("reference-url"),
    origin: existing?.origin || "manual"
  });
  if (!record) return;
  records = existing
    ? records.map(item => item.id === id ? record : item)
    : [record, ...records];
  persistRecords();
  resetForm();
  render();
}

function resetForm() {
  document.getElementById("work-log-form").reset();
  setValue("record-id", "");
  setValue("status", "planned");
  setValue("logged-at", toLocalInput(new Date()));
  document.getElementById("feature").focus({ preventScroll: true });
}

function render() {
  const counts = Object.fromEntries(Object.keys(statusLabels).map(status => [status, records.filter(item => item.status === status).length]));
  document.getElementById("total-count").textContent = records.length;
  Object.keys(statusLabels).forEach(status => {
    document.getElementById(`${status}-count`).textContent = counts[status];
  });

  const keyword = getValue("keyword-filter").trim().toLowerCase();
  const status = getValue("status-filter");
  const filtered = records
    .filter(item => status === "all" || item.status === status)
    .filter(item => !keyword || [item.feature, item.summary, item.nextAction, item.owner].join(" ").toLowerCase().includes(keyword))
    .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt));
  document.getElementById("visible-count").textContent = `${filtered.length}件`;
  document.getElementById("records-list").innerHTML = filtered.length
    ? filtered.map(renderRecord).join("")
    : '<div class="empty-state">条件に一致する記録はありません。</div>';
}

function renderRecord(item) {
  return `
    <article class="work-record" data-status="${escapeAttribute(item.status)}">
      <div class="record-head">
        <div>
          <h3>${escapeHtml(item.feature)}</h3>
          <p class="record-meta">
            <span>${escapeHtml(formatDateTime(item.loggedAt))}</span>
            <span>${escapeHtml(item.owner || "担当未設定")}</span>
            ${item.origin === "system" ? "<span>MAPから自動記録</span>" : ""}
          </p>
        </div>
        <span class="status-label">${escapeHtml(statusLabels[item.status])}</span>
      </div>
      <dl>
        <dt>実施結果・理由</dt><dd>${escapeHtml(item.summary || "-")}</dd>
        <dt>次の対応</dt><dd>${escapeHtml(item.nextAction || "-")}</dd>
        ${isHttpUrl(item.referenceUrl) ? `<dt>参照先</dt><dd><a href="${escapeAttribute(item.referenceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.referenceUrl)}</a></dd>` : ""}
      </dl>
      <div class="record-actions">
        <button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">編集</button>
        <button class="delete-button" type="button" data-action="delete" data-id="${escapeAttribute(item.id)}">削除</button>
      </div>
    </article>`;
}

function handleRecordAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const record = records.find(item => item.id === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === "delete") {
    if (!confirm(`「${record.feature}」の記録を削除しますか？`)) return;
    records = records.filter(item => item.id !== record.id);
    persistRecords();
    render();
    return;
  }
  setValue("record-id", record.id);
  setValue("feature", record.feature);
  setValue("status", record.status);
  setValue("owner", record.owner);
  setValue("logged-at", toLocalInput(new Date(record.loggedAt)));
  setValue("summary", record.summary);
  setValue("next-action", record.nextAction);
  setValue("reference-url", record.referenceUrl);
  document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function exportCsv() {
  const headers = ["id", "feature", "status", "statusLabel", "owner", "loggedAt", "summary", "nextAction", "referenceUrl", "origin"];
  const rows = records.map(item => headers.map(key => csvCell(key === "statusLabel" ? statusLabels[item.status] : item[key] || "")).join(","));
  download(`inzai-disaster-work-log-${dateStamp()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv;charset=utf-8");
}

function exportJson() {
  download(`inzai-disaster-work-log-${dateStamp()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2), "application/json");
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const source = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(source)) throw new Error("記録配列がありません");
      const imported = source.map(normalizeRecord).filter(Boolean);
      const byId = new Map(records.map(item => [item.id, item]));
      imported.forEach(item => byId.set(item.id, item));
      records = [...byId.values()];
      persistRecords();
      render();
      alert(`${imported.length}件を取り込みました。`);
    } catch (error) {
      alert(`JSONを取り込めませんでした: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function download(filename, text, type) {
  const blob = new Blob(["\ufeff", text], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getValue(id) {
  return document.getElementById(id).value;
}

function setValue(id, value) {
  document.getElementById(id).value = value || "";
}

function toLocalInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function dateStamp() {
  const date = new Date();
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
