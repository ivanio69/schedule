import type { Rehearsal } from "@/lib/schedule";

export function RehearsalCard({ rehearsal, own, onDelete, onClick }: { rehearsal: Rehearsal; own: boolean; onDelete?: () => void; onClick?: () => void }) {
  return (
    <>
      <style>{`.details-backdrop{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-end;justify-content:center;padding:16px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}.details-modal{position:relative;width:min(100%,520px);max-height:min(82vh,680px);overflow:auto;padding:28px 24px 24px;border:1px solid var(--border);border-radius:24px;background:linear-gradient(145deg,#17171b,#0f0f12);box-shadow:0 24px 80px rgba(0,0,0,.5)}.details-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:1px solid var(--border);border-radius:10px;color:var(--muted);background:var(--surface);cursor:pointer;font-size:22px;line-height:1}.details-close:hover{color:var(--text);background:var(--surface-hover)}.details-kicker{margin:0 0 8px;color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.details-modal h2{margin:0;padding-right:40px;font-size:25px;line-height:1.2;letter-spacing:-.035em}.details-date{margin:7px 0 0;color:var(--muted);font-size:13px}.details-time{display:flex;align-items:center;gap:10px;margin:24px 0;padding:16px;border:1px solid var(--border);border-radius:16px;background:rgba(255,255,255,.035)}.details-time strong{font-size:21px;letter-spacing:-.03em}.details-time span{color:var(--muted)}.details-list{display:grid;margin:0;border-top:1px solid var(--border)}.details-list>div{display:grid;grid-template-columns:130px 1fr;gap:16px;padding:13px 0;border-bottom:1px solid var(--border)}.details-list dt{color:var(--muted);font-size:11px}.details-list dd{margin:0;color:var(--text);font-size:13px;line-height:1.45;text-align:right}.details-delete{width:100%;margin-top:18px;padding:10px 13px;border:1px solid rgba(255,155,155,.25);border-radius:11px;color:#ff9b9b;background:transparent;cursor:pointer;font-size:12px;font-weight:700}.details-delete:hover{background:rgba(255,155,155,.08)}.schedule-card[role=button],.rehearsal-card[role=button]{cursor:pointer}.schedule-card[role=button]:focus-visible,.rehearsal-card[role=button]:focus-visible{outline:2px solid #fff;outline-offset:3px}@media (min-width:601px){.details-backdrop{align-items:center}}@media (max-width:600px){.details-modal{padding:25px 18px 18px;border-radius:22px}.details-list>div{grid-template-columns:105px 1fr}.details-time{margin:20px 0}}`}</style>
      <article
        className="rehearsal-card"
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(event) => {
          if (onClick && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onClick();
          }
        }}
      >
        <div className="schedule-card__time" aria-label={`Время: ${rehearsal.timeStart} — ${rehearsal.timeEnd}`}>
          <span>{rehearsal.timeStart}</span><span>{rehearsal.timeEnd}</span>
        </div>
        <div className="schedule-card__body">
          <div className="schedule-card__title-row">
            <div><span className="rehearsal-label">Репетиция</span><h2>{rehearsal.subject}</h2></div>
            {own && onDelete && <button type="button" className="rehearsal-delete" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Удалить</button>}
          </div>
          <div className="schedule-card__meta">
            <span>ответственный: {rehearsal.responsible}</span><span aria-hidden="true">·</span>
            <span>{rehearsal.participants.length} участн.</span>
          </div>
        </div>
      </article>
    </>
  );
}
