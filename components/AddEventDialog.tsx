"use client";

import EventDialog from "./EventDialog";
import styles from "./PersonalEvents.module.css";

export default function AddEventDialog({ onClose, onRehearsal, onPersonal }: { onClose: () => void; onRehearsal: () => void; onPersonal: () => void }) {
  return <EventDialog compact eyebrow="НОВОЕ СОБЫТИЕ" title="Что добавим?" onClose={onClose}>
    <p className={styles.description}>Выберите, что запланировать в расписании.</p>
    <div className={styles.choices}>
      <button type="button" className={styles.rehearsalChoice} onClick={onRehearsal}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v15H4zM8 3v4m8-4v4M4 10h16m-12 4h3m-3 3h7"/></svg></span><span><strong>Репетиция</strong><small>Пригласите участников и составьте план</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
      <button type="button" className={styles.personalChoice} onClick={onPersonal}><span className={styles.choiceIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg></span><span><strong>Личное событие</strong><small>Ваши планы, место и заметки — только для вас</small></span><span className={styles.arrow} aria-hidden="true">→</span></button>
    </div>
    <button type="button" className={styles.dismiss} onClick={onClose}>Отмена</button>
  </EventDialog>;
}
