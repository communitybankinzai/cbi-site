(function(root) {
  'use strict';
  function enforce(viewer, state, options) {
    if (options.disabled) { state.position = null; return false; }
    const C = root.Cesium, cam = viewer.camera;
    const current = C.Cartographic.fromCartesian(cam.positionWC);
    let previous = state.position;
    let height = current.height, unknown = false;
    let distance = previous ? C.Cartesian3.distance(C.Cartesian3.fromRadians(previous.longitude, previous.latitude, previous.height), cam.positionWC) : 0;
    // Spot jumps are not a flight segment. Validate their destination independently.
    if (distance > 500) { previous = null; distance = 0; state.checkedAt = 0; }
    const steps = Math.min(8, Math.max(1, Math.ceil(distance / 8)));
    const now = performance.now();
    // Recheck stationary positions too: new tiles can arrive underneath the camera.
    if (distance < 0.01 && state.checkedAt && now - state.checkedAt < 150) return false;
    state.checkedAt = now;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = previous ? new C.Cartographic(
        previous.longitude + (current.longitude - previous.longitude) * t,
        previous.latitude + (current.latitude - previous.latitude) * t,
        current.height) : current.clone();
      let ground;
      try { if (viewer.scene.sampleHeightSupported) ground = viewer.scene.sampleHeight(point, options.exclude || []); } catch (_) {}
      // 街並みの読み込み前は sampleHeight が数千mの値を返すことがあり、そのまま信じるとカメラが上空へ押し上げられる
      // （2026-09-13「高さ7777m」）。印西の地表は楕円体高35〜80mなので、明らかに外れた値は「不明」として扱う
      if (Number.isFinite(ground) && ground > -200 && ground < 1000) height = Math.max(height, ground + options.clearance);
      else unknown = true;
    }
    // Missing terrain is not permission to descend or advance into an unseen slope.
    if (unknown && previous) {
      current.longitude = previous.longitude;
      current.latitude = previous.latitude;
      height = Math.max(height, previous.height);
    }
    height = Math.max(height, options.fallback || 75);
    const changed = height > current.height + 0.001 || (unknown && distance > 0.01 && !!previous);
    current.height = height;
    if (changed) cam.setView({destination:C.Cartesian3.fromRadians(current.longitude,current.latitude,height),
      orientation:{direction:C.Cartesian3.clone(cam.directionWC),up:C.Cartesian3.clone(cam.upWC)}});
    state.position = current.clone();
    return changed;
  }
  root.CbiFlightGround = {enforce};
})(typeof window === 'undefined' ? globalThis : window);
