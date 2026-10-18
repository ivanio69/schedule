import { NextResponse } from "next/server";
import version from "@/version.json";
import { loadTechnicalChangelog } from "@/lib/technical-changelog";

export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!sha) return NextResponse.json({ error: "История доступна в опубликованной DEV-сборке." }, { status: 503 });
  try {
    const changelog = await loadTechnicalChangelog(sha, version.release, version.dev, version.pr);
    return NextResponse.json(changelog, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить коммиты. Попробуй ещё раз." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
