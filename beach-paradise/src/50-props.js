
// ───────────────────── 14. Places: where things are on the island ─────────────────────
function findAlong(x0, z0, dx, dz, test, maxD = 900, step = 0.5) {
  for (let d = 0; d < maxD; d += step) { const x = x0 + dx * d, z = z0 + dz * d; if (test(groundHeight(x, z), x, z)) return { x, z, d }; }
  return null;
}
// seaward direction from the smooth island field (stable, unlike the bumpy terrain)
function seaDir(x, z) {
  const e = 10, gx = landField(x + e, z) - landField(x - e, z), gz = landField(x, z + e) - landField(x, z - e);
  const l = Math.hypot(gx, gz) || 1; return { x: -gx / l, z: -gz / l };
}
const yawFacing = d => Math.atan2(-d.x, -d.z);
const LAYOUT = {};
function layoutPlaces() {
  // the arrival beach: a wide stretch of the west coast that faces the sunset
  let best = null;
  for (let z = -60; z <= 190; z += 6) {
    const c = findAlong(-120, z, -1, 0, h => h < 1.9); if (!c) continue;
    const sd = seaDir(c.x, c.z);
    const wl = findAlong(c.x, c.z, sd.x, sd.z, h => h < 0.0, 200, 0.5);
    const width = wl ? wl.d : 0;
    const score = (-sd.x) * 2.2 + clamp(width / 26, 0, 1.3) - Math.abs(z - 50) * 0.003 - (width > 60 ? 1 : 0);
    if (!best || score > best.score) best = { x: c.x, z: c.z, sd, score, width };
  }
  SPAWN.x = best.x; SPAWN.z = best.z; SPAWN.yaw = yawFacing(best.sd);
  const F = best.sd, R = { x: -F.z, z: F.x };
  LAYOUT.F = F; LAYOUT.R = R; LAYOUT.beachWidth = best.width;
  const at = (fw, rt) => ({ x: SPAWN.x + F.x * fw + R.x * rt, z: SPAWN.z + F.z * fw + R.z * rt });
  LAYOUT.at = at;
  EXCLUDE.push({ x: SPAWN.x, z: SPAWN.z, r: 13 });
  for (let d = 0; d < 70; d += 6) { const p = at(d, 0); EXCLUDE.push({ x: p.x, z: p.z, r: 9 + d * 0.1 }); }
  // beach chairs and umbrella, a towel, a sandcastle near the water
  LAYOUT.chairs = at(4, -9); EXCLUDE.push({ ...LAYOUT.chairs, r: 6 });
  LAYOUT.towel = at(7.5, 6.5); EXCLUDE.push({ ...LAYOUT.towel, r: 4 });
  const wl = findAlong(SPAWN.x, SPAWN.z, F.x, F.z, h => h < 0.55, 200);
  LAYOUT.castle = wl ? { x: wl.x - F.x * 2.5 + R.x * 3, z: wl.z - F.z * 2.5 + R.z * 3 } : at(15, 3);
  LAYOUT.buoy = at(-3, -17);
  LAYOUT.sign = at(-11, 5);
  // the dock, north along the beach
  const dockBase = at(-14, 52);
  // point the dock at the deepest water nearby, not just along the local coastline
  let dsd = seaDir(dockBase.x, dockBase.z), deepest = 1e9;
  for (let a = 0; a < 36; a++) {
    const ang = a / 36 * TAU, dx = Math.cos(ang), dz = Math.sin(ang);
    if (dx * dsd.x + dz * dsd.z < 0.2) continue;
    let h = 0; for (const d of [30, 45, 60]) h += groundHeight(dockBase.x + dx * d, dockBase.z + dz * d);
    if (h < deepest) { deepest = h; dsd = { x: dx, z: dz }; }
  }
  const ds = findAlong(dockBase.x, dockBase.z, dsd.x, dsd.z, h => h < 1.05, 200, 0.25);
  LAYOUT.dock = { x: ds.x, z: ds.z, dir: dsd, len: 42, top: 1.15 };
  for (let d = -4; d < 50; d += 5) EXCLUDE.push({ x: ds.x + dsd.x * d, z: ds.z + dsd.z * d, r: 5 });
  // hidden cove on the north shore
  PLACES.cove = { x: BAY.x, z: BAY.z, r: BAY.r + 6, name: 'Hidden Cove', sub: 'Tucked behind the northern headlands' };
  const cv = findAlong(BAY.x, BAY.z, 0, 1, h => h > 1.6, 120, 0.5) || { x: BAY.x, z: BAY.z + 40 };
  LAYOUT.hammock = { x: cv.x, z: cv.z + 3 };
  EXCLUDE.push({ ...LAYOUT.hammock, r: 6 });
  // summit lookout
  let top = { x: 170, z: -95, h: -1 };
  for (let i = 0; i < 400; i++) { const x = 170 + rand(-70, 70), z = -95 + rand(-70, 70), h = groundHeight(x, z); if (h > top.h && slopeAt(x, z) < 0.25) top = { x, z, h }; }
  LAYOUT.summit = top; EXCLUDE.push({ x: top.x, z: top.z, r: 8 });
  PLACES.summit = { x: top.x, z: top.z, r: 30, name: 'Summit Lookout', sub: `${Math.round(top.h)} m above the sea` };
  // a ring of palms around a quiet clearing
  let clr = null;
  for (let i = 0; i < 3000 && !clr; i++) {
    const x = rand(-260, 40), z = rand(80, 330), h = groundHeight(x, z);
    if (h < 5 || h > 30 || slopeAt(x, z) > 0.12 || T.L[vIndex(x, z)] < 90) continue;
    let flat = true; for (let a = 0; a < 8 && flat; a++) { const hx = groundHeight(x + Math.cos(a) * 14, z + Math.sin(a) * 14); if (Math.abs(hx - h) > 2.2) flat = false; }
    if (flat && !nearTrail(x, z, 20) && !nearStream(x, z, 20)) clr = { x, z, h };
  }
  if (clr) { LAYOUT.clearing = clr; EXCLUDE.push({ x: clr.x, z: clr.z, r: 15 }); PLACES.clearing = { x: clr.x, z: clr.z, r: 15, name: 'Palm Circle', sub: 'A clearing in the lowland forest' }; }
  // sea arch in the lagoon toward the little island
  const toI = { x: ISLET.x - (-170), z: ISLET.z - 250 }; const li = Math.hypot(toI.x, toI.z); toI.x /= li; toI.z /= li;
  const arch = findAlong(-170, 250, toI.x, toI.z, h => h < -1.1, 500, 0.5);
  if (arch) { LAYOUT.arch = { x: arch.x + toI.x * 6, z: arch.z + toI.z * 6, dir: toI }; PLACES.arch = { x: LAYOUT.arch.x, z: LAYOUT.arch.z, r: 22, name: 'The Sea Arch', sub: 'Swim through it' }; }
  PLACES.islet = { x: ISLET.x, z: ISLET.z, r: ISLET.r + 4, name: 'Lone Palm Isle', sub: 'About 200 m of open water from the main beach' };
  LAYOUT.islet = { x: ISLET.x, z: ISLET.z };
  EXCLUDE.push({ x: ISLET.x + 6, z: ISLET.z - 4, r: 4 });
  // a rock above the tide pools that catches the sunrise
  const tp = PLACES.tide;
  const rs = findAlong(tp.x, tp.z, -1, 0, h => h > 2.2, 80, 0.5) || { x: tp.x - 12, z: tp.z };
  LAYOUT.rockSeat = { x: rs.x, z: rs.z + 10 };
  // coral garden in front of the beach (for the place name when you dive there)
  const cg = findAlong(SPAWN.x, SPAWN.z, F.x, F.z, h => h < -2.6, 300) || at(80, 0);
  LAYOUT.coralGarden = { x: cg.x + F.x * 20, z: cg.z + F.z * 20 };
  PLACES.reef = { x: LAYOUT.coralGarden.x, z: LAYOUT.coralGarden.z, r: 45, under: true, name: 'Coral Garden', sub: 'Just off the main beach' };
  PLACES.beach = { x: SPAWN.x, z: SPAWN.z, r: 0.01, name: '', sub: '' }; visited.add('beach');
  if (STREAM.crossing) { const { p, q } = STREAM.crossing; for (let d = -q.W - 5; d <= q.W + 5; d += 3) EXCLUDE.push({ x: p.x - q.tz * d, z: p.z + q.tx * d, r: 3 }); }
  { const st = STREAM.lower[2] || STREAM.lower[0]; EXCLUDE.push({ x: st.x, z: st.z, r: 6 }); }
  cabinSite();
  buildPlane();
  PLACES.cabin = { x: CABIN.x, z: CABIN.z, r: 0.01, name: '', sub: '' }; visited.add('cabin');
}

