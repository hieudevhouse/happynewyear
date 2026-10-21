import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_QR_UPLOAD_BYTES, prepareQrImage } from '../src/lib/prepareQrImage.js';

function fixture(t, { width = 8000, height = 4000, sizes = [1024], delayEncode = false } = {}) {
  const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const renders = [];
  const encoded = [];
  let closes = 0;
  let complete;
  const context = {
    fillRect(...args) { renders.push({ kind: 'fill', color: this.fillStyle, args }); },
    drawImage(...args) { renders.push({ kind: 'image', smoothing: this.imageSmoothingEnabled, args }); },
  };
  const canvas = {
    getContext: () => context,
    toBlob(callback, type) {
      encoded.push({ width: this.width, height: this.height, type });
      const blob = new Blob([new Uint8Array(sizes[Math.min(encoded.length - 1, sizes.length - 1)])], { type });
      if (delayEncode) complete = () => callback(blob);
      else queueMicrotask(() => callback(blob));
    },
  };
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: async () => ({ width, height, close() { closes++; } }) });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { createElement: () => canvas } });
  t.after(() => {
    for (const [key, original] of [['createImageBitmap', originalBitmap], ['document', originalDocument]]) {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    }
  });
  return { renders, encoded, canvas, closed: () => closes, complete: () => complete?.() };
}

test('small images pass through unchanged without decoding', async () => {
  const file = new Blob(['PNG'], { type: 'image/png' });
  assert.equal(await prepareQrImage(file), file);
});

test('large QR preparation keeps aspect ratio, white background, and PNG output', async t => {
  const f = fixture(t);
  const blob = await prepareQrImage({ size: 20 * 1024 * 1024 });
  assert.equal(blob.type, 'image/png');
  assert.ok(blob.size <= MAX_QR_UPLOAD_BYTES);
  assert.deepEqual(f.encoded, [{ width: 4096, height: 2048, type: 'image/png' }]);
  assert.equal(f.renders[0].color, '#fff');
  assert.equal(f.renders[1].smoothing, false);
  assert.equal(f.closed(), 1);
  assert.equal(f.canvas.width, 0);
});

test('incompressible PNG output is progressively resized until within upload limit', async t => {
  const f = fixture(t, { sizes: [MAX_QR_UPLOAD_BYTES + 1, MAX_QR_UPLOAD_BYTES + 1, 1024] });
  await prepareQrImage({ size: 50 * 1024 * 1024 });
  assert.deepEqual(f.encoded.map(item => [item.width, item.height]), [[4096, 2048], [3072, 1536], [2048, 1024]]);
  assert.equal(f.closed(), 1);
});

test('portrait QR remains within canvas dimension bounds', async t => {
  const f = fixture(t, { width: 3000, height: 12000 });
  await prepareQrImage({ size: 20 * 1024 * 1024 });
  assert.deepEqual(f.encoded[0], { width: 1024, height: 4096, type: 'image/png' });
});

test('failed optimization never returns the oversized original', async t => {
  const f = fixture(t, { sizes: [MAX_QR_UPLOAD_BYTES + 1] });
  await assert.rejects(prepareQrImage({ size: 20 * 1024 * 1024 }), /Chưa tối ưu được ảnh QR/);
  assert.equal(f.encoded.length, 5);
  assert.equal(f.closed(), 1);
});

test('cancellation during PNG encoding frees the canvas and bitmap', async t => {
  const f = fixture(t, { delayEncode: true });
  const controller = new AbortController();
  const pending = prepareQrImage({ size: 20 * 1024 * 1024 }, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.encoded.length, 1);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  f.complete();
  assert.equal(f.closed(), 1);
  assert.equal(f.canvas.width, 0);
});

test('Image fallback cancellation revokes its object URL and detaches decoding', async t => {
  fixture(t);
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const originalCreateUrl = URL.createObjectURL;
  const originalRevokeUrl = URL.revokeObjectURL;
  const revoked = [];
  let image;
  globalThis.createImageBitmap = undefined;
  Object.defineProperty(globalThis, 'Image', { configurable: true, writable: true, value: class {
    constructor() { image = this; }
  } });
  URL.createObjectURL = () => 'blob:test-qr';
  URL.revokeObjectURL = url => revoked.push(url);
  t.after(() => {
    URL.createObjectURL = originalCreateUrl;
    URL.revokeObjectURL = originalRevokeUrl;
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage);
    else delete globalThis.Image;
  });
  const controller = new AbortController();
  const pending = prepareQrImage({ size: 20 * 1024 * 1024 }, { signal: controller.signal });
  assert.equal(image.src, 'blob:test-qr');
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(revoked, ['blob:test-qr']);
  assert.equal(image.src, '');
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});
