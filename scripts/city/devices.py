"""Product renders for the website: two phones and two watches showing the real app screens.

blender -b -P devices.py -- <out_dir> <public_dir> [--test] [--lang en|sq]

Reads the screenshots from <public_dir>/screens/<lang>/ and <public_dir>/watch-*.png and writes
transparent PNGs (soft contact shadows included) to <out_dir>: phones-<lang>.png, watches.png.
Units are millimetres.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
OUT, PUB = argv[0], argv[1]
TEST = '--test' in argv
LANGS = [argv[argv.index('--lang') + 1]] if '--lang' in argv else ['en', 'sq']
os.makedirs(OUT, exist_ok=True)


def hexrgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.samples = 24 if TEST else 160
    s.cycles.use_denoising = True
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.refresh_devices()
    for d in prefs.devices: d.use = d.type != 'CPU'
    s.cycles.device = 'GPU'
    s.render.film_transparent = True
    s.render.image_settings.file_format = 'PNG'; s.render.image_settings.color_mode = 'RGBA'
    s.view_settings.view_transform = 'Standard'   # screens keep their exact colours
    s.unit_settings.scale_length = 0.001
    w = bpy.data.worlds.new('w'); s.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = hexrgb('#DCE9E6'); bg.inputs['Strength'].default_value = 0.45
    return s


def rounded_rect(w, h, r, seg=12):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, w, h, r, depth, mat, bevel=0.0, z=0.0):
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new((x, y, z)) for x, y in rounded_rect(w, h, r)])
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)], vec=(0, 0, depth))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    if bevel:
        m = ob.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 6; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(60)
        ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    return ob


def disc(name, radius, depth, mat, bevel=0.0, z=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=96, radius1=radius, radius2=radius, depth=depth)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, z + depth / 2))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    if bevel:
        m = ob.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = 6; m.limit_method = 'ANGLE'
        ob.modifiers.new('wn', 'WEIGHTED_NORMAL')
    return ob


def metal(name, color, rough=0.32):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexrgb(color); b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = rough
    return m


def matte(name, color, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexrgb(color); b.inputs['Roughness'].default_value = rough
    return m


def screen_mat(name, image_path):
    """The screen glows with the screenshot under a glossy glass coat."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(image_path)
    tex.extension = 'CLIP'
    b.inputs['Base Color'].default_value = (0, 0, 0, 1); b.inputs['Roughness'].default_value = 0.08
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 1.0
    b.inputs['Coat Weight'].default_value = 1.0; b.inputs['Coat Roughness'].default_value = 0.03
    return m


