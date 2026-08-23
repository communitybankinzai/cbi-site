// いんざい冒険図鑑リアル Service Worker
// 方針: network-first（常に最新を優先し、オフライン時のみキャッシュで起動できるようにする）
// ⚠️ adventure/ 配下を修正したら CACHE_NAME を必ずバンプすること
const CACHE_NAME = "cbi-adventure-v3";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "../metaverse/bunkazai.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // 地図タイルはキャッシュしない（容量対策・常にネットワーク）
  if (event.request.url.indexOf("tile.openstreetmap.org") >= 0) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
