import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../lib/use-entrance-complete.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const animation = (finished, endTime = 400) => ({ playState: 'running', effect: { getComputedTiming: () => ({ endTime }) }, finished });

function harness(getAnimations, reducedMotion = false) {
  let value = null, cleanup, id = 0, now = 0;
  const frames = new Map(), timers = new Map(), writes = [];
  const react = { useState: () => [value, next => { value = next; writes.push(next); }], useEffect: effect => { cleanup = effect(); } };
  const context = { exports: {}, Promise, Element: class {},
    require: name => name === 'react' ? react : { useReducedMotion: () => reducedMotion },
    requestAnimationFrame: callback => { const key = ++id; frames.set(key, callback); return key; },
    cancelAnimationFrame: key => frames.delete(key),
    setTimeout: (callback, delay) => { const key = ++id; timers.set(key, { callback, due: now + delay }); return key; },
    clearTimeout: key => timers.delete(key),
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return {
    start(key = '2026-11-02', enabled = true) { cleanup?.(); return context.exports.useEntranceComplete({ current: { getAnimations, parentElement: null } }, key, enabled); },
    frames() { for (let i = 0; i < 2; i++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); } },
    elapse(ms) { now += ms; for (const [key, timer] of timers) if (timer.due <= now) { timers.delete(key); timer.callback(); } },
    stop() { cleanup?.(); },
    get value() { return value; }, writes,
    flush: () => new Promise(resolve => setImmediate(resolve)),
  };
}

test('tasks wait for finite entrance animations and ignore looping indicators', async () => {
  const entry = deferred();
  const h = harness(() => [animation(entry.promise), animation(new Promise(() => {}), Infinity)]);
  h.start(); h.frames(); await h.flush();
  assert.equal(h.value, null);
  entry.resolve(); await h.flush();
  assert.equal(h.value, '2026-11-02');
  h.elapse(2000); assert.equal(h.writes.length, 1);
});

test('an animation whose finished promise never settles cannot permanently hide tasks', async () => {
  const h = harness(() => [animation(new Promise(() => {}))]);
  h.start(); h.frames(); h.elapse(2000); await h.flush();
  assert.equal(h.value, '2026-11-02');
});

test('unsupported animation inspection falls back to revealing tasks', async () => {
  const h = harness(() => { throw new TypeError('Unsupported getAnimations options'); });
  h.start(); assert.doesNotThrow(() => h.frames()); h.elapse(2000); await h.flush();
  assert.equal(h.value, '2026-11-02');
});

test('changing days or unmounting cancels pending reveals', async () => {
  const entry = deferred();
  const h = harness(() => [animation(entry.promise)]);
  h.start('old'); h.frames(); h.start('current'); h.frames();
  entry.resolve(); await h.flush(); h.elapse(2000);
  assert.deepEqual(h.writes, ['current']);
  h.start('unmounted'); h.frames(); h.stop(); h.elapse(2000); await h.flush();
  assert.deepEqual(h.writes, ['current']);
});

test('reduced motion reveals the block immediately without waiting', () => {
  const h = harness(() => { throw new Error('Must not inspect animations'); }, true);
  assert.equal(h.start(), true); h.frames(); h.elapse(2000);
  assert.deepEqual(h.writes, []);
});

test('fallback still reveals content if the browser does not run animation frames', () => {
  const h = harness(() => [animation(new Promise(() => {}))]);
  h.start(); h.elapse(2000);
  assert.equal(h.value, '2026-11-02');
  h.frames(); assert.equal(h.writes.length, 1);
});

test('a late finished promise cannot replay a reveal after the fallback', async () => {
  const entry = deferred();
  const h = harness(() => [animation(entry.promise)]);
  h.start(); h.frames(); h.elapse(2000);
  entry.resolve(); await h.flush();
  assert.deepEqual(h.writes, ['2026-11-02']);
});
