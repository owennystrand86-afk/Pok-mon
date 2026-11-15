
// ───────────────────── 18. Reef: coral, sponges, sea fans, seagrass ─────────────────────
const SEA = { schools: [], fish: null, count: 0, anemones: [] };
function branchCoral() {
  const parts = [];
  const grow = (x, y, z, dx, dy, dz, len, r, depth) => {
    const g = new THREE.CylinderGeometry(r * 0.7, r, len, 4, 1, true);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir));
    g.translate(x, y, z);
    parts.push(prep(g, [1, 1, 1], { aY: depth / 3 }, 0.12));
    const ex = x + dir.x * len, ey = y + dir.y * len, ez = z + dir.z * len;
    if (depth < 2) for (let k = 0; k < (depth === 0 ? 3 : 2); k++) {
      const nd = dir.clone().add(new THREE.Vector3(rand(-0.9, 0.9), rand(0.1, 0.6), rand(-0.9, 0.9))).normalize();
      grow(ex, ey, ez, nd.x, nd.y, nd.z, len * rand(0.65, 0.85), r * 0.72, depth + 1);
    } else parts.push(prep(new THREE.OctahedronGeometry(r * 1.1, 0).translate(ex, ey, ez), [1.15, 1.15, 1.15], { aY: 1 }));
  };
  grow(0, 0, 0, 0, 1, 0, 0.32, 0.07, 0);
  return mergeGeos(parts);
}
function brainCoral() {
  const g = new THREE.IcosahedronGeometry(0.5, 2);
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const groove = Math.abs(Math.sin(Noise.n3(x * 4, y * 4, z * 4) * 9));
    const r = 1 - groove * 0.06;
    y = Math.max(y * 0.68, -0.08);
    p.setXYZ(i, x * r, y * r, z * r);
    const v = 0.65 + groove * 0.45; col.set([v, v, v], i * 3);
  }
  g.computeVertexNormals(); smoothNormals(g);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aY', new THREE.BufferAttribute(new Float32Array(n), 1));
  return g;
}
function tableCoral() {
  const P = [prep(new THREE.CylinderGeometry(0.07, 0.12, 0.35, 6).translate(0, 0.17, 0), [0.9, 0.9, 0.9], { aY: 0 })];
  const top = new THREE.CylinderGeometry(0.75, 0.6, 0.07, 18, 1).translate(0, 0.38, 0);
  const tp = top.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i); tp.setY(i, tp.getY(i) + Math.hypot(x, z) * 0.12 + Noise.n2(x * 4, z * 4) * 0.03); }
  top.computeVertexNormals();
  P.push(prep(top, [1, 1, 1], { aY: 0.2 }, 0.08));
  return mergeGeos(P);
}
function tubeSponge() {
  const P = [];
  const k = randInt(3, 5);
  for (let i = 0; i < k; i++) {
    const h = rand(0.35, 0.9), r = rand(0.06, 0.11), a = rand(0, TAU), d = rand(0, 0.12);
    const g = new THREE.CylinderGeometry(r, r * 0.8, h, 7, 1, true).translate(Math.cos(a) * d, h / 2, Math.sin(a) * d);
    g.rotateZ(rand(-0.2, 0.2)).rotateX(rand(-0.2, 0.2));
    P.push(prep(g, [1, 1, 1], { aY: 0.5 }, 0.1));
  }
  return mergeGeos(P);
}
function anemoneGeometry() {
  const P = [prep(new THREE.CylinderGeometry(0.14, 0.18, 0.1, 10).translate(0, 0.05, 0), [0.85, 0.75, 0.7], { aY: 0 })];
  for (let i = 0; i < 22; i++) {
    const a = rand(0, TAU), d = Math.sqrt(rng()) * 0.13, h = rand(0.14, 0.26);
    const g = new THREE.ConeGeometry(0.012, h, 3).translate(0, h / 2, 0).rotateX(rand(-0.6, 0.6)).rotateZ(rand(-0.6, 0.6)).translate(Math.cos(a) * d, 0.09, Math.sin(a) * d);
    P.push(prep(g, [1.1, 1.1, 1.1], { aY: 1 }));
  }
  return mergeGeos(P);
}
function fanTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    const branch = (x, y, a, len, wd, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (d < 6) { branch(x2, y2, a - rand(0.2, 0.5), len * 0.78, wd * 0.75, d + 1); branch(x2, y2, a + rand(0.2, 0.5), len * 0.78, wd * 0.75, d + 1); }
    };
    branch(w / 2, h, -Math.PI / 2, 52, 7, 0);
    g.globalAlpha = 0.5; g.lineWidth = 1;
    for (let i = 0; i < 60; i++) { g.beginPath(); const y = rand(30, 230); g.moveTo(rand(20, 120), y); g.lineTo(rand(136, 236), y + rand(-20, 20)); g.stroke(); }
  });
}
const SEA_SWAY = /* glsl */`
  { vec3 ip = instPos(); float ph = ip.x * 0.7 + ip.z * 0.4;
    float k = aY * max(transformed.y, 0.0);
    transformed.x += sin(uTime * 1.1 + ph + transformed.y * 2.0) * 0.08 * k;
    transformed.z += cos(uTime * 0.9 + ph * 1.3) * 0.06 * k; }
`;
function buildSeaLife() {
  const coralMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }), { key: 'coral', vHead: 'attribute float aY;\n' + WIND_HEAD, vBegin: SEA_SWAY });
  const coralNoSway = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { key: 'coral2' });
  const fanMat = patch(new THREE.MeshStandardMaterial({ map: fanTexture(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8 }), { key: 'fan', vHead: 'attribute float aY;\n' + WIND_HEAD, vBegin: SEA_SWAY });
  const grassTex = makeGrassTexture();
  const seagrassMat = patch(new THREE.MeshLambertMaterial({ map: grassTex, alphaTest: 0.45, side: THREE.DoubleSide }), {
    key: 'seagrass', vHead: WIND_HEAD,
    vBegin: `{ vec3 ip = instPos(); float ph = ip.x * 0.5 + ip.z * 0.3; float k = max(transformed.y, 0.0);
      transformed.x += sin(uTime * 0.9 + ph) * 0.18 * k * k; transformed.z += cos(uTime * 0.7 + ph) * 0.12 * k * k; }`,
    fMap: ALPHA_MIP_FIX,
  });
  const o = { chunk: 150, far: 140, farMulQ: true, pad: 3 };
  const fields = {
    branch: new Field('coralBranch', branchCoral(), coralMat, o),
    brain: new Field('coralBrain', brainCoral(), coralNoSway, o),
    table: new Field('coralTable', tableCoral(), coralNoSway, o),
    tube: new Field('coralTube', tubeSponge(), coralMat, o),
    anem: new Field('anemone', anemoneGeometry(), coralMat, o),
    fan: new Field('seafan', (() => { const p = new THREE.PlaneGeometry(0.9, 0.9, 1, 3).translate(0, 0.45, 0); return prep(p, [1, 1, 1], { aY: 0.6 }); })(), fanMat, o),
    grass: new Field('seagrass', grassGeometry(), seagrassMat, { chunk: 120, far: 70, nearMul: 0.8, pad: 2 }),
  };
  SEA.fields = fields;
  const PAL = [[1.0, 0.42, 0.55], [1.0, 0.52, 0.2], [0.62, 0.32, 0.88], [1.0, 0.86, 0.28], [0.25, 0.8, 0.72], [0.92, 0.22, 0.18], [0.78, 0.6, 0.95], [0.6, 0.9, 0.3], [0.95, 0.9, 0.82], [0.2, 0.55, 0.95]];
  const c = new THREE.Color();
  const garden = LAYOUT.coralGarden;
  const reefs = [{ x: garden.x, z: garden.z, r: 55, k: 1 }, { x: ISLET.x + 60, z: ISLET.z - 30, r: 90, k: 0.8 }];
  if (LAYOUT.arch) reefs.push({ x: LAYOUT.arch.x, z: LAYOUT.arch.z, r: 35, k: 0.8 });
  reefs.push({ x: BAY.x, z: BAY.z - 20, r: 40, k: 0.6 });
  SEA.reefs = reefs;
  const reefAt = (x, z) => { let v = 0; for (const r of reefs) v = Math.max(v, r.k * (1 - smoothstep(r.r * 0.5, r.r, Math.hypot(x - r.x, z - r.z)))); return v; };
  for (let i = 0; i < 160000; i++) {
    let x, z;
    if (i % 3 === 0) { const r = pick(reefs), a = rand(0, TAU), d = Math.sqrt(rng()) * r.r; x = r.x + Math.cos(a) * d; z = r.z + Math.sin(a) * d; }
    else { x = rand(-780, 680); z = rand(-680, 680); }
    const h = groundHeight(x, z);
    if (h > -1.1 || h < -18) continue;
    const L = T.L[vIndex(x, z)];
    const patchy = smoothstep(0.05, 0.4, Noise.fbm(x * 0.018 + 20, z * 0.018, 3));
    const clump = smoothstep(-0.15, 0.35, Noise.fbm(x * 0.09 + 3, z * 0.09, 2));
    const dens = Math.max(reefAt(x, z), patchy * 0.35 * (L > -260 ? 1 : 0)) * (0.25 + 0.75 * clump);
    const r = rng();
    if (r > dens * 0.2) {
      if (h < -1.4 && h > -9 && rng() < 0.012 && Noise.fbm(x * 0.03, z * 0.03 + 4, 2) > 0.12) fields.grass.add(mtx(x, h - 0.05, z, rand(0, TAU), rand(0.6, 1.4)), {}, c.setHSL(rand(0.18, 0.26), 0.45, rand(0.45, 0.65)));
      continue;
    }
    const col = pick(PAL), s = rand(0.45, 1.15) * (1 + Math.min(1, -h / 10) * 0.5);
    c.setRGB(col[0], col[1], col[2]);
    const t = rng(), y = h - 0.05;
    const nrm = groundNormal(x, z);
    if (t < 0.3) fields.branch.add(mtxAlign(x, y, z, rand(0, TAU), s, nrm, 0.5), {}, c);
    else if (t < 0.48) fields.brain.add(mtxAlign(x, y, z, rand(0, TAU), s * 0.9, nrm, 0.8), {}, c);
    else if (t < 0.6) fields.table.add(mtxAlign(x, y, z, rand(0, TAU), s * 0.7, nrm, 0.3), {}, c);
    else if (t < 0.76) fields.tube.add(mtxAlign(x, y, z, rand(0, TAU), s * 0.9, nrm, 0.4), {}, c);
    else if (t < 0.9) fields.fan.add(mtx(x, y, z, rand(0, TAU), s * 1.1), {}, c);
    else { fields.anem.add(mtxAlign(x, y, z, rand(0, TAU), s * 0.9, nrm, 0.8), {}, (() => { const ac = pick([[0.95, 0.6, 0.85], [0.6, 0.95, 0.75], [1, 0.75, 0.5]]); return c.setRGB(ac[0], ac[1], ac[2]); })()); SEA.anemones.push({ x, y: y + 0.2 * s, z }); }
  }
  buildFish();
}

