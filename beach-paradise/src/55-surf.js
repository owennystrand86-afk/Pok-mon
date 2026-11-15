
// ───────────────────── 16e. Surfing ─────────────────────
// Pick the surfboard from your tools (Q), wade or swim out, and hop on. Lie down and paddle out
// past the break, turn toward the beach as a wave comes, paddle to catch it, and stand up
// (Space) once it has you. Standing, you carve with A/D (or the joystick): angle along the wave to
// ride it, head straight down and you'll outrun it or nose-dive, get caught by the lip and you
// wipe out. Works anywhere there are waves; the bigger the waves, the faster the ride.
const SURF = {
  mesh: null, x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, stand: false, roll: 0, pitch: 0, stallT: 0,
  ride: 0, best: 0, caught: false, sprayT: 0, paddleT: 0, onFace: 0, lastG: 0,
};
function surfboardGeometry(len = 2.15, wid = 0.56) {
  // outline: a rounded nose and a squash tail, extruded and bevelled into a rail
  const sh = new THREE.Shape(), N = 24, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, z = (t - 0.5) * len;
    const w = wid / 2 * (t < 0.62 ? Math.pow(Math.sin(Math.PI * 0.5 * Math.min(1, t / 0.62)), 0.55) : Math.pow(Math.cos(Math.PI * 0.5 * (t - 0.62) / 0.38), 0.75) * 0.98 + 0.02);
    pts.push([w * (t < 0.03 ? 0.75 : 1), z]);
  }
  sh.moveTo(-pts[0][0], pts[0][1]);
  for (const [w, z] of pts) sh.lineTo(-w, z);
  for (let i = pts.length - 1; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.02, bevelSegments: 3, curveSegments: 6, steps: 1 });
  g.rotateX(Math.PI / 2); g.translate(0, 0.0, 0);
  // rocker: the nose and tail lift
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const z = p.getZ(i), t = z / (len / 2); p.setY(i, p.getY(i) + (t > 0 ? t * t * 0.18 : t * t * 0.06)); }
  g.computeVertexNormals();
  // colours: white with a teal stripe down the deck and a dark rail band
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    let c = [0.95, 0.94, 0.9];
    if (Math.abs(x) < 0.05) c = [0.1, 0.55, 0.6];
    if (Math.abs(x) > 0.13 && Math.abs(x) < 0.16 && z < 0.7) c = [0.95, 0.5, 0.18];
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function buildSurf() {
  const mat = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 }), { key: 'surfboard' });
  const grp = new THREE.Group();
  const board = new THREE.Mesh(surfboardGeometry(), mat); board.castShadow = true; board.receiveShadow = true; grp.add(board);
  const fin = new THREE.Mesh(prep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0.75), new THREE.Vector3(0, -0.14, 0.92), new THREE.Vector3(0, 0, 0.98)]).setIndex([0, 1, 2, 0, 2, 1]), [0.12, 0.12, 0.13]), propMatDouble);
  fin.geometry.computeVertexNormals(); grp.add(fin);
  // a leash coiled at the tail
  const leash = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1a1c }));
  leash.position.set(0, 0.045, 1.0); grp.add(leash);
  grp.visible = false; scene.add(grp); SURF.mesh = grp;
  // carried under your arm while it's your tool
  const vm = TOOL.vm; if (!vm.grp) return;
  const carry = new THREE.Group();
  const cb = new THREE.Mesh(surfboardGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3 }));
  cb.rotation.set(0, 0, Math.PI / 2); cb.scale.setScalar(0.8); carry.add(cb);
  carry.position.set(0.72, -0.62, -0.75); carry.rotation.set(0.15, 0.32, 0.08);
  carry.visible = false; vm.grp.add(carry); vm.surfboard = carry;
}
// the surf at a point: where in the wave cycle (g), how big this wave is here (amp), and the push
function surfAtJS(x, z, t) {
  const depth = -groundHeight(x, z), o = {};
  surfState(x, z, depth, t, o);
  return { g: o.g, amp: o.a, brk: o.brk, plunge: o.plunge, depth };
}
function canSurfHere() {
  if (P.mode === 'swim') return true;
  if (P.mode === 'walk' && P.depth > 0.4) return true;
  return false;
}
function startSurf() {
  if (!canSurfHere()) { showActivityHint('Wade out into deeper water first', true, 1.8); return; }
  P.mode = 'surf';
  SURF.x = P.pos.x; SURF.z = P.pos.z; SURF.yaw = P.yaw; SURF.vx = P.vel.x * 0.5; SURF.vz = P.vel.z * 0.5;
  SURF.stand = false; SURF.ride = 0; SURF.caught = false; SURF.stallT = 0;
  SURF.y = waterAt(SURF.x, SURF.z).level;
  SURF.mesh.visible = true;
  if (AUDIO.splash) AUDIO.splash(0.35);
  showActivityHint(isTouch ? 'Joystick: paddle and turn · ▲ to stand up on a wave · Get off with the button' : 'W paddle · A/D turn · Space stand up when a wave picks you up · E get off');
}
function endSurf(toSwim = true, wiped = false) {
  SURF.mesh.visible = false;
  const w = waterAt(SURF.x, SURF.z), g = groundHeight(SURF.x, SURF.z);
  if (!toSwim || w.level - g < 1.1) { P.mode = 'walk'; P.pos.set(SURF.x, Math.max(g, w.level - 1.0) + EYE, SURF.z); P.onGround = false; }
  else { P.mode = 'swim'; P.pos.set(SURF.x, w.level - (wiped ? 1.2 : 0.1), SURF.z); }
  P.vel.set(SURF.vx * 0.4, 0, SURF.vz * 0.4); P.camY = P.pos.y;
  if (SURF.ride > 3) { SURF.best = Math.max(SURF.best, SURF.ride); toast(`${SURF.ride.toFixed(1)} s ride`, SURF.ride >= SURF.best ? 'Your best yet' : `Best ${SURF.best.toFixed(1)} s`); }
  SURF.ride = 0; SURF.stand = false;
  if (TOOL.cur === 'surfboard') showActivityHint(TOOL_HINTS.surfboard[isTouch ? 1 : 0], true);
}
function wipeout(why) {
  SURF.lastEnd = why;
  P.dunk = 1; P.shake = 0.8; if (FX.lens) FX.lens(30);
  splashAt(SURF.x, SURF.y, SURF.z, 1.6); if (AUDIO.waveHit) AUDIO.waveHit(1.0);
  if (FX.bubbles) FX.bubbles(SURF.x, SURF.y - 1, SURF.z, 14);
  showActivityHint(why, true, 2.4);
  endSurf(true, true);
}
const _sv = new THREE.Vector3();
function updateSurf(dt) {
  const t = U.uTime.value, x = SURF.x, z = SURF.z;
  const w = waterAt(x, z), sea = w.kind === 'sea';
  const lvl = w.level, gnd = groundHeight(x, z);
  // the water's slope under the board
  const e = 0.7, hx = sea ? (oceanHeight(x + e, z, t) - oceanHeight(x - e, z, t)) / (2 * e) : 0, hz = sea ? (oceanHeight(x, z + e, t) - oceanHeight(x, z - e, t)) / (2 * e) : 0;
  const sd = seaDir(x, z), shx = -sd.x, shz = -sd.z;           // toward the beach
  const sa = sea ? surfAtJS(x, z, t) : { g: 0.5, amp: 0, depth: lvl - gnd };
  const onFace = sa.amp > 0.22 && sa.g > 0.72 && sa.g < 0.995;
  const white = sa.amp > 0.22 && sa.g < 0.22;
  const faceK = onFace ? smoothstep(0.72, 0.9, sa.g) : 0;
  SURF.onFace = damp(SURF.onFace, faceK, 6, dt);
  const fx = -Math.sin(SURF.yaw), fz = -Math.cos(SURF.yaw), rx = Math.cos(SURF.yaw), rz = -Math.sin(SURF.yaw);
  const st = SURF.stand;
  let mx = input.mx, my = input.my;
  // forces
  let ax = -9.8 * hx * (st ? 1.1 : 0.6), az = -9.8 * hz * (st ? 1.1 : 0.6);
  if (!st && my > 0.05) { ax += fx * 2.4 * my; az += fz * 2.4 * my; SURF.paddleT += dt * (1 + my); if (SURF.paddleT > 0.55) { SURF.paddleT = 0; if (AUDIO.stroke) AUDIO.stroke(false); rippleDrop(x + rx * 0.4, z + rz * 0.4, 0.3, 0.06, 0.15); rippleDrop(x - rx * 0.4, z - rz * 0.4, 0.3, 0.06, 0.15); } }
  // the wave picks you up and drives you toward the beach while you're on its face; white water shoves you in
  const push = SURF.onFace * sa.amp * (st ? 5.2 : 3.4) + (white ? sa.amp * (st ? 2.0 : 3.0) : 0);
  ax += shx * push; az += shz * push;
  if (st) { ax += fx * Math.max(0, my) * 1.2; az += fz * Math.max(0, my) * 1.2; }      // pumping
  ax += (w.fx || 0) * 0.6; az += (w.fz || 0) * 0.6;
  SURF.vx += ax * dt; SURF.vz += az * dt;
  // the fin and rails: sideways slip is turned into forward speed when you carve
  let fwd = SURF.vx * fx + SURF.vz * fz, side = SURF.vx * rx + SURF.vz * rz;
  const grip = st ? 7 : 2.5, side2 = side * Math.exp(-grip * dt);
  fwd += Math.abs(side - side2) * (st ? 0.55 : 0.1) * Math.sign(fwd || 1);
  fwd *= Math.exp(-(st ? 0.1 + Math.max(0, -my) * 0.8 : 0.9) * dt); fwd -= fwd * Math.abs(fwd) * 0.004 * dt;
  SURF.vx = fx * fwd + rx * side2; SURF.vz = fz * fwd + rz * side2;
  // turning
  const sp = Math.hypot(SURF.vx, SURF.vz);
  const yr = -mx * (st ? 1.0 + Math.min(sp, 6) * 0.15 - Math.max(0, sp - 8) * 0.05 : 1.4);
  SURF.yaw += yr * dt;
  SURF.roll = damp(SURF.roll, st ? clamp(-yr * sp * 0.05, -0.5, 0.5) : Math.sin(t * 1.3) * 0.03, 6, dt);
  SURF.x += SURF.vx * dt; SURF.z += SURF.vz * dt;
  // riding onto the sand
  const g2 = groundHeight(SURF.x, SURF.z), lv2 = waterAt(SURF.x, SURF.z).level;
  if (lv2 - g2 < 0.22) { SURF.lastEnd = 'beach'; showActivityHint(st ? 'You rode it all the way in!' : 'Washed up on the beach', true, 2); endSurf(false); return; }
  SURF.y = lv2;
  // standing up: once a wave has you moving
  SURF.caught = SURF.onFace > 0.35 && fwd > 2.2 && (fx * shx + fz * shz) > 0.2;
  if (!st) {
    if (SURF.caught) showActivityHint(isTouch ? 'The wave has you! Tap ▲ to stand up' : 'The wave has you! Press Space to stand up', true, 1.0);
    if (input.jump && fwd > 1.6) { SURF.stand = true; SURF.ride = 0; if (AUDIO.splash) AUDIO.splash(0.3); splashAt(SURF.x, SURF.y, SURF.z, 0.4); showActivityHint(isTouch ? 'Joystick to carve along the wave · ▼ to lie back down' : 'A/D carve along the wave · W pump for speed · S slow down · C lie back down', true); }
  } else {
    SURF.ride += dt;
    // falling off
    const facing = fx * shx + fz * shz;
    if (sa.amp > 0.75 && (sa.g > 0.975 || sa.g < 0.05) && facing < -0.1) return wipeout('Wiped out: the lip caught you');
    if (sa.amp > 0.85 && SURF.onFace > 0.85 && facing > 0.94 && fwd > 8.5 && sa.g > 0.95) return wipeout('Nose-dived down the face');
    if (Math.abs(yr) * sp > 24) return wipeout('Turned too hard and fell');
    if (fwd < 0.9) SURF.stallT += dt; else SURF.stallT = 0;
    if (SURF.stallT > 1.4) { SURF.lastEnd = 'stall'; SURF.stand = false; SURF.stallT = 0; showActivityHint('Lost the wave', true, 1.4); }
    if (input.down) { SURF.stand = false; }
  }
  // spray off the rail and foam trail when carving
  if (st && sp > 3) {
    SURF.sprayT += dt;
    if (SURF.sprayT > 0.06) {
      SURF.sprayT = 0;
      rippleDrop(SURF.x - fx * 0.9, SURF.z - fz * 0.9, 0.35, 0.05, Math.min(0.6, sp * 0.05));
      const s = Math.sign(yr || 1), n = Math.round(Math.min(8, Math.abs(yr) * sp * 1.4) * Q.particles);
      for (let i = 0; i < n; i++) sprayDrop(SURF.x + rx * s * 0.3 + fx * rand(-0.2, 0.4), SURF.y + 0.05, SURF.z + rz * s * 0.3 + fz * rand(-0.2, 0.4), rx * s * rand(1.5, 3.5) + SURF.vx * 0.4, rand(1.2, 2.8), rz * s * rand(1.5, 3.5) + SURF.vz * 0.4, rand(0.5, 0.9), rand(0.02, 0.045));
    }
  }
  // the board follows the water surface
  const along = (oceanHeightSafe(SURF.x + fx * 1, SURF.z + fz * 1, t, sea) - oceanHeightSafe(SURF.x - fx * 1, SURF.z - fz * 1, t, sea)) / 2;
  SURF.pitch = damp(SURF.pitch, Math.atan(along) + (st ? 0 : 0.04), 8, dt);
  SURF.mesh.position.set(SURF.x, SURF.y + 0.02, SURF.z);
  SURF.mesh.rotation.set(-SURF.pitch, SURF.yaw, SURF.roll, 'YXZ');
  // your eyes: lying on the board, or standing on it
  const eyeUp = st ? 1.5 : 0.48, back = st ? 0.15 : -0.35;
  P.pos.set(SURF.x - fx * back, SURF.y + eyeUp, SURF.z - fz * back); P.camY = P.pos.y;
  P.vel.set(SURF.vx, 0, SURF.vz); P.water = w; P.depth = lv2 - g2;
  if (!st) { let d = SURF.yaw - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * (1 - Math.exp(-dt * 3)); }   // lying, you look where you're paddling
  if (AUDIO.pour) AUDIO.pour(st ? clamp(sp / 12, 0, 1) * 0.6 : 0);
}
const oceanHeightSafe = (x, z, t, sea) => sea ? oceanHeight(x, z, t) : waterAt(x, z).level;
