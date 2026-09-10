"use client";

import { useEffect, useMemo, useState } from "react";
import type { IndividualSlot } from "@/lib/individual-slots";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; };

export default function IndividualSlots() {
  const [slots, setSlots] = useState<(IndividualSlot & { studentName?: string | null })[]>([]);
  const [personId, setPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = async (id?: string) => {
    const today = new Date();
    const response = await fetch(`/api/individual-slots?from=${dateKey(today)}&to=${dateKey(addDays(today, 21))}`, { cache: "no-store" });
    if (response.ok) setSlots((await response.json()).slots ?? []);
    if (id) setPersonId(id);
    setLoading(false);
  };
  useEffect(() => { const id = localStorage.getItem("schedule_person_id"); if (id) void load(id); else setLoading(false); }, []);

  const mine = useMemo(() => slots.filter(slot => slot.studentId === personId), [slots, personId]);
  const available = useMemo(() => slots.filter(slot => !slot.studentId), [slots]);
  if (loading || !personId || !slots.length) return null;

  const book = async (slot: IndividualSlot) => {
    setBusy(slot.id); setMessage("");
    const response = await fetch("/api/individual-slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", slotId: slot.id, studentId: personId }) });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) { setMessage(data.error ?? "Не удалось записаться"); await load(personId); return; }
    setMessage("Ты записан на индивидуальное занятие"); await load(personId);
  };
  const release = async (slot: IndividualSlot) => {
    if (!confirm("Отменить запись на это занятие?")) return;
    setBusy(slot.id); setMessage("");
    const response = await fetch("/api/individual-slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", slotId: slot.id, studentId: personId }) });
    const data = await response.json(); setBusy(null);
    if (!response.ok) { setMessage(data.error ?? "Не удалось отменить запись"); return; }
    setMessage("Запись отменена"); await load(personId);
  };
  const formatDate = (value: string) => new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
  return <section className="student-slots"><header><div><p>ИНДИВИДУАЛЬНЫЕ</p><h2>Свободные слоты</h2><span>Выбери удобное время и запишись сам.</span></div><strong>{available.length}</strong></header>{message && <div className="student-slots-message">{message}</div>}{mine.length > 0 && <div className="student-slots-mine"><h3>Мои записи</h3>{mine.map(slot => <article key={slot.id}><div><small>{formatDate(slot.date)} · {slot.timeStart}–{slot.timeEnd}</small><strong>{slot.subject}</strong><span>{slot.professor}{slot.auditorium ? ` · ${slot.auditorium}` : ""}</span></div><button disabled={busy === slot.id} onClick={() => void release(slot)}>{busy === slot.id ? "…" : "Отменить"}</button></article>)}</div>}<div className="student-slots-list">{available.map(slot => <article key={slot.id}><div className="student-slot-date"><strong>{formatDate(slot.date)}</strong><span>{slot.timeStart}–{slot.timeEnd}</span></div><div className="student-slot-info"><strong>{slot.subject}</strong><span>{slot.professor}{slot.auditorium ? ` · ${slot.auditorium}` : ""}</span>{slot.note && <small>{slot.note}</small>}</div><button disabled={busy === slot.id} onClick={() => void book(slot)}>{busy === slot.id ? "Записываю…" : "Записаться"}</button></article>)}</div></section>;
}
