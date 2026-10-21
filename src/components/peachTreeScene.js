import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPeachGround, groundHeight, sampleFallingPetal } from './peachGround.js';

import { ENVELOPE_ANCHORS, ENVELOPE_STYLES } from '../data/envelopes.js';
export { ENVELOPE_ANCHORS, ENVELOPE_STYLES } from '../data/envelopes.js';

export function seededRandom(seed = 2027) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function taperedBranch(points, radius, tip = .009, roughness = .065, taper = .76) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const segments = Math.max(12, points.length * 7);
  const sides = radius > .3 ? 14 : 9;
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const thickness = THREE.MathUtils.lerp(radius, tip, Math.pow(t, taper));
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const ripple = 1 + Math.sin(angle * 3 + t * 19) * roughness
        + Math.sin(angle * 7 - t * 11) * roughness * .4;
      const v = center.clone()
        .addScaledVector(frames.normals[i], Math.cos(angle) * thickness * ripple)
        .addScaledVector(frames.binormals[i], Math.sin(angle) * thickness * ripple);
      positions.push(v.x, v.y, v.z);
      uvs.push(j / sides, t * Math.max(curve.getLength() / 2, 1));
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j;
        const b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, curve };
}

function mergeBranches(parts) {
  const merged = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  return merged;
}

function leafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-.11, .12, -.08, .3, 0, .4);
  shape.bezierCurveTo(.08, .23, .11, .08, 0, 0);
  return new THREE.ShapeGeometry(shape, 5);
}

function blossomPetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1);
  shape.bezierCurveTo(-.8, -.55, -1, .35, -.55, .8);
  shape.quadraticCurveTo(-.18, 1.1, 0, .83);
  shape.quadraticCurveTo(.18, 1.1, .55, .8);
  shape.bezierCurveTo(1, .35, .8, -.55, 0, -1);
  const geometry = new THREE.ShapeGeometry(shape, 4);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    positions.setZ(i, .24 * x * x + .12 * (1 - y * y));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function barkTexture(random) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#89705b';
  context.fillRect(0, 0, 256, 512);
  // Long, broken grain follows the wood instead of wrapping it in separate ridges.
  for (let i = 0; i < 420; i++) {
    const x = random() * 256, y = random() * 512;
    context.strokeStyle = i % 3 ? '#493b2f' : '#c5a17c';
    context.globalAlpha = .12 + random() * .3;
    context.lineWidth = .4 + random() * 2;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x - 5, y + 20, x + 7, y + 35, x + random() * 5, y + 30 + random() * 100);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function envelopeTexture(style, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 256, 384);
  gradient.addColorStop(0, style.paper);
  gradient.addColorStop(.5, style.color);
  gradient.addColorStop(1, style.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = style.gold;
  ctx.fillStyle = style.gold;
  ctx.lineWidth = 2;
  ctx.globalAlpha = .65;
  ctx.strokeRect(13, 13, 230, 358);
  ctx.strokeRect(20, 20, 216, 344);
  for (let i = 0; i < 45; i++) {
    ctx.globalAlpha = .06;
    ctx.beginPath();
    ctx.moveTo(0, i * 11);
    ctx.lineTo(256, i * 11 - 120);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const flower = (x, y, radius) => {
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * radius * .55, y + Math.sin(a) * radius * .55,
        radius * .45, radius * .65, a + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(x, y, radius * .16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.gold;
  };

  if (style.motif === 'blossom') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(38, 280); ctx.bezierCurveTo(80, 210, 150, 190, 218, 112); ctx.stroke();
    flower(88, 222, 28); flower(148, 177, 34); flower(195, 131, 22);
  } else if (style.motif === 'bamboo') {
    for (let i = 0; i < 3; i++) {
      const x = 75 + i * 55;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, 285); ctx.lineTo(x - 10, 116); ctx.stroke();
      for (let j = 0; j < 3; j++) {
        const y = 150 + j * 52;
        ctx.fillRect(x - 14, y, 18, 3);
        ctx.beginPath();
        ctx.ellipse(x + (j % 2 ? -22 : 14), y - 18, 7, 30, j % 2 ? -.65 : .65, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (style.motif === 'crane') {
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(48, 224); ctx.lineTo(122, 151); ctx.lineTo(106, 210);
    ctx.lineTo(213, 165); ctx.lineTo(147, 241); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(137, 209); ctx.quadraticCurveTo(156, 134, 177, 151);
    ctx.lineTo(197, 156); ctx.stroke();
    ctx.beginPath(); ctx.arc(128, 203, 75, .2, Math.PI * 1.6); ctx.stroke();
  } else if (style.motif === 'coin') {
    ctx.lineWidth = 4;
    for (const radius of [64, 54, 43]) {
      ctx.beginPath(); ctx.arc(128, 199, radius, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeRect(113, 184, 30, 30);
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 76, 199 + Math.sin(a) * 76);
      ctx.lineTo(128 + Math.cos(a) * 86, 199 + Math.sin(a) * 86); ctx.stroke();
    }
  } else if (style.motif === 'waves') {
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.beginPath();
        ctx.arc(34 + col * 64 + (row % 2) * 28, 278 + row * 22, 29, Math.PI, 0);
        ctx.stroke();
      }
    }
    flower(128, 178, 43);
  } else {
    ctx.save(); ctx.translate(128, 199); ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-57, -57, 114, 114); ctx.strokeRect(-50, -50, 100, 100); ctx.restore();
    ctx.font = '64px serif'; ctx.textAlign = 'center'; ctx.fillText(style.symbol, 128, 222);
  }

  ctx.globalAlpha = .9;
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('L Ộ C   X U Â N', 128, 57);
  ctx.font = '17px sans-serif';
  ctx.fillText(String(index + 1).padStart(2, '0') + '  ·  2027', 128, 338);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeEnvelope(index, textureFactory) {
  const style = ENVELOPE_STYLES[index % ENVELOPE_STYLES.length];
  const pivot = new THREE.Group();
  pivot.position.set(...ENVELOPE_ANCHORS[index]);
  const gold = new THREE.MeshStandardMaterial({ color: style.gold, metalness: .65, roughness: .33 });
  const paper = new THREE.MeshStandardMaterial({ color: style.color, roughness: .73 });
  const face = new THREE.MeshStandardMaterial({
    color: textureFactory ? '#ffffff' : style.color,
    map: textureFactory?.(style, index) || null, roughness: .68, metalness: .08
  });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .29, 5), gold);
  cord.position.y = -.145;
  pivot.add(cord);

  const packet = new THREE.Group();
  packet.position.y = -.66;
  const body = new THREE.Mesh(new THREE.BoxGeometry(.48, .7, .055), paper);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(.48, .7), face);
  front.position.z = .03;
  packet.add(body, front);
  const flap = new THREE.Group();
  flap.position.set(0, .35, .033);
  const shape = new THREE.Shape();
  shape.moveTo(-.24, 0); shape.lineTo(.24, 0); shape.quadraticCurveTo(.17, -.16, 0, -.21);
  shape.quadraticCurveTo(-.17, -.16, -.24, 0);
  const flapMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({ color: style.paper, side: THREE.DoubleSide, roughness: .6 }));
  flap.add(flapMesh);
  packet.add(flap);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .009, 16), gold);
  seal.rotation.x = Math.PI / 2;
  seal.position.set(0, -.18, .012);
  flap.add(seal);
  const tassel = new THREE.Group();
  tassel.position.y = -.43;
  const strands = [];
  for (let i = 0; i < 5; i++) {
    const strand = new THREE.CylinderGeometry(.006, .003, .16, 3);
    strand.translate((i - 2) * .014, -.06, 0);
    strands.push(strand);
  }
  tassel.add(new THREE.Mesh(mergeBranches(strands), gold));
  packet.add(tassel);
  const halo = new THREE.Mesh(new THREE.RingGeometry(.41, .43, 48),
    new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0, depthWrite: false }));
  halo.position.z = -.06;
  packet.add(halo);
  pivot.add(packet);
  return { pivot, packet, flap, tassel, halo, index, style, home: pivot.position.clone(), scale: 1 };
}

