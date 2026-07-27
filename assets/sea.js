/* ヒーロー下部の水面（WebGL2）
   ns-factory の minamo-water.html から水面シミュレーションの最小構成を移植。
   - 波の計算と描画のみ（テキスト重ね・雨・音声・モード切替は移植していない）
   - 光源はページの太陽／月と同じ位置に追従するため、水面の反射が空と一致する
   - WebGL2 が使えない環境・視差軽減設定では何もせず、CSS 版の海のまま表示する */
(() => {
  'use strict';

  const sea = document.querySelector('.hero-sea');
  if (!sea) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'sea-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  sea.appendChild(canvas);

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
    canvas.remove();
    return;
  }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vsrc, fsrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
    return p;
  }

  const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

  /* 波の伝播（高さと速度を RG32F テクスチャで持ち回す） */
  const UPDATE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uWaveSpeed;
uniform float uDamping;
uniform float uTime;
void main(){
  vec2 self = texture(uState, vUv).rg;
  float hL = texture(uState, vUv - vec2(uTexel.x,0.0)).r;
  float hR = texture(uState, vUv + vec2(uTexel.x,0.0)).r;
  float hU = texture(uState, vUv + vec2(0.0,uTexel.y)).r;
  float hD = texture(uState, vUv - vec2(0.0,uTexel.y)).r;
  float lap = (hL+hR+hU+hD - 4.0*self.r);
  float vel = self.g + lap*uWaveSpeed;
  vel *= uDamping;

  // 常時わずかに風を当て続け、水面が完全な平面に落ち着かないようにする
  float chop = sin(vUv.x*46.0 + uTime*1.4) * sin(vUv.y*38.0 - uTime*1.1)
             + 0.5*sin(vUv.x*97.0 - uTime*2.3 + 1.7) * sin(vUv.y*81.0 + uTime*1.9);
  vel += chop * 0.00030;

  float h = self.r + vel;
  vec2 edge = smoothstep(0.0,0.02,vUv) * smoothstep(0.0,0.02,1.0-vUv);
  float edgeDamp = edge.x*edge.y;
  h *= mix(0.9, 1.0, edgeDamp);
  vel *= mix(0.85, 1.0, edgeDamp);
  h = clamp(h,-4.0,4.0);
  outColor = vec4(h, vel, 0.0, 1.0);
}`;

  /* 水面の陰影・きらめき。手前ほど波を大きく、奥（水平線側）ほど穏やかに見せる */
  const RENDER_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uNormalScale;
uniform vec3 uSkyTop; uniform vec3 uSkyBottom;
uniform vec3 uWaterDeep; uniform vec3 uWaterShallow;
uniform vec3 uLightDir; uniform vec3 uLightColor; uniform float uShininess;
uniform float uLightUp;
uniform float uTime;

float hash(vec2 p){
  vec3 p3 = fract(vec3(p.x,p.y,p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

void main(){
  float hC = texture(uState, vUv).r;
  float hL = texture(uState, vUv - vec2(uTexel.x,0.0)).r;
  float hR = texture(uState, vUv + vec2(uTexel.x,0.0)).r;
  float hU = texture(uState, vUv + vec2(0.0,uTexel.y)).r;
  float hD = texture(uState, vUv - vec2(0.0,uTexel.y)).r;
  vec2 grad = vec2(hR-hL, hU-hD) * uNormalScale;

  // 遠近感：画面下（手前）ほど波を大きく、上（水平線側）ほど穏やかに
  float distT = clamp(vUv.y, 0.0, 1.0);
  float perspScale = mix(1.35, 0.42, distT*distT);
  grad *= perspScale;
  hC *= perspScale;

  vec2 sp1 = vUv*vec2(26.0,20.0) + vec2(uTime*0.035, -uTime*0.025);
  vec2 sp2 = vUv*vec2(70.0,55.0) + vec2(-uTime*0.05, uTime*0.04);
  vec2 sp3 = vUv*vec2(170.0,140.0) + vec2(uTime*0.07, uTime*0.06);
  float e = 0.025;
  float n1c=noise(sp1), n1x=noise(sp1+vec2(e,0.0)), n1y=noise(sp1+vec2(0.0,e));
  float n2c=noise(sp2), n2x=noise(sp2+vec2(e,0.0)), n2y=noise(sp2+vec2(0.0,e));
  float n3c=noise(sp3), n3x=noise(sp3+vec2(e,0.0)), n3y=noise(sp3+vec2(0.0,e));
  vec2 microGrad = (vec2(n1x-n1c,n1y-n1c)/e*0.9 + vec2(n2x-n2c,n2y-n2c)/e*0.55 + vec2(n3x-n3c,n3y-n3c)/e*0.3) * perspScale;

  vec3 normal = normalize(vec3(-grad.x - microGrad.x*0.014, -grad.y - microGrad.y*0.014, 1.0));
  vec3 glintNormal = normalize(vec3(-grad.x - microGrad.x*0.055, -grad.y - microGrad.y*0.055, 1.0));

  vec3 viewDir = normalize(vec3(0.0, 0.85, 1.0));
  float skyT = clamp(normal.y*0.5+0.5, 0.0, 1.0);
  vec3 skyColor = mix(uSkyBottom, uSkyTop, skyT);

  float fres = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
  vec3 water = mix(uWaterDeep, uWaterShallow, clamp(fres*0.7 + hC*0.06,0.0,1.0));

  vec3 ld = normalize(uLightDir);
  vec3 h = normalize(ld + viewDir);
  float ndoth = max(dot(normal, h), 0.0);
  float broad = pow(ndoth, max(uShininess*0.18, 7.0)) * 0.55;
  float tight = pow(ndoth, uShininess) * 3.2;

  float ndothG = max(dot(glintNormal, h), 0.0);
  float shimmer = smoothstep(0.48, 0.92, pow(ndothG, 20.0)*2.4);
  float pinpoint = smoothstep(0.86, 0.999, pow(ndothG, 300.0)*3.2) * 1.1;
  float glint = shimmer + pinpoint;

  // 太陽・月が地平線の下にいる間はきらめきを消す
  float spec = (broad + tight + glint) * clamp(uLightUp, 0.0, 1.0);
  vec3 color = water + skyColor*0.28 + uLightColor*spec;

  // 水平線側を空になじませ、帯の上端に境目が出ないようにする
  float blend = smoothstep(0.82, 1.0, vUv.y);
  color = mix(color, uSkyBottom, blend*0.85);
  float alpha = mix(1.0, 0.0, smoothstep(0.94, 1.0, vUv.y));

  outColor = vec4(color*alpha, alpha);
}`;

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  function bindQuad(p) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  const updateProg = program(VERT, UPDATE_FRAG);
  const renderProg = program(VERT, RENDER_FRAG);

  let simW = 0, simH = 0, texelX = 0, texelY = 0;
  let cur, next;

  function seededWaveData(w, h) {
    const data = new Float32Array(w * h * 2);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        let hgt = 0;
        hgt += 0.35 * Math.sin(u * 14 + v * 7 + 1.1);
        hgt += 0.22 * Math.sin(u * 23 - v * 11 + 3.0);
        hgt += 0.15 * Math.sin(u * 39 + v * 29 - 0.6);
        hgt += 0.10 * Math.sin(u * 61 - v * 44 + 2.2);
        data[(y * w + x) * 2] = hgt * 0.24;
      }
    }
    return data;
  }
  function makeStateTexture(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, w, h, 0, gl.RG, gl.FLOAT, seededWaveData(w, h));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  }

  function resize() {
    const r = sea.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    // シミュレーションは表示より粗くて十分（負荷を抑える）
    simW = Math.min(360, Math.max(160, Math.floor(r.width / 3)));
    simH = Math.min(200, Math.max(90, Math.floor(r.height / 2)));
    texelX = 1 / simW;
    texelY = 1 / simH;
    const a = makeStateTexture(simW, simH);
    const b = makeStateTexture(simW, simH);
    cur = a;
    next = b;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- 時刻に応じた水と光の色（ページの太陽・月と同じ 1日=180秒の周回） ---- */
  const PALETTES = [
    // p: 1日の進み具合（0=0時, 0.5=正午）
    { p: 0.00, skyTop: [.04, .07, .16], skyBottom: [.06, .10, .20], deep: [.01, .03, .08], shallow: [.06, .11, .20], color: [.85, .90, 1.0], shin: 130 },
    { p: 0.22, skyTop: [.10, .12, .24], skyBottom: [.16, .16, .28], deep: [.02, .04, .10], shallow: [.09, .13, .24], color: [.85, .90, 1.0], shin: 120 },
    { p: 0.29, skyTop: [.55, .38, .42], skyBottom: [.85, .52, .38], deep: [.06, .06, .14], shallow: [.32, .22, .28], color: [1.0, .72, .52], shin: 80 },
    { p: 0.40, skyTop: [.45, .68, .92], skyBottom: [.68, .82, .95], deep: [.04, .12, .24], shallow: [.22, .42, .58], color: [1.0, .98, .92], shin: 70 },
    { p: 0.50, skyTop: [.42, .66, .95], skyBottom: [.70, .84, .96], deep: [.04, .13, .26], shallow: [.24, .45, .62], color: [1.0, 1.0, .96], shin: 65 },
    { p: 0.62, skyTop: [.45, .66, .92], skyBottom: [.72, .82, .94], deep: [.04, .12, .24], shallow: [.23, .43, .58], color: [1.0, .96, .88], shin: 70 },
    { p: 0.74, skyTop: [.42, .26, .34], skyBottom: [.80, .40, .30], deep: [.06, .05, .12], shallow: [.30, .18, .22], color: [1.0, .60, .40], shin: 85 },
    { p: 0.84, skyTop: [.08, .10, .22], skyBottom: [.12, .14, .26], deep: [.01, .03, .09], shallow: [.07, .12, .22], color: [.85, .90, 1.0], shin: 125 },
    { p: 1.00, skyTop: [.04, .07, .16], skyBottom: [.06, .10, .20], deep: [.01, .03, .08], shallow: [.06, .11, .20], color: [.85, .90, 1.0], shin: 130 },
  ];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function paletteAt(p) {
    let a = PALETTES[0], b = PALETTES[PALETTES.length - 1];
    for (let i = 0; i < PALETTES.length - 1; i++) {
      if (p >= PALETTES[i].p && p <= PALETTES[i + 1].p) { a = PALETTES[i]; b = PALETTES[i + 1]; break; }
    }
    const t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
    return {
      skyTop: mix3(a.skyTop, b.skyTop, t),
      skyBottom: mix3(a.skyBottom, b.skyBottom, t),
      deep: mix3(a.deep, b.deep, t),
      shallow: mix3(a.shallow, b.shallow, t),
      color: mix3(a.color, b.color, t),
      shin: a.shin + (b.shin - a.shin) * t,
    };
  }

  // 太陽（6時に東→18時に西）と月（18時に東→6時に西）の横位置と高さ。
  // CSS 側の sunArc / moonArc と同じ考え方なので、水面の反射が空の位置と一致する。
  function lightAt(p) {
    const dayT = (p - 0.25) / 0.5;        // 6時〜18時を 0→1
    if (dayT >= 0 && dayT <= 1) {
      return { x: dayT, up: Math.sin(dayT * Math.PI), day: true };
    }
    const nightT = p < 0.25 ? (p + 0.25) / 0.5 : (p - 0.75) / 0.5; // 18時〜翌6時を 0→1
    return { x: nightT, up: Math.sin(nightT * Math.PI), day: false };
  }

  const dayProgress = () => {
    const n = new Date();
    return (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400;
  };

  /* ---- 描画ループ（ヒーローが画面外なら止める） ---- */
  let running = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      running = entries[0].isIntersecting;
      if (running) requestAnimationFrame(frame);
    }, { threshold: 0 }).observe(sea);
  }
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  });

  const uUpd = {
    state: gl.getUniformLocation(updateProg, 'uState'),
    texel: gl.getUniformLocation(updateProg, 'uTexel'),
    speed: gl.getUniformLocation(updateProg, 'uWaveSpeed'),
    damp: gl.getUniformLocation(updateProg, 'uDamping'),
    time: gl.getUniformLocation(updateProg, 'uTime'),
  };
  const uRen = {};
  ['uState', 'uTexel', 'uNormalScale', 'uSkyTop', 'uSkyBottom', 'uWaterDeep', 'uWaterShallow',
    'uLightDir', 'uLightColor', 'uShininess', 'uLightUp', 'uTime'].forEach((k) => {
    uRen[k] = gl.getUniformLocation(renderProg, k);
  });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function frame(now) {
    if (!running || !cur) return;
    const t = now * 0.001;

    gl.viewport(0, 0, simW, simH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.fbo);
    gl.useProgram(updateProg);
    bindQuad(updateProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cur.tex);
    gl.uniform1i(uUpd.state, 0);
    gl.uniform2f(uUpd.texel, texelX, texelY);
    gl.uniform1f(uUpd.speed, 0.34);
    gl.uniform1f(uUpd.damp, 0.968);
    gl.uniform1f(uUpd.time, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const tmp = cur; cur = next; next = tmp;

    const p = dayProgress();
    const pal = paletteAt(p);
    const li = lightAt(p);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(renderProg);
    bindQuad(renderProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cur.tex);
    gl.uniform1i(uRen.uState, 0);
    gl.uniform2f(uRen.uTexel, texelX, texelY);
    gl.uniform1f(uRen.uNormalScale, 7.0);
    gl.uniform3fv(uRen.uSkyTop, pal.skyTop);
    gl.uniform3fv(uRen.uSkyBottom, pal.skyBottom);
    gl.uniform3fv(uRen.uWaterDeep, pal.deep);
    gl.uniform3fv(uRen.uWaterShallow, pal.shallow);
    // 光源の左右：太陽・月が左にあるほど反射も左に出る
    gl.uniform3fv(uRen.uLightDir, [(0.5 - li.x) * 1.1, 0.35 + li.up * 0.5, 0.5]);
    gl.uniform3fv(uRen.uLightColor, pal.color);
    gl.uniform1f(uRen.uShininess, pal.shin);
    gl.uniform1f(uRen.uLightUp, Math.max(0, li.up * 1.6));
    gl.uniform1f(uRen.uTime, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.documentElement.classList.add('has-sea-webgl');
})();
