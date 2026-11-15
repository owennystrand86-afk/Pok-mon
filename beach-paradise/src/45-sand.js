
// ───────────────────── 24. Living sand ─────────────────────
// Wherever something happens to the ground, the island is refined in 32 m chunks at
// 0.5 m resolution: the river channel (shaped once at load), holes and channels you dig,
// and the water that flows through them (a small shallow-water simulation fed by the
// river, the sea and groundwater, which also erodes the sand). Footprints and writing
// go into a finer 9 cm carve texture. Waves wash all of it away near the sea.
const SAND = {
  CS: 0.5, N: 64, TS: 32, O: -912, GRID: 57, CARVE: 448, SLOTS: 28,
  chunks: new Map(), list: [], count: 0, active: [], tick: 0, simAcc: 0,
  lookData: null, lookTex: null, carveData: null, carveTex: null, slots: [], carveDirty: new Set(), lookDirty: false,
  uniforms: null, tileMat: null, waterMat: null,
};
const SN = SAND.N, SP = SAND.N + 2;
const chunkKey = (cx, cz) => cx * 1024 + cz;
SAND.uniforms = { uTileLook: { value: null }, uCarve: { value: null }, uSandGrid: { value: new THREE.Vector4(SAND.O, SAND.TS, SAND.GRID, SAND.CARVE) } };
function initSand() {
  const G = SAND.GRID;
  SAND.lookData = new Uint8Array(G * G * 4);
  SAND.lookTex = new THREE.DataTexture(SAND.lookData, G, G, THREE.RGBAFormat, THREE.UnsignedByteType);
  SAND.lookTex.magFilter = SAND.lookTex.minFilter = THREE.NearestFilter; SAND.lookTex.generateMipmaps = false; SAND.lookTex.needsUpdate = true;
  SAND.carveData = new Uint8Array(SAND.CARVE * SAND.CARVE * SAND.SLOTS);
  const ct = new THREE.DataArrayTexture(SAND.carveData, SAND.CARVE, SAND.CARVE, SAND.SLOTS);
  ct.format = THREE.RedFormat; ct.type = THREE.UnsignedByteType; ct.magFilter = ct.minFilter = THREE.LinearFilter; ct.generateMipmaps = false;
  ct.wrapS = ct.wrapT = THREE.ClampToEdgeWrapping; ct.needsUpdate = true;
  SAND.carveTex = ct;
  SAND.uniforms.uTileLook.value = SAND.lookTex; SAND.uniforms.uCarve.value = ct;
  SAND.slots = new Array(SAND.SLOTS).fill(null);
}
function getChunk(cx, cz, create = false) {
  const k = chunkKey(cx, cz);
  let c = SAND.chunks.get(k);
  if (!c && create && cx >= 0 && cz >= 0 && cx < SAND.GRID && cz < SAND.GRID) c = makeChunk(cx, cz);
  return c || null;
}
function chunkAt(x, z, create = false) { return getChunk(Math.floor((x - SAND.O) / SAND.TS), Math.floor((z - SAND.O) / SAND.TS), create); }
function makeChunk(cx, cz) {
  const N = SN, x0 = SAND.O + cx * SAND.TS, z0 = SAND.O + cz * SAND.TS;
  const c = {
    cx, cz, x0, z0, base: new Float32Array(N * N), R: new Float32Array(N * N), G: new Float32Array(N * N),
    src: new Uint8Array(N * N), lvl: new Float32Array(N * N), touched: new Uint8Array(N * N), nTouched: 0,
    sim: null, slot: -1, mesh: null, water: null, meshDirty: true, visible: false, hasShape: false, low: false, sea: 0, minBase: 1e9, waterCells: 0,
  };
  let shaped = false;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) * SAND.CS, z = z0 + (j + 0.5) * SAND.CS, k = j * N + i;
    const b = baseGround(x, z); c.base[k] = b; c.minBase = Math.min(c.minBase, b);
    const q = STREAM.all.length ? riverQuery(x, z) : null;
    const nearSpring = Math.hypot(x - SPRING.x, z - SPRING.z) < SPRING.r + 3;
    if ((q && q.d < q.W + 14) || nearSpring) {
      const f = springShape(riverShape(gridSample(T.hPre, x, z), q), x, z);
      c.R[k] = f - b; if (Math.abs(c.R[k]) > 0.01) shaped = true;
      if (q && q.d < q.W + 0.3 && q.S > 0.04) { c.src[k] = 1; c.lvl[k] = q.S; }
    }
    if (nearSpring && Math.hypot(x - SPRING.x, z - SPRING.z) < SPRING.r) { c.src[k] = 1; c.lvl[k] = SPRING.level; }
    if (b < 0.3 && c.src[k] === 0) c.src[k] = 2;
    // the waterfall face and the pool below it take whatever water reaches them: it joins the falls
    if (c.src[k] === 0) {
      const s = cliffS(x, z), t = (x - WF.x) * -WF.nz + (z - WF.z) * WF.nx;
      if ((s < 1.75 && s > -7 && Math.abs(t) < WF.halfLen) || Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 3) c.src[k] = 3;
    }
  }
  c.hasShape = shaped; c.low = c.minBase < 2.2;
  SAND.chunks.set(chunkKey(cx, cz), c); SAND.list.push(c); SAND.count++;
  return c;
}
// height change at global cell (gi, gj)
function cellDelta(gi, gj) {
  if (gi < 0 || gj < 0) return 0;
  const c = SAND.chunks.get(chunkKey(gi >> 6, gj >> 6)); if (!c) return 0;
  const k = (gj & 63) * 64 + (gi & 63); return c.R[k] + c.G[k];
}
function sandDelta(x, z) {
  const gx = (x - SAND.O) / SAND.CS - 0.5, gz = (z - SAND.O) / SAND.CS - 0.5;
  const i = Math.floor(gx), j = Math.floor(gz), tx = gx - i, tz = gz - j;
  const a = cellDelta(i, j), b = cellDelta(i + 1, j), c = cellDelta(i, j + 1), d = cellDelta(i + 1, j + 1);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
// water standing in something you dug (not the sea, not the river itself)
function sandWaterAt(x, z) {
  const c = chunkAt(x, z); if (!c || !c.sim) return null;
  const i = clamp(Math.floor((x - c.x0) / SAND.CS), 0, SN - 1), j = clamp(Math.floor((z - c.z0) / SAND.CS), 0, SN - 1);
  const k = j * SN + i, pi = (j + 1) * SP + i + 1, w = c.sim.w[pi];
  if (w < 0.03 || c.src[k] === 1) return null;
  return { level: c.sim.b[pi] + w, depth: w, vx: c.sim.vx[k], vz: c.sim.vz[k] };
}

// ---- simulation ----
function activateSim(c) {
  if (c.sim) return;
  const N = SN, P = SP;
  c.sim = { b: new Float32Array(P * P), w: new Float32Array(P * P), fE: new Float32Array(N * N), fW: new Float32Array(N * N), fS: new Float32Array(N * N), fN: new Float32Array(N * N),
    inW: new Float32Array(N), inE: new Float32Array(N), inN: new Float32Array(N), inS: new Float32Array(N), vx: new Float32Array(N * N), vz: new Float32Array(N * N), tick: -1 };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i, pi = (j + 1) * P + i + 1; c.sim.b[pi] = c.base[k] + c.R[k] + c.G[k]; if (c.src[k] === 1 && c.lvl[k] > c.sim.b[pi]) c.sim.w[pi] = c.lvl[k] - c.sim.b[pi]; }
}
function touchCell(c, k) {
  if (c.touched[k]) return;
  c.touched[k] = 1; c.nTouched++;
  const i = k % SN, j = (k / SN) | 0;
  if (i < 3) forceChunk(c.cx - 1, c.cz); if (i > SN - 4) forceChunk(c.cx + 1, c.cz);
  if (j < 3) forceChunk(c.cx, c.cz - 1); if (j > SN - 4) forceChunk(c.cx, c.cz + 1);
  if ((i < 3 || i > SN - 4) && (j < 3 || j > SN - 4)) forceChunk(c.cx + (i < 3 ? -1 : 1), c.cz + (j < 3 ? -1 : 1));
}
function forceChunk(cx, cz) { const n = getChunk(cx, cz, true); if (n && !n.forced) { n.forced = true; n.meshDirty = true; } }
const needsMesh = c => !!c && (c.hasShape || c.nTouched > 0 || c.forced);
const meshShown = c => !!c && !!c.mesh && c.vis;
function neighbourCell(c, dx, dz, i, j) { // b and w of the cell beside chunk c's edge
  const n = getChunk(c.cx + dx, c.cz + dz);
  if (!n) return null;
  const ii = (i + SN) % SN, jj = (j + SN) % SN, k = jj * SN + ii;
  if (n.sim) { const pi = (jj + 1) * SP + ii + 1; return [n.sim.b[pi], n.sim.w[pi]]; }
  const b = n.base[k] + n.R[k] + n.G[k];
  return [b, n.src[k] === 1 && n.lvl[k] > b ? n.lvl[k] - b : 0];
}
function fillHalo(c) {
  const B = c.sim.b, Wt = c.sim.w, N = SN, P = SP;
  for (let j = 0; j < N; j++) {
    let v = neighbourCell(c, -1, 0, N - 1, j); B[(j + 1) * P] = v ? v[0] : 1e4; Wt[(j + 1) * P] = v ? v[1] : 0;
    v = neighbourCell(c, 1, 0, 0, j); B[(j + 1) * P + N + 1] = v ? v[0] : 1e4; Wt[(j + 1) * P + N + 1] = v ? v[1] : 0;
  }
  for (let i = 0; i < N; i++) {
    let v = neighbourCell(c, 0, -1, i, N - 1); B[i + 1] = v ? v[0] : 1e4; Wt[i + 1] = v ? v[1] : 0;
    v = neighbourCell(c, 0, 1, i, 0); B[(N + 1) * P + i + 1] = v ? v[0] : 1e4; Wt[(N + 1) * P + i + 1] = v ? v[1] : 0;
  }
}
function fluxPass(c, dt) {
  const s = c.sim, B = s.b, Wt = s.w, N = SN, P = SP, L = SAND.CS, k = dt * 9.8 * L;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const pi = (j + 1) * P + i + 1, ci = j * N + i, wc = Wt[pi];
    if (wc <= 1e-5) { s.fE[ci] = s.fW[ci] = s.fS[ci] = s.fN[ci] = 0; continue; }
    const h = B[pi] + wc;
    let e = Math.max(0, s.fE[ci] * 0.99 + k * (h - B[pi + 1] - Wt[pi + 1]));
    let w = Math.max(0, s.fW[ci] * 0.99 + k * (h - B[pi - 1] - Wt[pi - 1]));
    let so = Math.max(0, s.fS[ci] * 0.99 + k * (h - B[pi + P] - Wt[pi + P]));
    let no = Math.max(0, s.fN[ci] * 0.99 + k * (h - B[pi - P] - Wt[pi - P]));
    const sum = e + w + so + no;
    if (sum > 0) { const K = Math.min(1, (wc * L * L) / (sum * dt)); e *= K; w *= K; so *= K; no *= K; }
    s.fE[ci] = e; s.fW[ci] = w; s.fS[ci] = so; s.fN[ci] = no;
  }
}
function fluxHalo(c) {
  const s = c.sim, N = SN, tick = SAND.tick;
  const W = getChunk(c.cx - 1, c.cz), E = getChunk(c.cx + 1, c.cz), Nn = getChunk(c.cx, c.cz - 1), S = getChunk(c.cx, c.cz + 1);
  for (let j = 0; j < N; j++) { s.inW[j] = W && W.sim && W.sim.tick === tick ? W.sim.fE[j * N + N - 1] : 0; s.inE[j] = E && E.sim && E.sim.tick === tick ? E.sim.fW[j * N] : 0; }
  for (let i = 0; i < N; i++) { s.inN[i] = Nn && Nn.sim && Nn.sim.tick === tick ? Nn.sim.fS[(N - 1) * N + i] : 0; s.inS[i] = S && S.sim && S.sim.tick === tick ? S.sim.fN[i] : 0; }
}
function waterPass(c, dt, rain) {
  const s = c.sim, B = s.b, Wt = s.w, N = SN, P = SP, L2 = SAND.CS * SAND.CS, sea = c.sea;
  let wet = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const pi = (j + 1) * P + i + 1, ci = j * N + i;
    const inW = i > 0 ? s.fE[ci - 1] : s.inW[j], inE = i < N - 1 ? s.fW[ci + 1] : s.inE[j];
    const inN = j > 0 ? s.fS[ci - N] : s.inN[i], inS = j < N - 1 ? s.fN[ci + N] : s.inS[i];
    const out = s.fE[ci] + s.fW[ci] + s.fS[ci] + s.fN[ci];
    const w0 = Wt[pi];
    let w = w0 + (dt * (inW + inE + inN + inS - out)) / L2;
    const davg = Math.max(0.03, (w0 + w) * 0.5);
    s.vx[ci] = (inW - s.fW[ci] + s.fE[ci] - inE) / (2 * SAND.CS * davg);
    s.vz[ci] = (inN - s.fN[ci] + s.fS[ci] - inS) / (2 * SAND.CS * davg);
    const b = B[pi], src = c.src[ci];
    if (src === 1 && c.lvl[ci] > b) w = c.lvl[ci] - b;                // the river keeps its level
    else if (src === 2 && sea > b) w = Math.max(w, sea - b);         // the sea pours in on each wave
    else if (src === 3) w = 0;                                         // over the falls / into the pool
    if (b < 0.06 && c.low) w += Math.max(0, 0.06 - b - w) * 0.25 * dt; // holes near the sea fill with groundwater
    // water soaks into dry sand quickly; a pool in a hole you dug seals its own bottom and lasts
    const soak = c.G[ci] < -0.06 && w > 0.02 ? 0.00035 : b > 0.6 ? 0.003 : 0.001;
    w = Math.max(0, w + rain * 0.002 * dt - dt * soak);
    Wt[pi] = w; if (w > 0.01) wet++;
  }
  c.waterCells = wet;
}
function erodePass(c, dt) {
  const s = c.sim, B = s.b, Wt = s.w, N = SN, P = SP, L = SAND.CS;
  let changed = false;
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const ci = j * N + i; if (!c.touched[ci]) continue;
    const pi = (j + 1) * P + i + 1;
    // running water cuts into the sand
    const w = Wt[pi];
    if (!c.sandy) { c.sandy = new Uint8Array(N * N); for (let k = 0; k < N * N; k++) { const m = maskAt(c.x0 + ((k % N) + 0.5) * SAND.CS, c.z0 + (((k / N) | 0) + 0.5) * SAND.CS); c.sandy[k] = m[2] < 0.4 && slopeAt(c.x0 + ((k % N) + 0.5) * SAND.CS, c.z0 + (((k / N) | 0) + 0.5) * SAND.CS) < 0.45 ? 1 : 0; } }
    if (w > 0.01 && c.src[ci] !== 1 && c.src[ci] !== 3 && c.sandy[ci]) {
      const sp = Math.hypot(s.vx[ci], s.vz[ci]);
      if (sp > 0.28 && c.G[ci] > -1.8) { const e = Math.min(0.02, 0.016 * (sp - 0.28) * dt); c.G[ci] -= e; B[pi] -= e; changed = true; touchCell(c, ci + 1); touchCell(c, ci - 1); touchCell(c, ci + N); touchCell(c, ci - N); }
    }
    // loose sand slumps until it reaches its angle of repose
    for (let q = 0; q < 4; q++) {
      const di = q === 0 ? 1 : q === 1 ? N : q === 2 ? -1 : -N, dp = q === 0 ? 1 : q === 1 ? P : q === 2 ? -1 : -P;
      const cj = ci + di, pj = pi + dp;
      if (q >= 2 && c.touched[cj]) continue; // that pair is handled from the other side
      const dirtK = c.Dt ? Math.min(1, (c.Dt[ci] + c.Dt[cj]) * 4) : 0;    // packed dirt stands much steeper than loose sand
      const d = B[pi] - B[pj], lim = (w > 0.01 || Wt[pj] > 0.01 ? 0.5 + dirtK * 0.75 : 0.72 + dirtK * 0.9) * L;
      // running water also evens out the sand it carries, so channels come out as smooth grooves, not steps
      const soft = w > 0.01 && Wt[pj] > 0.01 && c.src[ci] !== 1 && c.src[cj] !== 1 && c.sandy[ci] && c.sandy[cj] ? Math.abs(d) * Math.min(0.08, dt * 1.2) : 0;
      if (Math.abs(d) > lim || soft > 0.0005) {
        // only loose material moves: sand, or dirt and sand piled on top of rock or soil (never the
        // natural ground itself, so a steep stream bed doesn't slide away)
        const donor = d > 0 ? ci : cj;
        const loose = c.sandy[donor] ? 1e9 : Math.max(0, c.G[donor]);
        const m = Math.min(loose, Math.max(0, Math.abs(d) - lim) * 0.22 + soft);
        if (m <= 0) continue;
        if (d > 0) { c.G[ci] -= m; c.G[cj] += m; B[pi] -= m; B[pj] += m; } else { c.G[ci] += m; c.G[cj] -= m; B[pi] += m; B[pj] -= m; }
        if (c.Dt) { const from = d > 0 ? ci : cj, to = d > 0 ? cj : ci, mv = Math.min(c.Dt[from], m); c.Dt[from] -= mv; c.Dt[to] += mv; }
        touchCell(c, cj); changed = true;
      }
    }
    // waves running up the beach slowly fill holes and flatten piles in the swash zone
    if (c.sea > c.base[ci] && c.base[ci] > -0.4 && c.base[ci] < 1.3) { const f = Math.min(1, 0.035 * dt); B[pi] -= c.G[ci] * f; c.G[ci] *= 1 - f; if (c.Dt) c.Dt[ci] *= 1 - f; changed = true; }
  }
  if (changed) c.meshDirty = true;
}
function updateSand(dt, t) {
  if (!SAND.carveTex) return;
  const px = P.pos.x, pz = P.pos.z;
  // which chunks are alive this frame
  SAND.simAcc += dt;
  const STEP = 1 / 20;
  if (SAND.simAcc >= STEP) {
    SAND.simAcc = Math.min(SAND.simAcc - STEP, STEP);
    const act = SAND.active; act.length = 0;
    for (const c of SAND.list) if (c.nTouched > 0 && Math.abs(c.x0 + 16 - px) < 110 && Math.abs(c.z0 + 16 - pz) < 110) { activateSim(c); act.push(c); }
    if (act.length) {
      const rain = U.uRain.value;
      for (let sub = 0; sub < 2; sub++) {
        SAND.tick++;
        for (const c of act) {
          c.sim.tick = SAND.tick;
          c.sea = c.low ? Math.max(0, surfJS(c.x0 + 16, c.z0 + 16, 0, t)) : -99;
          fillHalo(c);
        }
        for (const c of act) fluxPass(c, STEP / 2);
        for (const c of act) fluxHalo(c);
        for (const c of act) waterPass(c, STEP / 2, rain);
      }
      for (const c of act) { erodePass(c, STEP); c.waterDirty = true; }
    }
  }
  // meshes near the camera replace the coarse island; far away the coarse one is enough
  SAND.meshT = (SAND.meshT || 0) - dt;
  const showR = Q.near * 1.6;
  const todo = [];
  for (const c of SAND.list) {
    if (!needsMesh(c)) continue;
    const d = Math.hypot(c.x0 + 16 - camera.position.x, c.z0 + 16 - camera.position.z) - 22;
    const vis = d < showR;
    if (vis !== c.vis) {
      c.vis = vis; c.meshDirty = true; if (c.mesh) { c.mesh.visible = vis; setLook(c); }
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = getChunk(c.cx + dx, c.cz + dz); if (n && n.mesh) n.meshDirty = true; }
    }
    if (vis && (!c.mesh || c.meshDirty)) todo.push([d - (c.digDirty ? 1000 : 0), c]);
    if (c.mesh) c.mesh.visible = vis;
    if (c.waterDirty && c.sim) { updateChunkWater(c, vis); c.waterDirty = false; }
  }
  if (todo.length) {
    todo.sort((a, b) => a[0] - b[0]);
    // rebuild what you just dug right away; erosion and far chunks a few per frame
    let budget = 3;
    for (const [d, c] of todo) {
      if (budget <= 0) break;
      if (!c.digDirty && SAND.meshT > 0 && c.mesh) continue;
      buildChunkMesh(c); c.digDirty = false; budget--;
    }
    if (SAND.meshT <= 0) SAND.meshT = 0.2;
  }
  for (const c of SAND.list) if (c.mesh && c.mesh.visible !== c.vis) c.mesh.visible = !!c.vis;
  // waves erase footprints and writing; everything else fades over many minutes
  SAND.washT = (SAND.washT || 0) - dt;
  if (SAND.washT <= 0) { SAND.washT = 0.3; washCarves(t); }
  SAND.wetT = (SAND.wetT || 0) - dt;
  if (SAND.wetT <= 0) { SAND.wetT = 0.5; updateWetness(0.5); }
  SAND.fadeT = (SAND.fadeT || 0) - dt;
  if (SAND.fadeT <= 0) { SAND.fadeT = 0.36; fadeCarves(); }
  if (SAND.carveDirty.size) { for (const s of SAND.carveDirty) SAND.carveTex.addLayerUpdate(s); SAND.carveTex.needsUpdate = true; SAND.carveDirty.clear(); }
  if (SAND.lookDirty) { SAND.lookTex.needsUpdate = true; SAND.lookDirty = false; }
}
function setLook(c) {
  const o = (c.cz * SAND.GRID + c.cx) * 4;
  SAND.lookData[o] = c.slot + 1; SAND.lookData[o + 1] = meshShown(c) ? 255 : 0;
  SAND.lookDirty = true;
}

