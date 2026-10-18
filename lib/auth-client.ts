// Coalesce startup/focus checks without retaining session data between requests.
// Each consumer receives its own readable response body.
let pending: Promise<Response> | null = null;

export function fetchAuthSession(): Promise<Response> {
  if (!pending) {
    const request = fetch("/api/auth/session", { cache: "no-store" }).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
  }
  return pending.then(response => response.clone());
}
