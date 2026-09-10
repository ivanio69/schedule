import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSeminarTopic, deleteSeminarTopic, getSeminarTopics, updateSeminarTopic } from "@/lib/database";
import table from "@/app/table.json";

const SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
const COOKIE = "schedule_admin";
const subjects = [...new Set(table.days.flatMap((day) => day.table.map((item) => item.class)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ru"));
function auth(request: NextRequest) {
  const token = SECRET ? createHmac("sha256", SECRET).update("schedule-admin").digest("hex") : null;
  return Boolean(token && request.cookies.get(COOKIE)?.value === token);
}
function valid(body: Record<string, unknown> | null): body is Record<string, unknown> & { subject: string; title: string; capacity: number } {
  return Boolean(body && typeof body.subject === "string" && subjects.includes(body.subject) && typeof body.title === "string" && body.title.trim() && Number.isInteger(body.capacity) && Number(body.capacity) > 0 && Number(body.capacity) <= 100);
}

export async function GET(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subject = request.nextUrl.searchParams.get("subject") ?? undefined;
  const topics = await getSeminarTopics(subject);
  return NextResponse.json({ subjects, topics }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!valid(body)) return NextResponse.json({ error: "Выбери существующий предмет, тему и количество мест" }, { status: 400 });
  const topic = await createSeminarTopic({ subject: body.subject, title: body.title.trim(), capacity: Number(body.capacity) });
  return NextResponse.json({ topic }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!valid(body) || typeof body.id !== "string") return NextResponse.json({ error: "Проверь данные темы" }, { status: 400 });
  const topic = await updateSeminarTopic(body.id, { subject: body.subject, title: body.title.trim(), capacity: Number(body.capacity) });
  if (!topic) return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
  return NextResponse.json({ topic });
}

export async function DELETE(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указана тема" }, { status: 400 });
  await deleteSeminarTopic(id);
  return NextResponse.json({ ok: true });
}