// ───────────────────── 15. Prop building blocks ─────────────────────
const propMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }), { key: 'prop' });
const C = {
  wood: [0.42, 0.29, 0.18], woodDark: [0.28, 0.19, 0.12], woodPale: [0.62, 0.55, 0.45], drift: [0.66, 0.62, 0.56],
  white: [0.9, 0.9, 0.88], red: [0.78, 0.12, 0.1], teal: [0.08, 0.55, 0.55], coral: [0.95, 0.42, 0.3], yellow: [0.95, 0.75, 0.2],
  navy: [0.08, 0.16, 0.36], sand: [0.6, 0.5, 0.35], rope: [0.62, 0.52, 0.36], canvas: [0.86, 0.8, 0.66],
};
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, jitter = 0.04) {
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')));
  geo.translate(x, y, z);
  return prep(geo, color, {}, jitter);
}
const bx = (w, h, d, c, x, y, z, rx, ry, rz) => part(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
const cy = (rt, rb, h, seg, c, x, y, z, rx, ry, rz) => part(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, rx, ry, rz);
function propMesh(parts, x, y, z, ry = 0, opts = {}) {
  const g = mergeGeos(parts.map(p => { const q = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'color', 'uv']) q.setAttribute(n, p.attributes[n]); return q; }));
  const m = new THREE.Mesh(g, opts.mat || propMat);
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = opts.cast !== false; m.receiveShadow = true;
  scene.add(m); return m;
}
// local → world helper for an object facing `yaw`
function local(o, yaw, fw, rt, up = 0) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  return { x: o.x + fx * fw + rx * rt, y: (o.y || 0) + up, z: o.z + fz * fw + rz * rt };
}
function umbrella(c1, c2) {
  const P = [cy(0.025, 0.03, 2.5, 6, C.woodPale, 0, 1.15, 0)];
  const cone = new THREE.ConeGeometry(1.7, 0.55, 16, 1, true).toNonIndexed();
  const n = cone.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const cx = (cone.attributes.position.getX(i) + cone.attributes.position.getX(i + 1) + cone.attributes.position.getX(i + 2)) / 3;
    const cz = (cone.attributes.position.getZ(i) + cone.attributes.position.getZ(i + 1) + cone.attributes.position.getZ(i + 2)) / 3;
    const seg = Math.floor(((Math.atan2(cz, cx) + Math.PI) / TAU) * 16);
    const c = seg % 2 ? c1 : c2; for (let k = 0; k < 3; k++) col.set(c, (i + k) * 3);
  }
  cone.translate(0, 2.35, 0);
  cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!cone.attributes.uv) cone.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  P.push(cone);
  return P;
}
function towel(c1, c2, c3) {
  const P = [], cols = [c1, c2, c3, c2, c1];
  for (let i = 0; i < 5; i++) P.push(bx(0.9, 0.012, 0.36, cols[i], 0, 0.01, -0.72 + i * 0.36));
  return P;
}
function sandcastle() {
  const P = [cy(0.55, 0.65, 0.3, 14, C.sand, 0, 0.15, 0)];
  P.push(cy(0.32, 0.36, 0.5, 12, C.sand, 0, 0.55, 0), part(new THREE.ConeGeometry(0.3, 0.35, 12), C.sand, 0, 0.97, 0));
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; P.push(cy(0.13, 0.15, 0.42, 8, C.sand, Math.cos(a) * 0.48, 0.45, Math.sin(a) * 0.48), part(new THREE.ConeGeometry(0.14, 0.18, 8), C.sand, Math.cos(a) * 0.48, 0.75, Math.sin(a) * 0.48)); }
  P.push(cy(0.006, 0.006, 0.35, 3, C.woodPale, 0, 1.25, 0), bx(0.14, 0.08, 0.005, C.red, 0.07, 1.36, 0));
  return P;
}
function lifebuoyPost() {
  const P = [bx(0.12, 2.0, 0.12, C.woodPale, 0, 1.0, 0), bx(0.5, 0.08, 0.1, C.woodPale, 0, 1.7, 0.02)];
  const tor = new THREE.TorusGeometry(0.33, 0.085, 8, 24).toNonIndexed();
  const n = tor.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.atan2(tor.attributes.position.getY(i), tor.attributes.position.getX(i)); const c = Math.floor(((a + Math.PI) / TAU) * 8) % 2 ? C.white : C.red; col.set(c, i * 3); }
  tor.setAttribute('color', new THREE.BufferAttribute(col, 3)); tor.translate(0, 1.3, 0.1);
  P.push(tor);
  return P;
}
function sign(text) {
  const tex = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#7a5634'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,25,10,${rand(0.05, 0.18)})`; g.lineWidth = rand(1, 3); g.beginPath(); const y = rand(0, h); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + rand(-6, 6), w * 0.6, y + rand(-6, 6), w, y + rand(-4, 4)); g.stroke(); }
    g.fillStyle = '#f3ead8'; g.font = 'italic 300 76px Fraunces, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.53, 0.06), [propMatPlain(C.wood), propMatPlain(C.wood), propMatPlain(C.wood), propMatPlain(C.wood), patch(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { key: 'signface' }), propMatPlain(C.wood)]);
  return board;
}
const _plain = new Map();
const propMatDouble = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), { key: 'prop2' });
function propMatPlain(c) { const k = c.join(','); if (!_plain.has(k)) _plain.set(k, patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace), roughness: 0.85 }), { key: 'plain' })); return _plain.get(k); }
function bench() {
  const P = [];
  for (let i = 0; i < 3; i++) P.push(bx(1.8, 0.04, 0.12, C.wood, 0, 0.46, -0.16 + i * 0.14));
  for (let i = 0; i < 2; i++) P.push(bx(1.8, 0.11, 0.035, C.wood, 0, 0.7 + i * 0.16, 0.24, 0.18));
  for (const sx of [-0.75, 0.75]) { P.push(bx(0.07, 0.46, 0.07, C.woodDark, sx, 0.23, -0.15), bx(0.07, 0.95, 0.07, C.woodDark, sx, 0.47, 0.24, 0.18)); }
  return P;
}
function rowboatGeometry() {
  // lofted hull: U-shaped sections along the length, open on top
  const L = 3.6, N = 14, S = 9, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = (t - 0.5) * L;
    const w = 0.72 * Math.pow(Math.sin(Math.PI * clamp(t * 0.96 + 0.02, 0, 1)), 0.55) * (t > 0.85 ? 1 - (t - 0.85) * 2.5 : 1);
    const d = 0.42 + 0.12 * Math.abs(t - 0.5) * 2, sheer = 0.08 * Math.pow(Math.abs(t - 0.5) * 2, 2);
    for (let j = 0; j <= S; j++) {
      const a = Math.PI * (j / S);
      pos.push(Math.cos(a) * w, -Math.sin(a) * d + sheer + 0.42, z);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + 1, c = a + S + 1, dd = c + 1; idx.push(a, c, b, b, c, dd); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const hull = prep(g, [0.14, 0.42, 0.52], {}, 0.03);
  const ys = hull.attributes.position; const col = hull.attributes.color;
  for (let i = 0; i < ys.count; i++) if (ys.getY(i) > 0.36) col.setXYZ(i, 0.92, 0.9, 0.85); else if (ys.getY(i) < 0.08) col.setXYZ(i, 0.55, 0.16, 0.1);
  const P = [hull];
  for (const z of [-0.6, 0.35, 1.2]) P.push(bx(1.1, 0.04, 0.24, C.woodPale, 0, 0.3, z));
  P.push(bx(0.05, 0.05, 2.2, C.woodPale, 0.32, 0.12, 0.2, 0, 0.12), bx(0.05, 0.05, 2.2, C.woodPale, -0.3, 0.12, 0.25, 0, -0.1));
  return P;
}
function tubeGeometry() {
  const t = new THREE.TorusGeometry(0.56, 0.22, 12, 28).rotateX(Math.PI / 2).toNonIndexed();
  const n = t.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.atan2(t.attributes.position.getZ(i), t.attributes.position.getX(i)); col.set(Math.floor(((a + Math.PI) / TAU) * 8) % 2 ? [0.95, 0.94, 0.9] : [0.92, 0.28, 0.12], i * 3); }
  t.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return [t];
}
function fishingBoat() {
  const P = rowboatGeometry().map(g => g.clone().scale(2.2, 2.0, 2.4));
  P.push(bx(1.3, 1.1, 1.5, C.white, 0, 1.4, 0.8), bx(1.4, 0.08, 1.6, C.red, 0, 2.0, 0.8), cy(0.04, 0.05, 4.2, 5, C.woodPale, 0, 2.5, -1.2));
  return P;
}

