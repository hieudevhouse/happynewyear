import { api } from './api.js';
import { prepareQrImage } from './prepareQrImage.js';

export const MAX_QR_IMAGE_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function readImage(file, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Đã hủy tải ảnh.', 'AbortError'));
      return;
    }
    const reader = new FileReader();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => reader.abort();
    reader.onload = () => { cleanup(); resolve(reader.result); };
    reader.onerror = () => { cleanup(); reject(new Error('Không đọc được ảnh. Vui lòng chọn lại.')); };
    reader.onabort = () => { cleanup(); reject(new DOMException('Đã hủy tải ảnh.', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    try { reader.readAsDataURL(file); }
    catch {
      cleanup();
      reject(new Error('Không đọc được ảnh. Vui lòng chọn lại.'));
    }
  });
}

export async function uploadQr(file, { role = 'player', signal, onProgress } = {}) {
  if (!file || !IMAGE_TYPES.has(file.type)) throw new Error('Chọn ảnh QR định dạng JPG, PNG hoặc WebP.');
  if (!file.size || file.size > MAX_QR_IMAGE_BYTES) throw new Error('Ảnh QR trống hoặc lớn hơn 50 MB. Vui lòng chọn ảnh khác.');
  if (!['admin', 'player'].includes(role)) throw new Error('Không xác định được phiên tải ảnh.');
  const prepared = await prepareQrImage(file, { signal, onProgress });
  if (signal?.aborted) throw new DOMException('Đã hủy tải ảnh.', 'AbortError');
  onProgress?.('uploading');
  const image = await readImage(prepared, signal);
  if (signal?.aborted) throw new DOMException('Đã hủy tải ảnh.', 'AbortError');
  const result = await api(`/${role}/uploads/qr`, {
    method: 'POST', body: { image }, signal, timeoutMs: 180000,
  });
  if (typeof result.image?.url !== 'string' || !result.image.url.startsWith('https://') || !result.image.publicId) {
    throw new Error('Máy chủ chưa trả về ảnh QR hợp lệ. Vui lòng thử lại.');
  }
  return result.image;
}
