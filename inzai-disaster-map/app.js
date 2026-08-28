const INZAI_BOUNDS = L.latLngBounds([35.735, 140.055], [35.875, 140.245]);
const STORAGE_KEY = "inzai-disaster-records-v1";
const SEARCH_LOG_KEY = "inzai-disaster-search-log-v1";
const WORK_LOG_KEY = "inzai-disaster-work-log-v1";
const OPERATOR_KEY = "inzai-disaster-operator-v1";
const GUIDE_SEEN_KEY = "inzai-disaster-guide-seen-v1";
const SOURCE_CHECKED_AT = "2026-08-15";
const APP_CONFIG = window.CBI_DISASTER_CONFIG || {};
const PUBLIC_VIEW = new URLSearchParams(window.location.search).get("view") === "public";
const INZAI_CITY_CODE = "1223100";

const weatherWarningDefinitions = {
  "33": { name: "レベル5大雨特別警報", element: "rain", level: 50, alertLevel: 5 },
  "43": { name: "レベル4大雨危険警報", element: "rain", level: 40, alertLevel: 4 },
  "03": { name: "レベル3大雨警報", element: "rain", level: 30, alertLevel: 3 },
  "10": { name: "レベル2大雨注意報", element: "rain", level: 20, alertLevel: 2 },
  "39": { name: "レベル5土砂災害特別警報", element: "landslide", level: 50, alertLevel: 5 },
  "49": { name: "レベル4土砂災害危険警報", element: "landslide", level: 40, alertLevel: 4 },
  "09": { name: "レベル3土砂災害警報", element: "landslide", level: 30, alertLevel: 3 },
  "29": { name: "レベル2土砂災害注意報", element: "landslide", level: 20, alertLevel: 2 },
  "38": { name: "レベル5高潮特別警報", element: "tide", level: 50, alertLevel: 5 },
  "48": { name: "レベル4高潮危険警報", element: "tide", level: 40, alertLevel: 4 },
  "08": { name: "レベル3高潮警報", element: "tide", level: 30, alertLevel: 3 },
  "19": { name: "レベル2高潮注意報", element: "tide", level: 20, alertLevel: 2 },
  "35": { name: "暴風特別警報", element: "wind", level: 50 },
  "05": { name: "暴風警報", element: "wind", level: 30 },
  "15": { name: "強風注意報", element: "wind", level: 20 },
  "32": { name: "暴風雪特別警報", element: "windSnow", level: 50 },
  "02": { name: "暴風雪警報", element: "windSnow", level: 30 },
  "13": { name: "風雪注意報", element: "windSnow", level: 20 },
  "36": { name: "大雪特別警報", element: "snow", level: 50 },
  "06": { name: "大雪警報", element: "snow", level: 30 },
  "12": { name: "大雪注意報", element: "snow", level: 20 },
  "37": { name: "波浪特別警報", element: "wave", level: 50 },
  "07": { name: "波浪警報", element: "wave", level: 30 },
  "16": { name: "波浪注意報", element: "wave", level: 20 },
  "14": { name: "雷注意報", element: "thunder", level: 20 },
  "17": { name: "融雪注意報", element: "snowMelt", level: 20 },
  "20": { name: "濃霧注意報", element: "fog", level: 20 },
  "21": { name: "乾燥注意報", element: "dry", level: 20 },
  "22": { name: "なだれ注意報", element: "avalanche", level: 20 },
  "23": { name: "低温注意報", element: "cold", level: 20 },
  "24": { name: "霜注意報", element: "frost", level: 20 },
  "25": { name: "着氷注意報", element: "ice", level: 20 },
  "26": { name: "着雪注意報", element: "snowAccretion", level: 20 }
};

const weatherWarningActions = {
  rain: "低い土地の浸水や中小河川の増水に警戒し、キキクルと印西市の避難情報を確認してください。",
  landslide: "がけや急斜面から離れ、土砂キキクルと印西市の避難情報を確認してください。",
  tide: "海岸・河口付近から離れ、高潮と河川の情報を確認してください。",
  wind: "飛来物、倒木、停電に注意し、屋外物を固定して不要不急の外出を控えてください。",
  windSnow: "暴風雪による視界不良と交通障害に警戒し、不要不急の外出を控えてください。",
  snow: "積雪や路面凍結、交通障害に注意し、移動予定と備蓄を確認してください。",
  wave: "海岸や河口付近には近づかず、最新の波浪情報を確認してください。",
  thunder: "屋外活動を控えて頑丈な建物内へ移り、落雷、突風、ひょう、急な強い雨に注意してください。",
  snowMelt: "融雪による浸水や土砂災害に注意し、斜面や増水した水路に近づかないでください。",
  fog: "視界不良に注意し、運転時は速度を落として十分な車間距離を確保してください。",
  dry: "火の取り扱いと延焼に注意し、屋外での火気使用を控えてください。",
  avalanche: "積雪のある斜面や谷筋に近づかず、最新の道路・気象情報を確認してください。",
  cold: "水道管の凍結、農作物、体調管理に注意してください。",
  frost: "農作物の霜害に注意し、必要な保護対策を行ってください。",
  ice: "電線や設備への着氷と交通障害に注意してください。",
  snowAccretion: "電線や樹木への着雪、停電、交通障害に注意してください。"
};

const statusLabels = {
  unconfirmed: "未確認",
  corroborated: "複数根拠",
  verified: "確認済",
  actioning: "対応中",
  resolved: "解消済"
};

const categoryLabels = {
  road_flood: "道路冠水",
  inundation: "浸水",
  river: "河川増水",
  landslide: "土砂",
  traffic: "道路通行情報",
  rescue_request: "救助・安否確認要請",
  earthquake_damage: "地震被害",
  lifeline: "ライフライン",
  shelter: "避難所",
  other: "その他"
};

const passabilityLabels = {
  none: "該当なし・未設定",
  closed: "通行止め",
  impassable: "通行不能・通れない",
  restricted: "通行注意・規制あり",
  reopened: "通行再開",
  passed: "通行実績あり"
};

const passabilityModeLabels = {
  unknown: "不明",
  all: "全般",
  "passenger-car": "乗用車",
  "large-vehicle": "大型車",
  motorcycle: "二輪車",
  bicycle: "自転車",
  pedestrian: "歩行者"
};

const roadDirectionLabels = {
  unknown: "方向不明",
  both: "両方向",
  up: "上り",
  down: "下り"
};

const sourceLabels = {
  official: "公式",
  staff: "職員確認",
  citizen: "住民通報",
  sns: "SNS",
  news: "報道",
  web: "Web"
};

const photoLabels = {
  "needs-photo": "写真待ち",
  "has-photo": "写真リンクあり",
  "official-verified": "職員写真確認済",
  unavailable: "取得不可"
};

const locationStatusLabels = {
  unknown: "場所未特定",
  asked: "投稿者へ確認中",
  identified: "場所判明・ピン未設定",
  pinned: "ピン設定済"
};

const locationContactLabels = {
  comment: "投稿コメント",
  dm: "DM",
  phone: "電話・通報",
  onsite: "現地確認",
  other: "その他"
};

const platformLabels = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  bluesky: "Bluesky",
  "yahoo-realtime": "Yahoo!リアルタイム検索",
  web: "Web検索",
  other: "その他"
};

const searchMethodLabels = {
  "manual-search": "画面検索",
  screenshot: "スクショ登録",
  link: "投稿リンク登録",
  api: "連携API",
  json: "JSON取込",
  host: "CBI連携"
};

const alignmentLabels = {
  expected: "想定内被害",
  unexpected: "想定外被害",
  highRisk: "高リスク未確認",
  uncertain: "情報不確実",
  resolved: "解消済"
};

const roadFloodSites = [
  {
    id: "road-39",
    no: 39,
    city: "印西市",
    roadType: "市道",
    route: "印西市 08-014号線",
    name: "大森4233-10 六軒ガード下",
    lat: 35.8379,
    lng: 140.1494,
    accuracy: "住所・通称名からの暫定位置",
    source: "国土交通省 関東地方整備局 千葉国道事務所 道路冠水注意箇所マップ 令和8年6月30日更新",
    sourceUrl: "https://www.ktr.mlit.go.jp/chiba/chiba_index030.html"
  }
];

const locationAliases = [
  {
    patterns: ["やわたパレット", "八幡パレット"],
    title: "やわたパレット（市原市八幡総合市民センター）",
    query: "千葉県市原市八幡1050-3",
    confidence: 0.94,
    reason: "市原市広報に掲載された正式名称・所在地と『白金通り』の記述が一致",
    sourceUrl: "https://prdurbanosichapp1.blob.core.windows.net/common-article/6973379d8dbe435020068490/2026_2_seikatujouhou_16-17_kouhouichihara_web.pdf"
  }
];

const demoRecords = [
  {
    id: "demo-1",
    title: "道路冠水のSNS候補",
    category: "road_flood",
    locationName: "木下駅北側周辺 サンプル",
    lat: 35.8372,
    lng: 140.1482,
    observedAt: "2026-08-13T08:40",
    sourceType: "sns",
    sourceUrl: "",
    status: "unconfirmed",
    severity: "medium",
    passability: "impassable",
    passabilityMode: "all",
    passabilityCheckedAt: "2026-08-13T08:40",
    roadDirection: "both",
    roadGeometry: [[35.83705, 140.1477], [35.8374, 140.1488]],
    photoStatus: "has-photo",
    photoUrl: "SNS画像URLを庁内台帳へ転記",
    photoPrivacy: "internal",
    assignedTo: "道路管理",
    notes: "デモデータです。実被害ではありません。投稿位置と道路冠水注意箇所の近接を確認する想定。",
    hazardFlags: { flood: false, inland: true, road: true, landslide: false }
  },
  {
    id: "demo-2",
    title: "低地で浸水通報",
    category: "inundation",
    locationName: "発作地区周辺 サンプル",
    lat: 35.8264,
    lng: 140.1584,
    observedAt: "2026-08-13T09:15",
    sourceType: "citizen",
    sourceUrl: "",
    status: "corroborated",
    severity: "high",
    photoStatus: "needs-photo",
    photoUrl: "",
    photoPrivacy: "internal",
    assignedTo: "防災課",
    notes: "デモデータです。複数通報があるが写真未確認、現地確認依頼に回す想定。",
    hazardFlags: { flood: true, inland: true, road: false, landslide: false }
  },
  {
    id: "demo-3",
    title: "ハザード外の冠水候補",
    category: "road_flood",
    locationName: "千葉ニュータウン中央駅南側 サンプル",
    lat: 35.8005,
    lng: 140.1166,
    observedAt: "2026-08-13T10:05",
    sourceType: "web",
    sourceUrl: "",
    status: "unconfirmed",
    severity: "low",
    photoStatus: "needs-photo",
    photoUrl: "",
    photoPrivacy: "internal",
    assignedTo: "確認待ち",
    notes: "デモデータです。ハザード一致が弱い地点を想定外候補として扱う例。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false }
  }
];

let records = loadRecords();
let searchLog = loadSearchLog();
let selectedId = null;
let clickAddMode = false;
let roadDrawingMode = false;
let roadDrawingPoints = [];
let roadDrawingOriginal = [];
let locationPickRecordId = null;
let locationContactRecordId = null;
let apiResultItems = [];
let collectorLocationCandidate = null;
let recordFormLocationCandidate = null;
let locationSearchContext = { source: "collector", recordId: null, candidates: [] };
let sharedRecordsSyncTimer = null;
let snsMonitorItems = [];
let snsMonitorPayload = null;
let snsMonitorTimer = null;
let officialShelters = [];
let shelterPayload = null;
let shelterTimer = null;
let selectedShelterId = null;

// ============================================================
// 避難所開設の手動入力（市長SNS・公式LINE等の本文貼り付け）
// 公式APIの反映が遅い場合の補完。この端末のLocalStorageにのみ保存し、
// 公式判定（防災速報照合）とはバッジ・出典表示で明確に区別する。
// ============================================================
const SHELTER_MANUAL_KEY = "cbi-disaster-shelter-manual-v1";
let shelterManualOverrides = loadShelterManualOverrides();
let shelterPasteCandidates = [];
let editingManualShelterId = null;  // 手動入力一覧でインライン編集中の施設ID

function loadShelterManualOverrides() {
  try {
    const raw = localStorage.getItem(SHELTER_MANUAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveShelterManualOverrides() {
  localStorage.setItem(SHELTER_MANUAL_KEY, JSON.stringify(shelterManualOverrides));
}

// 手動入力を優先した実効開設状態。manual が null なら公式判定のまま
function effectiveShelterOpening(shelter) {
  const manual = normalizeManualEntry(shelterManualOverrides[shelter.id]);
  return {
    status: manual ? manual.status : (shelter.openingStatus || "not-announced"),
    manual
  };
}

// 旧形式（time 1つ）の保存データを openedTime / closedTime 形式へ読み替える
function normalizeManualEntry(manual) {
  if (!manual) return null;
  const legacyTime = manual.time || "";
  return {
    status: manual.status === "closed" ? "closed" : "open",
    openedTime: manual.openedTime !== undefined ? manual.openedTime : (manual.status === "closed" ? "" : legacyTime),
    closedTime: manual.closedTime !== undefined ? manual.closedTime : (manual.status === "closed" ? legacyTime : ""),
    source: manual.source || "",
    confirmedAt: manual.confirmedAt || ""
  };
}

function manualTimeLabel(entry) {
  const parts = [];
  if (entry.openedTime) parts.push(`開設 ${entry.openedTime}`);
  if (entry.closedTime) parts.push(`閉鎖 ${entry.closedTime}`);
  return parts.join(" → ");
}

// 貼り付け本文と避難所名を照合する。
// 「木下小」→「木下小学校」等の略記も拾えるよう、正式名と省略形の両方で探す。
function shelterNameVariants(name) {
  const variants = new Set([name]);
  variants.add(name.replace(/小学校$/, "小"));
  variants.add(name.replace(/中学校$/, "中"));
  variants.add(name.replace(/公民館$/, "公民館"));
  variants.add(name.replace(/^印西市立/, ""));
  return [...variants].filter(v => v.length >= 3);
}

function parseShelterPasteText(text) {
  const normalized = String(text || "").replace(/[　\t]/g, " ");
  if (!normalized.trim()) return [];
  // 文単位に割り、施設名ごとに最寄りの文から開設/閉鎖と時刻を推定する
  const segments = normalized.split(/[。\n！!]/).map(s => s.trim()).filter(Boolean);
  const results = [];
  officialShelters.forEach(shelter => {
    const variants = shelterNameVariants(shelter.name);
    let hit = null;
    for (const segment of segments) {
      const matched = variants.find(v => segment.includes(v));
      if (matched) { hit = { segment, matched }; break; }
    }
    if (!hit) return;
    const closed = /閉鎖|閉所|開設.{0,8}(終了|取りやめ)|受入.{0,6}終了/.test(hit.segment);
    const opened = /開設|開放|受け入れ|受入れ|受入開始/.test(hit.segment);
    const times = [...hit.segment.matchAll(/(\d{1,2})[:時](\d{1,2})?分?/g)]
      .map(m => `${m[1]}:${String(m[2] || "0").padStart(2, "0")}`);
    // 開設と閉鎖が同じ文にある場合は 1つ目=開設時刻、2つ目=閉鎖時刻 とみなす（プレビューで修正可能）
    const openedTime = closed && !opened ? "" : (times[0] || "");
    const closedTime = closed ? (opened ? (times[1] || "") : (times[0] || "")) : "";
    results.push({
      id: shelter.id,
      name: shelter.name,
      status: closed ? "closed" : opened ? "open" : "open",
      ambiguous: !closed && !opened,
      openedTime,
      closedTime,
      segment: hit.segment
    });
  });
  return results;
}

function renderShelterPastePreview() {
  const preview = document.getElementById("shelter-paste-preview");
  const applyButton = document.getElementById("shelter-paste-apply-button");
  if (!shelterPasteCandidates.length) {
    preview.hidden = false;
    preview.innerHTML = '<div class="detail-empty">本文から避難所名を見つけられませんでした。施設名（例: 木下小学校）が含まれているか確認してください。</div>';
    applyButton.disabled = true;
    return;
  }
  preview.hidden = false;
  preview.innerHTML = shelterPasteCandidates.map((item, index) => `
    <div class="shelter-paste-row">
      <label class="toggleRow">
        <input type="checkbox" data-paste-check="${index}" checked>
        <strong>${escapeHtml(item.name)}</strong>
      </label>
      <select data-paste-status="${index}">
        <option value="open" ${item.status === "open" ? "selected" : ""}>開設</option>
        <option value="closed" ${item.status === "closed" ? "selected" : ""}>閉鎖・終了</option>
      </select>
      <input type="text" data-paste-opened="${index}" value="${escapeAttribute(item.openedTime)}" placeholder="開設時刻 例 9:00" size="10">
      <input type="text" data-paste-closed="${index}" value="${escapeAttribute(item.closedTime)}" placeholder="閉鎖時刻 例 17:00" size="10">
      ${item.ambiguous ? '<span class="badge yellow">開設/閉鎖の語が本文になく「開設」と仮定</span>' : ""}
      <div class="shelter-paste-segment">${escapeHtml(truncateText(item.segment, 90))}</div>
    </div>
  `).join("");
  applyButton.disabled = false;
}

function applyShelterPaste() {
  const source = getFormValue("shelter-paste-source") || "その他";
  let applied = 0;
  shelterPasteCandidates.forEach((item, index) => {
    const check = document.querySelector(`[data-paste-check="${index}"]`);
    if (!check || !check.checked) return;
    const status = document.querySelector(`[data-paste-status="${index}"]`)?.value === "closed" ? "closed" : "open";
    const openedTime = String(document.querySelector(`[data-paste-opened="${index}"]`)?.value || "").trim();
    const closedTime = String(document.querySelector(`[data-paste-closed="${index}"]`)?.value || "").trim();
    const previous = normalizeManualEntry(shelterManualOverrides[item.id]);
    shelterManualOverrides[item.id] = {
      status,
      // 閉鎖の更新で開設時刻を空欄のまま反映しても、記録済みの開設時刻は消さない
      openedTime: openedTime || (previous ? previous.openedTime : ""),
      closedTime,
      source,
      confirmedAt: new Date().toISOString()
    };
    applied += 1;
  });
  if (!applied) return;
  saveShelterManualOverrides();
  renderShelters();
  renderShelterManualList();
  shelterPasteCandidates = [];
  document.getElementById("shelter-paste-preview").hidden = true;
  document.getElementById("shelter-paste-apply-button").disabled = true;
  document.getElementById("shelter-paste-text").value = "";
  // 反映結果は一覧の「手動」バッジと右上の件数表示（renderShelterManualList）で確認できる
  document.getElementById("shelter-paste-dialog").close();
}

function renderShelterManualList() {
  const container = document.getElementById("shelter-manual-list");
  const badge = document.getElementById("shelter-manual-count");
  const entries = Object.entries(shelterManualOverrides);
  if (badge) {
    badge.hidden = entries.length === 0;
    badge.textContent = entries.length ? `手動入力 ${entries.length}件` : "";
  }
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = '<div class="detail-empty">手動入力はありません。</div>';
    return;
  }
  container.innerHTML = entries.map(([id, rawManual]) => {
    const manual = normalizeManualEntry(rawManual);
    const shelter = officialShelters.find(item => item.id === id);
    if (editingManualShelterId === id) {
      return `
      <div class="shelter-paste-row">
        <strong>${escapeHtml(shelter?.name || id)}</strong>
        <select data-manual-edit-status="${escapeAttribute(id)}">
          <option value="open" ${manual.status === "open" ? "selected" : ""}>開設</option>
          <option value="closed" ${manual.status === "closed" ? "selected" : ""}>閉鎖・終了</option>
        </select>
        <input type="text" data-manual-edit-opened="${escapeAttribute(id)}" value="${escapeAttribute(manual.openedTime)}" placeholder="開設時刻 例 9:00" size="10">
        <input type="text" data-manual-edit-closed="${escapeAttribute(id)}" value="${escapeAttribute(manual.closedTime)}" placeholder="閉鎖時刻 例 17:00" size="10">
        <button type="button" class="text-button" data-manual-save="${escapeAttribute(id)}">保存</button>
        <button type="button" class="text-button" data-manual-cancel>キャンセル</button>
      </div>`;
    }
    const timeLabel = manualTimeLabel(manual);
    return `
      <div class="shelter-paste-row">
        <strong>${escapeHtml(shelter?.name || id)}</strong>
        <span class="badge ${manual.status === "open" ? "green" : "gray"}">${manual.status === "open" ? "開設" : "閉鎖"}（手動）</span>
        <span>${escapeHtml(timeLabel ? `${timeLabel} ・ ` : "")}${escapeHtml(manual.source || "")} / ${escapeHtml(formatDateTime(toDateTimeLocal(manual.confirmedAt)))}確認</span>
        <button type="button" class="text-button" data-manual-edit="${escapeAttribute(id)}">編集</button>
        <button type="button" class="text-button" data-manual-remove="${escapeAttribute(id)}">解除</button>
      </div>`;
  }).join("");
}

function findManualEditField(kind, id) {
  return [...document.querySelectorAll(`[data-manual-edit-${kind}]`)]
    .find(node => node.getAttribute(`data-manual-edit-${kind}`) === id) || null;
}

function handleShelterManualListClick(event) {
  const editButton = event.target.closest("[data-manual-edit]");
  if (editButton) {
    editingManualShelterId = editButton.dataset.manualEdit;
    renderShelterManualList();
    return;
  }
  if (event.target.closest("[data-manual-cancel]")) {
    editingManualShelterId = null;
    renderShelterManualList();
    return;
  }
  const saveButton = event.target.closest("[data-manual-save]");
  if (saveButton) {
    const id = saveButton.dataset.manualSave;
    const previous = normalizeManualEntry(shelterManualOverrides[id]);
    if (previous) {
      shelterManualOverrides[id] = {
        status: findManualEditField("status", id)?.value === "closed" ? "closed" : "open",
        openedTime: String(findManualEditField("opened", id)?.value || "").trim(),
        closedTime: String(findManualEditField("closed", id)?.value || "").trim(),
        source: previous.source,
        confirmedAt: new Date().toISOString()
      };
      saveShelterManualOverrides();
    }
    editingManualShelterId = null;
    renderShelters();
    renderShelterManualList();
    return;
  }
  const button = event.target.closest("[data-manual-remove]");
  if (!button) return;
  if (editingManualShelterId === button.dataset.manualRemove) editingManualShelterId = null;
  delete shelterManualOverrides[button.dataset.manualRemove];
  saveShelterManualOverrides();
  renderShelters();
  renderShelterManualList();
}
let screenshotState = {
  image: null,
  scale: 1,
  crop: null,
  dragging: false,
  start: null,
  locationCandidate: null,
  relativeTime: null,
  gpsInspectionState: "not-checked",
  autoGpsRecordId: null
};

const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true
}).fitBounds(INZAI_BOUNDS);

const baseLayers = {
  pale: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    attribution: "地理院タイル",
    maxZoom: 18
  }),
  std: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", {
    attribution: "地理院タイル",
    maxZoom: 18
  }),
  photo: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", {
    attribution: "地理院タイル",
    maxZoom: 18
  })
};

const hazardLayers = {
  // 色別標高図。低い土地ほど青〜緑で描かれる。
  // 内水氾濫はハザード想定区域の外でも起きるため（2026年8月の千葉豪雨では
  // 浸水報告の55.7%が想定区域外・ウェザーニューズ社調査）、
  // 「周囲より低い場所」を平面で把握する手掛かりとして重ねられるようにする。
  relief: L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png", {
    attribution: "地理院タイル（色別標高図）",
    opacity: 0.56,
    maxZoom: 15
  }),
  floodMax: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  floodPlan: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/01_flood_l1_shinsuishin_newlegend_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  inland: L.tileLayer("https://disaportaldata.gsi.go.jp/raster/02_naisui_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  })
};

const jshisLayers = {
  jshisPshm: L.tileLayer.wms(String(APP_CONFIG.jshisPshmWmsUrl || "https://www.j-shis.bosai.go.jp/map/wms/pshm/Y2024"), {
    layers: "P-Y2024-MAP-AVR-TTL_MTTL-T30_I55_PS",
    styles: "default",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    crs: L.CRS.EPSG3857,
    attribution: '<a href="https://www.j-shis.bosai.go.jp/" target="_blank" rel="noreferrer">J-SHIS（防災科研）</a>',
    opacity: 0.56,
    zIndex: 440,
    updateWhenIdle: true
  }),
  jshisGround: L.tileLayer.wms(String(APP_CONFIG.jshisGroundWmsUrl || "https://www.j-shis.bosai.go.jp/map/wms/sstrct/V4"), {
    layers: "Z-V4-JAPAN-AMP-VS400_M250-IDARV2",
    styles: "default",
    format: "image/png",
    transparent: true,
    version: "1.3.0",
    crs: L.CRS.EPSG3857,
    attribution: '<a href="https://www.j-shis.bosai.go.jp/" target="_blank" rel="noreferrer">J-SHIS（防災科研）</a>',
    opacity: 0.56,
    zIndex: 441,
    updateWhenIdle: true
  })
};

const jshisLayerMeta = {
  jshisPshm: { statusId: "jshis-pshm-status", idle: "2024年版・将来予測" },
  jshisGround: { statusId: "jshis-ground-status", idle: "V4・250mメッシュ" }
};

const rainNowcastLayer = L.tileLayer("", {
  attribution: "気象庁 高解像度降水ナウキャスト",
  opacity: 0.62,
  maxNativeZoom: 10,
  maxZoom: 18,
  zIndex: 450,
  updateWhenIdle: true
});
let rainNowcastTime = null;

// キキクル（気象庁 危険度分布）。雨雲レーダーと同じ jmatile 配信で、土砂・浸水・洪水の3要素。
// WOUDIOの観光防災マップ（2026-08-28 参照依頼）が表示していたのも同じデータ。
const KIKIKURU_ELEMENTS = {
  kikikuruLand: { element: "land", label: "土砂キキクル" },
  kikikuruInund: { element: "inund", label: "浸水キキクル" },
  kikikuruFlood: { element: "flood", label: "洪水キキクル" }
};
const kikikuruLayers = {};
Object.keys(KIKIKURU_ELEMENTS).forEach(key => {
  kikikuruLayers[key] = L.tileLayer("", {
    attribution: "気象庁 キキクル（危険度分布）",
    opacity: 0.62,
    maxNativeZoom: 10,
    maxZoom: 18,
    zIndex: 455,
    updateWhenIdle: true
  });
});

async function refreshKikikuru(showLayer) {
  const status = document.getElementById("kikikuru-layer-status");
  try {
    const response = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/risk/targetTimes.json?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const times = await response.json();
    const latest = Array.isArray(times)
      ? times.find(item => item?.basetime && item?.validtime && item?.member && item?.elements?.includes("land"))
      : null;
    if (!latest) throw new Error("最新時刻がありません");
    Object.entries(KIKIKURU_ELEMENTS).forEach(([key, def]) => {
      const template = `https://www.jma.go.jp/bosai/jmatile/data/risk/${latest.basetime}/${latest.member}/${latest.validtime}/surf/${def.element}/{z}/{x}/{y}.png`;
      kikikuruLayers[key].setUrl(template, false);
    });
    if (status) {
      status.textContent = `${formatJmaTime(latest.validtime)}時点・5分更新`;
      status.classList.remove("is-error");
    }
    Object.keys(KIKIKURU_ELEMENTS).forEach(key => {
      const enabled = document.querySelector(`[data-overlay="${key}"]`)?.checked;
      if (enabled && !map.hasLayer(kikikuruLayers[key])) kikikuruLayers[key].addTo(map);
    });
  } catch (error) {
    if (status) {
      status.textContent = "取得できません";
      status.classList.add("is-error");
    }
    if (showLayer) {
      appendSystemWorkLog("キキクルレイヤー", "blocked", `気象庁キキクルの最新配信を取得できませんでした: ${error?.message || "不明なエラー"}`, "通信状態と気象庁配信URLを確認する");
    }
  }
}

const landslideGroup = L.layerGroup([
  L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  }),
  L.tileLayer("https://disaportaldata.gsi.go.jp/raster/05_jisuberikeikaikuiki_data/{z}/{x}/{y}.png", {
    attribution: "ハザードマップポータルサイト",
    opacity: 0.56,
    maxZoom: 17
  })
]);

