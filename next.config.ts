import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
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
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
};

export default withWorkflow(nextConfig);
