"use client";

import { isBirthdayToday } from "@/lib/birthdays";
import { useContext } from "react";
import { BirthdayPersonContext } from "./BirthdayCelebration";
import type { Person } from "@/lib/people";
import styles from "./Birthday.module.css";

export default function BirthdayGreeting({ person, now }: { person: Person; now: Date }) {
  const profile = useContext(BirthdayPersonContext);
  if (profile?.id !== person.id || !isBirthdayToday(profile.birthday, now)) return null;
  const celebrate = async () => {
    const { fireBirthdayConfetti } = await import("@/lib/birthday-confetti");
    fireBirthdayConfetti();
  };
  return <section className={styles.card} aria-labelledby="birthday-title">
    <div className={styles.gift} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="12" y="29" width="40" height="25" rx="5"/><rect x="8" y="21" width="48" height="10" rx="3"/><path d="M32 21v33M32 21c-15 0-18-4-16-9 3-6 14 0 16 9Zm0 0c15 0 18-4 16-9-3-6-14 0-16 9Z"/><path d="m9 8 1 3 3 1-3 1-1 3-1-3-3-1 3-1Zm47 29 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></svg><span>✦</span></div>
    <div className={styles.message}><h2 id="birthday-title">С днём рождения, {person.name.trim().split(/\s+/)[0]}!</h2><p>Пусть сегодня будет больше улыбок, тёплых слов и маленьких чудес <span aria-hidden="true">✨</span></p><button type="button" className={styles.celebrate} onClick={() => void celebrate()}><span aria-hidden="true">✧</span> Ещё конфетти</button></div>
  </section>;
}
