import { NextResponse } from "next/server";
import { getPeople, getProfileSettings, saveProfileSettings } from "@/lib/database";

export const dynamic = "force-dynamic";

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 128;
}

function cleanPreferences(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v === "1" || v === "2" || v === "both"));
}

function cleanNotes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([k, v]) => k.length < 300 && typeof v === "string" && v.length <= 2000));
}

function cleanNotificationPreferences(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
}

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId");
    if (!validId(personId)) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
    return NextResponse.json(await getProfileSettings(personId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load profile settings", error);
    return NextResponse.json({ error: "Не удалось загрузить настройки" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!validId(body.personId)) return NextResponse.json({ error: "Некорректный профиль" }, { status: 400 });
    const people = await getPeople(true);
    if (!people.some((person) => person.id === body.personId)) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    const existing = await getProfileSettings(body.personId);
    const settings = await saveProfileSettings(body.personId, {
      preferences: body.preferences === undefined ? existing.preferences : cleanPreferences(body.preferences),
      notes: body.notes === undefined ? existing.notes : cleanNotes(body.notes),
      notificationPreferences: body.notificationPreferences === undefined ? existing.notificationPreferences : cleanNotificationPreferences(body.notificationPreferences),
      chinaMode: body.chinaMode === undefined ? existing.chinaMode : body.chinaMode === true,
      firstLessonReminder: [5, 10, 15, 30].includes(Number(body.firstLessonReminder)) ? Number(body.firstLessonReminder) as 5|10|15|30 : existing.firstLessonReminder,
      eventReminders: body.eventReminders && typeof body.eventReminders === "object" && !Array.isArray(body.eventReminders) ? Object.fromEntries(Object.entries(body.eventReminders).filter(([key,value]) => key.length < 400 && [5,10,15,30].includes(Number(value))).map(([key,value]) => [key, Number(value)])) as Record<string,5|10|15|30> : existing.eventReminders,
    });
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to save profile settings", error);
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}
