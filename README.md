# VITALIS

> Real-time bio-logistics emergency coordination ecosystem.
> Uber-grade dispatch × Wolt-grade logistics × healthcare-grade reliability.

## System split

Three apps in the monorepo, sharing one API:

| App | Audience | Form factor | URL (dev) |
|---|---|---|---|
| `apps/api` | — | Node service | http://localhost:4000 |
| `apps/web` | **Dispatchers / admins / operators** | desktop browser | http://localhost:5173 |
| `apps/mobile` | **Citizens / field responders** | mobile PWA + Capacitor (iOS/Android) | http://localhost:5174 |

Citizens cannot log into the desktop portal. Operators cannot log into the mobile app. Authentication is checked client-side after login (UX guard) and would be enforced server-side in production via role-based route policies (already implemented).

## Stack

- **Frontend** (web & mobile): React + Vite + TypeScript, Tailwind, Framer Motion, Redux Toolkit, React Query, Socket.io client, PWA. Web adds Mapbox; mobile adds Capacitor (`@capacitor/core`, `@capacitor/geolocation`, `@capacitor/haptics`, `@capacitor/status-bar`).
- **Backend**: Node + Express + TypeScript, Mongoose (MongoDB + GeoJSON `2dsphere`), Socket.io, JWT auth + RBAC, Winston, Helmet, rate limiting, Zod validation.
- **Infra**: Docker Compose, MongoDB Atlas-ready, Render/Vercel/Railway-ready.

## Layout

```
apps/api          Express + Socket.io + Mongoose
apps/web          Operator portal (desktop)
apps/mobile       Citizen + responder mobile app (PWA + Capacitor)
packages/shared   Shared TS types
```

## Getting started

```bash
cp .env.example .env

# install
cd apps/api && npm install
cd ../web && npm install
cd ../mobile && npm install

# run all three in separate terminals
cd apps/api && npm run dev      # → :4000
cd apps/web && npm run dev      # → :5173 (operator portal)
cd apps/mobile && npm run dev   # → :5174 (citizen + responder PWA)
```

Or all at once: `docker compose up --build`.

## Native mobile builds

The mobile app is a PWA that can be wrapped natively via Capacitor:

```bash
cd apps/mobile
npm run build                    # produce dist/

# first time: add native platforms (requires Xcode / Android Studio)
npx cap add android
npx cap add ios

# every time: sync web assets into native shells
npm run cap:sync

# open in IDE
npm run cap:open:android
npm run cap:open:ios
```

`capacitor.config.ts` is preconfigured with app id `dev.vitalis.mobile`. For testing the live dev server on a physical device, uncomment the `server.url` block and point it at your laptop's LAN IP.

## Roles & access

| Role | Where they sign in |
|---|---|
| `citizen`, `blood_donor` | Mobile app → Home tab (SOS, Medicine, Bio Passport) |
| `doctor`, `nurse`, `student_responder` | Mobile app → Responder Inbox |
| `dispatcher`, `admin` | Desktop operator portal |

The API issues JWT access + refresh tokens. RBAC is enforced server-side at every route.

## Real-time

Socket.io rooms — same on both clients:

- `user:<id>` — direct
- `responders` — new-SOS broadcasts (mobile responders)
- `dispatchers` — dashboard firehose (web operators)
- `emergency:<id>` — per-incident updates
- `rtc:<room>` — WebRTC signaling (Live-Link video)

## Blockchain simulation

Append-only `BlockchainLog` collection with SHA-256 chained hashes (difficulty 2). Verify: `GET /api/blockchain/verify`.

## License

MIT — prototype.
