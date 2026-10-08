# Vitalis mobile app

The app for citizens and responders (iOS and Android, Expo + expo-router). Citizens send an SOS,
keep their Medical ID (Bio Passport), take the CPR/AED course and find defibrillators.
Certified responders go on duty, receive nearby emergencies and hand over to the ambulance.

## Run

```bash
cp .env.example .env            # EXPO_PUBLIC_API_URL: see the comments for simulator / emulator / phone
npm run dev:native              # from the repo root; scan the QR with Expo Go
npm run dev:iphone              # same, on an iPhone on this Wi-Fi (opens an exp:// QR)
```

Stays on Expo SDK 57 until the App Store's Expo Go supports a newer one. The wake word needs a
development build (`expo-dev-client`); in Expo Go it is simply off.

## Layout

| Folder | What lives there |
|---|---|
| `app/` | Screens. The file path is the route (expo-router). |
| `app/(tabs)/` | The tab bar: Home, Supply (`blood.tsx`), Doctors, Training, Profile. `community.tsx` is opened from Home, not the bar |
| `app/sos.tsx`, `emergency.tsx` | Sending an SOS, then the live emergency (who is coming, CPR metronome, call 127) |
| `app/responder-inbox.tsx`, `handover/` | Responder side: nearby calls, the handover summary for the ambulance crew |
| `app/training/` | Course, lessons, quiz and certificate; passing promotes a citizen to responder |
| `app/fall.tsx`, `checkin.tsx`, `assistant.tsx`, `first-aid.tsx`, `aeds.tsx` | Fall alert, safety check-in, voice assistant, first-aid guides, defibrillator map |
| `components/` | `AppScreen` (green band + sheet layout), `ui/` kit (`List`, `Button`, `Card`, …), `WatchSection` (pair a watch) |
| `lib/` | Everything that is not a screen (see below) |
| `modules/keyword-spotter/` | Local Expo module: on-device "Hey Vitalis" / "not breathing" detection (Android) |
| `scripts/` | Checks run from the repo root: `check:i18n`, `check:fall`, `check:voice` |

`lib/` by concern:

| Concern | Files |
|---|---|
| Talking to the API | `api.ts` (axios + token refresh), `socket.ts` (live updates), `push.ts` |
| Session and state | `store.ts` (Redux, tokens in SecureStore), `session.ts` (full sign-out) |
| Safety features | `fallDetector.ts` (pure rule, tested), `fallDetection.ts` (sensor wiring), `wakeWord.ts`, `voicePhrases.ts`, `speech.ts`, `dutyLocation.ts` |
| Content | `firstAid.ts`, `courseArt.ts`, `medicalId.ts` |
| Language | `i18n.ts` (English, the source), `i18n.sq.ts` (Albanian); `check:i18n` fails on a missing key |
| Look | `theme.ts`: colours shared with the console and the watch apps |

## Conventions

- New screens use `AppScreen` and the `ui/List` rows, like Profile does.
- Every user-facing string goes through `t()` and exists in both languages.
- Pure logic (no React Native imports) goes in its own file with a check script, like `fallDetector.ts`.
