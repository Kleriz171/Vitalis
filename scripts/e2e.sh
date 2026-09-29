#!/usr/bin/env bash
# Runs every end-to-end API check, each against a freshly seeded test DB and its own API
# (the checks need different timings, and a fresh process resets the auth rate limit).
#   MONGO_URI=mongodb://localhost:27017/vitalis_test PORT=4160 scripts/e2e.sh
# Never point MONGO_URI at real data: the checks rewrite it.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${MONGO_URI:?set MONGO_URI to a test database}"
case "$MONGO_URI" in *test*) ;; *) echo "MONGO_URI must name a test database" >&2; exit 1;; esac
PORT="${PORT:-4000}"
export API_URL="http://localhost:$PORT" MONGO_URI
LOG_DIR="${LOG_DIR:-$(mktemp -d)}"; mkdir -p "$LOG_DIR"
pids=()
# Processes run as plain node (no npx wrapper), so kill reaches them and wait lets the port go.
cleanup() {
  for p in "${pids[@]:-}"; do [ -n "$p" ] && { kill "$p" 2>/dev/null; wait "$p" 2>/dev/null; } || true; done
  pids=()
}
trap cleanup EXIT

# run <name> "<API env>" "<check env>" <check script> [bridge]
run() {
  local name=$1 apienv=$2 checkenv=$3 script=$4 bridge=${5:-}
  echo "── $name"
  npm run seed -w @vitalis/api >"$LOG_DIR/$name-seed.log" 2>&1
  env $apienv PORT="$PORT" node --import tsx apps/api/src/index.ts >"$LOG_DIR/$name-api.log" 2>&1 & pids+=($!)
  for _ in $(seq 1 60); do curl -s -o /dev/null "$API_URL/api/health" && break; sleep 1; done
  if [ -n "$bridge" ]; then
    (cd apps/drone && exec env $apienv SIM=1 TELLO_HOST=127.0.0.1 node --import tsx src/bridge.ts >"$LOG_DIR/$name-bridge.log" 2>&1) & pids+=($!)
    sleep 3
  fi
  if ! env $checkenv npx tsx "$script"; then
    echo "✗ $name failed; API log:" >&2; tail -40 "$LOG_DIR/$name-api.log" >&2; exit 1
  fi
  cleanup
}

run security   "" "" apps/api/scripts/security-check.ts
run redispatch "REDISPATCH_TICK_MS=1000 REDISPATCH_PROGRESS_MS=3000" "" apps/api/scripts/redispatch-check.ts
run checkin    "CHECKIN_TICK_MS=500 CHECKIN_GRACE_MS=2000" "" apps/api/scripts/checkin-check.ts
run sms        "TWILIO_AUTH_TOKEN=test-token TWILIO_WEBHOOK_URL=$API_URL/api/sms/inbound" "TWILIO_AUTH_TOKEN=test-token" apps/api/scripts/sms-check.ts
run drones     "DRONE_BRIDGE_KEY=ci-bridge-key" "" apps/api/scripts/drone-check.ts bridge
echo "All end-to-end checks passed."
