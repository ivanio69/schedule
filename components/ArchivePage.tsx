"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ARCHIVE_SECTIONS, type ArchiveItem, type ArchiveKind } from "@/lib/archive";
import LoadingState from "./LoadingState";
import ArchiveIcon from "./ArchiveIcon";
import ArchiveEditor from "./ArchiveEditor";
import ArchiveFilePreview from "./ArchiveFilePreview";
import EventDialog from "./EventDialog";
import styles from "./Archive.module.css";

export default function ArchivePage({ admin = false }: { admin?: boolean }) {
  const reduced = useReducedMotion();
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArchiveKind | "all">("all");
  const [editor, setEditor] = useState<{ item: ArchiveItem | null; kind: ArchiveKind } | null>(null);
  const [preview, setPreview] = useState<ArchiveItem | null>(null);
  const [deleting, setDeleting] = useState<ArchiveItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteClosing, setDeleteClosing] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/archive", { cache: "no-store", signal: controller.signal }).then(async r => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error); return data;
    }).then(data => setItems(data.items)).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось загрузить архив"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("ru");
    return items.filter(item => (filter === "all" || item.kind === filter) && `${item.title} ${item.discipline} ${item.file?.name ?? ""}`.toLocaleLowerCase("ru").includes(search));
  }, [items, query, filter]);
  const sections = ARCHIVE_SECTIONS.filter(section => filter === "all" || section.kind === filter);
  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError("");
    try {
      const r = await fetch(`/api/admin/archive?id=${encodeURIComponent(deleting.id)}&revision=${deleting.revision}`, { method: "DELETE" });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setItems(current => current.filter(item => item.id !== deleting.id));
      setNotice("Материал удалён"); setDeleteClosing(true);
    } catch (e) { setDeleteError(e instanceof Error ? e.message : "Не удалось удалить материал"); }
    finally { setDeleteBusy(false); }
  }
  return <main className={`${styles.page}${admin ? ` admin-shell admin-unified ${styles.adminPage}` : ""}`}>
    {!admin && <Link className={styles.back} href="/">← На главную</Link>}
    <header className={styles.heading}>
      <div><h1>Архив</h1></div>
      {admin && <button type="button" className={styles.primary} onClick={() => setEditor({ item: null, kind: filter === "all" ? "show" : filter })}>+ Добавить</button>}
    </header>
    <p className={styles.srOnly} role="status">{notice}</p>
    {loading ? <LoadingState screen label="Загружаем архив"/> : error ? <div className={styles.empty} role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setRevision(n => n + 1); }}>Попробовать снова</button></div> : <>
      <div className={styles.toolbar}>
        <label className={styles.search}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg><span className={styles.srOnly}>Поиск по архиву</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Найти в архиве"/>{query && <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")}>×</button>}</label>
        <div className={styles.filters} role="group" aria-label="Разделы архива">
          {([{ kind: "all", label: "Всё" }, { kind: "show", label: "Показы" }, { kind: "file", label: "Файлы" }, { kind: "link", label: "Ссылки" }] as const).map(tab => <button type="button" key={tab.kind} aria-pressed={filter === tab.kind} onClick={() => setFilter(tab.kind)}>{tab.label}<span>{tab.kind === "all" ? items.length : items.filter(i => i.kind === tab.kind).length}</span></button>)}
        </div>
      </div>
      <div className={styles.sections}>
        {sections.map((section, index) => {
          const entries = filtered.filter(item => item.kind === section.kind);
          return <motion.section className={styles.section} key={`${section.kind}-${filter}`} aria-labelledby={`archive-${section.kind}`} initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: reduced ? 0 : index * .07 }}>
            <div className={styles.sectionHeading}><span className={styles.sectionIcon}><ArchiveIcon kind={section.kind}/></span><div><h2 id={`archive-${section.kind}`}>{section.title}<span>{entries.length}</span></h2></div>{admin && <button type="button" className={styles.addSection} aria-label={`Добавить: ${section.title}`} onClick={() => setEditor({ item: null, kind: section.kind })}>+</button>}</div>
            {entries.length ? <div className={styles.grid}>
              {entries.map((item, itemIndex) => <motion.article className={styles.card} key={item.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25, delay: reduced ? 0 : Math.min(itemIndex, 6) * .035 }}>
                <div className={styles.cardMeta}>{item.kind === "show" ? "YouTube" : item.kind === "file" ? `${item.extension.toUpperCase()}${item.file ? ` · ${item.file.size < 1024 * 1024 ? `${Math.ceil(item.file.size / 1024)} КБ` : `${(item.file.size / 1024 / 1024).toFixed(1)} МБ`}` : ""}` : new URL(item.url).hostname}</div>
                <h3>{item.title}</h3>
                {item.kind === "show" && <p className={styles.discipline}>{item.discipline}</p>}
                {item.kind === "file" && item.file && <p className={styles.filename}>{item.file.name}</p>}
                <div className={styles.cardFooter}>
                  {item.kind === "file" ? <button type="button" className={styles.open} onClick={() => setPreview(item)}>Открыть <span aria-hidden="true">↗</span></button> : <a className={styles.open} href={item.url} target="_blank" rel="noopener noreferrer">{item.kind === "show" ? "Смотреть на YouTube" : "Открыть"}<span aria-hidden="true">↗</span></a>}
                  {admin && <div className={styles.manage}><button type="button" aria-label={`Редактировать: ${item.title}`} onClick={() => setEditor({ item, kind: item.kind })}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z"/></svg></button><button type="button" aria-label={`Удалить: ${item.title}`} onClick={() => { setDeleteError(""); setDeleteClosing(false); setDeleting(item); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg></button></div>}
                </div>
              </motion.article>)}
            </div> : <div className={styles.empty}><p>{query ? "По запросу ничего не найдено" : admin ? "Здесь появятся добавленные материалы" : "Здесь скоро появятся материалы"}</p>{query && <button type="button" onClick={() => setQuery("")}>Сбросить поиск</button>}</div>}
          </motion.section>;
        })}
      </div>
    </>}
    {editor && <ArchiveEditor item={editor.item} initialKind={editor.kind} onClose={() => setEditor(null)} onSaved={item => { setItems(current => [item, ...current.filter(i => i.id !== item.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setNotice(editor.item ? "Изменения сохранены" : "Материал добавлен"); setEditor(null); }}/>}
    {preview && <ArchiveFilePreview item={preview} onClose={() => setPreview(null)}/>}
    {deleting && <EventDialog title="Удалить материал?" eyebrow="Архив" compact busy={deleteBusy} closing={deleteClosing} onClose={() => setDeleting(null)}><p className={styles.confirm}>«{deleting.title}» исчезнет из архива у всей группы.</p>{deleteError && <p role="alert" className={styles.notice}>{deleteError}</p>}<div className={styles.formActions}><button type="button" disabled={deleteBusy} onClick={() => setDeleteClosing(true)}>Отмена</button><button type="button" className={styles.danger} disabled={deleteBusy} onClick={() => void remove()}>{deleteBusy ? "Удаляем…" : "Удалить"}</button></div></EventDialog>}
  </main>;
}
