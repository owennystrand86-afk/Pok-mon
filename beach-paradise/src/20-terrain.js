
// ───────────────────────────── 6. Island terrain ─────────────────────────────
// World units are metres. +x is east, -z is north. The sun sets in the west,
// over the ocean in front of the main beach.
const T = { size: 1800, res: isMobile ? 320 : 480 };
T.half = T.size / 2; T.cell = T.size / T.res; T.n = T.res + 1; T.min = -T.half;
T.h = new Float32Array(T.n * T.n);
T.L = new Float32Array(T.n * T.n);
T.nrm = new Float32Array(T.n * T.n * 3);
T.mask = new Uint8Array(T.n * T.n * 4); // r sand, g jungle, b rock, a trail

const BLOBS = [[0, 0, 380], [185, -150, 265], [-125, 235, 235], [125, 255, 205], [-205, -215, 205], [300, 60, 170]];
const ISLET = { x: -610, z: 330, r: 48 };
const BAY = { x: -20, z: -352, r: 52 };                       // hidden cove (z fitted to the coast at build time)
const WF = { x: 16, z: -66, nx: 0.997, nz: 0.077, height: 28, halfLen: 50 }; // waterfall escarpment, on the mountain's flank
const POOL = { x: 2, z: -66, r: 13, level: 50 };
const SPRING = { x: 62, z: -78, r: 4.4, level: 60 };             // where the river rises
const STREAM_CTRL = [[62, -78], [50, -74.5], [40, -71.5], [31, -69.2], [25, -68], [19, -67.2], [3, -66], [-14, -67], [-34, -69], [-52, -70.5], [-70, -74], [-95, -84], [-128, -92], [-170, -85], [-218, -97], [-270, -107], [-322, -112], [-370, -114], [-420, -116]];
const TRAIL_CTRL = [[-318, 26], [-282, 16], [-232, 4], [-182, -10], [-136, -26], [-98, -42], [-70, -50], [-52, -56], [-48, -88], [-44, -112], [-30, -126], [2, -128], [42, -122], [84, -112], [126, -102], [166, -96]];

function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); }
function smax(a, b, k) { return -smin(-a, -b, k); }
function landRaw(x, z) {
  let L = -1e9;
  for (let i = 0; i < BLOBS.length; i++) { const b = BLOBS[i]; L = smax(L, b[2] - Math.hypot(x - b[0], z - b[1]), 90); }
  L += Noise.fbm(x * 0.0042 + 3.1, z * 0.0042 - 1.7, 4) * 46 + Noise.fbm(x * 0.016, z * 0.016 + 9, 3) * 9;
  const li = ISLET.r - Math.hypot(x - ISLET.x, z - ISLET.z) + Noise.fbm(x * 0.03, z * 0.03, 2) * 6;
  return Math.max(L, li);
}
function landField(x, z) {
  const L = landRaw(x, z);
  const lb = Math.hypot(x - BAY.x, z - BAY.z) - BAY.r + Noise.fbm(x * 0.02 + 5, z * 0.02, 2) * 7;
  return smin(L, lb, 16);
}
function rockyMask(x, z) {
  const e = Math.cos(Math.atan2(z, x) + 0.35);
  return smoothstep(0.5, 0.88, e) * smoothstep(-0.25, 0.25, Noise.fbm(x * 0.007 + 2, z * 0.007, 2) + 0.18);
}
// the mountain: a tall volcanic peak whose flanks are cut into knife-edge ridges and deep gullies
// running down from the summit, a lower shoulder to the north, and rock breaking through everywhere
function mountain(x, z) {
  const px = 196, pz = -92, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
  let m = 0;
  const R = 430;
  if (d < R) {
    const t = 1 - d / R;
    m = 248 * Math.pow(t, 1.85) + 46 * Math.pow(t, 7);                  // concave flanks, a sharp summit
    const a = Math.atan2(dz, dx) + Noise.fbm(x * 0.0045 + 11, z * 0.0045 - 3, 3) * 0.75;
    const rib = Math.abs(Math.sin(a * 6.5 + d * 0.0075));               // 1 on the ridges, 0 in the gullies
    const ridge = 1 - Math.pow(1 - rib, 2.4);
    const rk = smoothstep(0.04, 0.4, t) * (1 - smoothstep(0.82, 0.97, t));
    m *= 1 - 0.3 * rk * (1 - ridge);
    m += 14 * rk * Math.pow(rib, 6);                                     // knife edges along the crests
  }
  // the northern shoulder, joined to the peak by a saddle
  const d2 = Math.hypot(x + 18, z - 138), t2 = Math.max(0, 1 - d2 / 240);
  m = smax(m, 132 * Math.pow(t2, 1.6), 30);
  const ds = Math.hypot(x - 96, z - 22), ts = Math.max(0, 1 - ds / 170);
  m = smax(m, 92 * Math.pow(ts, 1.4), 30);
  // erosion: sharp ridged detail on the high ground, softer lumps lower down
  if (m > 0.5) {
    m += (Noise.ridged(x * 0.012, z * 0.012, 5) - 0.45) * 30 * smoothstep(8, 130, m);
    m += Noise.fbm(x * 0.045 + 3, z * 0.045, 3) * 4 * smoothstep(4, 60, m);
  }
  return m;
}
// the river has cut a valley down the mountain's flank below the falls, so it runs in pools and short
// cascades rather than one long torrent
function riverValley(x, z) {
  if (cliffS(x, z) > 25) return 1;
  let d = 1e9;
  for (let i = 6; i < STREAM_CTRL.length - 1; i++) {
    const [ax, az] = STREAM_CTRL[i], [bx2, bz2] = STREAM_CTRL[i + 1], ex = bx2 - ax, ez = bz2 - az, l2 = ex * ex + ez * ez;
    const t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1); d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  const k = (1 - smoothstep(30, 130, d)) * (1 - smoothstep(-15, 25, cliffS(x, z)));
  return 1 - 0.72 * k;
}
const _bh = { L: 0 };
function baseHeight(x, z, out = _bh) {
  const L = landField(x, z); out.L = L;
  const rock = rockyMask(x, z);
  let h;
  if (L < 0) {
    const t = -L * (1 + rock * 1.6);
    h = -(1.9 * (1 - Math.exp(-t / 20)) + 2.6 * smoothstep(25, 150, t) + 24 * smoothstep(150, 330, t) + 16 * smoothstep(330, 650, t));
    if (t > 8 && t < 330) h += Noise.fbm(x * 0.021, z * 0.021, 3) * 1.3 * smoothstep(8, 60, t) * (1 - smoothstep(200, 330, t));
  } else {
    const beach = 2.4 * (1 - Math.exp(-L / 28));
    h = lerp(beach, Math.min(L * 0.55, 13 + L * 0.06), rock);
    const dune = smoothstep(12, 38, L) * (1 - smoothstep(55, 110, L)) * (1 - rock);
    if (dune > 0) h += dune * (0.6 + 1.6 * (Noise.fbm(x * 0.03 + 7, z * 0.03, 3) * 0.5 + 0.5));
    const inland = smoothstep(25, 170, L);
    if (inland > 0) h += inland * (4 + 15 * (Noise.fbm(x * 0.0055 - 4, z * 0.0055 + 2, 4) * 0.5 + 0.5));
    const mm = smoothstep(30, 200, L);
    if (mm > 0) h += mm * mountain(x, z) * riverValley(x, z);
    const dx = x - WF.x, dz = z - WF.z;
    const s = dx * WF.nx + dz * WF.nz, al = -dx * WF.nz + dz * WF.nx;
    if (Math.abs(al) < WF.halfLen + 4 && s > -6 && s < 100)
      h += WF.height * smoothstep(-1.6, 1.6, s) * (1 - smoothstep(WF.halfLen * 0.55, WF.halfLen, Math.abs(al))) * (1 - smoothstep(45, 100, s));
  }
  const edge = Math.max(Math.abs(x), Math.abs(z));
  if (edge > T.half - 170) h = lerp(h, Math.min(h, -44), smoothstep(T.half - 170, T.half - 8, edge));
  return h;
}
const cliffS = (x, z) => (x - WF.x) * WF.nx + (z - WF.z) * WF.nz;

