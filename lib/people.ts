export type Person = {
  id: string;
  name: string;
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
