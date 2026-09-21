import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { DAILY_QUOTE_AUTHOR, validQuoteDate, type DailyQuote, type DailyQuoteSelection } from "@/lib/daily-quotes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (!validQuoteDate(date)) return NextResponse.json({ quote: null }, { headers: { "Cache-Control": "no-store" } });

    const db = await getDatabase();
    const quotes = await db.collection<DailyQuote>("daily_quotes")
      .find({ active: true }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
    if (!quotes.length) return NextResponse.json({ quote: null }, { headers: { "Cache-Control": "no-store" } });

    const selectionCollection = db.collection<DailyQuoteSelection>("daily_quote_selections");
    const existing = await selectionCollection.findOne({ _id: date });
    let selected = existing ? quotes.find(quote => quote.id === existing.quoteId) ?? null : null;

    if (!selected) {
      const candidate = quotes[Math.floor(Math.random() * quotes.length)];
      const now = new Date().toISOString();

      if (existing) {
        await selectionCollection.updateOne(
          { _id: date },
          { $set: { quoteId: candidate.id, selectedAt: now } }
        );
        selected = candidate;
      } else {
        try {
          await selectionCollection.insertOne({ _id: date, quoteId: candidate.id, selectedAt: now });
          selected = candidate;
        } catch {
          const persisted = await selectionCollection.findOne({ _id: date });
          selected = quotes.find(quote => quote.id === persisted?.quoteId) ?? candidate;
        }
      }
    }

    return NextResponse.json({
      quote: { id: selected.id, text: selected.text, author: DAILY_QUOTE_AUTHOR, date },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load daily quote", error);
    return NextResponse.json({ quote: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
