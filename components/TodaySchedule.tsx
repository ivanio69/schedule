"use client";

import { useEffect } from "react";
import ScheduleApp from "@/components/ScheduleApp";
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
  panel.querySelectorAll<HTMLElement>(".schedule-card, .rehearsal-card").forEach((card) => {
    const times = Array.from(card.querySelectorAll(".schedule-card__time span")).map((node) => node.textContent?.trim() ?? "");
    const end = times[1];
    const endParts = end?.split(":").map(Number);
    const endMinutes = endParts?.length === 2 ? endParts[0] * 60 + endParts[1] : Infinity;
    card.classList.toggle("is-past", pastDay || (currentDay && endMinutes <= now.getHours() * 60 + now.getMinutes()));
  });
}

export default function TodaySchedule() {
  useEffect(() => {
    let schedule: ScheduleData | null = null;
    let stopped = false;
    let panel: HTMLElement | null = null;
    let observer: MutationObserver | null = null;

    const attachObserver = () => {
      const nextPanel = document.querySelector<HTMLElement>(".schedule-panel");
      if (!nextPanel || nextPanel === panel) return;
      observer?.disconnect();
      panel = nextPanel;
      observer = new MutationObserver(() => {
        if (!stopped || schedule) updatePastState(schedule!);
      });
      observer.observe(panel, { childList: true, subtree: true });
      if (schedule) updatePastState(schedule);
    };

    const load = async () => {
      try {
        const response = await fetch("/api/schedule", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { schedule?: ScheduleData };
        if (!stopped && data.schedule) {
          schedule = data.schedule;
          attachObserver();
          updatePastState(schedule);
        }
      } catch {}
    };

    void load();
    const attachTimer = window.setInterval(attachObserver, 1000);
    const timer = window.setInterval(() => {
      if (schedule) updatePastState(schedule);
    }, 30000);

    return () => {
      stopped = true;
      observer?.disconnect();
      window.clearInterval(attachTimer);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <style jsx global>{`
        .schedule-panel.is-past-day .schedule-card,
        .schedule-panel.is-past-day .rehearsal-card,
        .schedule-card.is-past,
        .rehearsal-card.is-past { opacity: .42; filter: saturate(.55); }
        .schedule-card.is-past:hover,
        .rehearsal-card.is-past:hover { opacity: .58; }
      `}</style>
      <ScheduleApp />
    </>
  );
}
