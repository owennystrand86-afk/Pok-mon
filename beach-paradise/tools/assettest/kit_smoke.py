"""Smoke test of every modelling function of bpkit: runs each once and checks simple invariants in Blender
(closed solids face outwards, sizes are what was asked for, layers hold what was put in). No export.

    /opt/bl/venv/bin/python tools/assettest/kit_smoke.py
"""
import math, os, sys, traceback
d = os.path.dirname(os.path.abspath(__file__))
while not os.path.exists(os.path.join(d, 'models', 'lib', 'bpkit.py')):
    d = os.path.dirname(d)
sys.path.insert(0, os.path.join(d, 'models', 'lib'))
import bpkit as kit
import bpy, bmesh
import numpy as np
from mathutils import Matrix, Vector

RES = []


def check(name, ok, info=''):
    RES.append((name, bool(ok), info))
    print(('PASS ' if ok else 'FAIL ') + name + (': ' + str(info) if not isinstance(info, str) or info else ''), flush=True)


def world_tris(o):
    me = o.data; me.calc_loop_triangles()
    M = np.array(o.matrix_world, np.float64)
    co = np.array([v.co[:] for v in me.vertices], np.float64) @ M[:3, :3].T + M[:3, 3]
    t = np.array([lt.vertices[:] for lt in me.loop_triangles], np.int64)
    if np.linalg.det(M[:3, :3]) < 0:
        t = t[:, ::-1]
    return co, t


def volume(o):
    co, t = world_tris(o)
    a, b, c = co[t[:, 0]], co[t[:, 1]], co[t[:, 2]]
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6)


