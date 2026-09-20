import { NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 128;
}
function validKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 240 && !value.includes(".") && !value.includes("$");
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.personId) || !validKey(body.key) || typeof body.value !== "string" || body.value.length > 2000) {
      return NextResponse.json({ error: "Некорректная заметка" }, { status: 400 });
    }
    const people = await getPeople(true);
    if (!people.some(person => person.id === body.personId)) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    const db = await getDatabase();
    const value = body.value.trim();
    const path = `notes.${body.key}`;
    if (value) {
      await db.collection("profile_settings").updateOne(
        { personId: body.personId },
        { $set: { [path]: value, updatedAt: new Date().toISOString() }, $setOnInsert: { personId: body.personId, preferences: {} } },
        { upsert: true },
      );
    } else {
      await db.collection("profile_settings").updateOne(
        { personId: body.personId },
        { $unset: { [path]: "" }, $set: { updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
    }
    return NextResponse.json({ ok: true, value });
  } catch (error) {
    console.error("Failed to save personal event note", error);
    return NextResponse.json({ error: "Не удалось сохранить заметку" }, { status: 500 });
  }
}
