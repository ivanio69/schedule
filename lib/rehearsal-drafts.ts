import type { RehearsalBlock, RehearsalParticipantMode } from "@/lib/schedule";

export type RehearsalDraftKind = "simple" | "scheduled";

export type RehearsalDraft = {
  id: string;
  ownerId: string;
  kind: RehearsalDraftKind;
  subject: string;
  responsible: string;
  date: string;
  notes: string;
  tags: string[];
  timeStart: string;
  timeEnd: string;
  participantMode: RehearsalParticipantMode;
  participants: string[];
  blocks: RehearsalBlock[];
  createdAt: string;
  updatedAt: string;
};
