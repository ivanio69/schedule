/* PWA_BUILD_START */
// Next build: "_0RrTkOde9evG9A2ODQVC"
const BUILD_ASSETS = ["/_next/static/chunks/09548bce-d68d9a88211a1b1e.js","/_next/static/chunks/3199-1852b6323b7596ca.js","/_next/static/chunks/4335-c456ff4184bb92ff.js","/_next/static/chunks/4853-e257c10cd0a8ee7c.js","/_next/static/chunks/5256-f34f491e0fc20810.js","/_next/static/chunks/7395-b1d4e1d2047c0823.js","/_next/static/chunks/8453-a9f5e80eadbbc234.js","/_next/static/chunks/9465-69cb5183e80b93a5.js","/_next/static/chunks/app/layout-611f498ab9700c8a.js","/_next/static/chunks/app/loading-abc827f01364a4c4.js","/_next/static/chunks/app/login/page-832f69054441bd3a.js","/_next/static/chunks/app/page-538c0bcf8b7fa98a.js","/_next/static/chunks/main-app-b0c91a5f52fce85f.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-bb21cadff76a3206.js","/_next/static/css/1c9ead34bab2549a.css","/_next/static/css/358ee7b409fc8c54.css","/_next/static/css/5619a6af78d48b49.css","/_next/static/css/c3d2cf1c3d05342a.css","/_next/static/css/eaeb2674915c3298.css","/_next/static/media/569ce4b8f30dc480-s.woff2"];
/* PWA_BUILD_END */

const STATIC_CACHE = "schedule-pwa-static-v1";
const PUBLIC_CACHE = "schedule-pwa-public-v1";
const MAX_STATIC_ENTRIES = 160;
const MAX_PUBLIC_ENTRIES = 40;
const PUBLIC_ASSETS = [
  "/offline.html", "/manifest.webmanifest", "/icons/icon.svg",
  "/icons/icon-192.png", "/icons/icon-512.png", "/apple-touch-icon.png",
];
let writes = Promise.resolve();

function canCache(response) {
  return response.ok && response.type === "basic" && !response.redirected
    && response.headers.get("x-schedule-environment") !== "dev"
    && !/no-store|private/i.test(response.headers.get("cache-control") || "");
}

async function match(name, request) {
  try { return await (await caches.open(name)).match(request); } catch { return undefined; }
}

// Storage may be full or disabled. It must never break a successful request.
function save(name, request, response, limit) {
  if (!canCache(response)) return Promise.resolve();
  const copy = response.clone();
  writes = writes.then(async () => {
    const cache = await caches.open(name);
    await cache.put(request, copy);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map(key => cache.delete(key)));
  }).catch(() => undefined);
  return writes;
}

function staticResponse(event, immutable) {
  const name = immutable ? STATIC_CACHE : PUBLIC_CACHE;
  const request = event.request;
  // Attach the lifetime promise synchronously, before any cache/network await.
  let finish;
  event.waitUntil(new Promise(resolve => { finish = resolve; }));
  return (async () => {
    const cached = await match(name, request);
    if (cached && immutable) { finish(); return cached; }
    const refresh = fetch(request).then(response => {
      const saving = save(name, request, response, immutable ? MAX_STATIC_ENTRIES : MAX_PUBLIC_ENTRIES);
      saving.finally(finish);
      return response;
    }).catch(error => { finish(); if (!cached) throw error; return cached; });
    if (cached) { void refresh.catch(() => undefined); return cached; }
    return refresh;
  })();
}

async function navigate(event) {
  try {
    // Start the HTML request while the browser is still waking the worker.
    return (await event.preloadResponse) || await fetch(event.request);
  } catch {
    // Never save authenticated HTML, login redirects, RSC or API responses.
    return (await match(PUBLIC_CACHE, "/offline.html"))
      || new Response("Нет подключения. Попробуй открыть приложение ещё раз.", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
  }
}

async function precache() {
  const paths = [...PUBLIC_ASSETS, ...BUILD_ASSETS];
  // Limit background work on a phone; browser HTTP cache supplies files already loaded.
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const immutable = path.startsWith("/_next/static/");
        if (immutable && await match(STATIC_CACHE, path)) continue;
        const response = await fetch(path, { cache: immutable ? "default" : "reload" });
        await save(immutable ? STATIC_CACHE : PUBLIC_CACHE, path, response,
          immutable ? MAX_STATIC_ENTRIES : MAX_PUBLIC_ENTRIES);
      } catch {}
    }
  }));
}

self.addEventListener("install", event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // Remove the old worker's cached HTML, including any cached login page.
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("schedule-offline-")).map(key => caches.delete(key)));
    } catch {}
    try { await self.registration.navigationPreload?.enable(); } catch {}
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") { event.respondWith(navigate(event)); return; }
  // Explicit allowlist: no RSC, user uploads, authenticated images or arbitrary scripts.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticResponse(event, true));
  } else if (PUBLIC_ASSETS.includes(url.pathname) || url.pathname === "/art-banner/painting.jpg") {
    event.respondWith(staticResponse(event, false));
  }
});

self.addEventListener("message", event => {
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
