import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

// Run the actual request effect with controlled response ordering. No database
// or timing assumptions: an aborted transport can still resolve its JSON body.
const source = readFileSync(new URL('../components/ScheduleApp.tsx', import.meta.url), 'utf8');
const request = source.indexOf('fetch(`/api/schedule?date=');
const start = source.lastIndexOf('  useEffect(() => {', request);
const end = source.indexOf('}, [selectedDate, creatorId]);', request);
assert(start >= 0 && end > start, 'Schedule request effect must exist');
const effect = ts.transpile(source.slice(start, end + '}, [selectedDate, creatorId]);'.length), { target: ts.ScriptTarget.ES2022 });

function harness() {
  const pending = [];
  const state = { schedule: null, rehearsals: [], loading: true };
  const context = {
    AbortController,
    selectedDate: '', creatorId: '',
    didInitializeSelection: { current: true },
    setSchedule: value => { state.schedule = value; },
    setRehearsals: value => { state.rehearsals = value; },
    setLoading: value => { state.loading = value; },
    setPreferences() {}, readPreferences: () => ({}), getSubgroupSubjects: () => [],
    fetch: (_url, options) => new Promise((resolve, reject) => pending.push({ resolve, reject, signal: options.signal })),
    useEffect: callback => { context.cleanup = callback(); },
  };
  vm.createContext(context);
  const run = date => {
    context.selectedDate = date;
    vm.runInContext(effect, context);
    return context.cleanup ?? (() => {});
  };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const reply = async (index, title) => {
    pending[index].resolve({ ok: true, json: async () => ({ schedule: title, rehearsals: [title] }) });
    await flush();
  };
  return { state, pending, run, reply, flush };
}

test('late success from a previous day cannot remove the current rehearsal', async () => {
  const h = harness();
  const cleanup = h.run('2026-10-16');
  cleanup();
  h.run('2026-10-17');
  await h.reply(1, 'Пара и репетиция');
  await h.reply(0, 'Старый день');
  assert.equal(h.state.schedule, 'Пара и репетиция');
  assert.deepEqual(h.state.rehearsals, ['Пара и репетиция']);
  assert.equal(h.pending[0].signal.aborted, true);
});

test('late failure cannot clear rehearsals or finish the current request', async () => {
  const h = harness();
  const cleanup = h.run('2026-10-16');
  cleanup();
  h.run('2026-10-17');
  h.pending[0].reject(new Error('Aborted'));
  await h.flush();
  assert.equal(h.state.loading, true);
  await h.reply(1, 'Репетиция');
  assert.deepEqual(h.state.rehearsals, ['Репетиция']);
  assert.equal(h.state.loading, false);
});

test('profile change and unmount ignore already received response bodies', async () => {
  const h = harness();
  const cleanup = h.run('2026-10-17');
  let resolveBody;
  h.pending[0].resolve({ ok: true, json: () => new Promise(resolve => { resolveBody = resolve; }) });
  await h.flush();
  cleanup();
  resolveBody({ schedule: 'Stale profile', rehearsals: [] });
  await h.flush();
  assert.equal(h.state.schedule, null);
  assert.equal(h.state.loading, true);
});
