// Reuse the website's vector mark without scaling up a small PNG.
// Run from the repository root: node ios/scripts/generate-app-icons.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const source = fs.readFileSync(path.join(root, 'public/icons/icon.svg'), 'utf8');
  const output = path.join(root, 'ios/Schedule214/Assets.xcassets/AppIcon.appiconset');
  const variants = [
    ['AppIcon.png', source, false],
    ['AppIcon-dark.png', source.replace('#09090b', '#000000').replace('#17171b', '#111114'), false],
    ['AppIcon-tinted.png', source, true],
  ];
  for (const [filename, svg, monochrome] of variants) {
    let image = sharp(Buffer.from(svg)).resize(1024, 1024).flatten({ background: '#09090b' });
    if (monochrome) image = image.grayscale();
    await image.toColourspace('srgb').removeAlpha().png().toFile(path.join(output, filename));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