// --- grid access (matches the rendered triangles exactly) ---
function gridSample(H, x, z) {
  const fx = (x - T.min) / T.cell, fz = (z - T.min) / T.cell;
  if (!(fx >= 0 && fz >= 0 && fx < T.res && fz < T.res)) return -45;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, n = T.n, k = j * n + i;
  const ha = H[k], hb = H[k + 1], hc = H[k + n], hd = H[k + n + 1];
  if (tx + tz <= 1) return ha + (hb - ha) * tx + (hc - ha) * tz;
  return hd + (hc - hd) * (1 - tx) + (hb - hd) * (1 - tz);
}
const baseGround = (x, z) => gridSample(T.h, x, z);
// any per-vertex field of the coarse island (normals, masks), interpolated across the same triangles it is drawn with
function gridLerp(A, stride, x, z, out, scale = 1) {
  const fx = clamp((x - T.min) / T.cell, 0, T.res - 1e-4), fz = clamp((z - T.min) / T.cell, 0, T.res - 1e-4);
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, n = T.n, k = j * n + i;
  let ka, kb, kc, wa, wb, wc;
  if (tx + tz <= 1) { ka = k; kb = k + 1; kc = k + n; wa = 1 - tx - tz; wb = tx; wc = tz; }
  else { ka = k + n + 1; kb = k + n; kc = k + 1; wa = tx + tz - 1; wb = 1 - tx; wc = 1 - tz; }
  for (let q = 0; q < stride; q++) out[q] = (A[ka * stride + q] * wa + A[kb * stride + q] * wb + A[kc * stride + q] * wc) * scale;
  return out;
}
// the walkable surface: the island plus anything carved, dug or piled in the living-sand layer
function groundHeight(x, z) {
  if (x < T.min + 1 || z < T.min + 1 || x > -T.min - 1 || z > -T.min - 1) return farHeight(x, z);   // out in the wider ocean
  const b = gridSample(T.h, x, z); return SAND.count ? b + sandDelta(x, z) : b;
}
function groundNormal(x, z, out = new THREE.Vector3()) {
  const e = 0.75;
  return out.set(groundHeight(x - e, z) - groundHeight(x + e, z), 2 * e, groundHeight(x, z - e) - groundHeight(x, z + e)).normalize();
}
const vIndex = (x, z) => {
  const i = clamp(Math.round((x - T.min) / T.cell), 0, T.res), j = clamp(Math.round((z - T.min) / T.cell), 0, T.res);
  return j * T.n + i;
};
function coastAt(x, z) {
  if (x < T.min + 1 || z < T.min + 1 || x > -T.min - 1 || z > -T.min - 1) return farField(x, z).L;
  const fx = clamp((x - T.min) / T.cell, 0, T.res - 1e-3), fz = clamp((z - T.min) / T.cell, 0, T.res - 1e-3);
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * T.n + i, L = T.L;
  const a = clamp(L[k], -200, 200), b = clamp(L[k + 1], -200, 200), c = clamp(L[k + T.n], -200, 200), d = clamp(L[k + T.n + 1], -200, 200);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}
