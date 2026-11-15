"""The spade the player digs with (the first-person tool of src/88-activities.js).

A real digging spade: a dished steel blade with a stamped rib, turned-over treads for the foot, a socket
rolled from the blade and riveted to an ash shaft, and a steel yoke with a turned ash grip (a "YD" handle).

In the game: +Y runs up the shaft to the grip, the hollow of the blade faces -Z, and the origin is on the
shaft axis where the shaft meets the top of the blade: the same hold as the old model, 1.37 m long.
Anchors: 'grip' (the top hand), 'hand' (the lower hand on the shaft), 'blade' (middle of the hollow), 'tip'.

    /opt/bl/venv/bin/python models/shovel.py        -> models/out/shovel.bpk, build/preview/shovel_*.png
"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import bpkit as kit
import numpy as np
from mathutils import Matrix

kit.reset()
steel = kit.lib('steel', 'spade_steel', rough=0.38)
ash = kit.lib('ash')
PAINT = '#2c4a37'                    # the maker's dark green enamel
BARE = kit.linear(0.56, 0.57, 0.58)

W, L, T = 0.100, 0.292, 0.0022       # blade: half width at the shoulders, length, sheet thickness
Y0 = -0.0085                         # the sheet lies a little in front of the shaft axis (the socket is rolled from it)
DISH, CURL = 0.013, 0.020            # hollow across the blade, forward curl towards the tip
RIB_H, RIB_W, RIB_S = 0.0125, 0.0180, 0.64     # the stamped rib: height, half width at the top, how far down it runs (0..1)
LIFT = math.radians(8)               # the blade is cranked forward from the shaft
R_SOCKET, R_SOCKET_TOP = 0.0186, 0.0212        # the socket widens upwards to take the shaft


def half_width(s):
    """Outline: straight sides, rounded corners, a nearly straight cutting edge. s = 0 shoulders .. 1 edge."""
    t = np.clip((s - 0.50) / 0.50, 0, 0.985)
    return W * (1 - 0.05 * s) * (1 - t ** 2.7) ** (1 / 2.7)


def sheet(x, s):
    """Front face of the blade before it is cranked: (y, z) at lateral x, distance s down the blade."""
    z = -L * s - 0.011 * (np.abs(x) / W) ** 1.6 * (1 - s) ** 2          # shoulders fall away from the socket
    y = Y0 - DISH * (x / W) ** 2 * (1 - 0.35 * s) - CURL * s ** 2
    t = np.clip(s / RIB_S, 0, 1)
    rw = RIB_W * (1 - 0.8 * t)                                           # a tongue that narrows to a point
    return y - RIB_H * (1 - t) ** 0.7 * np.exp(-np.abs(x / rw) ** 3.0), z          # flat-topped, with firm shoulders


def crank(P):
    """Bend everything below the socket forward by LIFT (a smooth neck, not a kink)."""
    t = np.clip((0.035 - P[:, 2]) / 0.075, 0, 1); a = LIFT * t * t * (3 - 2 * t)
    c, sn = np.cos(a), np.sin(a)
    out = P.copy()
    out[:, 1] = P[:, 1] * c + P[:, 2] * sn
    out[:, 2] = -P[:, 1] * sn + P[:, 2] * c
    return out


# ── blade ──
def blade_fn(u, v):
    s = 1 - (1 - v) ** 1.5                                   # rows crowd towards the cutting edge
    g = np.sign(0.5 - u) * np.abs(2 * u - 1) ** 1.55         # columns crowd towards the rib; +x first, so the front faces -Y
    x = half_width(s) * g
    y, z = sheet(x, s)
    return x, y, z

blade = kit.surface('blade', blade_fn, 26, 22, mat=steel, thickness=T, grain='v', smooth=35)
kit.bevel(blade, 0.0007, angle=50, smooth=False)
kit.shade_smooth(blade, 40)

# the treads: the top edge of each shoulder rolled over backwards into a bead for the foot
def tread_fn(side):
    def fn(u, v):
        ax = 0.027 + u * (W - 0.027)                         # |x| from beside the socket to the corner
        x = side * (ax if side > 0 else (W + 0.027 - ax))    # u always runs towards +x, so the outside of the roll faces out
        y, z = sheet(x, 0.0)
        r = 0.0052
        a = v * math.radians(215)                            # up, over, and back down behind the blade
        return x, y + r - r * np.cos(a), z - 0.0015 + r * np.sin(a)
    return fn

treads = [kit.surface('tread_%s' % n, tread_fn(sd), 8, 8, mat=steel, thickness=T, grain='u', smooth=60) for n, sd in (('l', 1), ('r', -1))]
kit.bevel(treads, 0.0006, angle=50, smooth=False)
kit.shade_smooth(treads, 60)

# ── socket: a tube round the shaft that flattens into the rib of the blade ──
def frog_fn(u, v):
    th = u * math.tau
    z = -0.060 + v * 0.120                                   # bottom to top
    s = np.clip(-z / L, 0, 1)
    k = np.clip((0.058 - z) / 0.078, 0, 1); k = k * k * (3 - 2 * k)       # 0 = round tube, 1 = lying on the sheet
    sink = np.clip((-0.020 - z) / 0.040, 0, 1)               # at the bottom it runs out into the blade
    xt = 0.0215 * np.cos(th) * (1 - 0.45 * sink)
    yf, _ = sheet(xt, s)
    front = np.sin(th) < 0
    proud = 0.0007 - 0.0016 * sink
    yt = np.where(front, yf - proud, yf + T + proud + 0.0030 * (1 - (xt / 0.0215) ** 2) * (1 - sink))
    return R_SOCKET * np.cos(th) * (1 - k) + xt * k, R_SOCKET * np.sin(th) * (1 - k) + yt * k, z

frog = kit.surface('frog', frog_fn, 20, 14, mat=steel, closed_u=True, grain='v', smooth=60)
socket = kit.lathe('socket', [(R_SOCKET, 0.060), (R_SOCKET + 0.0010, 0.110), (R_SOCKET_TOP - 0.0004, 0.186), (R_SOCKET_TOP + 0.0012, 0.190),
                              (R_SOCKET_TOP + 0.0015, 0.197), (R_SOCKET_TOP + 0.0007, 0.2025), (R_SOCKET_TOP - 0.0022, 0.2025),
                              (R_SOCKET_TOP - 0.0022, 0.194)], steps=20, mat=steel, smooth=50)
kit.uv_tube(socket, 'z')
for o in [blade, frog] + treads:
    kit.deform(o, crank)

# ── shaft ──
shaft = kit.tube('shaft', [(0, 0, z) for z in (0.07, 0.20, 0.30, 0.45, 0.60, 0.75, 0.86, 0.925)],
                 [0.0160, 0.0186, 0.0190, 0.0187, 0.0184, 0.0180, 0.0174, 0.0172], mat=ash, verts=16, smooth=2)

# ── the YD handle: ferrule, two steel arms, a turned grip ──
ferrule = kit.lathe('ferrule', [(0.0176, 0.840), (0.0201, 0.840), (0.0205, 0.844), (0.0198, 0.850), (0.0198, 0.920),
                                (0.0205, 0.924), (0.0201, 0.930), (0.0120, 0.9315), (0.0, 0.9315)], steps=20, mat=steel, smooth=50)
kit.uv_tube(ferrule, 'z')
GZ = 1.053                                                   # height of the grip
arms = []
for n, sd in (('l', 1), ('r', -1)):
    path = [(sd * x, 0, z) for x, z in ((0.0206, 0.866), (0.0212, 0.905), (0.0240, 0.938), (0.0345, 0.966), (0.0500, 0.992),
                                        (0.0600, 1.016), (0.0634, 1.042), (0.0634, 1.066), (0.0634, 1.083))]
    arm = kit.strap('arm_' + n, path, [0.021, 0.021, 0.022, 0.024, 0.025, 0.026, 0.026, 0.026, 0.019], 0.003, mat=steel, smooth=3)
    kit.bevel(arm, 0.0008, angle=40)
    arms.append(arm)
gp = [(0.0142, -0.0600), (0.0152, -0.0585)] + [(0.0152 + 0.0016 * math.cos(math.pi * t / 2) ** 1.2, 0.0585 * t) for t in np.linspace(-1, 1, 9)] + [(0.0152, 0.0585), (0.0142, 0.0600)]
grip = kit.lathe('grip', gp, steps=14, mat=kit.lib('ash', 'grip_ash', rough=0.5), loc=(0, 0, GZ), rot=(0, math.pi / 2, 0), smooth=50)
kit.apply_transform(grip, location=True)
kit.uv_tube(grip, 'x')

# ── rivets ──
rivets = []
for i, z in enumerate((0.166, 0.092)):
    rz = R_SOCKET + 0.0010 + (R_SOCKET_TOP - R_SOCKET - 0.0014) * max(0.0, (z - 0.110) / 0.076) - 0.0003
    rivets.append(kit.rivet('rivet_sf%d' % i, (0, -rz, z), (0, -1, 0), 0.0052, mat=steel))
    rivets.append(kit.rivet('rivet_sb%d' % i, (0, rz, z), (0, 1, 0), 0.0052, mat=steel))
for sd in (1, -1):
    rivets.append(kit.rivet('rivet_arm%d' % sd, (sd * 0.0224, 0, 0.886), (sd, 0, 0), 0.0046, mat=steel))
    rivets.append(kit.rivet('rivet_grip%d' % sd, (sd * 0.0649, 0, GZ), (sd, 0, 0), 0.0062, mat=steel, washer=0.002))
kit.uv_box(rivets)
kit.detail_only(rivets[:6], upto=0)

# ── finish ──
metal = [blade, frog, socket, ferrule] + treads + arms

def streaks(P, seed):
    """Noise drawn out along the blade: the marks of sand dragged over it."""
    return kit.noise3(P * np.array([1.0, 1.0, 0.16]), 0.014, 3, seed)

def painted(P, N):
    """Enamel on the socket and the top of the blade, scraped away in streaks towards the cutting edge."""
    s = np.clip(-P[:, 2] / L, 0, 1.2)
    edge = 0.52 + 0.30 * (streaks(P, 7) - 0.5) + 0.10 * (kit.noise3(P, 0.05, 2, 9) - 0.5)
    return np.clip((edge - s) / 0.10, 0, 1)

kit.coat(metal, painted, color=PAINT, rough=0.46, metal=0.0, weight=0.12)
# the enamel is not one flat colour: thinner and duller in places
kit.tint(metal, fn=lambda P, N: (0.86 + 0.28 * kit.noise3(P, 0.03, 3, 31))[:, None] * np.ones(3)[None, :])
# where sand runs over the bare steel it is polished bright; a dull tarnish where it meets the paint
kit.coat([blade], lambda P, N: np.clip((-P[:, 2] / L - 0.62) / 0.25, 0, 1) * (0.5 + 0.5 * streaks(P, 3)), rough=0.20)
kit.coat([blade], lambda P, N: np.exp(-((-P[:, 2] / L - 0.50 - 0.30 * (streaks(P, 7) - 0.5)) / 0.07) ** 2) * 0.55, color='#5d4a3a', rough=0.6, metal=0.55)
kit.wear([blade] + treads + arms, amount=0.85, color=BARE, rough=0.3, metal=1.0, breakup=0.5, scale=0.02)
kit.wear([socket, ferrule, frog], amount=0.55, color=BARE, rough=0.32, metal=1.0, breakup=0.6, scale=0.015, spread=1.0)
# the cutting edge is ground bright; rust has started in a few places on the enamel
kit.coat([blade], lambda P, N: np.clip((-P[:, 2] / L - 0.955) / 0.02, 0, 1), color=kit.linear(0.72, 0.73, 0.74), rough=0.16, metal=1.0)
kit.coat(metal, lambda P, N: np.clip((kit.noise3(P, 0.022, 3, 41) - 0.70) / 0.10, 0, 1) * painted(P, N) * 0.8, color='#7a4424', rough=0.85, metal=0.0, weight=0.0)
# a film of dried sand low on the back of the blade
kit.coat([blade], lambda P, N: np.clip((-P[:, 2] / L - 0.45) / 0.4, 0, 1) * np.clip(N[:, 1], 0, 1) * np.clip((kit.noise3(P, 0.04, 3, 13) - 0.35) / 0.4, 0, 1) * 0.55,
         color='#b9a480', rough=0.9, metal=0.0, weight=0.0)

def handled(P, N):
    """The shaft is darker where hands and dirt have been at it."""
    z = P[:, 2]
    grime = 0.16 * np.exp(-((z - 0.52) / 0.16) ** 2) + 0.20 * np.exp(-((z - 0.22) / 0.07) ** 2) + 0.10 * np.exp(-((z - 0.86) / 0.06) ** 2)
    grime *= 0.7 + 0.6 * kit.noise3(P, 0.06, 3, 4)
    return (1 - grime)[:, None] * np.array([1.0, 0.985, 0.96])[None, :]

kit.tint(shaft, fn=handled)
kit.vary([shaft, grip], value=0.03, noise=0.07, scale=0.12, seed=2)
kit.tint(grip, '#e6d3b8')                                                   # the grip is a shade darker, polished by the hand
kit.tint(rivets, '#c9c9c6')

kit.bake_ao(distance=0.09, refine=0.15)
kit.dirt(metal + rivets, amount=0.75, color='#6b3d1f', rough=0.3)           # rust and dirt in the joints

# ── what the game reads ──
tip_y, tip_z = sheet(0.0, 1.0)
tip = crank(np.array([[0.0, float(tip_y), float(tip_z)]]))[0]
mid_y, mid_z = sheet(0.0, 0.6)
mid = crank(np.array([[0.0, float(mid_y), float(mid_z)]]))[0]
kit.anchor('grip', (0, 0, GZ))
kit.anchor('hand', (0, 0, 0.50))
kit.anchor('blade', tuple(mid), rot=(-LIFT, 0, 0))
kit.anchor('tip', tuple(tip), rot=(-LIFT, 0, 0))

kit.export_bpk('shovel', lods=[(0.35, 5)],
               meta=dict(kind='tool', length=1.385, hold='origin on the shaft axis at the top of the blade; +Y up the shaft; the hollow of the blade faces -Z'))

if '--no-preview' not in sys.argv:
    stuck = Matrix.Translation((0, 0, 0.19)) @ Matrix.Rotation(math.radians(-7), 4, 'X')        # stuck in the sand
    quick = '--quick' in sys.argv
    kit.preview('shovel', views=('hero',) if quick else ('hero', 'hero_back', 'side'), rest=stuck, extra=() if quick else ('ao', 'wire'),
                closeups={'blade': ((0, -0.02, -0.06), 0.19, -30, 14), 'socket': ((0, 0, 0.11), 0.10, -55, 12), 'grip': ((0, 0, 1.0), 0.12, -35, 18),
                          'blade_back': ((0, 0.0, -0.04), 0.19, 150, 16)})
    lying = Matrix.Translation((0, 0, 0.034)) @ Matrix.Rotation(math.radians(-90), 4, 'X')      # lying on the sand, hollow up
    kit.preview('shovel_lying', views=(('top', 0, 80), ('low', -50, 14)), rest=lying, closeups={'scoop': ((0, -0.03, -0.14), 0.2, -25, 42)})
