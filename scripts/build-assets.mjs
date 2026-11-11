#!/usr/bin/env node
/*
 * Builds the Android launcher icons and splash images from assets/book-cover.svg.
 *
 *   npm run assets
 *
 * 1. Renders the SVG into the PNG sources @capacitor/assets expects (assets/*.png).
 * 2. Runs `capacitor-assets generate --android`, which writes every size into
 *    android/app/src/main/res/.
 *
 * The icon and the splash are the same picture: one book cover on cream.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const CREAM = '#f2eee7';                       // --bg in the web design tokens
const svg = readFileSync(join(assets, 'book-cover.svg'));

// The book alone, transparent, at `size` px (the SVG canvas is square).
const book = (size) => sharp(svg, { density: Math.ceil((72 * size) / 1024) }).resize(size, size).png().toBuffer();

const canvas = (size) => sharp({ create: { width: size, height: size, channels: 4, background: CREAM } });

// The book enlarged: the middle 1/zoom of the SVG, scaled back up to 1024px.
async function bookZoomed(zoom) {
  const size = Math.round(1024 * zoom);
  const offset = Math.round((size - 1024) / 2);
  return sharp(await book(size)).extract({ left: offset, top: offset, width: 1024, height: 1024 }).png().toBuffer();
}

// Adaptive icon. capacitor-assets insets both layers by 16.7%, so the whole
// foreground image ends up in the visible part of the icon; the launcher's mask
// (often a circle) only cuts the corners. The book is sized to stay inside that circle.
await sharp(await bookZoomed(1.4)).toFile(join(assets, 'icon-foreground.png'));
await canvas(1024).png().toFile(join(assets, 'icon-background.png'));

// Legacy / store icon: the same picture, flattened on cream.
await canvas(1024).composite([{ input: await bookZoomed(1.4) }]).png().toFile(join(assets, 'icon-only.png'));

// Splash: the same book, small, in the middle of a cream field.
const splash = await canvas(2732).composite([{ input: await book(1200), gravity: 'centre' }]).png().toBuffer();
await sharp(splash).toFile(join(assets, 'splash.png'));
await sharp(splash).toFile(join(assets, 'splash-dark.png'));   // the app has one (light) theme

// Launch screen icon (Android 12+ shows an icon on a plain colour): the book at a
// size that stays sharp on any screen. Referenced from res/values/styles.xml.
const nodpi = join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
mkdirSync(nodpi, { recursive: true });
await sharp(await book(1152)).toFile(join(nodpi, 'splash_icon.png'));

// capacitor-assets also re-formats AndroidManifest.xml (whitespace only); keep ours as it is.
const manifestPath = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const manifest = readFileSync(manifestPath);

execFileSync('npx', [
  'capacitor-assets', 'generate', '--android',
  '--iconBackgroundColor', CREAM, '--iconBackgroundColorDark', CREAM,
  '--splashBackgroundColor', CREAM, '--splashBackgroundColorDark', CREAM,
], { cwd: root, stdio: 'inherit' });

writeFileSync(manifestPath, manifest);
