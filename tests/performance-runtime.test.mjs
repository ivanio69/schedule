import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function moduleContext(path, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const context = { exports: {}, require: () => ({}), ...globals };
  vm.createContext(context);
  vm.runInContext(ts.transpile(source, {module: ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}), context);
  return context;
}

test('simultaneous reads share transport but have independently readable bodies', async () => {
  let calls = 0, reply;
  const context = moduleContext('../lib/shared-read.ts', {
    fetch: () => { calls++; return new Promise(resolve => {reply=resolve;}); },
  });
  const read = context.exports.fetchSharedRead;
  const first = read('/profile'), second = read('/profile');
  assert.equal(calls, 1);
  reply(new Response(JSON.stringify({notes:{one:'test'}})));
  const [a,b] = await Promise.all([first,second]);
  assert.notEqual(a,b);
  assert.deepEqual(await a.json(),await b.json());
  const next = read('/profile');
  assert.equal(calls, 2, 'completed private data must not be retained');
  reply(new Response('{}'));
  await next;
});

test('failed shared requests can be retried', async () => {
  let calls = 0;
  const {exports:{fetchSharedRead:read}}=moduleContext('../lib/shared-read.ts', {
    fetch: () => ++calls===1 ? Promise.reject(new Error('offline')) : Promise.resolve(new Response('{}')),
  });
  await assert.rejects(read('/profile'), /offline/);
  assert.equal((await read('/profile')).ok, true);
  assert.equal(calls,2);
});

test('auth changes isolate in-flight reads; finishing an old request cannot evict a new one', async () => {
  const events = new Map(), replies = [];
  const {exports:{fetchSharedRead:read}}=moduleContext('../lib/shared-read.ts', {
    window:{addEventListener:(name,listener)=>events.set(name,listener)},
    fetch:()=>new Promise(resolve=>replies.push(resolve)),
  });
  const old = read('/profile');
  events.get('schedule-auth-change')();
  const fresh = read('/profile');
  replies[0](new Response('{}'));
  await old;
  const duplicate = read('/profile');
  assert.equal(replies.length,2);
  replies[1](new Response('{"fresh":true}'));
  const [a,b]=await Promise.all([fresh,duplicate]);
  assert.deepEqual(await a.json(),await b.json());
});

function clockHarness() {
  let time = 1250, counter = 0;
  const timers = new Map(), events = new Map();
  const document = {hidden:false,addEventListener:(name,listener)=>events.set(name,listener),removeEventListener:name=>events.delete(name)};
  const {exports:{createVisibleClock}}=moduleContext('../lib/visible-clock.ts', {
    document, Date:{now:()=>time},
    setTimeout:(callback,delay)=>{timers.set(++counter,{callback,delay});return counter;},
    clearTimeout:id=>timers.delete(id),
  });
  return {clock:createVisibleClock(1000),timers,events,document,setTime:value=>{time=value;}};
}

test('clock subscribers use one aligned timer and release it on last unmount', () => {
  const h = clockHarness();
  assert.equal(h.clock.getSnapshot(),null);
  let calls=0;
  const a=h.clock.subscribe(()=>calls++), b=h.clock.subscribe(()=>calls++);
  assert.equal(h.timers.size,1);
  assert.equal([...h.timers.values()][0].delay,750);
  assert.equal(h.clock.getSnapshot(),1250);
  a(); assert.equal(h.timers.size,1);
  b(); assert.equal(h.timers.size,0);
  assert.equal(h.events.size,0);
  assert.equal(h.clock.getSnapshot(),null);
});

test('hidden clocks do no work and immediately catch up when visible', () => {
  const h=clockHarness();let calls=0;
  const stop=h.clock.subscribe(()=>calls++);
  const initial=calls;
  h.document.hidden=true;h.events.get('visibilitychange')();
  h.setTime(100000);
  assert.equal(h.timers.size,0);
  assert.equal(calls,initial);
  h.document.hidden=false;h.events.get('visibilitychange')();
  assert.equal(h.clock.getSnapshot(),100000);
  assert.equal(h.timers.size,1);
  assert.equal(calls,initial+1);
  stop();
  const again=h.clock.subscribe(()=>calls++);
  assert.equal(h.clock.getSnapshot(),100000);
  assert.equal(h.timers.size,1);
  again();
});
