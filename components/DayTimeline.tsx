"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { formatDuration, getDayOccupancy, timeMinutes } from "@/lib/dashboard-timeline";
import styles from "./DayTimeline.module.css";

export type DayTimelineEvent = {
  key: string;
  kind: "group" | "individual" | "slot" | "rehearsal" | "personal";
  start: string;
  end: string;
  title: string;
  subtitle: string;
  detail: string;
  note?: string;
  status?: "cancelled" | "moved";
  reason?: string;
  attendance?: "late" | "absence";
  href?: string;
};

const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export default function DayTimeline({ events, date, week, currentMinute, notes, onOpen }: {
  events: DayTimelineEvent[];
  date: string;
  week: number;
  currentMinute: number;
  notes: Record<string, string>;
  onOpen: (event: DayTimelineEvent) => void;
}) {
  const reducedMotion = useReducedMotion();
  const occupancy = getDayOccupancy(events);
  const active = events.filter(event => event.status !== "cancelled");
  const current = active.find(event => timeMinutes(event.start) <= currentMinute && currentMinute < timeMinutes(event.end));
  const next = [...active].sort((a,b)=>a.start.localeCompare(b.start)).find(event => timeMinutes(event.start) > currentMinute);
  const lastEnd = occupancy.ranges.at(-1)?.end;
  const gaps = occupancy.gaps.map(gap => ({ ...gap, key: `gap-${gap.start}`, kind: "gap" as const }));
  const rows = [
    ...events.map(event => ({ key: event.key, kind: "event" as const, start: timeMinutes(event.start), event })),
    ...gaps,
  ].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
  const between = !active.some(event => timeMinutes(event.start) <= currentMinute && timeMinutes(event.end) > currentMinute);
  const nowBefore = between ? rows.findIndex(row => row.start > currentMinute) : -1;
  const nowLabel = <span className={styles.now}><i aria-hidden="true"/>Сейчас · {clock(currentMinute)}</span>;
  const currentGap = gaps.find(gap => gap.start <= currentMinute && currentMinute < gap.end);
  const focusKey = current?.key ?? currentGap?.key ?? next?.key ?? active.at(-1)?.key;
  const timeline = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const positionedDate = useRef<string | null>(null);

  useLayoutEffect(() => {
    const section = timeline.current;
    const header = document.querySelector<HTMLElement>("[data-dashboard-header]");
    if (!section || !header) return;
    let frame = 0;
    let previousEdge = -1;
    let previousOpacity = -1;
    const measure = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const edge = Math.round(Math.max(0, Math.min(rect.height + 112, header.getBoundingClientRect().bottom + 52 - rect.top)));
      if (edge !== previousEdge) {
        previousEdge = edge;
        section.style.setProperty("--timeline-fade-edge", `${edge}px`);
      }
      // Fade out the whole timeline as its bottom reaches the pinned header,
      // so its last cards cannot appear underneath the header at seminars.
      const overlap = header.getBoundingClientRect().bottom + 52 - rect.bottom;
      const opacity = Math.max(0, Math.min(1, 1 - (overlap + 120) / 120));
      const roundedOpacity = Math.round(opacity * 1000) / 1000;
      if (roundedOpacity !== previousOpacity) {
        previousOpacity = roundedOpacity;
        section.style.setProperty("--timeline-exit-opacity", `${roundedOpacity}`);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(header);
    observer.observe(section);
    window.addEventListener("scroll", schedule, {passive:true});
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useLayoutEffect(() => {
    if (!focusKey || positionedDate.current === date) return;
    // Let the browser/route finish restoring its scroll position first.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const target = list.current?.querySelector<HTMLElement>("[data-timeline-focus]");
        if (!target) return;
        const header = document.querySelector<HTMLElement>("[data-dashboard-header]");
        const headerHeight = header?.getBoundingClientRect().height ?? 0;
        const headerTop = header ? Number.parseFloat(getComputedStyle(header).top) || 0 : 0;
        // Only once per opening: clock ticks and data refreshes must not pull
        // someone away from the history they are reading.
        positionedDate.current = date;
        // Keep the focused card below the extended fade (52px) plus a 16px gap.
        window.scrollTo({top:Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerHeight - headerTop - 68),behavior:"instant"});
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [date, focusKey]);

  return <section ref={timeline} className={styles.timeline} aria-label="Единая временная шкала дня">
    <dl className={styles.summary}>
      <div><dt>Неделя</dt><dd>№ {week}</dd></div>
      <div><dt>Событий</dt><dd>{active.length}</dd></div>
      <div><dt>Освободишься в</dt><dd>{lastEnd === undefined ? "День свободен" : clock(lastEnd)}</dd></div>
    </dl>
    <ol ref={list} className={styles.rows}>
      {rows.map((row, index) => {
        if (row.kind === "gap") return <li data-timeline-focus={row.key === focusKey ? "" : undefined} className={`${styles.gap}${row.end - row.start < 30 ? ` ${styles.shortGap}` : ""}`} key={row.key}>
          <span className={styles.gapTime}>{clock(row.start)}–{clock(row.end)}</span>
          <span className={styles.gapContent}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2a3 3 0 0 1 0 6h-2M3 23h16M7 2v2m4-2v2m4-2v2"/></svg><span>Свободно <strong>{formatDuration(row.end - row.start)}</strong></span></span>
          {currentMinute >= row.start && currentMinute < row.end && nowLabel}
        </li>;
        const event = row.event;
        const start = timeMinutes(event.start), end = timeMinutes(event.end);
        const current = event.status !== "cancelled" && start <= currentMinute && currentMinute < end;
        const upcoming = event.key === next?.key;
        const progress = Math.max(0, Math.min(100, (currentMinute - start) / (end - start) * 100));
        const label = event.status === "cancelled" ? "Отменено" : event.status === "moved" ? "Перенесено" : event.attendance === "absence" ? "Меня не будет" : event.attendance === "late" ? "Опоздаю" : event.kind === "group" ? "" : event.kind === "rehearsal" ? "Репетиция" : event.kind === "personal" ? "Событие" : "Индивидуальное";
        const content = <><span className={styles.main}><span className={styles.titleRow}>{label && <span className={styles.kind}>{label}</span>}{current && <span className={styles.currentLabel}>Сейчас идёт</span>}{upcoming && <span className={styles.nextLabel}>Следующее · через {formatDuration(start - currentMinute)}</span>}</span><strong className={styles.title}>{event.title}</strong><span className={styles.metadata}>{[event.subtitle, event.detail].filter(Boolean).join(" · ")}</span>{event.status && <span className={styles.metadata}>{event.reason || (event.status === "cancelled" ? "Не учитывается в занятости" : "Занятие в новое время")}</span>}{(event.note || notes[event.key]) && <span className={styles.metadata}>● {event.note || notes[event.key]}</span>}</span><span className={styles.duration}>{event.end}<span>{formatDuration(end - start)}</span></span></>;
        return <li key={row.key} data-timeline-focus={row.key === focusKey ? "" : undefined} className={`${styles.row} ${styles[event.kind]}`}>
          {index === nowBefore && !occupancy.gaps.some(gap => currentMinute >= gap.start && currentMinute < gap.end) && <div className={styles.beforeNow}>{nowLabel}</div>}
          <time className={styles.time}>{event.start}</time>
          <motion.div className={`${styles.card}${current ? ` ${styles.current}` : ""}${upcoming ? ` ${styles.next}` : ""}${event.status === "cancelled" ? ` ${styles.exception}` : ""}${event.status !== "cancelled" && end <= currentMinute ? ` ${styles.past}` : ""}`} initial={false} animate={{paddingBottom: current ? 20 : 16}} transition={{duration: reducedMotion ? 0 : .24}}>
            {event.href ? <Link href={event.href} className={styles.open}>{content}</Link> : <button type="button" className={styles.open} onClick={()=>onOpen(event)} aria-label={`Открыть ${event.title}`}>{content}</button>}
            {current && <div className={styles.progressBlock}>
              <div className={styles.progressLabels}><span>До конца · {formatDuration(end - currentMinute)}</span><span>{Math.floor(progress)}%</span></div>
              <div className={styles.progress} role="progressbar" aria-label={`Прогресс: ${event.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress)}><span style={{transform:`scaleX(${progress / 100})`}}/></div>
            </div>}
          </motion.div>
        </li>;
      })}
      {between && nowBefore < 0 && rows.length > 0 && <li className={styles.afterNow}>{nowLabel}</li>}
    </ol>
    {!events.length && <div className="dashboard-empty">На сегодня ничего не запланировано.</div>}
  </section>;
}
