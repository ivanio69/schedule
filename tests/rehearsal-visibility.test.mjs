import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), URL, console });
  return exports;
}
const helpers = load('lib/rehearsals.ts');
const people = [{ id: 'author', name: 'Автор' }, { id: 'invited', name: 'Участник' }, { id: 'spectator', name: 'Зритель' }];
const simple = {
  id: 'simple', creatorId: 'author', subject: 'Прогон', date: '2026-10-19',
  timeStart: '18:00', timeEnd: '20:00', responsible: 'Автор', participants: ['Участник'],
};
const block = { id: 'b1', title: 'Финал', timeStart: '19:00', timeEnd: '20:00', participants: ['Участник'] };
const scheduled = { ...simple, id: 'scheduled', participantMode: 'blocks', participants: ['Зритель'], blocks: [block] };
const rehearsals = [simple, scheduled, { ...simple, id: 'global', isGlobal: true }];
const db = {
  getDatabase: async () => ({ collection: () => ({
    findOne: async ({ id }) => rehearsals.find(item => item.id === id) ?? null,
    find: () => ({ sort: () => ({ toArray: async () => rehearsals }) }),
  }) }),
  getPeople: async () => people,
  getRehearsals: async date => rehearsals.filter(item => item.date === date),
  getSchedule: async () => ({ days: [] }),
  getProfileSettings: async () => ({}),
  getIndividualLessons: async () => [],
};
const dependencies = {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  '@/lib/database': db,
  '@/lib/rehearsals': helpers,
  '@/lib/push': { sendPush: async () => { throw new Error('Read must not send notifications'); } },
  '@/lib/schedule': { filterScheduleByChinaMode: value => value },
};
const route = load('app/api/rehearsals/route.ts', dependencies);
const scheduleRoute = load('app/api/schedule/route.ts', dependencies);

test('participation recognizes author, invited people, block invitations and global rehearsals', () => {
  const participates = helpers.isRehearsalParticipant;
  assert.equal(participates(simple, 'author', ''), true);
  assert.equal(participates(simple, 'invited', 'Участник'), true);
  assert.equal(participates(simple, 'spectator', 'Зритель'), false);
  assert.equal(participates(scheduled, 'invited', 'Участник'), true);
  assert.equal(participates(scheduled, 'spectator', 'Зритель'), false, 'Block mode uses block participants');
  assert.equal(participates(rehearsals[2], 'spectator', 'Зритель'), true);
  assert.equal(participates(simple), false);
});

test('list and date endpoints return all rehearsals to nonparticipants and without a profile parameter', async () => {
  for (const query of ['', '?personId=spectator', '?date=2026-10-19&personId=spectator']) {
    const response = await route.GET(new Request('https://schedule.test/api/rehearsals' + query));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).rehearsals.map(item => item.id), ['simple', 'scheduled', 'global']);
  }
});

test('a nonparticipant can open a rehearsal by deep link; missing IDs still return 404', async () => {
  for (const id of ['simple', 'scheduled']) {
    const response = await route.GET(new Request(`https://schedule.test/api/rehearsals?id=${id}&personId=spectator`));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).rehearsal.id, id);
  }
  assert.equal((await route.GET(new Request('https://schedule.test/api/rehearsals?id=missing'))).status, 404);
});

test('schedule endpoint also includes rehearsals for other participants', async () => {
  const response = await scheduleRoute.GET(new Request('https://schedule.test/api/schedule?date=2026-10-19&personId=spectator'));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).rehearsals.map(item => item.id), ['simple', 'scheduled', 'global']);
});

test('nonparticipant cards show an explicit label and retain keyboard access to details', () => {
  const { RehearsalCard } = load('components/RehearsalCard.tsx', { '@/lib/rehearsals': helpers });
  const card = person => renderToStaticMarkup(createElement(RehearsalCard, {
    rehearsal: simple, own: person.id === 'author', personId: person.id, personName: person.name, onClick() {},
  }));
  const spectator = card(people[2]);
  assert.match(spectator, /is-non-participant/);
  assert.match(spectator, /Вы не участвуете/);
  assert.match(spectator, /role="button" tabindex="0"/);
  assert.doesNotMatch(card(people[0]), /Вы не участвуете/);
  assert.doesNotMatch(card(people[1]), /Вы не участвуете/);
});

test('nonparticipant modal shows static time without mounting the live timer', () => {
  const empty = { __esModule: true, default: () => null };
  const { default: EventDetailsContent } = load('components/EventDetailsContent.tsx', {
    '@/lib/rehearsals': helpers,
    '@/components/EventTiming': { __esModule: true, default: () => createElement('div', { 'data-live-timer': true }) },
    '@/components/LessonAttendanceQuickActions': empty,
    '@/components/PersonalEventNote': empty,
    '@/components/RehearsalTimeline': empty,
  });
  const modal = person => renderToStaticMarkup(createElement(EventDetailsContent, {
    details: { type: 'rehearsal', item: simple }, lessonDate: simple.date,
    creatorId: person.id, personName: person.name,
  }));
  const spectator = modal(people[2]);
  assert.doesNotMatch(spectator, /data-live-timer/);
  assert.match(spectator, /18:00–20:00/);
  assert.match(modal(people[1]), /data-live-timer/);
});
