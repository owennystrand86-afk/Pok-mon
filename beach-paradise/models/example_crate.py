"""A worked example for DEVELOPING.md ('3D assets made in Blender'): a small wooden storage crate with a hinged,
painted lid, strap hinges and rope handles. Copy this file to start a new model.

It is NOT part of the game: it exports to build/example/ instead of models/out/. Look at it with
    /opt/bl/venv/bin/python models/example_crate.py            -> build/example/crate.bpk, build/preview/crate_*.png
    tools/build.sh --assets build/example --out build/example/index.html
    FILE=file://$PWD/build/example/index.html tools/snap.sh steps.json      with  __T.studio('crate', {pose: {lid: [55, 0, 0]}})

In the game: 0.60 x 0.40 x 0.34 m (0.69 wide with the handles), the front faces -Z, the origin is on the ground under
the middle. Moving part: 'lid' (assetPose(model, 'lid', angle): positive angles about its x axis open it). Anchors: 'grip' (front edge of the lid,
rides on the lid), 'inside' (the middle of the floor of the crate; data: litres).
"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import bpkit as kit
import numpy as np

kit.reset()
rng = np.random.default_rng(4)

# ── materials: from the library where it has one, made here where the model needs its own ──
pine = kit.lib('pine')
iron = kit.lib('steel_dark', 'hinge_iron', rough=0.6)
rope = kit.lib('rope')
teal = kit.paint('crate_paint', '#2a9a96', gloss=0.2)

# ── measures (metres; Blender axes: X to the model's left, -Y its front, Z up) ──
L, W, T = 0.60, 0.40, 0.018                 # outside length and width of the box, thickness of the boards
SKID, BOARD, GAP = 0.030, 0.085, 0.004      # height of the skids it stands on; height of a side board; gap between boards
Z0 = SKID + T                               # top of the floor
TOP = Z0 + 3 * (BOARD + GAP) - GAP          # top edge of the sides

wood, lid, iron_bits, rivets = [], [], [], []

def board(name, size, loc, into=wood, bevel=0.0025):
    """one sawn board: never quite straight, never quite in line with its neighbours"""
    o = kit.box(name, size, loc, rot=(0, 0, rng.uniform(-0.004, 0.004)), mat=pine, bevel=bevel)
    into.append(o)
    return o

# ── the box ──
for sx in (-1, 1):
    board('skid_%d' % sx, (0.045, W, SKID), (sx * 0.21, 0, SKID / 2), bevel=0.004)
for i in range(4):
    board('floor_%d' % i, (L, 0.096, T), (0, -0.15 + 0.1 * i, SKID + T / 2))
for i in range(3):
    z = Z0 + BOARD / 2 + i * (BOARD + GAP)
    for sy in (-1, 1):
        board('side_%d_%d' % (sy, i), (L, T, BOARD), (0, sy * (W - T) / 2, z))
    for sx in (-1, 1):
        board('end_%d_%d' % (sx, i), (T, W - 2 * T, BOARD), (sx * (L - T) / 2, 0, z))
for sx in (-1, 1):
    for sy in (-1, 1):
        board('post_%d_%d' % (sx, sy), (0.028, 0.028, TOP - Z0 - 0.004), (sx * (L / 2 - T - 0.014), sy * (W / 2 - T - 0.014), (TOP + Z0) / 2 - 0.002))

# ── the lid: four boards held by two battens, painted ──
for i in range(4):
    board('lid_%d' % i, (L + 0.016, 0.1, 0.016), (0, -0.153 + 0.102 * i, TOP + 0.008), into=lid)
for sx in (-1, 1):
    board('lid_batten_%d' % sx, (0.05, W - 0.02, 0.014), (sx * 0.25, 0, TOP + 0.016 + 0.007), into=lid, bevel=0.003)
kit.set_material(lid, teal)

# ── strap hinges: one leaf on the back of the box, one on the lid, a barrel between; domed rivets hold them ──
HINGE = (W / 2 + 0.006, TOP + 0.002)                                   # the hinge line (y, z)
for sx in (-1, 1):
    x = sx * 0.14
    leaf = kit.strap('hinge_box_%d' % sx, [(x, W / 2 + 0.0015, TOP - 0.085), (x, W / 2 + 0.0015, TOP - 0.004)], 0.032, 0.003, mat=iron, width_axis=(1, 0, 0))
    barrel = kit.cylinder('hinge_barrel_%d' % sx, 0.006, 0.05, (x, HINGE[0], HINGE[1]), mat=iron, verts=12, axis='x')
    top = kit.strap('hinge_lid_%d' % sx, [(x, W / 2 + 0.004, TOP + 0.0175), (x, W / 2 - 0.02, TOP + 0.0175), (x, W / 2 - 0.15, TOP + 0.0175)], [0.032, 0.032, 0.02], 0.003, mat=iron, width_axis=(1, 0, 0))
    iron_bits += [leaf, barrel, top]; lid.append(top)
    for k, z in enumerate((TOP - 0.07, TOP - 0.025)):
        rivets.append(kit.rivet('rivet_box_%d_%d' % (sx, k), (x, W / 2 + 0.003, z), (0, 1, 0), 0.005, mat=iron))
    for k, y in enumerate((W / 2 - 0.035, W / 2 - 0.12)):
        r = kit.rivet('rivet_lid_%d_%d' % (sx, k), (x, y, TOP + 0.019), (0, 0, 1), 0.005, mat=iron)
        rivets.append(r); lid.append(r)
iron_bits += rivets

# ── rope handles through the ends ──
ropes = []
for sx in (-1, 1):
    x = sx * L / 2
    ropes.append(kit.tube('handle_%d' % sx, [(x - sx * 0.01, -0.07, 0.21), (x + sx * 0.03, -0.05, 0.17), (x + sx * 0.04, 0, 0.15), (x + sx * 0.03, 0.05, 0.17), (x - sx * 0.01, 0.07, 0.21)],
                          0.007, mat=rope, verts=8, smooth=4))

# ── moving parts: everything that turns with the lid, with the pivot ON the hinge line ──
p_lid = kit.part('lid', lid, pivot=(0, HINGE[0], HINGE[1]))

# ── surfaces: UVs in metres, then colour and wear from large to small ──
kit.uv_tube(wood + lid)                              # timber: grain along each board, wrapped round it (few seams)
kit.uv_box(iron_bits)                                # the rope came with UVs (tube, strap, surface do)
timber = [o for o in wood + lid if o not in iron_bits]
kit.vary(timber, value=0.08, hue=0.03, noise=0.06, scale=0.25, seed=2)        # no two boards the same
kit.coat(wood, lambda P, N: np.clip(N[:, 2], 0, 1) * (0.3 + 0.4 * kit.noise3(P, 0.2, 3, 7)), color='#b3a590', rough=0.85)   # tops bleached silver by the sun
painted = [o for o in lid if o not in iron_bits]
kit.wear(painted, amount=0.75, color='#c9a878', rough=0.7, breakup=0.6, scale=0.04)   # paint rubbed through to the wood on the edges
kit.wear(wood, amount=0.5, lighten=0.25, breakup=0.6)
kit.coat(iron_bits, lambda P, N: np.clip((kit.noise3(P, 0.03, 3, 9) - 0.55) / 0.15, 0, 1), color='#7a4226', rough=0.9, metal=0.1)   # rust has started in patches
kit.gradient(wood, 'z', 0.0, 0.14, color_lo='#b9a78f', color_hi='#ffffff')      # the lowest boards are stained by damp sand
kit.detail_only(rivets, upto=0)                      # too small to see beyond the first level of detail

# ── shade: ambient occlusion (it stands on the ground), grime in the nooks, the shade it leaves on the sand ──
kit.bake_ao(distance=0.3, ground=0.0)
kit.dirt(timber, amount=0.5)
kit.ground_shadow(z=0.0, reach=0.4)

# ── what the game reads instead of hard-coded numbers ──
kit.anchor('grip', (0, -W / 2 - 0.008, TOP + 0.008), parent_part=p_lid)
kit.anchor('inside', (0, 0, Z0), litres=round((L - 2 * T) * (W - 2 * T) * (TOP - Z0) * 1000))

kit.export_bpk('crate', lods=[(0.4, 12), (0.14, 35)], meta=dict(kind='prop', collider=dict(hx=L / 2, hz=W / 2, top=TOP + 0.03)),
                       out_dir=os.path.join(kit.ROOT, 'build', 'example'))        # a real model leaves out_dir out: models/out

if '--no-preview' not in sys.argv:
    kit.preview('crate', views=('hero', 'hero_back', 'top'), extra=('ao', 'wire'), size=(480, 360),
                closeups={'hinge': ((0.14, W / 2, TOP), 0.12, 150, 30), 'handle': ((L / 2, 0, 0.18), 0.14, 60, 15)})