const recordLayer = L.layerGroup();
const roadFloodLayer = L.layerGroup();
const roadDrawingLayer = L.layerGroup();
const shelterLayer = L.layerGroup();
// 公式発表タイムライン（initTimeline は起動時に呼ばれるため、宣言は必ずこの位置より前に置く）
let timelinePayload = null;
let timelineTimer = null;
const TIMELINE_TRUST_LABEL = { official: "公式", "semi-official": "準公式", unverified: "未確認" };
const TIMELINE_CHANGE_LABEL = { update: "更新", cancel: "取消・解除" };
const PRESENCE_SESSION_KEY = "cbi-disaster-presence-session-v1";
let presenceTimer = null;
const wellLayer = L.layerGroup();
let officialWells = [];
let wellPayload = null;
const bunkazaiLayer = L.layerGroup();   // 平時参考: 文化財（メタバースと同じ bunkazai.json）
const kominkanLayer = L.layerGroup();   // 平時参考: 公民館・交流館・文化ホール（kominkan.json）
const pastFloodLayer = L.layerGroup();  // 過去の冠水実績（past-flood-points.json・対象日フィルタの対象外）
const boundaryLayer = L.geoJSON(null, {
  style: {
    color: "#2365a8",
    weight: 2,
    fillColor: "#2365a8",
    fillOpacity: 0.05,
    dashArray: "7 5"
  }
});

baseLayers.pale.addTo(map);
hazardLayers.floodMax.addTo(map);
hazardLayers.inland.addTo(map);
recordLayer.addTo(map);
roadDrawingLayer.addTo(map);
boundaryLayer.addTo(map);
shelterLayer.addTo(map);

initBoundary();
refreshRainNowcast(false);
refreshWeatherWarnings(false);
refreshEarthquakeSummary(false);
initTimeline();
renderRoadFloodSites();
initIntegration();
applyTrialRecordFromQuery();
renderAll();
bindEvents();
initSnsMonitor();
initShelters();
initHelpGuide();
scheduleMapResize();

function bindEvents() {
  document.getElementById("base-layer-select").addEventListener("change", event => {
    Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
    baseLayers[event.target.value].addTo(map);
  });

  document.querySelectorAll("[data-overlay]").forEach(input => {
    input.addEventListener("change", () => toggleOverlay(input.dataset.overlay, input.checked));
  });

  document.getElementById("hazard-opacity").addEventListener("input", event => {
    const opacity = Number(event.target.value) / 100;
    document.getElementById("hazard-opacity-value").textContent = `${event.target.value}%`;
    Object.values(hazardLayers).forEach(layer => layer.setOpacity(opacity));
    Object.values(jshisLayers).forEach(layer => layer.setOpacity(opacity));
    landslideGroup.eachLayer(layer => layer.setOpacity(opacity));
    rainNowcastLayer.setOpacity(opacity);
  });

  document.getElementById("reset-view-button").addEventListener("click", () => map.fitBounds(INZAI_BOUNDS));
  document.getElementById("incident-date").addEventListener("change", () => {
    selectedId = null;
    renderAll();
    refreshSnsMonitor(false);
    refreshTimeline(false);
  });
  document.getElementById("timeline-days").addEventListener("change", () => refreshTimeline(false));
  document.getElementById("refresh-timeline-button").addEventListener("click", () => refreshTimeline(true));
  document.getElementById("timeline-list").addEventListener("click", handleTimelineListClick);
  document.getElementById("past-flood-dates")?.addEventListener("change", handlePastFloodDateChange);
  document.getElementById("past-flood-dates")?.addEventListener("click", (e) => { if (e.target.closest("[data-past-flood-all]")) handlePastFloodDateChange(e); });
  document.getElementById("show-all-dates").addEventListener("change", () => {
    selectedId = null;
    renderAll();
  });
  document.getElementById("print-button").addEventListener("click", () => window.print());
  document.getElementById("sns-collector-button").addEventListener("click", openCollectorDialog);
  document.getElementById("help-button").addEventListener("click", openHelpDialog);
  document.getElementById("official-links-button").addEventListener("click", openOfficialLinksDialog);
  document.getElementById("help-start-button").addEventListener("click", startFromHelp);
  document.getElementById("register-social-link-button").addEventListener("click", registerSocialLink);
  document.getElementById("collector-location-search-button").addEventListener("click", () => openLocationSearchDialog({ source: "collector" }));
  document.getElementById("record-location-search-button").addEventListener("click", () => openLocationSearchDialog({ source: "record-form" }));
  document.getElementById("free-location-search-button").addEventListener("click", runFreeLocationSearch);
  document.getElementById("ai-location-search-button").addEventListener("click", runAiLocationSearch);
  document.getElementById("location-candidate-results").addEventListener("click", handleLocationCandidateAction);
  ["location-search-post-text", "location-search-comments", "location-search-hint"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateLocationWebSearchLink);
  });
  document.getElementById("refresh-earthquake-button").addEventListener("click", () => refreshEarthquakeSummary(true));
  document.getElementById("refresh-weather-warning-button").addEventListener("click", () => refreshWeatherWarnings(true));
  document.getElementById("refresh-sns-monitor-button").addEventListener("click", () => refreshSnsMonitor(true));
  document.getElementById("sns-monitor-list").addEventListener("click", handleSnsMonitorAction);
  document.getElementById("sns-manual-register-button").addEventListener("click", registerManualMonitorUrl);
  document.getElementById("refresh-shelters-button").addEventListener("click", () => refreshShelters(true));
  document.getElementById("show-shelter-flood-button").addEventListener("click", showShelterFloodLayers);
  document.getElementById("shelter-hazard-filter").addEventListener("change", renderShelters);
  document.getElementById("shelter-kind-filter").addEventListener("change", renderShelters);
  document.getElementById("shelter-opening-filter").addEventListener("change", renderShelters);
  document.getElementById("shelter-keyword-filter").addEventListener("input", renderShelters);
  document.getElementById("shelter-list").addEventListener("click", handleShelterListClick);
  document.getElementById("shelter-paste-button").addEventListener("click", () => {
    renderShelterManualList();
    document.getElementById("shelter-paste-dialog").showModal();
  });
  document.getElementById("shelter-paste-parse-button").addEventListener("click", () => {
    shelterPasteCandidates = parseShelterPasteText(document.getElementById("shelter-paste-text").value);
    renderShelterPastePreview();
  });
  document.getElementById("shelter-paste-apply-button").addEventListener("click", applyShelterPaste);
  document.getElementById("shelter-manual-list").addEventListener("click", handleShelterManualListClick);
  document.getElementById("shelter-manual-clear-button").addEventListener("click", () => {
    shelterManualOverrides = {};
    saveShelterManualOverrides();
    renderShelters();
    renderShelterManualList();
  });
  document.getElementById("paste-social-link-button").addEventListener("click", pasteSocialLink);
  document.getElementById("collector-post-url").addEventListener("input", syncCollectorPlatformFromUrl);
  document.getElementById("collector-platform").addEventListener("change", updateCollectorPlatformHelp);
  document.querySelectorAll('[name="collector-search-mode"]').forEach(input => {
    input.addEventListener("change", updateCollectorPlatformHelp);
  });
  document.getElementById("cancel-location-pick-button").addEventListener("click", cancelLocationPick);
  document.getElementById("ask-comment-button").addEventListener("click", () => beginLocationContact("comment"));
  document.getElementById("ask-dm-button").addEventListener("click", () => beginLocationContact("dm"));
  document.getElementById("add-point-button").addEventListener("click", () => openRecordDialog());
  document.getElementById("add-road-status-button").addEventListener("click", openRoadStatusDialog);
  document.getElementById("record-road-draw-button").addEventListener("click", startRoadSectionSelection);
  document.getElementById("record-road-clear-button").addEventListener("click", clearRoadSection);
  document.getElementById("record-passability").addEventListener("change", updateRoadColorPreview);
  document.getElementById("road-draw-undo-button").addEventListener("click", undoRoadSectionPoint);
  document.getElementById("road-draw-cancel-button").addEventListener("click", cancelRoadSectionSelection);
  document.getElementById("road-draw-finish-button").addEventListener("click", finishRoadSectionSelection);
  document.getElementById("map-click-button").addEventListener("click", toggleClickAddMode);
  document.getElementById("screenshot-button").addEventListener("click", openScreenshotDialog);
  document.getElementById("use-map-center-button").addEventListener("click", useMapCenter);
  document.getElementById("record-form").addEventListener("submit", saveRecordFromForm);
  document.getElementById("delete-record-button").addEventListener("click", deleteCurrentRecord);
  document.getElementById("import-button").addEventListener("click", () => document.getElementById("import-dialog").showModal());
  document.getElementById("import-form").addEventListener("submit", importCsv);
  document.getElementById("copy-template-button").addEventListener("click", copyCsvTemplate);
  document.getElementById("screenshot-file").addEventListener("change", loadScreenshotFile);
  document.getElementById("capture-screen-button").addEventListener("click", captureScreen);
  document.getElementById("screenshot-form").addEventListener("submit", saveScreenshotEvidence);
  document.getElementById("reset-crop-button").addEventListener("click", resetCrop);
  document.getElementById("download-crop-button").addEventListener("click", downloadCrop);
  document.getElementById("clear-screenshot-button").addEventListener("click", clearScreenshot);
  document.getElementById("run-ocr-button").addEventListener("click", runEvidenceOcr);
  document.getElementById("screenshot-dialog").addEventListener("paste", handleScreenshotPaste);
  bindScreenshotDropZone();
  document.getElementById("open-social-search-button").addEventListener("click", openSocialSearch);
  document.getElementById("to-screenshot-button").addEventListener("click", collectorToScreenshot);
  document.getElementById("api-search-button").addEventListener("click", searchViaBridge);
  document.getElementById("parse-sns-json-button").addEventListener("click", parseSnsJsonInput);
  document.getElementById("api-results").addEventListener("click", handleApiResultAction);
  document.getElementById("clear-search-log-button").addEventListener("click", clearSearchLog);
  document.querySelectorAll("[data-query]").forEach(button => {
    button.addEventListener("click", () => setFormValue("collector-query", button.dataset.query));
  });
  ["record-title", "record-location", "record-lat", "record-lng", "record-observed-at", "record-source-url"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderRecordDuplicateWarning);
  });
  ["evidence-platform", "evidence-query", "evidence-url", "evidence-observed-at", "evidence-ocr-text"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderEvidenceDuplicateWarning);
  });
  bindCropCanvas();
  document.getElementById("export-csv-button").addEventListener("click", exportCsv);
  document.getElementById("export-geojson-button").addEventListener("click", exportGeoJson);
  document.getElementById("load-demo-button").addEventListener("click", loadDemoRecords);
  document.getElementById("clear-filters-button").addEventListener("click", clearFilters);
  document.getElementById("keyword-filter").addEventListener("input", renderAll);
  document.getElementById("photo-filter").addEventListener("change", renderAll);
  document.getElementById("passability-filter").addEventListener("change", renderAll);
  document.querySelectorAll("[data-status]").forEach(input => input.addEventListener("change", renderAll));
  document.querySelectorAll("[data-close-dialog]").forEach(button => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  // 大量データのレイヤー（土砂災害区域）は表示範囲が変わるたびに描き直す
  map.on("moveend", refreshVisibleOpenDataLayers);
  map.on("zoomend", refreshVisibleOpenDataLayers);
  map.on("click", event => {
    if (roadDrawingMode) {
      addRoadSectionPoint(event.latlng);
      return;
    }
    if (locationPickRecordId) {
      completeLocationPick(event.latlng);
      return;
    }
    if (!clickAddMode) return;
    openRecordDialog({ lat: event.latlng.lat, lng: event.latlng.lng });
  });

  window.addEventListener("resize", scheduleMapResize);
  window.addEventListener("orientationchange", scheduleMapResize);
}

function scheduleMapResize() {
  requestAnimationFrame(() => map.invalidateSize({ animate: false, pan: false }));
  setTimeout(() => map.invalidateSize({ animate: false, pan: false }), 240);
}

function initIntegration() {
  const homeLink = document.querySelector(".cbi-home-link");
  if (homeLink && APP_CONFIG.cbiHomeUrl) homeLink.href = APP_CONFIG.cbiHomeUrl;
  if (new URLSearchParams(window.location.search).get("embed") === "1") {
    document.body.classList.add("embed-mode");
  }
  if (PUBLIC_VIEW) {
    document.body.classList.add("public-view");
    document.getElementById("operation-banner-title").textContent = "一般公開用の参考表示";
    document.getElementById("operation-banner-text").textContent = "公開承認済みの参考情報だけを表示します。救助・事件・事故は119・110へ通報し、公式情報を優先してください。";
    applyPublicViewControls();
  }

  const endpoint = String(APP_CONFIG.snsSearchEndpoint || "").trim();
  const monitorEndpoint = String(APP_CONFIG.snsMonitorEndpoint || "").trim();
  const apiStatus = document.getElementById("api-status");
  const apiButton = document.getElementById("api-search-button");
  const apiNote = document.getElementById("collector-api-note");
  if (endpoint) {
    apiStatus.textContent = "SNS API接続設定済み";
    apiStatus.classList.add("is-connected");
    apiButton.disabled = false;
    apiNote.textContent = "CBI連携APIを通じて検索します。Metaのアクセストークンはこの画面には保存しません。";
  } else {
    apiStatus.textContent = monitorEndpoint ? "SNS自動巡回接続" : "試作・端末内保存";
    if (monitorEndpoint) apiStatus.classList.add("is-connected");
    apiButton.disabled = true;
    apiButton.title = "config.js にCBI連携APIを設定すると利用できます";
    apiNote.textContent = "現在は検索画面・スクショ・JSON取込を利用できます。公式API接続時は config.js の snsSearchEndpoint にCBI側の連携先を設定します。";
  }

  const locationAiEndpoint = String(APP_CONFIG.locationAiEndpoint || "").trim();
  const aiButton = document.getElementById("ai-location-search-button");
  if (locationAiEndpoint) {
    aiButton.disabled = false;
    aiButton.title = "CBI側のAI連携先で候補を補完します";
  } else {
    aiButton.disabled = true;
    aiButton.title = "CBI側のAI連携先を設定すると利用できます";
  }

  const operatorEndpoint = String(APP_CONFIG.operatorSessionEndpoint || "").trim();
  const operatorStatus = document.getElementById("operator-status");
  if (operatorEndpoint) {
    operatorStatus.textContent = "利用資格を確認中";
    initOperatorSession(operatorEndpoint);
  } else {
    operatorStatus.textContent = "試作利用";
  }

  window.CBIDisasterMap = {
    version: APP_CONFIG.appVersion || "",
    getRecords: () => records.map(withoutLargeImage),
    getSearchLog: () => searchLog.map(item => ({ ...item })),
    importSnsPayload: (payload, platform = "web") => consumeSnsPayload(payload, platform, "host")
  };
}

function initSnsMonitor() {
  const endpoint = String(APP_CONFIG.snsMonitorEndpoint || "").trim();
  const panel = document.getElementById("sns-monitor-panel");
  if (!endpoint) {
    panel.hidden = true;
    return;
  }
  refreshSnsMonitor(false);
  clearInterval(snsMonitorTimer);
  snsMonitorTimer = setInterval(() => refreshSnsMonitor(true, true), 5 * 60 * 1000);
}

async function refreshSnsMonitor(runScan = false, quiet = false) {
  const endpoint = String(APP_CONFIG.snsMonitorEndpoint || "").trim();
  if (!endpoint) return;
  const button = document.getElementById("refresh-sns-monitor-button");
  const status = document.getElementById("sns-monitor-status");
  if (!quiet) {
    button.disabled = true;
    status.classList.remove("is-error");
    status.textContent = runScan ? "各SNSの新着を確認しています..." : "巡回結果を読み込んでいます...";
  }
  try {
    if (runScan) {
      const scanResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "operator" })
      });
      if (!scanResponse.ok) throw new Error(`巡回API HTTP ${scanResponse.status}`);
    }
    const date = getFormValue("incident-date");
    const response = await fetch(`${endpoint}?date=${encodeURIComponent(date)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`新着API HTTP ${response.status}`);
    const payload = await response.json();
    snsMonitorItems = (Array.isArray(payload.items) ? payload.items : [])
      .map(item => normalizeSnsItem(item, item.platform || "web"))
      .filter(Boolean);
    snsMonitorPayload = payload;
    renderSnsMonitor(payload);
  } catch (error) {
    status.classList.add("is-error");
    status.textContent = `SNS巡回結果を取得できませんでした（${error?.message || "接続エラー"}）。`;
    appendSystemWorkLog("SNS自動巡回", "blocked", status.textContent, "CIDAO巡回API、DBマイグレーション、SNS認証状態を確認する");
  } finally {
    button.disabled = false;
  }
}

function renderSnsMonitor(payload) {
  const status = document.getElementById("sns-monitor-status");
  const list = document.getElementById("sns-monitor-list");
  const count = document.getElementById("sns-monitor-new-count");
  const lastRunAt = payload?.lastRun?.finished_at || payload?.lastRun?.started_at || "";
  const lastRunStatus = payload?.lastRun?.status || "waiting";
  status.classList.toggle("is-error", lastRunStatus === "failed");
  status.textContent = lastRunAt
    ? `${formatDateTime(toDateTimeLocal(lastRunAt))} 巡回 / ${snsMonitorItems.length}件（${getFormValue("incident-date")}）`
    : "初回巡回を待っています。";

  const unregisteredCount = snsMonitorItems.filter(item => !findExactDuplicate(item)).length;
  count.textContent = String(unregisteredCount);
  count.hidden = unregisteredCount === 0;
  renderSnsPlatformStatus(payload?.platforms || []);
  renderSnsMonitorRules(payload?.rules || []);

  if (!snsMonitorItems.length) {
    list.innerHTML = '<div class="detail-empty">対象日の新着候補はありません。</div>';
    return;
  }
  // 市長・市公式の発信は災害時に最優先で確認したいので先頭へ並べ替える
  const ordered = snsMonitorItems
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (b.item.priorityLabel ? 1 : 0) - (a.item.priorityLabel ? 1 : 0));
  list.innerHTML = ordered.map(({ item, index }) => {
    const duplicate = findExactDuplicate(item);
    const platform = platformLabels[item.platform] || item.platform;
    return `
      <article class="sns-monitor-item ${duplicate ? "is-registered" : ""} ${item.priorityLabel ? "is-priority" : ""}">
        <a class="sns-monitor-link" href="${escapeAttribute(item.permalink)}" target="_blank" rel="noreferrer">
          <div class="sns-monitor-meta">
            <span class="sns-monitor-platform">${escapeHtml(platform)}</span>
            ${item.priorityLabel ? `<span class="sns-monitor-priority">${escapeHtml(item.priorityLabel)}</span>` : ""}
            <span>${escapeHtml(item.username ? `@${item.username}` : "投稿者不明")}</span>
            <span>${escapeHtml(formatDateTime(toDateTimeLocal(item.timestamp)))}</span>
          </div>
          <p class="sns-monitor-text">${escapeHtml(truncateText(item.text || "本文を取得できない投稿", 120))}</p>
          ${item.mediaUrl ? `<img class="sns-monitor-thumb" src="${escapeAttribute(item.mediaUrl)}" alt="${escapeAttribute(`${platform}投稿の写真`)}" loading="lazy" referrerpolicy="no-referrer">` : ""}
        </a>
        <div class="sns-monitor-actions">
          <button class="tool-button ${duplicate ? "" : "primary"}" type="button" data-monitor-index="${index}" ${duplicate ? "disabled" : ""}>${duplicate ? "登録済" : "未確認候補へ"}</button>
        </div>
      </article>`;
  }).join("");
}

function renderSnsPlatformStatus(platforms) {
  const node = document.getElementById("sns-platform-status");
  const expected = ["threads", "instagram", "bluesky"];
  const byPlatform = new Map(platforms.map(item => [item.platform, item]));
  node.innerHTML = expected.map(platform => {
    const item = byPlatform.get(platform);
    const label = platformLabels[platform] || (platform === "bluesky" ? "Bluesky" : platform);
    const state = !item ? "waiting" : item.status;
    const className = state === "success" ? "is-active" : state === "failed" ? "is-error" : "";
    const stateLabel = state === "success" ? "巡回中" : state === "failed" ? "要確認" : "待機";
    const title = item?.message ? ` title="${escapeAttribute(item.message)}"` : "";
    return `<span class="platform-state ${className}"${title}>${escapeHtml(label)} ${stateLabel}</span>`;
  }).join("");
}

function handleSnsMonitorAction(event) {
  const button = event.target.closest("[data-monitor-index]");
  if (!button) return;
  const item = snsMonitorItems[Number(button.dataset.monitorIndex)];
  if (!item) return;
  addApiResultAsRecord(item, { keepOpen: true, query: item.query || "SNS自動巡回" });
  renderSnsMonitor(snsMonitorPayload || {});
}

function renderSnsMonitorRules(rules) {
  const node = document.getElementById("sns-monitor-rules");
  const links = document.getElementById("sns-manual-search-links");
  const activeRules = (Array.isArray(rules) ? rules : []).filter(rule => rule.enabled && rule.query);
  if (!activeRules.length) {
    node.innerHTML = '<span class="detail-empty">有効な検索語はありません。</span>';
  } else {
    const grouped = new Map();
    activeRules.forEach(rule => {
      if (!grouped.has(rule.platform)) grouped.set(rule.platform, []);
      grouped.get(rule.platform).push(rule.query);
    });
    node.innerHTML = Array.from(grouped.entries()).map(([platform, queries]) => `
      <div><strong>${escapeHtml(platformLabels[platform] || platform)}</strong><span>${queries.map(escapeHtml).join(" / ")}</span></div>
    `).join("");
  }

  const manualRules = activeRules.slice(0, 9).map(rule => ({ ...rule }));
  const fallbackQuery = activeRules[0]?.query || "印西市 災害";
  manualRules.push({ platform: "facebook", query: fallbackQuery });
  links.innerHTML = manualRules.map(rule => `
    <a class="manual-search-link" href="${escapeAttribute(buildSocialSearchUrl(rule.platform, rule.query))}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(platformLabels[rule.platform] || rule.platform)}: ${escapeHtml(rule.query)}
    </a>
  `).join("");
}

function registerManualMonitorUrl() {
  const input = document.getElementById("sns-manual-post-url");
  const url = input.value.trim();
  if (!isHttpUrl(url)) {
    alert("見つけたSNS投稿のURLを入力してください。");
    input.focus();
    return;
  }
  openCollectorDialog();
  setFormValue("collector-post-url", url);
  syncCollectorPlatformFromUrl();
  const platform = detectPlatformFromUrl(url);
  const firstQuery = (snsMonitorPayload?.rules || []).find(rule => rule.enabled && (!platform || rule.platform === platform))?.query;
  if (firstQuery) setFormValue("collector-query", firstQuery);
  document.getElementById("collector-link-status").textContent = "手動巡回で見つけたURLを設定しました。分かる範囲で本文・時刻・場所を補ってください。";
}

function initShelters() {
  const endpoint = String(APP_CONFIG.shelterEndpoint || "").trim();
  if (!endpoint) {
    document.getElementById("shelter-summary").textContent = "避難所APIが未設定です。";
    return;
  }
  refreshShelters(false);
  clearInterval(shelterTimer);
  shelterTimer = setInterval(() => refreshShelters(false, true), 5 * 60 * 1000);
  // 災害用井戸は静的データのため初回のみ取得する
  refreshWells();
  initPresence();
}

async function refreshShelters(showStatus = false, quiet = false) {
  const endpoint = String(APP_CONFIG.shelterEndpoint || "").trim();
  if (!endpoint) return;
  const button = document.getElementById("refresh-shelters-button");
  const summary = document.getElementById("shelter-summary");
  if (!quiet) {
    button.disabled = true;
    if (showStatus) summary.textContent = "印西市の公式避難所・防災速報を更新中です。";
  }
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`避難所API HTTP ${response.status}`);
    const payload = await response.json();
    officialShelters = Array.isArray(payload.shelters) ? payload.shelters.filter(shelter => (
      Number.isFinite(Number(shelter.latitude)) && Number.isFinite(Number(shelter.longitude))
    )) : [];
    shelterPayload = payload;
    renderShelters();
    renderShelterManualList();
  } catch (error) {
    summary.classList.add("is-error");
    summary.textContent = `避難所情報を取得できませんでした（${error?.message || "接続エラー"}）。`;
  } finally {
    button.disabled = false;
  }
}

// 印西市公式オープンデータの災害用井戸（断水時の生活用水）。
// 飲用可否は公表されていないため、ポップアップでも必ずその旨を表示する。
async function refreshWells(showStatus = false) {
  const endpoint = String(APP_CONFIG.wellEndpoint || "").trim();
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`災害用井戸API HTTP ${response.status}`);
    const payload = await response.json();
    officialWells = Array.isArray(payload.wells) ? payload.wells.filter(well => (
      Number.isFinite(Number(well.latitude)) && Number.isFinite(Number(well.longitude))
    )) : [];
    wellPayload = payload;
    renderWells();
  } catch (error) {
    if (showStatus) {
      document.getElementById("map-status").textContent = `災害用井戸を取得できませんでした（${error?.message || "接続エラー"}）。`;
    }
  }
}

function renderWells() {
  wellLayer.clearLayers();
  const note = wellPayload?.usageNote || "飲用の可否は公表されていません。";
  officialWells.forEach(well => {
    const marker = L.marker([Number(well.latitude), Number(well.longitude)], {
      icon: L.divIcon({
        className: "",
        html: `<div class="well-marker" aria-label="${escapeAttribute(well.name)}"><span>井</span></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      })
    });
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(well.name)}</div>
      <div class="shelter-popup-badges"><span class="badge blue">災害用井戸</span></div>
      ${well.address ? `<div>${escapeHtml(well.address)}</div>` : ""}
      <div class="popup-contact-note">${escapeHtml(note)}</div>
      <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ（CC BY 2.1 JP）</a>
    `);
    wellLayer.addLayer(marker);
  });
}

// いまMAPを開いている人数（在席確認）。メタバースと同じCiDAOのpresence APIを使い、
// mode="disaster-map" で3Dワールド側と区別して数える。
// 送るのは端末で生成した乱数のセッションIDのみ（個人情報は送らない）。
function presenceSessionId() {
  let id = localStorage.getItem(PRESENCE_SESSION_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    id = `dm-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 40);
    localStorage.setItem(PRESENCE_SESSION_KEY, id);
  }
  return id;
}

function renderPresence(count) {
  const chip = document.getElementById("presence-chip");
  if (!chip) return;
  if (typeof count !== "number") {
    chip.textContent = "👥 人数未取得";
    chip.classList.remove("is-active");
    return;
  }
  chip.textContent = `👥 いま ${count}人が閲覧中`;
  chip.classList.toggle("is-active", count > 1);
}

async function sendPresence() {
  const endpoint = String(APP_CONFIG.presenceEndpoint || "").trim();
  if (!endpoint) return;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: presenceSessionId(), mode: "disaster-map" })
    });
    if (!response.ok) throw new Error(`presence HTTP ${response.status}`);
    const payload = await response.json();
    renderPresence(Number(payload.disasterMap ?? payload.total ?? 0));
  } catch {
    renderPresence(null);
  }
}

function initPresence() {
  if (!String(APP_CONFIG.presenceEndpoint || "").trim()) return;
  sendPresence();
  clearInterval(presenceTimer);
  // 在席とみなされるのは直近90秒のため、その半分以下の間隔で合図を送る
  presenceTimer = setInterval(sendPresence, 40 * 1000);
}