// ───────────────────── 16. Rocks ─────────────────────
function smoothNormals(g) {
  const pos = g.attributes.position, nor = g.attributes.normal, map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
    let a = map.get(k); if (!a) map.set(k, a = [0, 0, 0, []]);
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); a[3].push(i);
  }
  for (const a of map.values()) { const l = Math.hypot(a[0], a[1], a[2]) || 1; for (const i of a[3]) nor.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
}
function rockGeometry(kind, seed, detail = 3) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const sc = [[1, 0.72, 1], [1.45, 0.45, 1], [0.8, 1.35, 0.8], [1.15, 0.8, 0.95]][kind];
  const disp = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let d = Noise.n3(x * 1.3 + seed, y * 1.3, z * 1.3) * 0.28 + Noise.n3(x * 3.1, y * 3.1 + seed, z * 3.1) * 0.1 + (kind === 3 ? Math.abs(Noise.n3(x * 2, y * 2, z * 2 + seed)) * -0.3 : 0);
    d += -Math.abs(Noise.n3(x * 5.2 + seed, y * 5.2, z * 5.2)) * 0.07 + Noise.n3(x * 11, y * 11, z * 11 + seed) * 0.018;   // chipped edges and grit
    d = Math.round(d * 14) / 14 * 0.4 + d * 0.6;                                                                            // a hint of flat, fractured faces
    if (kind === 2) d += Math.sin(y * 9 + seed) * 0.03;
    disp[i] = d;
    const r = 1 + d; p.setXYZ(i, x * r * sc[0], Math.max(y * r * sc[1], -0.35 * sc[1]), z * r * sc[2]);
  }
  g.computeVertexNormals(); smoothNormals(g);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = 0.78 + disp[i] * 0.9 + Noise.n3(p.getX(i) * 5, p.getY(i) * 5, p.getZ(i) * 5 + seed) * 0.08;
    col[i * 3] = 0.45 * v; col[i * 3 + 1] = 0.42 * v; col[i * 3 + 2] = 0.38 * v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const ROCK_FS = /* glsl */`
  { float up = clamp(vNrmW.y, 0.0, 1.0);
    vec4 rn = texture2D(uNoiseTex, vWPos.xz * 0.21 + vWPos.y * 0.13);
    vec4 rf = texture2D(uNoiseTex, vWPos.xz * 1.3 + vWPos.y * 0.9);
    vec3 c = diffuseColor.rgb * (0.85 + 0.3 * rn.a);
    c *= 0.9 + 0.12 * sin(vWPos.y * 4.2 + rn.r * 5.0);                                                // banding in the stone
    c *= 1.0 - smoothstep(0.035, 0.0, abs(rf.r - 0.5)) * 0.45;                                       // fine cracks
    c = mix(c, vec3(0.78, 0.74, 0.62), smoothstep(0.72, 0.82, rf.b) * up * smoothstep(1.2, 3.0, vWPos.y) * 0.55);  // pale lichen
    c = mix(c, vec3(0.72, 0.42, 0.16), smoothstep(0.78, 0.86, rf.g) * up * smoothstep(1.5, 3.5, vWPos.y) * 0.4);   // orange lichen
    c = mix(c, vec3(0.13, 0.2, 0.07), smoothstep(0.55, 0.85, up) * smoothstep(2.5, 6.0, vWPos.y) * smoothstep(0.4, 0.7, rn.g) * 0.85);
    c *= mix(1.0, 0.55, smoothstep(0.9, 0.0, vWPos.y) * step(-3.0, vWPos.y));
    c = mix(c, vec3(0.16, 0.22, 0.12), smoothstep(-0.5, -2.0, vWPos.y) * 0.5);
    c = mix(c, c * 0.62, uWet * 0.6);
    diffuseColor.rgb = c; }
`;
function rockMaterial() {
  return patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), {
    key: 'rock', vHead: 'varying vec3 vNrmW;',
    vEnd: `{ vec3 nn = objectNormal;
      #ifdef USE_INSTANCING
        nn = mat3(instanceMatrix) * nn;
      #endif
        vNrmW = normalize(mat3(modelMatrix) * nn); }`,
    fHead: 'varying vec3 vNrmW;', fColor: ROCK_FS,
    fNormal: '{ vec3 bn = texture2D(uNoiseTex, vWPos.xz * 2.7 + vWPos.y * 1.9).rgb - 0.5; normal = normalize(normal + bn * 0.32 * (1.0 - smoothstep(6.0, 30.0, length(vWPos - cameraPosition)))); }',
    fRough: 'roughnessFactor = mix(roughnessFactor, 0.35, smoothstep(0.9, 0.0, vWPos.y) * step(-0.5, vWPos.y) + uWet * 0.4);',
  });
}
const ROCKS = { fields: [], mat: null };
function placeRock(x, y, z, s, kind = randInt(0, 3), solid = true, ry = rand(0, TAU), tilt = 0.25) {
  const f = ROCKS.fields[kind];
  f.add(mtx(x, y, z, ry, s, rand(-tilt, tilt), rand(-tilt, tilt)));
  const sc = [[1, 0.72], [1.45, 0.45], [0.8, 1.35], [1.15, 0.8]][kind];
  if (solid && s > 0.6) addCollider(x, z, s * sc[0] * 0.82, y + s * sc[1] * 0.85);
}

