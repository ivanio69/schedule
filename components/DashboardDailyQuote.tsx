"use client";

import { useEffect, useMemo, useState } from "react";

type DailyQuoteResponse = {
  id: string;
  text: string;
  author: string;
  date: string;
};

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DashboardDailyQuote() {
  const [quote, setQuote] = useState<DailyQuoteResponse | null>(null);
  const [resolved, setResolved] = useState(false);
  const [visible, setVisible] = useState(false);
  const date = useMemo(() => localDateKey(), []);

  useEffect(() => {
    let stopped = false;
    setResolved(false);
    setVisible(false);

    void fetch("/api/daily-quote?date=" + encodeURIComponent(date), { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (stopped) return;
        setQuote(data?.quote ?? null);
        setResolved(true);
      })
      .catch(() => {
        if (stopped) return;
        setQuote(null);
        setResolved(true);
      });

    return () => { stopped = true; };
  }, [date]);

  useEffect(() => {
    if (!resolved || !quote) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [resolved, quote]);

  return <div className={`dashboard-daily-quote-reveal${visible ? " is-visible" : ""}`} aria-hidden={!visible}>
    <div className="dashboard-daily-quote-reveal-inner">
      {quote && <aside className="dashboard-daily-quote" aria-label="Цитата дня">
        <span>ЦИТАТА ДНЯ</span>
        <blockquote>«{quote.text}»</blockquote>
        <footer>— {quote.author}</footer>
      </aside>}
    </div>
  </div>;
}