def closed(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    ok = all(e.is_manifold for e in bm.edges)
    bm.free()
    return ok


def normals_agree(o):
    """share of face corners whose shading normal points to the same side as the face's winding"""
    me = o.data
    bad = 0; n = 0
    for p in me.polygons:
        for li in p.loop_indices:
            n += 1
            if me.corner_normals[li].vector.dot(p.normal) <= 0:
                bad += 1
    return 1 - bad / max(n, 1)


def size(o):
    lo, hi = kit.bounds([o])
    return hi - lo


def run(name, fn):
    try:
        fn()
    except Exception as e:
        traceback.print_exc()
        check(name, False, 'raised %s: %s' % (type(e).__name__, e))


kit.reset()
bpy.context.view_layer.update()
oak = kit.lib('oak'); steel = kit.lib('steel'); red = kit.paint('red', '#c0392b', gloss=0.6)


def t_box():
    o = kit.box('box', (0.2, 0.3, 0.4), (1, 2, 3)); bpy.context.view_layer.update()
    check('box size', np.allclose(size(o), (0.2, 0.3, 0.4), atol=1e-6), size(o))
    check('box volume outward', abs(volume(o) - 0.024) < 1e-6, volume(o))
    b = kit.box('boxb', (0.2, 0.3, 0.4), bevel=0.01, segments=2, mat=oak)
    v = volume(b)
    check('bevelled box outward and closed', 0.0235 < v < 0.024 and closed(b), v)
    check('bevelled box shading normals agree with winding', normals_agree(b) == 1.0, normals_agree(b))
    tag = b.data.attributes.get('bpk_edge')
    vals = np.array([d.value for d in tag.data]) if tag else np.zeros(0)
    check('bevel remembers its faces (bpk_edge > 0 on a convex box)', tag is not None and (vals > 0).sum() > 0 and (vals < 0).sum() == 0, '%d tagged of %d' % ((vals != 0).sum(), len(vals)))


def t_cyl():
    for ax, want in (('z', (0.2, 0.2, 0.5)), ('x', (0.5, 0.2, 0.2)), ('y', (0.2, 0.5, 0.2))):
        o = kit.cylinder('cyl' + ax, 0.1, 0.5, axis=ax, verts=32)
        check('cylinder axis ' + ax + ' size', np.allclose(size(o), want, atol=2e-3), size(o))
        v = volume(o)
        check('cylinder axis ' + ax + ' outward', 0.0150 < v < 0.0158, v)
    o = kit.cylinder('cone', 0.1, 0.5, radius2=0.05, bevel=0.004)
    check('cone frustum with bevel outward, closed', volume(o) > 0 and closed(o), volume(o))
    o = kit.cylinder('pipe', 0.1, 0.5, caps=False)
    check('open cylinder has a border', not closed(o))


def t_sphere():
    o = kit.sphere('sph', 0.5, segments=32, rings=16, scale=(1, 1, 0.5))
    v = volume(o); want = 4 / 3 * math.pi * 0.5 ** 3 * 0.5
    check('sphere volume outward', 0.95 * want < v < want, (v, want))
    check('sphere smooth normals outward', normals_agree(o) == 1.0)


def t_lathe():
    o = kit.lathe('lat', [(0.0, 0.0), (0.1, 0.0), (0.1, 0.2), (0.0, 0.2)], steps=24)
    v = volume(o); want = math.pi * 0.01 * 0.2
    check('lathe (closed with poles) outward', 0.95 * want < v < want and closed(o), (v, want))
    o2 = kit.lathe('lat_rev', [(0.0, 0.2), (0.1, 0.2), (0.1, 0.0), (0.0, 0.0)], steps=24)       # profile given the other way round
    check('lathe with the profile reversed still faces outwards', volume(o2) > 0, volume(o2))
    o3 = kit.lathe('lat_part', [(0.05, 0.0), (0.1, 0.0), (0.1, 0.2), (0.05, 0.2)], steps=12, angle=math.pi)
    check('partial lathe is open and has size', not closed(o3) and size(o3)[0] > 0.19, size(o3))


def t_tube():
    o = kit.tube('tub', [(0, 0, 0), (0, 0, 1)], 0.05, verts=16)
    v = volume(o); want = math.pi * 0.05 ** 2
    check('tube straight outward', 0.95 * want < v < want and closed(o), (v, want))
    uv = np.array([d.uv[:] for d in o.data.uv_layers.active.data])
    check('tube UVs in metres (u along 0..1, v round 0..2 pi r)', abs(uv[:, 0].max() - 1.0) < 0.3 and abs(uv[:, 1].max() - math.tau * 0.05) < 0.02, (uv.min(0), uv.max(0)))
    o = kit.tube('tub2', [(0, 0, 0), (0.3, 0, 0.3), (0.6, 0, 0), (0.9, 0.3, 0)], [0.03, 0.04, 0.03, 0.02], smooth=4, verts=10, squash=(1.0, 0.5), twist=0.3)
    check('tube bent, tapered, squashed, twisted: outward, closed', volume(o) > 0 and closed(o), volume(o))
    o = kit.tube('ring', [(math.cos(a) * 0.3, math.sin(a) * 0.3, 0) for a in np.linspace(0, math.tau, 12, endpoint=False)], 0.02, closed=True, smooth=3)
    want = math.tau * 0.3 * math.pi * 0.02 ** 2
    check('closed tube (ring) outward', 0.85 * want < volume(o) < 1.1 * want and closed(o), (volume(o), want))


def t_surface():
    fn = lambda u, v: (u - 0.5, v - 0.5, 0.1 * np.sin(u * 6) * np.cos(v * 5))
    o = kit.surface('sheet', fn, 10, 10)
    up = sum(p.normal.z * p.area for p in o.data.polygons)
    check('surface front where u, v, n are right-handed (+Z here)', up > 0, up)
    o = kit.surface('sheet_thick', fn, 10, 10, thickness=0.01)
    check('surface with thickness is closed, outward', closed(o) and volume(o) > 0, volume(o))
    lo, hi = kit.bounds([o])
    check('thickness grows away from the normals (below the sheet)', lo[2] < -0.1 - 0.005 and hi[2] < 0.1 + 0.002, (lo[2], hi[2]))
    o = kit.surface('drum', lambda u, v: (0.2 * np.cos(u * math.tau), 0.2 * np.sin(u * math.tau), v), 16, 4, closed_u=True)
    co, t = world_tris(o)
    n = np.cross(co[t[:, 1]] - co[t[:, 0]], co[t[:, 2]] - co[t[:, 0]]); c = co[t].mean(1)
    check('closed_u surface: faces outwards for a counter-clockwise u', ((n[:, :2] * c[:, :2]).sum(1) > 0).all())
    uv = np.array([d.uv[:] for d in o.data.uv_layers.active.data])
    check('surface UVs in metres', abs(uv[:, 0].max() - math.tau * 0.2) < 0.03 and abs(uv[:, 1].max() - 1) < 1e-3, uv.max(0))


def t_strap():
    o = kit.strap('str', [(0, 0, 0), (0.1, 0, 0), (0.2, 0, 0.1)], 0.02, 0.003, smooth=3)
    check('strap outward, closed', volume(o) > 0 and closed(o), volume(o))
    s = size(o)
    check('strap width along width_axis (y)', abs(s[1] - 0.02) < 1e-4, s)


def t_rivet():
    o = kit.rivet('riv', (1, 1, 1), (1, 0, 0), 0.005, washer=0.002)
    lo, hi = kit.bounds([o])
    check('rivet sits at loc and points along the normal', hi[0] > 1.002 and lo[0] > 0.997 and abs((lo[1] + hi[1]) / 2 - 1) < 1e-4, (lo, hi))
    check('rivet outward', volume(o) > 0, volume(o))
    check('rivet keeps only its place (rotation applied to the mesh)', np.allclose(np.array(o.matrix_world)[:3, :3], np.eye(3)))


def t_extrude():
    o = kit.extrude('ext', [(0, 0), (1, 0), (1, 1), (0, 1)], 0.1, holes=[[(0.4, 0.4), (0.4, 0.6), (0.6, 0.6), (0.6, 0.4)]])
    v = volume(o)
    check('extrude with a hole: volume, closed', abs(v - (1 - 0.04) * 0.1) < 1e-5 and closed(o), v)
    o = kit.extrude('ext_cw', [(0, 0), (0, 1), (1, 1), (1, 0)], 0.1)        # clockwise outline
    check('extrude of a clockwise outline still faces outwards', abs(volume(o) - 0.1) < 1e-6, volume(o))
    lo, hi = kit.bounds([o])
    check('extrude goes from z = 0 up', abs(lo[2]) < 1e-6 and abs(hi[2] - 0.1) < 1e-6, (lo[2], hi[2]))


def t_edit():
    o = kit.box('sub', (1, 1, 1)); kit.subdivide(o, 2)
    v = volume(o)
    check('subdivide (Catmull-Clark) shrinks towards a ball, outward', 0.25 < v < 0.8, v)
    o = kit.box('sub2', (1, 1, 1)); kit.subdivide(o, 2, crease_angle=30)
    check('subdivide with creased edges keeps the box', abs(volume(o) - 1) < 1e-3, volume(o))
    o = kit.box('sub3', (1, 1, 1)); kit.subdivide(o, 1, simple=True)
    check('subdivide simple keeps the shape, 4x faces', abs(volume(o) - 1) < 1e-6 and len(o.data.polygons) == 24, len(o.data.polygons))
    p = kit.mesh_object('pl', [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2, 3)])
    kit.solidify(p, 0.1)
    lo, hi = kit.bounds([p])
    check('solidify grows away from the normal by default', closed(p) and abs(volume(p) - 0.1) < 1e-6 and abs(lo[2] + 0.1) < 1e-6 and abs(hi[2]) < 1e-6, (lo[2], hi[2], volume(p)))
    p = kit.mesh_object('pl2', [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2, 3)])
    kit.rim(p, 0.05)
    lo, hi = kit.bounds([p])
    check('rim turns the border down against the normal', abs(lo[2] + 0.05) < 1e-6 and len(p.data.polygons) == 5 and normals_agree(p) == 1, (lo[2], len(p.data.polygons)))
    up = [q.normal.z for q in p.data.polygons if abs(q.normal.z) > 0.9]
    check('rim keeps the sheet facing the way it did', len(up) == 1 and up[0] > 0, up)
    out = [q.normal.dot(q.center - Vector((0.5, 0.5, 0))) for q in p.data.polygons if abs(q.normal.z) < 0.5]
    check('rim faces look outwards', len(out) == 4 and min(out) > 0, out)
    w = kit.surface('wavy', lambda u, v: (u - 0.5, v - 0.5, 0.1 * np.sin(u * 3)), 8, 8, mat=steel)
    n0 = len(w.data.polygons); kit.rim(w, 0.05)
    lo, hi = kit.bounds([w])
    new = list(w.data.polygons)[n0:]
    check('rim on a curved smooth sheet: 5 cm down, new faces smooth like the sheet, sheet still faces up', abs(lo[2] + 0.05) < 4e-3 and len(new) == 32 and all(q.use_smooth for q in new)
          and sum(q.normal.z * q.area for q in list(w.data.polygons)[:n0]) > 0, (lo[2], len(new)))
    p3 = kit.mesh_object('pl3', [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2, 3)]); kit.rim(p3, 0.05, direction=(1, 0, -1))
    lo, hi = kit.bounds([p3])
    check('rim along a given direction', abs(lo[2] + 0.05 / math.sqrt(2)) < 1e-6 and abs(hi[0] - 1 - 0.05 / math.sqrt(2)) < 1e-6, (lo, hi))
    h = kit.box('half', (0.5, 1, 1), (0.25, 0, 0)); kit.mirror(h, 'x')
    check('mirror modifier: whole box, merged, outward', abs(volume(h) - 1) < 1e-6 and closed(h), (volume(h), len(h.data.vertices)))
    a = kit.box('ba', (1, 1, 1)); c = kit.cylinder('bc', 0.2, 2)
    kit.boolean(a, c)
    want = 1 - math.pi * 0.04 * 0.99
    check('boolean difference: volume, closed, cutter removed', abs(volume(a) - (1 - 0.1243)) < 4e-3 and closed(a) and bpy.data.objects.get('bc') is None, volume(a))
    s = kit.sphere('dec', 0.5, segments=48, rings=24); n0 = kit.tri_count([s]); kit.decimate(s, 0.25)
    check('decimate to a quarter', 0.2 < kit.tri_count([s]) / n0 < 0.3 and volume(s) > 0, kit.tri_count([s]) / n0)
    d = kit.box('def', (1, 1, 1)); kit.deform(d, lambda P: P * np.array([2.0, 1, 1]))
    check('deform', abs(size(d)[0] - 2) < 1e-6)
    t = kit.box('tr', (1, 1, 1)); kit.transform(t, Matrix.Scale(-1, 4, (1, 0, 0)) @ Matrix.Translation((2, 0, 0)))
    check('transform by a mirroring matrix keeps faces outward', abs(volume(t) - 1) < 1e-6, volume(t))


