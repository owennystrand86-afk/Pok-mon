
// ───────────────────── 25. Waves that reach you ─────────────────────
const WAVEHIT = { lastG: 0 };
function checkWaveHit(dt) {
  if ((P.mode !== 'walk' && P.mode !== 'swim') || P.water.kind !== 'sea' || P.climb) { WAVEHIT.lastG = 0; return; }
  const x = P.pos.x, z = P.pos.z, g0 = groundHeight(x, z), depth = -g0;
  if (depth > 7 * Math.max(1, U.uSurfAmp.value * 0.75) || g0 > 1.4 + U.uSurfAmp.value * 0.5) { WAVEHIT.lastG = 0; return; }
  if (P.mode === 'walk' && P.pos.y - EYE > Math.max(g0, 0) + 0.35) { WAVEHIT.lastG = 0; return; } // up on the dock or the bridge, out of reach
  const o = {}; surfState(x, z, depth, U.uTime.value, o); const g = o.g;
  if (WAVEHIT.lastG > 0.8 && g < 0.2) {
    // the bore (or the swash) reaching you: as strong as the wave is tall here, stronger if it is still breaking
    let k = o.a * (0.75 + 0.5 * o.brk + 0.6 * o.plunge);
    if (depth <= 0.15) k = g0 < o.a * 0.9 ? o.a * 0.35 : 0;
    if (k > 0.12) waveHit(k, x, z, depth);
  }
  WAVEHIT.lastG = g;
}
function waveHit(k, x, z, depth) {
  const sd = seaDir(x, z), big = k > 0.55;
  const push = P.mode === 'swim' ? 2.6 : 3.6;
  P.vel.x -= sd.x * k * push; P.vel.z -= sd.z * k * push;
  if (P.mode === 'walk' && depth > 0.35 && big) { P.vel.y += 1.6 * k; P.onGround = false; P.stumble = 1; }
  if (P.mode === 'swim' && big) { P.dunk = 1; if (FX.bubbles) FX.bubbles(P.pos.x, P.pos.y - 0.3, P.pos.z, 12); }
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  if (FX.splash) FX.splash(x + fx * 0.8, P.water.level + 0.1, z + fz * 0.8, 0.6 + k * 2.2);
  if (FX.lens && (depth > 0.25 || P.mode === 'swim')) FX.lens(Math.round(6 + k * 46));
  if (AUDIO.waveHit) AUDIO.waveHit(k);
}

