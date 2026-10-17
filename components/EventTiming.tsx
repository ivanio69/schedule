"use client";

import { useEffect, useState } from "react";
import type { RehearsalBlock } from "@/lib/schedule";

type Props = {
  date: string;
  start: string;
  end: string;
  cancelled?: boolean;
  blocks?: RehearsalBlock[];
};

function minutes(value: string) {
  const parts = value.split(":").map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}
function clock(value: number) {
  const total = Math.max(0, Math.ceil(value / 1000));
  const seconds = total % 60;
  const min = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  return hours ? `${hours}:${String(min).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${min}:${String(seconds).padStart(2, "0")}`;
}
function timestamp(date: string, time: string) { return new Date(`${date}T${time}:00`).getTime(); }

export default function EventTiming({ date, start, end, cancelled, blocks = [] }: Props) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);
  if (now === null) return null;
  const startAt = timestamp(date, start);
  const endAt = timestamp(date, end);
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return null;
  const started = now >= startAt;
  const finished = now >= endAt;
  const ongoing = started && !finished && !cancelled;
  const progress = cancelled ? 0 : Math.max(0, Math.min(100, ((now - startAt) / (endAt - startAt)) * 100));
  const sorted = [...blocks].sort((a, b) => minutes(a.timeStart) - minutes(b.timeStart));
  const active = ongoing ? sorted.find(block => now >= timestamp(date, block.timeStart) && now < timestamp(date, block.timeEnd)) : undefined;
  const next = ongoing ? sorted.find(block => timestamp(date, block.timeStart) > now) : undefined;
  const inBreak = ongoing && sorted.length > 0 && !active && !!next;
  const status = cancelled ? "Отменено" : !started ? "До начала" : finished ? "Завершено" : inBreak ? "Перерыв" : "Идёт сейчас";
  const value = cancelled ? "Событие не состоится" : !started ? clock(startAt - now) : finished ? "На сегодня всё" : inBreak ? clock(timestamp(date, next!.timeStart) - now) : clock(endAt - now);
  return <section className="event-timing" aria-label="Статус события">
    <div className="event-timing__top"><div><span className={`event-timing__indicator${ongoing ? " is-active" : ""}`}/><span>{status}</span></div><strong className="event-timing__value" aria-live="off">{value}</strong></div>
    {ongoing && active && <p className="event-timing__hint">Сейчас: {active.title}</p>}
    {ongoing && next && <p className="event-timing__hint">Далее: {next.title} · {next.timeStart}</p>}
    {!cancelled && <div className="event-timing__track" role="progressbar" aria-label="Прогресс события" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }}/></div>}
    <div className="event-timing__footer"><span>{start}–{end}</span><span>{Math.round((endAt - startAt) / 60000)} мин</span></div>
  </section>;
}
