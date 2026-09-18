import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getSchedule } from "@/lib/database";
import { getOccurrences, validScheduleDate, type ScheduleChange } from "@/lib/schedule";
import { sendPush } from "@/lib/push";

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret || request.cookies.get("schedule_admin")?.value !== createHmac("sha256", secret).update("schedule-admin").digest("hex")) return reply({ error: "Войдите в админку заново" }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reply({ error: "Недопустимый источник запроса" }, 403);
  const input = await request.json().catch(() => null);
  if (!input || !["move", "cancel"].includes(input.kind) || typeof input.key !== "string" || input.key.length > 5000 || typeof input.date !== "string" || !Number.isInteger(input.revision) || input.revision < 0 || typeof input.reason !== "string" || input.reason.length > 300) return reply({ error: "Проверьте данные изменения" }, 400);
  try {
    const schedule = await getSchedule();
    const previous = schedule.changes?.find(c => c.key === input.key && c.date === input.date);
    if ((previous?.revision ?? 0) !== input.revision) return reply({ error: "Пара уже изменена. Обновите расписание." }, 409);
    const currentDate = previous?.kind === "move" ? previous.targetDate : input.date;
    const lesson = getOccurrences(schedule, currentDate).find(l => l.occurrence?.key === input.key && l.occurrence?.date === input.date);
    if (!lesson) return reply({ error: "Пара уже отменена или изменён шаблон. Обновите расписание." }, 409);
    if (input.kind === "move") {
      const time = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (typeof input.targetDate !== "string" || !validScheduleDate(schedule,input.targetDate) || typeof input.timeStart !== "string" || !time.test(input.timeStart) || typeof input.timeEnd !== "string" || !time.test(input.timeEnd) || input.timeStart >= input.timeEnd || typeof input.auditorium !== "string" || input.auditorium.length > 120) return reply({ error: "Выберите учебный день семестра и корректное время" }, 400);
      if (input.targetDate === currentDate && input.timeStart === lesson.timeStart && input.timeEnd === lesson.timeEnd && input.auditorium.trim() === lesson.auditorium) return reply({ error: "Дата, время и аудитория не изменились" }, 400);
      const conflict = getOccurrences(schedule,input.targetDate).some(l => !(l.occurrence?.key === input.key && l.occurrence?.date === input.date) && l.timeStart < input.timeEnd && l.timeEnd > input.timeStart && (!l.group.length || !lesson.group.length || l.group.some(g => lesson.group.includes(g))));
      if (conflict) return reply({ error: "В это время у подгруппы уже есть пара. Выберите другое время." }, 409);
    }
    const change: ScheduleChange = {
      key: input.key, date: input.date, lesson: previous?.lesson ?? lesson, kind: input.kind,
      targetDate: input.kind === "move" ? input.targetDate : currentDate,
      timeStart: input.kind === "move" ? input.timeStart : lesson.timeStart,
      timeEnd: input.kind === "move" ? input.timeEnd : lesson.timeEnd,
      auditorium: input.kind === "move" ? input.auditorium.trim() : lesson.auditorium,
      reason: input.reason.trim(), revision: input.revision + 1,
    };
    const db = await getDatabase();
    const collection = db.collection<ScheduleChange & { _id: string }>("schedule_changes");
    const id = createHash("sha256").update(input.date + input.key).digest("hex");
    if (previous) {
      const result = await collection.replaceOne({ _id: id, revision: input.revision }, change);
      if (!result.matchedCount) return reply({ error: "Пара уже изменена. Обновите расписание." }, 409);
    } else {
      try { await collection.insertOne({ ...change, _id: id }); }
      catch (error) { if ((error as { code?: number }).code === 11000) return reply({ error: "Изменение уже сохранено. Обновите расписание." }, 409); throw error; }
    }
    // Never report a saved change as failed: retries must not broadcast twice.
    try {
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return reply({ ok: true, warning: "Изменение сохранено. Push-уведомления на сервере не настроены." });
      const ids = await db.collection<{ personId: string }>("push_subscriptions").distinct("personId");
      const format = (date: string) => date.split("-").reverse().join(".");
      const body = input.kind === "cancel"
        ? `${lesson.class}: ${format(currentDate)}, ${lesson.timeStart} — отменена.`
        : `${lesson.class}: ${format(currentDate)} ${lesson.timeStart} → ${format(change.targetDate)} ${change.timeStart}–${change.timeEnd}${change.auditorium ? ", ауд. " + change.auditorium : ""}.`;
      const delivery = await sendPush(ids, "scheduleChanges", { title: input.kind === "cancel" ? "Отмена пары" : "Перенос пары", body: body + (change.reason ? " " + change.reason : ""), url: "/schedule" });
      return reply({ ok: true, delivery });
    } catch (error) {
      console.error("Schedule change saved, notification failed", error);
      return reply({ ok: true, warning: "Изменение сохранено, но отправка уведомлений не удалась. Используйте раздел «Уведомления»." });
    }
  } catch (error) {
    console.error("Schedule change failed", error);
    return reply({ error: "Не удалось сохранить изменение. Обновите расписание перед повторной попыткой." }, 500);
  }
}
