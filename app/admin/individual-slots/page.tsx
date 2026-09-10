"use client";

import { useEffect, useMemo, useState } from "react";
import type { IndividualSlot } from "@/lib/individual-slots";

const blank = (): IndividualSlot => ({ id: "", subject: "", professor: "", auditorium: "", date: new Date().toISOString().slice(0, 10), timeStart: "09:00", timeEnd: "10:30", note: "", studentId: null, createdAt: "", updatedAt: "" });

export default function IndividualSlotsAdmin() {
  const [slots, setSlots] = useState<IndividualSlot[]>([]);
  const [form, setForm] = useState<IndividualSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "free" | "taken">("all");

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/individual-slots", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/admin"; return; }
    const data = await response.json();
    setSlots(data.slots ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!form?.subject.trim() || !form.professor.trim() || !form.date || form.timeStart >= form.timeEnd) { setMessage("Заполни предмет, преподавателя, дату и корректное время"); return; }
    setSaving(true);
    const response = await fetch("/api/admin/individual-slots", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(data.error ?? "Ошибка сохранения"); return; }
    setForm(null); setMessage(form.id ? "Слот обновлён" : "Слот создан"); await load();
  };

  const remove = async (id: string) => { if (!confirm("Удалить слот?")) return; await fetch(`/api/admin/individual-slots?id=${encodeURIComponent(id)}`, { method: "DELETE" }); await load(); };
  const visible = useMemo(() => slots.filter(s => filter === "all" || (filter === "free" ? !s.studentId : Boolean(s.studentId))), [slots, filter]);

  if (loading) return <main className="slots-admin"><div className="slots-spinner" /><p>Загрузка слотов…</p></main>;
  return <main className="slots-admin">
    <header className="slots-head"><div><a href="/admin">← Админка</a><p>ИНДИВИДУАЛЬНЫЕ</p><h1>Слоты</h1><span>Создай время — студенты сами запишутся.</span></div><button onClick={() => setForm(blank())}>＋ Новый слот</button></header>
    <section className="slots-toolbar"><div><strong>{slots.length}</strong><span>всего</span></div><div><strong>{slots.filter(s => !s.studentId).length}</strong><span>свободно</span></div><div><strong>{slots.filter(s => s.studentId).length}</strong><span>занято</span></div><nav>{(["all", "free", "taken"] as const).map(x => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x === "all" ? "Все" : x === "free" ? "Свободные" : "Занятые"}</button>)}</nav></section>
    {message && <p className="slots-message">{message}</p>}
    <section className="slots-list">{visible.length ? visible.map(slot => <article className="slot-card" key={slot.id}><div className="slot-date"><strong>{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(`${slot.date}T12:00:00`))}</strong><span>{slot.timeStart}–{slot.timeEnd}</span></div><div className="slot-info"><strong>{slot.subject}</strong><span>{slot.professor}{slot.auditorium ? ` · ${slot.auditorium}` : ""}</span>{slot.note && <small>{slot.note}</small>}</div><div className={`slot-status ${slot.studentId ? "taken" : "free"}`}>{slot.studentId ? "ЗАНЯТО" : "СВОБОДНО"}</div><div className="slot-actions"><button onClick={() => setForm(slot)}>Изменить</button><button onClick={() => void remove(slot.id)}>Удалить</button></div></article>) : <div className="slots-empty">Слотов пока нет. Создай первый.</div>}</section>
    {form && <div className="slots-overlay" onMouseDown={() => setForm(null)}><section className="slots-modal" onMouseDown={e => e.stopPropagation()}><header><div><p>СЛОТ</p><h2>{form.id ? "Изменить слот" : "Новый слот"}</h2></div><button onClick={() => setForm(null)}>×</button></header><div className="slots-form"><label>Предмет<input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Индивидуальное занятие" /></label><label>Преподаватель<input value={form.professor} onChange={e => setForm({ ...form, professor: e.target.value })} placeholder="ФИО преподавателя" /></label><label>Аудитория<input value={form.auditorium} onChange={e => setForm({ ...form, auditorium: e.target.value })} placeholder="Например, 305" /></label><label>Дата<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><div className="slot-times"><label>Начало<input type="time" value={form.timeStart} onChange={e => setForm({ ...form, timeStart: e.target.value })} /></label><label>Конец<input type="time" value={form.timeEnd} onChange={e => setForm({ ...form, timeEnd: e.target.value })} /></label></div><label>Комментарий<textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Что нужно знать студенту" /></label></div>{form.studentId && <p className="slot-warning">Слот уже забронирован. Изменение времени может конфликтовать с расписанием студента.</p>}<footer><button onClick={() => setForm(null)}>Отмена</button><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : "Сохранить"}</button></footer></section></div>}
  </main>;
}
