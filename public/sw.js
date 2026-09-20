const CACHE_NAME = "schedule-offline-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];
const STATIC_DESTINATIONS = new Set(["style", "script", "image", "font"]);

function canCache(response) {
  return response.ok
    && response.type === "basic"
    && response.headers.get("x-schedule-environment") !== "dev";
}

async function cacheStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (canCache(response)) await cache.put(request, response.clone());
  return response;
}

async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    return (await caches.match(request))
      ?? (await caches.match("/"))
      ?? new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (path) => {
    try {
      const response = await fetch(path, { cache: "reload" });
      if (canCache(response)) {
        await cache.put(path, response.clone());
        return;
      }
    } catch {}

    // If the PWA is temporarily in same-origin DEV, keep the previous STABLE
    // shell instead of replacing it with preview HTML.
    const previous = await caches.match(path);
    if (previous) await cache.put(path, previous);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API data is intentionally never cached: schedule/profile data must not go stale.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (
    STATIC_DESTINATIONS.has(request.destination)
    || url.pathname.startsWith("/_next/static/")
    || url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheStatic(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let data = { title: "Расписание 214Р", body: "Есть новое уведомление", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        if ("navigate" in existing) await existing.navigate(target);
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