function maskAt(x, z) { const k = vIndex(x, z) * 4; return [T.mask[k] / 255, T.mask[k + 1] / 255, T.mask[k + 2] / 255, T.mask[k + 3] / 255]; }
function slopeAt(x, z) { return 1 - T.nrm[vIndex(x, z) * 3 + 1]; }
function forGrid(x0, z0, x1, z1, fn) {
  const i0 = Math.max(0, Math.floor((x0 - T.min) / T.cell)), i1 = Math.min(T.res, Math.ceil((x1 - T.min) / T.cell));
  const j0 = Math.max(0, Math.floor((z0 - T.min) / T.cell)), j1 = Math.min(T.res, Math.ceil((z1 - T.min) / T.cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * T.n + i, T.min + i * T.cell, T.min + j * T.cell);
}

// smooth polyline through control points, resampled every `step` metres
function smoothPath(ctrl, step) {
  const dense = [];
  for (let s = 0; s < ctrl.length - 1; s++) {
    const p0 = ctrl[Math.max(0, s - 1)], p1 = ctrl[s], p2 = ctrl[s + 1], p3 = ctrl[Math.min(ctrl.length - 1, s + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(ctrl[ctrl.length - 1]);
  const out = [{ x: dense[0][0], z: dense[0][1], s: 0 }];
  let acc = 0, total = 0;
  for (let i = 1; i < dense.length; i++) {
    const d = Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]); acc += d; total += d;
    if (acc >= step) { out.push({ x: dense[i][0], z: dense[i][1], s: total }); acc = 0; }
  }
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; out[i].tx = dx / l; out[i].tz = dz / l;
  }
  return out;
}
// nearest point on polyline for every grid vertex within `radius`
function nearestOnPath(pts, radius) {
  const res = new Map();
  for (let p = 0; p < pts.length - 1; p++) {
    const A = pts[p], B = pts[p + 1];
    const ex = B.x - A.x, ez = B.z - A.z, el = ex * ex + ez * ez || 1;
    forGrid(Math.min(A.x, B.x) - radius, Math.min(A.z, B.z) - radius, Math.max(A.x, B.x) + radius, Math.max(A.z, B.z) + radius, (k, x, z) => {
      const t = clamp(((x - A.x) * ex + (z - A.z) * ez) / el, 0, 1);
      const d = Math.hypot(x - (A.x + ex * t), z - (A.z + ez * t));
      if (d <= radius) { const cur = res.get(k); if (!cur || d < cur.d) res.set(k, { d, p, t }); }
    });
  }
  return res;
}

const STREAM = { upper: [], lower: [], lip: null, mouth: null, all: [] };
// exact position relative to the river: distance from the centre line, water level, width, current
function riverQuery(x, z) {
  const v = STREAM.near && STREAM.near.get(vIndex(x, z)); if (!v) return null;
  const pts = STREAM.all; let bd = 1e9, bp = 0, bt = 0;
  for (let p = Math.max(0, v.p - 4); p <= Math.min(pts.length - 2, v.p + 4); p++) {
    const A = pts[p], B = pts[p + 1], ex = B.x - A.x, ez = B.z - A.z, el = ex * ex + ez * ez || 1;
    const t = clamp(((x - A.x) * ex + (z - A.z) * ez) / el, 0, 1), d = Math.hypot(x - A.x - ex * t, z - A.z - ez * t);
    if (d < bd) { bd = d; bp = p; bt = t; }
  }
  const A = pts[bp], B = pts[bp + 1], kind = bt < 0.5 ? A.kind : B.kind;
  if (kind !== 'upper' && kind !== 'lower') return null;
  const P0 = A.S !== undefined ? A : B, P1 = B.S !== undefined ? B : A;
  const sUp = A.sUp !== undefined && B.sUp !== undefined ? lerp(A.sUp, B.sUp, bt) : 1e3;
  return { d: bd, S: lerp(P0.S, P1.S, bt), W: lerp(P0.W, P1.W, bt), D: lerp(P0.D, P1.D, bt), speed: lerp(P0.speed, P1.speed, bt), slope: lerp(P0.slope, P1.slope, bt), tx: lerp(A.tx, B.tx, bt), tz: lerp(A.tz, B.tz, bt), kind, i: bp, t: bt, sUp };
}
function riverShape(h, q) {
  if (!q) return h;
  const { d, S, W, D } = q;
  const prof = d < W ? S - D * Math.pow(1 - (d / W) * (d / W), 0.8) : S + (d - W) * 0.55;
  let out = Math.min(h, prof);
  if (S > 0.05 && d >= W && d < W + 3.5) out = Math.max(out, S + 0.3 * smoothstep(W, W + 0.6, d));
  return out;
}
function springShape(h, x, z) {
  const r = Math.hypot(x - SPRING.x, z - SPRING.z), R = SPRING.r;
  if (r > R + 3) return h;
  let out = r < R ? Math.min(h, SPRING.level - 1.4 * (1 - (r / R) * (r / R)) - 0.05) : h;
  if (r >= R - 0.1) out = Math.max(out, SPRING.level + 0.3 * smoothstep(R - 0.1, R + 0.7, r));
  return out;
}
const riverGround = (x, z, h) => springShape(riverShape(h, riverQuery(x, z)), x, z);
const TRAIL = { pts: [] };
const PLACES = {}; // named spots discovered while exploring

function carveFeatures() {
  const H = T.h;
  // 1) waterfall pool: a level basin under the cliff
  POOL.level = groundHeight(POOL.x - POOL.r * 0.9, POOL.z) - 0.25;
  forGrid(POOL.x - 40, POOL.z - 40, POOL.x + 40, POOL.z + 40, (k, x, z) => {
    const r = Math.hypot(x - POOL.x, z - POOL.z), s = cliffS(x, z);
    const w = Math.pow(1 - smoothstep(POOL.r + 2, POOL.r + 34, r), 1.5) * (1 - smoothstep(-3.5, -0.8, s));
    if (w > 0) H[k] = lerp(H[k], POOL.level + 0.55 + Math.max(0, r - POOL.r) * 0.16 + Noise.fbm(x * 0.2, z * 0.2, 2) * 0.25, w);
    if (r < POOL.r + 1.6) {
      const bowl = r < POOL.r ? POOL.level - 2.7 * (1 - (r / POOL.r) ** 2) - 0.05 : POOL.level + 0.12 + (r - POOL.r) * 0.3;
      H[k] = Math.min(H[k], bowl);
    }
  });
  // 2) the river: rises in a spring on the plateau, runs to the cliff lip (upper),
  //    drops as the falls, then leaves the pool and widens all the way to the sea (lower)
  T.hPre = T.h.slice();
  const pts = smoothPath(STREAM_CTRL, 1.5);
  for (const p of pts) p.h = groundHeight(p.x, p.z);
  const upper = [], lower = [];
  let S = Infinity;
  for (const p of pts) {
    const s = cliffS(p.x, p.z), rp = Math.hypot(p.x - POOL.x, p.z - POOL.z);
    if (s > 1.9) { S = Math.min(S, p.h - 0.45); Object.assign(p, { S, W: 2.5, D: 1.05, kind: 'upper' }); upper.push(p); }
    else if (rp <= POOL.r + 0.8) p.kind = 'pool';
    else if (p.x > POOL.x) p.kind = 'fall';
    else p.kind = 'lower';
  }
  const lowerAll = pts.filter(p => p.kind === 'lower');
  S = POOL.level;
  // pool and drop: the river holds a level for a stretch, then falls in a short cascade to the next
  // (a mountain stream, not a smooth ramp), so most of it is calm and clear and only the drops are white
  const DROP = 2.2;
  lowerAll.forEach((p, i) => {
    const f = i / Math.max(1, lowerAll.length - 1);
    S = Math.min(S, p.h - 0.55);
    let Sq = POOL.level - Math.ceil((POOL.level - S) / DROP - 1e-6) * DROP;
    if (S < 1.6) Sq = Math.min(S, Math.max(Sq, S - 0.25));     // the last run to the sea is smooth
    Object.assign(p, { S: Sq, W: lerp(3.4, 6.4, Math.pow(f, 0.8)), D: lerp(1.65, 2.3, f) }); lower.push(p);
  });
  // soften each drop over a couple of points so it's a chute, not a wall
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < lower.length - 1; i++) { const a = lower[i - 1].S, b = lower[i].S, c = lower[i + 1].S; if (a > b + 0.3 || b > c + 0.3) lower[i].S = Math.min(lower[i].S + 0.0, (a + b + c) / 3 > b ? b : (a + 2 * b + c) / 4); }
  // the mouth: the river's surface runs smoothly down to sea level where its path meets the sea and
  // carries on a little way out, so the two waters overlap and blend instead of meeting at an edge.
  // sUp = how far upstream of the coastline each point is (negative out at sea)
  {
    let mi = lower.findIndex((p, i) => i > 4 && p.h < 0.05);
    if (mi < 0) mi = lower.length - 1;
    lower[mi].sUp = 0;
    for (let i = mi - 1; i >= 0; i--) lower[i].sUp = lower[i + 1].sUp + Math.hypot(lower[i + 1].x - lower[i].x, lower[i + 1].z - lower[i].z);
    for (let i = mi + 1; i < lower.length; i++) lower[i].sUp = lower[i - 1].sUp - Math.hypot(lower[i].x - lower[i - 1].x, lower[i].z - lower[i - 1].z);
    for (const p of lower) p.S = Math.max(p.S, 0) * smoothstep(14, 50, p.sUp);   // at sea level for the last 14 m
    STREAM.mouthAt = { x: lower[mi].x, z: lower[mi].z };
  }
  for (const list of [upper, lower]) for (let i = 0; i < list.length; i++) {
    const a = list[Math.max(0, i - 1)], b = list[Math.min(list.length - 1, i + 1)];
    const run = Math.max(1, Math.hypot(b.x - a.x, b.z - a.z));
    list[i].slope = Math.max(0, a.S - b.S) / run;
    list[i].speed = clamp(0.8 + list[i].slope * 22, 0.7, 5);
  }
  // the river's mouth on the pool: the last stretch of path inside the pool becomes river too, so the
  // channel is cut through the pool's rim and the river surface starts out on the pool itself
  {
    let ci = 0, cd = 1e9; pts.forEach((p, i) => { const d = Math.hypot(p.x - POOL.x, p.z - POOL.z); if (p.kind === 'pool' && d < cd) { cd = d; ci = i; } });
    STREAM.leadIn = [];
    for (let i = ci + 1; i < pts.length && pts[i].kind === 'pool'; i++) {
      const p = pts[i], rp = Math.hypot(p.x - POOL.x, p.z - POOL.z);
      if (rp < POOL.r - 6) continue;
      Object.assign(p, { kind: 'lower', S: POOL.level, W: lower[0] ? lower[0].W : 3.4, D: lower[0] ? lower[0].D : 1.65, slope: 0, speed: 0.6, leadIn: true });
      STREAM.leadIn.push(p);
    }
    for (const p of STREAM.leadIn) { const j = pts.indexOf(p), a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)]; if (p.tx === undefined) { const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; p.tx = (b.x - a.x) / l; p.tz = (b.z - a.z) / l; } }
  }
  STREAM.upper = upper; STREAM.lower = lower; STREAM.all = pts;
  STREAM.lip = upper[upper.length - 1];
  SPRING.x = upper[0].x; SPRING.z = upper[0].z; SPRING.level = upper[0].S;
  STREAM.near = nearestOnPath(pts, 19);
  forGrid(SPRING.x - 12, SPRING.z - 12, SPRING.x + 12, SPRING.z + 12, (k) => { if (!STREAM.near.has(k)) STREAM.near.set(k, { d: 0, p: 0, t: 0 }); });
  STREAM.near.forEach((v, k) => { const x = T.min + (k % T.n) * T.cell, z = T.min + Math.floor(k / T.n) * T.cell; H[k] = riverGround(x, z, H[k]); });
  // how far the sea's waves are damped inside the river channel: not at all at the coastline, fully
  // about 40 m upstream. The ocean shader and oceanHeight() both use this, so swell runs into the
  // mouth and dies away up the river instead of stopping at a line
  T.calm = new Float32Array(T.n * T.n);
  STREAM.near.forEach((v, k) => {
    const x = T.min + (k % T.n) * T.cell, z = T.min + Math.floor(k / T.n) * T.cell, q = riverQuery(x, z);
    if (!q || q.kind !== 'lower') return;
    T.calm[k] = smoothstep(q.W + 7, q.W + 1.5, q.d) * smoothstep(-12, 16, q.sUp);
  });
  // 3) tide pools in the rock shelf of the eastern shore
  let tx = 200; while (tx < 600 && groundHeight(tx, -40) > 0.9) tx += 1;
  PLACES.tide = { x: tx - 3, z: -40, r: 30, name: 'The Tide Pools', sub: 'Eastern shore' };
  forGrid(tx - 30, -75, tx + 12, -5, (k, x, z) => {
    const r = Math.hypot((x - tx) * 1.3, z + 40);
    const w = 1 - smoothstep(14, 30, r);
    if (w > 0) H[k] = lerp(H[k], 0.45 + Noise.fbm(x * 0.15, z * 0.15, 3) * 0.35 + Math.max(0, tx - 6 - x) * 0.25, w * 0.85);
  });
  TIDEPOOLS.length = 0;
  for (let i = 0; i < 5; i++) {
    const cx = tx - 4 - rand(0, 6), cz = -40 + (i - 2) * 8 + rand(-2, 2), R = rand(2.2, 3.8);
    TIDEPOOLS.push({ x: cx, z: cz, r: R });
    forGrid(cx - R, cz - R, cx + R, cz + R, (k, x, z) => {
      const r = Math.hypot(x - cx, z - cz) / R;
      if (r < 1) H[k] = Math.min(H[k], -0.45 + 0.6 * r * r);
    });
  }
  // 4) worn trail from the beach to the summit (it crosses the river on a footbridge)
  TRAIL.pts = smoothPath(TRAIL_CTRL, 2);
  let cross = null;
  for (let i = 0; i < TRAIL.pts.length; i++) { const p = TRAIL.pts[i], q = riverQuery(p.x, p.z); if (q && q.kind === 'lower' && (!cross || q.d < cross.q.d)) cross = { p, q, i }; }
  STREAM.crossing = cross;
  TRAIL.near = nearestOnPath(TRAIL.pts, 4.5);
  TRAIL.near.forEach(({ d }, k) => { if (H[k] > 1.5) H[k] -= 0.12 * (1 - smoothstep(0.8, 2.4, d)); });
}
const TIDEPOOLS = [];

