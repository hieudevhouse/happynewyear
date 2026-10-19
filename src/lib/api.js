const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, signal, ...options } = {}) {
  method = method.toUpperCase();
  const payload = body === undefined && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) ? {} : body;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), 20000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      if (response.status === 401 && (path.startsWith('/admin/') || path.startsWith('/auth/me') || path.startsWith('/auth/logout'))) {
        window.dispatchEvent(new Event('lm:unauthorized'));
      }
      throw new ApiError(data?.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.', response.status, data);
    }
    if (!data) throw new ApiError('Máy chủ chưa sẵn sàng. Vui lòng thử lại sau.', response.status);
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error;
    throw new ApiError(controller.signal.aborted
      ? 'Máy chủ phản hồi chậm. Vui lòng thử lại.'
      : 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
