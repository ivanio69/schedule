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

export default function ArchivePoster({ src, title }: { src?: string; title: string }) {
  const content = src ? <PosterImage key={src} src={src} title={title}/> : <span className={styles.posterPlaceholder} aria-hidden="true"><ArchiveIcon kind="show"/><strong>{title}</strong><i/></span>;
  return <div className={styles.posterFrame}>{content}</div>;
}
