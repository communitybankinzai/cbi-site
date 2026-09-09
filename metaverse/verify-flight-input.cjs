const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {smooth,rotate}=require('./flight-input.js');
const state={};
assert(smooth(state,{x:1},1/60).x<0.12);
let previous=state.x;
for(let i=0;i<60;i++){smooth(state,{x:1},1/60);assert(state.x>=previous);previous=state.x;}
for(let i=0;i<40;i++)smooth(state,{x:0},1/60);
assert.equal(state.x,0);
const a={},b={};for(let i=0;i<60;i++)smooth(a,{x:0.5},1/60);for(let i=0;i<30;i++)smooth(b,{x:0.5},1/30);
assert(Math.abs(a.x-b.x)<1e-12);
assert(a.x<0.35);
const angles=[];rotate({lookUp:x=>angles.push(x),lookRight:x=>angles.push(x),twistRight:x=>angles.push(x)},{ry:1,rx:1,roll:1},10);
assert(angles.every(x=>Math.abs(x)<=0.12));
const html=fs.readFileSync(__dirname+'/index.html','utf8');
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
  if(!/src=|type="(?:module|importmap|application\/ld\+json)"/.test(match[1])) new vm.Script(match[2]);
}
assert(html.includes('id="swanToggleBtn"'));
console.log('PASS: gradual input, fast stop, frame-rate independence, bounded rotation, inline syntax, swan menu');
