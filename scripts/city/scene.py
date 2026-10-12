"""Builds the Tirana scene from tirana-geo.json (prepare.py) and renders the website's scroll-story frames.

blender -b -P scene.py -- <geo.json> <out_dir> [--test FRAME] [--size PX] [--engine EEVEE|CYCLES]
"""
import bpy, bmesh, json, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
GEO, OUT = argv[0], argv[1]
TEST = int(argv[argv.index('--test') + 1]) if '--test' in argv else None
SIZE = int(argv[argv.index('--size') + 1]) if '--size' in argv else 1600   # width; frames are 16:10
ENGINE = argv[argv.index('--engine') + 1] if '--engine' in argv else 'EEVEE'
FRAMES = 96
RADIUS = 820          # the city fades into the page colour beyond this

geo = json.load(open(GEO))
story = geo['story']


def hexrgb(h, a=1.0):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)


PAGE = '#073F3A'      # page background the frames sit on (deep green)
GROUND = '#0E7C71'
ROAD = '#2A9488'
PARK = '#1B8A6E'
WATER = '#0A4E5A'
CLAY = '#FBFBF8'
SOS = '#E14545'
R1 = '#FFFFFF'
R2 = '#FFC24B'


# ---------- reset ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, FRAMES


def material(name, color, rough=0.6, emission=None, strength=0.0, fade=True, alpha=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hexrgb(color)
    bsdf.inputs['Roughness'].default_value = rough
    if emission:
        bsdf.inputs['Emission Color'].default_value = hexrgb(emission)
        bsdf.inputs['Emission Strength'].default_value = strength
    out = nt.nodes['Material Output']
    if fade:
        # Distance from the centre on the ground plane -> mix toward the page colour.
        geo_n = nt.nodes.new('ShaderNodeNewGeometry')
        sep = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(geo_n.outputs['Position'], sep.inputs[0])
        comb = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(sep.outputs['X'], comb.inputs['X'])
        nt.links.new(sep.outputs['Y'], comb.inputs['Y'])
        length = nt.nodes.new('ShaderNodeVectorMath'); length.operation = 'LENGTH'
        nt.links.new(comb.outputs[0], length.inputs[0])
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = RADIUS * 0.55
        mr.inputs['From Max'].default_value = RADIUS
        nt.links.new(length.outputs['Value'], mr.inputs['Value'])
        bg = nt.nodes.new('ShaderNodeEmission')
        bg.inputs['Color'].default_value = hexrgb(PAGE)
        bg.inputs['Strength'].default_value = 1.0
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(mr.outputs['Result'], mix.inputs['Fac'])
        nt.links.new(bsdf.outputs['BSDF'], mix.inputs[1])
        nt.links.new(bg.outputs['Emission'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
    if alpha is not None:
        bsdf.inputs['Alpha'].default_value = alpha
        try: m.surface_render_method = 'BLENDED'
        except AttributeError: m.blend_method = 'BLEND'
    return m


def mesh_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def inside(p, r=RADIUS + 40):
    return p[0] * p[0] + p[1] * p[1] < r * r


# ---------- ground ----------
bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, radius=RADIUS + 400, segments=96)
mesh_object('ground', bm, material('ground', GROUND, rough=0.9))


def ribbons(name, lines, mat, z):
    bm = bmesh.new()
    for line in lines:
        pts, w = line['p'], line['w']
        for a, b in zip(pts, pts[1:]):
            if not (inside(a) or inside(b)): continue
            a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
            d = b - a
            if d.length < 0.01: continue
            n = Vector((-d.y, d.x, 0)).normalized() * (w / 2)
            vs = [bm.verts.new((v.x, v.y, z)) for v in (a + n, b + n, b - n, a - n)]
            bm.faces.new(vs)
            # round joint
            c = bmesh.ops.create_circle(bm, cap_ends=True, radius=w / 2, segments=8)
            bmesh.ops.translate(bm, verts=c['verts'], vec=(b.x, b.y, z))
    return mesh_object(name, bm, mat)


def polygons(name, polys, mat, z):
    bm = bmesh.new()
    for p in polys:
        if not any(inside(q) for q in p): continue
        try: bm.faces.new([bm.verts.new((q[0], q[1], z)) for q in p])
        except ValueError: pass
    return mesh_object(name, bm, mat)


polygons('parks', geo['parks'], material('park', PARK, rough=0.95), 0.05)
ribbons('roads', geo['roads'], material('road', ROAD, rough=0.85), 0.08)
ribbons('water', geo['water'], material('water', WATER, rough=0.25), 0.11)

# ---------- buildings ----------
bm = bmesh.new()
for b in geo['buildings']:
    p = b['p']
    if not any(inside(q) for q in p): continue
    try:
        f = bm.faces.new([bm.verts.new((q[0], q[1], 0.1)) for q in p])
    except ValueError:
        continue
    if f.normal.z < 0: f.normal_flip()
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    top = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top, vec=(0, 0, b['h']))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
mesh_object('buildings', bm, material('clay', CLAY, rough=0.7))


# ---------- story ----------
def keys(target, path, pairs, index=-1):
    for frame, value in pairs:
        if index >= 0: getattr(target, path)[index] = value
        else: setattr(target, path, value)
        target.keyframe_insert(path, frame=frame, index=index)


def route(name, pts, color, start, end, z=4.0):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, q in enumerate(pts): sp.points[i].co = (q[0], q[1], z, 1)
    cu.bevel_depth = 4.5; cu.bevel_resolution = 4; cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu); scene.collection.objects.link(ob)
    cu.materials.append(material(name + '-m', color, emission=color, strength=1.6, fade=False))
    keys(cu, 'bevel_factor_end', [(1, 0.0), (start, 0.0), (end, 1.0)])
    # the runner: a bright dot at the head of the line
    dot = bpy.data.objects.new(name + '-dot', bpy.data.meshes.new(name + '-dot'))
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=11)
    bm.to_mesh(dot.data); bm.free(); scene.collection.objects.link(dot)
    dot.data.materials.append(material(name + '-dm', color, emission=color, strength=2.2, fade=False))
    c = dot.constraints.new('FOLLOW_PATH'); c.target = ob; c.use_fixed_location = True
    keys(c, 'offset_factor', [(1, 0.0), (start, 0.0), (end, 1.0)])
    keys(dot, 'scale', [(start - 1, (0, 0, 0)), (start, (1, 1, 1))], -1)
    return ob


