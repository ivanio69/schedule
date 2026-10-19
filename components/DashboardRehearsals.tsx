"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import type { Rehearsal } from "@/lib/schedule";
import type { Person } from "@/lib/people";
import { getRehearsalAudienceNames, isRehearsalParticipant } from "@/lib/rehearsals";
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
        <div className="dashboard-section-head dashboard-rehearsals__head">
          <h2>Ближайшие репетиции</h2>
          <span>{items.length}</span>
        </div>
        <div className="dashboard-rehearsals__list">
          {items.map(item => {
            const blocks = item.blocks?.length ?? 0;
            const participating = isRehearsalParticipant(item, personId, personName);
            const participants = getRehearsalAudienceNames(item).length;
            return <button
              type="button"
              key={item.id}
              className={`dashboard-event-v2 dashboard-rehearsal${item.isGlobal ? " is-global" : ""}${!participating ? " is-non-participant" : ""}`}
              onClick={event => { lastTrigger.current = event.currentTarget; setSelectedId(item.id); }}
              aria-label={"Открыть репетицию «" + item.subject + "» " + formatDate(item.date) + ", " + item.timeStart + (!participating ? ". Вы не участвуете" : "")}
            >
              <span className="dashboard-event-time dashboard-rehearsal__date">
                <strong>{item.timeStart}</strong>
                <small>{item.timeEnd}</small>
                <time dateTime={item.date}>{formatDatePart(item.date, { day: "numeric", month: "short" })}</time>
                <small>{formatDatePart(item.date, { weekday: "short" })}</small>
              </span>
              <span className="dashboard-event-content dashboard-rehearsal__content">
                <span className="dashboard-rehearsal__labels"><span className="dashboard-rehearsal__kind">{item.isGlobal ? "ОБЩАЯ РЕПЕТИЦИЯ" : "РЕПЕТИЦИЯ"}</span>
                {!participating && <span className="rehearsal-participation-badge">Вы не участвуете</span>}</span>
                <strong className="dashboard-rehearsal__subject">{item.subject}</strong>
                <span className="dashboard-rehearsal__details">
                  {item.responsible && <span>Ответственный: {item.responsible}</span>}
                  {blocks > 0 && <span>{blocks} {plural(blocks, "блок", "блока", "блоков")}</span>}
                  <span>{participants} {plural(participants, "участник", "участника", "участников")}</span>
                </span>
              </span>
              <span className="dashboard-rehearsal__arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7"/></svg>
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
      /* Share the same card grid, surface and type scale as "Сегодня". */
      .dashboard-rehearsals{width:min(960px,calc(100% - 48px));margin:0 auto 56px}
      .dashboard-rehearsals__head{margin-bottom:10px}
      .dashboard-rehearsals__head h2{margin:0;font-size:18px;font-weight:600;letter-spacing:-.025em}
      .dashboard-rehearsals__head>span{color:var(--muted);font-size:12px}
      .dashboard-rehearsals__list{display:grid;gap:9px}
      .dashboard-rehearsal{width:100%;margin:0;min-width:0;color:var(--text);text-align:left;cursor:pointer}
      .dashboard-rehearsal:hover{border-color:color-mix(in srgb,var(--event-color) 56%,var(--border))!important;background:color-mix(in srgb,var(--event-color) 9%,var(--surface))!important}
      .dashboard-rehearsal:focus-visible{outline:2px solid var(--event-color,var(--rehearsal));outline-offset:3px}
      .dashboard-rehearsal__date{min-width:0;font-variant-numeric:tabular-nums}
      .dashboard-rehearsal__date strong{font-size:16px;font-weight:650;letter-spacing:-.025em}
      .dashboard-rehearsal__date small{color:var(--muted);font-size:11px;font-weight:400}
      .dashboard-rehearsal__date time{display:block;margin-top:6px;color:var(--muted-strong);font-size:10px;font-weight:600;line-height:1.3}
      .dashboard-rehearsal__content{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
      .dashboard-rehearsal__labels{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
      .dashboard-rehearsal__kind{color:var(--event-color,var(--rehearsal));font-size:9px;font-weight:800;letter-spacing:.09em;line-height:1.35}
      .dashboard-rehearsal__subject{color:var(--text);font-size:16px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}
      .dashboard-rehearsal__details{display:flex;flex-wrap:wrap;gap:3px 12px;color:var(--muted);font-size:12px;font-weight:400;letter-spacing:normal;line-height:1.5}
      .dashboard-rehearsal__details>span{min-width:0;overflow-wrap:anywhere}
      .dashboard-rehearsal__arrow{display:grid;place-items:center;color:var(--muted);opacity:.65}
      .dashboard-rehearsal__arrow svg{width:16px;height:16px;display:block;transition:transform .18s ease}
      .dashboard-rehearsal:hover .dashboard-rehearsal__arrow{opacity:1;color:var(--event-color,var(--rehearsal))}
      .dashboard-rehearsal:hover .dashboard-rehearsal__arrow svg{transform:translateX(2px)}
      @media(max-width:650px){
        .dashboard-rehearsals{width:calc(100% - 32px);margin-bottom:36px}
        .dashboard-rehearsal__date strong{font-size:15px}
        .dashboard-rehearsal__date small{font-size:10px}
        .dashboard-rehearsal__date time{font-size:10px}
        .dashboard-rehearsal__content{gap:3px}
        .dashboard-rehearsal__subject{font-size:15px}
        .dashboard-rehearsal__details{font-size:11px;gap:2px 8px}
      }
      @media(prefers-reduced-motion:reduce){
        .dashboard-rehearsal__arrow svg{transition:none}
        .dashboard-rehearsal:hover .dashboard-rehearsal__arrow svg{transform:none}
      }
    `}</style>
  </>;
}
