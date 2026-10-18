import type { NextConfig } from "next";
import versionInfo from "./version.json";

const gitRef = process.env.VERCEL_GIT_COMMIT_REF
  ?? process.env.GITHUB_HEAD_REF
  ?? process.env.GITHUB_REF_NAME
  ?? "";

const isDevBuild = process.env.NODE_ENV === "development"
  || process.env.VERCEL_ENV === "preview"
  || Boolean(gitRef && gitRef !== "main");

const appVersion = isDevBuild
  ? `${versionInfo.release}.dev${versionInfo.dev}`
  : versionInfo.release;

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/sw.js", headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ] },
      { source: "/offline.html", headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
      ] },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
