# Vitalis watch apps

Small standalone watch apps for one job: getting help from the wrist. Every watch platform
implements **the same screens, the same rules and the same look**. This file is the contract;
when you change behaviour or design on one platform, change it on all of them in the same PR.

| Platform | Folder | Stack | Status |
|---|---|---|---|
| Wear OS (Samsung Galaxy Watch, Pixel Watch, …) | [`wearos/`](wearos) | Kotlin, Compose for Wear OS, Health Services | Tested on the emulator |
| Apple Watch | [`watchos/`](watchos) | Swift, SwiftUI, HealthKit | Tested on the simulator |

Neither has been tried on a real watch yet; the heart sensors in particular need that.

## What the watch does

1. **Pair.** The watch shows a 6-digit code. In the phone app: Profile → Watch → type the code.
   The watch receives a limited key: it can send and cancel its own SOS, read that SOS's
   status, and read the Medical ID. Nothing else.
2. **SOS.** Hold the red button for 3 s (a ring fills, a tick each second). A 3 s countdown
   follows that can still be cancelled. The SOS goes out with the watch's location.
3. **Status.** Finding help → help is coming (responder name, ETA) → help is with you. Call 127
   and "I'm OK, cancel SOS" (tap twice) are always there.
4. **Heart check** (on by default, can be switched off). Watches the *resting* heart rate. If it
   stays ≥ 150 bpm or ≤ 40 bpm (Wear OS: ≤ 35 asleep) for 4+ minutes, the watch asks
   **"Are you OK?"**. No answer in 30 s sends a heart SOS. "I'm OK" silences it for 30 minutes.
   Exercise and readings without skin contact never count. These limits are a starting point
   and still need medical review.
5. **Medical ID.** Name, blood type, allergies, medication, conditions from the Bio Passport,
   cached so it opens offline.
6. **Call 127** opens the dialler (the person confirms; watches without a SIM hand it to the phone).

Not built, on purpose (ask first): fall detection on the watch, a watch-face SOS tile,
responder alerts on the wrist.

## Screens

One screen at a time, no navigation stack to get lost in during an emergency.

| Screen | Shows | Leaves to |
|---|---|---|
| Pair | Brand mark, the code, a hint (or "No connection") | Home once the phone confirms |
| Home | SOS button, heart card (bpm, beating heart, 6 h graph, switch), Medical ID, Call 127, paired name | Countdown, Medical, Status (if an SOS is already open) |
| Countdown | Red screen, 3-2-1 ring, Cancel | Sending, Home |
| Are you OK? | Heart beating at the alarming rate, I'm OK, "SOS in N s" | Home, Sending |
| Sending | Spinner; on failure "Retrying…" + Call 127, retries every 3 s | Status, No location, Pair (key revoked) |
| Status | Step icon, title, 4-step progress, ETA, responder, Call 127, cancel | Home when the SOS closes |
| No location | What to do, Call 127, Try again | Sending |
| Medical ID | Name, then one card per fact | Home |

A `401` anywhere means the phone unpaired the watch: forget the key, stop the heart check, go to Pair.

## Rules both apps share

| Rule | Value |
|---|---|
| Hold to send | 3 s |
| Countdown | 3 s |
| "Are you OK?" answer time | 30 s, then SOS (a background job sends it if the app is asleep) |
| Quiet after "I'm OK" | 30 min |
| Heart limits | high ≥ 150, low ≤ 40 (≤ 35 asleep, Wear OS only: Apple gives no sleep state) |
| Sustained | ≥ 3 readings spanning ≥ 4 min, inside a 15 min window, all out of range |
| Location | fresh fix within 8 s, else the last known one, else "No location" |
| Status refresh | every 5 s |
| Pairing code poll | every 3 s; expired code (404) → new code; offline → retry in 5 s |
| SOS `reason` | `button`, `heart_high` or `heart_low` |

The heart rule lives in `HeartCheck` on both platforms and has the same unit tests
(`HeartCheckTest.kt`, `HeartCheckTests.swift`).

## Design

The phone app's language, made for the wrist. Tokens (same names in `Theme.kt` and `Theme.swift`):

| Token | Hex | Use |
|---|---|---|
| Green → Deep | `#0C5D57` → `#084540` | Screen background, a top-to-bottom gradient |
| Teal | `#14A897` | Live, selected, primary buttons |
| SOS | `#E14545` | SOS and danger only |
| Paper / Paper pressed | `#F7F5F0` / `#E6E2D8` | Cards |
| Ink / Ink muted | `#13201F` / `#556362` | Text on cards |

