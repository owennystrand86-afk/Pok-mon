"""Torture test for the asset pipeline: ONE asset that holds every awkward case, and the ground truth about it.

    /opt/bl/venv/bin/python tools/assettest/torture.py [--preview]
        -> build/torture/out/torture.bpk     (never in models/out: it must not ship)
        -> build/torture/truth.json          (what the game must find, worked out here from Blender's own data)

The truth is computed with code that shares nothing with the exporter (plain matrix_world maths and the
documented axis rule (x, y, z) -> (-x, z, y)), so a mistake in the exporter, the packer or the loader shows.
Layout (Blender axes, metres; the front of the model looks along -Y):
    row y = 0     wedges (mirrored copies) at x = -2..-5, markers at the origin, multi-material cube 2, arm chain 4..5,
                  cylinder 6, half-flat ball 7.5, picture quads 9, tinted plate 11, occlusion plates 13 and 15.5,
                  glass 17, lamp 18.5, glow 19.5
    row y = -1    5 mm cubes, detail-only bits        row y = -2: far-UV strip, coated ball, flag, indoor box
    y = -2.5      the board with an F on it (reads F from the front if nothing is mirrored)
    y = 8         the 40 m slab                       x = -17..-7: the 90 601-vertex sheet
"""
import json, math, os, sys
d = os.path.dirname(os.path.abspath(__file__))
while not os.path.exists(os.path.join(d, 'models', 'lib', 'bpkit.py')):
    d = os.path.dirname(d)
ROOT = d
OUT = os.path.join(ROOT, 'build', 'torture')
sys.path.insert(0, os.path.join(ROOT, 'models', 'lib'))
import bpkit as kit
import bpy
import numpy as np
from mathutils import Matrix, Vector

ASSET = 'torture'
kit.reset()

# ───────────── images ─────────────
atlas = np.zeros((64, 64, 4), np.uint8)
atlas[:32, :32] = (255, 0, 0, 255)          # top left: red, solid
atlas[:32, 32:] = (0, 255, 0, 0)            # top right: green, fully see-through
atlas[32:, :32] = (0, 0, 255, 255)          # bottom left: blue, solid
atlas[32:, 32:] = (255, 255, 0, 128)        # bottom right: yellow, half see-through
kit.image('atlas', atlas)                   # WebP with alpha
sign = np.zeros((16, 32, 3), np.uint8); sign[:, :16] = 255; sign[:8, 16:] = (255, 0, 0)       # left white, top right red, bottom right black
kit.image('signpic', sign, fmt='PNG', wrap='clamp')
chk = np.zeros((16, 16, 3), np.uint8); chk[:8, :8] = 255; chk[8:, 8:] = 255
kit.image('checker', chk, fmt='PNG')

# ───────────── materials ─────────────
red = kit.material('paint_red', '#c0392b', rough=0.3)
white = kit.material('matte_white', '#e0e0e0', rough=0.9)
oak = kit.lib('oak')
steel = kit.lib('steel')
glass = kit.lib('glass')
lamp = kit.material('lamp', '#201a10', rough=0.5, emissive='#ffd27a', emissive_strength=6.0, own=True)
glow = kit.material('glow', '#ff8040', blend='add', alpha=0.6, cast_shadow=False, receive_shadow=False)
leaf = kit.material('leafcut', '#ffffff', rough=0.8, blend='cutout', alpha_test=0.4, double_sided=True, map='atlas')
signm = kit.material('signpaint', '#ffffff', rough=0.7, map='signpic')
tilem = kit.material('tilemap', '#ffffff', rough=0.7, map='checker')
hull = kit.gelcoat('hull', '#e8f0f4')
flagm = kit.fabric('flagcloth', '#1ba3a0', double_sided=True, sway=0.08)
indoor = kit.material('indoor', '#888888', env=0.3, flags=dict(note='hello', n=3))
boltm = kit.material('boltmat', kit.linear(0.6, 0.6, 0.6), rough=0.3, metal=1.0, own=True)
trimm = kit.material('trimmat', '#334455', own=True)
noshadow = kit.material('noshadow', '#808080', cast_shadow=False)
MK = {'o': ('#ff00ff', (0, 0, 0.05)), 'x': ('#ff0000', (1, 0, 0.05)), 'y': ('#00ff00', (0, 1, 0.05)), 'z': ('#0000ff', (0, 0, 1.05))}

