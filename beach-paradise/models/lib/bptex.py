"""bptex: small tileable greyscale DETAIL textures, generated with numpy (no files, deterministic).

A detail texture is one channel, 0.5 = neutral. The game (and the Blender preview material) reads it
three ways at once: it brightens/darkens the base colour, makes the surface rougher where it is dark
and gives it relief (dark = low).  Every function returns a float32 array (h, w) in 0..1 that tiles in
both directions, with u (array columns) running ALONG the grain / brush direction.

Used through bpkit:  kit.detail_texture('wood')  ->  an image the material definition can reference.
"""
import numpy as np


def _lattice(rng, ny, nx):
    return rng.random((ny, nx), dtype=np.float32)


def tile_noise(h, w, fy, fx, seed=0):
    """Smooth value noise on a (fy, fx) lattice that wraps round: one octave, 0..1."""
    rng = np.random.default_rng(seed)
    lat = _lattice(rng, fy, fx)
    y = np.arange(h, dtype=np.float32) * (fy / h)
    x = np.arange(w, dtype=np.float32) * (fx / w)
    y0 = np.floor(y).astype(np.int32); x0 = np.floor(x).astype(np.int32)
    ty = y - y0; tx = x - x0
    ty = ty * ty * (3 - 2 * ty); tx = tx * tx * (3 - 2 * tx)
    y1 = (y0 + 1) % fy; x1 = (x0 + 1) % fx
    a = lat[y0][:, x0]; b = lat[y0][:, x1]; c = lat[y1][:, x0]; d = lat[y1][:, x1]
    top = a + (b - a) * tx[None, :]; bot = c + (d - c) * tx[None, :]
    return top + (bot - top) * ty[:, None]


def tile_fbm(h, w, fy, fx, octaves=4, gain=0.5, seed=0):
    """Fractal sum of tile_noise octaves, normalised to 0..1."""
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        ny, nx = min(fy << o, h), min(fx << o, w)
        out += amp * tile_noise(h, w, ny, nx, seed * 131 + o * 17 + 1); tot += amp; amp *= gain
    return out / tot


def _norm(a, lo=0.0, hi=1.0, centre=True):
    """Stretch to lo..hi; with centre the MEAN lands on 0.5 so the texture is neutral on average."""
    a = a.astype(np.float32)
    mn, mx = np.percentile(a, 0.5), np.percentile(a, 99.5)
    a = np.clip((a - mn) / max(mx - mn, 1e-6), 0, 1)
    a = lo + (hi - lo) * a
    if centre:
        a = np.clip(a + (0.5 - float(a.mean())), 0, 1)
    return a


