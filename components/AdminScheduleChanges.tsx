"use client";

import { useRef, useState, type FormEvent } from "react";
import { DAY_NAMES, getCurrentWeek, getTotalWeeks, getScheduleDate, getOccurrences, formatWeekRange, type Lesson, type ScheduleData } from "@/lib/schedule";
import styles from "./AdminScheduleChanges.module.css";

type BatchItem = {
  id: string;
  label: string;
  source: string;
  target: string;
  conflicts: number;
  payload: Record<string, unknown>;
};

export default function AdminScheduleChanges({ initialSchedule, onChange }: { initialSchedule: ScheduleData; onChange: (schedule: ScheduleData) => void }) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [week, setWeek] = useState(() => getCurrentWeek(initialSchedule));
  const [day, setDay] = useState(() => Math.min((new Date().getDay() + 6) % 7, 5));
  const [editing, setEditing] = useState<{ lesson: Lesson; kind: "move" | "cancel" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moveConflicts, setMoveConflicts] = useState<{ class: string; timeStart: string; timeEnd: string; auditorium: string; group: (number | "china")[] }[]>([]);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [allowBatchConflicts, setAllowBatchConflicts] = useState(false);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const date = getScheduleDate(schedule, week, day);
  const lessons = getOccurrences(schedule, date);
  const changes = (schedule.changes ?? []).filter(c => c.date === date || c.targetDate === date);
  const close = () => { setEditing(null); setMoveConflicts([]); lastTrigger.current?.focus(); };
  const reload = async () => {
    const response = await fetch("/api/admin/schedule", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Не удалось обновить расписание");
    setSchedule(data.schedule);
    onChange(data.schedule);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || busy) return;
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const ignoreConflicts = submitter?.name === "ignoreConflicts" && submitter.value === "true";
    const stageOnly = submitter?.name === "action" && submitter.value === "batch";
    const targetDate = String(form.get("targetDate") ?? date);
    const timeStart = String(form.get("timeStart") ?? editing.lesson.timeStart);
    const timeEnd = String(form.get("timeEnd") ?? editing.lesson.timeEnd);
    const auditorium = String(form.get("auditorium") ?? editing.lesson.auditorium);
    const reason = String(form.get("reason") ?? "");
    const payload = { ...editing.lesson.occurrence, kind: editing.kind, reason, targetDate, timeStart, timeEnd, auditorium, ignoreConflicts };
    if (stageOnly) {
      const conflicts = editing.kind === "move" ? getOccurrences(schedule, targetDate).filter(item =>
        !(item.occurrence?.key === editing.lesson.occurrence?.key && item.occurrence?.date === editing.lesson.occurrence?.date)
        && item.timeStart < timeEnd && item.timeEnd > timeStart
        && (!item.group.length || !editing.lesson.group.length || item.group.some(group => editing.lesson.group.includes(group)))
      ).length : 0;
      const id = (editing.lesson.occurrence?.date ?? date) + ":" + (editing.lesson.occurrence?.key ?? editing.lesson.id ?? editing.lesson.class);
      const item: BatchItem = {
        id,
        label: editing.lesson.class,
        source: date.split("-").reverse().join(".") + " " + editing.lesson.timeStart + "–" + editing.lesson.timeEnd,
        target: editing.kind === "move" ? targetDate.split("-").reverse().join(".") + " " + timeStart + "–" + timeEnd + (auditorium ? " · ауд. " + auditorium : "") : "Отмена пары",
        conflicts,
        payload,
      };
      setBatch(current => [...current.filter(existing => existing.id !== id), item]);
      setPreviewOpen(false);
      setAllowBatchConflicts(false);
      close();
      setMessage("Добавлено в пакет изменений.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/schedule/changes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.code === "schedule_conflict") {
          setMoveConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
          return;
        }
        if (response.status === 409) await reload();
        throw new Error(data.error ?? "Не удалось сохранить изменение");
      }
      close();
      setMessage(data.warning ?? (data.delivery?.subscriptions ? `Сохранено. Push-сервис принял уведомления для ${data.delivery.sent ?? 0} из ${data.delivery.subscriptions} устройств.${data.delivery.failed ? " Часть отправок не удалась — используйте раздел «Уведомления»." : ""}` : "Сохранено. Нет устройств с включёнными уведомлениями об отменах и переносах."));
      try { await reload(); } catch { setError("Изменение сохранено. Обновите страницу, чтобы увидеть актуальное расписание."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сети. Обновите расписание перед повторной попыткой.");
    } finally { setBusy(false); }
  };
  const batchConflictCount = batch.reduce((sum, item) => sum + item.conflicts, 0);
  const applyBatch = async () => {
    if (!batch.length || busy) return;
    if (batchConflictCount > 0 && !allowBatchConflicts) {
      setPreviewOpen(true);
      setError("В пакете есть конфликты. Подтвердите принудительное применение в предпросмотре.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    let applied = 0;
    try {
      for (const item of batch) {
        const response = await fetch("/api/admin/schedule/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item.payload, ignoreConflicts: item.conflicts > 0 && allowBatchConflicts }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? ("Не удалось применить " + item.label));
        applied += 1;
      }
      setBatch([]); setPreviewOpen(false); setAllowBatchConflicts(false);
      setMessage("Пакет применён: " + applied + " изменений.");
      await reload();
    } catch (cause) {
      if (applied) setBatch(current => current.slice(applied));
      setError((cause instanceof Error ? cause.message : "Не удалось применить пакет") + ". Применено: " + applied + " из " + batch.length + ".");
      try { await reload(); } catch {}
    } finally { setBusy(false); }
  };
  return <section className={styles.root} aria-label="Изменения расписания на дату">
    <div className={styles.toolbar}>
      <div className={styles.week}>
        <button className="admin-secondary" aria-label="Предыдущая неделя" disabled={week <= 1 || busy} onClick={() => { close(); setWeek(week - 1); }}>←</button>
        <label>Учебная неделя<select className="admin-input" value={week} disabled={busy} onChange={e => { close(); setWeek(Number(e.target.value)); }}>{Array.from({ length: getTotalWeeks(schedule) }, (_, i) => <option value={i + 1} key={i}>{i + 1} · {formatWeekRange(schedule, i + 1)}</option>)}</select></label>
        <button className="admin-secondary" aria-label="Следующая неделя" disabled={week >= getTotalWeeks(schedule) || busy} onClick={() => { close(); setWeek(week + 1); }}>→</button>
      </div>
      <button className="admin-secondary" disabled={busy} onClick={() => { close(); setWeek(getCurrentWeek(schedule)); setDay(Math.min((new Date().getDay()+6)%7,5)); }}>Текущая неделя</button>
    </div>
    <div className={styles.days} aria-label="День недели">{DAY_NAMES.map((name, i) => <button key={name} aria-pressed={day === i} disabled={busy} onClick={() => { close(); setDay(i); }}><strong>{name}</strong><span>{getScheduleDate(schedule, week, i).slice(5).split("-").reverse().join(".")}</span><small>{getOccurrences(schedule, getScheduleDate(schedule, week, i)).filter(lesson => lesson.occurrence?.status !== "cancelled").length} пар</small></button>)}</div>
    <p className={styles.hint}>Перенос и отмена действуют только на выбранную пару. Уведомление получат подписчики, включившие отмены и переносы в настройках. Для серии правок можно собрать пакет и проверить его до публикации.</p>
    {batch.length > 0 && <section className={styles.batch}>
      <header><div><span>ПАКЕТ ИЗМЕНЕНИЙ</span><strong>{batch.length} шт.</strong></div><div className={styles.batchActions}><button type="button" className="admin-secondary" disabled={busy} onClick={() => { setBatch([]); setPreviewOpen(false); setAllowBatchConflicts(false); }}>Очистить</button><button type="button" className="admin-primary" disabled={busy} onClick={() => setPreviewOpen(value => !value)}>{previewOpen ? "Скрыть" : "Предпросмотр"}</button></div></header>
      <div className={styles.batchCompact}>{batch.map(item => <div key={item.id}><b>{item.label}</b><span>{item.source} → {item.target}</span><button type="button" aria-label={"Убрать " + item.label} disabled={busy} onClick={() => setBatch(current => current.filter(candidate => candidate.id !== item.id))}>×</button></div>)}</div>
      {previewOpen && <div className={styles.batchPreview}>
        <div className={styles.batchPreviewSummary}><article><span>Изменений</span><strong>{batch.length}</strong></article><article><span>Переносов</span><strong>{batch.filter(item => item.payload.kind === "move").length}</strong></article><article><span>Отмен</span><strong>{batch.filter(item => item.payload.kind === "cancel").length}</strong></article><article className={batchConflictCount ? styles.hasConflict : ""}><span>Конфликтов</span><strong>{batchConflictCount}</strong></article></div>
        <div className={styles.batchPreviewList}>{batch.map(item => <article key={item.id}><div><span>{item.payload.kind === "cancel" ? "ОТМЕНА" : "ПЕРЕНОС"}</span><strong>{item.label}</strong></div><p><s>{item.source}</s><b>→</b>{item.target}</p>{item.payload.reason ? <small>Причина: {String(item.payload.reason)}</small> : null}{item.conflicts > 0 && <em>Конфликтов: {item.conflicts}</em>}</article>)}</div>
        {batchConflictCount > 0 && <label className={styles.batchConflictConsent}><input type="checkbox" checked={allowBatchConflicts} onChange={event => setAllowBatchConflicts(event.target.checked)}/><span>Я проверил пересечения и разрешаю применить конфликтные переносы.</span></label>}
        <div className={styles.batchApply}><span>После подтверждения изменения сохранятся, а Push будут отправлены по каждому пункту.</span><button type="button" className="admin-primary" disabled={busy || (batchConflictCount > 0 && !allowBatchConflicts)} onClick={() => void applyBatch()}>{busy ? "Применяем…" : "Применить пакет"}</button></div>
      </div>}
    </section>}
    {message && <p className={styles.notice} role="status">{message}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!lessons.length && <div className={styles.empty}>На этот день пар нет</div>}
    <div className={styles.list}>{lessons.map(lesson => {
      const key = lesson.occurrence!.date + lesson.occurrence!.key;
      const active = editing?.lesson.occurrence?.key === lesson.occurrence!.key && editing?.lesson.occurrence?.date === lesson.occurrence!.date;
      const status = lesson.occurrence?.status;
      return <article className={`${styles.card}${status === "cancelled" ? ` ${styles.cardCancelled}` : status === "moved" ? ` ${styles.cardMoved}` : ""}`} key={key}>
        <div className={styles.summary}>
          <div className={styles.time}><strong>{lesson.timeStart}</strong><span>{lesson.timeEnd}</span></div>
          <div className={styles.subject}><h2>{lesson.class}</h2><p>{[lesson.professor, lesson.auditorium && `Ауд. ${lesson.auditorium}`, lesson.group.length === 1 ? `Подгруппа ${lesson.group[0]}` : "Вся группа"].filter(Boolean).join(" · ")}</p>{status && <small className={`${styles.badge}${status === "cancelled" ? ` ${styles.badgeCancelled}` : ""}`}>{status === "cancelled" ? "Отменена" : "Перенесена"}</small>}</div>
          <div className={styles.actions}>{status === "cancelled" ? <span className={styles.cancelledState}>Пара отменена</span> : <><button className="admin-secondary" disabled={busy} aria-expanded={active && editing.kind === "move"} onClick={e => { lastTrigger.current = e.currentTarget; setError(""); setMoveConflicts([]); setEditing({ lesson, kind: "move" }); }}>Перенести</button><button className="admin-danger" disabled={busy} aria-expanded={active && editing.kind === "cancel"} onClick={e => { lastTrigger.current = e.currentTarget; setError(""); setMoveConflicts([]); setEditing({ lesson, kind: "cancel" }); }}>Отменить пару</button></>}</div>
        </div>
        {active && <form key={editing.kind} className={styles.form} onSubmit={submit} onChange={() => { if (moveConflicts.length) setMoveConflicts([]); }}>
          <h3>{editing.kind === "move" ? "Куда перенести пару?" : "Подтвердите отмену пары"}</h3>
          <p>{date.split("-").reverse().join(".")} · {lesson.timeStart}–{lesson.timeEnd} · {lesson.class}</p>
          <fieldset disabled={busy}>
            {editing.kind === "move" && <div className={styles.fields}>
              <label>Новая дата<input autoFocus className="admin-input" name="targetDate" type="date" required defaultValue={date} min={getScheduleDate(schedule,1,0)} max={getScheduleDate(schedule,getTotalWeeks(schedule),5)}/></label>
              <label>Начало<input className="admin-input" name="timeStart" type="time" required defaultValue={lesson.timeStart}/></label>
              <label>Конец<input className="admin-input" name="timeEnd" type="time" required defaultValue={lesson.timeEnd}/></label>
              <label>Аудитория<input className="admin-input" name="auditorium" maxLength={120} defaultValue={lesson.auditorium}/></label>
            </div>}
            <label>Причина <span>(необязательно, попадёт в уведомление)</span><input autoFocus={editing.kind === "cancel"} className="admin-input" name="reason" maxLength={300} placeholder="Например, преподаватель заболел"/></label>
            {editing.kind === "move" && moveConflicts.length > 0 && <div className={styles.conflictWarning} role="alert">
              <div><strong>Есть конфликт · {moveConflicts.length}</strong><span>Перенос можно выполнить принудительно, если пересечение намеренное.</span></div>
              <div className={styles.conflictList}>{moveConflicts.map((conflict,index)=><div key={conflict.class+"-"+conflict.timeStart+"-"+index}><b>{conflict.timeStart}–{conflict.timeEnd} · {conflict.class}</b><small>{[conflict.auditorium && "Ауд. "+conflict.auditorium, conflict.group.length === 1 ? "Подгруппа "+conflict.group[0] : "Вся группа"].filter(Boolean).join(" · ")}</small></div>)}</div>
            </div>}
            <div className={styles.confirm}><button type="button" className="admin-secondary" onClick={close}>Назад</button><button className="admin-secondary" type="submit" name="action" value="batch">Добавить в пакет</button>{editing.kind === "move" && moveConflicts.length > 0 && <button className={styles.override} type="submit" name="ignoreConflicts" value="true">{busy ? "Сохраняем…" : "Всё равно перенести"}</button>}<button className={editing.kind === "cancel" ? "admin-danger" : "admin-primary"} type="submit">{busy ? "Сохраняем…" : editing.kind === "cancel" ? "Отменить и уведомить" : moveConflicts.length ? "Проверить снова" : "Перенести и уведомить"}</button></div>
          </fieldset>
        </form>}
      </article>;
    })}</div>
    {changes.length > 0 && <section className={styles.history}><h2>Изменения на эту дату</h2>{changes.map(c => <div key={c.date+c.key}><strong>{c.kind === "cancel" ? "Отмена" : "Перенос"} · {c.lesson.class}</strong><p>{c.date.split("-").reverse().join(".")} {c.lesson.timeStart}{c.kind === "move" ? ` → ${c.targetDate.split("-").reverse().join(".")} ${c.timeStart}–${c.timeEnd}` : ""}{c.reason ? ` · ${c.reason}` : ""}</p></div>)}</section>}
  </section>;
}
