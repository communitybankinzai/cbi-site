const INZAI_BOUNDS = L.latLngBounds([35.735, 140.055], [35.875, 140.245]);
const STORAGE_KEY = "inzai-disaster-records-v1";
const SEARCH_LOG_KEY = "inzai-disaster-search-log-v1";
const WORK_LOG_KEY = "inzai-disaster-work-log-v1";
const OPERATOR_KEY = "inzai-disaster-operator-v1";
const GUIDE_SEEN_KEY = "inzai-disaster-guide-seen-v1";
const SOURCE_CHECKED_AT = "2026-08-15";
const APP_CONFIG = window.CBI_DISASTER_CONFIG || {};

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
let locationPickRecordId = null;
let locationContactRecordId = null;
let apiResultItems = [];
let screenshotState = {
  image: null,
  scale: 1,
  crop: null,
  dragging: false,
  start: null,
  locationCandidate: null,
  relativeTime: null
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

const rainNowcastLayer = L.tileLayer("", {
  attribution: "気象庁 高解像度降水ナウキャスト",
  opacity: 0.62,
  maxNativeZoom: 10,
  maxZoom: 18,
  zIndex: 450,
  updateWhenIdle: true
});
let rainNowcastTime = null;

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
boundaryLayer.addTo(map);

initBoundary();
refreshRainNowcast(false);
renderRoadFloodSites();
initIntegration();
renderAll();
bindEvents();
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
    landslideGroup.eachLayer(layer => layer.setOpacity(opacity));
    rainNowcastLayer.setOpacity(opacity);
  });

  document.getElementById("reset-view-button").addEventListener("click", () => map.fitBounds(INZAI_BOUNDS));
  document.getElementById("incident-date").addEventListener("change", () => {
    selectedId = null;
    renderAll();
  });
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

  map.on("click", event => {
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

  const endpoint = String(APP_CONFIG.snsSearchEndpoint || "").trim();
  const apiStatus = document.getElementById("api-status");
  const apiButton = document.getElementById("api-search-button");
  const apiNote = document.getElementById("collector-api-note");
  if (endpoint) {
    apiStatus.textContent = "SNS API接続設定済み";
    apiStatus.classList.add("is-connected");
    apiButton.disabled = false;
    apiNote.textContent = "CBI連携APIを通じて検索します。Metaのアクセストークンはこの画面には保存しません。";
  } else {
    apiStatus.textContent = "試作・端末内保存";
    apiButton.disabled = true;
    apiButton.title = "config.js にCBI連携APIを設定すると利用できます";
    apiNote.textContent = "現在は検索画面・スクショ・JSON取込を利用できます。公式API接続時は config.js の snsSearchEndpoint にCBI側の連携先を設定します。";
  }

  window.CBIDisasterMap = {
    version: APP_CONFIG.appVersion || "",
    getRecords: () => records.map(withoutLargeImage),
    getSearchLog: () => searchLog.map(item => ({ ...item })),
    importSnsPayload: (payload, platform = "web") => consumeSnsPayload(payload, platform, "host")
  };
}

function initHelpGuide() {
  try {
    if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
      localStorage.setItem(GUIDE_SEEN_KEY, "true");
      document.getElementById("help-dialog").showModal();
    }
  } catch {}
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
  setFormValue("collector-post-time", "");
  setFormValue("collector-location-note", "");
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
    locationName: locationNote || "場所未特定",
    lat: null,
    lng: null,
    locationStatus: "unknown",
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
    assignedTo: "場所確認待ち",
    notes: locationNote
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
    evidenceOcrText: "",
    evidenceImage: "",
    externalId: metadata.externalId,
    sourceUsername: metadata.sourceUsername
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
    return "web";
  } catch {
    return "";
  }
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
    locationName: String(item.locationName || item.location_name || coordinates.name || ""),
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

