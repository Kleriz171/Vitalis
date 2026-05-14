# VITALIS

> Real-time bio-logistics emergency coordination ecosystem.
> Uber-grade dispatch × Wolt-grade logistics × healthcare-grade reliability.

Vitalis is an end-to-end platform for coordinating medical emergencies, blood and medicine logistics, teleconsultations, and first-aid response in a single real-time network. Citizens raise alerts and access health services from a mobile app; nearby doctors, nurses, and student responders pick them up from a responder inbox; dispatchers oversee the entire fleet — incidents, hospitals, drones, supply chains — from a desktop command portal. Every actor sees the same world update live.

The project is built as a monorepo of three frontends (a desktop operator portal, a mobile PWA, and an Expo React Native app) sharing a single Node/Express API backed by MongoDB and Socket.io.

---

## What Vitalis does

### For citizens (mobile)

- **SOS** — one-tap emergency broadcast with geolocation; instantly fans out to nearby responders and dispatchers
- **Bio Passport** — portable health record with a QR code that paramedics or hospitals can scan to retrieve allergies, blood type, conditions, and emergency contacts
- **Blood** — request a transfusion or register as a donor; matched against live hospital inventory
- **Medicine Radar** — find nearby pharmacies and check stock for a specific medication
- **Doctors** — book a teleconsult with a verified doctor (Live-Link video over WebRTC)
- **Community** — local groups and posts for awareness, donations, and drives
- **First Aid Training** — courses, quizzes, and a verifiable certificate (QR-checkable from the web)
- **AI Assistant** — triage helper for non-emergency symptom questions

### For doctors, nurses, and student responders (mobile)

- **Responder Inbox** — live feed of nearby SOS calls; accept, navigate, and update status
- **Live-Link video** — WebRTC consult with the citizen or scene
- **Patient context** — pulls Bio Passport on accept

### For dispatchers and admins (web desktop)

- **Logistics map** — live Mapbox view of incidents, responders, hospitals, drones
- **Drones** — drone mission planner for medicine / blood delivery
- **Ledger** — append-only blockchain audit log of every critical action; integrity-verifiable
- **Analytics** — KPI dashboard (response times, incident throughput, inventory health)

### Cross-cutting

- **Role-based access** — Citizens use Mobile only; Operators use Web only. Enforced server-side on every route.
- **Blockchain audit** — SHA-256 chained, difficulty-2, append-only `BlockchainLog` for tamper-evident history
- **GeoJSON `2dsphere` indexes** — geo-aware queries (nearby responders, nearest hospital, drone radius)
- **PWA + native shells** — the mobile app installs to home screen on any phone, and can be packaged for iOS/Android via Capacitor; an alternative pure-native client is provided via Expo

---

## System split

| App | Audience | Form factor | URL (dev) |
|---|---|---|---|
| `apps/api` | — | Node service | http://localhost:4000 |
| `apps/web` | **Dispatchers / admins / operators** | desktop browser | http://localhost:5173 |
| `apps/mobile` | **Citizens / field responders** | mobile PWA + Capacitor (iOS/Android) | http://localhost:5174 |
| `apps/native` | Same audience as `apps/mobile` | Expo React Native (iOS/Android) | Expo Go / dev client |

Citizens cannot log into the desktop portal. Operators cannot log into the mobile app. Authentication is checked client-side after login (UX guard) and enforced server-side via role-based route policies.

## Stack

- **Frontend** (web & mobile PWA): React + Vite + TypeScript, Tailwind, Radix UI, Framer Motion, Redux Toolkit, React Query, Socket.io client, PWA. Web adds Mapbox GL; mobile PWA adds Capacitor (`@capacitor/core`, `@capacitor/geolocation`, `@capacitor/haptics`, `@capacitor/status-bar`).
- **Native** (`apps/native`): Expo Router, React Native 0.81, NativeWind, Reanimated.
- **Backend**: Node + Express + TypeScript, Mongoose (MongoDB + GeoJSON `2dsphere`), Socket.io, JWT access + refresh tokens, RBAC, Winston, Helmet, rate limiting, Zod validation.
- **Infra**: Docker Compose, MongoDB Atlas-ready, Render/Vercel/Railway-ready.

## Layout

```
apps/api          Express + Socket.io + Mongoose
apps/web          Operator portal (desktop)
apps/mobile       Citizen + responder mobile app (PWA + Capacitor)
apps/native       Same client as a pure Expo React Native build
packages/shared   Shared TypeScript types
```

## Getting started

```bash
cp .env.example .env

# install
cd apps/api && npm install
cd ../web && npm install
cd ../mobile && npm install

# (optional) seed demo data + demo accounts
cd ../api && npm run seed

# run all three in separate terminals
cd apps/api && npm run dev      # → :4000
cd apps/web && npm run dev      # → :5173 (operator portal)
cd apps/mobile && npm run dev   # → :5174 (citizen + responder PWA)
```

Or all at once: `docker compose up --build`.

For a click-by-click first-time walkthrough — including demo accounts, what to try first, and common gotchas — see [`guide.md`](./guide.md).

### Demo accounts (created by `npm run seed`)

| Email | Password | Role | App |
|---|---|---|---|
| `demo@vitalis.dev` | `demo1234` | citizen | Mobile |
| `doctor@vitalis.dev` | `demo1234` | doctor | Mobile (Responder Inbox) |
| `dispatcher@vitalis.dev` | `demo1234` | dispatcher | Web |

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

For the pure-native Expo build: `cd apps/native && npm run start`, then scan the QR with Expo Go.

## Roles & access

| Role | Where they sign in |
|---|---|
| `citizen`, `blood_donor` | Mobile app → Home tab (SOS, Medicine, Bio Passport) |
| `doctor`, `nurse`, `student_responder` | Mobile app → Responder Inbox |
| `dispatcher`, `admin` | Desktop operator portal |

The API issues JWT access + refresh tokens. RBAC is enforced server-side at every route.

## API surface

Modules under `apps/api/src/modules`:

`auth` · `biopassport` · `blood` · `blockchain` · `community` · `doctors` · `drone` · `emergency` · `health` · `medicine` · `supply` · `training` · `analytics`

Each module is a vertical slice (router + controller + service + Zod validator + tests-ready). Health check: `GET /api/health`.

## Real-time

Socket.io rooms — same on both clients:

- `user:<id>` — direct
- `responders` — new-SOS broadcasts (mobile responders)
- `dispatchers` — dashboard firehose (web operators)
- `emergency:<id>` — per-incident updates
- `rtc:<room>` — WebRTC signaling (Live-Link video)

## Blockchain simulation

Append-only `BlockchainLog` collection with SHA-256 chained hashes (difficulty 2). Critical actions (SOS, drone dispatch, blood transfer, certificate issuance) are mined into the chain. Verify integrity: `GET /api/blockchain/verify`.

## License

MIT — prototype.