def t_copies():
    src = kit.box('src', (0.2, 0.4, 0.6), (1, 0, 0), bevel=0.01, mat=oak)
    dup = kit.duplicate(src, 'dup', loc=(-1, 0, 0)); dup.scale = (-1, 1, 1)
    bpy.context.view_layer.update()
    check('negative-scale copy: world volume positive (winding handled by callers)', volume(dup) > 0, volume(dup))
    kit.apply_transform(dup)
    bpy.context.view_layer.update()
    check('apply_transform on a mirrored object: outward, unscaled, normals agree', volume(dup) > 0 and tuple(dup.scale) == (1, 1, 1) and normals_agree(dup) == 1, (volume(dup), tuple(dup.scale), normals_agree(dup)))
    a = kit.box('ja', (0.2, 0.2, 0.2), (0, 0, 0), mat=oak); b = kit.box('jb', (0.2, 0.2, 0.2), (1, 0, 0), mat=steel); b.scale = (-1, 2, 1)
    j = kit.join([a, b], 'joined')
    bpy.context.view_layer.update()
    check('join: two materials kept, mirrored member outward, no transform', len(j.data.materials) == 2 and abs(volume(j) - 0.024) < 1e-6 and np.allclose(np.array(j.matrix_world), np.eye(4)), (len(j.data.materials), volume(j)))
    mats = sorted({j.data.materials[p.material_index].name for p in j.data.polygons})
    check('join: faces keep their own material', mats == ['oak', 'steel'], mats)
    o = kit.box('org', (1, 1, 1), (5, 5, 5)); kit.set_origin(o, (5, 5, 4.5))
    lo, hi = kit.bounds([o])
    check('set_origin moves the origin, not the mesh', np.allclose(o.matrix_world.translation, (5, 5, 4.5)) and np.allclose(lo, (4.5, 4.5, 4.5)), (tuple(o.matrix_world.translation), lo))
    pr = kit.part('prt', [o], pivot=(5, 5, 4.5), rot=(0.3, 0.2, 0.1))
    lo2, hi2 = kit.bounds([o])
    check('part: attached objects stay where they stand', np.allclose(lo, lo2) and np.allclose(hi, hi2), (lo2, hi2))
    kit.set_material(o, steel)
    kit.set_material(o, red, where=lambda c, n: n.z > 0.5)
    names = [o.data.materials[p.material_index].name for p in o.data.polygons]
    check('set_material whole and by face', sorted(set(names)) == ['red', 'steel'] and names.count('red') == 1, names)


