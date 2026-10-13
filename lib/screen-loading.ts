// Track mounted screens directly instead of observing every DOM mutation.
const screens = new Set<symbol>();
const listeners = new Set<(loading: boolean) => void>();
const notify = () => { for (const listener of listeners) listener(screens.size > 0); };
export function registerScreenLoading() {
  const token = Symbol();
  screens.add(token);
  if (screens.size === 1) notify();
  return () => {
    if (screens.delete(token) && screens.size === 0) notify();
  };
}
export function subscribeScreenLoading(listener: (loading: boolean) => void) {
  listeners.add(listener);
  listener(screens.size > 0);
  return () => { listeners.delete(listener); };
}
