"use client";

import { useEffect, useState } from "react";
import type { Rehearsal } from "@/lib/schedule";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export default function DashboardRehearsals() {
  const [items, setItems] = useState<Rehearsal[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch("/api/rehearsals", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { rehearsals?: Rehearsal[] };
        if (stopped) return;
        const today = new Date();
        const from = dateKey(today);
        const untilDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
        const until = dateKey(untilDate);
        setItems((data.rehearsals ?? []).filter(item => item.date >= from && item.date < until).sort((a, b) => `${a.date}${a.timeStart}`.localeCompare(`${b.date}${b.timeStart}`)));
      } finally {
        if (!stopped) setReady(true);
      }
    };
    void load();
    return () => { stopped = true; };
  }, []);

  if (!ready || items.length === 0) return null;

  return (
    <section className="dashboard-rehearsals">
      <div className="dashboard-rehearsals__head">
        <h2>Ближайшие репетиции</h2>
        <span>{items.length}</span>
      </div>
      <div className="dashboard-rehearsals__list">
        {items.map(item => (
          <article key={item.id} className="dashboard-rehearsal">
            <div className="dashboard-rehearsal__date">
              <strong>{item.timeStart}</strong>
              <small>{formatDate(item.date)}</small>
            </div>
            <div className="dashboard-rehearsal__main">
              <span>РЕПЕТИЦИЯ</span>
              <h3>{item.subject}</h3>
              <p>ответственный: {item.responsible}</p>
              <small>автор: {item.creatorName ?? "не указан"} · {item.participants.length} участн.</small>
            </div>
          </article>
        ))}
      </div>
      <style jsx>{`.dashboard-rehearsals{width:min(calc(100% - 28px),980px);margin:28px auto 64px}.dashboard-rehearsals__head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.dashboard-rehearsals__head h2{margin:0;font-size:21px;letter-spacing:-.025em}.dashboard-rehearsals__head span{color:#777780}.dashboard-rehearsals__list{display:grid;gap:8px}.dashboard-rehearsal{display:grid;grid-template-columns:120px minmax(0,1fr);gap:16px;padding:15px 16px;border:1px solid rgba(184,167,255,.35);border-radius:16px;background:#111114}.dashboard-rehearsal__date{display:grid;align-content:start;gap:4px}.dashboard-rehearsal__date strong{font-size:16px}.dashboard-rehearsal__date small,.dashboard-rehearsal__main p,.dashboard-rehearsal__main>small{color:#777780;font-size:10px}.dashboard-rehearsal__main>span{color:#777780;font-size:9px;font-weight:800;letter-spacing:.1em}.dashboard-rehearsal__main h3{margin:4px 0;font-size:15px}.dashboard-rehearsal__main p{margin:0 0 5px}.dashboard-rehearsal__main>small{font-size:10px}@media(max-width:650px){.dashboard-rehearsals{width:calc(100% - 20px);margin-top:22px}.dashboard-rehearsal{grid-template-columns:70px minmax(0,1fr);gap:10px;padding:13px}}`}</style>
    </section>
  );
}
