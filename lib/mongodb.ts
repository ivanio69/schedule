import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not configured");
}

const globalForMongo = globalThis as typeof globalThis & {
  __scheduleMongoClient?: MongoClient;
  __scheduleMongoPromise?: Promise<MongoClient>;
};

const client = globalForMongo.__scheduleMongoClient ?? new MongoClient(uri);
const clientPromise = globalForMongo.__scheduleMongoPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  globalForMongo.__scheduleMongoClient = client;
  globalForMongo.__scheduleMongoPromise = clientPromise;
}

export default clientPromise;
