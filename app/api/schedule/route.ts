import { NextResponse } from "next/server";
import { getRehearsals, getSchedule } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    const schedule = await getSchedule();
    const rehearsals = date ? await getRehearsals(date) : [];
    return NextResponse.json({ schedule, rehearsals }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load schedule", error);
    return NextResponse.json({ error: "Не удалось загрузить расписание" }, { status: 500 });
  }
}
