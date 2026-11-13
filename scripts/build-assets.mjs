#!/usr/bin/env node
/*
 * Builds the Android launcher icons and splash images from the app icon artwork.
 *
 *   npm run assets
 *
 * Sources (assets/):
 *   app-icon.png           square, full bleed (store icon and launcher icon; a round
 *                          launcher mask is allowed to cut the corners)
 *   app-icon-rounded.png   the rounded paper tile on transparent (launch screen)
 *
 * 1. Writes the PNG sources @capacitor/assets expects (assets/icon-*.png, splash*.png).
 * 2. Runs `capacitor-assets generate --android`, which writes every size into
 *    android/app/src/main/res/.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const PAPER = '#f8ebd5';   // paper colour of the icon artwork (adaptive icon background)
const SCREEN = '#ffffff';  // launch screen background = app background (--color-bg)

const src = (name) => join(assets, name);
const canvas = (size, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } });

// Adaptive icon: the full-bleed artwork as foreground, plain paper behind it.
await sharp(src('app-icon.png')).resize(1024, 1024).png().toFile(src('icon-foreground.png'));
await canvas(1024, PAPER).png().toFile(src('icon-background.png'));

// Legacy / store icon: the full-bleed artwork.
await sharp(src('app-icon.png')).resize(1024, 1024).png().toFile(src('icon-only.png'));

// Splash (older Android): the rounded tile in the middle of a white field.
const tile = (size) => sharp(src('app-icon-rounded.png')).resize(size, size).png().toBuffer();
const splash = await canvas(2732, SCREEN).composite([{ input: await tile(900), gravity: 'centre' }]).png().toBuffer();
await sharp(splash).toFile(src('splash.png'));
await sharp(splash).toFile(src('splash-dark.png'));

// Launch screen icon (Android 12+): the system masks it to a circle about 2/3 of the
// canvas wide, so the tile sits inside that circle. Referenced from res/values/styles.xml.
const nodpi = join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
mkdirSync(nodpi, { recursive: true });
await sharp({ create: { width: 1152, height: 1152, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await tile(600), gravity: 'centre' }])
  .png().toFile(join(nodpi, 'splash_icon.png'));

// capacitor-assets also re-formats AndroidManifest.xml (whitespace only); keep ours as it is.
const manifestPath = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const manifest = readFileSync(manifestPath);

execFileSync('npx', [
  'capacitor-assets', 'generate', '--android',
  '--iconBackgroundColor', PAPER, '--iconBackgroundColorDark', PAPER,
  '--splashBackgroundColor', SCREEN, '--splashBackgroundColorDark', SCREEN,
], { cwd: root, stdio: 'inherit' });

writeFileSync(manifestPath, manifest);
