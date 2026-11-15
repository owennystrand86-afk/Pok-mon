
// ───────────────────────────── 9. Geometry helpers ─────────────────────────────
function prep(g, color = [1, 1, 1], attrs = {}, jitter = 0) {
  if (g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const j = 1 + (rng() - 0.5) * jitter; col[i * 3] = color[0] * j; col[i * 3 + 1] = color[1] * j; col[i * 3 + 2] = color[2] * j; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const [name, val] of Object.entries(attrs)) {
    const v = Array.isArray(val) ? val : [val]; const arr = new Float32Array(n * v.length);
    for (let i = 0; i < n; i++) arr.set(v, i * v.length);
    g.setAttribute(name, new THREE.BufferAttribute(arr, v.length));
  }
  return g;
}
function mergeGeos(list) {
  const geos = list.map(g => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geos[0].attributes)) {
    const size = geos[0].attributes[name].itemSize;
    let total = 0; for (const g of geos) total += g.attributes[name].count * size;
    const arr = new Float32Array(total); let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
function mtx(x, y, z, ry = 0, s = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return _m4.compose(_v.set(x, y, z), _q, _s.set(s, s, s));
}
function mtxAlign(x, y, z, ry, s, normal, tilt = 1) {
  _q.setFromUnitVectors(_up, _n.copy(_up).lerp(normal, tilt).normalize());
  const qy = new THREE.Quaternion().setFromAxisAngle(_up, ry);
  _q.multiply(qy);
  return _m4.compose(_v.set(x, y, z), _q, _s.set(s, s, s));
}

// spatial hash for spacing checks and colliders
class SpatialHash {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(x, z) { return Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663; }
  add(x, z, item) { const k = this.key(x, z); let a = this.map.get(k); if (!a) this.map.set(k, a = []); a.push(item); }
  query(x, z, r, fn) {
    const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const a = this.map.get(i * 73856093 ^ j * 19349663); if (a) for (const it of a) if (fn(it) === false) return false; }
    return true;
  }
  free(x, z, r) { return this.query(x, z, r, it => (Math.hypot(it.x - x, it.z - z) < Math.max(r, it.r || 0) ? false : true)); }
}
const COLLIDERS = new SpatialHash(12);
function addCollider(x, z, r, top = 99, kind = 'solid') { COLLIDERS.add(x, z, { x, z, r, top, kind }); }
const OCCUPIED = new SpatialHash(8);      // keeps big things from overlapping
const EXCLUDE = [];                        // circles where nothing natural grows
const excluded = (x, z, pad = 0) => EXCLUDE.some(e => Math.hypot(x - e.x, z - e.z) < e.r + pad);
// in the river, a pool, the spring or any other water (with a margin of dry bank around it)
function inWater(x, z, margin = 0) {
  const q = riverQuery(x, z);
  if (q && q.S > 0.04 && q.d < q.W + margin) return true;
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 1.5 + margin || Math.hypot(x - SPRING.x, z - SPRING.z) < SPRING.r + 0.8 + margin) return true;
  return waterAt(x, z).level > groundHeight(x, z) - 0.1 - margin * 0.1;
}
function nearTrail(x, z, d) { const v = TRAIL.near && TRAIL.near.get(vIndex(x, z)); return !!v && v.d < d; }
function nearStream(x, z, d) {
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + d) return true;
  const v = STREAM.near && STREAM.near.get(vIndex(x, z)); return !!v && v.d < d;
}

// ───────────────────── 10. Instanced, chunked vegetation fields ─────────────────────
const FIELDS = [];
class Field {
  constructor(name, geo, mat, o = {}) {
    this.name = name; this.geo = geo; this.mat = mat;
    this.o = Object.assign({ chunk: 150, far: Infinity, cast: false, receive: true, attrs: {}, depth: null, pad: 6, density: true }, o);
    this.items = []; this.chunks = []; FIELDS.push(this);
  }
  add(m, a = {}, c = null) { this.items.push({ m: m.clone(), a, c: c ? c.clone() : null }); }
  build() {
    const groups = new Map();
    for (const it of this.items) {
      const key = Math.floor(it.m.elements[12] / this.o.chunk) + ',' + Math.floor(it.m.elements[14] / this.o.chunk);
      let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(it);
    }
    for (const list of groups.values()) {
      shuffle(list);
      const mk = base => { const q = new THREE.BufferGeometry(); for (const [n, a] of Object.entries(base.attributes)) q.setAttribute(n, a); if (base.index) q.setIndex(base.index); return q; };
      const g = mk(this.geo), gLo = this.o.lod ? mk(this.o.lod.geo) : null;
      for (const [name, size] of Object.entries(this.o.attrs)) {
        const arr = new Float32Array(list.length * size);
        list.forEach((it, i) => arr.set(it.a[name] || new Array(size).fill(0), i * size));
        const attr = new THREE.InstancedBufferAttribute(arr, size);
        g.setAttribute(name, attr); if (gLo) gLo.setAttribute(name, attr);
      }
      const mesh = new THREE.InstancedMesh(g, this.mat, list.length);
      let cx = 0, cz = 0, y0 = Infinity, y1 = -Infinity;
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m); if (it.c) mesh.setColorAt(i, it.c);
        if (it.a && it.a.id !== undefined) (this.byId || (this.byId = new Map())).set(it.a.id, { mesh, i, m: it.m });
        const e = it.m.elements; cx += e[12]; cz += e[14]; y0 = Math.min(y0, e[13]); y1 = Math.max(y1, e[13]);
      });
      cx /= list.length; cz /= list.length;
      let r = 0; for (const it of list) r = Math.max(r, Math.hypot(it.m.elements[12] - cx, it.m.elements[14] - cz));
      const pad = this.o.pad;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, (y0 + y1) / 2 + pad * 0.5, cz), Math.hypot(r + pad, (y1 - y0) / 2 + pad));
      mesh.castShadow = this.o.cast; mesh.receiveShadow = this.o.receive;
      if (this.o.depth) mesh.customDepthMaterial = this.o.depth;
      mesh.name = this.name; scene.add(mesh);
      this.chunks.push({ mesh, n: list.length, cx, cz, r, gHi: g, gLo });
    }
    this.items = null;
  }
  setDensity(f) { if (!this.o.density) return; for (const c of this.chunks) c.mesh.count = Math.round(c.n * clamp(f, 0, 1)); }
  update(cam) {
    const far = this.o.far * (this.o.farScale || 1), lod = this.o.lod ? this.o.lod.dist * (Q.near / 90) : 0;
    if (far === Infinity && !lod) return;
    for (const c of this.chunks) {
      const d = Math.hypot(c.cx - cam.x, c.cz - cam.z) - c.r;
      if (far !== Infinity) c.mesh.visible = c.mesh.count > 0 && d < far;
      if (c.gLo) { const want = d > lod ? c.gLo : c.gHi; if (c.mesh.geometry !== want) c.mesh.geometry = want; }
    }
  }
}

