# Typoem App

Android app for [Typoem](https://github.com/typoem-team/typoem-web), built with [Capacitor](https://capacitorjs.com/).
The app shows the same screens as the web (`public/` in the web repo) and talks to the server at
`https://typoem-app.onrender.com`.

## How it works

- `npm run sync` copies the web repo's `public/` into `www/` and runs `cap sync android`.
- `app-shell/app-shell.js` is added as the first script on every page. It:
  - sends `fetch('/api/...')` calls to the Render server, so **the web code doesn't need changes**;
  - wakes the server first (Render's free plan sleeps after 15 idle minutes) and shows a
    "서버를 깨우는 중이에요" screen while it starts, with "다시 시도" if it can't be reached;
  - sets the status bar, and handles the Android back button (see below).
- `www/` is generated. Don't edit it; change the web repo or `app-shell/` instead.

## Run it

Needs Node 20+, Android Studio, and JDK 21.

```bash
npm install
npm run sync      # clones typoem-team/typoem-web (main) and copies its screens
npm run open      # opens Android Studio → Run ▶ on a phone or emulator
```

Use a local web checkout instead of cloning: `WEB_DIR=../typoem-web npm run sync`
(or `npm run sync:local` when the web repo sits next to this one).
Use another branch of the web repo: `WEB_REF=my-branch npm run sync`.

## Native bits

The web pages stay plain web pages; the app adds a few things through Capacitor plugins.

| What | How |
|---|---|
| Status bar | `@capacitor/status-bar`. Every page starts with dark icons on the paper colour (`#f2eee7`). The reading screen asks for light text over its dark cover band through the web's `window.TypoemNative.setStatusBar('light')`. Light text is only applied when the page really is drawn behind the status bar (Android System WebView 140+); on older WebViews the bar keeps its paper colour and dark icons. |
| Back button | `@capacitor/app`. Order: an open sheet closes → the reading screen goes back to home → home leaves the app. The first two are the web's `window.TypoemNav.back()`. Other screens go back one page. |
| Haptics | `@capacitor/haptics`. Nothing in this repo: the web's `haptic()` calls `Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' })` when it exists. |
| Launch screen | `@capacitor/splash-screen` + `res/values/styles.xml`: the book-cover icon on the paper colour. |

## Icon and launch screen

The source is one SVG, `assets/book-cover.svg`: a deep green book cover with spine shading, a thin
inner frame and an italic "T" (Cormorant Garamond, converted to an outline).

```bash
npm run assets    # renders assets/*.png from the SVG, then writes every Android size into android/app/src/main/res/
```

Run it again after changing the SVG, and commit the generated files.

## Server requirements (CORS)

The app's pages run at origin `https://localhost`, so the server must allow it:

- `Access-Control-Allow-Origin: https://localhost`
- allow the `Authorization` and `Content-Type` headers, and answer `OPTIONS` preflight requests

## Release notes

- Package name: `com.typoem.app`. It cannot change after the first store release.
- The signing key (`*.jks`) is never committed. Back it up in the team drive; without it we can't
  publish updates.
