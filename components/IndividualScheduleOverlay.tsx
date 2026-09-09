"use client";

import { useEffect, useState } from "react";
import type { IndividualLesson } from "@/lib/people";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function IndividualScheduleOverlay() {
  const [lessons, setLessons] = useState<IndividualLesson[]>([]);

  useEffect(() => {
    const personId = localStorage.getItem("schedule_person_id");
    if (!personId) return;
    fetch(`/api/individuals?personId=${encodeURIComponent(personId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setLessons(data.lessons ?? []))
      .catch(() => setLessons([]));
  }, []);

  useEffect(() => {
    if (!lessons.length) return;
    const render = () => {
      const active = document.querySelector<HTMLButtonElement>(".day-tabs button.is-active");
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
      if (!active || !buttons.length) return;
      const dayIndex = buttons.indexOf(active);
      if (dayIndex < 0) return;

      const caption = document.querySelector<HTMLElement>(".week-caption");
      const match = caption?.textContent?.match(/(\d{1,2})[.\s–-]+(\d{1,2})/);
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const weekNumber = Number(document.querySelector(".week-number strong")?.textContent ?? "1");
      const baseMonday = new Date(monday);
      if (weekNumber && weekNumber !== 1) baseMonday.setDate(baseMonday.getDate() + (weekNumber - 1) * 7);
      const selected = new Date(baseMonday);
      selected.setDate(baseMonday.getDate() + dayIndex);
      const key = dateKey(selected);
      const items = lessons.filter((lesson) => lesson.date === key);

      document.querySelector(".individual-schedule-section")?.remove();
      if (!items.length) return;
      const panel = document.querySelector(".schedule-panel");
      if (!panel) return;
      const section = document.createElement("section");
      section.className = "individual-schedule-section";
      section.innerHTML = `<div class="individual-schedule-heading"><span>ИНДИВИДУАЛЬНЫЕ</span><strong>Мои занятия</strong></div>`;
      const list = document.createElement("div");
      list.className = "individual-schedule-list";
      items.sort((a, b) => a.timeStart.localeCompare(b.timeStart)).forEach((item) => {
        const card = document.createElement("article");
        card.className = "individual-schedule-card";
        card.innerHTML = `<div class="individual-schedule-time"><strong>${item.timeStart}</strong><small>${item.timeEnd}</small></div><div><span>ИНДИВИДУАЛЬНАЯ ПАРА</span><h3>${item.subject}</h3><p>${item.professor}${item.auditorium ? ` · ${item.auditorium}` : ""}</p>${item.note ? `<small>${item.note}</small>` : ""}</div>`;
        list.appendChild(card);
      });
      section.appendChild(list);
      panel.appendChild(section);
    };
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    render();
    return () => observer.disconnect();
  }, [lessons]);

  return null;
}