# ───────────── objects ─────────────
ANALYTIC = {}
for k, (c, p) in MK.items():
    kit.box('marker_' + k, (0.1, 0.1, 0.1), p, mat=kit.material('mk_' + k, c, rough=0.5))

board = kit.box('fboard', (1.0, 0.04, 1.2), (0, -2.5, 0.6), mat=white)
kit.box('f_stem', (0.12, 0.03, 0.9), (-0.25, -2.535, 0.6), mat=red)
kit.box('f_top', (0.44, 0.03, 0.12), (0.03, -2.535, 0.99), mat=red)
kit.box('f_mid', (0.31, 0.03, 0.12), (-0.035, -2.535, 0.65), mat=red)

multi = kit.box('multi', (0.6, 0.6, 0.6), (2, 0, 0.3), mat=white)
kit.set_material(multi, red, where=lambda c, n: n.z > 0.5)
kit.set_material(multi, steel, where=lambda c, n: abs(n.x) > 0.5)
kit.set_material(multi, oak, where=lambda c, n: abs(n.y) > 0.5)
kit.uv_box(multi)

# a chain of three moving parts, each with its own crooked pivot
arm_box = kit.box('arm_box', (0.5, 0.1, 0.1), (4.2, 0.1, 1.2), rot=(0.1, 0.2, 0.3), mat=red)
fore_box = kit.box('fore_box', (0.4, 0.08, 0.12), (4.7, 0.3, 1.8), rot=(-0.3, 0.5, 0.2), mat=white)
hand_box = kit.box('hand_box', (0.2, 0.15, 0.05), (5.1, 0.25, 2.1), rot=(0.7, -0.2, 1.3), mat=red, bevel=0.005)
p_arm = kit.part('arm', [arm_box], pivot=(4, 0, 1), rot=(0.3, 0.2, 0.5))
p_fore = kit.part('forearm', [fore_box], pivot=(4.5, 0.4, 1.6), rot=(-0.4, 0.7, 1.1), parent_part=p_arm)
p_hand = kit.part('hand', [hand_box], pivot=(5.0, 0.2, 2.0), rot=(1.0, -0.5, 0.25), parent_part=p_fore)

# mirrored things: negative scale on the object, in the root and inside a part
wedge = kit.extrude('wedge', [(0, 0), (0.5, 0), (0.5, 0.2), (0.2, 0.2), (0.2, 0.6), (0, 0.6)], 0.15, mat=oak, loc=(-2, 0, 0))
kit.bevel(wedge, 0.01)
kit.uv_box(wedge)
wedge_neg = kit.duplicate(wedge, 'wedge_neg', loc=(-3, 0, 0)); wedge_neg.scale = (-1, 1, 1)
wedge_part_neg = kit.duplicate(wedge, 'wedge_part_neg', loc=(-4, 0, 0.3)); wedge_part_neg.scale = (1, -1.5, 1); wedge_part_neg.rotation_euler = (0.3, 0.1, 0.2)
p_flip = kit.part('flipper', [wedge_part_neg], pivot=(-4, 0, 0.3), rot=(0.2, 0.4, 0.6))
ball_neg = kit.sphere('ball_neg', 0.25, (-5, 0, 0.3), mat=red, segments=16, rings=8); ball_neg.scale = (-1, 1, 1)
ANALYTIC['ball_neg'] = dict(kind='convex', centre=[-5, 0, 0.3])
ANALYTIC['multi'] = dict(kind='convex', centre=[2, 0, 0.3])

# more than 65 536 vertices in one object: a wavy sheet of 301 x 301 points
DN = 300
def dense_fn(u, v):
    return -17 + 10 * u, -5 + 10 * v, 0.6 + 0.3 * np.sin(6 * u) * np.cos(5 * v)
dense = kit.surface('dense', dense_fn, DN, DN, mat=oak, smooth=180)
ANALYTIC['dense'] = dict(kind='sheet', x0=-17, y0=-5, size=10, z0=0.6, amp=0.3, fu=6, fv=5, n=DN)

