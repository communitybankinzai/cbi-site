// 印西 食レポマップ（2026-11-06）
// お店＝OpenStreetMap（osm-shops.json）＋市民が足したお店＋FreeFree掲示板の飲食の掲載。
// 市民が SNS の食レポの URL を貼ると、そのお店のピンに並ぶ。写真は「自分の投稿」のときだけ1枚。
// 保存・検査は CiDAO の /api/gourmet/reports（匿名・すぐ公開・運営が伏せる）。
"use strict";

const API = "https://cidao.vercel.app/api/gourmet/reports";
const FREEFREE_API = "https://cidao.vercel.app/api/metaverse-shops";
const OSM_URL = "osm-shops.json";
const DEVICE_KEY = "cbi-gourmet-device-v1";
const OWN_KEY = "cbi-gourmet-own-v1"; // 自分が貼った食レポ（取り消し用・30分）
const MODERATION_KEY_STORAGE = "cbi-disaster-moderation-key-v1"; // 防災MAPと同じ合言葉を使う
const UNDO_MS = 30 * 60 * 1000;
const PHOTO_MAX_PX = 1600;
const PHOTO_QUALITY = 0.85;
const AREA = { south: 35.70, west: 140.02, north: 35.90, east: 140.32 }; // CiDAO の GOURMET_BBOX と揃える
const START = { lat: 35.806, lon: 140.15, zoom: 13 };

