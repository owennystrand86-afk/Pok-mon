"""bpkit: the shared Blender toolkit every Beach Paradise asset script imports.

    import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
    import bpkit as kit

    kit.reset()
    oak = kit.lib('oak')
    leg = kit.box('leg', (0.06, 0.06, 0.4), (0, 0, 0.2), mat=oak, bevel=0.004)
    kit.uv_box(leg)
    kit.export_bpk('stool')                 # -> models/out/stool.bpk
    kit.preview('stool')                    # -> build/preview/stool_<view>.png

Conventions (see DEVELOPING.md, '3D assets made in Blender'):
  * Blender units are metres, Z is up, the model's FRONT faces -Y (Blender's front view looks at it).
    export_bpk() turns that into the game's Y up / -Z forward:  (x, y, z) -> (-x, z, y).
  * Colours passed to this module are sRGB, the way they look on screen ('#c8a36a' or (0.78, 0.64, 0.42));
    wrap a triple in kit.linear(...) if it is already linear light (metal reflectances from a table).
  * A material made with kit.material()/kit.lib() exists twice: as a Blender material (a Principled BSDF
    for the preview renders) and as a game-side definition that travels in the .bpk.
  * Per-corner layers on every mesh (colour attributes, made on demand):
        Col      tint that multiplies the material's base colour (rgb) and opacity (a)
        bpk_pbr  r = roughness, g = metalness, b = weight (detail strength, or sway weight)
        bpk_ao   baked ambient occlusion (r)
  * Moving parts are made with kit.part(); named points for the game code with kit.anchor().
Run asset scripts with /opt/bl/venv/bin/python (Blender as a module, Cycles on the CPU).
"""
import bpy, bmesh, hashlib, io, json, math, os, struct, sys, time
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bptex  # noqa: E402

KIT_VERSION = '1.0'
LIB_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(LIB_DIR))            # beach-paradise/
OUT_DIR = os.path.join(ROOT, 'models', 'out')
PREVIEW_DIR = os.path.join(ROOT, 'build', 'preview')
TMP_DIR = os.path.join(ROOT, 'build', '.bpkit')

_S = {'images': {}}                                          # per-scene state (cleared by reset)
TAU = math.tau


def log(*a):
    print('[bpkit]', *a, flush=True)


# ───────────────────────────── colour ─────────────────────────────
def _s2l(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((np.maximum(c, 0) + 0.055) / 1.055) ** 2.4)


