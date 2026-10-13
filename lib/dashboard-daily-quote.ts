export type DashboardDailyQuoteData = {
  id: string;
  text: string;
  author: string;
  date: string;
};

// The quote participates in the dashboard's loading boundary. Failure is
// optional content, and a stalled request must not leave the dashboard hidden.
export async function loadDashboardDailyQuote(date: string): Promise<DashboardDailyQuoteData | null> {
  try {
    const response = await fetch("/api/daily-quote?date=" + encodeURIComponent(date), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const quote = data?.quote;
    return quote && typeof quote.text === "string" && typeof quote.author === "string" ? quote : null;
  } catch {
    return null;
  }
}
