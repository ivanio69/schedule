"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { Rehearsal } from "@/lib/schedule";
import type { Person } from "@/lib/people";
import { getRehearsalAudienceNames } from "@/lib/rehearsals";
import EventDetailsContent from "@/components/EventDetailsContent";
import LoadingState from "@/components/LoadingState";

const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(value + "T12:00:00"));
}
function formatDatePart(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ru-RU", options).format(new Date(value + "T12:00:00"));
}
function plural(count: number, one: string, few: string, many: string) {
  const tens = count % 100;
  if (tens >= 11 && tens <= 14) return many;
  const unit = count % 10;
  return unit === 1 ? one : unit >= 2 && unit <= 4 ? few : many;
}

export default function DashboardRehearsals() {
  const [items, setItems] = useState<Rehearsal[]>([]);
  const [ready, setReady] = useState(false);
  const [personId, setPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalReady, setModalReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const selected = items.find(item => item.id === selectedId);

  useEffect(() => {
    setModalReady(true);
    const id = localStorage.getItem("schedule_person_id") ?? "";
    setPersonId(id);
    if (!id) { setReady(true); return; }
    let stopped = false;
    const load = async () => {
      try {
        const [rehearsalsResponse, peopleResponse] = await Promise.all([
          fetch("/api/rehearsals?personId=" + encodeURIComponent(id), { cache: "no-store" }),
          fetch("/api/people", { cache: "no-store" }),
        ]);
        if (peopleResponse.ok) {
          const data = await peopleResponse.json() as { people?: Person[] };
          if (!stopped) setPersonName(data.people?.find(person => person.id === id)?.name ?? "");
        }
        if (!rehearsalsResponse.ok) return;
        const data = await rehearsalsResponse.json() as { rehearsals?: Rehearsal[] };
        if (stopped) return;
        const today = new Date();
        const from = dateKey(today);
        const until = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
        setItems((data.rehearsals ?? [])
          .filter(item => item.date >= from && item.date < until)
          .sort((a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart)));
      } catch (error) {
        console.error("Failed to load dashboard rehearsals", error);
      } finally {
        if (!stopped) setReady(true);
      }
    };
    void load();
    return () => { stopped = true; };
  }, []);

  const close = () => {
    setSelectedId(null);
    setExiting(true);
    lastTrigger.current?.focus();
  };

  useEffect(() => {
    if (!selected && !exiting) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected, exiting]);

  const deleteRehearsal = async (item: Rehearsal) => {
    if (!personId || item.creatorId !== personId) return;
    try {
      const response = await fetch("/api/rehearsals?id=" + encodeURIComponent(item.id) + "&creatorId=" + encodeURIComponent(personId), { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить репетицию");
      setItems(current => current.filter(value => value.id !== item.id));
      close();
    } catch (error) {
      console.error("Failed to delete dashboard rehearsal", error);
    }
  };

  return <>
    {!ready ? <section className="dashboard-rehearsals"><LoadingState compact label="Загружаем репетиции" detail="Проверяем ближайшие события."/></section> : items.length > 0 ? (
      <section className="dashboard-rehearsals" aria-label="Ближайшие репетиции">
        <div className="dashboard-rehearsals__head">
          <h2>Ближайшие репетиции</h2>
          <span className="dashboard-rehearsals__count">{items.length}</span>
        </div>
        <div className="dashboard-rehearsals__list">
          {items.map(item => {
            const blocks = item.blocks?.length ?? 0;
            const participants = getRehearsalAudienceNames(item).length;
            return <button
              type="button"
              key={item.id}
              className={item.isGlobal ? "dashboard-rehearsal is-global" : "dashboard-rehearsal"}
              onClick={event => { lastTrigger.current = event.currentTarget; setSelectedId(item.id); }}
              aria-label={"Открыть репетицию «" + item.subject + "» " + formatDate(item.date) + ", " + item.timeStart}
            >
              <span className="dashboard-rehearsal__date">
                <span className="dashboard-rehearsal__start">{item.timeStart}</span>
                <span className="dashboard-rehearsal__end">до {item.timeEnd}</span>
                <span className="dashboard-rehearsal__date-rule" aria-hidden="true"/>
                <time dateTime={item.date} className="dashboard-rehearsal__day">{formatDatePart(item.date, { day: "numeric", month: "short" })}</time>
                <span className="dashboard-rehearsal__weekday">{formatDatePart(item.date, { weekday: "long" })}</span>
              </span>
              <span className="dashboard-rehearsal__main">
                <span className="dashboard-rehearsal__top">
                  <span className="dashboard-rehearsal__kind"><span className="dashboard-rehearsal__dot" aria-hidden="true"/>{item.isGlobal ? "ОБЩАЯ РЕПЕТИЦИЯ" : "РЕПЕТИЦИЯ"}</span>
                  <span className="dashboard-rehearsal__arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
                  </span>
                </span>
                <strong className="dashboard-rehearsal__subject">{item.subject}</strong>
                {item.responsible && <span className="dashboard-rehearsal__responsible">Ответственный: {item.responsible}</span>}
                <span className="dashboard-rehearsal__meta">
                  {blocks > 0 && <span className="dashboard-rehearsal__chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h5"/></svg>
                    {blocks} {plural(blocks, "блок", "блока", "блоков")}
                  </span>}
                  <span className="dashboard-rehearsal__chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="3"/><path d="M3.8 19v-1.2A4.8 4.8 0 0 1 8.6 13h.8a4.8 4.8 0 0 1 4.8 4.8V19M17 8a2.5 2.5 0 0 1 0 5m2.4 1.6c.7.7 1.1 1.7 1.1 2.7V19"/></svg>
                    {participants} {plural(participants, "участник", "участника", "участников")}
                  </span>
                </span>
              </span>
            </button>;
          })}
        </div>
      </section>
    ) : null}
    {modalReady && createPortal(
      <AnimatePresence initial={false} onExitComplete={() => setExiting(false)}>
        {selected && <motion.div className="details-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}
          initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: .14, ease: [.22, 1, .36, 1] } }}
          exit={{ opacity: 0, transition: { duration: .12, ease: [.4, 0, 1, 1] } }}>
          <motion.section className="details-modal details-modal--rehearsal" role="dialog" aria-modal="true" aria-labelledby="dashboard-rehearsal-title"
            initial={{ opacity: 0, y: 14, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: .18, ease: [.22, 1, .36, 1] } }}
            exit={{ opacity: 0, y: 8, scale: .992, transition: { duration: .12, ease: [.4, 0, 1, 1] } }}>
            <div className="details-modal__header"><div>
              <span className="details-modal__eyebrow">Репетиция</span>
              <h2 id="dashboard-rehearsal-title">{selected.subject}</h2>
            </div><button type="button" className="details-modal__close" onClick={close} aria-label="Закрыть">×</button></div>
            <EventDetailsContent
              details={{ type: "rehearsal", item: selected }}
              lessonDate={selected.date}
              creatorId={personId}
              personName={personName}
              onDeleteRehearsal={item => void deleteRehearsal(item)}
            />
          </motion.section>
        </motion.div>}
      </AnimatePresence>, document.body)}
    <style jsx>{`
      .dashboard-rehearsals{width:min(calc(100% - 28px),980px);margin:0 auto 56px}
      .dashboard-rehearsals__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .dashboard-rehearsals__head h2{margin:0;font-size:21px;letter-spacing:-.035em;font-weight:680}
      .dashboard-rehearsals__count{display:grid;place-items:center;min-width:28px;height:28px;padding:0 8px;border:1px solid var(--border);border-radius:10px;background:var(--surface-raised);color:var(--muted-strong);font-size:11px;font-weight:750;font-variant-numeric:tabular-nums}
      .dashboard-rehearsals__list{display:grid;gap:10px}
      .dashboard-rehearsal{--card-accent:var(--rehearsal);display:grid;grid-template-columns:116px minmax(0,1fr);gap:0;position:relative;isolation:isolate;width:100%;min-width:0;padding:0;overflow:hidden;border:1px solid color-mix(in srgb,var(--card-accent) 30%,var(--border));border-radius:18px;background:linear-gradient(108deg,color-mix(in srgb,var(--card-accent) 6%,var(--surface)),var(--surface) 60%);color:var(--text);text-align:left;cursor:pointer;box-shadow:inset 3px 0 0 var(--card-accent),0 3px 15px color-mix(in srgb,var(--bg) 26%,transparent);transition:border-color .2s ease,background .2s ease,box-shadow .2s ease}
      .dashboard-rehearsal.is-global{--card-accent:#5eead4}
      .dashboard-rehearsal:hover{border-color:color-mix(in srgb,var(--card-accent) 65%,var(--border));background:linear-gradient(108deg,color-mix(in srgb,var(--card-accent) 11%,var(--surface)),var(--surface) 75%);box-shadow:inset 3px 0 0 var(--card-accent),0 9px 24px color-mix(in srgb,var(--bg) 46%,transparent)}
      .dashboard-rehearsal:focus-visible{outline:2px solid var(--card-accent);outline-offset:3px}
      .dashboard-rehearsal__date{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:2px;min-width:0;padding:19px 13px 18px 16px;border-right:1px solid color-mix(in srgb,var(--card-accent) 14%,var(--border));background:linear-gradient(165deg,color-mix(in srgb,var(--card-accent) 10%,var(--surface)),color-mix(in srgb,var(--card-accent) 3%,var(--surface)))}
      .dashboard-rehearsal__start{font-size:20px;font-weight:740;letter-spacing:-.055em;line-height:1.15;font-variant-numeric:tabular-nums}
      .dashboard-rehearsal__end{color:var(--muted);font-size:11px;font-weight:620;line-height:1.4;font-variant-numeric:tabular-nums}
      .dashboard-rehearsal__date-rule{display:block;width:24px;height:1px;margin:8px 0;background:color-mix(in srgb,var(--card-accent) 55%,var(--border))}
      .dashboard-rehearsal__day{color:var(--muted-strong);font-size:11px;line-height:1.35;font-weight:720;white-space:nowrap}
      .dashboard-rehearsal__weekday{max-width:100%;color:var(--muted);font-size:10px;line-height:1.35;overflow-wrap:anywhere}
      .dashboard-rehearsal__main{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:8px;min-width:0;padding:16px 18px 17px 19px}
      .dashboard-rehearsal__top{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0}
      .dashboard-rehearsal__kind{display:inline-flex;align-items:center;gap:7px;color:color-mix(in srgb,var(--card-accent) 80%,var(--text));font-size:9px;font-weight:810;letter-spacing:.09em;line-height:1.3}
      .dashboard-rehearsal__dot{display:block;flex:none;width:6px;height:6px;border-radius:50%;background:var(--card-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--card-accent) 14%,transparent)}
      .dashboard-rehearsal__arrow{display:grid;place-items:center;flex:none;width:27px;height:27px;border:1px solid var(--border);border-radius:9px;background:color-mix(in srgb,var(--surface-raised) 85%,transparent);color:var(--muted);transition:color .2s,border-color .2s,background .2s}
      .dashboard-rehearsal__arrow svg{display:block;width:15px;height:15px;transition:transform .2s}
      .dashboard-rehearsal:hover .dashboard-rehearsal__arrow{color:var(--card-accent);border-color:color-mix(in srgb,var(--card-accent) 35%,var(--border));background:color-mix(in srgb,var(--card-accent) 9%,var(--surface))}
      .dashboard-rehearsal:hover .dashboard-rehearsal__arrow svg{transform:translateX(2px)}
      .dashboard-rehearsal__subject{display:block;width:100%;font-size:17px;line-height:1.3;font-weight:680;letter-spacing:-.022em;overflow-wrap:anywhere}
      .dashboard-rehearsal__responsible{display:block;color:var(--muted-strong);font-size:12px;line-height:1.45;overflow-wrap:anywhere}
      .dashboard-rehearsal__meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:3px}
      .dashboard-rehearsal__chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:4px 8px;border:1px solid color-mix(in srgb,var(--card-accent) 16%,var(--border));border-radius:8px;background:color-mix(in srgb,var(--card-accent) 5%,var(--surface));color:var(--muted-strong);font-size:10px;font-weight:650;line-height:1.2}
      .dashboard-rehearsal__chip svg{display:block;flex:none;width:13px;height:13px;color:color-mix(in srgb,var(--card-accent) 72%,var(--muted))}
      @media(max-width:650px){
        .dashboard-rehearsals{width:calc(100% - 20px);margin-bottom:36px}
        .dashboard-rehearsal{grid-template-columns:93px minmax(0,1fr);border-radius:16px}
        .dashboard-rehearsal__date{padding:15px 9px 15px 13px}
        .dashboard-rehearsal__start{font-size:17px}
        .dashboard-rehearsal__day{font-size:10px}
        .dashboard-rehearsal__weekday{font-size:9px}
        .dashboard-rehearsal__main{gap:7px;padding:14px 12px 15px}
        .dashboard-rehearsal__subject{font-size:15px}
        .dashboard-rehearsal__responsible{font-size:11px}
        .dashboard-rehearsal__chip{padding:4px 6px;font-size:9px}
        .dashboard-rehearsal__arrow{width:25px;height:25px}
      }
      @media(prefers-reduced-motion:reduce){
        .dashboard-rehearsal,.dashboard-rehearsal__arrow,.dashboard-rehearsal__arrow svg{transition:none}
        .dashboard-rehearsal:hover .dashboard-rehearsal__arrow svg{transform:none}
      }
    `}</style>
  </>;
}
