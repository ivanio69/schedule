export type ConflictInterval = {
  key: string;
  label: string;
  timeStart: string;
  timeEnd: string;
};

export type ConflictExisting = {
  id: string;
  kind: "lesson" | "individual" | "individualSlot" | "rehearsal";
  title: string;
  timeStart: string;
  timeEnd: string;
};

export type ConflictRecord = {
  key: string;
  personId: string;
  personName: string;
  candidateBlockId?: string;
  candidateLabel: string;
  existing: ConflictExisting;
};

export function buildConflictKey(input: { personId: string; candidateBlockId?: string; candidateStart: string; candidateEnd: string; existing: ConflictExisting }) {
  return [
    input.personId,
    input.candidateBlockId ?? "all",
    input.candidateStart,
    input.candidateEnd,
    input.existing.id,
    input.existing.timeStart,
    input.existing.timeEnd,
  ].map(value => encodeURIComponent(value)).join("|");
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

export function buildConflictMap(intervals: ConflictInterval[]) {
  const result = new Map<string, string[]>();
  const add = (key: string, label: string) => {
    const current = result.get(key) ?? [];
    if (!current.includes(label)) result.set(key, [...current, label]);
  };

  for (let left = 0; left < intervals.length; left += 1) {
    for (let right = left + 1; right < intervals.length; right += 1) {
      const a = intervals[left];
      const b = intervals[right];
      if (a.key === b.key || !timesOverlap(a.timeStart, a.timeEnd, b.timeStart, b.timeEnd)) continue;
      add(a.key, b.label);
      add(b.key, a.label);
    }
  }

  return result;
}