export function createPeachTreeModel({ textureFactory = null } = {}) {
  const random = seededRandom();
  const root = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({
    color: textureFactory ? '#d1b69a' : '#80604a', roughness: .94,
    map: textureFactory ? barkTexture(seededRandom(81)) : null
  });
  const petalGeometry = blossomPetalGeometry();
  const centerGeometry = new THREE.SphereGeometry(1, 5, 4);
  const petalsMaterial = new THREE.MeshStandardMaterial({ color: '#fff4f7', side: THREE.DoubleSide, roughness: .72 });
  const innerMaterial = new THREE.MeshStandardMaterial({ color: '#ffb6ce', side: THREE.DoubleSide, roughness: .7 });
  const centerMaterial = new THREE.MeshStandardMaterial({ color: '#ffd075', roughness: .55, metalness: .12 });
  const leavesMaterial = new THREE.MeshStandardMaterial({ color: '#65a13d', roughness: .85, side: THREE.DoubleSide });
  const leafShape = leafGeometry();
  const dummy = new THREE.Object3D();
  const trunkPoints = [[0, -3.48, 0], [-.28, -2.85, .04], [-.43, -2.05, .1],
    [-.17, -1.25, .02], [.24, -.45, -.12], [.16, .38, -.24],
    [.53, 1.28, -.38], [.75, 2.25, -.48], [.52, 3.45, -.57]];
  const mainTrunk = taperedBranch(trunkPoints, .78, .045, .075, 1.12);
  const wood = [mainTrunk.geometry];
  // Uneven buttress roots sink into the lawn and give the old tree a firm stance.
  for (const [a, spread, radius] of [[.2, 1.95, .29], [1.15, 1.45, .24], [2.5, 2.15, .34],
    [3.4, 1.7, .26], [4.35, 1.65, .23], [5.45, 2.3, .31]]) {
    const x = Math.cos(a) * spread, z = Math.sin(a) * spread * .65;
    wood.push(taperedBranch([[-.19, -2.92, .03], [Math.cos(a) * .65 - .13, -3.23, Math.sin(a) * .42],
      [x * .73, groundHeight(x * .73, z * .73) + .045, z * .73],
      [x, groundHeight(x, z) - .09, z]], radius, .012, .07).geometry);
  }
  const trunk = new THREE.Mesh(mergeBranches(wood), bark);
  trunk.name = 'ancient-trunk-and-buttress-roots';
  trunk.castShadow = true;
  root.add(trunk);
  // Asymmetric ascending boughs leave the sweeping trunk visible between flower clouds.
  const specifications = [
    [[-.26, -1.43, -.12], [-1.15, -.92, -.25], [-2.3, -1.05, -.38], [-3.48, -.75, -.28], [-4.25, .1, -.4]],
    [[.2, -.6, -.19], [1.24, -.48, -.42], [2.45, -.8, -.38], [3.62, -.44, -.3], [4.35, .5, -.36]],
    [[-.08, -.92, -.14], [-.92, .35, -.4], [-2.27, .82, -.48], [-3.55, 1.2, -.6], [-4.34, 2.16, -.6]],
    [[.19, .25, -.3], [1.35, 1.08, -.54], [2.68, 1.26, -.6], [3.72, 1.9, -.66], [4.25, 2.58, -.7]],
    [[.46, 1.1, -.4], [-.52, 1.9, -.6], [-1.76, 2.5, -.7], [-3, 2.72, -.76], [-3.8, 3.35, -.8]],
    [[.65, 1.82, -.49], [1.44, 2.54, -.7], [2.18, 3.04, -.73], [3, 3.42, -.8], [3.44, 3.86, -.82]],
    [[.7, 2.22, -.49], [.08, 2.98, -.68], [-.88, 3.42, -.76], [-1.75, 3.5, -.8], [-2.3, 4.02, -.85]],
    [[.71, 2.68, -.54], [.5, 3.35, -.65], [.92, 3.85, -.75], [.5, 4.35, -.8]]
  ];
  const branchRadii = [.38, .31, .42, .32, .28, .2, .19, .12];
  const branches = [];
  const petalSources = [];
  specifications.forEach((points, branchIndex) => {
    const group = new THREE.Group();
    group.position.set(...points[0]);
    const local = points.map(p => [p[0] - points[0][0], p[1] - points[0][1], p[2] - points[0][2]]);
    const main = taperedBranch(local, branchRadii[branchIndex], .014, .065, .95);
    const twigs = [main.geometry];
    const flowerPositions = [];
    for (let i = 0; i < 11; i++) {
      const t = .2 + i * .073;
      const start = main.curve.getPoint(t);
      const direction = Math.sign(points.at(-1)[0] - points[0][0]) || 1;
      const end = start.clone().add(new THREE.Vector3(direction * (.25 + random() * .48),
        .28 + random() * .48, (random() - .5) * .9));
      const middle = start.clone().lerp(end, .55).add(new THREE.Vector3(-direction * .14, -.08, .04));
      const twig = taperedBranch([start.toArray(), middle.toArray(), end.toArray()], .035, .004);
      twigs.push(twig.geometry);
      for (let j = 0; j < 11; j++) {
        const flower = twig.curve.getPoint(.18 + random() * .82);
        flower.add(new THREE.Vector3((random() - .5) * .45, (random() - .5) * .4, (random() - .5) * .48));
        flowerPositions.push(flower);
      }
    }
    const bough = new THREE.Mesh(mergeBranches(twigs), bark);
    bough.castShadow = true;
    group.add(bough);
    const outer = new THREE.InstancedMesh(petalGeometry, petalsMaterial, flowerPositions.length * 5);
    const inner = new THREE.InstancedMesh(petalGeometry, innerMaterial, flowerPositions.length * 5);
    const centers = new THREE.InstancedMesh(centerGeometry, centerMaterial, flowerPositions.length);
    const leaves = new THREE.InstancedMesh(leafShape, leavesMaterial, flowerPositions.length);
    flowerPositions.forEach((p, i) => {
      const source = p.clone().add(group.position);
      if (source.y > .6) petalSources.push(source);
      const size = .63 + random() * .6;
      const tilt = (random() - .5) * .8;
      const blossomColor = new THREE.Color(['#d52b56', '#eb507d', '#f27c9f', '#ffb2ca', '#f795b4'][i % 5]);
      for (let k = 0; k < 5; k++) {
        const angle = k * Math.PI * 2 / 5 + tilt;
        dummy.position.set(p.x + Math.cos(angle) * .071 * size, p.y + Math.sin(angle) * .071 * size, p.z);
        dummy.rotation.set((random() - .5) * .5, (random() - .5) * .4, angle - Math.PI / 2);
        dummy.scale.set(.073 * size, .115 * size, .035 * size);
        dummy.updateMatrix(); outer.setMatrixAt(i * 5 + k, dummy.matrix);
        outer.setColorAt(i * 5 + k, blossomColor);
        const a = angle + .6;
        dummy.position.set(p.x + Math.cos(a) * .041 * size, p.y + Math.sin(a) * .041 * size, p.z + .032);
        dummy.rotation.z = a - Math.PI / 2;
        dummy.scale.set(.05 * size, .08 * size, .027 * size);
        dummy.updateMatrix(); inner.setMatrixAt(i * 5 + k, dummy.matrix);
      }
      dummy.position.copy(p).add(new THREE.Vector3(0, 0, .055));
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.026 * size);
      dummy.updateMatrix(); centers.setMatrixAt(i, dummy.matrix);
      dummy.position.copy(p).add(new THREE.Vector3(.09, -.09, -.035));
      dummy.rotation.set((random() - .5) * .7, random() * .8, random() * Math.PI * 2);
      dummy.scale.setScalar(.3 + random() * .32);
      dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    });
    group.add(outer, inner, centers, leaves);
    root.add(group);
    branches.push({ group, leaves, phase: branchIndex * 1.31 });
  });

  const ground = createPeachGround(random, { textured: Boolean(textureFactory) });
  root.add(ground.group);

  for (const [z, elevation, color] of [[-15, -3.4, '#b4dca0'], [-12.5, -3.55, '#8fc775']]) {
    const hill = new THREE.Shape();
    hill.moveTo(-65, -8);
    hill.lineTo(-65, elevation);
    for (let x = -65; x <= 65; x += 1) {
      hill.lineTo(x, elevation + Math.sin(x * .18 + z) * .24 + Math.sin(x * .37) * .09);
    }
    hill.lineTo(65, -8);
    hill.closePath();
    const meadow = new THREE.Mesh(new THREE.ShapeGeometry(hill), new THREE.MeshBasicMaterial({ color }));
    meadow.position.z = z;
    meadow.name = 'distant-spring-meadow';
    root.add(meadow);
  }

  // Each cord ends at its own twig, so packets never hang unsupported in space.
  const hooks = [];
  const limbs = specifications.map(points => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))));
  const envelopes = ENVELOPE_ANCHORS.map((anchor, index) => {
    const end = new THREE.Vector3(...anchor);
    let from = new THREE.Vector3();
    let nearest = Infinity;
    for (const limb of limbs) for (let j = 1; j <= 24; j++) {
      const candidate = limb.getPoint(j / 24);
      const distance = candidate.distanceToSquared(end);
      if (distance < nearest) { nearest = distance; from.copy(candidate); }
    }
    const middle = from.clone().lerp(end, .55).add(new THREE.Vector3(0, .12, -.1));
    hooks.push(taperedBranch([from.toArray(), middle.toArray(), end.toArray()], .035, .008).geometry);
    const envelope = makeEnvelope(index, textureFactory);
    root.add(envelope.pivot);
    return envelope;
  });
  root.add(new THREE.Mesh(mergeBranches(hooks), bark));

  const fallingPetals = new THREE.InstancedMesh(ground.petalGeometry,
    ground.petalMaterial.clone(), 96);
  fallingPetals.material.color.set('#ff94b7');
  fallingPetals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fallingPetals.frustumCulled = false;
  root.add(fallingPetals);
  const falling = Array.from({ length: 96 }, () => {
    const source = petalSources[Math.floor(random() * petalSources.length)];
    return {
      x: source.x, y: source.y, z: source.z + .4,
      driftX: .4 + random() * 1.2, driftZ: .4 + random() * 1.2,
      flight: 6 + random() * 5, rest: 3 + random() * 4,
      phase: random() * 17, spin: random() * Math.PI * 2, size: .065 + random() * .045
    };
  });
  const sparklePositions = [];
  for (let i = 0; i < 70; i++) sparklePositions.push((random() - .5) * 10, random() * 8 - 3.5, random() * 4 - 2);
  const sparkles = new THREE.Points(new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute(sparklePositions, 3)),
  new THREE.PointsMaterial({ color: '#ffe4ac', size: .025, transparent: true, opacity: .7, depthWrite: false }));
  root.add(sparkles);
  const burstPositions = Array.from({ length: 80 * 3 }, () => 0);
  const burst = new THREE.Points(new THREE.BufferGeometry().setAttribute('position',
    new THREE.Float32BufferAttribute(burstPositions, 3)),
  new THREE.PointsMaterial({ color: '#ffe3a1', size: .06, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending }));
  burst.frustumCulled = false;
  root.add(burst);
  return { root, branches, envelopes, fallingPetals, falling, ground: ground.group, petalCarpet: ground.carpet, sparkles, burst, dummy, selected: null, opening: null, opened: new Set() };
}