def _l2s(c):
    c = np.clip(np.asarray(c, np.float64), 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


class linear(tuple):
    """Mark a colour triple as linear light:  kit.linear(0.56, 0.57, 0.58)."""
    def __new__(cls, r, g=None, b=None):
        return super().__new__(cls, r if g is None else (r, g, b))


def rgb(c):
    """Any colour spec ('#rgb', '#rrggbb', 0xrrggbb, sRGB triple, kit.linear triple) -> linear (r, g, b)."""
    if isinstance(c, linear):
        return tuple(float(x) for x in c[:3])
    if isinstance(c, str):
        h = c.lstrip('#')
        if len(h) == 3:
            h = ''.join(ch * 2 for ch in h)
        c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    elif isinstance(c, int):
        c = [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]
    return tuple(float(x) for x in _s2l(list(c)[:3]))


# ───────────────────────────── scene ─────────────────────────────
def reset():
    """Start from an empty scene: metres, Cycles on the CPU, nothing left over from an earlier asset."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1.0
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    _S.clear(); _S['images'] = {}
    return sc


def _link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _update():
    bpy.context.view_layer.update()


def export_objects():
    """Every mesh object in the scene that is not a helper (helpers have names starting with '_')."""
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.name.startswith('_')]


def _as_list(objs):
    if objs is None:
        return export_objects()
    if isinstance(objs, bpy.types.Object):
        return [objs]
    return [o for o in objs if o is not None]


# ───────────────────────────── images ─────────────────────────────
def image(name, pixels, srgb=True, fmt='WEBP', quality=82, wrap='repeat'):
    """Register an image that materials can use (map=name or detail=name) and that travels inside the .bpk.
    pixels: uint8 or 0..1 float array (h, w), (h, w, 3) or (h, w, 4), top row first.
    srgb=True for colour pictures (leaf atlas, dial face), False for data (detail maps)."""
    from PIL import Image
    a = np.asarray(pixels)
    if a.dtype != np.uint8:
        a = np.clip(np.rint(a.astype(np.float64) * 255), 0, 255).astype(np.uint8)
    mode = 'L' if a.ndim == 2 else ('RGB' if a.shape[2] == 3 else 'RGBA')
    im = Image.fromarray(a, mode)
    buf = io.BytesIO()
    fmt = fmt.upper()
    if fmt == 'WEBP':
        im.save(buf, 'WEBP', quality=quality, method=6)
    elif fmt in ('JPG', 'JPEG'):
        fmt = 'JPEG'; im.convert('L' if mode == 'L' else 'RGB').save(buf, 'JPEG', quality=quality, optimize=True)
    else:
        fmt = 'PNG'; im.save(buf, 'PNG', optimize=True)
    data = buf.getvalue()
    os.makedirs(TMP_DIR, exist_ok=True)
    png = os.path.join(TMP_DIR, name + '.png'); im.save(png)          # what Blender's preview material reads
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    bimg = bpy.data.images.load(png); bimg.name = name
    bimg.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    _S['images'][name] = dict(name=name, mime='image/' + fmt.lower(), data=data, w=a.shape[1], h=a.shape[0],
                              srgb=bool(srgb), wrap=wrap, alpha=mode == 'RGBA')
    return name


# the three ways a detail texture acts, per kind: (base colour, roughness, relief depth in metres)
DETAIL_K = {'wood': (0.42, 0.22, 0.00035), 'brushed': (0.16, 0.30, 0.00008), 'weave': (0.30, 0.10, 0.00030), 'grunge': (0.20, 0.25, 0.00012)}


def detail_texture(kind):
    """One of the built-in tileable detail textures ('wood', 'brushed', 'weave', 'grunge'), registered once."""
    name = 'detail_' + kind
    if name not in _S['images']:
        image(name, bptex.GENERATORS[kind](), srgb=False, quality=80)
        _S['images'][name]['tile'] = bptex.TILE_M[kind]
        _S['images'][name]['k'] = DETAIL_K[kind]
    return name


# ───────────────────────────── materials ─────────────────────────────
def material(name, color=(0.8, 0.8, 0.8), rough=0.6, metal=0.0, *, alpha=1.0, blend='opaque', alpha_test=0.5,
             emissive=None, emissive_strength=1.0, double_sided=False, cast_shadow=True, receive_shadow=True,
             detail=None, detail_strength=1.0, detail_scale=1.0, map=None, coat=0.0, coat_rough=0.08,
             env=1.0, sway=0.0, own=False, flags=None):
    """Make a material: a Blender Principled BSDF for the previews AND the game-side definition.

    color            base colour (sRGB; see rgb()). Vertex colours (the 'Col' layer) multiply it.
    rough, metal     0..1. Can be varied per corner afterwards (kit.wear, kit.set_pbr).
    alpha, blend     'opaque' | 'cutout' (alpha_test) | 'blend' (see-through, sorted) | 'add' (glow) |
                     'shadow' (only darkens what is behind it by the vertex alpha: see ground_shadow)
    emissive         colour of emitted light (sRGB) x emissive_strength; None for none
    double_sided     draw both faces (thin sheets: cloth, leaves, fins)
    cast_shadow, receive_shadow
    detail           tileable detail texture: 'wood' | 'brushed' | 'weave' | 'grunge' (needs UVs in metres,
                     see uv_box / uv_tube); detail_strength 0..1 (also per corner: bpk_pbr.b), detail_scale
                     enlarges (>1) or shrinks the pattern
    map              name of a colour image registered with kit.image(): multiplies the base colour, its
                     alpha drives cutout/blend. Uses the mesh's UVs as they are (0..1 atlas).
    coat             clear coat 0..1 (gelcoat, car paint, varnish) with coat_rough
    env              how much sky the surface mirrors (1 outdoors; lower for things that live indoors)
    sway             metres the wind moves a vertex whose weight (bpk_pbr.b) is 1 (flags, canvas, fringes)
    own              True: never merged with other materials and never shared between assets, so the game
                     can find it by name and change it (lights that switch on, parts that get a tint)
    flags            free-form dict passed through to the game untouched
    Materials that draw the same way are merged into ONE draw call per node by the exporter (their
    colour, roughness and metalness travel per vertex), so use as many as the model needs."""
    lin = rgb(color)
    d = dict(name=name, color=[round(x, 5) for x in lin], rough=float(rough), metal=float(metal), alpha=float(alpha),
             blend=blend, alpha_test=float(alpha_test), double=bool(double_sided), cast=bool(cast_shadow),
             receive=bool(receive_shadow), detail=detail, detail_strength=float(detail_strength),
             detail_scale=float(detail_scale), map=map, coat=float(coat), coat_rough=float(coat_rough),
             env=float(env), sway=float(sway), own=bool(own), flags=flags or {})
    d['emissive'] = [round(x * emissive_strength, 5) for x in rgb(emissive)] if emissive is not None else None
    if detail:
        detail_texture(detail)
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat['bpk'] = json.dumps(d)
    _build_nodes(mat, d)
    return mat


def mat_def(mat):
    """The game-side definition of a Blender material (a plain grey one if it was not made by this kit)."""
    if mat is not None and 'bpk' in mat:
        return json.loads(mat['bpk'])
    base = list(mat.diffuse_color[:3]) if mat is not None else [0.6, 0.6, 0.6]
    return dict(name=mat.name if mat else 'default', color=base, rough=0.6, metal=0.0, alpha=1.0, blend='opaque',
                alpha_test=0.5, double=False, cast=True, receive=True, detail=None, detail_strength=1.0,
                detail_scale=1.0, map=None, coat=0.0, coat_rough=0.08, env=1.0, sway=0.0, own=False, flags={}, emissive=None)


def _build_nodes(mat, d):
    """A Principled BSDF that reads the same per-corner layers the exporter does, so previews match the game."""
    nt = mat.node_tree
    if nt is None:
        mat.use_nodes = True; nt = mat.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial'); out.location = (500, 0)
    p = N.new('ShaderNodeBsdfPrincipled'); p.location = (200, 0)
    L.new(p.outputs['BSDF'], out.inputs['Surface'])
    col = N.new('ShaderNodeAttribute'); col.attribute_name = 'Col'; col.location = (-700, 200)
    pbr = N.new('ShaderNodeAttribute'); pbr.attribute_name = 'bpk_pbr'; pbr.location = (-700, -100)
    sep = N.new('ShaderNodeSeparateColor'); sep.location = (-500, -100); L.new(pbr.outputs['Color'], sep.inputs['Color'])

    def sock(coll, ident):
        return next(s_ for s_ in coll if s_.identifier == ident)

    def mix(a, b, kind='MULTIPLY', fac=1.0):
        m = N.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.blend_type = kind; sock(m.inputs, 'Factor_Float').default_value = fac
        for ident, v in (('A_Color', a), ('B_Color', b)):
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, sock(m.inputs, ident))
            else:
                sock(m.inputs, ident).default_value = (*v, 1.0)
        return sock(m.outputs, 'Result_Color')

    def math_node(op, a, b=None, clamp=False):
        m = N.new('ShaderNodeMath'); m.operation = op; m.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, m.inputs[i])
            else:
                m.inputs[i].default_value = v
        return m.outputs[0]

    base = mix(d['color'], col.outputs['Color'])
    rough, weight = sep.outputs['Red'], sep.outputs['Blue']
    if d.get('map'):
        tex = N.new('ShaderNodeTexImage'); tex.image = bpy.data.images[d['map']]; tex.location = (-700, 500)
        base = mix(base, tex.outputs['Color'])
        alpha = math_node('MULTIPLY', math_node('MULTIPLY', col.outputs['Alpha'], tex.outputs['Alpha']), d['alpha'])
    else:
        alpha = math_node('MULTIPLY', col.outputs['Alpha'], d['alpha'])
    if d.get('detail'):
        info = _S['images']['detail_' + d['detail']]
        ka, kr, kb = info['k']; tu, tv = info['tile']
        uv = N.new('ShaderNodeUVMap'); uv.location = (-1300, 600)
        mp = N.new('ShaderNodeMapping'); mp.location = (-1100, 600)
        s = 1.0 / d['detail_scale']
        mp.inputs['Scale'].default_value = (s / tu, s / tv, 1.0)
        L.new(uv.outputs['UV'], mp.inputs['Vector'])
        tex = N.new('ShaderNodeTexImage'); tex.image = bpy.data.images['detail_' + d['detail']]; tex.location = (-900, 600)
        L.new(mp.outputs['Vector'], tex.inputs['Vector'])
        dv = tex.outputs['Color']
        dm = math_node('SUBTRACT', dv, 0.5)                                        # -0.5 .. 0.5
        k = math_node('MULTIPLY', weight, 2.0 * ka)
        fac = math_node('ADD', math_node('MULTIPLY', dm, k), 1.0)                  # 1 + 2 ka w (d - 0.5)
        comb = N.new('ShaderNodeCombineColor'); [L.new(fac, comb.inputs[i]) for i in range(3)]
        base = mix(base, comb.outputs['Color'])
        rough = math_node('SUBTRACT', rough, math_node('MULTIPLY', dm, math_node('MULTIPLY', weight, kr)), clamp=True)
        bump = N.new('ShaderNodeBump'); bump.inputs['Distance'].default_value = kb * 3.0
        L.new(weight, bump.inputs['Strength']); L.new(dv, bump.inputs['Height'])
        L.new(bump.outputs['Normal'], p.inputs['Normal'])
    L.new(base, p.inputs['Base Color'])
    L.new(rough, p.inputs['Roughness'])
    L.new(sep.outputs['Green'], p.inputs['Metallic'])
    if d['blend'] != 'opaque':
        L.new(alpha, p.inputs['Alpha'])
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED' if d['blend'] in ('blend', 'add') else 'DITHERED'
    if d['coat'] > 0:
        p.inputs['Coat Weight'].default_value = d['coat']; p.inputs['Coat Roughness'].default_value = d['coat_rough']
    if d.get('emissive'):
        e = d['emissive']; m = max(max(e), 1e-6)
        p.inputs['Emission Color'].default_value = (e[0] / m, e[1] / m, e[2] / m, 1.0)
        p.inputs['Emission Strength'].default_value = m
    mat.diffuse_color = (*[float(x) for x in _l2s(d['color'])], 1.0)
    mat.use_backface_culling = not d['double']


# The shared material library. Colours are sRGB; metals are their measured reflectance (linear).
LIB = {
    # timber
    'ash':        dict(color='#c9a779', rough=0.58, detail='wood', detail_strength=0.9),
    'oak':        dict(color='#a8804f', rough=0.62, detail='wood'),
    'pine':       dict(color='#d3b17d', rough=0.66, detail='wood', detail_strength=0.8),
    'teak':       dict(color='#9a6a3c', rough=0.60, detail='wood'),
    'teak_grey':  dict(color='#9b9388', rough=0.82, detail='wood', detail_strength=0.8),   # weathered silver
    'mahogany':   dict(color='#6d3a25', rough=0.50, detail='wood', detail_strength=0.8),
    'cedar':      dict(color='#b06c43', rough=0.66, detail='wood'),
    'walnut':     dict(color='#5b4030', rough=0.55, detail='wood', detail_strength=0.8),
    'driftwood':  dict(color='#a59c8f', rough=0.90, detail='wood', detail_strength=0.7),
    'log_bark':   dict(color='#5a4636', rough=0.95, detail='grunge'),
    'plywood':    dict(color='#c8a777', rough=0.70, detail='wood', detail_strength=0.6, detail_scale=1.6),
    # bare metals
    'steel':          dict(color=linear(0.56, 0.57, 0.58), rough=0.42, metal=1.0, detail='brushed'),
    'steel_polished': dict(color=linear(0.60, 0.61, 0.62), rough=0.20, metal=1.0, detail='brushed', detail_strength=0.5),
    'steel_dark':     dict(color=linear(0.16, 0.17, 0.18), rough=0.50, metal=1.0, detail='grunge'),      # blued / black oxide
    'stainless':      dict(color=linear(0.63, 0.62, 0.60), rough=0.28, metal=1.0, detail='brushed', detail_strength=0.6),
    'chrome':         dict(color=linear(0.55, 0.56, 0.56), rough=0.06, metal=1.0),
    'galvanised':     dict(color=linear(0.62, 0.64, 0.66), rough=0.48, metal=1.0, detail='grunge'),
    'cast_iron':      dict(color=linear(0.22, 0.22, 0.22), rough=0.72, metal=1.0, detail='grunge'),
    'aluminium':      dict(color=linear(0.91, 0.92, 0.92), rough=0.36, metal=1.0, detail='brushed', detail_strength=0.5),
    'brass':          dict(color=linear(0.89, 0.72, 0.36), rough=0.30, metal=1.0, detail='brushed', detail_strength=0.4),
    'bronze':         dict(color=linear(0.71, 0.48, 0.26), rough=0.42, metal=1.0, detail='grunge', detail_strength=0.6),
    'copper':         dict(color=linear(0.95, 0.64, 0.54), rough=0.32, metal=1.0, detail='brushed', detail_strength=0.4),
    'rust':           dict(color='#7a4226', rough=0.90, metal=0.15, detail='grunge'),
    # coatings and plastics
    'rubber':         dict(color='#1b1b1c', rough=0.85, detail='grunge', detail_strength=0.5),
    'plastic_black':  dict(color='#19191b', rough=0.45),
    'plastic_white':  dict(color='#e9e9e6', rough=0.42),
    'gelcoat_white':  dict(color='#eeeeea', rough=0.22, coat=1.0, coat_rough=0.05),
    'enamel_white':   dict(color='#ecebe6', rough=0.30),
    'concrete':       dict(color='#9b9a94', rough=0.92, detail='grunge'),
    # cloth, rope, skin of things
    'canvas':         dict(color='#d9cfb4', rough=0.92, detail='weave'),
    'canvas_white':   dict(color='#efede6', rough=0.90, detail='weave'),
    'rope':           dict(color='#b39a6c', rough=0.95, detail='weave', detail_scale=0.6),
    'leather':        dict(color='#5a3a26', rough=0.62, detail='grunge', detail_strength=0.7),
    'cork':           dict(color='#b08a5e', rough=0.90, detail='grunge'),
    # see-through
    'glass':          dict(color='#cfe6e6', rough=0.04, alpha=0.28, blend='blend'),
}


def lib(key, name=None, **over):
    """A material from the shared library (LIB), optionally renamed and with fields overridden:
    kit.lib('teak'), kit.lib('steel', 'blade_steel', rough=0.3)."""
    if key not in LIB:
        raise KeyError('no library material %r; have: %s' % (key, ', '.join(sorted(LIB))))
    name = name or key
    if not over and bpy.data.materials.get(name) is not None and 'bpk' in bpy.data.materials[name]:
        return bpy.data.materials[name]
    return material(name, **{**LIB[key], **over})


def paint(name, color, gloss=0.5, **kw):
    """Paint on anything: gloss 0 (chalky) .. 1 (wet-look enamel)."""
    return material(name, color, rough=0.75 - 0.6 * gloss, **{'detail': 'grunge', 'detail_strength': 0.35, **kw})


def plastic(name, color, rough=0.42, **kw):
    return material(name, color, rough=rough, **kw)


def fabric(name, color, **kw):
    """Woven cloth (canvas, towelling, sail). Thin sheets usually want double_sided=True."""
    return material(name, color, **{'rough': 0.92, 'detail': 'weave', **kw})


def gelcoat(name, color, **kw):
    """Glossy boat/fibreglass finish with a clear coat."""
    return material(name, color, **{'rough': 0.24, 'coat': 1.0, 'coat_rough': 0.05, **kw})


# ───────────────────────────── making meshes ─────────────────────────────
def mesh_object(name, verts, faces, mat=None, uvs=None, smooth=False):
    """A mesh object from points and faces (lists of vertex indices). uvs: one (u, v) per face corner, face by face."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    me.update()
    if uvs is not None:
        layer = me.uv_layers.new(name='UVMap')
        layer.data.foreach_set('uv', np.asarray(uvs, np.float32).reshape(-1))
    obj = _link(bpy.data.objects.new(name, me))
    if mat is not None:
        me.materials.append(mat)
    if smooth:
        me.shade_smooth()
    return obj


def _place(obj, loc=None, rot=None):
    if loc is not None:
        obj.location = loc
    if rot is not None:
        obj.rotation_euler = rot
    return obj


def box(name, size, loc=(0, 0, 0), rot=None, mat=None, bevel=None, segments=1):
    """A box of the given full size (x, y, z) centred on loc; bevel = edge radius in metres."""
    sx, sy, sz = [s / 2 for s in size]
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz), (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    obj = _place(mesh_object(name, v, f, mat), loc, rot)
    if bevel:
        globals()['bevel'](obj, bevel, segments)
    return obj


def cylinder(name, radius, depth, loc=(0, 0, 0), rot=None, mat=None, verts=24, radius2=None, caps=True, axis='z', bevel=None, segments=1):
    """A cylinder (or cone frustum: radius at the bottom, radius2 at the top) centred on loc, along `axis`."""
    r2 = radius if radius2 is None else radius2
    a = np.arange(verts) * (TAU / verts)
    ring = lambda r, z: [(r * math.cos(t), r * math.sin(t), z) for t in a]
    v = ring(radius, -depth / 2) + ring(r2, depth / 2)
    f = [(i, (i + 1) % verts, verts + (i + 1) % verts, verts + i) for i in range(verts)]
    if caps:
        f += [tuple(range(verts - 1, -1, -1)), tuple(range(verts, 2 * verts))]
    obj = mesh_object(name, v, f, mat)
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    if axis == 'x':
        obj.data.transform(Matrix.Rotation(math.pi / 2, 4, 'Y'))
    elif axis == 'y':
        obj.data.transform(Matrix.Rotation(-math.pi / 2, 4, 'X'))
    _place(obj, loc, rot)
    if bevel:
        globals()['bevel'](obj, bevel, segments, angle=40)
    else:
        obj.data.set_sharp_from_angle(angle=math.radians(40))
    return obj


def sphere(name, radius, loc=(0, 0, 0), mat=None, segments=24, rings=12, scale=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((*scale, 1.0))); me.shade_smooth()
    obj = _link(bpy.data.objects.new(name, me))
    if mat is not None:
        me.materials.append(mat)
    return _place(obj, loc)


def lathe(name, profile, steps=32, mat=None, loc=(0, 0, 0), rot=None, angle=TAU, smooth=40):
    """Spin a profile [(radius, z), ...] round the Z axis. Points with radius 0 become poles."""
    full = abs(angle - TAU) < 1e-6
    cols = steps if full else steps + 1
    verts, idx = [], []
    for r, z in profile:
        if r <= 1e-9:
            idx.append([len(verts)] * cols); verts.append((0.0, 0.0, z))
        else:
            row = []
            for j in range(cols):
                t = angle * j / steps
                row.append(len(verts)); verts.append((r * math.cos(t), r * math.sin(t), z))
            idx.append(row)
    faces = []
    for i in range(len(profile) - 1):
        for j in range(steps):
            a, b = idx[i][j], idx[i][(j + 1) % cols]
            c, d = idx[i + 1][(j + 1) % cols], idx[i + 1][j]
            q = [a]
            for x in (b, c, d):
                if x not in q:
                    q.append(x)
            if len(q) >= 3:
                faces.append(q)
    obj = _place(mesh_object(name, verts, faces, mat), loc, rot)
    fix_normals(obj)
    shade_smooth(obj, smooth)
    return obj


def _catmull(points, sub, closed=False):
    P = np.asarray(points, np.float64)
    if sub <= 1 or len(P) < 3:
        return P
    n = len(P)
    out = []
    segs = n if closed else n - 1
    for i in range(segs):
        p0 = P[(i - 1) % n] if (closed or i > 0) else 2 * P[0] - P[1]
        p1, p2 = P[i], P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else 2 * P[-1] - P[-2]
        for k in range(sub):
            t = k / sub
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    if not closed:
        out.append(P[-1])
    return np.array(out)


def tube(name, points, radius, mat=None, verts=12, smooth=1, closed=False, caps=True, scale_v=1.0, twist=0.0, squash=None):
    """Sweep a circle along a path of points (rods, rails, handles, hoses, rope).
    radius: one number or one per point. smooth: Catmull-Rom subdivisions per span (1 = straight spans).
    squash: (a, b) turns the circle into an ellipse (a across the first normal, b across the second).
    Comes with UVs in metres: u along the path, v round it, so wood grain and brushing run along the tube."""
    P0 = np.asarray(points, np.float64)
    R0 = np.full(len(P0), float(radius)) if np.isscalar(radius) else np.asarray(radius, np.float64)
    P = _catmull(P0, smooth, closed)
    if len(P) != len(P0):
        t = np.linspace(0, len(R0) - (0 if closed else 1), len(P), endpoint=not closed)
        R = np.interp(t, np.arange(len(R0) + (1 if closed else 0)), np.append(R0, R0[0]) if closed else R0)
    else:
        R = R0
    n = len(P)
    T = np.zeros_like(P)
    for i in range(n):
        a = P[(i + 1) % n] if (closed or i < n - 1) else P[i]
        b = P[(i - 1) % n] if (closed or i > 0) else P[i]
        d = a - b; T[i] = d / max(np.linalg.norm(d), 1e-12)
    # parallel-transport frame
    up = np.array([0, 0, 1.0]) if abs(T[0][2]) < 0.9 else np.array([1.0, 0, 0])
    nrm = np.cross(T[0], np.cross(up, T[0])); nrm /= np.linalg.norm(nrm)
    Nn, Bn = [nrm], [np.cross(T[0], nrm)]
    for i in range(1, n):
        v = np.cross(T[i - 1], T[i]); s = np.linalg.norm(v); c = float(np.dot(T[i - 1], T[i]))
        nprev = Nn[-1]
        if s > 1e-9:
            ax = v / s; ang = math.atan2(s, c)
            nprev = nprev * math.cos(ang) + np.cross(ax, nprev) * math.sin(ang) + ax * np.dot(ax, nprev) * (1 - math.cos(ang))
        nprev = nprev - T[i] * np.dot(nprev, T[i]); nprev /= np.linalg.norm(nprev)
        Nn.append(nprev); Bn.append(np.cross(T[i], nprev))
    ang = np.arange(verts) * (TAU / verts)
    sa, sb = squash or (1.0, 1.0)
    V = []
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    for i in range(n):
        tw = twist * arc[i]
        for a in ang:
            V.append(P[i] + R[i] * (math.cos(a + tw) * sa * Nn[i] + math.sin(a + tw) * sb * Bn[i]))
    faces, uvs = [], []
    rings = n if closed else n - 1
    meanr = float(np.mean(R)) * (sa + sb) / 2
    for i in range(rings):
        i2 = (i + 1) % n
        u0 = arc[i]; u1 = arc[i + 1] if i + 1 < n else arc[i] + np.linalg.norm(P[0] - P[i])
        for j in range(verts):
            j2 = (j + 1) % verts
            faces.append((i * verts + j, i * verts + j2, i2 * verts + j2, i2 * verts + j))
            v0 = TAU * meanr * j / verts * scale_v; v1 = TAU * meanr * (j + 1) / verts * scale_v
            uvs += [(u0, v0), (u0, v1), (u1, v1), (u1, v0)]
    if caps and not closed:
        faces.append(tuple(range(verts - 1, -1, -1))); uvs += [(V[k][0], V[k][1]) for k in range(verts - 1, -1, -1)]
        base = (n - 1) * verts
        faces.append(tuple(range(base, base + verts))); uvs += [(V[k][0], V[k][1]) for k in range(base, base + verts)]
    obj = mesh_object(name, V, faces, mat, uvs)
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    obj.data.set_sharp_from_angle(angle=math.radians(50))
    return obj


def surface(name, fn, nu, nv, mat=None, closed_u=False, closed_v=False, thickness=0.0, uv_scale=None, smooth=40, grain='u'):
    """A sheet from a function: fn(u, v) -> (x, y, z) with u, v in 0..1 (numpy arrays in, arrays out).
    The front (the side the normals point to) is the one where u, v, normal are right-handed.
    thickness > 0 gives it a back and edges (solidify, growing away from the normals).
    UVs are laid out in metres from the sheet's own arc lengths unless uv_scale=(su, sv) is given;
    grain='u' or 'v' says which way wood grain / brushing runs (that direction becomes texture U)."""
    cu, cv = nu + (0 if closed_u else 1), nv + (0 if closed_v else 1)
    U, Vv = np.meshgrid(np.linspace(0, 1, nu + 1)[:cu], np.linspace(0, 1, nv + 1)[:cv], indexing='ij')
    X = np.stack([np.asarray(a, np.float64) * np.ones_like(U) for a in fn(U, Vv)], axis=-1)
    verts = X.reshape(-1, 3)
    Ue, Ve = np.meshgrid(np.linspace(0, 1, nu + 1), np.linspace(0, 1, nv + 1), indexing='ij')
    Xe = np.stack([np.asarray(a, np.float64) * np.ones_like(Ue) for a in fn(Ue, Ve)], axis=-1)
    if uv_scale is None:
        lu = np.concatenate([np.zeros((1, nv + 1)), np.cumsum(np.linalg.norm(np.diff(Xe, axis=0), axis=2), axis=0)], axis=0)
        lv = np.concatenate([np.zeros((nu + 1, 1)), np.cumsum(np.linalg.norm(np.diff(Xe, axis=1), axis=2), axis=1)], axis=1)
        Uu = np.repeat(lu.mean(axis=1, keepdims=True), nv + 1, axis=1); Vu = np.repeat(lv.mean(axis=0, keepdims=True), nu + 1, axis=0)
    else:
        Uu, Vu = Ue * uv_scale[0], Ve * uv_scale[1]
    faces, uvs = [], []
    for i in range(nu):
        for j in range(nv):
            a = (i % cu) * cv + (j % cv); b = ((i + 1) % cu) * cv + (j % cv)
            c = ((i + 1) % cu) * cv + ((j + 1) % cv); d = (i % cu) * cv + ((j + 1) % cv)
            faces.append((a, b, c, d))
            uvs += [(Uu[i, j], Vu[i, j]), (Uu[i + 1, j], Vu[i + 1, j]), (Uu[i + 1, j + 1], Vu[i + 1, j + 1]), (Uu[i, j + 1], Vu[i, j + 1])]
    if grain == 'v':
        uvs = [(b, a) for a, b in uvs]
    obj = mesh_object(name, verts, faces, mat, uvs)
    if thickness:
        solidify(obj, thickness)
    shade_smooth(obj, smooth)
    return obj


def strap(name, points, width, thickness, mat=None, width_axis=(0, 1, 0), smooth=1, caps=True):
    """A flat bar bent along a path (hinge straps, brackets, bands, yokes): `width` lies along width_axis,
    `thickness` in the plane of the bends. width / thickness: one number or one per point.
    UVs in metres, u along the path (so brushing and grain follow the bar)."""
    P0 = np.asarray(points, np.float64)
    P = _catmull(P0, smooth)
    def per_point(v):
        if np.isscalar(v):
            return np.full(len(P), float(v))
        v = np.asarray(v, np.float64)
        return np.interp(np.linspace(0, len(v) - 1, len(P)), np.arange(len(v)), v)
    Wd, Th = per_point(width), per_point(thickness)
    n = len(P); wa = np.asarray(width_axis, np.float64); wa /= np.linalg.norm(wa)
    V = []
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    for i in range(n):
        t = P[min(i + 1, n - 1)] - P[max(i - 1, 0)]; t /= max(np.linalg.norm(t), 1e-12)
        w = wa - t * np.dot(wa, t); w /= max(np.linalg.norm(w), 1e-12)
        nn = np.cross(t, w)
        for sw, sn in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            V.append(P[i] + w * (sw * Wd[i] / 2) + nn * (sn * Th[i] / 2))
    faces, uvs = [], []
    for i in range(n - 1):
        per = [0, Wd[i], Wd[i] + Th[i], 2 * Wd[i] + Th[i], 2 * Wd[i] + 2 * Th[i]]
        for j in range(4):
            j2 = (j + 1) % 4
            faces.append((i * 4 + j, i * 4 + j2, (i + 1) * 4 + j2, (i + 1) * 4 + j))
            uvs += [(arc[i], per[j]), (arc[i], per[j + 1]), (arc[i + 1], per[j + 1]), (arc[i + 1], per[j])]
    if caps:
        faces.append((3, 2, 1, 0)); uvs += [(0, 0), (0, Th[0]), (Wd[0], Th[0]), (Wd[0], 0)]
        b = (n - 1) * 4
        faces.append((b, b + 1, b + 2, b + 3)); uvs += [(0, 0), (Wd[-1], 0), (Wd[-1], Th[-1]), (0, Th[-1])]
    obj = mesh_object(name, V, faces, mat, uvs)
    obj.data.shade_smooth(); obj.data.set_sharp_from_angle(angle=math.radians(40))
    return obj


def rivet(name, loc, normal=(0, 0, 1), radius=0.005, height=None, mat=None, segments=10, washer=0.0):
    """A domed rivet / bolt head sitting on a surface at `loc`, pointing along `normal`. washer > 0 adds a flat
    ring of that extra radius under it."""
    h = height or radius * 0.55
    prof = []
    if washer:
        prof += [(radius + washer, -radius * 0.3), (radius + washer, radius * 0.12), (radius * 0.98, radius * 0.12)]
    else:
        prof += [(radius, -radius * 0.3)]
    for k in range(4):
        a = (k / 3) * (math.pi / 2)
        prof.append((radius * math.cos(a), (radius * 0.12 if washer else 0.0) + h * math.sin(a)))
    obj = lathe(name, prof, steps=segments, mat=mat, smooth=50)
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector(normal).normalized()).to_euler()
    obj.location = loc
    apply_transform(obj)
    return obj


