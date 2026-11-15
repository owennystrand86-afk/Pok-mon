"""The wooden sun lounger on the main beach (src/50-props.js puts two of them under the umbrella).

A teak steamer lounger the way they are built: two long rails on front legs and a pair of wheels, a slatted bed,
a slatted backrest hinged between the rails and held up by a prop that drops into a notched rack, bolted with
stainless carriage bolts. A striped beach towel lies on it (its coloured stripes are the material 'towel',
which the game tints: teal on one lounger, coral on the other).

In the game: the foot end points to -Z (the sitter looks that way), the ground is y = 0, the origin is on the
ground under the middle of the bed. Moving parts: 'backrest' (hinge), 'prop' (inside backrest), 'wheels' (axle).
Anchors: 'seat' (where the eyes of someone lying on it are, looking down the lounger), 'stand' (where to stand up).

    /opt/bl/venv/bin/python models/lounger.py       -> models/out/lounger.bpk, build/preview/lounger_*.png
"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import bpkit as kit
import numpy as np
from mathutils import Matrix, Vector

kit.reset()
rng = np.random.default_rng(7)
teak = kit.lib('teak')
bolt = kit.material('bolt_steel', kit.linear(0.63, 0.62, 0.60), rough=0.32, metal=1.0)
tyre = kit.material('tyre', '#1d1d1e', rough=0.86)
towel_white = kit.fabric('towel_white', '#f1eee6', detail_strength=0.7)
towel = kit.fabric('towel', '#ffffff', detail_strength=0.7, own=True)      # white here: the game gives it its colour

# ── measures (metres) ──
RAIL_X, RAIL_W, RAIL_H, RAIL_TOP = 0.300, 0.034, 0.068, 0.322
Y_FOOT, Y_HEAD = -0.86, 1.06
SLAT_L, SLAT_W, SLAT_T, GAP = 0.640, 0.058, 0.018, 0.014
BED_TOP = RAIL_TOP + SLAT_T
HINGE_Y, HINGE_Z = 0.300, 0.300
RECLINE = math.radians(40)
STILE_X = 0.235                       # the backrest's side pieces run inside the rails
WHEEL_Y, WHEEL_R = 0.88, 0.095

wood, steel, static = [], [], []

def timber(name, size, loc, rot=None, bevel=0.003):
    o = kit.box(name, size, loc, rot, mat=teak, bevel=bevel)
    wood.append(o)
    return o

# ── frame ──
for sx, n in ((1, 'l'), (-1, 'r')):
    timber('rail_' + n, (RAIL_W, Y_HEAD - Y_FOOT, RAIL_H), (sx * RAIL_X, (Y_HEAD + Y_FOOT) / 2, RAIL_TOP - RAIL_H / 2), bevel=0.004)
    lx = sx * (RAIL_X - RAIL_W / 2 - 0.0225)
    timber('leg_' + n, (0.045, 0.045, RAIL_TOP - 0.006), (lx, -0.66, (RAIL_TOP - 0.006) / 2), bevel=0.004)
    timber('axle_block_' + n, (RAIL_W, 0.085, 0.215), (sx * RAIL_X, WHEEL_Y, 0.045 + 0.1075), bevel=0.004)
inner = 2 * (RAIL_X - RAIL_W / 2)
for n, y in (('foot', Y_FOOT + 0.035), ('mid', HINGE_Y - 0.045), ('head', Y_HEAD - 0.035)):
    timber('stretcher_' + n, (inner, 0.030, 0.052), (0, y, RAIL_TOP - 0.008 - 0.026))
stretch = kit.tube('leg_stretcher', [(-0.262, -0.66, 0.115), (0.262, -0.66, 0.115)], 0.012, mat=teak, verts=10)
wood.append(stretch)

# ── the bed ──
n_seat = int((HINGE_Y - 0.010 - (Y_FOOT + 0.012) + GAP) // (SLAT_W + GAP))
y0 = Y_FOOT + 0.012 + SLAT_W / 2
for i in range(n_seat):
    timber('slat_%02d' % i, (SLAT_L, SLAT_W, SLAT_T), (rng.uniform(-0.0015, 0.0015), y0 + i * (SLAT_W + GAP) + rng.uniform(-0.001, 0.001), RAIL_TOP + SLAT_T / 2),
           rot=(0, 0, rng.uniform(-0.004, 0.004)), bevel=0.0028)

# ── the backrest: built lying flat, then swung up about the hinge ──
back = []
for sx, n in ((1, 'l'), (-1, 'r')):
    back.append(timber('stile_' + n, (0.030, 0.770, 0.044), (sx * STILE_X, HINGE_Y - 0.025 + 0.385, RAIL_TOP - 0.022)))
n_back = 10
pitch = 0.0725
for i in range(n_back):
    wide = SLAT_W + (0.016 if i == n_back - 1 else 0)
    back.append(timber('back_slat_%02d' % i, (SLAT_L, wide, SLAT_T), (rng.uniform(-0.0015, 0.0015), HINGE_Y + 0.016 + SLAT_W / 2 + i * pitch + (0.008 if i == n_back - 1 else 0), RAIL_TOP + SLAT_T / 2),
                       rot=(0, 0, rng.uniform(-0.004, 0.004)), bevel=0.0028 if i < n_back - 1 else 0.006))
swing = Matrix.Translation((0, HINGE_Y, HINGE_Z)) @ Matrix.Rotation(RECLINE, 4, 'X') @ Matrix.Translation((0, -HINGE_Y, -HINGE_Z))

# ── the prop that holds the backrest, and the rack it drops into ──
def swung(p):
    return swing @ Vector(p)
pivot_flat = (0, HINGE_Y + 0.42, RAIL_TOP - 0.022)                 # on the stiles, 0.42 m up from the hinge
pv = swung(pivot_flat)
RACK_TOP, PROP_L, PROP_X = 0.287, 0.330, 0.262
foot_y = pv.y + math.sqrt(PROP_L ** 2 - (pv.z - (RACK_TOP + 0.004)) ** 2)
foot = Vector((0, foot_y, RACK_TOP + 0.004))
lean = math.atan2(foot.z - pv.z, foot.y - pv.y)                    # direction of the prop, in the YZ plane
prop = []
for sx, n in ((1, 'l'), (-1, 'r')):
    c = (Vector((sx * PROP_X, pv.y, pv.z)) + Vector((sx * PROP_X, foot.y, foot.z))) / 2
    prop.append(timber('prop_' + n, (0.022, PROP_L + 0.03, 0.032), c, rot=(lean, 0, 0)))
bar = kit.tube('prop_bar', [(-PROP_X - 0.011, foot.y, foot.z), (PROP_X + 0.011, foot.y, foot.z)], 0.0105, mat=teak, verts=10)
prop.append(bar); wood.append(bar)
notches = [foot_y + d for d in (-0.090, -0.045, 0.0, 0.045, 0.090)]
for sx, n in ((1, 'l'), (-1, 'r')):
    ya, yb = notches[0] - 0.05, notches[-1] + 0.05
    out = [(ya, RACK_TOP - 0.026), (yb, RACK_TOP - 0.026), (yb, RACK_TOP)]
    for ny in reversed(notches):                                   # a row of V notches along the top
        out += [(ny + 0.014, RACK_TOP), (ny + 0.004, RACK_TOP - 0.013), (ny - 0.004, RACK_TOP - 0.013), (ny - 0.014, RACK_TOP)]
    out.append((ya, RACK_TOP))
    rack = kit.extrude('rack_' + n, out, 0.022, mat=teak)
    rack.matrix_world = Matrix(((0, 0, 1, sx * 0.2715 - 0.011), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))    # outline (y, z) -> world, 22 mm thick in x
    kit.apply_transform(rack, location=True)
    kit.bevel(rack, 0.0015, angle=50)
    wood.append(rack)

# ── wheels ──
wheel_parts = []
axle = kit.tube('axle', [(-0.372, WHEEL_Y, WHEEL_R), (0.372, WHEEL_Y, WHEEL_R)], 0.007, mat=bolt, verts=8)
wheel_parts.append(axle); steel.append(axle)
for sx, n in ((1, 'l'), (-1, 'r')):
    wx = sx * (RAIL_X + RAIL_W / 2 + 0.008 + 0.016)
    prof = [(0.016, -0.019), (0.074, -0.016), (0.080, -0.012), (0.080, 0.012), (0.074, 0.016), (0.016, 0.019)]      # the wooden disc, a little thicker at the hub
    disc = kit.lathe('wheel_' + n, [(0.0, -0.019)] + prof + [(0.0, 0.019)], steps=16, mat=teak, loc=(wx, WHEEL_Y, WHEEL_R), rot=(0, math.pi / 2, 0), smooth=40)
    t = kit.lathe('tyre_' + n, [(0.079, -0.0125), (0.090, -0.0135), (WHEEL_R, -0.008), (WHEEL_R, 0.008), (0.090, 0.0135), (0.079, 0.0125)], steps=16, mat=tyre,
                  loc=(wx, WHEEL_Y, WHEEL_R), rot=(0, math.pi / 2, 0), smooth=40)
    cap = kit.rivet('hub_' + n, (wx + sx * 0.0185, WHEEL_Y, WHEEL_R), (sx, 0, 0), 0.013, height=0.006, mat=bolt, segments=8, washer=0.004)
    kit.apply_transform([disc, t], location=True)
    wheel_parts += [disc, t, cap]; wood.append(disc); steel.append(cap)

# ── bolts: where the frame is held together ──
bolts = []
def bolt_head(name, loc, normal, r=0.008):
    b = kit.rivet(name, loc, normal, r, height=0.0035, mat=bolt, segments=6, washer=0.0015)
    bolts.append(b); steel.append(b)
    return b
for sx, n in ((1, 'l'), (-1, 'r')):
    xo = sx * (RAIL_X + RAIL_W / 2)
    for k, z in enumerate((RAIL_TOP - 0.020, RAIL_TOP - 0.050)):
        bolt_head('bolt_leg_%s%d' % (n, k), (xo, -0.66, z), (sx, 0, 0))
    bolt_head('bolt_hinge_' + n, (xo, HINGE_Y, HINGE_Z), (sx, 0, 0), 0.0095)
    bolt_head('bolt_axle_' + n, (xo, WHEEL_Y, RAIL_TOP - 0.034), (sx, 0, 0))
prop_bolts = [bolt_head('bolt_prop_' + n, (sx * (PROP_X + 0.011), pv.y, pv.z), (sx, 0, 0), 0.007) for sx, n in ((1, 'l'), (-1, 'r'))]

# ── the towel: over the top of the backrest, down it and along the bed; two pieces that meet at the fold ──
TW, T_UP, STRIPE = 0.230, 0.004, 0.118        # half width; how far it rides above the slats; width of one stripe
back_dir = Vector((0, math.cos(RECLINE), math.sin(RECLINE)))
back_nrm = Vector((0, -math.sin(RECLINE), math.cos(RECLINE)))
hinge = Vector((0, HINGE_Y, HINGE_Z))
h_up = BED_TOP - HINGE_Z + T_UP                # height of the cloth over the hinge line, on bed and backrest alike
fold = hinge + back_dir * (h_up * (1 - math.cos(RECLINE)) / math.sin(RECLINE)) + back_nrm * h_up
back_end = HINGE_Y + 0.016 + SLAT_W / 2 + (n_back - 1) * pitch + 0.008 + (SLAT_W + 0.016) / 2 - HINGE_Y     # top edge of the top slat
top = hinge + back_dir * back_end + back_nrm * h_up
behind = top + back_dir * 0.014 - back_nrm * (SLAT_T + 0.012)
OVER, SEAT_LEN = 0.15, 0.78
path = [behind + Vector((0, 0.012, -OVER)), behind + Vector((0, 0.008, -OVER * 0.5)), behind, top + back_dir * 0.012 - back_nrm * 0.002, top]
path += [top - back_dir * (back_end - 0.02) * t for t in (0.25, 0.5, 0.75)] + [fold + back_dir * 0.03, fold, fold + Vector((0, -0.03, 0))]
path += [fold + Vector((0, -SEAT_LEN * t, 0)) for t in (0.33, 0.66, 1.0)]
path = kit._catmull([(q.y, q.z) for q in path], 6)
arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
d_fold = float(arc[np.argmin(np.linalg.norm(path - np.array([fold.y, fold.z]), axis=1))])

def towel_piece(name, d0, d1, nv, seed):
    """The strip of towel between distances d0..d1 along the path (measured from the end that hangs behind)."""
    def fn(u, v):
        d = d0 + (d1 - d0) * v
        y, z = np.interp(d, arc, path[:, 0]), np.interp(d, arc, path[:, 1])
        ty = np.interp(d + 0.004, arc, path[:, 0]) - np.interp(d - 0.004, arc, path[:, 0])
        tz = np.interp(d + 0.004, arc, path[:, 1]) - np.interp(d - 0.004, arc, path[:, 1])
        tl = np.maximum(np.hypot(ty, tz), 1e-9); ny, nz = tz / tl, -ty / tl                # the side that shows
        x = TW * (1 - 2 * u) * (1 + 0.014 * np.sin(d * 9.0 + seed))                        # +x first: that side is the front
        P = np.stack([x, d, np.full_like(x, 3.0)], axis=-1).reshape(-1, 3)
        w = 0.006 * (kit.noise3(P, 0.16, 3, 3).reshape(x.shape) - 0.5) + 0.0012 * np.cos(d * math.tau / (SLAT_W + GAP))   # folds, and the sag between slats
        droop = 0.004 * np.clip((np.abs(x) / TW - 0.84) / 0.16, 0, 1) ** 2                  # the edges hang a little
        return x, y + ny * w, z + nz * w - droop
    o = kit.surface(name, fn, 8, nv, mat=towel_white, smooth=180, grain='v')
    me = o.data
    me.materials.append(towel)
    for q in me.polygons:                                                                   # stripes across the towel
        d = d0 + (d1 - d0) * ((q.index % nv) + 0.5) / nv
        q.material_index = int(d / STRIPE + 0.35) % 2
    kit.rim(o, 0.007)
    return o

towel_back = towel_piece('towel_back', 0.0, d_fold, 20, 1.0)
towel_seat = towel_piece('towel_seat', d_fold, float(arc[-1]), 14, 2.0)
cloth = [towel_back, towel_seat]

# ── put the backrest up, declare the moving parts ──
for o in back:
    o.matrix_world = swing @ o.matrix_world
hinge_bolts = []
p_back = kit.part('backrest', back + [towel_back], pivot=(0, HINGE_Y, HINGE_Z), rot=(RECLINE, 0, 0))
p_prop = kit.part('prop', prop + prop_bolts, pivot=tuple(pv), rot=(lean, 0, 0), parent_part=p_back)
p_wheels = kit.part('wheels', wheel_parts, pivot=(0, WHEEL_Y, WHEEL_R))

# ── finish ──
kit.uv_tube(wood)                                    # every piece of timber: grain along its length, wrapped round it
kit.uv_tube([o for o in wood if o.name.startswith('wheel_')], 'x')
kit.vary(wood, value=0.09, hue=0.035, noise=0.07, scale=0.3, seed=3)
# years in the sun: the tops have gone silver, the sheltered wood is still warm
kit.coat(wood, lambda P, N: np.clip(N[:, 2], 0, 1) ** 1.5 * (0.22 + 0.45 * kit.noise3(P, 0.25, 3, 11)), color='#ab9a88', rough=0.82)
kit.wear(wood, amount=0.6, lighten=0.22, rough=0.75, breakup=0.6, scale=0.05)
kit.uv_box(steel + [o for o in wheel_parts if o.name.startswith('tyre')])
kit.tint(cloth, fn=lambda P, N: (0.93 + 0.14 * kit.noise3(P, 0.2, 3, 5))[:, None] * np.ones(3)[None, :])
kit.detail_only(bolts, upto=0)
kit.detail_only([o for o in wood if o.name.startswith('rack_')], upto=1)

kit.bake_ao(distance=0.32, ground=0.0, refine=0.12)
kit.dirt(wood, amount=0.55, color='#57483a', rough=0.12)
kit.ground_shadow(z=0.0, strength=0.8, reach=0.6, cell=0.13)

# ── what the game reads ──
kit.anchor('seat', (0, 0.40, 0.98), kind='lie', pitch=0.02)
kit.anchor('stand', (-1.3, 0.0, 0.0))
kit.anchor('head', tuple(top - back_dir * 0.12 + back_nrm * 0.08))
stats = kit.export_bpk('lounger', lods=[(0.42, 14), (0.15, 40)],
                       meta=dict(kind='prop', collider=dict(r=0.45, top=0.6), recline=round(RECLINE, 4), length=round(Y_HEAD - Y_FOOT, 3), width=0.75))

if '--no-preview' not in sys.argv:
    kit.material('towel', '#1ba3a0', rough=0.92, detail='weave', detail_strength=0.7, own=True)       # a colour for the pictures only
    kit.ensure_layers(cloth)
    quick = '--quick' in sys.argv
    kit.preview('lounger', views=('hero', 'hero_back') if quick else ('hero', 'hero_back', 'side', 'top', 'low'), extra=() if quick else ('ao', 'wire'),
                closeups={'hinge': ((0.30, HINGE_Y + 0.05, 0.33), 0.26, -62, 16), 'wheel': ((0.33, WHEEL_Y, 0.16), 0.24, 118, 12), 'slats': ((0.18, -0.55, 0.33), 0.26, -30, 34)})
