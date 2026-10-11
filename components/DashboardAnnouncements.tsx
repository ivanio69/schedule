"use client";

import ArtAppBanner from "@/components/ArtAppBanner";
import { artBannerDismissalKey } from "@/lib/art-app";
import { useEffect, useState, type CSSProperties } from "react";
import {
  announcementColors,
  announcementTextColor,
  type DashboardAnnouncement,
} from "@/lib/announcements";

type VisibleAnnouncement = DashboardAnnouncement & { acknowledgedAt?: string | null };

export default function DashboardAnnouncements({ personId }: { personId: string }) {
  return <AnnouncementsContent key={personId} personId={personId} />;
}

function AnnouncementsContent({ personId }: { personId: string }) {
  const [artEnabled, setArtEnabled] = useState(false);
  const [artDismissed, setArtDismissed] = useState(true);
  const [items, setItems] = useState<VisibleAnnouncement[]>([]);
  const [ackBusy, setAckBusy] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stopped = false;

    void fetch("/api/announcements?personId=" + encodeURIComponent(personId), { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (stopped) return;
        try { setArtDismissed(localStorage.getItem(artBannerDismissalKey(personId)) === "1"); }
        catch { setArtDismissed(false); }
        setArtEnabled(data?.artBannerEnabled === true);
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

  const acknowledge = async (announcementId: string) => {
    if (ackBusy) return;
    setAckBusy(announcementId);
    try {
      const response = await fetch("/api/announcements/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось подтвердить ознакомление");
      setItems(current => current.map(item => item.id === announcementId ? { ...item, acknowledgedAt: data?.acknowledgedAt ?? new Date().toISOString() } : item));
    } catch {} finally {
      setAckBusy(null);
    }
  };

  const showArt = artEnabled && !artDismissed;
  const dismissArt = () => {
    setArtDismissed(true);
    try { localStorage.setItem(artBannerDismissalKey(personId), "1"); } catch {}
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(resolved && (items.length > 0 || showArt)));
    return () => cancelAnimationFrame(frame);
  }, [resolved, items.length, showArt]);

  return <div className={`dashboard-announcements-reveal${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
    <div className="dashboard-announcements-reveal-inner">
      {(items.length > 0 || showArt) && <section className="dashboard-announcements" aria-label="Объявления">
        {showArt && <ArtAppBanner key={personId} onDismiss={dismissArt} />}
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
            {item.requiresAcknowledgement && <button type="button" className={"dashboard-announcement-ack" + (item.acknowledgedAt ? " is-done" : "")} disabled={Boolean(item.acknowledgedAt) || ackBusy === item.id} onClick={() => void acknowledge(item.id)}>{item.acknowledgedAt ? "Ознакомился ✓" : ackBusy === item.id ? "Сохраняю…" : "Ознакомился"}</button>}
          </article>;
        })}
      </section>}
    </div>
  </div>;
}