// 印西市公式オープンデータの追加レイヤー（消防・警察・市役所・緊急輸送路・鉄道・市版土砂災害）。
// 国土地理院版の土砂災害レイヤーとは別に「印西市公表」として並記する。
// 指定時期のずれで境界が異なる場合があるため、どちらかに寄せず両方を出典つきで示す方針。
const OPEN_DATA_LAYERS = {
  fire: { label: "消防署", marker: "消", color: "#d9534f", zoomLimit: 0 },
  police: { label: "警察機関", marker: "警", color: "#3b6fb6", zoomLimit: 0 },
  cityOffice: { label: "市役所・支所", marker: "市", color: "#2f855a", zoomLimit: 0 },
  // 道路・鉄道は線データ（KML由来）。点で置くと路線として読めないため線で描く
  emergencyRoute: { label: "緊急輸送路", marker: "路", color: "#b7791f", zoomLimit: 0, line: { weight: 5, opacity: 0.85 } },
  railway: { label: "鉄道", marker: "鉄", color: "#4b5563", zoomLimit: 0, line: { weight: 3, opacity: 0.8, dashArray: "8 5" } },
  // 土砂災害は点数が多いため、広域表示では描画せず拡大時のみ出す（描画負荷対策）
  landslideWarning: { label: "土砂災害警戒区域（市公表）", marker: "土", color: "#c05621", zoomLimit: 13 },
  landslideSpecial: { label: "土砂災害特別警戒区域（市公表）", marker: "特", color: "#9b2c2c", zoomLimit: 13 }
};
const openDataLayers = {};
const openDataCache = {};

Object.keys(OPEN_DATA_LAYERS).forEach(key => { openDataLayers[key] = L.layerGroup(); });

async function ensureOpenDataLayer(key) {
  const base = String(APP_CONFIG.openDataEndpoint || "").trim();
  if (!base || openDataCache[key]) return;
  try {
    const response = await fetch(`${base}?set=${encodeURIComponent(key)}`, {
      headers: { Accept: "application/json" }, cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    openDataCache[key] = payload;
    renderOpenDataLayer(key);
  } catch (error) {
    document.getElementById("map-status").textContent =
      `${OPEN_DATA_LAYERS[key].label}を取得できませんでした（${error?.message || "接続エラー"}）。`;
  }
}

function renderOpenDataLayer(key) {
  const payload = openDataCache[key];
  const spec = OPEN_DATA_LAYERS[key];
  const layer = openDataLayers[key];
  if (!payload || !layer) return;
  layer.clearLayers();
  // 拡大時のみ表示する設定のレイヤーは、ズームが浅いうちは描画しない
  if (spec.zoomLimit && map.getZoom() < spec.zoomLimit) return;

  // 線データ（緊急輸送路・鉄道）はポリラインで描く
  if (spec.line && Array.isArray(payload.lines) && payload.lines.length) {
    payload.lines.forEach(line => {
      if (!Array.isArray(line.path) || line.path.length < 2) return;
      const polyline = L.polyline(line.path, {
        color: spec.color,
        weight: spec.line.weight,
        opacity: spec.line.opacity,
        dashArray: spec.line.dashArray
      });
      polyline.bindPopup(`
        <div class="popup-title">${escapeHtml(line.name || spec.label)}</div>
        <div class="shelter-popup-badges"><span class="badge blue">${escapeHtml(spec.label)}</span></div>
        ${payload.note ? `<div class="popup-contact-note">${escapeHtml(payload.note)}</div>` : ""}
        <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ（CC BY 2.1 JP）</a>
      `);
      layer.addLayer(polyline);
    });
    return;
  }

  const bounds = map.getBounds();
  const wide = !spec.zoomLimit;
  (payload.features || []).forEach(feature => {
    const lat = Number(feature.latitude);
    const lng = Number(feature.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    // 大量データは画面内だけ描画する
    if (!wide && !bounds.contains([lat, lng])) return;
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="opendata-marker" style="background:${spec.color}" aria-label="${escapeAttribute(feature.name)}"><span>${escapeHtml(spec.marker)}</span></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    });
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(feature.name)}</div>
      <div class="shelter-popup-badges"><span class="badge blue">${escapeHtml(feature.category || spec.label)}</span></div>
      ${feature.address ? `<div>${escapeHtml(feature.address)}</div>` : ""}
      ${feature.phone ? `<div class="detail-meta">電話 ${escapeHtml(feature.phone)}</div>` : ""}
      ${feature.detail ? `<div class="detail-meta">${escapeHtml(feature.detail)}</div>` : ""}
      ${payload.note ? `<div class="popup-contact-note">${escapeHtml(payload.note)}</div>` : ""}
      <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ（CC BY 2.1 JP）</a>
    `);
    layer.addLayer(marker);
  });
}

// 表示中の大量データレイヤーを、地図移動のたびに描き直す
function refreshVisibleOpenDataLayers() {
  Object.keys(OPEN_DATA_LAYERS).forEach(key => {
    if (OPEN_DATA_LAYERS[key].zoomLimit && map.hasLayer(openDataLayers[key])) {
      renderOpenDataLayer(key);
    }
  });
}

// 気象庁の震源・震度情報を地図に表示する。
// list.json の cod（例 "+32.5+130.6+0/"）に震源座標と深さが含まれるため、
// 詳細JSONを追加取得せずに描画できる。印西市に震度記録がある地震を優先表示する。
const quakeLayer = L.layerGroup();
let quakeEvents = [];

// "+35.8+140.1-10000/" 形式を {lat, lng, depthKm} へ。深さはm単位で入ることがある
function parseJmaCoordinate(cod) {
  const m = String(cod || "").match(/([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let depthKm = null;
  if (m[3] !== undefined) {
    const raw = Math.abs(Number(m[3]));
    // 1000以上はメートル表記とみなす（気象庁は深さをmで出す場合がある）
    depthKm = Number.isFinite(raw) ? (raw >= 1000 ? Math.round(raw / 1000) : raw) : null;
  }
  return { lat, lng, depthKm };
}

// 震度は "5-"（5弱）"6+"（6強）等の表記。地図の丸の大きさ・色に使う
function intensityRank(value) {
  const table = { "1": 1, "2": 2, "3": 3, "4": 4, "5-": 5, "5+": 6, "6-": 7, "6+": 8, "7": 9 };
  return table[String(value || "").trim()] ?? 0;
}

function intensityLabel(value) {
  const v = String(value || "").trim();
  if (v === "5-") return "5弱";
  if (v === "5+") return "5強";
  if (v === "6-") return "6弱";
  if (v === "6+") return "6強";
  return v || "-";
}

function quakeColor(rank) {
  if (rank >= 7) return "#7f1d1d";
  if (rank >= 5) return "#dc2626";
  if (rank >= 4) return "#ea580c";
  if (rank >= 3) return "#d97706";
  return "#0f766e";
}

function renderQuakeLayer() {
  quakeLayer.clearLayers();
  quakeEvents.forEach((event, index) => {
    const pos = event.position;
    const rank = intensityRank(event.maxi);
    const color = quakeColor(rank);
    // 最新の1件だけ大きく描き、それ以前は小さく薄く（履歴として残す）
    const isLatest = index === 0;
    const radius = isLatest ? 10 + rank * 1.6 : 6 + rank;
    const marker = L.circleMarker([pos.lat, pos.lng], {
      radius,
      color: "#ffffff",
      weight: isLatest ? 2 : 1,
      fillColor: color,
      fillOpacity: isLatest ? 0.85 : 0.45
    });
    marker.bindPopup(`
      <div class="popup-title">震源: ${escapeHtml(event.name || "不明")}</div>
      <div class="shelter-popup-badges">
        <span class="badge ${rank >= 4 ? "red" : "blue"}">最大震度 ${escapeHtml(intensityLabel(event.maxi))}</span>
        <span class="badge blue">M${escapeHtml(event.mag || "-")}</span>
      </div>
      <div>${escapeHtml(formatJmaDateTime(event.at))}</div>
      ${pos.depthKm !== null ? `<div class="detail-meta">深さ 約${escapeHtml(String(pos.depthKm))}km</div>` : ""}
      ${event.inzaiIntensity ? `<div class="shelter-evidence"><strong>印西市の震度 ${escapeHtml(intensityLabel(event.inzaiIntensity))}</strong><span>市内の観測点で記録された震度です。</span></div>` : '<div class="popup-contact-note">印西市の震度記録はありません。</div>'}
      <a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noreferrer">出典: 気象庁 震源・震度情報</a>
    `);
    quakeLayer.addLayer(marker);
  });
}

// ============================================================
// 📰 公式発表・市長発信タイムライン
// CiDAO の /api/disaster/timeline（市公式ページ・防災速報・気象庁・市長SNSを
// 10分ごとに巡回し保存したもの）を、対象日を起点に時系列で読める形にする。
// 情報源の追加は CiDAO 管理画面（/admin/disaster-sources）で行い、ここでは表示だけを担う。
// ============================================================

async function refreshTimeline(manual = false) {
  const endpoint = String(APP_CONFIG.timelineEndpoint || "").trim();
  const status = document.getElementById("timeline-status");
  const list = document.getElementById("timeline-list");
  if (!endpoint || !status || !list) return;
  const date = getFormValue("incident-date") || dateStamp().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const days = Number(getFormValue("timeline-days") || 1);
  if (manual) status.textContent = "公式発表を更新中です。";
  try {
    const params = new URLSearchParams({ date, days: String(days), _: String(Date.now()) });
    const response = await fetch(`${endpoint}?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      // 503 はテーブル未作成・未設定の案内。故障ではないので文言をそのまま出す
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    timelinePayload = payload;
    renderTimeline(payload);
  } catch (error) {
    status.classList.add("is-error");
    status.textContent = `公式発表を取得できませんでした（${error?.message || "接続エラー"}）。印西市の公式ページで確認してください。`;
    if (manual) appendSystemWorkLog("公式発表タイムライン", "blocked", `取得失敗: ${error?.message || "不明"}`, "CiDAOのタイムラインAPIと情報源の状態を確認する");
  }
}

function timelineDayKey(iso) {
  const d = toDateTimeLocal(iso);
  return d ? d.slice(0, 10) : "";
}

function timelineTime(iso) {
  const d = toDateTimeLocal(iso);
  return d ? d.slice(11, 16) : "--:--";
}

function renderTimeline(payload) {
  const status = document.getElementById("timeline-status");
  const list = document.getElementById("timeline-list");
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const sources = Array.isArray(payload?.sources) ? payload.sources : [];
  const enabledSources = sources.filter(s => s.enabled);
  const failed = enabledSources.filter(s => s.lastStatus && s.lastStatus !== "success");
  const lastFetched = enabledSources.map(s => s.lastFetchedAt).filter(Boolean).sort().pop();

  status.classList.remove("is-error");
  status.textContent = [
    `${items.length}件`,
    lastFetched ? `最終巡回 ${formatDateTime(toDateTimeLocal(lastFetched))}` : "",
    `情報源 ${enabledSources.length}`,
    failed.length ? `（取得失敗 ${failed.length}: ${failed.map(s => s.label).join("・")}）` : ""
  ].filter(Boolean).join(" ・ ");

  if (!items.length) {
    list.innerHTML = '<div class="detail-empty">この期間の公式発表・発信はありません。</div>';
    return;
  }

  // 日付ごとに見出しを挟み、同じ日の中は新しい順（上から最新を追う）
  const sorted = [...items].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
  let currentDay = "";
  const html = [];
  sorted.forEach((item, index) => {
    const day = timelineDayKey(item.occurredAt);
    if (day !== currentDay) {
      currentDay = day;
      html.push(`<div class="timeline-day">${escapeHtml(day || "日時不明")}</div>`);
    }
    const trust = item.trust || "unverified";
    const trustCls = trust === "official" ? "is-official" : trust === "semi-official" ? "is-semi" : "";
    const change = item.changeType && item.changeType !== "new" ? item.changeType : "";
    const body = String(item.body || "").trim();
    const long = body.length > 160;
    html.push(`
      <article class="timeline-item ${trustCls} ${change === "cancel" ? "is-cancel" : ""}">
        <div class="timeline-time">${escapeHtml(timelineTime(item.occurredAt))}</div>
        <div class="timeline-body">
          <div class="timeline-source">
            <span class="timeline-trust ${trustCls}">${escapeHtml(TIMELINE_TRUST_LABEL[trust] || trust)}</span>
            <span>${escapeHtml(item.sourceLabel || item.sourceKind || "情報源不明")}</span>
            ${change ? `<span class="timeline-change ${change === "cancel" ? "is-cancel" : ""}">${escapeHtml(TIMELINE_CHANGE_LABEL[change] || change)}</span>` : ""}
          </div>
          <p class="timeline-title">${escapeHtml(item.title || "（見出しなし）")}</p>
          ${body ? `<p class="timeline-text ${long ? "is-clamped" : ""}" data-timeline-text="${index}">${escapeHtml(body)}</p>` : ""}
          ${long ? `<button class="timeline-more" type="button" data-timeline-more="${index}">続きを読む</button>` : ""}
          ${isHttpUrl(item.url) ? `<a class="timeline-link" href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">出典を開く</a>` : ""}
        </div>
      </article>`);
  });
  list.innerHTML = html.join("");
}

function handleTimelineListClick(event) {
  const button = event.target.closest("[data-timeline-more]");
  if (!button) return;
  const text = document.querySelector(`[data-timeline-text="${button.dataset.timelineMore}"]`);
  if (!text) return;
  const clamped = text.classList.toggle("is-clamped");
  button.textContent = clamped ? "続きを読む" : "閉じる";
}

function initTimeline() {
  if (!String(APP_CONFIG.timelineEndpoint || "").trim()) return;
  refreshTimeline(false);
  clearInterval(timelineTimer);
  // 巡回は10分ごとなので、表示側は5分ごとに追従すれば十分
  timelineTimer = setInterval(() => refreshTimeline(false), 5 * 60 * 1000);
}

function getShelterFilters() {
  return {
    hazard: getFormValue("shelter-hazard-filter") || "windFlood",
    kind: getFormValue("shelter-kind-filter") || "all",
    opening: getFormValue("shelter-opening-filter") || "all",
    keyword: getFormValue("shelter-keyword-filter").toLowerCase()
  };
}

function getFilteredShelters() {
  const filters = getShelterFilters();
  return officialShelters.filter(shelter => {
    if (filters.kind !== "all" && shelter.kind !== filters.kind) return false;
    if (filters.opening !== "all" && effectiveShelterOpening(shelter).status !== filters.opening) return false;
    if (filters.keyword && !`${shelter.name} ${shelter.address} ${shelter.district}`.toLowerCase().includes(filters.keyword)) return false;
    return true;
  });
}

function renderShelters() {
  const summary = document.getElementById("shelter-summary");
  const list = document.getElementById("shelter-list");
  const filters = getShelterFilters();
  const filtered = getFilteredShelters();
  const hazardLabels = { windFlood: "風水害", earthquake: "震災", landslide: "土砂災害" };
  const suitableCount = filtered.filter(shelter => shelter.suitableFor?.[filters.hazard]).length;
  const openCount = officialShelters.filter(shelter => effectiveShelterOpening(shelter).status === "open").length;
  const manualCount = Object.keys(shelterManualOverrides).length;
  const updateTime = shelterPayload?.fetchedAt ? formatDateTime(toDateTimeLocal(shelterPayload.fetchedAt)) : "";
  summary.classList.remove("is-error");
  summary.innerHTML = `
    <strong>${escapeHtml(hazardLabels[filters.hazard] || filters.hazard)}対応 ${suitableCount} / 表示${filtered.length}施設</strong>
    <span>開設中 ${openCount}施設${manualCount ? `（うち手動入力 ${manualCount}件を含む）` : ""}${updateTime ? ` ・ ${escapeHtml(updateTime)}取得` : ""}</span>
    <span>${escapeHtml(shelterPayload?.openingInformation || "公式の開設発表を確認中です。")}</span>
  `;

  shelterLayer.clearLayers();
  filtered.forEach(shelter => {
    const suitable = Boolean(shelter.suitableFor?.[filters.hazard]);
    const effective = effectiveShelterOpening(shelter);
    const opening = effective.status;
    const marker = L.marker([Number(shelter.latitude), Number(shelter.longitude)], {
      icon: L.divIcon({
        className: "",
        html: `<div class="shelter-marker is-${escapeAttribute(opening)} ${effective.manual ? "is-manual" : ""} ${suitable ? "" : "is-unsuitable"}" aria-label="${escapeAttribute(shelter.name)}"><span>${opening === "open" ? "開" : suitable ? "避" : "!"}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    });
    marker._shelterId = shelter.id;
    marker.bindPopup(buildShelterPopup(shelter, filters.hazard));
    marker.on("click", () => {
      selectedShelterId = shelter.id;
      renderShelterList(filtered, filters.hazard);
    });
    shelterLayer.addLayer(marker);
  });
  renderShelterList(filtered, filters.hazard);
}

function buildShelterPopup(shelter, hazard) {
  const hazardLabels = { windFlood: "風水害", earthquake: "震災", landslide: "土砂災害" };
  const openingLabels = { open: "開設中", closed: "閉鎖・開設終了", "not-announced": "開設発表なし" };
  const suitable = Boolean(shelter.suitableFor?.[hazard]);
  const evidence = shelter.openingEvidence;
  const effective = effectiveShelterOpening(shelter);
  const manual = effective.manual;
  return `
    <div class="popup-title">${escapeHtml(shelter.name)}</div>
    <div class="shelter-popup-badges">
      <span class="badge ${suitable ? "green" : "red"}">${escapeHtml(hazardLabels[hazard])}: ${suitable ? "対応可" : "対象外"}</span>
      <span class="badge ${effective.status === "open" ? "green" : effective.status === "closed" ? "gray" : "yellow"}">${escapeHtml(openingLabels[effective.status] || "開設発表なし")}${manual ? "（手動）" : ""}</span>
    </div>
    <div>${escapeHtml(shelter.kindLabel)} / ${escapeHtml(shelter.address)}</div>
    ${shelter.phone ? `<div class="detail-meta">電話 ${escapeHtml(shelter.phone)}</div>` : ""}
    ${manual ? `<div class="shelter-evidence is-manual"><strong>手動入力（${escapeHtml(manual.source || "出典未記入")}）</strong><span>${escapeHtml(manualTimeLabel(manual) ? `${manualTimeLabel(manual)} ・ ` : "")}${escapeHtml(formatDateTime(toDateTimeLocal(manual.confirmedAt)))}に運用者が確認・入力。公式発表ではありません。</span></div>` : ""}
    ${evidence ? `<div class="shelter-evidence"><strong>${escapeHtml(evidence.title || "印西市防災速報")}</strong><span>${escapeHtml(truncateText(evidence.message || "", 140))}</span><a href="${escapeAttribute(evidence.sourceUrl)}" target="_blank" rel="noreferrer">公式発表を確認</a></div>` : manual ? "" : '<div class="popup-contact-note">現在の開設を示す公式発表は確認されていません。</div>'}
    <a href="https://www2.wagmap.jp/inzai/OpenData" target="_blank" rel="noreferrer">出典: 印西市わが街ガイド オープンデータ</a>
  `;
}

function renderShelterList(filtered, hazard) {
  const list = document.getElementById("shelter-list");
  if (!filtered.length) {
    list.innerHTML = '<div class="detail-empty">条件に一致する避難所はありません。</div>';
    return;
  }
  const openingLabels = { open: "開設中", closed: "閉鎖発表", "not-announced": "開設発表なし" };
  list.innerHTML = filtered.map(shelter => {
    const suitable = Boolean(shelter.suitableFor?.[hazard]);
    const effective = effectiveShelterOpening(shelter);
    return `
      <button class="shelter-list-item ${shelter.id === selectedShelterId ? "is-selected" : ""}" type="button" data-shelter-id="${escapeAttribute(shelter.id)}">
        <strong>${escapeHtml(shelter.name)}</strong>
        <span>${escapeHtml(shelter.kindLabel)} ・ ${suitable ? "災害対応可" : "この災害は対象外"}</span>
        <span class="shelter-opening is-${escapeAttribute(effective.status)}">${escapeHtml(openingLabels[effective.status] || "開設発表なし")}${effective.manual ? "（手動）" : ""}</span>
      </button>`;
  }).join("");
}

function handleShelterListClick(event) {
  const button = event.target.closest("[data-shelter-id]");
  if (!button) return;
  const shelter = officialShelters.find(item => item.id === button.dataset.shelterId);
  if (!shelter) return;
  selectedShelterId = shelter.id;
  map.setView([Number(shelter.latitude), Number(shelter.longitude)], Math.max(map.getZoom(), 15));
  shelterLayer.eachLayer(marker => {
    if (marker._shelterId === shelter.id) marker.openPopup();
  });
  renderShelterList(getFilteredShelters(), getShelterFilters().hazard);
}

function showShelterFloodLayers() {
  setFormValue("shelter-hazard-filter", "windFlood");
  ["floodMax", "inland", "shelters"].forEach(name => {
    const input = document.querySelector(`[data-overlay="${name}"]`);
    if (input) input.checked = true;
    toggleOverlay(name, true);
  });
  renderShelters();
  map.fitBounds(INZAI_BOUNDS);
  document.getElementById("map-status").textContent = "公式の洪水・内水浸水想定と風水害対応避難所を重ねています。";
}

function applyPublicViewControls() {
  [
    "sns-collector-button", "add-point-button", "add-road-status-button", "map-click-button",
    "screenshot-button", "import-button", "export-csv-button", "export-geojson-button"
  ].forEach(id => {
    const control = document.getElementById(id);
    if (control) control.hidden = true;
  });
  document.querySelector(".admin-button")?.setAttribute("hidden", "");
  ["photo-queue", "location-queue", "search-log"].forEach(id => {
    const section = document.getElementById(id)?.closest(".panel-section");
    if (section) section.hidden = true;
  });
}

async function initOperatorSession(endpoint) {
  const status = document.getElementById("operator-status");
  try {
    const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(response.status === 401 ? "LOGIN_REQUIRED" : `HTTP ${response.status}`);
    const session = await response.json();
    window.CBIDisasterOperator = session;
    const roleLabel = session.roleLabel || session.role || "登録利用者";
    status.textContent = `${session.displayName || "利用者"} / ${roleLabel}`;
    status.classList.add("is-connected");
    applyOperatorPermissions(session.permissions || {});
    await loadSharedRecords();
  } catch (error) {
    window.CBIDisasterOperator = null;
    status.textContent = error?.message === "LOGIN_REQUIRED" ? "CiDAOログインが必要" : "利用資格を確認できません";
    applyOperatorPermissions({ canEdit: false });
  }
}

function applyOperatorPermissions(permissions) {
  if (!APP_CONFIG.operatorSessionEndpoint) return;
  const canEdit = Boolean(permissions.canEdit || permissions.canCreate);
  [
    "sns-collector-button", "add-point-button", "add-road-status-button", "map-click-button",
    "screenshot-button", "import-button"
  ].forEach(id => {
    const control = document.getElementById(id);
    if (!control) return;
    control.disabled = !canEdit;
    if (!canEdit) control.title = "承認済みの自主防災組織利用者のみ操作できます";
  });
}

