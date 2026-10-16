import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { groundHeight, sampleFallingPetal } from '../src/components/peachGround.js';
import { createPeachTreeModel, disposePeachTree } from '../src/components/peachTreeScene.js';

test('petals detach from the canopy, reach the actual terrain and rest above it', () => {
  const petal = { x: -2, y: 3, z: .5, driftX: 1.2, driftZ: .7, flight: 8, rest: 4, phase: 0, spin: 1, size: .09 };
  const start = sampleFallingPetal(petal, 0);
  assert.equal(start.y, 3);
  const middle = sampleFallingPetal(petal, 4);
  assert.ok(middle.y < start.y && middle.y > groundHeight(middle.x, middle.z));
  assert.notEqual(middle.x, start.x);
  const landed = sampleFallingPetal(petal, 8);
  const resting = sampleFallingPetal(petal, 10);
  assert.equal(landed.landed, true);
  assert.equal(landed.y, groundHeight(landed.x, landed.z) + .035);
  assert.equal(resting.y, landed.y);
  assert.equal(resting.rx, -Math.PI / 2);
  assert.equal(resting.x, landed.x);
  for (let time = 0; time < 120; time += .1) {
    const state = sampleFallingPetal(petal, time);
    assert.ok(state.y >= groundHeight(state.x, state.z), 'a falling petal passed through the soil');
  }
});

test('the mature tree stands in a broad garden floor with roots and fallen petals', () => {
  const model = createPeachTreeModel();
  try {
    const floor = model.root.getObjectByName('garden-floor');
    assert.ok(floor && floor.receiveShadow);
    floor.geometry.computeBoundingBox();
    const size = floor.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x > 50 && size.z > 30, 'terrain is only a small display base');
    const trunk = model.root.getObjectByName('ancient-trunk-and-buttress-roots');
    assert.ok(trunk && trunk.castShadow);
    assert.ok(model.petalCarpet.count >= 400);
    assert.ok(model.falling.length >= 90);
    assert.ok(model.falling.every(petal => petal.y > .6));
  } finally { disposePeachTree(model.root); }
});
