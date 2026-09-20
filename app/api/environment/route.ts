import { NextResponse } from "next/server";
import versionInfo from "@/version.json";

const GITHUB_REPO = "ivanio69/schedule";
const VERCEL_PROJECT = "schedule";
const VERCEL_SCOPE = "ivanio";

type GitHubPull = {
  number: number;
  draft?: boolean;
  base?: { ref?: string };
  head?: {
    ref?: string;
    repo?: { full_name?: string };
  };
};

function absoluteVercelUrl(host?: string | null) {
  if (!host) return null;
  return host.startsWith("http://") || host.startsWith("https://") ? host : `https://${host}`;
}

function branchSlug(ref: string) {
  return ref
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function branchPreviewUrl(ref: string) {
  return `https://${VERCEL_PROJECT}-git-${branchSlug(ref)}-${VERCEL_SCOPE}.vercel.app`;
}

async function latestOpenDevelopmentPull() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "schedule-environment-switcher",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/pulls?state=open&sort=created&direction=desc&per_page=30`,
    { headers, next: { revalidate: 60 } },
  );
  if (!response.ok) return null;

  const pulls = (await response.json()) as GitHubPull[];
  return pulls
    .filter((pull) =>
      pull.number > versionInfo.pr
      && pull.base?.ref === "main"
      && pull.head?.repo?.full_name === GITHUB_REPO
      && Boolean(pull.head?.ref),
    )
    .sort((a, b) => b.number - a.number)[0] ?? null;
}

async function previewExists(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    return response.status !== 404;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const gitRef = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  const isPreview = process.env.VERCEL_ENV === "preview" || Boolean(gitRef && gitRef !== "main");

  const stableUrl = absoluteVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? (process.env.VERCEL_ENV === "production" ? absoluteVercelUrl(process.env.VERCEL_URL) : null)
    ?? requestOrigin;

  let dev: { pr: number; branch: string; url: string } | null = null;

  if (isPreview) {
    const currentPreviewUrl = absoluteVercelUrl(process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
    if (currentPreviewUrl) {
      dev = {
        pr: versionInfo.pr,
        branch: gitRef,
        url: currentPreviewUrl,
      };
    }
  } else {
    const pull = await latestOpenDevelopmentPull();
    const branch = pull?.head?.ref;
    if (pull && branch) {
      const url = branchPreviewUrl(branch);
      if (await previewExists(url)) {
        dev = { pr: pull.number, branch, url };
      }
    }
  }

  return NextResponse.json(
    {
      current: isPreview ? "dev" : "stable",
      stable: { url: stableUrl },
      dev,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
