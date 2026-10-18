export type TechnicalCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

export type TechnicalChangelog = {
  version: string;
  sha: string;
  pr: number;
  commits: TechnicalCommit[];
};

type GitHubCommit = {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
};

// Read backwards from the immutable deployment SHA, never the moving PR head.
// Versioning CI guarantees one numbered commit per dev build.
export async function loadTechnicalChangelog(
  sha: string,
  release: string,
  dev: number,
  pr: number,
  request: typeof fetch = fetch,
): Promise<TechnicalChangelog> {
  const commits: TechnicalCommit[] = [];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "schedule-technical-changelog",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  for (let page = 1; commits.length < dev; page++) {
    const response = await request(
      `https://api.github.com/repos/ivanio69/schedule/commits?sha=${encodeURIComponent(sha)}&per_page=100&page=${page}`,
      { headers, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("GitHub unavailable");
    const batch = await response.json() as GitHubCommit[];
    if (!batch.length) throw new Error("Incomplete commit history");
    for (const item of batch) {
      if (!item.commit.message.startsWith(`[${release}.dev`)) continue;
      const number = Number(item.commit.message.split("]", 1)[0].split(".dev")[1]);
      if (number < 1 || number > dev) continue;
      commits.push({ sha: item.sha, message: item.commit.message, author: item.commit.author.name, date: item.commit.author.date });
      if (commits.length === dev) break;
    }
    if (batch.length < 100 && commits.length < dev) throw new Error("Incomplete commit history");
  }
  return { version: `${release}.dev${dev}`, sha, pr, commits };
}