export function createPeachTreeCamera() {
  const camera = new THREE.OrthographicCamera(-6, 6, 5, -5, .1, 120);
  camera.position.set(0, 5.4, 20);
  camera.lookAt(0, .45, 0);
  camera.updateMatrixWorld();
  return camera;
}

export function framePeachTree(camera, root, width, height) {
  const aspect = width / Math.max(height, 1);
  const squeeze = THREE.MathUtils.clamp(aspect * .42 + .4, .72, 1);
  root.scale.x = squeeze;
  const viewHeight = Math.max(9.8, 11.5 * squeeze / aspect);
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  // Packets retain their proportions when the canopy narrows on a phone.
  root.userData.envelopeWidth = 1 / squeeze;
  root.userData.packetScale = aspect < 1 ? 1.28 : 1.12;
}

export function animatePeachTree(model, time, delta, { reducedMotion = false } = {}) {
  const { dummy } = model;
  const t = reducedMotion ? 0 : time;
  model.branches.forEach(({ group, leaves, phase }) => {
    group.rotation.z = Math.sin(t * .63 + phase) * .012;
    group.rotation.x = Math.sin(t * .47 + phase) * .014;
    leaves.rotation.y = Math.sin(t * .9 + phase) * .018;
  });
  model.envelopes.forEach(envelope => {
    if (model.opened.has(envelope.index)) { envelope.pivot.visible = false; return; }
    const selected = envelope.index === model.selected;
    const opening = model.opening?.index === envelope.index;
    const sway = Math.sin(t * 1.13 + envelope.index * 1.7);
    envelope.packet.scale.setScalar(model.root.userData.packetScale || 1);
    if (!opening) {
      envelope.pivot.rotation.set(Math.sin(t * .8 + envelope.index) * .035, sway * .08, sway * .065);
      envelope.scale = THREE.MathUtils.damp(envelope.scale, selected ? 1.14 : 1, 8, delta);
      envelope.pivot.scale.set(envelope.scale * (model.root.userData.envelopeWidth || 1), envelope.scale, envelope.scale);
    }
    envelope.tassel.rotation.z = Math.sin(t * 1.9 + envelope.index) * .13;
    envelope.halo.material.opacity = THREE.MathUtils.damp(envelope.halo.material.opacity, selected ? .8 : 0, 8, delta);
    envelope.halo.rotation.z = t * .1;
  });
  model.falling.forEach((petal, i) => {
    const state = sampleFallingPetal(petal, t);
    dummy.position.set(state.x, state.y, state.z);
    dummy.rotation.set(state.rx, state.ry, state.rz);
    dummy.scale.set(state.scale, state.scale * 1.35, state.scale);
    dummy.updateMatrix();
    model.fallingPetals.setMatrixAt(i, dummy.matrix);
  });
  model.fallingPetals.instanceMatrix.needsUpdate = true;
  model.sparkles.material.opacity = .48 + Math.sin(t * .7) * .15;

  if (model.opening) {
    const opening = model.opening;
    opening.elapsed += delta;
    const progress = THREE.MathUtils.clamp(opening.elapsed / 2.1, 0, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const envelope = model.envelopes[opening.index];
    envelope.pivot.position.copy(envelope.home).lerp(new THREE.Vector3(0, 2.65, 4.5), ease);
    envelope.pivot.rotation.set(0, Math.sin(progress * Math.PI) * .45, 0);
    const scale = 1.14 + ease * 1.9;
    envelope.pivot.scale.set(scale * (model.root.userData.envelopeWidth || 1), scale, scale);
    envelope.flap.rotation.x = -Math.max(0, (progress - .35) / .65) * Math.PI * .85;
    envelope.halo.material.opacity = .9;
    envelope.halo.scale.setScalar(1 + ease * .8);
    const positions = model.burst.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const a = i * 2.39996;
      const radius = Math.max(0, progress - .35) * (1.3 + i % 7 * .22);
      positions.setXYZ(i, Math.cos(a) * radius, .65 + Math.sin(a) * radius, 4.6 + Math.sin(i) * radius * .4);
    }
    positions.needsUpdate = true;
    model.burst.material.opacity = Math.sin(progress * Math.PI) * .9;
  }
}

