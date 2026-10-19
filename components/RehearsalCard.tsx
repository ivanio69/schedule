import { getRehearsalAudienceNames, isRehearsalParticipant } from "@/lib/rehearsals";
import type { Rehearsal } from "@/lib/schedule";

export function RehearsalCard({ rehearsal, own, personId, personName, conflictWith = [], onDelete, onClick }: { rehearsal: Rehearsal; own: boolean; personId: string; personName: string; conflictWith?: string[]; onDelete?: () => void; onClick?: () => void }) {
  const audience = getRehearsalAudienceNames(rehearsal).length;
  const participating = isRehearsalParticipant(rehearsal, personId, personName);
  const blocks = rehearsal.blocks?.length ?? 0;
  return (
    <article className={`rehearsal-card${!participating ? " is-non-participant" : ""}${rehearsal.isGlobal ? " is-global" : ""}${conflictWith.length ? " schedule-card--conflict" : ""}`} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}>
      <div className="schedule-card__time" aria-label={`Время: ${rehearsal.timeStart} — ${rehearsal.timeEnd}`}><span>{rehearsal.timeStart}</span><span>{rehearsal.timeEnd}</span></div>
      <div className="schedule-card__body">
        <div className="schedule-card__title-row">
          <div className="schedule-card__title"><span className="card-kind-badge card-kind-badge--rehearsal">{rehearsal.isGlobal ? "ОБЩАЯ РЕПА" : "РЕПА"}</span>{!participating && <span className="rehearsal-participation-badge">Вы не участвуете</span>}{conflictWith.length>0&&<span className="card-kind-badge card-kind-badge--conflict" title={`Пересекается с: ${conflictWith.join(", ")}`}>КОНФЛИКТ</span>}<h2>{rehearsal.subject}</h2></div>
          {own && onDelete && <button type="button" className="rehearsal-delete" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Удалить</button>}
        </div>
        <div className="schedule-card__meta">
          <span>автор: {rehearsal.creatorName ?? (rehearsal.isGlobal ? "Администратор" : "не указан")}</span><span aria-hidden="true">·</span>
          <span>ответственный: {rehearsal.responsible}</span>
          {blocks > 0 && <><span aria-hidden="true">·</span><span>{blocks} {blocks === 1 ? "блок" : "блоков"}</span></>}
          <span aria-hidden="true">·</span><span>{rehearsal.isGlobal ? `общая · приглашено ${audience}` : `${audience} участн.`}</span>
        </div>
      </div>
    </article>
  );
}
