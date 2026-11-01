import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), URL, console });
  return exports;
}
const helpers = load('lib/personal-events.ts');
const input = { title: 'Встреча', date: '2026-11-02', timeStart: '18:00', timeEnd: '19:00', location: 'Аудитория', notes: 'Взять материалы' };

function fixture(personId = 'alice') {
  const events = [];
  let user = personId;
  const matches = (event, filter) => Object.entries(filter).every(([key, value]) => event[key] === value);
  const collection = {
    find: filter => ({ sort: () => ({ toArray: async () => events.filter(event => matches(event, filter)) }) }),
    insertOne: async event => { events.push({ ...event }); },
    updateOne: async (filter, update) => { const event = events.find(event => matches(event, filter)); if(event) Object.assign(event, update.$set); return { matchedCount: event ? 1 : 0 }; },
    deleteOne: async filter => { const index = events.findIndex(event => matches(event, filter)); if(index >= 0) events.splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; },
  };
  const route = load('app/api/personal-events/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: user }) }) },
    '@/lib/auth-session': { AUTH_COOKIE: 'auth', verifyAuthSessionToken: token => token ? { personId: token } : null },
    '@/lib/database': { getDatabase: async () => ({ collection: () => collection }) },
    '@/lib/personal-events': helpers,
  });
  const request = (method, body, query = '') => route[method](new Request('https://schedule.test/api/personal-events' + query, {
    method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  }));
  return { events, request, as: id => { user = id; } };
}

test('rejects impossible dates, invalid time ranges and oversized fields', () => {
  assert.ok(helpers.normalizePersonalEvent(input));
  for (const change of [{ date: '2026-02-30' }, { date: '2026-02-29' }, { timeStart: '25:00' }, { timeEnd: '18:00' }, { timeEnd: '17:59' }, { title: ' ' }, { notes: 'x'.repeat(2001) }, { location: { $gt: '' } }]) {
    assert.equal(helpers.normalizePersonalEvent({ ...input, ...change }), null);
  }
});

test('owner can create, list, edit and delete; responses are private and uncached', async () => {
  const f = fixture();
  const response = await f.request('POST', { ...input, creatorId: 'bob' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { event } = await response.json();
  assert.equal(event.creatorId, 'alice');
  assert.equal((await (await f.request('GET')).json()).events.length, 1);
  assert.equal((await f.request('PUT', { ...input, id: event.id, title: 'Изменено' })).status, 200);
  assert.equal(f.events[0].title, 'Изменено');
  assert.equal((await f.request('DELETE', null, '?id=' + event.id)).status, 200);
  assert.equal(f.events.length, 0);
});

test('another user including an administrator cannot list, edit or delete a private event', async () => {
  const f = fixture();
  const { event } = await (await f.request('POST', input)).json();
  for (const user of ['bob', 'admin']) {
    f.as(user);
    assert.equal((await (await f.request('GET', null, '?personId=alice')).json()).events.length, 0);
    assert.equal((await f.request('PUT', { ...input, id: event.id, creatorId: 'alice' })).status, 404);
    assert.equal((await f.request('DELETE', null, '?id=' + event.id + '&creatorId=alice')).status, 404);
  }
  assert.equal(f.events.length, 1);
});

test('all operations require an authenticated session', async () => {
  const f = fixture(null);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await f.request(method, method === 'POST' || method === 'PUT' ? input : null)).status, 401);
});