sx, sy = story['sos']
# pin
pin = bpy.data.objects.new('sos-pin', bpy.data.meshes.new('sos-pin'))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.0, radius2=9, depth=26)
bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 13))
sph = bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=9)
bmesh.ops.translate(bm, verts=sph['verts'], vec=(0, 0, 28))
bm.to_mesh(pin.data); bm.free(); scene.collection.objects.link(pin)
pin.location = (sx, sy, 0)
pin.data.materials.append(material('sos-m', SOS, emission=SOS, strength=1.4, fade=False))
keys(pin, 'scale', [(1, (0, 0, 0)), (14, (0, 0, 0)), (20, (1, 1, 1))])

# pulse rings on the ground: three discs expanding and fading, staggered
for i in range(3):
    ring = bpy.data.objects.new(f'pulse{i}', bpy.data.meshes.new(f'pulse{i}'))
    bm = bmesh.new()
    outer = bmesh.ops.create_circle(bm, cap_ends=False, radius=1.0, segments=64)['verts']
    inner = bmesh.ops.create_circle(bm, cap_ends=False, radius=0.86, segments=64)['verts']
    for k in range(64):
        bm.faces.new([outer[k], outer[(k + 1) % 64], inner[(k + 1) % 64], inner[k]])
    bm.to_mesh(ring.data); bm.free(); scene.collection.objects.link(ring)
    ring.location = (sx, sy, 0.6)
    m = material(f'pulse{i}-m', SOS, emission=SOS, strength=1.6, fade=False, alpha=1.0)
    ring.data.materials.append(m)
    alpha = m.node_tree.nodes['Principled BSDF'].inputs['Alpha']
    period, offset = 24, i * 8
    for f in range(14 + offset, FRAMES + 1, period):
        ring.scale = (0.01, 0.01, 1); ring.keyframe_insert('scale', frame=f)
        alpha.default_value = 0.0; alpha.keyframe_insert('default_value', frame=f - 1)
        alpha.default_value = 0.9; alpha.keyframe_insert('default_value', frame=f)
        ring.scale = (120, 120, 1); ring.keyframe_insert('scale', frame=f + period - 1)
        alpha.default_value = 0.0; alpha.keyframe_insert('default_value', frame=f + period - 1)
    if ring.animation_data is None:
        ring.scale = (0, 0, 1)

