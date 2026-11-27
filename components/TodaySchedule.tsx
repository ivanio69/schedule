"use client";

import ScheduleApp from "@/components/ScheduleApp";

export default function TodaySchedule() {
  return <>
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
        .booked-individuals-in-table{display:contents}
        .booked-individual-slot-card{cursor:pointer;border-color:rgba(120,180,255,.35)!important}
        .booked-individual-slot-card .schedule-card__title-row{display:flex;align-items:center;gap:8px}
        .booked-individual-slot-card .booked-individual-slot-badge{font-size:8px;font-weight:800;letter-spacing:.08em;color:#94949d;border:1px solid #303036;border-radius:6px;padding:3px 5px}
      `}</style>
      <ScheduleApp />
    </>;
}