def textured_face(ob, w, h, z, mat, round_screen=False):
    """A flat face carrying the screenshot, UV-mapped to its bounding box."""
    bm = bmesh.new()
    pts = [(w / 2 * math.cos(a), h / 2 * math.sin(a)) for a in [i * 2 * math.pi / 128 for i in range(128)]] if round_screen else rounded_rect(w, h, min(w, h) * 0.13)
    f = bm.faces.new([bm.verts.new((x, y, z)) for x, y in pts])
    uv = bm.loops.layers.uv.new()
    for loop in f.loops:
        loop[uv].uv = (loop.vert.co.x / w + 0.5, loop.vert.co.y / h + 0.5)
    me = bpy.data.meshes.new(ob + '-screen'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(ob + '-screen', me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    return o


def group(name, objs, loc, rot):
    root = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(root)
    for o in objs: o.parent = root
    root.location = loc; root.rotation_euler = [math.radians(a) for a in rot]
    return root


def phone(name, image, loc, rot):
    W, H, R, D = 70.6, 147.0, 10.5, 8.0
    frame = slab(name + '-frame', W, H, R, D, metal(name + '-ti', '#3B4245', 0.28), bevel=1.6)
    back = slab(name + '-glass', W - 1.4, H - 1.4, R - 0.7, 0.4, matte(name + '-back', '#1C2224', 0.25), z=D - 0.2)
    sw, sh = 66.0, 66.0 * 1688 / 780
    scr = textured_face(name, sw, sh, D + 0.25, screen_mat(name + '-screen-m', image))
    scr.scale = (1, 1, 1)
    btn = slab(name + '-btn', 1.2, 16, 0.6, 2.0, metal(name + '-btnm', '#3B4245'))
    btn.rotation_euler = (0, math.radians(90), 0); btn.location = (W / 2 + 0.4, 24, D / 2)
    return group(name, [frame, back, scr, btn], loc, rot)


def strap(name, w, length, thick, mat, y_sign):
    """A strap leaving the case and curving away behind it."""
    bm = bmesh.new()
    steps, prev = 24, None
    for i in range(steps + 1):
        t = i / steps
        ang = t * math.radians(110)
        y = y_sign * (length * 0.35 * math.sin(ang) + 1.5)
        z = -length * 0.35 * (1 - math.cos(ang))
        row = [bm.verts.new((x, y, z)) for x in (-w / 2, w / 2)] + [bm.verts.new((x, y, z - thick)) for x in (w / 2, -w / 2)]
        if prev:
            for k in range(4): bm.faces.new([prev[k], prev[(k + 1) % 4], row[(k + 1) % 4], row[k]])
        prev = row
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    ob.modifiers.new('sub', 'SUBSURF').levels = 2
    return ob


def apple_watch(loc, rot):
    W, H, R, D = 44.0, 49.0, 10.5, 12.0
    case = slab('aw-case', W, H, R, D, metal('aw-ti', '#8D9496', 0.3), bevel=2.2)
    sw, sh = 38.0, 38.0 * 514 / 422
    scr = textured_face('aw', sw, sh, D + 0.2, screen_mat('aw-screen', os.path.join(PUB, 'watch-apple.png')))
    crown = disc('aw-crown', 3.6, 3.2, metal('aw-crownm', '#7E8587', 0.35), bevel=0.5)
    crown.rotation_euler = (0, math.radians(90), 0); crown.location = (W / 2 + 0.2, 8, D / 2)
    band = matte('aw-band', '#0E8B7F', 0.75)
    s1 = strap('aw-strap1', 34, 70, 3.2, band, 1); s1.location.y = H / 2 - 2; s1.location.z = D / 2 + 1.5
    s2 = strap('aw-strap2', 34, 70, 3.2, band, -1); s2.location.y = -H / 2 + 2; s2.location.z = D / 2 + 1.5
    return group('apple', [case, scr, crown, s1, s2], loc, rot)


def wear_watch(loc, rot):
    R, D = 23.0, 12.0
    case = disc('ww-case', R, D, metal('ww-steel', '#2E3436', 0.3), bevel=2.0)
    bezel = disc('ww-bezel', R - 1.2, 0.6, matte('ww-bez', '#0B0F10', 0.3), z=D - 0.1)
    scr = textured_face('ww', 2 * (R - 3.2), 2 * (R - 3.2), D + 0.6, screen_mat('ww-screen', os.path.join(PUB, 'watch-wear.png')), round_screen=True)
    crown = disc('ww-crown', 3.2, 3.6, metal('ww-crownm', '#2E3436', 0.35), bevel=0.4)
    crown.rotation_euler = (0, math.radians(90), 0); crown.location = (R + 0.6, 0, D / 2)
    band = matte('ww-band', '#0C5D57', 0.75)
    s1 = strap('ww-strap1', 24, 70, 3.2, band, 1); s1.location.y = R - 4; s1.location.z = D / 2 + 1.5
    s2 = strap('ww-strap2', 24, 70, 3.2, band, -1); s2.location.y = -R + 4; s2.location.z = D / 2 + 1.5
    return group('wear', [case, bezel, scr, crown, s1, s2], loc, rot)


def stage(cam_loc, target, lens, res):
    s = bpy.context.scene
    # Shadow catcher: the transparent PNG keeps only the soft shadow on the floor.
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=600)
    me = bpy.data.meshes.new('floor'); bm.to_mesh(me); bm.free()
    floor = bpy.data.objects.new('floor', me); s.collection.objects.link(floor); floor.is_shadow_catcher = True
    floor.location.z = -0.5
    for name, loc, energy, size, color in (('key', (-260, -200, 420), 4.5e6, 260, '#FFF4EA'), ('rim', (320, 260, 260), 2.2e6, 180, '#BFEDE4'), ('fill', (300, -320, 160), 9e5, 300, '#FFFFFF')):
        L = bpy.data.lights.new(name, 'AREA'); L.energy = energy; L.size = size; L.color = hexrgb(color)[:3]
        o = bpy.data.objects.new(name, L); o.location = loc; s.collection.objects.link(o)
        t = o.constraints.new('TRACK_TO'); t.target = target; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); s.collection.objects.link(cam)
    cam.data.lens = lens; cam.data.clip_start = 1; cam.data.clip_end = 5000; cam.location = cam_loc
    t = cam.constraints.new('TRACK_TO'); t.target = target; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
    s.camera = cam
    s.render.resolution_x, s.render.resolution_y = res
    s.render.resolution_percentage = 35 if TEST else 100


for lang in LANGS:
    reset()
    a = phone('caller', os.path.join(PUB, 'screens', lang, 'emergency.webp'), (-41, 10, 62), (52, 0, 9))
    b = phone('responder', os.path.join(PUB, 'screens', lang, 'responder.webp'), (41, -16, 58), (50, 0, -9))
    tgt = bpy.data.objects.new('t', None); bpy.context.scene.collection.objects.link(tgt); tgt.location = (0, -4, 60)
    stage((30, -420, 250), tgt, 66, (1800, 1800))
    bpy.context.scene.render.filepath = os.path.join(OUT, f'phones-{lang}.png')
    bpy.ops.render.render(write_still=True)

if '--phones' not in argv:
  reset()
  apple_watch((-30, 4, 26), (38, 0, 8))
  wear_watch((32, -6, 24), (36, 0, -10))
  tgt = bpy.data.objects.new('t', None); bpy.context.scene.collection.objects.link(tgt); tgt.location = (0, 0, 24)
  stage((10, -330, 200), tgt, 72, (1800, 1300))
  bpy.context.scene.render.filepath = os.path.join(OUT, 'watches.png')
  bpy.ops.render.render(write_still=True)
