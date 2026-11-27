// 🧭 道順チェック（2026-11-26 事業主決定A）
// 出発地と目的地を選ぶと、通行止めと「通れなかった記録」のある道を避けた道順を、スマホの中で計算して地図に出す。
// 渋滞と道案内は CBI ではできない（JARTIC は転載禁止・走行データは有償・9/24 に自前で作らないと決定）ので、
// 「Googleマップで開く」で、避けた道順の要所を経由地にして Google に渡す（Maps URLs・鍵不要・スマホのブラウザは経由地3つまで）。
//
// ⚠ 言い方：「安全な道」「この道なら冠水しない」とは書かない（気象業務法・11/17 の法令点検）。
//   出すのは「記録のある区間を避けた道順の例」。記録の無い道も冠水することがある、を必ず添える。
// ⚠ 道路は simulation-data/route_graph.json（OpenStreetMap の車道・ODbL 1.0・pipeline/build_route_graph.py が作る）。車の道順。
//   一方通行は守る（OSM の oneway）。右左折の禁止・道幅・信号は考えない。
//   ⛔ road_risk.json（色分け用）は使わない：道ごとに点を間引いて交差点が落ち、道路網が 22,072 個に切れていた（2026-11-27 実測）。
// ⚠ 計算はすべて端末の中。出発地・目的地は送らない（Googleマップで開くを押したときだけ Google に渡る）。
//
// 避けるもの（rcMode）：
//   "now" ＝ いまの地図の表示に合わせる：いま赤く出ている通れない記録（雨の物差し・期間・凡例のしぼり込みと同じ）＋みんつくの投稿（出ているもの）＋役所の通行止め＋県の規制状況図
//   "all" ＝ 過去の記録をすべて避ける：通れない記録すべて＋みんつくの投稿すべて＋通行止め
// 雨の無い日の "now" は、通れない記録が地図に出ていないので、通行止めだけを避ける（画面にその旨を出す）。
(function initRouteCheck() {
  if (typeof map === "undefined" || typeof L === "undefined") return;

  const AVOID_NEAR_M = 15;        // 避ける線からこの距離以内の道の区間を「記録のある区間」とみなす
  const AVOID_FACTOR = 40;        // 記録のある区間の重み（長さ×40＋2km）。ほかに道が無いときだけ通る
  const AVOID_ADD_M = 2000;
  const SNAP_MAX_M = 600;         // 出発地・目的地から交差点・道の端までこれより遠ければ「範囲外」
  const WAYPOINT_MAX = 3;         // Googleマップ：スマホのブラウザは経由地3つまで（公式の説明）

  let graph = null;               // { lat, lon, adjStart, adjNode, adjEdge, eA, eB, eLen, shapeOff, shapeLat, shapeLon, nodeCount }
  let graphLoading = null;
  const state = { from: null, to: null, mode: "now", picking: null, result: null };
  const layer = L.layerGroup();
  const pane = map.createPane("routeCheckPane");
  pane.style.zIndex = 447;          // 記録の線（440）より上・みんつく（450）より下
  const renderer = L.svg({ pane: "routeCheckPane" });

  // ---------------------------------------------------------------- 道路網
  function meters(aLat, aLon, bLat, bLon) {
    const my = 111320, mx = 111320 * Math.cos(aLat * Math.PI / 180);
    return Math.hypot((bLat - aLat) * my, (bLon - aLon) * mx);
  }

  async function ensureGraph() {
    if (graph) return graph;
    if (graphLoading) return graphLoading;
    graphLoading = (async () => {
      const res = await fetch("./simulation-data/route_graph.json");
      if (!res.ok) throw new Error(`道路のデータを読めませんでした（HTTP ${res.status}）`);
      const data = await res.json();
      const q = data.quantize || 100000;
      const n = data.nodes.length / 2;
      const lat = new Float64Array(n), lon = new Float64Array(n);
      let a0 = 0, b0 = 0;
      for (let i = 0; i < n; i++) { a0 += data.nodes[2 * i]; b0 += data.nodes[2 * i + 1]; lat[i] = a0 / q; lon[i] = b0 / q; }
      const E = data.edges.length;
      const eA = new Int32Array(E), eB = new Int32Array(E), eDir = new Int8Array(E), eLen = new Float64Array(E);
      const shapeOff = new Int32Array(E + 1);
      let total = 0;
      data.edges.forEach((e, k) => { shapeOff[k] = total; total += 2 + (e.length - 3) / 2; });
      shapeOff[E] = total;
      const shapeLat = new Float64Array(total), shapeLon = new Float64Array(total);
      data.edges.forEach((e, k) => {
        const a = e[0], b = e[1];
        eA[k] = a; eB[k] = b; eDir[k] = e[2];
        let o = shapeOff[k];
        let la = Math.round(lat[a] * q), lo = Math.round(lon[a] * q);
        shapeLat[o] = lat[a]; shapeLon[o] = lon[a]; o++;
        for (let i = 3; i < e.length; i += 2) { la += e[i]; lo += e[i + 1]; shapeLat[o] = la / q; shapeLon[o] = lo / q; o++; }
        shapeLat[o] = lat[b]; shapeLon[o] = lon[b];
        let L1 = 0;
        for (let p = shapeOff[k]; p < shapeOff[k + 1] - 1; p++) L1 += meters(shapeLat[p], shapeLon[p], shapeLat[p + 1], shapeLon[p + 1]);
        eLen[k] = L1;
      });
      // 向きつきの隣接（一方通行は片方だけ）
      const deg = new Int32Array(n + 1);
      for (let k = 0; k < E; k++) { if (eDir[k] >= 0) deg[eA[k] + 1]++; if (eDir[k] <= 0) deg[eB[k] + 1]++; }
      for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
      const adjStart = deg, fill = new Int32Array(n);
      const adjNode = new Int32Array(deg[n]), adjEdge = new Int32Array(deg[n]);
      for (let k = 0; k < E; k++) {
        if (eDir[k] >= 0) { const p = adjStart[eA[k]] + fill[eA[k]]++; adjNode[p] = eB[k]; adjEdge[p] = k; }
        if (eDir[k] <= 0) { const p = adjStart[eB[k]] + fill[eB[k]]++; adjNode[p] = eA[k]; adjEdge[p] = k; }
      }
      graph = { lat, lon, adjStart, adjNode, adjEdge, eA, eB, eLen, shapeOff, shapeLat, shapeLon, nodeCount: n };
      return graph;
    })();
    try { return await graphLoading; } finally { graphLoading = null; }
  }

  function nearestNode(g, la, lo) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < g.nodeCount; i++) {
      const dLat = Math.abs(g.lat[i] - la);
      if (dLat > 0.01) continue;
      const d = meters(la, lo, g.lat[i], g.lon[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return { node: best, distance: bd };
  }

  // 二分ヒープの A*（費用は長さ以上なので、直線距離の見積もりで正しく最短になる）
  function aStar(g, s, t, edgeCost) {
    const n = g.nodeCount;
    const dist = new Float64Array(n).fill(Infinity);
    const prevEdge = new Int32Array(n).fill(-1);
    const prevNode = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    const heapN = [], heapF = [];
    const push = (v, f) => {
      heapN.push(v); heapF.push(f);
      let i = heapN.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= heapF[i]) break;
        [heapN[p], heapN[i]] = [heapN[i], heapN[p]]; [heapF[p], heapF[i]] = [heapF[i], heapF[p]];
        i = p;
      }
    };
    const pop = () => {
      const v = heapN[0];
      const lastN = heapN.pop(), lastF = heapF.pop();
      if (heapN.length) {
        heapN[0] = lastN; heapF[0] = lastF;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heapN.length && heapF[l] < heapF[m]) m = l;
          if (r < heapN.length && heapF[r] < heapF[m]) m = r;
          if (m === i) break;
          [heapN[m], heapN[i]] = [heapN[i], heapN[m]]; [heapF[m], heapF[i]] = [heapF[i], heapF[m]];
          i = m;
        }
      }
      return v;
    };
    const tLat = g.lat[t], tLon = g.lon[t];
    dist[s] = 0;
    push(s, meters(g.lat[s], g.lon[s], tLat, tLon));
    while (heapN.length) {
      const v = pop();
      if (done[v]) continue;
      done[v] = 1;
      if (v === t) break;
      for (let p = g.adjStart[v]; p < g.adjStart[v + 1]; p++) {
        const w = g.adjNode[p], e = g.adjEdge[p];
        const nd = dist[v] + edgeCost(e);
        if (nd < dist[w]) {
          dist[w] = nd; prevEdge[w] = e; prevNode[w] = v;
          push(w, nd + meters(g.lat[w], g.lon[w], tLat, tLon));
        }
      }
    }
    if (!done[t]) return null;
    const nodes = [t], edges = [];
    let v = t;
    while (v !== s) {
      const e = prevEdge[v];
      edges.push(e);
      v = prevNode[v];
      nodes.push(v);
    }
    nodes.reverse(); edges.reverse();
    let length = 0;
    edges.forEach(e => { length += g.eLen[e]; });
    return { nodes, edges, length };
  }

  // ---------------------------------------------------------------- 避ける線
  function rainFilteredNow() {
    return typeof rainVerdictFilter !== "undefined" && rainVerdictFilter && rainFilterActive();
  }
  // みんつくの投稿が、いま地図に出ているか（renderKansuiLayer と同じ条件。画面の範囲・縮尺は見ない）
  function kansuiShownNow(road) {
    if (isImplausibleKansuiLine(road.path)) return false;
    const filtered = rainFilteredNow();
    const recentOnly = filtered && Boolean(rainLive) && rainLive.mode === "now";
    if (filtered && !recentOnly) return false;
    if (!passesWhenFilter(road.createdAt)) return false;
    if (recentOnly && !isRecentRainIso(road.createdAt)) return false;
    return true;
  }

  function avoidFeatures(mode) {
    const out = [];
    const add = (kind, label, path) => {
      if (!Array.isArray(path) || !path.length) return;
      const pts = path.map(p => [Number(p[0]), Number(p[1])]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (pts.length) out.push({ kind, label, path: pts });
    };
    (typeof passedRoadsData !== "undefined" && Array.isArray(passedRoadsData) ? passedRoadsData : []).forEach(road => {
      if (passedRoadKindOf(road) !== "blocked") return;
      if (mode === "now" && !(passesWhenFilter(road.endedAt) && passedKindFilter.blocked && passesRainFilter(road))) return;
      add("blocked", "通れなかった記録", road.path);
    });
    (typeof kansuiData !== "undefined" && Array.isArray(kansuiData) ? kansuiData : []).forEach(road => {
      if (mode === "now" ? !kansuiShownNow(road) : isImplausibleKansuiLine(road.path)) return;
      add("kansui", "みんつくの冠水の投稿", road.path);
    });
    const closures = typeof roadClosuresData !== "undefined" && roadClosuresData && Array.isArray(roadClosuresData.active) ? roadClosuresData.active : [];
    closures.forEach(item => add("closure", "役所の通行止め", item.path));
    const pref = typeof prefKiseiData !== "undefined" && prefKiseiData && Array.isArray(prefKiseiData.lines) ? prefKiseiData.lines : [];
    pref.forEach(line => add("closure", "県の規制状況図の通行止め", line.path || line.latlngs || line.coords));
    return out;
  }

  // 避ける線の近くにある道の区間に印を付ける。edgeFeat[e] ＝ その区間に掛かる避ける線の番号（無ければ -1）
  function markAvoided(g, features) {
    const cellLat = 0.0002, cellLon = 0.00025;   // 約22m
    const grid = new Map();
    const put = (la, lo, f) => {
      const k = `${Math.floor(la / cellLat)},${Math.floor(lo / cellLon)}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([la, lo, f]);
    };
    features.forEach((feat, f) => {
      const p = feat.path;
      if (p.length === 1) { put(p[0][0], p[0][1], f); return; }
      for (let i = 0; i + 1 < p.length; i++) {
        const L1 = meters(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
        const steps = Math.max(1, Math.ceil(L1 / 8));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          put(p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t, f);
        }
      }
    });
    const edgeFeat = new Int32Array(g.eA.length).fill(-1);
    if (!grid.size) return edgeFeat;
    const near = (la, lo) => {
      const ci = Math.floor(la / cellLat), cj = Math.floor(lo / cellLon);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const list = grid.get(`${ci + di},${cj + dj}`);
        if (!list) continue;
        for (const [a, b, f] of list) if (meters(la, lo, a, b) <= AVOID_NEAR_M) return f;
      }
      return -1;
    };
    for (let e = 0; e < g.eA.length; e++) {
      let hit = -1;
      for (let p = g.shapeOff[e]; p < g.shapeOff[e + 1] - 1 && hit < 0; p++) {
        const aLat = g.shapeLat[p], aLon = g.shapeLon[p], bLat = g.shapeLat[p + 1], bLon = g.shapeLon[p + 1];
        const steps = Math.max(1, Math.ceil(meters(aLat, aLon, bLat, bLon) / 12));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const f = near(aLat + (bLat - aLat) * t, aLon + (bLon - aLon) * t);
          if (f >= 0) { hit = f; break; }
        }
      }
      edgeFeat[e] = hit;
    }
    return edgeFeat;
  }

  // 自分の道順のうち、ふつうの最短と違う部分（回り道）の真ん中を、経由地にする（長いものから3つまで・道順の順）
  function pickWaypoints(g, route, plain) {
    if (!plain) return [];
    const onPlain = new Set(plain.nodes);
    const sections = [];
    let cur = null;
    route.nodes.forEach((v, i) => {
      if (!onPlain.has(v)) {
        if (!cur) cur = { start: i, end: i, length: 0 };
        cur.end = i;
        if (i > 0) cur.length += g.eLen[route.edges[i - 1]];
      } else if (cur) { sections.push(cur); cur = null; }
    });
    if (cur) sections.push(cur);
    return sections.filter(s => s.length >= 50).sort((a, b) => b.length - a.length).slice(0, WAYPOINT_MAX)
      .sort((a, b) => a.start - b.start)
      .map(s => { const v = route.nodes[Math.floor((s.start + s.end) / 2)]; return [g.lat[v], g.lon[v]]; });
  }

  function googleUrl(from, to, waypoints) {
    const ll = p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ll(from))}&destination=${encodeURIComponent(ll(to))}&travelmode=driving`;
    if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.map(ll).join("|"))}`;
    return url;
  }

  // ---------------------------------------------------------------- 計算
  async function compute() {
    const out = document.getElementById("route-result");
    if (!state.from || !state.to) { out.innerHTML = "出発地と目的地を選んでください。"; return; }
    out.innerHTML = "道順を計算しています…（初回は道路のデータを読むので数秒かかります）";
    try {
      // 通行止めは冠水の用途では読み込んでいないことがあるので、ここで読む
      if (typeof roadClosuresData !== "undefined" && !roadClosuresData && typeof refreshRoadClosures === "function") await refreshRoadClosures();
      if (typeof prefKiseiData !== "undefined" && !prefKiseiData && typeof refreshPrefKisei === "function") await refreshPrefKisei();
      const g = await ensureGraph();
      const s = nearestNode(g, state.from[0], state.from[1]);
      const t = nearestNode(g, state.to[0], state.to[1]);
      if (s.node < 0 || t.node < 0 || s.distance > SNAP_MAX_M || t.distance > SNAP_MAX_M) {
        out.innerHTML = "出発地か目的地の近くに、この地図の道路のデータがありません（印西市とその周辺だけです）。";
        return;
      }
      const features = avoidFeatures(state.mode);
      const edgeFeat = markAvoided(g, features);
      const plain = aStar(g, s.node, t.node, e => g.eLen[e]);
      const route = aStar(g, s.node, t.node, e => (edgeFeat[e] >= 0 ? g.eLen[e] * AVOID_FACTOR + AVOID_ADD_M : g.eLen[e]));
      if (!route || !plain) { out.innerHTML = "道順が見つかりませんでした（道路がつながっていない場所です）。"; return; }
      const featsOn = r => new Set(r.edges.map(e => edgeFeat[e]).filter(f => f >= 0));
      const onPlain = featsOn(plain), onRoute = featsOn(route);
      const avoided = [...onPlain].filter(f => !onRoute.has(f));
      const waypoints = pickWaypoints(g, route, plain);
      state.result = { route, plain, avoided, unavoidable: [...onRoute], features, waypoints, g };
      out.innerHTML = "";
      panel.hidden = true;
      render(route, plain, avoided, [...onRoute], features, waypoints);
      showCard(true);
      draw(g, route, edgeFeat);
    } catch (error) {
      out.innerHTML = `計算できませんでした（${escapeHtml(error?.message || "不明")}）。`;
    }
  }

  function draw(g, route, edgeFeat) {
    layer.clearLayers();
    const latlngs = edgeLatLngs(g, route, null);
    if (latlngs.length) {
      [[state.from, latlngs[0]], [state.to, latlngs[latlngs.length - 1]]].forEach(([p, q]) => {
        if (p && meters(p[0], p[1], q[0], q[1]) > 15) L.polyline([p, q], { pane: "routeCheckPane", renderer, color: "#6a1b9a", weight: 3, opacity: 0.8, dashArray: "4 6", interactive: false }).addTo(layer);
      });
    }
    // 避けた記録は赤い点線で出す（なぜ回り道になったかが地図で分かるように・2026-11-27）
    const res = state.result;
    (res?.avoided || []).forEach(f => {
      const path = res.features[f]?.path || [];
      if (path.length === 1) L.circleMarker(path[0], { pane: "routeCheckPane", renderer, radius: 7, color: "#c62828", weight: 3, fillOpacity: 0.2, interactive: false }).addTo(layer);
      else if (path.length > 1) L.polyline(path, { pane: "routeCheckPane", renderer, color: "#c62828", weight: 4, opacity: 0.9, dashArray: "6 6", interactive: false }).addTo(layer);
    });
    L.polyline(latlngs, { pane: "routeCheckPane", renderer, color: "#ffffff", weight: 11, opacity: 0.9, interactive: false }).addTo(layer);
    L.polyline(latlngs, { pane: "routeCheckPane", renderer, color: "#6a1b9a", weight: 6, opacity: 0.95, interactive: false }).addTo(layer);
    // 避けきれなかった区間は、道順の上に黄色で重ねる
    route.edges.forEach((e, i) => {
      if (edgeFeat[e] < 0) return;
      L.polyline(edgeLatLngs(g, route, i), { pane: "routeCheckPane", renderer, color: "#ffd600", weight: 6, opacity: 1, interactive: false }).addTo(layer);
    });
    pins();
    if (!layer._map) layer.addTo(map);
    // 下の小札（約 170px）と左上のボタンに道順が隠れないよう、余白をとって合わせる
    map.fitBounds(L.latLngBounds(latlngs), { paddingTopLeft: [56, 70], paddingBottomRight: [20, (card.offsetHeight || 160) + 40], maxZoom: 16 });
  }
  // 道順の線（only＝その番号の区間だけ）。区間の形は点a→bの順なので、b から入ったときは逆にする
  function edgeLatLngs(g, route, only) {
    const out = [];
    route.edges.forEach((e, i) => {
      if (only !== null && only !== i) return;
      const from = route.nodes[i];
      const pts = [];
      for (let p = g.shapeOff[e]; p < g.shapeOff[e + 1]; p++) pts.push([g.shapeLat[p], g.shapeLon[p]]);
      if (g.eA[e] !== from) pts.reverse();
      (out.length ? pts.slice(1) : pts).forEach(x => out.push(x));
    });
    return out;
  }

  function pins() {
    const pin = (p, text, cls) => L.marker(p, {
      icon: L.divIcon({ className: "", html: `<div class="route-pin ${cls}">${text}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
      zIndexOffset: 1200, interactive: false
    }).addTo(layer);
    if (state.from) pin(state.from, "出", "is-from");
    if (state.to) pin(state.to, "着", "is-to");
  }

  function render(route, plain, avoided, unavoidable, features, waypoints) {
    const km = m => (m / 1000).toFixed(1);
    const extra = route.length - plain.length;
    const kindCount = list => {
      const c = {};
      list.forEach(f => { const k = features[f].label; c[k] = (c[k] || 0) + 1; });
      return Object.entries(c).map(([k, n]) => `${k} ${n}件`).join("・");
    };
    const nowNoRain = state.mode === "now" && typeof rainAmountFilter !== "undefined" && rainAmountFilter.dry;
    const sub = [];
    sub.push(avoided.length
      ? `<span title="${escapeHtml(kindCount(avoided))}">✅ 避けた記録 ${avoided.length}件（赤の点線）</span>`
      : `<span>最短の道に記録はありません</span>`);
    if (unavoidable.length) sub.push(`<span class="route-warn" title="${escapeHtml(kindCount(unavoidable))}">⚠ 避けきれない ${unavoidable.length}件（黄色）</span>`);
    if (nowNoRain) sub.push(`<span class="route-card-note">雨が少ないので、避けたのは通行止めだけです</span>`);
    card.innerHTML = `
      <div class="route-card-top">
        <p class="route-card-sum"><strong>🧭 約${km(route.length)}km</strong>${extra > 30 ? `<span>（最短より +${km(extra)}km）</span>` : ""}</p>
        <button type="button" class="route-card-x" data-card="clear" aria-label="道順を消す">✕</button>
      </div>
      <p class="route-card-sub">${sub.join("")}</p>
      <div class="route-card-btns">
        <a class="route-google" href="${escapeHtml(googleUrl(state.from, state.to, waypoints))}" target="_blank" rel="noreferrer">Googleマップで開く</a>
        <button type="button" class="route-card-edit" data-card="edit">条件を変える</button>
      </div>
      <p class="route-card-caution">安全の保証ではありません。現地の状況に従ってください。<button type="button" class="route-card-help" data-card="help" aria-label="道順チェックの説明を開く">ⓘ 説明</button></p>`;
  }

  // ---------------------------------------------------------------- 画面
  const host = map.getContainer().closest(".map-pane") || map.getContainer().parentElement;
  const panel = document.createElement("div");
  panel.className = "range-panel route-panel";
  panel.id = "route-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="route-head"><strong>🧭 道順チェック</strong><span class="route-head-btns"><button type="button" class="route-help" data-route="help" aria-label="道順チェックの説明を開く">ⓘ</button><button type="button" class="route-close" data-route="close" aria-label="閉じる">✕</button></span></div>
    ${["from", "to"].map(k => `
    <div class="route-point" data-point="${k}">
      <div class="route-point-head"><span class="route-point-name">${k === "from" ? "出発" : "目的地"}</span><span class="route-point-value" id="route-${k}-value">未選択</span></div>
      <div class="route-point-btns">
        <button type="button" data-route="here" data-point="${k}">📍 現在地</button>
        <button type="button" data-route="pick" data-point="${k}">🗺 地図で</button>
        <button type="button" data-route="find" data-point="${k}">🔍 地名</button>
      </div>
      <div class="route-find" id="route-${k}-find" hidden>
        <input type="search" placeholder="地名・駅・施設名（例：木下駅）" enterkeyhint="search" aria-label="${k === "from" ? "出発" : "目的地"}の地名">
        <div class="route-find-results"></div>
      </div>
    </div>`).join("")}
    <div class="route-mode" role="radiogroup" aria-label="避ける記録">
      <span class="route-mode-name">避ける記録</span>
      <label><input type="radio" name="route-mode" value="now" checked><span>いまの雨</span></label>
      <label><input type="radio" name="route-mode" value="all"><span>過去すべて</span></label>
    </div>
    <div class="route-actions"><button type="button" class="route-go" data-route="go">道順を調べる</button><button type="button" data-route="clear">消す</button></div>
    <div class="route-result" id="route-result" aria-live="polite"></div>`;
  host.appendChild(panel);

  // 結果の小札（画面の下・記録のボタンの場所に出す）
  const card = document.createElement("div");
  card.className = "route-card";
  card.id = "route-card";
  card.hidden = true;
  card.setAttribute("aria-live", "polite");
  host.appendChild(card);
  const showCard = on => {
    card.hidden = !on;
    host.classList.toggle("is-route-showing", on);
  };
  const openPanel = on => {
    panel.hidden = !on;
    if (on) { showCard(false); ensureGraph().catch(() => {}); }   // 開いた時点で道路のデータを読み始める
    else if (state.result) showCard(true);
  };
  const openRouteHelp = () => {
    const dialog = document.getElementById("help-dialog");
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    document.getElementById("help-route")?.scrollIntoView({ block: "start" });
  };
  card.addEventListener("click", event => {
    const btn = event.target.closest("[data-card]");
    if (!btn) return;
    switch (btn.dataset.card) {
      case "edit": openPanel(true); break;
      case "help": openRouteHelp(); break;
      case "clear":
        state.result = null;
        layer.clearLayers();
        showCard(false);
        break;
    }
  });

  const setPoint = (k, p, label) => {
    state[k] = p;
    const node = document.getElementById(`route-${k}-value`);
    if (node) node.textContent = label;
    layer.clearLayers(); pins(); if (!layer._map) layer.addTo(map);
  };

  let statusBeforePick = null;
  const stopPicking = () => {
    state.picking = null;
    const status = document.getElementById("map-status");
    if (status && statusBeforePick !== null) status.textContent = statusBeforePick;
    statusBeforePick = null;
    host.classList.remove("is-route-picking");
    panel.hidden = false;
  };
  // 地図で選ぶ：タップは地図（Leaflet）より先に受け取って止める。記録の線は canvas に描くので CSS の pointer-events が効かず、
  // 地図に渡すと app.js が近くの記録の吹き出しを開き、道順の線を隠していた（2026-11-27 録画で確認）。
  // 開いた吹き出しを後から閉じる形は、地図が動いている途中で消えて例外（_panAnim）になったのでやめた
  map.getContainer().addEventListener("click", event => {
    if (!state.picking) return;
    if (event.target.closest?.(".leaflet-control, .leaflet-popup")) return;   // ＋−などの操作はそのまま
    if (map.dragging?.moved?.()) return;                                       // 地図を動かしただけのとき
    event.stopPropagation();
    event.preventDefault();
    const latlng = map.mouseEventToLatLng(event);
    setPoint(state.picking, [latlng.lat, latlng.lng], "地図で選んだ場所");
    stopPicking();
  }, true);

  panel.addEventListener("click", event => {
    const btn = event.target.closest("[data-route]");
    if (!btn) {
      const result = event.target.closest(".route-find-results button");
      if (result) {
        const k = result.closest(".route-point").dataset.point;
        setPoint(k, [Number(result.dataset.lat), Number(result.dataset.lon)], result.textContent);
        result.closest(".route-find").hidden = true;
      }
      return;
    }
    const k = btn.dataset.point;
    switch (btn.dataset.route) {
      case "close": openPanel(false); break;
      case "help": openRouteHelp(); break;
      case "here":
        if (!navigator.geolocation) { document.getElementById("route-result").textContent = "この端末では現在地を取得できません。"; break; }
        document.getElementById(`route-${k}-value`).textContent = "現在地を取得中…";
        navigator.geolocation.getCurrentPosition(
          pos => setPoint(k, [pos.coords.latitude, pos.coords.longitude], `現在地（誤差 約${Math.round(pos.coords.accuracy || 0)}m）`),
          () => { document.getElementById(`route-${k}-value`).textContent = "現在地を取得できません（地図で選ぶか地名で）"; },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
        break;
      case "pick":
        state.picking = k;
        host.classList.add("is-route-picking");
        panel.hidden = true;
        { const status = document.getElementById("map-status");
          if (status) { if (statusBeforePick === null) statusBeforePick = status.textContent; status.textContent = `${k === "from" ? "出発" : "目的地"}の場所を地図でタップしてください`; } }
        break;
      case "find": {
        const box = document.getElementById(`route-${k}-find`);
        box.hidden = !box.hidden;
        if (!box.hidden) box.querySelector("input").focus();
        break;
      }
      case "go": compute(); break;
      case "clear":
        state.from = state.to = state.result = null;
        ["from", "to"].forEach(x => { document.getElementById(`route-${x}-value`).textContent = "未選択"; });
        document.getElementById("route-result").innerHTML = "";
        layer.clearLayers();
        showCard(false);
        break;
    }
  });
  panel.addEventListener("change", event => {
    if (event.target.name === "route-mode") state.mode = event.target.value;
  });
  panel.addEventListener("keydown", async event => {
    if (event.key !== "Enter" || event.target.type !== "search") return;
    event.preventDefault();
    const box = event.target.closest(".route-find");
    const list = box.querySelector(".route-find-results");
    const q = event.target.value.trim();
    if (!q) return;
    list.textContent = "さがしています…";
    try {
      const res = await fetch(`${PLACE_SEARCH_URL}${encodeURIComponent(q)}`);
      const items = (await res.json()) || [];
      // 印西市とその周辺（道路のデータの範囲）を先に
      const rows = items.map(it => ({ lon: it.geometry.coordinates[0], lat: it.geometry.coordinates[1], title: it.properties.title }))
        .filter(r => Math.abs(r.lat - 35.8) < 0.3 && Math.abs(r.lon - 140.15) < 0.4).slice(0, 6);
      list.innerHTML = rows.length
        ? rows.map(r => `<button type="button" data-lat="${r.lat}" data-lon="${r.lon}">${escapeHtml(r.title)}</button>`).join("")
        : "見つかりませんでした（印西市とその周辺の地名で）";
    } catch (error) {
      list.textContent = "さがせませんでした";
    }
  });

  // 地図の左上（現在地の下）に「🧭 道順」ボタン。冠水の用途だけに出す（CSS）
  const RouteControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const box = L.DomUtil.create("div", "leaflet-bar locate-control route-control");
      const button = L.DomUtil.create("button", "locate-btn", box);
      button.type = "button";
      button.innerHTML = '<span aria-hidden="true">🧭</span><span class="locate-label">道順</span>';
      button.title = "通行止めと通れなかった記録のある道を避けた道順を調べる";
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.on(button, "click", () => openPanel(panel.hidden));
      return box;
    }
  });
  new RouteControl().addTo(map);
})();
