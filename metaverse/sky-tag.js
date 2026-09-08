(function (root) {
  "use strict";
  const DURATION = 120000, RANGE = 350, HOLD = 2, ANGLE = 7 * Math.PI / 180;
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
    if (player.tagLock + 1e-9 >= HOLD) {
      player.tagScore++;
      player.tagFeedback = "タッチ！ +1";
      player.tagLock = 0;
      player.tagCooldown = 3;
    }
  }
  // A small solid glTF, authored with a forked tail and swept, fingered wings.
  // +X is forward; glTF +Y is up. No billboard: rear and side views have real depth.
  function birdModel(kind = "kite") {
    if (modelUris[kind]) return modelUris[kind];
    const swan = kind === "swan";
    const vertices = [], colors = [], normals = [], uvs = [], plumageIndices = [], bareIndices = [];
    const parts = {
      body: { pivot: [0, 0, 0], indices: [[], [], []] },
      neck: { pivot: [0.8, 0.1, 0], indices: [[], [], []] },
      leftWing: { pivot: [0.2, 0.08, 0.45], indices: [[], [], []] },
      rightWing: { pivot: [0.2, 0.08, -0.45], indices: [[], [], []] },
      tail: { pivot: [-1.05, -0.03, 0], indices: [[], [], []] }
    };
    let activePart = "body";
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
    function surface(sample, rows, columns, color, bare = false) {
      const material = bare === 2 ? 2 : bare ? 1 : 0;
      function vertex(i, j) { const u = i / rows, v = j / columns; return { ...sample(u, v), uv: sample(u, v).uv || [v, u] }; }
      function face(a, b, c) {
        const ab = b.p.map((value, i) => value - a.p[i]), ac = c.p.map((value, i) => value - a.p[i]);
        const cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
        const outward = cross.reduce((sum, value, i) => sum + value * (a.n[i] + b.n[i] + c.n[i]), 0);
        for (const v of outward < 0 ? [a, c, b] : [a, b, c]) {
          vertices.push(...v.p.map((coordinate, i) => coordinate - parts[activePart].pivot[i]));
          normals.push(...v.n);
          uvs.push(...v.uv);
          colors.push(...color.map((channel, i) => material === 1 || swan ? channel : Math.min(1, channel / [0.5, 0.36, 0.24][i])), 1);
          (bare ? bareIndices : plumageIndices).push(vertices.length / 3 - 1);
          parts[activePart].indices[material].push(vertices.length / 3 - 1);
        }
      }
      for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) {
        const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i + 1, j + 1), d = vertex(i, j + 1);
        face(a, b, c); face(a, c, d);
      }
    }
    function oval(center, radius, color, rows = 20, columns = 32) {
      surface((u, v) => {
        const latitude = Math.PI * u, longitude = 2 * Math.PI * v;
        const n = [Math.cos(latitude), Math.sin(latitude) * Math.sin(longitude), Math.sin(latitude) * Math.cos(longitude)];
        const normal = n.map((value, i) => value / radius[i]), length = Math.hypot(...normal);
        return { p: center.map((c, i) => c + radius[i] * n[i]), n: normal.map(v => v / length), uv: [v, u] };
      }, rows, columns, color, radius[0] < 0.35 ? true : 2);
    }
    function feather(base, tip, width, color) {
      const dx = tip[0] - base[0], dz = tip[2] - base[2], length = Math.hypot(dx, dz);
      surface((u, v) => {
        const angle = 2 * Math.PI * v, spread = Math.pow(Math.sin(Math.PI * u), 0.6);
        const across = Math.cos(angle) * width * spread;
        return { p: [base[0] + dx * u - dz / length * across,
          base[1] + (tip[1] - base[1]) * u + Math.sin(angle) * 0.014 * spread + 0.018 * Math.sin(Math.PI * u),
          base[2] + dz * u + dx / length * across],
          n: [-dz / length * Math.cos(angle), Math.sin(angle), dx / length * Math.cos(angle)],
          uv: [0.5 + Math.cos(angle) * 0.48, u] };
      }, 18, 12, color);
    }
    if (swan) {
      oval([-0.25, 0, 0], [1.85, 0.5, 0.58], [0.96, 0.97, 1]);
      activePart = "neck";
      surface((u, v) => {
        const angle = v * Math.PI * 2, radius = 0.27 - u * 0.14;
        return {p: [0.78 + u * 2.78, 0.14 + Math.sin(u * Math.PI) * 0.16 + Math.sin(angle) * radius, Math.cos(angle) * radius],
          n: [0, Math.sin(angle), Math.cos(angle)], uv: [v, u]};
      }, 32, 24, [0.98, 0.98, 1], 2);
      oval([3.65, 0.2, 0], [0.46, 0.24, 0.215], [1, 1, 1]);
      oval([4.05, 0.1, 0], [0.32, 0.12, 0.14], [0.95, 0.66, 0.13]);
      oval([4.27, 0.085, 0], [0.14, 0.08, 0.12], [0.07, 0.07, 0.08]);
    } else {
    oval([-0.15, 0, 0], [1.5, 0.52, 0.48], [0.46, 0.32, 0.19]);
    activePart = "neck";
    oval([1.05, 0.12, 0], [0.65, 0.4, 0.32], [0.52, 0.39, 0.25]);
    oval([1.62, 0.21, 0], [0.43, 0.36, 0.3], [0.62, 0.5, 0.34]);
    oval([1.97, 0.14, 0], [0.31, 0.15, 0.15], [0.49, 0.44, 0.29]);
    oval([2.13, 0.035, 0], [0.11, 0.16, 0.09], [0.18, 0.16, 0.12]);
    }
    for (const side of [-1, 1]) {
      activePart = "neck";
      if (swan) {
        oval([3.77, 0.29, side * 0.22], [0.05, 0.05, 0.025], [0.03, 0.03, 0.035], 8, 12);
      } else {
      oval([1.71, 0.29, side * 0.264], [0.09, 0.085, 0.045], [0.95, 0.63, 0.16], 8, 12);
      oval([1.735, 0.3, side * 0.3], [0.046, 0.052, 0.019], [0.045, 0.038, 0.03], 8, 12);
      }
      activePart = side === 1 ? "leftWing" : "rightWing";
      oval([0.15, 0.07, side * 1.7], [0.66, swan ? 0.085 : 0.17, 1.75], swan ? [0.94, 0.96, 1] : [0.4, 0.29, 0.18]);
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
        activePart = "tail";
        feather([-1.05, -0.03, side * (0.035 + i * 0.065)], [swan ? -2.8 + i * 0.12 : -2.55 - i * 0.16, -0.02, side * (0.08 + i * 0.245)], 0.18, swan ? [0.97, 0.98, 1] : [0.5, 0.35, 0.21]);
      }
    }
    const data = new Float32Array([...vertices, ...colors, ...normals, ...uvs, ...plumageIndices, ...bareIndices]);
    // Index arrays occupy the trailing bytes as uint32 rather than float32.
    const indexOffset = vertices.length + colors.length + normals.length + uvs.length;
    const integers = new Uint32Array(data.buffer);
    [...plumageIndices, ...bareIndices].forEach((index, i) => { integers[indexOffset + i] = index; });
    const bytes = new Uint8Array(data.buffer);
    let binary = ""; for (const b of bytes) binary += String.fromCharCode(b);
    const gltf = { asset: { version: "2.0", generator: "CBI feather study" },
      scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
      buffers: [{ byteLength: bytes.length, uri: "data:application/octet-stream;base64," + btoa(binary) }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: vertices.length * 4 },
        { buffer: 0, byteOffset: vertices.length * 4, byteLength: colors.length * 4 },
        { buffer: 0, byteOffset: (vertices.length + colors.length) * 4, byteLength: normals.length * 4 },
        { buffer: 0, byteOffset: (vertices.length + colors.length + normals.length) * 4, byteLength: uvs.length * 4 },
        { buffer: 0, byteOffset: indexOffset * 4, byteLength: plumageIndices.length * 4 },
        { buffer: 0, byteOffset: (indexOffset + plumageIndices.length) * 4, byteLength: bareIndices.length * 4 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: vertices.length / 3, type: "VEC3",
        min: [0, 1, 2].map(axis => vertices.reduce((min, v, i) => i % 3 === axis ? Math.min(min, v) : min, Infinity)),
        max: [0, 1, 2].map(axis => vertices.reduce((max, v, i) => i % 3 === axis ? Math.max(max, v) : max, -Infinity)) },
        { bufferView: 1, componentType: 5126, count: colors.length / 4, type: "VEC4" },
        { bufferView: 2, componentType: 5126, count: normals.length / 3, type: "VEC3" },
        { bufferView: 3, componentType: 5126, count: uvs.length / 2, type: "VEC2" },
        { bufferView: 4, componentType: 5125, count: plumageIndices.length, type: "SCALAR" },
        { bufferView: 5, componentType: 5125, count: bareIndices.length, type: "SCALAR" }],
      images: [{ uri: new URL("assets/tonbi/" + kind + "-feather.png", typeof location === "undefined" ? "https://communitybankinzai.github.io/cbi-site/metaverse/" : location.href).href },
        { uri: new URL("assets/tonbi/" + kind + "-normal.png", typeof location === "undefined" ? "https://communitybankinzai.github.io/cbi-site/metaverse/" : location.href).href }],
      samplers: [{ wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987 }],
      textures: [{ source: 0, sampler: 0 }, { source: 1, sampler: 0 }],
      materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.88 }, normalTexture: { index: 1, scale: 0.5 } },
        { doubleSided: true, pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.36 } }],
      meshes: [{ primitives: [0, 1].map(material => ({ attributes: { POSITION: 0, COLOR_0: 1, NORMAL: 2, TEXCOORD_0: 3 }, indices: 4 + material, material })) }] };
    gltf.images.push({uri: new URL("assets/tonbi/" + kind + (swan ? "-plumage.png" : "-body.png"), typeof location === "undefined" ? "https://communitybankinzai.github.io/cbi-site/metaverse/" : location.href).href});
    gltf.textures.push({source: 2, sampler: 0});
    gltf.materials.push({doubleSided: true, pbrMetallicRoughness: {baseColorTexture: {index: 2}, metallicFactor: 0, roughnessFactor: 0.95}});
    const chunks = [bytes];
    let offset = bytes.length;
    function append(values, componentType, type, width) {
      const raw = new Uint8Array(values.buffer);
      const view = gltf.bufferViews.length;
      gltf.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: raw.length});
      offset += raw.length; chunks.push(raw);
      const accessor = {bufferView: view, componentType, count: values.length / width, type};
      if (type === "SCALAR") { accessor.min = [Math.min(...values)]; accessor.max = [Math.max(...values)]; }
      gltf.accessors.push(accessor);
      return gltf.accessors.length - 1;
    }
    gltf.meshes = [];
    gltf.nodes = [{name: kind, children: []}];
    Object.entries(parts).forEach(([name, part]) => {
      const mesh = gltf.meshes.length;
      gltf.meshes.push({name, primitives: part.indices.map((indices, material) => indices.length ? {
        attributes: { POSITION: 0, COLOR_0: 1, NORMAL: 2, TEXCOORD_0: 3 },
        indices: append(new Uint32Array(indices), 5125, "SCALAR", 1), material
      } : null).filter(Boolean)});
      gltf.nodes[0].children.push(gltf.nodes.length);
      gltf.nodes.push({name, mesh, translation: part.pivot});
    });
    const times = append(new Float32Array([0, 0.35, 0.7, 1.05, 1.4]), 5126, "SCALAR", 1);
    const samplers = [], channels = [];
    [[3, -1], [4, 1], [5, 0.08]].forEach(([node, side]) => {
      const rotations = [0, 0.52, 0, -0.25, 0].flatMap(angle => [Math.sin(angle * side / 2), 0, 0, Math.cos(angle * side / 2)]);
      channels.push({sampler: samplers.length, target: {node, path: "rotation"}});
      samplers.push({input: times, output: append(new Float32Array(rotations), 5126, "VEC4", 4), interpolation: "LINEAR"});
    });
    gltf.animations = [{name: "Wingbeat", samplers, channels}];
    if (swan) {
      // Smooth spanwise deformation avoids hinges and detached rigid feather strips.
      const targets = [0, 1, 2].map(mode => {
        const dp = new Float32Array(vertices.length), dn = new Float32Array(normals.length);
        for (let j = 0; j < vertices.length; j += 3) {
          const x = vertices[j], z = vertices[j + 2], span = Math.abs(z), side = Math.sign(z);
          const r = Math.min(1, span / 5.2), bend = r * r;
          if (mode === 0) {
            dp[j + 1] = 1.15 * bend;
            const slope = 2.3 * r / 5.2 * side;
            const n = [normals[j], normals[j + 1], normals[j + 2] - slope * normals[j + 1]];
            const len = Math.hypot(...n) || 1;
            n.forEach((v, axis) => { dn[j + axis] = v / len - normals[j + axis]; });
          } else if (mode === 1) {
            dp[j] = -0.65 * bend; dp[j + 2] = -side * 0.48 * bend;
          } else {
            dp[j + 1] = -0.22 * x * bend;
            const n = [normals[j] + 0.22 * bend * normals[j + 1], normals[j + 1], normals[j + 2]];
            const len = Math.hypot(...n) || 1;
            n.forEach((v, axis) => { dn[j + axis] = v / len - normals[j + axis]; });
          }
        }
        return {POSITION: append(dp, 5126, "VEC3", 3), NORMAL: append(dn, 5126, "VEC3", 3)};
      });
      const frames = 33, duration = 2.2;
      const time = append(Float32Array.from({length: frames}, (_, i) => duration * i / (frames - 1)), 5126, "SCALAR", 1);
      gltf.animations[0] = {name: "Wingbeat", samplers: [], channels: []};
      const clip = gltf.animations[0];
      for (const [node, sign] of [[3, -1], [4, 1]]) {
        const mesh = gltf.meshes[gltf.nodes[node].mesh];
        mesh.weights = [0, 0, 0];
        mesh.primitives.forEach(p => { p.targets = targets; });
        const rotations = [], weights = [];
        for (let i = 0; i < frames; i++) {
          const phase = Math.PI * 2 * i / (frames - 1);
          const angle = sign * 0.48 * Math.sin(phase);
          rotations.push(Math.sin(angle / 2), 0, 0, Math.cos(angle / 2));
          weights.push(0.8 * Math.sin(phase - 0.7), Math.max(0, Math.cos(phase)) * 0.75, Math.sin(phase - 1.05));
        }
        for (const [path, values, type, width] of [["rotation", rotations, "VEC4", 4], ["weights", weights, "SCALAR", 1]]) {
          clip.channels.push({sampler: clip.samplers.length, target: {node, path}});
          clip.samplers.push({input: time, output: append(new Float32Array(values), 5126, type, width), interpolation: "LINEAR"});
        }
      }
    }
    binary = "";
    for (const chunk of chunks) for (const value of chunk) binary += String.fromCharCode(value);
    gltf.buffers[0] = {byteLength: offset, uri: "data:application/octet-stream;base64," + btoa(binary)};
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
  function aircraftUri(kind) {
    return "assets/tonbi/" + (kind === "kite" ? "kite" : "swan") + ".glb?v=20260908-4";
  }
  function placeAtStart(player) {
    const halfSeparationDegrees = 300 / 111000;
    const first = player.id === 1;
    player.viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(140.115, 35.805 + (first ? -1 : 1) * halfSeparationDegrees, 240),
      orientation: { heading: first ? 0 : Math.PI, pitch: 0, roll: 0 } });
  }
  function reset(players, race) {
    clear(players);
    race.tagTouchLatched = false;
    players.forEach(p => { p.tagScore = 0; p.tagLock = 0; p.tagCooldown = 0; p.tagTaggedFor = 0; p.tagFeedback = ""; });
    if (race.mode !== "tag") return;
    const C = Cesium;
    players.forEach((p, i) => {
      const other = players[1 - i];
      placeAtStart(p);
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
        model: { uri: aircraftUri(other.aircraft), minimumPixelSize: 0, runAnimations: false },
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
      const guidance = document.createElement("div");
      guidance.className = "tagGuidance";
      guidance.style.cssText = "position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:190px;max-width:42vw;white-space:pre-line;text-align:center;color:#fff;font:bold 13px/1.5 sans-serif;text-shadow:0 1px 3px #000;background:#07140fe8;padding:5px;box-sizing:border-box;border-radius:4px";
      ring.appendChild(guidance);
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
  function targetGuidance(rel, altitude, heightDifference) {
    const horizontal = rel.side > 0.025 ? "→ 右" : rel.side < -0.025 ? "← 左" : "左右中央";
    const vertical = rel.up > 0.025 ? "↑ 上" : rel.up < -0.025 ? "↓ 下" : "上下中央";
    const front = rel.dot < 0 ? "後方・反転 " : "";
    return front + horizontal + "  " + vertical + "\n高度 " + Math.round(altitude) + "m / 差 " + (heightDifference >= 0 ? "+" : "") + Math.round(heightDifference) + "m\n距離 " + Math.round(rel.distance) + "m";
  }
  function tick(players, race, dt, elapsed) {
    if (elapsed >= DURATION) return true;
    players.forEach(p => { p.tagTaggedFor = Math.max(0, (p.tagTaggedFor || 0) - dt); });
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
      const score = p.tagScore;
      advance(p, p.connected && (other.connected || race.practice) && !(race.practice && i === 1) && canLock(rel.distance, rel.dot), dt);
      if (p.tagScore > score) other.tagTaggedFor = 3;
    });
    return false;
  }
  function render(players, race) {
    if (race.mode !== "tag") return;
    players.forEach((p, i) => {
      p.tagRelative = relative(p, players[1 - i]);
      const other = players[1 - i];
      if (p.tagEntity) p.tagEntity.model.runAnimations = ["setup", "countdown", "running"].includes(race.state) && !race.paused;
      drawScope(p, players[1 - i]);
      const ring = p.tagReticle;
      if (!ring) return;
      const targetAltitude = Cesium.Cartographic.fromCartesian(other.viewer.camera.positionWC).height;
      const ownAltitude = Cesium.Cartographic.fromCartesian(p.viewer.camera.positionWC).height;
      const warning = p.tagTaggedFor > 0 ? "タッチされました！" : other.tagLock > 0 ? "⚠ 捕捉されています " + other.tagLock.toFixed(1) + " / 2.0秒" : "";
      ring.lastChild.textContent = targetGuidance(p.tagRelative, targetAltitude, targetAltitude - ownAltitude) + (warning ? "\n" + warning : "");
      ring.lastChild.style.background = warning ? "#742718ed" : "#07140fe8";
      const height = p.viewer.container.clientHeight;
      const size = height * Math.tan(ANGLE) / Math.tan(p.viewer.camera.frustum.fovy / 2);
      ring.style.width = size + "px"; ring.style.height = size + "px";
      ring.style.borderColor = p.tagCooldown > 0 ? "#ffd45b" : p.tagLock > 0 ? "#70efb4" : "#ffffff88";
      ring.style.background = p.tagLock > 0 ? "rgba(80,220,140,0.08)" : "transparent";
      const progress = ring.firstChild;
      progress.textContent = p.tagCooldown > 0 ? p.tagFeedback : p.tagLock > 0 ? "捕捉 " + p.tagLock.toFixed(1) + " / 2.0秒" : "照準 0 / 2.0秒";
      progress.style.color = p.tagCooldown > 0 ? "#ffd45b" : p.tagLock > 0 ? "#70efb4" : "#d2ddd8";
      progress.style.fontSize = p.tagCooldown > 0 ? "18px" : "14px";
    });
  }
  function status(p, race) {
    if (race.practice && p.id === 2) return "練習ターゲット";
    if (p.tagCooldown > 0) return p.tagFeedback;
    if (p.tagLock > 0) return "捕捉 " + p.tagLock.toFixed(1) + " / 2.0秒";
    const r = p.tagRelative;
    if (!r) return "相手を探索中";
    const direction = r.dot < 0 ? "後ろ" : Math.abs(r.side) > 0.12 ? r.side > 0 ? "右" : "左" : Math.abs(r.up) > 0.12 ? r.up > 0 ? "上" : "下" : "正面";
    return "相手 " + direction + " " + Math.round(r.distance) + "m";
  }
  root.SkyTag = { reset, clear, tick, render, status, canLock, advance, birdModel, scopePoint, aircraftUri, targetGuidance, placeAtStart };
})(typeof window !== "undefined" ? window : globalThis);
