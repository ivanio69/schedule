// Coalesce effect cleanup/setup within one React commit. A loader replacement
// must not briefly report "ready" and restart every background gradient.
const screens = new Set<symbol>();
const listeners = new Set<(loading: boolean) => void>();
let published = false;
let pending = false;
function notify() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    const loading = screens.size > 0;
    if (loading === published) return;
    published = loading;
    for (const listener of listeners) listener(loading);
  });
}
export function registerScreenLoading() {
  const token = Symbol();
  screens.add(token);
  notify();
  return () => {
    if (screens.delete(token)) notify();
  };
}
export function subscribeScreenLoading(listener: (loading: boolean) => void) {
  listeners.add(listener);
  // A just-mounted subscriber sees the current state even before the batch flush.
  listener(screens.size > 0);
  return () => { listeners.delete(listener); };
}
