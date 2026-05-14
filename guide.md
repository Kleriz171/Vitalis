# Vitalis — First-Time User Guide

Welcome. Vitalis is a real-time bio-logistics emergency platform with **three apps** sharing one backend:

| App | Who uses it | URL (local dev) |
|---|---|---|
| **API** | (backend service) | http://localhost:4000 |
| **Web** | Dispatchers / admins / operators | http://localhost:5173 |
| **Mobile** | Citizens, blood donors, doctors, nurses, responders | http://localhost:5174 |

Citizens use Mobile. Operators use Web. The API enforces this with role-based access.

---

## 1. Prerequisites

Install before you start:

- **Node.js 20+** (`node --version`)
- **npm 10+** (ships with Node)
- **MongoDB** — either:
  - Local install (Mongo 7+), or
  - Docker Desktop (recommended — `docker compose up mongo`), or
  - MongoDB Atlas cloud (just paste the connection string into `.env`)
- **Git**
- *(Optional)* **Mapbox token** — only needed for the live map view in the Web operator portal. Get a free one at https://account.mapbox.com/access-tokens/. The app still runs without it (map area will be blank).

---

## 2. First-run setup (5 minutes)

```bash
# 1. Clone & enter
git clone <repo-url> vitalis
cd vitalis

# 2. Copy environment template
cp .env.example .env
#   → edit .env: paste your Mapbox token (optional)
#   → leave JWT_ACCESS / JWT_REFRESH as anything random for local dev

# 3. Install everything (monorepo: one install per app)
cd apps/api && npm install
cd ../web && npm install
cd ../mobile && npm install
cd ../..

# 4. Start MongoDB (skip if you already have one running)
docker compose up -d mongo

# 5. Seed demo data + demo accounts
cd apps/api && npm run seed
```

Seed creates:

| Email | Password | Role | Where to log in |
|---|---|---|---|
| `demo@vitalis.dev` | `demo1234` | citizen | Mobile (http://localhost:5174) |
| `doctor@vitalis.dev` | `demo1234` | doctor | Mobile (Responder Inbox) |
| `dispatcher@vitalis.dev` | `demo1234` | dispatcher | Web (http://localhost:5173) |

Plus seeded hospitals, blood inventory, medicine inventory, doctors, and training courses around **Tirana, Albania** (demo coords).

---

## 3. Run the three apps

Open **three terminals** from the repo root:

```bash
# terminal 1
npm run dev:api          # → http://localhost:4000   (Express + Socket.io)

# terminal 2
npm run dev:web          # → http://localhost:5173   (operator portal)

# terminal 3
npm run dev:mobile       # → http://localhost:5174   (citizen + responder PWA)
```

Or one-shot with Docker:

```bash
docker compose up --build
```

---

## 4. What to try first

### As a **citizen** (Mobile, http://localhost:5174)

Log in with `demo@vitalis.dev` / `demo1234`. The bottom tab bar exposes:

- **Home** — big red **SOS** button (triggers a real emergency broadcast over Socket.io)
- **Bio Passport** — your health record + QR code (scannable from `/verify` on the web app)
- **Blood** — request a transfusion / register as donor
- **Medicine Radar** — nearby pharmacies and inventory
- **Doctors** — book a teleconsult
- **Community** — local groups & posts
- **Training** — first-aid courses, quizzes, and a verifiable certificate
- **Profile** — settings, sign out

### As a **dispatcher / operator** (Web, http://localhost:5173)

Log in with `dispatcher@vitalis.dev` / `demo1234`. Tabs:

- **Logistics** — live map of incidents, responders, hospitals (needs Mapbox token)
- **Drones** — drone mission planner
- **Ledger** — blockchain audit log (verify chain integrity at `/api/blockchain/verify`)
- **Analytics** — KPI dashboard

**Tip:** Fire an SOS from Mobile while the Web Logistics tab is open — you should see it appear instantly via Socket.io.

### As a **doctor / responder** (Mobile)

Log in with `doctor@vitalis.dev` / `demo1234`. You land on the **Responder Inbox** with live SOS notifications and Live-Link video signaling.

---

## 5. Public pages (no login)

- `http://localhost:5173/` — landing page
- `http://localhost:5173/verify?token=…` — scan a Bio Passport QR to verify the holder
- `http://localhost:4000/api/health` — API health check

---

## 6. Mobile native shells (optional)

The mobile app is a PWA. To wrap it for iOS / Android via Capacitor:

```bash
cd apps/mobile
npm run build
npx cap add android   # first time only — needs Android Studio
npx cap add ios       # first time only — needs Xcode (macOS)
npm run cap:sync
npm run cap:open:android   # or :ios
```

To test the live dev server from a real phone, edit `capacitor.config.ts` → uncomment `server.url` → set it to your laptop's LAN IP (e.g., `http://192.168.1.42:5174`), and start `npm run dev:mobile` (it already binds to `0.0.0.0` via `--host`).

There is also an **Expo React Native** version in `apps/native` (`npm run dev:native` then scan the QR with Expo Go).

---

## 7. Common gotchas

- **Web shows "blank map":** missing `VITE_MAPBOX_TOKEN` in `.env`. Everything else still works.
- **"Mongo connection refused":** the API can't reach MongoDB. Start it: `docker compose up -d mongo`.
- **Login rejects you:** wrong app for the role. Citizens → Mobile only; Dispatchers → Web only.
- **Ports already in use:** API=4000, Web=5173, Mobile=5174. Kill whatever else is on them.
- **Want to reset everything:** `docker compose down -v` (wipes the Mongo volume), then re-seed.

---

## 8. Tech stack at a glance

- **Frontend:** React 18, Vite, TypeScript, TailwindCSS, Radix UI, Redux Toolkit, React Query, Framer Motion, Socket.io client
- **Web extras:** Mapbox GL
- **Mobile extras:** Capacitor (geolocation, haptics, status bar), vite-plugin-pwa
- **Native:** Expo Router, NativeWind
- **Backend:** Node + Express + TypeScript, Mongoose (MongoDB w/ GeoJSON `2dsphere`), Socket.io, JWT + refresh tokens, RBAC, Zod, Helmet, Winston
- **Real-time rooms:** `user:<id>`, `responders`, `dispatchers`, `emergency:<id>`, `rtc:<room>`
- **Blockchain log:** SHA-256 chained, append-only — `GET /api/blockchain/verify`

---

## 9. Where to look next

- `README.md` — short-form overview
- `apps/api/src/modules/<feature>` — backend route + service + validator per feature
- `apps/api/src/seeds/seed.ts` — demo data definitions
- `apps/web/src/features/command/pages/*` — operator portal pages
- `apps/mobile/src/features/*` — citizen + responder screens
- `packages/shared` — TypeScript types shared across all apps

Happy hacking.
