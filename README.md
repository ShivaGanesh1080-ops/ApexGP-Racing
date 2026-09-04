# ApexGP Racing

A playable, installable 3D-style browser racing game with:

- 100 generated championship levels across 10 circuits
- single-player races against AI drivers
- persistent unlocks and best results in local storage
- keyboard, touch, and gamepad-friendly controls
- peer-to-peer friend rooms using a short room code (PeerJS signaling)
- offline-capable install shell through a PWA manifest and service worker
- procedural track, cars, curbs, trees, grandstands, lighting, fog, and particles built with Three.js

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL on desktop or mobile. The game can be installed from the browser's install/share menu. For two local devices, both need to be able to reach the same deployed HTTPS URL; create a friend room on one device and join with the code on the other.

## Multiplayer note

The first release uses browser-to-browser data channels with PeerJS's public signaling service, so no game state is stored on a server. The room host controls the selected level and starts the race. If a network or signaling service is unavailable, the UI keeps a local practice mode available.

## Android app

The repository includes a Capacitor Android wrapper under `android/` with package ID `com.shivaganesh.apexgp`. The GitHub Actions workflow at `.github/workflows/android-apk.yml` builds a debug APK on every push to `main` and uploads it as the `ApexGP-debug-apk` workflow artifact. A release APK for Play Store distribution still needs a signing keystore and release configuration; keep signing secrets in GitHub/Vercel settings, never in source files.

For a commercial release, move signaling to a controlled provider, add authoritative race validation, accounts, matchmaking, anti-cheat checks, sound/physics assets, and a full game-engine client if console-grade fidelity is required.

## Reality check

This is a polished web MVP, not a GTA VI/BGMI-scale production. Those games require a large art, engineering, animation, audio, networking, and QA team plus a multi-year budget. ApexGP focuses on a downloadable, playable foundation that can be expanded safely.
