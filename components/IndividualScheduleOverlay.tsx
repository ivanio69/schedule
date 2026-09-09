"use client";

import { useEffect, useState } from "react";
import type { IndividualLesson } from "@/lib/people";
import type { ScheduleData } from "@/lib/schedule";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function selectedDate(schedule: ScheduleData, week: number, day: number) {
  const [year, month, startDay] = schedule.semesterStart;
  const date = new Date(year, month, startDay + (week - 1) * 7 + day);
  return dateKey(date);
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
      heading.innerHTML = "<span>ИНДИВИДУАЛЬНЫЕ</span><strong>Мои занятия</strong>";
      section.appendChild(heading);
      const list = document.createElement("div");
      list.className = "individual-schedule-list";
      items.sort((a, b) => a.timeStart.localeCompare(b.timeStart)).forEach((item) => {
        const card = document.createElement("article");
        card.className = "individual-schedule-card";
        const time = document.createElement("div");
        time.className = "individual-schedule-time";
        const start = document.createElement("strong"); start.textContent = item.timeStart;
        const end = document.createElement("small"); end.textContent = item.timeEnd;
        time.append(start, end);
        const body = document.createElement("div");
        const label = document.createElement("span"); label.textContent = "ИНДИВИДУАЛЬНАЯ ПАРА";
        const title = document.createElement("h3"); title.textContent = item.subject;
        const meta = document.createElement("p"); meta.textContent = `${item.professor}${item.auditorium ? ` · ${item.auditorium}` : ""}`;
        body.append(label, title, meta);
        if (item.note) { const note = document.createElement("small"); note.textContent = item.note; body.append(note); }
        card.append(time, body); list.appendChild(card);
      });
      section.appendChild(list);
      panel.appendChild(section);
    };
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    render();
    return () => observer.disconnect();
  }, [lessons, schedule]);

  return null;
}
