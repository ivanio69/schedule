import assert from "node:assert/strict";
import test from "node:test";
import { loadTechnicalChangelog } from "../lib/technical-changelog";

const commit = (n: number) => ({ sha: `sha${n}`, commit: { message: `[5.6.1.dev${n}] Change ${n}\n\nFull technical details\n- preserve every line`, author: { name: "Ivan", date: "2026-10-18T12:00:00Z" } } });

test("pins history to deployed SHA and preserves complete commit messages", async () => {
  let url = "";
  const request = (async (input: string | URL | Request) => {
    url = String(input);
    return Response.json([commit(2), commit(1), commit(0)]);
  }) as typeof fetch;
  const result = await loadTechnicalChangelog("deployed-sha", "5.6.1", 2, 90, request);
  assert.match(url, /sha=deployed-sha/);
  assert.equal(result.commits.length, 2);
  assert.equal(result.commits[0].message, commit(2).commit.message);
  assert.equal(result.version, "5.6.1.dev2");
});

test("loads every page for versions with more than 100 commits", async () => {
  let page = 0;
  const request = (async () => Response.json(++page === 1
    ? Array.from({ length: 100 }, (_, i) => commit(101 - i)) : [commit(1)])) as typeof fetch;
  const result = await loadTechnicalChangelog("snapshot", "5.6.1", 101, 90, request);
  assert.equal(page, 2);
  assert.equal(result.commits.length, 101);
  assert.equal(result.commits.at(-1)?.sha, "sha1");
});

test("rejects unavailable or incomplete history instead of displaying a partial changelog", async () => {
  await assert.rejects(loadTechnicalChangelog("sha", "5.6.1", 2, 90, (async () => new Response(null, { status: 429 })) as typeof fetch));
  await assert.rejects(loadTechnicalChangelog("sha", "5.6.1", 2, 90, (async () => Response.json([commit(1)])) as typeof fetch));
});