// ───────────────────── 17. Build everything that isn't a plant ─────────────────────
const BOATS = [];
const TUBE = { mesh: null, home: null, x: 0, z: 0, riding: false, s: 0, o: 0, spin: 0, idleT: 0 };
function buildProps() {
  const F = LAYOUT.F, R = LAYOUT.R, yaw0 = SPAWN.yaw;
  const gy = (p) => groundHeight(p.x, p.z);
  // --- sun loungers + umbrella ---
  // The loungers are a Blender model (models/lounger.py). Where you lie and where you get up come from its
  // anchors; each one's towel gets its own colour.
  const ch = LAYOUT.chairs;
  const lg = assetMeta('lounger'), lgSeat = assetAnchor('lounger', 'seat'), lgStand = assetAnchor('lounger', 'stand');
  const lgCol = (lg && lg.meta.collider) || { r: 0.45, top: 0.6 };
  for (const [i, stripe] of [[0, 0x1fb5ae], [1, 0xf06a50]]) {
    const p = local(ch, yaw0, 0, i ? 0.9 : -0.9);
    const y = gy(p);
    const m = assetModel('lounger', { static: true, tint: { towel: stripe } });
    if (m) {
      m.position.set(p.x, y, p.z); m.rotation.y = yaw0 + (i ? -0.08 : 0.06);
      m.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(_up, groundNormal(p.x, p.z)));   // it stands on the slope of the beach
      scene.add(m);
    }
    addCollider(p.x, p.z, lgCol.r, y + lgCol.top);
    const sp = lgSeat ? lgSeat.position : { x: 0, y: 1.05, z: 0.35 }, st = lgStand ? lgStand.position : { x: 1.3, z: 0 };
    const eye = local({ x: p.x, z: p.z, y }, yaw0, -sp.z, sp.x, sp.y), up = local(p, yaw0, -st.z, st.x);
    INTERACT.push({ x: p.x, z: p.z, y, r: 2.0, label: 'Relax on the sun lounger', short: 'Sit', eye: new THREE.Vector3(eye.x, eye.y, eye.z), yaw: yaw0, pitch: lgSeat ? lgSeat.data.pitch ?? 0.02 : 0.02, standX: up.x, standZ: up.z, kind: 'chair' });
  }
  const up = local(ch, yaw0, -0.6, 0);
  propMesh(umbrella(C.white, C.teal), up.x, gy(up) - 0.2, up.z, 0);
  addCollider(up.x, up.z, 0.15, gy(up) + 2.4);
  const bag = local(ch, yaw0, 0.6, 1.8);
  propMesh([bx(0.42, 0.32, 0.18, C.coral, 0, 0.16, 0), part(new THREE.TorusGeometry(0.12, 0.012, 4, 12, Math.PI), C.navy, 0, 0.32, 0)], bag.x, gy(bag), bag.z, rand(0, TAU));
  // --- towel ---
  const tw = LAYOUT.towel, ty = gy(tw);
  const towelMesh = propMesh(towel(C.yellow, C.white, C.coral), tw.x, ty + 0.01, tw.z, yaw0 + 0.15, { cast: false });
  towelMesh.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(_up, groundNormal(tw.x, tw.z)));
  INTERACT.push({ x: tw.x, z: tw.z, y: ty, r: 1.8, label: 'Sit on the towel', short: 'Sit', eye: new THREE.Vector3(tw.x, ty + 0.92, tw.z), yaw: yaw0 + 0.15, pitch: -0.02, kind: 'towel' });
  // --- sandcastle, lifebuoy, sign ---
  const cs = LAYOUT.castle; propMesh(sandcastle(), cs.x, gy(cs) - 0.12, cs.z, rand(0, TAU)); addCollider(cs.x, cs.z, 0.55, gy(cs) + 0.8);
  const lb = LAYOUT.buoy; propMesh(lifebuoyPost(), lb.x, gy(lb), lb.z, yaw0 + Math.PI); addCollider(lb.x, lb.z, 0.2, gy(lb) + 2);
  const sg = LAYOUT.sign, sgy = gy(sg);
  propMesh([bx(0.1, 2.0, 0.1, C.woodDark, -0.6, 1.0, 0), bx(0.1, 2.0, 0.1, C.woodDark, 0.6, 1.0, 0)], sg.x, sgy - 0.3, sg.z, yaw0 + Math.PI);
  const board = sign('Paradise Beach'); board.position.set(sg.x, sgy + 1.25, sg.z); board.rotation.y = yaw0 + Math.PI; board.castShadow = true; scene.add(board);
  addCollider(sg.x, sg.z, 0.7, sgy + 2);

  // --- dock ---
  const D = LAYOUT.dock, dyaw = yawFacing(D.dir);
  const dockParts = [];
  const n = Math.round(D.len / 0.32);
  for (let i = 0; i < n; i++) dockParts.push(bx(1.9, 0.06, 0.27, i % 7 === 3 ? C.woodDark : C.wood, 0, -0.03, -i * 0.32 - 0.16, 0, rand(-0.01, 0.01)));
  for (const sx of [-0.8, 0.8]) dockParts.push(bx(0.12, 0.18, D.len, C.woodDark, sx, -0.15, -D.len / 2));
  for (let i = 0; i <= D.len; i += 3.5) for (const sx of [-0.85, 0.85]) {
    const wp = local({ x: D.x, z: D.z }, dyaw, i, sx);
    const floor = groundHeight(wp.x, wp.z);
    const h = D.top - floor + 0.4;
    dockParts.push(cy(0.1, 0.12, h, 7, C.woodDark, sx, -h / 2 + 0.35, -i));
    if (floor < D.top - 0.8) addCollider(wp.x, wp.z, 0.13, D.top - 0.05);
  }
  // end platform and ladder
  dockParts.push(bx(4.2, 0.06, 3.2, C.wood, 0, -0.03, -D.len - 1.4));
  for (const sx of [-1.95, 1.95]) dockParts.push(cy(0.11, 0.12, 4.2, 7, C.woodDark, sx, -1.6, -D.len - 2.8));
  for (const sx of [-0.3, 0.3]) dockParts.push(bx(0.05, 2.1, 0.05, C.woodPale, sx, -0.6, -D.len - 3.05));
  for (let r = 0; r < 5; r++) dockParts.push(bx(0.6, 0.04, 0.04, C.woodPale, 0, -1.4 + r * 0.33, -D.len - 3.05));
  propMesh(dockParts, D.x, D.top, D.z, dyaw);
  const mid = local({ x: D.x, z: D.z }, dyaw, D.len / 2, 0);
  PLATFORMS.push({ x: mid.x, z: mid.z, hx: 0.95, hz: D.len / 2 + 0.2, rot: dyaw, top: D.top, wood: true, climb: true });
  const endc = local({ x: D.x, z: D.z }, dyaw, D.len + 1.4, 0);
  PLATFORMS.push({ x: endc.x, z: endc.z, hx: 2.1, hz: 1.6, rot: dyaw, top: D.top, wood: true, climb: true });
  const seatP = local({ x: D.x, z: D.z, y: D.top }, dyaw, D.len + 2.7, 0.9, 0);
  const seatEye = local({ x: D.x, z: D.z, y: D.top }, dyaw, D.len + 2.85, 0.9, 0.98);
  INTERACT.push({ x: seatP.x, z: seatP.z, y: D.top, r: 2.0, label: 'Sit on the end of the dock', short: 'Sit', eye: new THREE.Vector3(seatEye.x, seatEye.y, seatEye.z), yaw: dyaw, pitch: -0.08, standX: local({ x: D.x, z: D.z }, dyaw, D.len + 1.2, 0.9).x, standZ: local({ x: D.x, z: D.z }, dyaw, D.len + 1.2, 0.9).z, kind: 'dock' });
  // the motorboat, moored beside the dock end
  const bp = local({ x: D.x, z: D.z }, dyaw, D.len - 3, -3.2);
  const boat = buildMotorboat(); boat.position.set(bp.x, 0, bp.z); boat.rotation.y = dyaw; scene.add(boat);
  const mb = { mesh: boat, x: bp.x, z: bp.z, yaw: dyaw, size: 1.3, motor: true, speed: 0, yawRate: 0, y: -REST_WL, vy: 0, pitch: 0, roll: 0, home: { x: bp.x, z: bp.z, yaw: dyaw } };
  mb.seat = { x: bp.x, z: bp.z, y: D.top, r: 3.4, label: 'Drive the motorboat', short: 'Drive', kind: 'drive', boat: mb, anyMode: true, eye: new THREE.Vector3() };
  INTERACT.push(mb.seat);
  BOATS.push(mb); BOATS.motor = mb;
  // an inner tube waiting at the edge of the waterfall pool
  {
    const st = STREAM.lower[2] || STREAM.lower[0];
    const tx = st.x + st.tx * 1.5, tz = st.z + st.tz * 1.5;
    const tm = propMesh(tubeGeometry(), tx, st.S, tz, 0, { mat: propMatDouble });
    TUBE.mesh = tm; TUBE.home = { x: tx, z: tz }; TUBE.x = tx; TUBE.z = tz;
    TUBE.seat = { x: tx, z: tz, y: st.S, r: 3.0, label: 'Ride the river on the inner tube', short: 'Ride', kind: 'tube', anyMode: true, eye: new THREE.Vector3() };
    INTERACT.push(TUBE.seat);
  }
  // a footbridge where the trail crosses the river
  if (STREAM.crossing) {
    const { p, q } = STREAM.crossing;
    const ax = -q.tz, az = q.tx, half = q.W + 3.2;
    const e1 = { x: p.x + ax * half, z: p.z + az * half }, e2 = { x: p.x - ax * half, z: p.z - az * half };
    // arched high enough for the motorboat to pass underneath, with a longer, gentler span
    const top = Math.max(groundHeight(e1.x, e1.z), groundHeight(e2.x, e2.z), q.S + 0.5) + 0.05, arch = Math.max(0.55, q.S + 3.1 - top);
    const rot = Math.atan2(ax, az), parts = [];
    const nP = Math.round(half * 2 / 0.3);
    for (let i = 0; i < nP; i++) {
      const lz = -half + (i + 0.5) * (half * 2 / nP), y = arch * (1 - (lz / half) ** 2);
      const tilt = Math.atan(2 * arch * lz / (half * half));
      parts.push(bx(1.7, 0.07, (half * 2 / nP) / Math.cos(tilt) + 0.025, i % 6 === 2 ? C.woodDark : C.wood, 0, y - 0.035, lz, tilt));
    }
    for (const sx of [-0.92, 0.92]) for (let i = 0; i <= 6; i++) {
      const lz = -half + i * (half * 2 / 6), y = arch * (1 - (lz / half) ** 2);
      parts.push(bx(0.08, 1.0, 0.08, C.woodDark, sx, y + 0.45, lz));
      const fl = groundHeight(p.x + ax * lz + (-az) * sx, p.z + az * lz + ax * sx);
      if (fl < top + y - 1.2) parts.push(cy(0.09, 0.11, top + y - fl + 0.3, 6, C.woodDark, sx, (fl - top - 0.3 + y) / 2, lz));
      if (i < 6) { const lz2 = lz + half * 2 / 6, y2 = arch * (1 - (lz2 / half) ** 2), mid = (lz + lz2) / 2; parts.push(bx(0.06, 0.07, half * 2 / 6 + 0.05, C.woodPale, sx, (y + y2) / 2 + 0.92, mid, Math.atan2(y - y2, lz2 - lz))); }
    }
    propMesh(parts, p.x, top, p.z, rot);
    PLATFORMS.push({ x: p.x, z: p.z, hx: 0.9, hz: half, rot, top, arch, wood: true, climb: true });
  }
  // distant fishing boats
  for (const [fw, rt] of [[420, -160], [650, 210], [900, -40]]) {
    const p = LAYOUT.at(fw, rt);
    if (groundHeight(p.x, p.z) > -8) continue;
    const m = propMesh(fishingBoat(), p.x, 0, p.z, rand(0, TAU), { cast: false });
    BOATS.push({ mesh: m, x: p.x, z: p.z, yaw: m.rotation.y, size: 2.3 });
  }

  // --- hammock in the hidden cove ---
  const hm = LAYOUT.hammock, hy = gy(hm), hyaw = rand(0, TAU);
  const a = local({ x: hm.x, z: hm.z }, hyaw, 0, -2.4), b = local({ x: hm.x, z: hm.z }, hyaw, 0, 2.4);
  VEG.addPalm(a.x, a.z, 8.5, 0.12, Math.PI - hyaw, 1, true);
  VEG.addPalm(b.x, b.z, 9.5, 0.16, -hyaw, 1, true);
  const hamParts = [];
  {
    const NU = 20, NV = 8, pos = [], col = [], idx = [];
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const u = i / NU, v = j / NV - 0.5;
      const x = lerp(-1.75, 1.75, u), pinch = Math.pow(Math.sin(Math.PI * u), 0.6);
      const y = 1.45 - 0.75 * Math.sin(Math.PI * u) + v * v * 0.9 * pinch;
      const z = v * 1.0 * pinch;
      pos.push(x, y, z);
      const stripe = Math.floor((v + 0.5) * 7) % 2 ? C.coral : C.canvas; col.push(...stripe);
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + 1, c = a + NV + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const fabric = g.toNonIndexed(); fabric.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(fabric.attributes.position.count * 3), 3));
    const ci = g.index.array; for (let k = 0; k < ci.length; k++) fabric.attributes.color.setXYZ(k, col[ci[k] * 3], col[ci[k] * 3 + 1], col[ci[k] * 3 + 2]);
    fabric.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(fabric.attributes.position.count * 2), 2));
    hamParts.push(fabric);
    for (const sx of [-1, 1]) for (const sz of [-0.12, 0.12]) {
      const r = new THREE.CylinderGeometry(0.012, 0.012, 0.62, 4);
      r.rotateZ(sx * 1.2).translate(sx * 2.0, 1.58, sz);
      hamParts.push(prep(r, C.rope));
    }
  }
  const hamMesh = propMesh(hamParts, hm.x, hy, hm.z, hyaw);
  hamMesh.material = propMatDouble;
  const hamEye = new THREE.Vector3(hm.x, hy + 0.95, hm.z);
  INTERACT.push({ x: hm.x, z: hm.z, y: hy, r: 2.4, label: 'Lie in the hammock', short: 'Lie down', eye: hamEye, yaw: hyaw - Math.PI / 2, pitch: 0.55, sway: true, swayX: -Math.sin(hyaw) * 0.5, swayZ: -Math.cos(hyaw) * 0.5, kind: 'hammock', standX: local(hm, hyaw, 1.6, 0).x, standZ: local(hm, hyaw, 1.6, 0).z });

  // --- summit bench, facing the western sea ---
  const sm = LAYOUT.summit, smy = gy(sm), byaw = Math.PI / 2;
  propMesh(bench(), sm.x, smy - 0.05, sm.z, byaw);
  addCollider(sm.x, sm.z, 0.9, smy + 0.9);
  const be = local({ x: sm.x, z: sm.z, y: smy }, byaw, 0.1, 0, 1.12);
  INTERACT.push({ x: sm.x, z: sm.z, y: smy, r: 2.4, label: 'Sit on the bench', short: 'Sit', eye: new THREE.Vector3(be.x, be.y, be.z), yaw: byaw, pitch: -0.12, kind: 'bench', standX: local(sm, byaw, 1.3, 0).x, standZ: local(sm, byaw, 1.3, 0).z });

  // --- palm circle clearing ---
  if (LAYOUT.clearing) {
    const cl = LAYOUT.clearing;
    for (let i = 0; i < 9; i++) { const ang = i / 9 * TAU + rand(-0.1, 0.1); VEG.addPalm(cl.x + Math.cos(ang) * 12.5, cl.z + Math.sin(ang) * 12.5, rand(8, 11), rand(0.12, 0.22), ang + Math.PI, rand(0.9, 1.1), true); }
    const blanket = canvasTex(256, 256, (g) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#c94b3a' : '#f1e6d2'; g.fillRect(i * 32, j * 32, 32, 32); } });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.6).rotateX(-Math.PI / 2), patch(new THREE.MeshStandardMaterial({ map: blanket, roughness: 1 }), { key: 'blanket' }));
    const cly = gy(cl); bm.position.set(cl.x, cly + 0.03, cl.z); bm.receiveShadow = true; scene.add(bm);
    propMesh([bx(0.45, 0.28, 0.32, C.woodPale, 0, 0.14, 0), part(new THREE.TorusGeometry(0.17, 0.015, 4, 12, Math.PI), C.woodDark, 0, 0.28, 0)], cl.x + 0.7, cly, cl.z - 0.3, 0.4);
    INTERACT.push({ x: cl.x, z: cl.z, y: cly, r: 2.0, label: 'Sit on the picnic blanket', short: 'Sit', eye: new THREE.Vector3(cl.x, cly + 0.9, cl.z), yaw: rand(0, TAU), pitch: 0.05, kind: 'blanket' });
  }

  // --- rocks ---
  ROCKS.mat = rockMaterial();
  const rockDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  for (let k = 0; k < 4; k++) ROCKS.fields.push(new Field('rocks' + k, rockGeometry(k, k * 13.7, 3), ROCKS.mat, { chunk: 300, cast: true, pad: 8, density: false, lod: { geo: rockGeometry(k, k * 13.7, 2), dist: 70 } }));
  // rocky shores, half in the water
  for (let i = 0; i < 26000; i++) {
    const x = rand(-700, 600), z = rand(-600, 600), h = groundHeight(x, z);
    if (h < -4 || h > 9) continue;
    const k = vIndex(x, z), rock = T.mask[k * 4 + 2] / 255, L = T.L[k];
    if (rockyMask(x, z) < 0.35 || L > 40 || L < -25) continue;
    if (rng() > 0.05 * (0.3 + rock)) continue;
    placeRock(x, h - rand(0.2, 0.8), z, rand(0.8, 3.6) * (L < 0 ? 1.15 : 1), randInt(0, 3), true, rand(0, TAU), 0.5);
  }
  // pebbles and small rocks on the beaches
  for (let i = 0; i < 6000; i++) {
    const x = rand(-700, 600), z = rand(-600, 600), h = groundHeight(x, z);
    if (h < 0.15 || h > 2.6) continue;
    if (excluded(x, z, 1) || rng() > 0.08) continue;
    placeRock(x, h - 0.05, z, rand(0.12, 0.45), randInt(0, 3), false);
  }
  // jungle boulders, mossy
  for (let i = 0; i < 9000; i++) {
    const x = rand(-450, 500), z = rand(-500, 500), h = groundHeight(x, z);
    if (h < 6 || T.L[vIndex(x, z)] < 70 || excluded(x, z, 3) || nearTrail(x, z, 3)) continue;
    if (rng() > 0.03 + slopeAt(x, z) * 0.1) continue;
    placeRock(x, h - rand(0.3, 0.7), z, rand(0.5, 2.4), randInt(0, 3));
  }
  // the waterfall cliff and the pool's edge
  for (let al = -WF.halfLen * 0.8; al <= WF.halfLen * 0.8; al += rand(1.6, 3.0)) {
    if (Math.abs(al - ((STREAM.lip.z - WF.z) * WF.nx - (STREAM.lip.x - WF.x) * WF.nz)) < 4.8) continue;
    const into = rand(0.4, 1.6);
    const x = WF.x - WF.nz * al + WF.nx * into, z = WF.z + WF.nx * al + WF.nz * into;
    const h = groundHeight(x - WF.nx * 3, z - WF.nz * 3);
    placeRock(x, h + rand(-0.8, 2.5), z, rand(2.0, 4.4), randInt(0, 3), true, rand(0, TAU), 0.3);
    placeRock(x + WF.nx * 1.2, h + WF.height * rand(0.3, 0.55), z + WF.nz * 1.2, rand(1.8, 3.4), randInt(0, 3), false, rand(0, TAU), 0.4);
    if (rng() < 0.7) placeRock(x + WF.nx * 2.2, h + WF.height * rand(0.65, 0.95), z + WF.nz * 2.2, rand(1.6, 3.0), randInt(0, 3), false, rand(0, TAU), 0.4);
    if (rng() < 0.65 && VEG.ferns) { // ferns clinging to the wet rock
      const sf = rand(-1.4, 1.3), lx = WF.x - WF.nz * al + WF.nx * sf, lz = WF.z + WF.nx * al + WF.nz * sf;
      VEG.ferns.add(mtx(lx, groundHeight(lx, lz) - 0.1, lz, rand(0, TAU), rand(1.1, 2.0), rand(-0.5, 0.5), rand(-0.5, 0.5)), {}, new THREE.Color().setHSL(0.27, 0.4, 0.78));
    }
  }
  for (let i = 0; i < 22; i++) {
    const ang = rand(0, TAU); if (Math.cos(ang) > 0.75) continue;
    const r = POOL.r + rand(0.2, 2.5), x = POOL.x + Math.cos(ang) * r, z = POOL.z + Math.sin(ang) * r;
    if (nearStream(x, z, 0) && Math.cos(ang) < -0.8) continue;
    placeRock(x, groundHeight(x, z) - 0.3, z, rand(0.5, 1.6), randInt(0, 3));
  }
  // a flat rock to sit on by the falls
  {
    const ang = 2.3, x = POOL.x + Math.cos(ang) * (POOL.r + 2.2), z = POOL.z + Math.sin(ang) * (POOL.r + 2.2), h = groundHeight(x, z);
    placeRock(x, h - 0.25, z, 1.1, 1, false, 0, 0.02);
    const fy = Math.atan2(-(STREAM.fall.x - x), -(STREAM.fall.z - z));
    INTERACT.push({ x, z, y: h, r: 2.2, label: 'Sit by the waterfall', short: 'Sit', eye: new THREE.Vector3(x, h + 0.25 + 0.95, z), yaw: fy, pitch: 0.12, kind: 'rock' });
  }
  // headlands guarding the hidden cove
  for (const side of [-1, 1]) {
    const mouth = findAlong(BAY.x + side * (BAY.r * 0.62), BAY.z, 0, -1, h => h < -0.4, 160, 0.5);
    if (!mouth) continue;
    for (let i = 0; i < 7; i++) placeRock(mouth.x + side * rand(-3, 8), groundHeight(mouth.x, mouth.z) - rand(0.5, 1.5), mouth.z - rand(-4, 10), rand(2.5, 6), randInt(0, 3), true, rand(0, TAU), 0.3);
  }
  // rocks around the tide pools + a seat with a sunrise view
  for (const tp of TIDEPOOLS) for (let i = 0; i < 4; i++) { const a = rand(0, TAU), r = tp.r + rand(0.3, 1.4); placeRock(tp.x + Math.cos(a) * r, groundHeight(tp.x + Math.cos(a) * r, tp.z + Math.sin(a) * r) - 0.25, tp.z + Math.sin(a) * r, rand(0.4, 1.1), randInt(0, 3)); }
  {
    const rs = LAYOUT.rockSeat, h = groundHeight(rs.x, rs.z);
    placeRock(rs.x, h - 0.6, rs.z, 1.5, 0, false, 0, 0.05);
    INTERACT.push({ x: rs.x, z: rs.z, y: h, r: 2.4, label: 'Sit on the rocks', short: 'Sit', eye: new THREE.Vector3(rs.x, h + 0.45 + 0.95, rs.z), yaw: -Math.PI / 2, pitch: -0.1, kind: 'rock' });
  }
  // underwater boulders in the reef zones
  for (let i = 0; i < 4000; i++) {
    const x = rand(-750, 650), z = rand(-650, 650), h = groundHeight(x, z);
    if (h > -2.2 || h < -16 || rng() > 0.06) continue;
    placeRock(x, h - rand(0.2, 0.6), z, rand(0.6, 2.6), randInt(0, 3), true, rand(0, TAU), 0.4);
  }
  // sea stacks off the eastern cliffs
  for (let i = 0; i < 7; i++) {
    const ang = rand(-1.2, 0.5), d = rand(30, 110);
    const c = findAlong(Math.cos(ang) * 150, Math.sin(ang) * 150, Math.cos(ang), Math.sin(ang), h => h < -1, 600);
    if (!c) continue;
    const x = c.x + Math.cos(ang) * d, z = c.z + Math.sin(ang) * d, h = groundHeight(x, z);
    if (h < -14) continue;
    placeRock(x, h, z, rand(4, 7.5), 2, true, rand(0, TAU), 0.12);
    placeRock(x + rand(-4, 4), h, z + rand(-4, 4), rand(2, 4), randInt(0, 3), true);
  }
  // the sea arch: one weathered span of rock standing in the lagoon
  if (LAYOUT.arch) {
    const A = LAYOUT.arch, ayaw = yawFacing(A.dir);
    const R = 6.2, g = new THREE.TorusGeometry(R, 2.3, 14, 40, Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = Noise.n3(x * 0.35, y * 0.35, z * 0.35) * 0.9 + Noise.n3(x * 1.1, y * 1.1 + 3, z * 1.1) * 0.3;
      const ang = Math.atan2(y, x), ring = Math.hypot(x, y);
      const thick = 1 + 0.35 * (1 - Math.sin(ang)); // thicker legs, thinner crown
      const rx = Math.cos(ang) * (R + (ring - R) * thick), ry = Math.sin(ang) * (R + (ring - R) * thick);
      x = rx + n * Math.cos(ang); y = ry * 1.12 + n * Math.sin(ang); z = z * thick * 1.15 + n * 0.6;
      if (ry < 0.4) y -= 4.5 * (1 - ry / 0.4); // legs reach down into the seabed
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); smoothNormals(g);
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = 0.72 + Noise.n3(p.getX(i) * 0.8, p.getY(i) * 0.8, p.getZ(i) * 0.8) * 0.25; col.set([0.45 * v, 0.41 * v, 0.36 * v], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, ROCKS.mat);
    m.position.set(A.x, groundHeight(A.x, A.z) + 0.6, A.z); m.rotation.y = ayaw;
    m.castShadow = m.receiveShadow = true; scene.add(m);
    for (const s of [-1, 1]) { const q = local(A, ayaw, 0, s * R * 1.05); addCollider(q.x, q.z, 2.6, 12); placeRock(q.x + rand(-2, 2), groundHeight(q.x, q.z) - 0.5, q.z + rand(-2, 2), rand(1.2, 2.2), randInt(0, 3), false); }
  }

  // --- beach scatter: shells, starfish, driftwood, seaweed ---
  const shellG = (() => {
    const g = new THREE.ConeGeometry(0.06, 0.03, 9, 1).rotateX(Math.PI).translate(0, 0.012, 0).scale(1, 1, 1.25);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, p.getY(i) + Math.abs(Math.sin(a * 4.5)) * 0.004); }
    g.computeVertexNormals(); return prep(g);
  })();
  const starG = (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = i % 2 ? 0.035 : 0.11; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 }).rotateX(-Math.PI / 2);
    return prep(g);
  })();
  const driftG = (() => {
    const P = [cy(0.08, 0.12, 2.6, 7, C.drift, 0, 0.08, 0, 0, 0, Math.PI / 2), cy(0.03, 0.05, 0.9, 5, C.drift, 0.5, 0.25, 0.2, 0.6, 0.4, 1.0), cy(0.04, 0.06, 0.6, 5, C.drift, -0.9, 0.1, -0.15, 0, 0.3, 1.9)];
    return mergeGeos(P.map(p => { const q = new THREE.BufferGeometry(); for (const nm of ['position', 'normal', 'color', 'uv']) q.setAttribute(nm, p.attributes[nm]); return q; }));
  })();
  const weedTex = canvasTex(128, 128, (g, w, h) => {
    for (let i = 0; i < 26; i++) { g.strokeStyle = hsl(rand(40, 95), 35, rand(18, 30), 0.85); g.lineWidth = rand(1.2, 3); g.beginPath(); const x = rand(20, 108), y = rand(20, 108); g.moveTo(x, y); g.bezierCurveTo(x + rand(-30, 30), y + rand(-30, 30), x + rand(-30, 30), y + rand(-30, 30), x + rand(-40, 40), y + rand(-40, 40)); g.stroke(); }
  });
  const smallMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { key: 'small' });
  const weedMat = patch(new THREE.MeshStandardMaterial({ map: weedTex, alphaTest: 0.4, roughness: 0.5, side: THREE.DoubleSide }), { key: 'weed' });
  const shells = new Field('shells', shellG, smallMat, { chunk: 100, far: 40, nearMul: 0.45, pad: 1 });
  const stars = new Field('starfish', starG, smallMat, { chunk: 100, far: 50, nearMul: 0.55, pad: 1 });
  const drift = new Field('driftwood', driftG, propMat, { chunk: 200, cast: true, far: 160, nearMul: 1.8, pad: 3 });
  const weed = new Field('seaweed', (() => { const p = new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2).translate(0, 0.02, 0); return prep(p); })(), weedMat, { chunk: 100, far: 60, nearMul: 0.7, pad: 1 });
  const sc = new THREE.Color();
  const SHELL_COLS = [[0.82, 0.74, 0.64], [0.86, 0.62, 0.55], [0.75, 0.58, 0.42], [0.7, 0.66, 0.62], [0.88, 0.52, 0.4]];
  for (let i = 0; i < 60000; i++) {
    const x = rand(-700, 600), z = rand(-600, 600), h = groundHeight(x, z);
    if (h < -2.5 || h > 2.6 || rockyMask(x, z) > 0.6) continue;
    const r = rng();
    if (h > 0.15 && h < 1.4 && r < 0.016) { const c = pick(SHELL_COLS); shells.add(mtxAlign(x, h, z, rand(0, TAU), rand(0.7, 1.6), groundNormal(x, z)), {}, sc.setRGB(c[0], c[1], c[2])); }
    else if (h > 0.6 && h < 1.3 && r < 0.0318) weed.add(mtxAlign(x, h + 0.01, z, rand(0, TAU), rand(0.35, 0.8), groundNormal(x, z)));
    else if (r < 0.0365 && h < 0.9) stars.add(mtxAlign(x, h + 0.01, z, rand(0, TAU), rand(0.8, 1.4), groundNormal(x, z)), {}, sc.setHSL(rand(0.0, 0.08), 0.75, rand(0.45, 0.6)));
    else if (h > 1.4 && h < 2.6 && r < 0.0378 && !excluded(x, z, 2)) drift.add(mtxAlign(x, h + 0.02, z, rand(0, TAU), rand(0.6, 1.3), groundNormal(x, z), 0.7));
  }
  for (const tp of TIDEPOOLS) for (let i = 0; i < 3; i++) { const a = rand(0, TAU), r = rand(0, tp.r * 0.6); const x = tp.x + Math.cos(a) * r, z = tp.z + Math.sin(a) * r; stars.add(mtxAlign(x, groundHeight(x, z) + 0.01, z, rand(0, TAU), rand(1, 1.6), groundNormal(x, z)), {}, sc.setHSL(rand(0, 0.1), 0.8, 0.5)); }
  // a driftwood log to sit on at the little island
  {
    const ix = ISLET.x + 6, iz = ISLET.z - 4, ih = groundHeight(ix, iz);
    const m = new THREE.Mesh(driftG, propMat); m.position.set(ix, ih + 0.05, iz); m.scale.setScalar(1.4); m.castShadow = true; scene.add(m);
    INTERACT.push({ x: ix, z: iz, y: ih, r: 2.2, label: 'Sit on the driftwood', short: 'Sit', eye: new THREE.Vector3(ix, ih + 1.15, iz), yaw: yawFacing({ x: (SPAWN.x - ix) / Math.hypot(SPAWN.x - ix, SPAWN.z - iz), z: (SPAWN.z - iz) / Math.hypot(SPAWN.x - ix, SPAWN.z - iz) }), pitch: -0.03, kind: 'log' });
    if (VEG.palmSpots.filter(p => Math.hypot(p.x - ISLET.x, p.z - ISLET.z) < ISLET.r).length < 2) VEG.addPalm(ISLET.x - 3, ISLET.z + 2, 11, 0.3, Math.PI * 0.8, 1, true);
  }
  // hero palms that frame the first view
  {
    const p1 = LAYOUT.at(-2, -11), p2 = LAYOUT.at(5, 15), p3 = LAYOUT.at(-9, 9);
    const sea = Math.atan2(LAYOUT.F.z, LAYOUT.F.x);
    VEG.addPalm(p1.x, p1.z, 10.5, 0.42, sea + 0.5, 1.05, true);
    VEG.addPalm(p2.x, p2.z, 9, 0.48, sea - 0.4, 1, true);
    VEG.addPalm(p3.x, p3.z, 12, 0.2, sea + 0.1, 1.1, true);
  }
  buildDistantIslands();
}