# defibrillator marker: a white tower with a red heart-ish cap, appears as runner 2 approaches
ax, ay = story['aed']
aed = bpy.data.objects.new('aed', bpy.data.meshes.new('aed'))
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.scale(bm, vec=(20, 20, 34), verts=bm.verts)
bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 17))
bm.to_mesh(aed.data); bm.free(); scene.collection.objects.link(aed)
aed.location = (ax, ay, 0)
aed.data.materials.append(material('aed-m', R2, emission=R2, strength=1.6, fade=False))
keys(aed, 'scale', [(1, (0, 0, 0)), (44, (0, 0, 0)), (50, (1, 1, 1))])

# routes: responder 1 draws 28->66, runner 2 draws 44->88 (via the defibrillator)
route('r1', story['r1'], R1, 28, 66)
route('r2', story['r2'], R2, 44, 88)

# ---------- camera ----------
cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 40; cam_data.clip_start = 5; cam_data.clip_end = 20000
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
target = bpy.data.objects.new('target', None); scene.collection.objects.link(target)
tc = cam.constraints.new('TRACK_TO'); tc.target = target; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
mid = ((sx + ax) / 2, (sy + ay) / 2)
# wide establishing -> settle over the story -> close on the patient
keys(cam, 'location', [(1, (-600, -1400, 1600)), (30, (-420, -1150, 1200)), (66, (-280, -980, 960)), (FRAMES, (sx - 140, sy - 680, 720))])
keys(target, 'location', [(1, (-260, 60, 0)), (30, (mid[0] - 230, mid[1] - 10, 0)), (66, (mid[0] - 200, mid[1] - 30, 0)), (FRAMES, (sx - 150, sy + 20, 0))])
for ob in (cam, target):
    for fc in ob.animation_data.action.fcurves if hasattr(ob.animation_data.action, 'fcurves') else []:
        for k in fc.keyframe_points: k.interpolation = 'BEZIER'; k.easing = 'AUTO'

# ---------- light & world ----------
world = bpy.data.worlds.new('world'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = hexrgb(PAGE)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.4; sun.data.color = hexrgb('#FFF1E2')[:3]; sun.data.angle = math.radians(3)
sun.rotation_euler = (math.radians(62), 0, math.radians(-38))
scene.collection.objects.link(sun)
fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN'))
fill.data.energy = 0.7; fill.data.color = hexrgb('#9FE3D8')[:3]
fill.rotation_euler = (math.radians(50), 0, math.radians(150))
scene.collection.objects.link(fill)

# ---------- render ----------
r = scene.render
r.resolution_x, r.resolution_y = SIZE, SIZE * 10 // 16
r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'
r.film_transparent = False
if ENGINE == 'CYCLES':
    r.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
else:
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try: r.engine = eng; break
        except TypeError: pass
    ee = scene.eevee
    for attr, val in (('taa_render_samples', 48), ('use_shadows', True), ('use_raytracing', True),
                      ('use_gtao', True), ('use_bloom', True), ('shadow_ray_count', 2)):
        if hasattr(ee, attr): setattr(ee, attr, val)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

# Where the story's points land on screen in every frame, for the page's HTML labels.
from bpy_extras.object_utils import world_to_camera_view
deps = bpy.context.evaluated_depsgraph_get()
track = {'sos': pin, 'aed': aed, 'r1': bpy.data.objects['r1-dot'], 'r2': bpy.data.objects['r2-dot']}
labels = []
for f in range(1, FRAMES + 1):
    scene.frame_set(f)
    row = {}
    for k, ob in track.items():
        w = ob.matrix_world.translation.copy()
        if k in ('sos', 'aed'): w.z += 40 if k == 'sos' else 38
        v = world_to_camera_view(scene, cam, w)
        row[k] = [round(v.x, 4), round(1 - v.y, 4), round(max(ob.scale), 2)]
    labels.append(row)
json.dump(labels, open(f'{OUT}/labels.json', 'w'))

if TEST:
    scene.frame_set(TEST)
    r.filepath = f'{OUT}/test-{TEST:03d}.png'
    bpy.ops.render.render(write_still=True)
else:
    r.filepath = f'{OUT}/frame-'
    bpy.ops.render.render(animation=True)
