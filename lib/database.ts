import { randomUUID } from "node:crypto";
import table from "@/app/table.json";
import clientPromise from "@/lib/mongodb";
import type { Rehearsal, ScheduleData } from "@/lib/schedule";

const DB_NAME = process.env.MONGODB_DB ?? "schedule";
type ScheduleDocument = ScheduleData & { _id: string };

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
  const document: ScheduleDocument = { ...schedule, _id: "current" };
  await collection.replaceOne({ _id: "current" }, document, { upsert: true });
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
