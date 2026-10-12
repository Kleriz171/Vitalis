# The Tirana city story

The website's hero is real central Tirana (OpenStreetMap buildings, streets, parks and the Lana),
rendered in Blender as a 96-frame sequence the page plays as the visitor scrolls. An SOS appears
by the National Gallery, a responder's route draws in from the east, and a second runner detours
past the defibrillator on Skanderbeg Square.

Regenerate it (Blender 5.x, Python 3 with Pillow):

```bash
scripts/city/fetch.sh /tmp/tirana-osm                                   # 1. download the map data
python3 scripts/city/prepare.py /tmp/tirana-osm /tmp/tirana-geo.json    # 2. local metres + street routes
blender -b -P scripts/city/scene.py -- /tmp/tirana-geo.json /tmp/tirana-frames            # 3. render (~4 min on Apple silicon)
python3 scripts/city/encode.py /tmp/tirana-frames                       # 4. WebP frames + label positions into apps/landing
```

- `blender ... --test 70 --size 1000` renders a single frame for checking the look.
- Colours are the brand's; `PAGE` in `scene.py` must equal `page` in `apps/landing/tailwind.config.ts`,
  so the city fades seamlessly into the page.
- The story's timing (SOS at frame 14, responder 28→66, runner 44→88) is mirrored by `BEATS` and
  `LABEL_RANGE` in `apps/landing/src/home/CityStory.tsx`. Change both together.
- Map data © OpenStreetMap contributors (ODbL); the page credits it.