def extrude(name, outline, depth, mat=None, loc=(0, 0, 0), rot=None, holes=()):
    """A flat shape with thickness: outline [(x, y), ...] counter-clockwise, extruded `depth` along +Z from z = 0."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0.0)) for x, y in outline]
    edges = [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
    for h in holes:
        hv = [bm.verts.new((x, y, 0.0)) for x, y in h]
        edges += [bm.edges.new((hv[i], hv[(i + 1) % len(hv)])) for i in range(len(hv))]
    res = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=True, edges=edges)
    faces = [g for g in res['geom'] if isinstance(g, bmesh.types.BMFace)]
    for f in faces:
        if f.normal.z < 0:
            f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=[g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    obj = _link(bpy.data.objects.new(name, me))
    if mat is not None:
        me.materials.append(mat)
    return _place(obj, loc, rot)


# ───────────────────────────── editing meshes ─────────────────────────────
def apply_modifiers(obj):
    """Bake every modifier of the object(s) into the mesh data."""
    for o in _as_list(obj):
        if o.type != 'MESH' or not o.modifiers:
            continue
        dg = bpy.context.evaluated_depsgraph_get()
        new = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        old = o.data; new.name = old.name
        o.modifiers.clear(); o.data = new
        if old.users == 0:
            bpy.data.meshes.remove(old)
    return obj


def apply_transform(obj, location=False, rotation=True, scale=True):
    """Push the object's rotation/scale (and optionally location) into its mesh, leaving the object at rest."""
    for o in _as_list(obj):
        loc, rot, scl = o.matrix_basis.decompose()
        M = Matrix.Identity(4)
        if scale:
            M = Matrix.Diagonal((*scl, 1.0)) @ M
        if rotation:
            M = rot.to_matrix().to_4x4() @ M
        if location:
            M = Matrix.Translation(loc) @ M
        o.data.transform(M)
        if M.determinant() < 0:
            o.data.flip_normals()
        o.matrix_basis = Matrix.LocRotScale(Vector() if location else loc, Quaternion() if rotation else rot, Vector((1, 1, 1)) if scale else scl)
    _update()
    return obj


def transform(obj, matrix):
    """Move the mesh data itself by a 4x4 matrix (the object's own transform is left alone)."""
    for o in _as_list(obj):
        o.data.transform(matrix)
        if matrix.determinant() < 0:
            o.data.flip_normals()
    return obj


def deform(obj, fn):
    """Move vertices with a function: fn(P) -> P', P an (n, 3) array of object-space positions."""
    me = obj.data; n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co)
    out = np.asarray(fn(co.reshape(n, 3).astype(np.float64)), np.float32).reshape(-1)
    me.vertices.foreach_set('co', out); me.update()
    return obj


def fix_normals(obj):
    """Make all faces point outwards consistently."""
    for o in _as_list(obj):
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(o.data); bm.free()
    return obj


def _tag_layer(bm):
    return bm.faces.layers.float.get('bpk_edge') or bm.faces.layers.float.new('bpk_edge')


def bevel(obj, width=0.003, segments=1, angle=30, profile=0.5, edges=None, smooth=True, clamp=True):
    """Round the hard edges (sharper than `angle` degrees) by `width` metres.
    edges: optional filter fn(BMEdge) -> bool to pick which hard edges get it.
    The new faces are remembered (face attribute 'bpk_edge': +1 on convex edges, -1 in concave ones) so
    kit.wear() can put edge wear exactly on them. With smooth=True the result is shaded the way a real
    chamfered part looks: big faces stay flat, the bevel rolls the light round the edge."""
    for o in _as_list(obj):
        me = o.data
        bm = bmesh.new(); bm.from_mesh(me)
        lim = math.radians(angle)
        sel = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim and (edges is None or edges(e))]
        if sel:
            convex = {}
            layer = _tag_layer(bm)
            sign = 1.0 if sum(1 if e.calc_face_angle_signed(0.0) >= 0 else -1 for e in sel) >= 0 else -1.0
            mixed = any((e.calc_face_angle_signed(0.0) >= 0) != (sign > 0) for e in sel)
            old_faces = set(bm.faces)
            res = bmesh.ops.bevel(bm, geom=sel, offset=width, offset_type='OFFSET', segments=segments, profile=profile,
                                  affect='EDGES', clamp_overlap=clamp, miter_outer='SHARP', miter_inner='SHARP')
            new = [f for f in res['faces'] if f.is_valid]
            newset = set(new)
            for f in new:
                s = sign
                if mixed:      # decide per face from the edges it shares with the untouched faces
                    acc = 0.0
                    for e in f.edges:
                        if len(e.link_faces) == 2 and any(g not in newset for g in e.link_faces):
                            acc += e.calc_face_angle_signed(0.0)
                    s = 1.0 if acc >= 0 else -1.0
                f[layer] = s
                f.smooth = True
        bm.to_mesh(me); bm.free(); me.update()
        if smooth:
            weighted_normals(o)
    return obj


def weighted_normals(obj, sharp=62):
    """Shade smooth with face-area-weighted normals: large flat faces keep flat shading, bevels blend between
    them. Edges sharper than `sharp` degrees stay hard."""
    for o in _as_list(obj):
        me = o.data
        if 'custom_normal' in me.attributes:
            me.attributes.remove(me.attributes['custom_normal'])
        me.shade_smooth(); me.set_sharp_from_angle(angle=math.radians(sharp))
        m = o.modifiers.new('bpk_wn', 'WEIGHTED_NORMAL'); m.keep_sharp = True; m.weight = 50; m.mode = 'FACE_AREA'
        apply_modifiers(o)
    return obj


def shade_smooth(obj, angle=30):
    """Smooth shading; edges sharper than `angle` degrees stay hard (angle=180: everything smooth)."""
    for o in _as_list(obj):
        me = o.data
        if 'custom_normal' in me.attributes:
            me.attributes.remove(me.attributes['custom_normal'])
        me.shade_smooth()
        if angle < 180:
            me.set_sharp_from_angle(angle=math.radians(angle))
    return obj


def shade_flat(obj):
    for o in _as_list(obj):
        if 'custom_normal' in o.data.attributes:
            o.data.attributes.remove(o.data.attributes['custom_normal'])
        o.data.shade_flat()
    return obj


def subdivide(obj, levels=1, simple=False, crease_angle=None):
    """Subdivision surface (Catmull-Clark; simple=True only splits). crease_angle: edges sharper than this
    many degrees are creased first so they stay crisp."""
    for o in _as_list(obj):
        if crease_angle is not None:
            bm = bmesh.new(); bm.from_mesh(o.data)
            cl = bm.edges.layers.float.get('crease_edge') or bm.edges.layers.float.new('crease_edge')
            lim = math.radians(crease_angle)
            for e in bm.edges:
                if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim:
                    e[cl] = 1.0
            bm.to_mesh(o.data); bm.free()
        m = o.modifiers.new('bpk_sub', 'SUBSURF'); m.levels = levels; m.render_levels = levels
        m.subdivision_type = 'SIMPLE' if simple else 'CATMULL_CLARK'
        apply_modifiers(o)
    return obj


def solidify(obj, thickness, offset=-1.0, rim=True):
    """Give a sheet thickness (offset -1: grows away from the normals, +1: along them, 0: both ways)."""
    for o in _as_list(obj):
        m = o.modifiers.new('bpk_sol', 'SOLIDIFY'); m.thickness = thickness; m.offset = offset
        m.use_rim = rim; m.use_even_offset = True; m.use_quality_normals = True
        apply_modifiers(o)
    return obj


def rim(obj, depth, direction=None):
    """Give an open sheet a turned-down edge: its border is extruded by `depth` against the surface normal
    (or along `direction`). A cloth or a panel lying on something then looks thick without a hidden underside.
    The sheet keeps facing the way it did; the new faces take the shading and material of the faces they grow from."""
    for o in _as_list(obj):
        me = o.data
        bm = bmesh.new(); bm.from_mesh(me)
        bm.normal_update()
        border = [e for e in bm.edges if e.is_boundary]
        if border:
            inner = {e: e.link_faces[0] for e in border}
            res = bmesh.ops.extrude_edge_only(bm, edges=border)
            new = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
            newset = set(new)
            push = Vector(direction).normalized() * depth if direction is not None else None
            for v in new:
                d = push
                if d is None:
                    # a new vertex has no normal of its own yet: it goes against the normal of the border vertex it came from
                    src = next((e.other_vert(v) for e in v.link_edges if e.other_vert(v) not in newset), None)
                    d = -src.normal * depth if src is not None else Vector((0, 0, 0))
                v.co += d
            for e, f0 in inner.items():
                for f in e.link_faces:
                    if f is not f0:
                        f.smooth = f0.smooth; f.material_index = f0.material_index
        bm.to_mesh(me); bm.free(); me.update()
    return obj


def mirror(obj, axis='x', merge=True, threshold=1e-4):
    """Mirror the mesh across its object-space origin plane along the axis (keeps the original half)."""
    for o in _as_list(obj):
        m = o.modifiers.new('bpk_mir', 'MIRROR')
        m.use_axis = (axis == 'x', axis == 'y', axis == 'z'); m.use_mirror_merge = merge; m.merge_threshold = threshold
        apply_modifiers(o)
    return obj


def boolean(obj, cutter, op='DIFFERENCE', remove_cutter=True):
    """Cut `cutter` out of obj (or 'UNION' / 'INTERSECT')."""
    m = obj.modifiers.new('bpk_bool', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    apply_modifiers(obj)
    if remove_cutter:
        delete(cutter)
    return obj


def decimate(obj, ratio):
    """Reduce the triangle count to about `ratio` of what it is (edge collapse)."""
    for o in _as_list(obj):
        m = o.modifiers.new('bpk_dec', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
        apply_modifiers(o)
    return obj


def delete(obj):
    for o in _as_list(obj):
        me = o.data if o.type == 'MESH' else None
        bpy.data.objects.remove(o, do_unlink=True)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)


def duplicate(obj, name=None, loc=None, rot=None, linked=False):
    """A copy of the object (with its own mesh unless linked=True)."""
    new = obj.copy()
    if not linked and obj.data is not None:
        new.data = obj.data.copy()
    if name:
        new.name = name
        if new.data is not None and not linked:
            new.data.name = name
    _link(new)
    return _place(new, loc, rot)


def join(objs, name=None):
    """Merge several mesh objects into one (materials and layers are kept; the result has no transform)."""
    objs = [o for o in _as_list(objs) if o.type == 'MESH']
    if not objs:
        return None
    _update()
    mats, bm = [], bmesh.new()
    for o in objs:
        apply_modifiers(o)
        remap = []
        for m in (o.data.materials[:] or [None]):
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        tmp = o.data.copy(); tmp.transform(o.matrix_world)
        if o.matrix_world.determinant() < 0:
            tmp.flip_normals()
        n0 = len(bm.faces)
        bm.from_mesh(tmp); bm.faces.ensure_lookup_table()
        for f in bm.faces[n0:]:
            f.material_index = remap[min(f.material_index, len(remap) - 1)]
        bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new(name or objs[0].name)
    bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    keep_name = name or objs[0].name
    props = {k: objs[0][k] for k in objs[0].keys() if k.startswith('bpk_')}
    parent = objs[0].parent
    delete(objs)
    out = _link(bpy.data.objects.new(keep_name, me))
    for k, v in props.items():
        out[k] = v
    if parent is not None:
        _update(); out.parent = parent; out.matrix_parent_inverse = parent.matrix_world.inverted()
    return out


def set_material(obj, mat, where=None):
    """Give the whole object one material, or only the faces where(centre, normal) is true (object space)."""
    for o in _as_list(obj):
        me = o.data
        if where is None:
            me.materials.clear(); me.materials.append(mat)
            me.polygons.foreach_set('material_index', np.zeros(len(me.polygons), np.int32))
        else:
            if mat.name not in [m.name for m in me.materials if m]:
                me.materials.append(mat)
            i = [m.name if m else None for m in me.materials].index(mat.name)
            for p in me.polygons:
                if where(p.center, p.normal):
                    p.material_index = i
        me.update()
    return obj


def set_origin(obj, point):
    """Move the object's origin to a world-space point without moving the geometry."""
    _update()
    p = Vector(point)
    d = obj.matrix_world.inverted() @ p
    obj.data.transform(Matrix.Translation(-d))
    obj.matrix_world = obj.matrix_world @ Matrix.Translation(d)
    _update()
    return obj


def parent(child, par):
    """Parent in place (the child keeps where it is in the world)."""
    _update()
    for c in _as_list(child):
        c.parent = par; c.matrix_parent_inverse = par.matrix_world.inverted()
    _update()
    return child


# ───────────────────────────── per-corner layers ─────────────────────────────
def _loop_verts(me):
    lv = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', lv)
    return lv


def _get_layer(me, name):
    a = me.color_attributes.get(name)
    if a is None:
        return None
    n = len(a.data); arr = np.empty(n * 4, np.float32); a.data.foreach_get('color', arr); arr = arr.reshape(n, 4)
    if a.domain == 'POINT':
        arr = arr[_loop_verts(me)]
    return arr


def _set_layer(me, name, arr):
    a = me.color_attributes.get(name)
    if a is not None and (a.domain != 'CORNER' or a.data_type != 'FLOAT_COLOR'):
        me.color_attributes.remove(a); a = None
    if a is None:
        a = me.color_attributes.new(name, 'FLOAT_COLOR', 'CORNER')
    a.data.foreach_set('color', np.ascontiguousarray(arr, np.float32).reshape(-1))
    me.update_tag()                                   # or renders keep showing the layer as it was


def _face_of_loop(me):
    counts = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('loop_total', counts)
    return np.repeat(np.arange(len(me.polygons), dtype=np.int32), counts)


def _loop_defs(me):
    """Per corner: the definition index of its face's material, and the list of definitions."""
    defs = [mat_def(m) for m in me.materials] or [mat_def(None)]
    mi = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('material_index', mi)
    mi = np.clip(mi, 0, len(defs) - 1)
    return mi[_face_of_loop(me)], defs


def ensure_layers(obj):
    """Make sure the object(s) carry the 'Col' and 'bpk_pbr' layers (white / filled from the materials)."""
    for o in _as_list(obj):
        me = o.data; nl = len(me.loops)
        if _get_layer(me, 'Col') is None:
            _set_layer(me, 'Col', np.ones((nl, 4), np.float32))
        if _get_layer(me, 'bpk_pbr') is None:
            li, defs = _loop_defs(me)
            tab = np.array([[d['rough'], d['metal'], d['detail_strength'] if d.get('detail') else 1.0, 1.0] for d in defs], np.float32)
            _set_layer(me, 'bpk_pbr', tab[li])
        ca = me.color_attributes
        if ca.get('Col') is not None:
            ca.active_color = ca['Col']
            ca.render_color_index = ca.find('Col')
    return obj


def _corner_world(o):
    """World-space position and normal of every face corner."""
    _update()
    me = o.data; nv = len(me.vertices); nl = len(me.loops)
    co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co)
    M = np.array(o.matrix_world, np.float64)
    P = (co.reshape(nv, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3])[_loop_verts(me)]
    cn = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get('vector', cn)
    Nw = cn.reshape(nl, 3).astype(np.float64) @ np.linalg.inv(M[:3, :3])
    Nw /= np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-12)
    return P, Nw


