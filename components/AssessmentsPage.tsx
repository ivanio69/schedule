"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ASSESSMENT_LABELS, formatAssessmentDate, type Assessment, type AssessmentKind } from "@/lib/assessments";
import { useVisibleClock } from "@/lib/visible-clock";
import AssessmentCard from "./AssessmentCard";
import EventDialog from "./EventDialog";
import LoadingState from "./LoadingState";
import styles from "./Assessments.module.css";
const AssessmentEditor = dynamic(() => import("./AssessmentEditor"));
const AssessmentDetails = dynamic(() => import("./AssessmentDetails"));

export default function AssessmentsPage({ manage = false, embedded = false }: { manage?: boolean; embedded?: boolean }) {
  const [items, setItems] = useState<Assessment[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false), [manageHref, setManageHref] = useState("");
  const [filter, setFilter] = useState<AssessmentKind | "all">("all"), [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ item: Assessment | null } | null>(null), [details, setDetails] = useState<Assessment | null>(null);
  const [deleting, setDeleting] = useState<Assessment | null>(null), [deleteBusy, setDeleteBusy] = useState(false), [deleteClosing, setDeleteClosing] = useState(false), [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  const deleteLock = useRef(false), requestId = useRef(0);
  const clock = useVisibleClock(), [initialNow] = useState(() => Date.now());
  const now = clock ?? initialNow;
  const load = useCallback(async (signal?: AbortSignal) => {
    const id = ++requestId.current;
    try {
      const response = await fetch("/api/assessments", { cache: "no-store", signal });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (signal?.aborted || id !== requestId.current) return;
      setItems(data.assessments); setCanManage(data.canManage); setManageHref(data.manageHref); setError("");
    } catch (error) { if (!signal?.aborted && id === requestId.current) setError(error instanceof Error ? error.message : "Не удалось загрузить расписание"); }
    finally { if (!signal?.aborted && id === requestId.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    const refresh = () => { if (!document.hidden) void load(controller.signal); };
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); };
  }, [load]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("ru");
    return items.filter(item => (filter === "all" || item.kind === filter) && `${item.subject} ${item.professor} ${item.auditorium} ${item.notes}`.toLocaleLowerCase("ru").includes(search));
  }, [items, filter, query]);
  const groups = useMemo(() => {
    const days = new Map<string, Assessment[]>();
    for (const item of [...filtered].sort((a, b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart) || a.subject.localeCompare(b.subject, "ru"))) days.set(item.date, [...(days.get(item.date) ?? []), item]);
    return [...days];
  }, [filtered]);
  function saved(item: Assessment) {
    // Invalidate an older focus refresh so it cannot overwrite a just-saved record.
    requestId.current++;
    setItems(current => [...current.filter(value => value.id !== item.id), item]);
    setNotice("Расписание обновлено");
  }
  async function remove() {
    if (!deleting || deleteLock.current) return;
    deleteLock.current = true; setDeleteBusy(true); setDeleteError("");
    try {
      const response = await fetch(`/api/assessments?id=${encodeURIComponent(deleting.id)}&revision=${deleting.revision}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      requestId.current++; setItems(current => current.filter(item => item.id !== deleting.id));
      setDeleteClosing(true); setNotice("Запись удалена");
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Не удалось удалить запись"); }
    finally { deleteLock.current = false; setDeleteBusy(false); }
  }
  if (loading) return <LoadingState screen={!embedded} label="Загружаем сессию" detail="Получаем зачёты и экзамены."/>;
  const management = manage && canManage;
  return <section className={`${styles.page}${embedded ? ` ${styles.embedded}` : ""}${manage && !embedded ? " admin-shell admin-unified" : ""}`}>
    {!manage && <Link className={styles.back} href="/">На главную</Link>}
    <header className={styles.header}><div><h1>Зачёты и экзамены</h1><p>{management ? "Добавляйте и меняйте расписание сессии для всей группы." : "Расписание сессии, примечания и комментарии группы."}</p></div>
      {management ? <button type="button" className="admin-primary" onClick={() => setEditor({ item: null })}>＋ Добавить</button> : canManage && <Link className="admin-secondary" href={manageHref}>Управлять</Link>}
    </header>
    {error && <p className={styles.error} role="alert">{error} <button type="button" className="admin-secondary" onClick={() => void load()}>Повторить</button></p>}
    <div className={styles.toolbar}><label className={styles.search}><input className="admin-input" type="search" value={query} placeholder="Поиск по предмету, преподавателю, месту" aria-label="Поиск по расписанию сессии" onChange={e => setQuery(e.target.value)}/></label>
      <div className={styles.filters} role="group" aria-label="Тип события">{(["all", "credit", "exam"] as const).map(kind => <button type="button" key={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === "all" ? "Все" : kind === "credit" ? "Зачёты" : "Экзамены"}</button>)}</div>
    </div>
    <p className={styles.help} role="status">{notice}</p>
    <div className={styles.groups}>{groups.map(([date, assessments]) => <section className={styles.day} key={date}><h2>{formatAssessmentDate(date)}</h2><div className={styles.list}>{assessments.map(item => <div className={styles.item} key={item.id}>
      <AssessmentCard assessment={item} past={new Date(`${item.date}T${item.timeEnd}:00`).getTime() <= now} onClick={() => setDetails(item)}/>
      {management && <div className={styles.actions}><button type="button" className="admin-secondary" onClick={() => setEditor({ item })}>Изменить</button><button type="button" className="admin-danger" onClick={() => { setDeleting(item); setDeleteClosing(false); setDeleteError(""); }}>Удалить</button></div>}
    </div>)}</div></section>)}</div>
    {!groups.length && !error && <div className={styles.empty}><h2>{items.length ? "Ничего не найдено" : "Расписание пока не добавлено"}</h2><p>{items.length ? "Попробуйте другой поиск или фильтр." : management ? "Добавьте первый зачёт или экзамен." : "Когда появятся даты, они будут здесь и в общем расписании."}</p></div>}
    {editor && <AssessmentEditor assessment={editor.item} onClose={() => setEditor(null)} onSaved={saved}/>}
    {details && <AssessmentDetails key={details.id} assessment={details} onClose={() => setDetails(null)} onChange={saved}/>}
    {deleting && <EventDialog title={`Удалить ${ASSESSMENT_LABELS[deleting.kind].toLocaleLowerCase("ru")}?`} eyebrow={deleting.subject} busy={deleteBusy} closing={deleteClosing} compact onClose={() => setDeleting(null)}><div className={styles.form}><p className={styles.help}>Запись исчезнет из общего расписания и расписания сессии. Комментарии также будут удалены.</p>{deleteError && <p className={styles.error} role="alert">{deleteError}</p>}<div className={styles.actions}><button type="button" className="admin-secondary" disabled={deleteBusy || deleteClosing} onClick={() => setDeleteClosing(true)}>Отмена</button><button type="button" className="admin-danger" disabled={deleteBusy || deleteClosing} onClick={() => void remove()}>{deleteBusy ? "Удаляем…" : "Удалить"}</button></div></div></EventDialog>}
  </section>;
}
