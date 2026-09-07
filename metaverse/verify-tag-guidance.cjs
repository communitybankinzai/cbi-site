const assert = require('node:assert/strict');
global.Cesium = { Cartesian3: { fromDegrees: (lon, lat, height) => ({lon, lat, height}) } };
require('./sky-tag.js');
const positions = [1, 2].map(id => {
  let pose;
  SkyTag.placeAtStart({id, viewer: {camera: {setView: value => {pose = value;}}}});
  return pose;
});
assert.equal(positions[0].destination.height, positions[1].destination.height);
assert.equal(positions[0].orientation.heading, 0);
assert.equal(positions[1].orientation.heading, Math.PI);
const distance = (positions[1].destination.lat - positions[0].destination.lat) * 111000;
assert(Math.abs(distance - 600) < 0.01);
assert(!SkyTag.canLock(distance, 1));
assert.match(SkyTag.targetGuidance({side: 0.4, up: 0.3, dot: 0.8, distance: 120}, 300, 60), /→ 右.*↑ 上/);
assert.match(SkyTag.targetGuidance({side: -0.4, up: -0.3, dot: -0.8, distance: 420}, 180, -60), /後方.*← 左.*↓ 下/);
assert.match(SkyTag.targetGuidance({side: 0, up: 0, dot: 1, distance: 600}, 240, 0), /距離 600m/);
console.log('PASS: symmetric starts outside capture range; direction, altitude and distance guidance');