// ───────────────────── 11. Foliage textures (drawn on canvas) ─────────────────────
function leafPath(g, len, wid) {
  g.beginPath(); g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.45, -wid, len, 0); g.quadraticCurveTo(len * 0.45, wid, 0, 0); g.closePath();
}
function makeFrondTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    for (let half = 0; half < 2; half++) {
      const ox = half * 256, cx = ox + 128, dead = half === 1;
      const N = 46;
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1), y = h - 10 - t * (h - 22);
        const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02 + 0.03)), 0.65);
        for (const side of [-1, 1]) {
          const len = 124 * env * (0.86 + rng() * 0.18), wid = 4.2 + 3.6 * env;
          const ang = side > 0 ? -0.62 - rng() * 0.12 : Math.PI + 0.62 + rng() * 0.12;
          g.save(); g.translate(cx, y); g.rotate(ang); leafPath(g, len, wid);
          const l = dead ? 34 + rng() * 14 : 27 + rng() * 15 + t * 5;
          g.fillStyle = dead ? hsl(30 + rng() * 10, 38 + rng() * 15, l) : hsl(86 + rng() * 26, 42 + rng() * 18, l);
          g.fill(); g.restore();
        }
      }
      g.strokeStyle = dead ? hsl(30, 35, 30) : hsl(80, 35, 26); g.lineCap = 'round';
      for (let s = 0; s < 3; s++) { g.lineWidth = 6 - s * 2; g.beginPath(); g.moveTo(cx, h - 2); g.lineTo(cx, 6 + s * 120); g.stroke(); }
    }
  });
}
function makeLeafClusterTexture(hueBase = 100) {
  return canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 92;
      const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
      g.save(); g.translate(x, y); g.rotate(rng() * TAU);
      const len = 34 + rng() * 26, wid = 9 + rng() * 8; leafPath(g, len, wid);
      g.fillStyle = hsl(hueBase + rng() * 24 - 10, 38 + rng() * 22, 23 + rng() * 19); g.fill();
      g.strokeStyle = hsl(hueBase, 30, 36, 0.55); g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, 0); g.lineTo(len * 0.9, 0); g.stroke();
      g.restore();
    }
  });
}
function makeGrassTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x0 = 14 + rng() * (w - 28), lean = (rng() - 0.5) * 70, hh = h * (0.55 + rng() * 0.44), bw = 2.5 + rng() * 3;
      const grad = g.createLinearGradient(0, h, 0, h - hh);
      const hue = 70 + rng() * 30;
      grad.addColorStop(0, hsl(hue, 45, 22)); grad.addColorStop(1, hsl(hue - 10, 50, 52));
      g.fillStyle = grad; g.beginPath(); g.moveTo(x0 - bw, h);
      g.quadraticCurveTo(x0 + lean * 0.3, h - hh * 0.6, x0 + lean, h - hh); g.quadraticCurveTo(x0 + lean * 0.3 + bw * 0.5, h - hh * 0.6, x0 + bw, h); g.fill();
    }
  });
}
function makeFernTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    const cx = w / 2;
    for (let k = 0; k < 34; k++) {
      const t = k / 33, y = h - 6 - t * (h - 14), env = Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05));
      for (const side of [-1, 1]) {
        g.save(); g.translate(cx, y); g.rotate(side > 0 ? -0.35 : Math.PI + 0.35);
        leafPath(g, 58 * env + 4, 4 + 2 * env); g.fillStyle = hsl(98 + rng() * 18, 45 + rng() * 15, 27 + rng() * 14); g.fill(); g.restore();
      }
    }
    g.strokeStyle = hsl(85, 35, 22); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, 8); g.stroke();
  });
}
function makeBigLeafTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.beginPath(); g.moveTo(w / 2, h - 4);
    g.bezierCurveTo(w * 1.05, h * 0.75, w * 0.95, h * 0.1, w / 2, 4);
    g.bezierCurveTo(w * 0.05, h * 0.1, -w * 0.05, h * 0.75, w / 2, h - 4);
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, hsl(105, 52, 36)); gr.addColorStop(1, hsl(118, 48, 26));
    g.fillStyle = gr; g.fill();
    g.strokeStyle = hsl(95, 40, 48, 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h - 4); g.lineTo(w / 2, 8); g.stroke();
    g.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const y = h - 4 - i * 14; g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w * 0.75, y - 6, w * 0.92, y - 16); g.moveTo(w / 2, y); g.quadraticCurveTo(w * 0.25, y - 6, w * 0.08, y - 16); g.stroke(); }
  });
}
function makeFlowerTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.translate(w / 2, h / 2);
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(i * TAU / 5); g.beginPath(); g.ellipse(0, -13, 9, 14, 0, 0, TAU);
      const gr = g.createRadialGradient(0, -4, 1, 0, -12, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(235,235,235,1)');
      g.fillStyle = gr; g.fill(); g.restore();
    }
    g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fillStyle = 'rgb(120,40,40)'; g.fill();
    g.strokeStyle = 'rgb(255,230,120)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(4, -12); g.stroke();
  });
}
function makeDeadLeafTexture() {
  return canvasTex(64, 128, (g, w, h) => {
    g.translate(w / 2, h - 4); g.rotate(-Math.PI / 2); leafPath(g, h - 10, 20);
    g.fillStyle = hsl(32, 45, 36); g.fill(); g.strokeStyle = hsl(28, 40, 24); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(h - 12, 0); g.stroke();
  });
}

