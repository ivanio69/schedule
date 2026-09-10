import { NextRequest, NextResponse } from "next/server";
import { claimSeminarTopic, getSeminarTopics, releaseSeminarTopic } from "@/lib/database";
import table from "@/app/table.json";

const subjects = [...new Set(table.days.flatMap((day) => day.table.map((item) => item.class)))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ru"));

export async function GET(request: NextRequest) {
  const subject = request.nextUrl.searchParams.get("subject") ?? undefined;
  if (subject && !subjects.includes(subject)) return NextResponse.json({ error: "Предмет не найден" }, { status: 400 });
  const topics = await getSeminarTopics(subject);
  return NextResponse.json({ subjects, topics }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { action?: string; topicId?: string; studentId?: string } | null;
  if (!body?.topicId || !body.studentId || !["claim", "release"].includes(body.action ?? "")) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  if (body.action === "claim") {
    const result = await claimSeminarTopic(body.topicId, body.studentId);
    if (!result.ok) {
      const errors = { student: "Студент не найден", missing: "Тема не найдена", already: "Ты уже записан на эту тему", taken: "Все места уже заняты" } as const;
      return NextResponse.json({ error: errors[result.reason] }, { status: result.reason === "taken" ? 409 : 400 });
    }
    return NextResponse.json({ topic: result.topic });
  }
  const topic = await releaseSeminarTopic(body.topicId, body.studentId);
  if (!topic) return NextResponse.json({ error: "Запись не найдена" }, { status: 403 });
  return NextResponse.json({ topic });
}