// ───────────────────── 26. The motorboat ─────────────────────
const WAKE = { pts: [], mesh: null, max: 90, acc: 0 };
function buildWake() {
  const n = WAKE.max, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n * 2), 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2 * 2), 2).setUsage(THREE.DynamicDrawUsage));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER },
    vertexShader: `${COMMON} attribute float aA; varying float vA; varying vec2 vUv; varying vec3 vW;
      void main(){ vA = aA; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON} uniform vec3 uFoamCol; varying float vA; varying vec2 vUv; varying vec3 vW;
      void main(){ float n = texture2D(uNoiseTex, vec2(vUv.x * 0.6, vUv.y * 0.12) + vW.xz * 0.05).a;
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float core = 1.0 - smoothstep(0.15, 0.5, abs(vUv.x - 0.5)) * 0.6;
        float a = vA * edge * smoothstep(0.3, 0.75, n * core + 0.2) * 0.85; if (a < 0.01) discard;
        vec3 c = applyFog(uFoamCol, vW, 1.0); gl_FragColor = vec4(outCol(c) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  WAKE.mesh = new THREE.Mesh(g, m); WAKE.mesh.frustumCulled = false; WAKE.mesh.renderOrder = 8; scene.add(WAKE.mesh);
}
function updateWake(dt, t) {
  if (!WAKE.mesh) return;
  const b = BOATS.motor;
  if (b && b.driving && !b.climb && Math.abs(b.speed) > 1.2 && !(b.airT > 0)) {
    const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
    WAKE.acc += Math.abs(b.speed) * dt;
    if (WAKE.acc > 0.7) { WAKE.acc = 0; WAKE.pts.unshift({ x: b.x - fx * 2.8, z: b.z - fz * 2.8, t, w: 0.9, px: -fz, pz: fx, v: Math.abs(b.speed) }); if (WAKE.pts.length > WAKE.max) WAKE.pts.pop(); }
  }
  while (WAKE.pts.length && t - WAKE.pts[WAKE.pts.length - 1].t > 12) WAKE.pts.pop();
  const pos = WAKE.mesh.geometry.attributes.position.array, aa = WAKE.mesh.geometry.attributes.aA.array, uv = WAKE.mesh.geometry.attributes.uv.array;
  let L = 0;
  for (let i = 0; i < WAKE.max; i++) {
    const p = WAKE.pts[Math.min(i, WAKE.pts.length - 1)];
    if (!p) { aa[i * 2] = aa[i * 2 + 1] = 0; continue; }
    const age = t - p.t, w = p.w + age * (0.9 + p.v * 0.08);
    const y = boatWaterLevel(p.x, p.z, t) + 0.05;
    pos.set([p.x + p.px * w, y, p.z + p.pz * w, p.x - p.px * w, y, p.z - p.pz * w], i * 6);
    const a = i < WAKE.pts.length ? Math.max(0, 1 - age / 12) * Math.min(1, p.v / 6) : 0;
    aa[i * 2] = aa[i * 2 + 1] = a;
    if (i > 0) L += 0.7;
    uv.set([0, L, 1, L], i * 4);
  }
  const at = WAKE.mesh.geometry.attributes; at.position.needsUpdate = at.aA.needsUpdate = at.uv.needsUpdate = true;
}
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _be = new THREE.Euler(), _bv = new THREE.Vector3();
function boardBoat(it) {
  const b = it.boat; if (!b) return;
  P.mode = 'boat'; P.boat = b; b.driving = true; b.y = b.mesh.position.y; b.vy = 0;
  P.yaw = b.yaw; P.vel.set(0, 0, 0);
  if (AUDIO.seat) AUDIO.seat('boat-seat');
  showActivityHint(isTouch ? 'Joystick to drive · Get out with the button' : 'W/S throttle · A/D steer · Shift full speed · E get out');
}
function exitBoat() {
  const b = P.boat; if (!b) return;
  b.driving = false; b.speed = 0; b.yawRate = 0; P.boat = null;
  const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
  // step onto the dock if it's right there, otherwise slip into the water beside the boat
  for (const p of PLATFORMS) {
    const dx = b.x - p.x, dz = b.z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < p.hx + 4.5 && Math.abs(lz) < p.hz + 1) {
      const ix = clamp(lx, -p.hx + 0.4, p.hx - 0.4), iz = clamp(lz, -p.hz + 0.4, p.hz - 0.4);
      P.pos.set(p.x + ix * c + iz * s, p.top + EYE, p.z - ix * s + iz * c); P.mode = 'walk'; P.onGround = true; P.vel.set(0, 0, 0); return;
    }
  }
  // otherwise stand up at the helm: walk around the deck, or hop over the side for a swim
  standOnDeck(b);
  showActivityHint(isTouch ? 'You\'re standing on the deck · jump over the side to swim' : 'Standing on the deck · walk around, jump over the side to swim · E to drive again', true, 4);
}
// is there water deep enough for the hull at (x, z)?  the sea (not the surf on the sand), the river, the pools
function boatCanGo(x, z, t) {
  const w = waterAt(x, z);
  let lvl = w.level;
  if (w.kind === 'sea' && !TSU.on) lvl = Math.min(lvl, 0.15);
  return groundHeight(x, z) < lvl - 0.5;
}
// driving up the waterfall: once you hit the bottom of the falls going fast enough, the boat
// claws its way up the face of the water and comes out on the river above
function startFallClimb(b) {
  const f = STREAM.fall, up = STREAM.upper;
  const top = up[Math.max(0, up.length - 4)];
  b.climb = { t: 0, x0: b.x, z0: b.z, y0: b.y, yaw0: b.yaw, top, dur: 2.6 };
  P.shake = 0.8; if (AUDIO.waveHit) AUDIO.waveHit(1.2);
  showActivityHint('Climbing the falls!', false, 2.5);
}
function updateFallClimb(b, dt) {
  const C = b.climb, f = STREAM.fall;
  C.t += dt / C.dur;
  const e = Math.min(1, C.t), u = 1 - e;                     // u: 1 at the bottom of the falls, 0 at the lip
  // up the face of the falls, along the water's own path (riding on its outer surface)
  let out, yF;
  if (f.path && f.path.length > 2) {
    const fp = f.path.filter(s => s.d >= f.edgeD - 0.3), q = clamp(u, 0, 1) * (fp.length - 1), i = Math.min(fp.length - 2, Math.floor(q)), k = q - i;
    const A = fp[i], B = fp[i + 1];
    out = lerp(A.d, B.d, k) + lerp(A.th, B.th, k) * 0.5 * lerp(A.nd || 0, B.nd || 0, k) + 0.6; yF = lerp(A.y, B.y, k) + 0.25;
  } else {
    out = 0.3 + f.fallLen * 0.55 * Math.pow(Math.max(u, 0), 0.6);
    yF = f.topY + 0.05 - (f.topY - f.botY + 0.2) * (u * u * 0.75 + u * 0.25);
  }
  let x = f.lipX + f.dirX * out, z = f.lipZ + f.dirZ * out, y = yF - REST_WL;
  // ease in from where you hit the falls, and out onto the river above the lip
  const k0 = smoothstep(0, 0.18, e);
  x = lerp(C.x0, x, k0); z = lerp(C.z0, z, k0); y = lerp(C.y0, y, k0);
  if (C.t > 1) { const k1 = smoothstep(1, 1.35, C.t); x = lerp(x, C.top.x, k1); z = lerp(z, C.top.z, k1); y = lerp(y, C.top.S - REST_WL, k1); }
  const yawUp = Math.atan2(f.dirX, f.dirZ);                  // facing back up toward the lip
  let dy = yawUp - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * (1 - Math.exp(-8 * dt));
  const climbPitch = C.t < 1 ? 1.05 * smoothstep(0, 0.25, e) * (1 - smoothstep(0.85, 1, e)) : 0;
  b.pitch = damp(b.pitch, climbPitch, 6, dt); b.roll = damp(b.roll, Math.sin(C.t * 19) * 0.06, 6, dt);
  b.x = x; b.z = z; b.y = y; b.vy = 0; b.pv = b.rv = 0; b.speed = 9;
  b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ');
  // white water everywhere
  const n = Math.round(dt * 260 * Q.particles);
  for (let i = 0; i < n; i++) sprayDrop(b.x + rand(-1.3, 1.3), b.y + rand(0, 1.2), b.z + rand(-1.3, 1.3), rand(-3, 3), rand(1, 6), rand(-3, 3), rand(0.5, 1.1), rand(0.03, 0.07));
  if (rng() < dt * 8 && FX.spawn) FX.spawn(b.x + rand(-2, 2), b.y + rand(0, 2), b.z + rand(-2, 2), rand(-0.5, 0.5), rand(0.2, 1), rand(-0.5, 0.5), rand(1.5, 3), rand(1.2, 2.6), 2, -0.05);
  P.shake = Math.max(P.shake || 0, 0.35);
  if (C.t > 1.35) { b.climb = null; b.hInit = false; b.speed = 6; if (FX.lens) FX.lens(30); }
}
function updateBoatDrive(dt) {
  const b = P.boat, t = U.uTime.value;
  const thr = input.my, steer = input.mx, boost = input.run;
  if (b.climb) {
    updateFallClimb(b, dt);
    b.mesh.updateMatrixWorld();
    _bv.set(0, 2.02, 0.74).applyMatrix4(b.mesh.userData.inner.matrixWorld);
    P.pos.copy(_bv); P.camY = P.pos.y; P.yaw = damp(P.yaw, b.yaw, 6, dt);
    if (AUDIO.engine) AUDIO.engine(1, 14, true);
    return;
  }
  b.speed += thr * (boost ? 9 : 6) * dt * (thr < 0 ? 0.6 : 1);
  b.speed -= b.speed * (0.22 + Math.abs(b.speed) * 0.011) * dt;
  b.speed = clamp(b.speed, -4.5, boost ? 22 : 14.5);
  const dir = b.speed < -0.2 ? -1 : 1;
  b.yawRate = damp(b.yawRate, -steer * (0.32 + Math.min(Math.abs(b.speed), 10) * 0.085) * dir, 4, dt);
  b.yaw += b.yawRate * dt;
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
  let nx = b.x + fx * b.speed * dt, nz = b.z + fz * b.speed * dt;
  const sgn = b.speed >= 0 ? 1 : -1;
  const kx = nx + fx * 2.5 * sgn, kz = nz + fz * 2.5 * sgn;
  // the bottom of the waterfall: drive at it and the boat climbs it
  const f = STREAM.fall;
  if (f && b.speed > 3 && thr > 0.2 && Math.hypot(b.x - f.x, b.z - f.z) < 7 && (fx * -f.dirX + fz * -f.dirZ) > 0.55 && b.y < f.botY + 1) { startFallClimb(b); return; }
  // in the river: the banks nudge you back toward the middle instead of stopping you dead
  const q = riverQuery(b.x, b.z);
  if (q && q.S > 0.05 && q.d < q.W + 1.5) {
    const A = STREAM.all[q.i], B = STREAM.all[q.i + 1], cx = lerp(A.x, B.x, q.t), cz = lerp(A.z, B.z, q.t);
    const off = Math.max(0, q.d - Math.max(0.6, q.W - 1.6));
    if (off > 0 && q.d > 1e-3) { const k = Math.min(1, off * 2.5 * dt); nx += (cx - b.x) / q.d * off * k * 3; nz += (cz - b.z) / q.d * off * k * 3; }
    // and turn you along the river if you're heading into a bank
    const along = fx * q.tx + fz * q.tz, tgtYaw = along >= 0 ? Math.atan2(-q.tx, -q.tz) : Math.atan2(q.tx, q.tz);
    let dy = tgtYaw - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    b.yaw += dy * Math.min(1, dt * (0.6 + off * 1.8) * Math.min(1, Math.abs(b.speed) / 4));
  }
  // the surf running up the sand doesn't count as water deep enough to drive in (a tsunami's flood does)
  if (!boatCanGo(kx, kz, t)) {
    if (Math.abs(b.speed) > 3) { if (AUDIO.slap) AUDIO.slap(0.6); P.shake = 0.6; }
    b.speed *= -0.25; nx = b.x; nz = b.z;
  }
  const r = Math.hypot(nx, nz); if (r > 1300) { nx *= 1300 / r; nz *= 1300 / r; b.speed *= 0.95; }
  b.x = nx; b.z = nz;
  boatPhysics(b, dt, thr);
  boatWaterFX(b, dt, thr);
  // the helm seat
  b.mesh.updateMatrixWorld();
  _bv.set(0, 2.02, 0.74).applyMatrix4(b.mesh.userData.inner.matrixWorld);
  P.pos.copy(_bv); P.camY = P.pos.y;
  P.yaw += b.yawRate * dt;
  b.seat.x = b.x; b.seat.z = b.z;
  if (AUDIO.engine) AUDIO.engine(Math.abs(thr), Math.abs(b.speed), true);
}

// ───────────────────── 27. Riding the river on an inner tube ─────────────────────
function startTube() {
  const L = STREAM.lower; if (!L.length) return;
  let best = 0, bd = 1e9; L.forEach((p, i) => { const d = Math.hypot(p.x - TUBE.x, p.z - TUBE.z); if (d < bd) { bd = d; best = i; } });
  TUBE.i = best; TUBE.o = 0; TUBE.riding = true; TUBE.rider = true;
  P.mode = 'tube'; P.vel.set(0, 0, 0);
  if (AUDIO.splash) AUDIO.splash(0.5);
  showActivityHint(isTouch ? 'Steer left and right with the joystick · Get off with the button' : 'A/D steer · W paddle · E get off');
}
function exitTube(intoSea) {
  TUBE.rider = false;
  P.mode = 'swim'; P.pos.y = (intoSea ? oceanHeight(P.pos.x, P.pos.z, U.uTime.value) : P.pos.y - 0.7) + 0.13; P.vel.set(0, 0, 0);
}
function updateTubeWorld(dt, t) {
  if (!TUBE.mesh) return;
  const L = STREAM.lower;
  if (TUBE.riding) {
    const i0 = Math.min(L.length - 2, Math.floor(TUBE.i)), f = TUBE.i - i0, A = L[i0], B = L[i0 + 1];
    const sp = lerp(A.speed, B.speed, f) * (TUBE.rider ? 0.85 + 0.35 * Math.max(0, input.my) : 0.8);
    TUBE.i += (sp * dt) / 1.5;
    const W = lerp(A.W, B.W, f), S = lerp(A.S, B.S, f), slope = lerp(A.slope, B.slope, f);
    if (TUBE.rider) TUBE.o += input.mx * 1.6 * dt;
    TUBE.o = clamp(TUBE.o * (1 - dt * 0.15), -(W - 1.1), W - 1.1);
    const tx = lerp(A.tx, B.tx, f), tz = lerp(A.tz, B.tz, f), nx = -tz, nz = tx;
    TUBE.x = lerp(A.x, B.x, f) + nx * TUBE.o; TUBE.z = lerp(A.z, B.z, f) + nz * TUBE.o;
    const rap = smoothstep(0.02, 0.12, slope);
    const y = S + Math.sin(t * 2.2) * 0.04 + Math.sin(t * 7.3) * 0.06 * rap;
    TUBE.spin += (0.18 + rap * 1.6) * dt;
    TUBE.mesh.position.set(TUBE.x, y - 0.06, TUBE.z);
    TUBE.mesh.rotation.set(Math.sin(t * 3.1) * 0.08 * rap - slope * 1.2 * 0, TUBE.spin, Math.cos(t * 2.7) * 0.08 * rap, 'YXZ');
    if (rap > 0.3 && FX.spawn && rng() < dt * 8 * rap) FX.splash(TUBE.x + rand(-0.6, 0.6), S, TUBE.z + rand(-0.6, 0.6), 0.35 + rap * 0.4);
    if (TUBE.rider) {
      P.pos.set(TUBE.x, y + 0.82, TUBE.z); P.camY = P.pos.y;
      P.tubeRoll = Math.sin(t * 2.7) * 0.03 * (1 + rap * 2);
      if (rap > 0.5 && FX.lens && rng() < dt * 1.2) FX.lens(2);
    }
    if (i0 >= L.length - 3 || S < 0.06) { // out into the sea
      if (TUBE.rider) exitTube(true);
      TUBE.riding = false; TUBE.away = t;
    }
  } else {
    // bob where it was left; go home once nobody is near it
    const away = TUBE.home && Math.hypot(TUBE.x - TUBE.home.x, TUBE.z - TUBE.home.z) > 3;
    if (away && Math.hypot(P.pos.x - TUBE.x, P.pos.z - TUBE.z) > 60 && Math.hypot(P.pos.x - TUBE.home.x, P.pos.z - TUBE.home.z) > 40) { TUBE.x = TUBE.home.x; TUBE.z = TUBE.home.z; }
    const w = waterAt(TUBE.x, TUBE.z);
    const y = w.level + Math.sin(t * 1.3) * 0.03;
    TUBE.mesh.position.set(TUBE.x, y - 0.06, TUBE.z); TUBE.mesh.rotation.set(Math.sin(t * 0.9) * 0.04, TUBE.spin + t * 0.05, Math.cos(t * 1.1) * 0.04, 'YXZ');
    TUBE.seat.y = y;
  }
  TUBE.seat.x = TUBE.x; TUBE.seat.z = TUBE.z;
}

// ───────────────────── 28. Tools: a shovel for digging, a stick for writing ─────────────────────
const TOOL = { cur: 'hands', aim: null, digT: 0, drawing: false, last: null, marker: null, vs: null, vm: {}, pen: false, scratch: 0, fill: false };
const TOOL_LIST = ['hands', 'shovel', 'bucket', 'stick', 'rod', 'surfboard', 'lantern'];
const TOOL_NAMES = { hands: 'Hands', shovel: 'Shovel', bucket: 'Bucket', stick: 'Driftwood stick', rod: 'Fishing rod', surfboard: 'Surfboard', lantern: 'Storm lantern' };
const BUCKET = { full: 0, anim: null, t: 0, dur: 0, src: null, poured: false, vol: 0.12 };
const TOOL_HINTS = {
  shovel: ['Shovel · click (or F) to dig · G or right-click: dig / place dirt · Q to switch', 'Shovel: tap Dig, or switch to Fill to pile up dirt'],
  bucket: ['Bucket · click (or F) to scoop up water, again to pour it out · Q to switch', 'Bucket: aim at water and tap Scoop, then Pour'],
  stick: ['Stick · hold the mouse button (or F) and look around to write · Q to switch', 'Stick: tap Draw, then look around to write in the sand'],
  rod: ['Fishing rod · hold the mouse button (or F) to wind up a cast · J for your fish journal', 'Fishing rod: hold Cast to wind up, let go to throw'],
  surfboard: ['Surfboard · wade or swim out and click (or F) to hop on · Space stands you up on a wave', 'Surfboard: wade out and tap Hop on'],
  lantern: ['Lantern · click (or F) to light or put out · by the boat, click to hang it up', 'Lantern: tap Light, or Hang it on the boat'],
};
function setTool(name) {
  TOOL.cur = name; TOOL.pen = false; TOOL.last = null;
  if (TOOL.vm.shovel) { TOOL.vm.shovel.visible = name === 'shovel'; TOOL.vm.stick.visible = name === 'stick'; TOOL.vm.bucket.visible = name === 'bucket'; if (TOOL.vm.rod) TOOL.vm.rod.visible = name === 'rod'; if (TOOL.vm.surfboard) TOOL.vm.surfboard.visible = name === 'surfboard'; if (TOOL.vm.lantern) TOOL.vm.lantern.visible = name === 'lantern' && LIGHTS.lantern.where === 'hand'; }
  if (name === 'hands') showActivityHint('');
  else showActivityHint(TOOL_HINTS[name][isTouch ? 1 : 0], true);
  updateToolButtons();
}
// on foot every tool; in the boat or sitting, just your hands or the rod
function cycleTool() {
  const list = P.mode === 'walk' ? TOOL_LIST : ['hands', 'rod', 'lantern'];
  setTool(list[(list.indexOf(TOOL.cur) + 1) % list.length]);
}
const _ad = new THREE.Vector3();
// where the view ray meets the ground, a floor, or (if asked) the surface of some water
function aimGround(maxD = 4.6, water = false) {
  camera.getWorldDirection(_ad); const o = camera.position;
  const surf = (x, y, z) => { const g = supportHeight(x, z, y); if (!water) return g; return Math.max(g, waterAt(x, z).level); };
  let prev = 0.25;
  for (let t = 0.35; t <= maxD; t += 0.1) {
    const x = o.x + _ad.x * t, y = o.y + _ad.y * t, z = o.z + _ad.z * t;
    if (y <= surf(x, y, z)) {
      let a = prev, b = t;
      for (let k = 0; k < 6; k++) { const m = (a + b) / 2, my = o.y + _ad.y * m; if (my <= surf(o.x + _ad.x * m, my, o.z + _ad.z * m)) b = m; else a = m; }
      const hx = o.x + _ad.x * b, hy = o.y + _ad.y * b, hz = o.z + _ad.z * b;
      const g = supportHeight(hx, hz, hy), wl = water ? waterAt(hx, hz).level : -99;
      return { x: hx, y: hy, z: hz, t: b, water: water && wl > g + 0.06 && wl >= hy - 0.08, floor: g > groundHeight(hx, hz) + 0.05 };
    }
    prev = t;
  }
  return null;
}
function buildTools() {
  // a small ring that shows where the tool will touch the ground
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.12, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  ring.visible = false; ring.renderOrder = 12; scene.add(ring); TOOL.marker = ring;
  // first-person models live in their own little scene, drawn over the world
  const vs = new THREE.Scene();
  const hl = new THREE.HemisphereLight(0xffffff, 0x886644, 1), dl = new THREE.DirectionalLight(0xffffff, 2);
  vs.add(hl, dl, dl.target);
  const grp = new THREE.Group(); vs.add(grp);
  const drift = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.62, 0.58, 0.52, THREE.SRGBColorSpace), roughness: 0.95 });
  // the spade is a Blender model (models/shovel.py): origin where the shaft meets the blade, +Y up the shaft to
  // the grip, the hollow of the blade facing -Z
  const shovel = assetModel('shovel', { lod: 0, cast: false, receive: false }) || new THREE.Group();
  const stick = new THREE.Group();
  const sg = new THREE.CylinderGeometry(0.012, 0.024, 0.95, 7, 6); const sp = sg.attributes.position;
  for (let i = 0; i < sp.count; i++) { const y = sp.getY(i); sp.setX(i, sp.getX(i) + Math.sin(y * 4) * 0.02); sp.setZ(i, sp.getZ(i) + Math.sin(y * 7 + 1) * 0.012); }
  sg.computeVertexNormals(); sg.translate(0, -0.475, 0);
  stick.add(new THREE.Mesh(sg, drift));
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.16, 5), drift); twig.position.set(0.03, -0.25, 0); twig.rotation.z = -0.7; stick.add(twig);
  // a galvanised bucket with a wire handle
  const bucket = new THREE.Group();
  const zinc = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.72, 0.75, 0.76, THREE.SRGBColorSpace), roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide });
  const bodyG = new THREE.CylinderGeometry(0.135, 0.105, 0.25, 28, 6, true); const bpz = bodyG.attributes.position;
  for (let i = 0; i < bpz.count; i++) { const y = bpz.getY(i); if (Math.abs(Math.abs(y) - 0.0625) < 0.01) { bpz.setX(i, bpz.getX(i) * 1.025); bpz.setZ(i, bpz.getZ(i) * 1.025); } }
  bodyG.computeVertexNormals();
  bucket.add(new THREE.Mesh(bodyG, zinc));
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.105, 28).rotateX(Math.PI / 2), zinc); bot.position.y = -0.124; bucket.add(bot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.136, 0.007, 6, 32).rotateX(Math.PI / 2), zinc); rim.position.y = 0.125; bucket.add(rim);
  const wire = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.0035, 5, 28, Math.PI), new THREE.MeshStandardMaterial({ color: 0x777b7e, roughness: 0.4, metalness: 0.8 }));
  wire.position.y = 0.11; bucket.add(wire); TOOL.bucketWire = wire;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.128, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.1, 0.42, 0.48, THREE.SRGBColorSpace), roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.88 }));
  water.position.y = 0.08; bucket.add(water); TOOL.bucketWater = water;
  grp.add(shovel, stick, bucket); shovel.visible = stick.visible = bucket.visible = false;
  TOOL.vs = vs; TOOL.vm = { grp, shovel, stick, bucket, hl, dl };
  buildWake();
}
const _tq = new THREE.Quaternion(), _tv = new THREE.Vector3(), _tm = new THREE.Matrix4();
const SHOVEL_HOLD = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.22, 0.12, 0.97).normalize());
function updateTools(dt) {
  if (PUMP.carry && started && !panelOpen && input.usePressed) { input.usePressed = false; placeCarried(); }
  if (TOOL.cur === 'surfboard' && started && !panelOpen && input.usePressed && P.mode !== 'surf') { input.usePressed = false; startSurf(); }
  if (TOOL.cur === 'lantern' && started && !panelOpen && input.usePressed) { input.usePressed = false; useLantern(); }
  const cur = TOOL.cur, ok = cur !== 'hands' && cur !== 'rod' && cur !== 'surfboard' && cur !== 'lantern' && P.mode === 'walk' && started && !panelOpen;
  if (started && !panelOpen) updateFishing(dt);
  TOOL.aim = ok ? aimGround(4.6, cur === 'bucket') : null;
  const a = TOOL.aim;
  let can = null;
  if (a && cur !== 'bucket') can = a.floor ? 'wood' : cur === 'shovel' && TOOL.fill ? canFill(a.x, a.z) : canDig(a.x, a.z);
  if (TOOL.marker) {
    TOOL.marker.visible = !!a;
    if (a) { TOOL.marker.position.set(a.x, a.y + 0.02, a.z); TOOL.marker.material.color.setRGB(can ? 1 : 1, can ? 0.55 : 1, can ? 0.45 : 1); TOOL.marker.scale.setScalar(cur === 'shovel' ? 4.5 * DIG.radius / 0.62 * (TOOL.fill ? 1.6 : 1) : cur === 'bucket' ? 3 : 1); if (cur === 'shovel' && TOOL.fill && !can) TOOL.marker.material.color.setRGB(0.75, 0.55, 0.35); if (cur === 'bucket') TOOL.marker.material.color.setRGB(a.water ? 0.6 : 1, a.water ? 0.9 : 1, 1); }
  }
  const use = input.use || TOOL.pen;
  TOOL.digT = Math.max(0, TOOL.digT - dt);
  if (cur === 'shovel' && ok) {
    if ((input.use || input.usePressed) && TOOL.digT <= 0 && a) {
      if (can) { showActivityHint(can === 'rock' ? 'Too rocky to dig here' : can === 'deep' ? 'Too deep here' : can === 'steep' ? 'Too steep to pile dirt here' : can === 'wood' ? (TOOL.fill ? 'Not on the wood' : 'You can’t dig through wood') : 'Something is in the way', true, 1.6); TOOL.digT = 0.4; }
      else { TOOL.digT = 0.62; TOOL.pending = { x: a.x, z: a.z, y: a.y, t: 0.26, fill: !!TOOL.fill }; }
    }
  }
  if (TOOL.pending) {
    TOOL.pending.t -= dt;
    if (TOOL.pending.t <= 0) {
      const p = TOOL.pending; TOOL.pending = null;
      const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      if (p.fill) {
        // a shovelful of dirt thrown down where you're aiming
        const added = fillAt(p.x, p.z);
        if (typeof cutGrass === 'function') cutGrass(p.x, p.z, Math.max(0.9, DIG.radius * 1.6));
        if (added > 0) {
          if (AUDIO.dig) AUDIO.dig();
          const w = waterAt(p.x, p.z), wet = w.level > groundHeight(p.x, p.z) + 0.05;
          for (let i = 0; i < 14 * Q.particles + 5; i++) FX.spawn(p.x - fx * 0.6 + rand(-0.25, 0.25), p.y + 0.9, p.z - fz * 0.6 + rand(-0.25, 0.25), fx * rand(0.6, 1.8) + rand(-0.4, 0.4), rand(0.2, 1.4), fz * rand(0.6, 1.8) + rand(-0.4, 0.4), rand(0.5, 0.9), rand(0.03, 0.06), 3, 9.8);
          if (wet && typeof splashAt === 'function') splashAt(p.x, w.level, p.z, 0.6);
        }
        surveyRiver(p.x, p.z);
      } else {
        const removed = digAt(p.x, p.z, p.x + rx * 1.05 - fx * 0.15, p.z + rz * 1.05 - fz * 0.15);
        if (typeof cutGrass === 'function') cutGrass(p.x, p.z, Math.max(0.9, DIG.radius * 1.4));
        if (removed > 0) {
          if (AUDIO.dig) AUDIO.dig();
          for (let i = 0; i < 10 * Q.particles + 4; i++) FX.spawn(p.x + rand(-0.2, 0.2), p.y + 0.05, p.z + rand(-0.2, 0.2), rx * rand(0.6, 1.6) + rand(-0.3, 0.3), rand(1.2, 2.6), rz * rand(0.6, 1.6) + rand(-0.3, 0.3), rand(0.5, 0.9), rand(0.025, 0.05), 3, 9.8);
        }
        surveyRiver(p.x, p.z);   // digging through a dam lets the river go again
      }
    }
  }
  if (cur === 'bucket' && ok) updateBucket(dt, a);
  if (cur === 'stick' && ok && use && a && !can) {
    if (TOOL.last && Math.hypot(a.x - TOOL.last.x, a.z - TOOL.last.z) < 0.9) {
      const d = Math.hypot(a.x - TOOL.last.x, a.z - TOOL.last.z);
      if (d > 0.012) { carveStroke(TOOL.last.x, TOOL.last.z, a.x, a.z); TOOL.scratch = Math.min(1, TOOL.scratch + d * 6); TOOL.last = { x: a.x, z: a.z }; }
    } else TOOL.last = { x: a.x, z: a.z };
  } else TOOL.last = null;
  TOOL.scratch = Math.max(0, TOOL.scratch - dt * 4);
  if (AUDIO.scratch) AUDIO.scratch(TOOL.scratch);
  input.usePressed = false;
  // first-person model
  const vm = TOOL.vm; if (!vm.grp) return;
  vm.grp.visible = (cur !== 'hands' && (P.mode === 'walk' || ((cur === 'rod' || cur === 'lantern') && (P.mode === 'swim' || P.mode === 'seat' || P.mode === 'boat')))) || !!(FISHING.held && FISHING.held.visible) || (!!PUMP.carry && P.mode === 'walk');
  if (!vm.grp.visible) return;
  vm.grp.position.copy(camera.position); vm.grp.quaternion.copy(camera.quaternion);
  vm.dl.color.copy(sun.color); vm.dl.intensity = sun.intensity; vm.dl.position.copy(camera.position).addScaledVector(U.uLightDir.value, 10); vm.dl.target.position.copy(camera.position); vm.dl.target.updateMatrixWorld();
  vm.hl.color.copy(hemi.color); vm.hl.groundColor.copy(hemi.groundColor); vm.hl.intensity = hemi.intensity;
  const bob = settings.headBob ? Math.sin(P.bob * 2) * 0.012 * P.bobAmt : 0, sway = Math.cos(P.bob) * 0.01 * P.bobAmt;
  if (cur === 'surfboard') { vm.surfboard.position.set(0.72 + sway, -0.62 + bob, -0.75); }
  else if (cur === 'rod') poseRod(dt, sway, bob);
  else if (cur === 'lantern') poseLantern(dt, sway, bob);
  else if (cur === 'bucket') {
    const b = vm.bucket, B = BUCKET, ph = B.anim ? clamp(B.t / B.dur, 0, 1) : 0;
    const dip = B.anim === 'scoop' ? Math.sin(ph * Math.PI) : 0;
    const tip = B.anim === 'pour' ? smoothstep(0, 0.3, ph) * (1 - smoothstep(0.82, 1, ph)) : 0;
    b.position.set(0.27 + sway, -0.44 + bob - dip * 0.32 + tip * 0.08, -0.66 - dip * 0.25 - tip * 0.12);
    b.rotation.set(-dip * 0.7 - tip * 1.75, 0.25, tip * 0.25);
    TOOL.bucketWire.rotation.set(0, 0, -0.2 - tip * 0.8);
    const fill = B.anim === 'pour' ? B.full * (1 - smoothstep(0.3, 0.9, ph)) : B.full;
    TOOL.bucketWater.visible = fill > 0.03;
    TOOL.bucketWater.position.y = -0.11 + 0.2 * fill;
    TOOL.bucketWater.rotation.set(dip * 0.6 + tip * 1.5 + Math.sin(P.t * 3.1) * 0.03 * P.bobAmt, 0, Math.cos(P.t * 2.7) * 0.03 * P.bobAmt);
  } else if (cur === 'shovel') {
    const s = vm.shovel, ph = TOOL.digT > 0 ? 1 - TOOL.digT / 0.62 : 0;
    const thrust = Math.sin(Math.min(1, ph / 0.42) * Math.PI) , toss = ph > 0.42 ? Math.sin((ph - 0.42) / 0.58 * Math.PI) : 0;
    // held low and to the right, blade out in front; dig = push in, lever back, toss the sand right
    s.position.set(0.21 + sway + toss * 0.12, -0.56 + bob - thrust * 0.12 + toss * 0.2, -1.15 - thrust * 0.3 + toss * 0.25);
    s.quaternion.copy(SHOVEL_HOLD);
    _tq.setFromEuler(new THREE.Euler(-thrust * 0.35 + toss * 0.5, 0, -toss * 0.9)); s.quaternion.multiply(_tq);
  } else {
    const s = vm.stick;
    s.position.set(0.24 + sway, -0.34 + bob, -0.42);
    if (a) { // point the stick at the spot it is drawing on
      _tv.set(a.x, a.y, a.z); vm.grp.worldToLocal(_tv);
      const dir = _tv.sub(s.position).normalize();
      _tq.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); s.quaternion.slerp(_tq, 1 - Math.exp(-dt * 14));
      if (use) s.position.addScaledVector(dir, 0.08);
    } else s.quaternion.slerp(_tq.setFromEuler(new THREE.Euler(-0.6, 0.1, 0.2)), 1 - Math.exp(-dt * 8));
  }
}
// scooping and pouring
const _bl = new THREE.Vector3();
function bucketLip() { _bl.set(0.27, -0.36, -0.86).applyQuaternion(camera.quaternion).add(camera.position); return _bl; }
function updateBucket(dt, a) {
  const B = BUCKET;
  if (!B.anim && (input.use || input.usePressed)) {
    if (B.full < 0.05) {
      const standing = P.depth > 0.3 ? { x: P.pos.x, z: P.pos.z, y: P.water.level, water: true } : null;
      const src = a && a.water ? a : standing;
      if (src) { B.anim = 'scoop'; B.t = 0; B.dur = 0.75; B.src = { x: src.x, y: src.y, z: src.z }; }
      else showActivityHint('Nothing to scoop up here: try the sea, the river or a pool you dug', true, 2.2);
    } else { B.anim = 'pour'; B.t = 0; B.dur = 1.3; B.poured = false; B.target = a ? { x: a.x, y: a.y, z: a.z, water: a.water, floor: a.floor } : null; }
  }
  if (!B.anim || B.anim !== 'pour') updatePourStream(null, null, 0);
  if (!B.anim) { if (AUDIO.pour) AUDIO.pour(0); return; }
  B.t += dt;
  const ph = B.t / B.dur;
  if (B.anim === 'scoop') {
    if (ph >= 0.45 && !B.got) {
      B.got = true;
      const s = B.src, w = waterAt(s.x, s.z);
      let amt = 1;
      if (w.kind === 'fresh' && SAND.count && sandWaterAt(s.x, s.z)) amt = clamp(scoopAt(s.x, s.z, B.vol) / B.vol, 0, 1);
      B.full = Math.max(B.full, amt);
      if (AUDIO.scoop) AUDIO.scoop();
      if (FX.splash) FX.splash(s.x, w.level, s.z, 0.45);
    }
    if (ph >= 1) { B.anim = null; B.got = false; updateToolButtons(); }
    return;
  }
  // pouring: a stream from the lip down to where you're looking
  const flow = ph > 0.28 && ph < 0.9 ? 1 : 0;
  if (!flow) updatePourStream(null, null, 0);
  if (AUDIO.pour) AUDIO.pour(flow * B.full);
  if (flow && FX.spawn) {
    const lip = bucketLip();
    // aim the stream so it lands on the target
    const tg = B.target && Math.hypot(B.target.x - P.pos.x, B.target.z - P.pos.z) < 3.8 ? B.target : { x: lip.x - Math.sin(P.yaw) * 0.55, z: lip.z - Math.cos(P.yaw) * 0.55, y: supportHeight(lip.x, lip.z, lip.y) };
    const tf = Math.sqrt(Math.max(0.05, 2 * Math.max(0.05, lip.y - (tg.y ?? lip.y - 1)) / 9.8));
    const vx0 = (tg.x - lip.x) / tf, vz0 = (tg.z - lip.z) / tf;
    updatePourStream(lip, new THREE.Vector3(vx0, 0.2, vz0), B.full);
    const n = Math.ceil(dt * 40 * Math.max(0.4, Q.particles));
    for (let i = 0; i < n; i++) sprayDrop(tg.x + rand(-0.08, 0.08), (tg.y ?? lip.y - 1) + 0.03, tg.z + rand(-0.08, 0.08), rand(-1.2, 1.2), rand(0.8, 2.2), rand(-1.2, 1.2), 0.5, rand(0.015, 0.03));
    if (rng() < dt * 25) rippleDrop(tg.x, tg.z, 0.3, 0.12, 0.35);
  }
  if (ph >= 0.55 && !B.poured) {
    B.poured = true;
    const lip = bucketLip(), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    // where the water lands: where you aimed, or just in front of you
    const tg = B.target && Math.hypot(B.target.x - P.pos.x, B.target.z - P.pos.z) < 3.8 ? B.target : null;
    const lx = tg ? tg.x : lip.x + fx * 0.55, lz = tg ? tg.z : lip.z + fz * 0.55;
    const g = supportHeight(lx, lz, lip.y), wl = waterAt(lx, lz).level;
    const fp = CABIN.lampPos && CABIN.lampPos[3];
    if (fp && CABIN.fireOn && Math.hypot(lx - fp.x, lz - fp.z) < 1.4 && Math.abs(lip.y - fp.y) < 2.5) {
      CABIN.fireOn = false; CABIN.fireManual = true;
      for (let i = 0; i < 26; i++) FX.spawn(fp.x + rand(-0.3, 0.3), fp.y, fp.z + rand(-0.3, 0.3), rand(-0.2, 0.2), rand(0.6, 1.4), rand(-0.2, 0.2), rand(1.5, 3), rand(0.15, 0.4), 2, -0.1);
      if (AUDIO.splash) AUDIO.splash(0.5);
      showActivityHint('Hiss… the fire is out', true, 2.2);
    } else if (wl > g + 0.05) { if (FX.splash) FX.splash(lx, wl, lz, 0.7); if (AUDIO.splash) AUDIO.splash(0.45); }
    else if (g > groundHeight(lx, lz) + 0.05) { if (FX.splash) FX.splash(lx, g, lz, 0.5); } // on a floor or the dock
    else { pourAt(lx, lz, B.vol * B.full); if (FX.splash) FX.splash(lx, g, lz, 0.55); }
    B.full = 0;
  }
  if (ph >= 1) { B.anim = null; updateToolButtons(); }
}
function renderTools() {
  if (POST.toolsDone) { POST.toolsDone = false; return; }   // already drawn into the HDR picture
  if (!TOOL.vs || !TOOL.vm.grp || !TOOL.vm.grp.visible) return;
  renderer.autoClear = false; renderer.clearDepth(); renderer.render(TOOL.vs, camera); renderer.autoClear = true;
}
// small hint line for the current activity
let actHintT = 0, actSticky = '';
// sticky hints stay up (the current tool); timed ones show for a moment, then the sticky one returns
function showActivityHint(text, sticky = true, secs = 0) {
  const el = $('act-hint'); if (!el) return;
  clearTimeout(actHintT);
  if (secs) { el.textContent = text; el.hidden = !text; actHintT = setTimeout(() => { el.textContent = actSticky; el.hidden = !actSticky; }, secs * 1000); return; }
  if (sticky) actSticky = TOOL.cur !== 'hands' ? text : '';
  el.textContent = text; el.hidden = !text;
  if (!sticky || P.mode === 'boat' || P.mode === 'tube') actHintT = setTimeout(() => { el.textContent = actSticky; el.hidden = !actSticky; }, 7000);
}
function updateToolButtons() {
  const tb = $('t-tool'), ub = $('t-use');
  if (!tb) return;
  tb.textContent = TOOL.cur === 'hands' ? 'Tools' : TOOL_NAMES[TOOL.cur].split(' ').pop().replace(/^./, c => c.toUpperCase());
  if (PUMP.carry) { ub.hidden = !isTouch; ub.textContent = 'Place'; return; }
  ub.hidden = !(isTouch && TOOL.cur !== 'hands' && (P.mode === 'walk' || ((TOOL.cur === 'rod' || TOOL.cur === 'lantern') && P.mode !== 'tube') || (TOOL.cur === 'surfboard' && P.mode === 'swim')));
  ub.textContent = TOOL.cur === 'lantern' ? (LIGHTS.lantern.where === 'boat' ? 'Take' : nearBoatForLantern() ? 'Hang' : LIGHTS.lantern.on ? 'Put out' : 'Light') : TOOL.cur === 'surfboard' ? 'Hop on' : TOOL.cur === 'rod' ? (FISHING.state === 'idle' ? 'Cast' : FISHING.state === 'fighting' || FISHING.state === 'bite' ? 'Reel' : FISHING.state === 'casting' ? 'Cast' : 'Reel in') : TOOL.cur === 'shovel' ? (TOOL.fill ? 'Fill' : 'Dig') : TOOL.cur === 'bucket' ? (BUCKET.full > 0.05 ? 'Pour' : 'Scoop') : (TOOL.pen ? 'Lift' : 'Draw');
  ub.classList.toggle('down', TOOL.pen);
  const mb = $('t-mode'); if (mb) { mb.hidden = ub.hidden || TOOL.cur !== 'shovel'; mb.textContent = TOOL.fill ? 'Dig mode' : 'Fill mode'; }
}
// the shovel either digs or throws down dirt
function toggleShovelMode() {
  if (TOOL.cur !== 'shovel') return;
  TOOL.fill = !TOOL.fill;
  showActivityHint(TOOL.fill ? 'Placing dirt · pile it up to build banks or dam the river' : 'Digging', true, 2.2);
  updateToolButtons();
}
