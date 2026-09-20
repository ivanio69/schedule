"use client";

import { useEffect, useState } from "react";
import type { DashboardAnnouncement } from "@/lib/announcements";

export default function DashboardAnnouncements({ personId }: { personId: string }) {
  const [items, setItems] = useState<DashboardAnnouncement[]>([]);
  useEffect(() => {
    let stopped = false;
    void fetch("/api/announcements?personId=" + encodeURIComponent(personId), { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!stopped) setItems(data?.announcements ?? []); })
      .catch(() => {});
    return () => { stopped = true; };
  }, [personId]);
  if (!items.length) return null;
  return <section className="dashboard-announcements" aria-label="Объявления">
    {items.map(item => <article key={item.id}>
      <span>ОБЪЯВЛЕНИЕ</span>
      <h2>{item.title}</h2>
      <p>{item.body}</p>
      {item.endsAt && <small>до {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(item.endsAt))}</small>}
    </article>)}
  </section>;
}
