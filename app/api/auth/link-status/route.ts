import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";

type LinkDoc = { id:string; expiresAt:string; linkedAt?:string };

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ linked: false }, { status: 400 });
  const link = await (await getDatabase()).collection<LinkDoc>("auth_telegram_links").findOne({ id }, { projection: { _id: 0 } });
  if (!link || link.expiresAt <= new Date().toISOString()) return NextResponse.json({ linked: false, expired: true });
  return NextResponse.json({ linked: Boolean(link.linkedAt) }, { headers: { "Cache-Control": "no-store" } });
}
