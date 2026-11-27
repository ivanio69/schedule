"use client";
import Image from "next/image";
import { useState } from "react";
import { archiveCoverUrl, type ArchiveItem } from "@/lib/archive";
import EventDialog from "./EventDialog";
import styles from "./Archive.module.css";

export default function ArchivePosterPreview({ item, onClose }: { item: ArchiveItem; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!item.cover) return null;
  const url = archiveCoverUrl(item.cover);
  return <EventDialog title={item.title} eyebrow="Афиша" wide onClose={onClose}>
    <div className={styles.previewActions}><button type="button" aria-pressed={zoom} onClick={() => setZoom(value => !value)}>{zoom ? "Уместить целиком" : "Увеличить"}</button><a href={`${url}?download=1`} download={item.cover.name} target="_blank" rel="noopener noreferrer">Скачать афишу ↓</a></div>
    {failed ? <p className={styles.notice} role="alert">Не удалось загрузить афишу. Попробуй открыть её ещё раз.</p> : <div className={styles.posterViewer} data-zoom={zoom} tabIndex={0} role="region" aria-label="Афиша. При увеличении доступна прокрутка."><Image className={styles.posterFull} src={url} alt={`Афиша показа «${item.title}»`} width={item.cover.width} height={item.cover.height} unoptimized onError={() => setFailed(true)}/></div>}
  </EventDialog>;
}
