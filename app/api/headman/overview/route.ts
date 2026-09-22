import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople, getSchedule } from "@/lib/database";
import { getRoleSessionPerson } from "@/lib/role-session";
import { getOccurrences } from "@/lib/schedule";
import type { AttendanceReport } from "@/lib/attendance";

export const dynamic = "force-dynamic";

const validDate = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));

export async function GET(request: NextRequest) {
  const actor = await getRoleSessionPerson(request, ["headman", "admin"]);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const requestedDate = new URL(request.url).searchParams.get("date");
  const date = validDate(requestedDate) ? requestedDate! : new Date().toISOString().slice(0, 10);
  const cutoff = new Date(date + "T00:00:00Z");
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const db = await getDatabase();
  const [reports, people, schedule] = await Promise.all([
    db.collection<AttendanceReport>("attendance_reports")
      .find({ dateTo: { $gte: cutoffKey } }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray(),
    getPeople(true),
    getSchedule(),
  ]);

  const lessons = getOccurrences(schedule, date)
    .filter(item => item.occurrence?.status !== "cancelled")
    .map(item => ({
      key: item.occurrence?.key ?? item.id ?? [item.class,item.timeStart,item.timeEnd].join("|"),
      title: item.class,
      start: item.timeStart,
      end: item.timeEnd,
      auditorium: item.auditorium,
      status: item.occurrence?.status ?? null,
    }))
    .sort((a,b)=>a.start.localeCompare(b.start));

  return NextResponse.json({ actor, reports, people, date, lessons }, { headers: { "Cache-Control": "no-store" } });
}
