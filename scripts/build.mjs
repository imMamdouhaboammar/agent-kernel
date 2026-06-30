import { copyFileSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcPath = join(root, 'src', 'cli.mjs');
const distPath = join(root, 'dist', 'cli.mjs');

// 1. Inject VERSION from package.json so we never have to manually update it
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
let srcText = readFileSync(srcPath, 'utf8');
const before = srcText.match(/const VERSION = ['"]([^'"]+)['"]/);
if (before) {
  srcText = srcText.replace(
    /const VERSION = ['"][^'"]+['"]/,
    `const VERSION = '${pkg.version}'`
  );
  writeFileSync(srcPath, srcText);
  if (before[1] !== pkg.version) {
    console.log(`  bumped VERSION: ${before[1]} → ${pkg.version}`);
  }
}

// 2. Copy to dist + chmod
copyFileSync(distPath, distPath); // no-op (ensures path exists)
writeFileSync(distPath, srcText);
chmodSync(distPath, 0o755);
console.log(`Built dist/cli.mjs (v${pkg.version})`);