def _hash3(i):
    i = (i.astype(np.int64) * np.array([73856093, 19349663, 83492791], np.int64)).sum(axis=-1)
    i = (i ^ (i >> 13)) * 1274126177
    i = i ^ (i >> 16)
    return (i & 0xFFFFFF).astype(np.float64) / float(0xFFFFFF)


def noise3(P, scale=1.0, octaves=3, seed=0):
    """Smooth fractal noise 0..1 at points P (n, 3); `scale` is the size of the largest features in metres."""
    P = np.asarray(P, np.float64) / scale + seed * 17.31
    out = np.zeros(len(P)); amp, tot = 1.0, 0.0
    for o in range(octaves):
        Q = P * (2 ** o)
        I = np.floor(Q); F = Q - I; F = F * F * (3 - 2 * F)
        acc = np.zeros(len(P))
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = (F[:, 0] if dx else 1 - F[:, 0]) * (F[:, 1] if dy else 1 - F[:, 1]) * (F[:, 2] if dz else 1 - F[:, 2])
                    acc += w * _hash3(I + np.array([dx, dy, dz]) + o * 101)
        out += amp * acc; tot += amp; amp *= 0.5
    return out / tot


def tint(obj, color=None, fn=None, amount=1.0):
    """Multiply the 'Col' layer: by one colour, or by fn(P, N) -> (n, 3) linear factors for the corners
    (P world positions, N world normals)."""
    for o in _as_list(obj):
        ensure_layers(o); me = o.data
        col = _get_layer(me, 'Col')
        if color is not None:
            col[:, :3] *= 1 + (np.array(rgb(color)) - 1) * amount
        if fn is not None:
            P, Nw = _corner_world(o)
            f = np.asarray(fn(P, Nw), np.float64)
            if f.ndim == 1:
                f = f[:, None]
            col[:, :3] *= 1 + (f - 1) * amount
        _set_layer(me, 'Col', col)
    return obj


def vary(obj, value=0.07, hue=0.03, noise=0.05, scale=0.25, seed=0):
    """Natural unevenness: each object gets its own slight brightness/colour offset (plank to plank), plus
    soft blotches inside it. Call with a list of planks/parts."""
    rng = np.random.default_rng(seed + 12345)
    for o in _as_list(obj):
        ensure_layers(o); me = o.data
        col = _get_layer(me, 'Col')
        k = 1 + rng.uniform(-value, value)
        shift = 1 + rng.uniform(-hue, hue, 3)
        col[:, :3] *= k * shift
        if noise:
            P, _ = _corner_world(o)
            n = noise3(P + rng.uniform(0, 50, 3), scale, 3, seed)
            col[:, :3] *= (1 + (n - 0.5) * 2 * noise)[:, None]
        _set_layer(me, 'Col', col)
    return obj


def gradient(obj, axis='z', lo=None, hi=None, color_lo='#ffffff', color_hi='#ffffff'):
    """Blend a tint along a world axis between two heights (ground grime below, sun bleaching on top)."""
    ax = 'xyz'.index(axis)
    for o in _as_list(obj):
        ensure_layers(o); me = o.data
        P, _ = _corner_world(o)
        a = P[:, ax]; l = a.min() if lo is None else lo; h = a.max() if hi is None else hi
        t = np.clip((a - l) / max(h - l, 1e-9), 0, 1)[:, None]
        col = _get_layer(me, 'Col')
        col[:, :3] *= np.array(rgb(color_lo)) * (1 - t) + np.array(rgb(color_hi)) * t
        _set_layer(me, 'Col', col)
    return obj


def set_pbr(obj, rough=None, metal=None, weight=None, fn=None):
    """Set roughness / metalness / weight per corner: constants, or fn(P, N) -> dict of arrays for any of them."""
    for o in _as_list(obj):
        ensure_layers(o); me = o.data
        pbr = _get_layer(me, 'bpk_pbr')
        vals = dict(rough=rough, metal=metal, weight=weight)
        if fn is not None:
            P, Nw = _corner_world(o); vals.update(fn(P, Nw))
        for i, k in enumerate(('rough', 'metal', 'weight')):
            if vals[k] is not None:
                pbr[:, i] = np.clip(vals[k], 0, 1)
        _set_layer(me, 'bpk_pbr', pbr)
    return obj


def coat(obj, mask, color=None, rough=None, metal=None, weight=None):
    """Lay a second finish over part of an object: paint over steel, rust, a wet patch, sun-bleaching.
    mask: fn(P, N) -> 0..1 per corner (world positions and normals), or a constant. Where it is 1 the surface
    takes `color` (sRGB) and the given roughness / metalness / weight; in between it blends."""
    tgt = None if color is None else np.array(rgb(color))
    for o in _as_list(obj):
        ensure_layers(o); me = o.data
        P, Nw = _corner_world(o)
        m = np.clip(np.asarray(mask(P, Nw) if callable(mask) else np.full(len(P), float(mask)), np.float64), 0, 1)
        col = _get_layer(me, 'Col'); pbr = _get_layer(me, 'bpk_pbr')
        if tgt is not None:
            li, defs = _loop_defs(me)
            base = np.array([d['color'] for d in defs], np.float64)[li]
            want = tgt[None, :] / np.maximum(base, 1e-4)
            col[:, :3] = col[:, :3] * (1 - m[:, None]) + want * m[:, None]
        for i, v in enumerate((rough, metal, weight)):
            if v is not None:
                pbr[:, i] = pbr[:, i] * (1 - m) + v * m
        _set_layer(me, 'Col', col); _set_layer(me, 'bpk_pbr', pbr)
    return obj


def _curvature(me):
    """Per vertex: > 0 on convex edges and corners, < 0 in creases (about the sine of the bend)."""
    nv = len(me.vertices); ne = len(me.edges)
    co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(nv, 3).astype(np.float64)
    vn = np.empty(nv * 3, np.float32); me.vertex_normals.foreach_get('vector', vn); vn = vn.reshape(nv, 3).astype(np.float64)
    ev = np.empty(ne * 2, np.int32); me.edges.foreach_get('vertices', ev); ev = ev.reshape(ne, 2)
    d = co[ev[:, 1]] - co[ev[:, 0]]; d /= np.maximum(np.linalg.norm(d, axis=1, keepdims=True), 1e-12)
    c = np.zeros(nv); cnt = np.zeros(nv)
    np.add.at(c, ev[:, 0], -(vn[ev[:, 0]] * d).sum(1)); np.add.at(c, ev[:, 1], (vn[ev[:, 1]] * d).sum(1))
    np.add.at(cnt, ev[:, 0], 1); np.add.at(cnt, ev[:, 1], 1)
    return c / np.maximum(cnt, 1)


def wear(obj, amount=0.6, color=None, lighten=0.35, rough=None, metal=None, breakup=0.7, scale=0.05, seed=0, spread=0.0):
    """Edge wear: where edges are exposed the surface is rubbed. On the bevels made by kit.bevel() (and on
    sharply convex vertices of dense meshes) the colour goes towards `color` (default: a paler version of
    itself, `lighten`), and roughness / metalness towards `rough` / `metal` if given: bare steel showing
    through paint is wear(obj, color=steel_colour, rough=0.35, metal=1).
    amount 0..1 how much of the edge length is worn; breakup 0..1 how patchy; scale the patch size in metres;
    spread > 0 also wears faces next to worn edges a little."""
    tgt = None if color is None else np.array(rgb(color))
    for o in _as_list(obj):
        ensure_layers(o); me = o.data
        nl = len(me.loops); lv = _loop_verts(me)
        tag = me.attributes.get('bpk_edge')
        mask = np.zeros(nl)
        if tag is not None and tag.domain == 'FACE':
            t = np.empty(len(me.polygons), np.float32); tag.data.foreach_get('value', t)
            mask = np.clip(t, 0, 1)[_face_of_loop(me)].astype(np.float64)
        cv = _curvature(me)
        mask = np.maximum(mask, np.clip((cv[lv] - 0.22) / 0.3, 0, 1) * (1.0 if tag is None else spread))
        P, _ = _corner_world(o)
        n = noise3(P, scale, 3, seed + 3)
        thr = 1 - amount
        m = mask * np.clip((n - thr * breakup) / max(1 - breakup * 0.999, 1e-3) + (1 - breakup) * 0.5, 0, 1) if breakup > 0 else mask * amount
        m = np.clip(m, 0, 1)[:, None]
        col = _get_layer(me, 'Col'); pbr = _get_layer(me, 'bpk_pbr')
        if tgt is None:
            col[:, :3] = col[:, :3] * (1 - m) + np.clip(col[:, :3] * (1 + lighten) + lighten * 0.25, 0, 4) * m
        else:
            li, defs = _loop_defs(me)
            base = np.array([d['color'] for d in defs], np.float64)[li]
            want = tgt[None, :] / np.maximum(base, 1e-4)                 # the tint that turns the base into the target
            col[:, :3] = col[:, :3] * (1 - m) + want * m
        if rough is not None:
            pbr[:, 0] = pbr[:, 0] * (1 - m[:, 0]) + rough * m[:, 0]
        if metal is not None:
            pbr[:, 1] = pbr[:, 1] * (1 - m[:, 0]) + metal * m[:, 0]
        _set_layer(me, 'Col', col); _set_layer(me, 'bpk_pbr', pbr)
    return obj


def dirt(obj=None, amount=0.5, color='#4a3c2c', rough=0.2, crease=0.6):
    """Grime where it gathers: in the nooks the baked ambient occlusion found (bakes it first if needed) and
    in the concave bevels. Darkens towards `color` and roughens."""
    objs = [o for o in _as_list(obj) if not o.get('bpk_shadow')]
    if any(_get_layer(o.data, 'bpk_ao') is None for o in objs):
        bake_ao(objs)
    c = np.array(rgb(color))
    for o in objs:
        ensure_layers(o); me = o.data
        ao = _get_layer(me, 'bpk_ao')[:, 0].astype(np.float64)
        m = np.clip((0.85 - ao) / 0.6, 0, 1) ** 1.3
        tag = me.attributes.get('bpk_edge')
        if tag is not None and tag.domain == 'FACE':
            t = np.empty(len(me.polygons), np.float32); tag.data.foreach_get('value', t)
            m = np.maximum(m, np.clip(-t, 0, 1)[_face_of_loop(me)] * crease)
        P, _ = _corner_world(o)
        m = np.clip(m * (0.6 + 0.8 * noise3(P, 0.08, 3, 5)) * amount, 0, 1)[:, None]
        col = _get_layer(me, 'Col'); pbr = _get_layer(me, 'bpk_pbr')
        col[:, :3] *= 1 - m + m * (c * 1.6)
        pbr[:, 0] = np.clip(pbr[:, 0] + rough * m[:, 0], 0, 1)
        _set_layer(me, 'Col', col); _set_layer(me, 'bpk_pbr', pbr)
    return obj


# ───────────────────────────── UVs in metres ─────────────────────────────
def _uv_layer(me):
    return me.uv_layers.active or me.uv_layers.new(name='UVMap')


def _name_seed(name):
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)


def uv_box(obj, grain='auto', scale=1.0, offset='auto', world=False):
    """Box-project UVs at real scale (1 UV unit = 1 metre x scale), each face from its nearest axis.
    grain: the axis ('x', 'y', 'z', object space) the wood grain / brushing runs along, mapped to U;
           'auto' = the object's longest dimension (right for planks, slats, beams, rods).
    offset: 'auto' shifts each object by its own random amount so neighbouring planks never show the
            same piece of the pattern; or give (u, v).  world=True projects in world space instead."""
    for o in _as_list(obj):
        me = o.data; nl = len(me.loops); nv = len(me.vertices)
        co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(nv, 3).astype(np.float64)
        pn = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get('normal', pn); pn = pn.reshape(-1, 3).astype(np.float64)
        if world:
            _update(); M = np.array(o.matrix_world, np.float64)
            co = co @ M[:3, :3].T + M[:3, 3]; pn = pn @ np.linalg.inv(M[:3, :3])
        g = int(np.argmax(co.max(0) - co.min(0))) if grain == 'auto' else 'xyz'.index(grain)
        dom = np.argmax(np.abs(pn), axis=1)[_face_of_loop(me)]              # per corner: the face's dominant axis
        P = co[_loop_verts(me)]
        others = [a for a in range(3) if a != g]
        u = np.where(dom == g, P[:, others[0]], P[:, g])
        vax = np.where(dom == g, others[1], np.where(dom == others[0], others[1], others[0]))
        v = P[np.arange(nl), vax]
        if offset == 'auto':
            rng = np.random.default_rng(_name_seed(o.name)); off = rng.uniform(0, 4, 2)
        else:
            off = offset or (0, 0)
        uv = np.stack([u * scale + off[0], v * scale + off[1]], axis=1)
        _uv_layer(me).data.foreach_set('uv', uv.astype(np.float32).reshape(-1))
    return obj


