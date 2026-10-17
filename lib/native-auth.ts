import { createHash, randomBytes } from "node:crypto";
import { authHmac } from "@/lib/auth-session";
import { getDatabase } from "@/lib/database";
import { safeAuthNext } from "@/lib/auth-next";

type NativeHandoff = { _id: string; personId: string; challenge: string; next: string; expiresAt: Date };
const collection = async () => (await getDatabase()).collection<NativeHandoff>("auth_native_handoffs");
export const validNativeChallenge = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

export async function createNativeHandoff(personId: string, challenge: string, next: string) {
  if (!validNativeChallenge(challenge)) throw new Error("Invalid native challenge");
  const code = randomBytes(32).toString("base64url");
  const store = await collection();
  await store.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await store.insertOne({ _id: authHmac("native-handoff:" + code), personId, challenge, next: safeAuthNext(next), expiresAt: new Date(Date.now() + 60_000) });
  return code;
}

export async function consumeNativeHandoff(code: string, verifier: string) {
  if (!validNativeChallenge(code) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return null;
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  // Atomic consumption prevents replay. An incorrect verifier doesn't consume the valid code.
  return (await collection()).findOneAndDelete({ _id: authHmac("native-handoff:" + code), challenge, expiresAt: { $gt: new Date() } });
}
