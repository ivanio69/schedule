"use client";

import { useEffect, useState } from "react";
import type { Rehearsal } from "@/lib/schedule";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import LoadingState from "@/components/LoadingState";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`)); }

export default function DashboardRehearsals() {
  const [items, setItems] = useState<Rehearsal[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const personId = localStorage.getItem("schedule_person_id");
    if (!personId) { setReady(true); return; }
    let stopped = false;
    const load = async () => { try {
      const response = await fetch(`/api/rehearsals?personId=${encodeURIComponent(personId)}`, { cache: "no-store" }); if (!response.ok) return;
      const data = await response.json() as { rehearsals?: Rehearsal[] }; if (stopped) return;
      const today = new Date(), from = dateKey(today), until = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
      setItems((data.rehearsals ?? []).filter(item => item.date >= from && item.date < until).sort((a,b)=>`${a.date}${a.timeStart}`.localeCompare(`${b.date}${b.timeStart}`)));
    } finally { if (!stopped) setReady(true); } };
    void load(); return () => { stopped = true; };
  }, []);
  if (!ready) return <section className="dashboard-rehearsals"><LoadingState compact label="Загружаем репетиции" detail="Проверяем ближайшие события."/></section>;
  if (items.length === 0) return null;
  return <section className="dashboard-rehearsals" aria-label="Ближайшие репетиции">
    <div className="dashboard-rehearsals__head"><h2>Ближайшие репетиции</h2><span>{items.length}</span></div>
    <div className="dashboard-rehearsals__list">
      {items.map(item => <article key={item.id} className={item.isGlobal ? "dashboard-rehearsal is-global" : "dashboard-rehearsal"}>
        <div className="dashboard-rehearsal__top">
          <span className="dashboard-rehearsal__kind">{item.isGlobal ? "ОБЩАЯ РЕПЕТИЦИЯ" : "РЕПЕТИЦИЯ"}</span>
          <div className="dashboard-rehearsal__when">
            <time dateTime={item.date}>{formatDate(item.date)}</time>
            <span aria-hidden="true">·</span>
            <strong>{item.timeStart}–{item.timeEnd}</strong>
          </div>
        </div>
        <h3>{item.subject}</h3>
        <div className="dashboard-rehearsal__meta">
          <span>Ответственный: {item.responsible}</span>
          <span>Автор: {item.creatorName ?? (item.isGlobal ? "Администратор" : "не указан")}</span>
          {item.blocks?.length ? <span>{item.blocks.length} блоков</span> : null}
          <span>{getRehearsalAudienceNames(item).length} приглаш.</span>
        </div>
      </article>)}
    </div>
    <style jsx>{`
      .dashboard-rehearsals{width:min(calc(100% - 28px),980px);margin:0 auto 56px}
      .dashboard-rehearsals__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .dashboard-rehearsals__head h2{margin:0;font-size:21px;letter-spacing:-.025em}
      .dashboard-rehearsals__head>span{color:var(--muted);font-size:12px}
      .dashboard-rehearsals__list{display:grid;gap:9px}
      .dashboard-rehearsal{display:grid;gap:9px;min-width:0;padding:16px 18px;border:1px solid color-mix(in srgb,var(--rehearsal) 34%,var(--border));border-radius:16px;background:color-mix(in srgb,var(--rehearsal) 5%,var(--surface));box-shadow:inset 3px 0 0 var(--rehearsal)}
      .dashboard-rehearsal.is-global{border-color:color-mix(in srgb,#5eead4 40%,var(--border));background:color-mix(in srgb,#5eead4 6%,var(--surface));box-shadow:inset 3px 0 0 #5eead4}
      .dashboard-rehearsal__top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:7px 16px;min-width:0}
      .dashboard-rehearsal__kind{color:var(--rehearsal);font-size:9px;font-weight:800;letter-spacing:.09em}
      .dashboard-rehearsal.is-global .dashboard-rehearsal__kind{color:#5eead4}
      .dashboard-rehearsal__when{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;min-width:0;font-variant-numeric:tabular-nums;white-space:nowrap}
      .dashboard-rehearsal__when time{font-size:11px;color:var(--muted)}
      .dashboard-rehearsal__when>span{color:var(--muted);font-size:10px}
      .dashboard-rehearsal__when strong{font-size:13px;font-weight:800;letter-spacing:-.02em;color:var(--text)}
      .dashboard-rehearsal h3{margin:0;font-size:15px;line-height:1.4;overflow-wrap:anywhere}
      .dashboard-rehearsal__meta{display:flex;align-items:center;flex-wrap:wrap;gap:3px 13px;color:var(--muted);font-size:10px;line-height:1.55}
      .dashboard-rehearsal__meta span{min-width:0;overflow-wrap:anywhere}
      @media(max-width:650px){
        .dashboard-rehearsals{width:calc(100% - 20px);margin-bottom:36px}
        .dashboard-rehearsal{padding:14px;gap:8px}
        .dashboard-rehearsal__top{align-items:flex-start;flex-direction:column;gap:8px}
        .dashboard-rehearsal__when{width:100%;justify-content:space-between;gap:8px}
        .dashboard-rehearsal__when>span{display:none}
      }
    `}</style>
  </section>;
}
