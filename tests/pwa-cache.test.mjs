import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://schedule.test';
function response(body, options = {}) {
  const result = new Response(body, options);
  Object.defineProperty(result, 'type', { value: 'basic' });
  return result;
}
function harness() {
  const handlers = {}, storage = new Map(), calls = [];
  const key = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
  let transport = async () => response('network');
  let brokenStorage = false, preloadEnabled = false;
  const caches = {
    async open(name) {
      if (brokenStorage) throw new Error('QuotaExceededError');
      if (!storage.has(name)) storage.set(name, new Map());
      const data = storage.get(name);
      return {
        match: async input => data.get(key(input))?.clone(),
        put: async (input, value) => { data.set(key(input), value.clone()); },
        keys: async () => [...data.keys()].map(url => ({ url })),
        delete: async input => data.delete(key(input)),
      };
    },
    keys: async () => [...storage.keys()],
    delete: async name => storage.delete(name),
  };
  const self = {
    location: { origin },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    registration: { navigationPreload: { enable: async () => { preloadEnabled = true; } } },
  };
  vm.runInNewContext(source, { self, caches, URL, Response, fetch: async (...args) => {
    calls.push(args); return transport(...args);
  } });
  function dispatch(name, extra = {}) {
    const waiting = [];
    let result;
    handlers[name]({ waitUntil: p => waiting.push(p), respondWith: p => { result = p; }, ...extra });
    return { result, done: async () => { if (result) await result.catch(() => {}); await Promise.all(waiting); } };
  }
  const request = (path, extra = {}) => ({ url: new URL(path, origin).href, method: 'GET', mode: 'cors', ...extra });
  return { dispatch, request, storage, calls, caches,
    setTransport: fn => { transport = fn; },
    breakStorage: () => { brokenStorage = true; },
    preloadEnabled: () => preloadEnabled,
  };
}

test('hashed assets are served locally on a warm launch without a second network request', async () => {
  const h = harness();
  const request = h.request('/_next/static/chunks/abc123.js');
  const first = h.dispatch('fetch', { request });
  assert.equal(await (await first.result).text(), 'network');
  await first.done();
  h.setTransport(() => { throw new Error('offline'); });
  const second = h.dispatch('fetch', { request });
  assert.equal(await (await second.result).text(), 'network');
  await second.done();
  assert.equal(h.calls.length, 1);
});

test('mutable icons render from cache while updating in the background', async () => {
  const h = harness();
  const request = h.request('/icons/icon.svg');
  await h.dispatch('fetch', { request }).done();
  let complete;
  h.setTransport(() => new Promise(resolve => { complete = resolve; }));
  const second = h.dispatch('fetch', { request });
  assert.equal(await (await second.result).text(), 'network');
  complete(response('new icon'));
  await second.done();
  const cache = await h.caches.open('schedule-pwa-public-v1');
  assert.equal(await (await cache.match(request)).text(), 'new icon');
});

test('navigation uses preload and never stores authenticated HTML', async () => {
  const h = harness();
  const event = h.dispatch('fetch', {
    request: h.request('/', { mode: 'navigate' }), preloadResponse: Promise.resolve(response('private html')),
  });
  assert.equal(await (await event.result).text(), 'private html');
  await event.done();
  assert.equal(h.calls.length, 0);
  assert.equal(h.storage.size, 0);
});

test('navigation has a network fallback when preload is unsupported', async () => {
  const h = harness();
  const event = h.dispatch('fetch', { request: h.request('/login', { mode: 'navigate' }) });
  assert.equal(await (await event.result).text(), 'network');
  assert.equal(h.calls.length, 1);
});

test('API, RSC, user files, external requests and mutations bypass persistent caches', () => {
  const h = harness();
  for (const request of [
    h.request('/api/profile/settings'), h.request('/api/auth/session'), h.request('/api/auth/session', { method: 'DELETE' }),
    h.request('/api/seminars/files/123', { destination: 'image' }),
    h.request('/?_rsc=123'), h.request('/schedule', { headers: { RSC: '1' } }),
    h.request('https://external.test/file.js', { destination: 'script' }),
    h.request('/private-photo.jpg', { destination: 'image' }),
  ]) assert.equal(h.dispatch('fetch', { request }).result, undefined);
  assert.equal(h.storage.size, 0);
});

test('DEV, private, no-store, redirect and failed responses never enter the cache', async () => {
  for (const options of [
    { headers: { 'x-schedule-environment': 'dev' } },
    { headers: { 'Cache-Control': 'private, max-age=3600' } },
    { headers: { 'Cache-Control': 'no-store' } }, { status: 404 }, { redirected: true },
  ]) {
    const h = harness();
    h.setTransport(async () => {
      const value = response('uncacheable', options);
      if (options.redirected) Object.defineProperty(value, 'redirected', { value: true });
      return value;
    });
    const event = h.dispatch('fetch', { request: h.request('/_next/static/asset.js') });
    assert.equal(await (await event.result).text(), 'uncacheable');
    await event.done();
    assert.equal([...h.storage.values()].reduce((n, cache) => n + cache.size, 0), 0);
  }
});

test('blocked Cache Storage does not break network requests or activation', async () => {
  const h = harness(); h.breakStorage();
  const event = h.dispatch('fetch', { request: h.request('/_next/static/asset.js') });
  assert.equal(await (await event.result).text(), 'network');
  await event.done();
  await h.dispatch('activate').done();
});

test('activation removes legacy HTML caches but preserves unrelated app caches', async () => {
  const h = harness();
  h.storage.set('schedule-offline-v3', new Map());
  h.storage.set('another-app', new Map());
  await h.dispatch('activate').done();
  assert.equal(h.storage.has('schedule-offline-v3'), false);
  assert.equal(h.storage.has('another-app'), true);
  assert.equal(h.preloadEnabled(), true);
});

test('offline navigation shows a public fallback instead of old login or profile HTML', async () => {
  const h = harness();
  await (await h.caches.open('schedule-pwa-public-v1')).put('/offline.html', response('offline screen'));
  h.setTransport(async () => { throw new Error('offline'); });
  const event = h.dispatch('fetch', { request: h.request('/admin', { mode: 'navigate' }) });
  assert.equal(await (await event.result).text(), 'offline screen');
});

test('cache size stays bounded across new builds', async () => {
  const h = harness();
  for (let i = 0; i < 165; i++) {
    await h.dispatch('fetch', { request: h.request(`/_next/static/chunks/${i}.js`) }).done();
  }
  assert.equal(h.storage.get('schedule-pwa-static-v1').size, 160);
});

test('client startup session checks share one request and revalidate on the next call', async () => {
  const code = ts.transpileModule(readFileSync(new URL('../lib/auth-client.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let count = 0, complete;
  const exports = {};
  vm.runInNewContext(code, { exports, fetch: () => {
    count++; return new Promise(resolve => { complete = resolve; });
  } });
  const first = exports.fetchAuthSession(), second = exports.fetchAuthSession();
  assert.equal(count, 1);
  complete(new Response('{"authenticated":true}'));
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(await a.json(), await b.json());
  const third = exports.fetchAuthSession();
  assert.equal(count, 2);
  complete(new Response('{}')); await third;
});
