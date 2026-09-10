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
    });
    return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to save profile settings", error);
    return NextResponse.json({ error: "Не удалось сохранить настройки" }, { status: 500 });
  }
}
