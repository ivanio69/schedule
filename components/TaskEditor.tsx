"use client";

import { useEffect, useState } from "react";
import TaskDialog from "./TaskDialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import TaskEventPicker from "./TaskEventPicker";
import { normalizeTask, validTaskDate, type ResolvedTask, type TaskDay, type TaskLink, type TaskTiming } from "@/lib/tasks";
import styles from "./Tasks.module.css";

export default function TaskEditor({ date, task, onClose, onSaved }: {
  date: string; task?: ResolvedTask; onClose: () => void; onSaved: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [closing, setClosing] = useState(false);
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
      onSaved(); setClosing(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось сохранить задачу"); }
    finally { setSaving(false); }
  }
  const events = day?.events ?? [];
  const dateCaption = validTaskDate(taskDate) ? new Intl.DateTimeFormat("ru-RU", {day:"numeric", month:"long"}).format(new Date(`${taskDate}T12:00:00`)) : "План на день";
  return <TaskDialog title={deleting ? "Удаление задачи" : task ? "Задача" : "Новая задача"} caption={dateCaption} busy={saving} closing={closing} onClose={onClose}>
    <AnimatePresence mode="wait" initial={false}>
    {deleting ? <motion.div key="delete" className={styles.confirm} initial={{opacity:0,y:reducedMotion?0:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-6}} transition={{duration:reducedMotion?0:.18}}>
      <motion.div className={styles.deleteIcon} initial={reducedMotion?false:{scale:.8,rotate:-8}} animate={{scale:1,rotate:0}} transition={{type:"spring",stiffness:320,damping:22}} aria-hidden="true"><svg viewBox="0 0 24 24"><motion.path d="M4 7h16m-11 0V4h6v3" animate={reducedMotion?undefined:{rotate:[0,-10,0]}} transition={{delay:.16,duration:.4}} style={{transformOrigin:"8px 7px"}}/><path d="m6 7 1 14h10l1-14m-8 4v6m4-6v6"/></svg></motion.div>
      <h3>Удалить эту задачу?</h3><p>Она исчезнет из списка. Связанное событие останется в расписании.</p>
      <div className={styles.deletePreview}><span className={styles.deletePreviewCheck} aria-hidden="true">{task?.completed ? "✓" : ""}</span><div><strong>{title}</strong><span>{dateCaption}{timing === "time" ? ` · ${time}` : timing === "after-classes" ? " · После пар" : " · В течение дня"}</span></div></div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={`${styles.actions} ${styles.deleteActions}`}><button type="button" autoFocus disabled={saving} onClick={() => { setDeleting(false); setError(""); }}>Оставить задачу</button><motion.button type="button" className={styles.danger} disabled={saving} whileTap={reducedMotion?undefined:{scale:.97}} onClick={() => void save(true)}>{saving ? "Удаляю…" : "Удалить"}</motion.button></div>
    </motion.div> : <motion.form key="edit" className={styles.form} initial={{opacity:0,y:reducedMotion?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:reducedMotion?0:-6}} transition={{duration:reducedMotion?0:.18}} onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>Что нужно сделать<input required maxLength={160} placeholder="Например, подготовить реквизит" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>Дата<input type="date" required value={taskDate} onChange={e => { setTaskDate(e.target.value); setEvent(null); setDay(null); setLoading(true); setLoadError(""); }} /></label>
      <fieldset className={styles.timing}><legend>Когда</legend><div role="group" aria-label="Срок задачи">{([ ["anytime", "В течение дня"], ["time", "Ко времени"], ["after-classes", "После пар"] ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={timing === value} onClick={() => setTiming(value)}>{label}</button>)}</div></fieldset>
      <AnimatePresence initial={false} mode="wait">
      {timing === "time" && <motion.label key="time" initial={{opacity:0,height:reducedMotion?"auto":0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:reducedMotion?"auto":0}} transition={{duration:reducedMotion?0:.18}} className={styles.timingDetail}>Время<input type="time" required value={time} onChange={e => setTime(e.target.value)} /></motion.label>}
      {timing === "after-classes" && <motion.p key="after" initial={{opacity:0,y:reducedMotion?0:5}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:reducedMotion?0:.16}} className={styles.hint}>{loading ? "Проверяем расписание…" : loadError ? "Время появится после загрузки расписания" : day?.afterClassesTime ? `Пары заканчиваются в ${day.afterClassesTime}. Время обновится при изменении расписания.` : "На эту дату пар нет. Задача останется в списке на выбранный день."}</motion.p>}
      </AnimatePresence>
      <TaskEventPicker key={taskDate} events={events} value={event} fallback={task?.linkedEvent} loading={loading} error={loadError} onChange={setEvent} onRetry={() => { setLoading(true); setLoadError(""); setAttempt(value => value + 1); }}/>
      <label>Заметки<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Детали, которые важно не забыть" /></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>{task && <button type="button" className={styles.danger} disabled={saving} onClick={() => { setDeleting(true); setError(""); }}>Удалить</button>}<button type="button" disabled={saving} onClick={() => setClosing(true)}>Отмена</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? "Сохраняю…" : task ? "Сохранить" : "Добавить задачу"}</button></div>
    </motion.form>}
    </AnimatePresence>
  </TaskDialog>;
}
