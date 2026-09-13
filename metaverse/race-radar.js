// 2Pレース（vs-race.js のタイムレース）に、おにごっこ（sky-tag.js）と同じ「相手の白鳥」と「レーダー」を足す（2026-09-13 追加）
// 中司さん「相手がみえません。ドッグファイトモードと同様に相手の位置と文化財の位置をレーダーで表示してほしい」。
// vs-race.js は毎フレーム window.SkyTag.render(players, race) を呼ぶ（おにごっこ以外では中で何もしない）ので、
// それを包んで、タイムレース中は各画面に (a) 相手の機体（相手のカメラ位置に白鳥／鳶）、(b) レーダー
// （相手＝相手の色の点、チェックポイント＝次が黄・通過済みが灰・その先が白）を描く。vs-race.js と sky-tag.js は変更しない。
(function () {
  "use strict";
  const T = window.SkyTag;
  if (!T || typeof T.render !== "function") return;
  const RANGES = [500, 1000, 2000, 5000, 10000, 20000];

  function ensure(players, race) {
    players.forEach((p, i) => {
      const other = players[1 - i];
      if (!p.viewer || !other.viewer) return;
      if (!p.rrEntity) {
        const C = Cesium;
        p.rrEntity = p.viewer.entities.add({
          position: new C.CallbackProperty(() => other.viewer.camera.positionWC, false),
          orientation: new C.CallbackProperty(() => {
            const camera = other.viewer.camera, m = new C.Matrix3();
            C.Matrix3.setColumn(m, 0, camera.rightWC, m);
            C.Matrix3.setColumn(m, 1, camera.directionWC, m);
            C.Matrix3.setColumn(m, 2, camera.upWC, m);
            return C.Quaternion.fromRotationMatrix(m);
          }, false),
          model: { uri: T.aircraftUri(other.aircraft), minimumPixelSize: 0, runAnimations: true },
          point: { pixelSize: 5, color: C.Color.fromCssColorString(other.color), distanceDisplayCondition: new C.DistanceDisplayCondition(250, 20000) },
          label: { text: "P" + other.id, font: "14px sans-serif", fillColor: C.Color.fromCssColorString(other.color), showBackground: true,
            pixelOffset: new C.Cartesian2(0, -22), distanceDisplayCondition: new C.DistanceDisplayCondition(0, 20000) },
        });
        p.rrAircraft = other.aircraft;
      } else if (p.rrAircraft !== other.aircraft) { // 相手が機体を変えたら差し替える
        p.rrEntity.model.uri = T.aircraftUri(other.aircraft);
        p.rrAircraft = other.aircraft;
      }
      if (!p.rrBanner) { // 通過の合図（2026-09-13 中司さん「ポイント通過したら通過したことがわかるように」）
        const b = document.createElement("div");
        b.className = "raceBanner";
        b.style.cssText = "position:absolute;left:50%;top:22%;transform:translate(-50%,-50%) scale(.9);z-index:6;pointer-events:none;color:#fff;font:bold clamp(18px,3.2vw,34px) sans-serif;text-align:center;background:#07140fd9;border:3px solid #ffd166;border-radius:14px;padding:10px 22px;opacity:0;transition:opacity .25s,transform .25s;white-space:pre-line;text-shadow:0 2px 6px #000";
        p.viewer.container.appendChild(b);
        p.rrBanner = b;
        p.rrSeenIndex = p.nextIndex; // 作った時点の通過数を基準にする（読み込み直後に鳴らさない）
        p.rrSeenFinished = !!p.finished;
      }
      if (!p.rrScope) {
        const scope = document.createElement("div");
        scope.className = "raceRadar";
        scope.style.cssText = "position:absolute;right:8px;bottom:32px;width:clamp(96px,30%,150px);z-index:5;pointer-events:none;color:#fff;font:12px sans-serif;text-align:center;background:#07140fcc;border:1px solid #7cc9aa66;border-radius:8px;padding:4px";
        const canvas = document.createElement("canvas");
        canvas.width = 280; canvas.height = 280;
        canvas.style.cssText = "display:block;width:100%;aspect-ratio:1";
        const readout = document.createElement("div");
        readout.style.cssText = "line-height:1.35;overflow-wrap:anywhere;white-space:pre-line";
        scope.append(canvas, readout);
        p.viewer.container.appendChild(scope);
        p.rrScope = scope;
      }
    });
  }
  function remove(players) {
    (players || []).forEach((p) => {
      if (p.rrEntity && p.viewer) { try { p.viewer.entities.remove(p.rrEntity); } catch (e) {} }
      p.rrEntity = null;
      if (p.rrScope) p.rrScope.remove();
      p.rrScope = null;
      if (p.rrBanner) p.rrBanner.remove();
      p.rrBanner = null; p.rrSeenIndex = undefined; p.rrSeenFinished = false;
    });
  }
  function localOf(inverse, cart) {
    return Cesium.Matrix4.multiplyByPoint(inverse, cart, new Cesium.Cartesian3());
  }
  // 通過音（ファイル不要の短いチャイム）。ブラウザの制限で、画面を一度操作した後でないと鳴らない
  let actx = null;
  function chime(goal) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime;
      (goal ? [523, 659, 784, 1047] : [880, 1175]).forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.35);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 0.4);
      });
    } catch (e) {}
  }
  function showBanner(p, text, ms) {
    const b = p.rrBanner;
    if (!b) return;
    b.textContent = text;
    b.style.opacity = "1"; b.style.transform = "translate(-50%,-50%) scale(1)";
    clearTimeout(p.rrBannerTimer);
    p.rrBannerTimer = setTimeout(() => { b.style.opacity = "0"; b.style.transform = "translate(-50%,-50%) scale(.9)"; }, ms || 2200);
  }
  // 通過・ゴールの検知：nextIndex（次に向かう番号）が増えたら直前の地点を通過した
  function detectPass(players, race) {
    const cps = (race.course && race.course.checkpoints) || [];
    players.forEach((p) => {
      if (!p.rrBanner) return;
      if (p.rrSeenIndex === undefined || p.nextIndex < p.rrSeenIndex) { p.rrSeenIndex = p.nextIndex; p.rrSeenFinished = !!p.finished; return; } // RESET 後
      if (p.nextIndex > p.rrSeenIndex) {
        const cp = cps[p.nextIndex - 1];
        const last = p.nextIndex >= cps.length;
        showBanner(p, (last ? "🏁 ゴール！ " : "✅ CP" + p.nextIndex + " 通過！ ") + (cp ? cp.name : "") + (last ? "" : "\nつぎ → " + (cps[p.nextIndex] ? cps[p.nextIndex].name : "")), last ? 4000 : 2200);
        chime(last);
        p.rrSeenIndex = p.nextIndex;
      }
      if (p.finished && !p.rrSeenFinished) { p.rrSeenFinished = true; if (p.nextIndex >= cps.length) { /* 上でゴール表示済み */ } else showBanner(p, "🏁 フィニッシュ", 3000); }
    });
  }
  function draw(players, race) {
    const C = Cesium;
    const cps = (race.course && race.course.checkpoints) || [];
    detectPass(players, race);
    players.forEach((p, i) => {
      if (!p.rrScope || !p.viewer) return;
      const other = players[1 - i];
      const camera = p.viewer.camera;
      const frame = C.Transforms.eastNorthUpToFixedFrame(camera.positionWC);
      const inverse = C.Matrix4.inverseTransformation(frame, new C.Matrix4());
      const items = [];
      // チェックポイント（次＝黄・通過済み＝灰・その先＝白）
      cps.forEach((cp, k) => {
        const l = localOf(inverse, C.Cartesian3.fromDegrees(cp.lon, cp.lat, cp.height || 140));
        items.push({ kind: k < p.nextIndex ? "done" : k === p.nextIndex ? "next" : "later", x: l.x, y: l.y, z: l.z, n: k + 1, name: cp.name });
      });
      let opp = null;
      if (other.viewer && (other.connected || race.practice)) {
        const l = localOf(inverse, other.viewer.camera.positionWC);
        opp = { kind: "opp", x: l.x, y: l.y, z: l.z, color: other.color, id: other.id };
        items.push(opp);
      }
      // 表示範囲：次のチェックポイントと相手が入る最小の段階
      let need = 0;
      items.forEach((it) => { if (it.kind === "next" || it.kind === "opp") need = Math.max(need, Math.hypot(it.x, it.y)); });
      const range = RANGES.find((r) => r >= need) || RANGES[RANGES.length - 1];
      const canvas = p.rrScope.firstChild, ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 280, 280);
      ctx.lineWidth = 2; ctx.strokeStyle = "#7cc9aa88";
      for (const radius of [52, 104]) { ctx.beginPath(); ctx.arc(140, 140, radius, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(36, 140); ctx.lineTo(244, 140); ctx.moveTo(140, 36); ctx.lineTo(140, 244); ctx.stroke();
      ctx.fillStyle = "#d1e9df"; ctx.font = "22px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("前", 140, 25); ctx.fillText("後", 140, 275); ctx.fillText("左", 16, 148); ctx.fillText("右", 264, 148);
      ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(140, 128); ctx.lineTo(133, 148); ctx.lineTo(147, 148); ctx.closePath(); ctx.fill();
      const order = ["done", "later", "next", "opp"]; // 上に描くものを後に
      items.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      items.forEach((it) => {
        const pt = T.scopePoint(it.x, it.y, camera.heading, range);
        const x = 140 + pt.x * 96, y = 140 + pt.y * 96;
        if (it.kind === "opp") {
          ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif"; ctx.fillText("P" + it.id, x, y - 11);
          return;
        }
        const col = it.kind === "next" ? "#ffd166" : it.kind === "done" ? "#8a8f95" : "#ffffff";
        const rad = it.kind === "next" ? 9 : 5;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
        if (pt.outside) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = it.kind === "next" ? "#10233a" : "#10233a"; ctx.font = "bold 12px sans-serif"; ctx.fillText(String(it.n), x, y + 4);
      });
      // 文字：次の地点と相手
      const next = items.find((it) => it.kind === "next");
      const lines = [];
      if (next) {
        const d = Math.hypot(next.x, next.y);
        lines.push("つぎ " + next.n + " " + next.name.slice(0, 10) + " " + (d >= 1000 ? (d / 1000).toFixed(1) + "km" : Math.round(d) + "m") + (next.z >= 0 ? " ↑" : " ↓") + Math.abs(Math.round(next.z)) + "m");
      } else lines.push("ゴール済み");
      if (opp) {
        const d = Math.hypot(opp.x, opp.y);
        lines.push("P" + opp.id + " " + (d >= 1000 ? (d / 1000).toFixed(1) + "km" : Math.round(d) + "m") + (opp.z >= 0 ? " 上" : " 下") + Math.abs(Math.round(opp.z)) + "m");
      }
      lines.push("表示 " + (range >= 1000 ? (range / 1000) + "km" : range + "m"));
      p.rrScope.lastChild.textContent = lines.join("\n");
    });
  }

  const origRender = T.render, origClear = T.clear, origReset = T.reset;
  T.render = function (players, race) {
    const r = origRender.apply(this, arguments);
    try {
      if (race && race.mode !== "tag" && players && players.length === 2) { ensure(players, race); draw(players, race); }
      else remove(players);
    } catch (e) { /* レーダーの不具合でレースを止めない */ }
    return r;
  };
  T.clear = function (players) { remove(players); return origClear.apply(this, arguments); };
  T.reset = function (players, race) { if (race && race.mode === "tag") remove(players); return origReset.apply(this, arguments); };
  window.RaceRadar = { ensure, remove, draw };
})();