Components: `IconTile`, `CardRow` (an icon, a title, a line under it, on a paper card),
`HoldSosButton`, `HeartCard`, `BeatingHeart`, `Sparkline`, `BrandMark`, `rise` (items fade up one
after another when a screen opens). Where the platforms differ only in idiom the names follow it:
`SolidButton` / `SolidStyle`, `Call127Card` / `Call127Button`, `PaperCard` / `CardStyle`. Haptics: a tick per second while
holding SOS and during the countdown, a buzz every 5 s on "Are you OK?", a confirmation when the
SOS is sent.

## Code layout

Both apps use the same folders, so a file on one platform has an obvious twin on the other.

| Folder | Wear OS (`wearos/app/src/main/java/dev/vitalis/watch/`) | Apple Watch (`watchos/Vitalis/`) |
|---|---|---|
| app | `MainActivity.kt` (screen router) | `App/VitalisApp.swift` (screen router) |
| core | `core/Api.kt`, `core/Store.kt` | `Core/Api.swift`, `Core/Store.swift` |
| heart | `heart/Heart.kt`, `HeartCheck.kt`, `HeartAlert.kt`, `HeartService.kt` | `Heart/Heart.swift`, `HeartCheck.swift`, `HeartAlert.swift` |
| sos | `sos/Sos.kt` | `Sos/Sos.swift` |
| design | `ui/design/Theme.kt`, `Components.kt`, `HeartViews.kt` | `Design/Theme.swift`, `Components.swift`, `HeartViews.swift` |
| screens | `ui/screens/*Screen.kt` | `Screens/*View.swift` |
| strings | `res/values{,-sq}/strings.xml` | `Resources/{en,sq}.lproj/Localizable.strings` |

The key is stored in the Keychain on Apple Watch and in app-private preferences on Wear OS
(see the `ponytail:` note in `Store.kt`).

## API

All under `/api/watch` (`apps/api/src/modules/watch/watch.routes.ts`, checked by `npm run check:watch`).
Paired calls send `Authorization: Watch <key>`.

| Call | Who | Purpose |
|---|---|---|
| `POST /pair/start` `{name}` → `{code, pairId}` | watch | New pairing code |
| `POST /pair/poll` `{pairId}` → `{status, token?, name?}` | watch | Wait for the phone |
| `POST /pair/confirm` `{code}` | phone (signed in) | Link the watch to the account |
| `POST /sos` `{reason, coordinates: [lng, lat], heartRate?}` | watch | Send the SOS |
| `GET /sos` → `{emergency \| null}` | watch | Status of the open SOS |
| `POST /sos/:id/cancel` | watch | False alarm |
| `GET /medical-id` → `{lines}` | watch | Medical ID, first line is the name |

## Build and run

Point the watch at the **test** API (`vitalis_test` database), never the one holding real data.

### Wear OS

Needs JDK 17 or 21 and the Android SDK (`wearos/local.properties` → `sdk.dir`).

```bash
cd apps/watch/wearos
./gradlew testDebugUnitTest assembleDebug -PapiUrl=http://10.0.2.2:4000/api   # 10.0.2.2 = this Mac, from the emulator
adb install -r -g app/build/outputs/apk/debug/app-debug.apk
```

Use `-PapiUrl=https://<api>/api` for real watches.

### Apple Watch

Needs Xcode and XcodeGen (`brew install xcodegen`). The Xcode project is generated, not committed.

```bash
cd apps/watch/watchos
xcodegen generate
xcodebuild -project VitalisWatch.xcodeproj -scheme Vitalis -sdk watchsimulator -derivedDataPath build build
xcodebuild test -project VitalisWatch.xcodeproj -scheme Vitalis -destination 'platform=watchOS Simulator,name=<watch>' -derivedDataPath build
```

Override the API with `VITALIS_API_URL=https://<api>/api` on the `xcodebuild` line. Shipping
needs a paid Apple Developer account (HealthKit entitlement, signing).

### Screenshots without tapping through

Debug builds open any screen directly:

```bash
# Wear OS
adb shell am start -S -n dev.vitalis.app/dev.vitalis.watch.MainActivity --es screen status --es demoStatus en_route
# Apple Watch
xcrun simctl launch <udid> dev.vitalis.watch -screen status -demoStatus en_route
```

`screen`: `countdown`, `areYouOk`, `status`, `medical`. `demoStatus`: `pending`, `en_route`, `on_scene`.
Careful: `countdown` really sends an SOS when it reaches zero. Home has a debug-only
"Test: high heart rate" button that runs the whole alert path.
