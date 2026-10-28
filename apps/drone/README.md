# Vitalis drone bridge

The bridge runs on a laptop (or Raspberry Pi) joined to the drone's Wi-Fi, and stays online
to the Vitalis API over a second link: a USB Wi-Fi adapter, Ethernet, or a phone over USB.
Operators fly from the console (Equipment → Drones); the console talks to the API, the API
relays to the bridge, and the bridge talks to the drone. Nothing reaches a drone without an
operator account, and every take-off, landing and emergency stop goes into the call log.

```
console ──Socket.io──▶ API ──/drones namespace──▶ bridge ──▶ drone
                                                    │
                                                    └─ http://<bridge>:8090/video.mjpg (camera)
```

## Drivers

`DRONE_TYPE` picks how the bridge talks to the drone.

| `DRONE_TYPE` | Drones | Routes | Battery, height | Code |
|---|---|---|---|---|
| `tello` (default) | DJI Tello | Yes: measured moves (`forward 200`, `cw 90`) | Yes | `src/tello.ts` |
| `cooingdv` | M10, E88, E99 and other "RC UFO" / "KY UFO" app drones | No | No | `src/turbodrone.ts` |
| `cooingdv_jieli` | "KY FPV" app drones | No | No | |
| `s2x` | Hiturbo S20, Loiley S29, Plegble PL-515, Redrie X29 | No | No | |
| `wifi_uav` | Karuisrc K417, FlyVista V88, D16/GT3/V66 | No | No | |
| `wifi_cam` | "WiFi_CAM" app drones | No | No | |
| `x69_lg` | Loiley X69 | No | No | |
| `debug` | None: your laptop's webcam stands in for the camera | No | No | |

Everything except `tello` goes through **turbodrone** (`turbodrone/`), a reverse-engineered
control server for Wi-Fi toy drones by Marshall Richards (Apache-2.0, see `turbodrone/NOTICE`).
The bridge starts it, steers it and serves its video; you never run it yourself.

## Run

```bash
# same DRONE_BRIDGE_KEY on the API and the bridge (openssl rand -hex 24)
DRONE_BRIDGE_KEY=... API_URL=http://<api>:4000 npm start -w @vitalis/drone                       # Tello
DRONE_BRIDGE_KEY=... API_URL=http://<api>:4000 DRONE_TYPE=cooingdv npm start -w @vitalis/drone   # toy drone
npm run sim -w @vitalis/drone   # simulated Tello, no hardware needed
```

On Windows PowerShell set each variable first: `$env:DRONE_TYPE="cooingdv"`, then `npm start -w @vitalis/drone`.

The drone shows up in the console as `<type>-1` (`tello-1`, `cooingdv-1`); set `DRONE_ID` to name it.

### Toy drones: one-time setup

turbodrone needs Python 3.10 or newer (tested with 3.11). From the repo root:

```bash
# macOS / Linux
python3.11 -m venv apps/drone/turbodrone/.venv
apps/drone/turbodrone/.venv/bin/pip install -r apps/drone/turbodrone/requirements.txt
```

```powershell
# Windows
py -3.11 -m venv apps\drone\turbodrone\.venv
apps\drone\turbodrone\.venv\Scripts\pip install -r apps\drone\turbodrone\requirements.txt
```

The bridge finds that environment by itself (`TURBODRONE_PYTHON` overrides it). Drone-specific
settings from upstream turbodrone (`DRONE_IP`, `COOINGDV_VARIANT`, the `X69_LG_*` video modes, …)
go in `apps/drone/turbodrone/.env`; the defaults fit each family's factory Wi-Fi.

Then: switch the drone on, join its Wi-Fi from the bridge laptop, start the bridge.

### Tello video

`brew install ffmpeg` (or ffmpeg on `PATH` on Windows) turns the Tello's H.264 into the
console's live picture. Toy drones need nothing extra, except `x69_lg` in its `h265` video mode.

## Safety rules

They run on the bridge, so they hold whatever the console does:

- No take-off without a live link to the drone, or under `MIN_BATTERY` (30%) when the drone reports its battery.
- API link lost while flying → land.
- Sticks are a dead-man switch: no input for 400 ms → hover.
- 60 s airborne without operator input (`IDLE_LAND_MS`) → land.
- Tello battery under 15% → land.

Toy drones add three more, inside turbodrone:

- Its only client is the bridge: it listens on 127.0.0.1 and every request needs a fresh token the bridge makes at start-up. Without that, any web page open on the laptop could fly the drone.
- Sticks centre when the bridge's socket closes, or when a held stick isn't re-sent for `AXES_DEADMAN_MS` (1 s).
- It exits when the bridge does, even if the bridge crashed. On macOS and Linux, Ctrl+C on the bridge lands the drone first (except one-button drones, below).

### What toy drones can't do

