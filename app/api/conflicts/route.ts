import { NextResponse } from "next/server";
import { getIndividualLessons, getIndividualSlots, getPeople, getProfileSettings, getRehearsals, getSchedule } from "@/lib/database";
import { getRehearsalAudienceNames, getRehearsalParticipantMode } from "@/lib/rehearsals";
import { getOccurrences, lessonMatchesChinaMode, type Rehearsal } from "@/lib/schedule";
import { timesOverlap, type ConflictExisting, type ConflictRecord } from "@/lib/conflicts";

export const dynamic = "force-dynamic";

type CandidateBlock = {
  id: string;
  title: string;
  timeStart: string;
  timeEnd: string;
  participants: string[];
};

const validTime = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const unique = (values: string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))];

function existingRehearsalIntervals(rehearsal: Rehearsal, personName: string): ConflictExisting[] {
  if (getRehearsalParticipantMode(rehearsal) === "blocks" && rehearsal.blocks?.length) {
    return rehearsal.blocks
      .filter(block => rehearsal.isGlobal || block.participants.includes(personName))
      .map(block => ({
        id: `rehearsal:${rehearsal.id}:${block.id}`,
        kind: "rehearsal" as const,
        title: `Репетиция «${rehearsal.subject}» · ${block.title}`,
        timeStart: block.timeStart,
        timeEnd: block.timeEnd,
      }));
  }

  const participates = rehearsal.isGlobal
    || rehearsal.creatorName === personName
    || getRehearsalAudienceNames(rehearsal).includes(personName);
  if (!participates) return [];
  return [{
    id: `rehearsal:${rehearsal.id}`,
    kind: "rehearsal",
    title: `Репетиция «${rehearsal.subject}»`,
    timeStart: rehearsal.timeStart,
    timeEnd: rehearsal.timeEnd,
  }];
}

function candidateIntervalsForPerson(
  participantMode: "rehearsal" | "blocks",
  personName: string,
  participants: string[],
  blocks: CandidateBlock[],
  timeStart: string,
  timeEnd: string,
) {
  if (participantMode === "blocks") {
    return blocks
      .filter(block => block.participants.includes(personName))
      .map(block => ({
        blockId: block.id,
        label: block.title.trim() ? `Блок «${block.title.trim()}»` : "Блок репетиции",
        timeStart: block.timeStart,
        timeEnd: block.timeEnd,
      }));
  }
  if (!participants.includes(personName)) return [];
  return [{ blockId: undefined, label: "Репетиция", timeStart, timeEnd }];
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || !validDate(raw.date)) {
      return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }

    const participantMode = raw.participantMode === "blocks" ? "blocks" : "rehearsal";
    const participants = Array.isArray(raw.participants) && raw.participants.every((value: unknown) => typeof value === "string")
      ? unique(raw.participants)
      : [];
    const blocks: CandidateBlock[] = Array.isArray(raw.blocks)
      ? raw.blocks.flatMap((value: unknown) => {
          if (!value || typeof value !== "object") return [];
          const block = value as Partial<CandidateBlock>;
          if (!validTime(block.timeStart) || !validTime(block.timeEnd) || block.timeStart >= block.timeEnd) return [];
          const blockParticipants = Array.isArray(block.participants) && block.participants.every(item => typeof item === "string")
            ? unique(block.participants)
            : [];
          return [{
            id: typeof block.id === "string" && block.id ? block.id.slice(0, 128) : "block",
            title: typeof block.title === "string" ? block.title.slice(0, 120) : "",
            timeStart: block.timeStart,
            timeEnd: block.timeEnd,
            participants: blockParticipants,
          }];
        })
      : [];

    if (!validTime(raw.timeStart) || !validTime(raw.timeEnd) || raw.timeStart >= raw.timeEnd) {
      return NextResponse.json({ error: "Некорректное время" }, { status: 400 });
    }
    if (participantMode === "blocks" && blocks.length === 0) {
      return NextResponse.json({ conflicts: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const requestedNames = participantMode === "blocks"
      ? unique(blocks.flatMap(block => block.participants))
      : participants;
    if (!requestedNames.length) {
      return NextResponse.json({ conflicts: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const allPeople = await getPeople(true);
    const byName = new Map(allPeople.map(person => [person.name, person]));
    const selectedPeople = requestedNames.map(name => byName.get(name)).filter((person): person is NonNullable<typeof person> => Boolean(person));
    if (!selectedPeople.length) {
      return NextResponse.json({ conflicts: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const [schedule, rehearsals, individualLessons, individualSlots, profiles] = await Promise.all([
      getSchedule(),
      getRehearsals(raw.date),
      getIndividualLessons(undefined, raw.date),
      getIndividualSlots(raw.date, raw.date),
      Promise.all(selectedPeople.map(person => getProfileSettings(person.id))),
    ]);
    const profileById = new Map(profiles.map(profile => [profile.personId, profile]));
    const excludeRehearsalId = typeof raw.excludeRehearsalId === "string" ? raw.excludeRehearsalId : "";

    const conflicts: ConflictRecord[] = [];
    for (const person of selectedPeople) {
      const profile = profileById.get(person.id);
      const busy: ConflictExisting[] = [];
      for (const lesson of getOccurrences(schedule, raw.date)) {
        if (lesson.occurrence?.status === "cancelled") continue;
        if (!lessonMatchesChinaMode(lesson, profile?.chinaMode === true)) continue;
        if (profile?.chinaMode !== true) {
          const preference = profile?.preferences?.[lesson.class] ?? "both";
          if (preference !== "both" && lesson.group.length && !lesson.group.includes(Number(preference))) continue;
        }
        busy.push({
          id: `lesson:${lesson.occurrence?.date ?? raw.date}:${lesson.occurrence?.key ?? lesson.id ?? lesson.class}`,
          kind: "lesson",
          title: `Пара «${lesson.class}»`,
          timeStart: lesson.timeStart,
          timeEnd: lesson.timeEnd,
        });
      }

      individualLessons.filter(item => item.personId === person.id).forEach(item => busy.push({
        id: `individual:${item.id}`,
        kind: "individual",
        title: `Индивидуальное «${item.subject}»`,
        timeStart: item.timeStart,
        timeEnd: item.timeEnd,
      }));

      individualSlots.filter(slot => slot.studentIds.includes(person.id)).forEach(slot => busy.push({
        id: `individual-slot:${slot.id}`,
        kind: "individualSlot",
        title: `Индивидуальный слот «${slot.subject}»`,
        timeStart: slot.timeStart,
        timeEnd: slot.timeEnd,
      }));

      rehearsals
        .filter(item => item.id !== excludeRehearsalId)
        .flatMap(item => existingRehearsalIntervals(item, person.name))
        .forEach(item => busy.push(item));

      const candidate = candidateIntervalsForPerson(participantMode, person.name, participants, blocks, raw.timeStart, raw.timeEnd);
      for (const interval of candidate) {
        for (const existing of busy) {
          if (!timesOverlap(interval.timeStart, interval.timeEnd, existing.timeStart, existing.timeEnd)) continue;
          conflicts.push({
            personId: person.id,
            personName: person.name,
            candidateBlockId: interval.blockId,
            candidateLabel: interval.label,
            existing,
          });
          if (conflicts.length >= 250) break;
        }
        if (conflicts.length >= 250) break;
      }
      if (conflicts.length >= 250) break;
    }

    return NextResponse.json({ conflicts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to check schedule conflicts", error);
    return NextResponse.json({ error: "Не удалось проверить конфликты" }, { status: 500 });
  }
}
