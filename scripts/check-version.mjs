import fs from "node:fs";
import { execFileSync } from "node:child_process";

const fail = (message) => {
  console.error(`Version check failed: ${message}`);
  process.exit(1);
};

const version = JSON.parse(fs.readFileSync("version.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.release ?? "");
if (!match) fail("release must use major.minor.hotfix");

const major = Number(match[1]);
const minor = Number(match[2]);
const hotfix = Number(match[3]);
if (major < 2) fail("major version must be at least 2");
if (!Number.isInteger(version.dev) || version.dev < 1) fail("dev must be a positive integer");
if (!Number.isInteger(version.pr) || version.pr < 1) fail("pr must be a positive integer");
if (!Number.isInteger(version.majorBasePr) || version.majorBasePr < 1) fail("majorBasePr must be a positive integer");
if (!["minor", "major", "hotfix"].includes(version.channel)) fail("channel must be minor, major or hotfix");
if (pkg.version !== version.release) fail("package.json version must equal release");
if (lock.version !== version.release || lock.packages?.[""]?.version !== version.release) fail("package-lock root version must equal release");

let event = null;
if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
  event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
}
const prNumber = event?.pull_request?.number;
if (prNumber) {
  if (version.pr !== prNumber) fail(`version.json pr is ${version.pr}, current PR is ${prNumber}`);
  if (version.channel === "minor") {
    const expectedMinor = prNumber - version.majorBasePr;
    if (minor !== expectedMinor || hotfix !== 0) fail(`minor PR #${prNumber} must be ${major}.${expectedMinor}.0`);
  }
  if (version.channel === "major") {
    if (minor !== 0 || hotfix !== 0 || version.majorBasePr !== prNumber) fail("major release must be X.0.0 and reset majorBasePr to this PR");
  }
  if (version.channel === "hotfix" && hotfix < 1) fail("hotfix channel requires a non-zero third number");
}

const baseRef = process.env.GITHUB_BASE_REF;
if (baseRef) {
  const log = execFileSync("git", ["log", "--reverse", `origin/${baseRef}..HEAD`, "--format=%s"], { encoding: "utf8" }).trim();
  const commits = log ? log.split("\n") : [];
  if (commits.length !== version.dev) fail(`dev is ${version.dev}, but PR has ${commits.length} commits`);
  commits.forEach((subject, index) => {
    const expected = `[${version.release}.dev${index + 1}]`;
    if (!subject.startsWith(expected)) fail(`commit ${index + 1} must start with ${expected}`);
  });
}

console.log(`Version OK: ${version.release}.dev${version.dev}`);
