import { NextResponse } from "next/server";
import { getRehearsals, getSchedule } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const week = Number(url.searchParams.get("week"));
    const day = Number(url.searchParams.get("day"));
    const schedule = await getSchedule();
    const rehearsals = Number.isInteger(week) && Number.isInteger(day)
      ? await getRehearsals(week, day)
      : [];

    return NextResponse.json({ schedule, rehearsals }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to load schedule", error);
    return NextResponse.json({ error: "Не удалось загрузить расписание" }, { status: 500 });
  }
}
