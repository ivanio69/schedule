"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ASSESSMENT_LABELS, formatAssessmentDate, type Assessment } from "@/lib/assessments";
import EventDialog from "./EventDialog";
import styles from "./Assessments.module.css";

export default function AssessmentDetails({ assessment, onClose, onChange }: { assessment: Assessment; onClose: () => void; onChange?: (item: Assessment) => void }) {
  const [item, setItem] = useState(assessment), [personId, setPersonId] = useState(""), [canManage, setCanManage] = useState(false);
  const [text, setText] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false), [removing, setRemoving] = useState<string | null>(null);
  const requestBusy = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/assessments?id=${encodeURIComponent(assessment.id)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
    }).then(data => { setItem(data.assessment); setPersonId(data.personId); setCanManage(data.canManage); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось обновить комментарии"); });
    return () => controller.abort();
  }, [assessment.id]);
  const update = (next: Assessment) => { setItem(next); onChange?.(next); };
  async function comment(event: FormEvent) {
    event.preventDefault(); if (requestBusy.current || !text.trim()) return;
    requestBusy.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "comment", id: item.id, text }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      update({ ...item, comments: [...(item.comments ?? []), data.comment] }); setText("");
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось добавить комментарий"); }
    finally { requestBusy.current = false; setBusy(false); }
  }
  async function remove(id: string) {
    if (requestBusy.current) return;
    requestBusy.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/assessments?id=${encodeURIComponent(item.id)}&commentId=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      update({ ...item, comments: item.comments.filter(comment => comment.id !== id) }); setRemoving(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось удалить комментарий"); }
    finally { requestBusy.current = false; setBusy(false); }
  }
  return <EventDialog title={item.subject} eyebrow={ASSESSMENT_LABELS[item.kind]} busy={busy} onClose={onClose}>
    <dl className={styles.facts}><div><dt>Дата</dt><dd>{formatAssessmentDate(item.date)}</dd></div><div><dt>Время</dt><dd>{item.timeStart}–{item.timeEnd}</dd></div>{item.professor && <div><dt>Преподаватель</dt><dd>{item.professor}</dd></div>}<div><dt>Место</dt><dd>{item.auditorium || "Уточняется"}</dd></div></dl>
    {item.notes && <p className={styles.notes}>{item.notes}</p>}
    <Link href={`/schedule?date=${item.date}`} className="admin-secondary" onClick={onClose}>Открыть день в расписании</Link>
    <section className={styles.comments} aria-label="Комментарии"><h3>Комментарии · {item.comments?.length ?? 0}</h3>
      {(item.comments ?? []).map(comment => <article className={styles.comment} key={comment.id}><div className={styles.commentHead}><strong>{comment.author}</strong><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(comment.createdAt))}</time></div><p>{comment.text}</p>
        {(comment.personId === personId || canManage) && <div className={styles.actions}>{removing === comment.id ? <><button type="button" className="admin-secondary" disabled={busy} onClick={() => setRemoving(null)}>Отмена</button><button type="button" className="admin-danger" disabled={busy} onClick={() => void remove(comment.id)}>Удалить комментарий</button></> : <button type="button" className="admin-secondary" disabled={busy} onClick={() => setRemoving(comment.id)}>Удалить</button>}</div>}
      </article>)}
      {!item.comments?.length && <p className={styles.help}>Комментариев пока нет.</p>}
      <form className={styles.commentForm} onSubmit={comment}><label>Новый комментарий<textarea className="admin-input" maxLength={2000} required disabled={busy || !personId} value={text} placeholder="Вопрос или полезная информация для группы" onChange={e => setText(e.target.value)}/></label><p className={styles.help}>Комментарий увидит вся группа.</p><div className={styles.actions}><button className="admin-primary" disabled={busy || !personId || !text.trim()}>{busy ? "Сохраняем…" : "Отправить"}</button></div></form>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  </EventDialog>;
}
