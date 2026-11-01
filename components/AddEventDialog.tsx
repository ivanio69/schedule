"use client";

import { useRef, useState } from "react";
import EventDialog from "./EventDialog";
import styles from "./PersonalEvents.module.css";

export default function AddEventDialog({ onClose, onRehearsal, onPersonal, onTask }: { onClose: () => void; onRehearsal: () => void; onPersonal: () => void; onTask: () => void }) {
  const [closing, setClosing] = useState(false);
  const nextAction = useRef<(() => void) | null>(null);
  const choose = (action: () => void) => { nextAction.current = action; setClosing(true); };
  const finishClose = () => { onClose(); nextAction.current?.(); };
  return <EventDialog closing={closing} compact eyebrow="НОВОЕ СОБЫТИЕ" title="Что добавим?" onClose={finishClose}>
    <p className={styles.description}>Выберите, что запланировать в расписании.</p>
    <div className={styles.choices}>
      <button type="button" className={styles.rehearsalChoice} onClick={() => choose(onRehearsal)}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v15H4zM8 3v4m8-4v4M4 10h16m-12 4h3m-3 3h7"/></svg></span><span><strong>Репетиция</strong><small>Пригласите участников и составьте план</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
      <button type="button" className={styles.personalChoice} onClick={() => choose(onPersonal)}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg></span><span><strong>Событие</strong><small>Ваши планы — только для вас или с приглашёнными</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
      <button type="button" className={styles.taskChoice} onClick={() => choose(onTask)}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8 12 3 3 5-6"/></svg></span><span><strong>Задача</strong><small>Личное дело на день, ко времени или после пар</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
    </div>
    <button type="button" className={styles.dismiss} onClick={() => setClosing(true)}>Отмена</button>
  </EventDialog>;
}
