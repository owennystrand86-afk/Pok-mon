// Checks of the in-game asset loader against the ground truth written by torture.py (window.__truth).
// Loaded into the page by an "eval" step; each __C.run('name') returns lines that start with PASS or FAIL.
(() => {
  const E = window.__bpEval, THREE = E('THREE'), ASSETS = E('ASSETS');
  const api = {};
  for (const n of ['assetModel', 'assetGeometry', 'assetGeometries', 'assetMeta', 'assetAnchor', 'assetAnchorWorld', 'assetMaterial', 'assetSetLod', 'updateAssets', 'assetInflate', 'assetInflateJS', 'assetB64', 'assetHas']) api[n] = E(n);
  const T = () => window.__truth, NAME = () => T().asset;
  const f = (v, d = 4) => (typeof v === 'number' ? +v.toFixed(d) : v);
  const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const l2s = c => { c = Math.min(Math.max(c, 0), 1); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  const deep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let out = [];
  const ok = (cond, name, info) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ': ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); return cond; };
  const rec = () => ASSETS.by.get(NAME());
  const rowMajor = a => new THREE.Matrix4().set(...a);

  // the model with its parts at rest, and for every node its world matrix
  let cache = null;
  function scene0() {
    if (cache) return cache;
    const m = api.assetModel(NAME(), { lod: 0 });
    m.updateMatrixWorld(true);
    // every level-0 primitive with its vertices in asset space
    const R = rec(), prims = [];
    for (const g of R.groups) {
      const p = g.lods[0]; if (!p) continue;
      const node = m.userData.nodes[R.nodes[g.node].name], M = node.matrixWorld, n3 = new THREE.Matrix3().setFromMatrix4(M);
      const W = new Float32Array(p.nv * 3), N = new Float32Array(p.nv * 3), v = new THREE.Vector3();
      for (let i = 0; i < p.nv; i++) { v.fromArray(p.pos, i * 3).applyMatrix4(M).toArray(W, i * 3); v.fromArray(p.nrm, i * 3).applyMatrix3(n3).toArray(N, i * 3); }
      prims.push({ g, p, W, N, node: R.nodes[g.node].name, mat: R.materials[g.mat] });
    }
    return cache = { m, prims };
  }
  const C = {};

  C.counts = () => {
    const R = rec(), t = T();
    if (!ok(!!R, 'the asset is in the pack')) return;
    ok(deep(R.tris, t.stats.tris), 'triangles per level as the exporter reported', { game: R.tris, exporter: t.stats.tris });
    ok(R.tris[0] === t.tris_total, 'no triangle lost at full detail', { game: R.tris[0], blender: t.tris_total });
    for (let l = 0; l < R.lods.length; l++) {
      let tri = 0, nv = 0;
      for (const g of R.groups) if (g.lods[l]) { tri += g.lods[l].ni / 3; nv += g.lods[l].nv; }
      ok(tri === R.tris[l] && nv === t.stats.verts[l], 'level ' + l + ': primitives add up to the header', { tri, nv, header: [R.tris[l], t.stats.verts[l]] });
    }
    let sv = 0, sl = 0; for (const o of Object.values(t.objects)) { sv += o.verts; sl += o.loops; }
    ok(t.stats.verts[0] >= sv * 0.98 && t.stats.verts[0] <= sl, 'vertex count between Blender vertices and face corners (welded)', { game: t.stats.verts[0], verts: sv, corners: sl });
    const big = R.groups.map(g => g.lods[0]).filter(p => p && p.nv > 65535);
    ok(big.length > 0 && big.every(p => p.idx instanceof Uint32Array), 'a primitive with more than 65 535 vertices uses 32-bit indices', big.map(p => p.nv));
    ok(R.groups.every(g => g.lods.every(p => !p || p.nv > 65535 || p.idx instanceof Uint16Array)), 'smaller primitives use 16-bit indices');
    let maxi = true; for (const g of R.groups) for (const p of g.lods) if (p) { let mx = 0; for (let i = 0; i < p.ni; i++) if (p.idx[i] > mx) mx = p.idx[i]; if (mx !== p.nv - 1) maxi = false; }
    ok(maxi, 'every primitive uses all its vertices and no index is out of range');
    const names = R.nodes.map(n => n.name), want = [t.asset, ...Object.keys(t.nodes)];
    ok(deep([...names].sort(), [...want].sort()), 'node names', { game: names, want });
    ok(R.nodes.slice(1).every(n => R.nodes[n.parent].name === t.nodes[n.name]?.parent), 'node parents', R.nodes.map(n => n.name + '<' + (n.parent >= 0 ? R.nodes[n.parent].name : '')));
    ok(deep(api.assetMeta(NAME()).meta, t.meta), 'meta passes through', api.assetMeta(NAME()).meta);
    ok(deep(api.assetMeta(NAME()).lods.map(l => l.dist), [0, ...t.lods.map(l => l[1])]), 'level distances', api.assetMeta(NAME()).lods);
  };

  C.nodes = () => {
    const { m } = scene0(), t = T();
    for (const [name, nd] of Object.entries(t.nodes)) {
      const node = m.userData.nodes[name];
      if (!ok(!!node, 'node ' + name + ' exists in the model')) continue;
      const want = rowMajor(nd.world).elements, got = node.matrixWorld.elements;
      let err = 0; for (let i = 0; i < 16; i++) err = Math.max(err, Math.abs(want[i] - got[i]));
      ok(err < 2e-5, 'node ' + name + ': world transform', 'max difference ' + err.toExponential(2));
    }
  };

  C.bbox = () => {
    const R = rec(), t = T(), { prims } = scene0();
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const q of prims) { if (q.mat.blend === 'shadow') continue; for (let i = 0; i < q.p.nv * 3; i++) { const k = i % 3; if (q.W[i] < lo[k]) lo[k] = q.W[i]; if (q.W[i] > hi[k]) hi[k] = q.W[i]; } }
    const e1 = Math.max(...[0, 1, 2].map(k => Math.max(Math.abs(lo[k] - t.bbox[0][k]), Math.abs(hi[k] - t.bbox[1][k]))));
    const b = R.bbox, e2 = Math.max(...[0, 1, 2].map(k => Math.max(Math.abs(b.min.getComponent(k) - t.bbox[0][k]), Math.abs(b.max.getComponent(k) - t.bbox[1][k]))));
    ok(e2 < 1e-4, 'header bounding box', { error: f(e2, 6), box: [b.min.toArray().map(x => f(x)), b.max.toArray().map(x => f(x))] });
    ok(e1 < 1e-3, 'bounding box of the decoded vertices', { error_m: f(e1, 6), truth: t.bbox.map(a => a.map(x => f(x))) });
    // the box three.js culls with must hold every vertex of its primitive
    let worst = 0;
    for (const g of R.groups) for (const p of g.lods) if (p) {
      for (let i = 0; i < p.nv * 3; i++) { const k = i % 3; worst = Math.max(worst, p.bb[0][k] - p.pos[i], p.pos[i] - p.bb[1][k]); }
    }
    ok(worst < 1e-5, 'every vertex lies inside its primitive\'s culling box', 'worst overshoot ' + worst.toExponential(2) + ' m');
  };

  // every sampled face corner of every object must exist in the game with the same position, normal, colour, finish and UV
  C.vertices = () => {
    const t = T(), { prims } = scene0(), R = rec();
    const byNode = {}; for (const q of prims) (byNode[q.node] || (byNode[q.node] = [])).push(q);
    const stat = {}, bad = [];
    const uvRule = (md, uv) => {      // what the loader should hold for Blender UV (u, v) on this material
      if (md.map) return { u: uv[0], v: 1 - uv[1], exact: true };
      if (md.detail) { const tl = t.detail_tiles[md.detail], s = md.detail_scale; return { u: uv[0] / (s * tl[0]), v: 1 - uv[1] / (s * tl[1]), exact: false }; }
      return null;
    };
    const circ = d => { d = d - Math.round(d); return Math.abs(d); };
    for (const [oname, o] of Object.entries(t.objects)) {
      const S = stat[oname] = { n: 0, pos: 0, nrm: 0, col: 0, aux: 0, uv: 0, missing: 0 };
      for (const c of o.corners) {
        const md = t.materials[c.mat];
        let best = null;
        for (const q of byNode[o.node] || []) {
          if (!(q.mat.src || []).includes(c.mat) && q.mat.name !== c.mat) continue;
          const { W, N, p } = q;
          // nearest position among vertices with this normal
          let bd = 1e9, cand = [];
          for (let i = 0; i < p.nv; i++) {
            const dx = W[i * 3] - c.p[0], dy = W[i * 3 + 1] - c.p[1], dz = W[i * 3 + 2] - c.p[2], d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > bd + 1e-12 && d2 > 4e-6) continue;
            const dn = N[i * 3] * c.n[0] + N[i * 3 + 1] * c.n[1] + N[i * 3 + 2] * c.n[2];
            if (dn < 0.985) continue;
            if (d2 < bd) bd = d2;
            cand.push([i, d2, dn]);
          }
          for (const [i, d2, dn] of cand) {
            if (d2 > bd + 4e-8 && Math.sqrt(d2) > Math.sqrt(bd) + 2e-4) continue;
            const cn = p.colN, e = { q, i, pos: Math.sqrt(d2), nrm: Math.acos(Math.min(1, dn)) * 180 / Math.PI };
            e.col = Math.max(...[0, 1, 2].map(k => Math.abs(l2s(p.col[i * cn + k]) - l2s(c.col[k]))));
            if (cn === 4) e.col = Math.max(e.col, Math.abs(p.col[i * 4 + 3] - Math.min(1, c.a)));
            e.aux = Math.max(Math.abs(p.aux[i * 4] / 255 - c.ao), Math.abs(p.aux[i * 4 + 1] / 255 - c.rough), Math.abs(p.aux[i * 4 + 2] / 255 - c.metal), Math.abs(p.aux[i * 4 + 3] / 255 - c.weight));
            e.uv = 0;
            const rule = c.uv ? uvRule(md, c.uv) : null;
            if (rule) {
              if (!p.uv) e.uv = 9;
              else if (rule.exact) e.uv = Math.max(Math.abs(p.uv[i * 2] - rule.u), Math.abs(p.uv[i * 2 + 1] - rule.v));
              else e.uv = Math.max(circ(p.uv[i * 2] - rule.u), circ(p.uv[i * 2 + 1] - rule.v));
              if (md.detail && !md.map) { const did = p.did ? p.did[i] : 0, im = did ? ASSETS.images[ASSETS.details[did - 1].image] : null; if (!im || im.name !== 'detail_' + md.detail) e.uv = 8; }
            }
            e.score = e.col + e.aux + Math.min(e.uv, 1) + e.pos * 100 + (1 - dn) * 50;
            if (!best || e.score < best.score) best = e;
          }
        }
        S.n++;
        if (!best) { S.missing++; if (bad.length < 8) bad.push(oname + ' has no vertex at ' + c.p.map(x => f(x)) + ' with normal ' + c.n.map(x => f(x, 2)) + ' in material ' + c.mat); continue; }
        for (const k of ['pos', 'nrm', 'col', 'aux', 'uv']) S[k] = Math.max(S[k], best[k]);
      }
    }
    const worst = k => Object.entries(stat).reduce((a, [n, s]) => (s[k] > a[1] ? [n, s[k]] : a), ['', 0]);
    const miss = Object.entries(stat).filter(([, s]) => s.missing).map(([n, s]) => n + ' ' + s.missing + '/' + s.n);
    const total = Object.values(stat).reduce((a, s) => a + s.n, 0);
    ok(!miss.length, total + ' sampled face corners of ' + Object.keys(stat).length + ' objects are all found in the game', miss.length ? { missing: miss, examples: bad } : undefined);
    const wp = worst('pos'), wn = worst('nrm'), wc = worst('col'), wa = worst('aux'), wu = worst('uv');
    ok(wp[1] < 4e-4, 'positions', 'worst error ' + (wp[1] * 1000).toFixed(3) + ' mm (' + wp[0] + ')');
    ok(wn[1] < 0.6, 'normals', 'worst error ' + wn[1].toFixed(3) + ' degrees (' + wn[0] + ')');
    ok(wc[1] < 0.5 / 63 + 2e-3, 'colours (sRGB units, 64 levels)', 'worst error ' + wc[1].toFixed(4) + ' (' + wc[0] + ')');
    ok(wa[1] < 0.5 / 63 + 2e-3, 'occlusion / roughness / metalness / weight', 'worst error ' + wa[1].toFixed(4) + ' (' + wa[0] + ')');
    ok(wu[1] < 1.5 / 1024, 'texture coordinates', 'worst error ' + wu[1].toFixed(5) + ' repeats = ' + (wu[1] * 256).toFixed(2) + ' texels of a 256 px texture (' + wu[0] + ')');
    const rep = n => { const s = stat[n]; return n + ': pos ' + (s.pos * 1000).toFixed(3) + ' mm, uv ' + s.uv.toFixed(5); };
    out.push('INFO ' + ['tiny', 'speck', 'big', 'dense', 'uvfar', 'leafquad', 'wedge_neg', 'wedge_part_neg'].map(rep).join(' | '));
  };

  // quantisation of the 5 mm cubes: how far their corners moved, and whether they are still cubes
  C.tiny = () => {
    const t = T(), { prims } = scene0();
    for (const name of ['tiny', 'speck']) {
      const o = t.objects[name]; let worst = 0, n = 0;
      for (const v of o.all_verts) {
        let bd = 1e9;
        for (const q of prims) { if (q.node !== o.node) continue; const W = q.W; for (let i = 0; i < q.p.nv; i++) { const d = Math.hypot(W[i * 3] - v[0], W[i * 3 + 1] - v[1], W[i * 3 + 2] - v[2]); if (d < bd) bd = d; } }
        worst = Math.max(worst, bd); n++;
      }
      ok(worst < 0.25e-3, name + ' (5 mm cube in a 40 m model): corners within 5 % of its size', 'worst corner error ' + (worst * 1000).toFixed(3) + ' mm = ' + (worst / 0.005 * 100).toFixed(1) + ' % of its size');
    }
    const o = t.objects.big; let worst = 0;
    for (const v of o.all_verts) { let bd = 1e9; for (const q of prims) { if (q.node !== o.node) continue; const W = q.W; for (let i = 0; i < q.p.nv; i++) { const d = Math.hypot(W[i * 3] - v[0], W[i * 3 + 1] - v[1], W[i * 3 + 2] - v[2]); if (d < bd) bd = d; } } worst = Math.max(worst, bd); }
    ok(worst < 1e-3, 'the 40 m slab: corners within 1 mm', 'worst corner error ' + (worst * 1000).toFixed(3) + ' mm');
  };

  // triangles must face the way their normals say (all levels), and convex things must face outwards
  C.winding = () => {
    const R = rec(), t = T(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (let l = 0; l < R.lods.length; l++) {
      let bad = 0, tot = 0, tiny = 0;
      for (const g of R.groups) {
        const p = g.lods[l]; if (!p) continue;
        for (let i = 0; i < p.ni; i += 3) {
          const i0 = p.idx[i], i1 = p.idx[i + 1], i2 = p.idx[i + 2];
          a.fromArray(p.pos, i0 * 3); b.fromArray(p.pos, i1 * 3); c.fromArray(p.pos, i2 * 3);
          n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
          const area = n.length(); tot++;
          if (area < 1e-12) { tiny++; continue; }
          const d = n.x * (p.nrm[i0 * 3] + p.nrm[i1 * 3] + p.nrm[i2 * 3]) + n.y * (p.nrm[i0 * 3 + 1] + p.nrm[i1 * 3 + 1] + p.nrm[i2 * 3 + 1]) + n.z * (p.nrm[i0 * 3 + 2] + p.nrm[i1 * 3 + 2] + p.nrm[i2 * 3 + 2]);
          if (d <= 0) bad++;
        }
      }
      ok(l === 0 ? bad === 0 : bad / tot < 0.01, 'level ' + l + ': triangles are wound the way their normals point', bad + ' of ' + tot + ' face away' + (tiny ? ', ' + tiny + ' without area' : ''));
      let nan = 0; for (const g of R.groups) { const p = g.lods[l]; if (!p) continue; for (const arr of [p.pos, p.nrm, p.col, p.uv || []]) for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) nan++; }
      ok(nan === 0, 'level ' + l + ': no NaN or infinite numbers');
      let unit = 0; for (const g of R.groups) { const p = g.lods[l]; if (!p) continue; for (let i = 0; i < p.nv; i++) unit = Math.max(unit, Math.abs(Math.hypot(p.nrm[i * 3], p.nrm[i * 3 + 1], p.nrm[i * 3 + 2]) - 1)); }
      ok(unit < 1e-4, 'level ' + l + ': normals have length 1');
    }
    const { prims } = scene0();
    for (const [name, an] of Object.entries(t.analytic)) {
      if (an.kind !== 'convex') continue;
      const o = t.objects[name], lo = o.bbox[0].map(x => x - 1e-3), hi = o.bbox[1].map(x => x + 1e-3), cc = an.centre;
      const inside = (W, i) => W[i * 3] >= lo[0] && W[i * 3] <= hi[0] && W[i * 3 + 1] >= lo[1] && W[i * 3 + 1] <= hi[1] && W[i * 3 + 2] >= lo[2] && W[i * 3 + 2] <= hi[2];
      let tri = 0, badT = 0, badN = 0;
      for (const q of prims) {
        if (q.node !== o.node || q.mat.blend === 'shadow') continue;
        const { W, N, p } = q;
        for (let i = 0; i < p.ni; i += 3) {
          const i0 = p.idx[i], i1 = p.idx[i + 1], i2 = p.idx[i + 2];
          if (!inside(W, i0) || !inside(W, i1) || !inside(W, i2)) continue;
          a.fromArray(W, i0 * 3); b.fromArray(W, i1 * 3); c.fromArray(W, i2 * 3);
          n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
          const cx = (a.x + b.x + c.x) / 3 - cc[0], cy = (a.y + b.y + c.y) / 3 - cc[1], cz = (a.z + b.z + c.z) / 3 - cc[2];
          tri++;
          if (n.x * cx + n.y * cy + n.z * cz <= 0) badT++;
          for (const k of [i0, i1, i2]) if (N[k * 3] * (W[k * 3] - cc[0]) + N[k * 3 + 1] * (W[k * 3 + 1] - cc[1]) + N[k * 3 + 2] * (W[k * 3 + 2] - cc[2]) <= 0) badN++;
        }
      }
      ok(tri >= o.tris && badT === 0 && badN === 0, name + (o.negative ? ' (negative scale)' : '') + ': faces and normals point outwards', { triangles: tri, inward_faces: badT, inward_normals: badN });
    }
  };

  // four coloured cubes at known places: the map from Blender to the game must be the documented rotation, not a mirror
  C.markers = () => {
    const t = T(), { prims } = scene0(), cen = {};
    for (const [k, mk] of Object.entries(t.markers)) {
      let n = 0; const s = [0, 0, 0];
      for (const q of prims) {
        if (q.node !== t.asset || q.mat.blend) continue;
        const p = q.p, cn = p.colN;
        for (let i = 0; i < p.nv; i++) if (Math.abs(p.col[i * cn] - mk.color[0]) + Math.abs(p.col[i * cn + 1] - mk.color[1]) + Math.abs(p.col[i * cn + 2] - mk.color[2]) < 0.02) { n++; s[0] += q.W[i * 3]; s[1] += q.W[i * 3 + 1]; s[2] += q.W[i * 3 + 2]; }
      }
      cen[k] = n ? s.map(x => x / n) : null;
      if (!ok(n > 0, 'marker ' + k + ' found by its colour', n + ' vertices')) return;
    }
    const col = k => [0, 1, 2].map(i => cen[k][i] - cen.o[i]);
    const M = [col('x'), col('y'), col('z')];      // images of Blender's unit x, y, z
    const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    ok(Math.abs(det - 1) < 1e-3, 'Blender to game is a rotation, not a mirror image (determinant +1)', 'determinant ' + det.toFixed(5));
    const want = [[-1, 0, 0], [0, 0, 1], [0, 1, 0]];
    let err = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) err = Math.max(err, Math.abs(M[i][j] - want[i][j]));
    ok(err < 1e-3, 'Blender +X -> game -X, +Y (back) -> +Z, +Z (up) -> +Y', { x: M[0].map(v => f(v)), y: M[1].map(v => f(v)), z: M[2].map(v => f(v)) });
    const fb = t.objects.f_top.bbox, st = t.objects.f_stem.bbox;
    ok((fb[0][0] + fb[1][0]) / 2 < (st[0][0] + st[1][0]) / 2, 'the arms of the F are on the game\'s -X side of its stem (what a camera in front, at -Z, sees on its right)');
  };

  C.analytic = () => {
    const t = T(), { prims } = scene0(), A = t.analytic, root = prims.filter(q => q.node === t.asset && !q.mat.blend);
    { // the wavy sheet: height and normal from its formula at every vertex
      const d = A.dense; let n = 0, eh = 0, en = 0;
      for (const q of root) for (let i = 0; i < q.p.nv; i++) {
        const gx = q.W[i * 3], gy = q.W[i * 3 + 1], gz = q.W[i * 3 + 2];
        const bx = -gx, by = gz;         // Blender x, y
        if (bx < d.x0 - 1e-3 || bx > d.x0 + d.size + 1e-3 || by < d.y0 - 1e-3 || by > d.y0 + d.size + 1e-3 || gy < d.z0 - d.amp - 0.01 || gy > d.z0 + d.amp + 0.01) continue;
        const u = (bx - d.x0) / d.size, v = (by - d.y0) / d.size;
        const z = d.z0 + d.amp * Math.sin(d.fu * u) * Math.cos(d.fv * v);
        if (Math.abs(gy - z) > 0.01) continue;      // something else in the region
        n++; eh = Math.max(eh, Math.abs(gy - z));
        const dzx = d.amp * d.fu * Math.cos(d.fu * u) * Math.cos(d.fv * v) / d.size, dzy = -d.amp * d.fv * Math.sin(d.fu * u) * Math.sin(d.fv * v) / d.size;
        const l = Math.hypot(dzx, dzy, 1), nb = [-dzx / l, -dzy / l, 1 / l], ng = [-nb[0], nb[2], nb[1]];
        const dot = q.N[i * 3] * ng[0] + q.N[i * 3 + 1] * ng[1] + q.N[i * 3 + 2] * ng[2];
        en = Math.max(en, Math.acos(Math.min(1, dot)) * 180 / Math.PI);
      }
      ok(n === (d.n + 1) * (d.n + 1), 'the sheet has exactly its ' + (d.n + 1) * (d.n + 1) + ' vertices (smooth, nothing split, nothing merged)', n);
      ok(eh < 2e-3 && en < 1.0, 'the sheet follows its formula', 'height within ' + (eh * 1000).toFixed(2) + ' mm, normals within ' + en.toFixed(2) + ' degrees');
    }
    { // cylinder: smooth round the side, flat caps
      const c = A.cyl, cc = c.centre; let side = 0, cap = 0, bad = 0;
      for (const q of root) for (let i = 0; i < q.p.nv; i++) {
        const x = q.W[i * 3] - cc[0], y = q.W[i * 3 + 1] - cc[1], z = q.W[i * 3 + 2] - cc[2], r = Math.hypot(x, z);
        if (r > c.radius + 2e-3 || Math.abs(y) > c.half + 2e-3) continue;
        const nx = q.N[i * 3], ny = q.N[i * 3 + 1], nz = q.N[i * 3 + 2];
        if (Math.abs(ny) > 0.999) cap++;
        else if (Math.abs(ny) < 0.02 && r > c.radius - 2e-3 && (nx * x + nz * z) / r > 0.999) side++;
        else bad++;
      }
      ok(side >= 64 && cap >= 64 && bad === 0, 'cylinder: side normals radial (smooth), cap normals along the axis (flat), hard edge between', { side, cap, other: bad });
    }
    { // ball: lower half smooth (normals radial), upper half flat (three equal normals per triangle, not radial)
      const hb = A.halfball, cc = hb.centre; let smoothOk = 0, smoothBad = 0, flatOk = 0, flatBad = 0;
      for (const q of root) {
        const { W, N, p } = q;
        for (let i = 0; i < p.ni; i += 3) {
          const ids = [p.idx[i], p.idx[i + 1], p.idx[i + 2]];
          if (!ids.every(k => Math.abs(Math.hypot(W[k * 3] - cc[0], W[k * 3 + 1] - cc[1], W[k * 3 + 2] - cc[2]) - hb.radius) < 3e-3)) continue;
          const cy = (W[ids[0] * 3 + 1] + W[ids[1] * 3 + 1] + W[ids[2] * 3 + 1]) / 3 - cc[1];
          if (cy < 0 && ids.some(k => W[k * 3 + 1] - cc[1] > -1e-3)) continue;      // on the seam the smooth side only averages its own half
          const rad = ids.map(k => (N[k * 3] * (W[k * 3] - cc[0]) + N[k * 3 + 1] * (W[k * 3 + 1] - cc[1]) + N[k * 3 + 2] * (W[k * 3 + 2] - cc[2])) / hb.radius);
          const same = ids.every(k => Math.abs(N[k * 3] - N[ids[0] * 3]) + Math.abs(N[k * 3 + 1] - N[ids[0] * 3 + 1]) + Math.abs(N[k * 3 + 2] - N[ids[0] * 3 + 2]) < 1e-3);
          if (cy < 0) { if (rad.every(r => r > 0.9995)) smoothOk++; else smoothBad++; }
          else { if (same && rad.some(r => r < 0.9995)) flatOk++; else flatBad++; }
        }
      }
      ok(smoothOk > 100 && smoothBad === 0 && flatOk > 100 && flatBad === 0, 'ball: smooth half and flat half keep their shading', { smooth: smoothOk, smooth_wrong: smoothBad, flat: flatOk, flat_wrong: flatBad });
    }
    { // tinted plate: colour is the base colour times (x, y, 0.5) across the plate
      const tp = A.tintplate; let n = 0, err = 0;
      for (const q of root) for (let i = 0; i < q.p.nv; i++) {
        const bx = -q.W[i * 3], by = q.W[i * 3 + 2], bz = q.W[i * 3 + 1];
        if (bx < tp.x0 - 1e-3 || bx > tp.x0 + 1 + 1e-3 || by < tp.y0 - 1e-3 || by > tp.y0 + 1 + 1e-3 || Math.abs(bz - 0.5) > 1e-3) continue;
        const want = [tp.base[0] * (bx - tp.x0), tp.base[1] * (by - tp.y0), tp.base[2] * 0.5], cn = q.p.colN;
        n++; for (let k = 0; k < 3; k++) err = Math.max(err, Math.abs(l2s(q.p.col[i * cn + k]) - l2s(Math.min(Math.max(want[k], 0), 1))));
      }
      ok(n === 81 && err < 0.5 / 63 + 2.5e-3, 'vertex tints: 81 vertices carry base colour x tint', { vertices: n, worst_srgb_error: f(err, 4) });
    }
  };

  C.materials = () => {
    const t = T(), R = rec(), { m } = scene0();
    const meshes = []; m.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const [name, d] of Object.entries(t.materials)) {
      const mat = api.assetMaterial(NAME(), name);
      if (!Object.values(t.objects).some(o => o.corners.some(c => c.mat === name))) continue;
      if (!ok(!!mat, 'material ' + name + ' can be found by name')) continue;
      const def = R.materials[R.materials.findIndex(b => b.name === name || (b.src || []).includes(name))], bad = [];
      const mine = meshes.filter(o => o.material === mat);
      if (!mine.length) bad.push('no mesh uses it');
      if (d.blend === 'shadow') { if (!mat.isMeshBasicMaterial || !mat.transparent || mat.depthWrite) bad.push('shadow layer material'); }
      else {
        if (d.blend === 'opaque' && (mat.transparent || mat.alphaTest > 0)) bad.push('should be opaque');
        if (d.blend === 'cutout' && (Math.abs(mat.alphaTest - d.alpha_test) > 1e-6 || mat.transparent)) bad.push('alphaTest ' + mat.alphaTest);
        if (d.blend === 'blend' && (!mat.transparent || mat.depthWrite || mat.blending !== THREE.NormalBlending)) bad.push('blend state');
        if (d.blend === 'add' && (!mat.transparent || mat.depthWrite || mat.blending !== THREE.AdditiveBlending)) bad.push('additive state');
        if ((mat.side === THREE.DoubleSide) !== !!d.double) bad.push('side');
        const em = d.emissive || [0, 0, 0];
        if (Math.abs(mat.emissive.r - em[0]) + Math.abs(mat.emissive.g - em[1]) + Math.abs(mat.emissive.b - em[2]) > 1e-4) bad.push('emissive ' + mat.emissive.toArray().map(x => f(x)));
        if (!!mat.isMeshPhysicalMaterial !== d.coat > 0 || (d.coat > 0 && (Math.abs(mat.clearcoat - d.coat) > 1e-6 || Math.abs(mat.clearcoatRoughness - d.coat_rough) > 1e-6))) bad.push('clear coat');
        const u = mat.userData.asset.uniforms;
        if (Math.abs(u.bpEnvK.value - d.env) > 1e-6) bad.push('env ' + u.bpEnvK.value);
        if (d.sway > 0 ? !(mat.defines.BP_SWAY !== undefined && Math.abs(u.bpSwayK.value - d.sway) < 1e-6) : mat.defines.BP_SWAY !== undefined) bad.push('sway');
        if (d.map ? !(mat.map && mat.map.name === d.map) : !!mat.map) bad.push('map ' + (mat.map && mat.map.name));
        if (d.detail && !d.map && !(mat.defines.BP_DETAIL !== undefined)) bad.push('detail texture not switched on');
        if (!deep(def.flags || {}, d.flags || {})) bad.push('flags ' + JSON.stringify(def.flags));
        if (d.own && mat.name !== name) bad.push('own material renamed to ' + mat.name);
        if (mat.vertexColors !== true) bad.push('vertexColors');
      }
      for (const o of mine) {
        if (o.castShadow !== (d.cast && d.blend !== 'shadow')) bad.push('castShadow ' + o.castShadow);
        if (o.receiveShadow !== (d.receive && d.blend !== 'shadow')) bad.push('receiveShadow ' + o.receiveShadow);
        if ((o.layers.mask === 4) !== !!mat.transparent) bad.push('draw layer ' + o.layers.mask);
      }
      ok(!bad.length, 'material ' + name + ' (' + d.blend + ')', bad.length ? [...new Set(bad)] : undefined);
    }
    const lampT = api.assetModel(NAME(), { lod: 0, tint: { lamp: 0xff0000 } });
    let lm = null; lampT.traverse(o => { if (o.isMesh && o.material.name === 'lamp') lm = o.material; });
    ok(lm && lm !== api.assetMaterial(NAME(), 'lamp') && lm.color.r === 1 && lm.color.g === 0, 'opts.tint gives an own material its own colour without touching the shared one');
    out.push('INFO draw batches: ' + R.materials.map(b => b.name + '[' + (b.src || []).join(',') + ']').join(' '));
  };

  C.images = async () => {
    const t = T();
    for (const [name, im] of Object.entries(t.images)) {
      const ix = ASSETS.images.findIndex(q => q.name === name), tex = ASSETS.textures[ix];
      if (!ok(ix >= 0 && !!tex, 'picture ' + name + ' became a texture')) continue;
      const cv = document.createElement('canvas'); cv.width = im.w; cv.height = im.h;
      const g = cv.getContext('2d'); g.drawImage(tex.image, 0, 0);
      const px = g.getImageData(0, 0, im.w, im.h).data, bad = [];
      for (const [x, y, r, gg, b, a] of im.texels) {
        const o = (y * im.w + x) * 4, got = [px[o], px[o + 1], px[o + 2], px[o + 3]];
        if (Math.abs(got[3] - a) > 16) bad.push([x, y, 'alpha', got[3], a]);
        if (r !== null && a > 0 && (Math.abs(got[0] - r) > 40 || Math.abs(got[1] - gg) > 40 || Math.abs(got[2] - b) > 40)) bad.push([x, y, got, [r, gg, b]]);
      }
      const wrap = im.wrap === 'clamp' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      ok(!bad.length && tex.image.width === im.w && tex.image.height === im.h && tex.flipY === false && tex.wrapS === wrap && tex.colorSpace === THREE.SRGBColorSpace,
        'picture ' + name + ': size, texels (row 0 at the top), alpha, wrapping, colour space', bad.length ? bad : { w: tex.image.width, h: tex.image.height });
    }
    // which way up: the top left corner of the quad (seen from the front) must show the top left of the picture
    const { prims } = scene0(), q = prims.find(q => (q.mat.src || []).includes('leafcut')), tl = [-8.5, 1.5, 0];
    let found = null;
    if (q) for (let i = 0; i < q.p.nv; i++) if (Math.hypot(q.W[i * 3] - tl[0], q.W[i * 3 + 1] - tl[1], q.W[i * 3 + 2] - tl[2]) < 1e-3) found = [q.p.uv[i * 2], q.p.uv[i * 2 + 1]];
    ok(found && Math.abs(found[0]) < 2e-3 && Math.abs(found[1]) < 2e-3, 'the picture is the right way up: the quad\'s top left corner has UV (0, 0), the first texel', found);
  };

  C.anchors = () => {
    const t = T(), { m } = scene0();
    const names = api.assetMeta(NAME()).anchors;
    ok(deep([...names].sort(), Object.keys(t.anchors).sort()), 'anchor names', names);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    const fixed = api.assetModel(NAME(), { static: true, lod: 0 }); fixed.updateMatrixWorld(true);
    for (const [name, a] of Object.entries(t.anchors)) {
      const an = api.assetAnchor(NAME(), name);
      if (!ok(!!an, 'anchor ' + name + ' exists')) continue;
      ok(an.node === a.node && deep(an.data, a.data), 'anchor ' + name + ': node and extra data', { node: an.node, data: an.data });
      for (const [label, model] of [['', m], [' on a static (welded) model', fixed]]) {
        let r = null, err = null;
        try { r = api.assetAnchorWorld(model, name, pos, quat); } catch (e) { err = e.message; }
        if (!ok(!!r && !err, 'anchor ' + name + label + ': assetAnchorWorld answers', err || undefined)) continue;
        const dp = Math.hypot(pos.x - a.pos[0], pos.y - a.pos[1], pos.z - a.pos[2]);
        const dq = 1 - Math.abs(quat.x * a.quat[0] + quat.y * a.quat[1] + quat.z * a.quat[2] + quat.w * a.quat[3]);
        ok(dp < 2e-5 && dq < 1e-6, 'anchor ' + name + label + ': world position and direction', { position_error: +dp.toExponential(2), rotation_error: +dq.toExponential(2) });
      }
    }
    // drive a part in the middle of the chain: the anchor on the last part must follow
    const live = api.assetModel(NAME(), { lod: 0 }), fore = live.userData.nodes.forearm;
    const before = api.assetAnchorWorld(live, 'tip', new THREE.Vector3()).clone();
    const R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
    fore.quaternion.multiply(R);
    const after = api.assetAnchorWorld(live, 'tip', new THREE.Vector3(), quat).clone();
    const W = n => rowMajor(t.nodes[n].world), armW = W('arm'), foreW = W('forearm'), handW = W('hand');
    const want = new THREE.Vector3().fromArray(t.anchors.tip.pos).applyMatrix4(foreW.clone().invert()).applyQuaternion(R).applyMatrix4(foreW);
    ok(after.distanceTo(want) < 3e-5 && before.distanceTo(after) > 0.05, 'turning the forearm part by 0.5 rad carries the hand\'s anchor with it', { moved: f(before.distanceTo(after)), error: +after.distanceTo(want).toExponential(2) });
    // a placed, turned and scaled model
    const placed = api.assetModel(NAME(), { lod: 0 }); placed.position.set(10, 2, -5); placed.rotation.set(0.2, 1.1, -0.3); placed.scale.setScalar(1.5);
    const got = api.assetAnchorWorld(placed, 'tip', new THREE.Vector3());
    placed.updateMatrixWorld(true);
    const exp = new THREE.Vector3().fromArray(t.anchors.tip.pos).applyMatrix4(placed.matrixWorld);
    ok(got.distanceTo(exp) < 5e-5, 'assetAnchorWorld follows the model\'s own position, rotation and scale', +got.distanceTo(exp).toExponential(2));
  };

  C.lod = () => {
    const R = rec(), t = T(), cam = E('camera'), Q = E('Q'), settings = E('settings');
    const m = api.assetModel(NAME());
    const vis = () => { let tri = 0; const mats = new Set(); for (const e of m.userData.lodMeshes) if (e.mesh.visible) { tri += e.mesh.geometry.index.count / 3; mats.add(e.mesh.material.name); } return { tri, mats }; };
    ok(m.userData.lodAuto === true, 'a model with several levels switches by itself unless a level is given');
    for (let l = 0; l < R.lods.length; l++) {
      api.assetSetLod(m, l); const v = vis();
      ok(v.tri === R.tris[l], 'level ' + l + ': the visible meshes are that level\'s triangles', { visible: v.tri, level: R.tris[l] });
      const want = n => t.objects[n].lod_max >= l;
      ok(v.mats.has('boltmat') === want('bolt_only0') && v.mats.has('trimmat') === want('trim_only1') && v.mats.has('shadow') === want('ground_shadow'),
        'level ' + l + ': detail-only things are ' + ['all there', 'partly gone', 'gone'][l], { bolt: v.mats.has('boltmat'), trim: v.mats.has('trimmat'), ground_shadow: v.mats.has('shadow') });
    }
    // distances: the exporter's numbers are for the medium preset (Q.near = 90) and scale with Q.near
    const k = Q.near / 90, low = settings.quality === 'low' ? 1 : 0, d1 = t.lods[0][1] * k, d2 = t.lods[1][1] * k;
    const scn = E('scene'); scn.add(m); m.position.set(0, 0, 0);
    const at = d => { cam.position.set(d, 0, 0); m.updateMatrixWorld(true); ASSETS.lodAt = 0; api.updateAssets(0.016); return m.userData.lod; };
    api.assetSetLod(m, 0);
    const seq = [[d1 * 0.5, 0], [d1 * 0.98, 0], [d1 * 1.1, 1], [d1 * 0.98, 1], [d1 * 0.9, 0], [d2 * 1.1, 2], [d2 * 0.98, 2], [d2 * 0.9, 1], [d2 * 5, 2], [0.5, 0]];
    const got = seq.map(([d]) => at(d)), want = seq.map(([, l]) => Math.max(l, low));
    ok(deep(got, want), 'levels switch at ' + f(d1, 1) + ' m and ' + f(d2, 1) + ' m on this quality (with a little slack against flicker)' + (low ? '; Low never shows level 0' : ''), { distances: seq.map(s => f(s[0], 1)), got, want });
    m.position.set(300, 0, 0); const far = at(300 + d1 * 0.5);
    ok(far === Math.max(0, low), 'the distance is measured from the model, wherever it stands', far);
    scn.remove(m);
    const fixed = api.assetModel(NAME(), { lod: 1 });
    ok(fixed.userData.lodAuto === false && fixed.userData.lod === 1, 'opts.lod pins a level');
    const st = api.assetModel(NAME(), { static: true }); let tri = 0;
    api.assetSetLod(st, 2); for (const e of st.userData.lodMeshes) if (e.mesh.visible) tri += e.mesh.geometry.index.count / 3;
    ok(tri === R.tris[2], 'a static (welded) model has the same triangles at level 2', { visible: tri, level: R.tris[2] });
  };

  C.static = () => {
    const R = rec(), t = T();
    const m = api.assetModel(NAME(), { static: true, lod: 0 });
    const meshes = []; m.traverse(o => { if (o.isMesh) meshes.push(o); });
    const live = api.assetModel(NAME(), { lod: 0 }); let liveMeshes = 0; live.traverse(o => { if (o.isMesh) liveMeshes++; });
    let tri = 0; const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; let bad = 0, wrongIdx = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    for (const o of meshes) {
      const g = o.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, I = g.index.array;
      tri += I.length / 3;
      if ((P.length / 3 > 65535) !== (I instanceof Uint32Array)) wrongIdx++;
      if (o.material.name !== 'shadow') for (let i = 0; i < P.length; i++) { const k = i % 3; if (P[i] < lo[k]) lo[k] = P[i]; if (P[i] > hi[k]) hi[k] = P[i]; }
      for (let i = 0; i < I.length; i += 3) {
        a.fromArray(P, I[i] * 3); b.fromArray(P, I[i + 1] * 3); c.fromArray(P, I[i + 2] * 3);
        n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
        if (n.length() > 1e-12 && n.x * (N[I[i] * 3] + N[I[i + 1] * 3] + N[I[i + 2] * 3]) + n.y * (N[I[i] * 3 + 1] + N[I[i + 1] * 3 + 1] + N[I[i + 2] * 3 + 1]) + n.z * (N[I[i] * 3 + 2] + N[I[i + 1] * 3 + 2] + N[I[i + 2] * 3 + 2]) <= 0) bad++;
      }
      const bb = g.boundingBox; let over = 0;
      for (let i = 0; i < P.length; i++) { const k = i % 3; over = Math.max(over, bb.min.getComponent(k) - P[i], P[i] - bb.max.getComponent(k)); }
      if (over > 1e-5) bad += 1e6;
    }
    const err = Math.max(...[0, 1, 2].map(k => Math.max(Math.abs(lo[k] - t.bbox[0][k]), Math.abs(hi[k] - t.bbox[1][k]))));
    ok(meshes.length === R.materials.length && meshes.length < liveMeshes, 'static: one mesh per draw batch (' + meshes.length + ' instead of ' + liveMeshes + ' with moving parts)');
    ok(tri === R.tris[0] && bad === 0 && wrongIdx === 0, 'static: all triangles, wound right, inside their culling boxes, index width right', { tri, bad, wrongIdx });
    ok(err < 1e-3, 'static: the parts are welded where they stand at rest (same bounding box)', 'error ' + (err * 1000).toFixed(3) + ' mm');
    ok(Object.keys(m.userData.nodes).length === 1, 'static: only the root node is left to move');
  };

  C.instancing = () => {
    const R = rec();
    const g = api.assetGeometry(NAME(), { material: 'paint_red' });
    ok(g && g.isBufferGeometry && ['position', 'normal', 'color', 'bpAux'].every(a => g.attributes[a]) && g.index, 'assetGeometry by material name gives a geometry with position, normal, color, bpAux and an index');
    ok(g === api.assetGeometry(NAME(), { material: 'paint_red' }), 'the geometry is shared between calls');
    const gs = api.assetGeometry(NAME(), { static: true, lod: 1, material: 'oak' }), gl = api.assetGeometry(NAME(), { static: true, lod: 0, material: 'oak' });
    ok(gs && gl && gs.index.count < gl.index.count, 'assetGeometry static at level 1 is lighter than at level 0', gs && gl ? [gs.index.count / 3, gl.index.count / 3] : null);
    ok(api.assetGeometry(NAME(), { node: 'hand' }) !== null && api.assetGeometry(NAME(), { node: 'nope' }) === null && api.assetGeometry(NAME(), { material: 'nope' }) === null, 'assetGeometry by node; null for an unknown node or material');
    ok(api.assetGeometry(NAME(), { material: 'boltmat', lod: 1 }) === null, 'assetGeometry is null for a thing that does not exist at that level', String(api.assetGeometry(NAME(), { material: 'boltmat', lod: 1 })));
    const all0 = api.assetGeometries(NAME(), 0), all2 = api.assetGeometries(NAME(), 2);
    const sum = L => L.reduce((a, e) => a + e.geometry.index.count / 3, 0);
    ok(all0.length === R.groups.length && sum(all0) === R.tris[0] && sum(all2) === R.tris[2], 'assetGeometries lists every primitive of a level', { level0: [all0.length, sum(all0)], level2: [all2.length, sum(all2)], want: R.tris });
    const mat = api.assetMaterial(NAME(), 'paint_red');
    const im = new THREE.InstancedMesh(g, mat, 5);
    ok(im.count === 5 && im.geometry.boundingSphere.radius > 0, 'an InstancedMesh can be made from assetGeometry and assetMaterial');
  };

  C.unknown = () => {
    const none = 'no-such-asset';
    let r;
    try {
      r = [api.assetModel(none), api.assetGeometry(none), api.assetGeometries(none), api.assetMeta(none), api.assetAnchor(none, 'x'), api.assetMaterial(none, 'x'), api.assetAnchorWorld(null, 'x'), api.assetHas(none),
        ASSETS.count ? api.assetAnchor([...ASSETS.by.keys()][0], 'no-such-anchor') : null, ASSETS.count ? api.assetMaterial([...ASSETS.by.keys()][0], 'no-such-material') : null];
    } catch (e) { r = 'threw ' + e.message; }
    ok(Array.isArray(r) && r.every(v => v === null || v === false), 'an unknown asset, anchor or material gives null everywhere, nothing throws', Array.isArray(r) ? r.map(String) : r);
    try { api.updateAssets(0.016); ok(true, 'updateAssets runs'); } catch (e) { ok(false, 'updateAssets runs', e.message); }
    out.push('INFO pack: ' + ASSETS.count + ' models, ready ' + ASSETS.ready + ', error ' + ASSETS.err + ', ' + ASSETS.ms.toFixed(1) + ' ms');
  };

  // the plain-JavaScript inflate must give the same bytes as the browser's
  C.inflate = async () => {
    const P = window.__packed;
    const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
    const t0 = performance.now(); const u8 = api.assetB64(P.b64); const t1 = performance.now();
    const nat = await api.assetInflate(u8, P.raw); const t2 = performance.now();
    const js = api.assetInflateJS(u8, P.raw); const t3 = performance.now();
    const js0 = api.assetInflateJS(u8, 0); const t4 = performance.now();
    ok(nat.length === P.raw && same(nat, js), 'JavaScript inflate gives the same ' + P.raw + ' bytes as the browser\'s DecompressionStream', { base64_ms: f(t1 - t0, 1), native_ms: f(t2 - t1, 1), js_ms: f(t3 - t2, 1) });
    ok(same(nat, js0), 'JavaScript inflate without knowing the size (growing buffer)', { ms: f(t4 - t3, 1) });
    const DS = window.DecompressionStream; let viaFallback = null;
    try { window.DecompressionStream = undefined; globalThis.DecompressionStream = undefined; viaFallback = await api.assetInflate(u8, P.raw); } finally { window.DecompressionStream = DS; globalThis.DecompressionStream = DS; }
    ok(viaFallback && same(nat, viaFallback), 'assetInflate falls back to it when the browser has no DecompressionStream');
    for (const [k, label] of [['stored', 'stored blocks (no compression)'], ['fixed', 'fixed Huffman codes'], ['tiny', 'a 1-byte and an empty stream']]) {
      if (!P[k]) continue;
      if (k === 'tiny') { const a = api.assetInflateJS(api.assetB64(P.tiny[0]), 0), b = api.assetInflateJS(api.assetB64(P.tiny[1]), 0); ok(a.length === 1 && a[0] === 65 && b.length === 0, 'JavaScript inflate: ' + label); continue; }
      const got = api.assetInflateJS(api.assetB64(P[k]), 0);
      ok(same(got, nat.subarray(0, got.length)) && got.length === P.part, 'JavaScript inflate: ' + label, got.length + ' bytes');
    }
    let threw = false; try { api.assetInflateJS(new Uint8Array([7, 255, 255, 255]), 0); } catch (e) { threw = true; }
    ok(threw, 'JavaScript inflate refuses a broken stream instead of returning rubbish');
  };

  window.__C = {
    api, scene0,
    async run(name) { out = []; try { await C[name](); } catch (e) { out.push('FAIL ' + name + ' threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)); } return '[' + name + ']\n  ' + out.join('\n  '); },
    names: Object.keys(C),
  };
})();
