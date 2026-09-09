import type { Rehearsal } from "@/lib/schedule";

export function RehearsalCard({ rehearsal, own, onDelete }: { rehearsal: Rehearsal; own: boolean; onDelete?: () => void }) {
  return (
    <article className="rehearsal-card">
      <div className="schedule-card__time" aria-label={`Время: ${rehearsal.timeStart} — ${rehearsal.timeEnd}`}>
        <span>{rehearsal.timeStart}</span><span>{rehearsal.timeEnd}</span>
      </div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <div><span className="rehearsal-label">Репетиция</span><h2>{rehearsal.subject}</h2></div>
          {own && onDelete && <button type="button" className="rehearsal-delete" onClick={onDelete}>Удалить</button>}
        </div>
        <div className="schedule-card__meta">
          <span>ответственный: {rehearsal.responsible}</span><span aria-hidden="true">·</span>
          <span>{rehearsal.participants.length} участн.</span>
        </div>
      </div>
    </article>
  );
}