function computeNormalsAndMasks() {
  const n = T.n, H = T.h, c = T.cell;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    const hl = H[j * n + Math.max(0, i - 1)], hr = H[j * n + Math.min(n - 1, i + 1)];
    const hd = H[Math.max(0, j - 1) * n + i], hu = H[Math.min(n - 1, j + 1) * n + i];
    let nx = hl - hr, ny = 2 * c, nz = hd - hu; const l = Math.hypot(nx, ny, nz);
    T.nrm[k * 3] = nx / l; T.nrm[k * 3 + 1] = ny / l; T.nrm[k * 3 + 2] = nz / l;
  }
  const trail = TRAIL.near || new Map();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = T.min + i * c, z = T.min + j * c, h = H[k], L = T.L[k];
    const slope = 1 - T.nrm[k * 3 + 1];
    const n1 = Noise.fbm(x * 0.03, z * 0.03, 2), n2 = Noise.fbm(x * 0.011 + 4, z * 0.011, 2);
    let sand = 1 - smoothstep(2.4, 4.4, h + n1 * 1.4);
    if (h < 7) sand = Math.max(sand, 1 - smoothstep(42, 86, L + n2 * 30));
    if (h < 0.4) sand = 1;
    const rockC = rockyMask(x, z) * (1 - smoothstep(16, 42, L + n1 * 8)) * smoothstep(-2.5, 0.2, h);
    const rock = clamp(Math.max(rockC, smoothstep(0.42, 0.68, slope)), 0, 1);
    sand *= 1 - rock;
    const jungle = smoothstep(-0.12, 0.25, Noise.fbm(x * 0.006 + 11, z * 0.006 - 3, 3) + (L - 150) / 340);
    const tr = trail.get(k); const path = tr ? 1 - smoothstep(0.9, 2.6, tr.d) : 0;
    T.mask[k * 4] = sand * 255; T.mask[k * 4 + 1] = jungle * 255; T.mask[k * 4 + 2] = rock * 255; T.mask[k * 4 + 3] = path * 255;
  }
}

