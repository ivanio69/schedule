"use client";
import { useState, type FormEvent } from "react";
import { ARCHIVE_EXTENSIONS, ARCHIVE_SECTIONS, MAX_ARCHIVE_FILE_BYTES, archiveExtension, parseArchiveInput, type ArchiveItem, type ArchiveKind } from "@/lib/archive";
import EventDialog from "./EventDialog";
import styles from "./Archive.module.css";

export default function ArchiveEditor({ item, initialKind, onClose, onSaved }: { item: ArchiveItem | null; initialKind: ArchiveKind; onClose: () => void; onSaved: (item: ArchiveItem) => void }) {
  const [kind, setKind] = useState<ArchiveKind>(item?.kind ?? initialKind);
  const [title, setTitle] = useState(item?.title ?? "");
  const [discipline, setDiscipline] = useState(item?.discipline ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [source, setSource] = useState(item?.kind === "file" && !item.file ? "url" : "upload");
  const [extension, setExtension] = useState(item?.extension ?? "docx");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [savedItem, setSavedItem] = useState<ArchiveItem | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      parseArchiveInput({ kind, title, discipline, url, extension }, kind === "file" && source === "upload" && Boolean(file || item?.file));
      if (kind === "file" && source === "upload" && !file && !item?.file) throw new Error("Выбери файл для загрузки");
      if (file && file.size > MAX_ARCHIVE_FILE_BYTES) throw new Error("Файл должен быть не больше 4 МБ. Для большого файла укажи прямую ссылку");
      setBusy(true);
      const form = new FormData();
      Object.entries({ kind, title, discipline, url, source, extension, ...(item ? { id: item.id, revision: String(item.revision) } : {}) }).forEach(([k, v]) => form.set(k, v));
      if (file && source === "upload" && kind === "file") form.set("file", file);
      const response = await fetch("/api/admin/archive", { method: item ? "PATCH" : "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить материал");
      setSavedItem(data.item); setClosing(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить материал"); }
    finally { setBusy(false); }
  }
  return <EventDialog title={item ? "Редактировать материал" : "Добавить в архив"} eyebrow="Архив" busy={busy} closing={closing} onClose={() => savedItem ? onSaved(savedItem) : onClose()}>
    <form className={styles.form} onSubmit={submit}>
      {!item && <label>Раздел<select value={kind} onChange={e => setKind(e.target.value as ArchiveKind)} disabled={busy}>{ARCHIVE_SECTIONS.map(section => <option key={section.kind} value={section.kind}>{section.title}</option>)}</select></label>}
      <label>Название<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} required disabled={busy} placeholder={kind === "show" ? "Например, «Умная собачка Соня»" : "Как назвать материал"}/></label>
      {kind === "show" && <label>Дисциплина<input value={discipline} onChange={e => setDiscipline(e.target.value)} maxLength={160} required disabled={busy} placeholder="Например, режиссура эстрады"/></label>}
      {kind === "file" && <fieldset disabled={busy} className={styles.source}><legend>Файл</legend>{[["upload", "Загрузить файл"], ["url", "По ссылке"]].map(([value, label]) => <button key={value} type="button" aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}</fieldset>}
      {kind === "file" && source === "upload" ? <label className={styles.upload}>Выбрать {item?.file ? "новый файл" : "файл"}<input type="file" accept={ARCHIVE_EXTENSIONS.map(ext => `.${ext}`).join(",")} disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }}/><span className={styles.hint}>{file?.name ?? item?.file?.name ?? "DOCX, PPTX, XLSX, PDF, изображения и другие форматы"} · до 4 МБ</span></label>
        : <label>{kind === "show" ? "Ссылка на YouTube" : kind === "file" ? "Прямая ссылка на файл" : "Ссылка"}<input value={url} type="url" maxLength={4000} required disabled={busy} onChange={e => { setUrl(e.target.value); const ext = archiveExtension(e.target.value); if (ARCHIVE_EXTENSIONS.includes(ext)) setExtension(ext); }} placeholder="https://…"/></label>}
      {kind === "file" && source === "url" && <><label>Формат файла<select value={extension} disabled={busy} onChange={e => setExtension(e.target.value)}>{ARCHIVE_EXTENSIONS.map(ext => <option key={ext} value={ext}>{ext.toUpperCase()}</option>)}</select></label><p className={styles.hint}>Нужна ссылка на сам файл, доступный без входа. Для больших файлов используй этот способ.</p></>}
      {kind === "file" && <p className={styles.hint}>Документы Office открываются через онлайн-просмотр Microsoft или Google.</p>}
      {error && <p className={styles.notice} role="alert">{error}</p>}
      <div className={styles.formActions}><button type="button" disabled={busy} onClick={() => setClosing(true)}>Отмена</button><button className={styles.primary} disabled={busy} type="submit">{busy ? "Сохраняем…" : item ? "Сохранить" : "Добавить"}</button></div>
    </form>
  </EventDialog>;
}
