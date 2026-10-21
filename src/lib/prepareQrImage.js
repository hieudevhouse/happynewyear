// Keep uploads below Cloudinary's 10 MB image limit, while accepting originals up to 50 MB.
export const MAX_QR_UPLOAD_BYTES = 9 * 1024 * 1024;
const DIMENSION_STEPS = [4096, 3072, 2048, 1536, 1024];

function abortError() {
  return new DOMException('Đã hủy tải ảnh.', 'AbortError');
}

function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}

function cancellable(promise, signal, disposeLate) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      reject(abortError());
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    Promise.resolve(promise).then(value => {
      signal?.removeEventListener('abort', abort);
      if (settled) { disposeLate?.(value); return; }
      settled = true;
      resolve(value);
    }, failure => {
      signal?.removeEventListener('abort', abort);
      if (settled) return;
      settled = true;
      reject(failure);
    });
  });
}

async function decodeImage(file, signal) {
  checkAbort(signal);
  if (typeof globalThis.createImageBitmap === 'function') {
    try {
      const bitmap = await cancellable(globalThis.createImageBitmap(file), signal, late => late.close?.());
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
    } catch (failure) {
      if (failure.name === 'AbortError') throw failure;
      // Image also supports browsers/formats without createImageBitmap decoding.
    }
  }
  checkAbort(signal);
  if (typeof globalThis.Image !== 'function' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Không đọc được ảnh QR để tối ưu. Vui lòng chọn ảnh JPG, PNG hoặc WebP hợp lệ.');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  const cleanup = () => {
    image.onload = image.onerror = null;
    image.src = '';
    URL.revokeObjectURL(url);
  };
  try {
    await cancellable(new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Không đọc được ảnh QR. Vui lòng chọn lại ảnh hợp lệ.'));
      image.src = url;
    }), signal);
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: cleanup };
  } catch (failure) {
    cleanup();
    throw failure;
  }
}

export async function prepareQrImage(file, { signal, onProgress } = {}) {
  checkAbort(signal);
  if (file.size <= MAX_QR_UPLOAD_BYTES) return file;
  onProgress?.('preparing');
  const decoded = await decodeImage(file, signal);
  let canvas;
  try {
    checkAbort(signal);
    if (!(decoded.width > 0 && decoded.height > 0) || typeof document === 'undefined') {
      throw new Error('Không đọc được kích thước ảnh QR. Vui lòng chọn lại ảnh.');
    }
    canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context || typeof canvas.toBlob !== 'function') throw new Error('Trình duyệt chưa hỗ trợ tối ưu ảnh QR. Vui lòng chọn ảnh nhỏ hơn 9 MB.');
    let lastDimensions = '';
    for (const maxDimension of DIMENSION_STEPS) {
      checkAbort(signal);
      const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const dimensions = `${width}:${height}`;
      if (dimensions === lastDimensions) continue;
      lastDimensions = dimensions;
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      context.drawImage(decoded.source, 0, 0, width, height);
      const blob = await cancellable(new Promise(resolve => canvas.toBlob(resolve, 'image/png')), signal);
      checkAbort(signal);
      if (blob?.type === 'image/png' && blob.size > 0 && blob.size <= MAX_QR_UPLOAD_BYTES) return blob;
    }
    throw new Error('Chưa tối ưu được ảnh QR để tải lên. Vui lòng xuất lại QR rõ nét từ ứng dụng ngân hàng hoặc chọn ảnh khác.');
  } finally {
    decoded.close();
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
