// ============================================================
// 印西市 文化財マップの中身（全画面版 map.html と、3Dワールドの画面内版で共用）
// ------------------------------------------------------------
// 画面内版を別ドキュメント（iframe）にすると、地図を触ったとたんにブラウザが
// コントローラーの入力を3D画面へ渡さなくなる（Gamepad API は操作中の画面にしか届かない）。
// そのため画面内版は3Dワールドと同じページに描く必要があり、地図の処理をここへ切り出して
// 両方から呼べるようにしている。
//
// 使い方:
//   CBIMap.load().then(() => {
//     const m = CBIMap.create(document.getElementById("box"), {
//       mini: true,
//       onGo: (idx, spot) => { ... },   // 「ここへ飛ぶ」が押されたとき
//     });
//     m.setMe(lat, lon, height);        // 現在地を動かす（省略すると出ない）
//     m.refreshPieces();                // 集めた記録を読み直す
//   });
// ============================================================
(function () {
  const LEAFLET_CSS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
  const PUZZLE_KEY = "cocola-metaverse-puzzle-v1"; // メタバースが書く「集めた記録」
  const DESIG_COLOR = { "国指定": "#e74c3c", "県指定": "#f39c12", "市指定": "#3498db", "国登録": "#9b59b6" };
  const STYLE_ID = "cbiMapStyle";

  let loading = null;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = [
      ".cbiMap { background: #0b1420; }",
      ".cbiMap .leaflet-container { background: #0b1420; font-family: inherit; }",
      ".cbiMap .bzPin { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;",
      "  font-size: 13px; border: 2px solid rgba(255,255,255,0.75); box-shadow: 0 2px 6px rgba(0,0,0,0.6); }",
      ".cbiMap .bzPin.got { border-color: #ffd166; box-shadow: 0 0 10px rgba(255,209,102,0.8); }",
      ".cbiMap .meLabel { background: rgba(10,20,32,0.9); border: 1px solid #7fc8ff; color: #7fc8ff;",
      "  border-radius: 12px; padding: 2px 8px; font-size: 11px; font-weight: bold; white-space: nowrap; }",
      ".cbiMap .leaflet-popup-content-wrapper { background: #10202f; color: #e8f0f8; border-radius: 10px; }",
      ".cbiMap .leaflet-popup-tip { background: #10202f; }",
      ".cbiMap .leaflet-popup-content { margin: 12px 14px; font-size: 13px; line-height: 1.7; max-width: 260px; }",
      ".cbiMap .leaflet-popup-content h3 { margin: 0 0 4px; font-size: 15px; color: #ffd166; }",
      ".cbiMap .leaflet-popup-content .meta { color: #8fa4b8; font-size: 11px; margin-bottom: 6px; }",
      ".cbiMap .leaflet-popup-content .src { font-size: 11px; color: #8fa4b8; }",
      ".cbiMap .leaflet-popup-content a { color: #7fc8ff; }",
      ".cbiMap .goBtn { display: block; width: 100%; margin-top: 8px; padding: 7px 10px; cursor: pointer;",
      "  background: #1d3a56; color: #cfe8ff; border: 1px solid #3a6a95; border-radius: 8px;",
      "  font-size: 12px; font-weight: bold; }",
      ".cbiMap .goBtn:hover { background: #26506f; }",
      ".cbiMap .gotMark { color: #ffd166; font-weight: bold; }",
      ".cbiMap.mini .leaflet-popup-content { font-size: 12px; max-width: 200px; margin: 10px 12px; }",
      ".cbiMap.mini .leaflet-control-attribution { font-size: 9px; }",
    ].join("\n");
    document.head.appendChild(st);
  }

  // Leaflet は地図を開くときに初めて読み込む（開かないうちは通信も解析も起きない）
  function load() {
    if (window.L) { injectStyle(); return Promise.resolve(); }
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = LEAFLET_JS;
      js.onload = function () { injectStyle(); resolve(); };
      js.onerror = function () { reject(new Error("地図の部品を読み込めませんでした")); };
      document.head.appendChild(js);
    });
    return loading;
  }

  function readPieces() {
    try {
      const raw = localStorage.getItem(PUZZLE_KEY);
      const d = raw ? JSON.parse(raw) : {};
      return (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
    } catch (e) { return {}; }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pinIcon(b, got) {
    return L.divIcon({
      className: "",
      html: '<div class="bzPin' + (got ? " got" : "") + '" style="background:'
        + (DESIG_COLOR[b.designation] || "#3498db") + '">' + (got ? "✅" : "🧩") + "</div>",
      iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14],
    });
  }

  // el: 地図を描く要素。opts: { mini, onGo(idx, spot), spots }
  function create(el, opts) {
    opts = opts || {};
    el.classList.add("cbiMap");
    if (opts.mini) el.classList.add("mini");

    const map = L.map(el, { zoomControl: true, attributionControl: true })
      .setView([35.832, 140.145], opts.mini ? 11 : 12);
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
      attribution: "地理院タイル", maxZoom: 18,
    }).addTo(map);

    let spots = [];
    const markers = [];
    let meMarker = null, meLabel = null;
    let showGot = true, showNot = true;
    let follow = false;      // 自分の位置を地図の中心に保ち続けるか
    let selfPan = false;     // 追従で動かしている最中か（利用者の操作と区別するため）
    const api = {};

    function popupHtml(b, i, got) {
      const desc = b.description ? "<p>" + esc(b.description) + "</p>" : "";
      const link = b.detailUrl
        ? '<p class="src">出典：<a href="' + esc(b.detailUrl) + '" target="_blank" rel="noopener">印西市ホームページ</a></p>'
        : "";
      const box = document.createElement("div");
      box.innerHTML = "<h3>" + esc(b.name) + "</h3>"
        + '<div class="meta">' + esc(b.designation || "") + "／" + esc(b.type || "")
        + (b.era ? "／" + esc(b.era) : "") + "<br>" + esc(b.address || "") + "</div>"
        + (got ? '<p class="gotMark">✅ この文化財の精霊は取得ずみです</p>' : "<p>🧩 まだ取得していません</p>")
        + desc + link
        + '<button class="goBtn">▶ 3Dワールドでここへ飛ぶ</button>';
      box.querySelector(".goBtn").addEventListener("click", function () {
        if (opts.onGo) opts.onGo(i, b);
      });
      return box;
    }

    function applyFilter() {
      const pieces = readPieces();
      markers.forEach(function (m, i) {
        const got = pieces[i] !== undefined;
        const want = got ? showGot : showNot;
        if (want && !map.hasLayer(m)) m.addTo(map);
        if (!want && map.hasLayer(m)) map.removeLayer(m);
      });
    }

    api.refreshPieces = function () {
      const pieces = readPieces();
      let got = 0;
      markers.forEach(function (m, i) {
        const has = pieces[i] !== undefined;
        if (has) got++;
        m.setIcon(pinIcon(spots[i], has));
        m.setPopupContent(popupHtml(spots[i], i, has));
      });
      applyFilter();
      if (opts.onCount) opts.onCount(got, spots.length);
      return got;
    };

    api.setFilter = function (gotOn, notOn) {
      showGot = gotOn; showNot = notOn;
      applyFilter();
    };

    // 3Dワールドの現在地を映す。lat が数値でなければ消す
    api.setMe = function (lat, lon, height) {
      if (typeof lat !== "number" || typeof lon !== "number") {
        if (meMarker) { map.removeLayer(meMarker); meMarker = null; }
        if (meLabel) { map.removeLayer(meLabel); meLabel = null; }
        return;
      }
      const pos = [lat, lon];
      if (!meMarker) {
        meMarker = L.circleMarker(pos, {
          radius: 9, color: "#7fc8ff", weight: 3, fillColor: "#7fc8ff", fillOpacity: 0.45,
        }).addTo(map);
        meLabel = L.marker(pos, {
          icon: L.divIcon({ className: "", html: '<div class="meLabel">🐦 いまここ</div>',
            iconSize: [80, 20], iconAnchor: [-12, 26] }),
          interactive: false,
        }).addTo(map);
      } else {
        meMarker.setLatLng(pos);
        meLabel.setLatLng(pos);
      }
      if (follow) {
        selfPan = true;
        map.panTo(pos, { animate: true, duration: 0.5 });
        setTimeout(function () { selfPan = false; }, 600);
      }
      if (typeof height === "number" && meLabel) {
        meLabel.setIcon(L.divIcon({ className: "",
          html: '<div class="meLabel">🐦 いまここ（高度 ' + Math.round(height) + 'm）</div>',
          iconSize: [140, 20], iconAnchor: [-12, 26] }));
      }
    };

    api.panToMe = function () {
      if (meMarker) map.panTo(meMarker.getLatLng());
    };

    // 追従モード。地図を自分で動かしたら自動で解除する（勝手に戻ると操作できないため）
    api.setFollow = function (on) {
      follow = !!on;
      if (follow) api.panToMe();
      if (opts.onFollowChange) opts.onFollowChange(follow);
    };
    api.getFollow = function () { return follow; };
    map.on("dragstart", function () {
      if (follow && !selfPan) api.setFollow(false);
    });

    api.invalidate = function () { map.invalidateSize(); };
    api.map = map;

    // 文化財データ。3Dワールド側がすでに持っていれば渡してもらい、無ければ読む
    const ready = opts.spots
      ? Promise.resolve(opts.spots)
      : fetch("bunkazai.json").then(function (r) { return r.json(); })
          .then(function (d) { return d.spots || []; });

    api.ready = ready.then(function (list) {
      spots = list;
      spots.forEach(function (b, i) {
        const m = L.marker([b.lat, b.lon], { icon: pinIcon(b, false) })
          .bindPopup(popupHtml(b, i, false));
        markers.push(m);
        m.addTo(map);
      });
      if (markers.length && !opts.mini) {
        map.fitBounds(L.featureGroup(markers).getBounds().pad(0.08));
      }
      api.refreshPieces();
      return api;
    });

    return api;
  }

  window.CBIMap = { load: load, create: create, readPieces: readPieces, PUZZLE_KEY: PUZZLE_KEY };
})();
