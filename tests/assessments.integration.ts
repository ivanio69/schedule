import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { assessmentNavigationStartWeek, assessmentNavigationWeeks, normalizeAssessment } from "../lib/assessments";
import { datePosition, getLessonsForWeek, getTotalWeeks } from "../lib/schedule";

async function main() {
  const input = { kind: "exam", subject: "Философия", date: "2027-01-10", timeStart: "09:00", timeEnd: "11:00", professor: "Преподаватель", auditorium: "101", notes: "Взять зачётную книжку" };
  assert.ok(normalizeAssessment(input));
  for (const bad of [{ kind: "lesson" }, { date: "2027-02-29" }, { date: "2027-02-30" }, { date: "2027-13-01" }, { timeStart: "24:00" }, { timeEnd: "09:00" }, { subject: " " }, { notes: "x".repeat(4001) }, { professor: { $gt: "" } }]) assert.equal(normalizeAssessment({ ...input, ...bad }), null);
  const semester = { semesterStart: [2026, 8, 1], days: Array.from({ length: 6 }, () => ({ table: [{ class: "Пара", professor: "", auditorium: "", group: [1], weeks: [1, 2], timeStart: "10:00", timeEnd: "11:00" }] })) };
  assert.equal(getTotalWeeks(semester), 2);
  assert.ok(assessmentNavigationWeeks(semester, [input]) > 2);
  assert.ok(assessmentNavigationStartWeek(semester, [{ date: "2026-08-01" }]) < 1);
  const { week, day } = datePosition(semester, input.date);
  assert.equal(day, 6); // Session events on Sundays and outside the semester stay reachable.
  assert.equal(getLessonsForWeek(semester, day, week).length, 0);

  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "assessments_test";
  process.env.AUTH_SESSION_SECRET = "assessments-test-only";
  const { getDatabase } = await import("../lib/database");
  const { default: connection } = await import("../lib/mongodb");
  const { createAuthSessionToken } = await import("../lib/auth-session");
  const route = await import("../app/api/assessments/route");
  const scheduleRoute = await import("../app/api/schedule/route");
  const db = await getDatabase();
  await db.collection("people").insertMany([
    { id: "admin", name: "Админ", active: true, role: "admin" },
    { id: "headman", name: "Староста", active: true, role: "headman" },
    { id: "user", name: "Студент", active: true, role: "user" },
    { id: "other", name: "Другой", active: true, role: "user" },
    { id: "inactive", name: "Неактивный", active: false, role: "admin" },
  ]);
  const request = (method: "GET" | "POST" | "PUT" | "DELETE", person: string | null, body?: unknown, query = "") => {
    const token = person ? createAuthSessionToken(person, person === "headman" ? "headman" : person === "admin" || person === "inactive" ? "admin" : "user") : "";
    return route[method](new NextRequest("http://localhost/api/assessments" + query, { method, headers: { ...(token ? { Cookie: `schedule_auth=${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  };
  try {
    for (const method of ["GET", "POST", "PUT", "DELETE"] as const) {
      assert.equal((await request(method, null, method === "POST" || method === "PUT" ? input : undefined)).status, 401);
      assert.equal((await request(method, "inactive", method === "POST" || method === "PUT" ? input : undefined)).status, 401);
    }
    assert.equal((await request("POST", "user", input)).status, 403);
    assert.equal((await request("PUT", "user", input)).status, 403);
    assert.equal((await request("POST", "admin", { ...input, timeEnd: "08:00" })).status, 400);
    const created = await request("POST", "headman", { ...input, id: "spoofed", comments: [{ text: "spoofed" }] });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("cache-control"), "private, no-store");
    let { assessment } = await created.json();
    assert.notEqual(assessment.id, "spoofed");
    assert.deepEqual(assessment.comments, []);
    const id = assessment.id;
    const list = await (await request("GET", "user")).json();
    assert.equal(list.canManage, false);
    assert.equal(list.assessments.length, 1);
    assert.equal((await (await request("GET", "headman")).json()).canManage, true);
    assert.equal((await (await request("GET", "admin")).json()).manageHref, "/admin/assessments");
    assert.equal((await request("DELETE", "user", undefined, `?id=${id}&revision=1`)).status, 403);
    const posted = await request("POST", "user", { action: "comment", id, text: "  Что подготовить?  ", personId: "admin", author: "Админ" });
    assert.equal(posted.status, 201);
    const { comment } = await posted.json();
    assert.equal(comment.author, "Студент");
    assert.equal(comment.personId, "user");
    assert.equal(comment.text, "Что подготовить?");
    assert.equal((await request("POST", "user", { action: "comment", id, text: " " })).status, 400);
    assert.equal((await request("POST", "user", { action: "comment", id, text: "x".repeat(2001) })).status, 400);
    assert.equal((await request("DELETE", "other", undefined, `?id=${id}&commentId=${comment.id}`)).status, 404);
    const edit = { ...input, id, revision: 1, notes: "Обновлённое примечание" };
    const concurrent = await Promise.all([request("PUT", "headman", edit), request("PUT", "admin", edit)]);
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
    assessment = (await (await request("GET", "user", undefined, `?id=${id}`)).json()).assessment;
    assert.equal(assessment.revision, 2);
    assert.equal(assessment.comments.length, 1); // Editing a date/notes never overwrites comments.
    assert.equal((await request("DELETE", "user", undefined, `?id=${id}&commentId=${comment.id}`)).status, 200);
    const moderation = await (await request("POST", "other", { action: "comment", id, text: "Комментарий" })).json();
    assert.equal((await request("DELETE", "headman", undefined, `?id=${id}&commentId=${moderation.comment.id}`)).status, 200);
    const schedule = await (await scheduleRoute.GET(new Request("http://localhost/api/schedule?date=2027-01-10&personId=user"))).json();
    assert.equal(schedule.assessments[0].id, id);
    assert.equal((await request("DELETE", "headman", undefined, `?id=${id}&revision=1`)).status, 409);
    assert.equal((await request("DELETE", "admin", undefined, `?id=${id}&revision=2`)).status, 200);
    assert.equal((await request("GET", "user", undefined, `?id=${id}`)).status, 404);
    assert.equal((await request("POST", "user", { action: "comment", id, text: "После удаления" })).status, 409);
    // A role change in the database takes effect even with a previously elevated session token.
    await db.collection("people").updateOne({ id: "admin" }, { $set: { role: "user" } });
    assert.equal((await request("POST", "admin", input)).status, 403);
    console.log("Assessment validation, roles, concurrency, comments and schedule integration passed");
  } finally {
    await (await connection).close();
    await mongo.stop();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
