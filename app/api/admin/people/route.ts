import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deletePerson, getPeople, savePerson } from "@/lib/database";
import { normalizePersonRole } from "@/lib/people";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? ADMIN_PASSWORD;
const COOKIE_NAME = "schedule_admin";
function token() { return SESSION_SECRET ? createHmac("sha256", SESSION_SECRET).update("schedule-admin").digest("hex") : null; }
function authorized(request: NextRequest) { const value = token(); return Boolean(value && request.cookies.get(COOKIE_NAME)?.value === value); }
function bad() { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
function telegramUsername(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  if (!normalized) return "";
  return /^[A-Za-z0-9_]{5,32}$/.test(normalized) ? normalized : null;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return bad();
  const people=(await getPeople(false)).map(({telegramChatId,telegramUserId,telegramLinkedAt,...person})=>({
    ...person,
    telegramLinked:Boolean(telegramChatId&&telegramUserId&&telegramLinkedAt),
  }));
  return NextResponse.json({ people }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return bad();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Укажите имя" }, { status: 400 });
  const username = telegramUsername(body.telegramUsername);
  if (username === null) return NextResponse.json({ error: "Telegram username: 5–32 символа, латиница, цифры или _" }, { status: 400 });
  const person = await savePerson({ name: body.name.trim().slice(0,120), active: body.active !== false, role: normalizePersonRole(body.role), telegramUsername: username || undefined });
  return NextResponse.json({ person }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) return bad();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string" || typeof body.name !== "string" || !body.name.trim()) return NextResponse.json({ error: "Проверьте данные человека" }, { status: 400 });
  const username = telegramUsername(body.telegramUsername);
  if (username === null) return NextResponse.json({ error: "Telegram username: 5–32 символа, латиница, цифры или _" }, { status: 400 });
  const person = await savePerson({ name: body.name.trim().slice(0,120), active: body.active !== false, role: normalizePersonRole(body.role), telegramUsername: username || undefined }, body.id);
  return NextResponse.json({ person });
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return bad();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан человек" }, { status: 400 });
  await deletePerson(id);
  return NextResponse.json({ ok: true });
}
