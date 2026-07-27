/* ヒーロー下部の雲海（WebGL2）
   多層ノイズ（fbm）＋ドメインワープでもくもくした雲の起伏を描く。
   - 光源はページの太陽／月と同じ時刻位相（1日=180秒）：真下の雲が明るく染まり、
     雲の縁が銀色に光る（silver lining）。昼は白、朝夕は茜色、夜は月光の銀
   - WebGL2 が使えない環境・視差軽減設定では何もせず、CSS の霧グラデのまま表示 */
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
  if (!gl) {
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
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform vec2 uRes;
uniform vec3 uLit;      // 光が当たる面の色
uniform vec3 uShadow;   // 影の谷の色
uniform vec3 uHaze;     // 遠景がなじむ空の色
uniform float uLightX;  // 太陽／月の横位置（0=左端, 1=右端）
uniform float uLightUp; // 光源の高さ（0=沈んでいる, 1=天頂）

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
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<4;i++){
    v += a*noise(p);
    p = p*2.03 + vec2(17.3, 9.1);
    a *= 0.55;
  }
  return v;
}

void main(){
  // vUv.y: 0=帯の下端（手前）、1=上端（遠く・空との境）
  // 遠くを強く圧縮して「見渡す雲海」の遠近をつくる
  float py = pow(vUv.y, 1.7);
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(vUv.x * aspect, py * 2.6);
  float scale = mix(1.7, 5.2, py);   // 遠くほど細かい雲

  // ドメインワープ2段でもくもく感を出し、全体をゆっくり流す
  vec2 drift = vec2(uTime*0.016, uTime*0.004);
  vec2 q = vec2(fbm(p*scale + drift),
                fbm(p*scale + vec2(5.2,1.3) - drift*0.7));
  float h = fbm(p*scale + q*1.9 + drift*0.6);

  // 雲の密度（下ほど濃く敷き詰める）
  float cover = mix(0.34, 0.52, py);          // 遠くほど隙間なく
  float density = smoothstep(cover - 0.16, cover + 0.30, h);

  // 起伏の傾きから照明を計算
  float e = 0.02;
  float hx = fbm(p*scale + q*1.9 + drift*0.6 + vec2(e,0.0)) - h;
  float hy = fbm(p*scale + q*1.9 + drift*0.6 + vec2(0.0,e)) - h;
  vec3 n = normalize(vec3(-hx*7.0, -hy*7.0, 1.0));
  vec3 ld = normalize(vec3((uLightX - vUv.x)*1.3, 0.5 + uLightUp*0.4, 0.55));
  float diff = clamp(dot(n, ld)*0.5 + 0.5, 0.0, 1.0);

  // 光源の真下：雲を明るく染める光の帯（水面反射の代わり）
  float beam = exp(-pow((vUv.x - uLightX)*2.6, 2.0)) * uLightUp;
  // 雲の頂の縁が光る（silver lining）
  float rim = smoothstep(0.58, 0.92, h) * beam;

  vec3 col = mix(uShadow, uLit, diff * (0.45 + 0.55*uLightUp));
  col += uLit * beam * 0.5;
  col += uLit * rim * 0.55;

  // 遠くは空の色にかすませる（大気遠近）
  col = mix(col, uHaze, smoothstep(0.45, 1.0, vUv.y)*0.75);

  // 上端は空へ溶け、下端はしっかり敷き詰める
  float alpha = clamp(density + smoothstep(0.30, 0.0, vUv.y)*0.85, 0.0, 1.0);
  alpha *= smoothstep(1.0, 0.80, vUv.y);

  outColor = vec4(col*alpha, alpha);
}`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    canvas.remove();
    return;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.useProgram(prog);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uTime', 'uRes', 'uLit', 'uShadow', 'uHaze', 'uLightX', 'uLightUp'].forEach((k) => {
    U[k] = gl.getUniformLocation(prog, k);
  });

  function resize() {
    const r = sea.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- 時刻に応じた雲海の色（0=0時 → 0.5=正午 → 1=24時） ---- */
  const PALETTES = [
    { p: 0.00, lit: [.52, .58, .78], shadow: [.08, .10, .19], haze: [.10, .13, .24] },  // 深夜：月光の銀
    { p: 0.22, lit: [.55, .58, .76], shadow: [.10, .11, .20], haze: [.13, .14, .25] },  // 未明
    { p: 0.29, lit: [1.0, .74, .52], shadow: [.38, .28, .38], haze: [.80, .55, .45] },  // 朝焼け
    { p: 0.40, lit: [1.0, .99, .96], shadow: [.58, .66, .80], haze: [.74, .84, .94] },  // 午前
    { p: 0.50, lit: [1.0, 1.0, 1.0], shadow: [.60, .68, .82], haze: [.76, .86, .95] },  // 正午
    { p: 0.62, lit: [1.0, .98, .92], shadow: [.58, .64, .78], haze: [.75, .83, .93] },  // 午後
    { p: 0.74, lit: [1.0, .62, .40], shadow: [.34, .22, .30], haze: [.78, .45, .34] },  // 夕焼け
    { p: 0.84, lit: [.54, .58, .78], shadow: [.09, .11, .20], haze: [.11, .13, .24] },  // 宵
    { p: 1.00, lit: [.52, .58, .78], shadow: [.08, .10, .19], haze: [.10, .13, .24] },
  ];
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function paletteAt(p) {
    let a = PALETTES[0], b = PALETTES[PALETTES.length - 1];
    for (let i = 0; i < PALETTES.length - 1; i++) {
      if (p >= PALETTES[i].p && p <= PALETTES[i + 1].p) { a = PALETTES[i]; b = PALETTES[i + 1]; break; }
    }
    const t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
    return { lit: mix3(a.lit, b.lit, t), shadow: mix3(a.shadow, b.shadow, t), haze: mix3(a.haze, b.haze, t) };
  }

  // 太陽（6→18時）と月（18→翌6時）の横位置と高さ。CSS の sunArc / moonArc と同じ配分。
  function lightAt(p) {
    const dayT = (p - 0.25) / 0.5;
    if (dayT >= 0 && dayT <= 1) {
      return { x: -0.04 + dayT * 1.08, up: Math.sin(dayT * Math.PI) };
    }
    const nightT = p < 0.25 ? (p + 0.25) / 0.5 : (p - 0.75) / 0.5;
    return { x: -0.04 + nightT * 1.08, up: Math.sin(nightT * Math.PI) };
  }
  const dayProgress = () => {
    const n = new Date();
    return (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400;
  };

  /* ---- 描画ループ（帯が画面外・タブ非表示なら停止） ---- */
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

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  function frame(now) {
    if (!running) return;
    const p = dayProgress();
    const pal = paletteAt(p);
    const li = lightAt(p);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform1f(U.uTime, now * 0.001);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform3fv(U.uLit, pal.lit);
    gl.uniform3fv(U.uShadow, pal.shadow);
    gl.uniform3fv(U.uHaze, pal.haze);
    gl.uniform1f(U.uLightX, li.x);
    gl.uniform1f(U.uLightUp, Math.min(1, Math.max(0, li.up * 1.5)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.documentElement.classList.add('has-sea-webgl');
})();
