import { NextResponse } from "next/server";
import versionInfo from "@/version.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const gitRef = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  const isPreview = process.env.VERCEL_ENV === "preview" || Boolean(gitRef && gitRef !== "main");

  return NextResponse.json(
    {
      version: isPreview ? `${versionInfo.release}.dev${versionInfo.dev}` : versionInfo.release,
      release: versionInfo.release,
      dev: versionInfo.dev,
      channel: isPreview ? "preview" : "production",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
