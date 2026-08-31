# Push-up Counter — Telegram Mini App

Counts push-ups in real time from the phone camera using MediaPipe Pose Landmarker.
Client-only static SPA, no backend. Spec: [tech.md](tech.md).

## Development

```bash
npm install
npm run dev
```

`npm run check` — typecheck, `npm run lint` — Prettier + ESLint, `npm run build` — static build into `build/`.

## Current stage

Stage 1 (skeleton): the app screen is the camera check that verifies the known
Telegram iOS WebView risk — `getUserMedia` returning a black stream (tech.md section 6).
It starts the rear camera, samples frames for brightness, prints diagnostics and offers
an "Open in Safari" fallback when the stream is black or unavailable.

## Deploying and testing in Telegram

The camera requires HTTPS, and the check is only meaningful inside a real Telegram client.

1. Build and deploy `build/` to any static HTTPS host (Vercel, GitHub Pages, Cloudflare Pages).
2. In `@BotFather`: `/newapp` → pick the bot → set the deployed URL as the Web App URL.
3. Open the mini app on a real iPhone, tap **Start camera**, allow access.
4. Read the status line: a live picture means the risk does not materialise; a black stream
   means the fallback path is required. Copy the diagnostics block and record the result.
