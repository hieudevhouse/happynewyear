// The lifecycle is separate from React so hidden tabs, cancellation, and slow
// requests can be verified without a browser or real timers.
export function startStatusPolling({
  refresh,
  onError = () => {},
  visibility = globalThis.document,
  focusTarget = globalThis.window,
  intervalMs = 15000,
  schedule = setTimeout,
  cancel = clearTimeout
}) {
  let stopped = false;
  let timer;
  let inFlight = null;
  let refreshAgain = false;
  const visible = () => visibility?.visibilityState !== 'hidden';
  const clearTimer = () => {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
  };
  const queue = () => {
    clearTimer();
    if (!stopped && visible()) timer = schedule(run, intervalMs);
  };

  async function run() {
    clearTimer();
    if (stopped || !visible()) return;
    if (inFlight) {
      refreshAgain = true;
      return;
    }
    const controller = new AbortController();
    inFlight = controller;
    try {
      await refresh({ signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted && error.name !== 'AbortError' && !stopped) onError(error);
    } finally {
      inFlight = null;
      if (stopped) return;
      if (refreshAgain && visible()) {
        refreshAgain = false;
        run();
      } else queue();
    }
  }

  const onVisibility = () => {
    if (visible()) run();
    else {
      clearTimer();
      refreshAgain = false;
      inFlight?.abort();
    }
  };
  const onFocus = () => { if (visible()) run(); };
  visibility?.addEventListener('visibilitychange', onVisibility);
  focusTarget?.addEventListener('focus', onFocus);
  run();

  return () => {
    stopped = true;
    clearTimer();
    inFlight?.abort();
    visibility?.removeEventListener('visibilitychange', onVisibility);
    focusTarget?.removeEventListener('focus', onFocus);
  };
}
