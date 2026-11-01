"use client";

import { useEffect, useState } from "react";
import type { TechnicalChangelog } from "@/lib/technical-changelog";
import styles from "./TechnicalChangelogDialog.module.css";
import TaskDialog from "./TaskDialog";

export default function TechnicalChangelogDialog({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<TechnicalChangelog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

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

  return <TaskDialog title="Технический чейнджлог" caption="ИСТОРИЯ РАЗРАБОТКИ" busy={false} closing={false} onClose={onClose}>
    {data && <p className={styles.summary}>DEV {data.version} · {data.commits.length} коммитов · <a href={`https://github.com/ivanio69/schedule/pull/${data.pr}`} target="_blank" rel="noreferrer">PR #{data.pr} ↗</a></p>}
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
  </TaskDialog>;
}
