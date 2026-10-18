"use client";

import { useEffect, useRef, useState } from "react";
import type { TechnicalChangelog } from "@/lib/technical-changelog";
import styles from "./TechnicalChangelogDialog.module.css";

export default function TechnicalChangelogDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<TechnicalChangelog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/technical-changelog", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Не удалось загрузить коммиты.");
        setData(result);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось загрузить коммиты.");
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="technical-changelog-title" onCancel={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className={styles.header}>
      <div><span>ИСТОРИЯ РАЗРАБОТКИ</span><h2 id="technical-changelog-title">Технический чейнджлог</h2>
        {data && <p>DEV {data.version} · {data.commits.length} коммитов · <a href={`https://github.com/ivanio69/schedule/pull/${data.pr}`} target="_blank" rel="noreferrer">PR #{data.pr} ↗</a></p>}
      </div>
      <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
    </header>
    <div className={styles.content} aria-busy={!data && !error}>
      {!data && !error && <p role="status">Загружаю коммиты…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Повторить</button></div>}
      {data?.commits.map(commit => {
        const [title, ...body] = commit.message.split("\n");
        return <article key={commit.sha} className={styles.commit}>
          <div className={styles.meta}><a href={`https://github.com/ivanio69/schedule/commit/${commit.sha}`} target="_blank" rel="noreferrer"><code>{commit.sha.slice(0, 7)} ↗</code></a><time dateTime={commit.date}>{new Date(commit.date).toLocaleString("ru-RU")}</time></div>
          <h3>{title}</h3>
          {body.join("\n").trim() && <pre>{body.join("\n").trim()}</pre>}
          <p className={styles.author}>{commit.author}</p>
        </article>;
      })}
    </div>
  </dialog>;
}
