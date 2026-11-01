import type { PersonalEvent } from "@/lib/personal-events";

export default function PersonalEventCard({ event, onClick }: { event: PersonalEvent; onClick: () => void }) {
  return <article className="schedule-card personal-event-card" role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
    <div className="schedule-card__time"><span>{event.timeStart}</span><span>{event.timeEnd}</span></div>
    <div className="schedule-card__body"><div className="schedule-card__title-row"><div className="schedule-card__title"><span className="card-kind-badge">ЛИЧНОЕ</span><h2>{event.title}</h2></div></div><div className="schedule-card__meta"><span>{event.location || "Видно только вам"}</span>{event.notes && <span>Есть заметки</span>}</div></div>
  </article>;
}
