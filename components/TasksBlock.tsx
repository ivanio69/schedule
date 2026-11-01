"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TaskEditor from "./TaskEditor";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { sortTasks, taskWhen, type ResolvedTask, type TaskDay } from "@/lib/tasks";
import styles from "./Tasks.module.css";

export default function TasksBlock({ date, newTaskOpen = false, onNewTaskClose }: {
  date: string; newTaskOpen?: boolean; onNewTaskClose?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState<(TaskDay & { date: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<{date:string;message:string} | null>(null);
  const error = failure?.date === date ? failure.message : "";
  const [editor, setEditor] = useState<ResolvedTask | "new" | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const pending = useRef(new Set<string>());
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const id = ++requestId.current;
    try {
      const response = await fetch(`/api/tasks?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: abort.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Не удалось загрузить задачи");
      if (id !== requestId.current || abort.signal.aborted) return;
      setData({ ...body, date }); setFailure(null);
    } catch (failure) { if (!abort.signal.aborted && id === requestId.current) setFailure({date,message:failure instanceof Error ? failure.message : "Не удалось загрузить задачи"}); }
    finally { if (!abort.signal.aborted && id === requestId.current) setLoading(false); }
  }, [date]);
  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
    const initial = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => { if (!document.hidden && !pending.current.size) void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearTimeout(initial); controller.current?.abort(); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);
  async function complete(task: ResolvedTask) {
    if (pending.current.has(task.id)) return;
    pending.current.add(task.id); setBusyIds([...pending.current]); setFailure(null);
    setData(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, completed: !task.completed } : item) } : current);
    try {
      const response = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, revision: task.revision, completed: !task.completed }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Не удалось изменить задачу");
      setData(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id && item.revision === task.revision ? { ...item, completed: !task.completed, revision: task.revision + 1 } : item) } : current);
      if (pending.current.size === 1) await latestRefresh.current();
    } catch (failure) {
      setData(current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id && item.revision === task.revision ? { ...item, completed: task.completed } : item) } : current);
      setFailure({date,message:failure instanceof Error ? failure.message : "Не удалось изменить задачу"});
    }
    finally { pending.current.delete(task.id); setBusyIds([...pending.current]); }
  }
  const tasks = sortTasks(data?.date === date ? data.tasks : []);
  const active = tasks.filter(task => !task.completed);
  const row = (task: ResolvedTask) => <motion.li layout={reducedMotion ? false : "position"} key={task.id} className={task.completed ? styles.done : undefined} initial={reducedMotion ? false : {opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:reducedMotion?1:.98}} transition={{layout:{type:"spring",stiffness:380,damping:34},opacity:{duration:.18},y:{duration:.2}}} aria-busy={busyIds.includes(task.id)}>
    <label className={styles.checkTarget}>
      <input type="checkbox" checked={task.completed} disabled={busyIds.includes(task.id)} aria-label={`${task.completed ? "Вернуть в задачи" : "Выполнить"}: ${task.title}`} onChange={() => void complete(task)} />
      <motion.svg viewBox="0 0 24 24" aria-hidden="true" initial={false} animate={{opacity:task.completed?1:0,scale:task.completed?1:.7}} transition={{duration:reducedMotion?0:.2}}><motion.path d="m6 12 4 4 8-8" initial={false} animate={{pathLength:task.completed?1:0}} transition={{duration:reducedMotion?0:.28,ease:"easeOut"}}/></motion.svg>
    </label>
    <button type="button" className={styles.task} disabled={busyIds.includes(task.id)} onClick={() => setEditor(task)}>
      <strong>{task.title}</strong>
      <span className={styles.meta}>
        <span className={styles.deadline} data-timed={task.timing !== "anytime"}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>{taskWhen(task)}</span>
        {task.linkedEvent && <span className={styles.linked} data-kind={task.linkedEvent.kind}><i aria-hidden="true"/>{task.linkedEvent.title}{task.linkedEvent.cancelled ? " · отменено" : ` · ${task.linkedEvent.start}`}</span>}
        {task.linkMissing && <span className={styles.unavailable}>Событие недоступно</span>}
      </span>
      {task.notes && <p>{task.notes}</p>}
    </button><svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
  </motion.li>;
  return <section className={styles.block} aria-label="Задачи">
    <header className={styles.heading}><h2>Задачи {active.length > 0 && <span>{active.length}</span>}</h2><motion.button type="button" className="icon-button" whileTap={reducedMotion?undefined:{scale:.93}} onClick={() => setEditor("new")} aria-label="Добавить задачу" title="Добавить задачу"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></motion.button></header>
    {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void refresh()}>Повторить</button></p>}
    {(loading || data?.date !== date) && !error ? <p className={styles.empty} role="status">Загружаем задачи…</p> : <>
      {tasks.length > 0 ? <motion.ul layout={reducedMotion ? false : "size"} className={styles.list}><AnimatePresence initial={false}>{tasks.map(row)}</AnimatePresence></motion.ul> : !error && <p className={styles.empty}>На этот день задач пока нет</p>}
    </>}
    {(newTaskOpen || editor) && <TaskEditor date={date} task={editor && editor !== "new" && !newTaskOpen ? editor : undefined} onClose={() => { setEditor(null); onNewTaskClose?.(); }} onSaved={() => void refresh()} />}
  </section>;
}
