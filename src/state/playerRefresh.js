export function createPlayerRefreshController({ getPlayer, applyPlayer, fetchPlayer }) {
  let revision = 0;
  let pending = null;
  const isCurrent = (token, code) => token === revision && (code === undefined || getPlayer().code === code);

  const invalidate = () => {
    revision += 1;
    pending?.controller.abort();
    pending = null;
    return revision;
  };

  const apply = (nextPlayer, token, code) => {
    if (!isCurrent(token, code)) return false;
    applyPlayer(nextPlayer);
    return true;
  };

  const commit = (nextPlayer, token, code) => {
    if (!isCurrent(token, code)) return false;
    // A scheduled GET may have begun while the POST was still in progress.
    // Invalidate that GET too before applying the completed mutation.
    return apply(nextPlayer, invalidate(), code);
  };

  function refresh({ signal } = {}) {
    const code = getPlayer().code;
    const token = revision;
    if (pending?.code === code && pending.token === token) return pending.promise;
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const request = { code, token, controller };
    pending = request;
    request.promise = (async () => {
      try {
        const nextPlayer = await fetchPlayer(controller.signal);
        // A payment save, another code, or unmount may have superseded this GET.
        controller.signal.throwIfAborted();
        if (!isCurrent(token, code)) return getPlayer();
        if (!nextPlayer || nextPlayer.code !== code) {
          throw new Error('Phiên nhận lộc đã thay đổi. Vui lòng tải lại trang.');
        }
        apply(nextPlayer, token, code);
        return nextPlayer;
      } finally {
        signal?.removeEventListener('abort', abort);
        if (pending === request) pending = null;
      }
    })();
    return request.promise;
  }

  return { invalidate, isCurrent, apply, commit, refresh };
}
