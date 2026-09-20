import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import type { Rehearsal } from "@/lib/schedule";
import PersonalEventNote from "@/components/PersonalEventNote";

export function RehearsalCard({ rehearsal, own, conflictWith = [], onDelete, onClick }: { rehearsal: Rehearsal; own: boolean; conflictWith?: string[]; onDelete?: () => void; onClick?: () => void }) {
  const audience = getRehearsalAudienceNames(rehearsal).length;
  const blocks = rehearsal.blocks?.length ?? 0;
  return (
    <article className={`rehearsal-card${rehearsal.isGlobal ? " is-global" : ""}${conflictWith.length ? " schedule-card--conflict" : ""}`} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}>
      <div className="schedule-card__time" aria-label={`Время: ${rehearsal.timeStart} — ${rehearsal.timeEnd}`}><span>{rehearsal.timeStart}</span><span>{rehearsal.timeEnd}</span></div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <div className="schedule-card__title"><span className="card-kind-badge card-kind-badge--rehearsal">{rehearsal.isGlobal ? "ОБЩАЯ РЕПА" : "РЕПА"}</span>{conflictWith.length>0&&<span className="card-kind-badge card-kind-badge--conflict" title={`Пересекается с: ${conflictWith.join(", ")}`}>КОНФЛИКТ</span>}<h2>{rehearsal.subject}</h2></div>
          {own && onDelete && <button type="button" className="rehearsal-delete" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Удалить</button>}
        </div>
        <div className="schedule-card__meta">
          <span>автор: {rehearsal.creatorName ?? (rehearsal.isGlobal ? "Администратор" : "не указан")}</span><span aria-hidden="true">·</span>
          <span>ответственный: {rehearsal.responsible}</span>
          {blocks > 0 && <><span aria-hidden="true">·</span><span>{blocks} {blocks === 1 ? "блок" : "блоков"}</span></>}
          {rehearsal.tags?.length ? <><span aria-hidden="true">·</span><span>{rehearsal.tags.map(tag => `#${tag}`).join(" ")}</span></> : null}
          <span aria-hidden="true">·</span><span>{rehearsal.isGlobal ? `общая · приглашено ${audience}` : `${audience} участн.`}</span>
        </div>
        <PersonalEventNote noteKey={`rehearsal:${rehearsal.id}`}/>
      </div>
    </article>
  );
}