// ───────────────────── 19. Fish ─────────────────────
const SPECIES = [
  { name: 'yellow tang', c1: [1.0, 0.82, 0.08], c2: [1.0, 0.95, 0.6], pat: 0, size: 0.22, school: [3, 7], speed: 0.9 },
  { name: 'blue tang', c1: [0.1, 0.3, 0.95], c2: [1.0, 0.8, 0.1], pat: 3, size: 0.26, school: [2, 5], speed: 1.0 },
  { name: 'sergeant major', c1: [0.85, 0.85, 0.55], c2: [0.08, 0.08, 0.1], pat: 1, size: 0.17, school: [8, 16], speed: 1.1 },
  { name: 'silversides', c1: [0.78, 0.84, 0.9], c2: [0.15, 0.35, 0.6], pat: 2, size: 0.11, school: [30, 60], speed: 1.4 },
  { name: 'parrotfish', c1: [0.15, 0.75, 0.6], c2: [0.95, 0.45, 0.65], pat: 3, size: 0.5, school: [1, 1], speed: 0.7 },
  { name: 'butterflyfish', c1: [1.0, 0.92, 0.75], c2: [0.95, 0.75, 0.1], pat: 1, size: 0.15, school: [2, 2], speed: 0.8 },
  { name: 'clownfish', c1: [1.0, 0.42, 0.05], c2: [1.0, 1.0, 1.0], pat: 4, size: 0.1, school: [2, 3], speed: 0.6, anemone: true },
];
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.5, 9, 6).scale(0.2, 0.46, 1);
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.42, 0, 0.26, -0.78, 0, 0.02, -0.62, 0, 0, -0.42, 0, -0.02, -0.62, 0, -0.26, -0.78], 3));
  tail.computeVertexNormals();
  const dorsal = new THREE.BufferGeometry();
  dorsal.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.2, 0.18, 0, 0.36, -0.12, 0, 0.18, -0.28], 3));
  dorsal.computeVertexNormals();
  const fin = new THREE.BufferGeometry();
  fin.setAttribute('position', new THREE.Float32BufferAttribute([0.09, -0.04, 0.12, 0.2, -0.1, -0.05, 0.09, -0.05, -0.02, -0.09, -0.04, 0.12, -0.09, -0.05, -0.02, -0.2, -0.1, -0.05], 3));
  fin.computeVertexNormals();
  const g = mergeGeos([body, tail, dorsal, fin].map(x => { const q = x.index ? x.toNonIndexed() : x; const n = q.attributes.position.count; const r = new THREE.BufferGeometry(); r.setAttribute('position', q.attributes.position); r.setAttribute('normal', q.attributes.normal); r.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); return r; }));
  return g;
}
function buildFish() {
  const geo = fishGeometry();
  const groups = [];
  const reefs = SEA.reefs;
  const total = 620;
  const reefW = [0.42, 0.3, 0.15, 0.13];
  const pickReef = () => { let r = rng(); for (let k = 0; k < reefs.length; k++) { r -= reefW[k] || 0.1; if (r <= 0) return reefs[k]; } return reefs[0]; };
  let n = 0;
  const addGroup = (sp, home, size) => {
    if (n + size > total) return;
    groups.push({ sp, home, size, start: n, c: new THREE.Vector3(home.x, home.y, home.z), v: new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(sp.speed), ph: rand(0, 100), R: sp.anemone ? 0.5 : rand(6, 22) });
    n += size;
  };
  const reefPoint = (r) => {
    for (let k = 0; k < 40; k++) {
      const a = rand(0, TAU), d = Math.sqrt(rng()) * r.r, x = r.x + Math.cos(a) * d, z = r.z + Math.sin(a) * d, h = groundHeight(x, z);
      if (h < -1.8) return { x, y: Math.min(-0.9, h + rand(1, Math.min(4, -h - 0.8))), z };
    }
    return null;
  };
  // clownfish live in anemones near the reefs
  for (const an of SEA.anemones.slice(0, 18)) addGroup(SPECIES[6], { x: an.x, y: an.y + 0.15, z: an.z }, randInt(2, 3));
  for (let i = 0; i < 400 && n < total - 4; i++) {
    const sp = SPECIES[randInt(0, 5)];
    const p = reefPoint(pickReef()) || reefPoint(pickReef());
    if (!p) continue;
    addGroup(sp, p, randInt(sp.school[0], sp.school[1]));
  }
  SEA.count = n;
  const aPat = new Float32Array(n * 4), aCol2 = new Float32Array(n * 3);
  const mesh = new THREE.InstancedMesh(geo, patch(new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide }), {
    key: 'fish',
    vHead: 'attribute vec4 aPat; attribute vec3 aCol2; varying vec4 vPat; varying vec3 vCol2; varying vec3 vLoc;',
    vBegin: /* glsl */`
      vLoc = position; vPat = aPat; vCol2 = aCol2;
      float tw = clamp(0.5 - transformed.z, 0.0, 1.35);
      transformed.x += sin(uTime * (7.0 + aPat.z * 7.0) + aPat.y - transformed.z * 4.0) * 0.11 * tw * tw;`,
    fHead: 'varying vec4 vPat; varying vec3 vCol2; varying vec3 vLoc;',
    fColor: /* glsl */`
      { vec3 c1 = diffuseColor.rgb; vec3 c = c1; float p = vPat.x;
        if (p > 0.5 && p < 1.5) c = mix(c1, vCol2, step(0.62, fract(vLoc.z * 3.2 + 0.1)) * step(vLoc.z, 0.38));
        else if (p > 1.5 && p < 2.5) c = mix(c1, vCol2, smoothstep(0.02, 0.1, vLoc.y));
        else if (p > 2.5 && p < 3.5) c = mix(c1, vCol2, smoothstep(-0.25, -0.5, vLoc.z));
        else if (p > 3.5) { float b = 0.0; b = max(b, smoothstep(0.05, 0.03, abs(vLoc.z - 0.26))); b = max(b, smoothstep(0.06, 0.035, abs(vLoc.z + 0.02))); b = max(b, smoothstep(0.05, 0.03, abs(vLoc.z + 0.33)));
          float edge = max(smoothstep(0.075, 0.05, abs(vLoc.z - 0.26)) - b, 0.0) + max(smoothstep(0.085, 0.06, abs(vLoc.z + 0.02)) - b, 0.0);
          c = mix(mix(c1, vec3(0.05), edge), vCol2, b); }
        c = mix(c, c * 0.25 + 0.75, smoothstep(-0.02, -0.18, vLoc.y) * 0.55);
        if (vLoc.z > 0.36 && abs(vLoc.x) > 0.04 && vLoc.y > 0.02 && vLoc.y < 0.08) c = vec3(0.02);
        diffuseColor.rgb = c; }`,
  }), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  const col = new THREE.Color();
  for (const gp of groups) for (let i = 0; i < gp.size; i++) {
    const k = gp.start + i, sp = gp.sp;
    col.setRGB(sp.c1[0], sp.c1[1], sp.c1[2]); mesh.setColorAt(k, col);
    aPat.set([sp.pat, rand(0, TAU), rand(0.6, 1.2), sp.size], k * 4); aCol2.set(sp.c2, k * 3);
    gp.offs = gp.offs || [];
    const rr = sp.anemone ? 0.25 : Math.cbrt(gp.size) * sp.size * 3.2;
    gp.offs.push(new THREE.Vector3(rand(-1, 1) * rr, rand(-0.5, 0.5) * rr * 0.6, rand(-1, 1) * rr));
    mesh.setMatrixAt(k, mtx(gp.c.x, gp.c.y, gp.c.z, 0, sp.size * rand(0.85, 1.15)));
  }
  geo.setAttribute('aPat', new THREE.InstancedBufferAttribute(aPat, 4));
  geo.setAttribute('aCol2', new THREE.InstancedBufferAttribute(aCol2, 3));
  scene.add(mesh);
  SEA.fish = mesh; SEA.schools = groups; SEA.aPat = aPat;
}
const _fq = new THREE.Quaternion(), _fe = new THREE.Euler(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(), _fo = new THREE.Vector3(), _ft = new THREE.Vector3();
function updateSeaLife(dt, t) {
  if (!SEA.fish) return;
  const px = P.pos.x, py = P.pos.y, pz = P.pos.z;
  const mesh = SEA.fish;
  let dirty = false, near = false;
  for (const g of SEA.schools) {
    if (g.start >= mesh.count) continue;
    const dpl = Math.hypot(g.c.x - px, g.c.z - pz);
    if (dpl > 230) continue;
    dirty = true; if (dpl < 190) near = true;
    const sp = g.sp;
    // wander around home in a slow loop, staying in the water column
    const tx = g.home.x + Math.sin(t * 0.05 * sp.speed + g.ph) * g.R, tz = g.home.z + Math.cos(t * 0.037 * sp.speed + g.ph * 1.3) * g.R;
    const floor = groundHeight(g.c.x, g.c.z);
    const ty = clamp(g.home.y + Math.sin(t * 0.11 + g.ph) * 0.8, floor + 0.7, -0.7);
    _ft.set(tx - g.c.x, (ty - g.c.y) * 2, tz - g.c.z);
    const want = sp.anemone ? 0.25 : sp.speed;
    if (_ft.lengthSq() > 0.01) _ft.normalize().multiplyScalar(want);
    // shy of swimmers
    const dx = g.c.x - px, dy = g.c.y - py, dz = g.c.z - pz, dd = Math.hypot(dx, dy, dz);
    if (dd < 5.5 && !sp.anemone) { _ft.x += (dx / dd) * 3.5; _ft.y += (dy / dd) * 1.2; _ft.z += (dz / dd) * 3.5; }
    g.v.lerp(_ft, 1 - Math.exp(-dt * (dd < 5.5 ? 3 : 0.8)));
    g.c.addScaledVector(g.v, dt);
    const fl = groundHeight(g.c.x, g.c.z);
    // the water surface right now (a tsunami can pull the sea back off the reef)
    const surf = TSU.on ? oceanHeight(g.c.x, g.c.z, t) : 0;
    if (g.c.y < fl + 0.4) g.c.y = fl + 0.4;
    if (g.c.y > Math.min(-0.5, surf - 0.35)) g.c.y = Math.min(-0.5, surf - 0.35);
    // with no water left above the sea bed they're gone (fled to deeper water) until it comes back
    const dry = surf - fl < 0.6;
    if (dry !== !!g.dry) { g.dry = dry; }
    const yaw = Math.atan2(g.v.x, g.v.z), pitch = -Math.atan2(g.v.y, Math.hypot(g.v.x, g.v.z)) * 0.6;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    for (let i = 0; i < g.size; i++) {
      const k = g.start + i; if (k >= mesh.count) break;
      const o = g.offs[i];
      const wob = Math.sin(t * 1.3 + i * 1.7) * 0.15;
      _fo.set(o.x * cy + o.z * sy + wob, o.y + Math.sin(t * 0.9 + i) * 0.1, -o.x * sy + o.z * cy);
      _fp.copy(g.c).add(_fo);
      if (sp.anemone) _fp.set(g.home.x + Math.sin(t * 0.8 + i * 2) * 0.22, g.home.y + Math.sin(t * 1.3 + i) * 0.06, g.home.z + Math.cos(t * 0.7 + i * 2) * 0.22);
      const fyaw = sp.anemone ? t * 0.6 + i * 2.1 : yaw + Math.sin(t * 2 + i) * 0.12;
      _fe.set(pitch, fyaw, 0, 'YXZ'); _fq.setFromEuler(_fe);
      let s = SEA.aPat[k * 4 + 3];
      if (g.dry) s = 0;
      else if (TSU.on && _fp.y > oceanHeight(_fp.x, _fp.z, t) - 0.15) s = 0;   // never poking out of the water
      mesh.setMatrixAt(k, _m4.compose(_fp, _fq, _fs.set(s, s, s)));
    }
  }
  if (dirty) mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = near;
}
function applyLifeQuality() {
  if (SEA.fish) SEA.fish.count = Math.round(SEA.count * Q.fish);
  if (WILD.applyQuality) WILD.applyQuality();
}