async function loadSharedRecords() {
  const endpoint = String(APP_CONFIG.sharedRecordsEndpoint || "").trim();
  if (!endpoint || !window.CBIDisasterOperator) return;
  const response = await fetch(endpoint, { credentials: "include", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`共有記録の取得に失敗しました (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload.records)) return;
  records = payload.records;
  selectedId = null;
  renderAll();
}

function initHelpGuide() {
  try {
    if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
      localStorage.setItem(GUIDE_SEEN_KEY, "true");
      document.getElementById("help-dialog").showModal();
    }
  } catch {}
}

function applyTrialRecordFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("trial") !== "yawata") return;
  const id = "trial-yawata-palette";
  const incidentDate = getFormValue("incident-date") || "2026-08-13";
  if (!records.some(record => record.id === id)) {
    records = [...records, {
      id,
      title: "やわたパレット・白金通り（市外試験ピン）",
      category: "other",
      locationName: "やわたパレット（市原市八幡1050-3）",
      lat: 35.536659,
      lng: 140.116455,
      locationStatus: "pinned",
      observedAt: `${incidentDate}T00:00`,
      incidentDate,
      sourceType: "web",
      sourceUrl: "https://prdurbanosichapp1.blob.core.windows.net/common-article/6973379d8dbe435020068490/2026_2_seikatujouhou_16-17_kouhouichihara_web.pdf",
      status: "unconfirmed",
      severity: "low",
      passability: "none",
      passabilityMode: "unknown",
      passabilityCheckedAt: "",
      photoStatus: "needs-photo",
      photoUrl: "",
      photoPrivacy: "internal",
      assignedTo: "市外試験",
      notes: "投稿語『八幡パレット』『白金通り』から検索した試験ピン。正式名称は『やわたパレット』。印西市外のため実運用データとは分離して扱う。",
      hazardFlags: { flood: false, inland: false, road: false, landslide: false },
      sourceText: "八幡パレットの白金通り",
      sourceComments: "",
      publicationStatus: "internal",
      publicLocationPrecision: "hidden",
      locationCandidateSource: "public-source-gsi",
      locationCandidateConfidence: 0.94,
      locationCandidateQuery: "千葉県市原市八幡1050-3",
      locationCandidateReason: "市原市広報の所在地と国土地理院地名検索の座標が一致",
      locationCandidateOutsideArea: true,
      locationSearchCheckedAt: nowLocalInput()
    }];
    persistRecords();
  }
  selectedId = PUBLIC_VIEW ? null : id;
  document.getElementById("show-all-dates").checked = true;
  setTimeout(() => {
    if (!PUBLIC_VIEW) map.setView([35.536659, 140.116455], 15);
    renderAll();
    document.getElementById("map-status").textContent = PUBLIC_VIEW
      ? "一般公開用の参考表示です。公開承認済みの情報だけを表示しています。"
      : "市外試験ピン『やわたパレット』を表示しています。";
  }, 250);
}

function openHelpDialog() {
  document.getElementById("help-dialog").showModal();
}

function openOfficialLinksDialog() {
  document.getElementById("official-links-dialog").showModal();
}

function startFromHelp() {
  document.getElementById("help-dialog").close();
  openCollectorDialog();
}

function openCollectorDialog() {
  const incidentDate = getFormValue("incident-date") || dateStamp().replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  setFormValue("collector-since", `${incidentDate}T00:00`);
  setFormValue("collector-until", `${incidentDate}T23:59`);
  setFormValue("collector-operator", loadOperator());
  setFormValue("collector-post-url", "");
  setFormValue("collector-post-text", "");
  setFormValue("collector-comments", "");
  setFormValue("collector-post-time", "");
  setFormValue("collector-location-note", "");
  collectorLocationCandidate = null;
  document.getElementById("collector-location-candidate-status").textContent = "候補未選択";
  document.getElementById("collector-link-status").textContent = "";
  apiResultItems = [];
  renderApiResults();
  updateCollectorPlatformHelp();
  document.getElementById("sns-collector-dialog").showModal();
}

function updateCollectorPlatformHelp() {
  const platform = getFormValue("collector-platform");
  const label = platformLabels[platform] || "SNS";
  const mode = getCollectorSearchMode();
  document.getElementById("open-social-search-button").textContent = `${label}で検索を開く`;
  document.getElementById("platform-help").textContent = `${label}の検索画面を新しいタブで開きます。検索語もコピーします。`;
  const messages = {
    instagram: "ハッシュタグなしのキーワードでも検索できます。本文等が候補になりますが、複数語の厳密なAND・完全一致は保証されません。",
    threads: "投稿本文をキーワード検索できます。複数語は絞り込みに使えますが、厳密なAND・完全一致は保証されません。",
    x: mode === "phrase"
      ? "Xは引用符付きの完全一致検索を開きます。ログイン後は高度な検索で期間も絞れます。"
      : "Xは半角スペースで区切った語を、すべて含む投稿として検索できます。",
    "yahoo-realtime": "本文中のキーワードを検索できます。複数語は絞り込みに使えますが、検索サービス側の順位付けがあります。",
    web: "Web検索を利用します。完全一致では引用符を付けて検索します。"
  };
  document.getElementById("search-capability-note").textContent = messages[platform] || messages.web;
}

async function pasteSocialLink() {
  const status = document.getElementById("collector-link-status");
  try {
    const text = await navigator.clipboard.readText();
    const url = extractFirstHttpUrl(text);
    if (!url) throw new Error("URL_NOT_FOUND");
    setFormValue("collector-post-url", url);
    syncCollectorPlatformFromUrl();
    status.textContent = "共有リンクを貼り付けました。";
  } catch (error) {
    status.textContent = error?.message === "URL_NOT_FOUND"
      ? "クリップボードに投稿URLが見つかりません。URL欄へ直接貼り付けてください。"
      : "自動貼り付けが許可されませんでした。URL欄を選び、Ctrl + Vで貼り付けてください。";
    document.getElementById("collector-post-url").focus();
  }
}

function extractFirstHttpUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[)\]}>。、，．]+$/, "") : "";
}

function syncCollectorPlatformFromUrl() {
  const platform = detectPlatformFromUrl(getFormValue("collector-post-url"));
  if (platform && platform !== "web") setFormValue("collector-platform", platform);
  updateCollectorPlatformHelp();
}

function registerSocialLink() {
  const sourceUrl = getFormValue("collector-post-url");
  if (!isHttpUrl(sourceUrl)) {
    alert("Instagramなどの投稿URLを入力してください。");
    return;
  }
  const platform = detectPlatformFromUrl(sourceUrl) || getFormValue("collector-platform") || "other";
  const operator = getFormValue("collector-operator") || loadOperator();
  const checkedAt = nowLocalInput();
  const sourceText = getFormValue("collector-post-text").trim();
  const sourceComments = getFormValue("collector-comments").trim();
  const locationNote = getFormValue("collector-location-note").trim();
  const postTime = parseCollectorPostTime(getFormValue("collector-post-time"), checkedAt);
  const metadata = parseSocialUrlMetadata(sourceUrl);
  const existing = records.find(record => canonicalUrl(record.sourceUrl) === canonicalUrl(sourceUrl));
  if (existing) {
    document.getElementById("sns-collector-dialog").close();
    selectRecord(existing.id, false);
    document.getElementById("map-status").textContent = "この投稿リンクはすでに登録されています。";
    return;
  }
  const record = {
    id: `rec-${Date.now()}`,
    title: sourceText ? truncateText(sourceText, 72) : `${platformLabels[platform] || "SNS"}投稿（場所確認待ち）`,
    category: inferCategory(sourceText),
    locationName: collectorLocationCandidate?.title || locationNote || "場所未特定",
    lat: collectorLocationCandidate?.lat ?? null,
    lng: collectorLocationCandidate?.lng ?? null,
    locationStatus: collectorLocationCandidate ? "pinned" : "unknown",
    observedAt: postTime.observedAt,
    incidentDate: getFormValue("incident-date"),
    sourceType: "sns",
    sourceUrl,
    status: "unconfirmed",
    severity: "medium",
    passability: inferPassability(sourceText),
    passabilityMode: "unknown",
    passabilityCheckedAt: postTime.observedAt || checkedAt,
    photoStatus: "needs-photo",
    photoUrl: "",
    photoPrivacy: "internal",
    assignedTo: collectorLocationCandidate ? "位置・内容確認待ち" : "場所確認待ち",
    notes: collectorLocationCandidate
      ? `本文・コメントから採用した場所候補: ${collectorLocationCandidate.title}。${collectorLocationCandidate.outsideInzai ? "印西市外候補。" : ""}候補の緯度経度でピン設定済み。公開前に位置と根拠を確認する。`
      : locationNote
        ? `場所の手掛かり: ${locationNote}。位置を投稿者または別資料で確認後、地図へピンを設定する。`
      : "SNS投稿リンクから登録。投稿者へ撮影場所を確認後、地図へピンを設定する。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: getFormValue("collector-query"),
    evidenceOperator: operator,
    evidenceCheckedAt: checkedAt,
    evidenceRelativeTime: postTime.label,
    observedAtDerived: postTime.derived,
    sourceText,
    sourceComments,
    evidenceOcrText: "",
    evidenceImage: "",
    externalId: metadata.externalId,
    sourceUsername: metadata.sourceUsername,
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    locationCandidateSource: collectorLocationCandidate?.source || "",
    locationCandidateConfidence: collectorLocationCandidate?.confidence ?? null,
    locationCandidateQuery: collectorLocationCandidate?.query || "",
    locationCandidateReason: collectorLocationCandidate?.reason || "",
    locationCandidateOutsideArea: Boolean(collectorLocationCandidate?.outsideInzai),
    locationSearchCheckedAt: collectorLocationCandidate ? checkedAt : ""
  };
  saveOperator(operator);
  records = [...records, record];
  selectedId = record.id;
  persistRecords();
  logSearch({ platform, query: sourceUrl, operator, checkedAt, method: "link", resultCount: 1 });
  document.getElementById("sns-collector-dialog").close();
  renderAll();
  document.getElementById("map-status").textContent = matchesIncidentDate(record)
    ? "投稿リンクを登録しました。場所が不明な場合は「場所を質問（コメント / DM）」を使います。"
    : "投稿リンクを台帳へ保存しましたが、対象日外のため地図には表示していません。「過去記録も表示」で確認できます。";
}

function detectPlatformFromUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("threads.net") || host.includes("threads.com")) return "threads";
    if (host === "x.com" || host.endsWith(".x.com") || host.includes("twitter.com")) return "x";
    if (host.includes("facebook.com") || host === "fb.watch") return "facebook";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    return "web";
  } catch {
    return "";
  }
}

function getRecordPlatform(record) {
  if (!record) return "";
  const platform = record.evidencePlatform || detectPlatformFromUrl(record.sourceUrl);
  if (!platform || platform === "web" || platform === "other") return "";
  return platform;
}

function parseSocialUrlMetadata(value) {
  try {
    const url = new URL(value);
    const path = url.pathname;
    const instagram = path.match(/^\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
    if (instagram) return { externalId: instagram[1], sourceUsername: "" };
    const threads = path.match(/^\/@([^/]+)\/post\/([^/?#]+)/i);
    if (threads) return { externalId: threads[2], sourceUsername: threads[1] };
    const x = path.match(/^\/([^/]+)\/status\/([^/?#]+)/i);
    if (x) return { externalId: x[2], sourceUsername: x[1] };
  } catch {}
  return { externalId: "", sourceUsername: "" };
}

function parseCollectorPostTime(value, checkedAt) {
  const text = String(value || "").trim();
  if (!text) return { label: "", observedAt: "", derived: false };
  const relative = deriveObservedAtFromRelativeText(text, checkedAt);
  if (relative) return { ...relative, derived: true };
  const normalized = text
    .normalize("NFKC")
    .replace(/[年\/\.]/g, "-")
    .replace(/月/g, "-")
    .replace(/日/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!match) return { label: text, observedAt: "", derived: false };
  const [, year, month, day, hour = "00", minute = "00"] = match;
  const observedAt = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
  return Number.isNaN(new Date(observedAt).getTime())
    ? { label: text, observedAt: "", derived: false }
    : { label: "", observedAt, derived: false };
}

function getCollectorSearchMode() {
  return document.querySelector('[name="collector-search-mode"]:checked')?.value || "keywords";
}

function openSocialSearch() {
  const platform = getFormValue("collector-platform");
  const query = getFormValue("collector-query");
  const operator = getFormValue("collector-operator");
  if (!query) {
    alert("検索語を入力してください。");
    return;
  }
  saveOperator(operator);
  const mode = getCollectorSearchMode();
  const effectiveQuery = buildSearchQuery(platform, query, mode);
  const url = buildSocialSearchUrl(platform, effectiveQuery);
  navigator.clipboard?.writeText(effectiveQuery).catch(() => {});
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  else {
    alert("検索画面を開けませんでした。ポップアップの許可を確認してください。");
    appendSystemWorkLog("SNS検索画面", "blocked", "検索画面のポップアップを開けませんでした。", "ブラウザのポップアップ許可を確認する");
  }
  logSearch({ platform, query, operator, checkedAt: nowLocalInput(), method: "manual-search", resultCount: "-" });
}

function collectorToScreenshot() {
  const platform = getFormValue("collector-platform");
  const query = getFormValue("collector-query");
  const operator = getFormValue("collector-operator");
  saveOperator(operator);
  document.getElementById("sns-collector-dialog").close();
  openScreenshotDialog({ platform, query, operator, checkedAt: nowLocalInput() });
  captureScreen();
}

function buildSearchQuery(platform, query, mode) {
  const clean = String(query || "").trim().replace(/\s+/g, " ");
  if (mode === "phrase" && (platform === "x" || platform === "web" || platform === "yahoo-realtime")) {
    return `"${clean.replace(/^"|"$/g, "")}"`;
  }
  return clean;
}

function buildSocialSearchUrl(platform, query) {
  const encoded = encodeURIComponent(query);
  if (platform === "instagram") {
    const tag = query.trim().replace(/^#/, "");
    if (query.trim().startsWith("#") && /^[^\s#]+$/.test(tag)) return `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`;
    return `https://www.instagram.com/explore/search/keyword/?q=${encoded}`;
  }
  if (platform === "threads") return `https://www.threads.net/search?q=${encoded}&serp_type=default`;
  if (platform === "bluesky") return `https://bsky.app/search?q=${encoded}`;
  if (platform === "facebook") return `https://www.facebook.com/search/posts/?q=${encoded}`;
  if (platform === "x") return `https://x.com/search?q=${encoded}&src=typed_query&f=live`;
  if (platform === "yahoo-realtime") return `https://search.yahoo.co.jp/realtime/search?p=${encoded}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${query} 印西市 災害`)}`;
}

async function searchViaBridge() {
  const endpoint = String(APP_CONFIG.snsSearchEndpoint || "").trim();
  if (!endpoint) return;
  const platform = getFormValue("collector-platform");
  const query = getFormValue("collector-query");
  const operator = getFormValue("collector-operator");
  if (!query) {
    alert("検索語を入力してください。");
    return;
  }
  const button = document.getElementById("api-search-button");
  const results = document.getElementById("api-results");
  button.disabled = true;
  results.innerHTML = '<div class="detail-empty">連携APIを検索中です...</div>';
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        query,
        since: getFormValue("collector-since"),
        until: getFormValue("collector-until")
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    consumeSnsPayload(payload, platform, "api");
    saveOperator(operator);
    logSearch({ platform, query, operator, checkedAt: nowLocalInput(), method: "api", resultCount: apiResultItems.length });
  } catch (error) {
    results.innerHTML = '<div class="duplicate-warning"><strong>連携APIから取得できませんでした</strong>検索画面・スクショ、またはJSON取込を利用してください。</div>';
    appendSystemWorkLog("SNS連携API", "blocked", `連携APIから取得できませんでした: ${error?.message || "不明なエラー"}`, "API設定、権限、レスポンス形式を確認する");
  } finally {
    button.disabled = false;
  }
}

function parseSnsJsonInput() {
  const text = getFormValue("sns-json-input");
  if (!text) return;
  try {
    const payload = JSON.parse(text);
    const platform = getFormValue("collector-platform");
    consumeSnsPayload(payload, platform, "json");
    logSearch({
      platform,
      query: getFormValue("collector-query"),
      operator: getFormValue("collector-operator"),
      checkedAt: nowLocalInput(),
      method: "json",
      resultCount: apiResultItems.length
    });
  } catch {
    alert("JSONの形式を確認してください。");
  }
}

function consumeSnsPayload(payload, fallbackPlatform, method) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.results)
          ? payload.results
          : [];
  apiResultItems = source.map(item => normalizeSnsItem(item, fallbackPlatform)).filter(Boolean);
  renderApiResults();
  if (!apiResultItems.length && method === "host") return [];
  return apiResultItems.map(item => ({ ...item }));
}

function normalizeSnsItem(item, fallbackPlatform) {
  if (!item || typeof item !== "object") return null;
  const text = String(item.text || item.caption || item.description || item.title || "").trim();
  const permalink = String(item.permalink || item.url || item.link || "").trim();
  const mediaUrl = String(item.mediaUrl || item.media_url || item.thumbnailUrl || item.thumbnail_url || "").trim();
  const coordinates = item.coordinates || item.location || {};
  const lat = Number(item.lat ?? item.latitude ?? coordinates.lat ?? coordinates.latitude);
  const lng = Number(item.lng ?? item.longitude ?? coordinates.lng ?? coordinates.longitude);
  return {
    externalId: String(item.externalId || item.id || item.shortcode || ""),
    platform: String(item.platform || fallbackPlatform || "web"),
    text,
    permalink,
    mediaUrl,
    timestamp: String(item.timestamp || item.createdAt || item.created_at || ""),
    username: String(item.username || item.owner?.username || ""),
    commentsText: Array.isArray(item.comments)
      ? item.comments.map(comment => typeof comment === "string" ? comment : comment?.text || "").filter(Boolean).join("\n")
      : String(item.commentsText || item.comments_text || item.commentText || ""),
    locationName: String(item.locationName || item.location_name || coordinates.name || ""),
    query: String(item.query || item.matchedQuery || item.matched_query || ""),
    discoveredAt: String(item.discoveredAt || item.discovered_at || ""),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

function renderApiResults() {
  const node = document.getElementById("api-results");
  if (!apiResultItems.length) {
    node.innerHTML = '<div class="detail-empty">APIまたはJSONの検索結果はまだありません。</div>';
    return;
  }
  node.innerHTML = apiResultItems.map((item, index) => {
    const duplicate = findExactDuplicate(item);
    return `
      <article class="api-result">
        <div>
          <h3>${escapeHtml(truncateText(item.text || "本文なし", 92))}</h3>
          <p class="result-meta">
            <span>${escapeHtml(platformLabels[item.platform] || item.platform)}</span>
            <span>${escapeHtml(item.username ? `@${item.username}` : "投稿者不明")}</span>
            <span>${escapeHtml(formatDateTime(toDateTimeLocal(item.timestamp)))}</span>
          </p>
          ${item.permalink ? `<p><a href="${escapeAttribute(item.permalink)}" target="_blank" rel="noreferrer">元投稿を開く</a></p>` : ""}
        </div>
        <button class="tool-button ${duplicate ? "" : "primary"}" type="button" data-api-index="${index}" ${duplicate ? "disabled" : ""}>
          ${duplicate ? "登録済" : "候補に追加"}
        </button>
      </article>`;
  }).join("");
}

function handleApiResultAction(event) {
  const button = event.target.closest("[data-api-index]");
  if (!button) return;
  addApiResultAsRecord(apiResultItems[Number(button.dataset.apiIndex)]);
}

function addApiResultAsRecord(item, options = {}) {
  if (!item) return;
  const duplicate = findExactDuplicate(item);
  if (duplicate) {
    selectRecord(duplicate.id, true);
    return;
  }
  const operator = getFormValue("collector-operator") || loadOperator();
  const apiHasLocation = Number.isFinite(item.lat) && Number.isFinite(item.lng);
  const record = {
    id: `rec-${Date.now()}`,
    title: truncateText(item.text || `${platformLabels[item.platform] || "SNS"}投稿候補`, 72),
    category: inferCategory(item.text),
    locationName: item.locationName || "場所未特定",
    lat: apiHasLocation ? item.lat : null,
    lng: apiHasLocation ? item.lng : null,
    locationStatus: apiHasLocation ? "pinned" : "unknown",
    observedAt: toDateTimeLocal(item.timestamp) || nowLocalInput(),
    incidentDate: getFormValue("incident-date"),
    sourceType: item.platform === "web" ? "web" : "sns",
    sourceUrl: item.permalink,
    status: "unconfirmed",
    severity: "medium",
    passability: inferPassability(item.text),
    passabilityMode: "unknown",
    passabilityCheckedAt: toDateTimeLocal(item.timestamp) || nowLocalInput(),
    photoStatus: item.mediaUrl ? "has-photo" : "needs-photo",
    photoUrl: item.mediaUrl,
    photoPrivacy: "internal",
    assignedTo: apiHasLocation ? "投稿位置情報の確認待ち" : "場所確認待ち",
    notes: "公式APIまたは連携JSONから登録。位置・内容・写真の真正性は未確認。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: item.platform,
    evidenceQuery: options.query || item.query || getFormValue("collector-query"),
    evidenceOperator: operator,
    evidenceCheckedAt: nowLocalInput(),
    sourceText: item.text,
    sourceComments: item.commentsText || "",
    evidenceOcrText: item.text,
    evidenceImage: "",
    externalId: item.externalId,
    sourceUsername: item.username,
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    locationCandidateSource: apiHasLocation ? "platform-location" : "",
    locationCandidateConfidence: apiHasLocation ? 0.9 : null,
    locationCandidateQuery: apiHasLocation ? "投稿API位置情報" : "",
    locationCandidateReason: apiHasLocation ? "投稿APIまたは連携JSONに緯度経度が含まれていました" : "",
    locationCandidateOutsideArea: apiHasLocation ? !INZAI_BOUNDS.contains([item.lat, item.lng]) : false,
    locationSearchCheckedAt: apiHasLocation ? nowLocalInput() : ""
  };
  records = [...records, record];
  selectedId = record.id;
  persistRecords();
  renderAll();
  renderApiResults();
  if (!options.keepOpen) document.getElementById("sns-collector-dialog").close();
  document.getElementById("map-status").textContent = apiHasLocation
    ? "投稿の場所候補を取得しました。地図上でピン位置を確認してください。"
    : "投稿を登録しました。場所が不明な場合は投稿者へ確認できます。";
}

function findExactDuplicate(item) {
  const url = canonicalUrl(item.permalink);
  return records.find(record =>
    (item.externalId && record.externalId && item.externalId === record.externalId) ||
    (url && canonicalUrl(record.sourceUrl) === url)
  );
}

function inferCategory(text) {
  const value = String(text || "");
  if (/助けて|救助|閉じ込め|生き埋め|安否確認|動けない|取り残され/.test(value)) return "rescue_request";
  if (/地震|揺れ|震度|倒壊|落下物/.test(value)) return "earthquake_damage";
  if (/冠水|アンダーパス|道路.*水/.test(value)) return "road_flood";
  if (/浸水|床上|床下/.test(value)) return "inundation";
  if (/河川|川.*増水|氾濫/.test(value)) return "river";
  if (/崖|土砂|土石流|地すべり/.test(value)) return "landslide";
  if (/通行止|通れない|通行不能|通行規制|通行再開|通れた|走行不能|走行可能|渋滞/.test(value)) return "traffic";
  if (/停電|断水|通信障害/.test(value)) return "lifeline";
  if (/避難所|避難場所/.test(value)) return "shelter";
  return "other";
}

function inferPassability(text) {
  const value = String(text || "");
  if (/通行止|通行禁止|進入禁止|閉鎖/.test(value)) return "closed";
  if (/通れない|通行不能|走行不能|進入不可|立ち往生/.test(value)) return "impassable";
  if (/片側交互|車線規制|通行規制|徐行/.test(value)) return "restricted";
  if (/通行再開|規制解除|開通/.test(value)) return "reopened";
  if (/通れた|通行できた|走行できた|走行可能/.test(value)) return "passed";
  return "none";
}

function deriveObservedAtFromRelativeText(text, referenceValue) {
  const source = String(text || "").normalize("NFKC");
  const reference = new Date(referenceValue || Date.now());
  if (Number.isNaN(reference.getTime())) return null;

  const japaneseMatch = source.match(/(?:約\s*)?(\d+)\s*(秒|分|時間|日|週間)前/);
  if (japaneseMatch) {
    const amount = Number(japaneseMatch[1]);
    const unitMs = {
      秒: 1000,
      分: 60 * 1000,
      時間: 60 * 60 * 1000,
      日: 24 * 60 * 60 * 1000,
      週間: 7 * 24 * 60 * 60 * 1000
    }[japaneseMatch[2]];
    return {
      label: japaneseMatch[0].replace(/\s+/g, ""),
      observedAt: toDateTimeLocal(new Date(reference.getTime() - amount * unitMs).toISOString())
    };
  }

  const englishMatch = source.match(/\b(\d+)\s*(s|m|h|d|w)\b/i);
  if (englishMatch) {
    const amount = Number(englishMatch[1]);
    const unitMs = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    }[englishMatch[2].toLowerCase()];
    return {
      label: englishMatch[0],
      observedAt: toDateTimeLocal(new Date(reference.getTime() - amount * unitMs).toISOString())
    };
  }

  if (/たった今/.test(source)) {
    return { label: "たった今", observedAt: toDateTimeLocal(reference.toISOString()) };
  }
  if (/昨日/.test(source)) {
    return {
      label: "昨日",
      observedAt: toDateTimeLocal(new Date(reference.getTime() - 24 * 60 * 60 * 1000).toISOString())
    };
  }
  return null;
}

async function suggestLocationFromOcr(text) {
  const candidates = await findFreeLocationCandidates({ postText: text, commentsText: "", hint: "" });
  return candidates.find(candidate => !candidate.outsideInzai) || candidates[0] || null;
}

function openLocationSearchDialog(options = {}) {
  const source = options.source || "collector";
  const recordId = options.recordId || (source === "record-form" ? getFormValue("record-id") : null);
  const record = recordId ? records.find(item => item.id === recordId) : null;
  const values = source === "collector"
    ? {
        postText: getFormValue("collector-post-text"),
        commentsText: getFormValue("collector-comments"),
        hint: getFormValue("collector-location-note")
      }
    : source === "record-form"
      ? {
          postText: getFormValue("record-source-text"),
          commentsText: getFormValue("record-source-comments"),
          hint: getFormValue("record-location")
        }
      : {
          postText: record?.sourceText || record?.evidenceOcrText || "",
          commentsText: record?.sourceComments || record?.locationAnswerNote || "",
          hint: record?.locationName && !["場所未特定", "位置未確定"].includes(record.locationName) ? record.locationName : ""
        };
  locationSearchContext = { source, recordId, candidates: [] };
  setFormValue("location-search-post-text", values.postText);
  setFormValue("location-search-comments", values.commentsText);
  setFormValue("location-search-hint", values.hint);
  document.getElementById("location-search-status").textContent = "無料候補検索から始めてください。「この候補を使う」を押すと、その緯度経度でピンを設定します。";
  renderLocationCandidates();
  updateLocationWebSearchLink();
  document.getElementById("location-search-dialog").showModal();
}

function getLocationSearchInput() {
  return {
    postText: getFormValue("location-search-post-text"),
    commentsText: getFormValue("location-search-comments"),
    hint: getFormValue("location-search-hint")
  };
}

function updateLocationWebSearchLink() {
  const input = getLocationSearchInput();
  const query = [input.hint, input.postText, input.commentsText]
    .filter(Boolean)
    .join(" ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  document.getElementById("location-web-search-link").href = `https://www.google.com/search?q=${encodeURIComponent(query || "印西市 災害 場所")}`;
}

async function runFreeLocationSearch() {
  const button = document.getElementById("free-location-search-button");
  const status = document.getElementById("location-search-status");
  const input = getLocationSearchInput();
  if (![input.postText, input.commentsText, input.hint].some(Boolean)) {
    status.textContent = "投稿本文、コメント、場所の手掛かりのいずれかを入力してください。";
    return;
  }
  button.disabled = true;
  status.textContent = "地名・施設名・道路名を抽出して、公開地名検索に照会しています...";
  try {
    const candidates = await findFreeLocationCandidates(input);
    locationSearchContext.candidates = candidates;
    renderLocationCandidates();
    status.textContent = candidates.length
      ? `${candidates.length}件の候補が見つかりました。市外候補も含め、根拠と地図を確認してください。`
      : "候補を特定できませんでした。コメントで町名・目印を確認するか、AI補完・Web検索を利用してください。";
  } catch (error) {
    status.textContent = `候補検索に失敗しました（${error?.message || "接続エラー"}）。`;
  } finally {
    button.disabled = false;
  }
}

