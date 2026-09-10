import { NextResponse } from "next/server";
import { getIndividualLessons, getPeople } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (!date) {
      return NextResponse.json({ individualLessons: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const [lessons, people] = await Promise.all([
      getIndividualLessons(undefined, date),
      getPeople(),
    ]);
    const names = new Map(people.map((person) => [person.id, person.name]));
    const individualLessons = lessons.map((lesson) => ({
      ...lesson,
      personName: names.get(lesson.personId) ?? "Профиль не найден",
    }));

    return NextResponse.json(
      { individualLessons },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to load individual lessons", error);
    return NextResponse.json(
      { error: "Не удалось загрузить индивидуальные занятия" },
      { status: 500 },
    );
  }
}
