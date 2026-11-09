#!/usr/bin/env node
/*
 * Copies the web screens (public/ in the web repo) into www/ for Capacitor,
 * and adds app-shell.js as the first script on every page.
 *
 * Where the web code comes from:
 *   WEB_DIR=../typoem npm run sync     use a local checkout of the web repo
 *   npm run sync                       clone typoem-team/typoem (branch WEB_REF, default main)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB_REPO = process.env.WEB_REPO || 'https://github.com/typoem-team/typoem.git';
const WEB_REF = process.env.WEB_REF || 'main';
const outDir = join(root, 'www');

function getWebDir() {
  if (process.env.WEB_DIR) {
    const dir = resolve(process.env.WEB_DIR);
    if (!existsSync(join(dir, 'public'))) {
      throw new Error(`WEB_DIR has no public/ folder: ${dir}`);
    }
    console.log(`Using local web repo: ${dir}`);
    return dir;
  }
  const cache = join(root, '.web-src');
  rmSync(cache, { recursive: true, force: true });
  console.log(`Cloning ${WEB_REPO} (${WEB_REF})…`);
  execFileSync('git', ['clone', '--depth', '1', '--branch', WEB_REF, WEB_REPO, cache], { stdio: 'inherit' });
  return cache;
}

const webDir = getWebDir();
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(webDir, 'public'), outDir, { recursive: true });
cpSync(join(root, 'app-shell', 'app-shell.js'), join(outDir, 'app-shell.js'));

// Capacitor opens index.html first. Keep the web's own index.html (My Rooms);
// it sends logged-out users to login.html by itself.
const SHELL_TAG = '<script src="/app-shell.js"></script>';
let pages = 0;
for (const name of readdirSync(outDir)) {
  if (!name.endsWith('.html')) continue;
  const file = join(outDir, name);
  let html = readFileSync(file, 'utf8');
  if (!html.includes(SHELL_TAG)) {
    // Right after <meta charset> (or <head>), before any page script runs.
    const anchor = /<meta\s+charset[^>]*>/i.test(html) ? /<meta\s+charset[^>]*>/i : /<head[^>]*>/i;
    if (!anchor.test(html)) throw new Error(`No <head> in ${name}`);
    html = html.replace(anchor, (m) => `${m}\n  ${SHELL_TAG}`);
    writeFileSync(file, html);
  }
  pages++;
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', webDir, 'rev-parse', '--short', 'HEAD']).toString().trim();
} catch { /* not a git checkout */ }
writeFileSync(join(outDir, 'web-version.txt'), `${commit}\n`);

console.log(`www/ ready: ${pages} pages, web commit ${commit}`);
