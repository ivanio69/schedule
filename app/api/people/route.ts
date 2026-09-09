import { NextResponse } from "next/server";
import { getPeople } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ people: await getPeople(true) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load people", error);
    return NextResponse.json({ error: "Не удалось загрузить список группы" }, { status: 500 });
  }
}
