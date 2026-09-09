import { MongoClient } from "mongodb";
import { readFile } from "node:fs/promises";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "schedule";
const force = process.argv.includes("--force");

if (!uri) throw new Error("MONGODB_URI is not configured");

const file = new URL("../app/table.json", import.meta.url);
const schedule = JSON.parse(await readFile(file, "utf8"));

if (!Array.isArray(schedule.semesterStart) || !Array.isArray(schedule.days)) {
  throw new Error("app/table.json has an invalid schedule format");
}

const client = new MongoClient(uri);
await client.connect();

try {
  const db = client.db(dbName);
  const collection = db.collection("schedule");
  const existing = await collection.findOne({ _id: "current" });

  if (existing && !force) {
    console.log(`Schedule already exists in '${dbName}'. Nothing changed. Use --force to overwrite it.`);
    process.exitCode = 0;
  } else {
    await collection.replaceOne(
      { _id: "current" },
      { ...schedule, _id: "current", migratedAt: new Date() },
      { upsert: true },
    );
    console.log(`Migrated ${schedule.days.length} days from app/table.json to MongoDB '${dbName}.schedule'.`);
  }
} finally {
  await client.close();
}