def uv_tube(obj, axis='auto', scale=1.0, offset='auto'):
    """UVs in metres wrapped round an object axis: U along the axis (the grain), V the distance round it, with
    one seam at the back. For round things (shafts, rods, wheels) and just as much for planks, slats, legs and
    beams: wrapped like this a plank has far fewer UV seams than with uv_box, so fewer vertices and bytes.
    axis: 'x', 'y', 'z' (object space) or 'auto' = the object's longest dimension."""
    for o in _as_list(obj):
        me = o.data; nv = len(me.vertices)
        co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(nv, 3).astype(np.float64)
        ax = int(np.argmax(co.max(0) - co.min(0))) if axis == 'auto' else 'xyz'.index(axis)
        a, b = [i for i in range(3) if i != ax]
        lv = _loop_verts(me); fl = _face_of_loop(me)
        c = np.array([co[:, a].mean(), co[:, b].mean()])
        ang = np.arctan2(co[lv, b] - c[1], co[lv, a] - c[0])
        r = np.hypot(co[:, a] - c[0], co[:, b] - c[1]).mean()
        # corners of faces that straddle the seam are moved to the far side
        fmin = np.full(len(me.polygons), 10.0); fmax = np.full(len(me.polygons), -10.0)
        np.minimum.at(fmin, fl, ang); np.maximum.at(fmax, fl, ang)
        wrap = (fmax - fmin > math.pi)[fl] & (ang < 0)
        ang = np.where(wrap, ang + TAU, ang)
        off = np.random.default_rng(_name_seed(o.name)).uniform(0, 4, 2) if offset == 'auto' else (offset or (0, 0))
        uv = np.stack([co[lv, ax] * scale + off[0], ang * r * scale + off[1]], axis=1)
        _uv_layer(me).data.foreach_set('uv', uv.astype(np.float32).reshape(-1))
    return obj


def uv_smart(obj, angle=66, margin=0.02, scale=1.0):
    """Blender's Smart UV Project for shapes box projection would tear, then rescaled so that the UVs are
    in metres on average (texture detail keeps its real size)."""
    for o in _as_list(obj):
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
        bpy.ops.object.mode_set(mode='OBJECT')
        me = o.data; me.calc_loop_triangles()
        nt = len(me.loop_triangles); tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
        area3 = np.empty(nt, np.float32); me.loop_triangles.foreach_get('area', area3)
        uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
        t = uv[tl].reshape(nt, 3, 2)
        e1, e2 = t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]
        area2 = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]).sum() * 0.5
        k = math.sqrt(float(area3.sum()) / max(float(area2), 1e-12)) * scale
        me.uv_layers.active.data.foreach_set('uv', (uv * k).astype(np.float32).reshape(-1))
    return obj


# ───────────────────────────── structure: parts, anchors, detail levels ─────────────────────────────
def part(name, objs=None, pivot=(0, 0, 0), rot=(0, 0, 0), parent_part=None):
    """Declare a MOVING PART: a named node the game can turn or slide (door, wheel, lid, propeller...).
    It is an Empty at `pivot` (world), oriented by `rot` (Euler radians) so that the part turns about one of
    its own axes; `objs` are attached to it where they stand. parent_part nests it inside another part.
    Everything that is not inside a part is static and gets merged."""
    e = _link(bpy.data.objects.new(name, None))
    e.empty_display_type = 'ARROWS'; e.empty_display_size = 0.1
    e.location = pivot; e.rotation_euler = rot
    e['bpk_part'] = True
    e['bpk_name'] = name                  # Blender renames an object whose name is taken (a mesh called the same)
    _update()
    if parent_part is not None:
        parent(e, parent_part)
    if objs:
        parent(_as_list(objs), e)
    return e


def anchor(name, loc=(0, 0, 0), rot=(0, 0, 0), parent_part=None, **data):
    """A named point (with a direction) that the game code reads instead of hard-coding numbers: a seat,
    a handle, where a light or the exhaust smoke goes. Its forward is its own -Y, up its +Z (like the
    model itself). Extra keyword values travel with it (numbers, strings, lists)."""
    e = _link(bpy.data.objects.new(name, None))
    e.empty_display_type = 'SINGLE_ARROW'; e.empty_display_size = 0.08
    e.location = loc; e.rotation_euler = rot
    e['bpk_anchor'] = json.dumps(data)
    e['bpk_name'] = name                  # Blender renames an object whose name is taken (a mesh called the same)
    _update()
    if parent_part is not None:
        parent(e, parent_part)
    return e


def detail_only(obj, upto=0):
    """Mark small things (bolts, screws, stitches) that exist only in detail levels 0..upto and vanish in
    the lighter levels of detail."""
    for o in _as_list(obj):
        o['bpk_lod_max'] = int(upto)
    return obj


# ───────────────────────────── ambient occlusion ─────────────────────────────
# Occlusion is stored per vertex, so a value is only right if a vertex sits where the shade changes. Two
# things make that work on lean meshes:
#   1. the value of each corner is not a single sample at the vertex (which may be buried inside another
#      part and pitch black) but the best fit over the faces around it: every triangle is sampled on a fine
#      grid, samples inside other solids are thrown away, and the rest are projected onto the corners;
#   2. where one straight edge cannot follow the shade (a table leg: dark at the floor, light above), the
#      edge gets an extra vertex at the worst spot. `refine` caps how many triangles that may add.
def _grid(k):
    ij = np.array([(i, j) for j in range(k + 1) for i in range(k + 1 - j)], np.int32)
    off = lambda j: j * (k + 1) - j * (j - 1) // 2
    T = []
    for j in range(k):
        for i in range(k - j):
            a = off(j) + i; c = off(j + 1) + i
            T.append((a, a + 1, c))
            if i + j <= k - 2:
                T.append((a + 1, c + 1, c))
    e01 = np.array([i for i in range(k + 1)], np.int32)
    e02 = np.array([off(j) for j in range(k + 1)], np.int32)
    e12 = np.array([off(j) + k - j for j in range(k + 1)], np.int32)
    return ij, np.array(T, np.int32), (e01, e02, e12)


def _soup(o, spacing, max_n):
    """A dense sampling mesh of one object: every triangle cut into a regular grid (world space)."""
    me = o.data; me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    if nt == 0:
        return None
    tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl); tl = tl.reshape(nt, 3)
    lv = _loop_verts(me); nv = len(me.vertices)
    co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co)
    M = np.array(o.matrix_world, np.float64)
    W = co.reshape(nv, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3]
    tv = lv[tl]
    A, B, C = W[tv[:, 0]], W[tv[:, 1]], W[tv[:, 2]]
    longest = np.maximum(np.linalg.norm(B - A, axis=1), np.maximum(np.linalg.norm(C - B, axis=1), np.linalg.norm(A - C, axis=1)))
    n = np.clip(np.ceil(longest / spacing), 1, max_n).astype(np.int32)
    nrm = np.cross(B - A, C - A); area = np.linalg.norm(nrm, axis=1) * 0.5
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-20)
    if np.linalg.det(M[:3, :3]) < 0:
        nrm = -nrm
    V, T, par, bary, groups = [], [], [], [], []
    base = 0
    for k in np.unique(n):
        sel = np.nonzero(n == k)[0]
        ij, tri, edges = _grid(int(k))
        b = np.stack([(k - ij[:, 0] - ij[:, 1]) / k, ij[:, 0] / k, ij[:, 1] / k], axis=1)
        m = len(b)
        P = A[sel][:, None, :] * b[None, :, 0:1] + B[sel][:, None, :] * b[None, :, 1:2] + C[sel][:, None, :] * b[None, :, 2:3]
        T.append((tri[None, :, :] + (base + np.arange(len(sel)) * m)[:, None, None]).reshape(-1, 3))
        V.append(P.reshape(-1, 3)); par.append(np.repeat(sel, m)); bary.append(np.tile(b, (len(sel), 1)))
        groups.append((int(k), sel, base, m, edges))
        base += len(sel) * m
    return dict(V=np.concatenate(V), T=np.concatenate(T), par=np.concatenate(par), bary=np.concatenate(bary), tl=tl, tv=tv,
                n=n, W=W, nrm=nrm, area=area, groups=groups, lv=lv, flip=np.linalg.det(M[:3, :3]) < 0)


