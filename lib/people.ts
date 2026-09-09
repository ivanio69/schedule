export type Group = 1 | 2;

export type Person = {
  id: string;
  name: string;
  group: Group;
  active: boolean;
  createdAt: string;
};

export type IndividualLesson = {
  id: string;
  personId: string;
  subject: string;
  professor: string;
  auditorium: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};
