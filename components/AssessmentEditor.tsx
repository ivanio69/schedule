"use client";
import { useRef, useState, type FormEvent } from "react";
import { ASSESSMENT_LABELS, normalizeAssessment, type Assessment, type AssessmentInput, type AssessmentKind } from "@/lib/assessments";
import EventDialog from "./EventDialog";
import styles from "./Assessments.module.css";

export default function AssessmentEditor({ assessment, onClose, onSaved }: { assessment: Assessment | null; onClose: () => void; onSaved: (assessment: Assessment) => void }) {
  const [value, setValue] = useState<AssessmentInput>(() => (assessment ? normalizeAssessment(assessment)! : null) ?? { kind: "credit", subject: "", date: "", timeStart: "09:00", timeEnd: "10:30", professor: "", auditorium: "", notes: "" });
  const [busy, setBusy] = useState(false), [closing, setClosing] = useState(false), [error, setError] = useState("");
  const saving = useRef(false);
  const change = <K extends keyof AssessmentInput>(key: K, next: AssessmentInput[K]) => setValue(current => ({ ...current, [key]: next }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || closing) return;
    if (value.timeStart >= value.timeEnd) { setError("Конец должен быть позже начала"); return; }
    saving.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/assessments", { method: assessment ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...value, ...(assessment ? { id: assessment.id, revision: assessment.revision } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onSaved(data.assessment); setClosing(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось сохранить запись"); }
    finally { saving.current = false; setBusy(false); }
  }
  return <EventDialog title={assessment ? "Изменить запись" : "Добавить в расписание"} eyebrow="ЗАЧЁТЫ И ЭКЗАМЕНЫ" busy={busy} closing={closing} onClose={onClose}>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fields} disabled={busy || closing} style={{ border: 0, padding: 0, margin: 0 }}>
        <label>Тип<select className="admin-input" value={value.kind} onChange={e => change("kind", e.target.value as AssessmentKind)}>{Object.entries(ASSESSMENT_LABELS).map(([kind, title]) => <option key={kind} value={kind}>{title}</option>)}</select></label>
        <label>Дата<input className="admin-input" type="date" required value={value.date} onChange={e => change("date", e.target.value)}/></label>
        <label className={styles.wide}>Предмет<input className="admin-input" required maxLength={160} value={value.subject} placeholder="Название дисциплины" onChange={e => change("subject", e.target.value)}/></label>
        <label>Начало<input className="admin-input" type="time" required value={value.timeStart} onChange={e => change("timeStart", e.target.value)}/></label>
        <label>Конец<input className="admin-input" type="time" required value={value.timeEnd} onChange={e => change("timeEnd", e.target.value)}/></label>
        <label className={styles.wide}>Преподаватель<input className="admin-input" maxLength={240} value={value.professor} onChange={e => change("professor", e.target.value)}/></label>
        <label className={styles.wide}>Аудитория или место<input className="admin-input" maxLength={240} value={value.auditorium} onChange={e => change("auditorium", e.target.value)}/></label>
        <label className={styles.wide}>Примечание<textarea className="admin-input" maxLength={4000} value={value.notes} placeholder="Что подготовить, взять с собой или уточнить" onChange={e => change("notes", e.target.value)}/></label>
      </fieldset>
      <p className={styles.help}>Запись и примечание будут видны всем в общем расписании и расписании сессии.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button type="button" className="admin-secondary" disabled={busy || closing} onClick={() => setClosing(true)}>Отмена</button><button className="admin-primary" disabled={busy || closing}>{busy ? "Сохраняем…" : "Сохранить"}</button></div>
    </form>
  </EventDialog>;
}
