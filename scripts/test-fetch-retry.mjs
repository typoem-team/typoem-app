#!/usr/bin/env node
// Runs app-shell.js in a fake WebView: after a network error, a read is sent again,
// a write is not (it may already have been saved).
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const src = readFileSync(new URL('../app-shell/app-shell.js', import.meta.url), 'utf8');

const sent = [];   // [method, url] of every API request that reached the network
const win = {
  location: { pathname: '/', origin: 'https://localhost' },
  history: {},
  fetch(url, init) {
    if (String(url).endsWith('/api/health')) {
      return Promise.resolve({ ok: true, headers: { get: () => 'application/json' } });
    }
    sent.push([(init && init.method) || 'GET', String(url)]);
    return Promise.reject(new TypeError('connection dropped'));
  },
  navigator: {},
  document: { body: null, readyState: 'complete', addEventListener() {} },
  sessionStorage: { getItem: () => String(Date.now()), setItem() {} },   // server already awake
  setTimeout, clearTimeout, Promise, URL, AbortController, DOMException,
};
win.window = win;
vm.runInNewContext(src, win);

await assert.rejects(win.fetch('/api/rooms/1/today'));
assert.equal(sent.filter(([m]) => m === 'GET').length, 2, 'a failed read is sent again once');

sent.length = 0;
await assert.rejects(win.fetch('/api/rooms/1/memos', { method: 'POST', body: '{}' }));
assert.deepEqual(sent.map(([m]) => m), ['POST'], 'a failed write is not sent again');

console.log('fetch retry: all checks passed');
