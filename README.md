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

Stage 2 (pose detection): the app starts the rear camera, verifies the stream is not black
(the Telegram iOS WebView risk from tech.md section 6, which did not materialise), loads the
Pose Landmarker model and draws the tracked skeleton over the video, reporting detection rate
and the delegate in use.

The WASM runtime is copied out of `node_modules` into `static/mediapipe/wasm` by
`npm run copy:wasm` (wired into `dev` and `build`), and the model lives in
`static/models`. Both are served from this origin, so no CDN request has to succeed.

## Deploying and testing in Telegram

The camera requires HTTPS, and the check is only meaningful inside a real Telegram client.

1. Build and deploy `build/` to any static HTTPS host (Vercel, GitHub Pages, Cloudflare Pages).
2. In `@BotFather`: `/newapp` → pick the bot → set the deployed URL as the Web App URL.
3. Open the mini app on a real iPhone, tap **Start camera**, allow access.
4. Read the status line: a live picture means the risk does not materialise; a black stream
   means the fallback path is required. Copy the diagnostics block and record the result.
