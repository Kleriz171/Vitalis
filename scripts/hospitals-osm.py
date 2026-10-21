#!/usr/bin/env python3
"""Hospitals in Albania from OpenStreetMap → apps/api/src/seeds/hospitals.al.json.

  curl -L -o /tmp/al.pbf https://download.geofabrik.de/europe/albania-latest.osm.pbf
  osmium tags-filter /tmp/al.pbf nwr/amenity=hospital nwr/healthcare=hospital -o /tmp/h.pbf --overwrite
  osmium export /tmp/h.pbf -f geojson -o /tmp/h.geojson --overwrite
  osmium tags-filter /tmp/al.pbf n/place=city,town -o /tmp/p.pbf --overwrite
  osmium export /tmp/p.pbf -f geojson -o /tmp/p.geojson --overwrite
  python3 scripts/hospitals-osm.py /tmp/h.geojson /tmp/p.geojson

Data © OpenStreetMap contributors, ODbL. Phone numbers are as mapped and unconfirmed:
call each one before real users rely on it.
"""
import json, math, sys, unicodedata

hosp_file, place_file = sys.argv[1], sys.argv[2]
OUT = 'apps/api/src/seeds/hospitals.al.json'

def centre(geom):
    if geom['type'] == 'Point':
        return geom['coordinates']
    c = geom['coordinates']
    ring = {'LineString': c, 'Polygon': c[0], 'MultiLineString': c[0]}.get(geom['type']) or c[0][0]
    return [sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)]

def km(a, b):
    dx = (a[0] - b[0]) * 111.32 * math.cos(math.radians(a[1]))
    return math.hypot(dx, (a[1] - b[1]) * 110.57)

def key(name):
    s = unicodedata.normalize('NFKD', name.lower())
    return ''.join(c for c in s if c.isalnum())

places = [(f['properties']['name'], f['geometry']['coordinates'])
          for f in json.load(open(place_file))['features'] if f['properties'].get('name')]

# Mappers mix English and unaccented spellings; show the Albanian name.
CITY = {'Tirana': 'Tiranë', 'Shkoder': 'Shkodër', 'Shkodra': 'Shkodër', 'kukes': 'Kukës', 'Kukes': 'Kukës',
        'Durres': 'Durrës', 'Vlora': 'Vlorë', 'Korca': 'Korçë', 'Cfir': 'Çfir'}

seen, out = [], []
for f in json.load(open(hosp_file))['features']:
    p = f['properties']
    name = (p.get('name') or '').strip()
    if not name:
        continue  # nothing to show a person
    at = [round(c, 6) for c in centre(f['geometry'])]
    # One hospital is often mapped as several buildings: same name within 1 km is the same place.
    if any(k == key(name) and km(at, c) < 1 for k, c in seen):
        continue
    seen.append((key(name), at))
    city = p.get('addr:city') or min(places, key=lambda pl: km(at, pl[1]))[0]
    city = CITY.get(city.strip(), city.strip())
    street = ' '.join(x for x in [p.get('addr:street'), p.get('addr:housenumber')] if x)
    op = (p.get('operator:type') or '').lower()
    out.append({
        'name': name,
        'type': 'private' if op in ('private', 'commercial') else 'public',
        'address': ', '.join(x for x in [street, city] if x),
        'phone': p.get('phone') or p.get('contact:phone') or None,
        'isOpen24h': p.get('opening_hours') == '24/7',
        'coordinates': at,
        'osm': f"{f.get('id', '')}",
    })

out.sort(key=lambda h: (h['address'].split(', ')[-1], h['name']))
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f'{len(out)} hospitals → {OUT}; {sum(1 for h in out if h["phone"])} with a phone number')