def wood(h=256, w=256, rings=11, seed=3, pores=0.5, figure=1.0):
    """Sawn timber: growth rings drawn out into long streaks, darker late wood, open pores.
    Meant to cover about 0.5 m along the grain (u) by 0.125 m across (v)."""
    v = (np.arange(h, dtype=np.float32) / h)[:, None]
    # rings are not evenly spaced: the tree grew faster in some years
    wide = np.zeros((h, 1), np.float32)
    rng = np.random.default_rng(seed)
    for k in (1, 2, 3, 5):
        wide += (0.5 / k) * np.sin(2 * np.pi * (k * v + rng.random())) / (2 * np.pi * k) * 2.2
    # they wander slowly along the board and wobble a little across it
    warp = (tile_fbm(h, w, 2, 1, 3, 0.55, seed) - 0.5) * 2.0 * figure
    warp += (tile_fbm(h, w, 5, 2, 2, 0.5, seed + 5) - 0.5) * 0.6 * figure
    r = rings * (v + wide) + warp
    f = r - np.floor(r)
    # early wood pales gradually, then the dense late wood ends in a sharp line
    ring = np.where(f < 0.8, np.clip(f / 0.8, 0, 1) ** 1.8, 1.0 - np.clip((f - 0.8) / 0.2, 0, 1) ** 0.6)
    # some rings are stronger than others
    strength = 0.55 + 0.45 * tile_noise(h, w, 4, 1, seed + 41)
    tone = 0.60 - 0.26 * ring * strength
    # long fibres: fine streaks, very stretched along u
    tone += 0.26 * (tile_fbm(h, w, 64, 2, 3, 0.6, seed + 11) - 0.5)
    tone += 0.16 * (tile_fbm(h, w, 128, 5, 2, 0.5, seed + 13) - 0.5)
    # broad tone changes across the board (heart and sap wood)
    tone += 0.20 * (tile_fbm(h, w, 3, 1, 2, 0.5, seed + 21) - 0.5)
    # pores: short dark dashes, more of them in the late wood
    p = tile_noise(h, w, h // 2, w // 10, seed + 31)
    p = np.clip((p - (0.80 - 0.10 * ring)) / 0.2, 0, 1)
    tone -= pores * 0.28 * p
    return _norm(tone, 0.06, 0.94)


def brushed(h=256, w=256, seed=7):
    """Brushed or ground metal: hair-fine scratches along u, a few deeper ones."""
    a = tile_fbm(h, w, 128, 2, 2, 0.6, seed) - 0.5
    b = tile_fbm(h, w, 256, 4, 1, 0.5, seed + 3) - 0.5
    c = tile_fbm(h, w, 32, 1, 2, 0.5, seed + 9) - 0.5
    deep = np.clip((tile_noise(h, w, 128, 3, seed + 15) - 0.86) / 0.14, 0, 1)
    blot = tile_fbm(h, w, 4, 4, 3, 0.5, seed + 23) - 0.5
    return _norm(0.5 + 0.45 * a + 0.35 * b + 0.25 * c - 0.5 * deep + 0.18 * blot, 0.08, 0.92)


def weave(h=256, w=256, threads=32, seed=5):
    """Plain-woven canvas: warp and weft threads passing over and under each other."""
    y = np.arange(h, dtype=np.float32)[:, None] * (threads / h)
    x = np.arange(w, dtype=np.float32)[None, :] * (threads / w)
    # thread thickness varies a little, threads are not perfectly straight
    x = x + 0.10 * np.sin(2 * np.pi * (y / threads) * 3 + 1.0) + 0.14 * (tile_fbm(h, w, 8, 8, 2, 0.5, seed) - 0.5)
    y = y + 0.10 * np.sin(2 * np.pi * (x / threads) * 2 + 0.3) + 0.14 * (tile_fbm(h, w, 8, 8, 2, 0.5, seed + 2) - 0.5)
    cx, cy = np.floor(x), np.floor(y)
    fx, fy = x - cx - 0.5, y - cy - 0.5
    over = ((cx + cy) % 2) < 1                       # which thread is on top in this cell
    # the top thread is a rounded ridge across its width, dipping where it goes under its neighbours
    ridge_u = np.cos(np.pi * fy) * (0.75 + 0.25 * np.cos(2 * np.pi * fx))
    ridge_v = np.cos(np.pi * fx) * (0.75 + 0.25 * np.cos(2 * np.pi * fy))
    hgt = np.where(over, ridge_u, ridge_v)
    fibre = tile_fbm(h, w, 128, 128, 2, 0.5, seed + 7) - 0.5
    return _norm(hgt + 0.22 * fibre, 0.08, 0.92)


def grunge(h=256, w=256, seed=11):
    """Even, direction-less wear: blotches, speckle and small pits (paint, galvanising, rubber, cast metal)."""
    a = tile_fbm(h, w, 4, 4, 5, 0.55, seed) - 0.5
    b = tile_fbm(h, w, 32, 32, 3, 0.5, seed + 4) - 0.5
    pits = np.clip((tile_noise(h, w, 96, 96, seed + 8) - 0.84) / 0.16, 0, 1)
    return _norm(0.5 + 0.5 * a + 0.35 * b - 0.45 * pits, 0.08, 0.92)


GENERATORS = {'wood': wood, 'brushed': brushed, 'weave': weave, 'grunge': grunge}
# how much of the world one repeat covers, in metres (u along the grain, v across it)
TILE_M = {'wood': (0.50, 0.125), 'brushed': (0.20, 0.05), 'weave': (0.048, 0.048), 'grunge': (0.30, 0.30)}
