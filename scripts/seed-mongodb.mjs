import { MongoClient } from "mongodb";
import { readFile } from "node:fs/promises";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "schedule";
if (!uri) throw new Error("MONGODB_URI is not configured");

const schedule = JSON.parse(await readFile(new URL("../app/table.json", import.meta.url), "utf8"));
const client = new MongoClient(uri);
await client.connect();
try {
  const collection = client.db(dbName).collection("schedule");
  await collection.replaceOne({ _id: "current" }, { ...schedule, _id: "current" }, { upsert: true });
  console.log(`Schedule seeded into MongoDB database '${dbName}'.`);
} finally {
  await client.close();
}
