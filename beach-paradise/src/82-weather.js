
// ───────────────────── 20b. Weather you can see: wind, rain and lightning ─────────────────────
// Faint streaks of moving air, leaves and sand blowing past, spray torn off the wave tops,
// raindrops splashing on everything and running off the roof, and real branching bolts
// of lightning that strike close by in a thunderstorm.
const WXFX = { lines: null, leaves: null, leafData: [], bolt: null, boltT: 0, splashAcc: 0, dripAcc: 0, sandAcc: 0, sprayAcc: 0, lensAcc: 0 };
const windNow = () => U.uWind.value;
function buildWeatherFX() {
  // --- streaks of wind: thin ribbons that ride the gusts around the camera ---
  const NL = 70, SEG = 14, pos = [], seed = [], idx = [];
  for (let l = 0; l < NL; l++) {
    const s = [rng(), rng(), rng(), rng()];
    for (let i = 0; i <= SEG; i++) for (const side of [-1, 1]) { pos.push(i / SEG, side, 0); seed.push(...s); }
    const b = l * (SEG + 1) * 2;
    for (let i = 0; i < SEG; i++) { const a = b + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 4)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, uAmt: { value: 0 } },
    vertexShader: /* glsl */`${COMMON} uniform float uAmt; attribute vec4 aSeed; varying float vA; varying vec3 vW;
      void main(){
        vec3 box = vec3(60.0, 14.0, 60.0);
        vec2 wd = normalize(uWindDir + vec2(1e-4)); vec2 sd = vec2(-wd.y, wd.x);
        float spd = 3.0 + uWind * 4.5;
        float len = 5.0 + aSeed.w * 9.0;
        // each streak drifts downwind and wraps around a box that follows the camera
        float along = mod(aSeed.x * box.x + uTime * spd - dot(cameraPosition.xz, wd), box.x) - box.x * 0.5;
        float across = mod(aSeed.z * box.z - dot(cameraPosition.xz, sd), box.z) - box.z * 0.5;
        vec2 base = cameraPosition.xz + wd * along + sd * across;
        float t = position.x;
        vec2 p = base - wd * len * t + sd * sin(t * 4.0 + uTime * 1.3 + aSeed.y * 20.0) * 0.6;
        float gy = max(terrainH(p), 0.0);
        float y = gy + 0.6 + aSeed.y * 6.0 + sin(t * 3.0 + uTime + aSeed.z * 9.0) * 0.4;
        vec3 wp = vec3(p.x, y, p.y);
        vec3 toCam = normalize(cameraPosition - wp);
        vec3 dir = normalize(vec3(-wd.x, 0.0, -wd.y));
        vec3 side = normalize(cross(dir, toCam));
        wp += side * position.y * 0.02 * (1.0 + aSeed.w);
        float dist = length(wp - cameraPosition);
        vA = uAmt * sin(t * 3.14159) * smoothstep(2.0, 6.0, dist) * (1.0 - smoothstep(18.0, 30.0, dist)) * (1.0 - smoothstep(0.35, 0.5, abs(along) / box.x)) * (0.5 + 0.5 * sin(uTime * 0.7 + aSeed.x * 30.0));
        vW = wp;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`${COMMON} varying float vA; varying vec3 vW;
      void main(){ if (vA < 0.003) discard; vec3 c = mix(uSkyHorizon, vec3(1.0), 0.6) * (0.4 + 0.6 * uDaylight); gl_FragColor = vec4(outCol(c) * vA, vA); }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide,
  });
  const lines = new THREE.Mesh(g, m); lines.frustumCulled = false; lines.renderOrder = 11; scene.add(lines);
  WXFX.lines = lines;
  // --- leaves blowing past ---
  const NLEAF = 140;
  // a little leaf: a pointed oval with a fold down the middle
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute([-0.065, 0, 0, 0, 0.004, 0.028, 0.065, 0, 0, 0, 0.004, -0.028, -0.03, 0.002, 0.022, 0.03, 0.002, 0.022, 0.03, 0.002, -0.022, -0.03, 0.002, -0.022], 3));
  lg.setIndex([0, 4, 1, 1, 5, 2, 0, 3, 7, 3, 2, 6, 0, 1, 3, 1, 2, 3]); lg.computeVertexNormals();
  const lm = new THREE.InstancedMesh(lg, patch(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), { key: 'blownLeaf' }), NLEAF);
  lm.frustumCulled = false; lm.count = 0; scene.add(lm);
  const lc = [new THREE.Color(0x4a7a2a), new THREE.Color(0x6b8f2e), new THREE.Color(0x8a6a2a), new THREE.Color(0x5d4a24), new THREE.Color(0x3f6b2c)];
  for (let i = 0; i < NLEAF; i++) { lm.setColorAt(i, pick(lc)); WXFX.leafData.push({ on: false }); }
  WXFX.leafColors = lc;
  WXFX.leaves = lm;
  // --- lightning: glowing ribbons with branches ---
  const bm = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } },
    vertexShader: 'attribute float aW; varying float vW; void main(){ vW = aW; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA; varying float vW; void main(){ float d = abs(vW); float core = 1.0 - smoothstep(0.0, 0.35, d); float halo = exp(-d * d * 4.0); gl_FragColor = vec4((vec3(1.0) * core * 2.2 + vec3(0.6, 0.68, 1.0) * halo * 0.9) * uA, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3000 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  bg.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(3000), 1).setUsage(THREE.DynamicDrawUsage));
  const bolt = new THREE.Mesh(bg, bm); bolt.frustumCulled = false; bolt.visible = false; bolt.renderOrder = 3; scene.add(bolt);
  WXFX.bolt = bolt;
}
// build a jagged, branching bolt from the cloud base down to (x, z), as camera-facing ribbons
function makeBolt(x, z) {
  const segs = [], top = 420 + rand(0, 140), ground = Math.max(groundHeight(x, z), oceanHeight(x, z, U.uTime.value));
  const walk = (x0, y0, z0, y1, w, depth) => {
    let px = x0, py = y0, pz = z0;
    const n = Math.max(6, Math.round((y0 - y1) / 18));
    for (let i = 0; i < n; i++) {
      const ny = py - (y0 - y1) / n, nx = px + rand(-1, 1) * (y0 - y1) / n * 0.55, nz = pz + rand(-1, 1) * (y0 - y1) / n * 0.55;
      segs.push([px, py, pz, nx, ny, nz, w]);
      if (depth < 2 && rng() < 0.16) walk(nx, ny, nz, ny - rand(40, 160), w * 0.45, depth + 1);
      px = nx; py = ny; pz = nz;
    }
    return [px, pz];
  };
  // aim the main channel so it ends on the strike point
  const sx = x + rand(-80, 80), sz = z + rand(-80, 80);
  walk(sx, top, sz, ground, 2.6, 0);
  const cam = camera.position, pos = WXFX.bolt.geometry.attributes.position.array, aw = WXFX.bolt.geometry.attributes.aW.array;
  let v = 0; const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();
  // the main channel ends exactly at the strike point: shift the whole tree
  const last = segs.filter(s => s[6] === 2.6).pop();
  const ox = last ? x - last[3] : 0, oz = last ? z - last[5] : 0;
  for (const s of segs) {
    if (v + 6 > 3000) break;
    const k = 1 - (s[1] - ground) / (top - ground);                 // drift of the shift grows toward the ground
    _a.set(s[0] + ox * k, s[1], s[2] + oz * k); _b.set(s[3] + ox * k, s[4], s[5] + oz * k);
    _d.subVectors(_b, _a).normalize(); _t.subVectors(cam, _a).normalize(); _s.crossVectors(_d, _t).normalize();
    const w = s[6] * 2.2 * (1 + _a.distanceTo(cam) / 600);
    const quad = [[_a, -1], [_a, 1], [_b, -1], [_a, 1], [_b, 1], [_b, -1]];
    for (const [p, sd] of quad) { pos[v * 3] = p.x + _s.x * sd * w; pos[v * 3 + 1] = p.y + _s.y * sd * w; pos[v * 3 + 2] = p.z + _s.z * sd * w; aw[v] = sd; v++; }
  }
  const g = WXFX.bolt.geometry; g.setDrawRange(0, v); g.attributes.position.needsUpdate = g.attributes.aW.needsUpdate = true;
  WXFX.bolt.visible = true; WXFX.boltT = 0.6;
  WXFX.flickers = [0.0, 0.09, 0.18 + rng() * 0.1].map(t => WXFX.boltT - t);   // a strike pulses two or three times
}
// a strike: close in a thunderstorm, far off otherwise
function strike(close) {
  const a = rand(0, TAU), dist = close ? rand(120, 900) : rand(900, 2800);
  const x = camera.position.x + Math.cos(a) * dist, z = camera.position.z + Math.sin(a) * dist;
  ENV.lightning = close ? 0.9 : 0.6;
  makeBolt(x, z);
  if (AUDIO.thunder) setTimeout(() => AUDIO.thunder(dist), (dist / 343) * 1000);
  const fl = document.getElementById('flash'); fl.style.transition = 'none'; fl.style.opacity = (close ? 0.32 : 0.18) * smoothstep(2800, 120, dist) + 0.04;
  requestAnimationFrame(() => { fl.style.transition = 'opacity .6s ease-out'; fl.style.opacity = 0; });
}
function updateWeatherFX(dt) {
  if (!WXFX.lines) return;
  const wind = windNow(), rain = U.uRain.value, cam = camera.position, under = P.eyeUnder;
  const wd = U.uWindDir.value, wx = wd.x, wz = wd.y;
  WXFX.lines.material.uniforms.uAmt.value = damp(WXFX.lines.material.uniforms.uAmt.value, under ? 0 : smoothstep(1.1, 2.6, wind) * 0.22 * Q.particles, 1, dt);
  // lightning ribbon flicker
  if (WXFX.boltT > 0) {
    WXFX.boltT -= dt;
    let f = 0; for (const ft of WXFX.flickers || []) { const k = ft - WXFX.boltT; if (k >= 0 && k < 0.08) f = Math.max(f, 1 - k / 0.08); }
    f = Math.max(f * 1.0, Math.min(1, WXFX.boltT * 2.5) * 0.35);
    WXFX.bolt.material.uniforms.uA.value = f; WXFX.bolt.visible = WXFX.boltT > 0;
    ENV.lightning = Math.max(ENV.lightning, f * 0.75);
  }
  if (under) return;
  // blown leaves: picked up near trees and bushes upwind of you, tumbling past
  const lm = WXFX.leaves, Ld = WXFX.leafData, _m = WXFX._m || (WXFX._m = new THREE.Matrix4()), _q = WXFX._q || (WXFX._q = new THREE.Quaternion()), _e = WXFX._e || (WXFX._e = new THREE.Euler()), _p = WXFX._p || (WXFX._p = new THREE.Vector3()), _s1 = WXFX._s1 || (WXFX._s1 = new THREE.Vector3(1, 1, 1));
  const want = wind > 1.0 ? Math.round(clamp((wind - 1.0) * 70, 0, 140) * Q.particles) : 0;
  let live = 0;
  for (let i = 0; i < Ld.length; i++) {
    const p = Ld[i];
    if (!p.on) {
      if (live < want && rng() < dt * 6) {
        const a = rand(-1.2, 1.2), dd = rand(8, 26), sx = cam.x - wx * dd + -wz * a * dd, sz = cam.z - wz * dd + wx * a * dd;
        const m = maskAt(sx, sz);
        if (m[0] > 0.7 && rng() > 0.25) continue;                       // few leaves over open sand
        Object.assign(p, { on: true, col: pick(WXFX.leafColors), x: sx, y: groundHeight(sx, sz) + rand(0.2, 4), z: sz, vx: 0, vy: 0, vz: 0, rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), sp: rand(2, 6), life: rand(4, 9), age: 0 });
      } else continue;
    }
    p.age += dt;
    const gust = 0.6 + 0.4 * Math.sin(U.uTime.value * 1.3 + i);
    p.vx = damp(p.vx, wx * wind * 3.2 * gust + Math.sin(p.age * 3 + i) * 1.2, 2, dt);
    p.vz = damp(p.vz, wz * wind * 3.2 * gust + Math.cos(p.age * 2.6 + i) * 1.2, 2, dt);
    p.vy = damp(p.vy, Math.sin(p.age * 2.1 + i * 3) * 1.4 - 0.6, 1.5, dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const g = groundHeight(p.x, p.z);
    if (p.y < g + 0.05) { p.y = g + 0.05; p.vy = Math.abs(p.vy) * 0.5 + wind * 0.4; }
    p.rx += p.sp * dt; p.rz += p.sp * 0.7 * dt;
    if (p.age > p.life || Math.hypot(p.x - cam.x, p.z - cam.z) > 40) { p.on = false; continue; }
    _e.set(p.rx, p.ry, p.rz); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z);
    _m.compose(_p, _q, _s1); lm.setMatrixAt(live, _m); lm.setColorAt(live, p.col);
    live++;
  }
  lm.count = live; lm.instanceMatrix.needsUpdate = true; if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
  // sand streaming low over the beach in a strong wind
  if (wind > 1.6 && FX.spawn) {
    WXFX.sandAcc += dt * (wind - 1.6) * 60 * Q.particles;
    while (WXFX.sandAcc > 1) {
      WXFX.sandAcc -= 1;
      const a = rand(-1, 1), dd = rand(-6, 20), sx = cam.x - wx * dd - wz * a * 12, sz = cam.z - wz * dd + wx * a * 12;
      const m = maskAt(sx, sz), g = groundHeight(sx, sz);
      if (m[0] < 0.6 || g < 0.6 || ENV.wet > 0.5) continue;
      FX.spawn(sx, g + rand(0.02, 0.4), sz, wx * wind * rand(3, 6), rand(-0.1, 0.4), wz * wind * rand(3, 6), rand(0.6, 1.4), rand(0.01, 0.022), 3, 1.5);
    }
  }
  // spray torn off the tops of the waves
  if (wind > 1.7) {
    WXFX.sprayAcc += dt * (wind - 1.7) * 45 * Q.particles;
    while (WXFX.sprayAcc > 1) {
      WXFX.sprayAcc -= 1;
      const a = rand(0, TAU), dd = rand(5, 40), sx = cam.x + Math.cos(a) * dd, sz = cam.z + Math.sin(a) * dd;
      if (groundHeight(sx, sz) > -1) continue;
      const lv = oceanHeight(sx, sz, U.uTime.value);
      if (lv < oceanHeight(sx + wx * 3, sz + wz * 3, U.uTime.value) - 0.05) continue; // only from the crests
      sprayDrop(sx, lv + 0.05, sz, wx * wind * rand(2.5, 5), rand(0.8, 2.2), wz * wind * rand(2.5, 5), rand(0.6, 1.3), rand(0.02, 0.05));
      if (rng() < 0.25 && FX.spawn) FX.spawn(sx, lv + 0.3, sz, wx * wind * 3, 0.4, wz * wind * 3, rand(1, 2), rand(0.5, 1.2), 2, -0.05);
    }
  }
  if (rain < 0.05) return;
  // raindrops bursting on the ground and on the porch (rings on water come from the ripple simulation)
  WXFX.splashAcc += dt * rain * 160 * Q.particles;
  while (WXFX.splashAcc > 1) {
    WXFX.splashAcc -= 1;
    const a = rand(0, TAU), dd = Math.sqrt(rng()) * 12 + 0.8, sx = cam.x + Math.cos(a) * dd, sz = cam.z + Math.sin(a) * dd;
    if (CABIN.group && !CABIN.destroyed) { const l = worldToCabin(sx, sz); if (Math.abs(l.x) < 5.6 && l.z > -6.4 && l.z < 4.4) continue; } // under the roof
    const g = supportHeight(sx, sz, cam.y), lv = waterAt(sx, sz).level;
    if (lv > g + 0.02) continue;
    for (let k = 0; k < 2; k++) sprayDrop(sx, g + 0.01, sz, rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5), rand(0.15, 0.3), rand(0.008, 0.016));
  }
  // water running off the roof edge of the cabin in strings of drops
  if (CABIN.group && !CABIN.destroyed && Math.hypot(cam.x - CABIN.x, cam.z - CABIN.z) < 30) {
    WXFX.dripAcc += dt * rain * 55 * Q.particles;
    while (WXFX.dripAcc > 1) {
      WXFX.dripAcc -= 1;
      const r = rng(); let lx, lz, ly;
      if (r < 0.45) { lx = rand(-5.4, 5.4); lz = -CPORCH - 0.3; ly = 2.1; }          // front of the porch roof
      else if (r < 0.75) { lx = rand(-5.4, 5.4); lz = CD + 0.75; ly = 2.15; }         // back eave
      else { lx = (rng() < 0.5 ? -1 : 1) * 5.45; lz = rand(-CPORCH, -CD); ly = 2.2; }  // porch sides
      const w = cabinToWorld(lx, ly, lz);
      sprayDrop(w.x, w.y, w.z, 0, -rand(0.5, 1.5), 0, 1.5, rand(0.012, 0.022));
    }
  }
  // drops landing on your face when you look up out in the rain
  const roofed = CABIN.inside || (CABIN.group && !CABIN.destroyed && (() => { const l = worldToCabin(cam.x, cam.z); return Math.abs(l.x) < 5.6 && l.z > -6.4 && l.z < 4.4; })());
  if (!roofed && P.mode !== 'seat' && FX.lens) {
    WXFX.lensAcc += dt * rain * Math.max(0, P.pitch + 0.25) * 6;
    if (WXFX.lensAcc > 1) { WXFX.lensAcc = 0; FX.lens(1); }
  }
}
