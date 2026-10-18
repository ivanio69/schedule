import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPwa } from '../scripts/build-pwa.mjs';

test('build prepares only startup scripts/styles/fonts and changes the worker on each deploy', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pwa-build-'));
  try {
    for (const directory of ['.next/server/app', '.next/static/media', 'public']) {
      await mkdir(path.join(root, directory), { recursive: true });
    }
    await writeFile(path.join(root, '.next/BUILD_ID'), 'first');
    await writeFile(path.join(root, '.next/server/app/index.html'), '<script src="/_next/static/chunks/main.js?v=1"></script><link href="/_next/static/chunks/main.css"><script>"/_next/static/chunks/main.js"</script>');
    await writeFile(path.join(root, '.next/server/app/login.html'), '<script src="/_next/static/chunks/login.js"></script>');
    await writeFile(path.join(root, '.next/static/media/cyrillic.woff2'), 'font');
    await writeFile(path.join(root, 'public/sw.js'), '/* PWA_BUILD_START */\nconst BUILD_ASSETS = [];\n/* PWA_BUILD_END */\n// worker');
    assert.deepEqual(await buildPwa(root), [
      '/_next/static/chunks/login.js', '/_next/static/chunks/main.css',
      '/_next/static/chunks/main.js', '/_next/static/media/cyrillic.woff2',
    ]);
    const first = await readFile(path.join(root, 'public/sw.js'), 'utf8');
    await writeFile(path.join(root, '.next/BUILD_ID'), 'second');
    await buildPwa(root);
    const second = await readFile(path.join(root, 'public/sw.js'), 'utf8');
    assert.notEqual(first, second);
    assert.equal(second.match(/const BUILD_ASSETS/g).length, 1);
    assert.ok(second.endsWith('// worker'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
