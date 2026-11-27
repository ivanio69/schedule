"use client";
/* eslint-disable @next/next/no-img-element -- Original authenticated attachments must bypass the image optimizer. */
import { useEffect, useState } from "react";
import EventDialog from "./EventDialog";
import { archiveFileUrl, archivePreviewKind, type ArchiveItem } from "@/lib/archive";
import styles from "./Archive.module.css";

export default function ArchiveFilePreview({ item, onClose }: { item: ArchiveItem; onClose: () => void }) {
  const kind = archivePreviewKind(item.extension);
  const [url, setUrl] = useState(kind === "office" ? "" : archiveFileUrl(item));
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [provider, setProvider] = useState<"microsoft" | "google">("microsoft");
  useEffect(() => {
    if (kind !== "office") return;
    const controller = new AbortController();
    void fetch(`/api/archive/preview?id=${encodeURIComponent(item.id)}`, { cache: "no-store", signal: controller.signal })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; })
      .then(data => setUrl(data.url))
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Не удалось открыть файл"); });
    return () => controller.abort();
  }, [item.id, kind, attempt]);
  useEffect(() => {
    if (!url || loaded) return;
    const timer = setTimeout(() => setError("Просмотр загружается дольше обычного. Попробуй другой просмотр или скачай файл"), 20000);
    return () => clearTimeout(timer);
  }, [url, loaded, provider]);
  const ready = () => { setLoaded(true); setError(""); };
  const failed = () => { setLoaded(true); setError("Не удалось показать файл. Его можно открыть отдельно или скачать"); };
  const viewer = kind === "office" ? (provider === "microsoft"
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`) : url;
  const original = archiveFileUrl(item);
  return <EventDialog title={item.title} eyebrow={`${item.extension.toUpperCase()} · Предпросмотр`} wide onClose={onClose}>
    <div className={styles.previewActions}>
      <a href={item.file ? `${original}?download=1` : original} download={item.file?.name} target="_blank" rel="noopener noreferrer">{item.file ? "Скачать файл ↓" : "Открыть оригинал ↗"}</a>
      {kind === "office" && <><button type="button" onClick={() => { setLoaded(false); setError(""); setProvider(p => p === "microsoft" ? "google" : "microsoft"); }}>Другой просмотр</button><button type="button" onClick={() => { setError(""); setUrl(""); setLoaded(false); setAttempt(n => n + 1); }}>Обновить</button></>}
    </div>
    {kind === "office" && <p className={styles.hint}>Онлайн-просмотр {provider === "microsoft" ? "Microsoft" : "Google"}. Сервис получает временную ссылку на файл. Для файлов по ссылке нужен прямой доступ без входа.</p>}
    {error && <p className={styles.notice} role="alert">{error}</p>}
    <div className={styles.preview} aria-busy={!loaded && kind !== "download"}>
      {!loaded && kind !== "download" && <p className={styles.previewLoading} role="status">Открываем файл…</p>}
      {url && (kind === "image" ? <img src={url} alt={item.title} onLoad={ready} onError={failed}/>
        : kind === "audio" ? <audio controls src={url} onLoadedMetadata={ready} onError={failed}/>
        : kind === "video" ? <video controls playsInline src={url} onLoadedMetadata={ready} onError={failed}/>
        : kind === "download" ? <p>Для этого формата доступно скачивание.</p>
        : <iframe key={viewer} src={viewer} title={`Предпросмотр: ${item.title}`} onLoad={ready} onError={failed} referrerPolicy="no-referrer" allow="fullscreen" sandbox={kind === "pdf" ? undefined : kind === "office" ? "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" : "allow-same-origin allow-downloads"}/>)}
    </div>
    {kind === "office" && url && <a className={styles.previewExternal} href={viewer} target="_blank" rel="noopener noreferrer">Открыть просмотр в новой вкладке ↗</a>}
  </EventDialog>;
}
