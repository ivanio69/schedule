"use client";

import { useCallback, useEffect, useState } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";

type Check = { id: string; label: string; status: "ok" | "warn" | "error"; detail: string };
type Note = { id: string; title: string; detail: string };
type Diagnostics = {
  generatedAt: string;
  version: string;
  release: string;
  pr: number;
  environment: string;
  databaseLatencyMs: number | null;
  checks: Check[];
  notes: Note[];
  runtime: null | { region:string|null;commitSha:string|null;deploymentUrl:string|null;productionUrl:string|null;node:string;uptimeSeconds:number };
  roles: null | { admin:number;headman:number;user:number };
  counts: null | {
    people:number;activePeople:number;lessons:number;rehearsals:number;individualLessons:number;individualSlots:number;seminarLists:number;
    pushSubscriptions:number;pushUsers:number;calendarSubscriptions:number;usageSessions:number;analyticsUsers:number;announcements:number;
    activeAnnouncements:number;quotes:number;activeQuotes:number;scheduleChanges:number;profileSettings:number;
  };
};

const statusText = { ok: "Работает", warn: "Внимание", error: "Ошибка" } as const;
const duration=(seconds:number)=>seconds<60?`${seconds} сек`:seconds<3600?`${Math.round(seconds/60)} мин`:`${Math.round(seconds/3600)} ч`;