# UVs far outside 0..1 on a tiling picture
uvfar = kit.mesh_object('uvfar', [(8.0 + 0.25 * i, -2.25 + 0.5 * j, 0.5) for j in range(2) for i in range(9)],
                        [(i, i + 1, i + 10, i + 9) for i in range(8)], mat=tilem,
                        uvs=[uv for i in range(8) for uv in ((-250.0 + 62.5 * i, -40.25), (-250.0 + 62.5 * (i + 1), -40.25), (-250.0 + 62.5 * (i + 1), 59.75), (-250.0 + 62.5 * i, 59.75))])

# vertex tints
tintplate = kit.surface('tintplate', lambda u, v: (10.5 + u, -0.5 + v, 0.5 + 0 * u), 8, 8, mat=white)
kit.tint(tintplate, fn=lambda P, N: np.stack([P[:, 0] - 10.5, P[:, 1] + 0.5, np.full(len(P), 0.5)], axis=1))
ANALYTIC['tintplate'] = dict(kind='tint', x0=10.5, y0=-0.5, base=kit.mat_def(white)['color'])

# quantisation: 5 mm things in a 40 m model
tiny = kit.box('tiny', (0.005, 0.005, 0.005), (0.5, -1, 0.0025), mat=red)
speck = kit.box('speck', (0.005, 0.005, 0.005), (0.7, -1, 0.0025), mat=red)
p_speck = kit.part('speck', [speck], pivot=(0.7, -1, 0.0025), rot=(0.5, 0.5, 0.5))      # the part is called like its mesh
big = kit.box('big', (40, 3, 0.2), (0, 8, 0.1), mat=oak)
kit.uv_box(big)

# smooth and flat shading mixed
cyl = kit.cylinder('cyl', 0.3, 1.0, (6, 0, 0.5), mat=steel, verts=32)
kit.uv_tube(cyl, 'z')
ANALYTIC['cyl'] = dict(kind='cylinder', centre=[6, 0, 0.5], radius=0.3, half=0.5)
halfball = kit.sphere('halfball', 0.4, (7.5, 0, 0.5), mat=red, segments=24, rings=12)
for p in halfball.data.polygons:
    p.use_smooth = p.center.z < 0
ANALYTIC['halfball'] = dict(kind='halfball', centre=[7.5, 0, 0.5], radius=0.4)

# embedded pictures: a cut-out one with alpha, a clamped opaque one
leafquad = kit.mesh_object('leafquad', [(8.5, 0, 0.5), (9.5, 0, 0.5), (9.5, 0, 1.5), (8.5, 0, 1.5)], [(0, 1, 2, 3)], mat=leaf, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
signquad = kit.mesh_object('signquad', [(8.5, 0.5, 0.5), (9.5, 0.5, 0.5), (9.5, 0.5, 1.0), (8.5, 0.5, 1.0)], [(0, 1, 2, 3)], mat=signm, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])

# occlusion plates: the left half open (1.0), the right half a deep crease (0.25); one in the sun, one under a roof
def ao_plate(name, x):
    return kit.mesh_object(name, [(x - 0.5, -0.25, 0.3), (x, -0.25, 0.3), (x + 0.5, -0.25, 0.3), (x - 0.5, 0.25, 0.3), (x, 0.25, 0.3), (x + 0.5, 0.25, 0.3)],
                           [(0, 1, 4, 3), (1, 2, 5, 4)], mat=white)
ao_sun = ao_plate('aoplate_sun', 13.0)
ao_shade = ao_plate('aoplate_shade', 15.5)
roof = kit.box('roof', (2.4, 2.4, 0.05), (15.5, 0, 0.9), mat=white)

# see-through, emissive, additive, clear-coated, wind-moved, indoor
pane = kit.box('pane', (1.0, 0.01, 1.0), (17, 0, 0.6), mat=glass)
bulb = kit.sphere('bulb', 0.15, (18.5, 0, 0.5), mat=lamp, segments=16, rings=8)
glowquad = kit.mesh_object('glowquad', [(19.25, 0, 0.25), (19.75, 0, 0.25), (19.75, 0, 0.75), (19.25, 0, 0.75)], [(0, 1, 2, 3)], mat=glow)
coatball = kit.sphere('coatball', 0.3, (-2, -2, 0.3), mat=hull, segments=24, rings=12)
flag = kit.surface('flag', lambda u, v: (-4.6 + 1.2 * u, -2 + 0 * u, 1.0 + 0.8 * v), 12, 8, mat=flagm)
kit.set_pbr(flag, fn=lambda P, N: dict(weight=np.clip((P[:, 0] + 4.6) / 1.2, 0, 1)))
inbox = kit.box('inbox', (0.4, 0.4, 0.4), (-5.5, -2, 0.2), mat=indoor)
nsbox = kit.box('nsbox', (0.4, 0.4, 0.4), (-6.3, -2, 0.2), mat=noshadow)