// ───────────────────── 12. Plant geometry ─────────────────────
const WIND_HEAD = /* glsl */`
vec3 windLocal(){
#ifdef USE_INSTANCING
  vec3 w = transpose(mat3(instanceMatrix)) * vec3(uWindDir.x, 0.0, uWindDir.y);
  return normalize(vec3(w.x, 0.0, w.z) + vec3(1e-5));
#else
  return vec3(uWindDir.x, 0.0, uWindDir.y);
#endif
}
vec3 instPos(){
#ifdef USE_INSTANCING
  return instanceMatrix[3].xyz;
#else
  return vec3(0.0);
#endif
}
float gustAt(vec3 ip, float ph){ return 0.55 + 0.45 * sin(uTime * 0.63 + ip.x * 0.021 + ip.z * 0.017) * sin(uTime * 0.29 + ph * 3.0); }
// plants a tsunami has flattened lie over in the direction the water ran
vec3 knockDown(vec3 p, vec3 ip){
  float d = flattenedAt(ip);
  if (d <= 0.004) return p;
#ifdef USE_INSTANCING
  vec3 wl = transpose(mat3(instanceMatrix)) * vec3(uTsuDir.x, 0.0, uTsuDir.y);
#else
  vec3 wl = vec3(uTsuDir.x, 0.0, uTsuDir.y);
#endif
  wl = normalize(vec3(wl.x, 0.0, wl.z) + vec3(1e-5));
  vec3 ax = normalize(cross(vec3(0.0, 1.0, 0.0), wl));
  float ang = d * (1.35 + 0.15 * sin(ip.x * 1.7 + ip.z)), c = cos(ang), s = sin(ang);
  return p * c + cross(ax, p) * s + ax * dot(ax, p) * (1.0 - c);
}
`;
const PALM_SWAY = /* glsl */`
  float H = aPalm.x, lean = aPalm.y, ph = aPalm.z;
  vec3 ip = instPos(); vec3 wl = windLocal(); float gust = gustAt(ip, ph);
  float sway = uWind * (0.022 + 0.05 * gust) * (1.0 + 0.6 * sin(uTime * (0.85 + ph * 0.35) + ph * 6.28)) + uWind * uWind * 0.022;
`;
const PALM_TRUNK_VS = PALM_SWAY + /* glsl */`
  float yN = aC > 0.5 ? 1.0 : transformed.y;
  if (aC > 0.5) transformed += vec3(lean * H, H, 0.0);
  else { transformed.y *= H; transformed.x += lean * H * pow(yN, 1.6); }
  transformed += wl * sway * H * yN * yN;
  transformed = knockDown(transformed, ip);
`;
const PALM_CROWN_VS = PALM_SWAY + /* glsl */`
  float ft = aFrond.x;
  transformed.y -= aPalm.w * ft * ft * 0.9;
  float fl = sin(uTime * (1.6 + uWind * 1.3) + ph * 9.0 + aFrond.y * 6.28) * (0.13 + 0.22 * gust) * uWind * ft;
  transformed.y += fl;
  transformed += wl * (fl * 0.8 + uWind * (0.15 + gust * 0.42) * ft * ft);
  // individual leaflets flicker along each frond
  float side = (fract(uv.x * 2.0) - 0.25) * 4.0;
  transformed.y += side * sin(uTime * 7.5 + ph * 13.0 + ft * 7.0 + aFrond.y * 9.0) * 0.07 * uWind * ft * (0.5 + gust);
  transformed += vec3(lean * H, H, 0.0) + wl * sway * H;
  transformed = knockDown(transformed, ip);
`;
function palmTrunkGeometry(lo = false) {
  const M = lo ? 9 : 16, S = lo ? 5 : 7, pos = [], nor = [], col = [], aC = [], idx = [];
  for (let i = 0; i <= M; i++) {
    const y = i / M;
    const ring = Math.pow(Math.abs(Math.sin(y * Math.PI * 30)), 5);
    const r = lerp(0.25, 0.145, Math.pow(y, 0.7)) * (1 + 0.06 * ring) * (1 + 0.5 * Math.exp(-y * 28));
    const shade = 0.82 + 0.18 * (1 - ring) + (rng() - 0.5) * 0.05;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * TAU;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r); nor.push(Math.cos(a), 0.1, Math.sin(a));
      const tone = y > 0.92 ? [0.30, 0.27, 0.16] : [0.46, 0.40, 0.33];
      col.push(tone[0] * shade, tone[1] * shade, tone[2] * shade); aC.push(0);
    }
  }
  for (let i = 0; i < M; i++) for (let j = 0; j < S; j++) {
    const a = i * S + j, b = i * S + ((j + 1) % S), c = a + S, d = b + S; idx.push(a, c, b, b, c, d);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 1));
  g.setIndex(idx);
  g = g.toNonIndexed();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const parts = [g];
  for (let k = 0; k < (lo ? 2 : 5); k++) {
    const a = k / 5 * TAU + rand(-0.3, 0.3);
    const cn = new THREE.IcosahedronGeometry(rand(0.11, 0.15), 0).translate(Math.cos(a) * 0.2, rand(-0.22, -0.06), Math.sin(a) * 0.2);
    parts.push(prep(cn, k < 2 ? [0.33, 0.36, 0.12] : [0.32, 0.22, 0.10], { aC: 1 }, 0.1));
  }
  // keep attribute sets identical before merging
  for (const p of parts) for (const nm of ['position', 'normal', 'color', 'aC', 'uv']) if (!p.attributes[nm]) throw new Error('palm attr ' + nm);
  return mergeGeos(parts.map(p => { const q = new THREE.BufferGeometry(); for (const nm of ['position', 'normal', 'color', 'aC', 'uv']) q.setAttribute(nm, p.attributes[nm]); return q; }));
}
function palmFronds() {
  const N = 16, fronds = [];
  for (let f = 0; f < N; f++) fronds.push({ phi: (f / N) * TAU + rand(-0.15, 0.15), el: rand(0.05, 0.85), len: rand(3.3, 4.5), droop: rand(0.12, 0.2), w: rand(0.8, 1.05), dead: false, rnd: rng() });
  for (let f = 0; f < 3; f++) fronds.push({ phi: rand(0, TAU), el: rand(-1.1, -0.7), len: rand(2.2, 2.8), droop: 0.05, w: 0.55, dead: true, rnd: rng() });
  return fronds;
}
function palmCrownGeometry(allFronds, lo = false) {
  const pos = [], uv = [], fr = [], idx = [];
  let base = 0;
  const fronds = lo ? allFronds.filter((F, i) => (F.dead ? i === allFronds.length - 1 : i % 2 === 0)).map(F => ({ ...F, w: F.w * 1.3 })) : allFronds;
  for (const F of fronds) {
    const segs = lo ? 4 : 7, cphi = Math.cos(F.phi), sphi = Math.sin(F.phi), rnd = F.rnd;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, s = t * F.len;
      const hx = s * Math.cos(F.el), hy = s * Math.sin(F.el) - F.droop * s * s;
      const w = F.w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), 0.7) * (1 - 0.25 * t);
      const cx = cphi * (hx + 0.12), cz = sphi * (hx + 0.12), cy = hy;
      const sx = -sphi, sz = cphi, fold = 0.32 * w;
      const u0 = F.dead ? 0.5 : 0;
      pos.push(cx + sx * w, cy + fold, cz + sz * w, cx, cy, cz, cx - sx * w, cy + fold, cz - sz * w);
      uv.push(u0, t, u0 + 0.25, t, u0 + 0.5, t);
      for (let k = 0; k < 3; k++) fr.push(t, rnd);
      if (i > 0) {
        const a = base + (i - 1) * 3;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
    }
    base += (segs + 1) * 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aFrond', new THREE.Float32BufferAttribute(fr, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) { _v.set(n.getX(i), Math.abs(n.getY(i)) + 0.8, n.getZ(i)).normalize(); n.setXYZ(i, _v.x, _v.y, _v.z); }
  return g;
}
function cardCluster(count, radius, center, size, opts = {}) {
  // leaf cards scattered over a sphere, normals pointing outward for soft canopy lighting
  const parts = [];
  for (let i = 0; i < count; i++) {
    const p = new THREE.PlaneGeometry(size * rand(0.8, 1.2), size * rand(0.8, 1.2));
    _e.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); p.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(_e));
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.4, 1) * (opts.flat || 1), rand(-1, 1)).normalize().multiplyScalar(radius * Math.cbrt(rng()));
    p.translate(center.x + dir.x, center.y + dir.y, center.z + dir.z);
    const nn = p.attributes.normal, pp = p.attributes.position;
    for (let k = 0; k < nn.count; k++) { _v.set(pp.getX(k) - center.x, (pp.getY(k) - center.y) * 0.7 + radius * 0.4, pp.getZ(k) - center.z).normalize(); nn.setXYZ(k, _v.x, _v.y, _v.z); }
    parts.push(prep(p, [1, 1, 1], opts.attrs || {}));
  }
  return parts;
}
function treeGeometries() {
  // trunk + branches (bark) and canopy (leaf cards) for a 10 m tropical hardwood
  const bark = [], leaves = [];
  const trunkH = 6.5;
  const trunk = new THREE.CylinderGeometry(0.2, 0.42, trunkH, 8, 6).translate(0, trunkH / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 0.6) * 0.25); }
  bark.push(prep(trunk, [0.36, 0.30, 0.24], { aY: 0 }, 0.12));
  const tops = [];
  for (let b = 0; b < 4; b++) {
    const a = b / 4 * TAU + rand(-0.4, 0.4), len = rand(2.4, 3.4), up = rand(0.55, 0.9);
    const br = new THREE.CylinderGeometry(0.07, 0.15, len, 6).translate(0, len / 2, 0);
    br.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -a, -Math.acos(up) * 1.1)));
    const y0 = trunkH * rand(0.62, 0.95); br.translate(Math.sin(y0 * 0.6) * 0.25, y0, 0);
    bark.push(prep(br, [0.34, 0.29, 0.23], { aY: 0 }, 0.1));
    const dirv = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up));
    tops.push(new THREE.Vector3(Math.sin(y0 * 0.6) * 0.25, y0, 0).addScaledVector(dirv, len));
  }
  tops.push(new THREE.Vector3(0.1, trunkH + 1.2, 0));
  for (const t of tops) leaves.push(...cardCluster(9, 1.9, t, 2.6, { attrs: { aY: 1 } }));
  const leavesLo = [];
  for (const t of tops) leavesLo.push(...cardCluster(4, 1.5, t, 3.3, { attrs: { aY: 1 } }));
  const trunkLo = new THREE.CylinderGeometry(0.22, 0.42, trunkH + 0.8, 5, 2).translate(0.1, (trunkH + 0.8) / 2, 0);
  // hanging vines
  for (let v = 0; v < 3; v++) {
    const t = pick(tops), len = rand(2.5, 4.5);
    const pl = new THREE.PlaneGeometry(0.5, len, 1, 4).translate(t.x + rand(-1, 1), t.y - len / 2 - 0.4, t.z + rand(-1, 1));
    pl.rotateY(rand(0, TAU));
    leaves.push(prep(pl, [0.75, 0.9, 0.7], { aY: 1 }));
  }
  return { bark: mergeGeos(bark), leaves: mergeGeos(leaves), barkLo: mergeGeos([prep(trunkLo, [0.35, 0.29, 0.23], { aY: 0 }, 0.1)]), leavesLo: mergeGeos(leavesLo) };
}
function bushGeometry() { return mergeGeos(cardCluster(11, 0.7, new THREE.Vector3(0, 0.75, 0), 1.25, { attrs: { aY: 1 }, flat: 0.7 })); }
function frondFan(count, len, droop, texU = [0, 1], tilt = [0.5, 1.1]) {
  const parts = [];
  for (let f = 0; f < count; f++) {
    const phi = f / count * TAU + rand(-0.2, 0.2), el = rand(tilt[0], tilt[1]), L = len * rand(0.75, 1.1), segs = 5;
    const pos = [], uv = [], idx = [], fa = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, s = t * L, hx = s * Math.cos(el), hy = s * Math.sin(el) - droop * s * s;
      const w = 0.16 * L * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05));
      const cx = Math.cos(phi) * hx, cz = Math.sin(phi) * hx, sx = -Math.sin(phi), sz = Math.cos(phi);
      pos.push(cx + sx * w, hy + w * 0.2, cz + sz * w, cx - sx * w, hy + w * 0.2, cz - sz * w);
      uv.push(texU[0], t, texU[1], t); fa.push(t, t);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aY', new THREE.Float32BufferAttribute(fa, 1));
    g.setIndex(idx); g.computeVertexNormals();
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.4, 1, n.getZ(i) * 0.4);
    parts.push(prep(g));
  }
  return mergeGeos(parts);
}
// a clump of individual blades: each one a tapered, curving strip, dark at the root and pale at the tip
function grassGeometry(blades = 16, segs = 4, indexed = false) {
  const pos = [], nor = [], col = [], uv = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = rand(0, TAU), r = Math.sqrt(rng()) * 0.32, h = rand(0.32, 0.78), w = rand(0.022, 0.04), lean = rand(0.15, 0.55);
    const bx0 = Math.cos(a) * r, bz0 = Math.sin(a) * r, face = a + rand(-0.6, 0.6), dx = Math.cos(face), dz = Math.sin(face);
    const sx = -dz, sz = dx;                      // across the blade
    const base = pos.length / 3;
    const tint = rand(0.85, 1.12), dry = rng() < 0.18 ? 1 : 0;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, y = h * t, out = lean * h * t * t;
      const cx = bx0 + dx * out, cz = bz0 + dz * out;
      const ww = w * (1 - t * t) * (s === segs ? 0 : 1);
      for (const side of [-1, 1]) {
        pos.push(cx + sx * ww * side, y, cz + sz * ww * side);
        // normals mostly up, a little toward the blade's face, so grass lights softly
        const nx = dx * 0.35, nz = dz * 0.35; const l = Math.hypot(nx, 0.94, nz); nor.push(nx / l, 0.94 / l, nz / l);
        const g = [lerp(0.12, 0.55, t), lerp(0.24, 0.66, t), lerp(0.05, 0.2, t)].map(v => v * tint);
        if (dry) { g[0] = lerp(g[0], 0.62, 0.6); g[1] = lerp(g[1], 0.55, 0.5); g[2] = lerp(g[2], 0.3, 0.5); }
        col.push(...g); uv.push(0.5, 0.5);
      }
      if (s < segs) { const i0 = base + s * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return indexed ? g : g.toNonIndexed();
}
function bigLeafPlantGeometry() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + rand(-0.3, 0.3), h = rand(0.7, 1.3), size = rand(0.9, 1.3);
    const stem = new THREE.CylinderGeometry(0.02, 0.035, h, 4).translate(0, h / 2, 0).rotateZ(-0.25).rotateY(-a);
    const sx = Math.cos(a) * Math.sin(0.25) * h, sz = Math.sin(a) * Math.sin(0.25) * h;
    const st = prep(stem, [0.25, 0.45, 0.15], { aY: 0 }); st.attributes.uv.array.fill(0.5); parts.push(st);
    const leaf = new THREE.PlaneGeometry(size * 0.85, size).translate(0, size / 2, 0).rotateX(-1.0).rotateY(-a + Math.PI / 2).translate(sx, h * 0.97, sz);
    // map the leaf texture: uv already 0..1 on the plane
    parts.push(prep(leaf, [1, 1, 1], { aY: 1 }));
  }
  // separate stems from leaves: all use the leaf texture; stems sample the leaf's midrib (u 0.5)
  const g = mergeGeos(parts);
  return g;
}
function flowerGeometry() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.PlaneGeometry(0.28, 0.28).rotateX(-Math.PI / 2 + rand(-0.5, 0.5)).rotateY(rand(0, TAU)).translate(rand(-0.35, 0.35), rand(0.0, 0.3), rand(-0.35, 0.35));
    const n = p.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
    parts.push(prep(p, [1, 1, 1], { aY: 1 }));
  }
  return mergeGeos(parts);
}

