"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { ScholarshipDate } from "@/components/ScholarshipBadge";
import type { ScheduleData } from "@/lib/schedule";

function selectedDate(schedule: ScheduleData) {
  const button = document.querySelector<HTMLButtonElement>(".day-tabs button.is-active");
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".day-tabs button"));
  const day = button ? buttons.indexOf(button) : -1;
  const week = Number(document.querySelector(".week-number strong")?.textContent ?? "0");
  if (day < 0 || !week) return null;
  const [year, month, startDay] = schedule.semesterStart;
  const value = new Date(year, month, startDay);
  const mondayOffset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - mondayOffset + (week - 1) * 7 + day);
  return value;
}

export default function ScheduleScholarshipBadge() {
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let schedule: ScheduleData | null = null;
    const sync = () => {
      const nextSlot = document.querySelector<HTMLElement>(".schedule-scholarship-slot");
      setSlot((current) => current === nextSlot ? current : nextSlot);
      if (schedule) setDate(selectedDate(schedule));
    };

    sync();
    fetch("/api/schedule", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        schedule = data?.schedule ?? null;
        sync();
      })
      .catch(() => {});

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", sync);
    };
  }, []);

  const payout = date ? ScholarshipDate({ date }) : null;
  const visible = Boolean(payout);
  if (!slot) return null;

  return createPortal(
    <div className={`scholarship-slot-wrap schedule-scholarship-wrap${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
      <div className="scholarship-slot-inner">
        <div className="scholarship-badge" role={visible ? "status" : undefined}>
          <span>₽</span>
          <strong>В этот день стипендия</strong>
        </div>
      </div>
    </div>,
    slot,
  );
}