# things that exist only in the finer levels of detail
bolt = kit.rivet('bolt_only0', (3, -1, 0), (0, 0, 1), 0.02, mat=boltm)
trim = kit.box('trim_only1', (0.2, 0.2, 0.1), (3.5, -1, 0.05), mat=trimm)
kit.detail_only(bolt, upto=0)
kit.detail_only(trim, upto=1)

# ───────────── ambient occlusion: baked for three objects, written by hand for the rest ─────────────
kit.bake_ao([multi, cyl, halfball], ground=0.0, samples=16)
objs = kit.export_objects()
kit.ensure_layers(objs)
for o in objs:
    if kit._get_layer(o.data, 'bpk_ao') is None:
        kit._set_layer(o.data, 'bpk_ao', np.ones((len(o.data.loops), 4), np.float32))
for o in (ao_sun, ao_shade):
    a = np.ones((len(o.data.loops), 4), np.float32)
    a[kit._face_of_loop(o.data) == 1, :3] = 0.25
    kit._set_layer(o.data, 'bpk_ao', a)
shadow = kit.ground_shadow([multi, cyl, halfball], z=0.0, cell=0.15, samples=16)

# ───────────── anchors ─────────────
kit.anchor('seat', (2, -1, 0.5), rot=(0.1, 0.2, 0.3), kind='sit', pitch=0.02, tags=['a', 'b'], offset=[1, 2.5, -3], nested=dict(k=1))
kit.anchor('tip', (5.2, 0.3, 2.2), rot=(0.4, 0.8, -0.6), parent_part=p_hand, power=5)
kit.anchor('multi', (2, 0, 0.6))            # called like a mesh object
kit.anchor('plain', (1, 2, 3))

# ───────────── the truth, from Blender's own data ─────────────
kit.ensure_layers(kit.export_objects())
bpy.context.view_layer.update()
A3 = lambda v: [-float(v[0]), float(v[2]), float(v[1])]                 # Blender -> game
AX = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def game_matrix(m):
    g = AX @ m @ AX.inverted()
    return [float(g[r][c]) for r in range(4) for c in range(4)]         # row by row


def node_name(o):
    p = o.parent
    while p is not None and not p.get('bpk_part'):
        p = p.parent
    return p['bpk_name'] if p is not None else ASSET


def corners(o, limit=64):
    me = o.data; nl = len(me.loops)
    M = o.matrix_world; N3 = M.to_3x3().inverted().transposed()
    defs = [kit.mat_def(m) for m in me.materials] or [kit.mat_def(None)]
    col = kit._get_layer(me, 'Col'); pbr = kit._get_layer(me, 'bpk_pbr'); ao = kit._get_layer(me, 'bpk_ao')
    fol = kit._face_of_loop(me)
    uvl = me.uv_layers.active
    out = []
    for li in sorted(set(np.linspace(0, nl - 1, min(limit, nl)).astype(int).tolist())):
        dd = defs[min(me.polygons[int(fol[li])].material_index, len(defs) - 1)]
        pw = M @ me.vertices[me.loops[li].vertex_index].co
        nw = (N3 @ Vector(me.corner_normals[li].vector)).normalized()
        e = dict(p=A3(pw), n=A3(nw), mat=dd['name'], col=[float(dd['color'][k] * col[li][k]) for k in range(3)], a=float(dd['alpha'] * col[li][3]),
                 rough=float(pbr[li][0]), metal=float(pbr[li][1]), weight=float(pbr[li][2]), ao=float(ao[li][0]) if ao is not None else 1.0)
        if uvl is not None:
            e['uv'] = [float(x) for x in uvl.data[li].uv]
        out.append(e)
    return out