function addApiResultAsRecord(item) {
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
    locationStatus: apiHasLocation ? "identified" : "unknown",
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
    assignedTo: apiHasLocation ? "ピン位置確認待ち" : "場所確認待ち",
    notes: "公式APIまたは連携JSONから登録。位置・内容・写真の真正性は未確認。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: item.platform,
    evidenceQuery: getFormValue("collector-query"),
    evidenceOperator: operator,
    evidenceCheckedAt: nowLocalInput(),
    sourceText: item.text,
    evidenceOcrText: item.text,
    evidenceImage: "",
    externalId: item.externalId,
    sourceUsername: item.username
  };
  records = [...records, record];
  selectedId = record.id;
  persistRecords();
  renderAll();
  renderApiResults();
  document.getElementById("sns-collector-dialog").close();
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
  const source = String(text || "").normalize("NFKC");
  const knownPlaces = [
    "千葉ニュータウン中央駅", "千葉ニュータウン中央", "印西牧の原駅", "印西牧の原",
    "印旛日本医大駅", "印旛日本医大", "木下駅", "木下", "小林駅", "小林",
    "六軒", "大森", "草深", "船尾", "師戸", "岩戸", "瀬戸", "平賀"
  ];
  const queries = [];
  const addressMatches = source.match(/印西市[一-龯々ヶケぁ-んァ-ヶー0-9\-]{2,28}/g) || [];
  addressMatches.slice(0, 2).forEach(value => queries.push(`千葉県${value}`));
  knownPlaces.filter(place => source.includes(place)).slice(0, 3).forEach(place => queries.push(`千葉県印西市${place}`));

  for (const query of [...new Set(queries)].slice(0, 4)) {
    try {
      const response = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`);
      if (!response.ok) continue;
      const results = await response.json();
      const match = Array.isArray(results) ? results.find(item => {
        const coordinates = item?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
        return INZAI_BOUNDS.contains([Number(coordinates[1]), Number(coordinates[0])]);
      }) : null;
      if (match) {
        return {
          title: String(match.properties?.title || query),
          lat: Number(match.geometry.coordinates[1]),
          lng: Number(match.geometry.coordinates[0]),
          query
        };
      }
    } catch {}
  }
  return null;
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

function toggleOverlay(name, checked) {
  if (name === "rainNowcast") {
    if (checked) refreshRainNowcast(true);
    else map.removeLayer(rainNowcastLayer);
    return;
  }
  const layerMap = {
    boundary: boundaryLayer,
    floodMax: hazardLayers.floodMax,
    floodPlan: hazardLayers.floodPlan,
    inland: hazardLayers.inland,
    landslide: landslideGroup,
    roadFlood: roadFloodLayer,
    records: recordLayer
  };
  const layer = layerMap[name];
  if (!layer) return;
  if (checked) layer.addTo(map);
  else map.removeLayer(layer);
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
    if (!hasCoordinates(record) || getLocationStatus(record) !== "pinned") return;
    const alignment = deriveAlignment(record);
    const marker = L.marker([Number(record.lat), Number(record.lng)], {
      icon: L.divIcon({
        className: "",
        html: `<div class="marker-pin" style="background:${markerColor(record, alignment)}"><span></span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28]
      })
    });
    marker.on("click", () => selectRecord(record.id, true));
    const passability = getPassability(record);
    marker.bindPopup(`
      <div class="popup-title">${escapeHtml(record.title)}</div>
      <div>${escapeHtml(categoryLabels[record.category] || record.category)} / ${escapeHtml(statusLabels[record.status] || record.status)}</div>
      ${passability !== "none" ? `<div class="detail-meta">${escapeHtml(passabilityLabels[passability])} ・ ${escapeHtml(formatDateTime(record.passabilityCheckedAt || record.observedAt))}</div>` : ""}
      <div class="detail-meta">${escapeHtml(alignmentLabels[alignment])} ・ ${escapeHtml(photoLabels[record.photoStatus] || "")}</div>
    `);
    recordLayer.addLayer(marker);
  });
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
      return `
        <article class="record-card ${record.id === selectedId ? "is-selected" : ""}" data-record-id="${record.id}" style="border-left-color:${markerColor(record, alignment)}">
          <h3>${escapeHtml(record.title)}</h3>
          <div class="record-meta">
            <span class="badge ${badgeColor(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
            <span class="badge ${alignmentColor(alignment)}">${escapeHtml(alignmentLabels[alignment])}</span>
            ${passability !== "none" ? `<span class="badge ${passabilityBadgeColor(passability)}">${escapeHtml(passabilityLabels[passability])}</span>` : ""}
            <span>${escapeHtml(categoryLabels[record.category] || record.category)}</span>
            <span>${escapeHtml(record.locationName || "場所名なし")}</span>
            <span class="badge ${getLocationStatus(record) === "pinned" ? "green" : "yellow"}">${escapeHtml(locationStatusLabels[getLocationStatus(record)])}</span>
          </div>
        </article>
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
        <span class="badge yellow">${escapeHtml(locationStatusLabels[getLocationStatus(record)])}</span>
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
  if (!record) {
    detail.innerHTML = "地図または一覧から地点を選択してください。";
    return;
  }
  const alignment = deriveAlignment(record);
  const riskHits = getRiskHits(record);
  const locationStatus = getLocationStatus(record);
  const passability = getPassability(record);
  detail.innerHTML = `
    <div class="detail-title">
      <h3>${escapeHtml(record.title)}</h3>
      <div class="detail-meta">
        <span class="badge ${badgeColor(record.status)}">${escapeHtml(statusLabels[record.status] || record.status)}</span>
        <span class="badge ${alignmentColor(alignment)}">${escapeHtml(alignmentLabels[alignment])}</span>
        <span class="badge ${photoBadgeColor(record.photoStatus)}">${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)}</span>
        <span class="badge ${locationStatus === "pinned" ? "green" : "yellow"}">${escapeHtml(locationStatusLabels[locationStatus])}</span>
        ${passability !== "none" ? `<span class="badge ${passabilityBadgeColor(passability)}">${escapeHtml(passabilityLabels[passability])}</span>` : ""}
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-row"><span>分類</span><span>${escapeHtml(categoryLabels[record.category] || record.category)}</span></div>
      ${passability !== "none" ? `<div class="detail-row"><span>通行状況</span><span>${escapeHtml(passabilityLabels[passability])}</span></div>` : ""}
      ${passability !== "none" ? `<div class="detail-row"><span>対象</span><span>${escapeHtml(passabilityModeLabels[record.passabilityMode] || passabilityModeLabels.unknown)}</span></div>` : ""}
      ${passability !== "none" ? `<div class="detail-row"><span>最終確認</span><span>${escapeHtml(formatDateTime(record.passabilityCheckedAt || record.observedAt))}</span></div>` : ""}
      <div class="detail-row"><span>場所</span><span>${escapeHtml(record.locationName || "-")}</span></div>
      <div class="detail-row"><span>座標</span><span>${hasCoordinates(record) ? `${Number(record.lat).toFixed(6)}, ${Number(record.lng).toFixed(6)}` : "未特定"}</span></div>
      <div class="detail-row"><span>場所確認</span><span>${escapeHtml(locationStatusLabels[locationStatus])}</span></div>
      ${record.locationAskedAt ? `<div class="detail-row"><span>質問日時</span><span>${escapeHtml(formatDateTime(record.locationAskedAt))}</span></div>` : ""}
      ${record.locationContactMethod ? `<div class="detail-row"><span>確認手段</span><span>${escapeHtml(locationContactLabels[record.locationContactMethod] || record.locationContactMethod)}</span></div>` : ""}
      ${record.locationAnsweredAt ? `<div class="detail-row"><span>回答確認</span><span>${escapeHtml(formatDateTime(record.locationAnsweredAt))}</span></div>` : ""}
      ${record.locationAnswerNote ? `<div class="detail-row"><span>場所回答</span><span>${escapeHtml(record.locationAnswerNote)}</span></div>` : ""}
      <div class="detail-row"><span>時刻</span><span>${escapeHtml(formatDateTime(record.observedAt))}${record.observedAtDerived ? `（${escapeHtml(record.evidenceRelativeTime || "相対表記")}から逆算）` : ""}</span></div>
      <div class="detail-row"><span>情報源</span><span>${escapeHtml(sourceLabels[record.sourceType] || record.sourceType)}</span></div>
      ${record.sourceUsername ? `<div class="detail-row"><span>投稿者</span><span>@${escapeHtml(record.sourceUsername)}</span></div>` : ""}
      <div class="detail-row"><span>担当</span><span>${escapeHtml(record.assignedTo || "-")}</span></div>
      ${record.evidenceOperator ? `<div class="detail-row"><span>確認者</span><span>${escapeHtml(record.evidenceOperator)}</span></div>` : ""}
      ${record.evidenceCheckedAt ? `<div class="detail-row"><span>確認時刻</span><span>${escapeHtml(formatDateTime(record.evidenceCheckedAt))}</span></div>` : ""}
      <div class="detail-row"><span>ハザード</span><span>${riskHits.length ? riskHits.map(escapeHtml).join("、") : "該当なし/未判定"}</span></div>
      <div class="detail-row"><span>写真</span><span>${escapeHtml(photoLabels[record.photoStatus] || record.photoStatus)} / ${escapeHtml(record.photoPrivacy || "internal")}</span></div>
      ${record.evidencePlatform ? `<div class="detail-row"><span>証跡</span><span>${escapeHtml(platformLabels[record.evidencePlatform] || record.evidencePlatform)} / ${escapeHtml(record.evidenceQuery || "-")}</span></div>` : ""}
      <div class="detail-row"><span>メモ</span><span>${escapeHtml(record.notes || "-")}</span></div>
    </div>
    ${record.evidenceImage ? `<img class="evidence-preview" src="${record.evidenceImage}" alt="検索画面スクリーンショット切り出し">` : ""}
    ${isHttpUrl(record.photoUrl) && record.photoUrl !== record.evidenceImage ? `<a href="${escapeAttribute(record.photoUrl)}" target="_blank" rel="noreferrer"><img class="evidence-preview" src="${escapeAttribute(record.photoUrl)}" alt="投稿に添付された被害候補写真" loading="lazy"></a>` : ""}
    ${record.sourceText ? `<div class="source-text-block"><strong>投稿本文・要約</strong><p>${escapeHtml(record.sourceText)}</p></div>` : ""}
    ${record.evidenceOcrText ? `<pre class="evidence-ocr">${escapeHtml(record.evidenceOcrText)}</pre>` : ""}
    <div class="detail-actions">
      ${record.sourceUrl && locationStatus !== "pinned" ? `<button class="tool-button primary" type="button" data-action="ask-location">場所を質問（コメント / DM）</button>` : ""}
      ${locationStatus !== "pinned" ? `<button class="tool-button" type="button" data-action="locate">${locationStatus === "identified" ? "場所候補を地図で確認してピン" : "回答後、地図でピンを置く"}</button>` : ""}
      <button class="tool-button" type="button" data-action="edit">編集</button>
      <button class="tool-button" type="button" data-action="verified">確認済</button>
      <button class="tool-button" type="button" data-action="photo">写真確認済</button>
      <button class="tool-button" type="button" data-action="actioning">対応中</button>
      <button class="tool-button" type="button" data-action="resolved">解消済</button>
      ${record.evidenceImage ? `<button class="tool-button" type="button" data-action="download-evidence">証跡画像DL</button>` : ""}
      ${record.sourceUrl ? `<a class="tool-button" href="${escapeAttribute(record.sourceUrl)}" target="_blank" rel="noreferrer">根拠を開く</a>` : ""}
    </div>
  `;
  detail.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => handleDetailAction(button.dataset.action));
  });
}

function selectRecord(id, panTo) {
  selectedId = id;
  const record = records.find(item => item.id === id);
  if (record && panTo && hasCoordinates(record)) {
    map.setView([Number(record.lat), Number(record.lng)], Math.max(map.getZoom(), 15));
  }
  renderAll();
}

function openRoadStatusDialog() {
  openRecordDialog({
    category: "traffic",
    severity: "high",
    sourceType: "citizen",
    passability: "impassable",
    passabilityMode: "all",
    passabilityCheckedAt: nowLocalInput(),
    observedAt: nowLocalInput()
  });
}

function openRecordDialog(seed = {}) {
  const record = seed.id ? records.find(item => item.id === seed.id) : null;
  const dialog = document.getElementById("record-dialog");
  document.getElementById("record-dialog-title").textContent = record
    ? "地点編集"
    : seed.category === "traffic" ? "道路通行情報を追加" : "地点追加";
  document.getElementById("delete-record-button").style.visibility = record ? "visible" : "hidden";

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
    passability: seed.passability || "none",
    passabilityMode: seed.passabilityMode || "unknown",
    passabilityCheckedAt: seed.passabilityCheckedAt || "",
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
  setFormValue("record-photo-status", values.photoStatus);
  setFormValue("record-photo-privacy", values.photoPrivacy);
  setFormValue("record-photo-url", values.photoUrl);
  setFormValue("record-notes", values.notes);
  document.getElementById("hazard-flood").checked = Boolean(values.hazardFlags?.flood);
  document.getElementById("hazard-inland").checked = Boolean(values.hazardFlags?.inland);
  document.getElementById("hazard-road").checked = Boolean(values.hazardFlags?.road);
  document.getElementById("hazard-landslide").checked = Boolean(values.hazardFlags?.landslide);

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
  const record = {
    ...(existingRecord || {}),
    id: existingId || `rec-${Date.now()}`,
    title: getFormValue("record-title"),
    category: getFormValue("record-category"),
    locationName: getFormValue("record-location"),
    lat: latValue,
    lng: lngValue,
    locationStatus: getFormValue("record-location-status"),
    locationContactMethod: getFormValue("record-location-contact-method"),
    locationAnsweredAt: getFormValue("record-location-answered-at"),
    locationAnswerNote: getFormValue("record-location-answer-note"),
    observedAt: getFormValue("record-observed-at"),
    incidentDate: existingRecord?.incidentDate || getFormValue("incident-date"),
    sourceType: getFormValue("record-source-type"),
    sourceUrl: getFormValue("record-source-url"),
    status: getFormValue("record-status"),
    severity: getFormValue("record-severity"),
    passability: getFormValue("record-passability"),
    passabilityMode: getFormValue("record-passability-mode"),
    passabilityCheckedAt: getFormValue("record-passability-checked-at"),
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

  if ((record.lat === null) !== (record.lng === null)) {
    alert("緯度と経度は両方入力するか、両方空欄にしてください。");
    return;
  }
  if (!hasCoordinates(record) && record.locationStatus === "pinned") record.locationStatus = "unknown";

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
  if (action === "locate") {
    startLocationPick(record.id);
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
  const record = records.find(item => item.id === locationContactRecordId);
  if (!record) return;
  const question = method === "dm"
    ? "突然のご連絡失礼します。印西市内の被害状況確認のため、差し支えない範囲で撮影場所（町名・目印）を教えていただけますか。個人宅など詳細住所は不要です。"
    : "印西市内の被害状況確認のため、差し支えない範囲で撮影場所（町名・目印）を教えていただけますか。個人宅など詳細住所は不要です。";
  navigator.clipboard?.writeText(question).catch(() => {});
  const opened = window.open(record.sourceUrl, "_blank");
  if (opened) opened.opener = null;
  record.locationStatus = "asked";
  record.locationContactMethod = method;
  record.locationAskedAt = nowLocalInput();
  record.locationAskedBy = record.evidenceOperator || loadOperator();
  record.assignedTo = record.assignedTo === "場所確認待ち" ? "投稿者へ確認中" : record.assignedTo;
  locationContactRecordId = null;
  document.getElementById("location-contact-dialog").close();
  persistRecords();
  renderAll();
  document.getElementById("map-status").textContent = `${locationContactLabels[method]}用の質問文をコピーしました。元投稿を開いて貼り付けてください。`;
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

function loadScreenshotFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  loadScreenshotBlob(file);
}

function handleScreenshotPaste(event) {
  const imageItem = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
  if (!imageItem) return;
  event.preventDefault();
  loadScreenshotBlob(imageItem.getAsFile());
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
    if (file) loadScreenshotBlob(file);
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

function loadScreenshotBlob(blob) {
  if (!blob) return;
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      screenshotState.image = image;
      screenshotState.crop = null;
      screenshotState.relativeTime = null;
      screenshotState.locationCandidate = null;
      setFormValue("evidence-ocr-text", "");
      drawScreenshotCanvas();
      document.getElementById("ocr-status").textContent = "画像を取得しました。投稿部分をドラッグで囲み、「OCR文字抽出」を押してください。";
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
    relativeTime: null
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
    screenshotState.locationCandidate = text ? await suggestLocationFromOcr(text) : null;
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
  const record = {
    id: `rec-${Date.now()}`,
    title: ocrText ? truncateText(ocrText, 72) : `${platformLabels[platform] || "検索"}証跡: ${query || "検索結果"}`,
    category: inferCategory(ocrText),
    locationName: locationCandidate?.title || "場所未特定",
    lat: locationCandidate?.lat ?? null,
    lng: locationCandidate?.lng ?? null,
    locationStatus: locationCandidate ? "identified" : "unknown",
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
    assignedTo: locationCandidate ? "ピン位置確認待ち" : "場所確認待ち",
    notes: getFormValue("evidence-notes") || "スクリーンショットから登録。投稿者へ撮影場所を確認後、地図へピンを設定する。",
    hazardFlags: { flood: false, inland: false, road: false, landslide: false },
    evidencePlatform: platform,
    evidenceQuery: query,
    evidenceOperator: operator,
    evidenceCheckedAt: checkedAt,
    evidenceRelativeTime: screenshotState.relativeTime?.label || "",
    observedAtDerived: Boolean(screenshotState.relativeTime),
    sourceText: ocrText,
    evidenceOcrText: ocrText,
    evidenceImage: dataUrl
  };
  const duplicates = detectDuplicates(record);
  if (duplicates.length && !confirmDuplicateRegistration(duplicates)) return;
  saveOperator(operator);
  records = [...records, record];
  selectedId = record.id;
  persistRecords();
  document.getElementById("screenshot-dialog").close();
  logSearch({ platform, query, operator, checkedAt, method: "screenshot", resultCount: 1 });
  clearScreenshot();
  renderAll();
  document.getElementById("map-status").textContent = "スクリーンショットを登録しました。場所が不明な場合は、元投稿から投稿者へ確認できます。";
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
  const lat = parseOptionalNumber(row.lat || row.latitude || row["緯度"]);
  const lng = parseOptionalNumber(row.lng || row.lon || row.longitude || row["経度"]);
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
    evidenceOcrText: row.evidenceOcrText || "",
    externalId: row.externalId || "",
    sourceUsername: row.sourceUsername || "",
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
  const template = "title,category,locationName,lat,lng,incidentDate,locationStatus,locationAskedAt,locationAskedBy,locationContactMethod,locationAnsweredAt,locationAnswerNote,observedAt,sourceType,sourceUrl,status,severity,passability,passabilityMode,passabilityCheckedAt,photoStatus,photoUrl,photoPrivacy,hazardFlood,hazardInland,hazardRoad,hazardLandslide,assignedTo,evidencePlatform,evidenceQuery,evidenceOperator,evidenceCheckedAt,evidenceRelativeTime,observedAtDerived,sourceText,externalId,sourceUsername,notes\n";
  navigator.clipboard?.writeText(template);
  document.getElementById("csv-input").value = template;
}

function exportCsv() {
  const headers = [
    "id", "title", "category", "locationName", "lat", "lng", "incidentDate", "locationStatus", "locationAskedAt", "locationAskedBy", "locationContactMethod", "locationAnsweredAt", "locationAnswerNote", "observedAt", "sourceType",
    "sourceUrl", "status", "severity", "passability", "passabilityMode", "passabilityCheckedAt", "photoStatus", "photoUrl", "photoPrivacy",
    "hazardFlood", "hazardInland", "hazardRoad", "hazardLandslide", "assignedTo", "evidencePlatform", "evidenceQuery",
    "evidenceOperator", "evidenceCheckedAt", "evidenceRelativeTime", "observedAtDerived", "sourceText", "evidenceOcrText", "externalId", "sourceUsername", "evidenceHasImage", "notes"
  ];
  const rows = records.map(record => headers.map(key => {
    if (key.startsWith("hazard")) {
      const flag = key.replace("hazard", "").toLowerCase();
      const normalized = flag === "flood" ? "flood" : flag === "inland" ? "inland" : flag === "road" ? "road" : "landslide";
      return csvCell(record.hazardFlags?.[normalized] ? "true" : "false");
    }
    if (key === "evidenceHasImage") return csvCell(record.evidenceImage ? "true" : "false");
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
      geometry: hasCoordinates(record) ? {
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

function getLocationStatus(record) {
  if (record?.locationStatus && locationStatusLabels[record.locationStatus]) return record.locationStatus;
  return hasCoordinates(record) ? "pinned" : "unknown";
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
  if (record.status === "resolved") return "#6b737a";
  const passability = getPassability(record);
  if (passability === "closed" || passability === "impassable") return "#b8322c";
  if (passability === "restricted") return "#c96321";
  if (passability === "reopened") return "#24745a";
  if (passability === "passed") return "#2365a8";
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
  } catch {
    alert("ブラウザのローカル保存容量を超えました。証跡画像を切り出しDLしてから、画像なしでCSV/GeoJSON管理してください。");
  }
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
