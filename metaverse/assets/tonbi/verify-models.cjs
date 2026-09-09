const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

for (const kind of ['kite', 'swan']) {
  const file = fs.readFileSync(path.join(__dirname, kind + '.glb'));
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + length).toString());
  const binary = file.subarray(28 + length);
  assert.equal(gltf.buffers[0].uri, undefined);
  for (const name of ['body', 'neck', 'leftWing', 'rightWing', 'tail']) {
    assert(gltf.nodes.some(node => node.name === name), name);
  }
  for (const view of gltf.bufferViews) {
    assert.equal((view.byteOffset || 0) % 4, 0);
    assert((view.byteOffset || 0) + view.byteLength <= binary.length);
  }
  for (const image of gltf.images) {
    assert.equal(image.mimeType, 'image/png');
    assert.equal(image.uri, undefined);
  }
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    for (const name of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
      assert(Number.isInteger(primitive.attributes[name]));
    }
  }
  const checked = new Set();
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    for (const semantic of ['POSITION', 'NORMAL']) {
      const index = primitive.attributes[semantic];
      if (checked.has(index)) continue;
      checked.add(index);
      const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
      const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      for (let i = 0; i < accessor.count; i++) {
        const v = [0,1,2].map(axis => binary.readFloatLE(offset+i*(view.byteStride || 12)+axis*4));
        assert(v.every(Number.isFinite), kind+' '+semantic+' finite');
        if (semantic === 'NORMAL') assert(Math.abs(Math.hypot(...v)-1)<0.01, kind+' normalized surface');
      }
    }
  }
  const clip = gltf.animations.find(animation => animation.name === 'Wingbeat');
  assert(clip);
  {
    for (const name of ['leftWing', 'rightWing']) {
      const node = gltf.nodes.findIndex(item => item.name === name);
      assert(clip.channels.some(channel => channel.target.node === node && channel.target.path === 'weights'));
      assert(gltf.meshes[gltf.nodes[node].mesh].primitives.every(p => p.targets.length === 3));
    }
  }
  for (const name of ['leftWing', 'rightWing']) {
    const node = gltf.nodes.findIndex(item => item.name === name);
    assert(clip.channels.some(channel => channel.target.node === node && channel.target.path === 'rotation'));
  }
  console.log('PASS:', kind, 'embedded textures, articulated parts and wing animation');
}
