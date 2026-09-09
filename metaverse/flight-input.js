(function(root) {
  "use strict";
  function smooth(state, target, dt) {
    const seconds = Math.max(0, Math.min(0.1, dt));
    for (const key of Object.keys(target)) {
      const x = Math.max(-1, Math.min(1, target[key] || 0));
      const curved = x * (0.45 + 0.55 * x * x);
      const alpha = 1 - Math.exp(-seconds / (x === 0 ? 0.07 : 0.16));
      state[key] = (state[key] || 0) + (curved - (state[key] || 0)) * alpha;
      if (x === 0 && Math.abs(state[key]) < 0.001) state[key] = 0;
    }
    return state;
  }
  function rotate(camera, input, dt) {
    const seconds = Math.max(0, Math.min(0.1,dt));
    camera.lookUp(-(input.ry || 0)*1.05*seconds);
    camera.lookRight((input.rx || 0)*1.2*seconds);
    camera.twistRight((input.roll || 0)*1.2*seconds);
  }
  root.CbiFlightInput = {smooth,rotate};
  if(typeof module !== "undefined") module.exports = root.CbiFlightInput;
})(typeof window === "undefined" ? globalThis : window);