async function findFreeLocationCandidates(input) {
  const queryItems = buildLocationQueries(input);
  const candidates = [];
  for (const item of queryItems.slice(0, 6)) {
    try {
      const response = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(item.query)}`);
      if (!response.ok) continue;
      const results = await response.json();
      if (!Array.isArray(results)) continue;
      results.slice(0, item.alias ? 1 : 3).forEach(result => {
        const coordinates = result?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return;
        const lng = Number(coordinates[0]);
        const lat = Number(coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const address = String(result.properties?.title || item.query);
        const tooBroad = /(?:都|道|府|県|市|区|町|村)$/.test(address) && item.query.length > address.length + 3 && !item.alias;
        if (tooBroad) return;
        candidates.push({
          title: item.alias?.title || address,
          address,
          lat,
          lng,
          query: item.query,
          source: item.alias ? "local-alias-gsi" : "gsi",
          confidence: Math.max(0.35, Math.min(1, item.confidence - (tooBroad ? 0.25 : 0))),
          reason: item.alias?.reason || item.reason,
          sourceUrl: item.alias?.sourceUrl || "https://maps.gsi.go.jp/",
          outsideInzai: !INZAI_BOUNDS.contains([lat, lng]),
          autoPin: false
        });
      });
    } catch {}
  }
  return dedupeLocationCandidates(candidates).sort((left, right) => {
    if (left.outsideInzai !== right.outsideInzai) return left.outsideInzai ? 1 : -1;
    return right.confidence - left.confidence;
  }).slice(0, 8);
}

function buildLocationQueries(input) {
  const source = [input.hint, input.postText, input.commentsText].filter(Boolean).join("\n").normalize("NFKC");
  const items = [];
  locationAliases.forEach(alias => {
    if (alias.patterns.some(pattern => source.includes(pattern))) {
      items.push({ query: alias.query, confidence: alias.confidence, reason: alias.reason, alias });
    }
  });

  const addressPattern = /(?:(?:北海道|東京都|(?:京都|大阪)府|.{2,3}県))?(?:[一-龯々ヶケ]{1,12}(?:市|区|町|村))[一-龯々ヶケぁ-んァ-ヶー0-9\-丁目番地号]{2,36}/g;
  (source.match(addressPattern) || []).slice(0, 3).forEach(value => {
    items.push({ query: value, confidence: /\d/.test(value) ? 0.92 : 0.76, reason: "本文またはコメントに住所・自治体名を含む記述があります" });
  });

  const knownPlaces = [
    "千葉ニュータウン中央駅", "印西牧の原駅", "印旛日本医大駅", "木下駅", "小林駅",
    "六軒", "大森", "草深", "船尾", "師戸", "岩戸", "瀬戸", "平賀"
  ];
  knownPlaces.filter(place => source.includes(place)).slice(0, 3).forEach(place => {
    items.push({ query: `千葉県印西市${place}`, confidence: 0.84, reason: "印西市内の既知の地名を検出しました" });
  });

  const municipality = (source.match(/[一-龯々ヶケ]{1,12}(?:市|区|町|村)/) || [])[0] || "印西市";
  const placeTerms = source.match(/[一-龯々ヶケぁ-んァ-ヶーA-Za-z0-9]{2,28}(?:駅|通り|街道|道路|橋|交差点|公園|学校|病院|センター|パレット|ガード|店)/g) || [];
  placeTerms.slice(0, 4).forEach(term => {
    items.push({ query: `千葉県${municipality}${term}`, confidence: 0.66, reason: "施設名・道路名・目印らしい語を検出しました" });
  });

  const hint = String(input.hint || "").replace(/\s+/g, " ").trim();
  if (hint && !items.some(item => item.query.includes(hint))) {
    const prefix = /(?:都|道|府|県|市|区|町|村)/.test(hint) ? "" : `千葉県${municipality}`;
    items.push({ query: `${prefix}${hint}`, confidence: 0.62, reason: "入力された場所の手掛かりを検索しました" });
  }

  const seen = new Set();
  return items.filter(item => {
    const key = item.query.replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeLocationCandidates(candidates) {
  const result = [];
  candidates.forEach(candidate => {
    const duplicate = result.find(item => distanceMeters(item.lat, item.lng, candidate.lat, candidate.lng) < 80);
    if (!duplicate) result.push(candidate);
    else if (candidate.confidence > duplicate.confidence) Object.assign(duplicate, candidate);
  });
  return result;
}

async function runAiLocationSearch() {
  const endpoint = String(APP_CONFIG.locationAiEndpoint || "").trim();
  const status = document.getElementById("location-search-status");
  if (!endpoint) {
    status.textContent = "AI連携先は未設定です。無料候補検索またはWeb検索を利用してください。";
    return;
  }
  const button = document.getElementById("ai-location-search-button");
  const input = getLocationSearchInput();
  button.disabled = true;
  status.textContent = "個人情報をマスクし、CBI側のAI連携先で候補を補完しています...";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        version: "1",
        targetArea: { name: "千葉県印西市", bounds: [[35.735, 140.055], [35.875, 140.245]] },
        postText: redactSensitiveText(input.postText),
        commentsText: redactSensitiveText(input.commentsText),
        locationHint: redactSensitiveText(input.hint),
        existingCandidates: locationSearchContext.candidates.map(candidate => withoutCandidatePrivateFields(candidate))
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const aiCandidates = normalizeAiLocationCandidates(payload.candidates || payload.data || []);
    locationSearchContext.candidates = dedupeLocationCandidates([...locationSearchContext.candidates, ...aiCandidates]);
    renderLocationCandidates();
    status.textContent = aiCandidates.length
      ? `AI補完で${aiCandidates.length}件を追加しました。候補の根拠を確認して採用してください。`
      : "AI補完でも新しい候補を特定できませんでした。投稿者への確認を続けてください。";
  } catch (error) {
    status.textContent = `AI補完に失敗しました（${error?.message || "接続エラー"}）。無料候補はそのまま利用できます。`;
    appendSystemWorkLog("AI場所候補検索", "blocked", status.textContent, "CBI側AIエンドポイントと利用者認証を確認する");
  } finally {
    button.disabled = false;
  }
}

function redactSensitiveText(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[メール非送信]")
    .replace(/(?:\+?81[- ]?)?0\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}/g, "[電話番号非送信]")
    .replace(/@[A-Za-z0-9_.]{2,30}/g, "@[アカウント非送信]")
    .slice(0, 4000);
}

function withoutCandidatePrivateFields(candidate) {
  return {
    title: candidate.title,
    address: candidate.address,
    lat: candidate.lat,
    lng: candidate.lng,
    confidence: candidate.confidence,
    source: candidate.source
  };
}

function normalizeAiLocationCandidates(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    const lat = Number(item.lat ?? item.latitude);
    const lng = Number(item.lng ?? item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      title: String(item.title || item.name || item.address || "AI場所候補"),
      address: String(item.address || item.title || ""),
      lat,
      lng,
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      reason: String(item.reason || "投稿本文とコメントからAIが推定"),
      query: String(item.query || "AI補完"),
      source: "ai",
      sourceUrl: isHttpUrl(item.sourceUrl) ? item.sourceUrl : "",
      outsideInzai: !INZAI_BOUNDS.contains([lat, lng]),
      autoPin: false
    };
  }).filter(Boolean);
}

function renderLocationCandidates() {
  const node = document.getElementById("location-candidate-results");
  const candidates = locationSearchContext.candidates || [];
  if (!candidates.length) {
    node.innerHTML = '<div class="detail-empty">場所候補はまだありません。</div>';
    return;
  }
  node.innerHTML = candidates.map((candidate, index) => `
    <article class="location-candidate-card ${candidate.outsideInzai ? "is-outside" : ""}">
      <div>
        <strong>${escapeHtml(candidate.title)}</strong>
        <p>${escapeHtml(candidate.address || candidate.reason || "候補住所なし")}</p>
        <div class="location-candidate-meta">
          <span class="badge ${candidate.outsideInzai ? "orange" : "green"}">${candidate.outsideInzai ? "印西市外" : "印西市内"}</span>
          <span class="badge blue">確度 ${Math.round(candidate.confidence * 100)}%</span>
          <span class="badge yellow">${escapeHtml(locationCandidateSourceLabel(candidate.source))}</span>
        </div>
        <p>${escapeHtml(candidate.reason || "候補の根拠は未記載です")}</p>
      </div>
      <button class="tool-button primary" type="button" data-location-candidate-index="${index}">この候補を使う</button>
    </article>
  `).join("");
}

function locationCandidateSourceLabel(source) {
  if (source === "image-exif") return "元画像GPS";
  if (source === "ai") return "AI補完";
  if (source === "local-alias-gsi" || source === "public-source-gsi") return "公開資料+地理院";
  return "国土地理院検索";
}

function publicationStatusLabel(value) {
  return ({ internal: "内部確認中", review: "公開承認待ち", published: "公開承認済み" })[value] || "内部確認中";
}

function publicLocationPrecisionLabel(value) {
  return ({ hidden: "位置非公開", approximate: "概略位置", exact: "正確な位置" })[value] || "位置非公開";
}

function handleLocationCandidateAction(event) {
  const button = event.target.closest("[data-location-candidate-index]");
  if (!button) return;
  const candidate = locationSearchContext.candidates[Number(button.dataset.locationCandidateIndex)];
  if (!candidate) return;
  applyLocationCandidate(candidate);
}

function applyLocationCandidate(candidate) {
  const checkedAt = nowLocalInput();
  if (locationSearchContext.source === "collector") {
    collectorLocationCandidate = candidate;
    setFormValue("collector-location-note", candidate.title);
    document.getElementById("collector-location-candidate-status").textContent = `${candidate.title} / ${candidate.outsideInzai ? "印西市外" : "印西市内"} / 確度${Math.round(candidate.confidence * 100)}%`;
  } else if (locationSearchContext.source === "record-form") {
    recordFormLocationCandidate = candidate;
    setFormValue("record-location", candidate.title);
    setFormValue("record-lat", candidate.lat.toFixed(6));
    setFormValue("record-lng", candidate.lng.toFixed(6));
    setFormValue("record-location-status", "pinned");
    setFormValue("record-source-text", getFormValue("location-search-post-text"));
    setFormValue("record-source-comments", getFormValue("location-search-comments"));
  } else {
    const record = records.find(item => item.id === locationSearchContext.recordId);
    if (!record) return;
    record.locationName = candidate.title;
    record.lat = candidate.lat;
    record.lng = candidate.lng;
    record.locationStatus = "pinned";
    record.sourceComments = getFormValue("location-search-comments");
    Object.assign(record, locationCandidateAuditFields(candidate, checkedAt));
    record.assignedTo = "位置・内容確認待ち";
    persistRecords();
    selectedId = record.id;
    map.setView([candidate.lat, candidate.lng], 15);
    renderAll();
  }
  document.getElementById("location-search-dialog").close();
  document.getElementById("map-status").textContent = `${candidate.title}の緯度経度でピンを設定しました。公開前に位置と根拠を確認してください。`;
}

function locationCandidateAuditFields(candidate, checkedAt = nowLocalInput()) {
  return {
    locationCandidateSource: candidate.source || "",
    locationCandidateConfidence: candidate.confidence ?? null,
    locationCandidateQuery: candidate.query || "",
    locationCandidateReason: candidate.reason || "",
    locationCandidateOutsideArea: Boolean(candidate.outsideInzai),
    locationSearchCheckedAt: checkedAt
  };
}

function logSearch(entry) {
  searchLog = [{
    id: `search-${Date.now()}`,
    platform: entry.platform || "web",
    query: entry.query || "",
    operator: entry.operator || "",
    checkedAt: entry.checkedAt || nowLocalInput(),
    method: entry.method || "manual-search",
    resultCount: entry.resultCount ?? "-"
  }, ...searchLog].slice(0, 50);
  try {
    localStorage.setItem(SEARCH_LOG_KEY, JSON.stringify(searchLog));
  } catch {}
  renderSearchLog();
}

function loadSearchLog() {
  try {
    const raw = localStorage.getItem(SEARCH_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderSearchLog() {
  const node = document.getElementById("search-log");
  if (!node) return;
  if (!searchLog.length) {
    node.innerHTML = '<div class="detail-empty">検索履歴はまだありません。</div>';
    return;
  }
  node.innerHTML = searchLog.slice(0, 8).map(item => `
    <div class="search-log-item">
      <strong>${escapeHtml(platformLabels[item.platform] || item.platform)} / ${escapeHtml(item.query || "検索語なし")}</strong>
      <span>${escapeHtml(formatDateTime(item.checkedAt))} ・ ${escapeHtml(item.operator || "確認者未設定")} ・ ${escapeHtml(searchMethodLabels[item.method] || item.method)}</span>
    </div>
  `).join("");
}

function clearSearchLog() {
  searchLog = [];
  try {
    localStorage.removeItem(SEARCH_LOG_KEY);
  } catch {}
  renderSearchLog();
}

function loadOperator() {
  try {
    return localStorage.getItem(OPERATOR_KEY) || "";
  } catch {
    return "";
  }
}

function saveOperator(operator) {
  if (!operator) return;
  try {
    localStorage.setItem(OPERATOR_KEY, operator);
  } catch {}
}

let bunkazaiLoaded = false;
async function ensureBunkazaiLayer() {
  if (bunkazaiLoaded) return;
  bunkazaiLoaded = true;
  try {
    const res = await fetch("../metaverse/bunkazai.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`bunkazai.json HTTP ${res.status}`);
    const data = await res.json();
    const colors = { "国指定": "#e74c3c", "国登録": "#e67e22", "県指定": "#9b59b6", "市指定": "#3498db" };
    (data.spots || []).forEach(b => {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return;
      const marker = L.circleMarker([b.lat, b.lon], {
        radius: 7, color: "#ffffff", weight: 1.5,
        fillColor: colors[b.designation] || "#3498db", fillOpacity: 0.9
      });
      marker.bindPopup(
        `<strong>🏛 ${escapeHtml(b.name)}</strong><br>` +
        `［${escapeHtml(b.designation)}・${escapeHtml(b.type)}${b.era ? "・" + escapeHtml(b.era) : ""}］ 印西市${escapeHtml(b.address)}<br>` +
        (b.description ? `<span style="font-size:11px;">${escapeHtml(b.description.slice(0, 80))}…</span><br>` : "") +
        (b.detailUrl ? `<a href="${b.detailUrl}" target="_blank" rel="noreferrer">市公式ページ（出典）</a> ・ ` : "") +
        `<a href="../metaverse/" target="_blank" rel="noreferrer">3Dで見る</a>`
      );
      marker.addTo(bunkazaiLayer);
    });
  } catch (error) {
    bunkazaiLoaded = false;
    console.error("文化財データの読み込みに失敗:", error);
  }
}

let kominkanLoaded = false;
async function ensureKominkanLayer() {
  if (kominkanLoaded) return;
  kominkanLoaded = true;
  try {
    const res = await fetch("../metaverse/kominkan.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`kominkan.json HTTP ${res.status}`);
    const data = await res.json();
    (data.facilities || []).forEach(k => {
      const marker = L.circleMarker([k.lat, k.lon], {
        radius: 7, color: "#ffffff", weight: 1.5, fillColor: "#00bcd4", fillOpacity: 0.9
      });
      marker.bindPopup(
        `<strong>🏢 ${escapeHtml(k.name)}</strong><br>` +
        `${escapeHtml(k.address)}<br>` +
        `<a href="${k.url}" target="_blank" rel="noreferrer">市公式ページ（出典）</a>`
      );
      marker.addTo(kominkanLayer);
    });
  } catch (error) {
    kominkanLoaded = false;
    console.error("公民館データの読み込みに失敗:", error);
  }
}

let pastFloodLoaded = false;
let pastFloodPoints = [];           // past-flood-points.json の全地点（日付フィルタ用に保持）
let pastFloodSelectedDates = null;  // null=全日付、Set=選択中の日付
async function ensurePastFloodLayer() {
  if (pastFloodLoaded) return;
  pastFloodLoaded = true;
  try {
    const res = await fetch("past-flood-points.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`past-flood-points.json HTTP ${res.status}`);
    const data = await res.json();
    pastFloodPoints = (data.points || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    renderPastFloodDateFilter();
    renderPastFloodMarkers();
  } catch (error) {
    pastFloodLoaded = false;
    console.error("過去冠水実績データの読み込みに失敗:", error);
  }
}

// 記録にある日付を列挙し、複数選択で振り返りできるようにする（既定は全日付ON）
function renderPastFloodDateFilter() {
  const box = document.getElementById("past-flood-dates");
  if (!box) return;
  const dates = [...new Set(pastFloodPoints.flatMap(p => p.dates || []))].sort().reverse();
  if (!dates.length) { box.innerHTML = '<span class="past-flood-empty">記録なし</span>'; return; }
  box.innerHTML = dates.map(d => {
    const count = pastFloodPoints.filter(p => (p.dates || []).includes(d)).length;
    const checked = !pastFloodSelectedDates || pastFloodSelectedDates.has(d);
    return `<label class="past-flood-date"><input type="checkbox" data-past-flood-date="${escapeAttribute(d)}" ${checked ? "checked" : ""}> ${escapeHtml(d)}<span class="past-flood-count">${count}</span></label>`;
  }).join("") + '<button type="button" class="past-flood-all" data-past-flood-all>全日付</button>';
}

function handlePastFloodDateChange(event) {
  const box = document.getElementById("past-flood-dates");
  if (!box) return;
  if (event.target.closest("[data-past-flood-all]")) {
    pastFloodSelectedDates = null;
    box.querySelectorAll("[data-past-flood-date]").forEach(input => { input.checked = true; });
  } else if (event.target.matches("[data-past-flood-date]")) {
    pastFloodSelectedDates = new Set([...box.querySelectorAll("[data-past-flood-date]:checked")].map(i => i.dataset.pastFloodDate));
  } else {
    return;
  }
  renderPastFloodMarkers();
}

function renderPastFloodMarkers() {
  pastFloodLayer.clearLayers();
  pastFloodPoints.forEach(p => {
    const dates = p.dates || [];
    if (pastFloodSelectedDates && !dates.some(d => pastFloodSelectedDates.has(d))) return;
    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 8, color: "#ffffff", weight: 1.5, fillColor: "#0d47a1", fillOpacity: 0.85
    });
    marker.bindPopup(
      `<strong>🌊 ${escapeHtml(p.name || "冠水ポイント")}</strong><br>` +
      `冠水確認日: ${escapeHtml(dates.join("、") || "不明")}<br>` +
      (p.note ? `${escapeHtml(p.note)}<br>` : "") +
      `出典: ${p.sourceUrl ? `<a href="${escapeAttribute(p.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(p.source || "記録")}</a>` : escapeHtml(p.source || "運用者記録")}` +
      (p.verifiedBy ? `（確認: ${escapeHtml(p.verifiedBy)}）` : "") +
      `<br><span style="font-size:11px;">過去に冠水が確認された地点の実績です。ハザード想定や現在の冠水状況ではありません。</span>`
    );
    marker.addTo(pastFloodLayer);
  });
}

function toggleOverlay(name, checked) {
  if (Object.prototype.hasOwnProperty.call(kikikuruLayers, name)) {
    if (checked) { refreshKikikuru(true); kikikuruLayers[name].addTo(map); }
    else map.removeLayer(kikikuruLayers[name]);
    return;
  }
  if (name === "rainNowcast") {
    if (checked) refreshRainNowcast(true);
    else map.removeLayer(rainNowcastLayer);
    return;
  }
  if (name === "bunkazai") {
    if (checked) { ensureBunkazaiLayer(); bunkazaiLayer.addTo(map); }
    else map.removeLayer(bunkazaiLayer);
    return;
  }
  if (name === "kominkan") {
    if (checked) { ensureKominkanLayer(); kominkanLayer.addTo(map); }
    else map.removeLayer(kominkanLayer);
    return;
  }
  if (name === "pastFlood") {
    if (checked) { ensurePastFloodLayer(); pastFloodLayer.addTo(map); }
    else map.removeLayer(pastFloodLayer);
    return;
  }
  const layerMap = {
    boundary: boundaryLayer,
    relief: hazardLayers.relief,
    floodMax: hazardLayers.floodMax,
    floodPlan: hazardLayers.floodPlan,
    inland: hazardLayers.inland,
    jshisPshm: jshisLayers.jshisPshm,
    jshisGround: jshisLayers.jshisGround,
    landslide: landslideGroup,
    roadFlood: roadFloodLayer,
    shelters: shelterLayer,
    wells: wellLayer,
    quakes: quakeLayer,
    fire: openDataLayers.fire,
    police: openDataLayers.police,
    cityOffice: openDataLayers.cityOffice,
    emergencyRoute: openDataLayers.emergencyRoute,
    railway: openDataLayers.railway,
    landslideWarning: openDataLayers.landslideWarning,
    landslideSpecial: openDataLayers.landslideSpecial,
    records: recordLayer
  };
  const layer = layerMap[name];
  if (!layer) return;
  if (checked) layer.addTo(map);
  else map.removeLayer(layer);
  // 市オープンデータのレイヤーは、最初にONにされた時だけ取得する
  if (checked && OPEN_DATA_LAYERS[name]) ensureOpenDataLayer(name);
  if (jshisLayers[name]) {
    setJshisLayerStatus(name, checked ? "読込中" : jshisLayerMeta[name].idle);
    updateJshisLegend(name, checked);
  }
}

Object.entries(jshisLayers).forEach(([name, layer]) => {
  layer.on("loading", () => setJshisLayerStatus(name, "読込中"));
  layer.on("load", () => setJshisLayerStatus(name, "表示中"));
  layer.on("tileerror", () => setJshisLayerStatus(name, "取得できません", true));
});

function setJshisLayerStatus(name, text, isError = false) {
  const node = document.getElementById(jshisLayerMeta[name]?.statusId || "");
  if (!node) return;
  node.textContent = text;
  node.classList.toggle("is-error", isError);
}

function updateJshisLegend(name, visible) {
  const legend = document.querySelector(`[data-jshis-legend="${name}"]`);
  if (legend) legend.hidden = !visible;
}

async function refreshRainNowcast(showLayer) {
  const status = document.getElementById("rain-layer-status");
  try {
    const response = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json?_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const times = await response.json();
    const latest = Array.isArray(times) ? times.find(item => item?.elements?.includes("hrpns")) : null;
    if (!latest?.basetime || !latest?.validtime) throw new Error("最新時刻がありません");
    const template = `https://www.jma.go.jp/bosai/jmatile/data/nowc/${latest.basetime}/none/${latest.validtime}/surf/hrpns/{z}/{x}/{y}.png`;
    rainNowcastLayer.setUrl(template, false);
    rainNowcastTime = latest.validtime;
    status.textContent = `${formatJmaTime(latest.validtime)}実況・5分更新`;
    status.classList.remove("is-error");
    const enabled = document.querySelector('[data-overlay="rainNowcast"]')?.checked;
    if ((showLayer || enabled) && !map.hasLayer(rainNowcastLayer)) rainNowcastLayer.addTo(map);
  } catch (error) {
    status.textContent = "取得できません";
    status.classList.add("is-error");
    if (showLayer) document.querySelector('[data-overlay="rainNowcast"]').checked = false;
    appendSystemWorkLog("リアルタイム降水レイヤー", "blocked", `気象庁の最新降水データを取得できませんでした: ${error?.message || "不明なエラー"}`, "通信状態と気象庁配信URLを確認する");
  }
}

async function refreshEarthquakeSummary(manual) {
  const node = document.getElementById("earthquake-summary-content");
  const endpoint = String(APP_CONFIG.earthquakeListEndpoint || "https://www.jma.go.jp/bosai/quake/data/list.json");
  if (manual) node.innerHTML = '<div class="detail-empty">最新情報を更新中です。</div>';
  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = await response.json();
    const reports = Array.isArray(items)
      ? items.filter(item => String(item.ttl || "").includes("震源・震度") && item.ift !== "取消")
      : [];
    const latest = reports[0];
    const inzai = reports.find(item => Array.isArray(item.int) && item.int.some(prefecture =>
      Array.isArray(prefecture.city) && prefecture.city.some(city => String(city.code) === "1223100")
    ));
    if (!latest) throw new Error("表示対象の地震情報がありません");
    const inzaiIntensity = inzai ? findCityIntensity(inzai, "1223100") : "";

    // 地図用: 座標が取れた地震を新しい順に最大20件保持する。
    // 印西市に震度記録がある地震は、市内への影響が分かるよう優先して残す
    quakeEvents = reports
      .map(item => {
        const position = parseJmaCoordinate(item.cod);
        if (!position) return null;
        return {
          at: item.at,
          name: item.anm || "",
          mag: item.mag || "",
          maxi: item.maxi || "",
          position,
          inzaiIntensity: findCityIntensity(item, "1223100") || ""
        };
      })
      .filter(Boolean)
      .slice(0, 20);
    renderQuakeLayer();
    node.innerHTML = `
      <div class="earthquake-event">
        <strong>最新: ${escapeHtml(latest.anm || "震源地不明")} M${escapeHtml(latest.mag || "-")}</strong>
        <span>${escapeHtml(formatJmaDateTime(latest.at))} / 最大震度 <span class="intensity-value">${escapeHtml(latest.maxi || "-")}</span></span>
        ${inzai ? `<span>印西市の直近観測: ${escapeHtml(formatJmaDateTime(inzai.at))} / 震度 <span class="intensity-value">${escapeHtml(inzaiIntensity || "-")}</span></span>` : '<span>取得範囲内に印西市の震度記録はありません。</span>'}
        <a href="https://www.jma.go.jp/bosai/map.html#contents=earthquake_map" target="_blank" rel="noreferrer">気象庁の地震情報を確認</a>
      </div>
    `;
  } catch (error) {
    node.innerHTML = '<div class="detail-empty">地震情報を取得できません。気象庁の公式ページを確認してください。</div>';
    if (manual) appendSystemWorkLog("気象庁 地震情報", "blocked", `地震情報を取得できませんでした: ${error?.message || "不明なエラー"}`, "気象庁公式ページと配信URLを確認する");
  }
}

async function refreshWeatherWarnings(manual) {
  const node = document.getElementById("weather-warning-content");
  const panel = document.getElementById("weather-warning-panel");
  const button = document.getElementById("refresh-weather-warning-button");
  const endpoint = String(APP_CONFIG.weatherWarningEndpoint || "https://www.jma.go.jp/bosai/warning/data/r8/120000.json");
  if (manual) node.innerHTML = '<div class="weather-warning-loading">最新情報を更新中です。</div>';
  node.setAttribute("aria-busy", "true");
  button.disabled = true;
  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}_=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reports = await response.json();
    const summary = parseInzaiWeatherWarnings(reports);
    renderWeatherWarnings(node, panel, summary);
  } catch (error) {
    setWeatherWarningPanelState(panel, "error");
    node.innerHTML = `
      <div class="weather-warning-error">
        <strong>現在の発表状況を取得できません</strong>
        <span>「発表なし」ではありません。通信状況を確認し、気象庁の公式ページで確認してください。</span>
        ${weatherWarningOfficialLink("気象庁で警報・注意報を確認")}
      </div>
    `;
    if (manual) appendSystemWorkLog("印西市の警報・注意報", "blocked", `気象庁の警報・注意報を取得できませんでした: ${error?.message || "不明なエラー"}`, "通信状態と気象庁の現行配信URLを確認する");
  } finally {
    node.setAttribute("aria-busy", "false");
    button.disabled = false;
  }
}

function parseInzaiWeatherWarnings(payload) {
  if (!Array.isArray(payload)) throw new Error("現行の警報データ形式ではありません");
  const latestByCode = new Map();
  let latestLocalReport = null;
  let foundCity = false;

  payload.forEach(report => {
    const city = (report?.warning?.class20Items || []).find(item => String(item.areaCode) === INZAI_CITY_CODE);
    if (!city) return;
    foundCity = true;
    const reportTime = new Date(report.reportDatetime || 0);
    if (!Number.isNaN(reportTime.getTime()) && (!latestLocalReport || reportTime > new Date(latestLocalReport.reportDatetime))) {
      latestLocalReport = report;
    }
    (city.kinds || []).forEach(kind => {
      const code = String(kind.code || "").padStart(2, "0");
      if (!kind.code) return;
      const existing = latestByCode.get(code);
      if (!existing || reportTime > new Date(existing.reportDatetime || 0)) {
        const definition = weatherWarningDefinitions[code] || {
          name: `気象警報・注意報（コード${code}）`,
          element: "other",
          level: 20
        };
        latestByCode.set(code, { ...definition, code, status: String(kind.status || "発表"), reportDatetime: report.reportDatetime, headlineText: report.headlineText || "", publishingOffice: report.publishingOffice || "気象庁" });
      }
    });
  });

  if (!foundCity) throw new Error("印西市の発表区域が見つかりません");
  const active = Array.from(latestByCode.values())
    .filter(item => !/解除|発表警報・注意報はなし|発表なし/.test(item.status))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "ja"));
  return {
    active,
    reportDatetime: latestLocalReport?.reportDatetime || "",
    publishingOffice: latestLocalReport?.publishingOffice || "気象庁"
  };
}

function renderWeatherWarnings(node, panel, summary) {
  const checkedAt = formatJmaDateTime(new Date());
  const reportAt = summary.reportDatetime ? formatJmaDateTime(summary.reportDatetime) : "-";
  if (!summary.active.length) {
    setWeatherWarningPanelState(panel, "clear");
    node.innerHTML = `
      <div class="weather-warning-clear">
        <span class="weather-warning-state-mark" aria-hidden="true"></span>
        <div>
          <strong>発表中の警報・注意報はありません</strong>
          <span>印西市を対象にした気象庁情報を確認しました。</span>
        </div>
      </div>
      <div class="weather-warning-meta">情報元 ${escapeHtml(summary.publishingOffice)} / 最新発表 ${escapeHtml(reportAt)} / 取得確認 ${escapeHtml(checkedAt)}</div>
      <div class="weather-warning-note">河川ごとの氾濫情報と印西市の避難情報は別に発表されます。</div>
      ${weatherWarningOfficialLink("気象庁の印西市ページを確認")}
    `;
    return;
  }

  const highestLevel = Math.max(...summary.active.map(item => item.level));
  const state = highestLevel >= 50 ? "emergency" : highestLevel >= 40 ? "danger" : highestLevel >= 30 ? "warning" : "advisory";
  const stateLabel = highestLevel >= 50 ? "特別警報" : highestLevel >= 40 ? "危険警報" : highestLevel >= 30 ? "警報" : "注意報";
  const alertLevel = Math.max(0, ...summary.active.filter(item => item.level === highestLevel).map(item => Number(item.alertLevel || 0)));
  const headline = summary.active.map(item => item.headlineText).find(Boolean) || "";
  const actions = Array.from(new Set(summary.active.map(item => weatherWarningActions[item.element]).filter(Boolean))).slice(0, 3);
  setWeatherWarningPanelState(panel, state);
  node.innerHTML = `
    <div class="weather-warning-alert-head">
      <span class="weather-warning-level">${escapeHtml(alertLevel ? `警戒レベル${alertLevel}相当` : stateLabel)}</span>
      <strong>印西市に${escapeHtml(stateLabel)}が発表中</strong>
    </div>
    <div class="weather-warning-items">
      ${summary.active.map(item => `
        <div class="weather-warning-item">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.status)}</span>
        </div>
      `).join("")}
    </div>
    ${headline ? `<p class="weather-warning-headline">${escapeHtml(headline)}</p>` : ""}
    ${actions.length ? `<div class="weather-warning-guidance"><strong>行動の目安</strong>${actions.map(action => `<span>${escapeHtml(action)}</span>`).join("")}</div>` : ""}
    <div class="weather-warning-meta">情報元 ${escapeHtml(summary.publishingOffice)} / 最新発表 ${escapeHtml(reportAt)} / 取得確認 ${escapeHtml(checkedAt)}</div>
    <div class="weather-warning-note">${alertLevel ? "警戒レベル相当情報は避難指示そのものではありません。" : "この表示は印西市の避難情報ではありません。"}印西市の避難情報も確認してください。</div>
    ${weatherWarningOfficialLink("気象庁で詳細・時系列を確認")}
  `;
}

function setWeatherWarningPanelState(panel, state) {
  panel.classList.remove("is-clear", "is-advisory", "is-warning", "is-danger", "is-emergency", "is-error");
  panel.classList.add(`is-${state}`);
}

