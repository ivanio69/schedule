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
  const notifications = [];
  const people = ['alice','bob','admin','carol'].map(id=>({id,name:id,active:true}));
  const matches = (event, filter) => Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(event, part));
    if (value && typeof value === 'object') {
      if ('$exists' in value) return (event[key] !== undefined) === value.$exists;
      if ('$in' in value) return value.$in.includes(event[key]);
      if ('$elemMatch' in value) return (event[key] ?? []).some(item => matches(item, value.$elemMatch));
    }
    return event[key] === value;
  });
  const collection = {
    find: filter => ({ sort: () => ({ toArray: async () => structuredClone(events.filter(event => matches(event, filter))) }) }),
    findOne: async filter => structuredClone(events.find(event=>matches(event,filter)) ?? null),
    insertOne: async event => { events.push(structuredClone(event)); },
    updateOne: async (filter, update) => { const event = events.find(event => matches(event, filter)); if(event) { Object.assign(event, structuredClone(update.$set)); for(const [key,value] of Object.entries(update.$inc??{})) event[key]=(event[key]??0)+value; } return { matchedCount: event ? 1 : 0 }; },
    deleteOne: async filter => { const index = events.findIndex(event => matches(event, filter)); if(index >= 0) events.splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; },
  };
  const route = load('app/api/personal-events/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: user }) }) },
    '@/lib/auth-session': { AUTH_COOKIE: 'auth', verifyAuthSessionToken: token => token ? { personId: token } : null },
    '@/lib/database': { getDatabase: async () => ({ collection: () => collection }), getPeople: async () => people },
    '@/lib/push': { sendPush: async (ids, category, payload) => { notifications.push(structuredClone({ids,category,payload})); } },
    '@/lib/personal-events': helpers,
  });
  const request = (method, body, query = '') => route[method](new Request('https://schedule.test/api/personal-events' + query, {
    method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  }));
  return { events, request, notifications, as: id => { user = id; } };
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
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await f.request(method, method === 'POST' || method === 'PUT' ? input : null)).status, 401);
});

test('pending invitations stay on dashboard until a choice; accepted events join schedule and decline hides them', async () => {
  const f = fixture();
  const { event } = await (await f.request('POST', { ...input, date:'2020-01-01', inviteeIds:['bob','carol'] })).json();
  assert.deepEqual(f.notifications[0].ids, ['bob','carol']);
  f.as('bob');
  for (let i=0;i<2;i++) {
    const data = await (await f.request('GET')).json();
    assert.equal(data.events.length, 0);
    assert.equal(data.invitations[0].id, event.id);
    assert.equal(data.invitations[0].canEdit, false);
    assert.equal(data.invitations[0].invitations.length, 1, 'Other invitees are private');
  }
  assert.equal((await f.request('PATCH', { id:event.id, status:'accepted', personId:'carol' })).status,200);
  let data=await (await f.request('GET')).json();
  assert.equal(data.events[0].id,event.id);assert.equal(data.invitations.length,0);
  assert.equal(f.notifications.at(-1).payload.title,'Приглашение принято');
  assert.deepEqual(f.notifications.at(-1).ids,['alice']);
  assert.equal((await f.request('PUT',{...input,id:event.id,inviteeIds:[]})).status,404);
  assert.equal((await f.request('DELETE',null,'?id='+event.id)).status,404);
  const sent=f.notifications.length;
  assert.equal((await f.request('PATCH',{id:event.id,status:'accepted'})).status,404);
  assert.equal(f.notifications.length,sent,'No duplicate response push');
  f.as('carol');
  assert.equal((await f.request('PATCH',{id:event.id,status:'declined'})).status,200);
  data=await (await f.request('GET')).json();assert.equal(data.events.length,0);assert.equal(data.invitations.length,0);
  f.as('alice');
  data=await (await f.request('GET')).json();
  assert.deepEqual(data.events[0].invitations.map(i=>i.status),['accepted','declined']);
});

test('outsiders cannot respond, input cannot forge acceptance and invitees are validated', async () => {
  const f=fixture();
  for (const inviteeIds of [['alice'],['unknown'],[{personId:'bob'}],'bob']) assert.equal((await f.request('POST',{...input,inviteeIds})).status,400);
  const {event}=await (await f.request('POST',{...input,inviteeIds:['bob','bob'],invitations:[{personId:'bob',status:'accepted'}]})).json();
  assert.equal(event.invitations.length,1);assert.equal(event.invitations[0].status,'pending');
  f.as('admin');
  assert.equal((await f.request('PATCH',{id:event.id,status:'accepted',personId:'bob'})).status,404);
  f.as('bob');
  assert.equal((await f.request('PATCH',{id:event.id,status:'maybe'})).status,400);
});

test('edits preserve decisions; updates, removal, re-invitation and cancellation notify the affected people', async () => {
  const f=fixture();
  const {event}=await (await f.request('POST',{...input,inviteeIds:['bob','carol']})).json();
  f.as('bob');await f.request('PATCH',{id:event.id,status:'accepted'});
  f.as('carol');await f.request('PATCH',{id:event.id,status:'declined'});
  f.as('alice');
  await f.request('PUT',{...input,id:event.id,title:'Изменение',inviteeIds:['bob','carol']});
  assert.deepEqual(f.events[0].invitations.map(i=>i.status),['accepted','declined']);
  assert.deepEqual(f.notifications.at(-1).ids,['bob']);assert.equal(f.notifications.at(-1).payload.title,'Событие изменено');
  await f.request('PUT',{...input,id:event.id,inviteeIds:[]});
  assert.equal(f.notifications.at(-1).payload.title,'Приглашение отменено');
  assert.deepEqual(f.notifications.at(-1).ids,['bob']);
  f.as('bob');assert.equal((await (await f.request('GET')).json()).events.length,0);
  f.as('alice');await f.request('PUT',{...input,id:event.id,inviteeIds:['bob']});
  assert.equal(f.events[0].invitations[0].status,'pending');assert.equal(f.notifications.at(-1).payload.title,'Приглашение на событие');
  await f.request('DELETE',null,'?id='+event.id);
  assert.equal(f.notifications.at(-1).payload.title,'Событие отменено');
  f.as('bob');assert.equal((await (await f.request('GET')).json()).invitations.length,0);
});

test('concurrent answers cannot overwrite one another or send duplicate pushes', async () => {
  const f=fixture();
  const {event}=await (await f.request('POST',{...input,inviteeIds:['bob']})).json();
  f.as('bob');
  const results=await Promise.all([f.request('PATCH',{id:event.id,status:'accepted'}),f.request('PATCH',{id:event.id,status:'declined'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(f.notifications.length,2);
});

test('events created before invitations and revisions existed still edit safely', async () => {
  const f=fixture();f.events.push({...input,id:'legacy',creatorId:'alice'});
  assert.equal((await f.request('PUT',{...input,id:'legacy',inviteeIds:['bob']})).status,200);
  assert.equal(f.events[0].revision,1);assert.equal(f.events[0].invitations[0].status,'pending');
});