// ───────────────────── 13. Planting the island ─────────────────────
const VEG = {};
function foliageMat(map, key, o = {}) {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest: o.alphaTest ?? 0.42, side: THREE.DoubleSide, vertexColors: !!o.vertexColors });
  if (!isMobile && o.a2c !== false) m.alphaToCoverage = true;
  if (o.fade && o.uniforms) FADE_SETS.push({ u: o.uniforms, mul: o.fadeMul || 1 });
  return patch(m, { key, vHead: (o.vHead || '') + WIND_HEAD + '', vBegin: o.vBegin, fHead: o.fade ? FADE_HEAD : '', fade: !!o.fade, uniforms: o.uniforms, fog: o.fog, fMap: ALPHA_MIP_FIX, fLight: LEAF_GLOW });
}
// sunlight shining through leaves when you look toward the sun
const LEAF_GLOW = /* glsl */`
  { vec3 Vw = normalize(cameraPosition - vWPos);
    float back = pow(max(dot(-Vw, uLightDir), 0.0), 3.0);
    outgoingLight += diffuseColor.rgb * vec3(1.0, 1.05, 0.7) * uSunLin * back * 0.32; }
`;
// keep thin leaves from dissolving in distant mip levels
const ALPHA_MIP_FIX = /* glsl */`
#ifdef USE_MAP
  { vec2 mdx = dFdx(vMapUv * 512.0), mdy = dFdy(vMapUv * 512.0);
    float mip = max(0.0, 0.5 * log2(max(dot(mdx, mdx), dot(mdy, mdy))));
    diffuseColor.a = clamp(diffuseColor.a * (1.0 + mip * 0.3), 0.0, 1.0); }
#endif
`;
const SWAY_SMALL = (amp, freq) => /* glsl */`
  { vec3 ip = instPos(); vec3 wl = windLocal(); float ph = ip.x * 0.37 + ip.z * 0.23;
    float gust = gustAt(ip, ph);
    float k = aY * clamp(transformed.y, 0.0, 2.0) * 0.8;
    float s = sin(uTime * ${freq.toFixed(2)} * (0.8 + 0.4 * gust) + ph + transformed.x * 1.3) * ${amp.toFixed(3)} * uWind * k;
    transformed += wl * (s + uWind * gust * ${(amp * 0.6).toFixed(3)} * k);
    transformed.y += s * 0.25;
    transformed = knockDown(transformed, ip); }
`;