function weatherWarningOfficialLink(label) {
  return `<a class="weather-warning-official-link" href="https://www.jma.go.jp/bosai/warning/#area_type=class20s&amp;area_code=1223100" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function findCityIntensity(report, cityCode) {
  for (const prefecture of report.int || []) {
    const city = (prefecture.city || []).find(item => String(item.code) === cityCode);
    if (city) return String(city.maxi || "");
  }
  return "";
}

function formatJmaDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatJmaTime(value) {
  const text = String(value || "");
  if (!/^\d{14}$/.test(text)) return text;
  const date = new Date(Date.UTC(
    Number(text.slice(0, 4)),
    Number(text.slice(4, 6)) - 1,
    Number(text.slice(6, 8)),
    Number(text.slice(8, 10)),
    Number(text.slice(10, 12)),
    Number(text.slice(12, 14))
  ));
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

setInterval(() => {
  if (document.querySelector('[data-overlay="rainNowcast"]')?.checked) refreshRainNowcast(true);
}, 5 * 60 * 1000);
setInterval(() => {
  if (Object.keys(KIKIKURU_ELEMENTS).some(key => document.querySelector(`[data-overlay="${key}"]`)?.checked)) refreshKikikuru(false);
}, 5 * 60 * 1000);

setInterval(() => refreshEarthquakeSummary(false), 10 * 60 * 1000);
setInterval(() => refreshWeatherWarnings(false), 5 * 60 * 1000);

function initBoundary() {
  fetch("https://geoshape.ex.nii.ac.jp/jma/resource/AreaInformationCity_risk/20241025/1223100.geojson")
    .then(response => {
      if (!response.ok) throw new Error("Boundary fetch failed");
      return response.json();
    })
    .then(data => {
      boundaryLayer.addData(data);
      document.getElementById("map-status").textContent = `公開レイヤー接続済み・確認日 ${SOURCE_CHECKED_AT}`;
    })
    .catch(() => {
      document.getElementById("map-status").textContent = "境界データを取得できませんでした。背景地図と手元データで表示しています。";
    });
}

function renderRoadFloodSites() {
  roadFloodLayer.clearLayers();
  roadFloodSites.forEach(site => {
    const marker = L.marker([site.lat, site.lng], {
      icon: L.divIcon({
        className: "",
        html: '<div class="risk-point" aria-hidden="true"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    });
    marker.bindPopup(`
      <div class="popup-title">参考リスク箇所 No.${site.no}</div>
      <div class="reference-warning">被害発生を示すピンではありません</div>
      <div>${escapeHtml(site.name)}</div>
      <div class="detail-meta">${escapeHtml(site.route)} / ${escapeHtml(site.accuracy)}</div>
      <a href="${escapeAttribute(site.sourceUrl)}" target="_blank" rel="noreferrer">出典: 道路冠水注意箇所マップ</a>
    `);
    roadFloodLayer.addLayer(marker);
  });
}

function renderAll() {
  renderDateScope();
  renderRecords();
  renderList();
  renderSummary();
  renderPhotoQueue();
  renderLocationQueue();
  renderDetail();
  renderSearchLog();
}

function renderDateScope() {
  const target = getFormValue("incident-date");
  const showAll = document.getElementById("show-all-dates").checked;
  document.getElementById("date-scope-label").textContent = showAll
    ? "過去記録を含めて表示中"
    : `${target ? target.replace(/-/g, "/") : "対象日"} の記録だけ表示中`;
}

function renderRecords() {
  recordLayer.clearLayers();
  getFilteredRecords().forEach(record => {
    const roadGeometry = getDisplayRoadGeometry(record);
    const displayCoordinates = getDisplayCoordinates(record) || roadGeometryCenter(roadGeometry);
    if (!displayCoordinates || getLocationStatus(record) !== "pinned") return;
    const alignment = deriveAlignment(record);
    const passability = getPassability(record);
    const platform = getRecordPlatform(record);
    const hasSourceUrl = isHttpUrl(record.sourceUrl);
    const hasSnsPost = record.sourceType === "sns" && isHttpUrl(record.sourceUrl);
    const popupPhoto = getPopupPhoto(record);
    const popupContent = `
      <div class="popup-title">${escapeHtml(record.title)}</div>
      ${popupPhoto ? `<div class="popup-photo-wrap ${popupPhoto.blurred ? "is-blurred" : ""}"><img src="${escapeAttribute(popupPhoto.src)}" alt="登録されたSNS投稿の証跡写真" loading="lazy" referrerpolicy="no-referrer"></div>` : ""}
      <div>${escapeHtml(categoryLabels[record.category] || record.category)} / ${escapeHtml(statusLabels[record.status] || record.status)}</div>
      <div class="detail-meta">情報源: ${escapeHtml(sourceLabels[record.sourceType] || record.sourceType)}</div>
      ${platform ? `<div class="detail-meta">情報元: ${escapeHtml(platformLabels[platform] || platform)}</div>` : ""}
      ${passability !== "none" ? `<div class="detail-meta">${escapeHtml(passabilityLabels[passability])} ・ ${escapeHtml(formatDateTime(record.passabilityCheckedAt || record.observedAt))}</div>` : ""}
      ${roadGeometry ? `<div class="detail-meta">道路区間 ${roadGeometry.length}点・${escapeHtml(formatRoadDistance(roadGeometry))} ・ ${escapeHtml(roadDirectionLabels[record.roadDirection] || roadDirectionLabels.unknown)}</div>` : ""}
      <div class="detail-meta">${escapeHtml(alignmentLabels[alignment])} ・ ${escapeHtml(photoLabels[record.photoStatus] || "")}</div>
      ${hasSnsPost ? `
        <div class="popup-source-actions">
          <a class="popup-source-link" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">元のSNS投稿を見る</a>
          ${PUBLIC_VIEW ? "" : `<button class="popup-question-button" type="button" data-popup-question-record="${escapeAttribute(record.id)}">質問文をコピーして投稿を開く</button>`}
        </div>
        ${PUBLIC_VIEW ? "" : '<div class="popup-contact-note">コメント送信はSNS画面で内容を確認してから行います。</div>'}
      ` : hasSourceUrl
        ? `<div class="popup-source-actions"><a class="popup-source-link" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noopener noreferrer">根拠情報を開く</a></div>`
        : '<div class="popup-contact-note">根拠URLが登録されていません。</div>'}
    `;

    if (roadGeometry) {
      const color = markerColor(record, alignment);
      const casing = L.polyline(roadGeometry, {
        color: "#ffffff",
        weight: 11,
        opacity: 0.92,
        interactive: false
      });
      const line = L.polyline(roadGeometry, {
        color,
        weight: 7,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
        dashArray: passability === "passed" ? "10 8" : null
      });
      line.on("click", () => selectRecord(record.id, false, { preserveMap: true }));
      line.bindPopup(popupContent);
      line.on("popupopen", () => bindMarkerPopupActions(line, record));
      recordLayer.addLayer(casing);
      recordLayer.addLayer(line);
      return;
    }

    const isPointClosure = passability === "closed" || passability === "impassable";
    const marker = L.marker([displayCoordinates.lat, displayCoordinates.lng], {
      icon: L.divIcon({
        className: "",
        html: isPointClosure
          ? '<div class="closure-cross" aria-label="通行止め地点">×</div>'
          : `<div class="marker-pin" style="background:${markerColor(record, alignment)}"><span></span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, isPointClosure ? 14 : 28]
      })
    });
    marker.on("click", () => selectRecord(record.id, false, { preserveMap: true }));
    marker.bindPopup(popupContent);
    marker.on("popupopen", () => bindMarkerPopupActions(marker, record));
    recordLayer.addLayer(marker);
  });
}

function bindMarkerPopupActions(marker, record) {
  const popupElement = marker.getPopup()?.getElement();
  const button = popupElement?.querySelector("[data-popup-question-record]");
  if (!button) return;
  button.addEventListener("click", () => beginLocationContactForRecord(record.id, "comment"), { once: true });
}

function getPopupPhoto(record) {
  if (!record) return null;
  const publicPhotoAllowed = record.photoPrivacy === "public" || record.photoPrivacy === "public-blurred";
  if (PUBLIC_VIEW && (!publicPhotoAllowed || record.category === "rescue_request")) return null;
  const evidenceImage = String(record.evidenceImage || "");
  const directPhotoUrl = String(record.photoUrl || "");
  const src = evidenceImage.startsWith("data:image/")
    ? evidenceImage
    : isDirectImageUrl(directPhotoUrl)
      ? directPhotoUrl
      : "";
  return src ? { src, blurred: PUBLIC_VIEW && record.photoPrivacy === "public-blurred" } : null;
}

function isDirectImageUrl(value) {
  if (!isHttpUrl(value)) return false;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return /\.(?:avif|gif|jpe?g|png|webp)$/.test(pathname);
  } catch {
    return false;
  }
}

function renderList() {
  const list = document.getElementById("record-list");
  const filtered = getFilteredRecords();
  if (!filtered.length) {
    list.innerHTML = '<div class="detail-empty">対象日に一致する登録地点はありません。対象日または「過去記録も表示」を確認してください。</div>';
    return;
  }
  list.innerHTML = filtered
    .sort((a, b) => String(b.observedAt || "").localeCompare(String(a.observedAt || "")))
    .map(record => {
      const alignment = deriveAlignment(record);
      const passability = getPassability(record);
      const roadGeometry = getDisplayRoadGeometry(record);
      const platform = getRecordPlatform(record);
      const opensSnsPost = record.sourceType === "sns" && isHttpUrl(record.sourceUrl);
      const cardTag = opensSnsPost ? "a" : "article";
      const linkAttributes = opensSnsPost
        ? `href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noopener noreferrer" title="元のSNS投稿を開く"`
        : "";
      return `
        <${cardTag} class="record-card ${opensSnsPost ? "has-source-link" : ""} ${record.id === selectedId ? "is-selected" : ""}" data-record-id="${record.id}" ${linkAttributes} style="border-left-color:${markerColor(record, alignment)}">
          <h3>${escapeHtml(record.title)}</h3>
          <div class="record-meta">
            <span class="badge ${badgeColor(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
            <span class="badge ${alignmentColor(alignment)}">${escapeHtml(alignmentLabels[alignment])}</span>
            ${platform ? `<span class="badge blue">${escapeHtml(platformLabels[platform] || platform)}</span>` : ""}
            ${passability !== "none" ? `<span class="badge ${passabilityBadgeColor(passability)}">${escapeHtml(passabilityLabels[passability])}</span>` : ""}
            ${roadGeometry ? `<span class="badge blue">道路区間 ${roadGeometry.length}点・${escapeHtml(formatRoadDistance(roadGeometry))}</span>` : ""}
            <span>${escapeHtml(categoryLabels[record.category] || record.category)}</span>
            <span>${escapeHtml(PUBLIC_VIEW && record.publicLocationPrecision !== "exact" ? (record.publicLocationPrecision === "approximate" ? "概略位置" : "位置非公開") : (record.locationName || "場所名なし"))}</span>
            <span class="badge ${getLocationStatus(record) === "pinned" ? "green" : "yellow"}">${escapeHtml(locationStatusDisplayLabel(record))}</span>
          </div>
        </${cardTag}>
      `;
    })
    .join("");
  list.querySelectorAll("[data-record-id]").forEach(card => {
    card.addEventListener("click", () => selectRecord(card.dataset.recordId, true));
  });
}

function renderSummary() {
  const filtered = getFilteredRecords();
  const outside = filtered.filter(record => deriveAlignment(record) === "unexpected").length;
  const needsPhoto = filtered.filter(record => record.photoStatus === "needs-photo" || record.photoStatus === "has-photo").length;
  const verified = filtered.filter(record => ["verified", "actioning", "resolved"].includes(record.status)).length;
  const official = filtered.filter(record => record.sourceType === "official" || record.sourceType === "staff").length;
  const locationPending = filtered.filter(record => getLocationStatus(record) !== "pinned").length;
  const blocked = filtered.filter(record => ["closed", "impassable"].includes(getPassability(record))).length;
  document.getElementById("summary-stats").innerHTML = `
    <div class="stat"><strong>${filtered.length}</strong><span>登録候補</span></div>
    <div class="stat"><strong>${verified}</strong><span>確認済・対応中</span></div>
    <div class="stat"><strong>${outside}</strong><span>想定外候補</span></div>
    <div class="stat"><strong>${needsPhoto}</strong><span>写真確認待ち</span></div>
    <div class="stat"><strong>${official}</strong><span>公式/職員根拠</span></div>
    <div class="stat"><strong>${locationPending}</strong><span>場所確認待ち</span></div>
    <div class="stat"><strong>${blocked}</strong><span>通行止め・不能</span></div>
    <div class="stat"><strong>${roadFloodSites.length}</strong><span>参考リスク箇所</span></div>
  `;
}

function renderPhotoQueue() {
  const queue = getFilteredRecords().filter(record => record.photoStatus !== "official-verified" && record.status !== "resolved");
  const node = document.getElementById("photo-queue");
  if (!queue.length) {
    node.innerHTML = '<div class="detail-empty">写真確認待ちはありません。</div>';
    return;
  }
  node.innerHTML = queue
    .map(record => `
      <article class="queue-item" data-record-id="${record.id}">
        <h3>${escapeHtml(record.title)}</h3>
        <div class="queue-meta">
          <span class="badge ${record.photoStatus === "needs-photo" ? "yellow" : "blue"}">${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)}</span>
          <span>${escapeHtml(record.locationName || "場所名なし")}</span>
          <span>${escapeHtml(record.assignedTo || "担当未設定")}</span>
        </div>
      </article>
    `)
    .join("");
  node.querySelectorAll("[data-record-id]").forEach(item => {
    item.addEventListener("click", () => selectRecord(item.dataset.recordId, true));
  });
}

function renderLocationQueue() {
  const queue = getFilteredRecords().filter(record => getLocationStatus(record) !== "pinned" && record.status !== "resolved");
  const node = document.getElementById("location-queue");
  if (!queue.length) {
    node.innerHTML = '<div class="detail-empty">場所確認待ちはありません。</div>';
    return;
  }
  node.innerHTML = queue.map(record => `
    <article class="queue-item" data-record-id="${record.id}">
      <h3>${escapeHtml(record.title)}</h3>
      <div class="queue-meta">
        <span class="badge yellow">${escapeHtml(locationStatusDisplayLabel(record))}</span>
        <span>${escapeHtml(record.evidenceOperator || record.assignedTo || "担当未設定")}</span>
      </div>
    </article>
  `).join("");
  node.querySelectorAll("[data-record-id]").forEach(item => {
    item.addEventListener("click", () => selectRecord(item.dataset.recordId, false));
  });
}

function renderDetail() {
  const detail = document.getElementById("detail-panel");
  const record = records.find(item => item.id === selectedId);
  if (!record || (PUBLIC_VIEW && record.publicationStatus !== "published")) {
    if (PUBLIC_VIEW && record) selectedId = null;
    detail.innerHTML = "地図または一覧から地点を選択してください。";
    return;
  }
  const alignment = deriveAlignment(record);
  const riskHits = getRiskHits(record);
  const locationStatus = getLocationStatus(record);
  const passability = getPassability(record);
  const platform = getRecordPlatform(record);
  const roadGeometry = getDisplayRoadGeometry(record);
  const displayCoordinates = getDisplayCoordinates(record) || roadGeometryCenter(roadGeometry);
  const publicApproximate = PUBLIC_VIEW && record.publicLocationPrecision === "approximate";
  const displayLocationName = publicApproximate ? "公開用の概略位置" : (record.locationName || "-");
  detail.innerHTML = `
    <div class="detail-title">
      <h3>${escapeHtml(record.title)}</h3>
      <div class="detail-meta">
        <span class="badge ${badgeColor(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
        <span class="badge ${alignmentColor(alignment)}">${escapeHtml(alignmentLabels[alignment])}</span>
        <span class="badge ${photoBadgeColor(record.photoStatus)}">${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)}</span>
        <span class="badge ${locationStatus === "pinned" ? "green" : "yellow"}">${escapeHtml(locationStatusDisplayLabel(record))}</span>
        ${passability !== "none" ? `<span class="badge ${passabilityBadgeColor(passability)}">${escapeHtml(passabilityLabels[passability])}</span>` : ""}
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-row"><span>分類</span><span>${escapeHtml(categoryLabels[record.category] || record.category)}</span></div>
      ${passability !== "none" ? `<div class="detail-row"><span>通行状況</span><span>${escapeHtml(passabilityLabels[passability])}</span></div>` : ""}
      ${passability !== "none" ? `<div class="detail-row"><span>対象</span><span>${escapeHtml(passabilityModeLabels[record.passabilityMode] || passabilityModeLabels.unknown)}</span></div>` : ""}
      ${passability !== "none" ? `<div class="detail-row"><span>最終確認</span><span>${escapeHtml(formatDateTime(record.passabilityCheckedAt || record.observedAt))}</span></div>` : ""}
      ${roadGeometry ? `<div class="detail-row"><span>道路区間</span><span>${roadGeometry.length}点・${escapeHtml(formatRoadDistance(roadGeometry))}</span></div>` : ""}
      ${roadGeometry ? `<div class="detail-row"><span>規制方向</span><span>${escapeHtml(roadDirectionLabels[record.roadDirection] || roadDirectionLabels.unknown)}</span></div>` : ""}
      <div class="detail-row"><span>場所</span><span>${escapeHtml(displayLocationName)}</span></div>
      <div class="detail-row"><span>座標</span><span>${displayCoordinates ? `${displayCoordinates.lat.toFixed(publicApproximate ? 3 : 6)}, ${displayCoordinates.lng.toFixed(publicApproximate ? 3 : 6)}${publicApproximate ? "（概略）" : ""}` : PUBLIC_VIEW ? "非公開" : "未特定"}</span></div>
      <div class="detail-row"><span>場所確認</span><span>${escapeHtml(locationStatusDisplayLabel(record))}</span></div>
      ${record.locationCandidateSource ? `<div class="detail-row"><span>場所候補根拠</span><span>${escapeHtml(locationCandidateSourceLabel(record.locationCandidateSource))} / 確度${Math.round(Number(record.locationCandidateConfidence || 0) * 100)}%${record.locationCandidateOutsideArea ? " / 印西市外" : ""}</span></div>` : ""}
      ${record.locationAskedAt ? `<div class="detail-row"><span>質問日時</span><span>${escapeHtml(formatDateTime(record.locationAskedAt))}</span></div>` : ""}
      ${record.locationContactMethod ? `<div class="detail-row"><span>確認手段</span><span>${escapeHtml(locationContactLabels[record.locationContactMethod] || record.locationContactMethod)}</span></div>` : ""}
      ${record.locationAnsweredAt ? `<div class="detail-row"><span>回答確認</span><span>${escapeHtml(formatDateTime(record.locationAnsweredAt))}</span></div>` : ""}
      ${record.locationAnswerNote ? `<div class="detail-row"><span>場所回答</span><span>${escapeHtml(record.locationAnswerNote)}</span></div>` : ""}
      <div class="detail-row"><span>時刻</span><span>${escapeHtml(formatDateTime(record.observedAt))}${record.observedAtDerived ? `（${escapeHtml(record.evidenceRelativeTime || "相対表記")}から逆算）` : ""}</span></div>
      <div class="detail-row"><span>情報源</span><span>${escapeHtml(sourceLabels[record.sourceType] || record.sourceType)}</span></div>
      ${platform ? `<div class="detail-row"><span>SNS媒体</span><span>${escapeHtml(platformLabels[platform] || platform)}</span></div>` : ""}
      ${!PUBLIC_VIEW && record.sourceUsername ? `<div class="detail-row"><span>投稿者</span><span>@${escapeHtml(record.sourceUsername)}</span></div>` : ""}
      ${!PUBLIC_VIEW ? `<div class="detail-row"><span>担当</span><span>${escapeHtml(record.assignedTo || "-")}</span></div>` : ""}
      ${!PUBLIC_VIEW && record.evidenceOperator ? `<div class="detail-row"><span>確認者</span><span>${escapeHtml(record.evidenceOperator)}</span></div>` : ""}
      ${record.evidenceCheckedAt ? `<div class="detail-row"><span>確認時刻</span><span>${escapeHtml(formatDateTime(record.evidenceCheckedAt))}</span></div>` : ""}
      <div class="detail-row"><span>ハザード</span><span>${riskHits.length ? riskHits.map(escapeHtml).join("、") : "該当なし/未判定"}</span></div>
      <div class="detail-row"><span>写真</span><span>${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)} / ${escapeHtml(record.photoPrivacy || "internal")}</span></div>
      <div class="detail-row"><span>公開状態</span><span>${escapeHtml(publicationStatusLabel(record.publicationStatus))} / ${escapeHtml(publicLocationPrecisionLabel(record.publicLocationPrecision))}</span></div>
      ${record.evidencePlatform ? `<div class="detail-row"><span>証跡</span><span>${escapeHtml(platformLabels[record.evidencePlatform] || record.evidencePlatform)} / ${escapeHtml(record.evidenceQuery || "-")}</span></div>` : ""}
      ${!PUBLIC_VIEW ? `<div class="detail-row"><span>メモ</span><span>${escapeHtml(record.notes || "-")}</span></div>` : ""}
    </div>
    ${!PUBLIC_VIEW && record.evidenceImage ? `<img class="evidence-preview" src="${record.evidenceImage}" alt="検索画面スクリーンショット切り出し">` : ""}
    ${!PUBLIC_VIEW && isHttpUrl(record.photoUrl) && record.photoUrl !== record.evidenceImage ? `<a href="${escapeAttribute(record.photoUrl)}" target="_blank" rel="noreferrer"><img class="evidence-preview" src="${escapeAttribute(record.photoUrl)}" alt="投稿に添付された被害候補写真" loading="lazy"></a>` : ""}
    ${!PUBLIC_VIEW && record.sourceText ? `<div class="source-text-block"><strong>投稿本文・要約</strong><p>${escapeHtml(record.sourceText)}</p></div>` : ""}
    ${!PUBLIC_VIEW && record.sourceComments ? `<div class="source-text-block"><strong>場所に関係するコメント</strong><p>${escapeHtml(record.sourceComments)}</p></div>` : ""}
    ${!PUBLIC_VIEW && record.evidenceOcrText ? `<pre class="evidence-ocr">${escapeHtml(record.evidenceOcrText)}</pre>` : ""}
    ${PUBLIC_VIEW ? "" : `<div class="detail-actions">
      ${record.sourceUrl && locationStatus !== "pinned" ? `<button class="tool-button primary" type="button" data-action="ask-location">場所を質問（コメント / DM）</button>` : ""}
      ${(record.sourceText || record.sourceComments || record.evidenceOcrText) ? `<button class="tool-button" type="button" data-action="search-location">本文・コメントから場所候補</button>` : ""}
      ${locationStatus !== "pinned" ? `<button class="tool-button" type="button" data-action="locate">${locationStatus === "identified" ? "場所候補を地図で確認してピン" : "回答後、地図でピンを置く"}</button>` : ""}
      <button class="tool-button" type="button" data-action="edit">編集</button>
      <button class="tool-button" type="button" data-action="verified">確認済</button>
      <button class="tool-button" type="button" data-action="photo">写真確認済</button>
      <button class="tool-button" type="button" data-action="actioning">対応中</button>
      <button class="tool-button" type="button" data-action="resolved">解消済</button>
      ${record.evidenceImage ? `<button class="tool-button" type="button" data-action="download-evidence">証跡画像DL</button>` : ""}
      ${record.sourceUrl ? `<a class="tool-button" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noreferrer">根拠を開く</a>` : ""}
      <button class="tool-button danger" type="button" data-action="delete">🗑 削除</button>
    </div>`}
  `;
  detail.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => handleDetailAction(button.dataset.action));
  });
}

function selectRecord(id, panTo, options = {}) {
  selectedId = id;
  const record = records.find(item => item.id === id);
  const roadGeometry = getDisplayRoadGeometry(record);
  const displayCoordinates = getDisplayCoordinates(record) || roadGeometryCenter(roadGeometry);
  if (record && panTo && roadGeometry) {
    map.fitBounds(L.latLngBounds(roadGeometry).pad(0.5), { maxZoom: 16 });
  } else if (record && panTo && displayCoordinates) {
    map.setView([displayCoordinates.lat, displayCoordinates.lng], Math.max(map.getZoom(), 15));
  }
  if (options.preserveMap) {
    renderList();
    renderDetail();
  } else {
    renderAll();
  }
}

function openRoadStatusDialog() {
  const checkedAt = incidentDateTimeInput();
  openRecordDialog({
    category: "traffic",
    severity: "high",
    sourceType: "citizen",
    passability: "impassable",
    passabilityMode: "all",
    passabilityCheckedAt: checkedAt,
    observedAt: checkedAt
  });
}

function openRecordDialog(seed = {}) {
  const record = seed.id ? records.find(item => item.id === seed.id) : null;
  const dialog = document.getElementById("record-dialog");
  document.getElementById("record-dialog-title").textContent = record
    ? getRoadGeometry(record) ? "道路区間編集" : "地点編集"
    : seed.category === "traffic" ? "道路通行情報を追加" : "地点追加";
  document.getElementById("delete-record-button").style.visibility = record ? "visible" : "hidden";
  recordFormLocationCandidate = null;

  const seedHasCoordinates = hasCoordinates(seed);
  const values = record || {
    id: "",
    category: seed.category || "road_flood",
    status: seed.status || "unconfirmed",
    severity: seed.severity || "medium",
    sourceType: seed.sourceType || "sns",
    title: seed.title || "",
    locationName: seed.locationName || "",
    lat: seedHasCoordinates ? seed.lat : null,
    lng: seedHasCoordinates ? seed.lng : null,
    locationStatus: seed.locationStatus || (seedHasCoordinates ? "pinned" : "unknown"),
    locationContactMethod: seed.locationContactMethod || "",
    locationAnsweredAt: seed.locationAnsweredAt || "",
    locationAnswerNote: seed.locationAnswerNote || "",
    observedAt: seed.observedAt || "",
    assignedTo: seed.assignedTo || "",
    sourceUrl: seed.sourceUrl || "",
    sourceText: seed.sourceText || "",
    sourceComments: seed.sourceComments || "",
    publicationStatus: seed.publicationStatus || "internal",
    publicLocationPrecision: seed.publicLocationPrecision || (seed.category === "rescue_request" ? "approximate" : "hidden"),
    passability: seed.passability || "none",
    passabilityMode: seed.passabilityMode || "unknown",
    passabilityCheckedAt: seed.passabilityCheckedAt || "",
    roadDirection: seed.roadDirection || "unknown",
    roadGeometry: getRoadGeometry(seed) || [],
    photoStatus: seed.photoStatus || "needs-photo",
    photoPrivacy: seed.photoPrivacy || "internal",
    photoUrl: seed.photoUrl || "",
    notes: seed.notes || "",
    hazardFlags: seed.hazardFlags || { flood: false, inland: false, road: false, landslide: false }
  };

  setFormValue("record-id", values.id || "");
  setFormValue("record-category", values.category);
  setFormValue("record-status", values.status);
  setFormValue("record-severity", values.severity);
  setFormValue("record-source-type", values.sourceType);
  setFormValue("record-passability", getPassability(values));
  setFormValue("record-passability-mode", values.passabilityMode || "unknown");
  setFormValue("record-passability-checked-at", values.passabilityCheckedAt || "");
  setFormValue("record-road-direction", values.roadDirection || "unknown");
  setFormValue("record-road-geometry", JSON.stringify(getRoadGeometry(values) || []));
  setFormValue("record-title", values.title);
  setFormValue("record-location", values.locationName);
  setFormValue("record-lat", hasCoordinates(values) ? Number(values.lat).toFixed(6) : "");
  setFormValue("record-lng", hasCoordinates(values) ? Number(values.lng).toFixed(6) : "");
  setFormValue("record-location-status", getLocationStatus(values));
  setFormValue("record-location-contact-method", values.locationContactMethod || "");
  setFormValue("record-location-answered-at", values.locationAnsweredAt || "");
  setFormValue("record-location-answer-note", values.locationAnswerNote || "");
  setFormValue("record-observed-at", values.observedAt || "");
  setFormValue("record-assignee", values.assignedTo);
  setFormValue("record-source-url", values.sourceUrl);
  setFormValue("record-source-text", values.sourceText || values.evidenceOcrText || "");
  setFormValue("record-source-comments", values.sourceComments || "");
  setFormValue("record-publication-status", values.publicationStatus || "internal");
  setFormValue("record-public-location-precision", values.publicLocationPrecision || "hidden");
  setFormValue("record-photo-status", values.photoStatus);
  setFormValue("record-photo-privacy", values.photoPrivacy);
  setFormValue("record-photo-url", values.photoUrl);
  setFormValue("record-notes", values.notes);
  document.getElementById("hazard-flood").checked = Boolean(values.hazardFlags?.flood);
  document.getElementById("hazard-inland").checked = Boolean(values.hazardFlags?.inland);
  document.getElementById("hazard-road").checked = Boolean(values.hazardFlags?.road);
  document.getElementById("hazard-landslide").checked = Boolean(values.hazardFlags?.landslide);
  renderRoadGeometrySummary();
  updateRoadColorPreview();

  const formHelp = document.getElementById("record-form-help");
  if (record?.evidencePlatform || getLocationStatus(values) !== "pinned") {
    formHelp.hidden = false;
    formHelp.textContent = getLocationStatus(values) === "pinned"
      ? "最後に、分類・重要度・場所を確認して保存してください。"
      : "場所が分からない間は座標を空欄のまま保存できます。投稿者へ確認後、「地図でピンを置く」から場所を設定してください。";
  } else {
    formHelp.hidden = true;
    formHelp.textContent = "";
  }

  dialog.showModal();
  renderRecordDuplicateWarning();
}

