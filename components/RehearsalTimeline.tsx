"use client";

import { useEffect, useMemo, useState } from "react";
import type { Rehearsal } from "@/lib/schedule";

const stamp = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();

export default function RehearsalTimeline({ rehearsal, personName }: { rehearsal: Rehearsal; personName: string }) {
  const [now, setNow] = useState<number | null>(null);
  const blocks = useMemo(() => [...(rehearsal.blocks ?? [])].sort((a, b) => a.timeStart.localeCompare(b.timeStart)), [rehearsal.blocks]);
  useEffect(() => {
    const sync = () => setNow(Date.now());
    sync();
    const timer = window.setInterval(sync, 30000);
    return () => window.clearInterval(timer);
  }, []);
  if (!blocks.length) return null;
  const assigned = rehearsal.participantMode === "blocks" && !rehearsal.isGlobal && !!personName
    ? blocks.filter(block => block.participants.includes(personName))
    : [];
  const nextAssigned = assigned.find(block => now === null || stamp(rehearsal.date, block.timeEnd) > now);
  return <section className="details-modal__schedule">
    <div className="details-modal__schedule-head"><span>ПЛАН РЕПЕТИЦИИ</span><strong>{blocks.length} {blocks.length === 1 ? "блок" : blocks.length < 5 ? "блока" : "блоков"}</strong></div>
    {rehearsal.participantMode === "blocks" && !rehearsal.isGlobal && !!personName &&
      <div className="event-personal-slot"><span>Моё участие</span><strong>{assigned.length ? nextAssigned ? `${nextAssigned.timeStart}–${nextAssigned.timeEnd} · ${nextAssigned.title}` : "Мои блоки завершены" : "Нет назначенных блоков"}</strong>{assigned.length > 1 && <small>Всего моих блоков: {assigned.length}</small>}</div>}
    <ol className="event-timeline">
      {blocks.map((block, index) => {
        const startAt = stamp(rehearsal.date, block.timeStart);
        const endAt = stamp(rehearsal.date, block.timeEnd);
        const active = now !== null && now >= startAt && now < endAt;
        const ended = now !== null && now >= endAt;
        const mine = assigned.some(item => item.id === block.id);
        return <li key={block.id} className={`event-timeline__item${active ? " is-current" : ""}${ended ? " is-complete" : ""}${mine ? " is-mine" : ""}`}>
          <div className="event-timeline__time"><strong>{block.timeStart}</strong><small>{block.timeEnd}</small></div>
          <div className="event-timeline__content"><div className="event-timeline__title"><strong>{block.title}</strong>{active && <span>Сейчас</span>}{mine && <em>Мой блок</em>}</div>
            {block.notes && <p>{block.notes}</p>}
            {rehearsal.participantMode === "blocks" && <details className="event-timeline__people"><summary>{block.participants.length ? `Участники · ${block.participants.length}` : "Без участников"}</summary><div>{block.participants.map(name => <span key={name}>{name}</span>)}</div></details>}
          </div>
        </li>;
      })}
    </ol>
  </section>;
}
