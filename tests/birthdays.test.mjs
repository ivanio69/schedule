import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
function load(path, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name), URL, console, process, Buffer, ...globals });
  return exports;
}
const birthdays = load("lib/birthdays.ts");
const people = load("lib/people.ts");
const tick = () => new Promise(resolve => setImmediate(resolve));

test("validates optional day/month without a year, including 29 February", () => {
  for (const empty of [undefined, null, ""]) assert.equal(birthdays.normalizeBirthday(empty), "");
  for (const valid of ["01-01", "02-29", "04-30", "12-31"]) assert.equal(birthdays.normalizeBirthday(valid), valid);
  for (const bad of ["2026-11-28", "11-31", "04-31", "02-30", "00-10", "13-01", "01-00", "1-1", "11-", "-28", 1128, {}, []]) assert.equal(birthdays.normalizeBirthday(bad), null);
  assert.equal(birthdays.formatBirthday("02-29"), "29 февраля");
});

test("uses the Minsk calendar at midnight and only the actual leap day", () => {
  assert.equal(birthdays.isBirthdayToday("11-28", new Date("2026-11-27T20:59:59Z")), false);
  assert.equal(birthdays.isBirthdayToday("11-28", new Date("2026-11-27T21:00:00Z")), true);
  assert.equal(birthdays.isBirthdayToday("11-28", new Date("2026-11-28T21:00:00Z")), false);
  assert.equal(birthdays.isBirthdayToday("02-29", new Date("2028-02-29T09:00:00Z")), true);
  assert.equal(birthdays.isBirthdayToday("02-29", new Date("2027-02-28T09:00:00Z")), false);
  assert.equal(birthdays.isBirthdayToday(undefined), false);
});

