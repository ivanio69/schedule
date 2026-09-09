"use client";

import { useEffect } from "react";
import ScheduleApp from "@/components/ScheduleApp";

export default function TodaySchedule() {
  useEffect(() => {
    const today = new Date().getDay();
    if (today === 0) return;
    const index = today - 1;
    const observer = new MutationObserver(() => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
      const target = buttons[index];
      if (target && !target.classList.contains("is-active")) target.click();
      if (target) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <ScheduleApp />;
}
