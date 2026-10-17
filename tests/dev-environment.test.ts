import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { AUTH_COOKIE, createAuthSessionToken } from "../lib/auth-session";
import { GET, POST } from "../app/api/environment/route";
import versionInfo from "../version.json";

async function main() {
process.env.VERCEL_ENV = "production";
process.env.VERCEL_GIT_COMMIT_REF = "main";
process.env.AUTH_SESSION_SECRET = "test-session-secret";
const pr = versionInfo.pr + 1;
const token = createAuthSessionToken("test", "user");
const selection = `schedule_environment=dev; schedule_dev_host=schedule-git-test-ivanio.vercel.app; schedule_dev_pr=${pr}`;
const cookie = `${selection}; ${AUTH_COOKIE}=${token}`;
const req = (path: string, cookies = cookie) => new NextRequest(`https://schedule-ivanio.vercel.app${path}`, { headers: { cookie: cookies } });

for (const path of ["/settings", "/_next/static/chunks/preview.js", "/_next/static/css/preview.css", "/_next/image?url=%2Ficons%2Ficon.svg&w=64&q=75", "/icons/icon.svg", "/api/schedule"]) {
  const response = proxy(req(path));
  const target = new URL(response.headers.get("x-middleware-rewrite")!);
  assert.equal(target.host, "schedule-git-test-ivanio.vercel.app", path);
  assert.equal(target.pathname + target.search, new URL(req(path).url).pathname + new URL(req(path).url).search);
  assert.equal(response.headers.get("x-schedule-environment"), "dev");
  assert.match(response.headers.get("cache-control")!, /no-store/);
}
assert.equal(proxy(req("/sw.js")).headers.get("x-middleware-rewrite"), null);
assert.equal(proxy(req("/api/environment")).headers.get("x-middleware-rewrite"), null);
assert.equal(proxy(req("/_next/static/anonymous.js", "")).status, 200);
assert.equal(proxy(req("/", selection)).headers.get("location")?.includes("/login"), true);
assert.equal(proxy(req("/api/admin/people")).status, 403);
assert.equal(proxy(req("/admin")).headers.get("location"), "https://schedule-ivanio.vercel.app/");
const invalid = proxy(req("/", cookie.replace("schedule-git-test-ivanio.vercel.app", "evil.example")));
assert.equal(invalid.cookies.get("schedule_environment")?.value, "");
assert.equal(invalid.headers.get("x-middleware-rewrite"), null);
process.env.VERCEL_ENV = "preview";
assert.equal(proxy(req("/_next/static/preview.js")).headers.get("x-middleware-rewrite"), null);
process.env.VERCEL_ENV = "production";

const originalFetch = globalThis.fetch;
let buildStatus = 200;
let authenticated = true;
const calls: string[] = [];
globalThis.fetch = async (input, options) => {
  const url = String(input);
  calls.push(url);
  if (url.includes("api.github.com") && url.includes("/pulls?")) return Response.json([{ number: pr, base: { ref: "main" }, head: { ref: "test", repo: { full_name: "ivanio69/schedule" } } }]);
  if (url.includes("api.github.com") && url.includes("/contents/version.json")) return Response.json({ encoding: "base64", content: Buffer.from(JSON.stringify({ release: "5.5.1", dev: 1 })).toString("base64") });
  if (url.endsWith("/api/build-version")) return buildStatus === 200 ? Response.json({ channel: "preview", version: "5.5.1.dev1" }) : new Response(null, { status: buildStatus });
  if (url.endsWith("/api/auth/session")) {
    assert.equal(new Headers(options?.headers).get("cookie"), `${AUTH_COOKIE}=${token}`);
    assert.equal(options?.redirect, "manual");
    return Response.json({ authenticated }, { status: authenticated ? 200 : 401, headers: { "set-cookie": "schedule_auth=; Max-Age=0" } });
  }
  throw new Error(`Unexpected fetch: ${url}`);
};
const switchRequest = (headers = { cookie, origin: "https://schedule-ivanio.vercel.app" }) => new Request("https://schedule-ivanio.vercel.app/api/environment", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ pr }) });
try {
  const available = await (await GET(req("/api/environment", ""))).json();
  assert.equal(available.dev.pr, pr);
  const ready = await POST(switchRequest());
  assert.equal(ready.status, 200);
  assert.equal(ready.headers.get("set-cookie"), null);
  authenticated = false;
  const rejected = await POST(switchRequest());
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get("set-cookie"), null, "preview cannot clear stable session");
  for (const status of [401, 403, 404, 500, 302]) {
    buildStatus = status;
    assert.equal((await (await GET(req("/api/environment", ""))).json()).dev, null, `status ${status} is not a ready preview`);
    assert.equal((await POST(switchRequest())).status, 503);
  }
  assert.equal((await POST(switchRequest({ cookie: "", origin: "https://schedule-ivanio.vercel.app" }))).status, 401);
  assert.equal((await POST(switchRequest({ cookie, origin: "https://evil.example" }))).status, 403);
  console.log("DEV routing, public assets, auth/roles, invalid selection, readiness and session preflight passed.");
} finally {
  globalThis.fetch = originalFetch;
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
