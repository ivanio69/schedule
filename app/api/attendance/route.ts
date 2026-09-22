import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople, getSchedule } from "@/lib/database";
import { getOccurrences } from "@/lib/schedule";
import { normalizePersonRole } from "@/lib/people";
import { sendPush } from "@/lib/push";
import { ATTENDANCE_REASON_LABELS, attendanceReportExpired, type AttendanceReason, type AttendanceReport, type AttendanceScope } from "@/lib/attendance";

export const dynamic = "force-dynamic";

const validDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));

function reasonFrom(value: unknown): AttendanceReason | null {
  return value === "sick" || value === "event" || value === "other" ? value : null;
}

function clientClock(request: NextRequest) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  const time = url.searchParams.get("time");
  const fallback = new Date();
  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : fallback.toISOString().slice(0,10),
    time: time && /^\d{2}:\d{2}$/.test(time) ? time : fallback.toISOString().slice(11,16),
  };
}

async function pruneExpiredAttendance(date: string, time: string) {
  const collection = (await getDatabase()).collection<AttendanceReport>("attendance_reports");
  const candidates = await collection.find(
    { dateTo: { $lte: date } },
    { projection: { _id: 0 } }
  ).toArray();
  const ids = candidates.filter(report => attendanceReportExpired(report, date, time)).map(report => report.id);
  if (ids.length) await collection.deleteMany({ id: { $in: ids } });
}

