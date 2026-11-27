import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Readable, Writable } from 'node:stream';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const { ObjectId } = require('mongodb');
function load(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), URL, console, Buffer, File, FormData, process, Error });
  return exports;
}
const helpers = load('lib/archive.ts');
const auth = load('lib/auth-session.ts');
process.env.AUTH_SESSION_SECRET = 'archive-test-secret-only';
const tokens = load('lib/archive-preview-token.ts', { '@/lib/auth-session': auth });
const show = { kind: 'show', title: 'Умная собачка Соня', discipline: 'Режиссура эстрады', date: '2026-11-27', url: 'https://youtu.be/test-video' };

function fixture() {
  let role = 'admin';
  const entries = [], files = new Map();
  const matches = (item, filter) => Object.entries(filter).every(([key, value]) => key === 'file.id' ? item.file?.id === value : key === '_id' ? String(item._id) === String(value) : item[key] === value);
  const collection = {
    findOne: async filter => structuredClone(entries.find(item => matches(item, filter)) ?? null),
    find: filter => ({ sort: () => ({ toArray: async () => structuredClone(entries.filter(item => matches(item, filter))) }) }),
    insertOne: async item => entries.push(structuredClone(item)),
    updateOne: async (filter, update) => { const item = entries.find(item => matches(item, filter)); if (item) Object.assign(item, structuredClone(update.$set)); return { matchedCount: item ? 1 : 0 }; },
    findOneAndDelete: async filter => { const index = entries.findIndex(item => matches(item, filter)); return index < 0 ? null : entries.splice(index, 1)[0]; },
  };
  class Bucket {
    openUploadStreamWithId(id, name) { const chunks = []; return new Writable({ write(chunk, encoding, callback) { chunks.push(chunk); callback(); }, final(callback) { files.set(String(id), { name, bytes: Buffer.concat(chunks) }); callback(); } }); }
    async delete(id) { files.delete(String(id)); }
    openDownloadStream(id) { return Readable.from([files.get(String(id)).bytes]); }
  }
  const database = { getDatabase: async () => ({ collection: name => name === 'archive' ? collection : { findOne: async filter => files.has(String(filter._id)) ? { _id: filter._id } : null } }) };
  const dependencies = { 'next/server': { NextResponse }, 'mongodb': { GridFSBucket: Bucket, ObjectId }, '@/lib/database': database, '@/lib/archive': helpers, '@/lib/role-session': { getRoleSessionPerson: async () => role === 'admin' ? { id: 'admin' } : null }, '@/lib/auth-session': auth, '@/lib/archive-preview-token': tokens };
  const admin = load('app/api/admin/archive/route.ts', dependencies);
  const user = load('app/api/archive/route.ts', dependencies);
  const preview = load('app/api/archive/preview/route.ts', dependencies);
  const download = load('app/api/archive/files/[id]/[name]/route.ts', dependencies);
  const cookie = () => role ? 'schedule_auth=' + auth.createAuthSessionToken(role, role === 'admin' ? 'admin' : 'user') : '';
  const req = (path, method = 'GET', body, authenticated = true) => new NextRequest('https://schedule.test' + path, { method, headers: authenticated ? { Cookie: cookie() } : {}, ...(body ? { body } : {}) });
  const mutate = (method, values = {}, file) => { const form = new FormData(); Object.entries(values).forEach(([key, value]) => form.set(key, String(value))); if (file) form.set('file', file); return admin[method](req('/api/admin/archive', method, form)); };
  return { entries, files, mutate, req, admin, user, preview, download, as: value => { role = value; } };
}

test('validates links, YouTube hosts, titles, disciplines and explicit remote file formats', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'data:text/html,hello', '//example.com']) assert.equal(helpers.archiveUrl(url), null);
  for (const url of ['https://youtube.com.evil.test/watch?v=x', 'https://evil.test/?youtube.com', 'https://youtu.be.evil.test/x']) assert.equal(helpers.youtubeUrl(url), null);
  for (const url of ['https://youtu.be/x', 'https://www.youtube.com/watch?v=x', 'https://m.youtube.com/shorts/x']) assert.ok(helpers.youtubeUrl(url));
  for (const patch of [{ title: ' ' }, { title: 'x'.repeat(161) }, { discipline: '' }, { artisticDirector: 'x'.repeat(161) }, { artisticDirector: { $gt: '' } }, { kind: 'unknown' }, { url: 'https://example.com' }]) assert.throws(() => helpers.parseArchiveInput({ ...show, ...patch }, false));
  assert.throws(() => helpers.parseArchiveInput({ kind: 'file', title: 'Remote', url: 'https://example.com/download', extension: 'html' }, false));
  for (const extension of ['docx', 'pptx', 'xlsx']) { assert.equal(helpers.archivePreviewKind(extension), 'office'); assert.equal(helpers.parseArchiveInput({ kind: 'file', title: 'Remote', url: 'https://example.com/download', extension }, false).extension, extension); }
});