def t_layers():
    o = kit.box('lay', (1, 1, 1), (0, 0, 0.5), mat=oak)
    kit.ensure_layers(o)
    pbr = kit._get_layer(o.data, 'bpk_pbr')
    check('ensure_layers fills roughness/metal/weight from the material', np.allclose(pbr[:, 0], 0.62) and np.allclose(pbr[:, 1], 0) and np.allclose(pbr[:, 2], 1.0), pbr[0])
    kit.tint(o, '#808080')
    c = kit._get_layer(o.data, 'Col')
    check('tint by a colour multiplies (linear) Col', np.allclose(c[:, :3], kit.rgb('#808080'), atol=1e-5), c[0])
    kit.tint(o, fn=lambda P, N: np.where(N[:, 2:3] > 0.5, 2.0, 1.0) * np.ones((1, 3)))
    c2 = kit._get_layer(o.data, 'Col')
    top = np.array([o.data.polygons[f].normal.z > 0.5 for f in kit._face_of_loop(o.data)])
    check('tint by a function of world position and normal', np.allclose(c2[top, 0], c[top, 0] * 2) and np.allclose(c2[~top, 0], c[~top, 0]))
    kit.gradient(o, 'z', color_lo='#000000', color_hi='#ffffff')
    c3 = kit._get_layer(o.data, 'Col'); P, _ = kit._corner_world(o)
    check('gradient along z', np.allclose(c3[P[:, 2] < 0.01, :3], 0) and np.allclose(c3[P[:, 2] > 0.99, 0], c2[P[:, 2] > 0.99, 0]))
    kit.set_pbr(o, rough=0.1, metal=0.9, weight=0.5)
    pbr = kit._get_layer(o.data, 'bpk_pbr')
    check('set_pbr constants', np.allclose(pbr[:, :3], (0.1, 0.9, 0.5)))
    kit.set_pbr(o, fn=lambda P, N: dict(rough=P[:, 2]))
    pbr = kit._get_layer(o.data, 'bpk_pbr')
    check('set_pbr by function', np.allclose(pbr[:, 0], np.clip(P[:, 2], 0, 1), atol=1e-6))
    o2 = kit.box('coat', (1, 1, 1), (3, 0, 0.5), mat=steel)
    kit.coat(o2, lambda P, N: (N[:, 2] > 0.5).astype(float), color='#c0392b', rough=0.4, metal=0.0)
    c = kit._get_layer(o2.data, 'Col'); pbr = kit._get_layer(o2.data, 'bpk_pbr')
    top = np.array([o2.data.polygons[f].normal.z > 0.5 for f in kit._face_of_loop(o2.data)])
    final = c[:, :3] * np.array(kit.mat_def(steel)['color'])
    check('coat: the masked faces take the colour (after the base colour multiplies) and the finish', np.allclose(final[top], kit.rgb('#c0392b'), atol=2e-4) and np.allclose(pbr[top, :2], (0.4, 0.0)) and np.allclose(pbr[~top, 1], 1.0), (final[top][0], kit.rgb('#c0392b')))
    o3 = kit.box('wear', (0.3, 0.3, 0.3), (5, 0, 0.15), mat=red, bevel=0.01)
    kit.wear(o3, amount=1.0, color=kit.linear(0.56, 0.57, 0.58), rough=0.3, metal=1.0, breakup=0.0)
    pbr = kit._get_layer(o3.data, 'bpk_pbr')
    tag = np.array([d.value for d in o3.data.attributes['bpk_edge'].data])[kit._face_of_loop(o3.data)]
    check('wear: bevel faces go to bare metal, big faces keep their paint', np.allclose(pbr[tag > 0, 1], 1.0) and np.allclose(pbr[tag == 0, 1], 0.0), (pbr[tag > 0, 1].min(), pbr[tag == 0, 1].max()))
    o4 = kit.sphere('vary', 0.3, (7, 0, 0.3), mat=oak)
    kit.vary(o4, value=0.1, hue=0.05, noise=0.1)
    c = kit._get_layer(o4.data, 'Col')
    check('vary changes Col moderately', 0.7 < c[:, :3].min() and c[:, :3].max() < 1.4 and c[:, :3].std() > 0.005, (c[:, :3].min(), c[:, :3].max()))
    n = kit.noise3(np.random.default_rng(1).uniform(-5, 5, (20000, 3)), 0.5, 3, 1)
    check('noise3 stays in 0..1 and is centred', n.min() >= 0 and n.max() <= 1 and 0.4 < n.mean() < 0.6, (n.min(), n.max(), n.mean()))


