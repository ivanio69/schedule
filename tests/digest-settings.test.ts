import assert from "node:assert/strict";
import { getDueDigestDate, normalizeDigestSettings } from "../lib/digest-settings";

const normalized = normalizeDigestSettings({
  morningEnabled: true,
  morningTime: "07:13",
  eveningEnabled: true,
  eveningTime: "21:47",
  timeZone: "Europe/Berlin",
});
assert.equal(normalized.morningTime, "07:13");
assert.equal(normalized.eveningTime, "21:47");
assert.equal(normalizeDigestSettings({ morningTime: "25:99" }).morningTime, "08:00");

assert.equal(
  getDueDigestDate(new Date("2026-09-23T08:04:00Z"), "UTC", "08:00"),
  "2026-09-23",
);
assert.equal(
  getDueDigestDate(new Date("2026-09-23T07:59:00Z"), "UTC", "08:00"),
  null,
);
assert.equal(
  getDueDigestDate(new Date("2026-09-23T08:46:00Z"), "UTC", "08:00"),
  null,
);
assert.equal(
  getDueDigestDate(new Date("2026-09-24T00:04:00Z"), "UTC", "23:59"),
  "2026-09-23",
);
assert.equal(
  getDueDigestDate(new Date("2026-09-23T06:05:00Z"), "Europe/Berlin", "08:00"),
  "2026-09-23",
);

console.log("Digest settings tests passed.");