T = dict(asset=ASSET, objects={}, nodes={}, anchors={}, materials={}, images={}, markers={}, analytic={})
lo = np.full(3, 1e30); hi = np.full(3, -1e30)
for o in kit.export_objects():
    me = o.data
    W = np.array([A3(o.matrix_world @ v.co) for v in me.vertices]) if len(me.vertices) < 5000 else None
    if W is None:                               # the big ones: numpy
        co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co)
        Mw = np.array(o.matrix_world, np.float64); Pw = co.reshape(-1, 3).astype(np.float64) @ Mw[:3, :3].T + Mw[:3, 3]
        W = np.stack([-Pw[:, 0], Pw[:, 2], Pw[:, 1]], axis=1)
    if not o.get('bpk_shadow'):
        lo = np.minimum(lo, W.min(0)); hi = np.maximum(hi, W.max(0))
    T['objects'][o.name] = dict(node=node_name(o), tris=kit.tri_count([o]), verts=len(me.vertices), loops=len(me.loops),
                                bbox=[W.min(0).tolist(), W.max(0).tolist()], lod_max=int(o.get('bpk_lod_max', 99)), shadow=bool(o.get('bpk_shadow')),
                                negative=o.matrix_world.determinant() < 0, corners=corners(o),
                                all_verts=W.tolist() if len(W) <= 64 else None)
T['bbox'] = [lo.tolist(), hi.tolist()]
for o in bpy.context.scene.objects:
    if o.get('bpk_part'):
        par = o.parent
        while par is not None and not par.get('bpk_part'):
            par = par.parent
        T['nodes'][o['bpk_name']] = dict(parent=par['bpk_name'] if par is not None else ASSET, world=game_matrix(o.matrix_world))
    if 'bpk_anchor' in o:
        g = AX @ o.matrix_world @ AX.inverted()
        q = g.to_quaternion()
        T['anchors'][o['bpk_name']] = dict(node=node_name(o), pos=[float(x) for x in g.translation], quat=[q.x, q.y, q.z, q.w], data=json.loads(o['bpk_anchor']))
for m in bpy.data.materials:
    if 'bpk' in m:
        T['materials'][m.name] = json.loads(m['bpk'])
T['images'] = dict(atlas=dict(w=64, h=64, alpha=True, texels=[[16, 16, 255, 0, 0, 255], [48, 16, None, None, None, 0], [16, 48, 0, 0, 255, 255], [48, 48, 255, 255, 0, 128]]),
                   signpic=dict(w=32, h=16, alpha=False, wrap='clamp', texels=[[8, 8, 255, 255, 255, 255], [24, 4, 255, 0, 0, 255], [24, 12, 0, 0, 0, 255]]),
                   checker=dict(w=16, h=16, alpha=False, wrap='repeat', texels=[[4, 4, 255, 255, 255, 255], [12, 4, 0, 0, 0, 255]]))
for k, (c, p) in MK.items():
    T['markers'][k] = dict(blender=list(p), color=list(kit.rgb(c)))
for k, a in ANALYTIC.items():
    a = dict(a)
    if 'centre' in a:
        a['centre'] = A3(a['centre'])
    T['analytic'][k] = a
T['detail_tiles'] = {k: list(v) for k, v in kit.bptex.TILE_M.items()}
T['meta'] = dict(kind='test', numbers=[1, 2, 3], nested=dict(a=True, s='text'))
T['lods'] = [[0.25, 12.0], [0.06, 40.0]]

# ───────────── export ─────────────
stats = kit.export_bpk(ASSET, lods=T['lods'], meta=T['meta'], out_dir=os.path.join(OUT, 'out'))
T['stats'] = {k: v for k, v in stats.items() if k != 'path'}
T['tris_total'] = sum(o['tris'] for o in T['objects'].values())
with open(os.path.join(OUT, 'truth.json'), 'w') as f:
    json.dump(T, f)
print('truth: %d objects, %d triangles, %d parts, %d anchors -> build/torture/truth.json' % (len(T['objects']), T['tris_total'], len(T['nodes']), len(T['anchors'])))

if '--preview' in sys.argv:
    near = [o for o in kit.export_objects() if o.name not in ('big', 'dense')]
    kit.preview('torture', views=('front', 'hero'), objects=near, size=(800, 450), samples=8, out_dir=os.path.join(OUT, 'preview'),
                closeups={'fboard': ((0, -2.5, 0.6), 0.9, 0, 5), 'leaf': ((9, 0, 1.0), 0.8, 0, 5)})