// coarse distance-to-shore field (for ambience volume)
const SHORE = { cell: 8, n: 0, d: null };
function computeShoreDistance() {
  const S = Math.round(T.size / SHORE.cell); SHORE.n = S;
  const d = new Float32Array(S * S).fill(1e6);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const h = groundHeight(T.min + (i + 0.5) * SHORE.cell, T.min + (j + 0.5) * SHORE.cell);
    if (h > -1.2 && h < 1.4) d[j * S + i] = 0;
  }
  const c = SHORE.cell, c2 = c * Math.SQRT2;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const k = j * S + i; let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + c);
      if (j > 0) { v = Math.min(v, d[k - S] + c); if (i > 0) v = Math.min(v, d[k - S - 1] + c2); if (i < S - 1) v = Math.min(v, d[k - S + 1] + c2); }
      d[k] = v;
    }
    for (let j = S - 1; j >= 0; j--) for (let i = S - 1; i >= 0; i--) {
      const k = j * S + i; let v = d[k];
      if (i < S - 1) v = Math.min(v, d[k + 1] + c);
      if (j < S - 1) { v = Math.min(v, d[k + S] + c); if (i < S - 1) v = Math.min(v, d[k + S + 1] + c2); if (i > 0) v = Math.min(v, d[k + S - 1] + c2); }
      d[k] = v;
    }
  }
  SHORE.d = d;
}
function shoreDistance(x, z) {
  const i = clamp(Math.floor((x - T.min) / SHORE.cell), 0, SHORE.n - 1), j = clamp(Math.floor((z - T.min) / SHORE.cell), 0, SHORE.n - 1);
  return SHORE.d[j * SHORE.n + i];
}

async function buildTerrainData(progress) {
  let cz = -250; while (cz > -700 && landRaw(-20, cz) > 0) cz -= 2;
  BAY.z = cz + 40;
  const n = T.n, c = T.cell, m = T.min, o = { L: 0 };
  for (let j = 0; j < n; j++) {
    const z = m + j * c;
    for (let i = 0; i < n; i++) { const k = j * n + i; T.h[k] = baseHeight(m + i * c, z, o); T.L[k] = o.L; }
    if ((j & 15) === 15) { progress(0.04 + 0.46 * j / n); await nextFrame(); }
  }
  carveFeatures();
  carveTrench();
  progress(0.52); await nextFrame();
  computeNormalsAndMasks();
  computeShoreDistance();
  progress(0.58); await nextFrame();
}

