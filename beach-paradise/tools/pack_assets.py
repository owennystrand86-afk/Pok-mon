#!/usr/bin/env python3
"""Embed the 3D assets in a built page.

    tools/pack_assets.py <page.html> [--dir models/out] [--quiet]        (tools/build.sh calls this)

Every models/out/*.bpk (written by models/lib/bpkit.py, format in DEVELOPING.md) is bundled into ONE
container, raw-deflated (zlib level 9), base64-encoded and put into the page as

    <script id="bp-assets" type="application/octet-stream" data-raw="N">BASE64</script>

just before the game's module script. A script of that type is never run: src/15-assets.js reads its text
at boot. With no .bpk files nothing is added and the page stays valid (a stale element is removed).

Container (little-endian), before deflate:
    'BPAK' | u32 version = 1 | u32 directory length | directory JSON, space-padded to 4 | blob
The directory is {"v":1, "assets":[<.bpk header>, ...], "images":[...], "details":[...]}: each asset's .bpk
header with the offsets of its arrays ("o") made relative to the blob, and its materials pointing into the
shared image table (identical images embedded by several assets are stored once). "details" lists the
detail textures of the whole pack ({"image": i, "k": [tone, roughness, relief]}); the per-vertex detail
numbers of every asset ("did") are renumbered to point into it (0 = none, n = details[n - 1]), so that the
game can keep all of them in one array texture and draw differently textured surfaces in one call.

Before deflate each array may be rewritten so that it compresses better; "f" on the array says how:
    f absent  as in the .bpk
    f = 1     per component: difference from the previous element, zigzag, then all low bytes, all high bytes
    f = 2     indices: each as (highest index seen so far + 1 - index), then byte planes
    f = 3     per component: difference from a value PREDICTED from the triangles, zigzag, byte planes.
              A vertex is predicted when the triangle list first uses it (vertices are stored in that order):
              from the other two corners a, b of that triangle if they are already known, completing the
              parallelogram with the previous triangle when that one shares the edge (a + b - d), else their
              mean; from the one known corner; or, with none, from the vertex before it.
For every array the tool tries the candidates and keeps the smallest. The filters are kept at all only if
they make the deflated pack clearly smaller (they need numpy; without it the pack is stored unfiltered).
"""
import base64, glob, hashlib, json, os, re, struct, sys, zlib

try:
    import numpy as np
except Exception:                                    # the build still works, just a little bigger
    np = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARK = '<script type="module">'
ELEMENT = re.compile(r'<script id="bp-assets"[^>]*>[^<]*</script>\n?')


def deflate(data, level=9):
    c = zlib.compressobj(level, zlib.DEFLATED, -15, 9)
    return c.compress(data) + c.flush()


def read_bpk(path):
    raw = open(path, 'rb').read()
    if raw[:4] != b'BPK1':
        raise ValueError('%s is not a .bpk file' % path)
    hl, bl = struct.unpack_from('<II', raw, 4)
    header = json.loads(raw[12:12 + hl].decode())
    return header, raw[12 + hl:12 + hl + bl], len(raw)


# (attribute key, numpy dtype or None = decided by the header, components)
def accessors(prim):
    out = [('pos', '<u2', 3)]
    out.append(('nrm', '<i1' if prim['nrm'].get('bits', 8) <= 8 else '<i2', 2))
    if 'uv' in prim:
        out.append(('uv', '<u2', 2))
    if 'col' in prim:
        out.append(('col', 'u1', 4))
    if 'aux' in prim:
        out.append(('aux', 'u1', 4))
    if 'did' in prim:
        out.append(('did', 'u1', 1))
    return out


def planes(a):
    """(n, c) unsigned array -> bytes: component after component, low bytes first, then the high bytes."""
    w = a.dtype.itemsize
    if w == 1:
        return np.ascontiguousarray(a.T).tobytes()
    b = a.T.reshape(-1).astype('<u%d' % w).view(np.uint8).reshape(-1, w)
    return np.ascontiguousarray(b.T).tobytes()


def filt_delta(a):
    """f = 1"""
    w = a.dtype.itemsize; bits = 8 * w
    s = a.astype(np.int64)
    d = np.diff(s, axis=0, prepend=np.zeros((1, a.shape[1]), np.int64))
    half = 1 << (bits - 1)
    d = (d + half) % (1 << bits) - half                              # wrap into the signed range
    z = ((d << 1) ^ (d >> (bits - 1))) & ((1 << bits) - 1)           # zigzag: small numbers stay small
    return planes(z.astype('<u%d' % w))


