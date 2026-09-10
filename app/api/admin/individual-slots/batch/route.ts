import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createIndividualSlot } from "@/lib/database";

const SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
const COOKIE = "schedule_admin";
function auth(request: NextRequest) { const token = SECRET ? createHmac("sha256", SECRET).update("schedule-admin").digest("hex") : null; return Boolean(token && request.cookies.get(COOKIE)?.value === token); }
function okTime(v: unknown): v is string { return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v); }
function okDate(v: unknown): v is string { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)); }
function minutes(value: string) { const [h, m] = value.split(":").map(Number); return h * 60 + m; }
function time(value: number) { return `${String(Math.floor(value / 60) % 24).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }

export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const professor = typeof body?.professor === "string" ? body.professor.trim() : "";
  const auditorium = typeof body?.auditorium === "string" ? body.auditorium.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const date = body?.date;
  const start = body?.timeStart;
  const end = body?.timeEnd;
  const interval = Number(body?.intervalMinutes);
  const count = Number(body?.count);
  if (!subject || !professor || !okDate(date) || !okTime(start) || !okTime(end) || !Number.isInteger(interval) || interval < 1 || !Number.isInteger(count) || count < 1 || count > 100 || minutes(start) >= minutes(end)) return NextResponse.json({ error: "Проверь предмет, дату, время, количество и интервал" }, { status: 400 });
  const duration = minutes(end) - minutes(start);
  const slots = [];
  for (let i = 0; i < count; i++) {
    const startMinutes = minutes(start) + i * interval;
    const endMinutes = startMinutes + duration;
    if (endMinutes > 24 * 60) return NextResponse.json({ error: `Серия не помещается в один день: занятие №${i + 1} выходит за 24:00` }, { status: 400 });
    slots.push(await createIndividualSlot({ subject, professor, auditorium, date, timeStart: time(startMinutes), timeEnd: time(endMinutes), note }));
  }
  return NextResponse.json({ slots }, { status: 201 });
}
