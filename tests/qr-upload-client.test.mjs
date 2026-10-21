import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_QR_IMAGE_BYTES, uploadQr } from '../src/lib/qrUpload.js';

function fixture(t, { response, optimize = false } = {}) {
  const originalReader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFetch = globalThis.fetch;
  const readers = [];
  const requests = [];
  class Reader {
    constructor() { readers.push(this); }
    readAsDataURL(file) {
      this.file = file;
      queueMicrotask(async () => {
        const bytes = Buffer.from(await file.arrayBuffer());
        if (this.aborted) return;
        this.result = `data:${file.type};base64,${bytes.toString('base64')}`;
        this.onload?.();
      });
    }
    abort() { this.aborted = true; this.onabort?.(); }
  }
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, writable: true, value: Reader });
  if (optimize) {
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: async () => ({ width: 8000, height: 4000, close() {} }) });
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: {
      createElement: () => ({
        getContext: () => ({ fillRect() {}, drawImage() {} }),
        toBlob: callback => queueMicrotask(() => callback(new Blob(['optimized PNG'], { type: 'image/png' }))),
      }),
    } });
  }
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return response || new Response(JSON.stringify({ image: { url: 'https://res.cloudinary.com/test/image/upload/lucky-money/qr/test.png', publicId: 'lucky-money/qr/test' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalReader) Object.defineProperty(globalThis, 'FileReader', originalReader);
    else delete globalThis.FileReader;
    if (originalBitmap) Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap);
    else delete globalThis.createImageBitmap;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete globalThis.document;
  });
  return { readers, requests };
}

test('invalid or oversized QR images never start a file read or upload', async t => {
  const { readers, requests } = fixture(t);
  for (const file of [null, { type: 'image/svg+xml', size: 10 }, { type: 'image/png', size: 0 }, { type: 'image/jpeg', size: MAX_QR_IMAGE_BYTES + 1 }]) {
    await assert.rejects(uploadQr(file));
  }
  assert.equal(readers.length, 0);
  assert.equal(requests.length, 0);
});

test('QR selection accepts actual files through 50 MiB and optimizes large uploads', async t => {
  const { readers, requests } = fixture(t, { optimize: true });
  assert.equal(MAX_QR_IMAGE_BYTES, 50 * 1024 * 1024);
  for (const size of [6 * 1024 * 1024, MAX_QR_IMAGE_BYTES]) {
    const file = new Blob([new Uint8Array(size)], { type: 'image/png' });
    const image = await uploadQr(file);
    assert.equal(image.publicId, 'lucky-money/qr/test');
    if (size === MAX_QR_IMAGE_BYTES) {
      assert.notEqual(readers.at(-1).file, file);
      assert.ok(readers.at(-1).file.size < 9 * 1024 * 1024);
    } else assert.equal(readers.at(-1).file, file);
  }
  assert.equal(requests.length, 2);
});

test('a 20 MiB recipient QR sends optimized PNG data rather than the original', async t => {
  const { requests } = fixture(t, { optimize: true });
  const progress = [];
  const file = new Blob([new Uint8Array(20 * 1024 * 1024)], { type: 'image/jpeg' });
  await uploadQr(file, { onProgress: phase => progress.push(phase) });
  assert.deepEqual(progress, ['preparing', 'uploading']);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    image: `data:image/png;base64,${Buffer.from('optimized PNG').toString('base64')}`,
  });
});

test('cancelling image preparation prevents file reads and network requests', async t => {
  const { readers, requests } = fixture(t, { optimize: true });
  const controller = new AbortController();
  let resolveBitmap;
  let closed = 0;
  globalThis.createImageBitmap = () => new Promise(resolve => { resolveBitmap = resolve; });
  const pending = uploadQr(new Blob([new Uint8Array(20 * 1024 * 1024)], { type: 'image/png' }), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  resolveBitmap({ width: 6000, height: 4000, close() { closed++; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, 1);
  assert.equal(readers.length, 0);
  assert.equal(requests.length, 0);
});

test('an unreadable large QR never uploads the original after optimization fails', async t => {
  const { readers, requests } = fixture(t, { optimize: true });
  globalThis.createImageBitmap = async () => { throw new Error('Invalid image'); };
  await assert.rejects(uploadQr(new Blob([new Uint8Array(20 * 1024 * 1024)], { type: 'image/png' })), /Không đọc được ảnh QR/);
  assert.equal(readers.length, 0);
  assert.equal(requests.length, 0);
});

test('admin and player QR images use the authenticated role upload endpoint', async t => {
  const { requests } = fixture(t);
  const file = new Blob([Buffer.from([137, 80, 78, 71])], { type: 'image/png' });
  for (const role of ['admin', 'player']) {
    const image = await uploadQr(file, { role });
    assert.equal(image.publicId, 'lucky-money/qr/test');
    const { url, options } = requests.at(-1);
    assert.equal(url, `/api/${role}/uploads/qr`);
    assert.equal(options.credentials, 'include');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { image: 'data:image/png;base64,iVBORw==' });
    assert.equal('timeoutMs' in options, false);
  }
});

test('cancelling QR selection prevents a Cloudinary upload', async t => {
  const { readers, requests } = fixture(t);
  const file = new Blob(['image'], { type: 'image/png' });
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(uploadQr(file, { signal: cancelled.signal }), { name: 'AbortError' });
  assert.equal(readers.length, 0);
  const reading = new AbortController();
  const pending = uploadQr(file, { signal: reading.signal });
  await Promise.resolve();
  reading.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(readers[0].aborted, true);
  assert.equal(requests.length, 0);
});

test('missing Cloudinary configuration is shown without pretending an image was saved', async t => {
  const message = 'Chưa cấu hình Cloudinary. Vui lòng điền key trong .env.';
  fixture(t, { response: new Response(JSON.stringify({ message }), { status: 503, headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(uploadQr(new Blob(['image'], { type: 'image/webp' })), { message, status: 503 });
});
