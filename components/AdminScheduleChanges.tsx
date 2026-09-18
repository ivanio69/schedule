"use client";

import { useRef, useState, type FormEvent } from "react";
import { DAY_NAMES, getCurrentWeek, getTotalWeeks, getScheduleDate, getOccurrences, formatWeekRange, type Lesson, type ScheduleData } from "@/lib/schedule";
import styles from "./AdminScheduleChanges.module.css";

export default function AdminScheduleChanges({ initialSchedule, onChange }: { initialSchedule: ScheduleData; onChange: (schedule: ScheduleData) => void }) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [week, setWeek] = useState(() => getCurrentWeek(initialSchedule));
  const [day, setDay] = useState(() => Math.min((new Date().getDay() + 6) % 7, 5));
  const [editing, setEditing] = useState<{ lesson: Lesson; kind: "move" | "cancel" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const date = getScheduleDate(schedule, week, day);
  const lessons = getOccurrences(schedule, date);
  const changes = (schedule.changes ?? []).filter(c => c.date === date || c.targetDate === date);
  const close = () => { setEditing(null); lastTrigger.current?.focus(); };
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
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/schedule/changes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editing.lesson.occurrence, kind: editing.kind, reason: form.get("reason") ?? "", targetDate: form.get("targetDate"), timeStart: form.get("timeStart"), timeEnd: form.get("timeEnd"), auditorium: form.get("auditorium") }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) await reload();
        throw new Error(data.error ?? "Не удалось сохранить изменение");
      }
      close();
      setMessage(data.warning ?? (data.delivery.subscriptions ? `Сохранено. Push-сервис принял уведомления для ${data.delivery.sent} из ${data.delivery.subscriptions} устройств.${data.delivery.failed ? " Часть отправок не удалась — используйте раздел «Уведомления»." : ""}` : "Сохранено. Нет устройств с включёнными уведомлениями об отменах и переносах."));
      try { await reload(); } catch { setError("Изменение сохранено. Обновите страницу, чтобы увидеть актуальное расписание."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сети. Обновите расписание перед повторной попыткой.");
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
    <div className={styles.days} aria-label="День недели">{DAY_NAMES.map((name, i) => <button key={name} aria-pressed={day === i} disabled={busy} onClick={() => { close(); setDay(i); }}><strong>{name}</strong><span>{getScheduleDate(schedule, week, i).slice(5).split("-").reverse().join(".")}</span><small>{getOccurrences(schedule, getScheduleDate(schedule, week, i)).length} пар</small></button>)}</div>
    <p className={styles.hint}>Перенос и отмена действуют только на выбранную пару. Уведомление получат подписчики, включившие отмены и переносы в настройках.</p>
    {message && <p className={styles.notice} role="status">{message}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!lessons.length && <div className={styles.empty}>На этот день пар нет</div>}
    <div className={styles.list}>{lessons.map(lesson => {
      const key = lesson.occurrence!.date + lesson.occurrence!.key;
      const active = editing?.lesson.occurrence?.key === lesson.occurrence!.key && editing?.lesson.occurrence?.date === lesson.occurrence!.date;
      return <article className={styles.card} key={key}>
        <div className={styles.summary}>
          <div className={styles.time}><strong>{lesson.timeStart}</strong><span>{lesson.timeEnd}</span></div>
          <div className={styles.subject}><h2>{lesson.class}</h2><p>{[lesson.professor, lesson.auditorium && `Ауд. ${lesson.auditorium}`, lesson.group.length === 1 ? `Подгруппа ${lesson.group[0]}` : "Вся группа"].filter(Boolean).join(" · ")}</p>{lesson.occurrence!.revision > 0 && <small className={styles.badge}>Перенесена</small>}</div>
          <div className={styles.actions}><button className="admin-secondary" disabled={busy} aria-expanded={active && editing.kind === "move"} onClick={e => { lastTrigger.current = e.currentTarget; setError(""); setEditing({ lesson, kind: "move" }); }}>Перенести</button><button className="admin-danger" disabled={busy} aria-expanded={active && editing.kind === "cancel"} onClick={e => { lastTrigger.current = e.currentTarget; setError(""); setEditing({ lesson, kind: "cancel" }); }}>Отменить пару</button></div>
        </div>
        {active && <form key={editing.kind} className={styles.form} onSubmit={submit}>
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
            <div className={styles.confirm}><button type="button" className="admin-secondary" onClick={close}>Назад</button><button className={editing.kind === "cancel" ? "admin-danger" : "admin-primary"} type="submit">{busy ? "Сохраняем…" : editing.kind === "cancel" ? "Отменить и уведомить" : "Перенести и уведомить"}</button></div>
          </fieldset>
        </form>}
      </article>;
    })}</div>
    {changes.length > 0 && <section className={styles.history}><h2>Изменения на эту дату</h2>{changes.map(c => <div key={c.date+c.key}><strong>{c.kind === "cancel" ? "Отмена" : "Перенос"} · {c.lesson.class}</strong><p>{c.date.split("-").reverse().join(".")} {c.lesson.timeStart}{c.kind === "move" ? ` → ${c.targetDate.split("-").reverse().join(".")} ${c.timeStart}–${c.timeEnd}` : ""}{c.reason ? ` · ${c.reason}` : ""}</p></div>)}</section>}
  </section>;
}
