#!/bin/sh
# One-time (and monthly, for fresh roads) preparation of the Albania road map for the osrm service.
# Needs Docker and ~2 GB of free memory. Output lands in data/osrm/, which docker-compose mounts.
set -e
cd "$(dirname "$0")/.."
mkdir -p data/osrm
curl -fL -o data/osrm/albania-latest.osm.pbf https://download.geofabrik.de/europe/albania-latest.osm.pbf
IMG=ghcr.io/project-osrm/osrm-backend:v5.27.1
docker run --rm -v "$PWD/data/osrm:/data" $IMG osrm-extract -p /opt/car.lua /data/albania-latest.osm.pbf
docker run --rm -v "$PWD/data/osrm:/data" $IMG osrm-partition /data/albania-latest.osrm
docker run --rm -v "$PWD/data/osrm:/data" $IMG osrm-customize /data/albania-latest.osrm
echo "Done. Start it with: docker compose --profile osrm up -d osrm   and set OSRM_URL=http://osrm:5000"
