import { randomUUID } from "node:crypto";
import table from "@/app/table.json";
import clientPromise from "@/lib/mongodb";
import type { IndividualLesson, Person } from "@/lib/people";
import type { IndividualSlot } from "@/lib/individual-slots";
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

export async function getIndividualSlots(from?: string, to?: string) {
  const db = await getDatabase();
  const query: { date?: { $gte?: string; $lte?: string } } = {};
  if (from || to) query.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  return db.collection<IndividualSlot>("individual_slots").find(query).sort({ date: 1, timeStart: 1 }).toArray();
}

export async function createIndividualSlot(input: Omit<IndividualSlot, "id" | "studentId" | "createdAt" | "updatedAt">) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const slot: IndividualSlot = { ...input, id: randomUUID(), studentId: null, createdAt: now, updatedAt: now };
  await db.collection<IndividualSlot>("individual_slots").insertOne(slot);
  return slot;
}

export async function updateIndividualSlot(id: string, input: Omit<IndividualSlot, "id" | "createdAt" | "updatedAt" | "studentId">) {
  const db = await getDatabase();
  const existing = await db.collection<IndividualSlot>("individual_slots").findOne({ id });
  if (!existing) return null;
  const slot: IndividualSlot = { ...existing, ...input, id, studentId: existing.studentId, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
  await db.collection<IndividualSlot>("individual_slots").replaceOne({ id }, slot);
  return slot;
}

export async function deleteIndividualSlot(id: string) {
  const db = await getDatabase();
  return (await db.collection<IndividualSlot>("individual_slots").deleteOne({ id })).deletedCount === 1;
}

export async function claimIndividualSlot(id: string, studentId: string) {
  const db = await getDatabase();
  const person = await db.collection<Person>("people").findOne({ id: studentId, active: true });
  if (!person) return { ok: false as const, reason: "student" as const };
  const existing = await db.collection<IndividualSlot>("individual_slots").findOne({ id });
  if (!existing) return { ok: false as const, reason: "missing" as const };
  if (existing.studentId) return { ok: false as const, reason: "taken" as const };
  const overlap = await db.collection<IndividualSlot>("individual_slots").findOne({ studentId, date: existing.date, timeStart: { $lt: existing.timeEnd }, timeEnd: { $gt: existing.timeStart } });
  if (overlap) return { ok: false as const, reason: "overlap" as const };
  const result = await db.collection<IndividualSlot>("individual_slots").findOneAndUpdate({ id, studentId: null }, { $set: { studentId, updatedAt: new Date().toISOString() } }, { returnDocument: "after" });
  if (!result) return { ok: false as const, reason: "taken" as const };
  return { ok: true as const, slot: result };
}

export async function releaseIndividualSlot(id: string, studentId: string) {
  const db = await getDatabase();
  const result = await db.collection<IndividualSlot>("individual_slots").findOneAndUpdate({ id, studentId }, { $set: { studentId: null, updatedAt: new Date().toISOString() } }, { returnDocument: "after" });
  return result;
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
  const result = await db.collection<Rehearsal>("rehearsals").findOneAndUpdate({ id, creatorId }, { $set: input }, { returnDocument: "after" });
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