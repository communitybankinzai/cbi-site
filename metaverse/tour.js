// 🗺 日本・世界の観光地めぐり（2026-11-02 中司さん「プレイのモードに日本や世界の観光地めぐりも入れて」）
// めぐりモード「tour」で、観光地の一覧から選ぶと、その観光地を見下ろす位置へ一瞬で移り、短い説明を出す。
// 道中のタイルを読まないよう、飛ばずに移す（index.html の warpTo と同じ考え方）。移ったあとは自由に飛べる。
// 武蔵屋めぐり・タイムトライアル・2Pレースの最中は移らない（warpBlockedReason）。
// 見る位置：target（緯度・経度・高さ＝見る点の楕円体高 m）を、heading（カメラの向き°）・pitch（見下ろし°）・range（距離 m）で見る。
// 高さは標高にジオイド高を足したおおよその値。距離を十分とっているので、数十mずれても構図は崩れない。
(function () {
  "use strict";

  const SPOTS = [
    // ---- 日本 ----
    { area: "jp", name: "東京スカイツリー", place: "東京都墨田区", lat: 35.71006, lon: 139.81070, h: 300, heading: 240, pitch: -12, range: 1500,
      desc: "高さ634mの電波塔。2012年に開業しました。" },
    { area: "jp", name: "東京タワー", place: "東京都港区", lat: 35.65858, lon: 139.74543, h: 200, heading: 20, pitch: -15, range: 900,
      desc: "高さ333mの電波塔。1958年に完成しました。" },
    { area: "jp", name: "成田山新勝寺", place: "千葉県成田市", lat: 35.78630, lon: 140.31840, h: 75, heading: 0, pitch: -25, range: 550,
      desc: "940年に開かれたと伝わる真言宗の寺。印西からも近い、千葉の大きなお寺です。" },
    { area: "jp", name: "鎌倉の大仏（高徳院）", place: "神奈川県鎌倉市", lat: 35.31672, lon: 139.53573, h: 55, heading: 0, pitch: -25, range: 300,
      desc: "高さ約11mの青銅の阿弥陀如来坐像。国宝です。" },
    { area: "jp", name: "富士山", place: "静岡県・山梨県", lat: 35.36060, lon: 138.72740, h: 3000, heading: 0, pitch: -10, range: 14000,
      desc: "標高3776m、日本でいちばん高い山。2013年に世界文化遺産になりました。" },
    { area: "jp", name: "清水寺", place: "京都府京都市", lat: 34.99485, lon: 135.78504, h: 130, heading: 60, pitch: -25, range: 550,
      desc: "崖にせり出した「清水の舞台」で知られる寺。世界遺産「古都京都の文化財」の一つです。" },
    { area: "jp", name: "金閣寺（鹿苑寺）", place: "京都府京都市", lat: 35.03937, lon: 135.72924, h: 140, heading: 0, pitch: -30, range: 400,
      desc: "金箔をはった舎利殿が池に映る寺。今の建物は1955年に建て直されたものです。" },
    { area: "jp", name: "東大寺 大仏殿", place: "奈良県奈良市", lat: 34.68895, lon: 135.83983, h: 160, heading: 0, pitch: -25, range: 600,
      desc: "奈良の大仏をまつる大仏殿は、世界最大級の木造建築です。" },
    { area: "jp", name: "大阪城", place: "大阪府大阪市", lat: 34.68737, lon: 135.52584, h: 100, heading: 0, pitch: -20, range: 650,
      desc: "豊臣秀吉が築いた城。今の天守は1931年に建て直されました。" },
    { area: "jp", name: "姫路城", place: "兵庫県姫路市", lat: 34.83939, lon: 134.69394, h: 100, heading: 0, pitch: -25, range: 450,
      desc: "白い壁から「白鷺城（しらさぎじょう）」とも呼ばれる城。1993年に日本で最初の世界遺産の一つになりました。" },
    { area: "jp", name: "厳島神社", place: "広島県廿日市市", lat: 34.29600, lon: 132.31930, h: 40, heading: 120, pitch: -15, range: 600,
      desc: "海の上に建つ朱色の大鳥居と社殿で知られる神社。世界遺産です。" },
    // ---- 世界 ----
    { area: "world", name: "エッフェル塔", place: "フランス・パリ", lat: 48.85837, lon: 2.29448, h: 200, heading: 315, pitch: -10, range: 1100,
      desc: "1889年のパリ万博に合わせて建てられた鉄の塔。高さは約330mです。" },
    { area: "world", name: "ビッグ・ベン", place: "イギリス・ロンドン", lat: 51.50073, lon: -0.12463, h: 100, heading: 270, pitch: -15, range: 750,
      desc: "国会議事堂の時計塔。正式な名前はエリザベス・タワーです。" },
    { area: "world", name: "コロッセオ", place: "イタリア・ローマ", lat: 41.89021, lon: 12.49223, h: 80, heading: 0, pitch: -30, range: 450,
      desc: "約2000年前に造られた、古代ローマの円形闘技場です。" },
    { area: "world", name: "サグラダ・ファミリア", place: "スペイン・バルセロナ", lat: 41.40363, lon: 2.17436, h: 150, heading: 315, pitch: -20, range: 650,
      desc: "ガウディが設計した教会。1882年に建て始めました。" },
    { area: "world", name: "サン・マルコ広場", place: "イタリア・ヴェネツィア", lat: 45.43414, lon: 12.33880, h: 50, heading: 30, pitch: -25, range: 600,
      desc: "運河の街ヴェネツィアの中心にある広場。大鐘楼とサン・マルコ寺院が建っています。" },
    { area: "world", name: "パルテノン神殿", place: "ギリシャ・アテネ", lat: 37.97153, lon: 23.72575, h: 190, heading: 30, pitch: -20, range: 500,
      desc: "約2400年前、古代ギリシャのアテネの丘（アクロポリス）に建てられた神殿です。" },
    { area: "world", name: "ギザのピラミッド", place: "エジプト・ギザ", lat: 29.97923, lon: 31.13420, h: 120, heading: 315, pitch: -15, range: 1600,
      desc: "約4500年前に造られた王の墓。いちばん大きいクフ王のピラミッドは、今の高さが約140mです。" },
    { area: "world", name: "マリーナベイ・サンズ", place: "シンガポール", lat: 1.28339, lon: 103.86074, h: 110, heading: 270, pitch: -12, range: 1200,
      desc: "3棟のホテルの屋上を、船の形の空中庭園でつないだ建物。2010年に開業しました。" },
    { area: "world", name: "自由の女神", place: "アメリカ・ニューヨーク", lat: 40.68925, lon: -74.04451, h: 40, heading: 315, pitch: -12, range: 500,
      desc: "1886年にフランスから贈られた像。ニューヨーク港のリバティ島に立っています。" },
    { area: "world", name: "ゴールデン・ゲート・ブリッジ", place: "アメリカ・サンフランシスコ", lat: 37.81990, lon: -122.47825, h: 50, heading: 330, pitch: -12, range: 2600,
      desc: "1937年に開通した、赤い吊り橋です。" },
    { area: "world", name: "コルコバードのキリスト像", place: "ブラジル・リオデジャネイロ", lat: -22.95192, lon: -43.21049, h: 720, heading: 270, pitch: -5, range: 900,
      desc: "リオデジャネイロの山の上に立つ、高さ約30mの像です。" },
  ];
  const AREA_LABEL = { jp: "🗾 日本", world: "🌍 世界" };

  const state = { area: "jp", index: -1, entered: false, opened: false };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---- 見た目（このファイルだけで完結させる） ----
  const css = document.createElement("style");
  css.textContent =
    "#tourPanel{position:absolute;inset:0;z-index:85;background:rgba(10,16,24,.82);display:none;align-items:center;justify-content:center;padding:16px}" +
    "#tourPanel.show{display:flex}" +
    "#tourPanel .inner{background:linear-gradient(160deg,#2c3e50,#1a2533);color:#fff;border:2px solid #ffd166;border-radius:18px;padding:18px 16px;max-width:560px;width:100%;max-height:calc(100vh - 32px);overflow-y:auto;box-sizing:border-box}" +
    "#tourPanel h2{color:#ffd166;font-size:17px;margin:0 0 10px;text-align:center}" +
    "#tourPanel .tabs{display:flex;gap:8px;margin-bottom:10px}" +
    "#tourPanel .tabs button{flex:1;padding:10px;border-radius:12px;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font-size:15px;font-weight:bold;cursor:pointer}" +
    "#tourPanel .tabs button.on{background:#ffd166;color:#1a2533;border-color:#ffd166}" +
    "#tourPanel .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}" +
    "#tourPanel .spot{text-align:left;padding:10px;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;font-size:14px;font-weight:bold;cursor:pointer;line-height:1.4}" +
    "#tourPanel .spot:hover,#tourPanel .spot:focus{background:rgba(255,255,255,.2)}" +
    "#tourPanel .spot small{display:block;font-size:11px;font-weight:normal;color:#c9d6e2}" +
    "#tourPanel .foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:#9fb2c8}" +
    "#tourPanel .foot button{padding:8px 16px;border-radius:10px;border:0;background:#555;color:#fff;font-size:14px;cursor:pointer}" +
    "#tourCard{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);z-index:60;width:min(460px,calc(100vw - 32px));box-sizing:border-box;display:none;" +
    "background:rgba(20,30,44,.92);color:#fff;border:2px solid #ffd166;border-radius:14px;padding:12px 14px}" +
    "#tourCard.show{display:block}" +
    "#tourCard .nm{font-size:16px;font-weight:bold;color:#ffd166}" +
    "#tourCard .pl{font-size:12px;color:#c9d6e2;margin-left:6px;font-weight:normal}" +
    "#tourCard p{margin:6px 0 10px;font-size:14px;line-height:1.6}" +
    "#tourCard .row{display:flex;gap:6px}" +
    "#tourCard .row button{flex:1;padding:8px 4px;border-radius:10px;border:0;background:#3d566e;color:#fff;font-size:13px;cursor:pointer}" +
    "#tourCard .row button.go{background:#e67e22}";
  document.head.appendChild(css);

  const panel = document.createElement("div");
  panel.id = "tourPanel";
  panel.innerHTML =
    '<div class="inner" role="dialog" aria-label="観光地めぐり">' +
    "<h2>🗺 観光地めぐり<br><small style=\"font-size:12px;color:#c9d6e2;font-weight:normal\">行きたい場所を押すと、その上空へ移ります。あとは自由に飛べます</small></h2>" +
    '<div class="tabs"><button type="button" data-area="jp">' + AREA_LABEL.jp + '</button><button type="button" data-area="world">' + AREA_LABEL.world + "</button></div>" +
    '<div class="grid"></div>' +
    '<div class="foot"><span>3D地図：Google（場所によって街並みの細かさが違います）</span><button type="button" data-act="close">とじる</button></div>' +
    "</div>";
  document.body.appendChild(panel);

  const card = document.createElement("div");
  card.id = "tourCard";
  document.body.appendChild(card);

  function renderList() {
    panel.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.area === state.area));
    panel.querySelector(".grid").innerHTML = SPOTS.map((s, i) => s.area !== state.area ? "" :
      '<button type="button" class="spot" data-i="' + i + '">' + esc(s.name) + "<small>" + esc(s.place) + "</small></button>").join("");
  }
  function openPanel() { renderList(); panel.classList.add("show"); state.opened = true; }
  function closePanel() { panel.classList.remove("show"); }

  function renderCard() {
    const s = SPOTS[state.index];
    if (!s) { card.classList.remove("show"); return; }
    card.innerHTML =
      '<div class="nm">' + esc(s.name) + '<span class="pl">' + esc(s.place) + "</span></div>" +
      "<p>" + esc(s.desc) + "</p>" +
      '<div class="row"><button type="button" data-act="prev">◀ まえ</button><button type="button" class="go" data-act="list">🗺 一覧</button>' +
      '<button type="button" data-act="next">つぎ ▶</button><button type="button" data-act="close">とじる</button></div>';
    card.classList.add("show");
  }

  function go(i) {
    const s = SPOTS[i];
    if (!s || typeof viewer === "undefined") return;
    const why = typeof warpBlockedReason === "function" ? warpBlockedReason() : "";
    if (why) { if (typeof showPickResult === "function") showPickResult(why + "は移動できません（記録が成立しなくなるため）。", 3500); return; }
    if (typeof walkMode !== "undefined" && walkMode && typeof setMode === "function") setMode(false); // 歩行のままだと地面へ吸着し直す
    state.index = i;
    state.area = s.area;
    closePanel();
    const hm = document.getElementById("howtoModal"); if (hm) hm.classList.remove("show"); // 初回の「使い方」が後ろに残って説明カードが隠れるため
    viewer.camera.cancelFlight();
    const target = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, s.h);
    viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(Cesium.Math.toRadians(s.heading), Cesium.Math.toRadians(s.pitch), s.range));
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); // 注視を外して、ふだんどおり自由に飛べるようにする
    renderCard();
    if (typeof miniMapApi !== "undefined" && miniMapApi) { try { miniMapApi.setFollow(true); } catch (e) {} }
  }
  // 同じ地域の中で前後へ（端まで行ったら反対の端へ）
  function step(d) {
    const list = SPOTS.map((s, i) => i).filter((i) => SPOTS[i].area === state.area);
    const p = list.indexOf(state.index);
    go(list[(p + d + list.length) % list.length]);
  }

  panel.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (ev.target === panel) { closePanel(); return; }
    if (!b) return;
    if (b.dataset.area) { state.area = b.dataset.area; renderList(); return; }
    if (b.dataset.i) { go(parseInt(b.dataset.i, 10)); return; }
    if (b.dataset.act === "close") closePanel();
  });
  card.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "prev") step(-1);
    else if (b.dataset.act === "next") step(1);
    else if (b.dataset.act === "list") openPanel();
    else if (b.dataset.act === "close") card.classList.remove("show");
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && panel.classList.contains("show")) closePanel();
  });

  const btn = document.getElementById("tourBtn");
  if (btn) btn.addEventListener("click", () => (panel.classList.contains("show") ? closePanel() : openPanel()));

  // index.html の applyMode から呼ぶ
  window.tourEnterMode = function () {
    if (btn) btn.style.display = "";
    if (!state.entered) { state.entered = true; setTimeout(openPanel, 400); } // 初めて入ったときだけ一覧を開く
  };
  window.tourLeaveMode = function () {
    if (btn) btn.style.display = "none";
    state.entered = false;
    closePanel();
    card.classList.remove("show");
  };
  window.CbiTour = { spots: SPOTS, go: go, open: openPanel };
  // ?mode=tour や前回のモードで開いたときは、このファイルより先に applyMode が走っているので、ここで入り直す
  if (typeof currentMode !== "undefined" && currentMode === "tour") window.tourEnterMode();
})();
