"use client";

import { motion, useReducedMotion } from "motion/react";
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

export default function DayTimeline({ events, currentMinute, notes, onOpen, onNote }: {
  events: DayTimelineEvent[];
  currentMinute: number;
  notes: Record<string, string>;
  onOpen: (event: DayTimelineEvent) => void;
  onNote: (event: DayTimelineEvent) => void;
}) {
  const reducedMotion = useReducedMotion();
  const occupancy = getDayOccupancy(events);
  const active = events.filter(event => event.status !== "cancelled");
  const lastEnd = occupancy.ranges.at(-1)?.end;
  const gaps = occupancy.gaps.map(gap => ({ ...gap, key: `gap-${gap.start}`, kind: "gap" as const }));
  const rows = [
    ...events.map(event => ({ key: event.key, kind: "event" as const, start: timeMinutes(event.start), event })),
    ...gaps,
  ].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
  const between = !active.some(event => timeMinutes(event.start) <= currentMinute && timeMinutes(event.end) > currentMinute);
  const nowBefore = between ? rows.findIndex(row => row.start > currentMinute) : -1;
  const nowLabel = <span className={styles.now}><i aria-hidden="true"/>Сейчас · {clock(currentMinute)}</span>;

  return <section className={styles.timeline} aria-label="Единая временная шкала дня">
    <div className="dashboard-section-head"><h2>Весь день</h2><Link href="/schedule">Расписание →</Link></div>
    <dl className={styles.summary}>
      <div><dt>Занято</dt><dd>{formatDuration(occupancy.occupiedMinutes)}</dd></div>
      <div><dt>Событий</dt><dd>{active.length}</dd></div>
      <div><dt>Освободишься в</dt><dd>{lastEnd === undefined ? "День свободен" : clock(lastEnd)}</dd></div>
    </dl>
    <ol className={styles.rows}>
      {rows.map((row, index) => {
        if (row.kind === "gap") return <li className={styles.gap} key={row.key}>
          <span className={styles.gapTime}>{clock(row.start)}–{clock(row.end)}</span>
          <span className={styles.gapContent}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h2a3 3 0 0 1 0 6h-2M3 23h16M7 2v2m4-2v2m4-2v2"/></svg><span>Свободно <strong>{formatDuration(row.end - row.start)}</strong></span></span>
          {currentMinute >= row.start && currentMinute < row.end && nowLabel}
        </li>;
        const event = row.event;
        const start = timeMinutes(event.start), end = timeMinutes(event.end);
        const current = event.status !== "cancelled" && start <= currentMinute && currentMinute < end;
        const progress = Math.max(0, Math.min(100, (currentMinute - start) / (end - start) * 100));
        const label = event.status === "cancelled" ? "Отменено" : event.status === "moved" ? "Перенесено" : event.attendance === "absence" ? "Меня не будет" : event.attendance === "late" ? "Опоздаю" : event.kind === "group" ? "" : event.kind === "rehearsal" ? "Репетиция" : event.kind === "personal" ? "Событие" : "Индивидуальное";
        const content = <><span className={styles.main}><span className={styles.titleRow}>{label && <span className={styles.kind}>{label}</span>}{current && <span className={styles.currentLabel}>Сейчас идёт</span>}</span><strong className={styles.title}>{event.title}</strong><span className={styles.metadata}>{[event.subtitle, event.detail].filter(Boolean).join(" · ")}</span>{event.status && <span className={styles.metadata}>{event.reason || (event.status === "cancelled" ? "Не учитывается в занятости" : "Занятие в новое время")}</span>}{(event.note || notes[event.key]) && <span className={styles.metadata}>● {event.note || notes[event.key]}</span>}</span><span className={styles.duration}>{event.end}<span>{formatDuration(end - start)}</span></span></>;
        return <li key={row.key} className={`${styles.row} ${styles[event.kind]}`}>
          {index === nowBefore && !occupancy.gaps.some(gap => currentMinute >= gap.start && currentMinute < gap.end) && <div className={styles.beforeNow}>{nowLabel}</div>}
          <time className={styles.time}>{event.start}</time>
          <motion.div className={`${styles.card}${current ? ` ${styles.current}` : ""}${event.status === "cancelled" ? ` ${styles.exception}` : ""}${event.status !== "cancelled" && end <= currentMinute ? ` ${styles.past}` : ""}`} initial={false} animate={{paddingBottom: current ? 20 : 16}} transition={{duration: reducedMotion ? 0 : .24}}>
            {event.href ? <Link href={event.href} className={styles.open}>{content}</Link> : <button type="button" className={styles.open} onClick={()=>onOpen(event)} aria-label={`Открыть ${event.title}`}>{content}</button>}
            {current && <div className={styles.progressBlock}>
              <div className={styles.progressLabels}><span>До конца · {formatDuration(end - currentMinute)}</span><span>{Math.floor(progress)}%</span></div>
              <div className={styles.progress} role="progressbar" aria-label={`Прогресс: ${event.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress)}><span style={{transform:`scaleX(${progress / 100})`}}/></div>
            </div>}
            {event.kind === "group" && <button type="button" className={styles.note} onClick={()=>onNote(event)}>{notes[event.key] ? "Изменить заметку" : "+ Заметка"}</button>}
          </motion.div>
        </li>;
      })}
      {between && nowBefore < 0 && rows.length > 0 && <li className={styles.afterNow}>{nowLabel}</li>}
    </ol>
    {!events.length && <div className="dashboard-empty">На сегодня ничего не запланировано.</div>}
  </section>;
}
