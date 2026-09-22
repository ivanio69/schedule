import { NextResponse } from "next/server";
import { getPeople } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const people = (await getPeople(true)).map(person => ({
    id: person.id,
    name: person.name,
  }));
  return NextResponse.json({ people }, { headers: { "Cache-Control": "no-store" } });
}
