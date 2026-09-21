"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  announcementColors,
  announcementTextColor,
  type DashboardAnnouncement,
} from "@/lib/announcements";

export default function DashboardAnnouncements({ personId }: { personId: string }) {
  const [items, setItems] = useState<DashboardAnnouncement[]>([]);
  const [resolved, setResolved] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stopped = false;
    setResolved(false);
    setVisible(false);

    void fetch("/api/announcements?personId=" + encodeURIComponent(personId), { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (stopped) return;
        setItems(data?.announcements ?? []);
        setResolved(true);
      })
      .catch(() => {
        if (stopped) return;
        setItems([]);
        setResolved(true);
      });

    return () => { stopped = true; };
  }, [personId]);

  useEffect(() => {
    if (!resolved || !items.length) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [resolved, items.length]);

  return <div className={`dashboard-announcements-reveal${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
    <div className="dashboard-announcements-reveal-inner">
      {items.length > 0 && <section className="dashboard-announcements" aria-label="Объявления">
        {items.map(item => {
          const colors = announcementColors(item);
          const style = {
            "--announcement-accent": colors.accentColor,
            "--announcement-bg": colors.backgroundColor,
            "--announcement-text": announcementTextColor(colors.backgroundColor),
          } as CSSProperties;
          return <article key={item.id} style={style}>
            <span>ОБЪЯВЛЕНИЕ</span>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            {item.endsAt && <small>до {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(item.endsAt))}</small>}
          </article>;
        })}
      </section>}
    </div>
  </div>;
}
