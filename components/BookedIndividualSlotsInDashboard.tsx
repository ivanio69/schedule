"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { IndividualSlot } from "@/lib/individual-slots";

type Slot = IndividualSlot & { studentNames?: string[] };
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function BookedIndividualSlotsInDashboard() {
  const [personId, setPersonId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("schedule_person_id") ?? "";
    setPersonId(id);
    const find = () => setTarget(document.querySelector<HTMLElement>(".dashboard-timeline"));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!personId) return;
    const today = new Date();
    const to = new Date(today);
    to.setDate(to.getDate() + 1);
    fetch(`/api/individual-slots?from=${dateKey(today)}&to=${dateKey(to)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setSlots((d?.slots ?? []).filter((s: Slot) => s.studentIds?.includes(personId))))
      .catch(() => setSlots([]));
  }, [personId]);

  const items = useMemo(() => slots.sort((a, b) => a.timeStart.localeCompare(b.timeStart)), [slots]);
  if (!target || !personId || !items.length) return null;
  return createPortal(
    <section className="dashboard-booked-individuals" aria-label="Мои индивидуальные занятия">
      <div className="dashboard-section-head"><h2>Мои индивидуальные</h2><span>{items.length}</span></div>
      {items.map((slot) => <article key={slot.id} className="dashboard-event-v2 individual">
        <div className="dashboard-event-time"><strong>{slot.timeStart}</strong><small>{slot.timeEnd}</small></div>
        <div className="dashboard-event-content"><span>ИНДИВИДУАЛЬНО</span><h3>{slot.subject}</h3><p>{slot.professor} · {slot.auditorium || "Аудитория не указана"}</p>{slot.note && <small className="dashboard-note-preview">● {slot.note}</small>}</div>
        <mark>{slot.studentIds?.length ?? 0}/{slot.capacity}</mark>
      </article>)}
    </section>, target
  );
}
