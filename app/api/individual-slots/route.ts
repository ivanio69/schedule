import { NextRequest, NextResponse } from "next/server";
import { claimIndividualSlot, getIndividualSlots, releaseIndividualSlot } from "@/lib/database";

function validDate(v: string | null) { return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v)); }

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if ((from && !validDate(from)) || (to && !validDate(to))) return NextResponse.json({ error: "Неверная дата" }, { status: 400 });
  const slots = await getIndividualSlots(from ?? undefined, to ?? undefined);
  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { action?: string; slotId?: string; studentId?: string } | null;
  if (!body?.slotId || !body.studentId || !["claim", "release"].includes(body.action ?? "")) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  if (body.action === "claim") {
    const result = await claimIndividualSlot(body.slotId, body.studentId);
    if (!result.ok) {
      const errors = { student: "Студент не найден", missing: "Слот не найден", taken: "Этот слот уже занят", already: "Ты уже записан на этот слот", overlap: "У тебя уже есть индивидуальное занятие в это время" } as const;
      return NextResponse.json({ error: errors[result.reason] }, { status: result.reason === "taken" ? 409 : 400 });
    }
    return NextResponse.json({ slot: result.slot });
  }
  const slot = await releaseIndividualSlot(body.slotId, body.studentId);
  if (!slot) return NextResponse.json({ error: "Слот не найден или запись принадлежит другому студенту" }, { status: 403 });
  return NextResponse.json({ slot });
}
