"use client";

import { useId, useRef, useState } from "react";
import { sameTaskLink, taskEventLabels, type TaskEvent, type TaskEventKind, type TaskLink } from "@/lib/tasks";
import styles from "./Tasks.module.css";

const filters = [
  { key: "all", label: "Все" }, { key: "lesson", label: "Пары" },
  { key: "rehearsal", label: "Репетиции" }, { key: "individual", label: "Индивидуальные" },
  { key: "personal", label: "События" },
] as const;

export default function TaskEventPicker({ events, value, fallback, loading, error, onRetry, onChange }: {
  events: TaskEvent[]; value: TaskLink | null; fallback?: TaskEvent | null;
  loading: boolean; error: string; onRetry: () => void; onChange: (value: TaskLink | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = value ? events.find(item => sameTaskLink(item, value)) ?? (fallback && sameTaskLink(fallback, value) ? fallback : null) : null;
  const category = (kind: TaskEventKind) => kind === "slot" ? "individual" : kind;
  const availableFilters = filters.filter(item => item.key === "all" || events.some(event => category(event.kind) === item.key));
  const search = query.trim().toLocaleLowerCase("ru");
  const visible = events.filter(item => (filter === "all" || category(item.kind) === filter) && `${item.title} ${item.start} ${item.end} ${taskEventLabels[item.kind]}`.toLocaleLowerCase("ru").includes(search));
  function choose(event: TaskEvent | null) {
    onChange(event ? { kind: event.kind, id: event.id, date: event.date } : null);
    setOpen(false); setQuery(""); setFilter("all"); trigger.current?.focus();
  }
  return <section className={styles.picker} aria-label="Привязка к событию">
    <div className={styles.fieldHeading}><span>Событие</span><small>Необязательно</small></div>
    <div className={styles.selection} data-linked={Boolean(value)}>
      <button ref={trigger} type="button" className={styles.pickerTrigger} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(current => !current)}>
        <span className={styles.linkIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m10 13 4-4m-6 6-1 1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2 2 1-1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/></svg></span>
        <span className={styles.selectionText}><strong>{selected?.title ?? (value ? "Связанное событие" : "Выбрать событие")}</strong><small>{selected ? `${taskEventLabels[selected.kind]} · ${selected.start}–${selected.end}${selected.cancelled ? " · отменено" : ""}` : value ? loading ? "Загружаем…" : "Событие больше недоступно" : "Пара, репетиция или другие планы"}</small></span>
        <svg className={styles.pickerChevron} data-open={open} viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>
      </button>
      {value && <button type="button" className={styles.unlink} onClick={() => choose(null)} aria-label="Убрать привязку к событию" title="Убрать привязку"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8 8 8m0-8-8 8"/></svg></button>}
    </div>
    {open && <div id={panelId} className={styles.pickerPanel}>
      <div className={styles.search}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><input type="search" aria-label="Поиск события" autoFocus placeholder="Название или время" value={query} onChange={e => setQuery(e.target.value)} /></div>
      {availableFilters.length > 2 && <div className={styles.filters} role="group" aria-label="Тип события">{availableFilters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div>}
      {loading ? <p className={styles.pickerMessage} role="status">Загружаем события…</p> : error ? <div className={styles.error} role="alert">{error} <button type="button" onClick={onRetry}>Повторить</button></div> : <>
        <div className={styles.eventOptions} role="group" aria-label="События на выбранную дату">
          {visible.map(item => { const active = Boolean(value && sameTaskLink(item, value)); return <button key={`${item.kind}-${item.id}-${item.date}`} type="button" className={styles.eventOption} data-kind={item.kind} aria-pressed={active} onClick={() => choose(item)}>
            <span className={styles.eventTime}><strong>{item.start}</strong><small>{item.end}</small></span>
            <span className={styles.eventText}><small><i aria-hidden="true"/>{taskEventLabels[item.kind]}</small><strong>{item.title}</strong></span>
            <span className={styles.eventCheck} aria-hidden="true">{active && <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>}</span>
          </button>; })}
        </div>
        {visible.length === 0 && <p className={styles.pickerMessage}>{search || filter !== "all" ? "Ничего не найдено. Попробуйте другое название или тип." : "На выбранную дату событий нет. Можно оставить задачу без привязки."}</p>}
      </>}
      <div className={styles.pickerFooter}><button type="button" onClick={() => choose(null)}>Без привязки</button><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Готово</button></div>
    </div>}
  </section>;
}