export function disposePeachTree(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse(object => {
    if (object.isLight && object.shadow) object.shadow.dispose();
    if (object.geometry) geometries.add(object.geometry);
    // InstancedMesh also owns GPU buffers separate from its shared geometry.
    if (object.isInstancedMesh) object.dispose();
    if (object.material) for (const material of [object.material].flat()) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
}

export function beginPeachTreeOpening(model, index) {
  if (model.opening || !Number.isInteger(index) || !model.envelopes[index] || model.opened.has(index)) return false;
  model.selected = index;
  model.opening = { index, elapsed: 0, complete: false };
  return true;
}

export function restoreOpenedEnvelopes(model, indices) {
  model.opened = new Set(indices.filter(index => Number.isInteger(index) && Boolean(model.envelopes[index])));
  model.envelopes.forEach(envelope => { envelope.pivot.visible = !model.opened.has(envelope.index); });
}

export function finishPeachTreeOpening(model) {
  if (!model.opening) return null;
  const index = model.opening.index;
  const envelope = model.envelopes[index];
  model.opened.add(index);
  envelope.pivot.visible = false;
  envelope.pivot.position.copy(envelope.home);
  envelope.pivot.rotation.set(0, 0, 0);
  envelope.pivot.scale.set(1, 1, 1);
  envelope.flap.rotation.x = 0;
  envelope.halo.material.opacity = 0;
  envelope.halo.scale.setScalar(1);
  envelope.scale = 1;
  model.selected = null;
  model.opening = null;
  model.burst.material.opacity = 0;
  return index;
}

export function mountPeachTree(host, targets, { onReady, onError, onOpened, opened = [] } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    onError?.(error);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#c9edfa', 29, 75);
  const camera = createPeachTreeCamera();
  scene.add(new THREE.HemisphereLight('#e5f5ff', '#6b9952', 2.15));
  const key = new THREE.DirectionalLight('#fff2d5', 2.3);
  key.position.set(-6, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -.0004;
  key.shadow.normalBias = .04;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#fff0ea', 1.15);
  rim.position.set(5, 3, -3); scene.add(rim);
  const model = createPeachTreeModel({ textureFactory: envelopeTexture });
  restoreOpenedEnvelopes(model, opened);
  scene.add(model.root);
  const point = new THREE.Vector3();
  const packetScale = new THREE.Vector3();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;
  let paused = false;
  let visible = true;
  let width = 1;
  let height = 1;
  let frame;
  let last = performance.now();
  let time = 0;
  let pointerX = 0;
  let reported = false;
  let destroyed = false;

  const resize = () => {
    width = Math.max(host.clientWidth, 1);
    height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height);
    framePeachTree(camera, model.root, width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; });
  intersection.observe(host);
  const onPointerMove = event => {
    if (event.pointerType !== 'mouse') return;
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - .5) * .075;
  };
  const onPointerLeave = () => { pointerX = 0; };
  const onMotion = event => { reducedMotion = event.matches; };
  const onContextLost = event => { event.preventDefault(); onError?.(new Error('WebGL context lost')); };
  host.parentElement.addEventListener('pointermove', onPointerMove);
  host.parentElement.addEventListener('pointerleave', onPointerLeave);
  motionQuery.addEventListener('change', onMotion);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

  const animate = now => {
    if (destroyed) return;
    frame = requestAnimationFrame(animate);
    const delta = Math.min((now - last) / 1000, .05);
    last = now;
    if (!visible || document.hidden) return;
    if (!paused && !reducedMotion) time += delta;
    model.root.rotation.y = THREE.MathUtils.damp(model.root.rotation.y, reducedMotion ? 0 : pointerX, 3, delta);
    animatePeachTree(model, time, delta, { reducedMotion });
    model.root.updateMatrixWorld(true);
    model.envelopes.forEach(({ packet, index }) => {
      const target = targets[index];
      if (!target) return;
      packet.getWorldPosition(point);
      point.project(camera);
      target.style.transform = `translate3d(${(point.x * .5 + .5) * width}px, ${(-point.y * .5 + .5) * height}px, 0) translate(-50%, -50%)`;
      packet.getWorldScale(packetScale);
      target.style.width = `${Math.max(44, .48 * packetScale.x * width / (camera.right - camera.left) + 8)}px`;
      target.style.height = `${Math.max(50, .7 * packetScale.y * height / (camera.top - camera.bottom) + 8)}px`;
      target.style.visibility = model.opening || model.opened.has(index) ? 'hidden' : 'visible';
    });
    renderer.render(scene, camera);
    if (!reported) { reported = true; onReady?.(); }
    if (model.opening?.elapsed >= 2.65 && !model.opening.complete) {
      model.opening.complete = true;
      const index = finishPeachTreeOpening(model);
      onOpened?.(index);
    }
  };
  frame = requestAnimationFrame(animate);

  return {
    setOpened(indices) { restoreOpenedEnvelopes(model, indices); },
    select(index) { model.selected = index; },
    pause(value) { paused = value; },
    open(index) {
      return beginPeachTreeOpening(model, index);
    },
    dispose() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      host.parentElement?.removeEventListener('pointermove', onPointerMove);
      host.parentElement?.removeEventListener('pointerleave', onPointerLeave);
      motionQuery.removeEventListener('change', onMotion);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      disposePeachTree(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
}
