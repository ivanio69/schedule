"use client";
import Image from "next/image";
import { useState } from "react";
import ArchiveIcon from "./ArchiveIcon";
import styles from "./Archive.module.css";

function PosterImage({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.posterFallback}><ArchiveIcon kind="show"/><span>Афиша недоступна</span></span>;
  // The archive route checks the user's session, so requests bypass the optimizer.
  return <Image className={styles.posterImage} data-loaded={loaded} src={src} alt={`Афиша показа «${title}»`} width={1600} height={2263} unoptimized loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}/>;
}

export default function ArchivePoster({ src, title, onOpen }: { src?: string; title: string; onOpen?: () => void }) {
  const content = src ? <PosterImage key={src} src={src} title={title}/> : <span className={styles.posterFallback} aria-hidden="true"><ArchiveIcon kind="show"/></span>;
  return onOpen && src ? <button type="button" className={styles.posterFrame} aria-label={`Открыть афишу: ${title}`} onClick={onOpen}>{content}<span className={styles.posterExpand} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></span></button>
    : <div className={styles.posterFrame}>{content}</div>;
}
