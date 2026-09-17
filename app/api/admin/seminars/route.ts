import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPeople, getSchedule } from "@/lib/database";
import { changeSeminar, createSeminar, deleteSeminar, editSeminar, getSeminars } from "@/lib/seminar-database";
import { parseSeminarEditInput, parseSeminarInput } from "@/lib/seminars";
import { sendPush } from "@/lib/push";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const unauthorized = () => NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
export async function GET(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const [lists, people, schedule] = await Promise.all([getSeminars(), getPeople(true), getSchedule()]);
  const subjects = [...new Set(schedule.days.flatMap(day => day.table.map(item => item.class)))].filter(Boolean).sort((a,b) => a.localeCompare(b,"ru"));
  return NextResponse.json({ lists, people: people.map(({ id, name }) => ({ id, name })), subjects }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const input = parseSeminarInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Укажи предмет, название списка, 1–200 тем и лимит от 1 до 5 человек" }, { status: 400 });
  const list=await createSeminar(input);const people=await getPeople(true);void sendPush(people.map(p=>p.id),"seminars",{title:"Новые семинары",body:`Открыта запись: ${input.subject} — ${input.title}`,url:"/seminars"});return NextResponse.json({list},{status:201});
}
export async function PUT(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const b = await request.json().catch(() => null);
  if (!b || typeof b.listId !== "string" || !b.listId || typeof b.topicId !== "string" || !b.topicId ||
      !Number.isInteger(b.revision) || b.revision < 0 || !Array.isArray(b.studentIds) || b.studentIds.length > 5 ||
      !b.studentIds.every((id: unknown) => typeof id === "string" && id) || new Set(b.studentIds).size !== b.studentIds.length)
    return NextResponse.json({ error: "Проверь участников темы" }, { status: 400 });
  const result = await changeSeminar({ action: "assign", listId: b.listId, topicId: b.topicId, studentIds: b.studentIds, revision: b.revision });
  return NextResponse.json(result, { status: result.status ?? 200 });
}
export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан семинар" }, { status: 400 });
  if (!await deleteSeminar(id)) return NextResponse.json({ error: "Семинар не найден" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const input = parseSeminarEditInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Проверь предмет, название, темы и лимит от 1 до 5 человек" }, { status: 400 });
  const result = await editSeminar(input);
  return NextResponse.json(result, { status: result.status ?? 200 });
}
