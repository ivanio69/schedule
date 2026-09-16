import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSchedule, saveSchedule } from "@/lib/database";
import type { ScheduleData } from "@/lib/schedule";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? ADMIN_PASSWORD;
const COOKIE_NAME = "schedule_admin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

function sessionToken() {
  return SESSION_SECRET ? createHmac("sha256", SESSION_SECRET).update("schedule-admin").digest("hex") : null;
}

function isAuthorized(request: NextRequest) {
  const token = sessionToken();
  return Boolean(token && request.cookies.get(COOKIE_NAME)?.value === token);
}

function validateSchedule(value: unknown): value is ScheduleData {
  if (!value || typeof value !== "object") return false;
  const schedule = value as Partial<ScheduleData>;
  if (!Array.isArray(schedule.semesterStart) || schedule.semesterStart.length !== 3 || !schedule.semesterStart.every(Number.isInteger)) return false;
  if (!Array.isArray(schedule.days) || schedule.days.length === 0) return false;
  return schedule.days.every((day) => Boolean(day && typeof day === "object" && Array.isArray(day.table)) && day.table.every((lesson) => {
    if (!lesson || typeof lesson !== "object") return false;
    const item = lesson as Record<string, unknown>;
    return typeof item.class === "string" && typeof item.professor === "string" && typeof item.auditorium === "string"
      && typeof item.timeStart === "string" && typeof item.timeEnd === "string"
      && Array.isArray(item.group) && item.group.every(Number.isInteger)
      && Array.isArray(item.weeks) && item.weeks.every(Number.isInteger);
  }));
}

export async function POST(request: NextRequest) {
  if (!ADMIN_PASSWORD || !SESSION_SECRET) return NextResponse.json({ error: "Admin auth is not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (!body || body.password !== ADMIN_PASSWORD) return unauthorized();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, sessionToken()!, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const schedule = await getSchedule();
    return NextResponse.json({ schedule }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load admin schedule", error);
    return NextResponse.json({ error: "Не удалось загрузить расписание из MongoDB" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  const body = await request.json().catch(() => null) as { schedule?: unknown } | null;
  if (!validateSchedule(body?.schedule)) return NextResponse.json({ error: "Невалидное расписание" }, { status: 400 });
  try {
    await saveSchedule(body.schedule);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to save admin schedule", error);
    return NextResponse.json({ error: "Не удалось сохранить расписание в MongoDB" }, { status: 500 });
  }
}
