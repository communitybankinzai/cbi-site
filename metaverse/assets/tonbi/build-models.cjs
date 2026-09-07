const fs = require('node:fs');
const path = require('node:path');
require('../../sky-tag.js');
for (const kind of ['kite', 'swan']) {
  const gltf = JSON.parse(Buffer.from(SkyTag.birdModel(kind).split(',')[1], 'base64').toString());
  const chunks = [Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64')];
  let offset = chunks[0].length;
  gltf.images.forEach(image => {
    const png = fs.readFileSync(path.join(__dirname, new URL(image.uri).pathname.split('/').pop()));
    image.bufferView = gltf.bufferViews.length;
    image.mimeType = 'image/png'; delete image.uri;
    gltf.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: png.length});
    chunks.push(png); offset += png.length;
    const padding = (4 - offset % 4) % 4; chunks.push(Buffer.alloc(padding)); offset += padding;
  });
  gltf.buffers = [{byteLength: offset}];
  const rawJson = Buffer.from(JSON.stringify(gltf));
  const json = Buffer.concat([rawJson, Buffer.alloc((4-rawJson.length%4)%4, 32)]);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+bin.length,8);
  const chunkHeader = (length, type) => { const b=Buffer.alloc(8);b.writeUInt32LE(length);b.writeUInt32LE(type,4);return b; };
  fs.writeFileSync(path.join(__dirname, kind + '.glb'), Buffer.concat([header, chunkHeader(json.length,0x4e4f534a), json, chunkHeader(bin.length,0x004e4942), bin]));
  console.log(kind, 'bytes:', 28+json.length+bin.length, 'parts:', gltf.nodes.length-1);
}
