import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getDatabase } from "@/lib/database";
import { normalizePersonalEvent, type PersonalEvent } from "@/lib/personal-events";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function handle(request: Request) {
  const session = verifyAuthSessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  if (!session) return json({ error: "Требуется вход через Telegram" }, 401);
  const creatorId = session.personId;
  const db = await getDatabase();
  const collection = db.collection<PersonalEvent>("personal_events");
  if (request.method === "GET") {
    const events = await collection.find({ creatorId }, { projection: { _id: 0 } }).sort({ date: 1, timeStart: 1 }).toArray();
    return json({ events });
  }
  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 128) return json({ error: "Некорректное событие" }, 400);
    const result = await collection.deleteOne({ id, creatorId });
    return result.deletedCount ? json({ ok: true }) : json({ error: "Событие не найдено" }, 404);
  }
  const body = await request.json().catch(() => null);
  const input = normalizePersonalEvent(body);
  if (!input) return json({ error: "Проверьте название, дату и время: конец должен быть позже начала" }, 400);
  if (request.method === "PUT") {
    if (typeof body.id !== "string" || !body.id || body.id.length > 128) return json({ error: "Некорректное событие" }, 400);
    const result = await collection.updateOne({ id: body.id, creatorId }, { $set: input });
    return result.matchedCount ? json({ event: { ...input, id: body.id, creatorId } }) : json({ error: "Событие не найдено" }, 404);
  }
  const event: PersonalEvent = { ...input, id: randomUUID(), creatorId };
  await collection.insertOne(event);
  return json({ event }, 201);
}

async function route(request: Request) {
  try { return await handle(request); }
  catch (error) {
    console.error("Personal event request failed", error);
    return json({ error: "Не удалось загрузить или сохранить личное событие" }, 500);
  }
}
export { route as GET, route as POST, route as PUT, route as DELETE };
