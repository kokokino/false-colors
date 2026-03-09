#!/usr/bin/env node
/**
 * Inspects a GLB file and reports morph targets, nodes, skins, and mesh info.
 * Usage: node tools/inspect-glb.js <path-to-glb>
 */

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node tools/inspect-glb.js <path-to-glb>');
  process.exit(1);
}

const stats = fs.statSync(filePath);
console.log(`File: ${filePath}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

const buf = fs.readFileSync(filePath);
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.slice(20, 20 + jsonLen).toString('utf8').replace(/\0+$/, '');
const json = JSON.parse(jsonStr);

// Meshes and morph targets
for (const m of json.meshes || []) {
  const names = (m.extras && m.extras.targetNames) || [];
  console.log(`Mesh: ${m.name}`);
  if (m.primitives) {
    const verts = m.primitives.reduce((sum, p) => {
      const acc = json.accessors[p.attributes.POSITION];
      return sum + (acc ? acc.count : 0);
    }, 0);
    console.log(`  Vertices: ${verts}`);
  }
  if (names.length > 0) {
    console.log(`  Morph targets (${names.length}):`);
    names.forEach(n => console.log(`    - ${n}`));
  } else {
    console.log('  Morph targets: none');
  }
  console.log('');
}

// Summary
console.log(`Nodes: ${json.nodes.length}`);
console.log(`Skins: ${(json.skins || []).length}`);
console.log(`Materials: ${(json.materials || []).length}`);
console.log(`Textures: ${(json.textures || []).length}`);
console.log(`Animations: ${(json.animations || []).length}`);
