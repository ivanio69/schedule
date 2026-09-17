import type { CSSProperties } from "react";
import type { Rehearsal } from "@/lib/schedule";

export function RehearsalCard({ rehearsal, own, onDelete, onClick }: { rehearsal: Rehearsal; own: boolean; onDelete?: () => void; onClick?: () => void }) {
  const globalStyle: CSSProperties | undefined = rehearsal.isGlobal ? {
    borderColor: "rgba(94, 234, 212, .55)",
    background: "linear-gradient(135deg, rgba(45, 212, 191, .13), rgba(255,255,255,.018))",
    boxShadow: "inset 3px 0 0 #5eead4",
  } : undefined;
  return (
    <article className="rehearsal-card" style={globalStyle} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}>
      <div className="schedule-card__time" aria-label={`Время: ${rehearsal.timeStart} — ${rehearsal.timeEnd}`}><span>{rehearsal.timeStart}</span><span>{rehearsal.timeEnd}</span></div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <div className="schedule-card__title"><span className="card-kind-badge card-kind-badge--rehearsal" style={rehearsal.isGlobal ? { color: "#5eead4", borderColor: "rgba(94,234,212,.4)", background: "rgba(45,212,191,.1)" } : undefined}>{rehearsal.isGlobal ? "ОБЩАЯ РЕПА" : "РЕПА"}</span><h2>{rehearsal.subject}</h2></div>
          {own && onDelete && <button type="button" className="rehearsal-delete" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Удалить</button>}
        </div>
        <div className="schedule-card__meta"><span>автор: {rehearsal.creatorName ?? (rehearsal.isGlobal ? "Администратор" : "не указан")}</span><span aria-hidden="true">·</span><span>ответственный: {rehearsal.responsible}</span><span aria-hidden="true">·</span><span>{rehearsal.isGlobal ? "вся группа" : `${rehearsal.participants.length} участн.`}</span></div>
      </div>
    </article>
  );
}
