// 防災MAP をオフラインでも開けるようにする（2026-11-26）。
// 大雨のときは、停電や通信の混雑で開けなくなることがある。一度開いた端末なら、最後に読み込んだ内容で開けるようにする。
//
// 方針：
// - いつも先にネットへ取りに行き（最新を優先）、つながらない・遅いときだけ手元の控えを返す（ネット優先）。
//   古い版を出し続けないため、控えを先に返すことはしない。
// - 控えるのは、この地図の画面の部品（同じサイト）、地図の部品（jsDelivr）、CiDAO の防災の読み取り（GET）だけ。
// - 送信（POST など）・運営の合言葉つきの読み取り・中身の見えない応答（opaque）は控えない。
// - ⚠ 地図の背景（地理院の画像）は中身の見えない応答なので控えない（端末の容量を大きく使うため）。オフラインでは背景が白くなる。
const VERSION = "2026-11-26a";
const CACHE = `cbi-disaster-map-${VERSION}`;
const MAX_ENTRIES = 200;
const NAV_TIMEOUT_MS = 6000;   // 画面：6秒待ってもつながらなければ控えを出す
const DATA_TIMEOUT_MS = 10000; // データ：10秒

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(["./", "./index.html"]).catch(() => {})));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("cbi-disaster-map-") && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function cacheable(request) {
  if (request.method !== "GET") return false;
  if (request.headers.get("x-moderation-key") || request.headers.get("authorization")) return false;
  const url = new URL(request.url);
  if (/[?&](all|moderate)=1\b/.test(url.search)) return false;
  if (url.origin === self.location.origin) return true;   // この地図の画面・../assets（同じサイト）
  if (url.hostname === "cdn.jsdelivr.net") return true;   // Leaflet など
  if (url.hostname === "cidao.vercel.app" && url.pathname.startsWith("/api/disaster/")) return true;
  return false;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) await cache.delete(keys[i]);
}

async function put(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  trim(cache);
}

async function networkFirst(event, timeoutMs) {
  const request = event.request;
  const network = fetch(request);
  // 控えへの保存は最初に登録する（画面へ返す前に複製を取るため。あとから waitUntil を呼ぶと、控えを返した後では例外になる）
  event.waitUntil(network.then(response => put(request, response.clone())).catch(() => {}));
  const timeout = new Promise(resolve => setTimeout(resolve, timeoutMs, null));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
  } catch (error) {
    // つながらない → 控えへ
  }
  const cached = await caches.match(request, { ignoreVary: true }) ||
    (request.mode === "navigate" ? await caches.match("./index.html") : null);
  if (cached) return cached;
  return network;   // 控えも無いときは、ネットの結果（失敗ならそのまま失敗）を返す
}

self.addEventListener("fetch", event => {
  if (!cacheable(event.request)) return;
  event.respondWith(networkFirst(event, event.request.mode === "navigate" ? NAV_TIMEOUT_MS : DATA_TIMEOUT_MS));
});

// 画面が開いたあとに、最初の読み込みで使った部品・データを控えへ入れる（最初の1回は SW がまだ働いていないため）
self.addEventListener("message", event => {
  if (event.data?.type !== "warm" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    for (const url of event.data.urls.slice(0, 60)) {
      try {
        const request = new Request(url, { mode: new URL(url).origin === self.location.origin ? "same-origin" : "cors", credentials: "omit" });
        if (!cacheable(request)) continue;
        if (await caches.match(request)) continue;
        await put(request, await fetch(request));
      } catch (error) {
        // 取れないものは飛ばす
      }
    }
  })());
});
