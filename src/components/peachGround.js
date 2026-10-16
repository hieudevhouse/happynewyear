import * as THREE from 'three';

export const GROUND_LEVEL = -3.48;

export function groundHeight(x, z) {
  return GROUND_LEVEL + Math.sin(x * .85) * Math.cos(z * .7) * .025
    + Math.sin(x * 1.9 + z * 1.25) * .018 + .085 * Math.exp(-(x * x + z * z) / 5);
}

function lawnTexture(random) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;
  // The vertex colors supply the meadow green; this light texture adds fine
  // strands without multiplying the lawn into a dark brown surface.
  context.fillStyle = '#e2edc9';
  context.fillRect(0, 0, 512, 512);
  const colors = ['#b4d58c', '#f1f6d3', '#8dbb70', '#cce5ab', '#d9ebbb'];
  for (let i = 0; i < 18000; i++) {
    const x = random() * 512, y = random() * 512;
    context.strokeStyle = colors[i % colors.length];
    context.globalAlpha = .18 + random() * .35;
    context.lineWidth = .5 + random() * 1.1;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (random() - .5) * 4, y - 1.5 - random() * 5);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 9);
  return texture;
}

export function loosePetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.75);
  shape.bezierCurveTo(-.9, -.25, -.85, .65, -.3, .9);
  shape.quadraticCurveTo(-.1, 1, 0, .77);
  shape.quadraticCurveTo(.1, 1, .3, .9);
  shape.bezierCurveTo(.85, .65, .9, -.25, 0, -.75);
  const geometry = new THREE.ShapeGeometry(shape, 5);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setZ(i, .16 * Math.pow(positions.getX(i), 2) + .08 * positions.getY(i));
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createPeachGround(random, { textured = false } = {}) {
  const group = new THREE.Group();
  group.name = 'orchard-ground';
  // A continuous garden floor, extending well beyond the tree's roots.
  const geometry = new THREE.PlaneGeometry(120, 48, 100, 48);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, 13);
  const positions = geometry.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, groundHeight(x, z));
    const patch = .5 + .5 * Math.sin(x * .36 + z * .22) * Math.cos(z * .48 - x * .17);
    color.set('#3d8e35').lerp(new THREE.Color('#80bd4b'), patch);
    color.multiplyScalar(.94 + random() * .12);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: 1,
    map: textured ? lawnTexture(random) : null
  }));
  ground.name = 'garden-floor';
  ground.receiveShadow = true;
  group.add(ground);

  // Soft canopy shade and a tighter contact shadow under the old roots.
  let shadowMap = null;
  if (textured && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
      gradient.addColorStop(0, '#000000aa'); gradient.addColorStop(.5, '#00000077'); gradient.addColorStop(1, '#00000000');
      context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
      shadowMap = new THREE.CanvasTexture(canvas);
    }
  }
  for (const [x, z, sx, sz, opacity] of [[.8, -.35, 5.8, 3.7, .17], [0, .15, 2.2, 1.5, .3]]) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
      color: '#172019', map: shadowMap, transparent: true, opacity, depthWrite: false
    }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, groundHeight(x, z) + .028, z);
    shadow.scale.set(sx, sz, 1);
    group.add(shadow);
  }

  const dummy = new THREE.Object3D();
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const rocks = new THREE.InstancedMesh(rockGeometry, new THREE.MeshStandardMaterial({ color: '#8b9274', roughness: 1 }), 18);
  for (let i = 0; i < rocks.count; i++) {
    const angle = random() * Math.PI * 2;
    const distance = 1.6 + random() * 5;
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance * .6;
    const size = .07 + random() * .22;
    dummy.position.set(x, groundHeight(x, z) + size * .2, z);
    dummy.rotation.set(random(), random() * 4, random());
    dummy.scale.set(size * 1.7, size * .65, size);
    dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.castShadow = true; rocks.receiveShadow = true; group.add(rocks);

  const blade = new THREE.BufferGeometry();
  // A softly bent, tapering blade with a sunlit tip. Thousands of blades still
  // render in one instanced draw call.
  blade.setAttribute('position', new THREE.Float32BufferAttribute([
    -.024, 0, 0, .024, 0, 0,
    -.014, .13, .012, .018, .13, .012,
    .002, .24, .04, .019, .24, .04,
    .033, .34, .085
  ], 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute([
    .62, .72, .47, .62, .72, .47,
    .83, .91, .67, .83, .91, .67,
    1, 1, .84, 1, 1, .84,
    1, 1, .94
  ], 3));
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  blade.computeVertexNormals();
  const grass = new THREE.InstancedMesh(blade,
    new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 6200);
  grass.name = 'spring-meadow-grass';
  const grassColors = ['#58a33b', '#6bb548', '#85c34e', '#419337', '#a1ce58'];
  for (let i = 0; i < grass.count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = .85 + Math.sqrt(random()) * 13;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius * .68 + 1;
    dummy.position.set(x, groundHeight(x, z), z);
    dummy.rotation.set((random() - .5) * .2, random() * Math.PI * 2, (random() - .5) * .3);
    const size = .45 + random() * .75;
    dummy.scale.set(.8 + random() * .65, size, size);
    dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
    color.set(grassColors[i % grassColors.length]);
    grass.setColorAt(i, color);
  }
  grass.receiveShadow = true;
  group.add(grass);

  const petalGeometry = loosePetalGeometry();
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff', side: THREE.DoubleSide, roughness: .9, emissive: '#55152b', emissiveIntensity: .1
  });
  const carpet = new THREE.InstancedMesh(petalGeometry, petalMaterial, 480);
  carpet.name = 'fallen-peach-petals';
  for (let i = 0; i < carpet.count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 5.7;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius * .58 + .8;
    dummy.position.set(x, groundHeight(x, z) + .035, z);
    dummy.rotation.set(-Math.PI / 2 + (random() - .5) * .14, 0, random() * Math.PI * 2);
    dummy.scale.set(.045 + random() * .035, .07 + random() * .04, .05);
    dummy.updateMatrix(); carpet.setMatrixAt(i, dummy.matrix);
    color.set(['#f27096', '#ffacc3', '#df3c69', '#ffc4d3'][i % 4]);
    carpet.setColorAt(i, color);
  }
  group.add(carpet);
  return { group, petalGeometry, petalMaterial, carpet };
}

export function sampleFallingPetal(petal, time) {
  const duration = petal.flight + petal.rest;
  const age = ((time + petal.phase) % duration + duration) % duration;
  const progress = Math.min(age / petal.flight, 1);
  const eased = Math.pow(progress, .92);
  const flutter = Math.sin(age * 2.1 + petal.spin) * .2 * Math.sin(progress * Math.PI);
  const x = petal.x + petal.driftX * progress + flutter;
  const z = petal.z + petal.driftZ * progress + Math.sin(age * 1.4) * .12 * Math.sin(progress * Math.PI);
  const floor = groundHeight(x, z) + .035;
  const y = Math.max(floor, THREE.MathUtils.lerp(petal.y, floor, eased));
  const landed = age >= petal.flight;
  const settle = THREE.MathUtils.smoothstep(progress, .88, 1);
  const fade = Math.min(age / .3, 1, (duration - age) / .8);
  return {
    x, y, z, landed,
    rx: THREE.MathUtils.lerp(Math.sin(age * 1.8 + petal.spin) * .75, -Math.PI / 2, settle),
    ry: Math.cos(age * 1.3 + petal.spin) * .6 * (1 - settle),
    rz: landed ? petal.spin + petal.flight * .6 : petal.spin + age * .6,
    scale: Math.max(0, fade) * petal.size
  };
}
