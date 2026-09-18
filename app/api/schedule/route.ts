import { NextResponse } from "next/server";
import { filterRehearsalsForPerson, getIndividualLessons, getPeople, getRehearsals, getSchedule } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const personId = url.searchParams.get("personId");
    const schedule = await getSchedule();
    const rehearsals = await filterRehearsalsForPerson(date ? await getRehearsals(date) : [], personId);
    const individualLessons = date ? await getIndividualLessons(undefined, date) : [];
    const people = individualLessons.length ? await getPeople() : [];
    const names = new Map(people.map((person) => [person.id, person.name]));
    const individual = individualLessons.map((lesson) => ({
      ...lesson,
      personName: names.get(lesson.personId) ?? "Профиль не найден",
    }));
    return NextResponse.json({ schedule, rehearsals, individualLessons: individual }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load schedule", error);
    return NextResponse.json({ error: "Не удалось загрузить расписание" }, { status: 500 });
  }
}
