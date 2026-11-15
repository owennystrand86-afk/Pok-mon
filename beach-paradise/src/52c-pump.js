
// ───────────────────── 13c. The drain pump and its hose ─────────────────────
// A yellow submersible pump stands by the cabin's back door. Pick it up, set it down in any water (the
// pool, the hot tub, a hole you dug, the sea) and you're left holding the end of 30 m of hose: walk it
// wherever you want and set it down. The hose is a chain that lies on the ground, drapes over edges and
// wraps round walls and trees rather than passing through them. While the pump is under water it
// pumps: the water comes out of the far end (into the sea, onto the sand where it soaks in and runs,
// or into the pool if that's where you left it).
const PUMP = { carry: null, pos: new THREE.Vector3(), deployed: false, endPlaced: false, end: new THREE.Vector3(), N: 72, seg: 0.66, nodes: [], prev: [], running: false, acc: 0, pourAcc: 0, its: {} };
const _ph = new THREE.Vector3(), _pf2 = new THREE.Vector3(), _pr2 = new THREE.Vector3();
function pumpModel() {
  const P = [];
  P.push(part(new THREE.CylinderGeometry(0.16, 0.18, 0.36, 16), [0.95, 0.75, 0.08], 0, 0.18, 0));
  P.push(part(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 16), [0.15, 0.15, 0.16], 0, 0.03, 0));
  P.push(part(new THREE.TorusGeometry(0.1, 0.018, 6, 12, Math.PI), [0.15, 0.15, 0.16], 0, 0.38, 0));
  P.push(part(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8).rotateZ(Math.PI / 2), [0.2, 0.2, 0.22], 0.2, 0.3, 0));
  for (let k = 0; k < 8; k++) P.push(part(new THREE.BoxGeometry(0.02, 0.05, 0.02), [0.1, 0.1, 0.1], Math.cos(k / 8 * TAU) * 0.17, 0.07, Math.sin(k / 8 * TAU) * 0.17));
  return new THREE.Mesh(mergeGeos(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }));
}
function buildPump() {
  const w = cabinToWorld(0.9, 0, CD - 0.45);
  PUMP.home = { x: w.x, y: CABIN.floor, z: w.z };
  PUMP.pos.set(w.x, CABIN.floor, w.z);
  const m = pumpModel(); m.castShadow = true; scene.add(m); PUMP.model = m;
  // the coiled hose sitting on the pump while it's put away
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.55 }));
  coil.position.y = 0.42; m.add(coil); PUMP.coil = coil;
  const c2 = coil.clone(); c2.position.y = 0.49; c2.scale.setScalar(0.92); m.add(c2);
  // the hose itself: a tube rebuilt from the chain each frame
  const N = PUMP.N, rings = N, sides = 7;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rings * sides * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(rings * sides * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = []; for (let i = 0; i < rings - 1; i++) for (let k = 0; k < sides; k++) { const a = i * sides + k, b = i * sides + (k + 1) % sides, c = a + sides, d = b + sides; idx.push(a, c, b, b, c, d); }
  g.setIndex(idx);
  const hose = new THREE.Mesh(g, patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.18, 0.5, 0.22, THREE.SRGBColorSpace), roughness: 0.5 }), { key: 'hose' }));
  hose.frustumCulled = false; hose.castShadow = true; hose.visible = false; scene.add(hose); PUMP.hose = hose;
  for (let i = 0; i < N; i++) { PUMP.nodes.push(new THREE.Vector3()); PUMP.prev.push(new THREE.Vector3()); }
  // carried in your hands
  const vm = TOOL.vm;
  if (vm.grp) {
    const vp = pumpModel(); vp.scale.setScalar(0.85); vp.position.set(0.25, -0.55, -0.6); vp.visible = false; vm.grp.add(vp); PUMP.vmPump = vp;
    const nz = new THREE.Group();
    nz.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.5 })));
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.12, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.3 })); tip.position.z = -0.25; nz.add(tip);
    nz.position.set(0.24, -0.32, -0.5); nz.rotation.set(0.25, 0.1, 0); nz.visible = false; vm.grp.add(nz); PUMP.vmHose = nz;
  }
  PUMP.its.pump = { x: 0, z: 0, y: 0, r: 1.3, label: 'Pick up the drain pump', short: 'Pick up', pumpPick: true };
  PUMP.its.hose = { x: 0, z: 0, y: 0, r: 1.3, label: 'Pick up the end of the hose', short: 'Pick up', hosePick: true };
  PUMP.its.reel = { x: 0, z: 0, y: 0, r: 1.4, label: 'Reel the hose in', short: 'Reel in', reel: true };
  placePumpModel();
}
function handPos(out) {
  camera.getWorldDirection(_pf2); _pr2.set(-_pf2.z, 0, _pf2.x).normalize();
  return out.copy(camera.position).addScaledVector(_pf2, 0.5).addScaledVector(_pr2, 0.22).add(new THREE.Vector3(0, -0.4, 0));
}
function placePumpModel() { PUMP.model.position.copy(PUMP.pos); PUMP.model.visible = PUMP.carry !== 'pump'; PUMP.coil.visible = !PUMP.deployed; PUMP.coil.parent.children.forEach(c => { if (c !== PUMP.coil && c.geometry && c.geometry.type === 'TorusGeometry') c.visible = !PUMP.deployed; }); }
function pickPump() {
  // the hose winds back onto the pump and comes with it
  if (PUMP.deployed) { PUMP.deployed = false; PUMP.endPlaced = false; PUMP.running = false; PUMP.hose.visible = false; if (AUDIO.pump) AUDIO.pump(0); }
  PUMP.carry = 'pump'; if (TOOL.cur !== 'hands') setTool('hands');
  placePumpModel();
  showActivityHint(isTouch ? 'Tap Place to set the pump down in some water' : 'Click (or F) to set the pump down, ideally in some water', false, 4);
}
function pickHose() {
  PUMP.carry = 'hose'; PUMP.endPlaced = false; if (TOOL.cur !== 'hands') setTool('hands');
  showActivityHint(isTouch ? 'Walk the hose where you want the water to go, then tap Place' : 'Walk the hose where you want the water to go, then click (or F) to set it down', false, 4);
}
function reelHose() {
  PUMP.deployed = false; PUMP.endPlaced = false; PUMP.running = false; PUMP.hose.visible = false; PUMP.carry = null;
  placePumpModel();
  if (AUDIO.pump) AUDIO.pump(0);
}
// put down whatever you're carrying where you're looking
function placeCarried() {
  const a = aimGround(5, true);
  if (!a) { showActivityHint('Aim at the ground or the water', true, 1.4); return; }
  if (PUMP.carry === 'pump') {
    // in water it sinks to the bottom
    const bottom = supportHeight(a.x, a.z, a.y);
    PUMP.pos.set(a.x, a.water ? bottom : a.y, a.z);
    if (a.water && FX.splash) FX.splash(a.x, a.y, a.z, 0.6);
    if (AUDIO.splash && a.water) AUDIO.splash(0.4);
    if (!PUMP.deployed) {
      // lay the hose out from the pump to your hands; now you're holding its end
      PUMP.deployed = true; PUMP.hose.visible = true;
      handPos(_ph);
      for (let i = 0; i < PUMP.N; i++) { const t = i / (PUMP.N - 1); PUMP.nodes[i].lerpVectors(PUMP.pos, _ph, t); PUMP.nodes[i].y += 0.2; PUMP.prev[i].copy(PUMP.nodes[i]); }
      PUMP.carry = 'hose';
      showActivityHint(isTouch ? 'Now walk the hose where you want the water to go and tap Place' : 'Now walk the hose where you want the water to go and click to set it down', false, 4);
    } else PUMP.carry = null;
    placePumpModel();
    return;
  }
  if (PUMP.carry === 'hose') {
    PUMP.end.set(a.x, a.y + 0.04, a.z); PUMP.endPlaced = true; PUMP.carry = null;
    showActivityHint('Hose laid', false, 1.4);
  }
}
// where the pump is drawing from, and whether it's under water
function pumpSource() {
  const p = PUMP.pos, pw = poolWhere(p.x, p.z);
  if (pw === 'pool') return TUB.poolLevel > 0.02 && CABIN.floor + poolLevelY() > p.y + 0.12 ? 'pool' : null;
  if (pw === 'tub') return TUB.level > 0.05 && CABIN.floor + tubLevelY() > p.y + 0.12 ? 'tub' : null;
  const w = waterAt(p.x, p.z);
  if (w.level > p.y + 0.12) return w.kind === 'sea' || w.kind === 'river' ? 'endless' : 'sand';
  return null;
}
function updatePump(dt) {
  if (!PUMP.model) return;
  // the things you can pick up
  const its = PUMP.its, want = new Set();
  if (PUMP.carry !== 'pump') { its.pump.x = PUMP.pos.x; its.pump.z = PUMP.pos.z; its.pump.y = PUMP.pos.y; want.add(its.pump); }
  if (PUMP.deployed && PUMP.endPlaced && !PUMP.carry) { const e = PUMP.nodes[PUMP.N - 1]; its.hose.x = e.x; its.hose.z = e.z; its.hose.y = e.y; want.add(its.hose); }
  if (PUMP.deployed && !PUMP.carry) { its.reel.x = PUMP.pos.x + 0.6; its.reel.z = PUMP.pos.z; its.reel.y = PUMP.pos.y; want.add(its.reel); }
  for (const it of Object.values(its)) { const has = INTERACT.includes(it); if (want.has(it) && !has) INTERACT.push(it); else if (!want.has(it) && has) INTERACT.splice(INTERACT.indexOf(it), 1); }
  // carrying
  if (PUMP.vmPump) { PUMP.vmPump.visible = PUMP.carry === 'pump'; PUMP.vmHose.visible = PUMP.carry === 'hose'; }
  if (PUMP.carry === 'pump') { handPos(PUMP.pos); PUMP.pos.y -= 0.25; }
  placePumpModel();
  if (!PUMP.deployed) { PUMP.running = false; if (AUDIO.pump) AUDIO.pump(0); return; }
  // the hose: a chain of points under gravity, pinned at the pump and at its end
  const N = PUMP.N, nodes = PUMP.nodes, prev = PUMP.prev, h = Math.min(dt, 1 / 30);
  const a = nodes[0], b = nodes[N - 1];
  a.set(PUMP.pos.x, PUMP.pos.y + 0.32, PUMP.pos.z);
  if (PUMP.carry === 'hose') handPos(b); else if (PUMP.endPlaced) b.copy(PUMP.end);
  // the hose pays out as far as you take it: always a little longer than the gap, so it lies slack
  PUMP.seg = Math.max(0.5, a.distanceTo(b) * 1.15 / (N - 1));
  const seg = PUMP.seg;
  for (let i = 1; i < N - 1; i++) {
    const p = nodes[i], q = prev[i], vx = (p.x - q.x) * 0.985, vy = (p.y - q.y) * 0.985, vz = (p.z - q.z) * 0.985;
    q.copy(p); p.x += vx; p.y += vy - 9.8 * h * h; p.z += vz;
  }
  for (let it = 0; it < 16; it++) {
    for (let i = 0; i < N - 1; i++) {
      const p = nodes[i], q = nodes[i + 1], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, d = Math.hypot(dx, dy, dz) || 1e-6, diff = (d - seg) / d;
      const wp = i === 0 ? 0 : i + 1 === N - 1 ? 1 : 0.5, wq = i + 1 === N - 1 ? 0 : i === 0 ? 1 : 0.5;
      p.x += dx * diff * wp; p.y += dy * diff * wp; p.z += dz * diff * wp;
      q.x -= dx * diff * wq; q.y -= dy * diff * wq; q.z -= dz * diff * wq;
    }
    if (it % 4 === 3) for (let i = 1; i < N - 1; i++) {
      const p = nodes[i];
      // lie on whatever is underneath, and slide round walls, trees and posts instead of through them
      const [nx, nz] = collide(p.x, p.z, p.y - 0.05); p.x = lerp(p.x, nx, 0.6); p.z = lerp(p.z, nz, 0.6);
      const g = supportHeight(p.x, p.z, p.y + 0.25) + 0.035;
      if (p.y < g) { p.y = g; const q = prev[i]; q.x = lerp(q.x, p.x, 0.5); q.z = lerp(q.z, p.z, 0.5); }
    }
  }
  // build the tube along the chain
  const pos = PUMP.hose.geometry.attributes.position.array, nor = PUMP.hose.geometry.attributes.normal.array, sides = 7, R = 0.032;
  for (let i = 0; i < N; i++) {
    const p = nodes[i], A = nodes[Math.max(0, i - 1)], B = nodes[Math.min(N - 1, i + 1)];
    _pf2.subVectors(B, A).normalize();
    _pr2.set(0, 1, 0).cross(_pf2); if (_pr2.lengthSq() < 1e-4) _pr2.set(1, 0, 0); _pr2.normalize();
    _ph.crossVectors(_pf2, _pr2);
    for (let k = 0; k < sides; k++) {
      const an = k / sides * TAU, cx = Math.cos(an), sx = Math.sin(an), o = (i * sides + k) * 3;
      const nx = _pr2.x * cx + _ph.x * sx, ny = _pr2.y * cx + _ph.y * sx, nz = _pr2.z * cx + _ph.z * sx;
      pos[o] = p.x + nx * R; pos[o + 1] = p.y + ny * R; pos[o + 2] = p.z + nz * R; nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
    }
  }
  PUMP.hose.geometry.attributes.position.needsUpdate = true; PUMP.hose.geometry.attributes.normal.needsUpdate = true;
  // pumping: whenever the pump is down in some water, water comes out of the end
  const src = PUMP.carry === 'pump' ? null : pumpSource();
  PUMP.running = !!src;
  const flow = settings.pumpFlow ?? 1;                 // set in the settings panel
  const q = src ? 0.32 * flow * dt : 0;               // m³ this frame
  if (src === 'pool') TUB.poolLevel = Math.max(0, TUB.poolLevel - q / (35 * 1.8));
  else if (src === 'tub') TUB.level = Math.max(0, TUB.level - q / (4.6 * 0.8));
  else if (src === 'sand') { PUMP.acc += q; if (PUMP.acc > 0.04) { scoopAt(PUMP.pos.x, PUMP.pos.z, PUMP.acc); PUMP.acc = 0; } }
  if (q > 0) {
    // where it comes out
    const e = nodes[N - 1], ew = poolWhere(e.x, e.z);
    if (ew === 'pool' && src !== 'pool') TUB.poolLevel = Math.min(1, TUB.poolLevel + q / (35 * 1.8));
    else if (ew === 'tub' && src !== 'tub') TUB.level = Math.min(1, TUB.level + q / (4.6 * 0.8));
    else if (!ew && SAND.count && waterAt(e.x, e.z).level < e.y - 0.05 && groundHeight(e.x, e.z) > -0.5) { PUMP.pourAcc += q; if (PUMP.pourAcc > 0.06 * Math.max(1, flow)) { pourAt(e.x, e.z, PUMP.pourAcc); PUMP.pourAcc = 0; } }
    // the gush
    _pf2.subVectors(e, nodes[N - 3]).normalize();
    const fk = Math.sqrt(flow), n = Math.round(dt * 90 * Q.particles * Math.min(2.5, fk));
    for (let i = 0; i < n; i++) sprayDrop(e.x, e.y + 0.02, e.z, _pf2.x * rand(1.5, 2.6) * fk + rand(-0.25, 0.25), _pf2.y * 2 * fk + rand(0.3, 1.0), _pf2.z * rand(1.5, 2.6) * fk + rand(-0.25, 0.25), rand(0.4, 0.8), rand(0.02, 0.045) * Math.min(1.6, fk));
    PUMP.ripT = (PUMP.ripT || 0) - dt;
    if (PUMP.ripT <= 0) { PUMP.ripT = 0.12; const w = waterAt(e.x + _pf2.x * 0.8, e.z + _pf2.z * 0.8); if (w.level > groundHeight(e.x, e.z) + 0.03) rippleDrop(e.x + _pf2.x * 0.8, e.z + _pf2.z * 0.8, 0.5, 0.03, 0.4); }
  }
  const dc = Math.min(PUMP.pos.distanceTo(camera.position), nodes[N - 1].distanceTo(camera.position));
  if (AUDIO.pump) AUDIO.pump(PUMP.running ? Math.min(1.4, 0.5 + 0.5 * Math.sqrt(flow)) / (1 + (dc / 5) ** 2) : 0);
}