def predictors(idx, nv):
    """For every vertex, how f = 3 predicts it: (kind, a, b, d). kind 0: from vertex v - 1 (or 0 for the first);
    1: copy a; 2: mean of a and b; 3: a + b - d."""
    i = idx.astype(np.int64); nt = len(i) // 3
    hw = np.maximum.accumulate(np.concatenate([[-1], i[:-1]])) + 1
    at = np.nonzero(i == hw)[0]                                    # where each vertex is first used
    v = i[at]
    if len(v) != nv or not np.array_equal(v, np.arange(nv)):
        return None                                               # not in order of first use
    t, k = at // 3, at % 3
    tri = i.reshape(nt, 3)
    o1, o2 = tri[t, (k + 1) % 3], tri[t, (k + 2) % 3]
    k1, k2 = o1 < v, o2 < v
    prev = tri[np.maximum(t - 1, 0)]
    shared = (t > 0) & k1 & k2 & (prev == o1[:, None]).any(1) & (prev == o2[:, None]).any(1) & (o1 != o2)
    d = np.where(shared, prev.sum(1) - o1 - o2, 0)
    kind = np.where(shared, 3, np.where(k1 & k2, 2, np.where(k1 | k2, 1, 0)))
    a = np.where(k1, o1, o2)
    return kind, a, np.where(k1 & k2, o2, a), d


def filt_predict(a, pred):
    """f = 3. The prediction of a vertex only uses vertices before it, so it can be computed from the
    original values all at once."""
    kind, pa, pb, pd = pred
    w = a.dtype.itemsize; bits = 8 * w; mask = (1 << bits) - 1
    s = a.astype(np.int64)
    p = np.zeros_like(s)
    p[1:] = s[:-1]                                                 # kind 0
    m = kind == 1; p[m] = s[pa[m]]
    m = kind == 2; p[m] = (s[pa[m]] + s[pb[m]]) >> 1
    m = kind == 3; p[m] = (s[pa[m]] + s[pb[m]] - s[pd[m]]) & mask
    half = 1 << (bits - 1)
    d = ((s - p) + half) % (1 << bits) - half
    z = ((d << 1) ^ (d >> (bits - 1))) & mask
    return planes(z.astype('<u%d' % w))


def filt_index(idx):
    """f = 2"""
    w = idx.dtype.itemsize
    i = idx.astype(np.int64)
    hw = np.maximum.accumulate(np.concatenate([[-1], i[:-1]])) + 1    # highest index seen before + 1
    v = hw - i
    if v.min() < 0 or v.max() >= (1 << (8 * w)):
        return None                                                  # vertices not in order of first use
    return planes(v.astype('<u%d' % w).reshape(-1, 1))


def pack(dir_path, use_filters=True):
    files = sorted(glob.glob(os.path.join(dir_path, '*.bpk')))
    assets, images, image_ix, rows = [], [], {}, []
    details, detail_ix = [], {}
    blob = bytearray()
    plain_total = filtered_total = 0

    def put(b):
        o = len(blob); blob.extend(b); return o

    for path in files:
        header, body, size = read_bpk(path)
        own_start = len(blob)
        # images: shared table, identical bytes stored once
        local = []
        for im in header.get('images', []):
            data = body[im['o']:im['o'] + im['n']]
            key = hashlib.sha1(data).hexdigest()
            if key not in image_ix:
                image_ix[key] = len(images)
                images.append(dict(name=im['name'], mime=im['mime'], o=put(data), n=len(data), w=im['w'], h=im['h'],
                                   srgb=im.get('srgb', True), wrap=im.get('wrap', 'repeat')))
            local.append(image_ix[key])
        for m in header.get('materials', []):
            if 'map' in m:
                m['map'] = local[m['map']]
        header.pop('images', None)
        # detail textures: one table for the whole pack; this asset's per-vertex numbers are translated to it
        lut = bytearray(range(256))
        for i, d in enumerate(header.pop('details', [])):
            gi = local[d['image']]
            if gi not in detail_ix:
                detail_ix[gi] = len(details) + 1
                details.append(dict(image=gi, k=d['k']))
            lut[i + 1] = detail_ix[gi]
        lut = bytes(lut)
        for p in header['prims']:
            nv, ni = p['nv'], p['ni']
            iacc = p['idx']; iw = 2 if iacc['t'] == 'u16' else 4
            iraw = body[iacc['o']:iacc['o'] + ni * iw]
            pred = predictors(np.frombuffer(iraw, '<u%d' % iw), nv) if np is not None and use_filters else None
            for key, dt, comps in accessors(p):
                acc = p[key]; w = np.dtype(dt).itemsize if np else {'<u2': 2, '<i2': 2, '<i1': 1, 'u1': 1}[dt]
                raw = body[acc['o']:acc['o'] + nv * comps * w]
                if key == 'did':
                    raw = raw.translate(lut)
                best = raw
                if np is not None and use_filters:
                    a = np.frombuffer(raw, dt).reshape(nv, comps)
                    a = a.astype(a.dtype.str.replace('i', 'u')) if a.dtype.kind == 'i' else a
                    cands = [(len(deflate(raw, 6)), 0, raw)]
                    f1 = filt_delta(a); cands.append((len(deflate(f1, 6)), 1, f1))
                    if pred is not None:
                        f3 = filt_predict(a, pred); cands.append((len(deflate(f3, 6)), 3, f3))
                    csize, f, best = min(cands, key=lambda c: c[0])
                    plain_total += cands[0][0]; filtered_total += csize
                    if f:
                        acc['f'] = f
                acc['o'] = put(best)
            best = iraw
            if np is not None and use_filters:
                f = filt_index(np.frombuffer(iraw, '<u%d' % iw))
                ca = len(deflate(iraw, 6)); cb = len(deflate(f, 6)) if f is not None else ca + 1
                plain_total += ca; filtered_total += min(ca, cb)
                if cb < ca:
                    best = f; iacc['f'] = 2
            iacc['o'] = put(best)
        assets.append(header)
        lod0 = header['tris'][0] if header['tris'] else 0
        packed = len(deflate(bytes(blob[own_start:]) + json.dumps(header, separators=(',', ':')).encode()))
        rows.append((header['name'], lod0, sum(header['tris']), sum(header['verts']), size, packed))
    directory = json.dumps(dict(v=1, assets=assets, images=images, details=details), separators=(',', ':')).encode()
    directory += b' ' * ((-len(directory)) % 4)
    container = b'BPAK' + struct.pack('<II', 1, len(directory)) + directory + bytes(blob)
    return container, rows, images, (plain_total, filtered_total)


