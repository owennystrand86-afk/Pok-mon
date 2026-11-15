
// ───────────────────── 16c. The biplane ─────────────────────
// An open-cockpit biplane parked on the beach. Throttle up, roll down the sand and lift off.
// Land it gently on the wheels; touch the sea and it's lost to the deep; fly it into the ground
// and it explodes. Local space: nose toward -z, up +y, right +x; the origin is the centre of mass.
const PLANE = {
  mesh: null, parts: {}, home: null, x: 0, y: 0, z: 0, q: new THREE.Quaternion(), vel: new THREE.Vector3(), w: new THREE.Vector3(),
  throttle: 0, onGround: true, state: 'parked', stick: new THREE.Vector2(), head: { yaw: 0, pitch: 0 }, sinkT: 0, wreck: null, crashT: 0,
};
const PL_GEAR = { wheelY: -1.55, wheelZ: -1.0, wheelX: 0.85, tailY: -0.72, tailZ: 3.2 };
const PL_TAILDOWN = Math.atan2(PL_GEAR.wheelY - PL_GEAR.tailY, PL_GEAR.tailZ - PL_GEAR.wheelZ) * -1; // nose up sitting on the tail skid
const planeMat = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 }), { key: 'plane' });
const planeMetal = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }), { key: 'planeMetal' });
function planeGeometry() {
  const fab = [], met = [], dark = [];
  const RED = [0.66, 0.08, 0.06], CREAM = [0.9, 0.86, 0.74], WOOD = [0.5, 0.32, 0.17], DARK = [0.08, 0.08, 0.09];
  // fuselage: elliptical sections from the engine back to the tail
  {
    const N = 24, R = 14, pos = [], col = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = lerp(-2.2, 3.5, t);
      const w = 0.5 * (t < 0.12 ? lerp(0.95, 1, t / 0.12) : lerp(1, 0.16, Math.pow((t - 0.12) / 0.88, 1.3)));
      const h = 0.55 * (t < 0.12 ? 1 : lerp(1, 0.25, Math.pow((t - 0.12) / 0.88, 1.2)));
      const cyy = lerp(0.05, 0.22, t);
      for (let k = 0; k <= R; k++) {
        const a = (k / R) * TAU, x = Math.cos(a) * w, y = cyy + Math.sin(a) * h;
        pos.push(x, y, z);
        const stripe = Math.abs(y - cyy - 0.02) < 0.06 && t > 0.15;
        col.push(...(stripe ? CREAM : (y > cyy + h * 0.4 && t > 0.25 && t < 0.4 ? DARK : (t < 0.16 ? RED : (y > cyy ? RED : CREAM)))));
      }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < R; k++) { const a = i * (R + 1) + k, b = a + 1, c = a + R + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    fab.push(prep(g.toNonIndexed(), [1, 1, 1]));
    const gg = fab[fab.length - 1]; const c2 = gg.attributes.color; const src = g.toNonIndexed().attributes.color; for (let i = 0; i < c2.count; i++) c2.setXYZ(i, src.getX(i), src.getY(i), src.getZ(i));
  }
  // wings: upper and lower, made of rib panels so the fabric shows its ribs
  const wing = (y, z, span, chord, color) => {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const x0 = -span / 2 + (i / n) * span, x1 = -span / 2 + ((i + 1) / n) * span, xm = (x0 + x1) / 2;
      const tip = Math.abs(xm) > span / 2 - 0.4 ? 0.85 : 1;
      const v = i % 2 ? 1 : 0.94;
      fab.push(bx(x1 - x0 + 0.002, 0.07, chord * tip, color.map(c => c * v), xm, y, z));
    }
    fab.push(bx(span, 0.085, 0.06, color.map(c => c * 0.8), 0, y + 0.01, z - chord / 2 + 0.03));  // leading edge
  };
  wing(1.32, -0.85, 8.8, 1.45, RED);
  wing(-0.32, -0.2, 8.2, 1.35, RED);
  // roundels on the upper wing
  for (const s of [-1, 1]) { fab.push(part(new THREE.CylinderGeometry(0.42, 0.42, 0.075, 24), CREAM, s * 3.3, 1.33, -0.85)); fab.push(part(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 24), [0.08, 0.2, 0.55], s * 3.3, 1.335, -0.85)); fab.push(part(new THREE.CylinderGeometry(0.12, 0.12, 0.085, 20), RED, s * 3.3, 1.34, -0.85)); }
  // interplane struts and cabane struts
  for (const s of [-1, 1]) {
    for (const dz of [-0.95, 0.25]) dark.push(cy(0.035, 0.035, 1.64, 6, WOOD, s * 2.9, 0.5, dz - 0.15, 0, 0, 0));
    dark.push(cy(0.03, 0.03, 1.1, 6, WOOD, s * 0.4, 0.95, -0.9, 0, 0, s * 0.35), cy(0.03, 0.03, 1.1, 6, WOOD, s * 0.4, 0.95, -0.2, 0, 0, s * 0.35));
  }
  // flying wires
  for (const s of [-1, 1]) for (const dz of [-0.9, 0.2]) {
    const a = new THREE.Vector3(s * 2.9, 1.3, dz), b = new THREE.Vector3(s * 0.5, -0.3, dz), m = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(0.008, 0.008, len, 4); g.lookAt(b.clone().sub(a)); g.rotateX(Math.PI / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const g2 = new THREE.CylinderGeometry(0.008, 0.008, len, 4).applyQuaternion(q).translate(m.x, m.y, m.z);
    met.push(prep(g2, [0.7, 0.7, 0.72]));
  }
  // tail: stabiliser and fin (the moving surfaces are separate)
  fab.push(bx(3.0, 0.05, 0.7, RED, 0, 0.25, 3.05));
  fab.push(part(new THREE.BoxGeometry(0.05, 1.0, 0.7), RED, 0, 0.72, 3.1, 0, 0, 0));
  // engine: cowling ring, cylinders, spinner
  met.push(part(new THREE.CylinderGeometry(0.58, 0.55, 0.42, 22, 1, true).rotateX(Math.PI / 2), [0.72, 0.72, 0.74], 0, 0.06, -2.38));
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; met.push(part(new THREE.CylinderGeometry(0.075, 0.08, 0.32, 8), [0.35, 0.35, 0.36], Math.cos(a) * 0.4, 0.06 + Math.sin(a) * 0.4, -2.35, 0, 0, a - Math.PI / 2)); }
  met.push(part(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16).rotateX(Math.PI / 2), [0.2, 0.2, 0.22], 0, 0.06, -2.35));
  // landing gear and the tail skid
  for (const s of [-1, 1]) {
    dark.push(cy(0.035, 0.035, 1.25, 6, DARK, s * 0.55, -0.85, -1.15, 0.3, 0, s * -0.32), cy(0.035, 0.035, 1.2, 6, DARK, s * 0.55, -0.85, -0.6, -0.35, 0, s * -0.32));
    dark.push(part(new THREE.TorusGeometry(0.26, 0.1, 10, 22).rotateY(Math.PI / 2), [0.09, 0.09, 0.09], s * PL_GEAR.wheelX, -1.2, PL_GEAR.wheelZ));
    met.push(part(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16).rotateZ(Math.PI / 2), [0.75, 0.75, 0.78], s * PL_GEAR.wheelX, -1.2, PL_GEAR.wheelZ));
  }
  dark.push(cy(0.03, 0.03, 1.7, 6, DARK, 0, -1.2, PL_GEAR.wheelZ, 0, 0, Math.PI / 2));
  dark.push(cy(0.025, 0.03, 0.55, 6, DARK, 0, -0.45, 3.2, 0.5, 0, 0));
  // cockpit: a padded rim, the seat, the little windscreen, an instrument panel with dials
  dark.push(part(new THREE.TorusGeometry(0.38, 0.05, 6, 20).rotateX(Math.PI / 2).scale(1, 1, 1.4), [0.25, 0.15, 0.08], 0, 0.6, 0.85));
  dark.push(bx(0.6, 0.08, 0.5, [0.2, 0.12, 0.07], 0, 0.05, 1.05), bx(0.6, 0.55, 0.08, [0.2, 0.12, 0.07], 0, 0.3, 1.33));
  dark.push(bx(0.75, 0.3, 0.05, [0.2, 0.13, 0.08], 0, 0.42, 0.2));
  // a control stick
  dark.push(cy(0.02, 0.02, 0.5, 6, DARK, 0, 0.18, 0.6));
  const m = new THREE.Group();
  const toMesh = (list, mat) => { const g = mergeGeos(list.map(p => { const q = new THREE.BufferGeometry(); for (const nm of ['position', 'normal', 'color', 'uv']) q.setAttribute(nm, p.attributes[nm]); return q; })); const mm = new THREE.Mesh(g, mat); mm.castShadow = true; mm.receiveShadow = true; return mm; };
  m.add(toMesh(fab, planeMat), toMesh(dark, planeMat), toMesh(met, planeMetal));
  // instrument dials (lit faces), windscreen, propeller, moving surfaces
  const dialMat = new THREE.MeshBasicMaterial({ color: 0xe9e2c8 });
  for (const [x, r] of [[-0.2, 0.07], [0, 0.085], [0.2, 0.07]]) { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 20), dialMat); d.position.set(x, 0.45, 0.18); d.rotation.y = Math.PI; m.add(d); }
  const needleMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const needles = [-0.2, 0, 0.2].map(x => { const n = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.06).translate(0, 0.03, 0), needleMat); n.position.set(x, 0.45, 0.175); n.rotation.y = Math.PI; m.add(n); return n; });
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.22), new THREE.MeshStandardMaterial({ color: 0x99aaaa, transparent: true, opacity: 0.25, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  ws.position.set(0, 0.74, 0.42); ws.rotation.x = -0.5; m.add(ws);
  const prop = new THREE.Group(); prop.position.set(0, 0.06, -2.62);
  const bladeG = new THREE.BoxGeometry(0.16, 2.5, 0.05); const bp = bladeG.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - Math.pow(Math.abs(y) / 1.25, 3) * 0.6)); bp.setZ(i, bp.getZ(i) + Math.sign(bp.getX(i)) * y * 0.03); }
  bladeG.computeVertexNormals();
  const blade = new THREE.Mesh(bladeG, patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.42, 0.25, 0.12, THREE.SRGBColorSpace), roughness: 0.5 }), { key: 'prop' }));
  prop.add(blade);
  prop.add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 16).rotateX(-Math.PI / 2), planeMetal));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  prop.add(disc); m.add(prop);
  const surface = (w, h, d, x, y, z, color) => { const piv = new THREE.Group(); piv.position.set(x, y, z); const s = new THREE.Mesh(prep(new THREE.BoxGeometry(w, h, d).translate(0, 0, d / 2), color), planeMat); s.castShadow = true; piv.add(s); m.add(piv); return piv; };
  const ailL = surface(2.2, 0.05, 0.32, -3.0, 1.32, -0.12, RED), ailR = surface(2.2, 0.05, 0.32, 3.0, 1.32, -0.12, RED);
  const elev = surface(2.9, 0.045, 0.42, 0, 0.25, 3.4, RED);
  const rud = new THREE.Group(); rud.position.set(0, 0.7, 3.45); const rs = new THREE.Mesh(prep(new THREE.BoxGeometry(0.045, 1.05, 0.45).translate(0, 0, 0.225), [0.9, 0.86, 0.74]), planeMat); rud.add(rs); m.add(rud);
  PLANE.parts = { prop, blade, disc, ailL, ailR, elev, rud, needles };
  return m;
}
// a long flat stretch of beach to take off from
function planeSite() {
  let best = null;
  for (const side of [-1, 1]) for (const fw of [6, 9, 12]) {
    const p0 = LAYOUT.at(fw, side * 22), dir = { x: LAYOUT.R.x * side, z: LAYOUT.R.z * side };
    let run = 0;
    for (let d = 0; d < 260; d += 4) { const x = p0.x + dir.x * d, z = p0.z + dir.z * d, h = groundHeight(x, z); if (h < 0.6 || h > 4.5 || slopeAt(x, z) > 0.12 || (LAYOUT.dock && Math.hypot(x - LAYOUT.dock.x, z - LAYOUT.dock.z) < 16) || (CABIN.x && Math.hypot(x - CABIN.x, z - CABIN.z) < 16)) break; run = d; }
    if (!best || run > best.run) best = { p: p0, dir, run };
  }
  return best;
}
function buildPlane() {
  const site = planeSite(); if (!site) return;
  const m = planeGeometry(); scene.add(m);
  PLANE.mesh = m;
  const yaw = Math.atan2(-site.dir.x, -site.dir.z);
  PLANE.home = { x: site.p.x, z: site.p.z, yaw };
  for (let d = -6; d < site.run; d += 6) EXCLUDE.push({ x: site.p.x + site.dir.x * d, z: site.p.z + site.dir.z * d, r: 7 });
  resetPlane();
  PLANE.seat = { x: PLANE.x, z: PLANE.z, y: groundHeight(PLANE.x, PLANE.z), r: 4, label: 'Fly the biplane', short: 'Fly', kind: 'plane' };
  INTERACT.push(PLANE.seat);
  PLACES.plane = { x: PLANE.x, z: PLANE.z, r: 16, name: 'The Old Biplane', sub: 'Throttle up and fly it off the beach' };
}
function resetPlane() {
  const H = PLANE.home; if (!H) return;
  if (PLANE.wreck) { for (const p of PLANE.wreck) { scene.remove(p.m); } PLANE.wreck = null; }
  PLANE.mesh.visible = true;
  PLANE.x = H.x; PLANE.z = H.z;
  PLANE.q.setFromEuler(new THREE.Euler(PL_TAILDOWN, H.yaw, 0, 'YXZ'));
  PLANE.y = groundHeight(H.x, H.z) + planeGearHeight();
  PLANE.vel.set(0, 0, 0); PLANE.w.set(0, 0, 0); PLANE.throttle = 0; PLANE.state = 'parked'; PLANE.onGround = true; PLANE.sinkT = 0;
  syncPlaneMesh();
  if (PLANE.seat) { PLANE.seat.x = H.x; PLANE.seat.z = H.z; PLANE.seat.y = groundHeight(H.x, H.z); }
}
// how far the centre sits above the ground when resting on its wheels and tail skid
function planeGearHeight() { return -new THREE.Vector3(0, PL_GEAR.wheelY, PL_GEAR.wheelZ).applyEuler(new THREE.Euler(PL_TAILDOWN, 0, 0, 'YXZ')).y + 0.02; }
function syncPlaneMesh() { PLANE.mesh.position.set(PLANE.x, PLANE.y, PLANE.z); PLANE.mesh.quaternion.copy(PLANE.q); }
function boardPlane() {
  if (PLANE.state !== 'parked' && PLANE.state !== 'ground') return;
  P.mode = 'plane'; PLANE.state = 'ground'; PLANE.head.yaw = 0; PLANE.head.pitch = -0.05;
  if (TOOL.cur !== 'hands') setTool('hands');
  if (AUDIO.seat) AUDIO.seat('boat-seat');
  showActivityHint(isTouch ? 'Joystick to fly (push forward for nose down) · ▲▼ throttle · drag to look around' : 'W/S throttle · mouse or arrows: stick (pull back to climb) · A/D roll · E to get out on the ground');
}
function exitPlane(force) {
  if (!force && !(PLANE.onGround && PLANE.vel.length() < 3)) { showActivityHint('Land first!', true, 1.5); return; }
  const r = new THREE.Vector3(1, 0, 0).applyQuaternion(PLANE.q);
  const x = PLANE.x + r.x * 2.2, z = PLANE.z + r.z * 2.2;
  P.mode = 'walk'; P.pos.set(x, groundHeight(x, z) + EYE, z); P.vel.set(0, 0, 0); P.onGround = true; P.camY = P.pos.y;
  PLANE.throttle = 0; PLANE.state = PLANE.state === 'sunk' ? 'sunk' : 'ground';
  $('hud').hidden = true;
  if (AUDIO.planeEngine) AUDIO.planeEngine(0, 0, false);
}
const _pf = new THREE.Vector3(), _pu = new THREE.Vector3(), _pr = new THREE.Vector3(), _pdq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pv = new THREE.Vector3();
function updatePlane(dt, flying) {
  if (!PLANE.mesh) return;
  if (PLANE.state === 'sinking') return planeSinking(dt);
  if (PLANE.state === 'crashed' || PLANE.state === 'sunk') { updatePlaneWreck(dt); return; }
  if (PLANE.state === 'parked' && !flying) { PLANE.parts.prop.rotation.z += 0; return; }
  // controls
  let thr = 0, pitchIn = 0, rollIn = 0;
  if (flying) {
    if (isTouch) { thr = (touch.up ? 1 : 0) - (touch.down ? 1 : 0); pitchIn = -input.my; rollIn = input.mx; PLANE.head.yaw -= input.lookX * 0.004; PLANE.head.pitch -= input.lookY * 0.004; input.lookX = input.lookY = 0; }
    else {
      thr = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      PLANE.stick.x = clamp(PLANE.stick.x + input.lookX * 0.004 * settings.sensitivity, -1, 1); PLANE.stick.y = clamp(PLANE.stick.y + input.lookY * 0.004 * settings.sensitivity * (settings.invertY ? -1 : 1), -1, 1);
      input.lookX = input.lookY = 0;
      PLANE.stick.multiplyScalar(Math.exp(-dt * 2.2));                       // the stick drifts back to centre
      pitchIn = PLANE.stick.y + (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
      rollIn = PLANE.stick.x + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    }
    PLANE.head.yaw = damp(PLANE.head.yaw, 0, isTouch ? 0.6 : 3, dt); PLANE.head.pitch = damp(PLANE.head.pitch, -0.05, isTouch ? 0.6 : 3, dt);
    PLANE.throttle = clamp(PLANE.throttle + thr * dt * 0.45, 0, 1);
    pitchIn = clamp(pitchIn, -1, 1); rollIn = clamp(rollIn, -1, 1);
  } else PLANE.throttle = Math.max(0, PLANE.throttle - dt);
  const sub = 3, h = dt / sub;
  for (let k = 0; k < sub; k++) {
    _pf.set(0, 0, -1).applyQuaternion(PLANE.q); _pu.set(0, 1, 0).applyQuaternion(PLANE.q); _pr.set(1, 0, 0).applyQuaternion(PLANE.q);
    const v = PLANE.vel, s = v.length(), sf = v.dot(_pf), su = v.dot(_pu), sr = v.dot(_pr);
    const aoa = Math.atan2(-su, Math.max(sf, 0.5));
    const CL = aoa < 0.27 ? 0.35 + 5.0 * aoa : Math.max(0.15, 1.7 - 3.2 * (aoa - 0.27));
    const q2 = sf * Math.abs(sf);
    const lift = 0.0175 * CL * q2 * smoothstep(2, 8, sf);
    const thrust = PLANE.throttle * 9.5 * clamp(1 - sf / 92, 0, 1);
    const acc = _pv.set(0, -9.8, 0);
    acc.addScaledVector(_pf, thrust);
    // lift is perpendicular to the flight path, in the plane's up direction
    const vdir = s > 0.5 ? v.clone().multiplyScalar(1 / s) : _pf.clone();
    const liftDir = _pu.clone().addScaledVector(vdir, -_pu.dot(vdir)).normalize();
    acc.addScaledVector(liftDir, lift);
    acc.addScaledVector(vdir, -(0.0016 + 0.0175 * CL * CL * 0.05) * s * s);   // drag, parasitic and induced
    acc.addScaledVector(_pr, -sr * 1.5 * clamp(s / 25, 0.2, 1.5));          // the fuselage resists sideslip
    v.addScaledVector(acc, h);
    // rotation in body axes: controls, weathervane stability, and the turn you get from banking
    const eff = clamp((sf - 4) / 26, 0, 1.25);
    _pe.setFromQuaternion(PLANE.q, 'YXZ');
    const bank = _pe.z;
    const tp = pitchIn * 1.25 * eff - aoa * 1.6 * eff * (PLANE.onGround ? 0 : 1);
    const tr = -rollIn * 2.3 * eff;
    const ty = Math.sin(bank) * 9.8 / Math.max(sf, 12) * (PLANE.onGround ? 0 : 1) - (sr / Math.max(s, 1)) * 1.5 * eff + (PLANE.onGround && flying ? -rollIn * 0.7 * clamp(sf / 6, 0, 1) : 0);
    PLANE.w.x = damp(PLANE.w.x, tp, 5, h); PLANE.w.z = damp(PLANE.w.z, tr, 6, h); PLANE.w.y = damp(PLANE.w.y, ty, 4, h);
    _pdq.setFromEuler(new THREE.Euler(PLANE.w.x * h, PLANE.w.y * h, PLANE.w.z * h, 'YXZ'));
    PLANE.q.multiply(_pdq).normalize();
    PLANE.x += v.x * h; PLANE.y += v.y * h; PLANE.z += v.z * h;
    if (planeContacts(h, flying)) return;
  }
  if (flying) {
    // the moving parts
    const pp = PLANE.parts, rpm = 6 + PLANE.throttle * 60 + PLANE.vel.length() * 0.5;
    pp.prop.rotation.z += rpm * dt;
    pp.disc.material.opacity = smoothstep(15, 45, rpm) * 0.35; pp.blade.visible = rpm < 50;
    pp.ailL.rotation.x = rollIn * 0.35; pp.ailR.rotation.x = -rollIn * 0.35; pp.elev.rotation.x = -pitchIn * 0.4; pp.rud.rotation.y = -rollIn * 0.15;
    const kmh = PLANE.vel.length() * 3.6, alt = PLANE.y - Math.max(0, groundHeight(PLANE.x, PLANE.z));
    pp.needles[0].rotation.z = -clamp(kmh / 250, 0, 1) * 5; pp.needles[1].rotation.z = -(alt / 300) * TAU; pp.needles[2].rotation.z = -PLANE.throttle * 4;
    $('hud-speed').textContent = Math.round(kmh); $('hud-alt').textContent = Math.round(alt); $('hud-thr').style.width = Math.round(PLANE.throttle * 100) + '%';
    $('hud-vs').textContent = (PLANE.vel.y >= 0 ? '+' : '') + PLANE.vel.y.toFixed(1);
    const stall = !PLANE.onGround && PLANE.vel.dot(_pf.set(0, 0, -1).applyQuaternion(PLANE.q)) < 19;
    $('hud-stall').hidden = !stall;
    if (AUDIO.planeEngine) AUDIO.planeEngine(PLANE.throttle, PLANE.vel.length(), true);
    if (PLANE.throttle > 0.1 && PLANE.onGround && rng() < dt * 30 * PLANE.throttle && FX.spawn) { const t = new THREE.Vector3(0, -1.0, 1.0).applyQuaternion(PLANE.q); FX.spawn(PLANE.x + t.x + rand(-1, 1), groundHeight(PLANE.x, PLANE.z) + 0.1, PLANE.z + t.z + rand(-1, 1), rand(-1, 1), rand(0.5, 1.5), rand(-1, 1), rand(0.4, 0.9), rand(0.02, 0.04), 3, 6); }
  }
  syncPlaneMesh();
  if (PLANE.seat) { PLANE.seat.x = PLANE.x; PLANE.seat.z = PLANE.z; PLANE.seat.y = groundHeight(PLANE.x, PLANE.z); }
}
// wheels on the ground, or a crash: returns true when the flight ended
function planeContacts(h, flying) {
  const g = groundHeight(PLANE.x, PLANE.z), wl = oceanHeight(PLANE.x, PLANE.z, U.uTime.value);
  const low = new THREE.Vector3(0, PL_GEAR.wheelY, PL_GEAR.wheelZ).applyQuaternion(PLANE.q).y;
  const bottomY = PLANE.y + low;
  _pe.setFromQuaternion(PLANE.q, 'YXZ');
  // into the sea
  if (wl > g + 0.3 && bottomY < wl + 0.05) { planeDitch(); return true; }
  // the nose or a wingtip hitting a hillside
  const nose = new THREE.Vector3(0, 0, -2.6).applyQuaternion(PLANE.q), tipL = new THREE.Vector3(-4.4, 1.3, -0.5).applyQuaternion(PLANE.q), tipR = new THREE.Vector3(4.4, 1.3, -0.5).applyQuaternion(PLANE.q);
  for (const p of [nose, tipL, tipR]) { const px = PLANE.x + p.x, pz = PLANE.z + p.z; if (PLANE.y + p.y < groundHeight(px, pz) - 0.05 && PLANE.vel.length() > 6) { planeExplode(); return true; } }
  if (bottomY > g + 0.02) { PLANE.onGround = false; return false; }
  // touching down: too fast a sink, too much bank or nose first and it breaks up
  const vs = PLANE.vel.y;
  if (!PLANE.onGround && (vs < -5.5 || Math.abs(_pe.z) > 0.45 || _pe.x < -0.22)) { planeExplode(); return true; }
  PLANE.onGround = true;
  PLANE.y += g + 0.02 - bottomY;
  if (PLANE.vel.y < 0) PLANE.vel.y = 0;
  // rolling: friction and brakes, no sideways skating, wings levelled by the wheels
  _pf.set(0, 0, -1).applyQuaternion(PLANE.q); _pr.set(1, 0, 0).applyQuaternion(PLANE.q);
  const sf = PLANE.vel.dot(_pf), sr = PLANE.vel.dot(_pr);
  const brake = flying && PLANE.throttle < 0.02 && keys.has('KeyS') ? 4 : 0;
  PLANE.vel.addScaledVector(_pr, -sr * Math.min(1, 8 * h));
  PLANE.vel.addScaledVector(_pf, -Math.sign(sf) * Math.min(Math.abs(sf), (0.35 + brake) * h));
  const groundPitch = lerp(PL_TAILDOWN, 0.02, smoothstep(14, 24, sf));
  const pitchNow = _pe.x, rollNow = _pe.z;
  if (pitchNow < groundPitch || PLANE.vel.y <= 0.2) {
    const np = pitchNow < groundPitch ? damp(pitchNow, groundPitch, 8, h) : pitchNow;
    PLANE.q.setFromEuler(new THREE.Euler(Math.max(np, Math.min(groundPitch, pitchNow)), _pe.y, damp(rollNow, 0, 10, h), 'YXZ'));
    if (pitchNow < groundPitch) PLANE.w.x = Math.max(PLANE.w.x, 0);
  }
  PLANE.w.z = 0;
  // ran off the beach into the trees or rocks
  if (sf > 8 && slopeAt(PLANE.x, PLANE.z) > 0.35) { planeExplode(); return true; }
  return false;
}
// ---- crashes ----
function planeExplode() {
  const x = PLANE.x, y = PLANE.y, z = PLANE.z, g = groundHeight(x, z);
  PLANE.state = 'crashed'; PLANE.crashT = 0; PLANE.mesh.visible = false;
  const wasIn = P.mode === 'plane';
  // a fireball, burning wreckage and a scorched crater
  for (let i = 0; i < 70 * Q.particles; i++) FX.spawn(x + rand(-2, 2), y + rand(0, 2), z + rand(-2, 2), rand(-6, 6), rand(2, 12), rand(-6, 6), rand(0.6, 1.6), rand(0.06, 0.16), 4, 9.8);
  for (let i = 0; i < 26; i++) FX.spawn(x + rand(-3, 3), y + rand(0, 3), z + rand(-3, 3), rand(-1, 1), rand(1, 4), rand(-1, 1), rand(3, 7), rand(2, 5), 2, -0.2);
  for (let i = 0; i < 40 * Q.particles; i++) FX.spawn(x, g + 0.2, z, rand(-7, 7), rand(3, 9), rand(-7, 7), rand(0.8, 1.5), rand(0.03, 0.06), 3, 9.8);
  PLANE.boom = { x, y, z, t: 0 };
  blastTrees(x, z, 14, 14);
  if (maskAt(x, z)[0] > 0.5) { for (let i = 0; i < 6; i++) digAt(x + rand(-1.5, 1.5), z + rand(-1.5, 1.5)); }
  const wr = [];
  const kinds = [[2.2, 0.08, 1.2], [2.0, 0.08, 1.2], [1.6, 0.6, 1.4], [0.9, 0.5, 0.9], [2.5, 0.1, 0.1], [1.2, 0.05, 0.5], [0.6, 0.6, 0.4]];
  for (let i = 0; i < 12; i++) {
    const [a, b, c] = kinds[i % kinds.length];
    const mesh = new THREE.Mesh(prep(new THREE.BoxGeometry(a * rand(0.6, 1), b, c * rand(0.6, 1)), i % 3 ? [0.3, 0.05, 0.04] : [0.12, 0.1, 0.09]), planeMat);
    mesh.castShadow = true; scene.add(mesh);
    wr.push({ m: mesh, x, y: y + 0.5, z, vx: PLANE.vel.x * 0.3 + rand(-6, 6), vy: rand(3, 10), vz: PLANE.vel.z * 0.3 + rand(-6, 6), rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), wx: rand(-6, 6), wz: rand(-6, 6), fire: i < 5 });
  }
  PLANE.wreck = wr;
  if (AUDIO.explode) AUDIO.explode(Math.hypot(camera.position.x - x, camera.position.z - z));
  if (wasIn) {
    $('hud').hidden = true; if (AUDIO.planeEngine) AUDIO.planeEngine(0, 0, false);
    P.mode = 'dead'; P.shake = 1; P.dunk = 1;
    const fl = $('flash'); fl.style.transition = 'none'; fl.style.background = '#ffb070'; fl.style.opacity = 0.9; requestAnimationFrame(() => { fl.style.transition = 'opacity 1.4s ease-out'; fl.style.opacity = 0; setTimeout(() => fl.style.background = '', 1500); });
    toast('You crashed', 'You wake up back at the cabin');
    const fade = $('fade'); fade.style.transition = 'opacity 0.8s'; fade.style.opacity = 1;
    setTimeout(() => { spawnPlayer(); fade.style.opacity = 0; setTimeout(() => fade.style.transition = '', 900); }, 1600);
  }
}
function planeDitch() {
  PLANE.state = 'sinking'; PLANE.sinkT = 0;
  const wl = oceanHeight(PLANE.x, PLANE.z, U.uTime.value);
  splashAt(PLANE.x, wl, PLANE.z, 2.4); splashAt(PLANE.x - 3, wl, PLANE.z, 1.6); splashAt(PLANE.x + 3, wl, PLANE.z, 1.6);
  if (AUDIO.waveHit) AUDIO.waveHit(1.6);
  PLANE.vel.multiplyScalar(0.15);
  if (P.mode === 'plane') {
    $('hud').hidden = true; if (AUDIO.planeEngine) AUDIO.planeEngine(0, 0, false);
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(PLANE.q);
    P.mode = 'swim'; P.pos.set(PLANE.x + r.x * 2.5, wl + 0.2, PLANE.z + r.z * 2.5); P.vel.set(0, 0, 0); P.dunk = 1; P.shake = 0.8;
    if (FX.lens) FX.lens(40);
    toast('Into the sea', 'The plane is going down');
  }
}
function planeSinking(dt) {
  PLANE.sinkT += dt;
  const floor = groundHeight(PLANE.x, PLANE.z) - PL_GEAR.wheelY - 0.2, wl = oceanHeight(PLANE.x, PLANE.z, U.uTime.value);
  // floats nose-down for a few seconds, then slips under and settles on the bottom
  const k = smoothstep(2.5, 14, PLANE.sinkT);
  PLANE.vel.multiplyScalar(Math.exp(-dt * 1.5));
  PLANE.x += PLANE.vel.x * dt; PLANE.z += PLANE.vel.z * dt;
  PLANE.y = lerp(wl - 0.4, floor, k);
  _pe.setFromQuaternion(PLANE.q, 'YXZ');
  PLANE.q.setFromEuler(new THREE.Euler(damp(_pe.x, -0.35 * (1 - k) + 0.05 * k, 0.8, dt), _pe.y, damp(_pe.z, 0.15, 0.5, dt), 'YXZ'));
  if (rng() < dt * 12 * (1 - k * 0.7) && FX.bubbles) FX.bubbles(PLANE.x + rand(-2, 2), PLANE.y, PLANE.z + rand(-2, 2), 3);
  if (k < 0.3 && rng() < dt * 8) rippleDrop(PLANE.x + rand(-3, 3), PLANE.z + rand(-3, 3), 0.6, 0.15, 0.5);
  syncPlaneMesh();
  if (PLANE.sinkT > 15) { PLANE.state = 'sunk'; PLACES.planeWreck = { x: PLANE.x, z: PLANE.z, r: 18, under: true, name: 'The Sunken Biplane', sub: 'Lost to the sea' }; }
}
function updatePlaneWreck(dt) {
  if (!PLANE.wreck) return;
  PLANE.crashT += dt;
  for (const p of PLANE.wreck) {
    const g = groundHeight(p.x, p.z);
    p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < g + 0.1) { p.y = g + 0.1; p.vy = Math.abs(p.vy) * 0.25; p.vx *= 0.6; p.vz *= 0.6; p.wx *= 0.6; p.wz *= 0.6; }
    p.rx += p.wx * dt; p.rz += p.wz * dt;
    p.m.position.set(p.x, p.y, p.z); p.m.rotation.set(p.rx, p.ry, p.rz);
    if (p.fire && PLANE.crashT < 25 && rng() < dt * 10 && FX.spawn) { FX.spawn(p.x + rand(-0.3, 0.3), p.y + 0.2, p.z + rand(-0.3, 0.3), rand(-0.3, 0.3), rand(1, 2.5), rand(-0.3, 0.3), rand(0.4, 0.9), rand(0.04, 0.09), 4, -0.5); if (rng() < 0.4) FX.spawn(p.x, p.y + 0.5, p.z, rand(-0.3, 0.3), rand(1, 2), rand(-0.3, 0.3), rand(3, 6), rand(1, 2.5), 2, -0.15); }
  }
  // a new plane is waiting on the beach once you've walked away from the wreck
  if (PLANE.crashT > 12 && P.mode !== 'plane' && Math.hypot(P.pos.x - PLANE.home.x, P.pos.z - PLANE.home.z) > 40 && PLANE.crashT > 30) { resetPlane(); }
}
// the pilot's seat: position the player and the camera in the cockpit
const _pq = new THREE.Quaternion(), _peye = new THREE.Vector3();
function placeInPlane() {
  _peye.set(0, 1.08, 1.0).applyQuaternion(PLANE.q).add(new THREE.Vector3(PLANE.x, PLANE.y, PLANE.z));
  P.pos.copy(_peye); P.camY = P.pos.y; P.vel.copy(PLANE.vel);
}
function cameraInPlane() {
  _peye.set(0, 1.08, 1.0).applyQuaternion(PLANE.q).add(new THREE.Vector3(PLANE.x, PLANE.y, PLANE.z));
  camera.position.copy(_peye);
  const shake = (P.shake || 0) * 0.02 + (PLANE.onGround ? Math.min(1, PLANE.vel.length() / 20) * 0.006 : 0.0015 * Math.min(1, PLANE.vel.length() / 40));
  camera.position.y += (rng() - 0.5) * shake;
  _pq.setFromEuler(new THREE.Euler(PLANE.head.pitch, PLANE.head.yaw, 0, 'YXZ'));
  camera.quaternion.copy(PLANE.q).multiply(_pq);
  P.yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
}
