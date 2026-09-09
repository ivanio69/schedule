"use client";

import { useEffect, useState } from "react";
import type { IndividualLesson } from "@/lib/people";
import type { ScheduleData } from "@/lib/schedule";

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function selectedDate(schedule: ScheduleData, week: number, day: number) {
  const [year, month, startDay] = schedule.semesterStart;
  return dateKey(new Date(year, month, startDay + (week - 1) * 7 + day));
}

export default function IndividualScheduleOverlay() {
  const [lessons, setLessons] = useState<IndividualLesson[]>([]);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);

  useEffect(() => {
    const personId = localStorage.getItem("schedule_person_id");
    if (!personId) return;
    Promise.all([
      fetch(`/api/individuals?personId=${encodeURIComponent(personId)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/schedule", { cache: "no-store" }).then((r) => r.json()),
    ]).then(([individualData, scheduleData]) => {
      setLessons(individualData.lessons ?? []);
      setSchedule(scheduleData.schedule ?? null);
    }).catch(() => setLessons([]));
  }, []);

  useEffect(() => {
    if (!lessons.length || !schedule) return;
    const render = () => {
      const active = document.querySelector<HTMLButtonElement>(".day-tabs button.is-active");
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
      const week = Number(document.querySelector(".week-number strong")?.textContent ?? "1");
      if (!active || !buttons.length || !week) return;
      const day = buttons.indexOf(active);
      if (day < 0) return;
      const items = lessons.filter((lesson) => lesson.date === selectedDate(schedule, week, day));
      document.querySelector(".individual-schedule-section")?.remove();
      if (!items.length) return;
      const panel = document.querySelector(".schedule-panel");
      if (!panel) return;

      const section = document.createElement("section");
      section.className = "individual-schedule-section";
      const heading = document.createElement("div");
      heading.className = "individual-schedule-heading";
      const label = document.createElement("span"); label.textContent = "ИНДИВИДУАЛЬНЫЕ";
      const title = document.createElement("strong"); title.textContent = "Мои занятия";
      heading.append(label, title); section.appendChild(heading);
      const list = document.createElement("div"); list.className = "individual-schedule-list";
      items.sort((a, b) => a.timeStart.localeCompare(b.timeStart)).forEach((item) => {
        const card = document.createElement("article"); card.className = "individual-schedule-card";
        const time = document.createElement("div"); time.className = "individual-schedule-time";
        const start = document.createElement("strong"); start.textContent = item.timeStart;
        const end = document.createElement("small"); end.textContent = item.timeEnd; time.append(start, end);
        const body = document.createElement("div");
        const type = document.createElement("span"); type.textContent = "ИНДИВИДУАЛЬНАЯ ПАРА";
        const subject = document.createElement("h3"); subject.textContent = item.subject;
        const meta = document.createElement("p"); meta.textContent = `${item.professor}${item.auditorium ? ` · ${item.auditorium}` : ""}`;
        body.append(type, subject, meta);
        if (item.note) { const note = document.createElement("small"); note.textContent = item.note; body.append(note); }
        card.append(time, body); list.appendChild(card);
      });
      section.appendChild(list); panel.appendChild(section);
    };
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    render();
    return () => observer.disconnect();
  }, [lessons, schedule]);

  return <style jsx global>{`.individual-schedule-section{margin-top:12px;padding-top:14px}.individual-schedule-heading{display:flex;align-items:center;justify-content:space-between;margin:0 2px 9px}.individual-schedule-heading span{color:#94949d;font-size:10px;font-weight:800;letter-spacing:.08em}.individual-schedule-heading strong{font-size:14px}.individual-schedule-list{display:grid;gap:8px}.individual-schedule-card{display:grid;grid-template-columns:76px 1fr;overflow:hidden;border:1px solid rgba(120,180,255,.35);border-radius:18px;background:linear-gradient(135deg,rgba(120,180,255,.08),rgba(255,255,255,.018));box-shadow:inset 3px 0 0 #78b4ff}.individual-schedule-time{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:18px 14px;border-right:1px solid rgba(120,180,255,.18);background:rgba(120,180,255,.035)}.individual-schedule-time strong{font-size:16px}.individual-schedule-time small,.individual-schedule-card p,.individual-schedule-card>div>small{color:#94949d;font-size:11px}.individual-schedule-card>div:last-child{padding:16px 20px}.individual-schedule-card>div:last-child>span{color:#78b4ff;font-size:9px;font-weight:800;letter-spacing:.06em}.individual-schedule-card h3{margin:5px 0;font-size:15px}.individual-schedule-card p{margin:0}.individual-schedule-card>div>small{display:block;margin-top:7px}@media(max-width:600px){.individual-schedule-card{grid-template-columns:62px 1fr}.individual-schedule-card>div:last-child{padding:14px}}`}</style>;
}
