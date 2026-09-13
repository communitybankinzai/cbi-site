// 3Dワールドの Service Worker（2026-09-14 中司さん「2回目以降はテザリング通信を食わないように。鳶も同様」）
// 武蔵屋モードで開いたときに controls-guide.js が登録し、下の対象を保存領域（Cache Storage）へまとめて保存する。
// ここでは、保存領域にあればそこから返し、無ければネットから取って保存する（cache-first）。
// 対象は次だけ。それ以外（Google の3D街並み・地図・API など）には一切手を出さない（3D街並みは規約上保存しない）。
//   - 描画部品 Three.js 0.180.0（jsdelivr）
//   - 白鳥・鳶の3Dモデル assets/tonbi/{swan,kite}.glb（ゲーム本体・2Pレース・操作のしかた で共用）
//   - 操作のしかたの手順と声 assets/narration/controls-guide.json・zundamon/guide_*.mp3
// URL には版（?v=）が付くので、中身を差し替えたら URL が変わり、新しい方を取りに行く。古い版は controls-guide.js が消す。
const CACHE = "cbi-meta-offline-v1";
function target(url) {
  return url.startsWith("https://cdn.jsdelivr.net/npm/three@0.180.0/") ||
    /\/metaverse\/assets\/tonbi\/(swan|kite)\.glb\?/.test(url) ||
    /\/metaverse\/assets\/narration\/(controls-guide\.json|zundamon\/guide_[^/]+\.mp3)\?/.test(url);
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !target(req.url)) return; // 対象外はブラウザにそのまま任せる
  e.respondWith(caches.open(CACHE).then((c) =>
    // 鍵は URL だけにする（音声の Range 指定などヘッダーの違いで取りこぼさない）
    c.match(req.url, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.status === 200) c.put(req.url, res.clone()).catch(() => {});
      return res;
    }))
  ));
});