def _soup_object(name, V, T):
    me = bpy.data.meshes.new(name)
    nt = len(T)
    me.vertices.add(len(V)); me.loops.add(nt * 3); me.polygons.add(nt)
    me.vertices.foreach_set('co', np.ascontiguousarray(V, np.float32).reshape(-1))
    me.loops.foreach_set('vertex_index', np.ascontiguousarray(T, np.int32).reshape(-1))
    me.polygons.foreach_set('loop_start', np.arange(0, nt * 3, 3, dtype=np.int32))
    me.update(calc_edges=True)
    a = me.color_attributes.new('bpk_ao', 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = a
    return _link(bpy.data.objects.new(name, me))


def _ao_round(objs, distance, samples, ground, spacing, max_n):
    """One dense bake. -> per object: fitted value per corner, and how badly each mesh edge is served."""
    from mathutils.bvhtree import BVHTree
    sc = bpy.context.scene
    soups = [_soup(o, spacing, max_n) for o in objs]
    total = sum(len(s['T']) for s in soups if s)
    lo, hi = bounds(objs)
    extra = []
    if ground is not None:
        r = float(np.linalg.norm(hi - lo)) * 3 + distance * 4; c = (lo + hi) / 2
        extra.append(mesh_object('_ao_ground', [(c[0] - r, c[1] - r, ground), (c[0] + r, c[1] - r, ground), (c[0] + r, c[1] + r, ground), (c[0] - r, c[1] + r, ground)], [(0, 1, 2, 3)]))
    sobs = [(_soup_object('_ao_soup', s['V'], s['T'] if not s['flip'] else s['T'][:, ::-1]) if s else None) for s in soups]
    live = [x for x in sobs if x is not None]
    hidden = [(o, o.hide_render) for o in sc.objects]
    for o in sc.objects:
        o.hide_render = not (o in live or o in extra)
    bpy.ops.object.select_all(action='DESELECT')
    for o in live:
        o.select_set(True)
    bpy.context.view_layer.objects.active = live[0]
    sc.cycles.samples = samples; sc.world.light_settings.distance = distance
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o, h in hidden:
        try:
            o.hide_render = h
        except ReferenceError:
            pass
    # one BVH of everything, to find samples that sit inside another solid (or under the ground)
    bv, bt, base = [], [], 0
    for s in soups:
        if s:
            bv.append(s['V']); bt.append(s['T'] + base); base += len(s['V'])
    if extra:
        g = extra[0].data
        gv = np.array([v.co[:] for v in g.vertices], np.float64)
        bv.append(gv); bt.append(np.array([[0, 1, 2], [0, 2, 3]]) + base)
    bvh = BVHTree.FromPolygons(np.concatenate(bv).tolist(), np.concatenate(bt).tolist(), all_triangles=True)
    out = []
    for o, s, so in zip(objs, soups, sobs):
        if s is None:
            out.append(None); continue
        me = so.data
        aol = np.empty(len(me.loops) * 4, np.float32); me.color_attributes['bpk_ao'].data.foreach_get('color', aol)
        aol = aol.reshape(-1, 4)[:, 0].astype(np.float64)
        T = s['T'] if not s['flip'] else s['T'][:, ::-1]
        li = T.reshape(-1)
        cnt = np.maximum(np.bincount(li, minlength=len(s['V'])), 1)
        aoV = np.bincount(li, aol, minlength=len(s['V'])) / cnt
        ok = np.ones(len(s['V']), bool)
        for i in np.nonzero(aoV < 0.04)[0]:
            d = s['nrm'][s['par'][i]]
            hit = bvh.ray_cast(Vector(s['V'][i] + d * 2e-4), Vector(d))
            if hit[0] is not None and hit[1].dot(Vector(d)) > 0:
                ok[i] = False
        # project the samples onto the corners (hat functions), weighted by the area each stands for
        nl = len(s['lv'])
        wA = (s['area'] / (s['n'].astype(np.float64) ** 2))[s['par']] * ok
        num = np.zeros(nl); den = np.zeros(nl)
        for k in range(3):
            w = (wA * s['bary'][:, k])[li]
            tgt = s['tl'][s['par'], k][li]
            num += np.bincount(tgt, w * aol, minlength=nl); den += np.bincount(tgt, w, minlength=nl)
        rm = o.data
        cn = np.empty(nl * 3, np.float32); rm.corner_normals.foreach_get('vector', cn)
        key = np.concatenate([s['lv'][:, None].astype(np.int64), np.rint(cn.reshape(nl, 3) * 64).astype(np.int64)], axis=1)
        _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.reshape(-1)
        gn = np.bincount(inv, num); gd = np.bincount(inv, den)
        fit = np.where(gd > 1e-14, gn / np.maximum(gd, 1e-14), 0.35)[inv]
        # how far the true shade strays from a straight line between the two ends of each mesh edge (the
        # diagonals a face is triangulated with are not edges: nothing can be cut there)
        ne = len(rm.edges); ev = np.empty(ne * 2, np.int32); rm.edges.foreach_get('vertices', ev)
        real = set(map(tuple, np.sort(ev.reshape(ne, 2), axis=1).tolist()))
        cand = {}
        for k, sel, b0, m, edges in s['groups']:
            if k < 2:
                continue
            av = aoV[b0:b0 + len(sel) * m].reshape(len(sel), m); okv = ok[b0:b0 + len(sel) * m].reshape(len(sel), m)
            t = np.arange(k + 1) / k
            for (ca, cb), ids in zip(((0, 1), (0, 2), (1, 2)), edges):
                fa = fit[s['tl'][sel, ca]][:, None]; fb = fit[s['tl'][sel, cb]][:, None]
                dev = np.abs(av[:, ids] - (fa + (fb - fa) * t[None, :])) * okv[:, ids]
                dev[:, 0] = 0; dev[:, -1] = 0
                e = dev.max(axis=1)
                va = s['tv'][sel, ca]; vb = s['tv'][sel, cb]
                L = np.linalg.norm(s['W'][vb] - s['W'][va], axis=1)
                for q in np.nonzero(e > 0.02)[0]:
                    key = (int(min(va[q], vb[q])), int(max(va[q], vb[q])))
                    if key not in real:
                        continue
                    old = cand.get(key)
                    if old is None or e[q] > old[0]:
                        cand[key] = (float(e[q]), float(L[q]))
        out.append(dict(fit=fit, cand=cand))
    delete(live + extra)
    return out, total


def _cut_edges(o, cuts):
    """Put a vertex in the middle of each listed edge (va, vb) and tie it into the faces round it."""
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    emap = {tuple(sorted((e.verts[0].index, e.verts[1].index))): e for e in bm.edges}
    todo = [(emap[k], bm.verts[k[0]]) for k in cuts if k in emap]
    new = []
    for e, va in todo:
        if e.is_valid:
            new.append(bmesh.utils.edge_split(e, va, 0.5)[1])
    newset = set(new)
    for nv in new:
        for f in list(nv.link_faces):
            if not f.is_valid:
                continue
            l = next((x for x in f.loops if x.vert == nv), None)
            if l is None:
                continue
            p, n = l.link_loop_prev.vert, l.link_loop_next.vert
            d1 = (p.co - nv.co); d2 = (n.co - nv.co)
            if d1.length < 1e-9 or d2.length < 1e-9 or d1.normalized().dot(d2.normalized()) > -0.9999:
                continue
            others = [x.vert for x in f.loops if x.vert not in (nv, p, n)]
            if not others:
                continue
            ax = d1.normalized()
            pick = [v for v in others if v in newset] or others
            tgt = max(pick, key=lambda v: ((v.co - nv.co) - ax * (v.co - nv.co).dot(ax)).length)
            try:
                bmesh.utils.face_split(f, nv, tgt)
            except Exception:
                pass
    bm.to_mesh(me); bm.free(); me.update()
    return len(new)


def tri_count(objs=None):
    n = 0
    for o in _as_list(objs):
        if o.type == 'MESH':
            o.data.calc_loop_triangles(); n += len(o.data.loop_triangles)
    return n


def bake_ao(objs=None, distance=None, samples=32, ground=None, strength=1.0, floor=0.0, refine=0.3, tol=0.07, spacing=None, quiet=False):
    """Bake ambient occlusion into the 'bpk_ao' layer of the objects (all export objects by default), all
    of them shading each other where they stand. The game darkens SKY light with it much more than sun
    light, which is what makes nooks, joints and undersides sit right.

    distance   how far a surface looks for things that block the sky (default: a quarter of the model's
               size, clamped to 0.15 .. 2 m)
    ground     height of a ground plane that also shades (None: no ground; 0.0 for things that stand on it)
    refine     the bake may halve long edges where the shade changes part-way along (a leg that is dark at
               the floor only). This is the most extra triangles it may add, as a fraction of what there
               is (0.3 = +30 %; 0 = never touch the mesh).   tol: how wrong (0..1) an edge may be
    strength   0..1 fades the result towards "no occlusion"; floor: the darkest value allowed
    spacing    distance between samples on the surfaces (default: distance / 6, 4 mm .. 4 cm)"""
    objs = [o for o in _as_list(objs) if o.type == 'MESH' and len(o.data.polygons) and not o.get('bpk_shadow')]
    if not objs:
        return objs
    t0 = time.time()
    sc = bpy.context.scene
    apply_modifiers(objs); _update()
    lo, hi = bounds(objs)
    if distance is None:
        distance = float(min(max(0.25 * np.linalg.norm(hi - lo), 0.15), 2.0))
    if spacing is None:
        spacing = float(min(max(distance / 6, 0.004), 0.04))
    if sc.world is None:
        sc.world = bpy.data.worlds.new('bpk_world')
    prev = (sc.render.engine, sc.cycles.samples, sc.world.light_settings.distance, sc.cycles.use_denoising)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    tris0 = tri_count(objs); budget = int(refine * tris0); added = 0
    max_n = 20
    rounds = 3 if refine > 0 else 0
    res = None
    for rnd in range(rounds + 1):
        res, total = _ao_round(objs, distance, samples, ground, spacing, max_n)
        if rnd == rounds:
            break
        allc = []
        min_seg = max(spacing * 1.2, 0.006)
        for oi, r in enumerate(res):
            if r is None:
                continue
            for (a, b), (e, L) in r['cand'].items():
                if e > tol and L * 0.5 > min_seg:
                    allc.append((round(e * L, 4), oi, a, b))
        allc.sort(reverse=True)
        per = {}
        room = budget - added
        for pr, oi, a, b in allc:
            if room < 2:
                break
            per.setdefault(oi, set()).add((a, b)); room -= 2
        if not per:
            break
        before = tri_count(objs)
        for oi, cuts in per.items():
            _cut_edges(objs[oi], cuts)
        added += tri_count(objs) - before
    for o, r in zip(objs, res):
        if r is None:
            continue
        me = o.data; nl = len(me.loops)
        ao = np.clip(1 - (1 - r['fit']) * strength, floor, 1)
        out = np.ones((nl, 4), np.float32); out[:, 0] = out[:, 1] = out[:, 2] = ao
        _set_layer(me, 'bpk_ao', out)
        if me.color_attributes.get('Col') is not None:
            me.color_attributes.active_color = me.color_attributes['Col']
    sc.render.engine, sc.cycles.samples, sc.world.light_settings.distance, sc.cycles.use_denoising = prev
    if not quiet:
        log('ambient occlusion: %d objects, reach %.2f m, %d k samples, +%d triangles for shading (%d -> %d), %.1f s' % (
            len(objs), distance, total * 3 // 1000, added, tris0, tris0 + added, time.time() - t0))
    return objs


def ground_shadow(objs=None, z=0.0, strength=0.85, reach=None, margin=None, cell=None, name='ground_shadow', upto=1, samples=64):
    """The soft shade a thing leaves on the ground it stands on, as a flat mesh just above the ground whose
    vertex alpha is how dark it is (baked ambient occlusion of the ground under the model). The game draws
    it as a see-through black layer, so even things too small or too low for the sun's shadow map sit on
    the ground instead of floating over it.
    z: ground height; reach: how far up the ground "looks" for the model (default: about its height);
    cell: grid size in metres; upto: the last level of detail that still has it."""
    objs = [o for o in _as_list(objs) if o.type == 'MESH' and not o.get('bpk_shadow')]
    t0 = time.time()
    sc = bpy.context.scene
    apply_modifiers(objs); _update()
    lo, hi = bounds(objs)
    if reach is None:
        reach = float(min(max((hi[2] - z) * 0.9, 0.2), 1.5))
    if margin is None:
        margin = reach * 0.7
    x0, x1, y0, y1 = lo[0] - margin, hi[0] + margin, lo[1] - margin, hi[1] + margin
    if cell is None:
        cell = float(min(max(max(x1 - x0, y1 - y0) / 30, 0.03), 0.3))
    nx, ny = int(math.ceil((x1 - x0) / cell)), int(math.ceil((y1 - y0) / cell))
    xs, ys = np.linspace(x0, x1, nx + 1), np.linspace(y0, y1, ny + 1)
    V = [(x, y, z + 0.004) for y in ys for x in xs]
    F = [(j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i) for j in range(ny) for i in range(nx)]
    mat = bpy.data.materials.get('ground_shadow') or material('ground_shadow', '#000000', rough=1.0, blend='shadow', cast_shadow=False, receive_shadow=False)
    plane = mesh_object(name, V, F, mat)
    me = plane.data
    _set_layer(me, 'bpk_ao', np.ones((len(me.loops), 4), np.float32))
    me.color_attributes.active_color = me.color_attributes['bpk_ao']
    if sc.world is None:
        sc.world = bpy.data.worlds.new('bpk_world')
    prev = (sc.render.engine, sc.cycles.samples, sc.world.light_settings.distance, sc.cycles.use_denoising)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_denoising = False
    sc.world.light_settings.distance = reach
    hidden = [(o, o.hide_render) for o in sc.objects]
    for o in sc.objects:
        o.hide_render = not (o in objs or o is plane)
    bpy.ops.object.select_all(action='DESELECT')
    plane.select_set(True); bpy.context.view_layer.objects.active = plane
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    for o, h in hidden:
        o.hide_render = h
    sc.render.engine, sc.cycles.samples, sc.world.light_settings.distance, sc.cycles.use_denoising = prev
    lv = _loop_verts(me)
    ao = _get_layer(me, 'bpk_ao')[:, 0].astype(np.float64)
    ao = (np.bincount(lv, ao) / np.maximum(np.bincount(lv), 1))            # per grid vertex
    co = np.array(V)
    edge = np.minimum(np.minimum(co[:, 0] - x0, x1 - co[:, 0]), np.minimum(co[:, 1] - y0, y1 - co[:, 1]))
    fade = np.clip(edge / max(margin * 0.6, 1e-6), 0, 1); fade = fade * fade * (3 - 2 * fade)
    a = np.clip((1 - ao) * 1.1 - 0.03, 0, 1) * strength * fade
    col = np.ones((len(lv), 4), np.float32); col[:, 3] = a[lv]
    _set_layer(me, 'Col', col)
    me.attributes.remove(me.attributes['bpk_ao'])
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    dead = [f for f in bm.faces if max(a[v.index] for v in f.verts) < 0.012]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(me); bm.free(); me.update()
    plane['bpk_shadow'] = True
    plane['bpk_lod_max'] = int(upto)
    log('ground shadow: %d x %d cells of %.0f mm, reach %.2f m, %d triangles, %.1f s' % (nx, ny, cell * 1000, reach, tri_count(plane), time.time() - t0))
    return plane


def bounds(objs=None):
    """World-space bounding box (min, max) of the objects (all export objects by default)."""
    _update()
    lo, hi = np.full(3, 1e30), np.full(3, -1e30)
    for o in _as_list(objs):
        if o.type != 'MESH' or len(o.data.vertices) == 0:
            continue
        nv = len(o.data.vertices); co = np.empty(nv * 3, np.float32); o.data.vertices.foreach_get('co', co)
        M = np.array(o.matrix_world, np.float64)
        P = co.reshape(nv, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3]
        lo = np.minimum(lo, P.min(0)); hi = np.maximum(hi, P.max(0))
    return lo, hi


# ───────────────────────────── export: the .bpk pack ─────────────────────────────
# Blender (x, y, z), Z up, front -Y   ->   game (-x, z, y), Y up, forward -Z.  A proper rotation: no mirroring.
_AX = np.array([[-1.0, 0, 0], [0, 0, 1.0], [0, 1.0, 0]])


def _to_game(v):
    return np.asarray(v, np.float64) @ _AX.T


def _oct_encode(n, bits):
    n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    l1 = np.abs(n).sum(1, keepdims=True)
    p = n[:, :2] / np.maximum(l1, 1e-12)
    neg = n[:, 2] < 0
    q = (1 - np.abs(p[:, ::-1])) * np.where(p >= 0, 1.0, -1.0)
    p = np.where(neg[:, None], q, p)
    m = (1 << (bits - 1)) - 1
    return np.clip(np.rint(p * m), -m, m).astype(np.int32)


def _tipsify(idx, nv, k=24):
    """Reorder triangles so that neighbours follow each other (Sander et al.'s Tipsify): good for the GPU's
    vertex cache and, more important here, it makes indices and vertex data compress well."""
    tris = idx.tolist(); nt = len(tris)
    adj = [[] for _ in range(nv)]
    for t, (a, b, c) in enumerate(tris):
        adj[a].append(t); adj[b].append(t); adj[c].append(t)
    live = [len(a) for a in adj]
    stamp = [0] * nv; emitted = [False] * nt
    out = []; dead = []; s = k + 1; f = tris[0][0] if nt else -1; cursor = 0
    while f >= 0:
        cand = []
        for t in adj[f]:
            if emitted[t]:
                continue
            emitted[t] = True; out.append(t)
            for v in tris[t]:
                dead.append(v); cand.append(v); live[v] -= 1
                if s - stamp[v] > k:
                    stamp[v] = s; s += 1
        n, pri = -1, -1
        for v in cand:
            if live[v] > 0:
                p = 0
                if s - stamp[v] + 2 * live[v] <= k:
                    p = s - stamp[v]
                if p > pri:
                    pri, n = p, v
        if n < 0:
            while dead:
                d = dead.pop()
                if live[d] > 0:
                    n = d; break
        if n < 0:
            while cursor < nv:
                if live[cursor] > 0:
                    n = cursor; break
                cursor += 1
        f = n
    return idx[np.array(out, np.int64)] if nt else idx


def _build_prim(P, Nn, UV, COL, AUX, DID, o, uv_step):
    """Quantise, weld and order one primitive. Inputs are per triangle corner (3 rows per triangle).
    Positions and UVs go on a fixed grid (o['pos_step'] metres, uv_step repeats), counted from the primitive's
    own minimum: 16-bit numbers where its box is small enough for that, 32-bit ones where it is not, so a
    5 mm bolt keeps its shape whether it sits in a hand tool or in a 40 m hull."""
    pmin = P.min(0); step = float(o['pos_step'])
    qp = np.rint((P - pmin) / step).astype(np.int64)
    qn = _oct_encode(Nn, o['normal_bits'])
    cols = [qp, qn]
    uvmin = None
    if UV is not None:
        uvmin = UV.min(0)
        cols.append(np.rint((UV - uvmin) / uv_step).astype(np.int64))
    cols += [COL.astype(np.int64), AUX.astype(np.int64)]
    if DID is not None:
        cols.append(DID.astype(np.int64).reshape(-1, 1))
    key = np.concatenate(cols, axis=1)
    if key.max() >= 2 ** 32:
        raise ValueError('a primitive is %.0f m across: too large for a %.2g m grid, pass a coarser pos_step' % (float((P.max(0) - pmin).max()), step))
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    idx = inv.reshape(-1, 3)
    good = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    lost = int((~good).sum())
    idx = idx[good]
    if len(idx) == 0:
        return None
    if o['optimise']:
        idx = _tipsify(idx, len(uniq))
    flat = idx.reshape(-1)
    _, first = np.unique(flat, return_index=True)
    order = flat[np.sort(first)]                              # vertices in order of first use
    remap = np.full(len(uniq), -1, np.int64); remap[order] = np.arange(len(order))
    idx = remap[idx]; uniq = uniq[order]
    nv = len(uniq)
    c = 0
    out = dict(nv=nv, ni=int(idx.size), lost=lost)
    wide = lambda a: '<u2' if int(a.max()) <= 65535 else '<u4'
    out['pos'] = uniq[:, c:c + 3].astype(wide(uniq[:, c:c + 3])); c += 3
    out['nrm'] = uniq[:, c:c + 2].astype('<i1' if o['normal_bits'] <= 8 else '<i2'); c += 2
    if UV is not None:
        out['uv'] = uniq[:, c:c + 2].astype(wide(uniq[:, c:c + 2])); c += 2
        out['uvmin'] = [float(x) for x in uvmin]; out['uvstep'] = float(uv_step)
    out['col'] = uniq[:, c:c + 4].astype('u1'); c += 4
    out['aux'] = uniq[:, c:c + 4].astype('u1'); c += 4
    if DID is not None:
        out['did'] = uniq[:, c].astype('u1'); c += 1
    out['idx'] = idx.astype('<u2' if nv <= 65535 else '<u4').reshape(-1)
    out['pmin'] = [float(x) for x in pmin]; out['pstep'] = step
    real = pmin + out['pos'].astype(np.float64) * step
    out['bb'] = [[float(x) for x in real.min(0)], [float(x) for x in real.max(0)]]
    return out


_SIG_KEYS = ('blend', 'alpha_test', 'double', 'cast', 'receive', 'emissive', 'map', 'coat', 'coat_rough', 'env', 'sway', 'flags')


def _signature(d):
    """Materials with the same signature draw in the same call: only how they are drawn matters. Their
    colour / roughness / metalness travel per vertex, and so does WHICH detail texture each vertex uses."""
    if d['own']:
        return ('own', d['name'])
    return tuple(json.dumps(d[k], sort_keys=True) for k in _SIG_KEYS)


def _corner_arrays(o, node_inv):
    """Everything the exporter needs from one mesh object, per triangle corner, in its node's space."""
    me = o.data
    me.calc_loop_triangles()
    nt = len(me.loop_triangles); nl = len(me.loops); nv = len(me.vertices)
    if nt == 0:
        return None
    tl = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
    tp = np.empty(nt, np.int32); me.loop_triangles.foreach_get('polygon_index', tp)
    lv = _loop_verts(me)
    co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(nv, 3).astype(np.float64)
    cn = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get('vector', cn); cn = cn.reshape(nl, 3).astype(np.float64)
    M = np.array(node_inv @ o.matrix_world, np.float64)
    R = M[:3, :3]
    P = co @ R.T + M[:3, 3]
    Nw = cn @ np.linalg.inv(R)
    Nw /= np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-12)
    if np.linalg.det(R) < 0:
        tl = tl.reshape(nt, 3)[:, ::-1].reshape(-1)
    li, defs = _loop_defs(me)
    col = _get_layer(me, 'Col'); pbr = _get_layer(me, 'bpk_pbr'); ao = _get_layer(me, 'bpk_ao')
    uv = None
    if me.uv_layers.active is not None:
        uv = np.empty(nl * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(nl, 2).astype(np.float64)
    return dict(tl=tl, tp=tp, lv=lv, P=P[lv], N=Nw, li=li, defs=defs, col=col, pbr=pbr, ao=ao, uv=uv, nt=nt)


def _given_name(o):
    """The name a part or an anchor was made with (Blender may have added .001 to the object's own name)."""
    return o.get('bpk_name') or o.name


def _node_of(o):
    p = o.parent
    while p is not None:
        if p.get('bpk_part'):
            return p
        p = p.parent
    return None


def _lod_object(objs, ratio, node_world_inv, smooth_angle=45, keep_detail=False):
    """A temporary decimated copy of some objects, joined, in their node's space."""
    mats, bm = [], bmesh.new()
    for o in objs:
        remap = []
        for m in (o.data.materials[:] or [None]):
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        tmp = o.data.copy(); M = node_world_inv @ o.matrix_world
        if 'custom_normal' in tmp.attributes:
            tmp.attributes.remove(tmp.attributes['custom_normal'])
        tmp.transform(M)
        if M.determinant() < 0:
            tmp.flip_normals()
        n0 = len(bm.faces)
        bm.from_mesh(tmp); bm.faces.ensure_lookup_table()
        for f in bm.faces[n0:]:
            f.material_index = remap[min(f.material_index, len(remap) - 1)]
        bpy.data.meshes.remove(tmp)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    me = bpy.data.meshes.new('_lod'); bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    ob = _link(bpy.data.objects.new('_lod', me))
    mod = ob.modifiers.new('d', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
    apply_modifiers(ob)
    me = ob.data
    if 'custom_normal' in me.attributes:
        me.attributes.remove(me.attributes['custom_normal'])
    me.shade_smooth(); me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    # decimation leaves every face corner with its own colour and shade: one value per vertex and material
    # again, so that vertices can be shared (smaller, and it looks the same from where these levels are seen)
    mi = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get('material_index', mi)
    key = _loop_verts(me).astype(np.int64) * 4096 + mi[_face_of_loop(me)]
    _, inv = np.unique(key, return_inverse=True); inv = inv.reshape(-1)
    cnt = np.maximum(np.bincount(inv), 1)
    for nm in ('Col', 'bpk_pbr', 'bpk_ao'):
        a = _get_layer(me, nm)
        if a is not None:
            _set_layer(me, nm, np.stack([np.bincount(inv, a[:, c]) / cnt for c in range(4)], axis=1)[inv])
    if not keep_detail:
        if not any(mat_def(m).get('map') for m in mats):       # a picture still needs its UVs, however far away
            while me.uv_layers:
                me.uv_layers.remove(me.uv_layers[0])
        ob['bpk_no_detail'] = True
    return ob


def export_bpk(name, objects=None, *, lods=(), lod_detail=False, ao=True, meta=None, pos_step=None, normal_bits=10, uv_step=None,
               optimise=True, out_dir=None, quiet=False):
    """Write models/out/<name>.bpk from the scene.

    objects      which mesh objects (default: every mesh whose name does not start with '_')
    lods         lighter levels of detail: [(ratio, distance), ...] e.g. [(0.4, 14), (0.12, 40)] keeps 40 % of
                 the triangles beyond 14 m and 12 % beyond 40 m (distances for the 'medium' quality preset;
                 the game scales them). Objects marked with kit.detail_only() are left out of them. The lighter
                 levels carry no detail textures (too far away to see) unless lod_detail=True.
    ao           True: bake ambient occlusion if it has not been baked; False: none; or a dict of bake_ao()
                 arguments, e.g. dict(ground=0.0, distance=0.5)
    meta         free-form dict for the game code (anything JSON can hold)
    pos_step     position grid in metres: every vertex is stored to the nearest multiple of it, whatever the
                 size of the model. Default: 0.1 mm, or 4 millionths of the model's size if that is coarser
                 (0.17 mm for a 43 m submarine, 8 mm for a 2 km island). Finer costs bytes in the page.
    normal_bits  8..16 bits per normal component (octahedral); 10 is plenty, 12+ for mirror-like surfaces
    uv_step      texture coordinate grid, in repeats of the texture. Default: a quarter of a texel of the
                 texture the surface uses (1/1024 for the 256-pixel detail textures)
    out_dir      where to write (default models/out; test assets that must not ship go elsewhere)
    Returns a dict of statistics (triangles and vertices per level, bytes)."""
    t0 = time.time()
    sc = bpy.context.scene
    objs = [o for o in _as_list(objects) if o.type == 'MESH']
    apply_modifiers(objs)
    ensure_layers(objs)
    if ao and any(_get_layer(o.data, 'bpk_ao') is None for o in objs if not o.get('bpk_shadow')):
        bake_ao(objs, **(ao if isinstance(ao, dict) else {}))
    _update()
    if pos_step is None:
        lo_, hi_ = bounds(objs)
        pos_step = max(1e-4, float(np.linalg.norm(hi_ - lo_)) / 250000)
    opts = dict(pos_step=float(pos_step), normal_bits=int(normal_bits), optimise=optimise)

    # nodes: the root, then every part that holds geometry, an anchor or another part
    parts = [o for o in sc.objects if o.get('bpk_part')]
    order, seen = [], set()

    def visit(p):
        if p in seen:
            return
        par = _node_of(p)
        if par is not None:
            visit(par)
        seen.add(p); order.append(p)
    for p in parts:
        visit(p)
    node_index = {None: 0}
    nodes = [dict(name=name, parent=-1)]
    for p in order:
        node_index[p] = len(nodes)
        par = _node_of(p)
        pw = par.matrix_world if par is not None else Matrix.Identity(4)
        loc, rot, scl = (pw.inverted() @ p.matrix_world).decompose()
        if max(abs(s - 1) for s in scl) > 1e-4:
            raise ValueError('part %r is scaled: apply the scale to its meshes instead' % _given_name(p))
        t = _to_game(np.array(loc)); ax = _to_game(np.array([rot.x, rot.y, rot.z]))
        nd = dict(name=_given_name(p), parent=node_index[par])
        if np.abs(t).max() > 1e-9:
            nd['t'] = [round(float(x), 6) for x in t]
        if abs(rot.w) < 1 - 1e-9:
            nd['r'] = [round(float(x), 7) for x in (*ax, rot.w)]
        nodes.append(nd)
    names = [n['name'] for n in nodes]
    if len(set(names)) != len(names):
        raise ValueError('node names must be unique: %r' % names)

    def node_inv(p):
        return p.matrix_world.inverted() if p is not None else Matrix.Identity(4)

    # materials -> batches
    batches, batch_of = [], {}
    images, image_index = [], {}

    def image_ref(nm):
        if nm not in image_index:
            info = _S['images'][nm]
            image_index[nm] = len(images); images.append(info)
        return image_index[nm]

    def batch_for(d):
        sig = _signature(d)
        if sig not in batch_of:
            b = dict(name=d['name'] if d['own'] else 'm%d' % len(batches), src=[])
            if d['blend'] != 'opaque':
                b['blend'] = d['blend']
                if d['blend'] == 'cutout':
                    b['alphaTest'] = d['alpha_test']
            for k_src, k_dst in (('double', 'double'), ('own', 'own')):
                if d[k_src]:
                    b[k_dst] = True
            for k_src in ('cast', 'receive'):
                if not d[k_src]:
                    b[k_src] = False
            if d.get('emissive'):
                b['emissive'] = d['emissive']
            if d.get('map'):
                b['map'] = image_ref(d['map'])
            if d['coat'] > 0:
                b['coat'] = d['coat']; b['coatRough'] = d['coat_rough']
            if d['env'] != 1.0:
                b['env'] = d['env']
            if d['sway'] > 0:
                b['sway'] = d['sway']
            if d['flags']:
                b['flags'] = d['flags']
            batch_of[sig] = len(batches); batches.append(b)
        b = batches[batch_of[sig]]
        if d['name'] not in b['src']:
            b['src'].append(d['name'])
        return batch_of[sig]

    details, detail_ix = [], {}

    def detail_ref(d):
        """1-based index of the material's detail texture in this asset's list (0: none)"""
        if not d.get('detail') or d.get('map'):
            return 0
        nm = 'detail_' + d['detail']
        if nm not in detail_ix:
            detail_ix[nm] = len(details) + 1
            details.append(dict(image=image_ref(nm), k=list(_S['images'][nm]['k'])))
        return detail_ix[nm]

    def gather(obj_list, inv_for):
        """-> {(node, batch): [P, N, UV, COL, AUX, DID] lists}"""
        acc = {}
        for o in obj_list:
            nd = _node_of(o) if inv_for is None else None
            ninv = node_inv(nd) if inv_for is None else Matrix.Identity(4)
            node_i = node_index[nd] if inv_for is None else inv_for
            A = _corner_arrays(o, ninv)
            if A is None:
                continue
            tl = A['tl']; nt = A['nt']
            bids = np.array([batch_for(d) for d in A['defs']], np.int32)
            tri_b = bids[A['li'][tl.reshape(nt, 3)[:, 0]]]
            P = _to_game(A['P'][tl]); Nn = _to_game(A['N'][tl])
            base = np.array([d['color'] for d in A['defs']], np.float64)[A['li']]
            alpha = np.array([d['alpha'] for d in A['defs']], np.float64)[A['li']]
            colL = base * A['col'][:, :3]
            q6 = lambda x: np.rint(np.clip(x, 0, 1) * 63) * (255 / 63)        # 64 levels are plenty per vertex, and pack far better
            col8 = np.rint(q6(_l2s(colL)))
            a8 = np.clip(np.rint(alpha * A['col'][:, 3] * 255), 0, 255)
            aoL = A['ao'][:, 0] if A['ao'] is not None else np.ones(len(A['li']))
            aux = np.stack([q6(aoL), q6(A['pbr'][:, 0]), q6(A['pbr'][:, 1]), q6(A['pbr'][:, 2])], axis=1)
            COL = np.concatenate([col8, a8[:, None]], axis=1)[tl]
            AUX = np.rint(aux)[tl]
            # detail textures: which one each corner uses, and its UVs brought from metres to texture space
            did_def = np.array([0 if o.get('bpk_no_detail') else detail_ref(d) for d in A['defs']], np.int32)
            did_l = did_def[A['li']]
            UVd = None
            if did_l.any():
                if A['uv'] is None:
                    raise ValueError('object %r has a material with a detail texture but no UVs: call kit.uv_box / uv_tube / uv_smart on it' % o.name)
                sc_def = np.zeros((len(A['defs']), 2))
                for i_d, d in enumerate(A['defs']):
                    if did_def[i_d]:
                        tu, tv = _S['images']['detail_' + d['detail']]['tile']
                        sc_def[i_d] = (1.0 / (d['detail_scale'] * tu), 1.0 / (d['detail_scale'] * tv))
                UVd = A['uv'] * sc_def[A['li']]
                on = did_l > 0
                UVd[on, 1] = 1.0 - UVd[on, 1]                     # image row 0 is the top (no flip in the game)
                UVd[on] -= np.floor(UVd[on].min(0))                # the textures tile: keep the numbers small
                UVd = UVd[tl]
            DIDc = did_l[tl]
            UVm = None
            for b in np.unique(tri_b):
                sel = np.repeat(tri_b == b, 3)
                bd = batches[b]
                uvb = didb = None
                if 'map' in bd:
                    if A['uv'] is None:
                        raise ValueError('object %r uses a material with a picture (%s) but has no UVs' % (o.name, '/'.join(bd['src'])))
                    if UVm is None:
                        UVm = A['uv'][tl].copy(); UVm[:, 1] = 1.0 - UVm[:, 1]
                    uvb = UVm[sel]
                elif UVd is not None and DIDc[sel].any():
                    uvb = UVd[sel]; didb = DIDc[sel]
                slot = acc.setdefault((node_i, int(b)), [[], [], [], [], [], []])
                slot[0].append(P[sel]); slot[1].append(Nn[sel]); slot[2].append(uvb); slot[3].append(COL[sel]); slot[4].append(AUX[sel]); slot[5].append(didb)
        return acc

    prims, blobs, blob_len = [], [], 0

    def put(arr):
        nonlocal blob_len
        b = np.ascontiguousarray(arr).tobytes()
        off = blob_len
        pad = (-len(b)) % 4
        blobs.append(b + b'\0' * pad); blob_len += len(b) + pad
        return off

    def uv_grid(b):
        """a quarter of a texel of the texture this batch uses"""
        if uv_step is not None:
            return float(uv_step)
        if 'map' in batches[b]:
            info = images[batches[b]['map']]
            return 1.0 / (4 * max(info['w'], info['h']))
        return 1.0 / 1024

    lost = [0, 0]

    def emit(acc, lod):
        tris = verts = 0
        for (node_i, b) in sorted(acc):
            Pl, Nl, UVl, Cl, Al, Dl = acc[(node_i, b)]
            UV = DID = None
            if any(u is not None for u in UVl):                  # objects without texture in a textured batch: zeros
                UV = np.concatenate([u if u is not None else np.zeros((len(p_), 2)) for u, p_ in zip(UVl, Pl)])
            if any(d_ is not None for d_ in Dl):
                DID = np.concatenate([d_ if d_ is not None else np.zeros(len(p_), np.int32) for d_, p_ in zip(Dl, Pl)])
            Pc = np.concatenate(Pl)
            pr = _build_prim(Pc, np.concatenate(Nl), UV, np.concatenate(Cl), np.concatenate(Al), DID, opts, uv_grid(b))
            lost[0 if lod == 0 else 1] += len(Pc) // 3 if pr is None else pr['lost']
            if pr is None:
                continue
            wide = lambda a: dict(t='u32') if a.dtype.itemsize == 4 else {}
            h = dict(node=node_i, mat=b, lod=lod, nv=pr['nv'], ni=pr['ni'], bb=[[round(x, 5) for x in v] for v in pr['bb']])
            h['pos'] = dict(o=put(pr['pos']), min=pr['pmin'], step=pr['pstep'], **wide(pr['pos']))
            h['nrm'] = dict(o=put(pr['nrm']), bits=opts['normal_bits'])
            if 'uv' in pr:
                h['uv'] = dict(o=put(pr['uv']), min=pr['uvmin'], step=pr['uvstep'], **wide(pr['uv']))
            h['col'] = dict(o=put(pr['col']))
            h['aux'] = dict(o=put(pr['aux']))
            if 'did' in pr:
                h['did'] = dict(o=put(pr['did']))
            h['idx'] = dict(o=put(pr['idx']), t='u16' if pr['nv'] <= 65535 else 'u32')
            prims.append(h); tris += pr['ni'] // 3; verts += pr['nv']
        return tris, verts

    stats = dict(tris=[], verts=[])
    t, v = emit(gather(objs, None), 0)
    stats['tris'].append(t); stats['verts'].append(v)
    lod_info = [dict(dist=0)]
    for k, (ratio, dist) in enumerate(lods, start=1):
        acc = {}
        groups = {}
        for o in objs:
            if o.get('bpk_lod_max', 99) >= k:
                groups.setdefault(_node_of(o), []).append(o)
        for nd, lst in groups.items():
            tmp = _lod_object(lst, ratio, node_inv(nd), smooth_angle=50 if k == 1 else 80, keep_detail=lod_detail)
            for key, val in gather([tmp], node_index[nd]).items():
                acc[key] = val
            delete(tmp)
        t, v = emit(acc, k)
        stats['tris'].append(t); stats['verts'].append(v)
        lod_info.append(dict(dist=float(dist), ratio=float(ratio)))

    # anchors
    anchors = {}
    for o in sc.objects:
        if 'bpk_anchor' not in o:
            continue
        nd = _node_of(o)
        loc, rot, _ = (node_inv(nd) @ o.matrix_world).decompose()
        a = dict(node=node_index[nd], p=[round(float(x), 5) for x in _to_game(np.array(loc))])
        if abs(rot.w) < 1 - 1e-9:
            a['q'] = [round(float(x), 6) for x in (*_to_game(np.array([rot.x, rot.y, rot.z])), rot.w)]
        extra = json.loads(o['bpk_anchor'])
        if extra:
            a['data'] = extra
        if _given_name(o) in anchors:
            raise ValueError('two anchors are called %r' % _given_name(o))
        anchors[_given_name(o)] = a

    # embedded images
    img_headers = []
    for info in images:
        h = dict(name=info['name'], mime=info['mime'], o=blob_len, n=len(info['data']), w=info['w'], h=info['h'],
                 srgb=info['srgb'], wrap=info['wrap'], hash=hashlib.sha1(info['data']).hexdigest()[:16])
        pad = (-len(info['data'])) % 4
        blobs.append(info['data'] + b'\0' * pad); blob_len += len(info['data']) + pad
        img_headers.append(h)

    # the box round the whole model at rest, in the game's axes (the shade on the ground does not count)
    blo, bhi = bounds([o for o in objs if not o.get('bpk_shadow')] or objs)
    lo = np.array([-bhi[0], blo[2], blo[1]]); hi = np.array([-blo[0], bhi[2], bhi[1]])
    header = dict(bpk=1, name=name, generator='bpkit %s, Blender %s' % (KIT_VERSION, bpy.app.version_string),
                  bbox=[[round(float(x), 5) for x in lo], [round(float(x), 5) for x in hi]],
                  tris=stats['tris'], verts=stats['verts'], lods=lod_info, nodes=nodes, materials=batches,
                  prims=prims, images=img_headers, details=details, anchors=anchors, meta=meta or {})
    hj = json.dumps(header, separators=(',', ':')).encode()
    hj += b' ' * ((-len(hj)) % 4)
    body = b''.join(blobs)
    out_dir = out_dir or OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, name + '.bpk')
    with open(path, 'wb') as f:
        f.write(b'BPK1' + struct.pack('<II', len(hj), len(body)) + hj + body)
    stats.update(bytes=12 + len(hj) + len(body), path=path, nodes=len(nodes), materials=len(batches), prims=len(prims),
                 images=len(images), seconds=time.time() - t0, pos_step=opts['pos_step'], lost=lost[0])
    if lost[0]:
        # triangles whose corners fell on the same grid point: something is too small for the grid
        log('WARNING: %d triangle(s) of %s vanished at full detail: they are smaller than the %.2f mm position grid (pass a finer pos_step, or drop the detail)' % (
            lost[0], name, opts['pos_step'] * 1000))
    if not quiet:
        log('%s.bpk: %s triangles, %s vertices, %d node(s), %d draw batch(es) at full detail, %d image(s), %.1f KB, %.1f s' % (
            name, '/'.join(str(x) for x in stats['tris']), '/'.join(str(x) for x in stats['verts']), len(nodes),
            len([p for p in prims if p['lod'] == 0]), len(images), stats['bytes'] / 1024, stats['seconds']))
    return stats


# ───────────────────────────── preview renders ─────────────────────────────
VIEWS = {            # name: (azimuth, elevation) in degrees; azimuth 0 looks at the model's front, 90 from its +X side
    'hero': (-38, 22), 'hero_back': (142, 24), 'front': (0, 6), 'back': (180, 6), 'side': (90, 6), 'side2': (-90, 6),
    'top': (0, 88), 'low': (-28, 3), 'high': (-35, 50), 'under': (-35, -30),
}


PREVIEW_LOOK = ('ACES 1.3', 'None', -0.5)       # view transform, look, exposure offset in stops: close to the game's filmic curve


def _look_at(cam, eye, target):
    d = Vector(target) - Vector(eye)
    cam.location = eye
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def _frame(points, az, el, fov_x, fov_y, margin=1.08):
    """Camera position that just fits the points from a direction, and the point it looks at."""
    az, el = math.radians(az), math.radians(el)
    v = np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])     # from target to camera
    up = np.array([0, 0, 1.0])
    right = np.cross(up, v); right /= max(np.linalg.norm(right), 1e-9)
    upv = np.cross(v, right)
    P = np.asarray(points, np.float64)
    c = (P.min(0) + P.max(0)) / 2
    tx, ty = math.tan(fov_x / 2), math.tan(fov_y / 2)
    for _ in range(3):
        rel = P - c
        x, y, z = rel @ right, rel @ upv, rel @ v
        d = float(np.max(np.maximum(z + np.abs(x) / tx, z + np.abs(y) / ty)))
        # centre what the camera sees
        px, py = x / np.maximum(d - z, 1e-6), y / np.maximum(d - z, 1e-6)
        c = c + right * ((px.max() + px.min()) / 2) * d + upv * ((py.max() + py.min()) / 2) * d
    return c + v * d * margin, c


def _sphere_points(c, r):
    c = np.asarray(c, np.float64)
    return np.array([c + r * np.array(d) for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))])


