import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/database";

type WidgetPairing = {
  codeHash: string;
  personId: string;
  createdAt: Date;
  expiresAt: Date;
};

type WidgetToken = {
  id: string;
  tokenHash: string;
  personId: string;
  deviceId?: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
};

const PAIRING_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanDeviceId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 ? value : undefined;
}

export async function createWidgetPairing(personId: string) {
  const db = await getDatabase();
  const now = new Date();
  await db.collection<WidgetPairing>("widget_pairings").deleteMany({ expiresAt: { $lte: now } });
  const code = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  await db.collection<WidgetPairing>("widget_pairings").insertOne({
    codeHash: hashSecret(code),
    personId,
    createdAt: now,
    expiresAt,
  });
  return { code, expiresAt };
}

export async function createWidgetToken(personId: string, deviceId?: unknown) {
  const db = await getDatabase();
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  await db.collection<WidgetToken>("widget_tokens").insertOne({
    id: randomUUID(),
    tokenHash: hashSecret(token),
    personId,
    deviceId: cleanDeviceId(deviceId),
    createdAt: now,
    expiresAt,
    lastUsedAt: now,
  });
  return { token, personId, expiresAt };
}

export async function exchangeWidgetPairing(code: unknown, deviceId?: unknown) {
  if (typeof code !== "string" || !SECRET_PATTERN.test(code)) return null;
  const db = await getDatabase();
  const now = new Date();
  const pairing = await db.collection<WidgetPairing>("widget_pairings").findOne({
    codeHash: hashSecret(code),
    expiresAt: { $gt: now },
  });
  if (!pairing) return null;

  const consumed = await db.collection<WidgetPairing>("widget_pairings").deleteOne({
    _id: pairing._id,
    codeHash: pairing.codeHash,
  });
  if (consumed.deletedCount !== 1) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  await db.collection<WidgetToken>("widget_tokens").insertOne({
    id: randomUUID(),
    tokenHash: hashSecret(token),
    personId: pairing.personId,
    deviceId: cleanDeviceId(deviceId),
    createdAt: now,
    expiresAt,
    lastUsedAt: now,
  });

  return { token, personId: pairing.personId, expiresAt };
}

export async function resolveWidgetToken(rawToken: unknown) {
  if (typeof rawToken !== "string" || !SECRET_PATTERN.test(rawToken)) return null;
  const db = await getDatabase();
  const now = new Date();
  const tokenHash = hashSecret(rawToken);
  const token = await db.collection<WidgetToken>("widget_tokens").findOne({
    tokenHash,
    expiresAt: { $gt: now },
  });
  if (!token) return null;
  await db.collection<WidgetToken>("widget_tokens").updateOne(
    { _id: token._id },
    { $set: { lastUsedAt: now } },
  );
  return token;
}

export async function countWidgetTokens(personId: string) {
  const db = await getDatabase();
  const now = new Date();
  await db.collection<WidgetToken>("widget_tokens").deleteMany({ expiresAt: { $lte: now } });
  return db.collection<WidgetToken>("widget_tokens").countDocuments({
    personId,
    expiresAt: { $gt: now },
  });
}

export async function revokeWidgetToken(rawToken: unknown) {
  if (typeof rawToken !== "string" || !SECRET_PATTERN.test(rawToken)) return false;
  const db = await getDatabase();
  const result = await db.collection<WidgetToken>("widget_tokens").deleteOne({
    tokenHash: hashSecret(rawToken),
  });
  return result.deletedCount === 1;
}

export async function revokeWidgetTokens(personId: string) {
  const db = await getDatabase();
  const result = await db.collection<WidgetToken>("widget_tokens").deleteMany({ personId });
  return result.deletedCount;
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? null;
}
