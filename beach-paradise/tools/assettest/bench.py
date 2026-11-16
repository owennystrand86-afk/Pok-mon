"""Benchmark packs: about N thousand triangles of typical prop geometry (bevelled planks, turned posts, rods),
with detail textures, tints, wear and a made-up occlusion layer.   bench.py <thousand triangles>
-> build/torture/bench<N>/bench<N>.bpk   (never in models/out).   tools/assettest/run.sh --bench does all of it"""
import math, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'models', 'lib'))
import bpkit as kit, numpy as np
N = int(sys.argv[1]) * 1000
kit.reset()
teak = kit.lib('teak_grey'); steel = kit.lib('stainless'); paint = kit.paint('navy', '#1f3a5f', 0.6); rope = kit.lib('rope')
rng = np.random.default_rng(1)
objs, tris, i, t0 = [], 0, 0, time.time()
while tris < N:
    x, y = (i % 60) * 0.5, (i // 60) * 1.2
    k = i % 4
    if k == 0:
        o = kit.box('plank%d' % i, (0.09, 1.0, 0.022), (x, y, 0.4), mat=teak, bevel=0.003, segments=2); kit.uv_box(o)
    elif k == 1:
        o = kit.lathe('post%d' % i, [(0, 0), (0.03, 0), (0.035, 0.05), (0.025, 0.1), (0.03, 0.2), (0.022, 0.3), (0.03, 0.38), (0, 0.4)], steps=20, mat=paint, loc=(x, y, 0)); kit.uv_tube(o, 'z')
    elif k == 2:
        o = kit.tube('rod%d' % i, [(x, y - 0.4, 0.2), (x + 0.1, y, 0.3), (x, y + 0.4, 0.2)], 0.012, mat=steel, verts=10, smooth=6)
    else:
        o = kit.tube('rope%d' % i, [(x, y - 0.4, 0.05), (x + 0.2, y - 0.1, 0.02), (x - 0.1, y + 0.2, 0.04), (x, y + 0.4, 0.02)], 0.008, mat=rope, verts=8, smooth=8)
    # nothing repeats in a real model: every piece is a little bent, turned and out of place
    kit.deform(o, lambda P: P + 0.004 * np.sin(P[:, [1, 2, 0]] * rng.uniform(3, 9, 3) + rng.uniform(0, 6, 3)) + rng.normal(0, 0.0003, P.shape))
    o.rotation_euler = (rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), rng.uniform(0, 6.28)); o.location.z += rng.uniform(0, 0.3)
    objs.append(o); tris += kit.tri_count(o); i += 1
kit.vary(objs, seed=2)
big = kit.join(objs, 'bench')
kit.wear(big, amount=0.5)
me = big.data
P, _ = kit._corner_world(big)
ao = 0.45 + 0.55 * kit.noise3(P, 0.3, 2, 1)
a = np.ones((len(me.loops), 4), np.float32); a[:, 0] = a[:, 1] = a[:, 2] = ao
kit._set_layer(me, 'bpk_ao', a)
print('built %d objects, %d triangles in %.0f s' % (i, kit.tri_count(big), time.time() - t0), flush=True)
name = 'bench%d' % (N // 1000)
st = kit.export_bpk(name, ao=False, out_dir=os.path.join(ROOT, 'build', 'torture', name))
print('STATS', {k: st[k] for k in ('tris', 'verts', 'bytes', 'seconds', 'pos_step')})
