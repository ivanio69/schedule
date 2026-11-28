import { getDatabase } from "./database";
import type { Assessment } from "./assessments";

export async function getAssessments() {
  return (await getDatabase()).collection<Assessment>("assessments")
    .find({}, { projection: { _id: 0 } }).sort({ date: 1, timeStart: 1, subject: 1 }).toArray();
}
