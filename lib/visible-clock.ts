"use client";

import { useSyncExternalStore } from "react";

export function createVisibleClock(interval: number) {
  let now: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const tick = () => {
    clearTimeout(timer);
    timer = undefined;
    if (document.hidden || !listeners.size) return;
    now = Date.now();
    for (const listener of listeners) listener();
    timer = setTimeout(tick, interval - Date.now() % interval);
  };
  return {
    getSnapshot: () => now,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        document.addEventListener("visibilitychange", tick);
        tick();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimeout(timer);
          timer = undefined;
          document.removeEventListener("visibilitychange", tick);
          now = null;
        }
      };
    },
  };
}

const clocks = { 1000: createVisibleClock(1000), 30000: createVisibleClock(30000), 60000: createVisibleClock(60000) };
const serverSnapshot = () => null;
export function useVisibleClock(interval: keyof typeof clocks = 60000) {
  const clock = clocks[interval];
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, serverSnapshot);
}
