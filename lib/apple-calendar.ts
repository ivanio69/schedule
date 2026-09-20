import { randomBytes } from "node:crypto";
import { filterRehearsalsForPerson, getDatabase, getIndividualLessons, getIndividualSlots, getPeople, getProfileSettings, getSchedule } from "@/lib/database";
import { getRehearsalAudienceNames, getRehearsalParticipantMode } from "@/lib/rehearsals";
import { getLessonsForWeek, getScheduleDate, getTotalWeeks, type Rehearsal } from "@/lib/schedule";

type CalendarSubscription = {
  personId: string;
  token: string;
  createdAt: string;
  updatedAt: string;
};

type CalendarEvent = {
  uid: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  summary: string;
  description?: string;
  location?: string;
  status?: "CANCELLED";
};

const escapeIcs = (value: string) => value
  .replaceAll("\\", "\\\\")
  .replaceAll("\n", "\\n")
  .replaceAll("\r", "")
  .replaceAll(",", "\\,")
  .replaceAll(";", "\\;");

const localDateTime = (date: string, time: string) =>
  `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;

const uidPart = (value: string) => value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 180);

function eventLines(event: CalendarEvent) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uidPart(event.uid)}@schedule-214r`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
    `DTSTART:${localDateTime(event.date, event.timeStart)}`,
    `DTEND:${localDateTime(event.date, event.timeEnd)}`,
    `SUMMARY:${escapeIcs(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.status) lines.push(`STATUS:${event.status}`);
  lines.push("END:VEVENT");
  return lines;
}

export async function getCalendarSubscription(personId: string) {
  return (await getDatabase()).collection<CalendarSubscription>("calendar_subscriptions").findOne({ personId }, { projection: { _id: 0 } });
}

export async function ensureCalendarSubscription(personId: string, rotate = false) {
  const collection = (await getDatabase()).collection<CalendarSubscription>("calendar_subscriptions");
  const existing = await collection.findOne({ personId });
  if (existing && !rotate) return existing;
  const now = new Date().toISOString();
  const value: CalendarSubscription = {
    personId,
    token: randomBytes(32).toString("base64url"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await collection.replaceOne({ personId }, value, { upsert: true });
  return value;
}

export async function revokeCalendarSubscription(personId: string) {
  return (await getDatabase()).collection<CalendarSubscription>("calendar_subscriptions").deleteOne({ personId });
}

export async function resolveCalendarSubscription(token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  return (await getDatabase()).collection<CalendarSubscription>("calendar_subscriptions").findOne({ token }, { projection: { _id: 0 } });
}

export async function buildPersonalCalendar(personId: string) {
  const people = await getPeople(true);
  const person = people.find(item => item.id === personId);
  if (!person) return null;

  const [schedule, profile, individualLessons, individualSlots, rawRehearsals] = await Promise.all([
    getSchedule(),
    getProfileSettings(personId),
    getIndividualLessons(personId),
    getIndividualSlots(),
    (await getDatabase()).collection<Rehearsal>("rehearsals").find({}).sort({ date: 1, timeStart: 1 }).toArray(),
  ]);
  const rehearsals = await filterRehearsalsForPerson(rawRehearsals, personId);
  const events: CalendarEvent[] = [];

  for (let week = 1; week <= getTotalWeeks(schedule); week += 1) {
    for (let day = 0; day < 6; day += 1) {
      const date = getScheduleDate(schedule, week, day);
      const lessons = getLessonsForWeek(schedule, day, week, profile.preferences, profile.chinaMode === true);
      for (const lesson of lessons) {
        const occurrenceDate = lesson.occurrence?.date ?? date;
        const occurrenceKey = lesson.occurrence?.key ?? lesson.id ?? `${lesson.class}-${lesson.timeStart}`;
        const moved = lesson.occurrence?.status === "moved";
        const cancelled = lesson.occurrence?.status === "cancelled";
        const details = [
          lesson.professor ? `Преподаватель: ${lesson.professor}` : "",
          lesson.group.length ? `Подгруппа: ${lesson.group.join(", ")}` : "",
          moved && lesson.occurrence?.originalDate ? `Перенесено с ${lesson.occurrence.originalDate}` : "",
          lesson.occurrence?.reason ? `Причина: ${lesson.occurrence.reason}` : "",
        ].filter(Boolean).join("\n");
        events.push({
          uid: `lesson-${occurrenceDate}-${occurrenceKey}`,
          date,
          timeStart: lesson.timeStart,
          timeEnd: lesson.timeEnd,
          summary: cancelled ? `Отменено · ${lesson.class}` : lesson.class,
          description: details,
          location: lesson.auditorium ? `ауд. ${lesson.auditorium}` : undefined,
          status: cancelled ? "CANCELLED" : undefined,
        });
      }
    }
  }

  for (const rehearsal of rehearsals) {
    const mode = getRehearsalParticipantMode(rehearsal);
    if (mode === "blocks" && rehearsal.blocks?.length) {
      const blocks = rehearsal.blocks.filter(block => rehearsal.isGlobal || block.participants.includes(person.name));
      blocks.forEach(block => events.push({
        uid: `rehearsal-${rehearsal.id}-block-${block.id}`,
        date: rehearsal.date,
        timeStart: block.timeStart,
        timeEnd: block.timeEnd,
        summary: `${rehearsal.subject} · ${block.title}`,
        description: [
          `Репетиция · ответственный: ${rehearsal.responsible}`,
          block.notes?.trim() ? `Блок: ${block.notes.trim()}` : "",
          rehearsal.notes?.trim() ? `Общее: ${rehearsal.notes.trim()}` : "",
        ].filter(Boolean).join("\n"),
      }));
      continue;
    }

    events.push({
      uid: `rehearsal-${rehearsal.id}`,
      date: rehearsal.date,
      timeStart: rehearsal.timeStart,
      timeEnd: rehearsal.timeEnd,
      summary: rehearsal.subject,
      description: [
        rehearsal.isGlobal ? "Общая репетиция" : "Репетиция",
        `Ответственный: ${rehearsal.responsible}`,
        rehearsal.notes?.trim() ?? "",
        getRehearsalAudienceNames(rehearsal).length ? `Участников: ${getRehearsalAudienceNames(rehearsal).length}` : "",
      ].filter(Boolean).join("\n"),
    });
  }

  individualLessons.forEach(item => events.push({
    uid: `individual-${item.id}`,
    date: item.date,
    timeStart: item.timeStart,
    timeEnd: item.timeEnd,
    summary: `Индивидуальное · ${item.subject}`,
    location: item.auditorium || undefined,
    description: [item.professor ? `Преподаватель: ${item.professor}` : "", item.note?.trim() ?? ""].filter(Boolean).join("\n"),
  }));

  individualSlots
    .filter(item => item.studentIds.includes(personId))
    .forEach(item => events.push({
      uid: `individual-slot-${item.id}`,
      date: item.date,
      timeStart: item.timeStart,
      timeEnd: item.timeEnd,
      summary: `Индивидуальное · ${item.subject}`,
      location: item.auditorium || undefined,
      description: [item.professor ? `Преподаватель: ${item.professor}` : "", item.note?.trim() ?? ""].filter(Boolean).join("\n"),
    }));

  events.sort((a, b) => `${a.date}${a.timeStart}${a.summary}`.localeCompare(`${b.date}${b.timeStart}${b.summary}`));

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//214R Schedule//Personal Calendar//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`214Р · ${person.name}`)}`,
    "X-PUBLISHED-TTL:PT30M",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
