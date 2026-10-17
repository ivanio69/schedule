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
                    {blocks} {blocks === 1 ? "блок" : blocks < 5 ? "блока" : "блоков"}
                  </span>}
                  <span className="dashboard-rehearsal__chip">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="3"/><path d="M3.8 19v-1.2A4.8 4.8 0 0 1 8.6 13h.8a4.8 4.8 0 0 1 4.8 4.8V19M17 8a2.5 2.5 0 0 1 0 5m2.4 1.6c.7.7 1.1 1.7 1.1 2.7V19"/></svg>
                    {participants} {participants === 1 ? "участник" : participants < 5 ? "участника" : "участников"}
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
      .dashboard-rehearsals__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .dashboard-rehearsals__head h2{margin:0;font-size:21px;letter-spacing:-.025em}
      .dashboard-rehearsals__head>span{color:var(--muted);font-size:12px}
      .dashboard-rehearsals__list{display:grid;gap:9px}
      .dashboard-rehearsal{display:grid;grid-template-columns:116px minmax(0,1fr);gap:0;min-width:0;width:100%;padding:0;border:1px solid color-mix(in srgb,var(--rehearsal) 34%,var(--border));border-radius:16px;background:color-mix(in srgb,var(--rehearsal) 5%,var(--surface));box-shadow:inset 3px 0 0 var(--rehearsal);color:var(--text);text-align:left;cursor:pointer;overflow:hidden}
      .dashboard-rehearsal:hover{border-color:color-mix(in srgb,var(--rehearsal) 62%,var(--border));background:color-mix(in srgb,var(--rehearsal) 9%,var(--surface))}
      .dashboard-rehearsal:focus-visible{outline:2px solid var(--rehearsal);outline-offset:2px}
      .dashboard-rehearsal.is-global{border-color:color-mix(in srgb,#5eead4 40%,var(--border));background:color-mix(in srgb,#5eead4 6%,var(--surface));box-shadow:inset 3px 0 0 #5eead4}
      .dashboard-rehearsal__date{display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;padding:16px 13px;border-right:1px solid var(--border);background:color-mix(in srgb,var(--rehearsal) 5%,var(--surface))}
      .dashboard-rehearsal__start{font-size:17px;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
      .dashboard-rehearsal__end{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
      .dashboard-rehearsal__date time{font-size:10px;margin-top:8px;line-height:1.3;color:var(--muted);overflow-wrap:anywhere}
      .dashboard-rehearsal__main{display:flex;flex-direction:column;gap:6px;min-width:0;padding:16px 18px}
      .dashboard-rehearsal__kind{color:var(--rehearsal);font-size:9px;font-weight:800;letter-spacing:.09em}
      .dashboard-rehearsal.is-global .dashboard-rehearsal__kind{color:#5eead4}
      .dashboard-rehearsal__subject{font-size:16px;line-height:1.35;font-weight:680;overflow-wrap:anywhere}
      .dashboard-rehearsal__meta{display:flex;align-items:center;flex-wrap:wrap;gap:3px 12px;color:var(--muted);font-size:11px;line-height:1.5}
      .dashboard-rehearsal__meta span{min-width:0;overflow-wrap:anywhere}
      @media(max-width:650px){
        .dashboard-rehearsals{width:calc(100% - 20px);margin-bottom:36px}
        .dashboard-rehearsal{grid-template-columns:86px minmax(0,1fr)}
        .dashboard-rehearsal__date{padding:13px 10px}
        .dashboard-rehearsal__start{font-size:15px}
        .dashboard-rehearsal__date time{font-size:9px;margin-top:6px}
        .dashboard-rehearsal__main{padding:14px 12px}
        .dashboard-rehearsal__subject{font-size:14px}
      }
    `}</style>
  </>;
}
