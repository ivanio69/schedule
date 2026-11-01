import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getDatabase } from "@/lib/database";
import { createTaskResolver } from "@/lib/task-events";
import { normalizeTask, sameTaskLink, validTaskDate, validTaskId, type Task } from "@/lib/tasks";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
let indexReady: Promise<string> | undefined;
const validRevision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

async function handle(request: Request) {
  const session = verifyAuthSessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  if (!session) return json({ error: "Требуется вход через Telegram" }, 401);
  const creatorId = session.personId;
  const collection = (await getDatabase()).collection<Task>("tasks");
  indexReady ??= collection.createIndex({ creatorId: 1, id: 1 }, { unique: true, name: "tasks_owner_id" }).catch(error => { indexReady = undefined; throw error; });
  await indexReady;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const date = url.searchParams.get("date");
    if (!validTaskDate(date)) return json({ error: "Укажите корректную дату" }, 400);
    const [tasks, resolver] = await Promise.all([
      collection.find({ creatorId }, { projection: { _id: 0 } }).toArray(), createTaskResolver(creatorId),
    ]);
    return json(await resolver.day(date, tasks));
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Некорректная задача" }, 400);
  const editing = request.method !== "POST";
  if (editing && (!validTaskId(body.id) || !validRevision(body.revision))) return json({ error: "Обновите задачу и повторите действие" }, 400);
  const before = editing ? await collection.findOne({ id: body.id, creatorId }) : null;
  if (editing && !before) return json({ error: "Задача не найдена" }, 404);
  if (before && before.revision !== body.revision) return json({ error: "Задача изменилась. Обновите список и повторите действие" }, 409);
  const filter = { id: body.id as string, creatorId, revision: body.revision as number };
  if (request.method === "DELETE") {
    const result = await collection.deleteOne(filter);
    return result.deletedCount ? json({ ok: true }) : json({ error: "Задача изменилась. Обновите список" }, 409);
  }
  if (request.method === "PATCH") {
    if (typeof body.completed !== "boolean") return json({ error: "Некорректный статус задачи" }, 400);
    const result = await collection.updateOne(filter, { $set: { completed: body.completed, updatedAt: new Date().toISOString() }, $inc: { revision: 1 } });
    return result.matchedCount ? json({ ok: true }) : json({ error: "Задача изменилась. Обновите список" }, 409);
  }
  const input = normalizeTask(body);
  if (!input) return json({ error: "Проверьте название, дату и время задачи" }, 400);
  // Existing links can be retained if an event was cancelled/deleted; a new link must be visible to this user.
  const keptLink = before?.event && input.event && sameTaskLink(before.event, input.event) && input.date === before.date;
  if (input.event && !keptLink && !await (await createTaskResolver(creatorId)).validLink(input)) return json({ error: "Событие недоступно на выбранную дату. Выберите другое событие" }, 400);
  const now = new Date().toISOString();
  if (before) {
    const result = await collection.updateOne(filter, { $set: { ...input, updatedAt: now }, $inc: { revision: 1 } });
    return result.matchedCount ? json({ ok: true }) : json({ error: "Задача изменилась. Обновите список" }, 409);
  }
  const task: Task = { ...input, id: randomUUID(), creatorId, completed: false, revision: 0, createdAt: now, updatedAt: now };
  await collection.insertOne(task);
  return json({ task }, 201);
}
async function route(request: Request) {
  try { return await handle(request); }
  catch (error) { console.error("Task request failed", error); return json({ error: "Не удалось загрузить или сохранить задачи" }, 500); }
}
export { route as GET, route as POST, route as PUT, route as PATCH, route as DELETE };
