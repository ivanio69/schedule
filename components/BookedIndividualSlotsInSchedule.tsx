"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { IndividualSlot } from "@/lib/individual-slots";
import type { ScheduleData } from "@/lib/schedule";

type Slot = IndividualSlot & { studentNames?: string[]; studentName?: string | null };
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const selectedDate = (schedule: ScheduleData) => {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
  const day = buttons.findIndex((button) => button.classList.contains("is-active"));
  const week = Number(document.querySelector(".week-number strong")?.textContent ?? "0");
  if (day < 0 || !week) return dateKey(new Date());
  const [year, month, startDay] = schedule.semesterStart;
  const d = new Date(year, month, startDay);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset + (week - 1) * 7 + day);
  return dateKey(d);
};

export default function BookedIndividualSlotsInSchedule() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [personId, setPersonId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    setPersonId(localStorage.getItem("schedule_person_id") ?? "");
    fetch("/api/schedule", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((d) => setSchedule(d?.schedule ?? null)).catch(() => {});
    const find = () => setTarget(document.querySelector<HTMLElement>(".lesson-list"));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!schedule) return;
    const sync = () => setDate(selectedDate(schedule));
    sync();
    const timer = window.setInterval(sync, 300);
    return () => window.clearInterval(timer);
  }, [schedule]);

  useEffect(() => {
    if (!date || !personId) return;
    fetch(`/api/individual-slots?from=${date}&to=${date}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setSlots((d?.slots ?? []).filter((s: Slot) => s.studentIds?.includes(personId) || s.studentId === personId)))
      .catch(() => setSlots([]));
  }, [date, personId]);

  const content = useMemo(() => [...slots].sort((a, b) => a.timeStart.localeCompare(b.timeStart)), [slots]);
  if (!target || !personId || !content.length) return null;
  return createPortal(
    <div className="booked-individuals-in-table" aria-label="Мои индивидуальные занятия">
      {content.map((slot) => <article key={slot.id} className="schedule-card booked-individual-slot-card">
        <div className="schedule-card__time"><strong>{slot.timeStart}</strong><span>{slot.timeEnd}</span></div>
        <div className="schedule-card__body">
          <div className="schedule-card__title-row"><h3>{slot.subject}</h3><span className="booked-individual-slot-badge">ИНДИВ.</span></div>
          <p>{slot.professor}{slot.auditorium ? ` · ${slot.auditorium}` : ""}</p>
          {slot.note && <small>{slot.note}</small>}
        </div>
      </article>)}
    </div>, target
  );
}
