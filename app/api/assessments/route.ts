import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRoleSessionPerson } from "@/lib/role-session";
import { getDatabase } from "@/lib/database";
import { getAssessments } from "@/lib/assessment-database";
import { normalizeAssessment, type Assessment } from "@/lib/assessments";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 128;
const validRevision = (revision: unknown): revision is number => Number.isSafeInteger(revision) && (revision as number) >= 1;

async function handle(request: NextRequest) {
  const person = await getRoleSessionPerson(request, ["admin", "headman", "user"]);
  if (!person) return json({ error: "Требуется вход в активный профиль" }, 401);
  const canManage = person.role === "admin" || person.role === "headman";
  const collection = (await getDatabase()).collection<Assessment>("assessments");
  if (request.method === "GET") {
    const id = request.nextUrl.searchParams.get("id");
    const access = { canManage, personId: person.id, manageHref: person.role === "admin" ? "/admin/assessments" : "/headman?tab=assessments" };
    if (id !== null) {
      if (!validId(id)) return json({ error: "Некорректная запись" }, 400);
      const assessment = await collection.findOne({ id }, { projection: { _id: 0, comments: 0 } });
      return assessment ? json({ assessment, ...access }) : json({ error: "Запись уже удалена" }, 404);
    }
    return json({ assessments: await getAssessments(), ...access });
  }
  if (request.method === "DELETE") {
    const params = request.nextUrl.searchParams;
    const id = params.get("id"), commentId = params.get("commentId");
    if (!validId(id)) return json({ error: "Некорректная запись" }, 400);
    if (commentId !== null) return json({ error: "Публичные комментарии отключены" }, 410);
    if (!canManage) return json({ error: "Управлять расписанием могут администратор и староста" }, 403);
    const revision = Number(params.get("revision"));
    if (!validRevision(revision)) return json({ error: "Обновите запись перед удалением" }, 400);
    const result = await collection.deleteOne({ id, revision });
    return result.deletedCount ? json({ ok: true }) : json({ error: "Запись уже изменилась или удалена. Обновите страницу" }, 409);
  }
  const body = await request.json().catch(() => null);
  if (body?.action === "comment") return json({ error: "Публичные комментарии отключены" }, 410);
  if (!canManage) return json({ error: "Управлять расписанием могут администратор и староста" }, 403);
  const input = normalizeAssessment(body);
  if (!input) return json({ error: "Проверьте предмет, дату и время: конец должен быть позже начала" }, 400);
  const now = new Date().toISOString();
  if (request.method === "PUT") {
    if (!validId(body.id) || !validRevision(body.revision)) return json({ error: "Обновите запись перед сохранением" }, 400);
    const updated = await collection.findOneAndUpdate({ id: body.id, revision: body.revision }, { $set: { ...input, updatedAt: now }, $inc: { revision: 1 } }, { returnDocument: "after", projection: { _id: 0, comments: 0 } });
    return updated ? json({ assessment: updated }) : json({ error: "Запись уже изменилась или удалена. Обновите страницу" }, 409);
  }
  const assessment: Assessment = { ...input, id: randomUUID(), revision: 1, createdAt: now, updatedAt: now };
  await collection.insertOne(assessment);
  return json({ assessment }, 201);
}

async function route(request: NextRequest) {
  try { return await handle(request); }
  catch (error) {
    console.error("Assessment request failed", error);
    return json({ error: "Не удалось загрузить или сохранить расписание сессии" }, 500);
  }
}
export { route as GET, route as POST, route as PUT, route as DELETE };
