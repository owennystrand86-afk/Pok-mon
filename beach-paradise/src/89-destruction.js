
// ───────────────────── 31. What a tsunami leaves behind ─────────────────────
// As the flood runs over the land it scours the ground away (the island mesh, its height
// texture and the sand layer all follow), knocks palms and trees flat, and if it is deep and
// fast enough at the cabin, tears the cabin apart into floating wreckage. "Repair the island"
// in the settings puts everything back.
const DESTROY = { N: 256, grid: null, tex: null, dirty: null, eroded: false, acc: 0, meshAcc: 0, debris: [], saved: null };
function initDestruction() {
  const N = DESTROY.N;
  DESTROY.grid = new Uint8Array(N * N);
  DESTROY.tex = new THREE.DataTexture(DESTROY.grid, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  DESTROY.tex.magFilter = DESTROY.tex.minFilter = THREE.LinearFilter; DESTROY.tex.needsUpdate = true;
  U.uDestroyTex.value = DESTROY.tex;
  U.uDestroyRect.value.set(T.min, T.min, 1 / T.size, 0);
  T.h0 = T.h.slice(); T.mask0 = T.mask.slice();
}
// how flattened the plants at (x, z) are, 0..1 (the same lookup the plant shaders do)
function destroyedAt(x, z) {
  if (!DESTROY.grid || !U.uDestroyRect.value.w) return 0;
  const N = DESTROY.N, i = clamp(Math.floor((x - T.min) / T.size * N), 0, N - 1), j = clamp(Math.floor((z - T.min) / T.size * N), 0, N - 1);
  return DESTROY.grid[j * N + i] / 255;
}
function markDirty(i, j) {
  const d = DESTROY.dirty || (DESTROY.dirty = { i0: 1e9, j0: 1e9, i1: -1, j1: -1 });
  if (i < d.i0) d.i0 = i; if (i > d.i1) d.i1 = i; if (j < d.j0) d.j0 = j; if (j > d.j1) d.j1 = j;
}
// called a few times a second while a tsunami is running
function tsunamiErode(dt) {
  if (!T.h0) return;
  const d = U.uTsuDir.value, front = TSU.front, A = TSU.A, n = T.n, c = T.cell, H = T.h, k0 = TSU.k;
  const maxErode = Math.min(0.5 + A * 0.27, 11);
  const flat = DESTROY.grid, DN = DESTROY.N;
  let touchedVeg = false;
  for (let j = 1; j < n - 1; j++) {
    const z = T.min + j * c;
    for (let i = 1; i < n - 1; i++) {
      const x = T.min + i * c, s = x * d.x + z * d.y - front;
      if (s > 12 || s < -220) continue;
      const k = j * n + i, h = H[k];
      if (h < -1.5) continue;
      const e = tsunamiJS(x, z, -h);
      const wd = e - h;
      if (wd < 0.25) continue;
      // fast, deep water scours sand easily, soil less, rock hardly at all
      const sand = T.mask[k * 4] / 255, rock = T.mask[k * 4 + 2] / 255;
      const near = s > -60 ? 1 : 0.45;                      // the front does the most damage
      const rate = 0.028 * Math.min(wd, 9) * (0.35 + 0.65 * sand) * (1 - rock * 0.85) * near * k0;
      const lost = T.h0[k] - h;
      if (lost < maxErode) {
        // scour, and smooth toward the neighbours so the land is planed flat rather than pitted
        const avg = (H[k - 1] + H[k + 1] + H[k - n] + H[k + n]) * 0.25;
        H[k] = h - Math.min(rate * dt, maxErode - lost) + (avg - h) * Math.min(1, dt * 0.8) * 0.5;
        markDirty(i, j);
        T.mask[k * 4] = Math.min(255, T.mask[k * 4] + 120 * dt * Math.min(1, wd));          // left as bare sand and mud
        T.mask[k * 4 + 1] = Math.max(0, T.mask[k * 4 + 1] - 160 * dt * Math.min(1, wd));
      }
      // plants go over where the water is deep and fast
      if (wd > 1.0) {
        const di = Math.floor((x - T.min) / T.size * DN), dj = Math.floor((z - T.min) / T.size * DN);
        const gi = dj * DN + di, v = flat[gi], add = Math.round(255 * Math.min(1, (wd - 1.0) / 2.5) * dt * 1.6 * k0);
        if (add > 0 && v < 255) { flat[gi] = Math.min(255, v + add); touchedVeg = true; }
      }
    }
  }
  if (touchedVeg) { DESTROY.tex.needsUpdate = true; U.uDestroyRect.value.w = 1; }
  DESTROY.eroded = DESTROY.eroded || !!DESTROY.dirty;
}
// push height changes out to the mesh, the normals, the water's height texture and the sand chunks
function flushTerrain(all = false) {
  const d = all ? { i0: 0, j0: 0, i1: T.res, j1: T.res } : DESTROY.dirty; if (!d) return;
  DESTROY.dirty = null;
  const n = T.n, H = T.h, c = T.cell, i0 = Math.max(0, d.i0 - 1), i1 = Math.min(n - 1, d.i1 + 1), j0 = Math.max(0, d.j0 - 1), j1 = Math.min(n - 1, d.j1 + 1);
  const pos = T.mesh.geometry.attributes.position.array, hd = U.uHeightTex.value.image.data;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * n + i;
    const hl = H[j * n + Math.max(0, i - 1)], hr = H[j * n + Math.min(n - 1, i + 1)];
    const hdn = H[Math.max(0, j - 1) * n + i], hu = H[Math.min(n - 1, j + 1) * n + i];
    let nx = hl - hr, ny = 2 * c, nz = hdn - hu; const l = Math.hypot(nx, ny, nz);
    T.nrm[k * 3] = nx / l; T.nrm[k * 3 + 1] = ny / l; T.nrm[k * 3 + 2] = nz / l;
    pos[k * 3 + 1] = H[k];
    hd[k * 4] = THREE.DataUtils.toHalfFloat(H[k]);
  }
  const g = T.mesh.geometry;
  g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.aMask.needsUpdate = true;
  U.uHeightTex.value.needsUpdate = true;
  // the fine sand layer re-reads the ground underneath it; anything dug there is washed away
  const x0 = T.min + i0 * c, x1 = T.min + i1 * c, z0 = T.min + j0 * c, z1 = T.min + j1 * c;
  for (const ch of SAND.list) {
    if (ch.x0 + SAND.TS < x0 || ch.x0 > x1 || ch.z0 + SAND.TS < z0 || ch.z0 > z1) continue;
    for (let jj = 0; jj < SN; jj++) for (let ii = 0; ii < SN; ii++) {
      const kk = jj * SN + ii, wx = ch.x0 + (ii + 0.5) * SAND.CS, wz = ch.z0 + (jj + 0.5) * SAND.CS;
      ch.base[kk] = baseGround(wx, wz); if (!all) { ch.G[kk] *= 0.2; if (ch.Dt) ch.Dt[kk] *= 0.2; }
      if (ch.sim) { const pi = (jj + 1) * SP + ii + 1; ch.sim.b[pi] = ch.base[kk] + ch.R[kk] + ch.G[kk]; }
    }
    let mb = 1e9; for (let q = 0; q < ch.base.length; q++) if (ch.base[q] < mb) mb = ch.base[q];
    ch.meshDirty = true; ch.minBase = mb; ch.low = mb < 2.2;
  }
}
// ---- the cabin coming apart ----
function checkCabinDestruction() {
  if (!CABIN.group || CABIN.destroyed) return;
  const c = cabinToWorld(0, 0, -1);
  const e = tsunamiJS(c.x, c.z, -groundHeight(c.x, c.z));
  const over = e - CABIN.floor, flow = tsunamiFlow(c.x, c.z);
  if (over > 0.6 && flow > 4) destroyCabin();
}
function destroyCabin() {
  if (CABIN.destroyed) return;
  CABIN.destroyed = true;
  CABIN.group.visible = false;
  DESTROY.saved = { walls: WALLS.slice(), plats: PLATFORMS.filter(p => p.cabin), inter: INTERACT.filter(i => i.cabin) };
  WALLS.length = 0;
  for (const p of DESTROY.saved.plats) PLATFORMS.splice(PLATFORMS.indexOf(p), 1);
  for (const it of DESTROY.saved.inter) INTERACT.splice(INTERACT.indexOf(it), 1);
  CABIN.savedInv = CABIN.uniforms.uCabinInv.value.clone();
  CABIN.uniforms.uCabinInv.value.makeTranslation(1e5, 0, 0);
  if (P.mode === 'seat' && P.seat && P.seat.cabin) { P.mode = 'swim'; P.seat = null; }
  // wreckage: logs, boards, roof panels and furniture, thrown into the flood
  const mats = CABIN.mats, d = U.uTsuDir.value;
  const pieces = [];
  for (let i = 0; i < 26; i++) pieces.push(['log', rand(1.6, 4.2)]);
  for (let i = 0; i < 22; i++) pieces.push(['board', rand(1.0, 2.6)]);
  for (let i = 0; i < 8; i++) pieces.push(['roof', rand(1.6, 3.0)]);
  pieces.push(['sofa', 2.1], ['table', 1.2], ['bed', 2.0], ['counter', 1.8], ['door', 1.06]);
  for (const [kind, len] of pieces) {
    let geo, mat = mats.wood;
    if (kind === 'log') { geo = prep(new THREE.CylinderGeometry(0.15, 0.15, len, 10).rotateZ(Math.PI / 2), [0.3, 0.19, 0.11], {}, 0.2); }
    else if (kind === 'board') geo = prep(new THREE.BoxGeometry(len, 0.06, 0.18), [0.36, 0.25, 0.15], {}, 0.2);
    else if (kind === 'roof') { geo = prep(new THREE.BoxGeometry(len, 0.06, 1.3), [0.3, 0.24, 0.19], {}, 0.1); mat = mats.roof; }
    else if (kind === 'sofa') { geo = prep(new THREE.BoxGeometry(0.9, 0.6, 2.1), [0.33, 0.42, 0.5]); mat = mats.fabric; }
    else if (kind === 'bed') { geo = prep(new THREE.BoxGeometry(1.7, 0.5, 2.2), [0.85, 0.84, 0.8]); mat = mats.fabric; }
    else if (kind === 'counter') { geo = prep(new THREE.BoxGeometry(1.8, 0.86, 0.6), [0.4, 0.5, 0.44]); mat = mats.paint; }
    else geo = prep(new THREE.BoxGeometry(len, 0.4 + rand(0, 0.4), 0.7), [0.45, 0.31, 0.19]);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    const w = cabinToWorld(rand(-CW, CW), rand(0.2, 3), rand(-CPORCH, CD));
    const r = kind === 'log' || kind === 'board' || kind === 'roof' ? 0.12 : 0.35;
    DESTROY.debris.push({ m, x: w.x, y: w.y, z: w.z, vx: d.x * rand(3, 9) + rand(-2, 2), vy: rand(0, 3), vz: d.y * rand(3, 9) + rand(-2, 2),
      rx: rand(0, TAU), ry: rand(0, TAU), rz: rand(0, TAU), wx: rand(-2, 2), wy: rand(-2, 2), wz: rand(-2, 2), r, float: kind !== 'counter' });
  }
  if (AUDIO.crash) AUDIO.crash();
  for (let i = 0; i < 40 && FX.spawn; i++) { const w = cabinToWorld(rand(-CW, CW), rand(0, 3), rand(-CD, CD)); FX.spawn(w.x, w.y, w.z, rand(-3, 3), rand(1, 5), rand(-3, 3), rand(0.6, 1.4), rand(0.04, 0.09), 3, 9.8); }
  toast('The cabin is gone', 'Repair the island from the settings to rebuild it');
}
function updateDebris(dt) {
  if (!DESTROY.debris.length) return;
  const t = U.uTime.value;
  for (const p of DESTROY.debris) {
    const w = waterAt(p.x, p.z), g = groundHeight(p.x, p.z);
    const wet = p.float && w.level > g + 0.15 && p.y < w.level + 0.05;
    if (wet) {
      p.vy += (w.level - 0.05 - p.y) * 14 * dt; p.vy *= Math.exp(-3 * dt);
      p.vx = damp(p.vx, (w.fx || 0) * 0.9, 1.2, dt); p.vz = damp(p.vz, (w.fz || 0) * 0.9, 1.2, dt);
      p.wx *= Math.exp(-1.5 * dt); p.wz *= Math.exp(-1.5 * dt);
      p.rx = damp(p.rx, Math.round(p.rx / Math.PI) * Math.PI, 0.8, dt); p.rz = damp(p.rz, Math.round(p.rz / Math.PI) * Math.PI, 0.8, dt);
    } else p.vy -= 9.8 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < g + p.r) { p.y = g + p.r; p.vy = Math.max(0, -p.vy * 0.2); p.vx *= Math.exp(-4 * dt); p.vz *= Math.exp(-4 * dt); p.wx *= 0.9; p.wy *= 0.9; p.wz *= 0.9; p.rx = damp(p.rx, Math.round(p.rx / Math.PI) * Math.PI, 3, dt); p.rz = damp(p.rz, Math.round(p.rz / Math.PI) * Math.PI, 3, dt); }
    p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
    p.m.position.set(p.x, p.y, p.z); p.m.rotation.set(p.rx, p.ry, p.rz);
  }
}
// ---- putting it all back ----
function repairIsland() {
  if (T.h0) { T.h.set(T.h0); T.mask.set(T.mask0); flushTerrain(true); }
  if (DESTROY.grid) { DESTROY.grid.fill(0); DESTROY.tex.needsUpdate = true; U.uDestroyRect.value.w = 0; }
  unhideTrees();
  DESTROY.eroded = false;
  for (const p of DESTROY.debris) { scene.remove(p.m); p.m.geometry.dispose(); }
  DESTROY.debris.length = 0;
  if (CABIN.destroyed && DESTROY.saved) {
    CABIN.destroyed = false; CABIN.group.visible = true;
    WALLS.push(...DESTROY.saved.walls); PLATFORMS.push(...DESTROY.saved.plats); INTERACT.push(...DESTROY.saved.inter);
    CABIN.uniforms.uCabinInv.value.copy(CABIN.savedInv);
  }
  calmSea();
  toast('The island is repaired', '');
}
function updateDestruction(dt) {
  if (TSU.on && TSU.k > 0.05) {
    DESTROY.acc += dt;
    if (DESTROY.acc >= 0.25) { tsunamiErode(DESTROY.acc); DESTROY.acc = 0; checkCabinDestruction(); }
  }
  DESTROY.meshAcc += dt;
  if (DESTROY.dirty && DESTROY.meshAcc > 0.5) { DESTROY.meshAcc = 0; flushTerrain(); }
  updateDebris(dt);
}
