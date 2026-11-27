import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// Measure actual initial scripts/styles, not all emitted chunks (which include
// on-demand editors). Run after a production build, with the same bundler when
// comparing revisions. API latency and device frame rate require separate tests.
const pages = process.argv.slice(2);
for (const page of pages.length ? pages : ['index', 'schedule', 'seminars', 'settings', 'archive']) {
  const file = `.next/server/app/${page}.html`;
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8');
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+\.(?:js|css))/g)].map(match => match[1]))];
  const totals = { js: 0, css: 0, gzipJs: 0, gzipCss: 0 };
  for (const asset of assets) {
    const bytes = readFileSync(`.next/${asset.slice('/_next/'.length)}`);
    const js = asset.endsWith('.js');
    totals[js ? 'js' : 'css'] += bytes.length;
    totals[js ? 'gzipJs' : 'gzipCss'] += gzipSync(bytes).length;
  }
  console.log(JSON.stringify({ page: page === 'index' ? '/' : `/${page}`, ...totals }));
}