def preview(name, views=('hero', 'hero_back', 'side', 'top'), closeups=None, objects=None, *, size=(640, 480), samples=16,
            ground=0.0, rest=None, lens=62, sun=(52, 46), exposure=0.0, extra=(), out_dir=None, quiet=False, look=None):
    """Render preview pictures with Cycles: a sun and sky, a sand-coloured ground, the camera framed on the model.
    Writes build/preview/<name>_<view>.png and returns the paths.

    views      names from VIEWS, or (name, azimuth, elevation) triples
    closeups   {name: (centre, radius)} or {name: (centre, radius, azimuth, elevation)}: world-space spots to
               look at closely (the picture is build/preview/<name>_<closeup>.png)
    ground     height of the ground plane (None: no ground, the model hangs in the sky)
    rest       4x4 Matrix applied to the whole model for the pictures only (lay a tool down, lean it...)
    sun        (azimuth relative to the camera, elevation) of the sun, degrees
    extra      'ao' adds <name>_ao.png (the baked occlusion alone), 'wire' adds <name>_wire.png (the triangles)"""
    t0 = time.time()
    sc = bpy.context.scene
    look = look or PREVIEW_LOOK
    objs = [o for o in _as_list(objects) if o.type == 'MESH']
    shadow_planes = [(o, o.hide_render) for o in objs if o.get('bpk_shadow')]
    for o, _h in shadow_planes:                          # Cycles casts the real shadow
        o.hide_render = True
    objs = [o for o in objs if not o.get('bpk_shadow')]
    apply_modifiers(objs); ensure_layers(objs); _update()
    out_dir = out_dir or PREVIEW_DIR
    os.makedirs(out_dir, exist_ok=True)
    made, times = [], []
    # pose for the pictures
    saved = None
    if rest is not None:
        roots = [o for o in sc.objects if o.parent is None and not o.name.startswith('_')]
        saved = [(o, o.matrix_world.copy()) for o in roots]
        for o in roots:
            o.matrix_world = rest @ o.matrix_world
        _update()
    lo, hi = bounds(objs)
    corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
    diag = float(np.linalg.norm(hi - lo))

    # the rig
    world = bpy.data.worlds.new('_bpk_preview'); old_world = sc.world; sc.world = world
    nt = world.node_tree
    if nt is None:
        world.use_nodes = True; nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground'); wo = nt.nodes.new('ShaderNodeOutputWorld'); sky = nt.nodes.new('ShaderNodeTexSky')
    for k in ('MULTIPLE_SCATTERING', 'NISHITA', 'HOSEK_WILKIE'):
        try:
            sky.sky_type = k; break
        except TypeError:
            pass
    if hasattr(sky, 'sun_disc'):
        sky.sun_disc = False
    tc = nt.nodes.new('ShaderNodeTexCoord'); skymap = nt.nodes.new('ShaderNodeMapping'); skymap.vector_type = 'POINT'
    nt.links.new(tc.outputs['Generated'], skymap.inputs['Vector']); nt.links.new(skymap.outputs['Vector'], sky.inputs['Vector'])
    nt.links.new(sky.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], wo.inputs[0])
    bg.inputs[1].default_value = 0.22
    try:
        world.cycles.sampling_method = 'NONE'          # a smooth sky needs no importance map (saves seconds per view)
    except Exception:
        pass
    if hasattr(sky, 'sun_elevation'):
        sky.sun_elevation = math.radians(sun[1]); sky.sun_rotation = 0.0
    sun_data = bpy.data.lights.new('_bpk_sun', 'SUN'); sun_data.energy = 4.2; sun_data.angle = math.radians(1.6)
    sun_data.color = (1.0, 0.96, 0.88)
    sun_ob = _link(bpy.data.objects.new('_bpk_sun', sun_data))
    cam_data = bpy.data.cameras.new('_bpk_cam'); cam_data.lens = lens; cam_data.sensor_width = 36
    cam = _link(bpy.data.objects.new('_bpk_cam', cam_data)); old_cam = sc.camera; sc.camera = cam
    plane = None
    if ground is not None:
        r = max(diag * 40, 60)
        plane = mesh_object('_bpk_ground', [(-r, -r, ground), (r, -r, ground), (r, r, ground), (-r, r, ground)], [(0, 1, 2, 3)])
        gm = bpy.data.materials.new('_bpk_sand'); gnt = gm.node_tree
        if gnt is None:
            gm.use_nodes = True; gnt = gm.node_tree
        pb = next(n for n in gnt.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
        pb.inputs['Base Color'].default_value = (*rgb('#cdb893'), 1.0); pb.inputs['Roughness'].default_value = 0.95
        nz = gnt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 900; nz.inputs['Detail'].default_value = 4
        bp = gnt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25; bp.inputs['Distance'].default_value = 0.002
        gnt.links.new(nz.outputs[0], bp.inputs['Height']); gnt.links.new(bp.outputs['Normal'], pb.inputs['Normal'])
        plane.data.materials.append(gm)
    r = sc.render
    prev = dict(engine=r.engine, x=r.resolution_x, y=r.resolution_y, pct=r.resolution_percentage, samples=sc.cycles.samples,
                den=sc.cycles.use_denoising, vt=sc.view_settings.view_transform, look=sc.view_settings.look, exp=sc.view_settings.exposure, path=r.filepath)
    r.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    r.use_persistent_data = True                       # keep the scene loaded between the views
    r.resolution_x, r.resolution_y = size; r.resolution_percentage = 100
    sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.03
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except TypeError:
        sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 5; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
    r.image_settings.file_format = 'PNG'; r.film_transparent = False
    for vt, lk, ev in (look, ('Standard', 'None', -1.0)):
        try:
            sc.view_settings.view_transform = vt; sc.view_settings.look = lk; sc.view_settings.exposure = exposure + ev; break
        except TypeError:
            pass
    fov_x = 2 * math.atan(18 / lens); fov_y = 2 * math.atan(18 / lens * size[1] / size[0])

    def shoot(tag, pts, az, el):
        eye, tgt = _frame(pts, az, el, fov_x, fov_y)
        if ground is not None and eye[2] < ground + 0.02 and el >= 0:
            eye[2] = ground + 0.02
        _look_at(cam, eye, tgt)
        cam_data.clip_start = max(0.005, float(np.linalg.norm(eye - tgt)) * 0.02); cam_data.clip_end = 2000
        sa, se = math.radians(az + sun[0]), math.radians(sun[1])
        sdir = Vector((math.sin(sa) * math.cos(se), -math.cos(sa) * math.cos(se), math.sin(se)))       # towards the sun
        sun_ob.rotation_euler = sdir.to_track_quat('Z', 'Y').to_euler()
        # the sky picture is computed once (sun due +Y); turn the lookup instead of rebuilding it for every view
        skymap.inputs['Rotation'].default_value = (0.0, 0.0, math.atan2(sdir.x, sdir.y))
        if plane is not None:
            plane.hide_render = el < 0
        path = os.path.join(out_dir, '%s_%s.png' % (name, tag))
        r.filepath = path
        ts = time.time()
        bpy.ops.render.render(write_still=True)
        made.append(path); times.append(time.time() - ts)

    for v in views:
        tag, az, el = (v, *VIEWS[v]) if isinstance(v, str) else v
        shoot(tag, corners, az, el)
    for tag, spec in (closeups or {}).items():
        c, rad = spec[0], spec[1]
        az, el = (spec[2], spec[3]) if len(spec) > 2 else VIEWS['hero']
        if rest is not None:
            c = rest @ Vector(c)
        shoot(tag, _sphere_points(c, rad), az, el)
    if extra:
        vl = bpy.context.view_layer
        for kind in extra:
            m = bpy.data.materials.new('_bpk_' + kind); mnt = m.node_tree
            if mnt is None:
                m.use_nodes = True; mnt = m.node_tree
            mnt.nodes.clear()
            o_ = mnt.nodes.new('ShaderNodeOutputMaterial')
            if kind == 'ao':
                at = mnt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'bpk_ao'
                em = mnt.nodes.new('ShaderNodeEmission'); mnt.links.new(at.outputs['Color'], em.inputs['Color']); mnt.links.new(em.outputs[0], o_.inputs['Surface'])
            else:
                wf = mnt.nodes.new('ShaderNodeWireframe'); wf.use_pixel_size = True; wf.inputs['Size'].default_value = 0.9
                df = mnt.nodes.new('ShaderNodeBsdfDiffuse'); df.inputs['Color'].default_value = (0.75, 0.75, 0.75, 1)
                em = mnt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.02, 0.05, 0.3, 1)
                mx = mnt.nodes.new('ShaderNodeMixShader')
                mnt.links.new(wf.outputs[0], mx.inputs[0]); mnt.links.new(df.outputs[0], mx.inputs[1]); mnt.links.new(em.outputs[0], mx.inputs[2])
                mnt.links.new(mx.outputs[0], o_.inputs['Surface'])
            vl.material_override = m
            if kind == 'ao':
                keep_vt, keep_look = sc.view_settings.view_transform, sc.view_settings.look
                sc.view_settings.look = 'None'; sc.view_settings.view_transform = 'Raw'      # grey level = the stored value
            shoot(kind, corners, *VIEWS['hero'])
            if kind == 'ao':
                sc.view_settings.view_transform = keep_vt; sc.view_settings.look = keep_look
            vl.material_override = None
            bpy.data.materials.remove(m)
    # put everything back
    delete([cam, sun_ob] + ([plane] if plane is not None else []))
    sc.world = old_world; sc.camera = old_cam
    bpy.data.worlds.remove(world)
    r.use_persistent_data = False
    r.engine, r.resolution_x, r.resolution_y, r.resolution_percentage, r.filepath = prev['engine'], prev['x'], prev['y'], prev['pct'], prev['path']
    sc.cycles.samples, sc.cycles.use_denoising = prev['samples'], prev['den']
    try:
        sc.view_settings.view_transform = prev['vt']; sc.view_settings.look = prev['look']
    except TypeError:
        pass
    sc.view_settings.exposure = prev['exp']
    if saved is not None:
        for o, m in saved:
            o.matrix_world = m
        _update()
    for o, h in shadow_planes:
        o.hide_render = h
    if not quiet:
        log('%d preview(s) in %.1f s (%s): %s' % (len(made), time.time() - t0, ' '.join('%.1f' % x for x in times), ' '.join(os.path.relpath(p, ROOT) for p in made)))
    return made
