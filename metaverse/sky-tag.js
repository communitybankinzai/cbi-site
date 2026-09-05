(function (root) {
  "use strict";
  const DURATION = 120000, RANGE = 350, HOLD = 3, ANGLE = 7 * Math.PI / 180;
  let modelUri;
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
      player.tagLock = 0;
      player.tagCooldown = 3;
    }
  }
  // A small solid glTF, authored with a forked tail and swept, fingered wings.
  // +X is forward; glTF +Y is up. No billboard: rear and side views have real depth.
  function birdModel() {
    if (modelUri) return modelUri;
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
    solid([[1.9, 0, 0], [0.6, 0, 0.42], [-1.5, 0, 0.24], [-1.5, 0, -0.24], [0.6, 0, -0.42]], 0.32, [0.36, 0.24, 0.14]);
    for (const side of [-1, 1]) {
      const wing = [[0.7, 0, 0.25], [0.8, 0.08, 1.8], [0, 0.12, 3.8], [-0.8, 0.18, 6],
        [-1.05, 0.15, 5.8], [-0.75, 0.12, 4.9], [-1.3, 0.12, 5.5], [-1.1, 0.1, 4.5],
        [-1.65, 0.1, 5], [-1.4, 0.08, 3.9], [-1.8, 0.08, 4.3], [-1.4, 0, 2], [-0.7, 0, 0.3]];
      solid(wing.map(p => [p[0], p[1], p[2] * side]), 0.055, [0.29, 0.19, 0.11]);
      solid([[-1, 0, side * 0.16], [-3, 0, side * 1.15], [-2.3, 0, 0]], 0.065, [0.44, 0.3, 0.17]);
      solid([[1.5, 0.08, side * 0.17], [2.2, 0, 0], [1.7, 0.12, 0]], 0.08, [0.75, 0.62, 0.3]);
    }
    const data = new Float32Array([...vertices, ...colors]);
    const bytes = new Uint8Array(data.buffer);
    let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
    const gltf = { asset: { version: "2.0" }, extensionsUsed: ["KHR_materials_unlit"],
      scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      buffers: [{ byteLength: bytes.length, uri: "data:application/octet-stream;base64," + btoa(binary) }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.length * 4 },
        { buffer: 0, byteOffset: vertices.length * 4, byteLength: colors.length * 4 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: vertices.length / 3, type: "VEC3", min: [-3, -0.4, -6], max: [2.2, 0.4, 6] },
        { bufferView: 1, componentType: 5126, count: colors.length / 4, type: "VEC4" }],
      materials: [{ doubleSided: true, extensions: { KHR_materials_unlit: {} } }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, material: 0 }] }] };
    modelUri = "data:model/gltf+json;base64," + btoa(JSON.stringify(gltf));
    return modelUri;
  }
  function clear(players) {
    players.forEach(p => {
      if (p.tagEntity && p.viewer) p.viewer.entities.remove(p.tagEntity);
      if (p.tagReticle) p.tagReticle.remove();
      p.tagEntity = null; p.tagReticle = null;
    });
  }
  function reset(players, race) {
    clear(players);
    players.forEach(p => { p.tagScore = 0; p.tagLock = 0; p.tagCooldown = 0; });
    if (race.mode !== "tag") return;
    const C = Cesium;
    players.forEach((p, i) => {
      const other = players[1 - i];
      p.viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(140.115, 35.805 + i * 0.001, 240),
        orientation: { heading: 0, pitch: 0, roll: 0 } });
      p.tagEntity = p.viewer.entities.add({
        position: new C.CallbackProperty(() => other.viewer.camera.positionWC, false),
        orientation: new C.CallbackProperty(() => C.Transforms.headingPitchRollQuaternion(other.viewer.camera.positionWC,
          new C.HeadingPitchRoll(other.viewer.camera.heading - Math.PI / 2, other.viewer.camera.pitch, -other.input.rx * 0.45)), false),
        model: { uri: birdModel(), minimumPixelSize: 0 },
        point: { pixelSize: 5, color: C.Color.fromCssColorString(other.color),
          distanceDisplayCondition: new C.DistanceDisplayCondition(250, 10000) },
        label: { text: "P" + other.id, font: "14px sans-serif", fillColor: C.Color.fromCssColorString(other.color),
          showBackground: true, pixelOffset: new C.Cartesian2(0, -22),
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 10000) }
      });
      const ring = document.createElement("div");
      ring.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px solid #ffffff88;border-radius:50%;pointer-events:none;box-sizing:border-box;z-index:4";
      p.viewer.container.appendChild(ring); p.tagReticle = ring;
    });
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
      const ring = p.tagReticle;
      if (!ring) return;
      const height = p.viewer.container.clientHeight;
      const size = height * Math.tan(ANGLE) / Math.tan(p.viewer.camera.frustum.fovy / 2);
      ring.style.width = size + "px"; ring.style.height = size + "px";
      ring.style.borderColor = p.tagCooldown > 0 ? "#ffd45b" : p.tagLock > 0 ? "#70efb4" : "#ffffff88";
      ring.style.background = p.tagLock > 0 ? "rgba(80,220,140,0.08)" : "transparent";
    });
  }
  function status(p, race) {
    if (race.practice && p.id === 2) return "練習ターゲット";
    if (p.tagCooldown > 0) return "捕まえた！ +1";
    if (p.tagLock > 0) return "捕捉 " + p.tagLock.toFixed(1) + " / 3.0秒";
    const r = p.tagRelative;
    if (!r) return "相手を探索中";
    const direction = r.dot < 0 ? "後ろ" : Math.abs(r.side) > 0.12 ? r.side > 0 ? "右" : "左" : Math.abs(r.up) > 0.12 ? r.up > 0 ? "上" : "下" : "正面";
    return "相手 " + direction + " " + Math.round(r.distance) + "m";
  }
  root.SkyTag = { reset, clear, tick, render, status, canLock, advance, birdModel };
})(typeof window !== "undefined" ? window : globalThis);