export default function AdminDiagnostics() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);setError("");
    try {
      const response = await fetch("/api/admin/diagnostics", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok && !payload?.diagnostics) throw new Error(payload?.error ?? "Не удалось собрать диагностику");
      setData(payload.diagnostics);
      if (!response.ok) setError("Часть проверок завершилась ошибкой");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось собрать диагностику");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const counts=data?.counts;

  return <>
    <AdminHeading title="Диагностика" description="Состояние данных, ролей, аналитики, Push и инфраструктуры без показа секретов." actions={<button className="admin-secondary" disabled={loading} onClick={() => void load()}>↻ Проверить снова</button>}/>
    {loading&&!data?<LoadingState compact label="Проверяем систему" detail="Пингуем базу и собираем состояние сервисов."/>:null}
    {data?<>
      <section className="admin-diagnostics-summary">
        <article><span>Версия</span><strong>{data.version}</strong><small>PR #{data.pr} · {data.environment}</small></article>
        <article><span>MongoDB</span><strong>{data.databaseLatencyMs===null?"—":`${data.databaseLatencyMs} мс`}</strong><small>server-side ping</small></article>
        <article><span>Проверки</span><strong>{data.checks.filter(check=>check.status==="ok").length}/{data.checks.length}</strong><small>{data.checks.filter(check=>check.status!=="ok").length?"есть пункты для внимания":"все проверки зелёные"}</small></article>
        <article><span>Runtime</span><strong>{data.runtime?.region??"local"}</strong><small>{data.runtime?.commitSha?data.runtime.commitSha.slice(0,7)+" · ":""}uptime {data.runtime?duration(data.runtime.uptimeSeconds):"—"}</small></article>
      </section>

      <section className="admin-card admin-diagnostics-checks">
        <header><div><p className="admin-eyebrow">Сервисы</p><h2>Состояние системы</h2></div><small>{new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(data.generatedAt))}</small></header>
        <div>{data.checks.map(check=><article key={check.id} className={`is-${check.status}`}><span className="admin-diagnostics-dot" aria-hidden="true"/><div><strong>{check.label}</strong><small>{check.detail}</small></div><b>{statusText[check.status]}</b></article>)}</div>
      </section>

      {data.notes?.length?<section className="admin-card admin-diagnostics-notes"><header><div><p className="admin-eyebrow">Инфраструктура</p><h2>Полезно знать</h2></div></header><div>{data.notes.map(note=><article key={note.id}><strong>{note.title}</strong><p>{note.detail}</p></article>)}</div></section>:null}

      {data.roles&&<section className="admin-card admin-diagnostics-roles"><header><div><p className="admin-eyebrow">Доступ</p><h2>Роли</h2></div></header><div><article><span>Админы</span><strong>{data.roles.admin}</strong></article><article><span>Старосты</span><strong>{data.roles.headman}</strong></article><article><span>Пользователи</span><strong>{data.roles.user}</strong></article></div></section>}

      {counts&&<section className="admin-card admin-diagnostics-counts"><header><div><p className="admin-eyebrow">Данные</p><h2>Контрольные счётчики</h2></div></header><div className="admin-diagnostics-count-grid">
        <article><span>Люди</span><strong>{counts.activePeople}/{counts.people}</strong></article>
        <article><span>Пары</span><strong>{counts.lessons}</strong><small>{counts.scheduleChanges} изменений</small></article>
        <article><span>Репетиции</span><strong>{counts.rehearsals}</strong></article>
        <article><span>Индивидуальные</span><strong>{counts.individualLessons}</strong><small>{counts.individualSlots} слотов</small></article>
        <article><span>Семинары</span><strong>{counts.seminarLists}</strong></article>
        <article><span>Push</span><strong>{counts.pushSubscriptions}</strong><small>{counts.pushUsers} пользователей</small></article>
        <article><span>Аналитика</span><strong>{counts.usageSessions}</strong><small>{counts.analyticsUsers} профилей</small></article>
        <article><span>Объявления</span><strong>{counts.activeAnnouncements}/{counts.announcements}</strong><small>активных / всего</small></article>
        <article><span>Цитаты</span><strong>{counts.activeQuotes}/{counts.quotes}</strong><small>активных / всего</small></article>
        <article><span>Настройки</span><strong>{counts.profileSettings}</strong><small>облачных профилей</small></article>
        <article><span>Apple Calendar</span><strong>{counts.calendarSubscriptions}</strong></article>
      </div></section>}
    </>:null}
    {error&&<p className="admin-error">{error}</p>}
    <style jsx>{`
      .admin-diagnostics-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px}
      .admin-diagnostics-summary article{display:grid;gap:5px;padding:16px 18px;border:1px solid var(--border);border-radius:15px;background:var(--surface)}
      .admin-diagnostics-summary span,.admin-diagnostics-summary small{color:var(--muted);font-size:10px}.admin-diagnostics-summary strong{font-size:20px}
      .admin-diagnostics-checks,.admin-diagnostics-counts,.admin-diagnostics-notes,.admin-diagnostics-roles{margin-top:12px;overflow:hidden}
      .admin-diagnostics-checks>header,.admin-diagnostics-counts>header,.admin-diagnostics-notes>header,.admin-diagnostics-roles>header{display:flex;align-items:center;justify-content:space-between;padding:17px 18px;border-bottom:1px solid var(--border)}
      .admin-diagnostics-checks h2,.admin-diagnostics-counts h2,.admin-diagnostics-notes h2,.admin-diagnostics-roles h2{margin:0;font-size:18px}.admin-diagnostics-checks header small{color:var(--muted);font-size:10px}
      .admin-diagnostics-checks>div>article{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 18px;border-bottom:1px solid var(--border)}.admin-diagnostics-checks>div>article:last-child{border-bottom:0}.admin-diagnostics-checks article>div{display:grid;gap:3px}.admin-diagnostics-checks article strong{font-size:12px}.admin-diagnostics-checks article small{color:var(--muted);font-size:10px;line-height:1.45}.admin-diagnostics-checks article>b{font-size:10px}
      .admin-diagnostics-dot{width:8px;height:8px;border-radius:50%;background:#72d18a;box-shadow:0 0 0 4px color-mix(in srgb,#72d18a 12%,transparent)}.is-warn .admin-diagnostics-dot{background:#f5c16c;box-shadow:0 0 0 4px color-mix(in srgb,#f5c16c 12%,transparent)}.is-error .admin-diagnostics-dot{background:#ff7f87;box-shadow:0 0 0 4px color-mix(in srgb,#ff7f87 12%,transparent)}.is-ok>b{color:#72d18a}.is-warn>b{color:#f5c16c}.is-error>b{color:#ff7f87}
      .admin-diagnostics-count-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border)}.admin-diagnostics-count-grid article{display:grid;gap:4px;padding:15px;background:var(--surface)}.admin-diagnostics-count-grid span,.admin-diagnostics-count-grid small{color:var(--muted);font-size:10px}.admin-diagnostics-count-grid strong{font-size:18px}
      .admin-diagnostics-notes>div{display:grid;gap:0}.admin-diagnostics-notes article{padding:15px 18px;border-bottom:1px solid var(--border)}.admin-diagnostics-notes article:last-child{border-bottom:0}.admin-diagnostics-notes strong{font-size:12px}.admin-diagnostics-notes p{margin:5px 0 0;color:var(--muted);font-size:10px;line-height:1.55}
      .admin-diagnostics-roles>div{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border)}.admin-diagnostics-roles article{display:grid;gap:4px;padding:15px;background:var(--surface)}.admin-diagnostics-roles span{color:var(--muted);font-size:10px}.admin-diagnostics-roles strong{font-size:20px}
      @media(max-width:900px){.admin-diagnostics-summary{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:720px){.admin-diagnostics-summary{grid-template-columns:1fr}.admin-diagnostics-count-grid{grid-template-columns:repeat(2,1fr)}.admin-diagnostics-roles>div{grid-template-columns:1fr}.admin-diagnostics-checks>div>article{grid-template-columns:10px minmax(0,1fr)}.admin-diagnostics-checks article>b{grid-column:2}}
    `}</style>
  </>;
}
