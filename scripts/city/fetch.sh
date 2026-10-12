#!/usr/bin/env bash
# Downloads central Tirana from OpenStreetMap (ODbL: credit "© OpenStreetMap contributors").
# Usage: scripts/city/fetch.sh <out_dir>
set -euo pipefail
OUT=${1:?out dir}; mkdir -p "$OUT"
BB='41.3195,19.8080,41.3355,19.8295'
MIRRORS=(https://overpass-api.de/api/interpreter https://maps.mail.ru/osm/tools/overpass/api/interpreter https://overpass.kumi.systems/api/interpreter)
q() { echo "[out:json][timeout:90];($1);out body;>;out skel qt;"; }
fetch() {
  for attempt in 1 2 3 4 5 6; do
    for u in "${MIRRORS[@]}"; do
      curl -s -m 120 -A "VitalisWebsite/1.0" -X POST "$u" --data-urlencode "data=$2" -o "$OUT/$1.json"
      if head -c 1 "$OUT/$1.json" | grep -q '{'; then echo "$1: ok"; return; fi
    done
    sleep 8   # public servers are often busy; try again
  done
  echo "$1: failed" >&2; exit 1
}
fetch buildings "$(q "way[\"building\"]($BB);relation[\"building\"]($BB);")"
fetch roads "$(q "way[\"highway\"~\"^(primary|secondary|tertiary|residential|trunk|pedestrian|unclassified|living_street)\$\"]($BB);")"
fetch green "$(q "way[\"waterway\"]($BB);way[\"leisure\"=\"park\"]($BB);relation[\"leisure\"=\"park\"]($BB);way[\"landuse\"=\"grass\"]($BB);way[\"natural\"=\"water\"]($BB);")"
