"use client";

const pending = new Map<string, Promise<Response>>();
let listening = false;
export function fetchSharedRead(url: string): Promise<Response> {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("schedule-auth-change", () => pending.clear());
  }
  let request = pending.get(url);
  if (!request) {
    const next = fetch(url, { cache: "no-store" }).finally(() => {
      if (pending.get(url) === next) pending.delete(url);
    });
    pending.set(url, next);
    request = next;
  }
  return request.then(response => response.clone());
}
