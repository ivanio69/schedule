import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRehearsal, deleteRehearsal, getPeople, getRehearsals } from "@/lib/database";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const unauthorized = () => NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !validDate(date)) return NextResponse.json({ error: "Укажи дату" }, { status: 400 });
  return NextResponse.json({ rehearsals: await getRehearsals(date) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body.subject !== "string" || !body.subject.trim() || body.subject.trim().length > 120 || !validDate(body.date) || !validTime(body.timeStart) || !validTime(body.timeEnd) || body.timeStart >= body.timeEnd || typeof body.responsible !== "string" || !body.responsible.trim() || body.responsible.trim().length > 120)
    return NextResponse.json({ error: "Проверь данные репетиции" }, { status: 400 });
  const people = await getPeople(true);
  const rehearsal = await createRehearsal({
    creatorId: "admin",
    subject: body.subject.trim(),
    date: body.date,
    timeStart: body.timeStart,
    timeEnd: body.timeEnd,
    responsible: body.responsible.trim(),
    participants: people.map(person => person.name),
    isGlobal: true,
  });
  return NextResponse.json({ rehearsal: { ...rehearsal, creatorName: "Администратор" } }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указана репетиция" }, { status: 400 });
  return await deleteRehearsal(id, "admin") ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Общая репетиция не найдена" }, { status: 404 });
}
