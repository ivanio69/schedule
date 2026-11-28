"use client";

import { normalizeBirthday } from "@/lib/birthdays";
import styles from "./Birthday.module.css";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

export default function BirthdayField({ value = "", onChange }: { value?: string; onChange: (value: string) => void }) {
  const [month = "", day = ""] = value.split("-");
  const update = (nextMonth: string, nextDay: string) => onChange(nextMonth || nextDay ? `${nextMonth}-${nextDay}` : "");
  const invalid = normalizeBirthday(value) === null;
  return <fieldset className={styles.field}>
    <legend>День рождения</legend>
    <div className={styles.dateInputs}>
      <label><span className={styles.srOnly}>День рождения: день</span><select className="admin-input" aria-invalid={invalid || undefined} value={day} onChange={event => update(month, event.target.value)}><option value="">День</option>{Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map(day => <option key={day} value={day}>{Number(day)}</option>)}</select></label>
      <label><span className={styles.srOnly}>День рождения: месяц</span><select className="admin-input" aria-invalid={invalid || undefined} value={month} onChange={event => update(event.target.value, day)}><option value="">Месяц</option>{MONTHS.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}</select></label>
      {value && <button type="button" className="admin-secondary" onClick={() => onChange("")}>Убрать</button>}
    </div>
    <small className="admin-muted">Необязательно, без года. В этот день пользователь увидит личное поздравление и конфетти.</small>
    {invalid && <small className={styles.error}>Выберите существующий день и месяц.</small>}
  </fieldset>;
}
