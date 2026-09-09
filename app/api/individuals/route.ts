import { NextResponse } from "next/server";
import { getIndividualLessons } from "@/lib/database";

export const dynamic = "force-dynamic";

function validId(value: unknown) { return typeof value === "string" && value.length > 0 && value.length < 128; }
function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function validTime(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId") ?? undefined;
    if (personId && !validId(personId)) return NextResponse.json({ error: "Некорректный человек" }, { status: 400 });
    return NextResponse.json({ lessons: await getIndividualLessons(personId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load individual lessons", error);
    return NextResponse.json({ error: "Не удалось загрузить индивидуальные занятия" }, { status: 500 });
  }
}
