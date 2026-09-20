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

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "schedule-environment-switcher",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function latestOpenDevelopmentPull() {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/pulls?state=open&sort=created&direction=desc&per_page=30`,
    { headers: githubHeaders(), next: { revalidate: 60 } },
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

async function versionForBranch(branch: string) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/version.json?ref=${encodeURIComponent(branch)}`,
      { headers: githubHeaders(), next: { revalidate: 30 } },
    );
    if (!response.ok) return null;
    const payload = await response.json() as { content?: string; encoding?: string };
    if (payload.encoding !== "base64" || !payload.content) return null;
    const parsed = JSON.parse(Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8")) as { release?: string; dev?: number };
    if (!parsed.release || !Number.isFinite(parsed.dev)) return null;
    return `${parsed.release}.dev${parsed.dev}`;
  } catch {
    return null;
  }
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

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function GET(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const gitRef = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  const isPreview = process.env.VERCEL_ENV === "preview" || Boolean(gitRef && gitRef !== "main");
  const proxiedDev = !isPreview && cookieValue(request, "schedule_environment") === "dev";
  const proxiedPr = Number(cookieValue(request, "schedule_dev_pr") ?? "") || null;
  const proxiedVersion = cookieValue(request, "schedule_dev_version");

  const stableUrl = absoluteVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? (process.env.VERCEL_ENV === "production" ? absoluteVercelUrl(process.env.VERCEL_URL) : null)
    ?? requestOrigin;

  let dev: { pr: number; branch: string; url: string; version: string } | null = null;

  if (isPreview) {
    const currentPreviewUrl = absoluteVercelUrl(process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
    if (currentPreviewUrl) {
      dev = {
        pr: versionInfo.pr,
        branch: gitRef,
        url: currentPreviewUrl,
        version: `${versionInfo.release}.dev${versionInfo.dev}`,
      };
    }
  } else {
    const pull = await latestOpenDevelopmentPull();
    const branch = pull?.head?.ref;
    if (pull && branch) {
      const url = branchPreviewUrl(branch);
      const version = await versionForBranch(branch);
      if (version && await previewExists(url)) {
        dev = { pr: pull.number, branch, url, version };
      }
    }
  }

  return NextResponse.json(
    {
      current: isPreview || proxiedDev ? "dev" : "stable",
      currentPr: isPreview ? versionInfo.pr : proxiedPr,
      currentVersion: isPreview ? `${versionInfo.release}.dev${versionInfo.dev}` : proxiedVersion,
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
