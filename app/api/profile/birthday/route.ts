import { NextRequest, NextResponse } from "next/server";
import { getRoleSessionPerson } from "@/lib/role-session";

export const dynamic = "force-dynamic";

// Unlike /api/auth/*, this route follows the selected DEV deployment.
// The owner always comes from the signed session, never a query parameter.
export async function GET(request: NextRequest) {
  const person = await getRoleSessionPerson(request, ["user", "headman", "admin"]);
  const headers = { "Cache-Control": "private, no-store" };
  if (!person) return NextResponse.json({ person: null }, { status: 401, headers });
  return NextResponse.json({ person: { id: person.id, name: person.name, birthday: person.birthday || null } }, { headers });
}
