import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "native_auth_test";
  process.env.AUTH_SESSION_SECRET = "native-auth-integration-only";
  process.env.TELEGRAM_OIDC_CLIENT_ID = "test-client";
  process.env.TELEGRAM_OIDC_CLIENT_SECRET = "test-secret";
  const { getDatabase } = await import("../lib/database");
  const { default: client } = await import("../lib/mongodb");
  const { safeAuthNext } = await import("../lib/auth-next");
  const { createTelegramOpenIdFlow, readTelegramOpenIdFlow, TELEGRAM_OIDC_FLOW_COOKIE } = await import("../lib/telegram-openid");
  const { createNativeHandoff } = await import("../lib/native-auth");
  const { verifyAuthSessionToken, AUTH_COOKIE } = await import("../lib/auth-session");
  const start = await import("../app/api/auth/openid/start/route");
  const callback = await import("../app/api/auth/openid/callback/route");
  const complete = await import("../app/api/auth/native/complete/route");
  const originalFetch = globalThis.fetch;
  const origin = "https://schedule-ivanio.vercel.app";
  try {
    const db = await getDatabase();
    await db.collection("people").insertOne({ id: "person", name: "Test", active: true, role: "admin", telegramOidcSub: "telegram-user" });
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const response = await start.GET(new NextRequest(origin + "/api/auth/openid/start?next=%2Fschedule&native_challenge=" + challenge));
    const cookie = response.cookies.get(TELEGRAM_OIDC_FLOW_COOKIE)!.value;
    const flow = readTelegramOpenIdFlow(cookie)!;
    assert.equal(flow.nativeChallenge, challenge);
    assert.equal(flow.redirectUri, origin + "/api/auth/openid/callback");
    assert.equal(new URL(response.headers.get("location")!).hostname, "oauth.telegram.org");
    assert.equal(readTelegramOpenIdFlow(cookie + "tampered"), null);
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({ iss: "https://oauth.telegram.org", aud: "test-client", sub: "telegram-user", iat: now, exp: now + 120, nonce: flow.nonce })).toString("base64url");
    const unsigned = header + "." + payload;
    const idToken = unsigned + "." + sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
    globalThis.fetch = async input => {
      if (String(input).endsWith("/token")) return Response.json({ id_token: idToken });
      if (String(input).endsWith("/jwks.json")) return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test" }] });
      throw new Error("Unexpected network request");
    };
    const authRequest = (state: string, suffix = "&code=telegram-code") => new NextRequest(origin + "/api/auth/openid/callback?state=" + state + suffix, { headers: { cookie: TELEGRAM_OIDC_FLOW_COOKIE + "=" + cookie } });
    const invalidState = await callback.GET(authRequest("ios.wrong"));
    assert.equal(new URL(invalidState.headers.get("location")!).searchParams.get("openid_error"), "invalid_state");
    const denied = await callback.GET(authRequest(flow.state, "&error=access_denied"));
    assert.equal(new URL(denied.headers.get("location")!).protocol, "schedule214:");
    const authenticated = await callback.GET(authRequest(flow.state));
    const deepLink = new URL(authenticated.headers.get("location")!);
    assert.equal(deepLink.origin, "null");
    assert.equal(deepLink.protocol, "schedule214:");
    assert.equal(deepLink.host + deepLink.pathname, "auth/callback");
    assert.equal(authenticated.cookies.get(AUTH_COOKIE), undefined, "The system browser doesn't receive the WebView session");
    const code = deepLink.searchParams.get("code")!;
    const post = (code: string, verifier: string, headers: Record<string, string> = { "X-Schedule-Native-Auth": "1" }) => new NextRequest(origin + "/api/auth/native/complete", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams({ code, verifier }) });
    assert.equal((await complete.POST(post(code, verifier, {}))).cookies.get(AUTH_COOKIE), undefined, "Cross-site forms cannot log the browser in");
    assert.equal((await complete.POST(post(code, verifier, { "X-Schedule-Native-Auth": "1", Origin: "https://evil.invalid" }))).cookies.get(AUTH_COOKIE), undefined);
    assert.equal((await complete.POST(post(code, randomBytes(32).toString("base64url")))).cookies.get(AUTH_COOKIE), undefined);
    // Role and active status are checked again at consumption, not trusted from the earlier callback.
    await db.collection("people").updateOne({ id: "person" }, { $set: { role: "user" } });
    const loggedIn = await complete.POST(post(code, verifier));
    assert.equal(loggedIn.status, 303);
    assert.equal(verifyAuthSessionToken(loggedIn.cookies.get(AUTH_COOKIE)!.value)?.role, "user");
    assert.equal(new URL(loggedIn.headers.get("location")!).searchParams.get("next"), "/schedule");
    assert.equal(loggedIn.cookies.get(AUTH_COOKIE)!.httpOnly, true);
    assert.equal((await complete.POST(post(code, verifier))).cookies.get(AUTH_COOKIE), undefined, "Codes are single use");
    const expired = await createNativeHandoff("person", challenge, "/");
    await db.collection("auth_native_handoffs").updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal((await complete.POST(post(expired, verifier))).cookies.get(AUTH_COOKIE), undefined);
    const removed = await createNativeHandoff("person", challenge, "/");
    await db.collection("people").updateOne({ id: "person" }, { $set: { active: false } });
    assert.equal((await complete.POST(post(removed, verifier))).cookies.get(AUTH_COOKIE), undefined);
    assert.equal(readTelegramOpenIdFlow(createTelegramOpenIdFlow(origin, "/schedule").cookie)!.nativeChallenge, undefined, "Browser login keeps its original flow");
    for (const value of ["//evil.invalid", "/\\evil.invalid", "/login", "/api/auth/native/complete"]) assert.equal(safeAuthNext(value), "/");
    console.log("Native Telegram auth: signed OIDC → app callback → WebView cookies, PKCE, replay, expiry, cancellation and profile checks passed");
  } finally {
    globalThis.fetch = originalFetch;
    await (await client).close();
    await mongo.stop();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