def build_container(dir_path):
    """Pack with the filters, and keep them only if they clearly pay."""
    container, rows, images, (plain, filtered) = pack(dir_path, True)
    note = ''
    if np is None:
        note = 'numpy not found: arrays stored unfiltered'
    elif plain:
        a = len(deflate(container))
        raw_container, raw_rows, _, _ = pack(dir_path, False)
        b = len(deflate(raw_container))
        if a < b * 0.97:
            note = 'delta/byte-plane filters kept: %d B deflated instead of %d B (-%.0f%%)' % (a, b, 100 * (1 - a / b))
        else:
            note = 'delta/byte-plane filters dropped: %d B with, %d B without' % (a, b)
            container, rows = raw_container, raw_rows
    return container, rows, images, note


def main(argv):
    quiet, dir_path, page_path = False, os.path.join(ROOT, 'models', 'out'), None
    it = iter(argv)
    for a in it:
        if a == '--quiet':
            quiet = True
        elif a == '--dir':
            dir_path = next(it)
        elif page_path is None:
            page_path = a
    if page_path is None:
        print(__doc__); return 2
    page = open(page_path, encoding='utf-8').read()
    page = ELEMENT.sub('', page)
    before = len(page.encode())
    if not glob.glob(os.path.join(dir_path, '*.bpk')):
        open(page_path, 'w', encoding='utf-8').write(page)
        if not quiet:
            print('assets: none in %s, page left as it is' % os.path.relpath(dir_path, ROOT))
        return 0
    if MARK not in page:
        print('pack_assets: no %s in %s' % (MARK, page_path), file=sys.stderr); return 1
    container, rows, images, note = build_container(dir_path)
    packed = deflate(container)
    b64 = base64.b64encode(packed).decode()
    element = '<script id="bp-assets" type="application/octet-stream" data-raw="%d">%s</script>\n' % (len(container), b64)
    page = page.replace(MARK, element + MARK, 1)
    open(page_path, 'w', encoding='utf-8').write(page)
    if not quiet:
        print('%-22s %9s %9s %9s %10s %10s' % ('asset', 'tris', 'all lods', 'vertices', 'raw B', 'packed B'))
        for name, lod0, tris, verts, size, pk in rows:
            print('%-22s %9d %9d %9d %10d %10d' % (name, lod0, tris, verts, size, pk))
        if images:
            print('%-22s %9s %9s %9s %10d' % ('images (%d, shared)' % len(images), '', '', '', sum(i['n'] for i in images)))
        print('%-22s %9d %9d %9d %10d %10d' % ('total', sum(r[1] for r in rows), sum(r[2] for r in rows), sum(r[3] for r in rows),
                                              len(container), len(packed)))
        if note:
            print(note)
        print('assets: %d B container -> %d B deflated -> %d B base64; page %d B -> %d B' % (
            len(container), len(packed), len(b64), before, len(page.encode())))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
