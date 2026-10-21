const monotonicNow = () => globalThis.performance?.now?.() ?? Date.now();

// HTTP Date is supplied by the API server, so changing a phone's clock must not
// restart a QR's countdown. A monotonic anchor also keeps it steady between calls.
export function createServerClock({ wallNow = Date.now, steadyNow = monotonicNow } = {}) {
  let anchorTime = wallNow();
  let anchorTick = steadyNow();
  let latestRequest = -Infinity;

  return {
    now: () => anchorTime + Math.max(0, steadyNow() - anchorTick),
    sync(dateHeader, { requestStartedAt, responseReceivedAt = steadyNow() } = {}) {
      const serverTime = Date.parse(dateHeader);
      if (!Number.isFinite(serverTime)) return false;
      const started = requestStartedAt ?? responseReceivedAt;
      // A slow response from an older request must not replace a newer sample.
      if (started < latestRequest) return false;
      latestRequest = started;
      anchorTick = responseReceivedAt;
      anchorTime = serverTime + Math.max(0, responseReceivedAt - started) / 2;
      return true;
    }
  };
}

const clock = createServerClock();
export const getServerNow = () => clock.now();
export const getMonotonicNow = monotonicNow;
export const syncServerClock = (dateHeader, timing) => clock.sync(dateHeader, timing);
