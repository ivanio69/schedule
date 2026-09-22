import { NextResponse } from "next/server";
import { getPeople } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const people = (await getPeople(true)).map(({ telegramUsername: _telegramUsername, ...person }) => person;
    return NextResponse.json({ people }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load people", error);
    return NextResponse.json({ error: "Не удалось загрузить список группы" }, { status: 500 });
  }
}
