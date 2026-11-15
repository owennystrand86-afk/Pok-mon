
// ───────────────────── 31b. Trees that break ─────────────────────
// A tsunami (or a plane crashing nearby) snaps palms and trees into pieces: trunk sections, fronds,
// branches, clumps of leaves and coconuts, each one tumbling, flying and then floating away on the
// flood. A tree whose roots the river has washed out topples into the water and drifts downstream.
// Every kind of piece is one instanced mesh, so hundreds of pieces cost a handful of draw calls.
const TREEFALL = { types: {}, pieces: [], broken: new Set(), max: 2400, acc: 0, checkAcc: 0 };
const TF_CAP = { palmSeg: 450, treeSeg: 320, branch: 600, frond: 1200, leaves: 600, coconut: 450 };
const _tz = new THREE.Matrix4().makeScale(0, 0, 0), _tm4 = new THREE.Matrix4(), _tq4 = new THREE.Quaternion(), _tv3 = new THREE.Vector3(), _ts3 = new THREE.Vector3();
function buildTreefall() {
  const mat = (key, side) => patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: side || THREE.FrontSide }), { key: 'tf-' + key });
  const colorize = (g, fn) => { g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) c.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g; };
  const palmSeg = colorize(new THREE.CylinderGeometry(0.15, 0.18, 1, 10, 6), (x, y) => { const r = (y + 0.5) * 9 % 1; const v = r < 0.2 ? 0.72 : 1; return [0.5 * v, 0.42 * v, 0.32 * v]; });
  const treeSeg = colorize(new THREE.CylinderGeometry(0.22, 0.3, 1, 9, 3), (x, y, z) => { const v = 0.8 + 0.2 * Math.sin(y * 13 + x * 9); return [0.33 * v, 0.25 * v, 0.17 * v]; });
  const branch = colorize(new THREE.CylinderGeometry(0.05, 0.09, 1, 6), () => [0.3, 0.22, 0.15]);
  // a palm frond: a long arched rib with leaflets down both sides
  const frondG = (() => {
    const pos = [], col = [], idx = []; const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = -t * 3.2, y = Math.sin(t * Math.PI * 0.8) * 0.6 - t * t * 0.9, w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.55;
      pos.push(-w, y - w * 0.25, z, 0, y + 0.03, z, w, y - w * 0.25, z);
      const gc = [0.22 + t * 0.12, 0.42 + t * 0.06, 0.12]; col.push(...gc, 0.3, 0.42, 0.15, ...gc);
      if (i < N) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const leaves = (() => { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + Noise.n3(x * 2.3, y * 2.3, z * 2.3) * 0.35; p.setXYZ(i, x * d, y * d * 0.7, z * d); } return colorize(g, (x, y, z) => { const v = 0.7 + 0.3 * Math.sin(x * 7 + z * 5) * Math.cos(y * 6); return [0.13 * v, 0.3 * v, 0.08 * v]; }); })();
  const coconut = colorize(new THREE.SphereGeometry(0.13, 10, 8), () => [0.36, 0.42, 0.14]);
  const defs = { palmSeg: [palmSeg, mat('bark')], treeSeg: [treeSeg, mat('bark2')], branch: [branch, mat('branch')], frond: [frondG, mat('frond', THREE.DoubleSide)], leaves: [leaves, mat('leaves')], coconut: [coconut, mat('nut')] };
  for (const [k, [g, m]] of Object.entries(defs)) {
    const im = new THREE.InstancedMesh(g, m, TF_CAP[k]); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; scene.add(im);
    TREEFALL.types[k] = { mesh: im, free: [], used: 0 };
  }
}
function tfSlot(type) {
  const T0 = TREEFALL.types[type]; if (!T0) return -1;
  if (T0.free.length) return T0.free.pop();
  if (T0.used >= T0.mesh.instanceMatrix.count) return -1;
  return T0.used++;
}
// hide a tree (its instances and its collider) and remember how to put it back
function hideTree(t) {
  const fields = t.kind === 'palm' ? [VEG.palmsT, VEG.palmsC] : [VEG.treesB, VEG.treesL];
  for (const f of fields) { const r = f.byId && f.byId.get(t.id); if (r) { r.mesh.setMatrixAt(r.i, _tz); r.mesh.instanceMatrix.needsUpdate = true; } }
  COLLIDERS.query(t.x, t.z, 1, c => { if (Math.hypot(c.x - t.x, c.z - t.z) < 0.05 && c.top > -1e8) { c.topWas = c.top; c.top = -1e9; } });
  TREEFALL.broken.add(t);
}
function unhideTrees() {
  for (const t of TREEFALL.broken) {
    const fields = t.kind === 'palm' ? [VEG.palmsT, VEG.palmsC] : [VEG.treesB, VEG.treesL];
    for (const f of fields) { const r = f.byId && f.byId.get(t.id); if (r) { r.mesh.setMatrixAt(r.i, r.m); r.mesh.instanceMatrix.needsUpdate = true; } }
    COLLIDERS.query(t.x, t.z, 1, c => { if (c.topWas !== undefined && Math.hypot(c.x - t.x, c.z - t.z) < 0.05) { c.top = c.topWas; delete c.topWas; } });
    t.down = false;
  }
  TREEFALL.broken.clear();
  for (const p of TREEFALL.pieces) { const T0 = TREEFALL.types[p.type]; T0.mesh.setMatrixAt(p.slot, _tz); T0.free.push(p.slot); T0.mesh.instanceMatrix.needsUpdate = true; }
  TREEFALL.pieces.length = 0;
}
function addPiece(type, pos, q, scale, vel, spin, r, float = 1) {
  if (TREEFALL.pieces.length >= TREEFALL.max) { const old = TREEFALL.pieces.shift(); const T0 = TREEFALL.types[old.type]; T0.mesh.setMatrixAt(old.slot, _tz); T0.free.push(old.slot); }
  const slot = tfSlot(type); if (slot < 0) return;
  const T0 = TREEFALL.types[type]; T0.mesh.count = Math.max(T0.mesh.count, slot + 1);
  TREEFALL.pieces.push({ type, slot, p: pos.clone(), q: q.clone(), s: scale.clone(), v: vel.clone(), w: spin.clone(), r, float, age: 0, rest: 0 });
}
// break a tree apart. dir: which way the force pushes it, k: how hard (m/s)
function breakTree(t, dir, k) {
  if (t.down) return; t.down = true;
  hideTree(t);
  const up = new THREE.Vector3(0, 1, 0), rnd = () => new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
  const push = (h) => new THREE.Vector3(dir.x * k * (0.5 + h * 0.08) + rand(-1.5, 1.5), rand(0.5, 2.5) + k * 0.25 * Math.min(1, h / 6), dir.z * k * (0.5 + h * 0.08) + rand(-1.5, 1.5));
  if (t.kind === 'palm') {
    const L = t.leanDir, top = new THREE.Vector3(t.x + Math.cos(L) * t.lean * t.H, t.y + t.H, t.z + Math.sin(L) * t.lean * t.H), base = new THREE.Vector3(t.x, t.y + 0.25, t.z);
    // the trunk snaps into three pieces along its curve
    const nSeg = 3;
    for (let i = 0; i < nSeg; i++) {
      const a = i / nSeg, b = (i + 1) / nSeg;
      const pa = base.clone().lerp(top, a), pb = base.clone().lerp(top, b);
      pa.x += Math.cos(L) * t.lean * t.H * (a * a - a) * 0.6; pb.x += Math.cos(L) * t.lean * t.H * (b * b - b) * 0.6;
      const mid = pa.clone().add(pb).multiplyScalar(0.5), len = pa.distanceTo(pb);
      const q = new THREE.Quaternion().setFromUnitVectors(up, pb.clone().sub(pa).normalize());
      addPiece('palmSeg', mid, q, new THREE.Vector3(t.s, len, t.s), push(mid.y - t.y), rnd().multiplyScalar(2 + k * 0.2), 0.2 * t.s, 0.8);
    }
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + rand(-0.2, 0.2), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.3, 0.3), a, 0, 'YXZ'));
      addPiece('frond', top.clone().add(new THREE.Vector3(rand(-0.3, 0.3), rand(-0.2, 0.3), rand(-0.3, 0.3))), q, new THREE.Vector3(t.s, t.s, t.s), push(t.H).add(new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)).multiplyScalar(rand(1, 4))), rnd().multiplyScalar(4 + k * 0.3), 0.3, 1);
    }
    for (let i = 0; i < 3; i++) addPiece('coconut', top.clone().add(new THREE.Vector3(rand(-0.4, 0.4), -0.3, rand(-0.4, 0.4))), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1), push(t.H).add(rnd().multiplyScalar(2)), rnd().multiplyScalar(6), 0.13, 1);
  } else {
    const H = 8 * t.s, base = new THREE.Vector3(t.x, t.y, t.z);
    for (let i = 0; i < 2; i++) {
      const y0 = i * H * 0.42, y1 = (i + 1) * H * 0.42, mid = base.clone().add(new THREE.Vector3(0, (y0 + y1) / 2, 0));
      addPiece('treeSeg', mid, new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.1, 0.1), 0, rand(-0.1, 0.1))), new THREE.Vector3(t.s, y1 - y0, t.s), push(mid.y - t.y), rnd().multiplyScalar(1.5 + k * 0.15), 0.3 * t.s, 0.7);
    }
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU), q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(Math.cos(a), 0.7, Math.sin(a)).normalize());
      addPiece('branch', base.clone().add(new THREE.Vector3(Math.cos(a) * 1.2 * t.s, H * rand(0.6, 0.8), Math.sin(a) * 1.2 * t.s)), q, new THREE.Vector3(t.s, 2.2 * t.s, t.s), push(H * 0.7), rnd().multiplyScalar(3 + k * 0.2), 0.1, 1);
    }
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU), r = rand(0.8, 2.2) * t.s;
      addPiece('leaves', base.clone().add(new THREE.Vector3(Math.cos(a) * r, H * rand(0.75, 1.0), Math.sin(a) * r)), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6))), new THREE.Vector3(1, 1, 1).multiplyScalar(t.s * rand(1.1, 1.7)), push(H).add(rnd().multiplyScalar(2)), rnd().multiplyScalar(1.5 + k * 0.1), 1.2 * t.s, 1);
    }
  }
}
// every tree on the island, with where it stands
function allTrees() {
  if (TREEFALL.all) return TREEFALL.all;
  const list = [];
  for (const p of VEG.palmSpots || []) list.push({ kind: 'palm', ...p });
  for (const t of VEG.treeSpots || []) list.push({ kind: 'tree', ...t });
  TREEFALL.all = list;
  return list;
}
function updateTreefall(dt) {
  if (!TREEFALL.types.palmSeg) return;
  const t = U.uTime.value, cam = camera.position;
  // the tsunami's flood snaps trees it runs into near you
  TREEFALL.acc += dt;
  if (TREEFALL.acc > 0.2) {
    TREEFALL.acc = 0;
    if (TSU.on && TSU.k > 0.2) {
      const d = U.uTsuDir.value, dir = new THREE.Vector3(d.x, 0, d.y);
      for (const tr of allTrees()) {
        if (tr.down || Math.abs(tr.x - cam.x) > 170 || Math.abs(tr.z - cam.z) > 170) continue;
        const sF = tr.x * d.x + tr.z * d.y - TSU.front; if (sF > 8 || sF < -90) continue;
        const g = groundHeight(tr.x, tr.z), e = tsunamiJS(tr.x, tr.z, -g), wd = e - g;
        if (wd > 1.1 + rng() * 0.8) breakTree(tr, dir, clamp(wd * 2.2 + tsunamiFlow(tr.x, tr.z) * 0.6, 3, 22));
      }
    }
  }
  // trees whose roots the river (or your digging) has washed out fall into the water
  TREEFALL.checkAcc += dt;
  if (TREEFALL.checkAcc > 0.7) {
    TREEFALL.checkAcc = 0;
    for (const tr of allTrees()) {
      if (tr.down || Math.abs(tr.x - P.pos.x) > 70 || Math.abs(tr.z - P.pos.z) > 70) continue;
      const g = groundHeight(tr.x, tr.z), w = SAND.count ? sandWaterAt(tr.x, tr.z) : null;
      if (tr.ground - g > 0.45 || (w && w.depth > 0.15)) {
        // fall toward the lowest ground beside it, gently
        let best = null, lo = 1e9; for (let a = 0; a < TAU; a += TAU / 8) { const h = groundHeight(tr.x + Math.cos(a) * 2, tr.z + Math.sin(a) * 2); if (h < lo) { lo = h; best = a; } }
        breakTree(tr, new THREE.Vector3(Math.cos(best), 0, Math.sin(best)), 1.5);
        if (AUDIO.crash && Math.hypot(tr.x - P.pos.x, tr.z - P.pos.z) < 40) AUDIO.splash(0.6);
      }
    }
  }
  if (!TREEFALL.pieces.length) return;
  // pieces: gravity, bouncing on the ground, floating and drifting with the water
  const touched = new Set();
  for (let i = TREEFALL.pieces.length - 1; i >= 0; i--) {
    const p = TREEFALL.pieces[i]; p.age += dt;
    const far = Math.hypot(p.p.x - cam.x, p.p.z - cam.z);
    if (p.rest > 4 && far > 60) continue;          // settled and out of sight: leave it be
    const g = groundHeight(p.p.x, p.p.z), wa = waterAt(p.p.x, p.p.z), lvl = wa.level, wet = lvl > g + 0.08 && p.p.y < lvl + 0.1;
    p.v.y -= 9.8 * dt;
    if (wet) {
      const sub = clamp((lvl - p.p.y) / Math.max(p.r, 0.1) + 0.5, 0, 1.5);
      p.v.y += 9.8 * 1.5 * p.float * sub * dt; p.v.y *= Math.exp(-2.5 * dt);
      const fx = wa.fx || 0, fz = wa.fz || 0;
      p.v.x = damp(p.v.x, fx * 0.95, 1.2, dt); p.v.z = damp(p.v.z, fz * 0.95, 1.2, dt);
      p.w.multiplyScalar(Math.exp(-1.2 * dt));
      if (rng() < dt * 2 && far < 50) rippleDrop(p.p.x, p.p.z, 0.4, 0.06, 0.15);
    } else p.v.multiplyScalar(Math.exp(-0.05 * dt));
    p.p.addScaledVector(p.v, dt);
    const g2 = groundHeight(p.p.x, p.p.z);
    if (p.p.y < g2 + p.r) {
      p.p.y = g2 + p.r;
      if (p.v.y < -2.5 && far < 60 && FX.spawn) for (let k = 0; k < 4; k++) FX.spawn(p.p.x, g2 + 0.1, p.p.z, rand(-1, 1), rand(0.5, 2), rand(-1, 1), rand(0.5, 1), rand(0.03, 0.06), 3, 9.8);
      p.v.y = Math.abs(p.v.y) * 0.25; p.v.x *= 0.6; p.v.z *= 0.6; p.w.multiplyScalar(0.6);
      // long pieces settle lying down
      _tv3.set(0, 1, 0).applyQuaternion(p.q);
      if (p.type !== 'leaves' && p.type !== 'coconut') { const flat = new THREE.Quaternion().setFromUnitVectors(_tv3, new THREE.Vector3(_tv3.x, 0, _tv3.z).normalize().lengthSq() > 0.01 ? new THREE.Vector3(_tv3.x, 0, _tv3.z).normalize() : new THREE.Vector3(1, 0, 0)); p.q.premultiply(new THREE.Quaternion().slerp(flat, Math.min(1, dt * 4))); }
    }
    if (p.w.lengthSq() > 1e-6) { _tq4.setFromAxisAngle(_tv3.copy(p.w).normalize(), p.w.length() * dt); p.q.premultiply(_tq4); }
    const moving = p.v.lengthSq() > 0.05 || wet;
    p.rest = moving ? 0 : p.rest + dt;
    const T0 = TREEFALL.types[p.type];
    T0.mesh.setMatrixAt(p.slot, _tm4.compose(p.p, p.q, p.s)); touched.add(T0.mesh);
    // washed far out to sea, or lying around for many minutes: gone
    if (p.age > 300 || (wet && g < -25)) { T0.mesh.setMatrixAt(p.slot, _tz); T0.free.push(p.slot); TREEFALL.pieces.splice(i, 1); }
  }
  for (const m of touched) m.instanceMatrix.needsUpdate = true;
}
// a blast nearby (the plane crashing) throws the trees around it
function blastTrees(x, z, radius, k) {
  for (const tr of allTrees()) {
    const d = Math.hypot(tr.x - x, tr.z - z); if (d > radius || tr.down) continue;
    breakTree(tr, new THREE.Vector3((tr.x - x) / (d || 1), 0, (tr.z - z) / (d || 1)), k * (1 - d / radius) + 3);
  }
}
