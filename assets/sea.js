/* ヒーロー下部のボリューム雲海（WebGL2・GLSL レイマーチング）
   3Dノイズの密度場をレイ（視線）で貫いて積分する本格的なボリュームレンダリング。
   - 自己陰影：光源方向の密度差から雲の陰影を計算（もくもくの立体感）
   - 前方散乱：太陽・月の方向を向いた雲が明るく輝く（silver lining）
   - 光源はページの太陽／月と同じ時刻位相（1日=180秒）に連動
   - WebGL2 が使えない環境・視差軽減設定では CSS の霧グラデのまま表示 */
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
uniform vec3 uLit;      // 光が当たる雲の色
uniform vec3 uShadow;   // 雲の陰の色
uniform vec3 uHaze;     // 遠景がかすむ空の色
uniform float uLightX;  // 太陽／月の横位置（0=左端, 1=右端）
uniform float uLightUp; // 光源の高さ（0=沈んでいる, 1=天頂）

float hash(vec3 p){
  p = fract(p*0.3183099 + vec3(0.1, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x + p.y + p.z));
}
float noise3(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*(3.0 - 2.0*f);
  return mix(
    mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 4; i++){
    v += a*noise3(p);
    p = p*2.13 + vec3(11.3, 5.1, 7.7);
    a *= 0.5;
  }
  return v;
}

/* 雲の密度場：y=0 付近に厚い雲の層。ゆっくり流れ、形も変わり続ける */
float densityAt(vec3 p){
  vec3 q = p*vec3(0.30, 0.50, 0.30) + vec3(uTime*0.048, uTime*0.007, uTime*0.020);
  float base = fbm(q);
  float heightFall = smoothstep(1.35, -0.3, p.y);   // 上に行くほど薄く
  float d = base*1.30 - 0.66 + heightFall*0.58;
  return clamp(d, 0.0, 1.0);
}

void main(){
  float aspect = uRes.x / max(uRes.y, 1.0);
  // 視線：帯の下端＝手前の雲を見下ろし、上端＝水平線近くを見渡す
  vec3 ro = vec3(0.0, 2.1, 0.0);
  vec3 rd = normalize(vec3((vUv.x - 0.5)*aspect*0.9, mix(-0.62, -0.03, vUv.y), 1.0));

  // 光源（太陽／月）の方向。前方散乱：光源の方を向いた雲ほど輝く
  vec3 ld = normalize(vec3((uLightX - 0.5)*1.5, 0.30 + uLightUp*0.9, 0.4));
  float phase = 0.3 + 4.2*pow(max(dot(rd, ld), 0.0), 6.0);

  // 雲層スラブとレイの交差区間
  float tEnter = max((1.15 - ro.y)/rd.y, 0.0);
  float tExit  = min((-2.0 - ro.y)/rd.y, 26.0);

  // レイマーチング（開始位置をピクセルごとに散らして縞を防ぐ）
  const int STEPS = 16;
  float dt = (tExit - tEnter)/float(STEPS);
  float t = tEnter + dt*hash(vec3(vUv*913.7, 0.0));
  vec3 col = vec3(0.0);
  float T = 1.0;   // 透過率
  for(int i = 0; i < STEPS; i++){
    vec3 p = ro + rd*t;
    float d = densityAt(p);
    if(d > 0.012){
      // 自己陰影：光源側へ少し進んだ場所が濃ければこの点は影になる
      float dl = densityAt(p + ld*0.85);
      float lightAmt = clamp((d - dl)*2.8 + 0.28, 0.0, 1.0) * (0.30 + 0.70*uLightUp);
      vec3 sampleCol = mix(uShadow, uLit, lightAmt);
      sampleCol += uLit * phase * lightAmt * 0.24 * uLightUp;
      float absorb = exp(-d*dt*2.8);
      col += T*(1.0 - absorb)*sampleCol;
      T *= absorb;
      if(T < 0.045) break;   // ほぼ不透明になったら打ち切り
    }
    t += dt;
  }
  float alpha = 1.0 - T;

  // 大気遠近：遠くの雲は空の色にかすむ
  float hazeAmt = smoothstep(0.5, 1.0, vUv.y);
  col = mix(col, uHaze*alpha, hazeAmt*0.72);

  // 太陽・月の真下：雲海に映る反射のような光の帯
  float beam = exp(-pow((vUv.x - uLightX)*2.4, 2.0)) * uLightUp;
  col += uLit * beam * alpha * 0.55;

  // 帯の上端は空に溶かす（premultiplied のため色と透明度に同じ係数）
  float fade = smoothstep(1.0, 0.85, vUv.y);
  outColor = vec4(col*fade, alpha*fade);
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
    // 内部解像度は CSS 表示サイズと等倍にする。
    // 拡大表示だと OS 側の合成（オーバーレイ）に載りやすく、描画の取り残しを招くため。
    canvas.width = Math.max(2, Math.round(r.width));
    canvas.height = Math.max(2, Math.round(r.height));
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- 時刻に応じた雲海の色（0=0時 → 0.5=正午 → 1=24時） ---- */
  const PALETTES = [
    { p: 0.00, lit: [.52, .58, .78], shadow: [.07, .09, .17], haze: [.10, .13, .24] },  // 深夜：月光の銀
    { p: 0.22, lit: [.55, .58, .76], shadow: [.09, .10, .18], haze: [.13, .14, .25] },  // 未明
    { p: 0.29, lit: [1.0, .74, .52], shadow: [.30, .22, .32], haze: [.80, .55, .45] },  // 朝焼け
    { p: 0.40, lit: [1.05, 1.03, 1.0], shadow: [.50, .58, .74], haze: [.74, .84, .94] },// 午前
    { p: 0.50, lit: [1.08, 1.07, 1.05], shadow: [.52, .60, .76], haze: [.76, .86, .95] },// 正午
    { p: 0.62, lit: [1.04, 1.0, .94], shadow: [.50, .56, .72], haze: [.75, .83, .93] }, // 午後
    { p: 0.74, lit: [1.0, .60, .38], shadow: [.26, .17, .26], haze: [.78, .45, .34] },  // 夕焼け
    { p: 0.84, lit: [.54, .58, .78], shadow: [.08, .10, .18], haze: [.11, .13, .24] },  // 宵
    { p: 1.00, lit: [.52, .58, .78], shadow: [.07, .09, .17], haze: [.10, .13, .24] },
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