async function currentPerson(request: NextRequest) {
  const profileId = request.cookies.get("schedule_profile")?.value ?? "";
  if (!profileId) return null;
  const people = await getPeople(false);
  return people.find(item => item.id === profileId && item.active) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const person = await currentPerson(request);
    if (!person) return NextResponse.json({ error: "Выбери профиль заново" }, { status: 401 });
    const { date, time } = clientClock(request);
    await pruneExpiredAttendance(date, time);
    const reports = await (await getDatabase()).collection<AttendanceReport>("attendance_reports")
      .find({ personId: person.id, dateTo: { $gte: date } }, { projection: { _id: 0 } })
      .sort({ dateFrom: 1, updatedAt: -1 })
      .toArray();
    return NextResponse.json({ reports }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load attendance reports", error);
    return NextResponse.json({ error: "Не удалось загрузить отметки" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const person = await currentPerson(request);
    if (!person) return NextResponse.json({ error: "Выбери профиль заново" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "Не указана отметка" }, { status: 400 });

    const db = await getDatabase();
    const report = await db.collection<AttendanceReport>("attendance_reports").findOne({ id, personId: person.id });
    if (!report) return NextResponse.json({ error: "Отметка не найдена" }, { status: 404 });
    await db.collection<AttendanceReport>("attendance_reports").deleteOne({ id, personId: person.id });

    const people = await getPeople(false);
    const headmanIds = people
      .filter(item => item.active && normalizePersonRole(item.role, item.adminLink) === "headman")
      .map(item => item.id);
    const detail = report.kind === "late"
      ? "опоздание на «" + (report.lessonTitle ?? "пару") + "»"
      : report.scope === "lesson"
        ? "отсутствие на «" + (report.lessonTitle ?? "паре") + "»"
        : report.scope === "day"
          ? "отсутствие на " + report.dateFrom
          : "отсутствие с " + report.dateFrom + " по " + report.dateTo;
    const delivery = headmanIds.length
      ? await sendPush(headmanIds, null, { title: "Отметка отменена", body: person.name + " отменил(а) " + detail + ".", url: "/headman" })
      : { subscriptions: 0, sent: 0, failed: 0 };

    return NextResponse.json({ ok: true, id, delivery });
  } catch (error) {
    console.error("Failed to delete attendance report", error);
    return NextResponse.json({ error: "Не удалось отменить отметку" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profileId = request.cookies.get("schedule_profile")?.value ?? "";
    const people = await getPeople(false);
    const person = people.find(item => item.id === profileId && item.active);
    if (!person) return NextResponse.json({ error: "Выбери профиль заново" }, { status: 401 });

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || (body.kind !== "late" && body.kind !== "absence")) {
      return NextResponse.json({ error: "Некорректная отметка" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const fallbackNow = new Date();
    const clientDate = validDate(body.clientDate) ? body.clientDate : fallbackNow.toISOString().slice(0,10);
    const clientTime = typeof body.clientTime === "string" && /^\d{2}:\d{2}$/.test(body.clientTime)
      ? body.clientTime
      : fallbackNow.toISOString().slice(11,16);
    const schedule = await getSchedule();
    let report: AttendanceReport;

    if (body.kind === "late") {
      const date = validDate(body.date) ? body.date : "";
      const lessonKey = typeof body.lessonKey === "string" ? body.lessonKey : "";
      const lesson = date ? getOccurrences(schedule, date).find(item => item.occurrence?.key === lessonKey && item.occurrence?.status !== "cancelled") : null;
      if (!date || !lesson) return NextResponse.json({ error: "Не удалось определить пару" }, { status: 400 });

      const key = "late:" + person.id + ":" + date + ":" + lessonKey;
      const existing = await (await getDatabase()).collection<AttendanceReport>("attendance_reports").findOne({ key });
      report = {
        id: existing?.id ?? randomUUID(),
        key,
        personId: person.id,
        personName: person.name,
        kind: "late",
        scope: "lesson",
        dateFrom: date,
        dateTo: date,
        lessonKey,
        lessonTitle: lesson.class,
        lessonStart: lesson.timeStart,
        lessonEnd: lesson.timeEnd,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    } else {
      const scope: AttendanceScope = body.scope === "period" ? "period" : body.scope === "day" ? "day" : "lesson";
      const reason = reasonFrom(body.reason);
      const reasonText = typeof body.reasonText === "string" ? body.reasonText.trim().slice(0, 300) : "";
      if (!reason || (reason === "other" && !reasonText)) {
        return NextResponse.json({ error: "Выбери причину отсутствия" }, { status: 400 });
      }

      let dateFrom = validDate(body.dateFrom) ? body.dateFrom : validDate(body.date) ? body.date : "";
      let dateTo = validDate(body.dateTo) ? body.dateTo : dateFrom;
      let lessonKey: string | undefined;
      let lessonTitle: string | undefined;
      let lessonStart: string | undefined;
      let lessonEnd: string | undefined;

      if (!dateFrom || !dateTo || dateFrom > dateTo) return NextResponse.json({ error: "Проверь даты" }, { status: 400 });
      const maxRange = Math.round((Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000);
      if (maxRange > 90) return NextResponse.json({ error: "Период не может быть длиннее 90 дней" }, { status: 400 });

      if (scope === "lesson") {
        const candidate = typeof body.lessonKey === "string" ? body.lessonKey : "";
        const lesson = getOccurrences(schedule, dateFrom).find(item => item.occurrence?.key === candidate && item.occurrence?.status !== "cancelled");
        if (!lesson) return NextResponse.json({ error: "Не удалось определить пару" }, { status: 400 });
        if (dateFrom < clientDate || (dateFrom === clientDate && lesson.timeEnd <= clientTime)) {
          return NextResponse.json({ error: "Нельзя отметить отсутствие на уже прошедшую пару" }, { status: 400 });
        }
        lessonKey = candidate;
        lessonTitle = lesson.class;
        lessonStart = lesson.timeStart;
        lessonEnd = lesson.timeEnd;
        dateTo = dateFrom;
      }

      const scopeKey = scope === "lesson" ? (lessonKey ?? "") : scope === "day" ? dateFrom : dateFrom + ":" + dateTo;
      const key = "absence:" + person.id + ":" + scope + ":" + scopeKey;
      const existing = await (await getDatabase()).collection<AttendanceReport>("attendance_reports").findOne({ key });
      report = {
        id: existing?.id ?? randomUUID(),
        key,
        personId: person.id,
        personName: person.name,
        kind: "absence",
        scope,
        dateFrom,
        dateTo,
        lessonKey,
        lessonTitle,
        lessonStart,
        lessonEnd,
        reason,
        reasonText: reason === "other" ? reasonText : undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    }

    const db = await getDatabase();
    await db.collection<AttendanceReport>("attendance_reports").replaceOne({ key: report.key }, report, { upsert: true });

    const headmanIds = people
      .filter(item => item.active && normalizePersonRole(item.role, item.adminLink) === "headman")
      .map(item => item.id);
    const reasonLabel = report.reason ? ATTENDANCE_REASON_LABELS[report.reason] + (report.reason === "other" && report.reasonText ? ": " + report.reasonText : "") : "";
    const pushBody = report.kind === "late"
      ? report.personName + " опоздает на «" + (report.lessonTitle ?? "пару") + "» в " + (report.lessonStart ?? "") + "."
      : report.scope === "lesson"
        ? report.personName + " не будет на «" + (report.lessonTitle ?? "паре") + "» " + report.dateFrom + ". " + reasonLabel
        : report.scope === "day"
          ? report.personName + " не будет " + report.dateFrom + ". " + reasonLabel
          : report.personName + " не будет с " + report.dateFrom + " по " + report.dateTo + ". " + reasonLabel;

    const delivery = headmanIds.length
      ? await sendPush(headmanIds, null, { title: report.kind === "late" ? "Кто-то опоздает" : "Отсутствие", body: pushBody.slice(0, 240), url: "/headman" })
      : { subscriptions: 0, sent: 0, failed: 0 };

    return NextResponse.json({ report, delivery });
  } catch (error) {
    console.error("Failed to save attendance report", error);
    return NextResponse.json({ error: "Не удалось отправить отметку старосте" }, { status: 500 });
  }
}
