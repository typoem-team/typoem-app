#!/usr/bin/env node
// Runs app-shell.js in a fake WebView and presses the Android back button on each page.
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const src = readFileSync(new URL('../app-shell/app-shell.js', import.meta.url), 'utf8');

let did;          // what the back button did
let onBack;       // the shell's backButton listener
const location = {
  pathname: '/',
  origin: 'https://localhost',
  replace(url) { did = 'replace ' + url; },
  set href(url) { did = 'href ' + url; },
};
const win = {
  location,
  history: { back() { did = 'history.back'; } },
  fetch: () => Promise.resolve({ ok: true, headers: { get: () => 'application/json' } }),
  navigator: {},
  document: { body: null, addEventListener() {} },
  sessionStorage: { getItem: () => String(Date.now()), setItem() {} },   // server already awake
  Capacitor: { Plugins: { App: {
    addListener(name, fn) { if (name === 'backButton') onBack = fn; },
    exitApp() { did = 'exit'; },
  } } },
  setTimeout, clearTimeout, Promise, URL, AbortController, DOMException,
};
win.window = win;
vm.runInNewContext(src, win);
assert.ok(onBack, 'app-shell registers a backButton listener');

function press(path, { canGoBack = true, navBack } = {}) {
  location.pathname = path;
  win.TypoemNav = navBack === undefined ? undefined : { back: navBack };
  did = 'nothing';
  onBack({ canGoBack });
  return did;
}

// Home and the login / landing pages leave the app.
for (const p of ['/', '/index.html', '/login.html', '/landing.html']) assert.equal(press(p), 'exit', p);

// Bottom tabs go straight home without adding history, even with history to go back to.
for (const p of ['/rooms.html', '/vocab.html', '/me.html']) {
  assert.equal(press(p), 'replace /index.html', p);
  assert.equal(press(p, { canGoBack: false }), 'replace /index.html', p);
}

// 설정 goes back, or to 나 without history.
assert.equal(press('/settings.html'), 'history.back');
assert.equal(press('/settings.html', { canGoBack: false }), 'href /me.html');

// Other pages keep the old behaviour.
for (const p of ['/join.html', '/create-room.html', '/privacy.html', '/room.html', '/book.html']) {
  assert.equal(press(p), 'history.back', p);
  assert.equal(press(p, { canGoBack: false }), 'href /index.html', p);
}

// The web handled it (closed a sheet / its page handler) -> the shell stops there.
for (const p of ['/index.html', '/me.html', '/settings.html', '/room.html']) {
  assert.equal(press(p, { navBack: () => true }), 'nothing', p);
}
// The web didn't handle it, or threw -> the page rule runs.
assert.equal(press('/me.html', { navBack: () => false }), 'replace /index.html');
assert.equal(press('/me.html', { navBack: () => { throw new Error('x'); } }), 'replace /index.html');

console.log('back button: all checks passed');
