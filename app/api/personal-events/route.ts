import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getDatabase, getPeople } from "@/lib/database";
import { sendPush } from "@/lib/push";
import { normalizePersonalEvent, type PersonalEvent, type PersonalEventInvitation } from "@/lib/personal-events";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 128;
const versionFilter = (event: PersonalEvent) => ({ id: event.id, revision: event.revision ?? { $exists: false } });
const activeAudience = (event: PersonalEvent) => (event.invitations ?? []).filter(invite => invite.status !== "declined").map(invite => invite.personId);

async function notify(ids: string[], title: string, event: PersonalEvent, detail = "") {
  if (!ids.length) return;
  try {
    await sendPush([...new Set(ids)], null, {
      title, body: `${detail}${event.title} · ${event.date} · ${event.timeStart}–${event.timeEnd}`,
      url: "/", tag: `personal-event-${event.id}`,
    });
  } catch (error) { console.error("Personal event notification failed", error); }
}

async function handle(request: Request) {
  const session = verifyAuthSessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  if (!session) return json({ error: "Требуется вход через Telegram" }, 401);
  const personId = session.personId;
  const db = await getDatabase();
  const collection = db.collection<PersonalEvent>("personal_events");
  if (request.method === "GET") {
    const items = await collection.find({ $or: [
      { creatorId: personId },
      { invitations: { $elemMatch: { personId, status: { $in: ["pending", "accepted"] } } } },
    ] }, { projection: { _id: 0 } }).sort({ date: 1, timeStart: 1 }).toArray();
    const people = items.length ? await getPeople() : [];
    const names = new Map(people.map(person => [person.id, person.name]));
    const visible = items.map(event => ({ ...event, creatorName: names.get(event.creatorId) ?? "Автор события", canEdit: event.creatorId === personId,
      invitations: (event.invitations ?? []).filter(invite => event.creatorId === personId || invite.personId === personId).map(invite => ({ ...invite, name: names.get(invite.personId) ?? "Пользователь" })),
    }));
    return json({ personId,
      events: visible.filter(event => event.creatorId === personId || event.invitations.some(invite => invite.personId === personId && invite.status === "accepted")),
      invitations: visible.filter(event => event.creatorId !== personId && event.invitations.some(invite => invite.personId === personId && invite.status === "pending")),
    });
  }
  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    if (!validId(id)) return json({ error: "Некорректное событие" }, 400);
    const before = await collection.findOne({ id, creatorId: personId });
    if (!before) return json({ error: "Событие не найдено" }, 404);
    const result = await collection.deleteOne({ ...versionFilter(before), creatorId: personId });
    if (!result.deletedCount) return json({ error: "Событие изменилось. Обновите его и повторите действие" }, 409);
    await notify(activeAudience(before), "Событие отменено", before);
    return json({ ok: true });
  }
  const body = await request.json().catch(() => null);
  if (request.method === "PATCH") {
    if (!validId(body?.id) || !["accepted", "declined"].includes(body?.status)) return json({ error: "Некорректный ответ на приглашение" }, 400);
    const before = await collection.findOne({ id: body.id, invitations: { $elemMatch: { personId, status: "pending" } } });
    if (!before || before.creatorId === personId) return json({ error: "Приглашение не найдено или ответ уже сохранён" }, 404);
    const invitations = (before.invitations ?? []).map(invite => invite.personId === personId ? { ...invite, status: body.status as PersonalEventInvitation["status"] } : invite);
    const result = await collection.updateOne(versionFilter(before), { $set: { invitations }, $inc: { revision: 1 } });
    if (!result.matchedCount) return json({ error: "Приглашение изменилось. Обновите страницу и повторите ответ" }, 409);
    const name = (await getPeople()).find(person => person.id === personId)?.name ?? "Пользователь";
    await notify([before.creatorId], body.status === "accepted" ? "Приглашение принято" : "Отказ от приглашения", before, `${name}: `);
    return json({ ok: true });
  }
  const input = normalizePersonalEvent(body);
  if (!input) return json({ error: "Проверьте название, дату и время: конец должен быть позже начала" }, 400);
  const before = request.method === "PUT" && validId(body.id) ? await collection.findOne({ id: body.id, creatorId: personId }) : null;
  if (request.method === "PUT" && !before) return json({ error: "Событие не найдено" }, 404);
  const people = await getPeople(true);
  const ids: unknown = body.inviteeIds ?? (before?.invitations ?? []).map(invite => invite.personId);
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !validId(id) || id === personId || !people.some(person => person.id === id))) return json({ error: "Проверьте список приглашённых" }, 400);
  const invitations: PersonalEventInvitation[] = [...new Set(ids as string[])].map(id => ({ personId: id, status: before?.invitations?.find(invite => invite.personId === id)?.status ?? "pending" }));
  const event: PersonalEvent = { ...input, id: before?.id ?? randomUUID(), creatorId: personId, invitations, revision: (before?.revision ?? 0) + 1 };
  if (before) {
    const result = await collection.updateOne({ ...versionFilter(before), creatorId: personId }, { $set: { ...input, invitations }, $inc: { revision: 1 } });
    if (!result.matchedCount) return json({ error: "Событие изменилось. Обновите его и повторите сохранение" }, 409);
  } else await collection.insertOne(event);
  const added = invitations.filter(invite => !before?.invitations?.some(old => old.personId === invite.personId)).map(invite => invite.personId);
  const removed = before ? activeAudience(before).filter(id => !invitations.some(invite => invite.personId === id)) : [];
  const changed = before && ["title", "date", "timeStart", "timeEnd", "location", "notes"].some(key => before[key as keyof typeof input] !== input[key as keyof typeof input]);
  const updated = changed ? activeAudience(event).filter(id => !added.includes(id)) : [];
  await Promise.all([
    notify(added, "Приглашение на событие", event, `${people.find(person => person.id === personId)?.name ?? "Пользователь"} приглашает: `),
    notify(removed, "Приглашение отменено", event),
    notify(updated, "Событие изменено", event),
  ]);
  return json({ event }, before ? 200 : 201);
}

async function route(request: Request) {
  try { return await handle(request); }
  catch (error) {
    console.error("Personal event request failed", error);
    return json({ error: "Не удалось загрузить или сохранить событие" }, 500);
  }
}
export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE };
