import { NextResponse } from "next/server";
import versionInfo from "@/version.json";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";

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
    { headers: githubHeaders(), next: { revalidate: 8 }, signal: AbortSignal.timeout(3000) },
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

async function developmentPullByNumber(number: number) {
  if (!Number.isFinite(number) || number < 1) return null;
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/pulls/${number}`,
      { headers: githubHeaders(), next: { revalidate: 5 }, signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return null;
    return await response.json() as GitHubPull;
  } catch {
    return null;
  }
}

async function versionForBranch(branch: string) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/version.json?ref=${encodeURIComponent(branch)}`,
      { headers: githubHeaders(), next: { revalidate: 5 }, signal: AbortSignal.timeout(3000) },
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

async function previewExists(url: string, expectedVersion: string) {
  try {
    const response = await fetch(new URL("/api/build-version", url), {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const build = await response.json();
    return build.channel === "preview" && build.version === expectedVersion;
  } catch {
    return false;
  }
}

// Validate the selected build and this user's session before changing environments.
// Never relay a preview's Set-Cookie headers: a rejected preview session must not
// erase the working production session.
export async function POST(request: Request) {
  const token = cookieValue(request, AUTH_COOKIE);
  if (!verifyAuthSessionToken(token)) {
    return NextResponse.json({ error: "Войди в приложение заново" }, { status: 401 });
  }
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  try {
    const { pr } = await request.json();
    const pull = await latestOpenDevelopmentPull();
    if (!pull?.head?.ref || pull.number !== pr) {
      return NextResponse.json({ error: "DEV-сборка изменилась. Обнови настройки." }, { status: 409 });
    }
    const url = branchPreviewUrl(pull.head.ref);
    const version = await versionForBranch(pull.head.ref);
    if (!version || !await previewExists(url, version)) {
      return NextResponse.json({ error: "DEV-сборка пока недоступна или защищена от доступа. Остаёмся в STABLE." }, { status: 503 });
    }
    const response = await fetch(new URL("/api/auth/session", url), {
      headers: { Cookie: `${AUTH_COOKIE}=${token}` },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || (await response.json()).authenticated !== true) {
      return NextResponse.json({ error: "DEV не принимает текущую сессию. Проверь настройки авторизации и базы DEV. Остаёмся в STABLE." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, url, pr, version }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Не удалось проверить DEV. Остаёмся в STABLE." }, { status: 503 });
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

  const stableUrl = absoluteVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? (process.env.VERCEL_ENV === "production" ? absoluteVercelUrl(process.env.VERCEL_URL) : null)
    ?? requestOrigin;

  let dev: { pr: number; branch: string; url: string; version: string } | null = null;
  let activeDevVersion: string | null = null;

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
    const [pull, activePull] = await Promise.all([
      latestOpenDevelopmentPull(),
      proxiedDev && proxiedPr ? developmentPullByNumber(proxiedPr) : Promise.resolve(null),
    ]);

    const branch = pull?.head?.ref;
    const activeBranch = activePull?.head?.ref;

    const [latestVersion, currentVersion] = await Promise.all([
      branch ? versionForBranch(branch) : Promise.resolve(null),
      activeBranch ? versionForBranch(activeBranch) : Promise.resolve(null),
    ]);

    if (pull && branch && latestVersion) {
      const url = branchPreviewUrl(branch);
      if (await previewExists(url, latestVersion)) {
        dev = { pr: pull.number, branch, url, version: latestVersion };
      }
    }

    if (proxiedDev && proxiedPr && activeBranch && currentVersion) {
      activeDevVersion = currentVersion;
    }
  }

  return NextResponse.json(
    {
      current: isPreview || proxiedDev ? "dev" : "stable",
      currentPr: isPreview ? versionInfo.pr : proxiedPr,
      currentVersion: isPreview ? `${versionInfo.release}.dev${versionInfo.dev}` : activeDevVersion,
      stable: { url: stableUrl },
      dev,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
