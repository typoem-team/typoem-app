# Typoem App

Android app for [Typoem](https://github.com/typoem-team/typoem), built with [Capacitor](https://capacitorjs.com/).
The app shows the same screens as the web (`public/` in the web repo) and talks to the server at
`https://typoem-app.onrender.com`.

## How it works

- `npm run sync` copies the web repo's `public/` into `www/` and runs `cap sync android`.
- `app-shell/app-shell.js` is added as the first script on every page. It:
  - sends `fetch('/api/...')` calls to the Render server, so **the web code doesn't need changes**;
  - wakes the server first (Render's free plan sleeps after 15 idle minutes) and shows a
    "Waking up the server…" screen while it starts.
- `www/` is generated. Don't edit it; change the web repo or `app-shell/` instead.

## Run it

Needs Node 20+, Android Studio, and JDK 21.

```bash
npm install
npm run sync      # clones typoem-team/typoem (main) and copies its screens
npm run open      # opens Android Studio → Run ▶ on a phone or emulator
```

Use a local web checkout instead of cloning: `WEB_DIR=../typoem npm run sync`
(or `npm run sync:local` when the web repo sits next to this one).
Use another branch of the web repo: `WEB_REF=my-branch npm run sync`.

## Server requirements (CORS)

The app's pages run at origin `https://localhost`, so the server must allow it:

- `Access-Control-Allow-Origin: https://localhost`
- allow the `Authorization` and `Content-Type` headers, and answer `OPTIONS` preflight requests

## Release notes

- Package name: `com.typoem.app`. It cannot change after the first store release.
- The signing key (`*.jks`) is never committed. Back it up in the team drive; without it we can't
  publish updates.
