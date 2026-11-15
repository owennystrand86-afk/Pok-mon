
// ───────────────────── 6b. The wider ocean: deep water and other islands ─────────────────────
// Beyond the home island the sea floor falls away to the abyss, 400 m and more down, and six other
// islands lie scattered kilometres out: a smoking volcano, a lighthouse on a rock, a coral atoll with
// its lagoon, a sandy cay with a shipwreck on its reef, a pair of palm islets and a cliff-girt mesa.
const ISLANDS = [
  { name: 'Volcano Isle', sub: 'Black sand, and the mountain still smokes', x: 2350, z: -1450, r: 430, H: 330, type: 'volcano', seed: 1.3 },
  { name: 'Lighthouse Rock', sub: 'Its light sweeps the sea at night', x: -320, z: -1950, r: 75, H: 34, type: 'rock', seed: 4.1 },
  { name: 'Coral Atoll', sub: 'A ring of sand round a turquoise lagoon', x: -2650, z: 950, r: 380, w: 55, H: 3.2, type: 'atoll', seed: 2.7 },
  { name: 'Shipwreck Cay', sub: 'Something ran aground on the reef', x: 950, z: 2150, r: 115, H: 4.5, type: 'cay', seed: 5.9 },
  { name: 'Twin Palms', sub: 'Two little islands, one channel', x: -1750, z: -700, r: 62, H: 5, type: 'twin', seed: 7.2 },
  { name: 'Mesa Island', sub: 'Sheer cliffs and a grassy top', x: 2650, z: 1550, r: 270, H: 95, type: 'mesa', seed: 3.4 },
];
const FAR = { size: 16000, res: 512, tex: null, reach: 3700 };
const ABYSS = { x: -600, z: 2800, r: 720, depth: 1650 };   // a great sinkhole in the sea floor, south-west
// the deep floor, without any island
function farBase(x, z) {
  const r = Math.hypot(x, z);
  let h = -(46 + 380 * smoothstep(950, 2600, r)) + Noise.fbm(x * 0.0012, z * 0.0012, 3) * 18 * smoothstep(900, 1800, r);
  const da = Math.hypot(x - ABYSS.x, z - ABYSS.z) * (1 + 0.12 * Noise.fbm(x * 0.002, z * 0.002, 3));
  if (da < ABYSS.r) h -= (ABYSS.depth - 420) * Math.pow(1 - smoothstep(ABYSS.r * 0.18, ABYSS.r, da), 1.4);
  return h;
}
const _ifo = { L: 0, h: 0 };
// one island's shape: how far inside its coast (L, negative out at sea) and the height there
function islandAt(I, x, z, o = _ifo) {
  const dx = x - I.x, dz = z - I.z;
  let d = Math.hypot(dx, dz);
  if (d > I.r + 650) return null;
  const a = Math.atan2(dz, dx);
  const wob = 1 + 0.16 * Noise.fbm(Math.cos(a) * 1.4 + I.seed, Math.sin(a) * 1.4 - I.seed, 3) + 0.05 * Noise.fbm(x * 0.02, z * 0.02, 2);
  let L;
  if (I.type === 'atoll') L = I.w * wob - Math.abs(d - I.r);
  else if (I.type === 'twin') { const ox = I.r * 1.25; L = Math.max(I.r * wob - Math.hypot(dx - ox, dz), I.r * 0.85 * wob - Math.hypot(dx + ox, dz + 20)); }
  else L = I.r * wob - d;
  let h;
  if (L < 0) {
    const t = -L;
    h = -(1.6 * (1 - Math.exp(-t / 16)) + 3.2 * smoothstep(15, 110, t) + 40 * smoothstep(90, 520, t));
    if (I.type === 'atoll' && d < I.r) h = Math.max(h, -6 - 3 * smoothstep(I.r - I.w * 2, I.r * 0.4, I.r - d) + Noise.fbm(x * 0.03, z * 0.03, 2) * 1.2);   // the lagoon
  } else {
    const beach = 2.2 * (1 - Math.exp(-L / 18));
    if (I.type === 'volcano') {
      const t = clamp(L / (I.r * wob), 0, 1);
      const rib = Math.abs(Math.sin(a * 9 + d * 0.01));
      h = beach + I.H * Math.pow(t, 1.55) * (0.85 + 0.15 * rib);
      if (d < I.r * 0.13) h -= (I.H * 0.22) * (1 - Math.pow(d / (I.r * 0.13), 2));   // the crater
      h += (Noise.ridged(x * 0.02, z * 0.02, 4) - 0.45) * 12 * smoothstep(0.1, 0.5, t);
    } else if (I.type === 'mesa') {
      h = beach + I.H * smoothstep(I.r * 0.12, I.r * 0.24, L) + Noise.fbm(x * 0.03, z * 0.03, 3) * 3 * smoothstep(I.r * 0.24, I.r * 0.4, L);
    } else if (I.type === 'rock') {
      h = beach * 0.4 + I.H * Math.pow(smoothstep(0, I.r * 0.55, L), 0.6) + (Noise.ridged(x * 0.06, z * 0.06, 3) - 0.45) * 5;
    } else {
      h = beach + I.H * smoothstep(8, 60, L) * (0.6 + 0.4 * (Noise.fbm(x * 0.04 + I.seed, z * 0.04, 3) * 0.5 + 0.5));
    }
  }
  o.L = L; o.h = h;
  return o;
}
const _ff = { h: 0, L: -200, I: null };
// the whole far field: the deep floor and whichever island rises from it
function farField(x, z, o = _ff) {
  let h = farBase(x, z), L = -200, best = null;
  for (const I of ISLANDS) {
    const r = islandAt(I, x, z); if (!r) continue;
    if (r.h > h) h = r.h;
    if (r.L > L) { L = r.L; best = I; }
  }
  o.h = h; o.L = L; o.I = best;
  return o;
}
const farHeight = (x, z) => farField(x, z).h;
// a texture of the far field for the water shaders (depth, foam and surf round the islands)
function buildFarTexture() {
  const n = FAR.res, hd = new Uint16Array(n * n * 2), c = FAR.size / n, x0 = -FAR.size / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * c, z = x0 + (j + 0.5) * c, f = farField(x, z), k = (j * n + i) * 2;
    hd[k] = THREE.DataUtils.toHalfFloat(f.h); hd[k + 1] = THREE.DataUtils.toHalfFloat(clamp(f.L, -200, 200));
  }
  const t = new THREE.DataTexture(hd, n, n, THREE.RGFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  U.uFarTex.value = t; U.uFarRect.value.set(x0, x0, 1 / FAR.size, 0);
  FAR.tex = t;
}
// ---- the islands' ground ----
function islandColor(I, h, slope, L, x, z) {
  const n = Noise.fbm(x * 0.05, z * 0.05, 2) * 0.5 + 0.5;
  const black = I.type === 'volcano';
  const sand = black ? [0.16, 0.15, 0.15] : [0.78, 0.7, 0.53];
  const wetSand = black ? [0.1, 0.1, 0.1] : [0.6, 0.53, 0.4];
  const grass = black ? [0.2, 0.3, 0.12] : I.type === 'mesa' ? [0.36, 0.42, 0.18] : [0.24, 0.42, 0.14];
  const rock = black ? [0.17, 0.15, 0.14] : [0.45, 0.42, 0.38];
  let c;
  if (h < 0.4) c = wetSand;
  else if (h < 2.6 || L < 14) c = sand;
  else c = grass.map((v, i) => lerp(v, rock[i], smoothstep(0.35, 0.6, slope)));
  if (black && h > I.H * 0.55) c = rock.map((v, i) => lerp(v, [0.35, 0.2, 0.15][i], smoothstep(0.8, 0.95, h / I.H)));
  if (h < -0.5) c = c.map((v, i) => lerp(v, [0.72, 0.66, 0.5][i] * (black ? 0.45 : 1), 0.5));
  return c.map(v => v * (0.88 + 0.24 * n));
}
function buildIslandMesh(I) {
  const ext = I.r + (I.type === 'twin' ? 260 : 320), seg = I.r > 300 ? 230 : I.r > 100 ? 170 : 130, c = (ext * 2) / seg;
  const g = new THREE.PlaneGeometry(ext * 2, ext * 2, seg, seg).rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const H = new Float32Array(p.count), Ls = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + I.x, z = p.getZ(i) + I.z, f = farField(x, z); H[i] = f.h; Ls[i] = f.L; p.setXYZ(i, x, f.h, z); }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const cc = islandColor(I, H[i], 1 - nr.getY(i), Ls[i], p.getX(i), p.getZ(i)); col.set(cc, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), {
    key: 'island-ground', fColor: '{ float nn = texture2D(uNoiseTex, vWPos.xz * 0.21).r * 0.6 + texture2D(uNoiseTex, vWPos.xz * 0.9).g * 0.4; diffuseColor.rgb *= 0.86 + 0.28 * nn; }',
  }));
  m.receiveShadow = true; m.castShadow = true; scene.add(m);
  return m;
}
// ---- what grows and stands on them ----
function farPalmGeometry() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 7, 7, 6, true); const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) + 3.5; tp.setX(i, tp.getX(i) + Math.pow(y / 7, 2) * 0.8); tp.setY(i, y); }
  trunk.computeVertexNormals();
  const parts = [prep(trunk, [0.45, 0.36, 0.26])];
  for (let k = 0; k < 8; k++) {
    const f = new THREE.PlaneGeometry(0.8, 3.4, 1, 4); const fp = f.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i) + 1.7; fp.setZ(i, -y * y * 0.12); fp.setY(i, y); }
    f.rotateX(-1.1); f.rotateY((k / 8) * TAU); f.translate(0.8, 7.0, 0);
    parts.push(prep(f, [0.2, 0.42, 0.14], {}, 0.15));
  }
  return mergeGeos(parts);
}
function farTreeGeometry() {
  const can = new THREE.IcosahedronGeometry(2.8, 1); const cp = can.attributes.position;
  for (let i = 0; i < cp.count; i++) { const k = 0.85 + 0.3 * Math.sin(cp.getX(i) * 3 + cp.getZ(i) * 2); cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k * 0.8 + 5.5, cp.getZ(i) * k); }
  can.computeVertexNormals();
  return mergeGeos([prep(new THREE.CylinderGeometry(0.2, 0.32, 4.4, 6).translate(0, 2.2, 0), [0.36, 0.27, 0.2]), prep(can, [0.18, 0.34, 0.12], {}, 0.2)]);
}
function farLighthouse(I) {
  // on the top of the rock
  let bx0 = I.x, bz0 = I.z, top = -99;
  for (let a = 0; a < 40; a++) { const x = I.x + rand(-25, 25), z = I.z + rand(-25, 25), h = farHeight(x, z); if (h > top) { top = h; bx0 = x; bz0 = z; } }
  const P = [];
  for (let k = 0; k < 8; k++) P.push(part(new THREE.CylinderGeometry(2.6 - (k + 1) * 0.15, 2.6 - k * 0.15, 2.5, 20), k % 2 ? [0.85, 0.12, 0.1] : [0.95, 0.95, 0.93], 0, 1.25 + k * 2.5, 0));
  P.push(part(new THREE.CylinderGeometry(1.9, 1.9, 0.3, 20), [0.15, 0.15, 0.16], 0, 20.2, 0), part(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 4), [0.15, 0.15, 0.16], 1.8, 20.9, 0));
  P.push(part(new THREE.ConeGeometry(1.6, 1.6, 16), [0.85, 0.12, 0.1], 0, 23.6, 0));
  P.push(part(new THREE.BoxGeometry(6, 3.2, 5), [0.92, 0.9, 0.86], 5.5, 1.6, 2), part(new THREE.BoxGeometry(6.4, 0.3, 5.4), [0.4, 0.15, 0.12], 5.5, 3.3, 2));
  const tower = new THREE.Mesh(mergeGeos(P), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { key: 'lighthouse' }));
  tower.position.set(bx0, top - 0.3, bz0); tower.castShadow = true; scene.add(tower);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 16), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.85, toneMapped: false }));
  lamp.position.set(bx0, top + 21.6, bz0); scene.add(lamp);
  // the sweeping beams
  const beams = new THREE.Group(); beams.position.copy(lamp.position); scene.add(beams);
  const len = 260, bg = new THREE.ConeGeometry(Math.tan(0.05) * len, len, 24, 1, true).translate(0, -len / 2, 0).rotateZ(Math.PI / 2);
  const bm = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uLen: { value: len } },
    vertexShader: 'varying vec3 vL; varying vec3 vNv; varying vec3 vVv; void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vNv = normalize(normalMatrix * normal); vVv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uK; uniform float uLen; varying vec3 vL; varying vec3 vNv; varying vec3 vVv; void main(){ float t = clamp(abs(vL.x) / uLen, 0.0, 1.0); float a = uK * pow(abs(dot(normalize(vNv), normalize(vVv))), 1.5) * pow(1.0 - t, 1.6); gl_FragColor = vec4(vec3(1.0, 0.96, 0.82) * a, 0.0); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  for (const s of [1, -1]) { const b = new THREE.Mesh(bg, bm); b.scale.x = s; b.frustumCulled = false; beams.add(b); }
  FAR.lighthouse = { beams, lamp, bm };
}
function farShipwreck(I) {
  const x = I.x + I.r + 60, z = I.z + 70, y = farHeight(x, z);
  const P = [];
  const hull = new THREE.CylinderGeometry(4, 3.2, 34, 16, 1, true, 0, Math.PI).rotateZ(Math.PI).rotateX(Math.PI / 2);
  P.push(part(hull, [0.28, 0.18, 0.12], 0, 3, 0));
  for (let k = -6; k <= 6; k++) P.push(part(new THREE.TorusGeometry(3.7, 0.18, 4, 12, Math.PI).rotateZ(Math.PI), [0.32, 0.2, 0.13], 0, 3, k * 2.6, 0, 0, 0));
  P.push(part(new THREE.BoxGeometry(7, 0.3, 14), [0.36, 0.25, 0.16], 0, 4.2, -6), part(new THREE.CylinderGeometry(0.3, 0.35, 16, 8), [0.3, 0.2, 0.13], 0, 10, -3, 0.25, 0, 0.2));
  const m = new THREE.Mesh(mergeGeos(P), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), { key: 'wreck' }));
  m.position.set(x, y - 1.6, z); m.rotation.set(0.18, 0.7, 0.35); m.castShadow = true; scene.add(m);
  PLACES.wreck = { x, z, r: 40, name: 'The Wreck', sub: 'An old trader, broken on the reef' };
}
// soft clouds caught on the home island's summit
function buildSummitClouds() {
  const tex = canvasTex(128, 128, c => { for (let i = 0; i < 9; i++) { const x = 30 + Math.random() * 68, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); } });
  const top = groundHeight(196, -92); FAR.clouds = [];
  for (let k = 0; k < 9; k++) {
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.55, color: 0xffffff });
    const s = new THREE.Sprite(m); const a = k / 9 * TAU, d = 40 + Math.random() * 70;
    s.position.set(196 + Math.cos(a) * d, top - 10 + Math.random() * 40, -92 + Math.sin(a) * d); s.scale.setScalar(70 + Math.random() * 60); s.renderOrder = 9;
    s.userData = { a, d, y: s.position.y, sp: 0.01 + Math.random() * 0.02 }; scene.add(s); FAR.clouds.push(s);
  }
}
function buildIslands() {
  buildSummitClouds();
  const palms = [], trees = [], r = mulberry32(9137);
  for (const I of ISLANDS) {
    buildIslandMesh(I);
    PLACES['isle' + I.name] = { x: I.x, z: I.z, r: I.r + 40, name: I.name, sub: I.sub };
    // vegetation: palms on the beaches and low ground, round trees inland
    const tries = I.type === 'atoll' ? 900 : I.type === 'twin' ? 120 : Math.min(1400, I.r * 3.2);
    for (let k = 0; k < tries; k++) {
      const a = r() * TAU, d = Math.sqrt(r()) * (I.r + (I.type === 'atoll' ? I.w : 0)) * (I.type === 'twin' ? 2.4 : 1.05);
      const x = I.x + Math.cos(a) * d - (I.type === 'twin' ? 0 : 0), z = I.z + Math.sin(a) * d;
      const f = farField(x, z); if (f.I !== I || f.h < 1.2) continue;
      const e = 2, sl = Math.abs(farHeight(x + e, z) - f.h) + Math.abs(farHeight(x, z + e) - f.h);
      if (sl > 2.4) continue;
      if (I.type === 'volcano' && f.h > I.H * 0.5) continue;
      if ((f.h < 6 || f.L < 30) && I.type !== 'mesa') { if (r() < 0.6) palms.push([x, f.h, z, r() * TAU, 0.8 + r() * 0.5]); }
      else if (r() < 0.75) trees.push([x, f.h, z, r() * TAU, 0.8 + r() * 0.7]);
    }
    if (I.type === 'rock') farLighthouse(I);
    if (I.type === 'cay') farShipwreck(I);
    if (I.type === 'volcano') FAR.volcano = { x: I.x, z: I.z, y: farHeight(I.x + I.r * 0.13, I.z) };
  }
  const sway = '{ float sway = max(transformed.y - 4.0, 0.0) * 0.012 * (1.0 + uWind); transformed.x += sin(uTime * 1.3 + instanceMatrix[3][0] * 0.1) * sway; transformed.z += cos(uTime * 1.1 + instanceMatrix[3][2] * 0.1) * sway * 0.6; }';
  const inst = (geo, list, key, opts = {}) => {
    const im = new THREE.InstancedMesh(geo, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: opts.side || THREE.FrontSide, flatShading: !!opts.flat }), { key, vBegin: opts.sway ? sway : '' }), list.length);
    list.forEach((s, i) => im.setMatrixAt(i, mtx(s[0], s[1] - 0.2, s[2], s[3], s[4])));
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
    for (const s of list) COLLIDERS.add(s[0], s[2], { x: s[0], z: s[2], r: 0.35, top: s[1] + 6 });
  };
  inst(farPalmGeometry(), palms, 'far-palm', { sway: true, side: THREE.DoubleSide });
  inst(farTreeGeometry(), trees, 'far-tree', { flat: true });
}
// the deep floor beyond the home island (the islands have their own ground)
function farFloorGeometry() {
  const fg = new THREE.PlaneGeometry(FAR.size * 1.8, FAR.size * 1.8, 200, 200).rotateX(-Math.PI / 2), fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) fp.setY(i, Math.min(farBase(fp.getX(i), fp.getZ(i)), -46));
  fg.computeVertexNormals();
  return fg;
}
// smoke over the volcano, the lighthouse beams at night
function updateFar(dt) {
  if (FAR.clouds) for (const c of FAR.clouds) { const u = c.userData; u.a += dt * u.sp; c.position.x = 196 + Math.cos(u.a) * u.d; c.position.z = -92 + Math.sin(u.a) * u.d; c.material.opacity = 0.5 * (0.35 + 0.65 * ENV.daylight) * (1 - (WX.cur.rain || 0) * 0.3); c.material.color.setRGB(SKY.uCloudLit.value.x, SKY.uCloudLit.value.y, SKY.uCloudLit.value.z, THREE.SRGBColorSpace); }
  const L = FAR.lighthouse, night = 1 - smoothstep(0.1, 0.45, ENV.daylight);
  if (L) { L.beams.rotation.y += dt * 0.6; L.beams.visible = night > 0.02; L.bm.uniforms.uK.value = night * 0.35; L.lamp.material.color.setScalar(0.5 + night * 1.5); }
  const V = FAR.volcano;
  if (V && FX.spawn && Math.hypot(camera.position.x - V.x, camera.position.z - V.z) < 2600 && rng() < dt * 4)
    FX.spawn(V.x + rand(-20, 20), V.y + rand(0, 10), V.z + rand(-20, 20), U.uWindDir.value.x * 2 + rand(-1, 1), rand(3, 6), U.uWindDir.value.y * 2 + rand(-1, 1), rand(8, 14), rand(25, 45), 2, -0.2);
}
