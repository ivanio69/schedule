export type IndividualSlot = {
  id: string;
  subject: string;
  professor: string;
  auditorium: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  note: string;
  capacity: number;
  studentIds: string[];
  /** Legacy records stored a single participant. */
  studentId?: string | null;
  createdAt: string;
  updatedAt: string;
};
