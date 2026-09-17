import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople, getSchedule } from "@/lib/database";
import { getSeminars } from "@/lib/seminar-database";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  try {
    const db = await getDatabase();
    const [people, schedule, seminars, pushPersonIds, individualLessons, individualSlots, rehearsals] = await Promise.all([
      getPeople(),
      getSchedule(),
      getSeminars(),
      db.collection("push_subscriptions").distinct("personId"),
      db.collection("individual_lessons").countDocuments(),
      db.collection("individual_slots").countDocuments(),
      db.collection("rehearsals").countDocuments(),
    ]);
    const activePeople = people.filter(person => person.active).length;
    const pushUsers = new Set(pushPersonIds.filter((id): id is string => typeof id === "string")).size;
    const lessons = schedule.days.reduce((total, day) => total + day.table.length, 0);
    const seminarTopics = seminars.reduce((total, list) => total + list.topics.length, 0);
    const seminarBookings = seminars.reduce((total, list) => total + list.topics.reduce((sum, topic) => sum + topic.studentIds.length, 0), 0);
    return NextResponse.json({
      stats: { people: people.length, activePeople, pushUsers, lessons, seminarLists: seminars.length, seminarTopics, seminarBookings, individualLessons, individualSlots, rehearsals }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin statistics", error);
    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }
}
