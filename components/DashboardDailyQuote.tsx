"use client";

import type { DashboardDailyQuoteData } from "@/lib/dashboard-daily-quote";

export default function DashboardDailyQuote({ quote }: { quote: DashboardDailyQuoteData | null }) {
  if (!quote) return null;

  return <div className="dashboard-daily-quote-reveal is-visible">
    <div className="dashboard-daily-quote-reveal-inner">
      <aside className="dashboard-daily-quote" aria-label="Цитата дня">
        <span>ЦИТАТА ДНЯ</span>
        <blockquote>«{quote.text}»</blockquote>
        <footer>— {quote.author}</footer>
      </aside>
    </div>
  </div>;
}
