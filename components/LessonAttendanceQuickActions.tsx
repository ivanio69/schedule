"use client";

import { useEffect, useState } from "react";
import type { AttendanceReason, AttendanceReport } from "@/lib/attendance";

type Props = { date: string; lessonKey?: string; start: string; end: string; cancelled?: boolean };
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function LessonAttendanceQuickActions({ date, lessonKey, start, end, cancelled }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [reason, setReason] = useState<AttendanceReason>("sick");
  const [reasonText, setReasonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let mounted = true;
    const current = new Date();
    const query = new URLSearchParams({ date: dateKey(current), time: `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}` });
    void fetch(`/api/attendance?${query}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (mounted) setReports(data?.reports ?? []); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [date, lessonKey]);
  if (!now || !lessonKey || cancelled) return null;
  const today = dateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const upcoming = date > today || (date === today && end > currentTime);
  const canLate = date === today && end > currentTime;
  const existing = reports.find(item =>
    item.dateFrom <= date && item.dateTo >= date &&
    (item.scope !== "lesson" || item.lessonKey === lessonKey)
  );
  if (!upcoming && !existing) return null;
  async function send(kind: "late" | "absence") {
    if (busy || !lessonKey) return;
    setBusy(true); setError("");
    try {
      const current = new Date();
      const clientDate = dateKey(current);
      const clientTime = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
      const payload = kind === "late"
        ? { kind, date, lessonKey, clientDate, clientTime }
        : { kind, scope: "lesson", date, dateFrom: date, dateTo: date, lessonKey, reason, reasonText, clientDate, clientTime };
      const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить отметку");
      if (data?.report) setReports(previous => [data.report, ...previous.filter(item => item.key !== data.report.key)]);
      setAbsenceOpen(false);
      window.dispatchEvent(new Event("schedule-attendance-changed"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка сохранения"); }
    finally { setBusy(false); }
  }
  async function cancel(report: AttendanceReport) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/attendance?id=${encodeURIComponent(report.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось отменить");
      setReports(previous => previous.filter(item => item.id !== report.id));
      window.dispatchEvent(new Event("schedule-attendance-changed"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка отмены"); }
    finally { setBusy(false); }
  }
  return <>
    <div className="event-attendance__buttons" role="group" aria-label="Сообщить старосте">
      {existing ? <button type="button" disabled={busy} onClick={() => void cancel(existing)}>{existing.kind === "late" ? "Отменить опоздание" : "Отменить отсутствие"}</button> : upcoming && <>
        {canLate && <button type="button" disabled={busy} onClick={() => void send("late")}>Опоздаю</button>}
        <button type="button" disabled={busy} aria-expanded={absenceOpen} onClick={() => setAbsenceOpen(value => !value)}>Не приду</button>
      </>}
    </div>
    {absenceOpen && !existing && <div className="event-attendance__form">
      <label>Причина<select value={reason} onChange={event => setReason(event.target.value as AttendanceReason)}><option value="sick">Больничный</option><option value="event">Мероприятие</option><option value="other">Другое</option></select></label>
      {reason === "other" && <label>Уточнение<input maxLength={300} value={reasonText} onChange={event => setReasonText(event.target.value)} placeholder="Укажи причину" /></label>}
      <div><button type="button" onClick={() => setAbsenceOpen(false)}>Отмена</button><button type="button" disabled={busy || (reason === "other" && !reasonText.trim())} onClick={() => void send("absence")}>{busy ? "Отправляю…" : "Сообщить старосте"}</button></div>
    </div>}
    {error && <p role="alert" className="event-attendance__notice">{error}</p>}
  </>;
}