// ---- meshes ----
// height change at a corner shared by up to four cells (and by neighbouring chunks, identically)
function cornerDelta(c, i, j) {
  if ((i === 0 && !meshShown(getChunk(c.cx - 1, c.cz))) || (i === SN && !meshShown(getChunk(c.cx + 1, c.cz))) ||
      (j === 0 && !meshShown(getChunk(c.cx, c.cz - 1))) || (j === SN && !meshShown(getChunk(c.cx, c.cz + 1)))) return 0;
  if ((i === 0 || i === SN) && (j === 0 || j === SN) && !meshShown(getChunk(c.cx + (i ? 1 : -1), c.cz + (j ? 1 : -1)))) return 0;
  const gi = c.cx * SN + i, gj = c.cz * SN + j;
  return (cellDelta(gi - 1, gj - 1) + cellDelta(gi, gj - 1) + cellDelta(gi - 1, gj) + cellDelta(gi, gj)) * 0.25;
}
// The height change at a global grid corner, worked out the same way whichever chunk asks (so
// neighbouring chunks agree exactly along their shared edge). Next to a chunk that isn't drawn in
// fine detail (the coarse island shows there) it eases to zero over a few cells instead of
// creasing at the edge.
const _shownCache = new Map();
function chunkShownG(cx, cz) {
  const k = chunkKey(cx, cz); let v = _shownCache.get(k);
  if (v === undefined) { v = meshShown(getChunk(cx, cz)); _shownCache.set(k, v); }
  return v;
}
function rampG(gi, gj) {
  const cx = Math.floor(gi / SN), cz = Math.floor(gj / SN), li = gi - cx * SN, lj = gj - cz * SN, R = 3;
  let m = R;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    // distance (in corners) from this corner to chunk (cx+dx, cz+dz)
    const ex = dx < 0 ? li : dx > 0 ? SN - li : 0, ez = dz < 0 ? lj : dz > 0 ? SN - lj : 0, e = Math.max(ex, ez);
    if (e >= m) continue;
    if (!chunkShownG(cx + dx, cz + dz)) m = e;
    // a corner on a chunk edge also belongs to the chunk behind it
    if (dx === 0 && li === 0 && !chunkShownG(cx - 1, cz + dz)) m = 0;
    if (dz === 0 && lj === 0 && !chunkShownG(cx + dx, cz - 1)) m = 0;
    if (li === 0 && lj === 0 && !chunkShownG(cx - 1, cz - 1)) m = 0;
  }
  const t = m / R; return t * t * (3 - 2 * t);
}
function deltaG(gi, gj) {
  const r = rampG(gi, gj); if (r <= 0) return 0;
  return (cellDelta(gi - 1, gj - 1) + cellDelta(gi, gj - 1) + cellDelta(gi - 1, gj) + cellDelta(gi, gj)) * 0.25 * r;
}
// how deep the sand was dug at a corner, averaged like the heights so it fades smoothly
function cellG(gi, gj) {
  if (gi < 0 || gj < 0) return 0;
  const c = SAND.chunks.get(chunkKey(gi >> 6, gj >> 6)); if (!c) return 0;
  return c.G[(gj & 63) * 64 + (gi & 63)];
}
function cellDirt(gi, gj) {
  if (gi < 0 || gj < 0) return 0;
  const c = SAND.chunks.get(chunkKey(gi >> 6, gj >> 6)); if (!c || !c.Dt) return 0;
  return c.Dt[(gj & 63) * 64 + (gi & 63)];
}
function cornerDirt(c, i, j) {
  const gi = c.cx * SN + i, gj = c.cz * SN + j;
  return (cellDirt(gi - 1, gj - 1) + cellDirt(gi, gj - 1) + cellDirt(gi - 1, gj) + cellDirt(gi, gj)) * 0.25;
}
function cornerDig(c, i, j) {
  const gi = c.cx * SN + i, gj = c.cz * SN + j;
  return (cellG(gi - 1, gj - 1) + cellG(gi, gj - 1) + cellG(gi - 1, gj) + cellG(gi, gj)) * 0.25;
}
function buildChunkMesh(c) {
  const N = SN + 1, CS = SAND.CS;
  const E = 4 * N; // skirt vertices, one per edge vertex
  if (!c.mesh) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N * N + E) * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((N * N + E) * 3), 3));
    // the sand, grass, rock and path weights, blended exactly as the island under it blends them
    // (not snapped to the nearest island vertex, which made 4-6 m blocks)
    const mask = new Uint8Array((N * N + E) * 4), mq = [0, 0, 0, 0];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { gridLerp(T.mask, 4, c.x0 + i * CS, c.z0 + j * CS, mq); for (let q = 0; q < 4; q++) mask[(j * N + i) * 4 + q] = Math.round(mq[q]); }
    c.edge = [];
    for (let i = 0; i < N; i++) c.edge.push(i, (N - 1) * N + i);
    for (let j = 0; j < N; j++) c.edge.push(j * N, j * N + N - 1);
    c.edge.forEach((k, e) => mask.set(mask.subarray(k * 4, k * 4 + 4), (N * N + e) * 4));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4, true));
    g.setAttribute('aDig', new THREE.BufferAttribute(new Float32Array(N * N + E), 1));
    g.setAttribute('aWetS', new THREE.BufferAttribute(new Float32Array(N * N + E), 1));
    g.setAttribute('aDirt', new THREE.BufferAttribute(new Float32Array(N * N + E), 1));
    const idx = new Uint16Array(SN * SN * 6 + 4 * SN * 6); let q = 0;
    for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) { const a = j * N + i, b = a + 1, cc = a + N, d = cc + 1; idx[q++] = a; idx[q++] = cc; idx[q++] = b; idx[q++] = b; idx[q++] = cc; idx[q++] = d; }
    const side = (list) => { for (let t = 0; t < list.length - 1; t++) { const a = list[t], b = list[t + 1], as = N * N + c.edge.indexOf(a), bs = N * N + c.edge.indexOf(b); idx[q++] = a; idx[q++] = as; idx[q++] = b; idx[q++] = b; idx[q++] = as; idx[q++] = bs; } };
    const top = [], bot = [], lft = [], rgt = [];
    for (let i = 0; i < N; i++) { top.push(i); bot.push((N - 1) * N + i); }
    for (let j = 0; j < N; j++) { lft.push(j * N); rgt.push(j * N + N - 1); }
    side(top); side(bot); side(lft); side(rgt);
    g.attributes.position.setUsage(THREE.DynamicDrawUsage);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    c.mesh = new THREE.Mesh(g, SAND.tileMat); c.mesh.receiveShadow = true; c.mesh.name = 'sandChunk'; c.mesh.visible = !!c.vis;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = getChunk(c.cx + dx, c.cz + dz); if (n && n.mesh && n !== c) n.meshDirty = true; }
    c.heights = new Float32Array(N * N);
    scene.add(c.mesh);
  }
  const g = c.mesh.geometry, pos = g.attributes.position.array, nor = g.attributes.normal.array, dig = g.attributes.aDig.array, H = c.heights, dirt = g.attributes.aDirt.array;
  // heights for this chunk's corners plus one ring beyond, so slopes at the edges match the neighbours'
  const M = N + 2;
  if (!c.dl) c.dl = new Float32Array(M * M);
  const D = c.dl, nb = [0, 0, 0], gi0 = c.cx * SN - 1, gj0 = c.cz * SN - 1;
  _shownCache.clear();
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) D[j * M + i] = deltaG(gi0 + i, gj0 + j);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = c.x0 + i * CS, z = c.z0 + j * CS;
    H[k] = baseGround(x, z) + D[(j + 1) * M + i + 1];
    pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z;
    dig[k] = cornerDig(c, i, j);
    dirt[k] = cornerDirt(c, i, j);
  }
  // lighting: the island's own smooth normal, tilted by whatever was dug or piled here, so an
  // untouched patch shades exactly like the ground around it (no facets, no square outline)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const o = (j + 1) * M + i + 1, dl = D[o - 1], dr = D[o + 1], dd = D[o - M], du = D[o + M];
    gridLerp(T.nrm, 3, c.x0 + i * CS, c.z0 + j * CS, nb);
    const ny = Math.max(0.05, nb[1]);
    const gx = -nb[0] / ny + (dr - dl) / (2 * CS), gz = -nb[2] / ny + (du - dd) / (2 * CS);
    const l = Math.hypot(gx, 1, gz);
    nor[k * 3] = -gx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -gz / l;
  }
  c.edge.forEach((k, e) => { const o = (N * N + e) * 3; pos[o] = pos[k * 3]; pos[o + 1] = pos[k * 3 + 1] - 0.6; pos[o + 2] = pos[k * 3 + 2]; nor[o] = nor[k * 3]; nor[o + 1] = nor[k * 3 + 1]; nor[o + 2] = nor[k * 3 + 2]; dig[N * N + e] = dig[k]; dirt[N * N + e] = dirt[k]; });
  g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.aDig.needsUpdate = g.attributes.aDirt.needsUpdate = true;
  writeWet(c);
  g.computeBoundingSphere();
  c.meshDirty = false;
  setLook(c);
}
function updateChunkWater(c, vis) {
  const s = c.sim, N = SN + 1, CS = SAND.CS;
  let any = false;
  for (let k = 0; k < SN * SN; k++) { const pi = (Math.floor(k / SN) + 1) * SP + (k % SN) + 1; if (s.w[pi] > 0.006 && c.src[k] !== 1 && (c.base[k] > 0.15 || c.G[k] < -0.05)) { any = true; break; } }
  if (!any) { if (c.water) c.water.visible = false; return; }
  if (!c.water) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
    g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(N * N), 1));
    g.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(N * N * 2), 2));
    const idx = new Uint16Array(SN * SN * 6); let q = 0;
    for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) { const a = j * N + i, b = a + 1, cc = a + N, d = cc + 1; idx[q++] = a; idx[q++] = cc; idx[q++] = b; idx[q++] = b; idx[q++] = cc; idx[q++] = d; }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    c.water = new THREE.Mesh(g, SAND.waterMat); c.water.renderOrder = 6; c.water.frustumCulled = false; c.water.userData.water = true; c.water.layers.set(1); c.water.userData.layerSet = true; scene.add(c.water);
  }
  const g = c.water.geometry, pos = g.attributes.position.array, aw = g.attributes.aW.array, av = g.attributes.aVel.array;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    let sh = 0, nWet = 0, sw = 0, nShow = 0, svx = 0, svz = 0, n = 0, sb = 0;
    for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= SN || jj >= SN) continue;
      const ck = jj * SN + ii, pi = (jj + 1) * SP + ii + 1, w = s.w[pi];
      sb += s.b[pi]; n++;
      if (w > 0.006) { sh += s.b[pi] + w; nWet++; svx += s.vx[ck]; svz += s.vz[ck]; }
      if (w > 0.006 && c.src[ck] !== 1 && (c.base[ck] > 0.15 || c.G[ck] < -0.05)) { sw += w; nShow++; }
    }
    pos[k * 3] = c.x0 + i * CS; pos[k * 3 + 2] = c.z0 + j * CS;
    if (nWet) { pos[k * 3 + 1] = sh / nWet; aw[k] = nShow ? (sw / nShow) * (nShow / n) : 0; av[k * 2] = svx / nWet; av[k * 2 + 1] = svz / nWet; }
    else { pos[k * 3 + 1] = sb / Math.max(1, n) - 0.08; aw[k] = 0; av[k * 2] = av[k * 2 + 1] = 0; }
  }
  g.attributes.position.needsUpdate = g.attributes.aW.needsUpdate = g.attributes.aVel.needsUpdate = true;
  c.water.visible = vis;
}
function makeSandWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, ...WFX.uniforms },
    vertexShader: `${COMMON}
      attribute float aW; attribute vec2 aVel; varying vec3 vWPos; varying float vW; varying vec2 vVel;
      void main(){ vW = aW; vVel = aVel; vec4 wp = modelMatrix * vec4(position, 1.0); vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `${COMMON}
      ${WATER_FRAG_COMMON}
      ${WFX_GLSL}
      varying float vW; varying vec2 vVel;
      vec3 skyR(vec3 R){ float yy = max(R.y, 0.0); return mix(uSkyHorizon, uSkyZenith, pow(yy, 0.5)); }
      void main(){
        // a film thinner than a couple of centimetres is just wet ground (the sand shader darkens it)
        float show = smoothstep(0.012, 0.07, vW + (texture2D(uNoiseTex, vWPos.xz * 0.6).r - 0.5) * 0.035);
        if (show < 0.01) discard;
        vec3 toCam = cameraPosition - vWPos; float dist = length(toCam); vec3 V = toCam / dist;
        float sp = length(vVel);
        float ph0 = fract(uTime * 0.5), ph1 = fract(uTime * 0.5 + 0.5);
        vec2 fl = vVel * 0.5;
        vec3 na = texture2D(uNormTex, vWPos.xz * 0.35 - fl * ph0).xyz * 2.0 - 1.0;
        vec3 nb = texture2D(uNormTex, vWPos.xz * 0.35 + 0.5 - fl * ph1).xyz * 2.0 - 1.0;
        vec3 nn = mix(na, nb, abs(ph0 - 0.5) * 2.0);
        vec3 N = normalize(vec3(nn.x * (0.18 + sp * 0.25), 1.0, nn.y * (0.18 + sp * 0.25)));
        vec3 rp = ripple(vWPos.xz); N = normalize(N + vec3(-rp.x, 0.0, -rp.y));
        if (uRain > 0.02) N = normalize(N + rainRipple(vWPos.xz) * 0.35 * uRain);
        float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        float Tr = exp(-vW / max(V.y, 0.15) * 0.9);
        vec3 body = vec3(0.30, 0.33, 0.24) * uWaterLight;      // a little silty
        float foam = foamMask(vWPos.xz, smoothstep(1.3, 2.8, sp) * 0.4 * smoothstep(0.1, 0.25, vW) + rp.z * 0.5, fl * ph0 * 0.2);
        float sun = max(dot(R, uLightDir), 0.0);
        vec3 spec = uSpecCol * (pow(sun, 400.0) * 2.0 + pow(sun, 2000.0) * 2.5);
        F *= 0.7;
        vec3 col = body * (1.0 - Tr) * (1.0 - F) + skyR(R) * F * 0.85 + spec;
        float a = 1.0 - Tr * (1.0 - F);
        col = mix(col, uFoamCol, foam * 0.85); a = mix(a, 1.0, foam * 0.85);
        col *= show; a *= show;
        col = applyFog(col, vWPos, 1.0);
        if (uRefrOn > 0.5) { vec2 off = N.xz * 30.0 * clamp(vW, 0.0, 1.0) * (uScreen.y / 900.0) / (1.0 + dist * 0.1); col += refrAt(off) * (1.0 - a); a = 1.0; }
        gl_FragColor = vec4(outCol(col / max(a, 1e-3)) * a, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// ---- carving: footprints and writing ----
function ensureSlot(c) {
  if (c.slot >= 0) return c.slot;
  let s = SAND.slots.indexOf(null);
  if (s < 0) { // reuse the slot of the chunk farthest from you
    let far = -1, fs = 0;
    SAND.slots.forEach((o, i) => { const d = Math.hypot(o.x0 - P.pos.x, o.z0 - P.pos.z); if (d > far) { far = d; fs = i; } });
    const old = SAND.slots[fs]; old.slot = -1; setLook(old); s = fs;
  }
  SAND.slots[s] = c; c.slot = s;
  SAND.carveData.fill(0, s * SAND.CARVE * SAND.CARVE, (s + 1) * SAND.CARVE * SAND.CARVE);
  SAND.carveDirty.add(s); setLook(c);
  return s;
}
// paint into the carve layer: fn(worldX, worldZ, current) → new value (0..255)
function carveRegion(x0, z0, x1, z1, fn) {
  const R = SAND.CARVE, tex = SAND.TS / R;
  for (let cz = Math.floor((z0 - SAND.O) / SAND.TS); cz <= Math.floor((z1 - SAND.O) / SAND.TS); cz++)
    for (let cx = Math.floor((x0 - SAND.O) / SAND.TS); cx <= Math.floor((x1 - SAND.O) / SAND.TS); cx++) {
      const c = getChunk(cx, cz, true); if (!c) continue;
      const s = ensureSlot(c), off = s * R * R;
      const i0 = clamp(Math.floor((x0 - c.x0) / tex), 0, R - 1), i1 = clamp(Math.ceil((x1 - c.x0) / tex), 0, R - 1);
      const j0 = clamp(Math.floor((z0 - c.z0) / tex), 0, R - 1), j1 = clamp(Math.ceil((z1 - c.z0) / tex), 0, R - 1);
      let hit = false;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const o = off + j * R + i, v = fn(c.x0 + (i + 0.5) * tex, c.z0 + (j + 0.5) * tex, SAND.carveData[o]);
        if (v !== SAND.carveData[o]) { SAND.carveData[o] = v; hit = true; }
      }
      if (hit) SAND.carveDirty.add(s);
    }
}
function carveStroke(ax, az, bx, bz, radius = 0.085, depth = 1.0) {
  const ex = bx - ax, ez = bz - az, el = ex * ex + ez * ez || 1e-6;
  carveRegion(Math.min(ax, bx) - radius, Math.min(az, bz) - radius, Math.max(ax, bx) + radius, Math.max(az, bz) + radius, (x, z, cur) => {
    const t = clamp(((x - ax) * ex + (z - az) * ez) / el, 0, 1), d = Math.hypot(x - ax - ex * t, z - az - ez * t);
    const v = depth * (1 - smoothstep(radius * 0.35, radius, d)) * 255;
    return v > cur ? Math.round(v) : cur;
  });
}
function stampFoot(x, z, yaw, left) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), side = left ? -1 : 1;
  const el = (u, v, cu, cv, au, av) => ((u - cu) / au) ** 2 + ((v - cv) / av) ** 2;
  carveRegion(x - 0.2, z - 0.2, x + 0.2, z + 0.2, (px, pz, cur) => {
    const dx = px - x, dz = pz - z, u = dx * fx + dz * fz, v = (dx * rx + dz * rz) * side;
    let e = Math.min(el(u, v, -0.085, 0, 0.05, 0.042), el(u, v, 0.03, 0.006, 0.065, 0.05), el(u, v, -0.03, 0.018, 0.06, 0.03));
    for (let t = 0; t < 5; t++) e = Math.min(e, el(u, v, 0.11 - Math.abs(t - 1) * 0.008, -0.03 + t * 0.016, 0.014, 0.011 - t * 0.001));
    const val = (1 - smoothstep(0.55, 1.0, e)) * 0.58 * 255;
    return val > cur ? Math.round(val) : cur;
  });
}
function washCarves(t) {
  const R = SAND.CARVE, step = SN / R;
  for (const c of SAND.slots) {
    if (!c || !c.low) continue;
    if (Math.abs(c.x0 + 16 - P.pos.x) > 160 || Math.abs(c.z0 + 16 - P.pos.z) > 160) continue;
    const sea = Math.max(0, surfJS(c.x0 + 16, c.z0 + 16, 0, t)) + 0.03;
    const off = c.slot * R * R; let hit = false;
    for (let j = 0; j < R; j++) {
      const cj = Math.min(SN - 1, Math.floor(j * step));
      for (let i = 0; i < R; i++) {
        const o = off + j * R + i; if (!SAND.carveData[o]) continue;
        const ck = cj * SN + Math.min(SN - 1, Math.floor(i * step));
        if (c.base[ck] + c.R[ck] + c.G[ck] < sea) { SAND.carveData[o] = SAND.carveData[o] * 0.72 | 0; hit = true; }
      }
    }
    if (hit) SAND.carveDirty.add(c.slot);
  }
}
// one slot at a time, so the cost is spread out; each slot fades a step about every 10 s
let fadeSlot = 0;
function fadeCarves() {
  const R = SAND.CARVE, c = SAND.slots[fadeSlot]; fadeSlot = (fadeSlot + 1) % SAND.SLOTS;
  if (!c) return;
  const off = c.slot * R * R; let any = false;
  for (let o = off; o < off + R * R; o++) if (SAND.carveData[o]) { SAND.carveData[o]--; any = true; }
  if (any) SAND.carveDirty.add(c.slot);
}