function buildDistantIslands() {
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { key: 'distant', fog: 0.78, under: false });
  const spots = [[-3400, -900, 700, 260], [-4200, 1500, 1100, 380], [-2600, 2600, 450, 120], [600, 3900, 900, 300], [3600, -1400, 800, 200], [-1200, -4300, 1300, 420]];
  for (const [x, z, r, h] of spots) {
    const seg = 24;
    const geo = new THREE.BufferGeometry();
    const pos = [], col = [], idx = [];
    const seed = x * 0.001;
    for (let i = 0; i <= seg; i++) for (let j = 0; j < 48; j++) {
      const rr = (i / seg) * r * (1 + Noise.n2(Math.cos(j / 48 * TAU) * 2 + seed, Math.sin(j / 48 * TAU) * 2) * 0.25), a = j / 48 * TAU;
      const t = 1 - i / seg;
      const y = h * Math.pow(Math.sin(t * Math.PI / 2), 1.6) * (0.75 + 0.35 * Noise.n2(Math.cos(a) * 3 + seed, Math.sin(a) * 3 + i * 0.1)) - 6;
      pos.push(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr);
      const beach = i > seg - 2 ? 1 : 0;
      col.push(...(beach ? [0.62, 0.55, 0.42] : [0.11 + rng() * 0.03, 0.2 + rng() * 0.04, 0.09]));
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < 48; j++) { const a = i * 48 + j, b = i * 48 + (j + 1) % 48, c = a + 48, d = b + 48; idx.push(a, b, c, b, d, c); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); scene.add(m);
  }
}
function updateBoats(t, dt = 1 / 60) {
  for (const b of BOATS) {
    if (b.motor) {
      if (!b.driving) {
        // tied up at the dock: the lines pull it gently back to its berth
        const dh = Math.hypot(b.x - b.home.x, b.z - b.home.z);
        if (dh < 7 && !TSU.on) { b.x = damp(b.x, b.home.x, 0.5, dt); b.z = damp(b.z, b.home.z, 0.5, dt); let dy = b.home.yaw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * (1 - Math.exp(-0.5 * dt)); }
        b.speed = damp(b.speed, 0, 0.8, dt); b.yawRate = damp(b.yawRate, 0, 2, dt);
        b.x += -Math.sin(b.yaw) * b.speed * dt; b.z += -Math.cos(b.yaw) * b.speed * dt;
        boatPhysics(b, dt, 0);
        b.seat.x = b.x; b.seat.z = b.z;
      }
      updateMotorboatParts(b, dt, b.driving ? input.my : 0, b.driving ? input.mx : 0);
      continue;
    }
    if (b.driving) continue;
    if (b.seat) { b.seat.x = b.x; b.seat.z = b.z; }
    const y = oceanHeight(b.x, b.z, t);
    const s = 1.4 * b.size;
    const yf = oceanHeight(b.x - Math.sin(b.yaw) * s, b.z - Math.cos(b.yaw) * s, t), yb = oceanHeight(b.x + Math.sin(b.yaw) * s, b.z + Math.cos(b.yaw) * s, t);
    const yl = oceanHeight(b.x - Math.cos(b.yaw) * 0.6 * b.size, b.z + Math.sin(b.yaw) * 0.6 * b.size, t), yr = oceanHeight(b.x + Math.cos(b.yaw) * 0.6 * b.size, b.z - Math.sin(b.yaw) * 0.6 * b.size, t);
    b.mesh.position.y = y - 0.12 * b.size;
    b.mesh.rotation.set(Math.atan2(yf - yb, 2 * s) * 0.8, b.yaw, Math.atan2(yr - yl, 1.2 * b.size) * 0.8, 'YXZ');
  }
  // the inner tube bobs at the pool until someone takes it
  if (TUBE.mesh && !TUBE.riding) {
    TUBE.idleT += 0.016;
    const lvl = riverQuery(TUBE.x, TUBE.z);
    const y = (lvl ? lvl.S : POOL.level) + Math.sin(t * 1.3) * 0.03;
    TUBE.mesh.position.set(TUBE.x, y - 0.05, TUBE.z); TUBE.mesh.rotation.set(Math.sin(t * 0.9) * 0.04, t * 0.1, Math.cos(t * 1.1) * 0.04);
    TUBE.seat.x = TUBE.x; TUBE.seat.z = TUBE.z; TUBE.seat.y = y;
  }
}
