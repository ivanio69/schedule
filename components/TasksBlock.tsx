"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { taskWhen, type ResolvedTask, type TaskDay } from "@/lib/tasks";
import styles from "./Tasks.module.css";
const TaskEditor = dynamic(() => import("./TaskEditor"));

export default function TasksBlock({ date, newTaskOpen = false, onNewTaskClose }: {
  date: string; newTaskOpen?: boolean; onNewTaskClose?: () => void;
}) {
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
    try {
      const response = await fetch("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, revision: task.revision, completed: !task.completed }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Не удалось изменить задачу");
      await latestRefresh.current();
    } catch (failure) { setFailure({date,message:failure instanceof Error ? failure.message : "Не удалось изменить задачу"}); }
    finally { pending.current.delete(task.id); setBusyIds([...pending.current]); }
  }
  const tasks = data?.date === date ? data.tasks : [];
  const active = tasks.filter(task => !task.completed), completed = tasks.filter(task => task.completed);
  const row = (task: ResolvedTask) => <li key={task.id} className={task.completed ? styles.done : undefined}>
    <label className={styles.checkTarget}>
      <input type="checkbox" checked={task.completed} disabled={busyIds.includes(task.id)} aria-label={`${task.completed ? "Вернуть в задачи" : "Выполнить"}: ${task.title}`} onChange={() => void complete(task)} />
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8"/></svg>
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
  </li>;
  return <section className={styles.block} aria-label="Задачи">
    <header className={styles.heading}><h2>Задачи {active.length > 0 && <span>{active.length}</span>}</h2><button type="button" onClick={() => setEditor("new")} aria-label="Добавить задачу" title="Добавить задачу"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></header>
    {error && <p className={styles.error} role="alert">{error} <button type="button" onClick={() => void refresh()}>Повторить</button></p>}
    {(loading || data?.date !== date) && !error ? <p className={styles.empty} role="status">Загружаем задачи…</p> : <>
      {active.length > 0 ? <ul className={styles.list}>{active.map(row)}</ul> : !error && <p className={styles.empty}>{completed.length ? "Все задачи выполнены" : "На этот день задач пока нет"}</p>}
      {completed.length > 0 && <details className={styles.completed}><summary>Выполнено · {completed.length}</summary><ul className={styles.list}>{completed.map(row)}</ul></details>}
    </>}
    {(newTaskOpen || editor) && <TaskEditor date={date} task={editor && editor !== "new" && !newTaskOpen ? editor : undefined} onClose={() => { setEditor(null); onNewTaskClose?.(); }} onSaved={() => void refresh()} />}
  </section>;
}
