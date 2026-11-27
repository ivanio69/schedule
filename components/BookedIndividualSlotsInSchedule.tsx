"use client";
import { useEffect, useMemo, useState } from "react";
import type { IndividualSlot } from "@/lib/individual-slots";
import LoadingState from "@/components/LoadingState";
import PersonalEventNote from "@/components/PersonalEventNote";

type Slot = IndividualSlot & { studentNames?: string[] };
export default function BookedIndividualSlotsInSchedule({ date, personId }: { date: string; personId: string }) {
  const requestKey = `${date}|${personId}`;
  const [result, setResult] = useState<{ key: string; slots: Slot[] } | null>(null);
  const loading = result?.key !== requestKey;

  useEffect(() => {
    if (!date || !personId) return;
    const controller = new AbortController();
    fetch(`/api/individual-slots?from=${date}&to=${date}`, { cache: "no-store", signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!controller.signal.aborted) setResult({ key: requestKey, slots: (d?.slots ?? []).filter((s: Slot) => s.studentIds?.includes(personId) || s.studentId === personId) }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ key: requestKey, slots: [] }); });
    return () => controller.abort();
  }, [date, personId, requestKey]);

  const content = useMemo(() => result?.key === requestKey ? [...result.slots].sort((a, b) => a.timeStart.localeCompare(b.timeStart)) : [], [result, requestKey]);
  if (personId && loading) return <LoadingState compact label="Загружаем индивидуальные" detail="Проверяем записи на выбранную дату."/>;
  if (!personId || !content.length) return null;
  return (
    <div className="booked-individuals-in-table" aria-label="Мои индивидуальные занятия">
      {content.map((slot) => <article key={slot.id} className="schedule-card booked-individual-slot-card">
        <div className="schedule-card__time"><strong>{slot.timeStart}</strong><span>{slot.timeEnd}</span></div>
        <div className="schedule-card__body">
          <div className="schedule-card__title-row"><h3>{slot.subject}</h3><span className="booked-individual-slot-badge">ИНДИВ.</span></div>
          <p>{slot.professor}{slot.auditorium ? ` · ${slot.auditorium}` : ""}</p>
          {slot.note && <small>{slot.note}</small>}
          <PersonalEventNote noteKey={`individual-slot:${slot.id}`}/>
        </div>
      </article>)}
    </div>
  );
}