function useMapCenter() {
  const center = map.getCenter();
  setFormValue("record-lat", center.lat.toFixed(6));
  setFormValue("record-lng", center.lng.toFixed(6));
  setFormValue("record-location-status", "pinned");
}

function saveRecordFromForm(event) {
  event.preventDefault();
  const existingId = getFormValue("record-id");
  const existingRecord = existingId ? records.find(item => item.id === existingId) : null;
  const latValue = parseOptionalNumber(getFormValue("record-lat"));
  const lngValue = parseOptionalNumber(getFormValue("record-lng"));
  const roadGeometry = parseRoadGeometry(getFormValue("record-road-geometry"));
  const roadCenter = roadGeometry ? roadGeometryCenter(roadGeometry) : null;
  const record = {
    ...(existingRecord || {}),
    id: existingId || `rec-${Date.now()}`,
    title: getFormValue("record-title"),
    category: getFormValue("record-category"),
    locationName: getFormValue("record-location"),
    lat: roadCenter?.lat ?? latValue,
    lng: roadCenter?.lng ?? lngValue,
    locationStatus: roadGeometry ? "pinned" : getFormValue("record-location-status"),
    locationContactMethod: getFormValue("record-location-contact-method"),
    locationAnsweredAt: getFormValue("record-location-answered-at"),
    locationAnswerNote: getFormValue("record-location-answer-note"),
    observedAt: getFormValue("record-observed-at"),
    incidentDate: existingRecord?.incidentDate || getFormValue("incident-date"),
    sourceType: getFormValue("record-source-type"),
    sourceUrl: getFormValue("record-source-url"),
    sourceText: getFormValue("record-source-text"),
    sourceComments: getFormValue("record-source-comments"),
    publicationStatus: getFormValue("record-publication-status"),
    publicLocationPrecision: getFormValue("record-public-location-precision"),
    status: getFormValue("record-status"),
    severity: getFormValue("record-severity"),
    passability: getFormValue("record-passability"),
    passabilityMode: getFormValue("record-passability-mode"),
    passabilityCheckedAt: getFormValue("record-passability-checked-at"),
    roadDirection: getFormValue("record-road-direction"),
    roadGeometry: roadGeometry || [],
    photoStatus: getFormValue("record-photo-status"),
    photoUrl: getFormValue("record-photo-url"),
    photoPrivacy: getFormValue("record-photo-privacy"),
    assignedTo: getFormValue("record-assignee"),
    notes: getFormValue("record-notes"),
    hazardFlags: {
      flood: document.getElementById("hazard-flood").checked,
      inland: document.getElementById("hazard-inland").checked,
      road: document.getElementById("hazard-road").checked,
      landslide: document.getElementById("hazard-landslide").checked
    }
  };

  if (recordFormLocationCandidate) {
    Object.assign(record, locationCandidateAuditFields(recordFormLocationCandidate));
  }

  if ((record.lat === null) !== (record.lng === null)) {
    alert("緯度と経度は両方入力するか、両方空欄にしてください。");
    return;
  }
  if (!hasCoordinates(record) && record.locationStatus === "pinned") record.locationStatus = "unknown";
  if (record.category === "rescue_request" && record.publicationStatus === "published" && record.publicLocationPrecision === "exact") {
    alert("救助・安否確認要請の正確な位置は公開できません。『概略位置』または『位置を非公開』を選んでください。");
    return;
  }

  const duplicates = detectDuplicates(record, existingId);
  if (duplicates.length && !confirmDuplicateRegistration(duplicates)) return;

  records = existingId
    ? records.map(item => (item.id === existingId ? record : item))
    : [...records, record];
  selectedId = record.id;
  persistRecords();
  document.getElementById("record-dialog").close();
  renderAll();
}

function deleteCurrentRecord() {
  const id = getFormValue("record-id");
  if (!id) return;
  if (!confirm("この地点を削除しますか。")) return;
  records = records.filter(record => record.id !== id);
  selectedId = null;
  persistRecords();
  document.getElementById("record-dialog").close();
  renderAll();
}

function handleDetailAction(action) {
  const record = records.find(item => item.id === selectedId);
  if (!record) return;
  if (action === "edit") {
    openRecordDialog({ id: record.id });
    return;
  }
  if (action === "download-evidence") {
    downloadDataUrl(record.evidenceImage, `evidence-${record.id}.jpg`);
    return;
  }
  if (action === "ask-location") {
    locationContactRecordId = record.id;
    document.getElementById("location-contact-dialog").showModal();
    return;
  }
  if (action === "search-location") {
    openLocationSearchDialog({ source: "record", recordId: record.id });
    return;
  }
  if (action === "locate") {
    startLocationPick(record.id);
    return;
  }
  if (action === "delete") {
    // 誤登録の取り消し用。取り消し（アンドゥ）はないため必ず確認を挟む
    if (!confirm(`「${record.title || "この地点"}」を削除しますか。元に戻せません。`)) return;
    records = records.filter(item => item.id !== record.id);
    selectedId = null;
    persistRecords();
    renderAll();
    return;
  }
  if (action === "photo") {
    record.photoStatus = "official-verified";
    record.photoPrivacy = record.photoPrivacy || "internal";
  } else {
    record.status = action;
  }
  persistRecords();
  renderAll();
}

function beginLocationContact(method) {
  beginLocationContactForRecord(locationContactRecordId, method);
}

function beginLocationContactForRecord(recordId, method) {
  const record = records.find(item => item.id === recordId);
  if (!record) return;
  const question = buildLocationQuestion(method);
  navigator.clipboard?.writeText(question).catch(() => {});
  const opened = window.open(record.sourceUrl, "_blank");
  if (opened) opened.opener = null;
  if (getLocationStatus(record) !== "pinned") record.locationStatus = "asked";
  record.locationContactMethod = method;
  record.locationAskedAt = nowLocalInput();
  record.locationAskedBy = record.evidenceOperator || loadOperator();
  record.assignedTo = record.assignedTo === "場所確認待ち" ? "投稿者へ確認中" : record.assignedTo;
  locationContactRecordId = null;
  const dialog = document.getElementById("location-contact-dialog");
  if (dialog.open) dialog.close();
  persistRecords();
  renderAll();
  document.getElementById("map-status").textContent = `${locationContactLabels[method]}用の質問文をコピーしました。元投稿を開いて貼り付けてください。`;
}

function buildLocationQuestion(method) {
  const body = "印西市内の災害状況確認のため、差し支えない範囲で撮影場所（町名・道路名・目印）と撮影時刻、現在も同じ状況かを教えていただけますか。個人名・電話番号・個人宅の詳細住所は書かないでください。";
  return method === "dm" ? `突然のご連絡失礼します。${body}` : body;
}

function startLocationPick(recordId) {
  const record = records.find(item => item.id === recordId);
  if (!record) return;
  locationPickRecordId = recordId;
  selectedId = recordId;
  document.getElementById("location-pick-banner").hidden = false;
  document.querySelector(".map-pane").classList.add("is-location-pick");
  document.getElementById("map-status").textContent = "投稿者から確認できた場所を地図上でクリックしてください。";
  if (hasCoordinates(record)) map.setView([Number(record.lat), Number(record.lng)], Math.max(map.getZoom(), 15));
  else map.fitBounds(INZAI_BOUNDS);
  document.querySelector(".map-pane").scrollIntoView({ behavior: "smooth", block: "center" });
  scheduleMapResize();
}

function completeLocationPick(latlng) {
  const record = records.find(item => item.id === locationPickRecordId);
  if (!record) {
    cancelLocationPick();
    return;
  }
  record.lat = Number(latlng.lat.toFixed(6));
  record.lng = Number(latlng.lng.toFixed(6));
  if (record.locationStatus === "asked" && !record.locationAnsweredAt) record.locationAnsweredAt = nowLocalInput();
  record.locationStatus = "pinned";
  if (!record.locationName || ["場所未特定", "位置未確定"].includes(record.locationName)) {
    record.locationName = "地図指定地点";
  }
  locationPickRecordId = null;
  document.getElementById("location-pick-banner").hidden = true;
  document.querySelector(".map-pane").classList.remove("is-location-pick");
  selectedId = record.id;
  persistRecords();
  map.setView([record.lat, record.lng], Math.max(map.getZoom(), 15));
  renderAll();
  openRecordDialog({ id: record.id });
}

function cancelLocationPick() {
  locationPickRecordId = null;
  document.getElementById("location-pick-banner").hidden = true;
  document.querySelector(".map-pane").classList.remove("is-location-pick");
  document.getElementById("map-status").textContent = `公開レイヤー接続済み・確認日 ${SOURCE_CHECKED_AT}`;
}

function startRoadSectionSelection() {
  const geometry = parseRoadGeometry(getFormValue("record-road-geometry")) || [];
  roadDrawingOriginal = geometry.map(point => [...point]);
  roadDrawingPoints = geometry.map(point => [...point]);
  roadDrawingMode = true;
  clickAddMode = false;
  document.getElementById("map-click-button").setAttribute("aria-pressed", "false");
  document.getElementById("record-dialog").close();
  document.getElementById("road-draw-banner").hidden = false;
  document.querySelector(".map-pane").classList.add("is-road-drawing");
  renderRoadDrawingPreview();
  if (roadDrawingPoints.length >= 2) map.fitBounds(L.latLngBounds(roadDrawingPoints).pad(0.35));
  scheduleMapResize();
}

function addRoadSectionPoint(latlng) {
  if (!roadDrawingMode) return;
  roadDrawingPoints.push([Number(latlng.lat.toFixed(6)), Number(latlng.lng.toFixed(6))]);
  renderRoadDrawingPreview();
}

function undoRoadSectionPoint() {
  roadDrawingPoints.pop();
  renderRoadDrawingPreview();
}

function cancelRoadSectionSelection() {
  setFormValue("record-road-geometry", JSON.stringify(roadDrawingOriginal));
  closeRoadSectionSelection();
}

function finishRoadSectionSelection() {
  if (roadDrawingPoints.length < 2) return;
  setFormValue("record-road-geometry", JSON.stringify(roadDrawingPoints));
  const center = roadGeometryCenter(roadDrawingPoints);
  if (center) {
    setFormValue("record-lat", center.lat.toFixed(6));
    setFormValue("record-lng", center.lng.toFixed(6));
    setFormValue("record-location-status", "pinned");
  }
  closeRoadSectionSelection();
}

function closeRoadSectionSelection() {
  roadDrawingMode = false;
  roadDrawingLayer.clearLayers();
  document.getElementById("road-draw-banner").hidden = true;
  document.querySelector(".map-pane").classList.remove("is-road-drawing");
  document.getElementById("record-dialog").showModal();
  renderRoadGeometrySummary();
  renderRecordDuplicateWarning();
}

function clearRoadSection() {
  setFormValue("record-road-geometry", "[]");
  renderRoadGeometrySummary();
}

function renderRoadDrawingPreview() {
  roadDrawingLayer.clearLayers();
  if (roadDrawingPoints.length >= 2) {
    roadDrawingLayer.addLayer(L.polyline(roadDrawingPoints, {
      color: "#b8322c",
      weight: 7,
      opacity: 0.94,
      dashArray: "10 7",
      interactive: false
    }));
  }
  roadDrawingPoints.forEach((point, index) => {
    const marker = L.circleMarker(point, {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: "#b8322c",
      fillOpacity: 1,
      interactive: false
    });
    const pointLabel = index === 0
      ? "始点"
      : index === roadDrawingPoints.length - 1
        ? "終点"
        : `中間${index}`;
    marker.bindTooltip(pointLabel, {
      permanent: true,
      direction: "top",
      offset: [0, -8]
    });
    roadDrawingLayer.addLayer(marker);
  });
  const status = document.getElementById("road-draw-status");
  status.textContent = roadDrawingPoints.length === 0
    ? "まず通行止め区間の始点となる交差点を選んでください。"
    : roadDrawingPoints.length === 1
      ? "次の交差点を選んでください。曲がる道路では中間点を続けて追加できます。"
      : `${roadDrawingPoints.length}点・${formatRoadDistance(roadDrawingPoints)}。曲がりに沿って点を追加するか、この区間で確定してください。`;
  document.getElementById("road-draw-undo-button").disabled = roadDrawingPoints.length === 0;
  document.getElementById("road-draw-finish-button").disabled = roadDrawingPoints.length < 2;
}

function renderRoadGeometrySummary() {
  const geometry = parseRoadGeometry(getFormValue("record-road-geometry"));
  const node = document.getElementById("record-road-geometry-summary");
  node.textContent = geometry
    ? `道路区間を設定済み（${geometry.length}点・${formatRoadDistance(geometry)}）`
    : "区間未設定（通行止め・通行不能は地図上に×で表示）";
  document.getElementById("record-road-clear-button").disabled = !geometry;
  document.getElementById("record-road-draw-button").textContent = geometry ? "道路区間を変更" : "道路区間を地図で指定";
}

function updateRoadColorPreview() {
  const passability = getFormValue("record-passability");
  const colors = {
    closed: "#b8322c",
    impassable: "#b8322c",
    restricted: "#c96321",
    reopened: "#24745a",
    passed: "#2365a8",
    none: "#6b737a"
  };
  const node = document.getElementById("record-road-color-preview");
  node.querySelector("span").style.background = colors[passability] || colors.none;
  node.querySelector("strong").textContent = `${passabilityLabels[passability] || passabilityLabels.none}の表示色`;
}

function toggleClickAddMode() {
  clickAddMode = !clickAddMode;
  const button = document.getElementById("map-click-button");
  button.setAttribute("aria-pressed", String(clickAddMode));
  document.getElementById("map-status").textContent = clickAddMode
    ? "地図上をクリックすると被害候補を追加します。"
    : `公開レイヤー接続済み・確認日 ${SOURCE_CHECKED_AT}`;
}

function importCsv(event) {
  event.preventDefault();
  const text = document.getElementById("csv-input").value.trim();
  if (!text) return;
  const imported = parseCsv(text).map(row => normalizeImportedRow(row)).filter(Boolean);
  if (!imported.length) {
    alert("取り込める行がありませんでした。");
    return;
  }
  records = [...records, ...imported];
  selectedId = imported[0].id;
  persistRecords();
  document.getElementById("import-dialog").close();
  renderAll();
}

function openScreenshotDialog(seed = {}) {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  setFormValue("evidence-platform", seed.platform || getFormValue("evidence-platform") || "instagram");
  setFormValue("evidence-query", seed.query || "");
  setFormValue("evidence-url", seed.url || "");
  setFormValue("evidence-operator", seed.operator || loadOperator());
  setFormValue("evidence-observed-at", seed.observedAt || "");
  setFormValue("evidence-checked-at", seed.checkedAt || local);
  setFormValue("evidence-notes", seed.notes || "");
  setFormValue("evidence-ocr-text", "");
  document.getElementById("ocr-status").textContent = "OCR未実行";
  document.getElementById("ocr-status").classList.remove("is-active");
  document.getElementById("screenshot-dialog").showModal();
  drawScreenshotCanvas();
  renderEvidenceDuplicateWarning();
}

async function loadScreenshotFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await loadScreenshotBlob(file, { inspectGps: true });
}

function handleScreenshotPaste(event) {
  const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
  if (!imageItem) return;
  event.preventDefault();
  loadScreenshotBlob(imageItem.getAsFile(), { inspectGps: true });
}

function bindScreenshotDropZone() {
  const zone = document.getElementById("paste-zone");
  zone.addEventListener("dragover", event => {
    event.preventDefault();
    zone.classList.add("is-dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("is-dragover"));
  zone.addEventListener("drop", event => {
    event.preventDefault();
    zone.classList.remove("is-dragover");
    const file = Array.from(event.dataTransfer?.files || []).find(item => item.type.startsWith("image/"));
    if (file) loadScreenshotBlob(file, { inspectGps: true });
  });
  zone.addEventListener("click", () => zone.focus());
}

async function captureScreen() {
  const status = document.getElementById("ocr-status");
  if (!navigator.mediaDevices?.getDisplayMedia) {
    alert("このブラウザでは画面キャプチャが利用できません。スクリーンショットを貼り付けるか、画像を選択してください。");
    appendSystemWorkLog("SNS画面キャプチャ", "blocked", "このブラウザは画面キャプチャAPIに対応していません。", "画像ファイルまたは貼り付けで証跡を登録する");
    return;
  }
  let stream = null;
  try {
    setFormValue("evidence-ocr-text", "");
    screenshotState.relativeTime = null;
    screenshotState.locationCandidate = null;
    screenshotState.gpsInspectionState = "not-checked";
    screenshotState.autoGpsRecordId = null;
    status.classList.add("is-active");
    status.textContent = "共有画面で、投稿を表示したSNSタブを選んでください...";
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 1, max: 5 } },
      audio: false,
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "include",
      systemAudio: "exclude"
    });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await waitForCapturedFrame(video);
    if (!video.videoWidth || !video.videoHeight) throw new Error("共有画面の画像サイズを取得できませんでした");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (isCanvasBlank(canvas, context)) throw new Error("共有画面が白紙として取得されました");
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
    if (!blob) throw new Error("共有画面を画像へ変換できませんでした");
    loadScreenshotBlob(blob);
  } catch (error) {
    if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
      status.textContent = "画面共有はキャンセルされました。必要なときにもう一度お試しください。";
    } else {
      status.textContent = `画面を取得できませんでした。${error?.message || "画像選択または貼り付けをお試しください。"}`;
      appendSystemWorkLog("SNS画面キャプチャ", "blocked", status.textContent, "SNSタブを明示選択して再試行し、難しい場合は画像貼り付けを利用する");
    }
  } finally {
    stream?.getTracks().forEach(track => track.stop());
    status.classList.remove("is-active");
  }
}

function waitForCapturedFrame(video) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = callback => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    const timeout = setTimeout(() => finish(() => reject(new Error("共有画面の読み込みがタイムアウトしました"))), 5000);
    const ready = () => {
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        video.requestVideoFrameCallback(() => finish(resolve));
      } else {
        requestAnimationFrame(() => requestAnimationFrame(() => finish(resolve)));
      }
    };
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("resize", ready, { once: true });
    ready();
  });
}

function isCanvasBlank(canvas, context) {
  const sampleWidth = Math.min(canvas.width, 80);
  const sampleHeight = Math.min(canvas.height, 45);
  const sample = document.createElement("canvas");
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const data = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let min = 255;
  let max = 0;
  let alphaCount = 0;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3;
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
    if (data[index + 3] > 0) alphaCount += 1;
  }
  return alphaCount === 0 || (min > 248 && max - min < 3);
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function loadScreenshotBlob(blob, options = {}) {
  if (!blob) return;
  const gpsInspection = options.inspectGps
    ? await inspectImageGps(blob)
    : { state: "not-checked", candidate: null };
  const gpsCandidate = gpsInspection.candidate;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      screenshotState.image = image;
      screenshotState.crop = null;
      screenshotState.relativeTime = null;
      screenshotState.locationCandidate = gpsCandidate;
      screenshotState.gpsInspectionState = gpsInspection.state;
      if (!gpsCandidate) screenshotState.autoGpsRecordId = null;
      setFormValue("evidence-ocr-text", "");
      drawScreenshotCanvas();
      if (gpsCandidate) autoSaveGpsDraft(gpsCandidate);
      document.getElementById("ocr-status").textContent = gpsCandidate
        ? `GPSあり（${gpsCandidate.lat.toFixed(6)}, ${gpsCandidate.lng.toFixed(6)}）。内部確認中のピンとして自動保存しました。`
        : gpsInspection.state === "absent"
          ? "GPS情報なし。本文・コメント・OCRから場所候補を確認してください。"
          : gpsInspection.state === "unavailable"
            ? "GPS情報を判定できませんでした。写真形式または解析機能の読み込みを確認してください。"
            : "画面キャプチャには元写真のGPSは含まれません。投稿部分を囲んでOCRしてください。";
      renderEvidenceDuplicateWarning();
    };
    image.onerror = () => {
      document.getElementById("ocr-status").textContent = "画像を読み込めませんでした。別の画像でお試しください。";
      appendSystemWorkLog("SNS証跡画像", "blocked", "選択または貼り付けた画像を読み込めませんでした。", "別形式の画像で再試行する");
    };
    image.src = reader.result;
  };
  reader.onerror = () => {
    document.getElementById("ocr-status").textContent = "画像ファイルを読み込めませんでした。";
  };
  reader.readAsDataURL(blob);
}

async function inspectImageGps(blob) {
  if (!window.exifr?.gps) return { state: "unavailable", candidate: null };
  try {
    const gps = await window.exifr.gps(blob);
    const lat = Number(gps?.latitude);
    const lng = Number(gps?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { state: "absent", candidate: null };
    const candidate = {
      title: "元画像GPS位置",
      lat,
      lng,
      source: "image-exif",
      confidence: 1,
      query: "EXIF GPS",
      reason: "選択した元画像に記録されたGPS緯度経度",
      outsideInzai: !INZAI_BOUNDS.contains([lat, lng]),
      autoPin: true
    };
    return { state: "found", candidate };
  } catch {
    return { state: "unavailable", candidate: null };
  }
}

function autoSaveGpsDraft(candidate) {
  const checkedAt = getFormValue("evidence-checked-at") || nowLocalInput();
  const observedAt = getFormValue("evidence-observed-at") || checkedAt;
  const platform = getFormValue("evidence-platform") || "other";
  const existingId = screenshotState.autoGpsRecordId;
  const existing = existingId ? records.find(record => record.id === existingId) : null;
  const id = existing?.id || `gps-draft-${Date.now()}`;
  const draft = {
    ...(existing || {}),
    id,
    title: existing?.title && !existing.autoGpsDraft ? existing.title : "GPS付き写真（内容確認待ち）",
    category: existing?.category || "other",
    locationName: "元画像GPS位置",
    lat: candidate.lat,
    lng: candidate.lng,
    locationStatus: "pinned",
    observedAt,
    incidentDate: getFormValue("incident-date"),
    sourceType: platform === "web" ? "web" : "sns",
    sourceUrl: getFormValue("evidence-url"),
    status: existing?.status || "unconfirmed",
    severity: existing?.severity || "medium",
    passability: existing?.passability || "none",
    passabilityMode: existing?.passabilityMode || "unknown",
    passabilityCheckedAt: existing?.passabilityCheckedAt || observedAt,
    photoStatus: existing?.photoStatus || "needs-photo",
    photoUrl: existing?.photoUrl || "",
    photoPrivacy: "internal",
    assignedTo: "画像内容・位置確認待ち",
    notes: "元画像のEXIF GPSだけを自動保存した確認待ち記録。画像証跡と投稿内容は未確定。",
    hazardFlags: existing?.hazardFlags || { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: getFormValue("evidence-query"),
    evidenceOperator: getFormValue("evidence-operator"),
    evidenceCheckedAt: checkedAt,
    sourceText: existing?.sourceText || "",
    sourceComments: existing?.sourceComments || "",
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    ...locationCandidateAuditFields(candidate, checkedAt),
    autoGpsDraft: true
  };
  records = existing
    ? records.map(record => record.id === id ? draft : record)
    : [...records, draft];
  screenshotState.autoGpsRecordId = id;
  selectedId = id;
  persistRecords();
  renderAll();
  map.setView([candidate.lat, candidate.lng], 16);
}

function bindCropCanvas() {
  const canvas = document.getElementById("screenshot-canvas");
  canvas.addEventListener("pointerdown", event => {
    if (!screenshotState.image) return;
    const point = canvasPoint(event, canvas);
    screenshotState.dragging = true;
    screenshotState.start = point;
    screenshotState.crop = { x: point.x, y: point.y, w: 1, h: 1 };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!screenshotState.dragging || !screenshotState.start) return;
    const point = canvasPoint(event, canvas);
    const x = Math.min(point.x, screenshotState.start.x);
    const y = Math.min(point.y, screenshotState.start.y);
    const w = Math.abs(point.x - screenshotState.start.x);
    const h = Math.abs(point.y - screenshotState.start.y);
    screenshotState.crop = clampCrop({ x, y, w, h }, canvas);
    drawScreenshotCanvas();
  });
  canvas.addEventListener("pointerup", event => {
    screenshotState.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
}

function drawScreenshotCanvas() {
  const canvas = document.getElementById("screenshot-canvas");
  const ctx = canvas.getContext("2d");
  if (!screenshotState.image) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f6fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#5d6b74";
    ctx.font = "14px sans-serif";
    ctx.fillText("スクリーンショットを貼り付けるか画像を選択してください", 24, 48);
    return;
  }

  const image = screenshotState.image;
  const maxWidth = 720;
  const maxHeight = 520;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  screenshotState.scale = scale;
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (!screenshotState.crop) {
    screenshotState.crop = {
      x: Math.round(canvas.width * 0.08),
      y: Math.round(canvas.height * 0.10),
      w: Math.round(canvas.width * 0.84),
      h: Math.round(canvas.height * 0.58)
    };
  }

  const crop = clampCrop(screenshotState.crop, canvas);
  screenshotState.crop = crop;
  ctx.save();
  ctx.fillStyle = "rgba(22, 33, 42, 0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
  ctx.strokeStyle = "#0c6e99";
  ctx.lineWidth = 3;
  ctx.strokeRect(crop.x + 1.5, crop.y + 1.5, crop.w - 3, crop.h - 3);
  ctx.restore();
}

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height
  };
}

function clampCrop(crop, canvas) {
  const x = Math.max(0, Math.min(crop.x, canvas.width - 1));
  const y = Math.max(0, Math.min(crop.y, canvas.height - 1));
  const w = Math.max(1, Math.min(crop.w, canvas.width - x));
  const h = Math.max(1, Math.min(crop.h, canvas.height - y));
  return { x, y, w, h };
}

function resetCrop() {
  screenshotState.crop = null;
  drawScreenshotCanvas();
}

function clearScreenshot() {
  screenshotState = {
    image: null,
    scale: 1,
    crop: null,
    dragging: false,
    start: null,
    locationCandidate: null,
    relativeTime: null,
    gpsInspectionState: "not-checked",
    autoGpsRecordId: null
  };
  document.getElementById("screenshot-file").value = "";
  setFormValue("evidence-ocr-text", "");
  document.getElementById("ocr-status").textContent = "OCR未実行";
  document.getElementById("ocr-status").classList.remove("is-active");
  drawScreenshotCanvas();
  renderEvidenceDuplicateWarning();
}

async function runEvidenceOcr() {
  const dataUrl = getCroppedEvidenceDataUrl();
  if (!dataUrl) {
    alert("スクリーンショットを読み込んで、文字を抽出する範囲を指定してください。");
    return;
  }
  if (!window.Tesseract?.recognize) {
    alert("OCR機能を読み込めませんでした。通信状態を確認して再読み込みしてください。");
    appendSystemWorkLog("SNS画像OCR", "blocked", "OCRライブラリを読み込めませんでした。", "通信状態とCDN接続を確認する");
    return;
  }

  const button = document.getElementById("run-ocr-button");
  const status = document.getElementById("ocr-status");
  button.disabled = true;
  status.classList.add("is-active");
  status.textContent = "OCR準備中...";
  try {
    const result = await window.Tesseract.recognize(dataUrl, "jpn+eng", {
      logger(message) {
        if (message.status === "recognizing text") {
          status.textContent = `OCR解析中 ${Math.round((message.progress || 0) * 100)}%`;
        }
      }
    });
    const text = String(result?.data?.text || "").trim();
    setFormValue("evidence-ocr-text", text);
    status.textContent = text ? `OCR完了 ${text.length}文字。場所候補を確認中...` : "文字を認識できませんでした";
    screenshotState.relativeTime = text
      ? deriveObservedAtFromRelativeText(text, getFormValue("evidence-checked-at") || nowLocalInput())
      : null;
    if (screenshotState.relativeTime) {
      setFormValue("evidence-observed-at", screenshotState.relativeTime.observedAt);
    }
    if (screenshotState.locationCandidate?.source !== "image-exif") {
      screenshotState.locationCandidate = text ? await suggestLocationFromOcr(text) : null;
    }
    if (text) {
      const messages = [`OCR完了 ${text.length}文字`];
      if (screenshotState.relativeTime) {
        messages.push(`${screenshotState.relativeTime.label}から投稿時刻を逆算`);
      }
      if (screenshotState.locationCandidate) messages.push(`場所候補: ${screenshotState.locationCandidate.title}`);
      else messages.push("場所は未特定");
      status.textContent = messages.join(" / ");
    }
    renderEvidenceDuplicateWarning();
  } catch (error) {
    status.textContent = "OCRに失敗しました。切り出し範囲を調整して再実行してください。";
    appendSystemWorkLog("SNS画像OCR", "testing", `OCRに失敗しました: ${error?.message || "不明なエラー"}`, "投稿本文だけを囲んで再実行し、難しい場合は本文を手入力する");
  } finally {
    button.disabled = false;
    status.classList.remove("is-active");
  }
}

