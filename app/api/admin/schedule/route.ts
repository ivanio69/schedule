import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const OWNER = process.env.GITHUB_OWNER ?? "ivanio69";
const REPO = process.env.GITHUB_REPO ?? "schedule";
const BRANCH = process.env.GITHUB_BRANCH ?? "main";
const TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? ADMIN_PASSWORD;
const FILE_PATH = "app/table.json";
const COOKIE_NAME = "schedule_admin";

type Schedule = { semesterStart: number[]; days: Array<{ name: string; table: Array<Record<string, unknown>> }> };

function unauthorized() { return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
function sessionToken() { return SESSION_SECRET ? createHmac("sha256", SESSION_SECRET).update("schedule-admin").digest("hex") : null; }
function isAuthorized(request: NextRequest) { const token = sessionToken(); return Boolean(token && request.cookies.get(COOKIE_NAME)?.value === token); }

function validateSchedule(value: unknown): value is Schedule {
  if (!value || typeof value !== "object") return false;
  const schedule = value as Partial<Schedule>;
  if (!Array.isArray(schedule.semesterStart) || schedule.semesterStart.length !== 3 || !schedule.semesterStart.every((n) => Number.isInteger(n))) return false;
  if (!Array.isArray(schedule.days) || schedule.days.length === 0) return false;
  return schedule.days.every((day) => Boolean(day && typeof day.name === "string" && Array.isArray(day.table)) && day.table.every((lesson) => lesson && typeof lesson === "object"));
}

async function githubRequest(path: string, init?: RequestInit) {
  if (!TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${TOKEN}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  if (!ADMIN_PASSWORD || !SESSION_SECRET) return NextResponse.json({ error: "Admin auth is not configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (!body || body.password !== ADMIN_PASSWORD) return unauthorized();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, sessionToken()!, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  const response = await githubRequest(`contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`);
  if (!response.ok) return NextResponse.json({ error: "Failed to load schedule from GitHub" }, { status: 502 });
  const data = (await response.json()) as { content?: string; sha?: string };
  if (!data.content || !data.sha) return NextResponse.json({ error: "Invalid GitHub response" }, { status: 502 });
  const schedule = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  return NextResponse.json({ schedule, sha: data.sha, branch: BRANCH }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  const body = await request.json().catch(() => null) as { schedule?: unknown; sha?: string } | null;
  if (!body?.sha || !validateSchedule(body.schedule)) return NextResponse.json({ error: "Invalid schedule or SHA" }, { status: 400 });
  const content = `${JSON.stringify(body.schedule, null, 2)}\n`;
  const response = await githubRequest(`contents/${FILE_PATH}`, { method: "PUT", body: JSON.stringify({ message: "Update schedule from admin panel", content: Buffer.from(content, "utf8").toString("base64"), sha: body.sha, branch: BRANCH }) });
  if (response.status === 409) return NextResponse.json({ error: "Schedule changed on GitHub. Reload before saving." }, { status: 409 });
  if (!response.ok) return NextResponse.json({ error: "Failed to save schedule to GitHub" }, { status: 502 });
  const result = (await response.json()) as { content?: { sha?: string } };
  return NextResponse.json({ ok: true, sha: result.content?.sha ?? null }, { headers: { "Cache-Control": "no-store" } });
}
