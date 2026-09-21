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
  const date = useMemo(() => localDateKey(), []);

  useEffect(() => {
    let stopped = false;
    void fetch("/api/daily-quote?date=" + encodeURIComponent(date), { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!stopped) setQuote(data?.quote ?? null); })
      .catch(() => {});
    return () => { stopped = true; };
  }, [date]);

  if (!quote) return null;

  return <aside className="dashboard-daily-quote" aria-label="Цитата дня">
    <span>ЦИТАТА ДНЯ</span>
    <blockquote>«{quote.text}»</blockquote>
    <footer>— {quote.author}</footer>
  </aside>;
}
