import { getIndividualLessons, getPeople, getProfileSettings, getRehearsals, getSchedule, type ProfileSettings } from "@/lib/database";
import { normalizeAppearance } from "@/lib/appearance";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import { getOccurrences, lessonMatchesChinaMode, type GroupPreference, type ScheduleData } from "@/lib/schedule";

export type WidgetEventKind = "lesson" | "individual" | "rehearsal";
export type WidgetEventStatus = "normal" | "cancelled" | "moved";

export type WidgetEvent = {
  id: string;
  kind: WidgetEventKind;
  status: WidgetEventStatus;
  title: string;
  subtitle: string;
  start: string;
  end: string;
};

function visibleLessons(schedule: ScheduleData, date: string, settings: ProfileSettings) {
  return getOccurrences(schedule, date).filter((lesson) => {
    if (!lessonMatchesChinaMode(lesson, settings.chinaMode === true)) return false;
    if (settings.chinaMode === true) return true;
    const preference = (settings.preferences?.[lesson.class] ?? "both") as GroupPreference;
    return preference === "both" || !lesson.group.length || lesson.group.includes(Number(preference));
  });
}

function joinSubtitle(...parts: Array<string | undefined | null>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" · ");
}

function lessonEvent(lesson: ReturnType<typeof getOccurrences>[number], date: string): WidgetEvent {
  const status: WidgetEventStatus = lesson.occurrence?.status ?? "normal";
  return {
    id: `lesson:${date}:${lesson.occurrence?.key ?? lesson.id ?? `${lesson.class}:${lesson.timeStart}`}`,
    kind: "lesson",
    status,
    title: lesson.class,
    subtitle: joinSubtitle(lesson.professor, lesson.auditorium),
    start: lesson.timeStart,
    end: lesson.timeEnd,
  };
}

export async function buildWidgetFeed(personId: string, date: string) {
  const [people, schedule, settings, individuals, rehearsals] = await Promise.all([
    getPeople(true),
    getSchedule(),
    getProfileSettings(personId),
    getIndividualLessons(personId, date),
    getRehearsals(date),
  ]);
  const person = people.find((item) => item.id === personId);
  if (!person) return null;

  const lessons = visibleLessons(schedule, date, settings).map((lesson) => lessonEvent(lesson, date));
  const personalIndividuals: WidgetEvent[] = individuals.map((item) => ({
    id: `individual:${item.id}`,
    kind: "individual",
    status: "normal",
    title: item.subject || "Индивидуальное",
    subtitle: joinSubtitle(item.professor, item.auditorium),
    start: item.timeStart,
    end: item.timeEnd,
  }));
  const personalRehearsals: WidgetEvent[] = rehearsals
    .filter((item) => item.isGlobal || item.creatorId === person.id || getRehearsalAudienceNames(item).includes(person.name))
    .map((item) => ({
      id: `rehearsal:${item.id}`,
      kind: "rehearsal",
      status: "normal",
      title: item.subject || "Репетиция",
      subtitle: joinSubtitle(item.responsible),
      start: item.timeStart,
      end: item.timeEnd,
    }));

  const events = [...lessons, ...personalIndividuals, ...personalRehearsals]
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "ru"));

  const activeEvents = events.filter((item) => item.status !== "cancelled");
  const freeAt = activeEvents.reduce<string | null>(
    (latest, item) => !latest || item.end > latest ? item.end : latest,
    null,
  );

  return {
    profile: { id: person.id, name: person.name },
    date,
    events,
    freeAt,
    appearance: normalizeAppearance(settings.appearance),
    generatedAt: new Date().toISOString(),
  };
}