def t_uv():
    o = kit.box('uvb', (2.0, 0.1, 0.3), (10, 0, 0), mat=oak)
    kit.uv_box(o, offset=(0, 0))
    uv = np.array([d.uv[:] for d in o.data.uv_layers.active.data])
    check('uv_box: metres, grain along the longest axis (U spans 2 m)', abs(np.ptp(uv[:, 0]) - 2.0) < 1e-5 and np.ptp(uv[:, 1]) <= 0.3 + 1e-5, (np.ptp(uv[:, 0]), np.ptp(uv[:, 1])))
    kit.uv_box(o, grain='z', offset=(0, 0), scale=2.0)
    uv = np.array([d.uv[:] for d in o.data.uv_layers.active.data])
    check('uv_box: grain axis and scale', abs(np.ptp(uv[:, 0]) - 4.0) < 1e-5, np.ptp(uv[:, 0]))
    kit.uv_box(o); a = np.array([d.uv[:] for d in o.data.uv_layers.active.data]); kit.uv_box(o); b = np.array([d.uv[:] for d in o.data.uv_layers.active.data])
    check('uv_box auto offset is the same every run', np.allclose(a, b))
    c = kit.cylinder('uvt', 0.05, 1.0, (12, 0, 0), mat=oak, verts=16)
    kit.uv_tube(c, offset=(0, 0))
    uv = np.array([d.uv[:] for d in c.data.uv_layers.active.data])
    side = np.array([len(p.vertices) == 4 for p in c.data.polygons])[kit._face_of_loop(c.data)]
    check('uv_tube: U along the axis in metres, V the way round', abs(np.ptp(uv[side, 0]) - 1.0) < 1e-5 and abs(np.ptp(uv[side, 1]) - math.tau * 0.05) < 2e-3, (np.ptp(uv[side, 0]), np.ptp(uv[side, 1])))
    # no face may be stretched across the seam
    worst = 0.0
    for p in c.data.polygons:
        if len(p.vertices) == 4:
            vs = [c.data.uv_layers.active.data[i].uv[1] for i in p.loop_indices]
            worst = max(worst, max(vs) - min(vs))
    check('uv_tube: no face wraps back across the seam', worst < math.tau * 0.05 / 16 * 1.5, worst)
    s = kit.sphere('uvs', 0.5, (14, 0, 0), mat=oak)
    kit.uv_smart(s)
    me = s.data; me.calc_loop_triangles()
    uv = np.array([d.uv[:] for d in me.uv_layers.active.data])
    a3 = sum(t.area for t in me.loop_triangles)
    a2 = 0.0
    for t in me.loop_triangles:
        p0, p1, p2 = [uv[i] for i in t.loops]
        a2 += abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0])) / 2
    check('uv_smart: UV area equals surface area (metres)', abs(a2 / a3 - 1) < 0.02, a2 / a3)


