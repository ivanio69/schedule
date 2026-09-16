import { NextRequest, NextResponse } from "next/server";
import { changeSeminar, getSeminars } from "@/lib/seminar-database";

export async function GET() {
  return NextResponse.json({ lists: await getSeminars() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.listId !== "string" || !body.listId || typeof body.topicId !== "string" || !body.topicId ||
      typeof body.studentId !== "string" || !body.studentId || !["claim", "release"].includes(body.action))
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const result = await changeSeminar({ listId: body.listId, topicId: body.topicId, studentId: body.studentId, action: body.action });
  return NextResponse.json(result, { status: result.status ?? 200 });
}
