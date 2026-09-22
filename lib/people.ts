export type PersonRole = "user" | "headman" | "admin";

export function normalizePersonRole(role: unknown, legacyAdminLink?: unknown): PersonRole {
  if (role === "admin" || role === "headman" || role === "user") return role;
  return legacyAdminLink === true ? "admin" : "user";
}

export type Person = {
  id: string;
  name: string;
  active: boolean;
  role?: PersonRole;
  adminLink?: boolean;
  telegramUsername?: string;
  telegramChatId?: string;
  telegramUserId?: string;
  telegramLinkedAt?: string;
  telegramLinked?: boolean;
  telegramOidcSub?: string;
  telegramOpenIdLinked?: boolean;
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
