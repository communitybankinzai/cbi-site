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
  if (new URLSearchParams(location.search).get('fx') === 'off') return;

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
uniform float uGrass;   // 1.0 で草原モード（反射を抑え、地平線をはっきりさせる）

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
  for(int i = 0; i < 5; i++){
    v += a*noise3(p);
    p = p*2.07 + vec3(11.3, 5.1, 7.7);
    a *= 0.56;   // 高周波を残しすぎない＝ざらつかず、ふわっとした綿になる
  }
  return v;
}

/* 雲の密度場：y=0 付近に厚い雲の層。ゆっくり流れ、形も変わり続ける */
float densityAt(vec3 p){
  // ゆっくり流れる（風）。x方向に流し、形もじわじわ変える
  vec3 flow = vec3(uTime*0.075, uTime*0.010, uTime*0.028);
  vec3 q = p*vec3(0.26, 0.46, 0.26) + flow;
  // 風のうねり：波が奥から手前へ渡っていく（周期の違う2つの波を重ねる）
  float swell = sin(p.x*0.55 - p.z*0.30 - uTime*0.60) * 0.5
              + sin(p.x*0.24 + p.z*0.18 - uTime*0.34) * 0.5;
  q += vec3(swell*0.16, swell*0.09, swell*0.05);
  // ドメインワープ：まっすぐな縞にならず、綿がうねるような形になる
  vec3 w = vec3(fbm(q*0.7 + 3.1), fbm(q*0.7 + 8.4), fbm(q*0.7 + 1.7)) - 0.5;
  float base = fbm(q + w*1.25) + swell*0.055;
  float heightFall = smoothstep(1.45, -0.4, p.y);
  float d = base*1.42 - 0.70 + heightFall*0.60;
  // 端をなだらかにして、砂のような固い粒立ちをなくす
  return smoothstep(0.0, 0.55, clamp(d, 0.0, 1.0));
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
  const int STEPS = 14;
  float dt = (tExit - tEnter)/float(STEPS);
  float t = tEnter + dt*hash(vec3(vUv*913.7, 0.0));
  vec3 col = vec3(0.0);
  float T = 1.0;   // 透過率
  for(int i = 0; i < STEPS; i++){
    vec3 p = ro + rd*t;
    float d = densityAt(p);
    if(d > 0.012){
      // 自己陰影：光源側へ少し進んだ場所が濃ければこの点は影になる
      // 自己陰影：光源方向の密度差。振幅を大きく取り、常にはっきりした明暗を出す
      float dl = densityAt(p + ld*1.15);
      float lightAmt = clamp((d - dl)*6.0 + 0.10, 0.0, 1.0);
      lightAmt = pow(lightAmt, 0.75);
      // 起伏そのものによる陰影（光源が低い時間帯でも凹凸が消えないように）
      float relief = clamp((d - densityAt(p + vec3(0.0, 0.55, 0.0)))*3.4 + 0.5, 0.0, 1.0);
      lightAmt = mix(relief, lightAmt, 0.55 + 0.45*uLightUp);
      // 光源が低い時間帯でも地の色が分かるよう、最低限の明るさを残す
      lightAmt = mix(0.30, 1.0, lightAmt);
      vec3 sampleCol = mix(uShadow, uLit, lightAmt);
      sampleCol += uLit * phase * lightAmt * mix(0.24, 0.10, uGrass) * uLightUp;
      float absorb = exp(-d*dt*2.0);
      col += T*(1.0 - absorb)*sampleCol;
      T *= absorb;
      if(T < 0.045) break;   // ほぼ不透明になったら打ち切り
    }
    t += dt;
  }
  float alpha = 1.0 - T;

  // 大気遠近：遠くの雲は空の色にかすむ
  float hazeAmt = smoothstep(0.62, 1.0, vUv.y);
  col = mix(col, uHaze*alpha, hazeAmt*0.55);

  // 太陽・月の真下：雲海に映る反射のような光の帯
  // 太陽・月の真下に伸びる光の道。中心は鋭く、周囲はやわらかく広がる
  float dx = vUv.x - uLightX;
  float core = exp(-pow(dx*7.0, 2.0));
  float halo = exp(-pow(dx*2.2, 2.0));
  float beam = (core*1.5 + halo*0.75) * uLightUp;
  beam *= mix(1.5, 0.45, vUv.y);   // 手前ほど広く強く
  // 草原では鏡のような反射は起きないので、日なたが明るい程度に留める
  col += uLit * beam * alpha * mix(1.25, 0.32, uGrass);

  // 上端の処理：雲海は空へ溶かし、草原は地平線をはっきり出す
  float fade = mix(smoothstep(1.0, 0.85, vUv.y), smoothstep(1.0, 0.965, vUv.y), uGrass);
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
  ['uTime', 'uRes', 'uLit', 'uShadow', 'uHaze', 'uLightX', 'uLightUp', 'uGrass'].forEach((k) => {
    U[k] = gl.getUniformLocation(prog, k);
  });

  function resize() {
    const r = sea.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    // レイマーチングは重いので内部解像度を半分に落とす（雲はぼやけた表現なので劣化は見えない）
    canvas.width = Math.max(2, Math.round(r.width * 0.5));
    canvas.height = Math.max(2, Math.round(r.height * 0.5));
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---- 時刻に応じた雲海の色（0=0時 → 0.5=正午 → 1=24時） ---- */
  const PALETTES = [
    { p: 0.00, lit: [.62, .68, .88], shadow: [.02, .03, .07], haze: [.05, .07, .15] },  // 深夜：月光の銀
    { p: 0.22, lit: [.64, .69, .86], shadow: [.03, .04, .08], haze: [.06, .08, .16] },  // 未明
    { p: 0.29, lit: [1.15, .86, .62], shadow: [.22, .15, .24] , haze: [.80, .55, .45] },  // 朝焼け
    { p: 0.40, lit: [1.22, 1.22, 1.20], shadow: [.34, .42, .60], haze: [.74, .84, .94] },// 午前
    { p: 0.50, lit: [1.28, 1.28, 1.26], shadow: [.36, .44, .62], haze: [.76, .86, .95] },// 正午
    { p: 0.62, lit: [1.22, 1.19, 1.12], shadow: [.34, .40, .58], haze: [.75, .83, .93] }, // 午後
    { p: 0.74, lit: [1.15, .72, .46], shadow: [.20, .13, .22], haze: [.78, .45, .34] },  // 夕焼け
    { p: 0.84, lit: [.62, .67, .87], shadow: [.03, .04, .08], haze: [.06, .08, .16] },  // 宵
    { p: 1.00, lit: [.62, .68, .88], shadow: [.02, .03, .07], haze: [.05, .07, .15] },
  ];
  // 草原（?scene=grass）：同じ起伏の計算のまま、色と光の当たり方だけ草地に変える
  const GRASS = [
    // 影も緑系に統一：暗くても「草」に見えるようにする（茶色くしない）
    { p: 0.00, lit: [.20, .34, .22], shadow: [.05, .12, .08], haze: [.07, .12, .16] },  // 深夜
    { p: 0.22, lit: [.24, .40, .25], shadow: [.06, .14, .09], haze: [.09, .15, .18] },  // 未明
    { p: 0.29, lit: [.72, .82, .40], shadow: [.16, .28, .16], haze: [.55, .52, .40] },  // 朝日
    { p: 0.40, lit: [.72, .95, .44], shadow: [.16, .34, .18], haze: [.60, .76, .70] },  // 午前
    { p: 0.50, lit: [.78, 1.00, .48], shadow: [.17, .36, .19], haze: [.62, .78, .72] },  // 正午
    { p: 0.62, lit: [.74, .96, .44], shadow: [.16, .34, .18], haze: [.60, .76, .70] },  // 午後
    { p: 0.74, lit: [.78, .78, .36], shadow: [.15, .24, .14], haze: [.56, .48, .36] },  // 夕日
    { p: 0.84, lit: [.23, .38, .24], shadow: [.06, .13, .09], haze: [.08, .14, .17] },  // 宵
    { p: 1.00, lit: [.20, .34, .22], shadow: [.05, .12, .08], haze: [.07, .12, .16] },
  ];
  // 標準は草原。?scene=cloud を付けると雲海表示になる
  const SCENE = new URLSearchParams(location.search).get('scene');
  const IS_GRASS = SCENE !== 'cloud';
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function paletteAt(p) {
    const TBL = IS_GRASS ? GRASS : PALETTES;
    let a = TBL[0], b = TBL[TBL.length - 1];
    for (let i = 0; i < TBL.length - 1; i++) {
      if (p >= TBL[i].p && p <= TBL[i + 1].p) { a = TBL[i]; b = TBL[i + 1]; break; }
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
  // 開いた瞬間の実時刻を起点に、1日=180秒で進む（ページ側の空と同じ速さ）
  const _n0 = new Date();
  const _phase0 = (_n0.getHours() * 3600 + _n0.getMinutes() * 60 + _n0.getSeconds()) / 86400;
  const _t0 = performance.now();
  const dayProgress = () => ((_phase0 + (performance.now() - _t0) / 180000) % 1 + 1) % 1;

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

  let lastDraw = 0;
  function frame(now) {
    if (!running) return;
    // 30fps に制限：雲の動きはゆっくりなので見た目は変わらず、負荷は半分になる
    if (now - lastDraw < 33) { requestAnimationFrame(frame); return; }
    lastDraw = now;
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
    gl.uniform1f(U.uGrass, IS_GRASS ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.documentElement.classList.add('has-sea-webgl');
})();