function plantIsland(progress) {
  const texFrond = makeFrondTexture(), texCluster = makeLeafClusterTexture(102), texBush = makeLeafClusterTexture(96);
  const texGrass = makeGrassTexture(), texFern = makeFernTexture(), texBig = makeBigLeafTexture(), texFlower = makeFlowerTexture(), texDead = makeDeadLeafTexture();
  VEG.textures = { texDead, texCluster };

  // --- palms ---
  const palmUni = {};
  const trunkMat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'palmTrunk', vHead: 'attribute vec4 aPalm; attribute float aC;\n' + WIND_HEAD, vBegin: PALM_TRUNK_VS,
    fColor: '{ float ring = fract(vWPos.y * 3.2 + texture2D(uNoiseTex, vWPos.xz * 0.5).r * 0.6); diffuseColor.rgb *= 0.78 + 0.32 * smoothstep(0.0, 0.25, ring) * (1.0 - smoothstep(0.75, 1.0, ring)); diffuseColor.rgb *= 0.9 + 0.2 * texture2D(uNoiseTex, vec2((vWPos.x + vWPos.z) * 3.0, vWPos.y * 0.6)).a; }' });
  const crownMat = foliageMat(texFrond, 'palmCrown', { vHead: 'attribute vec4 aPalm; attribute vec2 aFrond;\n', vBegin: PALM_CROWN_VS });
  const trunkDepth = depthMat({ key: 'palmTrunk', vHead: 'attribute vec4 aPalm; attribute float aC;\n' + WIND_HEAD, vBegin: PALM_TRUNK_VS });
  const crownDepth = depthMat({ key: 'palmCrown', vHead: 'attribute vec4 aPalm; attribute vec2 aFrond;\n' + WIND_HEAD, vBegin: PALM_CROWN_VS }, texFrond, 0.42);
  const fronds = palmFronds();
  const trunkGeo = palmTrunkGeometry(), crownGeo = palmCrownGeometry(fronds);
  const palmsT = new Field('palmTrunks', trunkGeo, trunkMat, { chunk: 150, cast: true, attrs: { aPalm: 4 }, depth: trunkDepth, pad: 16, density: false, lod: { geo: palmTrunkGeometry(true), dist: 70 } });
  const palmsC = new Field('palmCrowns', crownGeo, crownMat, { chunk: 150, cast: true, attrs: { aPalm: 4 }, depth: crownDepth, pad: 16, density: false, lod: { geo: palmCrownGeometry(fronds, true), dist: 70 } });
  VEG.palmsT = palmsT; VEG.palmsC = palmsC;
  const placed = new SpatialHash(10);
  VEG.palmSpots = []; VEG.palmsT = palmsT; VEG.palmsC = palmsC;
  const addPalm = (x, z, H, lean, leanDir, s = rand(0.85, 1.15), force = false) => {
    const y = groundHeight(x, z) - 0.25;
    if (!force && !placed.free(x, z, 3.6)) return false;
    if (inWater(x, z, 2.5)) return false;
    placed.add(x, z, { x, z, r: 3.6 });
    const ry = Math.atan2(-Math.sin(leanDir), Math.cos(leanDir));
    const m = mtx(x, y, z, ry, s);
    const a = { aPalm: [H / s, lean, rng(), rand(0, 0.55)], id: 'p' + VEG.palmSpots.length };
    palmsT.add(m, a); palmsC.add(m, a);
    addCollider(x, z, 0.32 * s + 0.08, y + H);
    VEG.palmSpots.push({ x, z, y, H, lean, leanDir, s, id: a.id, ground: y + 0.25 });
    return true;
  };
  VEG.addPalm = addPalm;
  // hero palms framing the first view and around special places are added by the props stage
  const tries = Math.round(16000 * 1.0);
  for (let i = 0; i < tries; i++) {
    const x = rand(-700, 520), z = rand(-560, 520);
    const h = groundHeight(x, z); if (h < 0.9 || h > 40) continue;
    const k = vIndex(x, z), L = T.L[k];
    if (slopeAt(x, z) > 0.28) continue;
    if (excluded(x, z, 2) || nearTrail(x, z, 2.5) || nearStream(x, z, 3)) continue;
    const coast = (L > 5 && L < 75) ? 1 : 0;
    let p = coast ? 0.5 : (h < 22 ? 0.07 : 0.02);
    if (Math.hypot(x - ISLET.x, z - ISLET.z) < ISLET.r + 10) p = 0.5;
    p *= smoothstep(-0.3, 0.25, Noise.fbm(x * 0.012 + 50, z * 0.012, 2));
    p *= 1 - T.mask[k * 4 + 2] / 255;
    if (rng() > p) continue;
    _n.set(T.nrm[k * 3], 0, T.nrm[k * 3 + 2]);
    const leanDir = _n.lengthSq() > 1e-5 ? Math.atan2(_n.z, _n.x) + rand(-0.6, 0.6) : rand(0, TAU);
    addPalm(x, z, coast ? rand(7, 12.5) : rand(6, 11), coast ? rand(0.1, 0.36) : rand(0.02, 0.14), leanDir);
  }

  // --- jungle trees ---
  const tg = treeGeometries();
  const TREE_VS = /* glsl */`
    { vec3 ip = instPos(); vec3 wl = windLocal(); float ph = ip.x * 0.11 + ip.z * 0.07; float gust = gustAt(ip, ph);
      float k = pow(max(transformed.y, 0.0) / 10.0, 2.0);
      transformed += wl * uWind * (0.2 + 0.38 * gust) * k * (1.0 + 0.4 * sin(uTime * 1.1 + ph));
      transformed += aY * vec3(sin(uTime * 2.7 + transformed.x * 2.0 + ph), sin(uTime * 3.1 + transformed.z * 2.0), cos(uTime * 2.3 + transformed.y)) * 0.09 * uWind * (0.5 + gust);
      transformed = knockDown(transformed, ip); }
  `;
  const barkMat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'bark', vHead: 'attribute float aY;\n' + WIND_HEAD, vBegin: TREE_VS,
    fColor: '{ float g = texture2D(uNoiseTex, vec2((vWPos.x + vWPos.z) * 2.6, vWPos.y * 0.35)).a; float g2 = texture2D(uNoiseTex, vec2((vWPos.x - vWPos.z) * 7.0, vWPos.y * 1.2)).r; diffuseColor.rgb *= 0.72 + 0.4 * g; diffuseColor.rgb *= 1.0 - smoothstep(0.6, 0.75, g2) * 0.35; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.3, 0.12), smoothstep(0.62, 0.8, g) * smoothstep(3.0, 0.5, vWPos.y - terrainH(vWPos.xz)) * 0.5); }' });
  const canopyMat = foliageMat(texCluster, 'canopy', { vHead: 'attribute float aY;\n', vBegin: TREE_VS, vertexColors: true });
  const canopyDepth = depthMat({ key: 'canopy', vHead: 'attribute float aY;\n' + WIND_HEAD, vBegin: TREE_VS }, texCluster, 0.42);
  const barkDepth = depthMat({ key: 'bark', vHead: 'attribute float aY;\n' + WIND_HEAD, vBegin: TREE_VS });
  const treesB = new Field('treeBark', tg.bark, barkMat, { chunk: 200, cast: true, depth: barkDepth, pad: 14, lod: { geo: tg.barkLo, dist: 60 } });
  const treesL = new Field('treeLeaves', tg.leaves, canopyMat, { chunk: 200, cast: true, depth: canopyDepth, pad: 14, lod: { geo: tg.leavesLo, dist: 60 } });
  VEG.treesB = treesB; VEG.treesL = treesL; VEG.treeSpots = [];
  const tcol = new THREE.Color();
  for (let i = 0; i < 9000; i++) {
    const x = rand(-480, 520), z = rand(-520, 520);
    const h = groundHeight(x, z); if (h < 3 || h > 120) continue;
    const k = vIndex(x, z), L = T.L[k];
    if (L < 55 || slopeAt(x, z) > 0.42) continue;
    if (excluded(x, z, 4) || nearTrail(x, z, 3.5) || nearStream(x, z, 5) || inWater(x, z, 3.5)) continue;
    const jungle = T.mask[k * 4 + 1] / 255;
    if (rng() > 0.05 + jungle * jungle * 0.75) continue;
    if (!placed.free(x, z, 5.5)) continue;
    placed.add(x, z, { x, z, r: 5.5 });
    const s = rand(0.75, 1.45);
    const m = mtx(x, h - 0.3, z, rand(0, TAU), s);
    tcol.setHSL(rand(0.17, 0.33), rand(0.15, 0.4), rand(0.66, 0.9));
    const tid = 't' + VEG.treeSpots.length; VEG.treeSpots.push({ x, z, y: h - 0.3, s, id: tid, ground: h, col: tcol.clone() });
    treesB.add(m, { id: tid }); treesL.add(m, { id: tid }, tcol);
    addCollider(x, z, 0.45 * s, h + 8 * s);
  }
  progress(0.7);

  // --- understory ---
  const bushMat = foliageMat(texBush, 'bush', { vHead: 'attribute float aY;\n' + FADE_HEAD, vBegin: SWAY_SMALL(0.11, 1.9), fade: true, fadeMul: 1.35, uniforms: fadeUniforms(90, 25) });
  const fernMat = foliageMat(texFern, 'fern', { vHead: 'attribute float aY;\n' + FADE_HEAD, vBegin: SWAY_SMALL(0.15, 2.3), fade: true, fadeMul: 1.35, uniforms: fadeUniforms(90, 25) });
  const grassMat = foliageMat(null, 'grass', { vHead: FADE_HEAD + 'float aY = 1.0;\n', vBegin: SWAY_SMALL(0.22, 2.2), fade: true, uniforms: fadeUniforms(70, 25), alphaTest: 0.0, vertexColors: true, a2c: false });
  const bigMat = foliageMat(texBig, 'bigleaf', { vHead: 'attribute float aY;\n' + FADE_HEAD, vBegin: SWAY_SMALL(0.13, 1.6), fade: true, fadeMul: 1.35, uniforms: fadeUniforms(90, 25), vertexColors: true });
  const flowerMat = foliageMat(texFlower, 'flower', { vHead: 'attribute float aY;\n' + FADE_HEAD, vBegin: SWAY_SMALL(0.09, 2.0), fade: true, uniforms: fadeUniforms(70, 20), alphaTest: 0.5 });
  const deadMat = foliageMat(texDead, 'deadleaf', { vHead: FADE_HEAD + 'float aY = 0.0;\n', vBegin: '', fade: true, fadeMul: 0.7, uniforms: fadeUniforms(50, 15), alphaTest: 0.5 });
  VEG.fadeMats = [[bushMat, 1.35], [fernMat, 1.35], [grassMat, 1], [bigMat, 1.35], [flowerMat, 1], [deadMat, 0.7]];
  const bushes = new Field('bushes', bushGeometry(), bushMat, { chunk: 110, far: 90, nearMul: 1.35, pad: 3 });
  const ferns = new Field('ferns', frondFan(9, 0.95, 0.35), fernMat, { chunk: 110, far: 90, nearMul: 1.35, pad: 2 });
  const grass = new Field('grass', grassGeometry(16, 4), grassMat, { chunk: 90, far: 90, nearMul: 1, pad: 2, lod: { geo: grassGeometry(9, 2), dist: 30 } });
  const bigs = new Field('bigleaf', bigLeafPlantGeometry(), bigMat, { chunk: 110, far: 90, nearMul: 1.35, pad: 3 });
  const flowers = new Field('flowers', flowerGeometry(), flowerMat, { chunk: 110, far: 90, nearMul: 1, pad: 2 });
  const deadLeaves = new Field('deadleaves', (() => { const p = new THREE.PlaneGeometry(0.22, 0.42).rotateX(-Math.PI / 2).translate(0, 0.03, 0); const n = p.attributes.normal; for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0); return prep(p); })(), deadMat, { chunk: 110, far: 90, nearMul: 0.7, pad: 1 });
  Object.assign(VEG, { bushes, ferns, grass, bigs, flowers, deadLeaves });
  const c = new THREE.Color();
  const FLOWER_COLS = [[0.98, 0.32, 0.45], [0.95, 0.2, 0.22], [1.0, 0.62, 0.2], [1.0, 0.86, 0.3], [0.96, 0.96, 0.92], [0.9, 0.4, 0.8]];
  const flowerSpots = [];
  for (let i = 0; i < 90000; i++) {
    const x = rand(-700, 520), z = rand(-560, 520);
    const h = groundHeight(x, z); if (h < 0.8 || h > 150) continue;
    if (inWater(x, z, 0.8)) continue;
    const k = vIndex(x, z), L = T.L[k];
    const sand = T.mask[k * 4] / 255, jungle = T.mask[k * 4 + 1] / 255, rock = T.mask[k * 4 + 2] / 255;
    const slope = slopeAt(x, z);
    if (slope > 0.5 || rock > 0.6) continue;
    if (excluded(x, z, 0.5)) continue;
    const onTrail = nearTrail(x, z, 1.6);
    const wet = nearStream(x, z, 9);
    const r = rng();
    if (sand > 0.55) {
      // beach grass on the dunes, the odd sea-grape bush at the vegetation line
      const edge = 1 - smoothstep(0.78, 1.0, sand);
      if (L > 14 && h > 1.3 && !onTrail && r < (0.09 + edge * 0.32) * smoothstep(0.2, 0.7, Noise.fbm(x * 0.04, z * 0.04, 2) + 0.35)) {
        c.setHSL(rand(0.11, 0.17), rand(0.3, 0.55), rand(0.72, 0.9));
        grass.add(mtxAlign(x, h - 0.05, z, rand(0, TAU), rand(0.7, 1.3), groundNormal(x, z), 0.6), {}, c);
      } else if (L > 30 && r > 0.995 - edge * 0.025) {
        c.setHSL(rand(0.2, 0.3), 0.3, rand(0.7, 0.88));
        bushes.add(mtx(x, h - 0.1, z, rand(0, TAU), rand(0.6, 1.1)), {}, c);
      }
      continue;
    }
    if (onTrail) continue;
    if (jungle > 0.45 && L > 50) {
      if (r < 0.05 + (wet ? 0.08 : 0)) ferns.add(mtx(x, h - 0.05, z, rand(0, TAU), rand(0.8, 1.6)), {}, c.setHSL(rand(0.2, 0.3), 0.35, rand(0.72, 0.92)));
      else if (r < 0.085) { c.setHSL(rand(0.18, 0.32), rand(0.2, 0.4), rand(0.7, 0.9)); if (rng() < 0.12) c.setHSL(rand(0.95, 1.0), 0.6, 0.62); bushes.add(mtx(x, h - 0.15, z, rand(0, TAU), rand(0.8, 1.8)), {}, c); }
      else if (r < 0.105 + (wet ? 0.05 : 0)) bigs.add(mtx(x, h - 0.05, z, rand(0, TAU), rand(0.8, 1.6)), {}, c.setHSL(rand(0.22, 0.32), 0.3, rand(0.75, 0.92)));
      else if (r < 0.14) deadLeaves.add(mtxAlign(x, h, z, rand(0, TAU), rand(0.8, 1.4), groundNormal(x, z)), {}, c.setHSL(rand(0.06, 0.1), 0.5, rand(0.35, 0.55)));
      else if (r < 0.15) { const fc = pick(FLOWER_COLS); flowers.add(mtx(x, h + 0.25, z, rand(0, TAU), rand(0.8, 1.3)), {}, c.setRGB(fc[0], fc[1], fc[2])); flowerSpots.push({ x, y: h + 0.5, z }); }
    } else {
      // open grassland and the edge of the jungle
      if (r < 0.085) { c.setHSL(rand(0.17, 0.27), rand(0.3, 0.5), rand(0.62, 0.84)); grass.add(mtxAlign(x, h - 0.05, z, rand(0, TAU), rand(0.6, 1.1), groundNormal(x, z), 0.7), {}, c); }
      else if (r < 0.1) { c.setHSL(rand(0.18, 0.3), rand(0.2, 0.4), rand(0.68, 0.9)); bushes.add(mtx(x, h - 0.15, z, rand(0, TAU), rand(0.7, 1.4)), {}, c); }
      else if (r < 0.107) ferns.add(mtx(x, h - 0.05, z, rand(0, TAU), rand(0.7, 1.2)), {}, c.setHSL(0.25, 0.35, 0.8));
      else if (r < 0.112) { const fc = pick(FLOWER_COLS); flowers.add(mtx(x, h + 0.25, z, rand(0, TAU), rand(0.8, 1.3)), {}, c.setRGB(fc[0], fc[1], fc[2])); flowerSpots.push({ x, y: h + 0.5, z }); }
    }
  }
  // fallen fronds and coconuts under palms
  for (const p of VEG.palmSpots) {
    for (let k = 0; k < 3; k++) {
      const a = rand(0, TAU), d = rand(0.6, 3.5), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const h = groundHeight(x, z); if (h < 0.4) continue;
      deadLeaves.add(mtxAlign(x, h, z, rand(0, TAU), rand(1.5, 3.2), groundNormal(x, z)), {}, c.setHSL(rand(0.07, 0.11), 0.45, rand(0.45, 0.6)));
    }
  }
  VEG.flowerSpots = flowerSpots;
}
function finishVegetation() {
  for (const f of FIELDS) f.build();
  applyVegetationQuality();
}
const FADE_SETS = [];
function applyVegetationQuality() {
  for (const f of FIELDS) {
    if (f.o.nearMul) f.o.farScale = Q.near / 90 * f.o.nearMul;
    else if (f.o.farMulQ) f.o.farScale = Q.farMul;
    f.setDensity(Q.veg);
  }
  for (const s of FADE_SETS) { const far = Q.near * s.mul; s.u.uFadeStart.value = far * 0.72; s.u.uFadeLen.value = far * 0.28; }
}
