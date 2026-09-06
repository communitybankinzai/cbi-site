const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('./cbi-simulation-core.js');
test('rain and duration increase the index on a fixed scale', () => {
  assert.ok(core.calculate(80, 60, 1, .8, 0) > core.calculate(80, 30, 1, .8, 0));
  assert.ok(core.calculate(80, 30, 2, .8, 0) > core.calculate(80, 30, 1, .8, 0));
  assert.equal(core.calculate(80, 30, 2, .8, 0), core.calculate(80, 60, 1, .8, 0));
});
test('zero rainfall and missing terrain remain distinct', () => {
  assert.equal(core.calculate(80, 0, 1, .8, 0), 0);
  assert.equal(core.calculate(null, 0, 1, .8, 0), null);
  assert.equal(core.calculate(undefined, 50, 1, .8, 0), null);
  assert.equal(core.calculate(80, 20, 1, .8, 30), 0);
});
test('invalid inputs are rejected, including NaN and empty conversions', () => {
  for (const args of [[-1,1,.8,0],[301,1,.8,0],[50,0,.8,0],[50,73,.8,0],[50,1,1.1,0],[50,1,.8,-1],[NaN,1,.8,0],[Infinity,1,.8,0]]) assert.throws(() => core.calculate(80,...args), RangeError);
});
test('real grid has valid bounds and preserves missing cells', () => {
  const grid = core.validateGrid(JSON.parse(fs.readFileSync(__dirname + '/simulation-data/map_grid.json')));
  assert.ok(grid.values.score.some(value => value === null));
  assert.ok(grid.values.score.some(value => value > 0));
  assert.throws(() => core.validateGrid({...grid, width: grid.width + 1}));
  for (const score of grid.values.score) { const result = core.calculate(score, 300, 72, 1, 0); assert.ok(result === null || (result >= 0 && result <= 100)); }
});
function fixture(fetchData) {
  const elements = {};
  for (const id of ['cbi-simulation-form','cbi-simulation-status','cbi-rain','cbi-hours','cbi-runoff','cbi-drainage','cbi-show-simulation','cbi-simulate','cbi-simulation-opacity']) elements[id] = { value: '', events: {}, addEventListener(name, fn) { this.events[name] = fn; }, reportValidity() { return true; } };
  ['50','2','.8','0'].forEach((v,i)=>elements[['cbi-rain','cbi-hours','cbi-runoff','cbi-drainage'][i]].value=v);
  elements['cbi-simulation-opacity'].value='55';
  const layers = new Set(); let count = 0;
  const map = { createPane() { return {style:{}}; }, removeLayer(layer) { layers.delete(layer); } };
  const L = { control() { return { addTo() { this.onAdd(); return this; }, remove() {} }; }, DomUtil: { create() { return {}; } }, imageOverlay(url,bounds,options) { count++; return {options, addTo() { layers.add(this); }, setOpacity(v) { this.opacity=v; } }; } };
  const document = { getElementById(id) { return elements[id]; }, createElement() { return { getContext() { return {createImageData(w,h) {return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){}}; }, toDataURL() {return 'data:image/png;base64,test';} }; } };
  const context = { document, map, L, CbiSimulationCore:core, fetch:fetchData };
  vm.runInNewContext(fs.readFileSync(__dirname+'/cbi-simulation.js','utf8'),context);
  return {elements,layers,count:()=>count,submit:()=>elements['cbi-simulation-form'].events.submit({preventDefault(){}})};
}
const tiny = {width:2,height:1,transform:[100,0,-100,100],bounds:[[35,140],[36,141]],values:{score:[80,null]}};
test('submit, hide, reshow, opacity and edit invalidate previous map', async () => {
  const f=fixture(async()=>({ok:true,json:async()=>tiny})); await f.submit();
  assert.equal(f.layers.size,1); assert.equal(f.count(),1);
  assert.match(f.elements['cbi-simulation-status'].textContent,/50 mm\/h × 2時間/);
  f.elements['cbi-show-simulation'].checked=false; f.elements['cbi-show-simulation'].events.change(); assert.equal(f.layers.size,0);
  f.elements['cbi-show-simulation'].checked=true; f.elements['cbi-show-simulation'].events.change(); assert.equal(f.layers.size,1);
  f.elements['cbi-simulation-opacity'].events.input({target:{value:'70'}}); assert.equal([...f.layers][0].opacity,.7);
  f.elements['cbi-simulation-form'].events.input(); assert.equal(f.layers.size,0); assert.equal(f.elements['cbi-show-simulation'].disabled,true);
});
test('failed load can retry and never displays an old result', async () => {
  let attempt=0; const f=fixture(async()=>({ok:++attempt>1,json:async()=>tiny}));
  await f.submit(); assert.equal(f.layers.size,0); assert.match(f.elements['cbi-simulation-status'].textContent,/計算できませんでした/);
  await f.submit(); assert.equal(f.layers.size,1);
});
test('input edited during fetch cancels stale rendering', async () => {
  let resolve; const f=fixture(()=>new Promise(r=>resolve=r)); const pending=f.submit();
  f.elements['cbi-simulation-form'].events.input(); resolve({ok:true,json:async()=>tiny}); await pending;
  assert.equal(f.layers.size,0); assert.equal(f.count(),0);
});
