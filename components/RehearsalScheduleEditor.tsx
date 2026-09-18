"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/people";
import type { Rehearsal, RehearsalBlock, RehearsalParticipantMode } from "@/lib/schedule";
import { getRehearsalBounds } from "@/lib/rehearsals";

type Props = {
  admin?: boolean;
  initialDate?: string;
  editId?: string;
};

const blankBlock = (id = "block-1"): RehearsalBlock => ({
  id,
  title: "",
  timeStart: "18:00",
  timeEnd: "19:00",
  notes: "",
  participants: [],
});

const unique = (values: string[]) => [...new Set(values)];

export default function RehearsalScheduleEditor({ admin = false, initialDate = "", editId = "" }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [creatorId, setCreatorId] = useState("");
  const [subject, setSubject] = useState("");
  const [responsible, setResponsible] = useState("");
  const [date, setDate] = useState(initialDate);
  const [notes, setNotes] = useState("");
  const [participantMode, setParticipantMode] = useState<RehearsalParticipantMode>("rehearsal");
  const [participants, setParticipants] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<RehearsalBlock[]>([blankBlock()]);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const didSeedAdmin = useRef(false);

  const bounds = useMemo(() => getRehearsalBounds(blocks), [blocks]);
  const creatorName = useMemo(() => people.find(person => person.id === creatorId)?.name ?? "", [people, creatorId]);

  useEffect(() => {
    if (!admin) setCreatorId(localStorage.getItem("schedule_person_id") ?? "");
    void fetch("/api/people", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => setPeople(data?.people ?? []))
      .catch(() => setError("Не удалось загрузить список группы"));
  }, [admin]);

  useEffect(() => {
    if (!editId) return;
    const personId = admin ? "" : (localStorage.getItem("schedule_person_id") ?? "");
    const endpoint = admin
      ? `/api/admin/rehearsals?id=${encodeURIComponent(editId)}`
      : `/api/rehearsals?id=${encodeURIComponent(editId)}&personId=${encodeURIComponent(personId)}`;
    void fetch(endpoint, { cache: "no-store" }).then(async response => {
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось загрузить репетицию");
      const rehearsal = data.rehearsal as Rehearsal;
      if (!admin && rehearsal.creatorId !== personId) throw new Error("Редактировать репетицию может только автор");
      setSubject(rehearsal.subject);
      setResponsible(rehearsal.responsible);
      setDate(rehearsal.date);
      setNotes(rehearsal.notes ?? "");
      setParticipantMode(rehearsal.participantMode === "blocks" && rehearsal.blocks?.length ? "blocks" : "rehearsal");
      setParticipants(rehearsal.participants ?? []);
      setBlocks(rehearsal.blocks?.length ? rehearsal.blocks : [blankBlock()]);
    }).catch(value => setError(value instanceof Error ? value.message : "Не удалось загрузить репетицию")).finally(() => setLoading(false));
  }, [admin, editId]);

  useEffect(() => {
    if (!admin || editId || !people.length || didSeedAdmin.current) return;
    didSeedAdmin.current = true;
    const all = people.map(person => person.name);
    setParticipants(all);
    setBlocks(current => current.map(block => ({ ...block, participants: all })));
  }, [admin, editId, people]);

  useEffect(() => {
    if (admin || !creatorName || loading) return;
    setParticipants(current => current.includes(creatorName) ? current : [creatorName, ...current]);
    setBlocks(current => current.map(block => ({
      ...block,
      participants: block.participants.includes(creatorName) ? block.participants : [creatorName, ...block.participants],
    })));
  }, [admin, creatorName, loading]);

  const toggleName = (name: string) => { if (!admin && name === creatorName) return; setParticipants(current => current.includes(name) ? current.filter(item => item !== name) : [...current, name]); };
  const toggleBlockName = (blockId: string, name: string) => {
    if (!admin && name === creatorName) return;
    setBlocks(current => current.map(block => block.id !== blockId ? block : {
      ...block,
      participants: block.participants.includes(name) ? block.participants.filter(item => item !== name) : [...block.participants, name],
    }));
  };
  const updateBlock = (id: string, patch: Partial<RehearsalBlock>) => setBlocks(current => current.map(block => block.id === id ? { ...block, ...patch } : block));
  const addBlock = () => setBlocks(current => [...current, { ...blankBlock(crypto.randomUUID()), participants: !admin && creatorName ? [creatorName] : [] }]);
  const removeBlock = (id: string) => setBlocks(current => current.length === 1 ? current : current.filter(block => block.id !== id));

  const changeMode = (mode: RehearsalParticipantMode) => {
    if (mode === participantMode) return;
    if (mode === "blocks") {
      setBlocks(current => current.map(block => {
        const base = block.participants.length ? block.participants : participants;
        return { ...block, participants: !admin && creatorName ? unique([creatorName, ...base]) : base };
      }));
    } else if (!participants.length) {
      const next = unique(blocks.flatMap(block => block.participants));
      setParticipants(!admin && creatorName ? unique([creatorName, ...next]) : next);
    }
    setParticipantMode(mode);
  };

  const save = async () => {
    setError("");
    if (!admin && !creatorId) { setError("Сначала выберите свой профиль на дашборде"); return; }
    if (!subject.trim() || !responsible.trim() || !date) { setError("Заполните название, дату и ответственного"); return; }
    if (!blocks.length || blocks.some(block => !block.title.trim() || block.timeStart >= block.timeEnd)) { setError("Проверьте названия и время блоков"); return; }
    setSaving(true);
    try {
      const endpoint = admin ? "/api/admin/rehearsals" : "/api/rehearsals";
      const method = editId ? "PUT" : "POST";
      const payload = {
        ...(editId ? { id: editId } : {}),
        ...(admin ? {} : { creatorId }),
        subject,
        responsible,
        date,
        notes,
        participantMode,
        participants: participantMode === "rehearsal" ? (!admin && creatorName ? unique([creatorName, ...participants]) : participants) : [],
        blocks: blocks.map(block => ({
          ...block,
          title: block.title.trim(),
          notes: block.notes?.trim() ?? "",
          participants: participantMode === "blocks" ? (!admin && creatorName ? unique([creatorName, ...block.participants]) : block.participants) : [],
        })),
        timeStart: bounds.timeStart,
        timeEnd: bounds.timeEnd,
      };
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить репетицию");
      window.location.href = admin ? "/admin?tab=rehearsals" : "/schedule";
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось сохранить репетицию");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="rehearsal-editor-page"><div className="rehearsal-editor-loading">Загрузка репетиции…</div></main>;

  return <main className={`rehearsal-editor-page${admin ? " is-admin" : ""}`}>
    <header className="rehearsal-editor-head">
      <div><p>РЕПЕТИЦИЯ · ГРАФИК</p><h1>{editId ? "Редактировать график" : admin ? "Общая репетиция с графиком" : "Репетиция с графиком"}</h1><span>Разбейте репетицию на блоки и назначьте участников общим списком или отдельно для каждого блока.</span></div>
      <button type="button" className="rehearsal-editor-back" onClick={() => history.back()}>← Назад</button>
    </header>

    <section className="rehearsal-editor-card rehearsal-editor-main">
      <div className="rehearsal-editor-grid">
        <label>Название<input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Например, прогон первого акта" autoFocus /></label>
        <label>Дата<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Ответственный<input value={responsible} onChange={event => setResponsible(event.target.value)} placeholder="ФИО" /></label>
      </div>
      <label className="rehearsal-editor-notes">Заметки к репетиции<textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Общие заметки, что взять, что подготовить…" /></label>
      <div className="rehearsal-editor-summary"><span>Общее время</span><strong>{bounds.timeStart}–{bounds.timeEnd}</strong><small>{blocks.length} {blocks.length === 1 ? "блок" : "блоков"}</small></div>
    </section>

    <section className="rehearsal-editor-card rehearsal-editor-audience">
      <div><p>УЧАСТНИКИ</p><h2>Кого приглашать</h2></div>
      <div className="rehearsal-mode-switch" role="group" aria-label="Режим приглашений">
        <button type="button" className={participantMode === "rehearsal" ? "is-active" : ""} onClick={() => changeMode("rehearsal")}>Общий список</button>
        <button type="button" className={participantMode === "blocks" ? "is-active" : ""} onClick={() => changeMode("blocks")}>По блокам</button>
      </div>
      {participantMode === "rehearsal" && <div className="rehearsal-editor-people">{people.map(person => <button type="button" key={person.id} className={`${participants.includes(person.name) ? "is-active" : ""}${!admin && person.name===creatorName ? " is-locked" : ""}`} disabled={!admin && person.name===creatorName} title={!admin && person.name===creatorName ? "Автор участвует автоматически" : undefined} onClick={() => toggleName(person.name)}>{person.name}{!admin && person.name===creatorName ? " · автор" : ""}</button>)}</div>}
      <small>{participantMode === "rehearsal" ? "Этот список относится ко всей репетиции и ко всем её блокам." : "Участники выбираются отдельно внутри каждого блока."}</small>
    </section>

    <section className="rehearsal-editor-blocks">
      <div className="rehearsal-editor-section-head"><div><p>ГРАФИК</p><h2>Блоки репетиции</h2></div><button type="button" onClick={addBlock}>＋ Блок</button></div>
      {blocks.map((block, index) => <article className="rehearsal-block-editor" key={block.id}>
        <header><span>{String(index + 1).padStart(2, "0")}</span><strong>{block.title || "Новый блок"}</strong><button type="button" disabled={blocks.length === 1} onClick={() => removeBlock(block.id)}>Удалить</button></header>
        <div className="rehearsal-block-grid">
          <label>Название<input value={block.title} onChange={event => updateBlock(block.id, { title: event.target.value })} placeholder="Сцена / номер / задача" /></label>
          <label>Начало<input type="time" value={block.timeStart} onChange={event => updateBlock(block.id, { timeStart: event.target.value })} /></label>
          <label>Конец<input type="time" value={block.timeEnd} onChange={event => updateBlock(block.id, { timeEnd: event.target.value })} /></label>
        </div>
        <label className="rehearsal-block-notes">Заметка<textarea value={block.notes ?? ""} onChange={event => updateBlock(block.id, { notes: event.target.value })} placeholder="Что происходит в этом блоке…" /></label>
        {participantMode === "blocks" && <div className="rehearsal-block-audience"><span>Участники блока</span><div className="rehearsal-editor-people">{people.map(person => <button type="button" key={person.id} className={`${block.participants.includes(person.name) ? "is-active" : ""}${!admin && person.name===creatorName ? " is-locked" : ""}`} disabled={!admin && person.name===creatorName} title={!admin && person.name===creatorName ? "Автор участвует автоматически" : undefined} onClick={() => toggleBlockName(block.id, person.name)}>{person.name}{!admin && person.name===creatorName ? " · автор" : ""}</button>)}</div><small>{block.participants.length ? `Выбрано: ${block.participants.length}` : "Никто не приглашён в этот блок"}</small></div>}
      </article>)}
    </section>

    {error && <p className="rehearsal-editor-error">{error}</p>}
    <footer className="rehearsal-editor-footer"><button type="button" className="rehearsal-editor-cancel" onClick={() => history.back()}>Отмена</button><button type="button" className="rehearsal-editor-save" disabled={saving} onClick={() => void save()}>{saving ? "Сохраняю…" : editId ? "Сохранить изменения" : "Создать репетицию"}</button></footer>
  </main>;
}
