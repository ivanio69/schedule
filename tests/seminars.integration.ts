import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "seminars_test";
  process.env.ADMIN_SESSION_SECRET = "seminars-test-only";
  const { getDatabase } = await import("../lib/database");
  const { default: client } = await import("../lib/mongodb");
  const admin = await import("../app/api/admin/seminars/route");
  const user = await import("../app/api/seminars/route");
  const cookie = "schedule_admin=" + createHmac("sha256", process.env.ADMIN_SESSION_SECRET).update("schedule-admin").digest("hex");
  const req = (body: unknown, authenticated = false) => new NextRequest("http://localhost/api/seminars", {
    method: "POST", headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
  try {
    const db = await getDatabase();
    await db.collection("people").insertMany(["a", "b", "c", "d", "e", "f"].map(id => ({ id, name: `Student ${id}`, active: true })));
    assert.equal((await admin.POST(req({}))).status, 401);
    assert.equal((await admin.PUT(req({}))).status, 401);
    assert.equal((await admin.GET(req({}))).status, 401);
    assert.equal((await admin.DELETE(new NextRequest("http://localhost/api/admin/seminars?id=x", { method: "DELETE" }))).status, 401);
    for (const capacity of [0, 6, 1.5, "2"]) assert.equal((await admin.POST(req({ subject: "История", title: "Семинар", capacity, topics: ["Тема"] }, true))).status, 400);
    assert.equal((await admin.POST(req({ subject: " ", title: "Семинар", capacity: 1, topics: ["Тема"] }, true))).status, 400);
    assert.equal((await admin.PATCH(req({}))).status, 401);
    const created = await (await admin.POST(req({ subject: "История", title: "Редактирование", capacity: 2, topics: ["Занятая", "Свободная"] }, true))).json();
    const seminar = created.list;
    const topicId = seminar.topics[0].id;
    await user.POST(req({ listId: seminar.id, topicId, action: "claim", studentId: "a" }));
    await user.POST(req({ listId: seminar.id, topicId, action: "claim", studentId: "b" }));
    const editInput = { listId: seminar.id, revision: 2, subject: "Культура", title: "Обновлённый", capacity: 3,
      topics: [{ id: topicId, title: "Новое название" }, { title: "Новая тема" }] };
    const patch = (body: unknown) => admin.PATCH(req(body, true));
    for (const topics of [[], [null], [{ title: " " }], [{ id: topicId, title: "A" }, { id: topicId, title: "B" }]])
      assert.equal((await patch({ ...editInput, topics })).status, 400);
    assert.equal((await patch({ ...editInput, listId: "missing" })).status, 404);
    assert.equal((await patch({ ...editInput, topics: [{ id: "foreign", title: "A" }] })).status, 400);
    assert.equal((await patch({ ...editInput, capacity: 1 })).status, 400);
    assert.equal((await patch({ ...editInput, topics: [{ title: "Удалить занятую" }] })).status, 400);
    assert.equal((await patch({ ...editInput, revision: 0 })).status, 409);
    assert.equal((await patch(editInput)).status, 200);
    let edited = await db.collection("seminars").findOne({ id: seminar.id });
    assert.equal(edited!.subject, "Культура");
    assert.equal(edited!.title, "Обновлённый");
    assert.equal(edited!.capacity, 3);
    assert.equal(edited!.topics[0].id, topicId);
    assert.equal(edited!.topics[0].title, "Новое название");
    assert.deepEqual(edited!.topics[0].studentIds, ["a", "b"]);
    assert.deepEqual(edited!.topics[1].studentIds, []);
    assert.notEqual(edited!.topics[1].id, seminar.topics[1].id);
    assert.equal((await patch(editInput)).status, 409);
    const raceInput = { ...editInput, revision: edited!.revision };
    const results = await Promise.all([patch(raceInput), patch({ ...raceInput, title: "Другой администратор" })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    edited = await db.collection("seminars").findOne({ id: seminar.id });
    const race = await Promise.all([
      patch({ ...editInput, revision: edited!.revision }),
      user.POST(req({ listId: seminar.id, topicId, action: "claim", studentId: "c" })),
    ]);
    assert.equal(race[1].status, 200);
    assert.ok([200, 409].includes(race[0].status));
    edited = await db.collection("seminars").findOne({ id: seminar.id });
    assert.deepEqual(edited!.topics[0].studentIds, ["a", "b", "c"]);
    for (const capacity of [1, 2, 3, 4, 5]) {
      const response = await admin.POST(req({ subject: "История", title: `Семинар ${capacity}`, capacity, topics: ["Тема 1", "Тема 2"] }, true));
      assert.equal(response.status, 201);
      const { list } = await response.json();
      const base = { listId: list.id, topicId: list.topics[0].id };
      const claim = (studentId: string) => user.POST(req({ ...base, action: "claim", studentId }));
      assert.equal((await claim("missing")).status, 400);
      const attempts = await Promise.all(["a", "b", "c", "d", "e", "f"].map(claim));
      assert.equal(attempts.filter(r => r.status === 200).length, capacity);
      let stored = await db.collection("seminars").findOne({ id: list.id });
      assert.equal(stored!.topics[0].studentIds.length, capacity);
      const owner = stored!.topics[0].studentIds[0];
      await Promise.all([claim(owner), claim(owner)]);
      stored = await db.collection("seminars").findOne({ id: list.id });
      assert.equal(stored!.topics[0].studentIds.length, capacity);
      assert.equal((await admin.PUT(req({ ...base, studentIds: [], revision: 0 }, true))).status, 409);
      assert.equal((await admin.PUT(req({ ...base, studentIds: ["a", "a"], revision: stored!.revision }, true))).status, 400);
      assert.equal((await admin.PUT(req({ ...base, studentIds: ["missing"], revision: stored!.revision }, true))).status, 400);
      if (capacity === 1) assert.equal((await admin.PUT(req({ ...base, studentIds: ["a", "b"], revision: stored!.revision }, true))).status, 400);
      assert.equal((await admin.PUT(req({ ...base, studentIds: ["c"], revision: stored!.revision }, true))).status, 200);
      const data = await (await user.GET()).json();
      assert.deepEqual(data.lists.find((l: { id: string }) => l.id === list.id).topics[0].studentNames, ["Student c"]);
      await user.POST(req({ ...base, action: "release", studentId: "a" }));
      stored = await db.collection("seminars").findOne({ id: list.id });
      assert.deepEqual(stored!.topics[0].studentIds, ["c"]);
      await user.POST(req({ ...base, action: "release", studentId: "c" }));
      assert.equal((await claim("a")).status, 200);
      // Concurrent duplicate requests for an empty topic must consume one place only.
      const second = { ...base, topicId: list.topics[1].id, action: "claim", studentId: "a" };
      await Promise.all([user.POST(req(second)), user.POST(req(second))]);
      stored = await db.collection("seminars").findOne({ id: list.id });
      assert.deepEqual(stored!.topics[1].studentIds, ["a"]);
      const assigned = ["a", "b", "c", "d", "e"].slice(0, capacity);
      assert.equal((await admin.PUT(req({ ...base, studentIds: assigned, revision: stored!.revision }, true))).status, 200);
      stored = await db.collection("seminars").findOne({ id: list.id });
      assert.deepEqual(stored!.topics[0].studentIds, assigned);
      assert.equal((await admin.PUT(req({ ...base, studentIds: [], revision: stored!.revision }, true))).status, 200);
      const deleteRequest = (id: string) => new NextRequest(`http://localhost/api/admin/seminars?id=${id}`, { method: "DELETE", headers: { Cookie: cookie } });
      assert.equal((await admin.DELETE(deleteRequest(list.id))).status, 200);
      assert.equal(await db.collection("seminars").countDocuments({ id: list.id }), 0);
      assert.equal((await admin.DELETE(deleteRequest(list.id))).status, 404);
    }
    assert.equal((await user.POST(req({ action: "assign", listId: "x", topicId: "y", studentId: "a" }))).status, 400);
    assert.equal((await user.POST(req({ action: "claim", listId: "missing", topicId: "missing", studentId: "a" }))).status, 404);
    console.log("PASS: editing, preserved bookings, topic validation, concurrent edits/claims, creation, deletion, validation, admin authorization, capacities 1–5, concurrent claims, duplicate claims, admin replacement, stale edits, public names, release and reassignment");
  } finally { await (await client).close(); await mongo.stop(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
