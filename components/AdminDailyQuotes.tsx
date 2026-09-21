"use client";

import { useCallback, useEffect, useState } from "react";
import AdminHeading from "@/components/AdminHeading";
import LoadingState from "@/components/LoadingState";
import { DAILY_QUOTE_AUTHOR, type DailyQuote } from "@/lib/daily-quotes";

export default function AdminDailyQuotes() {
  const [items, setItems] = useState<DailyQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/daily-quotes", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok) setItems(data?.quotes ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const reset = () => { setText(""); setEditingId(null); };

  const save = async () => {
    if (busy || !text.trim()) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/daily-quotes", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, text } : { text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить цитату");
      setStatus(editingId ? "Цитата обновлена" : "Цитата добавлена");
      reset();
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить цитату");
    } finally { setBusy(false); }
  };

  const setActive = async (item: DailyQuote, active: boolean) => {
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/daily-quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, active }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось изменить цитату");
      setItems(current => current.map(value => value.id === item.id ? data.quote : value));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось изменить цитату");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить цитату?")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/admin/daily-quotes?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить цитату");
      setItems(current => current.filter(item => item.id !== id));
      if (editingId === id) reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось удалить цитату");
    } finally { setBusy(false); }
  };

  return <>
    <AdminHeading title="Цитаты дня" description="Добавляй фразы Урбана А.М. На дашборде каждый день случайно выбирается одна активная цитата." actions={<button className="admin-secondary" disabled={loading} onClick={() => void load()}>↻ Обновить</button>}/>

    <section className="admin-card admin-form-panel daily-quotes-form">
      <p className="admin-eyebrow">{editingId ? "Редактирование" : "Новая цитата"}</p>
      <h2>{editingId ? "Изменить цитату" : "Добавить в список"}</h2>
      <label>Текст<textarea className="admin-input" rows={4} maxLength={600} value={text} onChange={event=>setText(event.target.value)} placeholder="Введите цитату…"/></label>
      <div className="daily-quotes-author"><span>Автор</span><strong>{DAILY_QUOTE_AUTHOR}</strong></div>
      <div className="admin-form-actions">
        {editingId && <button className="admin-secondary" type="button" onClick={reset}>Отмена</button>}
        <button className="admin-primary" disabled={busy||!text.trim()} type="button" onClick={()=>void save()}>{busy?"Сохраняю…":editingId?"Сохранить":"Добавить цитату"}</button>
      </div>
      {status&&<p className="admin-success">{status}</p>}
    </section>

    {loading ? <LoadingState compact label="Загружаем цитаты" detail="Получаем список доступных фраз."/> :
      <section className="admin-card daily-quotes-list">
        <header><strong>Список цитат</strong><span>{items.filter(item=>item.active).length} активных · {items.length} всего</span></header>
        {items.length ? items.map(item=><article key={item.id} className={item.active?"is-active":""}>
          <div><span>{item.active?"АКТИВНА":"ВЫКЛЮЧЕНА"}</span><blockquote>{item.text}</blockquote><small>— {DAILY_QUOTE_AUTHOR}</small></div>
          <div>
            <button className="admin-secondary" disabled={busy} onClick={()=>{setEditingId(item.id);setText(item.text);window.scrollTo({top:0,behavior:"smooth"})}}>Редактировать</button>
            <button className="admin-secondary" disabled={busy} onClick={()=>void setActive(item,!item.active)}>{item.active?"Выключить":"Включить"}</button>
            <button className="admin-danger" disabled={busy} onClick={()=>void remove(item.id)}>Удалить</button>
          </div>
        </article>) : <p className="admin-empty">Добавь хотя бы одну цитату — после этого блок появится на дашборде.</p>}
      </section>}
  </>;
}
