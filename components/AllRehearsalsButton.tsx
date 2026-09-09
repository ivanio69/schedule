"use client";

import { useEffect, useState } from "react";
import type { Rehearsal } from "@/lib/schedule";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

export default function AllRehearsalsButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    fetch("/api/rehearsals", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Не удалось загрузить репетиции");
        setItems(data.rehearsals ?? []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить репетиции"))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button type="button" className="all-rehearsals-button" onClick={() => setOpen(true)}>
        ВСЕ
      </button>
      {open && (
        <div className="all-rehearsals-backdrop" onMouseDown={() => setOpen(false)}>
          <section className="all-rehearsals-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="all-rehearsals-title">
            <header className="all-rehearsals-head">
              <div>
                <p className="rehearsal-label">214Р</p>
                <h2 id="all-rehearsals-title">Все репетиции</h2>
              </div>
              <button type="button" className="all-rehearsals-close" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
            </header>
            {loading ? (
              <div className="all-rehearsals-empty">Загрузка…</div>
            ) : error ? (
              <div className="all-rehearsals-empty">{error}</div>
            ) : items.length === 0 ? (
              <div className="all-rehearsals-empty">Репетиций пока нет.</div>
            ) : (
              <div className="all-rehearsals-list">
                {items.map((item) => (
                  <article className="all-rehearsal-item" key={item.id}>
                    <div className="all-rehearsal-time">
                      <strong>{item.timeStart}</strong>
                      <small>{item.timeEnd}</small>
                    </div>
                    <div>
                      <p className="all-rehearsal-date">{formatDate(item.date)}</p>
                      <h3>{item.subject}</h3>
                      <p>{item.responsible}</p>
                      {item.participants.length > 0 && <small>{item.participants.join(", ")}</small>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <style jsx global>{`
        .all-rehearsals-button{border:1px solid #303036;background:#111114;color:#f5f5f5;border-radius:10px;padding:8px 11px;font-size:11px;font-weight:800;letter-spacing:.08em;cursor:pointer;transition:.18s ease}
        .all-rehearsals-button:hover{background:#1b1b20;border-color:#55555d}
        .all-rehearsals-backdrop{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72)}
        .all-rehearsals-modal{width:min(100%,560px);max-height:82vh;overflow:auto;padding:20px;border:1px solid #303036;border-radius:22px;background:#111114;box-shadow:0 30px 100px #000}
        .all-rehearsals-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
        .all-rehearsals-head h2{margin:4px 0 0;font-size:25px;letter-spacing:-.03em}
        .all-rehearsals-close{border:0;background:none;color:#94949d;font-size:28px;line-height:1;cursor:pointer}
        .all-rehearsals-list{display:grid;gap:8px}
        .all-rehearsal-item{display:grid;grid-template-columns:64px 1fr;gap:14px;padding:14px;border:1px solid #27272c;border-radius:15px;background:#151518}
        .all-rehearsal-time{display:grid;align-content:start;gap:2px}
        .all-rehearsal-time strong{font-size:16px}
        .all-rehearsal-time small,.all-rehearsal-item p,.all-rehearsal-item>div>small{color:#94949d}
        .all-rehearsal-item p{margin:0;font-size:12px}
        .all-rehearsal-item h3{margin:3px 0;font-size:15px}
        .all-rehearsal-date{text-transform:capitalize}
        .all-rehearsals-empty{padding:34px 12px;color:#777780;text-align:center}
        @media(max-width:520px){.all-rehearsals-modal{padding:16px;border-radius:18px}.all-rehearsal-item{grid-template-columns:58px 1fr;padding:12px}}
      `}</style>
    </>
  );
}
