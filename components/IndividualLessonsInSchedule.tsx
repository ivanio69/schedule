"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { IndividualLesson } from "@/lib/people";
import type { ScheduleData } from "@/lib/schedule";

const PERSON_KEY = "schedule_person_id";

function dateKey(schedule: ScheduleData, week: number, day: number) {
  const [year, month, startDay] = schedule.semesterStart;
  const date = new Date(year, month, startDay + (week - 1) * 7 + day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getSelection(schedule: ScheduleData) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
  const day = buttons.findIndex((button) => button.classList.contains("is-active"));
  const week = Number(document.querySelector(".week-number strong")?.textContent ?? "0");
  if (day < 0 || !week) return null;
  return { day, week, date: dateKey(schedule, week, day) };
}

export default function IndividualLessonsInSchedule() {
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [personId, setPersonId] = useState("");
  const [date, setDate] = useState("");
  const [lessons, setLessons] = useState<IndividualLesson[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPersonId(localStorage.getItem(PERSON_KEY) ?? "");
    let stopped = false;
    fetch("/api/schedule", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ schedule?: ScheduleData }> : Promise.reject())
      .then((data) => { if (!stopped) setSchedule(data.schedule ?? null); })
      .catch(() => {});
    const onStorage = () => setPersonId(localStorage.getItem(PERSON_KEY) ?? "");
    window.addEventListener("storage", onStorage);
    return () => { stopped = true; window.removeEventListener("storage", onStorage); };
  }, []);

  useEffect(() => {
    if (!schedule || !personId) return;
    const syncSelection = () => {
      const selection = getSelection(schedule);
      if (!selection) return;
      setDate((current) => current === selection.date ? current : selection.date);
      const nextHost = document.querySelector<HTMLElement>(".lesson-list");
      if (nextHost) setHost((current) => current === nextHost ? current : nextHost);
    };
    syncSelection();
    const observer = new MutationObserver(syncSelection);
    const root = document.querySelector(".schedule-shell") ?? document.body;
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [schedule, personId]);

  useEffect(() => {
    if (!personId || !date) { setLessons([]); return; }
    let stopped = false;
    fetch(`/api/individuals?personId=${encodeURIComponent(personId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ lessons?: IndividualLesson[] }> : Promise.reject())
      .then((data) => { if (!stopped) setLessons((data.lessons ?? []).filter((lesson) => lesson.date === date)); })
      .catch(() => { if (!stopped) setLessons([]); });
    return () => { stopped = true; };
  }, [personId, date]);

  if (!host || !lessons.length) return null;
  return createPortal(
    <>
      {lessons.map((lesson) => (
        <article key={lesson.id} className="individual-schedule-entry">
          <div className="individual-schedule-entry__time">
            <strong>{lesson.timeStart}</strong>
            <small>{lesson.timeEnd}</small>
          </div>
          <div className="individual-schedule-entry__main">
            <span>ИНДИВИДУАЛЬНО</span>
            <h3>{lesson.subject}</h3>
            <p>{lesson.professor || "Преподаватель не указан"}{lesson.auditorium ? ` · ${lesson.auditorium}` : ""}</p>
            {lesson.note && <small className="individual-schedule-entry__note">● {lesson.note}</small>}
          </div>
        </article>
      ))}
      <style jsx global>{`
        .individual-schedule-entry{display:grid;grid-template-columns:76px minmax(0,1fr);gap:15px;align-items:center;margin-top:8px;padding:15px 16px;border:1px solid rgba(120,180,255,.35);border-radius:16px;background:linear-gradient(135deg,rgba(120,180,255,.08),rgba(255,255,255,.025));}
        .individual-schedule-entry__time{display:grid;gap:3px}.individual-schedule-entry__time strong{font-size:16px}.individual-schedule-entry__time small,.individual-schedule-entry__main p{color:#777780;font-size:10px}.individual-schedule-entry__main>span{color:#8ebfff;font-size:9px;font-weight:800;letter-spacing:.1em}.individual-schedule-entry__main h3{margin:4px 0;font-size:15px}.individual-schedule-entry__main p{margin:0}.individual-schedule-entry__note{display:block;margin-top:6px;color:#b5b5bd;font-size:10px}
        .individual-schedule-entry.is-past{opacity:.42;filter:saturate(.55)}
        @media(max-width:650px){.individual-schedule-entry{grid-template-columns:58px minmax(0,1fr);gap:9px;padding:13px}}
      `}</style>
    </>,
    host,
  );
}
