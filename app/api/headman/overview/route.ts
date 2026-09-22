import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import { getRoleSessionPerson } from "@/lib/role-session";
import type { AttendanceReport } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await getRoleSessionPerson(request, ["headman", "admin"]);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const db = await getDatabase();
  const [reports, people] = await Promise.all([
    db.collection<AttendanceReport>("attendance_reports")
      .find({ dateTo: { $gte: cutoffKey } }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .limit(500)
      .toArray(),
    getPeople(true),
  ]);

  return NextResponse.json({ actor, reports, people }, { headers: { "Cache-Control": "no-store" } });
}
