"use client";

import { useEffect } from "react";
import ScheduleApp from "@/components/ScheduleApp";
import IndividualLessonsInSchedule from "@/components/IndividualLessonsInSchedule";
import type { ScheduleData } from "@/lib/schedule";

function getSelectedDate(schedule: ScheduleData) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
  const day = buttons.findIndex((button) => button.classList.contains("is-active"));
  const week = Number(document.querySelector(".week-number strong")?.textContent ?? "0");
  if (day < 0 || !week) return null;
  const [year, month, startDay] = schedule.semesterStart;
  return new Date(year, month, startDay + (week - 1) * 7 + day);
}

function updatePastState(schedule: ScheduleData) {
  const panel = document.querySelector<HTMLElement>(".schedule-panel");
  const selected = getSelectedDate(schedule);
  if (!panel || !selected) return;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedDay = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
  const pastDay = selectedDay < today;
  const currentDay = selectedDay.getTime() === today.getTime();
  panel.classList.toggle("is-past-day", pastDay);
  panel.querySelectorAll<HTMLElement>(".schedule-card, .rehearsal-card, .individual-schedule-entry").forEach((card) => {
    const endText = card.querySelectorAll(".schedule-card__time span")[1]?.textContent?.trim() ?? card.querySelector<HTMLElement>(".individual-schedule-entry__time small")?.textContent?.trim() ?? "";
    const [hours, minutes] = endText.split(":").map(Number);
    const endMinutes = Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : Infinity;
    card.classList.toggle("is-past", pastDay || (currentDay && endMinutes <= now.getHours() * 60 + now.getMinutes()));
  });
}

export default function TodaySchedule() {
  useEffect(() => {
    let schedule: ScheduleData | null = null;
    let stopped = false;

    const sync = () => {
      if (schedule) updatePastState(schedule);
    };

    const load = async () => {
      try {
        const response = await fetch("/api/schedule", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { schedule?: ScheduleData };
        if (stopped || !data.schedule) return;
        schedule = data.schedule;

        window.setTimeout(() => {
          if (stopped) return;
          const today = new Date().getDay();
          if (today !== 0) {
            const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
            buttons[today - 1]?.click();
          }
          sync();
        }, 80);
      } catch {}
    };

    void load();
    const timer = window.setInterval(sync, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        .schedule-panel.is-past-day .schedule-card,
        .schedule-panel.is-past-day .rehearsal-card,
        .schedule-panel.is-past-day .individual-schedule-entry,
        .schedule-card.is-past,
        .rehearsal-card.is-past,
        .individual-schedule-entry.is-past { opacity: .42; filter: saturate(.55); }
        .schedule-card.is-past:hover,
        .rehearsal-card.is-past:hover,
        .individual-schedule-entry.is-past:hover { opacity: .58; }
      `}</style>
      <ScheduleApp />
      <IndividualLessonsInSchedule />
    </>
  );
}
