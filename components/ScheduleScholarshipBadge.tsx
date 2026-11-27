"use client";

import { ScholarshipDate } from "@/components/ScholarshipBadge";

export default function ScheduleScholarshipBadge({ date }: { date: string }) {
  const visible = Boolean(ScholarshipDate({ date }));
  return <div className={`scholarship-slot-wrap schedule-scholarship-wrap${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
    <div className="scholarship-slot-inner"><div className="scholarship-badge" role={visible ? "status" : undefined}>
      <span>₽</span><strong>В этот день стипендия</strong>
    </div></div>
  </div>;
}
