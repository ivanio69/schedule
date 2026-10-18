import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run after next build. The deployed worker changes with every build, so installed
// PWAs discover newly compiled files even if the worker logic hasn't changed.
export async function buildPwa(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const buildId = (await readFile(path.join(root, ".next/BUILD_ID"), "utf8")).trim();
  const assets = new Set();
  for (const page of ["index", "login"]) {
    // A future dynamic page may have no prerendered HTML; runtime caching still works.
    try {
      const html = await readFile(path.join(root, `.next/server/app/${page}.html`), "utf8");
      for (const match of html.matchAll(/\/_next\/static\/[^"'\s<>\\]+/g)) {
        const asset = match[0].split("?")[0];
        if (/\.(?:js|css|woff2?)$/.test(asset)) assets.add(asset);
      }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  // Include font subsets referenced from CSS rather than HTML (e.g. Cyrillic).
  const media = path.join(root, ".next/static/media");
  try {
    for (const name of await readdir(media)) {
      if (/\.woff2?$/.test(name)) assets.add(`/_next/static/media/${name}`);
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const filename = path.join(root, "public/sw.js");
  const source = await readFile(filename, "utf8");
  const replacement = `/* PWA_BUILD_START */\n// Next build: ${JSON.stringify(buildId)}\nconst BUILD_ASSETS = ${JSON.stringify([...assets].sort())};\n/* PWA_BUILD_END */`;
  if (!source.includes("/* PWA_BUILD_START */")) throw new Error("Worker build marker missing");
  await writeFile(filename, source.replace(/\/\* PWA_BUILD_START \*\/[\s\S]*?\/\* PWA_BUILD_END \*\//, () => replacement));
  console.log(`PWA: ${assets.size} startup assets prepared for ${buildId}`);
  return [...assets].sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPwa();
