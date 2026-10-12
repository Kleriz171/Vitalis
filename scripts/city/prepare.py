"""OSM JSON -> local-metre geometry for Blender: buildings, roads, parks, river, responder routes."""
import json, sys, math, heapq, hashlib

SRC, OUT = sys.argv[1], sys.argv[2]
LAT0, LON0 = 41.32750, 19.81870          # Skanderbeg Square
KX, KY = math.cos(math.radians(LAT0)) * 111320, 110540

def xy(lat, lon): return [round((lon - LON0) * KX, 2), round((lat - LAT0) * KY, 2)]

def load(name):
    els = json.load(open(f'{SRC}/{name}.json'))['elements']
    nodes = {e['id']: (e['lat'], e['lon']) for e in els if e['type'] == 'node'}
    ways = {e['id']: e for e in els if e['type'] == 'way'}
    rels = [e for e in els if e['type'] == 'relation']
    return nodes, ways, rels

def ring(nodes, way):
    pts = [xy(*nodes[n]) for n in way['nodes'] if n in nodes]
    if len(pts) > 1 and pts[0] == pts[-1]: pts = pts[:-1]
    return pts

def height(tags, eid, area):
    try:
        if 'height' in tags: return float(str(tags['height']).split()[0])
        if 'building:levels' in tags: return float(tags['building:levels']) * 3.3 + 1
    except ValueError: pass
    r = int(hashlib.md5(str(eid).encode()).hexdigest(), 16) % 1000 / 1000
    lv = (5 + r * 5) if area > 700 else (2 + r * 4)
    return lv * 3.2 + 1

def area(p):
    return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2

out = {'buildings': [], 'roads': [], 'parks': [], 'water': []}

nodes, ways, rels = load('buildings')
used = set()
for r in rels:
    for m in r.get('members', []):
        if m['type'] == 'way' and m.get('role') == 'outer' and m['ref'] in ways:
            p = ring(nodes, ways[m['ref']])
            if len(p) >= 3:
                out['buildings'].append({'p': p, 'h': round(height(r.get('tags', {}), r['id'], area(p)), 1)})
                used.add(m['ref'])
for w in ways.values():
    t = w.get('tags', {})
    if 'building' in t and w['id'] not in used:
        p = ring(nodes, w)
        if len(p) >= 3:
            out['buildings'].append({'p': p, 'h': round(height(t, w['id'], area(p)), 1),
                                     **({'name': t['name']} if 'name' in t else {})})

WIDTH = {'trunk': 16, 'primary': 14, 'secondary': 11, 'tertiary': 9, 'residential': 6,
         'unclassified': 6, 'living_street': 5, 'pedestrian': 6}
rn, rw, _ = load('roads')
graph = {}
for w in rw.values():
    hw = w['tags']['highway']
    ids = [n for n in w['nodes'] if n in rn]
    out['roads'].append({'p': [xy(*rn[n]) for n in ids], 'w': WIDTH.get(hw, 6)})
    for a, b in zip(ids, ids[1:]):
        pa, pb = xy(*rn[a]), xy(*rn[b])
        d = math.dist(pa, pb)
        graph.setdefault(a, []).append((b, d)); graph.setdefault(b, []).append((a, d))

gn, gw, grel = load('green')
for w in gw.values():
    t = w.get('tags', {})
    p = ring(gn, w)
    if 'waterway' in t: out['water'].append({'p': [xy(*gn[n]) for n in w['nodes'] if n in gn], 'w': 12 if t['waterway'] in ('river', 'canal') else 4})
    elif len(p) >= 3: out['parks'].append(p)
for r in grel:
    for m in r.get('members', []):
        if m['type'] == 'way' and m.get('role') == 'outer' and m['ref'] in gw:
            p = ring(gn, gw[m['ref']])
            if len(p) >= 3: out['parks'].append(p)

def nearest(lat, lon):
    t = xy(lat, lon)
    return min(graph, key=lambda n: math.dist(xy(*rn[n]), t))

def route(a, b):
    dist, prev, q = {a: 0}, {}, [(0, a)]
    while q:
        d, u = heapq.heappop(q)
        if u == b: break
        if d > dist[u]: continue
        for v, w in graph[u]:
            if d + w < dist.get(v, 1e18):
                dist[v] = d + w; prev[v] = u; heapq.heappush(q, (d + w, v))
    path = [b]
    while path[-1] != a: path.append(prev[path[-1]])
    return [xy(*rn[n]) for n in reversed(path)], round(dist[b])

SOS = nearest(41.32545, 19.82025)       # Bulevardi Dëshmorët e Kombit, by the National Gallery
R1 = nearest(41.32280, 19.82280)        # responder 1, south across the Lana (stays in frame)
R2 = nearest(41.33030, 19.81150)        # responder 2, north-west
AED = nearest(41.32859, 19.81691)       # public defibrillator on the west side of Skanderbeg Square
r1, d1 = route(R1, SOS)
r2a, d2a = route(R2, AED)
# The street graph reaches the square's corner and then loops round it; walk in from the corner instead.
aed_pt = xy(*rn[AED])
cut = next(i for i, q in enumerate(r2a) if math.dist(q, aed_pt) < 95)
r2a = r2a[:cut + 1] + [aed_pt]
d2a = round(sum(math.dist(a, b) for a, b in zip(r2a, r2a[1:])))
# From the defibrillator a runner cuts straight across the open square and down the boulevard
# (the map has no footpaths across the plaza, so a street route would loop round it).
aed_xy, sos_xy = xy(*rn[AED]), xy(*rn[SOS])
r2b = [aed_xy, [-10, 25], [58, -55], [64, -140], sos_xy]
d2b = round(sum(math.dist(a, b) for a, b in zip(r2b, r2b[1:])))
out['story'] = {'sos': xy(*rn[SOS]), 'aed': xy(*rn[AED]), 'r1': r1, 'r2': r2a + r2b[1:],
                'r2_split': len(r2a) - 1, 'metres': {'r1': d1, 'r2': d2a + d2b}}
json.dump(out, open(OUT, 'w'))
print(len(out['buildings']), 'buildings', len(out['roads']), 'roads', len(out['parks']), 'parks', len(out['water']), 'water')
print('routes metres', out['story']['metres'], 'sos', out['story']['sos'], 'aed', out['story']['aed'])
