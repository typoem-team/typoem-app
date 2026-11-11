/*
 * Typoem app shell — loaded before every page script inside the Android app.
 *
 * 1. Sends the web pages' relative API calls (fetch('/api/...')) to the real server.
 * 2. Render's free plan sleeps after 15 idle minutes and takes ~1 minute to wake.
 *    Before the first API call we ping /api/health, and if any API call is slow we
 *    show a "waking up the server" screen instead of a page that looks broken.
 *
 * Nothing in the web repo needs to change for this to work.
 */
(function () {
  'use strict';

  var API_BASE = window.TYPOEM_API_BASE || 'https://typoem-app.onrender.com';
  var SHOW_OVERLAY_AFTER_MS = 2500;   // fast responses never flash the overlay
  var WAKE_TIMEOUT_MS = 90000;        // give up waking after 90 s
  var PING_TIMEOUT_MS = 15000;        // one health ping

  var nativeFetch = window.fetch.bind(window);

  // ---------- share sheet ----------
  // Android's WebView has no navigator.share, so the web's "공유하기" button would
  // only copy the text. If the native Share plugin is there, route navigator.share
  // to the phone's own share sheet (KakaoTalk, messages, ...).
  (function () {
    var cap = window.Capacitor;
    if (typeof navigator.share === 'function') return;
    if (!cap || typeof cap.isPluginAvailable !== 'function' || !cap.isPluginAvailable('Share')) return;
    navigator.share = function (data) {
      data = data || {};
      return cap.Plugins.Share.share({ title: data.title, text: data.text, url: data.url })
        .then(function () { /* shared */ })
        .catch(function (err) {
          // The web code treats a closed sheet as AbortError, like the browser does.
          var msg = String((err && err.message) || err || '');
          if (/cancel/i.test(msg)) throw new DOMException('Share canceled', 'AbortError');
          throw err;
        });
    };
  })();

  // ---------- overlay ----------
  var overlay = null;
  var slowCount = 0;

  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'typoem-wake-overlay';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="tw-box">' +
        '<div class="tw-dots"><span></span><span></span><span></span></div>' +
        '<p class="tw-title">Waking up the server…</p>' +
        '<p class="tw-sub">This can take up to a minute.</p>' +
        '<button type="button" class="tw-retry" hidden>Try again</button>' +
      '</div>';
    var style = document.createElement('style');
    style.textContent =
      '#typoem-wake-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;' +
      'align-items:center;justify-content:center;background:rgba(244,236,216,.94);' +
      'font-family:"IM Fell English",Georgia,serif;color:#2b1f12;text-align:center;padding:24px}' +
      '#typoem-wake-overlay .tw-title{font-size:20px;margin:16px 0 4px}' +
      '#typoem-wake-overlay .tw-sub{font-size:15px;opacity:.7}' +
      '#typoem-wake-overlay .tw-dots span{display:inline-block;width:8px;height:8px;margin:0 4px;' +
      'border-radius:50%;background:#2b1f12;animation:tw-blink 1.2s infinite both}' +
      '#typoem-wake-overlay .tw-dots span:nth-child(2){animation-delay:.2s}' +
      '#typoem-wake-overlay .tw-dots span:nth-child(3){animation-delay:.4s}' +
      '#typoem-wake-overlay .tw-retry{margin-top:16px;padding:8px 20px;font:inherit;' +
      'background:#2b1f12;color:#f4ecd8;border:0;border-radius:4px}' +
      '@keyframes tw-blink{0%,80%,100%{opacity:.2}40%{opacity:1}}';
    el.appendChild(style);
    el.querySelector('.tw-retry').addEventListener('click', function () {
      window.location.reload();
    });
    return el;
  }

  function showOverlay() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', showOverlay, { once: true });
      return;
    }
    if (!overlay) overlay = buildOverlay();
    if (!overlay.isConnected) document.body.appendChild(overlay);
  }

  function hideOverlay() {
    if (overlay && overlay.isConnected) overlay.remove();
  }

  function showFailure() {
    showOverlay();
    overlay.querySelector('.tw-dots').hidden = true;
    overlay.querySelector('.tw-title').textContent = 'Can’t reach the server.';
    overlay.querySelector('.tw-sub').textContent = 'Check your internet connection and try again.';
    overlay.querySelector('.tw-retry').hidden = false;
  }

  // Show the overlay only while at least one API call has been slow.
  function trackSlow(promise) {
    var flagged = false;
    var timer = setTimeout(function () {
      flagged = true;
      slowCount++;
      showOverlay();
    }, SHOW_OVERLAY_AFTER_MS);
    function done() {
      clearTimeout(timer);
      if (flagged && --slowCount === 0) hideOverlay();
    }
    promise.then(done, done);
    return promise;
  }

  // ---------- waking the server ----------
  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function pingOnce() {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, PING_TIMEOUT_MS);
    return nativeFetch(API_BASE + '/api/health', { signal: ctrl.signal, cache: 'no-store' })
      .then(function (res) {
        var type = res.headers.get('content-type') || '';
        // Render may answer with an HTML "starting up" page while waking.
        return res.ok && type.indexOf('application/json') !== -1;
      })
      .catch(function () { return false; })
      .finally(function () { clearTimeout(t); });
  }

  // The pages are separate HTML files, so this script restarts on every navigation.
  // Remember when the server last answered, so we don't ping before every page.
  var AWAKE_KEY = 'typoem.serverAwakeAt';
  var RECENT_MS = 10 * 60 * 1000; // Render sleeps after 15 idle minutes

  function markAwake() {
    try { sessionStorage.setItem(AWAKE_KEY, String(Date.now())); } catch (e) { /* ignore */ }
  }
  function recentlyAwake() {
    try {
      var t = Number(sessionStorage.getItem(AWAKE_KEY));
      return t > 0 && Date.now() - t < RECENT_MS;
    } catch (e) { return false; }
  }

  var wakePromise = null;
  function wakeServer() {
    if (wakePromise) return wakePromise;
    if (recentlyAwake()) return (wakePromise = Promise.resolve(true));
    var started = Date.now();
    wakePromise = (async function () {
      while (Date.now() - started < WAKE_TIMEOUT_MS) {
        if (await pingOnce()) { markAwake(); return true; }
        await sleep(2000);
      }
      return false;
    })();
    wakePromise.then(function (ok) {
      if (!ok) wakePromise = null; // allow a later retry
    });
    return wakePromise;
  }

  // ---------- fetch wrapper ----------
  function toApiUrl(input) {
    if (typeof input === 'string' && input.indexOf('/api/') === 0) return API_BASE + input;
    if (input instanceof URL && input.origin === location.origin && input.pathname.indexOf('/api/') === 0) {
      return API_BASE + input.pathname + input.search;
    }
    return null;
  }

  window.fetch = function (input, init) {
    var apiUrl = toApiUrl(input);
    if (!apiUrl) return nativeFetch(input, init);

    return trackSlow((async function () {
      var awake = await wakeServer();
      if (!awake) {
        showFailure();
        throw new TypeError('Typoem server is not reachable');
      }
      try {
        var res = await nativeFetch(apiUrl, init);
        markAwake();
        return res;
      } catch (err) {
        // Server may have gone back to sleep while the app was in the background.
        wakePromise = null;
        if (await wakeServer()) return nativeFetch(apiUrl, init);
        showFailure();
        throw err;
      }
    })());
  };

  // Start waking the server as soon as the app opens.
  trackSlow(wakeServer());
})();
