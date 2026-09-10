"use client";

import { useEffect } from "react";
import ScheduleApp from "@/components/ScheduleApp";
import IndividualLessonsInSchedule from "@/components/IndividualLessonsInSchedule";
import BookedIndividualSlotsInSchedule from "@/components/BookedIndividualSlotsInSchedule";
import type { ScheduleData } from "@/lib/schedule";

function getSelectedDate(schedule: ScheduleData) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
  const day = buttons.findIndex((button) => button.classList.contains("is-active"));
  const week = Number(document.querySelector(".week-number strong")?.textContent ?? "0");
  if (day < 0 || !week) return null;
  const [year, month, startDay] = schedule.semesterStart;
  const date = new Date(year, month, startDay);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + (week - 1) * 7 + day);
  return date;
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
  panel.querySelectorAll<HTMLElement>(".schedule-card, .rehearsal-card, .individual-schedule-entry, .booked-individual-schedule article").forEach((card) => {
    const endText = card.querySelectorAll(".schedule-card__time span")[1]?.textContent?.trim() ?? card.querySelector<HTMLElement>(".individual-schedule-entry__time small")?.textContent?.trim() ?? card.querySelector<HTMLElement>(".booked-individual-schedule__time small")?.textContent?.trim() ?? "";
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
        .schedule-panel.is-past-day .booked-individual-schedule article,
        .schedule-card.is-past,
        .rehearsal-card.is-past,
        .individual-schedule-entry.is-past,
        .booked-individual-schedule article.is-past { opacity: .42; filter: saturate(.55); }
        .schedule-card.is-past:hover,
        .rehearsal-card.is-past:hover,
        .individual-schedule-entry.is-past:hover,
        .booked-individual-schedule article.is-past:hover { opacity: .58; }
        .booked-individual-schedule{margin-top:10px;padding:14px;border:1px solid #303036;border-radius:16px;background:#111114}
        .booked-individual-schedule__head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 8px}
        .booked-individual-schedule__head span{font-size:9px;font-weight:800;letter-spacing:.1em;color:#777780}
        .booked-individual-schedule__head h3{margin:3px 0 0;font-size:15px}
        .booked-individual-schedule__head b{font-size:12px;color:#94949d}
        .booked-individual-schedule article{display:grid;grid-template-columns:62px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 8px;border-top:1px solid #25252b}
        .booked-individual-schedule__time{display:grid;gap:2px}.booked-individual-schedule__time strong{font-size:14px}.booked-individual-schedule__time small{font-size:10px;color:#777780}
        .booked-individual-schedule article>div:nth-child(2){display:grid;gap:2px;min-width:0}.booked-individual-schedule article>div:nth-child(2)>span{font-size:9px;color:#777780;font-weight:800;letter-spacing:.08em}.booked-individual-schedule article>div:nth-child(2)>strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.booked-individual-schedule article>div:nth-child(2)>small,.booked-individual-schedule article em{font-size:10px;color:#94949d}.booked-individual-schedule article em{font-style:normal}.booked-individual-schedule mark{padding:4px 7px;border-radius:8px;background:#202025;color:#b5b5bd;font-size:9px}
        @media(max-width:600px){.booked-individual-schedule article{grid-template-columns:54px minmax(0,1fr) auto;gap:8px}.booked-individual-schedule{padding:11px}}
      `}</style>
      <ScheduleApp />
      <IndividualLessonsInSchedule />
      <BookedIndividualSlotsInSchedule />
    </>
  );
}