function getCroppedEvidenceDataUrl() {
  if (!screenshotState.image || !screenshotState.crop) return "";
  const crop = screenshotState.crop;
  const scale = screenshotState.scale || 1;
  const sourceX = Math.round(crop.x / scale);
  const sourceY = Math.round(crop.y / scale);
  const sourceW = Math.round(crop.w / scale);
  const sourceH = Math.round(crop.h / scale);
  const maxOutputWidth = 1200;
  const outputScale = Math.min(maxOutputWidth / sourceW, 1);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(sourceW * outputScale));
  output.height = Math.max(1, Math.round(sourceH * outputScale));
  output.getContext("2d").drawImage(
    screenshotState.image,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    0,
    0,
    output.width,
    output.height
  );
  return output.toDataURL("image/jpeg", 0.84);
}

function downloadCrop() {
  const dataUrl = getCroppedEvidenceDataUrl();
  if (!dataUrl) {
    alert("スクリーンショットを読み込んでください。");
    return;
  }
  downloadDataUrl(dataUrl, `sns-evidence-${dateStamp()}.jpg`);
}

function saveScreenshotEvidence(event) {
  event.preventDefault();
  const dataUrl = getCroppedEvidenceDataUrl();
  if (!dataUrl) {
    alert("スクリーンショットを読み込んでください。");
    return;
  }
  const platform = getFormValue("evidence-platform");
  const query = getFormValue("evidence-query");
  const operator = getFormValue("evidence-operator");
  const checkedAt = getFormValue("evidence-checked-at");
  const ocrText = getFormValue("evidence-ocr-text");
  const locationCandidate = screenshotState.locationCandidate;
  const autoGpsRecordId = screenshotState.autoGpsRecordId;
  const record = {
    id: autoGpsRecordId || `rec-${Date.now()}`,
    title: ocrText ? truncateText(ocrText, 72) : `${platformLabels[platform] || "検索"}証跡: ${query || "検索結果"}`,
    category: inferCategory(ocrText),
    locationName: locationCandidate?.title || "場所未特定",
    lat: locationCandidate?.lat ?? null,
    lng: locationCandidate?.lng ?? null,
    locationStatus: locationCandidate?.autoPin ? "pinned" : locationCandidate ? "identified" : "unknown",
    observedAt: getFormValue("evidence-observed-at"),
    incidentDate: getFormValue("incident-date"),
    sourceType: platform === "web" ? "web" : "sns",
    sourceUrl: getFormValue("evidence-url"),
    status: "unconfirmed",
    severity: "medium",
    passability: inferPassability(ocrText),
    passabilityMode: "unknown",
    passabilityCheckedAt: getFormValue("evidence-observed-at") || checkedAt,
    photoStatus: "has-photo",
    photoUrl: "ローカルスクショ証跡",
    photoPrivacy: "internal",
    assignedTo: locationCandidate?.autoPin ? "画像GPS位置確認待ち" : locationCandidate ? "ピン位置確認待ち" : "場所確認待ち",
    notes: getFormValue("evidence-notes") || "スクリーンショットから登録。投稿者へ撮影場所を確認後、地図へピンを設定する。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: query,
    evidenceOperator: operator,
    evidenceCheckedAt: checkedAt,
    evidenceRelativeTime: screenshotState.relativeTime?.label || "",
    observedAtDerived: Boolean(screenshotState.relativeTime),
    sourceText: ocrText,
    sourceComments: "",
    evidenceOcrText: ocrText,
    evidenceImage: dataUrl,
    publicationStatus: "internal",
    publicLocationPrecision: "hidden",
    locationCandidateSource: locationCandidate?.source || "",
    locationCandidateConfidence: locationCandidate?.confidence ?? null,
    locationCandidateQuery: locationCandidate?.query || "",
    locationCandidateReason: locationCandidate?.reason || "",
    locationCandidateOutsideArea: Boolean(locationCandidate?.outsideInzai),
    locationSearchCheckedAt: locationCandidate ? nowLocalInput() : ""
  };
  const duplicates = detectDuplicates(record, autoGpsRecordId || "");
  if (duplicates.length && !confirmDuplicateRegistration(duplicates)) return;
  saveOperator(operator);
  records = autoGpsRecordId && records.some(item => item.id === autoGpsRecordId)
    ? records.map(item => item.id === autoGpsRecordId ? record : item)
    : [...records, record];
  selectedId = record.id;
  persistRecords();
  document.getElementById("screenshot-dialog").close();
  logSearch({ platform, query, operator, checkedAt, method: "screenshot", resultCount: 1 });
  clearScreenshot();
  renderAll();
  document.getElementById("map-status").textContent = locationCandidate?.autoPin
    ? "元画像のGPS緯度経度でピン留めし、スクリーンショット証跡を登録しました。公開前に位置と内容を確認してください。"
    : "スクリーンショットを登録しました。場所が不明な場合は、元投稿から投稿者へ確認できます。";
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function normalizeImportedRow(row) {
  let lat = parseOptionalNumber(row.lat || row.latitude || row["緯度"]);
  let lng = parseOptionalNumber(row.lng || row.lon || row.longitude || row["経度"]);
  const roadGeometry = parseRoadGeometry(row.roadGeometry || row.road_geometry || row["道路区間"]);
  const roadCenter = roadGeometry ? roadGeometryCenter(roadGeometry) : null;
  if (roadCenter) {
    lat = roadCenter.lat;
    lng = roadCenter.lng;
  }
  if (!row.title || ((lat === null) !== (lng === null))) return null;
  return {
    id: row.id || `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: row.title,
    category: row.category || "other",
    locationName: row.locationName || row.location || row["場所"] || "",
    lat,
    lng,
    locationStatus: row.locationStatus || (lat === null ? "unknown" : "pinned"),
    locationAskedAt: row.locationAskedAt || "",
    locationAskedBy: row.locationAskedBy || "",
    locationContactMethod: row.locationContactMethod || "",
    locationAnsweredAt: row.locationAnsweredAt || "",
    locationAnswerNote: row.locationAnswerNote || "",
    observedAt: row.observedAt || row.time || "",
    incidentDate: row.incidentDate || extractLocalDate(row.observedAt || row.time || row.evidenceCheckedAt || ""),
    sourceType: row.sourceType || "web",
    sourceUrl: row.sourceUrl || "",
    status: row.status || "unconfirmed",
    severity: row.severity || "medium",
    passability: row.passability || (row.category === "traffic" ? "closed" : "none"),
    passabilityMode: row.passabilityMode || "unknown",
    passabilityCheckedAt: row.passabilityCheckedAt || row.observedAt || row.time || "",
    roadDirection: row.roadDirection || "unknown",
    roadGeometry: roadGeometry || [],
    photoStatus: row.photoStatus || "needs-photo",
    photoUrl: row.photoUrl || "",
    photoPrivacy: row.photoPrivacy || "internal",
    assignedTo: row.assignedTo || "",
    notes: row.notes || "",
    evidencePlatform: row.evidencePlatform || "",
    evidenceQuery: row.evidenceQuery || "",
    evidenceOperator: row.evidenceOperator || "",
    evidenceCheckedAt: row.evidenceCheckedAt || "",
    evidenceRelativeTime: row.evidenceRelativeTime || "",
    observedAtDerived: toBool(row.observedAtDerived),
    sourceText: row.sourceText || row.postText || "",
    sourceComments: row.sourceComments || row.comments || "",
    evidenceOcrText: row.evidenceOcrText || "",
    externalId: row.externalId || "",
    sourceUsername: row.sourceUsername || "",
    publicationStatus: row.publicationStatus || "internal",
    publicLocationPrecision: row.publicLocationPrecision || "hidden",
    locationCandidateSource: row.locationCandidateSource || "",
    locationCandidateConfidence: parseOptionalNumber(row.locationCandidateConfidence),
    locationCandidateQuery: row.locationCandidateQuery || "",
    locationCandidateReason: row.locationCandidateReason || "",
    locationCandidateOutsideArea: toBool(row.locationCandidateOutsideArea),
    locationSearchCheckedAt: row.locationSearchCheckedAt || "",
    evidenceImage: "",
    hazardFlags: {
      flood: toBool(row.hazardFlood),
      inland: toBool(row.hazardInland),
      road: toBool(row.hazardRoad),
      landslide: toBool(row.hazardLandslide)
    }
  };
}

function copyCsvTemplate() {
  const template = "title,category,locationName,lat,lng,roadGeometry,roadDirection,incidentDate,locationStatus,locationAskedAt,locationAskedBy,locationContactMethod,locationAnsweredAt,locationAnswerNote,observedAt,sourceType,sourceUrl,status,severity,passability,passabilityMode,passabilityCheckedAt,photoStatus,photoUrl,photoPrivacy,publicationStatus,publicLocationPrecision,hazardFlood,hazardInland,hazardRoad,hazardLandslide,assignedTo,evidencePlatform,evidenceQuery,evidenceOperator,evidenceCheckedAt,evidenceRelativeTime,observedAtDerived,sourceText,sourceComments,locationCandidateSource,locationCandidateConfidence,locationCandidateQuery,locationCandidateReason,locationCandidateOutsideArea,locationSearchCheckedAt,externalId,sourceUsername,notes\n";
  navigator.clipboard?.writeText(template);
  document.getElementById("csv-input").value = template;
}

function exportCsv() {
  const headers = [
    "id", "title", "category", "locationName", "lat", "lng", "roadGeometry", "roadDirection", "incidentDate", "locationStatus", "locationAskedAt", "locationAskedBy", "locationContactMethod", "locationAnsweredAt", "locationAnswerNote", "observedAt", "sourceType",
    "sourceUrl", "status", "severity", "passability", "passabilityMode", "passabilityCheckedAt", "photoStatus", "photoUrl", "photoPrivacy", "publicationStatus", "publicLocationPrecision",
    "hazardFlood", "hazardInland", "hazardRoad", "hazardLandslide", "assignedTo", "evidencePlatform", "evidenceQuery",
    "evidenceOperator", "evidenceCheckedAt", "evidenceRelativeTime", "observedAtDerived", "sourceText", "sourceComments", "evidenceOcrText",
    "locationCandidateSource", "locationCandidateConfidence", "locationCandidateQuery", "locationCandidateReason", "locationCandidateOutsideArea", "locationSearchCheckedAt",
    "externalId", "sourceUsername", "evidenceHasImage", "notes"
  ];
  const rows = records.map(record => headers.map(key => {
    if (key.startsWith("hazard")) {
      const flag = key.replace("hazard", "").toLowerCase();
      const normalized = flag === "flood" ? "flood" : flag === "inland" ? "inland" : flag === "road" ? "road" : "landslide";
      return csvCell(record.hazardFlags?.[normalized] ? "true" : "false");
    }
    if (key === "evidenceHasImage") return csvCell(record.evidenceImage ? "true" : "false");
    if (key === "roadGeometry") return csvCell(JSON.stringify(getRoadGeometry(record) || []));
    return csvCell(record[key] ?? "");
  }).join(","));
  downloadText(`inzai-disaster-records-${dateStamp()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
}

function exportGeoJson() {
  const geojson = {
    type: "FeatureCollection",
    name: "inzai_disaster_records",
    features: records.map(record => ({
      type: "Feature",
      geometry: getRoadGeometry(record) ? {
        type: "LineString",
        coordinates: getRoadGeometry(record).map(point => [point[1], point[0]])
      } : hasCoordinates(record) ? {
          type: "Point",
          coordinates: [Number(record.lng), Number(record.lat)]
        } : null,
      properties: {
        ...withoutLargeImage(record),
        alignment: deriveAlignment(record),
        riskHits: getRiskHits(record).join(", ")
      }
    }))
  };
  downloadText(`inzai-disaster-records-${dateStamp()}.geojson`, JSON.stringify(geojson, null, 2), "application/geo+json");
}

function withoutLargeImage(record) {
  const copy = { ...record };
  copy.evidenceHasImage = Boolean(copy.evidenceImage);
  delete copy.evidenceImage;
  return copy;
}

function loadDemoRecords() {
  if (records.some(record => record.id.startsWith("demo-"))) {
    alert("サンプルはすでに表示されています。");
    return;
  }
  records = [...records, ...demoRecords];
  selectedId = demoRecords[0].id;
  persistRecords();
  renderAll();
}

function clearFilters() {
  document.getElementById("keyword-filter").value = "";
  document.getElementById("photo-filter").value = "all";
  document.getElementById("passability-filter").value = "all";
  document.querySelectorAll("[data-status]").forEach(input => {
    input.checked = true;
  });
  renderAll();
}

function getFilteredRecords() {
  const keyword = document.getElementById("keyword-filter").value.trim().toLowerCase();
  const photoFilter = document.getElementById("photo-filter").value;
  const passabilityFilter = document.getElementById("passability-filter").value;
  const activeStatuses = new Set(
    Array.from(document.querySelectorAll("[data-status]"))
      .filter(input => input.checked)
      .map(input => input.dataset.status)
  );

  return records.filter(record => {
    if (PUBLIC_VIEW && record.publicationStatus !== "published") return false;
    if (!matchesIncidentDate(record)) return false;
    if (!activeStatuses.has(record.status)) return false;
    if (photoFilter !== "all" && record.photoStatus !== photoFilter) return false;
    if (!matchesPassabilityFilter(record, passabilityFilter)) return false;
    if (!keyword) return true;
    const haystack = [
      record.title,
      record.locationName,
      record.notes,
      record.assignedTo,
      record.evidenceOperator,
      record.sourceText,
      record.sourceComments,
      record.evidenceOcrText,
      record.sourceUsername,
      record.sourceUrl,
      categoryLabels[record.category],
      passabilityLabels[getPassability(record)],
      passabilityModeLabels[record.passabilityMode],
      sourceLabels[record.sourceType]
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
}

function matchesIncidentDate(record) {
  if (document.getElementById("show-all-dates").checked) return true;
  const target = getFormValue("incident-date");
  if (!target) return true;
  return getRecordIncidentDate(record) === target;
}

function getRecordIncidentDate(record) {
  return extractLocalDate(record?.observedAt) ||
    String(record?.incidentDate || "") ||
    extractLocalDate(record?.evidenceCheckedAt) ||
    extractLocalDate(record?.passabilityCheckedAt) ||
    extractLocalDate(record?.locationAskedAt);
}

function extractLocalDate(value) {
  const text = String(value || "");
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getPassability(record) {
  if (record?.passability && passabilityLabels[record.passability]) return record.passability;
  return record?.category === "traffic" ? "closed" : "none";
}

function matchesPassabilityFilter(record, filter) {
  if (filter === "all") return true;
  const passability = getPassability(record);
  if (filter === "blocked") return passability === "closed" || passability === "impassable";
  return passability === filter;
}

function renderRecordDuplicateWarning() {
  const node = document.getElementById("record-duplicate-warning");
  const id = getFormValue("record-id");
  const candidate = {
    id,
    title: getFormValue("record-title"),
    locationName: getFormValue("record-location"),
    lat: parseOptionalNumber(getFormValue("record-lat")),
    lng: parseOptionalNumber(getFormValue("record-lng")),
    observedAt: getFormValue("record-observed-at"),
    sourceUrl: getFormValue("record-source-url")
  };
  renderDuplicateWarning(node, detectDuplicates(candidate, id));
}

function renderEvidenceDuplicateWarning() {
  const node = document.getElementById("evidence-duplicate-warning");
  const platform = getFormValue("evidence-platform");
  const query = getFormValue("evidence-query");
  const ocrText = getFormValue("evidence-ocr-text");
  const candidate = {
    title: `${platformLabels[platform] || platform}証跡: ${query || "検索結果"}`,
    sourceUrl: getFormValue("evidence-url"),
    observedAt: getFormValue("evidence-observed-at") || getFormValue("evidence-checked-at"),
    evidencePlatform: platform,
    evidenceQuery: query,
    evidenceOcrText: ocrText
  };
  renderDuplicateWarning(node, detectDuplicates(candidate));
}

function renderDuplicateWarning(node, duplicates) {
  if (!node) return;
  if (!duplicates.length) {
    node.hidden = true;
    node.innerHTML = "";
    return;
  }
  node.hidden = false;
  node.innerHTML = `
    <strong>重複候補 ${duplicates.length}件</strong>
    ${duplicates.slice(0, 3).map(item => `${escapeHtml(item.record.title)}（${escapeHtml(item.reason)}）`).join("<br>")}
  `;
}

function detectDuplicates(candidate, excludeId = "") {
  if (!candidate) return [];
  const candidateUrl = canonicalUrl(candidate.sourceUrl);
  const candidateText = normalizeForMatch(candidate.evidenceOcrText || candidate.sourceText || candidate.title);
  const candidateTime = parseTime(candidate.observedAt || candidate.evidenceCheckedAt);
  const matches = [];

  records.forEach(record => {
    if (record.id === excludeId) return;
    let reason = "";
    if (candidate.externalId && record.externalId && candidate.externalId === record.externalId) {
      reason = "投稿IDが一致";
    } else if (candidateUrl && candidateUrl === canonicalUrl(record.sourceUrl)) {
      reason = "根拠URLが一致";
    } else if (
      candidate.evidencePlatform &&
      candidate.evidenceQuery &&
      candidate.evidencePlatform === record.evidencePlatform &&
      normalizeForMatch(candidate.evidenceQuery) === normalizeForMatch(record.evidenceQuery) &&
      isWithinHours(candidateTime, parseTime(record.observedAt || record.evidenceCheckedAt), 24)
    ) {
      reason = "同じ検索語・24時間以内";
    } else if (
      candidateText.length >= 8 &&
      textSimilarity(candidateText, normalizeForMatch(record.evidenceOcrText || record.sourceText || record.title)) >= 0.72 &&
      isWithinHours(candidateTime, parseTime(record.observedAt || record.evidenceCheckedAt), 48)
    ) {
      reason = "本文・OCRが類似";
    } else if (
      Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng) &&
      Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng)) &&
      distanceMeters(candidate.lat, candidate.lng, Number(record.lat), Number(record.lng)) <= 150 &&
      textSimilarity(normalizeForMatch(candidate.title), normalizeForMatch(record.title)) >= 0.55 &&
      isWithinHours(candidateTime, parseTime(record.observedAt), 24)
    ) {
      reason = "近接地点・類似件名";
    }
    if (reason) matches.push({ record, reason });
  });
  return matches;
}

function confirmDuplicateRegistration(duplicates) {
  const summary = duplicates.slice(0, 3).map(item => `・${item.record.title}（${item.reason}）`).join("\n");
  return confirm(`重複候補が見つかりました。別情報として登録しますか。\n\n${summary}`);
}

function canonicalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "igshid"].forEach(key => url.searchParams.delete(key));
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return text.replace(/\/$/, "").toLowerCase();
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .slice(0, 500);
}

function textSimilarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftSet = bigrams(left);
  const rightSet = bigrams(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let intersection = 0;
  leftSet.forEach(value => {
    if (rightSet.has(value)) intersection += 1;
  });
  return intersection / (leftSet.size + rightSet.size - intersection);
}

function bigrams(value) {
  const set = new Set();
  for (let index = 0; index < value.length - 1; index += 1) set.add(value.slice(index, index + 2));
  return set;
}

function parseTime(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isWithinHours(left, right, hours) {
  if (left === null || right === null) return false;
  return Math.abs(left - right) <= hours * 60 * 60 * 1000;
}

function parseOptionalNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function hasCoordinates(record) {
  return record?.lat !== null && record?.lat !== "" && record?.lat !== undefined &&
    record?.lng !== null && record?.lng !== "" && record?.lng !== undefined &&
    Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lng));
}

function parseRoadGeometry(value) {
  let source = value;
  if (typeof source === "string") {
    const text = source.trim();
    if (!text) return null;
    try {
      source = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(source)) return null;
  const points = source
    .map(point => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : null)
    .filter(point => point && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180);
  return points.length >= 2 ? points : null;
}

function getRoadGeometry(record) {
  return parseRoadGeometry(record?.roadGeometry);
}

function getDisplayRoadGeometry(record) {
  const geometry = getRoadGeometry(record);
  if (!geometry) return null;
  if (!PUBLIC_VIEW) return geometry;
  const precision = record.publicLocationPrecision || "hidden";
  if (precision === "hidden") return null;
  if (precision === "approximate") {
    return geometry.map(point => [Number(point[0].toFixed(3)), Number(point[1].toFixed(3))]);
  }
  return geometry;
}

function roadGeometryCenter(geometry) {
  const points = parseRoadGeometry(geometry);
  if (!points) return null;
  const center = L.latLngBounds(points).getCenter();
  return { lat: center.lat, lng: center.lng };
}

function formatRoadDistance(geometry) {
  const points = parseRoadGeometry(geometry);
  if (!points) return "距離未設定";
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    meters += distanceMeters(points[index - 1][0], points[index - 1][1], points[index][0], points[index][1]);
  }
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.max(1, Math.round(meters))}m`;
}

function getDisplayCoordinates(record) {
  if (!hasCoordinates(record)) return null;
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!PUBLIC_VIEW) return { lat, lng };
  const precision = record.publicLocationPrecision || "hidden";
  if (precision === "hidden") return null;
  if (precision === "approximate") {
    return { lat: Number(lat.toFixed(3)), lng: Number(lng.toFixed(3)) };
  }
  return { lat, lng };
}

function getLocationStatus(record) {
  if (record?.locationStatus && locationStatusLabels[record.locationStatus]) return record.locationStatus;
  return hasCoordinates(record) || getRoadGeometry(record) ? "pinned" : "unknown";
}

function locationStatusDisplayLabel(record) {
  const status = getLocationStatus(record);
  if (status === "pinned" && getRoadGeometry(record)) return "道路区間設定済";
  return locationStatusLabels[status] || status;
}

function deriveAlignment(record) {
  if (record.status === "resolved") return "resolved";
  const riskHits = getRiskHits(record);
  const hasReliableSignal = ["official", "staff", "citizen", "news"].includes(record.sourceType) || ["corroborated", "verified", "actioning"].includes(record.status);
  if (riskHits.length && ["verified", "actioning", "corroborated", "unconfirmed"].includes(record.status)) return "expected";
  if (!riskHits.length && hasReliableSignal) return "unexpected";
  if (!riskHits.length && record.sourceType === "sns") return "uncertain";
  return riskHits.length ? "highRisk" : "uncertain";
}

function getRiskHits(record) {
  const hits = [];
  if (record.hazardFlags?.flood) hits.push("洪水");
  if (record.hazardFlags?.inland) hits.push("内水");
  if (record.hazardFlags?.landslide) hits.push("土砂");
  const nearRoad = hasCoordinates(record) && roadFloodSites.some(site => distanceMeters(record.lat, record.lng, site.lat, site.lng) <= 220);
  if (record.hazardFlags?.road || nearRoad) hits.push("道路冠水注意箇所");
  return [...new Set(hits)];
}

function markerColor(record, alignment) {
  const passability = getPassability(record);
  if (passability === "closed" || passability === "impassable") return "#b8322c";
  if (passability === "restricted") return "#c96321";
  if (passability === "reopened") return "#24745a";
  if (passability === "passed") return "#2365a8";
  if (record.status === "resolved") return "#6b737a";
  if (record.status === "verified" || record.status === "actioning") return "#b8322c";
  if (record.status === "corroborated") return "#c96321";
  if (alignment === "highRisk") return "#2365a8";
  if (alignment === "unexpected") return "#7050a8";
  return "#a77708";
}

function badgeColor(status) {
  if (status === "verified" || status === "actioning") return "red";
  if (status === "corroborated") return "orange";
  if (status === "resolved") return "green";
  return "yellow";
}

function alignmentColor(alignment) {
  if (alignment === "expected") return "blue";
  if (alignment === "unexpected") return "purple";
  if (alignment === "highRisk") return "blue";
  if (alignment === "resolved") return "green";
  return "yellow";
}

function photoBadgeColor(status) {
  if (status === "official-verified") return "green";
  if (status === "has-photo") return "blue";
  if (status === "unavailable") return "purple";
  return "yellow";
}

function passabilityBadgeColor(passability) {
  if (passability === "closed" || passability === "impassable") return "red";
  if (passability === "restricted") return "orange";
  if (passability === "reopened") return "green";
  if (passability === "passed") return "blue";
  return "yellow";
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const toRad = value => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    notifyHost();
    queueSharedRecordsSync();
  } catch {
    alert("ブラウザのローカル保存容量を超えました。証跡画像を切り出しDLしてから、画像なしでCSV/GeoJSON管理してください。");
  }
}

function queueSharedRecordsSync() {
  const endpoint = String(APP_CONFIG.sharedRecordsEndpoint || "").trim();
  const permissions = window.CBIDisasterOperator?.permissions || {};
  if (!endpoint || !(permissions.canEdit || permissions.canCreate)) return;
  clearTimeout(sharedRecordsSyncTimer);
  sharedRecordsSyncTimer = setTimeout(async () => {
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appVersion: APP_CONFIG.appVersion || "", records })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      document.getElementById("map-status").textContent = "共有台帳へ保存しました。";
    } catch (error) {
      document.getElementById("map-status").textContent = `端末には保存しましたが、共有台帳へ送信できませんでした（${error?.message || "接続エラー"}）。`;
      appendSystemWorkLog("自主防災組織 共有台帳", "blocked", "共有台帳への保存に失敗しました。", "認証状態とCBI連携APIを確認する");
    }
  }, 600);
}

function appendSystemWorkLog(feature, status, summary, nextAction) {
  try {
    const current = JSON.parse(localStorage.getItem(WORK_LOG_KEY) || "[]");
    const now = new Date();
    const duplicate = current.some(item =>
      item.feature === feature &&
      item.summary === summary &&
      now.getTime() - new Date(item.loggedAt).getTime() < 30 * 60 * 1000
    );
    if (duplicate) return;
    current.unshift({
      id: `work-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      feature,
      status,
      owner: "",
      loggedAt: now.toISOString(),
      summary,
      nextAction,
      referenceUrl: "",
      origin: "system"
    });
    localStorage.setItem(WORK_LOG_KEY, JSON.stringify(current.slice(0, 500)));
  } catch {}
}

function notifyHost() {
  if (window.parent === window) return;
  const targetOrigin = String(APP_CONFIG.hostOrigin || window.location.origin);
  window.parent.postMessage({
    type: "cbi:disaster-map:records-changed",
    count: records.length,
    selectedId,
    updatedAt: new Date().toISOString()
  }, targetOrigin);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  const headers = rows.shift()?.map(value => value.trim()) || [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function nowLocalInput() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function incidentDateTimeInput() {
  const now = nowLocalInput();
  const incidentDate = getFormValue("incident-date");
  return incidentDate ? `${incidentDate}${now.slice(10)}` : now;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatDateTime(value) {
  if (!value) return "-";
  return value.replace("T", " ");
}

function setFormValue(id, value) {
  document.getElementById(id).value = value ?? "";
}

function getFormValue(id) {
  return document.getElementById(id).value.trim();
}

function toBool(value) {
  return ["true", "1", "yes", "y", "該当", "あり"].includes(String(value || "").trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