// ---- wet patches: where you poured water or water ran, drying over a minute or two ----
function cellWet(gi, gj) {
  if (gi < 0 || gj < 0) return 0;
  const c = SAND.chunks.get(chunkKey(gi >> 6, gj >> 6)); if (!c || !c.wet) return 0;
  return c.wet[(gj & 63) * 64 + (gi & 63)];
}
function writeWet(c) {
  if (!c.mesh) return;
  const N = SN + 1, a = c.mesh.geometry.attributes.aWetS, arr = a.array;
  if (!c.wet) { if (c.wetShown) { arr.fill(0); a.needsUpdate = true; c.wetShown = false; } return; }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const gi = c.cx * SN + i, gj = c.cz * SN + j;
    const a0 = cellWet(gi - 1, gj - 1), a1 = cellWet(gi, gj - 1), a2 = cellWet(gi - 1, gj), a3 = cellWet(gi, gj);
    arr[j * N + i] = Math.max(a0, a1, a2, a3) * 0.45 + (a0 + a1 + a2 + a3) * 0.1375;
  }
  c.edge.forEach((k, e) => { arr[N * N + e] = arr[k]; });
  a.needsUpdate = true; c.wetShown = true;
}
function wetArea(x, z, r) {
  for (let gz = Math.floor((z - r - SAND.O) / SAND.CS); gz <= Math.floor((z + r - SAND.O) / SAND.CS); gz++)
    for (let gx = Math.floor((x - r - SAND.O) / SAND.CS); gx <= Math.floor((x + r - SAND.O) / SAND.CS); gx++) {
      const wx = SAND.O + (gx + 0.5) * SAND.CS, wz = SAND.O + (gz + 0.5) * SAND.CS, d = Math.hypot(wx - x, wz - z);
      if (d > r) continue;
      const c = getChunk(gx >> 6, gz >> 6, true); if (!c) continue;
      if (!c.wet) c.wet = new Float32Array(SN * SN);
      const k = (gz & 63) * SN + (gx & 63);
      c.wet[k] = Math.max(c.wet[k], 1 - (d / r) ** 3 * 0.5);
      if (!needsMesh(c)) { c.forced = true; }
      c.wetDirty = true; c.meshDirty = c.meshDirty || !c.mesh;
    }
}
function updateWetness(dt) {
  const f = Math.exp(-dt / 75);
  for (const c of SAND.list) {
    if (!c.wet && !(c.sim && c.waterCells)) continue;
    if (!c.wet) c.wet = new Float32Array(SN * SN);
    let any = false;
    for (let k = 0; k < SN * SN; k++) {
      let w = c.wet[k] * f;
      if (c.sim) { const pi = ((k / SN | 0) + 1) * SP + (k % SN) + 1; if (c.sim.w[pi] > 0.01 && c.src[k] !== 1) w = 1; }
      c.wet[k] = w < 0.02 ? 0 : w; if (w >= 0.02) any = true;
    }
    if (!any) c.wet = null;
    if (c.vis) writeWet(c);
  }
}
// pour a bucket of water onto the sand: it soaks in, runs downhill and collects in what you dug
function cellRef(x, z) {
  const gx = Math.floor((x - SAND.O) / SAND.CS), gz = Math.floor((z - SAND.O) / SAND.CS);
  const c = getChunk(gx >> 6, gz >> 6, true); if (!c) return null;
  const k = (gz & 63) * SN + (gx & 63);
  return { c, k, pi: ((gz & 63) + 1) * SP + (gx & 63) + 1 };
}
function pourAt(x, z, vol) {
  const r = 0.8, cells = [];
  for (let dz = -r; dz <= r + 1e-6; dz += SAND.CS) for (let dx = -r; dx <= r + 1e-6; dx += SAND.CS) {
    if (dx * dx + dz * dz > r * r) continue;
    const ref = cellRef(x + dx, z + dz); if (ref) cells.push(ref);
  }
  if (!cells.length) return false;
  const per = vol / (cells.length * SAND.CS * SAND.CS);
  for (const { c, k, pi } of cells) {
    touchCell(c, k); activateSim(c);
    c.sim.b[pi] = c.base[k] + c.R[k] + c.G[k];
    c.sim.w[pi] += per; c.waterDirty = true;
  }
  wetArea(x, z, 1.15);
  return true;
}
// take water out of a dug pool; returns how much there was
function scoopAt(x, z, vol) {
  let got = 0;
  for (let ring = 0; ring <= 2 && got < vol; ring++) for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring || got >= vol) continue;
    const ref = cellRef(x + dx * SAND.CS, z + dz * SAND.CS); if (!ref || !ref.c.sim || ref.c.src[ref.k] === 1) continue;
    const w = ref.c.sim.w[ref.pi], take = Math.min(w, (vol - got) / (SAND.CS * SAND.CS));
    if (take <= 0) continue;
    ref.c.sim.w[ref.pi] -= take; got += take * SAND.CS * SAND.CS; ref.c.waterDirty = true;
  }
  return got;
}