def t_ao():
    post = kit.box('post', (0.1, 0.1, 1.0), (20, 0, 0.5), mat=oak)
    slab = kit.box('slabao', (1.0, 1.0, 0.1), (20, 0, 1.05), mat=oak)
    n0 = kit.tri_count([post, slab])
    kit.bake_ao([post, slab], ground=0.0, samples=16, refine=1.0)
    ao = kit._get_layer(post.data, 'bpk_ao')[:, 0]; P, N = kit._corner_world(post)
    side = np.abs(N[:, 2]) < 0.5
    mid = side & (np.abs(P[:, 2] - 0.5) < 0.3)
    lowv, midv, hiv = ao[side & (P[:, 2] < 0.02)].mean(), ao[mid].mean() if mid.any() else float('nan'), ao[side & (P[:, 2] > 0.98)].mean()
    check('bake_ao: a post is darker at the ground and under the slab than half-way up', lowv < 0.78 and hiv < 0.78 and midv > lowv + 0.1 and midv > hiv + 0.1, (lowv, midv, hiv))
    check('bake_ao: refine added vertices where the shade changes along the post', kit.tri_count([post, slab]) > n0, (n0, kit.tri_count([post, slab])))
    top = kit._get_layer(slab.data, 'bpk_ao')[:, 0]; Ps, Ns = kit._corner_world(slab)
    check('bake_ao: the open top of the slab is unshaded', top[Ns[:, 2] > 0.5].min() > 0.9, top[Ns[:, 2] > 0.5].min())
    kit.dirt([post], amount=1.0, color='#000000')
    c = kit._get_layer(post.data, 'Col')[:, :3]
    check('dirt darkens the nooks the occlusion found, not the open faces', c[side & (P[:, 2] < 0.02)].mean() < 0.9 * c[mid].mean(), (c[side & (P[:, 2] < 0.02)].mean(), c[mid].mean() if mid.any() else None))
    sh = kit.ground_shadow([post, slab], z=0.0, cell=0.1, samples=16)
    a = kit._get_layer(sh.data, 'Col')[:, 3]; Pg, _ = kit._corner_world(sh)
    near = np.hypot(Pg[:, 0] - 20, Pg[:, 1]) < 0.12; far = np.hypot(Pg[:, 0] - 20, Pg[:, 1]) > 1.2
    check('ground_shadow: dark under the model, clear away from it, marked as shadow', a[near].mean() > 0.3 and (not far.any() or a[far].max() < 0.2) and sh.get('bpk_shadow') and abs(Pg[:, 2].mean() - 0.004) < 1e-6, (a[near].mean(), a[far].max() if far.any() else None))


def t_names():
    kit.box('grip', (0.1, 0.1, 0.1))
    a = kit.anchor('grip', (0, 0, 1)); pt = kit.part('lid', [kit.box('lid', (0.1, 0.1, 0.1), (1, 0, 0))], pivot=(1, 0, 0))
    check('an anchor and a part called like a mesh keep the name they were given', kit._given_name(a) == 'grip' and kit._given_name(pt) == 'lid' and a.name != 'grip', (a.name, pt.name))


for name, fn in (('names', t_names), ('box', t_box), ('cylinder', t_cyl), ('sphere', t_sphere), ('lathe', t_lathe), ('tube', t_tube), ('surface', t_surface),
                 ('strap', t_strap), ('rivet', t_rivet), ('extrude', t_extrude), ('editing', t_edit), ('copies', t_copies), ('layers', t_layers),
                 ('uv', t_uv), ('ao', t_ao)):
    run(name, fn)
bad = [r for r in RES if not r[1]]
print('\nkit smoke test: %d checks, %d failed' % (len(RES), len(bad)))
for r in bad:
    print('  FAIL', r[0], r[2])
