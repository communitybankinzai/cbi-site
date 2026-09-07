// Deterministic original feather textures; no external photography or licenses required.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'C:/Repos/cidao/node_modules/sharp');
const size = 1024;
async function make(kind) {
  const height = new Float32Array(size * size), color = Buffer.alloc(size * size * 3);
  const white = kind === 'swan';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = (x + 0.5) / size, t = (y + 0.5) / size;
    const a = Math.abs(s - 0.5) * 2;
    const noise = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
    const vein = Math.sin((t * 210 + a * 36 + Math.sin(a * 4) * 2) * Math.PI * 2);
    const fine = Math.sin((t * 830 + a * 153) * Math.PI * 2);
    const shaft = Math.exp(-Math.pow((s - 0.5) * 210, 2));
    const tip = Math.pow(t, 8);
    const band = Math.pow(0.5 + 0.5 * Math.cos((t * 6.2 + a * 0.09) * Math.PI * 2), 9);
    const edge = Math.pow(a, 12);
    height[y * size + x] = 0.48 + vein * 0.1 + fine * 0.025 + shaft * 0.22 + noise * 0.014;
    const value = white ? 0.92 + vein * 0.018 + fine * 0.008 + shaft * 0.05 - tip * 0.055
      : 0.7 + vein * 0.042 + fine * 0.02 + shaft * 0.12 - band * 0.035 - tip * 0.12 + edge * 0.1;
    const base = white ? [246, 245, 239] : [120, 88, 59];
    for (let i = 0; i < 3; i++) color[(y * size + x) * 3 + i] = Math.max(0, Math.min(255, base[i] * value + noise * (white ? 1.2 : 3)));
  }
  const normal = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (dx, dy) => height[((y + dy + size) % size) * size + ((x + dx + size) % size)];
    const nx = (h(-1, 0) - h(1, 0)) * 1.4, ny = (h(0, -1) - h(0, 1)) * 1.4;
    const len = Math.hypot(nx, ny, 1);
    normal[(y * size + x) * 3] = (nx / len * 0.5 + 0.5) * 255;
    normal[(y * size + x) * 3 + 1] = (ny / len * 0.5 + 0.5) * 255;
    normal[(y * size + x) * 3 + 2] = (1 / len * 0.5 + 0.5) * 255;
  }
  for (const [name, data] of [['feather', color], ['normal', normal]]) {
    await sharp(data, {raw:{width:size,height:size,channels:3}}).png().toFile(path.join(__dirname, kind + '-' + name + '.png'));
  }
  const body = Buffer.alloc(size * size * 3);
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const row=Math.floor(y/size*14), v=(y/size*14)%1;
    const u=((x/size*18+row%2*0.5)%1-0.5)*2;
    const edge=Math.pow(Math.abs(u),8)*(0.5+v*0.5);
    const streak=Math.exp(-u*u*35)*(0.3+v*0.7);
    const barb=Math.sin((v*27+Math.abs(u)*11)*Math.PI*2);
    const noise=Math.sin(x*12.9898+y*78.233)*43758.5453%1;
    const tone=white?0.95-edge*0.035+barb*0.008:0.68+streak*0.22-edge*0.075+barb*0.018+noise*0.02;
    const base=white?[245,244,239]:[131,96,62];
    for(let c=0;c<3;c++)body[(y*size+x)*3+c]=Math.min(255,base[c]*tone);
  }
  await sharp(body,{raw:{width:size,height:size,channels:3}}).png().toFile(path.join(__dirname,kind+'-body.png'));
}
Promise.all(['kite', 'swan'].map(make)).catch(e => { console.error(e); process.exitCode = 1; });
