import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createIndividualSlot } from "@/lib/database";

const SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
const COOKIE = "schedule_admin";

function auth(request: NextRequest) {
  const token = SECRET ? createHmac("sha256", SECRET).update("schedule-admin").digest("hex") : null;
  return Boolean(token && request.cookies.get(COOKIE)?.value === token);
}

function okTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function okDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function minutes(v: string) {
  const [hour, minute] = v.split(":").map(Number);
  return hour * 60 + minute;
}

function time(v: number) {
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const professor = typeof body?.professor === "string" ? body.professor.trim() : "";
  const auditorium = typeof body?.auditorium === "string" ? body.auditorium.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const date = body?.date;
  const start = body?.timeStart;
  const duration = Number(body?.durationMinutes);
  const interval = Number(body?.intervalMinutes);
  const count = Number(body?.count);
  const capacity = Number(body?.capacity);

  if (
    !subject ||
    !professor ||
    !okDate(date) ||
    !okTime(start) ||
    !Number.isInteger(duration) || duration < 1 || duration > 1440 ||
    !Number.isInteger(interval) || interval < 1 || interval > 1440 ||
    !Number.isInteger(count) || count < 1 || count > 100 ||
    !Number.isInteger(capacity) || capacity < 1 || capacity > 100
  ) {
    return NextResponse.json({ error: "Проверь предмет, дату, время, длительность, количество и вместимость" }, { status: 400 });
  }

  const firstStart = minutes(start);
  if (firstStart + duration > 1440) {
    return NextResponse.json({ error: "Занятие выходит за пределы суток" }, { status: 400 });
  }

  if (count > 1 && interval < duration) {
    return NextResponse.json({ error: "Интервал между началами не может быть меньше длительности занятия" }, { status: 400 });
  }

  const slots = [];
  for (let i = 0; i < count; i++) {
    const startMinutes = firstStart + i * interval;
    const endMinutes = startMinutes + duration;

    if (startMinutes >= 1440 || endMinutes > 1440) {
      return NextResponse.json({ error: `Серия не помещается в один день: занятие №${i + 1} выходит за 24:00` }, { status: 400 });
    }

    slots.push(await createIndividualSlot({
      subject,
      professor,
      auditorium,
      date,
      timeStart: time(startMinutes),
      timeEnd: time(endMinutes),
      note,
      capacity,
    }));
  }

  return NextResponse.json({ slots }, { status: 201 });
}
