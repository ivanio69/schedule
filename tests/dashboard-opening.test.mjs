import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../components/DayTimeline.tsx", import.meta.url), "utf8");
const scroll = source.indexOf('if (openingScroll === "pending")');
const start = source.lastIndexOf("  useLayoutEffect(() => {", scroll);
const end = source.indexOf("}, [date, focusKey, openFromTop, openingScroll]);", scroll);
assert.ok(start >= 0 && end > start);
const code = ts.transpile(source.slice(start, end + "}, [date, focusKey, openFromTop, openingScroll]);".length), { target: ts.ScriptTarget.ES2022 });

function harness() {
  let cleanup;
  let nextFrame = 0;
  const frames = new Map(), calls = [];
  const context = {
    openingScroll: "pending", date: "2026-11-28", focusKey: "current", openFromTop: false,
    positionedDate: { current: null },
    list: { current: { querySelector: () => ({ getBoundingClientRect: () => ({ top: 800 }) }) } },
    document: { querySelector: () => ({ getBoundingClientRect: () => ({ height: 80 }) }) },
    window: { scrollY: 300, scrollTo: options => calls.push({ ...options }) },
    getComputedStyle: () => ({ top: "0" }),
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    useLayoutEffect: fn => { cleanup = fn(); },
  };
  vm.createContext(context);
  const run = changes => { cleanup?.(); Object.assign(context, changes); vm.runInContext(code, context); };
  const flush = () => { while (frames.size) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } };
  return { context, calls, run, flush, frames };
}

test("waits for the birthday profile, then opens above the greeting without scrolling to an event", () => {
  const h = harness();
  h.run({ openingScroll: "pending" }); h.flush();
  assert.equal(h.calls.length, 0);
  h.run({ openingScroll: "top" }); h.flush();
  assert.deepEqual(h.calls, [{ top: 0, behavior: "instant" }]);
  h.run({ focusKey: "next" }); h.flush();
  assert.equal(h.calls.length, 1, "clock ticks must not undo manual scrolling");
});

test("birthday opens from the top on a free day and cancels an already scheduled event scroll", () => {
  const h = harness();
  h.run({ openingScroll: "focus" });
  h.run({ openingScroll: "top", focusKey: undefined }); h.flush();
  assert.deepEqual(h.calls, [{ top: 0, behavior: "instant" }]);
});

test("ordinary days retain their event positioning and first-event top behavior", () => {
  const h = harness();
  h.run({ openingScroll: "focus" }); h.flush();
  assert.equal(h.calls[0].top, 952);
  h.run({ date: "2026-11-29", openFromTop: true }); h.flush();
  assert.equal(h.calls[1].top, 0);
});
