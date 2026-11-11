/*
 * Typoem app shell — loaded before every page script inside the Android app.
 *
 * 1. Sends the web pages' relative API calls (fetch('/api/...')) to the real server.
 * 2. Render's free plan sleeps after 15 idle minutes and takes ~1 minute to wake.
 *    Before the first API call we ping /api/health, and if any API call is slow we
 *    show a "waking up the server" screen instead of a page that looks broken.
 * 3. Native polish, through the Capacitor plugins: status bar colours, the Android
 *    back button, and the safe-area insets the web pages pad themselves with.
 *
 * Nothing in the web repo needs to change for this to work. The web pages offer
 * two small hooks that this file uses when they are there:
 *   window.TypoemNav.back()               close a sheet / leave the reading screen
 *   window.TypoemNative.setStatusBar(..)  light text over a dark cover (web calls it)
 * Haptics need nothing here: the web's haptic() calls Capacitor.Plugins.Haptics itself.
 */
(function () {
  'use strict';

  var API_BASE = window.TYPOEM_API_BASE || 'https://typoem-app.onrender.com';
  var SHOW_OVERLAY_AFTER_MS = 2500;   // fast responses never flash the overlay
  var WAKE_TIMEOUT_MS = 90000;        // give up waking after 90 s
  var PING_TIMEOUT_MS = 15000;        // one health ping

  var nativeFetch = window.fetch.bind(window);

  // ---------- overlay ----------
  var overlay = null;
  var slowCount = 0;
  var failed = false;     // the "can't reach the server" screen stays until "다시 시도"

  function buildOverlay() {
    var el = document.createElement('div');
    el.id = 'typoem-wake-overlay';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="tw-box">' +
        '<div class="tw-dots"><span></span><span></span><span></span></div>' +
        '<p class="tw-title">서버를 깨우는 중이에요</p>' +
        '<p class="tw-sub">최대 1분 걸릴 수 있어요</p>' +
        '<button type="button" class="tw-retry" hidden>다시 시도</button>' +
      '</div>';
    // Colours and fonts are the web design tokens (styles.css), with their values as
    // fallbacks: this screen can show before the page's stylesheet has loaded. The
    // fonts are the files synced from the web repo (www/fonts/), so it looks the same
    // offline.
    var style = document.createElement('style');
    style.textContent =
      '@font-face{font-family:"MaruBuri";font-weight:400;font-display:swap;' +
      'src:url("/fonts/maruburi/MaruBuri-Regular.subset.woff2") format("woff2")}' +
      '@font-face{font-family:"MaruBuri";font-weight:700;font-display:swap;' +
      'src:url("/fonts/maruburi/MaruBuri-Bold.subset.woff2") format("woff2")}' +
      '#typoem-wake-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;' +
      'align-items:center;justify-content:center;background:var(--bg,#f2eee7);' +
      'font-family:"MaruBuri","Nanum Myeongjo","Apple SD Gothic Neo",serif;' +
      'color:var(--ink,#1f1b16);text-align:center;padding:24px;word-break:keep-all;' +
      '-webkit-font-smoothing:antialiased}' +
      '#typoem-wake-overlay .tw-title{font-size:17px;font-weight:700;line-height:1.5;margin:22px 0 4px}' +
      '#typoem-wake-overlay .tw-sub{font-size:13.5px;line-height:1.6;color:var(--ink-2,#6b6358);margin:0}' +
      '#typoem-wake-overlay .tw-dots span{display:inline-block;width:8px;height:8px;margin:0 5px;' +
      'border-radius:50%;background:var(--ink,#1f1b16);animation:tw-blink 1.8s cubic-bezier(.22,.61,.36,1) infinite both}' +
      '#typoem-wake-overlay .tw-dots span:nth-child(2){animation-delay:.25s}' +
      '#typoem-wake-overlay .tw-dots span:nth-child(3){animation-delay:.5s}' +
      '#typoem-wake-overlay .tw-retry{margin-top:22px;min-height:48px;padding:12px 26px;font:inherit;' +
      'font-size:14.5px;background:var(--ink,#1f1b16);color:var(--on-ink,#f4efe6);border:0;border-radius:999px}' +
      '#typoem-wake-overlay [hidden]{display:none}' +
      '@keyframes tw-blink{0%,80%,100%{opacity:.2}40%{opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){#typoem-wake-overlay .tw-dots span{animation:none;opacity:.5}}';
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
    if (failed) return;
    if (overlay && overlay.isConnected) overlay.remove();
  }

  function showFailure() {
    failed = true;
    showOverlay();
    overlay.querySelector('.tw-dots').hidden = true;
    overlay.querySelector('.tw-title').textContent = '서버에 연결하지 못했어요';
    overlay.querySelector('.tw-sub').textContent = '인터넷 연결을 확인하고 다시 시도해 주세요';
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

  // ---------- native polish (Capacitor plugins; none of this runs in a browser) ----------
  function plugin(name) {
    var cap = window.Capacitor;
    return (cap && cap.Plugins && cap.Plugins[name]) || null;
  }

  var PAPER = '#f2eee7';   // --bg

  // Is the page drawn behind the status bar? Capacitor does that on a recent
  // Android System WebView (140+), where env(safe-area-inset-top) is the bar's
  // height. On older ones it keeps the page below the bar instead, and the strip
  // behind the bar stays paper-coloured.
  function drawsBehindStatusBar() {
    if (!document.body) return false;
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;' +
      'height:env(safe-area-inset-top,0px)';
    document.body.appendChild(probe);
    var h = probe.getBoundingClientRect().height;
    probe.remove();
    return h > 0;
  }

  // Every page starts with dark status bar icons on the paper colour. The reading
  // screen then asks for light text itself (TypoemNative.setStatusBar('light') ->
  // StatusBar.setStyle DARK). Light text is only readable when the dark cover band
  // really is behind the bar, so otherwise that request is turned back into dark icons.
  // Each page is a separate HTML file, so this runs again on every navigation.
  function setUpStatusBar() {
    var bar = plugin('StatusBar');
    if (!bar) return;
    try {
      var setStyle = bar.setStyle.bind(bar);
      bar.setStyle = function (options) {
        if (options && options.style === 'DARK' && !drawsBehindStatusBar()) options = { style: 'LIGHT' };
        return setStyle(options);
      };
      setStyle({ style: 'LIGHT' }).catch(function () {});                   // LIGHT = dark icons
      bar.setBackgroundColor({ color: PAPER }).catch(function () {});       // Android 14 and older
    } catch (e) { /* plugin missing a method on this platform */ }
  }

  // Android back button: open sheet -> reading screen to home -> leave the app.
  // The web's TypoemNav.back() does the first two and answers whether it did anything.
  var EXIT_PAGES = ['/', '/index.html', '/login.html', '/landing.html'];

  function onBackButton(ev) {
    var app = plugin('App');
    if (overlay && overlay.isConnected) {          // waking / failed screen: nothing to go back to
      if (app) app.exitApp();
      return;
    }
    var nav = window.TypoemNav;
    try {
      if (nav && typeof nav.back === 'function' && nav.back()) return;
    } catch (e) { /* fall through to the default */ }

    if (EXIT_PAGES.indexOf(window.location.pathname) !== -1) {
      if (app) app.exitApp();
    } else if (ev && ev.canGoBack) {
      window.history.back();                       // e.g. 단어장 -> the screen before it
    } else {
      window.location.href = '/index.html';
    }
  }

  function setUpBackButton() {
    var app = plugin('App');
    if (app && app.addListener) app.addListener('backButton', onBackButton);
  }

  setUpStatusBar();
  setUpBackButton();

  // Start waking the server as soon as the app opens.
  trackSlow(wakeServer());
})();