- **No routes.** They have no GPS or position sensor, so there is no "fly 2 m forward". The API refuses to dispatch them, and the console offers manual flight only.
- **No readings.** No battery, height or speed. The bridge judges the link from video frames and the drone's replies, and counts flight time itself.
- **Take-off and landing take a set time** (`TOY_TAKEOFF_MS` 3 s, `TOY_LAND_MS` 5 s), because the drone never says it's done. Time your model once and set them.
- **One-button drones.** CooingDV "GL" drones use the same button to take off and land. If one sets itself down (flat battery), the console still says it's flying, and Land would launch it again. So the bridge never lands these automatically: if the API link drops or nobody steers for 60 s, it centres the sticks and the drone hovers until the operator lands it or the drone lands itself.

## Photos and videos

The console's **Take photo** and **Record** buttons (under each drone's picture) work for every
drone with a camera feed, Tello or toy:

1. The console asks the API; the API records who asked, for which drone and which call.
2. The bridge takes the picture from its own feed (`/video.mjpg`): one frame for a photo, or the
   frames encoded by ffmpeg into an H.264 MP4 for a video (up to `MAX_RECORD_S`, 10 minutes).
3. The bridge uploads the file to the API with its bridge key, retrying for about a minute, then
   deletes it from the laptop. It is footage of patients and bystanders.
4. The API stores it (MongoDB by default, Firebase Storage if set up), writes its SHA-256 to
   the call log, and the console lists it under **Photos and videos**.

Opening one gets a link that works for 10 minutes, and each opening goes into the call log.
After **30 days** the record (a MongoDB TTL index) and the file are deleted. Recording needs
`ffmpeg` on the bridge laptop; photos don't.

### Where the files go

**MongoDB (default, free).** With no `MEDIA_BUCKET`, files go into the API's own database
(GridFS, `droneMedia.*` collections), the same way doctor certificates do, and an hourly sweep
deletes them after 30 days. The free Atlas tier holds 512 MB for everything, so footage is
capped at `MEDIA_QUOTA_MB` (300 MB); when full, the console says so until older footage expires.
A photo is about 50–150 KB and a minute of 720p video roughly 5–15 MB, so 300 MB holds
thousands of photos or about half an hour of video. Check usage in the Atlas dashboard.

**Firebase Storage (no cap, costs money).** Set `MEDIA_BUCKET` and the API uses it instead.
It needs the Blaze (pay-as-you-go) plan, so a billing account with a card:

1. Firebase console → project `vitalis-al-7c3m` → **Upgrade to Blaze**. Cloud Storage for Firebase
   needs the pay-as-you-go plan; a few GB of footage costs cents a month. Add a budget alert.
2. **Storage → Get started**. Pick an EU location (patient data stays in Europe) and *production mode*.
3. **Storage → Rules**: make sure nothing but the API can touch the files:
   `rules_version = '2'; service firebase.storage { match /b/{bucket}/o { match /{allPaths=**} { allow read, write: if false; } } }`
   The API signs in with a service account, which these rules don't apply to.
4. **Project settings → Service accounts → Generate new private key.** Keep the JSON file secret.
5. On the API: `MEDIA_BUCKET=<bucket name, e.g. vitalis-al-7c3m.firebasestorage.app>` and
   `GOOGLE_APPLICATION_CREDENTIALS=<path to that JSON>`. On Render, upload the JSON as a Secret File
   named `firebase-storage.json` (`render.yaml` already points there) and set `MEDIA_BUCKET`.
6. Start the API and look for `drone media in gs://…, deleted after 30 days`. An error there means
   the key can't manage the bucket; the lifecycle rule can also be set by hand under the bucket's
   Lifecycle tab in Google Cloud console (delete, age 30 days, prefix `drone-media/`).

## Checks

From the repo root, with the API running against a seeded test database:

```bash
API_URL=http://localhost:4000 npm run check:drones                 # bridge: npm run sim -w @vitalis/drone
TURBODRONE_TOKEN=t TURBODRONE_PORT=8765 npm run check:toy-drones    # bridge: see the top of apps/api/scripts/toy-drone-check.ts
MONGO_URI=… npm run check:drone-media                              # bridge in sim mode; video part needs ffmpeg
(cd apps/drone/turbodrone && .venv/bin/python -m unittest discover -s tests)   # turbodrone's protocol tests
```

`check:toy-drones` plays a fake CooingDV drone on UDP 7099 and checks the real path:
console → API → bridge → turbodrone → drone packets (take-off, sticks, hover on release, land,
emergency stop), the token, and both stick dead-man switches. `scripts/e2e.sh` runs both drone
checks; it skips the toy one when the Python environment isn't set up.

## Files

| File | What it does |
|---|---|
| `src/bridge.ts` | Connects to the API, runs missions and the safety rules, serves video |
| `src/drone.ts` | The interface both drivers implement |
| `src/tello.ts` | DJI Tello SDK over UDP, plus its video |
| `src/turbodrone.ts` | Starts turbodrone and drives it; proxies its video |
| `src/media.ts` | Photos and videos: frames from the feed, ffmpeg recording, upload to the API |
| `src/sim.ts`, `src/sim-camera.jpg` | Fake Tello for development and CI, with a test-card camera |
| `turbodrone/` | Vendored turbodrone backend (upstream commit 2c09cf8). Files changed for Vitalis say so in their first lines. |
