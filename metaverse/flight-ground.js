(function(root) {
  'use strict';
  // 地表の高さ（楕円体高）として信じてよい範囲。
  // 印西の周辺（中心から50km以内）の地表は35〜80mなので、1000mを超える値は街並み読み込み前の外れ値
  // （2026-09-13「高さ7777m」）として捨てる。それより遠い場所は山岳地を飛べるよう 4000m まで受け付ける
  // （2026-11-21 富士山（約3,800m）の上空を飛べず、地面の中と扱われた）
  const NEAR_CENTER = {lon: 140.15 * Math.PI / 180, lat: 35.805 * Math.PI / 180};
  const NEAR_RADIUS_M = 50000, NEAR_MAX_M = 1000, FAR_MAX_M = 4000, MIN_M = -200, EARTH_R = 6371000;
  function groundPlausible(lonRad, latRad, g) {
    if (!Number.isFinite(g) || g <= MIN_M) return false;
    const dx = (lonRad - NEAR_CENTER.lon) * Math.cos(NEAR_CENTER.lat) * EARTH_R;
    const dy = (latRad - NEAR_CENTER.lat) * EARTH_R;
    return g < (Math.hypot(dx, dy) <= NEAR_RADIUS_M ? NEAR_MAX_M : FAR_MAX_M);
  }
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
      // （2026-09-13「高さ7777m」）。印西の周辺は地表が楕円体高35〜80mなので、明らかに外れた値は「不明」として扱う。
      // 遠方は山岳地もあるので上限を緩める（groundPlausible）
      if (groundPlausible(point.longitude, point.latitude, ground)) height = Math.max(height, ground + options.clearance);
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
  root.CbiFlightGround = {enforce, groundPlausible};
})(typeof window === 'undefined' ? globalThis : window);
