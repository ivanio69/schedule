import { randomUUID } from "node:crypto";
import table from "@/app/table.json";
import clientPromise from "@/lib/mongodb";
import type { IndividualLesson, Person } from "@/lib/people";
import type { Rehearsal, ScheduleData } from "@/lib/schedule";

const DB_NAME = process.env.MONGODB_DB ?? "schedule";
type ScheduleDocument = ScheduleData & { _id: string };
export type ProfileSettings = {
  personId: string;
  preferences: Record<string, "1" | "2" | "both">;
  notes: Record<string, string>;
  updatedAt: string;
};

function localDateKey() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

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
  await collection.replaceOne({ _id: "current" }, { ...schedule, _id: "current" }, { upsert: true });
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

export async function getIndividualLessons(personId?: string) {
  const db = await getDatabase();
  const today = localDateKey();
  await db.collection<IndividualLesson>("individual_lessons").deleteMany({ date: { $lt: today } });
  return db.collection<IndividualLesson>("individual_lessons").find(personId ? { personId } : {}).sort({ date: 1, timeStart: 1 }).toArray();
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
  return db.collection<Rehearsal>("rehearsals").find({ date }).sort({ timeStart: 1, createdAt: 1 }).toArray();
}

export async function createRehearsal(input: Omit<Rehearsal, "id" | "createdAt">) {
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
