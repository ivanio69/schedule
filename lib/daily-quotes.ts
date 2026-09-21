export const DAILY_QUOTE_AUTHOR = "Урбан А.М.";

export type DailyQuote = {
  id: string;
  text: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyQuoteSelection = {
  _id: string;
  quoteId: string;
  selectedAt: string;
};

export function validQuoteDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T12:00:00Z"));
}
