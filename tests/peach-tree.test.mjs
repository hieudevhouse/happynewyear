import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createPeachTreeModel, createPeachTreeCamera, framePeachTree, animatePeachTree,
  beginPeachTreeOpening, finishPeachTreeOpening, restoreOpenedEnvelopes, disposePeachTree
} from '../src/components/peachTreeScene.js';

function cameraForTree() {
  return createPeachTreeCamera();
}

test('tree geometry and animated transforms stay finite', () => {
  const model = createPeachTreeModel();
  try {
    for (const time of [0, 1, 30, 600]) {
      animatePeachTree(model, time, 1 / 60);
      model.root.updateMatrixWorld(true);
      model.root.traverse(object => {
        assert.ok(object.matrixWorld.elements.every(Number.isFinite));
        if (object.geometry) {
          const vertices = object.geometry.attributes.position.array;
          assert.ok(vertices.every(Number.isFinite), 'invalid geometry vertex');
        }
      });
    }
  } finally { disposePeachTree(model.root); }
});

test('all 16 touch targets remain inside the garden and do not overlap in the wind', () => {
  const model = createPeachTreeModel();
  const camera = cameraForTree();
  const point = new THREE.Vector3();
  try {
    for (const [width, height] of [[288, 384], [320, 568], [320, 440], [351, 464], [387, 512], [567, 563], [768, 1024], [844, 384], [980, 585]]) {
      framePeachTree(camera, model.root, width, height);
      for (let time = 0; time < 30; time += .5) {
        animatePeachTree(model, time, 1 / 60);
        model.root.rotation.y = Math.sin(time) * .038;
        model.root.updateMatrixWorld(true);
        const positions = model.envelopes.map(({ packet }) => {
          packet.getWorldPosition(point).project(camera);
          return { x: (point.x * .5 + .5) * width, y: (.5 - point.y * .5) * height };
        });
        assert.equal(positions.length, 16);
        for (let i = 0; i < positions.length; i++) {
          const p = positions[i];
          assert.ok(p.x >= 22 && p.x <= width - 22 && p.y >= 25 && p.y <= height - 25,
            `packet ${i + 1} clipped at ${width}x${height}`);
          for (let j = i + 1; j < positions.length; j++) {
            assert.ok(Math.abs(p.x - positions[j].x) >= 44 || Math.abs(p.y - positions[j].y) >= 50,
              `touch targets ${i + 1} and ${j + 1} overlap at ${width}x${height}`);
          }
        }
      }
    }
  } finally { disposePeachTree(model.root); }
});

test('opening locks the chosen packet and animates it to the center', () => {
  const model = createPeachTreeModel();
  try {
    assert.equal(beginPeachTreeOpening(model, -1), false);
    assert.equal(beginPeachTreeOpening(model, 16), false);
    assert.equal(beginPeachTreeOpening(model, .5), false);
    assert.equal(beginPeachTreeOpening(model, 7), true);
    assert.equal(beginPeachTreeOpening(model, 8), false);
    for (let frame = 0; frame < 150; frame++) animatePeachTree(model, frame / 60, 1 / 60);
    assert.equal(model.opening.index, 7);
    assert.ok(model.opening.elapsed >= 2.15);
    assert.ok(model.envelopes[7].flap.rotation.x < -2);
    model.root.updateMatrixWorld(true);
    const center = model.envelopes[7].packet.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(center.x) < .01 && center.y > .4 && center.y < 1);
  } finally { disposePeachTree(model.root); }
});

test('reduced motion holds branches, leaves, and falling petals still', () => {
  const model = createPeachTreeModel();
  try {
    animatePeachTree(model, 0, 1 / 60, { reducedMotion: true });
    const rotations = model.branches.map(b => b.group.rotation.toArray());
    const petals = Array.from(model.fallingPetals.instanceMatrix.array);
    animatePeachTree(model, 200, 1 / 60, { reducedMotion: true });
    assert.deepEqual(model.branches.map(b => b.group.rotation.toArray()), rotations);
    assert.deepEqual(Array.from(model.fallingPetals.instanceMatrix.array), petals);
  } finally { disposePeachTree(model.root); }
});

test('finishing an opening removes only that packet and returns to a usable tree', () => {
  const model = createPeachTreeModel();
  try {
    for (const index of [3, 8, 1]) {
      assert.equal(beginPeachTreeOpening(model, index), true);
      for (let frame = 0; frame < 150; frame++) animatePeachTree(model, frame / 60, 1 / 60);
      assert.equal(finishPeachTreeOpening(model), index);
      assert.equal(model.opening, null);
      assert.equal(model.selected, null);
      assert.equal(model.envelopes[index].pivot.visible, false);
      assert.equal(beginPeachTreeOpening(model, index), false);
    }
    assert.deepEqual([...model.opened], [3, 8, 1]);
    assert.equal(model.envelopes[0].pivot.visible, true);
    assert.equal(finishPeachTreeOpening(model), null);
  } finally { disposePeachTree(model.root); }
});

test('restored opened packets stay off the tree and cannot be opened again', () => {
  const model = createPeachTreeModel();
  try {
    restoreOpenedEnvelopes(model, [0, 4, 4, -1, 100]);
    animatePeachTree(model, 5, 1 / 60);
    assert.deepEqual([...model.opened], [0, 4]);
    assert.equal(model.envelopes[0].pivot.visible, false);
    assert.equal(model.envelopes[4].pivot.visible, false);
    assert.equal(beginPeachTreeOpening(model, 4), false);
    assert.equal(beginPeachTreeOpening(model, 5), true);
  } finally { disposePeachTree(model.root); }
});

test('shared geometries are disposed once when leaving the tree screen', () => {
  const model = createPeachTreeModel();
  const geometries = new Map();
  model.root.traverse(object => {
    if (object.geometry && !geometries.has(object.geometry)) {
      const record = { disposed: 0 };
      object.geometry.addEventListener('dispose', () => { record.disposed++; });
      geometries.set(object.geometry, record);
    }
  });
  disposePeachTree(model.root);
  for (const record of geometries.values()) assert.equal(record.disposed, 1);
});