function fixture() {
  const entries = [];
  const collection = {
    findOne: async filter => structuredClone(entries.find(item => item.id === filter.id) ?? null),
    find: filter => ({ sort: () => ({ toArray: async () => structuredClone(entries.filter(item => !filter.active || item.active)) }) }),
    replaceOne: async (filter, item) => { const i = entries.findIndex(entry => entry.id === filter.id); if (i < 0) entries.push(structuredClone(item)); else entries[i] = structuredClone(item); },
  };
  const db = { collection: () => collection };
  const database = load("lib/database.ts", {
    "@/app/table.json": {}, "@/lib/mongodb": { default: Promise.resolve({ db: () => db }) },
    "@/lib/people": people, "@/lib/rehearsals": {}, "@/lib/schedule": {},
  });
  const env = { ...process.env, ADMIN_SESSION_SECRET: "birthday-test-only", AUTH_SESSION_SECRET: "birthday-auth-test-only" };
  const globals = { process: { env }, Buffer };
  const auth = load("lib/auth-session.ts", {}, globals);
  const dependencies = { "next/server": { NextResponse }, "@/lib/database": database, "@/lib/people": people, "@/lib/birthdays": birthdays, "@/lib/auth-session": auth };
  const admin = load("app/api/admin/people/route.ts", dependencies, globals);
  const session = load("app/api/auth/session/route.ts", dependencies, globals);
  const publicPeople = load("app/api/people/route.ts", dependencies, globals);
  const loginPeople = load("app/api/auth/people/route.ts", dependencies, globals);
  const request = (method, body, cookie = "schedule_admin=" + auth.adminCookieToken()) => admin[method](new NextRequest("https://schedule.test/api/admin/people", { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  const sessionRequest = (id, query = "") => session.GET(new NextRequest("https://schedule.test/api/auth/session" + query, { headers: { Cookie: id ? "schedule_auth=" + auth.createAuthSessionToken(id, "user") : "" } }));
  return { entries, request, sessionRequest, publicPeople, loginPeople };
}

test("admin creates, edits and clears birthdays; invalid and unauthorized writes fail", async () => {
  const f = fixture(), input = { name: "Иван", active: true, birthday: "02-29" };
  assert.equal((await f.request("POST", input, "")).status, 401);
  assert.equal((await f.request("POST", { ...input, birthday: "02-30" })).status, 400);
  const response = await f.request("POST", input);
  assert.equal(response.status, 201);
  const { person } = await response.json();
  assert.equal(person.birthday, "02-29");
  assert.equal((await f.request("PUT", { ...person, birthday: "11-28" })).status, 200);
  // Older clients that omit the optional field preserve the stored birthday.
  const { birthday: ignored, ...legacy } = person;
  await f.request("PUT", { ...legacy, name: "Ваня" });
  assert.equal(f.entries[0].birthday, "11-28");
  assert.equal((await f.request("PUT", { ...person, birthday: { $gt: "" } })).status, 400);
  assert.equal(f.entries[0].birthday, "11-28");
  await f.request("PUT", { ...person, birthday: "" });
  assert.equal(f.entries[0].birthday, undefined);
});

test("birthday is private to the authenticated user and admin; public pickers omit it", async () => {
  const f = fixture();
  const a = (await (await f.request("POST", { name: "Иван", birthday: "11-28" })).json()).person;
  const b = (await (await f.request("POST", { name: "Анна", birthday: "05-01" })).json()).person;
  const response = await f.sessionRequest(a.id, "?personId=" + b.id);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.json()).person.birthday, "11-28");
  assert.equal((await f.sessionRequest()).status, 401);
  for (const route of [f.publicPeople, f.loginPeople]) for (const person of (await (await route.GET()).json()).people) assert.equal("birthday" in person, false);
  assert.equal((await (await f.request("GET")).json()).people[1].birthday, "05-01");
  f.entries[0].active = false;
  assert.equal((await f.sessionRequest(a.id)).status, 401);
});

test("confetti waits for loading, runs once per launch, replays on resume and stops on logout", async () => {
  let effect, loadingListener, user = { id: "a", birthday: "11-28" }, fires = 0, stops = 0, imported = 0;
  const document = new EventTarget(), window = new EventTarget();
  document.hidden = false;
  const timers = new Map(); let nextTimer = 0;
  const helpers = { ...birthdays, isBirthdayToday: value => value === "11-28" };
  const component = load("components/BirthdayCelebration.tsx", {
    react: { useEffect: fn => { effect = fn; }, useState: init => [init()] },
    "@/lib/visible-clock": { useVisibleClock: () => Date.parse("2026-11-28T10:00:00Z") },
    "@/lib/birthdays": helpers,
    "@/lib/auth-client": { fetchAuthSession: async () => user ? Response.json({ person: user }) : new Response(null, { status: 401 }) },
    "@/lib/screen-loading": { subscribeScreenLoading: fn => { loadingListener = fn; fn(true); return () => {}; } },
    "@/lib/birthday-confetti": { get fireBirthdayConfetti() { imported++; return () => { fires++; return () => { stops++; }; }; } },
  }, { document, window, setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id) });
  const flush = async () => { await tick(); const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); await tick(); };
  component.default(); const cleanup = effect();
  await flush(); assert.equal(fires, 0);
  loadingListener(false); await flush(); assert.equal(fires, 1);
  loadingListener(true); loadingListener(false); await flush(); assert.equal(fires, 1);
  document.hidden = true; document.dispatchEvent(new Event("visibilitychange"));
  document.hidden = false; document.dispatchEvent(new Event("visibilitychange")); await flush(); assert.equal(fires, 2);
  user = null; window.dispatchEvent(new Event("schedule-auth-change")); await flush(); assert.equal(fires, 2); assert.ok(stops >= 2);
  user = { id: "b", birthday: "05-01" }; window.dispatchEvent(new Event("schedule-auth-change")); await flush(); assert.equal(fires, 2);
  assert.equal(imported, 2);
  cleanup(); assert.equal(timers.size, 0);
});
