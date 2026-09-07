(function (root) {
  "use strict";
  const DURATION = 120000, RANGE = 350, HOLD = 3, ANGLE = 7 * Math.PI / 180;
  const modelUris = {};
  function canLock(distance, forwardDot) {
    return distance >= 8 && distance <= RANGE && forwardDot >= Math.cos(ANGLE);
  }
  function advance(player, eligible, dt) {
    if (player.tagCooldown > 0) {
      player.tagCooldown = Math.max(0, player.tagCooldown - dt);
      player.tagLock = 0;
      return;
    }
    player.tagLock = eligible ? player.tagLock + dt : 0;
    if (player.tagLock >= HOLD) {
      player.tagScore++;
      player.tagFeedback = "照準成功 +1";
      player.tagLock = 0;
      player.tagCooldown = 3;
    }
  }
  // A small solid glTF, authored with a forked tail and swept, fingered wings.
  // +X is forward; glTF +Y is up. No billboard: rear and side views have real depth.
  function birdModel(kind = "kite") {
    if (modelUris[kind]) return modelUris[kind];
    const swan = kind === "swan";
    const vertices = [], colors = [];
    function tri(a, b, c, color) {
      for (const v of [a, b, c]) { vertices.push(...v); colors.push(...color, 1); }
    }
    function solid(outline, thickness, color) {
      const center = outline.reduce((sum, p) => sum.map((v, i) => v + p[i] / outline.length), [0, 0, 0]);
      const top = p => [p[0], p[1] + thickness, p[2]];
      const bottom = p => [p[0], p[1] - thickness, p[2]];
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        tri(top(center), top(a), top(b), color);
        tri(bottom(center), bottom(b), bottom(a), color.map(v => v * 0.65));
        tri(top(a), bottom(a), bottom(b), color);
        tri(top(a), bottom(b), top(b), color);
      }
    }
    function surface(sample, rows, columns, color) {
      function vertex(i, j) { return sample(i / rows, j / columns); }
      function face(a, b, c) {
        for (const v of [a, b, c]) {
          vertices.push(...v.p);
          colors.push(...color.map(channel => channel * v.shade), 1);
        }
      }
      for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
        const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i + 1, j + 1), d = vertex(i, j + 1);
        face(a, b, c); face(a, c, d);
      }
    }
    function oval(center, radius, color, rows = 12, columns = 20) {
      surface((u, v) => {
        const latitude = Math.PI * u, longitude = 2 * Math.PI * v;
        const n = [Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude), Math.sin(latitude) * Math.cos(longitude)];
        return { p: center.map((c, i) => c + radius[i] * n[i]), shade: 0.66 + 0.3 * Math.max(0, n[1]) + 0.12 * n[2] };
      }, rows, columns, color);
    }
    function feather(base, tip, width, color) {
      const dx = tip[0] - base[0], dz = tip[2] - base[2], length = Math.hypot(dx, dz);
      surface((u, v) => {
        const angle = 2 * Math.PI * v, spread = Math.pow(Math.sin(Math.PI * u), 0.6);
        const across = Math.cos(angle) * width * spread;
        return { p: [base[0] + dx * u - dz / length * across,
          base[1] + (tip[1] - base[1]) * u + Math.sin(angle) * 0.045 * spread + 0.06 * Math.sin(Math.PI * u),
          base[2] + dz * u + dx / length * across],
          shade: (0.78 + 0.2 * Math.sin(angle)) * (u > 0.86 ? 0.66 : 1) * (1 - 0.09 * Math.pow(Math.sin(u * Math.PI * 7), 8)) };
      }, 12, 8, color);
    }
    if (swan) {
      oval([-0.25, 0, 0], [1.7, 0.66, 0.65], [0.96, 0.97, 1]);
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        oval([0.85 + t * 2.6, 0.14 + Math.sin(t * Math.PI) * 0.2, 0], [0.3, 0.2 - t * 0.05, 0.2 - t * 0.05], [0.98, 0.98, 1], 8, 12);
      }
      oval([3.65, 0.2, 0], [0.42, 0.3, 0.25], [1, 1, 1]);
      oval([4.05, 0.1, 0], [0.32, 0.12, 0.14], [0.95, 0.66, 0.13]);
      oval([4.27, 0.085, 0], [0.14, 0.08, 0.12], [0.07, 0.07, 0.08]);
    } else {
    oval([-0.15, 0, 0], [1.5, 0.52, 0.48], [0.46, 0.32, 0.19]);
    oval([1.05, 0.12, 0], [0.65, 0.4, 0.32], [0.52, 0.39, 0.25]);
    oval([1.62, 0.21, 0], [0.43, 0.36, 0.3], [0.62, 0.5, 0.34]);
    oval([1.97, 0.14, 0], [0.31, 0.15, 0.15], [0.49, 0.44, 0.29]);
    oval([2.13, 0.035, 0], [0.11, 0.16, 0.09], [0.18, 0.16, 0.12]);
    }
    for (const side of [-1, 1]) {
      if (swan) {
        oval([3.77, 0.29, side * 0.22], [0.05, 0.05, 0.025], [0.03, 0.03, 0.035], 8, 12);
      } else {
      oval([1.71, 0.29, side * 0.264], [0.09, 0.085, 0.045], [0.95, 0.63, 0.16], 8, 12);
      oval([1.735, 0.3, side * 0.3], [0.046, 0.052, 0.019], [0.045, 0.038, 0.03], 8, 12);
      }
      oval([0.15, 0.07, side * 1.7], [0.66, 0.17, 1.75], swan ? [0.94, 0.96, 1] : [0.4, 0.29, 0.18]);
      // Overlapping secondaries, separated finger-like primaries, and shorter coverts.
      for (let i = 0; i < 13; i++) {
        const z = 0.45 + i * 0.235;
        feather([0.5 - i * 0.035, 0.04, side * z], [-1.3 - i * 0.022, -0.04, side * (z + 0.26)], 0.2, swan ? [0.93, 0.95, 0.99] : [0.47, 0.34, 0.21]);
        feather([0.6 - i * 0.035, 0.21, side * z], [-0.45 - i * 0.026, 0.15, side * (z + 0.17)], 0.18, swan ? [1, 1, 1] : [0.53, 0.4, 0.25]);
      }
      for (let i = 0; i < 7; i++) {
        feather([0.18 - i * 0.14, 0.1, side * (2.75 + i * 0.15)],
          [0.5 - i * 0.42, 0.26 - i * 0.025, side * (5.7 - Math.abs(i - 2) * 0.18)], 0.23, swan ? [0.94, 0.96, 1] : [0.35, 0.25, 0.16]);
      }
      for (let i = 0; i < 5; i++) {
        feather([-1.05, -0.03, side * (0.035 + i * 0.065)], [swan ? -2.8 + i * 0.12 : -2.55 - i * 0.16, -0.02, side * (0.08 + i * 0.245)], 0.18, swan ? [0.97, 0.98, 1] : [0.5, 0.35, 0.21]);
      }
    }
    const data = new Float32Array([...vertices, ...colors]);
    const bytes = new Uint8Array(data.buffer);
    let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
    const gltf = { asset: { version: "2.0" }, extensionsUsed: ["KHR_materials_unlit"],
      scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      buffers: [{ byteLength: bytes.length, uri: "data:application/octet-stream;base64," + btoa(binary) }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.length * 4 },
        { buffer: 0, byteOffset: vertices.length * 4, byteLength: colors.length * 4 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: vertices.length / 3, type: "VEC3",
        min: [0, 1, 2].map(axis => vertices.reduce((min, v, i) => i % 3 === axis ? Math.min(min, v) : min, Infinity)),
        max: [0, 1, 2].map(axis => vertices.reduce((max, v, i) => i % 3 === axis ? Math.max(max, v) : max, -Infinity)) },
        { bufferView: 1, componentType: 5126, count: colors.length / 4, type: "VEC4" }],
      materials: [{ doubleSided: true, extensions: { KHR_materials_unlit: {} } }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, material: 0 }] }] };
    modelUris[kind] = "data:model/gltf+json;base64," + btoa(JSON.stringify(gltf));
    return modelUris[kind];
  }
  function clear(players) {
    players.forEach(p => {
      if (p.tagEntity && p.viewer) p.viewer.entities.remove(p.tagEntity);
      if (p.tagReticle) p.tagReticle.remove();
      if (p.tagScope) p.tagScope.remove();
      p.tagScope = null;
      p.tagEntity = null; p.tagReticle = null;
    });
  }
  function reset(players, race) {
    clear(players);
    race.tagTouchLatched = false;
    players.forEach(p => { p.tagScore = 0; p.tagLock = 0; p.tagCooldown = 0; p.tagFeedback = ""; });
    if (race.mode !== "tag") return;
    const C = Cesium;
    players.forEach((p, i) => {
      const other = players[1 - i];
      p.viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(140.115, 35.805 + i * 0.001, 240),
        orientation: { heading: 0, pitch: 0, roll: 0 } });
      p.tagEntity = p.viewer.entities.add({
        position: new C.CallbackProperty(() => other.viewer.camera.positionWC, false),
        orientation: new C.CallbackProperty(() => {
          const camera = other.viewer.camera, matrix = new C.Matrix3();
          // Cesium's glTF axis correction maps the authored +X nose to local +Y.
          C.Matrix3.setColumn(matrix, 0, camera.rightWC, matrix);
          C.Matrix3.setColumn(matrix, 1, camera.directionWC, matrix);
          C.Matrix3.setColumn(matrix, 2, camera.upWC, matrix);
          return C.Quaternion.fromRotationMatrix(matrix);
        }, false),
        model: { uri: birdModel(other.aircraft), minimumPixelSize: 0 },
        point: { pixelSize: 5, color: C.Color.fromCssColorString(other.color),
          distanceDisplayCondition: new C.DistanceDisplayCondition(250, 10000) },
        label: { text: "P" + other.id, font: "14px sans-serif", fillColor: C.Color.fromCssColorString(other.color),
          showBackground: true, pixelOffset: new C.Cartesian2(0, -22),
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 10000) }
      });
      const ring = document.createElement("div");
      ring.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px solid #ffffff88;border-radius:50%;pointer-events:none;box-sizing:border-box;z-index:4";
      const progress = document.createElement("div");
      progress.style.cssText = "position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);width:160px;max-width:42vw;text-align:center;color:#fff;font:bold 14px sans-serif;text-shadow:0 1px 4px #000;background:#07140fdd;border-radius:4px;padding:5px;box-sizing:border-box";
      ring.appendChild(progress);
      p.viewer.container.appendChild(ring); p.tagReticle = ring;
      const scope = document.createElement("div");
      scope.className = "tagScope";
      scope.style.cssText = "position:absolute;right:8px;bottom:32px;width:clamp(88px,30%,140px);z-index:5;pointer-events:none;color:#fff;font:12px sans-serif;text-align:center;background:#081714d9;border-radius:6px;padding:5px;box-sizing:border-box";
      const canvas = document.createElement("canvas");
      canvas.width = 280; canvas.height = 280;
      canvas.style.cssText = "display:block;width:100%;aspect-ratio:1";
      const readout = document.createElement("div");
      readout.style.cssText = "line-height:1.4;overflow-wrap:anywhere;white-space:pre-line";
      scope.append(canvas, readout); p.viewer.container.appendChild(scope);
      p.tagScope = scope;
    });
  }
  function scopePoint(east, north, heading, range) {
    const right = east * Math.cos(heading) - north * Math.sin(heading);
    const forward = east * Math.sin(heading) + north * Math.cos(heading);
    const distance = Math.hypot(right, forward);
    const divisor = Math.max(range, distance);
    return { x: right / divisor, y: -forward / divisor, outside: distance > range };
  }
  function drawScope(p, other) {
    if (!p.tagScope) return;
    const C = Cesium, camera = p.viewer.camera;
    const frame = C.Transforms.eastNorthUpToFixedFrame(camera.positionWC);
    const inverse = C.Matrix4.inverseTransformation(frame, new C.Matrix4());
    const local = C.Matrix4.multiplyByPoint(inverse, other.viewer.camera.positionWC, new C.Cartesian3());
    const horizontal = Math.hypot(local.x, local.y);
    const range = horizontal <= 500 ? 500 : horizontal <= 1000 ? 1000 : 2000;
    const point = scopePoint(local.x, local.y, camera.heading, range);
    const altitude = C.Cartographic.fromCartesian(other.viewer.camera.positionWC).height - C.Cartographic.fromCartesian(camera.positionWC).height;
    const color = p.tagLock > 0 ? "#70efb4" : other.color;
    const canvas = p.tagScope.firstChild, ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 280, 280);
    ctx.lineWidth = 2; ctx.strokeStyle = "#7cc9aa88";
    for (const radius of [52, 104]) { ctx.beginPath(); ctx.arc(140, 140, radius, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(36, 140); ctx.lineTo(244, 140); ctx.moveTo(140, 36); ctx.lineTo(140, 244); ctx.stroke();
    ctx.fillStyle = "#d1e9df"; ctx.font = "22px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("前", 140, 25); ctx.fillText("後", 140, 275);
    ctx.fillText("左", 16, 148); ctx.fillText("右", 264, 148);
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.moveTo(140, 128); ctx.lineTo(133, 148); ctx.lineTo(147, 148); ctx.closePath(); ctx.fill();
    const x = 140 + point.x * 96, y = 140 + point.y * 96;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    if (p.tagLock > 0) { ctx.beginPath(); ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.tagLock / HOLD); ctx.stroke(); }
    const distance = Math.round(p.tagRelative.distance);
    p.tagScope.lastChild.textContent = "P" + other.id + " · " + distance + "m\n" + (altitude >= 0 ? "上 " : "下 ") + Math.abs(Math.round(altitude)) + "m · " + (range / 1000) + "km" + (point.outside ? " 圏外" : "");
    p.tagScope.setAttribute("aria-label", "索敵スコープ " + status(p, {}) + " 高度差 " + Math.round(altitude) + "m");
  }
  function relative(p, other) {
    const C = Cesium, cam = p.viewer.camera;
    const vector = C.Cartesian3.subtract(other.viewer.camera.positionWC, cam.positionWC, new C.Cartesian3());
    const distance = C.Cartesian3.magnitude(vector);
    const direction = distance > 0 ? C.Cartesian3.divideByScalar(vector, distance, vector) : vector;
    return { distance, dot: C.Cartesian3.dot(direction, cam.directionWC),
      side: C.Cartesian3.dot(direction, cam.rightWC), up: C.Cartesian3.dot(direction, cam.upWC) };
  }
  function tick(players, race, dt, elapsed) {
    if (elapsed >= DURATION) return true;
    const separation = relative(players[0], players[1]).distance;
    if (separation > 12) race.tagTouchLatched = false;
    if (separation <= 8 && !race.tagTouchLatched && players[0].connected && (players[1].connected || race.practice)) {
      race.tagTouchLatched = true;
      players.forEach((p, i) => {
        if (race.practice && i === 1) return;
        p.tagScore++; p.tagLock = 0; p.tagCooldown = 3;
        p.tagFeedback = "タッチ！ +1";
      });
      return false;
    }
    players.forEach((p, i) => {
      const other = players[1 - i], rel = relative(p, other);
      advance(p, p.connected && (other.connected || race.practice) && !(race.practice && i === 1) && canLock(rel.distance, rel.dot), dt);
    });
    return false;
  }
  function render(players, race) {
    if (race.mode !== "tag") return;
    players.forEach((p, i) => {
      p.tagRelative = relative(p, players[1 - i]);
      drawScope(p, players[1 - i]);
      const ring = p.tagReticle;
      if (!ring) return;
      const height = p.viewer.container.clientHeight;
      const size = height * Math.tan(ANGLE) / Math.tan(p.viewer.camera.frustum.fovy / 2);
      ring.style.width = size + "px"; ring.style.height = size + "px";
      ring.style.borderColor = p.tagCooldown > 0 ? "#ffd45b" : p.tagLock > 0 ? "#70efb4" : "#ffffff88";
      ring.style.background = p.tagLock > 0 ? "rgba(80,220,140,0.08)" : "transparent";
      const progress = ring.firstChild;
      progress.textContent = p.tagCooldown > 0 ? p.tagFeedback : p.tagLock > 0 ? "捕捉 " + p.tagLock.toFixed(1) + " / 3.0秒" : "照準 0 / 3.0秒";
      progress.style.color = p.tagCooldown > 0 ? "#ffd45b" : p.tagLock > 0 ? "#70efb4" : "#d2ddd8";
      progress.style.fontSize = p.tagCooldown > 0 ? "18px" : "14px";
    });
  }
  function status(p, race) {
    if (race.practice && p.id === 2) return "練習ターゲット";
    if (p.tagCooldown > 0) return p.tagFeedback;
    if (p.tagLock > 0) return "捕捉 " + p.tagLock.toFixed(1) + " / 3.0秒";
    const r = p.tagRelative;
    if (!r) return "相手を探索中";
    const direction = r.dot < 0 ? "後ろ" : Math.abs(r.side) > 0.12 ? r.side > 0 ? "右" : "左" : Math.abs(r.up) > 0.12 ? r.up > 0 ? "上" : "下" : "正面";
    return "相手 " + direction + " " + Math.round(r.distance) + "m";
  }
  root.SkyTag = { reset, clear, tick, render, status, canLock, advance, birdModel, scopePoint };
})(typeof window !== "undefined" ? window : globalThis);
