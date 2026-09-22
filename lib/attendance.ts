export type AttendanceKind = "late" | "absence";
export type AttendanceScope = "lesson" | "day" | "period";
export type AttendanceReason = "sick" | "event" | "other";

export type AttendanceReport = {
  id: string;
  key: string;
  personId: string;
  personName: string;
  kind: AttendanceKind;
  scope: AttendanceScope;
  dateFrom: string;
  dateTo: string;
  lessonKey?: string;
  lessonTitle?: string;
  lessonStart?: string;
  lessonEnd?: string;
  reason?: AttendanceReason;
  reasonText?: string;
  createdAt: string;
  updatedAt: string;
};

export const ATTENDANCE_REASON_LABELS: Record<AttendanceReason, string> = {
  sick: "Больничный",
  event: "Мероприятие",
  other: "Другое",
};

export function attendanceReasonText(report: Pick<AttendanceReport, "reason" | "reasonText">) {
  if (!report.reason) return "";
  const label = ATTENDANCE_REASON_LABELS[report.reason];
  return report.reason === "other" && report.reasonText ? label + ": " + report.reasonText : label;
}

export function attendanceReportExpired(report: AttendanceReport, date: string, time: string) {
  if (report.kind !== "absence") return false;
  if (report.dateTo < date) return true;
  if (report.dateTo > date) return false;
  if (report.scope !== "lesson") return false;
  if (!report.lessonEnd) return false;
  return report.lessonEnd <= time;
}
