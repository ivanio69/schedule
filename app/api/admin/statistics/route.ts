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
    const [people, schedule, seminars, pushDeviceCounts, individualLessons, individualSlots, rehearsals] = await Promise.all([
      getPeople(),
      getSchedule(),
      getSeminars(),
      db.collection("push_subscriptions").aggregate<{ _id: string; devices: number }>([
        { $match: { personId: { $type: "string" } } },
        { $group: { _id: "$personId", devices: { $sum: 1 } } },
      ]).toArray(),
      db.collection("individual_lessons").countDocuments(),
      db.collection("individual_slots").countDocuments(),
      db.collection("rehearsals").countDocuments(),
    ]);
    const activePeople = people.filter(person => person.active).length;
    const devicesByPersonId = new Map(pushDeviceCounts.map(item => [item._id, item.devices]));
    const pushDevicesByPerson = people
      .map(person => ({ personId: person.id, name: person.name, active: person.active, devices: devicesByPersonId.get(person.id) ?? 0 }))
      .sort((a, b) => b.devices - a.devices || a.name.localeCompare(b.name, "ru"));
    const pushUsers = pushDevicesByPerson.filter(person => person.devices > 0).length;
    const pushDevices = pushDevicesByPerson.reduce((total, person) => total + person.devices, 0);
    const lessons = schedule.days.reduce((total, day) => total + day.table.length, 0);
    const seminarTopics = seminars.reduce((total, list) => total + list.topics.length, 0);
    const seminarBookings = seminars.reduce((total, list) => total + list.topics.reduce((sum, topic) => sum + topic.studentIds.length, 0), 0);
    return NextResponse.json({
      stats: { people: people.length, activePeople, pushUsers, pushDevices, pushDevicesByPerson, lessons, seminarLists: seminars.length, seminarTopics, seminarBookings, individualLessons, individualSlots, rehearsals }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin statistics", error);
    return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
  }
}
