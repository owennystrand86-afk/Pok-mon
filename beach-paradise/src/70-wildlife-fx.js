
// ───────────────────── 21. Wildlife: birds, crabs, butterflies, fireflies ─────────────────────
const WILD = { birds: [], crabs: [], flies: [] };
function birdGeometry() {
  const P = [];
  const body = prep(new THREE.SphereGeometry(0.5, 8, 6).scale(0.15, 0.13, 0.6), [1, 1, 1], { aWing: 0 });
  const head = prep(new THREE.SphereGeometry(0.075, 6, 5).translate(0, 0.06, 0.3), [1, 1, 1], { aWing: 0 });
  const beak = prep(new THREE.ConeGeometry(0.018, 0.08, 4).rotateX(Math.PI / 2).translate(0, 0.05, 0.4), [1, 0.75, 0.2], { aWing: 0 });
  const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.01, -0.24, -0.09, 0, -0.42, 0.09, 0, -0.42], 3)); tail.computeVertexNormals();
  P.push(body, head, beak, prep(tail, [0.95, 0.95, 0.95], { aWing: 0 }));
  for (const s of [-1, 1]) {
    const pts = [[0.06, 0, 0.12], [0.06, 0, -0.1], [0.45, 0.02, 0.08], [0.45, 0.02, -0.12], [0.86, 0, -0.04], [0.86, 0, -0.16]];
    const pos = [], col = [], aw = [];
    const tri = (a, b, c) => { for (const i of [a, b, c]) { const q = pts[i]; pos.push(q[0] * s, q[1], q[2]); aw.push(s * q[0] / 0.86); const tip = q[0] > 0.6; col.push(...(tip ? [0.13, 0.13, 0.15] : [0.74, 0.76, 0.8])); } };
    tri(0, 2, 1); tri(1, 2, 3); tri(2, 4, 3); tri(3, 4, 5);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(aw, 1));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    P.push(g);
  }
  return mergeGeos(P.map(p => { const q = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'color', 'uv', 'aWing']) q.setAttribute(n, p.attributes[n]); return q; }));
}
function crabGeometry() {
  const P = [prep(new THREE.SphereGeometry(0.5, 9, 6).scale(0.13, 0.055, 0.1).translate(0, 0.06, 0), [1, 1, 1], { aLeg: 0 })];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -0.035 + i * 0.024;
      const g = new THREE.BoxGeometry(0.1, 0.012, 0.012).translate(0.05, 0, 0).rotateZ(-0.6).translate(0.055, 0.06, z);
      if (s < 0) g.scale(-1, 1, 1);
      P.push(prep(g, [0.9, 0.9, 0.9], { aLeg: i + 1 + (s > 0 ? 4 : 0) }));
    }
    P.push(prep(new THREE.SphereGeometry(0.028, 6, 4).scale(1, 0.7, 1.3).translate(s * 0.07, 0.07, 0.085), [1, 1, 1], { aLeg: 0 }));
    P.push(prep(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4).translate(s * 0.025, 0.1, 0.05), [0.3, 0.3, 0.3], { aLeg: 0 }));
  }
  return mergeGeos(P.map(p => { const q = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'color', 'uv', 'aLeg']) q.setAttribute(n, p.attributes[n]); return q; }));
}
function butterflyTexture() {
  return canvasTex(128, 64, (g, w, h) => {
    for (const s of [-1, 1]) {
      g.save(); g.translate(w / 2, h / 2); g.scale(s, 1);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(26, -10, 25, 18, -0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(20, 12, 17, 14, 0.5, 0, TAU); g.fill();
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 4; g.beginPath(); g.ellipse(26, -10, 25, 18, -0.5, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(20, 12, 17, 14, 0.5, 0, TAU); g.stroke();
      g.fillStyle = '#1a1a1a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(38 + i * 3, -18 + i * 5, 2, 0, TAU); g.fill(); }
      g.restore();
    }
    g.fillStyle = '#222'; g.fillRect(w / 2 - 2, h / 2 - 12, 4, 24);
  });
}
function buildWildlife() {
  // ---- birds ----
  const bg = birdGeometry();
  const nB = 26;
  const aBird = new Float32Array(nB * 4);
  bg.setAttribute('aBird', new THREE.InstancedBufferAttribute(aBird, 4).setUsage(THREE.DynamicDrawUsage));
  const bmat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), {
    key: 'bird', vHead: 'attribute float aWing; attribute vec4 aBird;',
    vBegin: /* glsl */`{ float lift = abs(aWing);
      float fa = sin(uTime * aBird.w + aBird.x);
      transformed.x = mix(transformed.x, transformed.x * 0.16, aBird.z);
      transformed.y += mix(fa * aBird.y * 0.5 * pow(lift, 1.3) + 0.1 * lift * (1.0 - aBird.y), 0.05 * lift, aBird.z);
      transformed.z += mix(0.0, -0.12 * lift, aBird.z); }`,
  });
  const birds = new THREE.InstancedMesh(bg, bmat, nB);
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); birds.frustumCulled = false; birds.castShadow = true;
  scene.add(birds); WILD.birdMesh = birds; WILD.aBird = aBird;
  const coast = [];
  for (let i = 0; i < 3000 && coast.length < 40; i++) { const x = rand(-700, 550), z = rand(-560, 560), h = groundHeight(x, z); if (h > 0 && h < 1.5) coast.push({ x, z }); }
  const col = new THREE.Color();
  const near = (p, r) => ({ x: p.x + rand(-r, r), z: p.z + rand(-r, r) });
  for (let i = 0; i < nB; i++) {
    let b;
    if (i < 14) { // gulls over the shore
      const a = i < 4 ? near(LAYOUT.at(25, rand(-40, 40)), 20) : i < 6 ? near(LAYOUT.dock, 25) : pick(coast);
      b = { kind: 'gull', ax: a.x, az: a.z, h0: rand(11, 32), R: rand(18, 55), w: rand(0.12, 0.26) * (rng() < 0.5 ? -1 : 1), ph: rand(0, TAU), call: rand(5, 30), flapSpeed: rand(8, 10.5) };
      col.setRGB(1, 1, 1);
    } else if (i < 18) { // gulls resting on the dock and the rocks
      const D = LAYOUT.dock, yaw = yawFacing(D.dir);
      const spots = [local({ x: D.x, z: D.z, y: D.top }, yaw, D.len + 2.8, -1.95, 0.25), local({ x: D.x, z: D.z, y: D.top }, yaw, D.len + 2.8, 1.95, 0.25), { x: PLACES.tide.x - 4, y: groundHeight(PLACES.tide.x - 4, -46) + 0.6, z: -46 }, { x: ISLET.x + 2, y: groundHeight(ISLET.x + 2, ISLET.z + 9) + 0.05, z: ISLET.z + 9 }];
      const s = spots[i - 14];
      b = { kind: 'perch', x: s.x, y: s.y, z: s.z, yaw: rand(0, TAU), ph: rand(0, TAU) };
      col.setRGB(1, 1, 1);
    } else { // parrots over the jungle
      const anchors = [{ x: POOL.x, z: POOL.z }, LAYOUT.clearing || { x: -120, z: 150 }, { x: 60, z: 40 }, { x: -60, z: 200 }];
      const a = near(anchors[i % anchors.length], 30);
      b = { kind: 'parrot', ax: a.x, az: a.z, h0: rand(18, 28), R: rand(20, 45), w: rand(0.35, 0.55) * (rng() < 0.5 ? -1 : 1), ph: rand(0, TAU), flapSpeed: rand(13, 16), call: rand(4, 20) };
      const pc = pick([[0.95, 0.18, 0.1], [0.15, 0.45, 0.95], [0.2, 0.8, 0.3], [1.0, 0.82, 0.15]]); col.setRGB(pc[0], pc[1], pc[2]);
    }
    birds.setColorAt(i, col);
    aBird.set([b.ph, b.kind === 'perch' ? 0 : 1, b.kind === 'perch' ? 1 : 0, b.flapSpeed || 9], i * 4);
    WILD.birds.push(b);
  }
  // ---- crabs ----
  const cg = crabGeometry();
  const nC = 30, aCrab = new Float32Array(nC * 4);
  cg.setAttribute('aCrab', new THREE.InstancedBufferAttribute(aCrab, 4).setUsage(THREE.DynamicDrawUsage));
  const cmat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), {
    key: 'crab', vHead: 'attribute float aLeg; attribute vec4 aCrab;',
    vBegin: 'if (aLeg > 0.5) transformed.y += sin(uTime * 26.0 + aLeg * 1.9) * 0.014 * aCrab.x;',
  });
  const crabs = new THREE.InstancedMesh(cg, cmat, nC);
  crabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crabs.frustumCulled = false; crabs.castShadow = true;
  scene.add(crabs); WILD.crabMesh = crabs; WILD.aCrab = aCrab;
  for (let i = 0; i < nC; i++) {
    let home = null;
    for (let k = 0; k < 200 && !home; k++) {
      const c = i < 10 ? LAYOUT.at(rand(5, 22), rand(-40, 40)) : pick(coast);
      const x = c.x + rand(-6, 6), z = c.z + rand(-6, 6), h = groundHeight(x, z);
      if (h > 0.25 && h < 1.7) home = { x, z };
    }
    home = home || { x: SPAWN.x, z: SPAWN.z };
    const ghost = rng() < 0.5;
    col.setRGB(...(ghost ? [0.9, 0.8, 0.6] : [0.9, 0.32, 0.12]));
    crabs.setColorAt(i, col);
    WILD.crabs.push({ home, x: home.x, z: home.z, yaw: rand(0, TAU), state: 'idle', t: rand(0, 3), tx: 0, tz: 0, vis: 1, s: rand(0.8, 1.3) * (ghost ? 1 : 1.2) });
  }
  // ---- butterflies ----
  const fg = new THREE.PlaneGeometry(0.12, 0.06, 2, 1).rotateX(-Math.PI / 2);
  const nF = 34, flies = new THREE.InstancedMesh(fg, patch(new THREE.MeshLambertMaterial({ map: butterflyTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), {
    key: 'butterfly', vHead: WIND_HEAD,
    vBegin: /* glsl */`{ vec3 ip = instPos(); float a = sin(uTime * 17.0 + ip.x * 3.1 + ip.z * 1.7) * 1.05 + 0.35;
      float ax = abs(transformed.x); transformed.y += ax * sin(a); transformed.x = sign(transformed.x) * ax * cos(a); }`,
  }), nF);
  flies.instanceMatrix.setUsage(THREE.DynamicDrawUsage); flies.frustumCulled = false;
  scene.add(flies); WILD.flyMesh = flies;
  const spots = (VEG.flowerSpots || []).filter(s => Math.hypot(s.x - SPAWN.x, s.z - SPAWN.z) < 500);
  for (let i = 0; i < nF; i++) {
    const a = spots.length ? pick(spots) : { x: SPAWN.x, y: 2, z: SPAWN.z };
    const fc = pick([[0.25, 0.55, 1.0], [1.0, 0.55, 0.12], [1.0, 0.92, 0.35], [0.98, 0.98, 0.95], [0.95, 0.4, 0.7]]);
    flies.setColorAt(i, col.setRGB(fc[0], fc[1], fc[2]));
    WILD.flies.push({ ax: a.x, ay: a.y, az: a.z, ph: rand(0, 100), r: rand(1.5, 4), sp: rand(0.5, 1) });
  }
  // ---- fireflies (night) ----
  const nFF = 90, ffPos = new Float32Array(nFF * 3), ffSeed = new Float32Array(nFF);
  for (let i = 0; i < nFF; i++) { ffSeed[i] = rng(); ffPos.set([0, -999, 0], i * 3); }
  const ffg = new THREE.BufferGeometry();
  ffg.setAttribute('position', new THREE.BufferAttribute(ffPos, 3).setUsage(THREE.DynamicDrawUsage));
  ffg.setAttribute('aSeed', new THREE.BufferAttribute(ffSeed, 1));
  const ffm = new THREE.ShaderMaterial({
    uniforms: { ...U, uAmt: { value: 0 }, uScale: FX_SCALE },
    vertexShader: `${COMMON} uniform float uAmt; uniform float uScale; attribute float aSeed; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uTime * 0.7 + aSeed * 30.0) * 0.3; p.x += sin(uTime * 0.4 + aSeed * 20.0) * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        float blink = smoothstep(0.55, 1.0, sin(uTime * (0.8 + aSeed) + aSeed * 40.0));
        vA = blink * uAmt; gl_PointSize = max(2.0, 0.12 * uScale / -mv.z); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const ff = new THREE.Points(ffg, ffm); ff.frustumCulled = false; scene.add(ff);
  WILD.ff = { pts: ff, pos: ffPos, n: nFF, mat: ffm };
  WILD.applyQuality = () => { WILD.ffCount = Math.round(nFF * Q.particles); };
  WILD.applyQuality();
}
const _wq = new THREE.Quaternion(), _we = new THREE.Euler(), _wp = new THREE.Vector3(), _ws = new THREE.Vector3();
function updateWildlife(dt, t) {
  if (!WILD.birdMesh) return;
  const px = P.pos.x, pz = P.pos.z;
  // birds
  const bm = WILD.birdMesh, ab = WILD.aBird;
  WILD.birds.forEach((b, i) => {
    if (b.kind === 'perch') {
      _we.set(0, b.yaw + Math.sin(t * 0.3 + b.ph) * 0.4, 0, 'YXZ');
      bm.setMatrixAt(i, _m4.compose(_wp.set(b.x, b.y, b.z), _wq.setFromEuler(_we), _ws.set(1, 1, 1)));
      return;
    }
    const th = b.ph + b.w * t, R = b.R * (1 + 0.2 * Math.sin(t * 0.07 + b.ph));
    const sgn = Math.sign(b.w);
    let y = b.h0 + Math.sin(t * 0.17 + b.ph) * 3.5;
    if (b.kind === 'parrot') y += groundHeight(b.ax, b.az);
    _wp.set(b.ax + Math.cos(th) * R, y, b.az + Math.sin(th) * R);
    const tx = -Math.sin(th) * sgn, tz = Math.cos(th) * sgn;
    _we.set(-Math.cos(t * 0.17 + b.ph) * 0.15, Math.atan2(tx, tz), -sgn * (b.kind === 'parrot' ? 0.45 : 0.32), 'YXZ');
    const flap = b.kind === 'parrot' ? 1 : smoothstep(0.35, 0.75, Math.sin(t * 0.33 + b.ph) * 0.5 + 0.5);
    ab[i * 4 + 1] = flap;
    const s = b.kind === 'parrot' ? 0.7 : 1;
    bm.setMatrixAt(i, _m4.compose(_wp, _wq.setFromEuler(_we), _ws.set(s, s, s)));
    b.call -= dt;
    if (b.call < 0) {
      b.call = rand(6, 26);
      const d = Math.hypot(_wp.x - px, _wp.z - pz);
      if (d < 90 && AUDIO.birdCall && started) AUDIO.birdCall(b.kind, _wp.x, _wp.y, _wp.z);
    }
  });
  bm.instanceMatrix.needsUpdate = true; bm.geometry.attributes.aBird.needsUpdate = true;
  // crabs
  const cm = WILD.crabMesh, ac = WILD.aCrab;
  WILD.crabs.forEach((c, i) => {
    if (Math.hypot(c.x - px, c.z - pz) > 110 && c.state !== 'hidden') return;
    const pd = Math.hypot(c.x - px, c.z - pz);
    let moving = 0;
    if (c.state === 'hidden') {
      c.t -= dt; c.vis = Math.max(0, c.vis - dt * 2);
      if (c.t <= 0) { c.x = c.home.x + rand(-5, 5); c.z = c.home.z + rand(-5, 5); if (groundHeight(c.x, c.z) < 0.15) { c.x = c.home.x; c.z = c.home.z; } c.state = 'idle'; c.t = rand(1, 4); }
    } else {
      c.vis = Math.min(1, c.vis + dt * 1.5);
      if (pd < 4.2 && P.mode === 'walk' && c.state !== 'flee') { c.state = 'flee'; c.t = 1.3; const a = Math.atan2(c.z - pz, c.x - px); c.tx = Math.cos(a); c.tz = Math.sin(a); }
      if (c.state === 'flee') {
        c.x += c.tx * 2.6 * dt; c.z += c.tz * 2.6 * dt; moving = 1; c.yaw = Math.atan2(c.tx, c.tz) + Math.PI / 2;
        c.t -= dt; if (c.t <= 0) { c.state = 'hidden'; c.t = rand(14, 28); }
      } else if (c.state === 'idle') { c.t -= dt; if (c.t <= 0) { c.state = 'walk'; c.tx = c.home.x + rand(-5, 5); c.tz = c.home.z + rand(-5, 5); } }
      else if (c.state === 'walk') {
        const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
        if (d < 0.1 || groundHeight(c.tx, c.tz) < 0.1 || groundHeight(c.tx, c.tz) > 2) { c.state = 'idle'; c.t = rand(1.5, 6); }
        else { c.x += dx / d * 0.7 * dt; c.z += dz / d * 0.7 * dt; c.yaw = Math.atan2(dx, dz) + Math.PI / 2; moving = 1; }
      }
    }
    ac[i * 4] = moving;
    const h = groundHeight(c.x, c.z);
    const s = c.s * (0.2 + 0.8 * c.vis);
    _we.set(0, c.yaw, 0, 'YXZ');
    cm.setMatrixAt(i, _m4.compose(_wp.set(c.x, h - (1 - c.vis) * 0.12, c.z), _wq.setFromEuler(_we), _ws.set(s, s, s)));
  });
  cm.instanceMatrix.needsUpdate = true; cm.geometry.attributes.aCrab.needsUpdate = true;
  // butterflies (daytime only)
  const fm = WILD.flyMesh, day = smoothstep(0.02, 0.12, ENV.elev) * (1 - WX.cur.rain);
  WILD.flies.forEach((f, i) => {
    const tt = t * f.sp + f.ph;
    const x = f.ax + Math.sin(tt * 0.9) * f.r + Math.sin(tt * 3.1) * 0.3, z = f.az + Math.cos(tt * 0.7) * f.r + Math.cos(tt * 2.7) * 0.3;
    const y = f.ay + 0.4 + Math.sin(tt * 1.7) * 0.5 + Math.abs(Math.sin(tt * 5.3)) * 0.2;
    const vx = Math.cos(tt * 0.9) * 0.9 * f.r, vz = -Math.sin(tt * 0.7) * 0.7 * f.r;
    _we.set(0, Math.atan2(vx, vz), 0, 'YXZ');
    const s = day > 0.05 ? 1.6 : 0.0001;
    fm.setMatrixAt(i, _m4.compose(_wp.set(x, y, z), _wq.setFromEuler(_we), _ws.set(s, s, s)));
  });
  fm.instanceMatrix.needsUpdate = true;
  // fireflies around you after dark, where there is vegetation
  const F = WILD.ff, nightAmt = ENV.night * (1 - WX.cur.rain);
  F.mat.uniforms.uAmt.value = nightAmt;
  F.pts.visible = nightAmt > 0.02 && !P.eyeUnder;
  if (F.pts.visible) {
    for (let i = 0; i < F.n; i++) {
      const o = i * 3;
      const far = Math.hypot(F.pos[o] - px, F.pos[o + 2] - pz) > 45;
      if (i >= WILD.ffCount) { F.pos[o + 1] = -999; continue; }
      if (far || F.pos[o + 1] < -900) {
        const a = rand(0, TAU), d = rand(6, 40), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d, h = groundHeight(x, z);
        const m = maskAt(x, z);
        F.pos.set(h > 1.5 && m[0] < 0.5 ? [x, h + rand(0.4, 2.5), z] : [0, -999, 0], o);
      }
    }
    F.pts.geometry.attributes.position.needsUpdate = true;
  }
}

// ───────────────────── 22. Effects ─────────────────────
const FX_SCALE = { value: 600 };
const FX = { n: 1100, parts: [], free: [] };
FX.build = function () {
  // generic droplets / bubbles / mist
  const n = FX.n, pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n), type = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3 + 1] = -9999; FX.free.push(i); FX.parts.push({ on: false }); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aType', new THREE.BufferAttribute(type, 1).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, ...WFX.uniforms, uScale: FX_SCALE },
    vertexShader: `${COMMON} uniform float uScale; attribute float aSize; attribute float aAlpha; attribute float aType; varying float vA; varying float vT; varying vec3 vW;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vA = aAlpha; vT = aType; vW = position;
        gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 340.0); }`,
    fragmentShader: `${COMMON} uniform vec3 uFoamCol; varying float vA; varying float vT; varying vec3 vW;
      uniform sampler2D uDepthTex; uniform float uDepthOn; uniform vec2 uScreen; uniform vec2 uNearFar;
      float fxLin(float z){ return uNearFar.x * uNearFar.y / (uNearFar.y - z * (uNearFar.y - uNearFar.x)); }
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; float a;
        vec3 c = uFoamCol;
        if (vT < 0.5 || (vT > 4.5 && vT < 5.5)) a = smoothstep(1.0, 0.4, d);
        else if (vT < 1.5) { a = smoothstep(1.0, 0.8, d) * (0.35 + 0.65 * smoothstep(0.55, 0.95, d)); c = mix(uWaterFog * 2.0 + 0.3, vec3(1.0), 0.6); a += smoothstep(0.35, 0.0, length(q - vec2(-0.15, -0.15))) * 0.8; }
        else if (vT < 2.5) {
          vec2 nq = gl_PointCoord * 0.6 + fract(vW.xz * 0.37 + vW.y * 0.11);
          float nz = texture2D(uNoiseTex, nq + uTime * 0.015).r * 0.6 + texture2D(uNoiseTex, nq * 2.3 - uTime * 0.02).g * 0.4;
          a = smoothstep(1.0, 0.1, d) * smoothstep(0.22, 0.7, nz + (1.0 - d) * 0.3) * 0.6;
          if (uDepthOn > 0.5) a *= smoothstep(0.0, 0.45, fxLin(texture2D(uDepthTex, gl_FragCoord.xy / uScreen).r) - fxLin(gl_FragCoord.z));
          float sunS = pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 4.0);
          c = uFoamCol * (0.84 + 0.45 * sunS * uDaylight);
        }
        else if (vT < 3.5) { a = smoothstep(1.0, 0.35, d); c = vec3(0.6, 0.51, 0.36) * (0.3 + 0.7 * uDaylight); }
        else if (vT < 4.5) { a = smoothstep(1.0, 0.0, d); c = vec3(1.0, 0.5, 0.14) * 2.2; }
        else if (vT > 6.5) { a = smoothstep(1.0, 0.5, d) * step(abs(q.x * 0.9 - q.y * 0.35), 0.13); c = mix(vec3(0.22, 0.42, 0.1), vec3(0.42, 0.58, 0.2), fract(vW.x * 13.7)) * (0.3 + 0.7 * uDaylight); }
        else if (vT > 5.5) { a = smoothstep(1.0, 0.0, d) * (0.6 + 0.4 * sin(uTime * 3.0 + vW.x * 7.0)); c = vec3(0.25, 0.95, 1.0) * 1.8; }
        else { c = mix(uWaterFog * 1.6 + 0.25, uFoamCol, 0.5); }
        a *= vA; if (a < 0.01) discard;
        c = applyFog(c, vW, 1.0);
        gl_FragColor = vec4(outCol(c) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9; scene.add(pts);
  FX.pts = pts; FX.pos = pos; FX.size = size; FX.alpha = alpha; FX.type = type;

  // rain streaks around the camera
  const NR = 6500, rp = [], rc = [], rs = [], ri = [];
  for (let i = 0; i < NR; i++) {
    const sx = rng(), sy = rng(), sz = rng();
    for (const [cx, cyy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) { rp.push(0, 0, 0); rc.push(cx, cyy); rs.push(sx, sy, sz); }
    const b = i * 4; ri.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('aCorner', new THREE.Float32BufferAttribute(rc, 2)); rg.setAttribute('aSeed', new THREE.Float32BufferAttribute(rs, 3));
  rg.setIndex(ri);
  const rm = new THREE.ShaderMaterial({
    uniforms: { ...U, uCount: { value: 1 }, uCabinInv: CABIN.uniforms.uCabinInv },
    vertexShader: `${COMMON} uniform float uCount; uniform mat4 uCabinInv; attribute vec2 aCorner; attribute vec3 aSeed; varying float vA; varying vec2 vC; varying float vNear;
      void main(){
        vec3 box = vec3(44.0, 30.0, 44.0);
        vec2 drift = uWindDir * uWind * uTime * 3.0;
        vec3 base;
        base.x = cameraPosition.x + mod(aSeed.x * box.x - cameraPosition.x - drift.x, box.x) - box.x * 0.5;
        base.z = cameraPosition.z + mod(aSeed.z * box.z - cameraPosition.z - drift.y, box.z) - box.z * 0.5;
        base.y = cameraPosition.y - box.y * 0.35 + mod(aSeed.y * box.y - uTime * (9.0 + aSeed.x * 5.0), box.y);
        // gusts sweep through the rain in sheets: the wind's push and the rain's density both rise and fall as a band passes
        float gustB = sin(dot(base.xz, uWindDir) * 0.09 - uTime * (1.2 + uWind * 0.8)) * 0.5 + 0.5;
        vec3 vel = normalize(vec3(uWindDir.x * uWind * (0.3 + 0.35 * gustB), -1.0, uWindDir.y * uWind * (0.3 + 0.35 * gustB)));
        vec3 toCam = normalize(cameraPosition - base);
        vec3 side = normalize(cross(vel, toCam));
        float dist0 = length(base - cameraPosition);
        vec3 wp = base + side * aCorner.x * (0.004 + aSeed.z * 0.007) * (1.0 + dist0 * 0.06) + vel * aCorner.y * (0.25 + aSeed.x * 0.5);
        vC = aCorner; vNear = 1.0 - smoothstep(2.0, 9.0, dist0);
        float ground = max(terrainH(base.xz), 0.0);
        float dist = length(base - cameraPosition);
        vec3 cl = (uCabinInv * vec4(base, 1.0)).xyz;
        float roofed = step(abs(cl.x), 5.6) * step(-6.4, cl.z) * step(cl.z, 4.4) * step(cl.y, 4.9);
        vA = uRain * (0.2 + aSeed.y * 0.2) * (0.55 + 0.6 * gustB * smoothstep(0.6, 1.4, uWind)) * step(ground, base.y) * smoothstep(0.9, 2.4, dist) * (1.0 - smoothstep(12.0, 22.0, dist)) * step(aSeed.y + aSeed.z * 0.001, uCount) * (1.0 - uUnderwater) * (1.0 - roofed);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `${COMMON} varying float vA; varying vec2 vC; varying float vNear;
      void main(){ if (vA < 0.005) discard;
        float across = 1.0 - abs(vC.x); float along = smoothstep(0.0, 0.25, vC.y) * smoothstep(1.0, 0.6, vC.y);   // a soft streak, brightest in its middle
        float a = vA * across * across * along * (1.0 + vNear * 0.6);
        vec3 c = mix(uSkyHorizon, vec3(0.85, 0.9, 1.0), 0.5) * (0.45 + 0.55 * uDaylight) + vec3(0.8, 0.85, 1.0) * uLightning * 1.4;
        gl_FragColor = vec4(outCol(c) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const rain = new THREE.Mesh(rg, rm); rain.frustumCulled = false; rain.renderOrder = 10; scene.add(rain);
  FX.rain = rain;

  // lightning bolt
  const boltMat = new THREE.LineBasicMaterial({ color: 0xe8efff, transparent: true, opacity: 0 });
  const bolt = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(30 * 3), 3)), boltMat);
  bolt.frustumCulled = false; scene.add(bolt); FX.boltLine = bolt; FX.boltT = 0;

  // underwater light shafts
  const rayMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uAmt: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON} uniform float uAmt; varying vec2 vUv; varying vec3 vW;
      void main(){ float edge = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
        float fall = pow(vUv.y, 2.2); float d = length(vW - cameraPosition);
        float a = edge * fall * uAmt * 0.16 * smoothstep(0.5, 4.0, d) * (1.0 - smoothstep(18.0, 32.0, d));
        gl_FragColor = vec4(outCol(vec3(0.75, 0.95, 1.0)) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  FX.rays = [];
  for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.8, 2.4), 34), rayMat); r.frustumCulled = false; r.renderOrder = 11; r.visible = false; scene.add(r); FX.rays.push({ m: r, a: rand(0, TAU), d: rand(3, 16), ph: rand(0, TAU) }); }
  FX.rayMat = rayMat;

  // ambient motes: marine snow under water, pollen and dust in the sun above it
  const NM = 520, mp = new Float32Array(NM * 3), ms = new Float32Array(NM);
  for (let i = 0; i < NM; i++) { mp.set([rng(), rng(), rng()], i * 3); ms[i] = rng(); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
  const mm = new THREE.ShaderMaterial({
    uniforms: { ...U, uScale: FX_SCALE, uCount: { value: 1 } },
    vertexShader: `${COMMON} uniform float uScale; uniform float uCount; attribute float aSeed; varying float vA; varying float vSun;
      void main(){
        float under = uUnderwater;
        vec3 box = under > 0.5 ? vec3(22.0, 14.0, 22.0) : vec3(26.0, 10.0, 26.0);
        vec3 drift = under > 0.5 ? vec3(sin(uTime * 0.1 + aSeed * 9.0) * 0.4, -uTime * 0.05, cos(uTime * 0.08 + aSeed * 7.0) * 0.4) : vec3(uWindDir.x, sin(uTime * 0.3 + aSeed * 20.0) * 0.1, uWindDir.y) * uTime * 0.25 * uWind;
        vec3 p = position * box + drift;
        vec3 wp = cameraPosition + mod(p - cameraPosition, box) - box * 0.5;
        vec4 mv = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mv;
        float dist = length(wp - cameraPosition);
        float vis = under > 0.5 ? 0.55 : uDaylight * (1.0 - uRain) * 0.55 * step(terrainH(wp.xz) + 0.3, wp.y) * step(0.3, wp.y);
        vA = vis * (1.0 - smoothstep(6.0, 11.0, dist)) * step(aSeed, uCount);
        vSun = under;
        gl_PointSize = clamp((under > 0.5 ? 0.035 : 0.025) * uScale / -mv.z, 1.0, 6.0); }`,
    fragmentShader: `${COMMON} varying float vA; varying float vSun; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vA; if (a < 0.01) discard;
        vec3 c = vSun > 0.5 ? vec3(0.75, 0.9, 0.92) * (0.3 + 0.7 * uDaylight) : vec3(1.0, 0.94, 0.75); gl_FragColor = vec4(outCol(c) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(mg, mm); motes.frustumCulled = false; motes.renderOrder = 12; scene.add(motes);
  FX.motes = motes;
  FX.mistT = 0;
};
FX.spawn = function (x, y, z, vx, vy, vz, life, size, type, grav) {
  if (!FX.free.length) return;
  const i = FX.free.pop(), p = FX.parts[i];
  Object.assign(p, { on: true, x, y, z, vx, vy, vz, life, age: 0, size, type, grav });
};
FX.splash = function (x, y, z, k = 1) { if (SPRAY.mesh) { splashAt(x, y, z, k); return; }
  const n = Math.round((6 + k * 14) * Q.particles);
  for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(0.4, 1.8) * k; FX.spawn(x + rand(-0.2, 0.2), y + 0.05, z + rand(-0.2, 0.2), Math.cos(a) * s, rand(1.2, 3.4) * Math.sqrt(k), Math.sin(a) * s, rand(0.5, 1.0), rand(0.03, 0.07), 0, 9.8); }
};
FX.bubbles = function (x, y, z, n = 3) { for (let i = 0; i < n; i++) FX.spawn(x + rand(-0.1, 0.1), y, z + rand(-0.1, 0.1), rand(-0.1, 0.1), rand(0.5, 0.9), rand(-0.1, 0.1), rand(2, 5), rand(0.025, 0.06), 1, 0); };
// footprints are pressed into the living-sand layer, so waves wash them away
FX.footprint = function (x, z, yaw, left) { if (SAND.carveTex) stampFoot(x, z, yaw + rand(-0.06, 0.06), left); };
// water drops on the camera after a wave, a dive or a ride through rapids
FX.drops = [];
FX.lens = function (n) {
  const cv = document.getElementById('lens'); if (!cv) return;
  const w = innerWidth, h = innerHeight;
  for (let i = 0; i < n && FX.drops.length < 70; i++) FX.drops.push({ x: rand(0, w), y: rand(0, h * 0.9), r: rand(3, 14) * Math.min(1.4, w / 900 + 0.4), life: rand(1.0, 3.2), age: 0, vy: rand(6, 30) });
};
FX.updateLens = function (dt) {
  const cv = document.getElementById('lens'); if (!cv) return;
  if (!FX.drops.length) { if (cv.dataset.on) { cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); delete cv.dataset.on; } return; }
  if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); cv.dataset.on = 1;
  for (let i = FX.drops.length - 1; i >= 0; i--) {
    const d = FX.drops[i]; d.age += dt; d.y += d.vy * dt * (d.r / 12);
    if (d.age > d.life || P.eyeUnder) { FX.drops.splice(i, 1); continue; }
    const a = Math.min(1, (d.life - d.age) * 1.5) * 0.85;
    const gr = g.createRadialGradient(d.x - d.r * 0.25, d.y - d.r * 0.3, d.r * 0.1, d.x, d.y, d.r);
    gr.addColorStop(0, `rgba(255,255,255,${0.12 * a})`); gr.addColorStop(0.6, `rgba(225,240,242,${0.04 * a})`); gr.addColorStop(0.88, `rgba(30,50,60,${0.1 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * 1.12, 0, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,255,255,${0.3 * a})`; g.beginPath(); g.ellipse(d.x - d.r * 0.3, d.y - d.r * 0.42, d.r * 0.12, d.r * 0.07, -0.5, 0, TAU); g.fill();
  }
};
FX.bolt = function (a, dist) {
  const cx = camera.position.x + Math.cos(a) * dist, cz = camera.position.z + Math.sin(a) * dist;
  const pos = FX.boltLine.geometry.attributes.position;
  let x = cx, y = 620, z = cz;
  for (let i = 0; i < 30; i++) { pos.setXYZ(i, x, y, z); x += rand(-30, 30); z += rand(-30, 30); y -= 620 / 29; }
  pos.needsUpdate = true; FX.boltT = 0.35;
};
FX.update = function (dt, t) {
  if (!FX.pts) return;
  FX_SCALE.value = renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
  // waterfall mist and spray when nearby
  if (STREAM.fall && Math.hypot(P.pos.x - STREAM.fall.x, P.pos.z - STREAM.fall.z) < 150) {
    FX.mistT += dt * 30 * Q.particles * (STREAM.fallFlow ?? 1);
    while (FX.mistT > 1) {
      FX.mistT -= 1;
      const f = STREAM.fall;
      if (rng() < 0.5) FX.spawn(f.x + rand(-1.5, 1.5), f.botY + 0.2, f.z + rand(-1.5, 1.5), rand(-0.5, 0.5), rand(0.4, 1.4), rand(-0.5, 0.5), rand(2, 4), rand(0.9, 2.2), 2, -0.05);
      else FX.spawn(f.x + rand(-1, 1), f.botY + 0.1, f.z + rand(-1, 1), rand(-2, 2), rand(1.5, 4), rand(-2, 2), rand(0.5, 1), rand(0.04, 0.08), 0, 9.8);
    }
  }
  const pos = FX.pos, size = FX.size, alpha = FX.alpha, type = FX.type;
  for (let i = 0; i < FX.n; i++) {
    const p = FX.parts[i]; if (!p.on) continue;
    p.age += dt;
    if (p.age >= p.life) { p.on = false; pos[i * 3 + 1] = -9999; alpha[i] = 0; FX.free.push(i); continue; }
    p.vy -= p.grav * dt;
    if (p.type === 1) { p.vx += Math.sin(t * 9 + i) * 0.2 * dt; const w = waterAt(p.x, p.z); if (p.y > w.level - 0.05) p.age = p.life; }
    if (p.type === 6) { p.vx += Math.sin(t * 0.7 + i) * 0.05 * dt; p.vz += Math.cos(t * 0.6 + i) * 0.05 * dt; }
    if (p.type === 2) { p.vx *= 1 - dt * 0.5; p.vz *= 1 - dt * 0.5; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.type === 0 && p.vy < 0 && p.y < waterAt(p.x, p.z).level) p.age = p.life;
    if ((p.type === 3 || p.type === 7) && p.vy < 0 && p.y < groundHeight(p.x, p.z)) p.age = p.life;
    if (p.type === 7) { p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; p.vy = Math.max(p.vy, -2.2); }
    if (p.type === 5 && p.vy < 0 && p.y < Math.max(supportHeight(p.x, p.z, p.y), waterAt(p.x, p.z).level)) { p.age = p.life; if (rng() < 0.25) FX.spawn(p.x, p.y + 0.03, p.z, rand(-0.6, 0.6), rand(0.6, 1.4), rand(-0.6, 0.6), 0.35, 0.03, 0, 9.8); }
    if (p.type === 4) { p.vx += Math.sin(t * 7 + i) * 0.3 * dt; }
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    const k = p.age / p.life;
    size[i] = p.type === 2 ? p.size * (1 + k * 1.5) : p.size;
    alpha[i] = p.type === 2 ? Math.sin(k * Math.PI) * 0.45 : p.type === 3 || p.type === 7 ? 1 - k * k : p.type === 4 ? (1 - k) * (0.6 + 0.4 * Math.sin(t * 30 + i)) : p.type === 5 ? 0.85 : (1 - k) * (p.type === 1 ? 0.9 : 0.85);
    type[i] = p.type;
  }
  const g = FX.pts.geometry.attributes;
  g.position.needsUpdate = g.aSize.needsUpdate = g.aAlpha.needsUpdate = g.aType.needsUpdate = true;
  // rain
  FX.rain.visible = U.uRain.value > 0.02 && !P.eyeUnder;
  FX.rain.material.uniforms.uCount.value = Q.particles;
  // lightning bolt flicker
  if (FX.boltT > 0) { FX.boltT -= dt; FX.boltLine.material.opacity = FX.boltT > 0 ? (Math.sin(FX.boltT * 90) > -0.2 ? 0.95 : 0.2) : 0; FX.boltLine.visible = FX.boltT > 0; }
  else FX.boltLine.visible = false;
  // light shafts below the surface
  const under = P.eyeUnder;
  const amt = under ? ENV.daylight * (1 - WX.cur.cover * 0.7) : 0;
  FX.rayMat.uniforms.uAmt.value = amt;
  for (const r of FX.rays) {
    r.m.visible = amt > 0.02;
    if (!r.m.visible) continue;
    const a = r.a + t * 0.02, x = camera.position.x + Math.cos(a) * r.d, z = camera.position.z + Math.sin(a) * r.d;
    const lvl = waterAt(x, z).level;
    r.m.position.set(x, lvl - 17, z);
    r.m.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0);
    r.m.rotateX(-0.25 * (1 - ENV.elev)); r.m.rotateZ(Math.sin(t * 0.2 + r.ph) * 0.05);
    r.m.scale.y = 1;
  }
  FX.motes.material.uniforms.uCount.value = Q.particles;
};
