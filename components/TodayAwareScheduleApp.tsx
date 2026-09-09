"use client";

import { useEffect } from "react";
import ScheduleApp from "@/components/ScheduleApp";

const PAST_CLASS = "is-past";

function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? -1 : day - 1;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getWeekState() {
  const weekNumber = Number(
    document.querySelector(".week-number strong")?.textContent ?? "0",
  );
  const currentWeek = document.querySelector(".week-number em")
    ? weekNumber
    : null;
  return { weekNumber, currentWeek };
}

function updatePastState() {
  const tabs = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".day-tabs button"),
  );
  const { weekNumber, currentWeek } = getWeekState();
  const activeIndex = tabs.findIndex((tab) => tab.classList.contains("is-active"));
  const todayIndex = getTodayIndex();
  const previousWeek = currentWeek !== null && weekNumber < currentWeek;

  tabs.forEach((tab, index) => {
    tab.classList.toggle(
      PAST_CLASS,
      previousWeek ||
        (currentWeek !== null && todayIndex >= 0 && index < todayIndex),
    );
  });

  const cards = document.querySelectorAll<HTMLElement>(
    ".lesson-list .schedule-card, .lesson-list .rehearsal-card",
  );
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  cards.forEach((card) => {
    const end = card.querySelector<HTMLElement>(
      ".schedule-card__time span:last-child",
    )?.textContent?.trim();
    if (!end || activeIndex < 0) {
      card.classList.remove(PAST_CLASS);
      return;
    }

    const pastDay =
      currentWeek !== null && activeIndex < todayIndex;
    const pastLesson =
      currentWeek !== null &&
      activeIndex === todayIndex &&
      timeToMinutes(end) <= nowMinutes;

    card.classList.toggle(
      PAST_CLASS,
      previousWeek || pastDay || pastLesson,
    );
  });
}

export default function TodayAwareScheduleApp() {
  useEffect(() => {
    let selectedToday = false;
    const sync = () => {
      const tabs = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".day-tabs button"),
      );
      const currentWeek = Boolean(document.querySelector(".week-number em"));
      const todayIndex = getTodayIndex();

      if (!selectedToday && currentWeek && todayIndex >= 0 && tabs[todayIndex]) {
        selectedToday = true;
        tabs[todayIndex].click();
      }

      updatePastState();
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    const timer = window.setInterval(updatePastState, 60_000);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <style>{`.day-tabs button.is-past{opacity:.42}.day-tabs button.is-past:hover{opacity:.7}.schedule-card.is-past,.rehearsal-card.is-past{opacity:.42;filter:saturate(.35)}.schedule-card.is-past:hover,.rehearsal-card.is-past:hover{transform:none}`}</style>
      <ScheduleApp />
    </>
  );
}