// ---- digging ----
const DIG = { radius: 0.62, depth: 0.26 };
function applyShovelPower() { const p = settings.shovelPower || 1; DIG.radius = 0.62 * Math.pow(p, 0.45); DIG.depth = 0.26 * p; }
applyShovelPower();
function canDig(x, z) {
  const m = maskAt(x, z), b = baseGround(x, z);
  if (m[2] > 0.55 || slopeAt(x, z) > 0.55) return 'rock';
  if (b < -0.6) return 'deep';
  for (const p of PLATFORMS) { const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot); if (Math.abs(dx * c - dz * s) < p.hx + 0.3 && Math.abs(dx * s + dz * c) < p.hz + 0.3) return 'wood'; }
  let blocked = false; COLLIDERS.query(x, z, 2, c => { if (Math.hypot(c.x - x, c.z - z) < c.r + 0.5) blocked = true; });
  return blocked ? 'blocked' : null;
}
// one scoop of the shovel: a hole at (x, z), the sand tossed to (tx, tz)
function digAt(x, z, tx, tz) {
  const r = DIG.radius, pr = Math.max(1.0, r * 1.5), ext = Math.max(r, pr) + 0.2;
  let removed = 0;
  const apply = (cx, cz, fn) => {
    for (let gz = Math.floor((cz - ext - SAND.O) / SAND.CS); gz <= Math.floor((cz + ext - SAND.O) / SAND.CS); gz++)
      for (let gx = Math.floor((cx - ext - SAND.O) / SAND.CS); gx <= Math.floor((cx + ext - SAND.O) / SAND.CS); gx++) {
        const c = getChunk(gx >> 6, gz >> 6, true); if (!c) continue;
        const k = (gz & 63) * SN + (gx & 63);
        const wx = SAND.O + (gx + 0.5) * SAND.CS, wz = SAND.O + (gz + 0.5) * SAND.CS;
        const d = fn(c, k, Math.hypot(wx - cx, wz - cz));
        if (d) { touchCell(c, k); c.meshDirty = true; c.digDirty = true; activateSim(c); c.sim.b[((k / SN | 0) + 1) * SP + (k % SN) + 1] = c.base[k] + c.R[k] + c.G[k]; }
      }
  };
  apply(x, z, (c, k, d) => {
    if (d > r) return false;
    const want = DIG.depth * Math.pow(1 - (d / r) ** 2, 1.3);
    const floor = Math.max(-2.4, -1.6 - c.base[k] * 0.0);
    const cut = Math.min(want, c.base[k] + c.R[k] + c.G[k] - Math.max(-1.6, c.base[k] - 2.4));
    if (cut <= 0) return false;
    c.G[k] -= cut; removed += cut; return true;
  });
  if (tx !== undefined && removed > 0) {
    const pile = removed * 0.7; let norm = 0;
    apply(tx, tz, (c, k, d) => { if (d > pr) return false; norm += Math.pow(1 - (d / pr) ** 2, 1.5); return false; });
    apply(tx, tz, (c, k, d) => { if (d > pr || !norm) return false; c.G[k] += pile * Math.pow(1 - (d / pr) ** 2, 1.5) / norm; return true; });
  }
  // digging wipes out any writing or footprints under the shovel
  carveRegion(x - r, z - r, x + r, z + r, (px, pz, cur) => (Math.hypot(px - x, pz - z) < r ? 0 : cur));
  return removed;
}
// ---- placing dirt ----
// the shovel can also throw down dirt (as much as you like): build up banks, fill holes, dam the river
function canFill(x, z) {
  const b = baseGround(x, z);
  if (slopeAt(x, z) > 0.62) return 'steep';
  if (b < -3.5) return 'deep';
  for (const p of PLATFORMS) { const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot); if (Math.abs(dx * c - dz * s) < p.hx + 0.3 && Math.abs(dx * s + dz * c) < p.hz + 0.3) return 'wood'; }
  let blocked = false; COLLIDERS.query(x, z, 2, c => { if (Math.hypot(c.x - x, c.z - z) < c.r + 0.4) blocked = true; });
  return blocked ? 'blocked' : null;
}
function fillAt(x, z) {
  const r = DIG.radius * 1.6, h = DIG.depth * 2.2, ext = r + 0.2;
  let added = 0;
  for (let gz = Math.floor((z - ext - SAND.O) / SAND.CS); gz <= Math.floor((z + ext - SAND.O) / SAND.CS); gz++)
    for (let gx = Math.floor((x - ext - SAND.O) / SAND.CS); gx <= Math.floor((x + ext - SAND.O) / SAND.CS); gx++) {
      const c = getChunk(gx >> 6, gz >> 6, true); if (!c) continue;
      const k = (gz & 63) * SN + (gx & 63);
      const wx = SAND.O + (gx + 0.5) * SAND.CS, wz = SAND.O + (gz + 0.5) * SAND.CS, d = Math.hypot(wx - x, wz - z);
      if (d > r) continue;
      // a rounded heap; thrown into water it slumps flatter
      const add = h * Math.pow(1 - (d / r) ** 2, 1.4);
      if (add < 0.004) continue;
      if (!c.Dt) c.Dt = new Float32Array(SN * SN);
      c.G[k] += add; c.Dt[k] += add; added += add * SAND.CS * SAND.CS;
      touchCell(c, k); c.meshDirty = true; c.digDirty = true; activateSim(c);
      const pi = ((k / SN | 0) + 1) * SP + (k % SN) + 1;
      c.sim.b[pi] = c.base[k] + c.R[k] + c.G[k];
      c.sim.w[pi] = Math.max(0, c.sim.w[pi] - add);      // the dirt pushes the water aside
    }
  carveRegion(x - r, z - r, x + r, z + r, (px, pz, cur) => (Math.hypot(px - x, pz - z) < r * 0.8 ? 0 : cur));
  return added;
}