// 貼れる SNS（表示用。最終の判定は CiDAO が行う）
const PLATFORMS = [
  ["instagram", "Instagram", /(^|\.)instagram\.com$/],
  ["threads", "Threads", /(^|\.)threads\.(net|com)$/],
  ["x", "X", /(^|\.)(x|twitter)\.com$/],
  ["tiktok", "TikTok", /(^|\.)tiktok\.com$/],
  ["youtube", "YouTube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["facebook", "Facebook", /(^|\.)(facebook\.com|fb\.watch)$/],
  ["bluesky", "Bluesky", /(^|\.)bsky\.app$/],
  ["lemon8", "Lemon8", /(^|\.)lemon8-app\.com$/],
  ["note", "note", /(^|\.)note\.com$/],
  ["ameblo", "アメブロ", /(^|\.)ameblo\.jp$/],
  ["hatena", "はてなブログ", /(^|\.)(hatenablog\.(com|jp)|hateblo\.jp|hatenadiary\.(com|jp))$/],
];

const ERRORS = {
  invalid_url: "このURLは貼れません。SNSの投稿のURL（https://〜）を貼ってください。",
  invalid_handle: "投稿した人の名前は、英数字と . _ - だけで入れてください。",
  invalid_comment: "ひとことは100字までです。",
  image_requires_own: "写真をのせられるのは、自分の投稿のときだけです。",
  image_too_large: "写真が大きすぎます。別の写真を選んでください。",
  invalid_image: "写真を読めませんでした。別の写真を選んでください。",
  duplicate: "この投稿は、このお店にもう貼られています。",
  unknown_shop: "お店が見つかりませんでした。地図を読み込み直してください。",
  invalid_shop: "新しいお店の名前を入れてください。",
  outside_area: "印西市と周辺のお店だけ登録できます。場所を確かめてください。",
  not_ready: "準備中です。しばらくしてからお試しください。",
};

let map;
let osmLayer;
let pinLayer;
const shops = new Map(); // ref → { ref, name, lat, lon, kind, address, website, source, branch, cuisine }
let reports = []; // CiDAO の食レポ（新しい順）
const reportsByShop = new Map();
let currentShopRef = null;
let formShop = null; // 食レポを貼るお店（新しいお店のときは null）
let newShopPos = null;
let picking = false;
let pickMarker = null;
let moderation = false;

// ---------- 小さな道具 ----------
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function store(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function deviceId() {
  let id = "";
  try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch {}
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(DEVICE_KEY, id); } catch {}
  }
  return id;
}
function moderationKey() {
  try { return localStorage.getItem(MODERATION_KEY_STORAGE) || ""; } catch { return ""; }
}
// 検索用に表記をそろえる（全角半角・大文字小文字・カタカナとひらがな）
function norm(s) {
  return String(s || "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, "");
}
function insideArea(lat, lon) {
  return lat >= AREA.south && lat <= AREA.north && lon >= AREA.west && lon <= AREA.east;
}
function setStatus(text) { document.getElementById("gm-status").textContent = text; }
function fmtDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
function platformOf(raw) {
  try {
    const u = new URL(String(raw).trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
    const hit = PLATFORMS.find((p) => p[2].test(host));
    if (!hit) return null;
    const segs = u.pathname.split("/").filter(Boolean);
    let handle = "";
    if (hit[0] === "x" && segs[1] === "status") handle = segs[0];
    if ((hit[0] === "threads" || hit[0] === "tiktok") && segs[0]?.startsWith("@")) handle = segs[0].slice(1);
    if (hit[0] === "instagram" && (segs[1] === "p" || segs[1] === "reel")) handle = segs[0];
    if (hit[0] === "bluesky" && segs[0] === "profile") handle = segs[1] || "";
    return { id: hit[0], label: hit[1], handle: /^[A-Za-z0-9._-]{1,40}$/.test(handle) ? handle : "" };
  } catch { return null; }
}

// ---------- 地図 ----------
function initMap() {
  map = L.map("gm-map", { preferCanvas: true, zoomControl: true }).setView([START.lat, START.lon], START.zoom);
  L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> | お店 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  osmLayer = L.layerGroup().addTo(map);
  pinLayer = L.layerGroup().addTo(map);
  map.on("click", (e) => {
    if (!picking) return;
    setNewShopPos(e.latlng.lat, e.latlng.lng, "地図で決めました");
    stopPicking();
  });
}

function shopKinds() {
  const counts = new Map();
  for (const s of shops.values()) if (s.kind) counts.set(s.kind, (counts.get(s.kind) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function visibleShop(s) {
  const only = document.getElementById("gm-only-reports").checked;
  const kind = document.getElementById("gm-kind").value;
  if (only && !reportsByShop.get(s.ref)?.length) return false;
  if (kind && s.kind !== kind) return false;
  return true;
}

function render() {
  osmLayer.clearLayers();
  pinLayer.clearLayers();
  let shown = 0;
  for (const s of shops.values()) {
    if (!visibleShop(s)) continue;
    shown += 1;
    const n = reportsByShop.get(s.ref)?.length || 0;
    if (n > 0 || s.source === "ff") {
      const label = n > 0 ? `🍽 ${n}` : "🍽";
      const icon = L.divIcon({ className: "", html: `<span class="gm-pin${s.source === "ff" ? " is-ff" : ""}">${label}</span>`, iconSize: null });
      L.marker([s.lat, s.lon], { icon, title: s.name, riseOnHover: true })
        .on("click", () => openShop(s.ref)).addTo(pinLayer);
    } else {
      L.circleMarker([s.lat, s.lon], { radius: 6, color: "#fff", weight: 1.5, fillColor: "#7a4b2a", fillOpacity: 0.9 })
        .bindTooltip(esc(s.name), { direction: "top" })
        .on("click", () => openShop(s.ref)).addTo(osmLayer);
    }
  }
  const withReports = [...reportsByShop.keys()].length;
  setStatus(`お店 ${shown.toLocaleString()}件を表示中（食レポのあるお店 ${withReports}件・食レポ ${reports.filter((r) => !r.hidden).length}件）`);
}

// ---------- 読み込み ----------
async function loadOsm() {
  const res = await fetch(OSM_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`osm ${res.status}`);
  const data = await res.json();
  for (const s of data.shops || []) shops.set(s.id, { ...s, ref: s.id, source: "osm" });
}

async function loadFreefree() {
  try {
    const res = await fetch(FREEFREE_API);
    if (!res.ok) return;
    const data = await res.json();
    for (const s of data.shops || []) {
      if (s.category !== "food" || typeof s.lat !== "number" || !insideArea(s.lat, s.lon)) continue;
      const ref = `ff:${String(s.id).toLowerCase()}`;
      shops.set(ref, {
        ref, source: "ff", name: s.shop || s.title, lat: s.lat, lon: s.lon, kind: "FreeFree掲載", address: s.address || s.location || "",
        title: s.title, detailUrl: s.detailUrl, links: Array.isArray(s.links) ? s.links : [],
      });
    }
  } catch { /* FreeFree が読めなくても地図は使える */ }
}

async function loadReports() {
  const key = moderationKey();
  const headers = key ? { "x-moderation-key": key } : {};
  let res = await fetch(key ? `${API}?all=1` : API, { headers, cache: "no-store" });
  if (key && res.status === 403) {
    // 合言葉が違う・古いときは一般の一覧で
    res = await fetch(API, { cache: "no-store" });
  } else if (key && res.ok) {
    moderation = true;
  }
  if (!res.ok) throw new Error(`reports ${res.status}`);
  const data = await res.json();
  for (const s of data.shops || []) {
    if (s.hidden && !moderation) continue;
    shops.set(s.ref, { ...s, source: "shop", kind: "市民が登録", hidden: Boolean(s.hidden) });
  }
  reports = data.reports || [];
  indexReports();
}

function indexReports() {
  reportsByShop.clear();
  for (const r of reports) {
    if (r.hidden && !moderation) continue;
    if (!reportsByShop.has(r.shopRef)) reportsByShop.set(r.shopRef, []);
    reportsByShop.get(r.shopRef).push(r);
    // 一覧から消えたお店（FreeFree の掲載終了など）でも、食レポが付いていれば残す
    if (!shops.has(r.shopRef)) shops.set(r.shopRef, { ref: r.shopRef, name: r.shopName, lat: r.lat, lon: r.lon, kind: "", source: "report" });
  }
}

// ---------- 検索 ----------
function search(q) {
  const box = document.getElementById("gm-results");
  const key = norm(q);
  if (!key) { box.hidden = true; box.innerHTML = ""; return; }
  const hits = [];
  for (const s of shops.values()) {
    const hay = norm(`${s.name} ${s.branch || ""} ${s.nameEn || ""} ${s.kind || ""} ${s.cuisine || ""} ${s.address || ""}`);
    if (!hay.includes(key)) continue;
    const n = reportsByShop.get(s.ref)?.length || 0;
    const starts = norm(s.name).startsWith(key) ? 1 : 0;
    hits.push({ s, n, score: n * 10 + starts * 5 });
  }
  hits.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name, "ja"));
  const top = hits.slice(0, 30);
  box.innerHTML = top.length
    ? top.map(({ s, n }) => `<button type="button" data-ref="${esc(s.ref)}">${esc(s.name)}${s.branch ? ` ${esc(s.branch)}` : ""}<small>${esc(s.kind || "")}</small>${n ? `<span class="gm-count">食レポ ${n}</span>` : ""}</button>`).join("")
      + (hits.length > top.length ? `<div class="gm-empty">ほか ${hits.length - top.length}件。もう少しくわしく入れてください</div>` : "")
    : `<div class="gm-empty">見つかりませんでした。<button type="button" data-new="1">＋「${esc(q)}」を新しいお店として足す</button></div>`;
  box.hidden = false;
}

// ---------- お店の欄 ----------
function reportCard(r) {
  const own = store(OWN_KEY, {});
  const mine = own[r.id] && Date.now() - own[r.id] < UNDO_MS;
  const photo = r.imageUrl
    ? `<a class="gm-report-photo" href="${esc(r.url)}" target="_blank" rel="noopener"><img src="${esc(r.imageUrl)}" alt="${esc(r.shopName)}の食レポの写真" loading="lazy"></a>`
    : "";
  const who = r.handle ? `<strong>@${esc(r.handle)}</strong>` : "<strong>投稿者</strong>";
  const tools = [];
  if (mine) tools.push(`<button type="button" data-undo="${esc(r.id)}">↩ 取り消す</button>`);
  if (moderation) tools.push(`<button type="button" data-hide="${esc(r.id)}" data-hidden="${r.hidden ? "0" : "1"}">${r.hidden ? "戻す（運営）" : "🗑 伏せる（運営）"}</button>`);
  return `<article class="gm-report${r.hidden ? " is-hidden" : ""}">
    ${photo}
    <div class="gm-report-body">
      <div class="gm-report-head">${who}・${esc(r.platformLabel)}・${fmtDate(r.createdAt)}${r.isOwn ? "" : "（見つけた人が紹介）"}</div>
      ${r.comment ? `<p class="gm-report-comment">${esc(r.comment)}</p>` : ""}
      <a class="gm-report-go" href="${esc(r.url)}" target="_blank" rel="noopener">📱 ${esc(r.platformLabel)}で元の投稿を見る ↗</a>
      ${tools.length ? `<div class="gm-report-tools">${tools.join("")}</div>` : ""}
    </div>
  </article>`;
}

function openShop(ref, { fly = false } = {}) {
  const s = shops.get(ref);
  if (!s || picking) return; // 地図で新しいお店の場所を決めている間は開かない
  currentShopRef = ref;
  const list = reportsByShop.get(ref) || [];
  const meta = [s.kind, s.address].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join("");
  const badge = s.source === "ff" ? '<span class="gm-badge is-ff">FreeFree掲載</span>'
    : s.source === "shop" ? '<span class="gm-badge">市民が登録</span>' : "";
  const links = [];
  if (s.website) links.push(`<a href="${esc(s.website)}" target="_blank" rel="noopener">お店のサイト ↗</a>`);
  if (s.source === "ff" && s.detailUrl) links.push(`<a href="${esc(s.detailUrl)}" target="_blank" rel="noopener">FreeFreeの掲載を見る ↗</a>`);
  for (const l of (s.links || []).slice(0, 3)) if (/^https:\/\//.test(l.url)) links.push(`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || "リンク")} ↗</a>`);
  const shopTools = moderation && s.source === "shop"
    ? `<p><button type="button" data-hide-shop="${esc(s.ref.slice(5))}" data-hidden="${s.hidden ? "0" : "1"}">${s.hidden ? "お店を戻す（運営）" : "🗑 お店を伏せる（運営）"}</button></p>` : "";
  document.getElementById("gm-panel-body").innerHTML = `
    <h2>${esc(s.name)}${s.branch ? ` <small>${esc(s.branch)}</small>` : ""}</h2>
    <p class="gm-shop-meta">${badge}${meta}</p>
    ${links.length ? `<p class="gm-shop-meta">${links.join("　")}</p>` : ""}
    <button type="button" class="gm-btn-main gm-add-report" data-add="${esc(s.ref)}">＋ このお店の食レポを貼る</button>
    ${list.length ? list.map(reportCard).join("") : '<p class="gm-empty-reports">まだ食レポがありません。食べた投稿があれば、URLを貼ってください。</p>'}
    ${shopTools}`;
  document.getElementById("gm-panel").hidden = false;
  if (fly) map.setView([s.lat, s.lon], Math.max(map.getZoom(), 17));
  try { history.replaceState(null, "", `?shop=${encodeURIComponent(ref)}`); } catch {}
}

function closePanel() {
  document.getElementById("gm-panel").hidden = true;
  currentShopRef = null;
  try { history.replaceState(null, "", location.pathname); } catch {}
}

function openLatest() {
  const list = reports.filter((r) => moderation || !r.hidden).slice(0, 30);
  document.getElementById("gm-panel-body").innerHTML = `<h2>🆕 新着の食レポ</h2>` + (list.length
    ? list.map((r) => `<button type="button" class="gm-latest-item" data-ref="${esc(r.shopRef)}">
        ${r.imageUrl ? `<img src="${esc(r.imageUrl)}" alt="" loading="lazy">` : '<span class="gm-latest-noimg">🍽</span>'}
        <span>${esc(r.shopName)}<small>${r.handle ? `@${esc(r.handle)}・` : ""}${esc(r.platformLabel)}・${fmtDate(r.createdAt)}</small></span>
      </button>`).join("")
    : '<p class="gm-empty-reports">まだ食レポがありません。お店を探して、最初の1件を貼ってください。</p>');
  document.getElementById("gm-panel").hidden = false;
  currentShopRef = null;
}

// ---------- 食レポを貼る ----------
function openForm(ref, newName = "") {
  formShop = ref ? shops.get(ref) : null;
  newShopPos = null;
  const f = document.getElementById("gm-form");
  f.reset();
  document.getElementById("gm-form-error").textContent = "";
  document.getElementById("gm-photo-wrap").hidden = true;
  document.getElementById("gm-new-shop").hidden = Boolean(formShop);
  document.getElementById("gm-form-title").textContent = formShop ? "食レポを貼る" : "地図に無いお店を足して、食レポを貼る";
  document.getElementById("gm-form-shop").textContent = formShop ? `お店：${formShop.name}` : "";
  document.getElementById("gm-ns-name").value = newName;
  document.getElementById("gm-ns-pos-text").textContent = "場所はまだ決まっていません";
  document.getElementById("gm-url-hint").textContent = "Instagram・X・Threads・TikTok・YouTube・Facebook・Bluesky・Lemon8・note・アメブロ・はてなブログの投稿を貼れます";
  document.getElementById("gm-submit").disabled = false;
  document.getElementById("gm-dialog").showModal();
}

function setNewShopPos(lat, lon, how) {
  if (!insideArea(lat, lon)) {
    document.getElementById("gm-ns-pos-text").textContent = "その場所は範囲の外です（印西市と周辺のお店だけ登録できます）";
    return;
  }
  newShopPos = { lat, lon };
  document.getElementById("gm-ns-pos-text").textContent = `場所が決まりました（${how}）`;
  if (pickMarker) pickMarker.remove();
  pickMarker = L.circleMarker([lat, lon], { radius: 9, color: "#d9480f", weight: 3, fillOpacity: 0.3 }).addTo(map);
  map.setView([lat, lon], Math.max(map.getZoom(), 16));
}

function startPicking() {
  picking = true;
  document.getElementById("gm-dialog").close();
  document.getElementById("gm-pick-bar").hidden = false;
}
function stopPicking() {
  picking = false;
  document.getElementById("gm-pick-bar").hidden = true;
  const d = document.getElementById("gm-dialog");
  if (!d.open) d.showModal();
}

async function geocode() {
  const addr = document.getElementById("gm-ns-address").value.trim();
  const out = document.getElementById("gm-ns-pos-text");
  if (!addr) { out.textContent = "住所を入れてください"; return; }
  out.textContent = "探しています…";
  try {
    const q = /^(千葉県|印西|白井|佐倉|成田|栄町|我孫子|柏)/.test(addr) ? addr : `印西市${addr}`;
    const res = await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`);
    const list = await res.json();
    const hit = (list || []).find((x) => Array.isArray(x.geometry?.coordinates) && insideArea(x.geometry.coordinates[1], x.geometry.coordinates[0]));
    if (!hit) { out.textContent = "見つかりませんでした。地図をタップして決めてください"; return; }
    setNewShopPos(hit.geometry.coordinates[1], hit.geometry.coordinates[0], `住所「${hit.properties?.title || addr}」の位置`);
  } catch {
    out.textContent = "探せませんでした。地図をタップして決めてください";
  }
}

function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error("画像を選んでください")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("写真を読めませんでした"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("写真を読めませんでした"));
      img.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("写真を変換できませんでした"))), "image/jpeg", PHOTO_QUALITY);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function submitForm(e) {
  e.preventDefault();
  const err = document.getElementById("gm-form-error");
  const btn = document.getElementById("gm-submit");
  err.textContent = "";
  const url = document.getElementById("gm-url").value.trim();
  if (!platformOf(url)) { err.textContent = ERRORS.invalid_url; return; }
  const fd = new FormData();
  fd.set("deviceId", deviceId());
  fd.set("url", url);
  fd.set("handle", document.getElementById("gm-handle").value.trim());
  fd.set("comment", document.getElementById("gm-comment").value.trim());
  const own = document.getElementById("gm-own").checked;
  if (own) fd.set("isOwn", "1");
  if (formShop) {
    fd.set("shopRef", formShop.ref);
    fd.set("shopName", formShop.name);
    fd.set("shopLat", String(formShop.lat));
    fd.set("shopLon", String(formShop.lon));
  } else {
    const name = document.getElementById("gm-ns-name").value.trim();
    if (!name) { err.textContent = ERRORS.invalid_shop; return; }
    if (!newShopPos) { err.textContent = "お店の場所を決めてください（住所から探すか、地図をタップ）"; return; }
    fd.set("newShopName", name);
    fd.set("newShopAddress", document.getElementById("gm-ns-address").value.trim());
    fd.set("newShopLat", String(newShopPos.lat));
    fd.set("newShopLon", String(newShopPos.lon));
  }
  const file = document.getElementById("gm-photo").files?.[0];
  btn.disabled = true;
  btn.textContent = "登録しています…";
  try {
    if (own && file) fd.set("image", await shrinkPhoto(file), "photo.jpg");
    const res = await fetch(API, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      err.textContent = res.status === 429
        ? `続けて登録するときは、あと${data.retryAfterSeconds || 30}秒お待ちください。`
        : ERRORS[data.error] || `登録できませんでした（${data.error || res.status}）。`;
      return;
    }
    const ownList = store(OWN_KEY, {});
    ownList[data.report.id] = Date.now();
    for (const [id, t] of Object.entries(ownList)) if (Date.now() - t > UNDO_MS) delete ownList[id];
    save(OWN_KEY, ownList);
    if (data.shop) shops.set(data.shop.ref, { ...data.shop, source: "shop", kind: "市民が登録" });
    reports.unshift(data.report);
    indexReports();
    render();
    document.getElementById("gm-dialog").close();
    if (pickMarker) { pickMarker.remove(); pickMarker = null; }
    openShop(data.report.shopRef, { fly: true });
  } catch (error) {
    err.textContent = error instanceof Error && /写真|画像/.test(error.message) ? error.message : "通信できませんでした。電波のよい所でもう一度お試しください。";
  } finally {
    btn.disabled = false;
    btn.textContent = "登録する";
  }
}

async function undo(id) {
  if (!confirm("この食レポを取り消しますか？")) return;
  const res = await fetch(`${API}?id=${encodeURIComponent(id)}&deviceId=${encodeURIComponent(deviceId())}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error === "too_late" ? "30分を過ぎたため取り消せません。運営に連絡してください。" : "取り消せませんでした。");
    return;
  }
  reports = reports.filter((r) => r.id !== id);
  indexReports();
  render();
  if (currentShopRef) openShop(currentShopRef);
}

async function moderate(id, hidden, type = "report") {
  const res = await fetch(`${API}?id=${encodeURIComponent(id)}&type=${type}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "x-moderation-key": moderationKey() }, body: JSON.stringify({ hidden }),
  });
  if (!res.ok) { alert("切り替えられませんでした。"); return; }
  if (type === "report") {
    const r = reports.find((x) => x.id === id);
    if (r) r.hidden = hidden;
  } else {
    const s = shops.get(`shop:${id}`);
    if (s) s.hidden = hidden;
  }
  indexReports();
  render();
  if (currentShopRef) openShop(currentShopRef);
}

// ---------- 画面の操作 ----------
function bind() {
  const q = document.getElementById("gm-q");
  q.addEventListener("input", () => search(q.value));
  q.addEventListener("focus", () => q.value && search(q.value));
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-ref],[data-add],[data-new],[data-undo],[data-hide],[data-hide-shop]");
    if (!t) {
      if (!e.target.closest(".gm-search")) document.getElementById("gm-results").hidden = true;
      return;
    }
    if (t.dataset.ref) { document.getElementById("gm-results").hidden = true; openShop(t.dataset.ref, { fly: true }); }
    else if (t.dataset.add) openForm(t.dataset.add);
    else if (t.dataset.new) { document.getElementById("gm-results").hidden = true; openForm(null, q.value.trim()); }
    else if (t.dataset.undo) undo(t.dataset.undo);
    else if (t.dataset.hide) moderate(t.dataset.hide, t.dataset.hidden === "1");
    else if (t.dataset.hideShop) moderate(t.dataset.hideShop, t.dataset.hidden === "1", "shop");
  });
  document.getElementById("gm-only-reports").addEventListener("change", render);
  document.getElementById("gm-kind").addEventListener("change", render);
  document.getElementById("gm-latest-btn").addEventListener("click", openLatest);
  document.getElementById("gm-add-shop-btn").addEventListener("click", () => openForm(null));
  document.getElementById("gm-panel-close").addEventListener("click", closePanel);
  document.getElementById("gm-form").addEventListener("submit", submitForm);
  document.getElementById("gm-cancel").addEventListener("click", () => {
    document.getElementById("gm-dialog").close();
    if (pickMarker) { pickMarker.remove(); pickMarker = null; }
  });
  document.getElementById("gm-own").addEventListener("change", (e) => {
    document.getElementById("gm-photo-wrap").hidden = !e.target.checked;
    if (!e.target.checked) document.getElementById("gm-photo").value = "";
  });
  document.getElementById("gm-url").addEventListener("input", (e) => {
    const p = platformOf(e.target.value);
    const hint = document.getElementById("gm-url-hint");
    const handle = document.getElementById("gm-handle");
    if (!e.target.value.trim()) return;
    hint.textContent = p ? `${p.label}の投稿として登録します` : "このURLは貼れません（SNS・ブログの投稿のURLを貼ってください）";
    if (p?.handle && !handle.value) handle.value = `@${p.handle}`;
  });
  document.getElementById("gm-ns-geocode").addEventListener("click", geocode);
  document.getElementById("gm-ns-pick").addEventListener("click", startPicking);
  document.getElementById("gm-pick-cancel").addEventListener("click", stopPicking);
}

async function main() {
  initMap();
  bind();
  try {
    await loadOsm();
  } catch {
    setStatus("お店の一覧を読めませんでした。ページを読み込み直してください。");
  }
  const results = await Promise.allSettled([loadReports(), loadFreefree()]);
  const kindSel = document.getElementById("gm-kind");
  for (const [k, n] of shopKinds()) kindSel.insertAdjacentHTML("beforeend", `<option value="${esc(k)}">${esc(k)}（${n}）</option>`);
  render();
  if (results[0].status === "rejected") setStatus(`${document.getElementById("gm-status").textContent}　※食レポを読めませんでした`);
  const ref = new URLSearchParams(location.search).get("shop");
  if (ref && shops.has(ref)) openShop(ref, { fly: true });
}

main();