test('preview signatures reject expiry, tampering, invalid IDs and use outside the lifetime', () => {
  const id = '1234567890abcdef12345678';
  const signed = tokens.signArchivePreview(id, 1800000000);
  assert.ok(tokens.validArchivePreview(id, signed.expires, signed.token, 1800000001));
  assert.equal(tokens.validArchivePreview('abcdef1234567890abcdef12', signed.expires, signed.token, 1800000001), false);
  assert.equal(tokens.validArchivePreview(id, signed.expires, '0'.repeat(64), 1800000001), false);
  assert.equal(tokens.validArchivePreview(id, signed.expires, signed.token, Number(signed.expires)), false);
  assert.equal(tokens.validArchivePreview(id, signed.expires, signed.token, 1799990000), false);
});

test('show dates are required calendar dates; display keeps the chosen day in every timezone', () => {
  for (const date of [undefined, '', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '2026-1-01', '0000-01-01', '2026-11-27T00:00:00Z', 20261127, { $gt: '' }]) {
    assert.equal(helpers.validArchiveDate(date), false);
    assert.throws(() => helpers.parseArchiveInput({ ...show, date }, false));
  }
  assert.equal(helpers.parseArchiveInput({ ...show, date: '2024-02-29' }, false).date, '2024-02-29');
  const timezone = process.env.TZ;
  try {
    for (const zone of ['America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Minsk']) {
      process.env.TZ = zone;
      assert.match(helpers.formatArchiveDate('2026-11-27'), /^27 ноября 2026/);
    }
  } finally { if (timezone === undefined) delete process.env.TZ; else process.env.TZ = timezone; }
  assert.equal(helpers.formatArchiveDate(undefined), '');
  assert.equal(helpers.parseArchiveInput({ kind: 'link', title: 'Link', url: 'https://example.com', date: 'invalid' }, false).date, '');
});

test('archive reads use show date rather than upload date and move legacy undated shows to the end', async () => {
  const f = fixture();
  for (const date of ['2024-01-01', '2026-11-27', '2025-12-31']) assert.equal((await f.mutate('POST', { ...show, date })).status, 201);
  f.entries[0].createdAt = '2099-01-01T00:00:00.000Z'; // An older show uploaded most recently.
  f.entries.push({ ...f.entries[0], id: 'legacy', title: 'Без даты', date: undefined });
  const read = async () => (await (await f.user.GET(f.req('/api/archive'))).json()).items;
  assert.deepEqual((await read()).map(item => item.date ?? ''), ['2026-11-27', '2025-12-31', '2024-01-01', '']);
  const older = f.entries[0];
  const edited = await f.mutate('PATCH', { ...show, id: older.id, revision: 0, date: '2027-01-02' });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).item.date, '2027-01-02');
  assert.equal((await read())[0].id, older.id);
  assert.equal((await f.mutate('POST', { ...show, date: '2026-02-30' })).status, 400);
});

test('same-day shows have deterministic order and non-show materials retain newest-upload-first sorting', () => {
  const base = { ...show, revision: 0, file: null, extension: '', updatedAt: '' };
  const items = [
    { ...base, id: 'b', createdAt: '2026-11-01' },
    { ...base, id: 'c', createdAt: '2026-11-03' },
    { ...base, id: 'a', createdAt: '2026-11-01' },
  ];
  assert.deepEqual(items.sort(helpers.compareArchiveItems).map(item => item.id), ['c', 'a', 'b']);
  const files = items.map((item, index) => ({ ...item, kind: 'file', date: `200${index}-01-01` }));
  assert.deepEqual(files.sort(helpers.compareArchiveItems).map(item => item.id), ['c', 'a', 'b']);
});

