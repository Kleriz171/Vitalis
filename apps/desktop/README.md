# Vitalis Command (desktop console)

The console emergency services operators use: every live call on a map, defibrillators and
drones, user accounts and doctor applications, and reports that export as PDF. It is a React +
Vite app wrapped by Tauri into an installable macOS / Windows app; the same build also runs in a browser.

## Run

```bash
npm run dev:desktop                                   # repo root: browser at http://localhost:5173
npm run desktop:dev -w @vitalis/desktop               # the Tauri window (needs Rust)
npm run desktop:build -w @vitalis/desktop             # installers: .dmg / .app, .msi / .exe
```

`VITE_API_URL` and `VITE_SOCKET_URL` are baked in at build time; set them to the production API
before building installers. CI builds both platforms in `.github/workflows/desktop.yml`.

## Layout

The folders under `features/` are the four menu sections, so the menu and the code read the same way.

| Menu | Tab | File | URL |
|---|---|---|---|
| Live calls | | `features/live-calls/LiveCalls.tsx` | `/command` |
| Equipment | Defibrillators | `features/equipment/Defibrillators.tsx` | `/command/aeds` |
| | Drones | `features/equipment/Drones.tsx` | `/command/drones` |
| People | Users | `features/people/Users.tsx` (+ `UserDetail.tsx`) | `/command/admin/users` |
| | Doctor applications | `features/people/DoctorApplications.tsx` | `/command/admin/doctor-applications` |
| Reports | Overview | `features/reports/Overview.tsx` | `/command/analytics` |
| | Call log | `features/reports/CallLog.tsx` | `/command/ledger` |

The menu itself is `SECTIONS` in `components/layout/CommandShell.tsx`. URLs kept their original names so links keep working.

| Folder | What lives there |
|---|---|
| `src/api/client.ts` | axios with token refresh |
| `src/realtime/socket.ts` | Socket.io: live calls, responders, drones |
| `src/store/` | Redux: the session |
| `src/components/layout/` | `CommandShell` (frame, menu, `PageHeader`, Export PDF button) |
| `src/components/ui/` | The kit: `list.tsx` (`Panel`, `Row`, `Chip`, mirrors the mobile app's `List`), `tile.tsx` (icon tiles), buttons, inputs |
| `src/components/print/Report.tsx` | The PDF report document (cover, sections, charts) every export uses |
| `src/components/map/`, `widgets/` | Map, KPI cards, gauges |
| `src/lib/` | `exportPdf.ts` (Tauri print, else `window.print`), `useNow.ts` (one ticking clock), `motion.ts`, `format.ts` |
| `src/styles/index.css` | Colour tokens and the entrance animations |
| `src-tauri/` | The desktop shell (Rust): window, print command, icons |

## Conventions

- Vitalis colours only: green frame, off-white sheet. Red is for SOS and danger.
- Plain words in the UI: no internal terms (role names, "ledger", "KPI").
- One plain sentence under every page title.
- Live timers use `useNow` inside the ticking component, never a page-wide re-render.
