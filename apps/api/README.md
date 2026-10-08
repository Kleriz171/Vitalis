# Vitalis API

One Express + MongoDB (Mongoose) + Socket.io server for every client: the mobile app, the watch
apps, the desktop console, the public website and the drone bridge.

## Run

```bash
cp ../../.env.example ../../.env     # JWT_ACCESS / JWT_REFRESH at least
npm run seed                          # repo root: wipes the DB and loads demo data (refuses in production)
npm run dev:api                       # http://localhost:4000, health check at /health
```

Run checks against a separate test database (`MONGO_URI=…/vitalis_test`), never the one with real data.

## Layout

| Folder | What lives there |
|---|---|
| `src/index.ts`, `src/app.ts` | Start-up; the Express app with security headers, CORS, rate limits and every route mounted |
| `src/config/` | `env.ts` (all settings, refuses weak secrets in production), `db.ts`, `logger.ts` |
| `src/middleware/` | `auth.ts` (`authRequired`, JWT), `rbac.ts` (`allow(...roles)`), `validate.ts` (zod body check), `error.ts` |
| `src/modules/<area>/` | One folder per API area, mounted at `/api/<area>` (see below) |
| `src/models/` | Mongoose models, one per file |
| `src/realtime/` | `socket.ts` (rooms: an emergency's people, on-duty responders, operators), `drones.ts` (bridge link and operator controls) |
| `src/utils/` | Small helpers: `geo` (distance, near queries), `jwt`, `hash`, `sms` (Twilio), `qr`, `lang`, `regex` |
| `src/seeds/` | Demo data and the training courses (English + Albanian) |
| `scripts/` | End-to-end checks, run from the repo root as `npm run check:<name>` |

A module is a `<area>.routes.ts` with its zod schemas next to the handlers. Bigger areas split out
a `.controller.ts` and `.service.ts` (`auth`, `emergency`) so the routes file stays readable.

| Area | Used by | Purpose |
|---|---|---|
| `auth`, `account` | all apps | Sign-in, refresh, sign-up; export or erase your own data |
| `emergency` (+ `redispatch.ts`) | mobile, console | SOS, matching responders, two-runner cardiac dispatch, re-dispatch when nobody answers |
| `watch` | watch apps, mobile | Pairing and the watch's limited SOS / Medical ID key |
| `biopassport`, `training`, `doctor-applications` | mobile, console | Medical ID, courses and certificates, doctors applying to respond |
| `aed`, `drone`, `track`, `checkin`, `sms`, `push` | various | Defibrillators, drones, the public tracking link, safety check-ins, Twilio SMS fallback, push tokens |
| `blood`, `supply`, `medicine`, `doctors`, `community`, `health`, `ai` | mobile | The citizen app's other tabs and the assistant |
| `admin`, `analytics`, `blockchain` | console | Operators and users, reports, the tamper-proof call log |

## Checks

```bash
MONGO_URI=mongodb://localhost:27017/vitalis_test PORT=4160 scripts/e2e.sh   # repo root: all end-to-end checks, fresh seed each
API_URL=http://localhost:4000 npm run check:security                           # one check against a running, seeded API
```

`check:security` covers auth, roles, injection, dispatch races and socket rooms. Run it after
any change to the API.

## Conventions

- Validate every request body with zod (`validate(schema)`), check roles with `allow(...)`.
- Operators have one role, `eso`. `normalizeRole()` in `models/User.ts` maps older role names.
- Patient locations never go to third-party services in production (OSRM is self-hosted; see the root README).
