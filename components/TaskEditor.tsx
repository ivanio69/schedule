"use client";

import { useEffect, useState } from "react";
import EventDialog from "./EventDialog";
import { normalizeTask, sameTaskLink, taskEventLabels, type ResolvedTask, type TaskDay, type TaskLink, type TaskTiming } from "@/lib/tasks";
import styles from "./Tasks.module.css";

export default function TaskEditor({ date, task, onClose, onSaved }: {
  date: string; task?: ResolvedTask; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [taskDate, setTaskDate] = useState(task?.effectiveDate ?? date);
  const [timing, setTiming] = useState<TaskTiming>(task?.timing ?? "anytime");
  const [time, setTime] = useState(task?.time || "18:00");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [event, setEvent] = useState<TaskLink | null>(task?.event ?? null);
  const [day, setDay] = useState<TaskDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/tasks?date=${encodeURIComponent(taskDate)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setDay(data); })
      .catch(() => { if (!controller.signal.aborted) setLoadError("Не удалось загрузить события для привязки"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskDate, attempt]);

  async function save(remove = false) {
    if (saving) return;
    const input = { title, date: taskDate, notes, timing, time, event };
    if (!remove && !normalizeTask(input)) { setError("Укажите название, дату и корректное время задачи"); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/tasks", { method: remove ? "DELETE" : task ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, id: task?.id, revision: task?.revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить задачу");
      onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось сохранить задачу"); }
    finally { setSaving(false); }
  }
  const events = day?.events ?? [];
  const missingSelection = event && !events.some(item => sameTaskLink(item, event));
  return <EventDialog title={deleting ? "Удалить задачу?" : task ? "Задача" : "Новая задача"} eyebrow="ВИДНО ТОЛЬКО ВАМ" busy={saving} compact={deleting} onClose={() => { if (deleting) { setDeleting(false); setError(""); } else onClose(); }}>
    {deleting ? <div className={styles.confirm}>
      <p>Задача «{task?.title}» будет удалена.</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><button type="button" autoFocus disabled={saving} onClick={() => setDeleting(false)}>Оставить</button><button type="button" className={styles.danger} disabled={saving} onClick={() => void save(true)}>{saving ? "Удаляю…" : "Удалить"}</button></div>
    </div> : <form className={styles.form} onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>Что нужно сделать<input autoFocus required maxLength={160} placeholder="Например, подготовить реквизит" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Дата<input type="date" required value={taskDate} onChange={e => { setTaskDate(e.target.value); setEvent(null); setDay(null); setLoading(true); setLoadError(""); }} /></label>
      <fieldset className={styles.timing}><legend>Когда</legend><div role="group" aria-label="Срок задачи">{([ ["anytime", "В течение дня"], ["time", "Ко времени"], ["after-classes", "После пар"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={timing === value} onClick={() => setTiming(value)}>{label}</button>)}</div></fieldset>
      {timing === "time" && <label>Время<input type="time" required value={time} onChange={e => setTime(e.target.value)} /></label>}
      {timing === "after-classes" && <p className={styles.hint}>{loading ? "Проверяем расписание…" : loadError ? "Время появится после загрузки расписания" : day?.afterClassesTime ? `Пары заканчиваются в ${day.afterClassesTime}. Время обновится при изменении расписания.` : "На эту дату пар нет. Задача останется в списке на выбранный день."}</p>}
      <label>Связать с событием<select value={event ? JSON.stringify(event) : ""} disabled={loading} onChange={e => setEvent(e.target.value ? JSON.parse(e.target.value) as TaskLink : null)}>
        <option value="">Без привязки</option>
        {missingSelection && <option value={JSON.stringify(event)}>{task?.linkedEvent?.title ?? "Прежнее событие"} · {loading ? "загрузка…" : "недоступно"}</option>}
        {events.map(item => { const link = { kind: item.kind, id: item.id, date: item.date }; return <option key={JSON.stringify(link)} value={JSON.stringify(link)}>{item.start} · {taskEventLabels[item.kind]} · {item.title}</option>; })}
      </select></label>
      {loading && <p className={styles.hint} role="status">Загружаем события…</p>}
      {loadError && <p className={styles.error} role="alert">{loadError} <button type="button" onClick={() => { setLoading(true); setLoadError(""); setAttempt(value => value + 1); }}>Повторить</button></p>}
      <label>Заметки<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Детали, которые важно не забыть" /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>{task && <button type="button" className={styles.danger} disabled={saving} onClick={() => { setDeleting(true); setError(""); }}>Удалить</button>}<button type="button" disabled={saving} onClick={onClose}>Отмена</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? "Сохраняю…" : task ? "Сохранить" : "Добавить задачу"}</button></div>
    </form>}
  </EventDialog>;
}
