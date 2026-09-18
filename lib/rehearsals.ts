import type { Rehearsal, RehearsalBlock, RehearsalParticipantMode } from "@/lib/schedule";

const uniq = (values: string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))];
const sorted = (values: string[]) => [...values].sort((a, b) => a.localeCompare(b, "ru"));
const sameNames = (a: string[], b: string[]) => JSON.stringify(sorted(uniq(a))) === JSON.stringify(sorted(uniq(b)));

export function getRehearsalParticipantMode(rehearsal: Pick<Rehearsal, "participantMode" | "blocks">): RehearsalParticipantMode {
  return rehearsal.participantMode === "blocks" && (rehearsal.blocks?.length ?? 0) > 0 ? "blocks" : "rehearsal";
}

export function getRehearsalAudienceNames(rehearsal: Pick<Rehearsal, "participantMode" | "participants" | "blocks">) {
  if (getRehearsalParticipantMode(rehearsal) === "blocks") {
    return uniq((rehearsal.blocks ?? []).flatMap(block => block.participants));
  }
  return uniq(rehearsal.participants ?? []);
}

export function getRehearsalBounds(blocks: RehearsalBlock[]) {
  const ordered = [...blocks].sort((a, b) => a.timeStart.localeCompare(b.timeStart));
  return {
    timeStart: ordered[0]?.timeStart ?? "18:00",
    timeEnd: ordered.reduce((latest, block) => block.timeEnd > latest ? block.timeEnd : latest, ordered[0]?.timeEnd ?? "20:00"),
  };
}

function sameBlock(a?: RehearsalBlock, b?: RehearsalBlock) {
  if (!a || !b) return false;
  return a.title === b.title
    && a.timeStart === b.timeStart
    && a.timeEnd === b.timeEnd
    && (a.notes ?? "") === (b.notes ?? "")
    && sameNames(a.participants, b.participants);
}

export function getChangedRehearsalAudienceNames(before: Rehearsal, after: Rehearsal) {
  const recipients = new Set<string>();
  const beforeMode = getRehearsalParticipantMode(before);
  const afterMode = getRehearsalParticipantMode(after);
  const beforeAudience = getRehearsalAudienceNames(before);
  const afterAudience = getRehearsalAudienceNames(after);

  const add = (values: string[]) => values.forEach(value => recipients.add(value));

  if (beforeMode !== afterMode) {
    add(beforeAudience);
    add(afterAudience);
    return [...recipients];
  }

  const topLevelChanged = before.subject !== after.subject
    || before.date !== after.date
    || before.responsible !== after.responsible
    || (before.notes ?? "") !== (after.notes ?? "");

  if (beforeMode === "rehearsal") {
    if (topLevelChanged || before.timeStart !== after.timeStart || before.timeEnd !== after.timeEnd || !sameNames(before.participants, after.participants)) {
      add(beforeAudience);
      add(afterAudience);
    }
    return [...recipients];
  }

  if (topLevelChanged) {
    add(beforeAudience);
    add(afterAudience);
  }

  const oldBlocks = new Map((before.blocks ?? []).map(block => [block.id, block]));
  const newBlocks = new Map((after.blocks ?? []).map(block => [block.id, block]));
  const ids = new Set([...oldBlocks.keys(), ...newBlocks.keys()]);
  ids.forEach(id => {
    const oldBlock = oldBlocks.get(id);
    const newBlock = newBlocks.get(id);
    if (!sameBlock(oldBlock, newBlock)) {
      add(oldBlock?.participants ?? []);
      add(newBlock?.participants ?? []);
    }
  });

  return [...recipients];
}

export function normalizeRehearsalParticipants(rehearsal: Pick<Rehearsal, "participantMode" | "participants" | "blocks">) {
  const mode = getRehearsalParticipantMode(rehearsal);
  return {
    participantMode: mode,
    participants: mode === "rehearsal" ? uniq(rehearsal.participants ?? []) : [],
    blocks: (rehearsal.blocks ?? []).map(block => ({ ...block, participants: uniq(block.participants) })),
  };
}
