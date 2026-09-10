import { randomUUID } from "node:crypto";
import table from "@/app/table.json";
import clientPromise from "@/lib/mongodb";
import type { IndividualLesson, Person } from "@/lib/people";
import type { SeminarTopic } from "@/lib/seminars";
import type { Rehearsal, ScheduleData } from "@/lib/schedule";

const DB_NAME = process.env.MONGODB_DB ?? "schedule";
type ScheduleDocument = ScheduleData & { _id: string };
export type ProfileSettings = {
  personId: string;
  preferences: Record<string, "1" | "2" | "both">;
  notes: Record<string, string>;
  updatedAt: string;
};

export async function getDatabase() {
  const mongo = await clientPromise;
  return mongo.db(DB_NAME);
}

export async function getSchedule(): Promise<ScheduleData> {
  const db = await getDatabase();
  const collection = db.collection<ScheduleDocument>("schedule");
  const stored = await collection.findOne({ _id: "current" });
  if (stored) {
    const { _id: _ignored, ...schedule } = stored;
    return schedule;
  }
  await collection.insertOne({ ...table, _id: "current" } as ScheduleDocument);
  return table;
}

export async function saveSchedule(schedule: ScheduleData) {
  const db = await getDatabase();
  const collection = db.collection<ScheduleDocument>("schedule");
  await collection.replaceOne({ _id: "current" }, schedule, { upsert: true });
}

export async function getPeople(activeOnly = false) {
  const db = await getDatabase();
  const query = activeOnly ? { active: true } : {};
  return db.collection<Person>("people").find(query).sort({ name: 1 }).toArray();
}

export async function savePerson(input: Omit<Person, "id" | "createdAt">, id?: string) {
  const db = await getDatabase();
  const collection = db.collection<Person>("people");
  const person: Person = { ...input, id: id ?? randomUUID(), createdAt: new Date().toISOString() };
  await collection.replaceOne({ id: person.id }, person, { upsert: true });
  return person;
}

export async function deletePerson(id: string) {
  const db = await getDatabase();
  return (await db.collection<Person>("people").deleteOne({ id })).deletedCount === 1;
}

export async function getIndividualLessons(personId?: string, date?: string) {
  const db = await getDatabase();
  const query: { personId?: string; date?: string } = {};
  if (personId) query.personId = personId;
  if (date) query.date = date;
  return db.collection<IndividualLesson>("individual_lessons").find(query).sort({ date: 1, timeStart: 1 }).toArray();
}

export async function saveIndividualLesson(input: Omit<IndividualLesson, "id" | "createdAt" | "updatedAt">, id?: string) {
  const db = await getDatabase();
  const collection = db.collection<IndividualLesson>("individual_lessons");
  const existing = id ? await collection.findOne({ id }) : null;
  const now = new Date().toISOString();
  const lesson: IndividualLesson = { ...input, id: id ?? randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now };
  await collection.replaceOne({ id: lesson.id }, lesson, { upsert: true });
  return lesson;
}

export async function deleteIndividualLesson(id: string) {
  const db = await getDatabase();
  return (await db.collection<IndividualLesson>("individual_lessons").deleteOne({ id })).deletedCount === 1;
}

export async function getRehearsals(date: string) {
  const db = await getDatabase();
  const rehearsals = await db.collection<Rehearsal>("rehearsals").find({ date }).sort({ timeStart: 1, createdAt: 1 }).toArray();
  const people = await getPeople();
  const names = new Map(people.map((person) => [person.id, person.name]));
  return rehearsals.map((rehearsal) => ({ ...rehearsal, creatorName: rehearsal.creatorName ?? names.get(rehearsal.creatorId) }));
}

export async function createRehearsal(input: Omit<Rehearsal, "id" | "createdAt" | "creatorName">) {
  const rehearsal: Rehearsal = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
  const db = await getDatabase();
  await db.collection<Rehearsal>("rehearsals").insertOne(rehearsal);
  return rehearsal;
}

export async function deleteRehearsal(id: string, creatorId: string) {
  const db = await getDatabase();
  const result = await db.collection<Rehearsal>("rehearsals").deleteOne({ id, creatorId });
  return result.deletedCount === 1;
}