test('admin CRUD, all-user reading, authentication and stale-write protection', async () => {
  const f = fixture();
  const response = await f.mutate('POST', { ...show, artisticDirector: '  Урбан А. М.  ' }); assert.equal(response.status, 201);
  const { item } = await response.json();
  assert.equal(item.artisticDirector, 'Урбан А. М.');
  f.as('user');
  assert.equal((await f.mutate('POST', show)).status, 403);
  assert.equal((await f.mutate('PATCH', { ...show, id: item.id, revision: 0 })).status, 403);
  assert.equal((await f.admin.DELETE(f.req(`/api/admin/archive?id=${item.id}&revision=0`, 'DELETE'))).status, 403);
  const read = await f.user.GET(f.req('/api/archive')); assert.equal(read.headers.get('cache-control'), 'private, no-store'); assert.equal((await read.json()).items.length, 1);
  f.as(null); assert.equal((await f.user.GET(f.req('/api/archive'))).status, 401);
  f.as('admin');
  const results = await Promise.all([f.mutate('PATCH', { ...show, id: item.id, revision: 0, title: 'First' }), f.mutate('PATCH', { ...show, id: item.id, revision: 0, title: 'Second' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(f.entries[0].artisticDirector, 'Урбан А. М.');
  const edited = await f.mutate('PATCH', { ...show, id: item.id, revision: 1, artisticDirector: 'Новый руководитель' });
  assert.equal(edited.status, 200); assert.equal((await edited.json()).item.artisticDirector, 'Новый руководитель');
  assert.equal((await f.admin.DELETE(f.req(`/api/admin/archive?id=${item.id}&revision=0`, 'DELETE'))).status, 409);
  assert.equal((await f.mutate('PATCH', { ...show, id: item.id })).status, 400);
  assert.equal((await f.admin.DELETE(f.req(`/api/admin/archive?id=${item.id}&revision=2`, 'DELETE'))).status, 200);
  assert.equal(f.entries.length, 0);
});

test('uploads, serves and replaces Office files; signed access works without session and revokes after deletion', async () => {
  const f = fixture();
  let previous;
  for (const extension of ['docx', 'pptx', 'xlsx']) {
    const file = new File([`test-${extension}`], `Тест.${extension}`);
    const response = await f.mutate(previous ? 'PATCH' : 'POST', { kind: 'file', title: 'Useful', source: 'upload', ...(previous ? { id: previous.id, revision: previous.revision } : {}) }, file);
    assert.equal(response.status, previous ? 200 : 201);
    const { item } = await response.json(); assert.equal(item.extension, extension); assert.equal(f.files.size, 1);
    if (previous) assert.ok(!f.files.has(previous.file.id));
    const generated = await f.preview.GET(f.req(`/api/archive/preview?id=${item.id}`));
    const { url } = await generated.json(); const ctx = { params: Promise.resolve({ id: item.file.id, name: file.name }) };
    const read = await f.download.GET(new NextRequest(url), ctx); assert.equal(read.status, 200); assert.equal(await read.text(), `test-${extension}`);
    const head = await f.download.HEAD(new NextRequest(url, { method: 'HEAD' }), ctx); assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.match(head.headers.get('content-type'), /officedocument/);
    assert.equal((await f.download.GET(f.req(new URL(url).pathname, 'GET', undefined, false), ctx)).status, 401);
    previous = item;
  }
  const { url } = await (await f.preview.GET(f.req(`/api/archive/preview?id=${previous.id}`))).json();
  assert.equal((await f.admin.DELETE(f.req(`/api/admin/archive?id=${previous.id}&revision=${previous.revision}`, 'DELETE'))).status, 200);
  assert.equal(f.files.size, 0);
  assert.equal((await f.download.GET(new NextRequest(url), { params: Promise.resolve({ id: previous.file.id, name: 'old.xlsx' }) })).status, 404);
});

test('rejects oversized and unsafe uploads; cleans uploads on a losing concurrent edit', async () => {
  const f = fixture(); const input = { kind: 'file', title: 'Useful', source: 'upload' };
  assert.equal((await f.mutate('POST', input, new File(['<html>'], 'x.html'))).status, 400);
  assert.equal((await f.mutate('POST', input, new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.docx'))).status, 413);
  assert.equal(f.files.size, 0); assert.equal(f.entries.length, 0);
  const { item } = await (await f.mutate('POST', input, new File(['initial'], 'a.docx'))).json();
  const edits = await Promise.all(['a', 'b'].map(text => f.mutate('PATCH', { ...input, id: item.id, revision: 0 }, new File([text], `${text}.xlsx`))));
  assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]); assert.equal(f.files.size, 1); assert.ok(f.files.has(f.entries[0].file.id));
});

test('switching an uploaded file to a remote link removes the old binary', async () => {
  const f = fixture(); const { item } = await (await f.mutate('POST', { kind: 'file', title: 'Useful', source: 'upload' }, new File(['a'], 'a.docx'))).json();
  const response = await f.mutate('PATCH', { id: item.id, revision: 0, kind: 'file', title: 'Remote', source: 'url', url: 'https://example.com/file.xlsx', extension: 'xlsx' });
  assert.equal(response.status, 200); assert.equal(f.files.size, 0); assert.equal(f.entries[0].file, null);
});

test('proxy only admits valid signed GET/HEAD file URLs, never archive APIs or writes', () => {
  const proxy = load('proxy.ts', { 'next/server': { NextResponse }, '@/version.json': { pr: 99 }, '@/lib/auth-session': auth, '@/lib/archive-preview-token': tokens });
  const id = '1234567890abcdef12345678'; const signed = tokens.signArchivePreview(id); const query = `?expires=${signed.expires}&token=${signed.token}`;
  for (const method of ['GET', 'HEAD']) assert.equal(proxy.proxy(new NextRequest(`https://schedule.test/api/archive/files/${id}/file.docx${query}`, { method })).status, 200);
  for (const path of ['/api/archive', '/api/archive/preview', '/api/admin/archive', `/api/archive/files/abcdef1234567890abcdef12/file.docx`]) assert.equal(proxy.proxy(new NextRequest('https://schedule.test' + path + query)).status, 401);
  assert.equal(proxy.proxy(new NextRequest(`https://schedule.test/api/archive/files/${id}/file.docx${query}`, { method: 'POST' })).status, 401);
});