// ---- damming the river ----
// Pile dirt across the channel higher than the water and the river stops there: below the dam it
// drains away to puddles (and if you dam it above the falls, the falls run dry); above it the water
// backs up into a pond that rises until it pours over the dam or spills out over the lowest bank.
// Dig through the dam and it all lets go again.
const DAM = { list: [], active: { upper: null, lower: null }, t: 0, lvlT: 0, spillT: 0 };
function crossMin(p, W) {
  const nx = -p.tz, nz = p.tx; let m = 1e9;
  for (let off = -W - 0.4; off <= W + 0.4 + 1e-6; off += 0.3) m = Math.min(m, groundHeight(p.x + nx * off, p.z + nz * off));
  return m;
}
// look at the river's cross-sections around (x, z) after the ground there has changed
function surveyRiver(x, z) {
  if (!STREAM.all.length) return;
  const q = riverQuery(x, z); if (!q || q.d > q.W + 4 || (q.kind !== 'upper' && q.kind !== 'lower')) return;
  const pts = STREAM.all;
  let best = null;
  for (let j = Math.max(0, q.i - 4); j <= Math.min(pts.length - 1, q.i + 5); j++) {
    const p = pts[j]; if (p.kind !== q.kind || p.S === undefined || p.tx === undefined) continue;
    // the cross-section that stands highest above its own water level (on a steep stream the bed
    // upstream is higher than any dam below it, so compare each with its own water)
    const m = crossMin(p, p.W);
    if (!best || m - p.S > best.crest - best.S) best = { j, crest: m, S: p.S };
  }
  if (!best) return;
  const blocked = best.crest > best.S + 0.02 && best.S > 0.05;
  let dm = DAM.list.find(d => d.kind === q.kind && Math.abs(d.pi - best.j) < 9);
  if (!dm && !blocked) return;
  if (!dm) {
    dm = { kind: q.kind, pi: best.j, rv: pts[best.j].rv || 0, S: best.S, D: pts[best.j].D, crest: best.crest, blocked: true, drop: 0, pond: best.S, spill: null, bank: 1e9, x: pts[best.j].x, z: pts[best.j].z };
    DAM.list.push(dm);
    toast('You dammed the river', q.kind === 'upper' ? 'The falls will run dry below it' : 'It’s drying up downstream');
  }
  if (blocked) { dm.pi = best.j; dm.rv = pts[best.j].rv || 0; dm.S = best.S; dm.D = pts[best.j].D; dm.x = pts[best.j].x; dm.z = pts[best.j].z; }
  if (dm.blocked && !blocked) toast('The dam broke', 'The river runs again');
  dm.crest = best.crest; dm.blocked = blocked;
  // the lowest point of the banks along the pond, where it will spill out if it rises that far
  if (blocked) {
    dm.bank = 1e9; dm.spill = null;
    const pondMax = Math.min(dm.crest, q.kind === 'lower' ? POOL.level : 1e9);
    for (let j = dm.pi - 1, run = 0; j >= 0 && run < 70; j--) {
      const p = pts[j], n = pts[j + 1]; if (p.kind !== q.kind || p.S === undefined || p.tx === undefined) break;
      run += Math.hypot(n.x - p.x, n.z - p.z);
      if (p.S > pondMax + 0.3) break;
      for (const side of [-1, 1]) for (const off of [1.0, 2.2]) {
        const bx = p.x - p.tz * side * (p.W + off), bz = p.z + p.tx * side * (p.W + off), h = groundHeight(bx, bz);
        if (h < dm.bank) { dm.bank = h; dm.spill = { x: bx, z: bz, ox: -p.tz * side, oz: p.tx * side }; }
      }
    }
  }
  pickActiveDams();
}
function pickActiveDams() {
  DAM.active.upper = DAM.active.lower = null;
  for (const d of DAM.list) if (d.blocked || d.drop > 0.01 || d.pond > d.S + 0.01) { const a = DAM.active[d.kind]; if (!a || d.pi < a.pi) DAM.active[d.kind] = d; }
}
// the water level of the river at a riverQuery() result, allowing for any dam
function riverLevelAt(q) {
  const dm = q && DAM.active[q.kind]; if (!dm) return q.S;
  const at = q.i + q.t;
  if (at > dm.pi + 0.6) { const bed = q.S - q.D; return Math.max(bed + 0.12, bed < 0 ? Math.min(q.S, 0) : -1e9, q.S - dm.drop); }
  if (at > dm.pi - 80) return Math.max(q.S, dm.pond);
  return q.S;
}
// how still the river is at q because of a dam (0 running normally, 1 not moving at all)
function riverStillAt(q) {
  const dm = q && DAM.active[q.kind]; if (!dm) return 0;
  const at = q.i + q.t;
  if (at > dm.pi + 0.6) return clamp(dm.drop / Math.max(0.2, q.D - 0.12), 0, 1);
  if (at > dm.pi - 80 && dm.pond > q.S) return clamp((dm.pond - q.S) / 0.25, 0, 1);
  return 0;
}
function updateDams(dt) {
  if (!DAM.list.length && !DAM.live) return;
  DAM.live = DAM.list.length > 0;      // one more pass after the last dam goes, to put everything back
  for (const d of DAM.list) {
    // rises behind the dam until it tops the dam or finds the lowest bank
    const top = Math.min(d.crest, d.bank + 0.03, d.kind === 'lower' ? POOL.level : 1e9);
    const overTop = d.blocked && d.crest <= d.bank + 0.03;
    if (d.blocked) d.pond = Math.min(top, d.pond + dt * 0.045);
    else d.pond = Math.max(d.S, d.pond - dt * 0.25);
    const full = d.D - 0.12;
    const wantDrop = d.blocked && !(overTop && d.pond >= top - 0.005) ? full : 0;
    d.drop = wantDrop > d.drop ? Math.min(wantDrop, d.drop + dt * 0.09) : Math.max(wantDrop, d.drop - dt * 0.35);
    // pouring out over the bank once the pond is up to it
    if (d.blocked && d.spill && d.pond >= d.bank + 0.02) {
      DAM.spillT -= dt;
      if (DAM.spillT <= 0) { DAM.spillT = 0.25; pourAt(d.spill.x + d.spill.ox * 0.8, d.spill.z + d.spill.oz * 0.8, 0.35); }
    }
  }
  DAM.list = DAM.list.filter(d => d.blocked || d.drop > 0.005 || d.pond > d.S + 0.005);
  pickActiveDams();
  for (const r of STREAM.ribbons || []) {
    const u = r.material.uniforms.uDam; if (!u) continue;
    const dm = DAM.active[r.userData.kind];
    if (dm) u.value.set(dm.rv, dm.drop, dm.pond, 1); else u.value.w = 0;
  }
  // the river cells of the sand layer follow the new levels, so dug channels fill (or don't) to match
  DAM.lvlT -= dt;
  if (DAM.lvlT <= 0) {
    DAM.lvlT = 0.6;
    for (const c of SAND.list) {
      if (!c.sim) continue;
      for (let k = 0; k < SN * SN; k++) {
        if (c.src[k] !== 1) continue;
        const q = riverQuery(c.x0 + ((k % SN) + 0.5) * SAND.CS, c.z0 + (((k / SN) | 0) + 0.5) * SAND.CS);
        if (q) c.lvl[k] = riverLevelAt(q);
      }
    }
  }
  // the falls run dry when the river above them is dammed
  const up = DAM.active.upper;
  STREAM.fallFlow = up ? 1 - clamp(up.drop / Math.max(0.2, up.D - 0.12), 0, 1) : 1;
  if (STREAM.fall && STREAM.fall.mats) for (const m of STREAM.fall.mats) m.uniforms.uFlow.value = STREAM.fallFlow;
}
// river chunks are shaped at load so the channel is smooth up close
function buildRiverChunks() {
  initSand();
  SAND.tileMat = makeTerrainMaterial(true);
  SAND.waterMat = makeSandWaterMaterial();
  const want = new Set();
  for (const p of STREAM.all) {
    const W = (p.W || 3) + 14;
    for (let z = p.z - W; z <= p.z + W; z += 8) for (let x = p.x - W; x <= p.x + W; x += 8) want.add(chunkKey(Math.floor((x - SAND.O) / SAND.TS), Math.floor((z - SAND.O) / SAND.TS)));
  }
  for (let z = SPRING.z - 8; z <= SPRING.z + 8; z += 4) for (let x = SPRING.x - 8; x <= SPRING.x + 8; x += 4) want.add(chunkKey(Math.floor((x - SAND.O) / SAND.TS), Math.floor((z - SAND.O) / SAND.TS)));
  for (const k of want) { const cx = Math.floor(k / 1024), cz = k % 1024; if (!SAND.chunks.has(k)) makeChunk(cx, cz); }
  // chunks that turned out flat don't need to exist
  for (const c of [...SAND.list]) if (!c.hasShape) { SAND.chunks.delete(chunkKey(c.cx, c.cz)); SAND.list.splice(SAND.list.indexOf(c), 1); SAND.count--; }
}