export async function updateRehearsal(id: string, creatorId: string, input: Omit<Rehearsal, "id" | "createdAt" | "creatorId" | "creatorName">) {
  const db = await getDatabase();
  const result = await db.collection<Rehearsal>("rehearsals").findOneAndUpdate(
    { id, creatorId },
    { $set: input },
    { returnDocument: "after" },
  );
  return result;
}

export async function getProfileSettings(personId: string): Promise<ProfileSettings> {
  const db = await getDatabase();
  const stored = await db.collection<ProfileSettings>("profile_settings").findOne({ personId });
  return stored ?? { personId, preferences: {}, notes: {}, updatedAt: new Date(0).toISOString() };
}

export async function saveProfileSettings(personId: string, input: Pick<ProfileSettings, "preferences" | "notes">) {
  const db = await getDatabase();
  const settings: ProfileSettings = { personId, preferences: input.preferences, notes: input.notes, updatedAt: new Date().toISOString() };
  await db.collection<ProfileSettings>("profile_settings").replaceOne({ personId }, settings, { upsert: true });
  return settings;
}

export async function getSeminarTopics(subject?: string) {
  const db = await getDatabase();
  const topics = await db.collection<SeminarTopic>("seminar_topics").find(subject ? { subject } : {}).sort({ subject: 1, title: 1 }).toArray();
  const people = await getPeople();
  const names = new Map(people.map((person) => [person.id, person.name]));
  return topics.map((topic) => {
    const studentIds = topic.studentIds ?? [];
    return { ...topic, capacity: topic.capacity ?? 1, studentIds, studentNames: studentIds.map((id) => names.get(id) ?? "Неизвестный студент") };
  });
}

export async function createSeminarTopic(input: { subject: string; title: string; capacity: number }) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const topic: SeminarTopic = { id: randomUUID(), subject: input.subject.trim(), title: input.title.trim(), capacity: Math.max(1, input.capacity), studentIds: [], createdAt: now, updatedAt: now };
  await db.collection<SeminarTopic>("seminar_topics").insertOne(topic);
  return topic;
}

export async function updateSeminarTopic(id: string, input: { subject: string; title: string; capacity: number }) {
  const db = await getDatabase();
  const existing = await db.collection<SeminarTopic>("seminar_topics").findOne({ id });
  if (!existing) return null;
  const topic: SeminarTopic = { ...existing, subject: input.subject.trim(), title: input.title.trim(), capacity: Math.max(1, input.capacity), studentIds: existing.studentIds ?? [], updatedAt: new Date().toISOString() };
  await db.collection<SeminarTopic>("seminar_topics").replaceOne({ id }, topic);
  return topic;
}

export async function deleteSeminarTopic(id: string) {
  const db = await getDatabase();
  return (await db.collection<SeminarTopic>("seminar_topics").deleteOne({ id })).deletedCount === 1;
}

export async function claimSeminarTopic(id: string, studentId: string) {
  const db = await getDatabase();
  const person = await db.collection<Person>("people").findOne({ id: studentId, active: true });
  if (!person) return { ok: false as const, reason: "student" as const };
  const topic = await db.collection<SeminarTopic>("seminar_topics").findOne({ id });
  if (!topic) return { ok: false as const, reason: "missing" as const };
  const ids = topic.studentIds ?? [];
  if (ids.includes(studentId)) return { ok: false as const, reason: "already" as const };
  if (ids.length >= (topic.capacity ?? 1)) return { ok: false as const, reason: "taken" as const };
  const result = await db.collection<SeminarTopic>("seminar_topics").findOneAndUpdate(
    { id, $expr: { $lt: [{ $size: { $ifNull: ["$studentIds", []] } }, topic.capacity ?? 1] } },
    { $push: { studentIds: studentId }, $set: { updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  if (!result) return { ok: false as const, reason: "taken" as const };
  return { ok: true as const, topic: result };
}

export async function releaseSeminarTopic(id: string, studentId: string) {
  const db = await getDatabase();
  return db.collection<SeminarTopic>("seminar_topics").findOneAndUpdate(
    { id, studentIds: studentId },
    { $pull: { studentIds: studentId }, $set: { updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );
}