// one material for the coarse island and for the fine "living sand" chunks laid over it
function makeTerrainMaterial(tile) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  if (tile) { m.defines = { SAND_TILE: '' }; m.side = THREE.DoubleSide; }
  return patch(m, {
    key: tile ? 'terrainTile' : 'terrain',
    uniforms: SAND.uniforms,
    vHead: `attribute vec4 aMask; varying vec4 vMask; varying vec3 vNrmW; varying float vDig; varying float vWetS; varying float vDirt;
      #ifdef SAND_TILE
      attribute float aDig; attribute float aWetS; attribute float aDirt;
      #endif`,
    vEnd: `vMask = aMask; vNrmW = normal;
      #ifdef SAND_TILE
      vDig = aDig; vWetS = aWetS; vDirt = aDirt;
      #else
      vDig = 0.0; vWetS = 0.0; vDirt = 0.0;
      #endif`,
    fHead: /* glsl */`varying vec4 vMask; varying vec3 vNrmW; varying float vDig; varying float vWetS; varying float vDirt;
      uniform sampler2D uTileLook; uniform highp sampler2DArray uCarve; uniform vec4 uSandGrid;
      float hash12t(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float carveAt(vec2 p, out float meshFlag){
        vec2 tc = (p - uSandGrid.x) / uSandGrid.y;
        vec4 lk = texture2D(uTileLook, (floor(tc) + 0.5) / uSandGrid.z);
        meshFlag = lk.g;
        float slot = floor(lk.r * 255.0 + 0.5) - 1.0;
        return slot < 0.0 ? 0.0 : textureLod(uCarve, vec3(fract(tc), slot), 0.0).r;
      }
      // derivative bump mapping with heights in metres (Mikkelsen)
      vec3 bumpN(vec3 sp, vec3 sn, float h){
        vec3 sx = dFdx(sp), sy = dFdy(sp);
        vec3 r1 = cross(sy, sn), r2 = cross(sn, sx);
        float det = dot(sx, r1);
        vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
        return normalize(abs(det) * sn - grad);
      }`,
    fColor: /* glsl */`
      vec3 wp = vWPos;
      float meshFlag; float carve = carveAt(wp.xz, meshFlag);
      #ifndef SAND_TILE
      if (meshFlag > 0.5) discard;
      #endif
      vec4 nA = texture2D(uNoiseTex, wp.xz * 0.013);
      vec4 nB = texture2D(uNoiseTex, wp.xz * 0.071);
      vec4 nC = texture2D(uNoiseTex, wp.xz * 0.43);
      vec4 nD = texture2D(uNoiseTex, wp.xz * 1.9);
      vec4 nE = texture2D(uNoiseTex, wp.xz * 7.3);
      float camD = length(wp - cameraPosition);
      float nearF = 1.0 - smoothstep(5.0, 26.0, camD);
      // the finest layers repeat every few centimetres: show them only close up, or the repeat reads as a lattice
      float fineF = 1.0 - smoothstep(2.0, 6.5, camD), midF = 1.0 - smoothstep(5.0, 15.0, camD);
      float slope = 1.0 - clamp(vNrmW.y, 0.0, 1.0);
      float under = smoothstep(0.25, -0.7, wp.y);
      float rockW = max(vMask.b, smoothstep(0.34, 0.58, slope + (nB.r - 0.5) * 0.22));
      float sandW = max(vMask.r, under * (1.0 - rockW));
      sandW = smoothstep(0.3, 0.7, clamp(sandW + (nB.g - 0.5) * 0.55 * (1.0 - under), 0.0, 1.0));
      float dug = smoothstep(0.03, 0.22, -vDig + (nC.g - 0.5) * 0.07);   // ragged edge, not the 0.5 m grid
      sandW = max(sandW, dug * (1.0 - rockW));
      // wet sand: darkest where the last wave reached, drying as the water drains away
      float psiW = uTime / 8.5 + surfOff(wp.xz); float nW = floor(psiW); float gW = psiW - nW;
      float reach = (0.35 * surfAmpN(wp.xz, nW) + 0.03) * 0.9 + 0.04;
      float sheen = exp(-gW * 2.6);
      float tWet = smoothstep(reach + 0.06, reach - 0.06, wp.y) * (0.55 + 0.45 * sheen);
      tWet = max(tWet, smoothstep(0.85, 0.08, wp.y) * 0.55);
      float wetS = smoothstep(0.08, 0.85, vWetS + (nC.b - 0.5) * 0.32 + (nD.r - 0.5) * 0.12);
      tWet = max(tWet * (1.0 - under), max(max(uWet * 0.8, dug * 0.75), wetS * 0.95));
      // sand: patches of whiter and warmer grains, darker coarse grains, the odd shell fragment
      // warm, pale gold; drier and whiter up the beach, a little darker and richer toward the water
      vec3 cSand = mix(vec3(0.56, 0.44, 0.275), vec3(0.64, 0.535, 0.37), smoothstep(0.35, 0.7, nA.r));
      cSand = mix(cSand, vec3(0.655, 0.56, 0.40), smoothstep(1.2, 3.2, wp.y) * 0.55);
      cSand *= 0.94 + 0.12 * texture2D(uNoiseTex, wp.xz * 0.0037 + 0.5).g;
      cSand *= 0.9 + 0.14 * nB.b + 0.08 * nC.a;
      cSand *= 0.93 + 0.14 * nE.a * fineF;
      // individual grains up close: dark mineral specks, white quartz, pink shell grit
      { float gs = hash12t(floor(wp.xz * 140.0)); float gnear = 1.0 - smoothstep(1.2, 4.5, camD);
        cSand = mix(cSand, vec3(0.28, 0.25, 0.22), step(0.965, gs) * 0.7 * gnear);
        cSand = mix(cSand, vec3(0.93, 0.91, 0.86), step(0.935, gs) * (1.0 - step(0.965, gs)) * 0.6 * gnear);
        cSand = mix(cSand, vec3(0.86, 0.66, 0.6), step(0.92, gs) * (1.0 - step(0.935, gs)) * 0.5 * gnear); }
      cSand = mix(cSand, vec3(0.42, 0.36, 0.28), smoothstep(0.82, 0.95, nE.r) * 0.5 * fineF);
      float shellF;
      { vec2 sq = wp.xz * 22.0, sc = floor(sq); float sh = hash12t(sc);
        vec2 sp = fract(sq) - 0.5 - (vec2(hash12t(sc + 5.3), hash12t(sc + 9.1)) - 0.5) * 0.5;
        sp = mat2(0.8, -0.6, 0.6, 0.8) * sp * vec2(1.0, 1.0 + 1.2 * hash12t(sc + 2.2));
        shellF = step(0.985, sh) * smoothstep(0.26, 0.16, length(sp) * (1.6 + 2.0 * hash12t(sc + 1.7))) * (1.0 - under) * nearF;
        cSand = mix(cSand, mix(vec3(0.84, 0.79, 0.72), vec3(0.74, 0.56, 0.5), step(0.6, hash12t(sc + 4.4))), shellF * 0.8); }
      // grass: darker lush patches, sun-bleached ones, and bare earth showing through here and there
      vec3 cGrass = mix(vec3(0.115, 0.215, 0.05), vec3(0.25, 0.32, 0.09), nA.r) * (0.75 + 0.45 * nB.g);
      { float patchN = texture2D(uNoiseTex, wp.xz * 0.0043 + 0.21).b;
        cGrass = mix(cGrass, vec3(0.34, 0.33, 0.13), smoothstep(0.55, 0.8, patchN) * 0.55);           // dry
        cGrass = mix(cGrass, vec3(0.07, 0.16, 0.045), smoothstep(0.5, 0.2, patchN) * 0.5);           // lush
        cGrass *= 0.82 + 0.3 * nC.b + 0.12 * nD.g * midF;
        cGrass = mix(cGrass, vec3(0.24, 0.18, 0.11) * (0.8 + 0.4 * nC.r), smoothstep(0.7, 0.9, nB.a * 0.6 + nC.g * 0.5) * 0.5); }
      vec3 cJungle = mix(vec3(0.10, 0.13, 0.05), vec3(0.19, 0.16, 0.08), nB.r) * (0.8 + 0.4 * nC.g);
      // rock on steep faces is textured from the side (triplanar), so cliffs aren't smeared streaks
      vec3 an = abs(normalize(vNrmW)); an = an / (an.x + an.y + an.z);
      vec4 tX = texture2D(uNoiseTex, wp.zy * vec2(0.21, 0.33)), tZ = texture2D(uNoiseTex, wp.xy * vec2(0.21, 0.33));
      vec4 tX2 = texture2D(uNoiseTex, wp.zy * 1.1), tZ2 = texture2D(uNoiseTex, wp.xy * 1.1);
      vec4 tri = tX * an.x + tZ * an.z + nB * an.y, tri2 = tX2 * an.x + tZ2 * an.z + nC * an.y;
      float strata = sin(wp.y * 1.7 + tri.r * 6.0) * 0.5 + 0.5;
      vec3 cRock = mix(vec3(0.38, 0.35, 0.31), vec3(0.17, 0.16, 0.15), smoothstep(0.25, 0.8, tri.b)) * (0.78 + 0.34 * tri2.r) * (0.86 + 0.18 * strata);
      cRock *= 1.0 - smoothstep(0.035, 0.0, abs(tri2.g - 0.5)) * 0.4;                                  // cracks
      cRock = mix(cRock, vec3(0.1, 0.09, 0.08), smoothstep(0.6, 0.85, tri.a) * (1.0 - an.y) * 0.45);  // dark water streaks down the faces
      cRock = mix(cRock, vec3(0.15, 0.22, 0.08), smoothstep(0.55, 0.85, vNrmW.y) * smoothstep(6.0, 14.0, wp.y) * 0.6);
      vec3 cPath = vec3(0.40, 0.31, 0.21) * (0.85 + 0.3 * nC.a);
      vec3 col = mix(mix(cGrass, cJungle, vMask.g), cSand, sandW);
      col = mix(col, cPath, vMask.a * (1.0 - sandW * 0.6));
      col = mix(col, cRock, rockW);
      // the line of washed-up seaweed and twigs at the top of the waves' reach
      float wr = smoothstep(0.1, 0.0, abs(wp.y - (1.12 + (nA.r - 0.5) * 0.35))) * smoothstep(0.66, 0.8, nD.g) * smoothstep(0.35, 0.6, nC.g) * sandW * (1.0 - under);
      col = mix(col, vec3(0.16, 0.13, 0.08), wr * 0.6);
      // seagrass and reef shadow patches seen through the water
      float sgN = texture2D(uNoiseTex, wp.xz * 0.0031 + 0.37).r * 0.6 + nA.g * 0.4;
      float sg = smoothstep(0.58, 0.68, sgN) * smoothstep(1.2, 3.0, -wp.y) * (1.0 - smoothstep(9.0, 14.0, -wp.y));
      col = mix(col, vec3(0.10, 0.16, 0.06), sg * 0.75);
      // freshly dug sand is damp and darker, grooves you draw are shaded and moist
      col = mix(col, col * vec3(0.74, 0.68, 0.6), dug);
      // dirt you shovelled in: dark, crumbly earth with clods and bits of root
      float dirtK = smoothstep(0.03, 0.16, vDirt + (nC.r - 0.5) * 0.05);
      { float dk = dirtK;
        vec3 cDirt = mix(vec3(0.27, 0.19, 0.12), vec3(0.36, 0.27, 0.18), nD.g) * (0.82 + 0.3 * nE.b);
        cDirt = mix(cDirt, vec3(0.17, 0.12, 0.08), smoothstep(0.72, 0.9, nE.r) * 0.6);
        col = mix(col, cDirt, dk * (1.0 - rockW * 0.5)); sandW *= 1.0 - dk; dug *= 1.0 - dk; }
      col *= 1.0 - carve * 0.4 * sandW;
      col *= mix(vec3(1.0), mix(vec3(0.78), vec3(0.56, 0.54, 0.52), sandW), tWet);   // wet sand is much darker and a touch cooler
      col *= mix(1.0, 0.86, under);
      diffuseColor.rgb = col;
      // fine relief for the bump pass: wind ripples on dry sand, wave ripples under water, grains, carving
      vec2 rdir = vec2(0.924, 0.383);
      float warp = nA.g * 9.0 + nB.r * 3.0;
      float ph = dot(wp.xz, rdir) * 33.0 + warp * 3.0;
      float rWind = (pow(0.5 + 0.5 * sin(ph), 2.2) * 2.0 - 1.0 + 0.35 * sin(ph * 2.0 + 1.0)) * (0.6 + 0.4 * nC.b);   // ripples: a gentle windward slope and a steep lee face
      float rWave = sin(dot(wp.xz, vec2(-rdir.y, rdir.x)) * 16.0 + warp * 2.0);
      float hDetail = sandW * nearF * (rWind * 0.0022 * (1.0 - smoothstep(3.0, 13.0, camD)) * smoothstep(0.35, 0.75, nA.b) * (1.0 - tWet) * (1.0 - under) + rWave * 0.006 * under)
                    + sandW * 0.03 * (sin(wp.x * 0.23 + wp.z * 0.11) * sin(wp.z * 0.19 - wp.x * 0.07) + 0.45 * sin(wp.x * 0.51 + wp.z * 0.37 + 1.3)) * (1.0 - under) * (1.0 - smoothstep(30.0, 90.0, camD))   // low, soft dunes (smooth maths: a texture here would show its texels as facets)
                    + (tri2.r * 0.09 + strata * 0.04) * rockW * (1.0 - an.y) * (1.0 - smoothstep(10.0, 60.0, camD))
                    + (nD.a * 0.004 * midF + nE.a * 0.0015 * fineF + texture2D(uNoiseTex, wp.xz * 21.0).a * 0.0009 * (1.0 - smoothstep(1.5, 4.0, camD))) * (1.0 - rockW * 0.5) + nC.r * 0.02 * rockW * nearF
                    - carve * 0.065 + dirtK * (nD.a * 0.022 * midF + nE.a * 0.009 * fineF);
    `,
    fRough: 'roughnessFactor = mix(mix(0.96, 0.86, rockW), 0.2, tWet * (0.45 + 0.55 * sheen));',
    fNormal: 'normal = bumpN(-vViewPosition, normal, hDetail);',
    fLight: /* glsl */`
      {
        vec3 Vw = normalize(cameraPosition - vWPos);
        vec3 Nw = normalize(vNrmW);
        // grains of sand catching the sun
        // (the grid of grains grows with distance, so a glint is never smaller than a pixel and they don't shimmer into patterns)
        float gLod = exp2(floor(log2(max(camD * 0.45, 1.0))));
        vec2 gc = floor(vWPos.xz * 70.0 / gLod);
        float gl = step(0.9935, hash12t(gc + gLod)) * sandW * (1.0 - tWet) * (1.0 - under) * (1.0 - smoothstep(6.0, 34.0, camD)) / sqrt(gLod);
        vec3 gn = normalize(Nw + vec3(hash12t(gc + 3.1) - 0.5, 0.0, hash12t(gc + 7.7) - 0.5) * 0.7);
        outgoingLight += uSunLin * gl * pow(max(dot(reflect(-Vw, gn), uLightDir), 0.0), 40.0) * 1.8;
        // wet sand mirrors the sky as the water drains away
        float fr = 0.03 + 0.97 * pow(1.0 - max(dot(Nw, Vw), 0.0), 5.0);
        vec3 sk = pow(skyHaze(reflect(-Vw, Nw)), vec3(2.2)); sk = mix(sk, vec3(dot(sk, vec3(0.3, 0.55, 0.15))), 0.45);
        outgoingLight += sk * fr * tWet * (0.3 + 0.7 * sheen) * 0.75 * sandW * (1.0 - under);
      }`,
  });
}
function buildTerrainMesh() {
  const n = T.n, c = T.cell;
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; pos[k * 3] = T.min + i * c; pos[k * 3 + 1] = T.h[k]; pos[k * 3 + 2] = T.min + j * c;
  }
  // full detail where it can be seen; deep seabed (under opaque water) is meshed in 8×8 blocks
  const B = 8, idx = new Uint32Array(T.res * T.res * 6); let q = 0;
  const quad = (a, b, cc, d) => { idx[q++] = a; idx[q++] = cc; idx[q++] = b; idx[q++] = b; idx[q++] = cc; idx[q++] = d; };
  for (let bj = 0; bj < T.res; bj += B) for (let bi = 0; bi < T.res; bi += B) {
    const j1 = Math.min(T.res, bj + B), i1 = Math.min(T.res, bi + B);
    let deep = true;
    for (let j = Math.max(0, bj - 1); j <= Math.min(T.res, j1 + 1) && deep; j++) for (let i = Math.max(0, bi - 1); i <= Math.min(T.res, i1 + 1); i++) if (T.h[j * n + i] > -16 || T.h[j * n + i] < -47) { deep = false; break; }
    if (deep) quad(bj * n + bi, bj * n + i1, j1 * n + bi, j1 * n + i1);
    else for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) { const a = j * n + i; quad(a, a + 1, a + n, a + n + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(T.nrm, 3));
  geo.setAttribute('aMask', new THREE.BufferAttribute(T.mask, 4, true));
  geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1));
  geo.computeBoundingSphere();
  const mat = makeTerrainMaterial(false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.name = 'Island'; T.mesh = mesh;
  scene.add(mesh);
  // deep seabed beyond the island tile
  const far = new THREE.Mesh(farFloorGeometry(),
    patch(new THREE.MeshLambertMaterial({ color: 0x1b3a40 }), { key: 'seabed', fColor: `if (abs(vWPos.x - ${(T.min + T.size / 2).toFixed(1)}) < ${(T.size / 2 - 1).toFixed(1)} && abs(vWPos.z - ${(T.min + T.size / 2).toFixed(1)}) < ${(T.size / 2 - 1).toFixed(1)}) discard;` }));
  far.receiveShadow = false; scene.add(far);
  // height texture for water depth, foam and shore waves
  // r: height, g: distance from the coast, b: how calm the river channel keeps the sea's waves
  const hd = new Uint16Array(n * n * 4), h0 = THREE.DataUtils.toHalfFloat(0);
  for (let i = 0; i < n * n; i++) { hd[i * 4] = THREE.DataUtils.toHalfFloat(T.h[i]); hd[i * 4 + 1] = THREE.DataUtils.toHalfFloat(clamp(T.L[i], -200, 200)); hd[i * 4 + 2] = THREE.DataUtils.toHalfFloat(T.calm ? T.calm[i] : 0); hd[i * 4 + 3] = h0; }
  const ht = new THREE.DataTexture(hd, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
  ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.wrapS = ht.wrapT = THREE.ClampToEdgeWrapping; ht.needsUpdate = true;
  U.uHeightTex.value = ht;
  U.uTerrainRect.value.set(T.min, T.min, 1 / (T.cell * n), 0.5 / n);
  buildFarTexture();
  return mesh;
}
