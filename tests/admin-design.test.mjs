import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
test("All admin tabs use the shared heading", () => {
  for (const path of ["app/admin/page.tsx", "components/Seminars.tsx", "components/AdminIndividualSlots.tsx", "components/AdminBroadcast.tsx", "components/AdminRehearsals.tsx"])
    assert.match(read(path), /<AdminHeading\s/);
  assert.doesNotMatch(read("app/admin/page.tsx"), /<h2>Люди<\/h2>/);
  assert.doesNotMatch(read("components/AdminIndividualSlots.tsx"), /<main/);
});
test("Rehearsals stay inside the admin tab shell", () => {
  assert.match(read("app/admin/page.tsx"), /\["rehearsals", "Репетиции"\]/);
  assert.match(read("app/admin/page.tsx"), /<AdminRehearsals\/>/);
  assert.match(read("app/admin/rehearsals/page.tsx"), /redirect\("\/admin\?tab=rehearsals"\)/);
  assert.doesNotMatch(read("components/AdminRehearsals.tsx"), /AdminPageFrame/);
});
test("Client page spacing does not leak into embedded admin seminars", () => {
  const css=read("app/design-system.css");
  assert.match(css, /\.seminars-client, \.student-slots/);
  assert.doesNotMatch(css, /\.dashboard-v2, \.seminars,/);
  assert.match(css, /--accent: #b5f0cd/);
});
