import fs from "node:fs";
import { execFileSync } from "node:child_process";

const fail = (message) => {
  console.error(`Version check failed: ${message}`);
  process.exit(1);
};

const parseRelease = (release, label) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(release ?? "");
  if (!match) fail(`${label} must use major.minor.hotfix`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    hotfix: Number(match[3]),
  };
};

const version = JSON.parse(fs.readFileSync("version.json", "utf8"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const current = parseRelease(version.release, "release");

if (current.major < 2) fail("major version must be at least 2");
if (!Number.isInteger(version.dev) || version.dev < 0) fail("dev must be a non-negative integer");
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
const baseRef = process.env.GITHUB_BASE_REF;

if (prNumber) {
  if (version.dev < 1) fail("PR builds require dev >= 1");
  if (version.pr !== prNumber) fail(`version.json pr is ${version.pr}, current PR is ${prNumber}`);
}

if (prNumber && baseRef) {
  let baseVersion;
  try {
    baseVersion = JSON.parse(
      execFileSync("git", ["show", `origin/${baseRef}:version.json`], { encoding: "utf8" }),
    );
  } catch {
    fail(`cannot read version.json from origin/${baseRef}`);
  }

  const base = parseRelease(baseVersion.release, "base release");

  if (version.channel === "minor") {
    const consolidated = version.consolidatesPrs;
    let increment = 1;
    if (consolidated !== undefined) {
      if (!Array.isArray(consolidated) || !consolidated.length) fail("consolidatesPrs must be a non-empty array when present");
      if (!consolidated.every(item => Number.isInteger(item) && item > 0)) fail("consolidatesPrs must contain positive PR numbers");
      if (new Set(consolidated).size !== consolidated.length) fail("consolidatesPrs must not contain duplicates");
      if (consolidated.includes(prNumber)) fail("consolidatesPrs must only contain superseded PRs");
      increment += consolidated.length;
    }
    const expected = `${base.major}.${base.minor + increment}.0`;
    if (version.release !== expected) {
      fail(`minor release from ${baseVersion.release} must be ${expected}${consolidated ? " for this consolidated release" : ""}`);
    }
    if (version.majorBasePr !== baseVersion.majorBasePr) {
      fail("minor release must preserve majorBasePr");
    }
  }

  if (version.channel === "hotfix") {
    const expected = `${base.major}.${base.minor}.${base.hotfix + 1}`;
    if (version.release !== expected) {
      fail(`hotfix from ${baseVersion.release} must be ${expected}`);
    }
    if (version.majorBasePr !== baseVersion.majorBasePr) {
      fail("hotfix release must preserve majorBasePr");
    }
  }

  if (version.channel === "major") {
    const expected = `${base.major + 1}.0.0`;
    if (version.release !== expected) {
      fail(`major release from ${baseVersion.release} must be ${expected}`);
    }
    if (version.majorBasePr !== prNumber) {
      fail("major release must reset majorBasePr to this PR");
    }
  }

  const log = execFileSync("git", ["log", "--reverse", `origin/${baseRef}..HEAD`, "--format=%s"], { encoding: "utf8" }).trim();
  const commits = log ? log.split("\n") : [];
  if (commits.length !== version.dev) fail(`dev is ${version.dev}, but PR has ${commits.length} commits`);
  commits.forEach((subject, index) => {
    const expected = `[${version.release}.dev${index + 1}]`;
    if (!subject.startsWith(expected)) fail(`commit ${index + 1} must start with ${expected}`);
  });
}

console.log(`Version OK: ${version.release}.dev${version.dev}`);
