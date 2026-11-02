import type { Rehearsal } from "./schedule";
import { getRehearsalParticipantMode, isRehearsalParticipant } from "./rehearsals";

export const timeMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} ч${rest ? ` ${rest} мин` : ""}` : `${rest} мин`;
}

type Interval = { start: string; end: string; status?: "cancelled" | "moved" };

/** Moved occurrences are on their destination date; the schedule resolver removes the source. */
export function getDayOccupancy(events: Interval[]) {
  const ranges: { start: number; end: number }[] = [];
  for (const event of [...events].filter(event => event.status !== "cancelled").sort((a, b) => a.start.localeCompare(b.start))) {
    const start = timeMinutes(event.start), end = timeMinutes(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const previous = ranges.at(-1);
    if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
    else ranges.push({ start, end });
  }
  return {
    ranges,
    occupiedMinutes: ranges.reduce((sum, range) => sum + range.end - range.start, 0),
    gaps: ranges.slice(1).map((range, index) => ({ start: ranges[index].end, end: range.start })),
  };
}

/** Rehearsal-level invitations apply to every block; block-level invitations only to named blocks. */
export function getDashboardRehearsalSegments(rehearsal: Rehearsal, personId?: string | null, personName?: string | null) {
  if (!isRehearsalParticipant(rehearsal, personId, personName)) return [];
  if (!rehearsal.blocks?.length) return [{ title: rehearsal.subject, timeStart: rehearsal.timeStart, timeEnd: rehearsal.timeEnd, notes: rehearsal.notes, blockId: undefined }];
  return rehearsal.blocks
    .filter(block => rehearsal.isGlobal || rehearsal.creatorId === personId || getRehearsalParticipantMode(rehearsal) === "rehearsal" || Boolean(personName && block.participants.includes(personName)))
    .map(block => ({ title: block.title, timeStart: block.timeStart, timeEnd: block.timeEnd, notes: block.notes || rehearsal.notes, blockId: block.id }));
}
