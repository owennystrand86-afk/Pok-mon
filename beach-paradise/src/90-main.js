
// ───────────────────── 30. Input: keyboard, mouse, touch ─────────────────────
const $ = id => document.getElementById(id);
let started = false, panelOpen = false, dragLook = isTouch, pointerLocked = false;
const input = { mx: 0, my: 0, run: false, up: false, down: false, jump: false, lookX: 0, lookY: 0, interact: false, use: false, usePressed: false, useMouse: false };
const keys = new Set();
const touch = { stickId: null, ox: 0, oy: 0, sx: 0, sy: 0, look: new Map(), up: false, down: false };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') && e.code !== 'Escape') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'Space') input.jump = true;
    if (e.code === 'KeyE' || e.code === 'Enter') input.interact = true;
    if (started && !panelOpen) {
      if (e.code === 'KeyQ') cycleTool();
      if (e.code === 'KeyG') toggleShovelMode();
      if (e.code === 'Digit1') setTool('hands'); if (e.code === 'Digit2') setTool('shovel'); if (e.code === 'Digit3') setTool('bucket'); if (e.code === 'Digit4') setTool('stick');
      if (e.code === 'KeyF') input.usePressed = true;
      if (e.code === 'KeyJ') toggleJournal();
      if (e.code === 'KeyX' && P.mode === 'sub') setSonar(!SUB.sonar);
      if (e.code === 'KeyV' && P.mode === 'sub') cycleSubView();
      if (e.code === 'Space' && (P.mode === 'swim' || P.mode === 'walk') && poolWhere(P.pos.x, P.pos.z) && P.pos.y - EYE < CABIN.floor - 0.2) poolClimbOut();
      if (e.code === 'KeyR' && P.mode === 'sub') { SUB.radar = !SUB.radar; if (AUDIO.beep) AUDIO.beep(); }
      if (e.code === 'KeyL' && P.mode === 'sub') SUB.lightsToggle = true;
      else if (e.code === 'KeyL' && (P.mode === 'boat' || DECK.boat)) toggleHeadlights();
      else if (e.code === 'KeyL' && TOOL.cur === 'lantern' && LIGHTS.lantern.where === 'hand') useLantern();
      if (e.code === 'Digit7') setTool('lantern');
      if (e.code === 'Digit5') setTool('rod');
      if (e.code === 'Digit6') setTool('surfboard');
    }
    if (e.code === 'Escape' && !$('journal').hidden) { toggleJournal(false); }
    else if (e.code === 'Escape' || e.code === 'KeyM' || e.code === 'Tab') { if (started) togglePanel(); }
  }
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function readKeys() {
  const k = c => keys.has(c);
  let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  let my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
  let run = k('ShiftLeft') || k('ShiftRight');
  if (touch.stickId !== null) {
    const R = 52; let dx = (touch.sx - touch.ox) / R, dy = (touch.sy - touch.oy) / R; const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    mx = dx; my = -dy; run = l > 0.95;
  }
  input.mx = mx; input.my = my; input.run = run;
  input.up = k('Space') || touch.up; input.down = k('KeyC') || k('KeyZ') || touch.down;
  input.use = k('KeyF') || input.useMouse || touch.use;
}
function lockPointer() {
  if (isTouch || dragLook) return;
  try { const r = canvas.requestPointerLock({ unadjustedMovement: false }); if (r && r.catch) r.catch(() => { dragLook = true; showHint(); }); }
  catch (e) { dragLook = true; showHint(); }
}
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; showHint(); });
document.addEventListener('pointerlockerror', () => { dragLook = true; showHint(); });
let mouseDown = false;
canvas.addEventListener('mousedown', e => {
  if (!started || panelOpen) return; mouseDown = true;
  if (pointerLocked && e.button === 0) { input.useMouse = true; input.usePressed = true; }
  if (pointerLocked && e.button === 2 && TOOL.cur === 'shovel') toggleShovelMode();
  if (!pointerLocked && !dragLook) lockPointer();
});
addEventListener('mouseup', () => { mouseDown = false; input.useMouse = false; });
addEventListener('mousemove', e => {
  if (!started || panelOpen) return;
  if (pointerLocked || (dragLook && mouseDown && !isTouch)) { input.lookX += e.movementX || 0; input.lookY += e.movementY || 0; }
});
// touch: left side is a floating joystick, the rest drags the view
const stickEl = $('stick'), knobEl = $('knob');
function placeStickIdle() {
  const x = Math.max(110, innerWidth * 0.14) + (parseFloat(getComputedStyle(document.body).paddingLeft) || 0) * 0.3;
  const y = innerHeight - Math.max(120, innerHeight * 0.22);
  stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; knobEl.style.transform = 'translate(0,0)';
  stickEl.classList.add('on', 'idle');
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || !started || panelOpen) return;
  canvas.setPointerCapture?.(e.pointerId);
  if (touch.stickId === null && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.3) {
    touch.stickId = e.pointerId; touch.ox = touch.sx = e.clientX; touch.oy = touch.sy = e.clientY;
    stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.classList.add('on'); stickEl.classList.remove('idle');
  } else touch.look.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'touch') return;
  if (e.pointerId === touch.stickId) {
    touch.sx = e.clientX; touch.sy = e.clientY;
    let dx = touch.sx - touch.ox, dy = touch.sy - touch.oy; const l = Math.hypot(dx, dy), R = 52;
    if (l > R) { dx = dx / l * R; dy = dy / l * R; }
    knobEl.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (touch.look.has(e.pointerId)) {
    const p = touch.look.get(e.pointerId);
    input.lookX += (e.clientX - p.x) * 2.3; input.lookY += (e.clientY - p.y) * 2.3;
    p.x = e.clientX; p.y = e.clientY;
  }
});
const endTouch = e => {
  if (e.pointerId === touch.stickId) { touch.stickId = null; placeStickIdle(); }
  touch.look.delete(e.pointerId);
};
canvas.addEventListener('pointerup', endTouch); canvas.addEventListener('pointercancel', endTouch);
const holdBtn = (el, prop, onPress) => {
  const on = e => { e.preventDefault(); e.stopPropagation(); touch[prop] = true; el.classList.add('down'); if (onPress) onPress(); };
  const off = e => { touch[prop] = false; el.classList.remove('down'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
};
holdBtn($('t-up'), 'up', () => { input.jump = true; if (started && (P.mode === 'swim' || P.mode === 'walk') && poolWhere(P.pos.x, P.pos.z) && P.pos.y - EYE < CABIN.floor - 0.2) poolClimbOut(); });
holdBtn($('t-down'), 'down');
$('t-act').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); input.interact = true; });
$('t-tool').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycleTool(); });
$('t-mode').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleShovelMode(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
{
  const ub = $('t-use');
  ub.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (TOOL.cur === 'stick') { TOOL.pen = !TOOL.pen; updateToolButtons(); } else { touch.use = true; input.usePressed = true; ub.classList.add('down'); } });
  const off = () => { touch.use = false; if (TOOL.cur !== 'stick') ub.classList.remove('down'); };
  ub.addEventListener('pointerup', off); ub.addEventListener('pointercancel', off); ub.addEventListener('pointerleave', off);
}

// ───────────────────── 31. Player ─────────────────────
const EYE = 1.62;
const P = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, mode: 'walk', onGround: true,
  camY: 0, bob: 0, bobAmt: 0, stepAcc: 0, foot: 0, seat: null, seatT: 0, seatFrom: new THREE.Vector3(),
  water: { level: -99, kind: 'sea' }, depth: 0, eyeUnder: false, under: 0, climb: null, t: 0, swimStroke: 0, enteredWater: 0,
};
const SPAWN = { x: -330, z: 40, yaw: Math.PI / 2 };
const PLATFORMS = []; // walkable boxes: { x, z, hx, hz, rot, top }
const INTERACT = [];  // seats and the like
function supportHeight(x, z, feet) {
  let g = groundHeight(x, z);
  for (const p of PLATFORMS) {
    const dx = x - p.x, dz = z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) > p.hx || Math.abs(lz) > p.hz) continue;
    const top = p.top + (p.arch ? p.arch * (1 - (lz / p.hz) ** 2) : 0);
    if (top <= feet + 0.5 && top > g) g = top;
  }
  const db = deckBoat(x, z);
  if (db) { const top = deckTopAt(db, x, z, feet); if (top <= feet + 0.5 && top > g) g = top; }
  return g;
}
// inside the falls themselves: a column of fast water from the pool up to the lip. You can swim up it
// against the current (hold forward and look up, or hold jump), or let it carry you down.
function fallsWaterAt(x, z, y) {
  const F = STREAM.fall; if (!F || !F.path || (STREAM.fallFlow ?? 1) < 0.3) return null;
  const dx = x - F.lipX, dz = z - F.lipZ, d = dx * F.dirX + dz * F.dirZ;
  if (d < F.edgeD - 0.6 || d > F.fallLen + 2.5) return null;
  if (y > F.topY - 0.5 && d < F.edgeD + 0.9) return null;   // up at the brink: that's the river
  const ts = -dx * F.dirZ + dz * F.dirX, t = Math.abs(ts);
  let top = -1e9, bot = 1e9, near = null, nd = 1e9;
  for (const s of F.path) {
    if (s.d < F.edgeD - 0.4 || t > s.hw + 0.2) continue;
    if (Math.abs(d - s.d) < s.th * 0.5 + 0.9) { top = Math.max(top, s.y + s.th * 0.5); bot = Math.min(bot, s.y - s.th * 0.5); }
    const e = Math.abs(s.y - y); if (e < nd) { nd = e; near = s; }
  }
  if (top < -1e8 || y < bot - 1.8 || y > top + 1.2) return null;
  const k = STREAM.fallFlow ?? 1;
  // the falling water carries you with it: down, and in towards the middle of the stream
  const pd = near ? clamp((near.d - d) * 2.6, -2.6, 2.6) : 0, pt = clamp(-ts * 0.5, -1, 1);
  return { level: Math.min(top, F.topY + 0.25), kind: 'fall', fx: (F.dirX * pd - F.dirZ * pt) * k, fz: (F.dirZ * pd + F.dirX * pt) * k, fy: -2.7 * k };
}
function waterAt(x, z, y) {
  if (y !== undefined) { const fw = fallsWaterAt(x, z, y); if (fw) return fw; }
  { const pw = poolWaterAt(x, z); if (pw) return pw; }
  if (CABIN.group && !CABIN.destroyed) { const l = worldToCabin(x, z); if (Math.abs(l.x) < CW + 0.05 && l.z > -CPORCH - 0.05 && l.z < CD + 0.05) return { level: Math.min(CABIN.floor - 0.4, oceanHeight(x, z, U.uTime.value)), kind: 'sea', fx: 0, fz: 0 }; }
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 0.6) return { level: POOL.level, kind: 'fresh', fx: 0, fz: 0 };
  if (Math.hypot(x - SPRING.x, z - SPRING.z) < SPRING.r + 0.3) return { level: SPRING.level, kind: 'fresh', fx: 0, fz: 0 };
  const q = riverQuery(x, z);
  if (q && q.d < q.W + 0.6 && (q.S > 0.05 || q.sUp > -16)) {
    // near the mouth the sea's swell runs up the river too (damped the same way the water is drawn);
    // a dam (see updateDams) drains it below and backs it up above
    const k = (1 - smoothstep(q.W * 0.6, q.W + 0.6, q.d) * 0.7) * smoothstep(-12, 25, q.sUp) * (1 - riverStillAt(q));
    const S = riverLevelAt(q);
    const level = q.sUp < 60 ? S + oceanHeight(x, z, U.uTime.value) : S;
    return { level, kind: q.sUp < 0 ? 'sea' : 'river', fx: q.tx * q.speed * k, fz: q.tz * q.speed * k, q };
  }
  const sw = SAND.count ? sandWaterAt(x, z) : null;
  if (sw) return { level: sw.level, kind: 'fresh', fx: sw.vx * 0.6, fz: sw.vz * 0.6 };
  const tf = TSU.on ? tsunamiFlow(x, z) : 0;
  return { level: oceanHeight(x, z, U.uTime.value), kind: 'sea', fx: U.uTsuDir.value.x * tf, fz: U.uTsuDir.value.y * tf, tsu: tf };
}
function collide(x, z, feet) {
  COLLIDERS.query(x, z, 3, c => {
    if (feet > c.top - 0.1 || (U.uDestroyRect.value.w && destroyedAt(c.x, c.z) > 0.45)) return;
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), R = c.r + 0.28;
    if (d < R && d > 1e-5) { x = c.x + (dx / d) * R; z = c.z + (dz / d) * R; }
  });
  // the cabin's walls, furniture and the space under its floor
  const R = 0.28;
  for (const w of WALLS) {
    if (feet > w.y1 - 0.42 || feet + 1.75 < w.y0) continue;
    const dx = x - w.x, dz = z - w.z, reach = w.hx + w.hz + R;
    if (dx * dx + dz * dz > reach * reach) continue;
    const c = Math.cos(w.rot), s = Math.sin(w.rot);
    let lx = dx * c - dz * s, lz = dx * s + dz * c;
    const qx = clamp(lx, -w.hx, w.hx), qz = clamp(lz, -w.hz, w.hz), ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
    if (d >= R) continue;
    if (d > 1e-5) { lx = qx + (ex / d) * R; lz = qz + (ez / d) * R; }
    else if (w.hx - Math.abs(lx) < w.hz - Math.abs(lz)) lx = Math.sign(lx || 1) * (w.hx + R); else lz = Math.sign(lz || 1) * (w.hz + R);
    x = w.x + lx * c + lz * s; z = w.z - lx * s + lz * c;
  }
  const dk = deckCollide(x, z, feet);
  if (dk) { x = dk[0]; z = dk[1]; }
  return [x, z];
}
function blockedStep(x0, z0, x1, z1, g0, feet) {
  const gh = supportHeight(x1, z1, feet), d = Math.hypot(x1 - x0, z1 - z0);
  if (d < 1e-6) return false;
  return gh > feet + 0.02 && ((gh - g0) / d > 1.3 || gh - feet > 0.5);
}
function spawnPoint() {
  const c = CABIN.spawn;
  if (c && !CABIN.destroyed) return { x: c.x, z: c.z, yaw: c.yaw, y: CABIN.floor };
  return { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw, y: groundHeight(SPAWN.x, SPAWN.z) };
}
function spawnPlayer() {
  const sp = spawnPoint();
  if (P.mode === 'seat') { P.seat = null; }
  P.pos.set(sp.x, sp.y + EYE, sp.z);
  if (P.mode === 'boat' && P.boat) { P.boat.driving = false; P.boat.speed = 0; P.boat = null; }
  if (P.mode === 'tube') { TUBE.rider = false; }
  if (P.mode === 'plane') { $('hud').hidden = true; if (PLANE.state === 'ground') PLANE.throttle = 0; }
  if (P.mode === 'surf') { SURF.mesh.visible = false; SURF.stand = false; }
  if (P.mode === 'sub') { $('hud').hidden = true; SUB.state = 'parked'; setSonar(false); $('t-sonar').hidden = true; }
  P.vel.set(0, 0, 0); P.yaw = sp.yaw; P.pitch = -0.05; P.mode = 'walk'; P.camY = P.pos.y; P.seat = null; P.climb = null;
}
function updatePlayer(dt) {
  P.t += dt;
  if (P.mode === 'dead') { input.lookX = input.lookY = 0; return; }
  if (P.mode === 'plane') { updatePlane(dt, true); if (P.mode === 'plane') placeInPlane(); input.jump = false; return; }
  const sens = 0.0022 * settings.sensitivity;
  P.yaw -= input.lookX * sens; P.pitch -= input.lookY * sens * (settings.invertY ? -1 : 1);
  input.lookX = input.lookY = 0;
  P.pitch = clamp(P.pitch, -1.52, 1.52);
  P.dunk = Math.max(0, (P.dunk || 0) - dt * 1.1); P.shake = Math.max(0, (P.shake || 0) - dt * 2.5); P.stumble = Math.max(0, (P.stumble || 0) - dt * 1.6);
  if (P.mode === 'seat') return updateSeat(dt);
  if (P.mode === 'boat') { updateBoatDrive(dt); input.jump = false; return; }
  if (P.mode === 'sub') { updateSub(dt); input.jump = false; return; }
  if (P.mode === 'subboard') { input.jump = false; return; }
  if (P.mode === 'subwalk') { subWalk(dt); input.jump = false; return; }
  if (P.mode === 'surf') { updateSurf(dt); input.jump = false; return; }
  if (P.mode === 'tube') { P.water = waterAt(P.pos.x, P.pos.z); input.jump = false; return; }
  if (P.climb) return updateClimb(dt);
  let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  if (P.mode === 'walk') deckCarry(); else DECK.boat = null;
  const w = waterAt(P.pos.x, P.pos.z, P.pos.y - 0.6); P.water = w;
  if (P.mode === 'walk') walkStep(dt, w, mx, my, ml, fx, fz, rx, rz); else swimStep(dt, w, mx, my, ml, fx, fz, rx, rz);
  deckTrack();
  checkWaveHit(dt);
  const r = Math.hypot(P.pos.x, P.pos.z), R0 = FAR.reach;
  if (r > R0) { const push = (r - R0) * 0.6; P.pos.x -= (P.pos.x / r) * push * dt; P.pos.z -= (P.pos.z / r) * push * dt; }
  if (r > R0 + 250) { P.pos.x *= (R0 + 250) / r; P.pos.z *= (R0 + 250) / r; }
  input.jump = false;
}
function walkStep(dt, w, mx, my, ml, fx, fz, rx, rz) {
  const feet = P.pos.y - EYE;
  const g = supportHeight(P.pos.x, P.pos.z, feet);
  const depth = w.level - g; P.depth = depth;
  const wade = smoothstep(0.08, 1.15, depth);
  const speed = (input.run ? 7.0 : 3.8) * lerp(1, 0.47, wade);
  const wx = (fx * my + rx * mx) * speed, wz = (fz * my + rz * mx) * speed;
  const acc = P.onGround ? 10 : 1.8;
  const cur = w.tsu ? smoothstep(0.15, 0.9, depth) * 0.95 : depth > 0.25 ? smoothstep(0.25, 1.2, depth) * 0.55 : 0;
  P.vel.x = damp(P.vel.x, wx + (w.fx || 0) * cur, acc, dt); P.vel.z = damp(P.vel.z, wz + (w.fz || 0) * cur, acc, dt);
  if (P.onGround && input.jump && depth < 0.9) { P.vel.y = 5.4; P.onGround = false; }
  P.vel.y -= 21 * dt;
  let nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
  [nx, nz] = collide(nx, nz, feet);
  if (blockedStep(P.pos.x, P.pos.z, nx, nz, g, feet)) {
    if (!blockedStep(P.pos.x, P.pos.z, nx, P.pos.z, g, feet)) nz = P.pos.z;
    else if (!blockedStep(P.pos.x, P.pos.z, P.pos.x, nz, g, feet)) nx = P.pos.x;
    else { nx = P.pos.x; nz = P.pos.z; P.vel.x *= 0.2; P.vel.z *= 0.2; }
  }
  const moved = Math.hypot(nx - P.pos.x, nz - P.pos.z);
  P.pos.x = nx; P.pos.z = nz;
  let f2 = feet + P.vel.y * dt;
  const g2 = supportHeight(P.pos.x, P.pos.z, Math.max(f2, feet));
  if (f2 <= g2) { if (P.vel.y < -7 && AUDIO.land) AUDIO.land(); f2 = g2; P.vel.y = 0; P.onGround = true; }
  else if (P.onGround && P.vel.y <= 0 && f2 - g2 < 0.45) { f2 = g2; P.vel.y = 0; }
  else P.onGround = false;
  P.pos.y = f2 + EYE;
  const d2 = w.level - g2; P.depth = d2;
  if ((d2 > 1.38 && f2 < w.level - 1.1) || (w.tsu > 2.5 && d2 > 0.95)) {
    const fall = clamp(-P.vel.y / 8, 0.4, 2.2);
    P.mode = 'swim'; P.vel.y = Math.max(P.vel.y * 0.25, -4); if (FX.splash) FX.splash(P.pos.x + fx, w.level, P.pos.z + fz, 0.8 + fall); if (AUDIO.splash) AUDIO.splash(Math.min(1.6, fall));
    if (fall > 1) { P.dunk = 0.8; if (FX.bubbles) FX.bubbles(P.pos.x, w.level - 1, P.pos.z, 14); }
  }
  // footsteps, head bob, splashes in the shallows
  const sp = Math.hypot(P.vel.x, P.vel.z);
  P.bobAmt = damp(P.bobAmt, P.onGround ? clamp(sp / 4, 0, 1.6) : 0, 8, dt);
  P.bob += moved * 1.65;
  P.stepAcc += moved;
  const stride = input.run ? 1.05 : 0.78;
  if (P.onGround && P.stepAcc > stride) {
    P.stepAcc = 0; P.foot ^= 1;
    const surf = d2 > 0.04 ? 'water' : surfaceType(P.pos.x, P.pos.z, f2);
    if (AUDIO.step) AUDIO.step(surf, input.run, d2);
    if (surf === 'water' && FX.splash) FX.splash(P.pos.x + fx * 0.5 + rx * (P.foot ? 0.15 : -0.15), w.level, P.pos.z + fz * 0.5 + rz * (P.foot ? 0.15 : -0.15), 0.35 + clamp(d2, 0, 0.8));
    if (surf === 'sand' && FX.footprint) FX.footprint(P.pos.x + rx * (P.foot ? 0.13 : -0.13), P.pos.z + rz * (P.foot ? 0.13 : -0.13), P.yaw, !P.foot);
  }
}
function surfaceType(x, z, feet) {
  if (DECK.boat) return 'wood';
  for (const p of PLATFORMS) if (Math.abs(p.top - feet) < 0.05) return p.wood ? 'wood' : 'rock';
  const m = maskAt(x, z), h = groundHeight(x, z), slope = slopeAt(x, z);
  if (m[2] > 0.5 || slope > 0.45) return 'rock';
  if (m[0] > 0.45 || h < 2.2) return 'sand';
  if (m[3] > 0.5) return 'path';
  return 'grass';
}
function swimStep(dt, w, mx, my, ml, fx, fz, rx, rz) {
  const surf = w.level;
  if (surf < P.pos.y - 1.5) { P.mode = 'walk'; P.onGround = false; P.vel.y = 0.4; return; } // swept over the edge of the falls
  const ly = Math.sin(P.pitch), lh = Math.cos(P.pitch);
  const under = P.pos.y < surf - 0.32;
  const diveLook = P.pitch < -0.42 && my > 0.1;
  const speed = input.run ? 4.3 : 2.6;
  let wx, wy = 0, wz;
  const free = under || input.down || diveLook;
  if (!free) {
    wx = (fx * my + rx * mx) * speed; wz = (fz * my + rz * mx) * speed;
    P.pos.y = Math.max(damp(P.pos.y, surf + 0.22, 8, dt), surf + 0.18); P.vel.y = 0;
    if (input.up && input.jump) tryClimbOut();
  } else {
    wx = (fx * lh * my + rx * mx) * speed * 1.05; wz = (fz * lh * my + rz * mx) * speed * 1.05; wy = ly * my * speed * 1.05;
    if (input.up) wy += 2.4; if (input.down) wy -= 2.4;
    if (!input.up && !input.down && ml < 0.05) wy += 0.65;
    P.vel.y = damp(P.vel.y, wy + (w.fy || 0), 3.2, dt);
  }
  const hk = w.kind === 'fall' ? 0.45 : 1;       // in the falls you mostly fight your way up, not along
  P.vel.x = damp(P.vel.x, wx * hk + (w.fx || 0) * 0.92, 3.2, dt); P.vel.z = damp(P.vel.z, wz * hk + (w.fz || 0) * 0.92, 3.2, dt);
  let nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
  [nx, nz] = collide(nx, nz, P.pos.y - 0.8);
  // a rock wall under water: stop at it instead of popping up onto whatever is on top of it
  { const g0 = groundHeight(P.pos.x, P.pos.z), g1 = groundHeight(nx, nz);
    if (g1 > P.pos.y - 0.45 && g1 > g0 + 0.8 && !poolWhere(nx, nz)) { nx = P.pos.x; nz = P.pos.z; P.vel.x *= 0.3; P.vel.z *= 0.3; } }
  P.pos.x = nx; P.pos.z = nz;
  P.pos.y += P.vel.y * dt;
  if (P.pos.y > surf + 0.22) { P.pos.y = surf + 0.22; P.vel.y = Math.min(P.vel.y, 0); }
  const gg = poolWhere(P.pos.x, P.pos.z) ? supportHeight(P.pos.x, P.pos.z, P.pos.y - 0.8) : groundHeight(P.pos.x, P.pos.z);
  if (P.pos.y < gg + 0.5) { P.pos.y = gg + 0.5; P.vel.y = Math.max(P.vel.y, 0); }
  P.depth = surf - gg;
  // strokes: gentle splashes at the surface, bubbles below
  const sp = Math.hypot(P.vel.x, P.vel.z, P.vel.y);
  P.swimStroke += Math.min(sp, ml * (input.run ? 4.3 : 2.6) + Math.abs(P.vel.y)) * dt;
  if (P.swimStroke > 1.6) {
    P.swimStroke = 0;
    if (!under && FX.splash) FX.splash(P.pos.x + fx * 0.7, surf, P.pos.z + fz * 0.7, 0.3);
    if (AUDIO.stroke) AUDIO.stroke(under);
  }
  if (under && FX.bubbles && rng() < dt * (0.6 + sp * 0.8)) FX.bubbles(P.pos.x + fx * 0.25, P.pos.y - 0.15, P.pos.z + fz * 0.25, 1 + (rng() * 3 | 0));
  if (surf - gg < 1.18 && P.pos.y > surf - 0.6) { P.mode = 'walk'; P.pos.y = Math.max(gg + EYE, Math.min(P.pos.y, gg + EYE)); P.vel.y = 0; P.onGround = true; }
}
function tryClimbOut() {
  if (deckClimbFrom()) return;
  for (const p of PLATFORMS) {
    if (!p.climb) continue;
    const dx = P.pos.x - p.x, dz = P.pos.z - p.z, c = Math.cos(p.rot), s = Math.sin(p.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < p.hx + 1.1 && Math.abs(lz) < p.hz + 1.1 && p.top - P.pos.y < 1.6) {
      const ix = clamp(lx, -p.hx + 0.4, p.hx - 0.4), iz = clamp(lz, -p.hz + 0.4, p.hz - 0.4);
      const tx = p.x + ix * c + iz * s, tz = p.z - ix * s + iz * c;
      P.climb = { from: P.pos.clone(), to: new THREE.Vector3(tx, p.top + EYE, tz), t: 0 };
      return;
    }
  }
}
function updateClimb(dt) {
  const C = P.climb; C.t = Math.min(1, C.t + dt / 0.75);
  const e = C.t * C.t * (3 - 2 * C.t);
  P.pos.lerpVectors(C.from, C.to, e); P.pos.y += Math.sin(C.t * Math.PI) * 0.35;
  if (C.t >= 1) { P.climb = null; P.mode = 'walk'; P.vel.set(0, 0, 0); P.onGround = true; if (AUDIO.splash) AUDIO.splash(0.4); }
}
// sitting
const _aimD = new THREE.Vector3(), _aimP = new THREE.Vector3();
function nearestInteract() {
  if (P.mode === 'seat') return { label: P.seat.standLabel || 'Stand up', short: 'Stand', stand: true };
  if (P.mode === 'surf') return { label: 'Get off the board', short: 'Get off', exitSurf: true };
  if (P.mode === 'plane') return PLANE.onGround && PLANE.vel.length() < 3 ? { label: 'Climb out of the plane', short: 'Get out', exitPlane: true } : null;
  if (P.mode === 'subboard') return null;
  if (P.mode === 'sub') return { label: 'Stand up', short: 'Stand', subStand: true };
  if (P.mode === 'subwalk') return subWalkInteract();
  // in the pool or the hot tub: a way out
  if ((P.mode === 'swim' || P.mode === 'walk') && poolWhere(P.pos.x, P.pos.z) && P.pos.y - EYE < CABIN.floor - 0.2) return { label: poolWhere(P.pos.x, P.pos.z) === 'tub' ? 'Climb out of the hot tub' : 'Climb out of the pool', short: 'Climb out', poolOut: true };
  if (P.mode === 'boat') return { label: 'Get out of the boat', short: 'Get out', exitBoat: true };
  if (P.mode === 'tube') return { label: 'Get off the tube', short: 'Get off', exitTube: true };
  if (P.mode !== 'walk' && P.mode !== 'swim') return null;
  let best = null, bd = 1e9;
  // things you pick by looking at them (doors and windows) come first
  if (P.mode === 'walk') {
    camera.getWorldDirection(_aimD);
    let bt = 2.7;
    for (const it of INTERACT) {
      const A = it.aim; if (!A) continue;
      const den = _aimD.dot(A.n); if (Math.abs(den) < 1e-3) continue;
      const t = _aimP.subVectors(A.c, camera.position).dot(A.n) / den;
      if (t <= 0.15 || t >= bt) continue;
      _aimP.copy(camera.position).addScaledVector(_aimD, t).sub(A.c);
      if (Math.abs(_aimP.dot(A.a)) < A.hw + 0.12 && Math.abs(_aimP.y) < A.hh + 0.12) { bt = t; best = it; }
    }
    if (best) return best;
  }
  for (const it of INTERACT) {
    if (it.aim) continue;
    if (P.mode === 'swim' && !it.anyMode) continue;
    const d = Math.hypot(P.pos.x - it.x, P.pos.z - it.z);
    const yOk = it.anyMode || Math.abs((P.pos.y - EYE) - it.y) < 2.2;
    if (d < (it.r || 2.2) && d < bd && yOk) { best = it; bd = d; }
  }
  return best;
}
function sit(it) {
  P.mode = 'seat'; P.seat = it; P.seatT = 0; P.seatFrom.copy(P.pos); P.vel.set(0, 0, 0);
  P.seatYaw0 = P.yaw; P.seatPitch0 = P.pitch;
  if (AUDIO.seat) AUDIO.seat(it.kind);
}
function stand() {
  const it = P.seat; P.mode = 'walk'; P.seat = null;
  const sx = it.standX ?? it.x, sz = it.standZ ?? it.z;
  P.pos.set(sx, supportHeight(sx, sz, it.y + 0.6) + EYE, sz); P.onGround = true;
}
function updateSeat(dt) {
  const it = P.seat;
  P.seatT = Math.min(1, P.seatT + dt / 0.8);
  const e = P.seatT * P.seatT * (3 - 2 * P.seatT);
  const sway = it.sway ? Math.sin(P.t * 0.9) * 0.18 : 0;
  _v.set(it.eye.x + (it.swayX || 0) * sway, it.eye.y, it.eye.z + (it.swayZ || 0) * sway);
  P.pos.lerpVectors(P.seatFrom, _v, e);
  if (P.seatT < 1) {
    let dy = it.yaw - P.seatYaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    P.yaw = P.seatYaw0 + dy * e; P.pitch = lerp(P.seatPitch0, it.pitch ?? -0.05, e);
  }
  if (P.seatT >= 1 && (Math.hypot(input.mx, input.my) > 0.5 || input.jump)) stand();
}

// ───────────────────── 32. Camera ─────────────────────
const _fwd = new THREE.Vector3();
function updateCamera(dt) {
  if ((P.mode === 'sub' || P.mode === 'subboard' || P.mode === 'subwalk') && SUB.mesh) { subCamera(); return; }
  P.camY = Math.abs(P.camY - P.pos.y) > 4 ? P.pos.y : damp(P.camY, P.pos.y, P.mode === 'walk' ? 16 : 9, dt);
  let bobY = 0, bobX = 0, roll = 0;
  if (settings.headBob && P.mode === 'walk') { bobY = Math.sin(P.bob * 2) * 0.032 * P.bobAmt; bobX = Math.cos(P.bob) * 0.022 * P.bobAmt; }
  if (P.mode === 'swim') roll = Math.sin(P.t * 0.9) * (P.pos.y < P.water.level - 0.3 ? 0.012 : 0.022);
  if (P.mode === 'seat' && P.seat.sway) roll = Math.sin(P.t * 0.9 + 1.2) * 0.03;
  if (P.mode === 'tube') roll = P.tubeRoll || 0;
  if (P.mode === 'plane') { cameraInPlane(); return; }
  if (P.mode === 'boat' && P.boat) roll = P.boat.roll * 0.8;
  if (P.mode === 'sub') roll = SUB.roll * 0.8;
  if (P.mode === 'surf') roll = SURF.roll * (SURF.stand ? 0.9 : 0.5);
  let dy = 0, pitchOff = 0;
  if (P.dunk > 0) { const k = Math.sin(P.dunk * Math.PI); dy -= k * 0.75; roll += Math.sin(P.dunk * 9) * 0.25 * k; pitchOff += Math.sin(P.dunk * 7) * 0.2 * k; }
  if (P.stumble > 0) { roll += Math.sin(P.stumble * 11) * 0.12 * P.stumble; }
  if (P.shake > 0) { dy += (rng() - 0.5) * 0.08 * P.shake; pitchOff += (rng() - 0.5) * 0.04 * P.shake; }
  const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  camera.position.set(P.pos.x + rx * bobX, (P.mode === 'boat' || P.mode === 'tube' || P.mode === 'sub' || P.mode === 'surf' ? P.pos.y : P.camY) + bobY + dy, P.pos.z + rz * bobX);
  camera.rotation.set(P.pitch + pitchOff + (P.mode === 'boat' && P.boat ? P.boat.pitch * 0.8 : 0), P.yaw, roll);
  keepEyeOffSurface();
}
// Never let the eye sit right on the water surface: there the surface is edge-on and the near
// plane cuts through it, so you'd see the sea floor with no water. Stay clearly above or below,
// and only cross when you really dive or come up.
function keepEyeOffSurface() {
  if (P.mode === 'boat' || P.mode === 'seat' || P.mode === 'plane' || P.mode === 'sub' || P.mode === 'surf' || !started) { P.camSide = 0; return; }
  const lv = waterAt(camera.position.x, camera.position.z, camera.position.y).level, y = camera.position.y, band = 0.16;
  if (y > lv + 0.6 || y < lv - 0.8) { P.camSide = y > lv ? 1 : -1; return; }
  if (!P.camSide) P.camSide = y >= lv ? 1 : -1;
  if (P.camSide > 0) { if (y < lv - 0.22) P.camSide = -1; }
  else if (y > lv + 0.22) P.camSide = 1;
  camera.position.y = P.camSide > 0 ? Math.max(y, lv + band) : Math.min(y, lv - band);
}
// slow drift over the beach behind the title screen
function introCamera(t) {
  const sp = spawnPoint(), sx = sp.x, sz = sp.z, g = sp.y;
  P.yaw = sp.yaw + Math.sin(t * 0.07) * 0.18; P.pitch = -0.04 + Math.sin(t * 0.05) * 0.03;
  P.pos.set(sx, g + EYE, sz); P.camY = P.pos.y;
  camera.position.set(sx, g + EYE + Math.sin(t * 0.11) * 0.04, sz);
  camera.rotation.set(P.pitch, P.yaw, 0);
}

// ───────────────────── 33. Interface ─────────────────────
const promptEl = $('prompt'), promptText = $('prompt-text'), actBtn = $('t-act'), hintEl = $('hint');
function showHint() {
  if (!started || isTouch || panelOpen) { hintEl.hidden = true; return; }
  if (dragLook) { hintEl.textContent = 'Hold the mouse button and drag to look around'; hintEl.hidden = false; clearTimeout(showHint.t); showHint.t = setTimeout(() => (hintEl.hidden = true), 6000); }
  else if (!pointerLocked) { hintEl.textContent = 'Click the island to look around'; hintEl.hidden = false; }
  else hintEl.hidden = true;
}
let toastTimer = 0;
function toast(t1, t2) {
  $('toast-1').textContent = t1; $('toast-2').textContent = t2 || '';
  const el = $('toast'); el.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.style.opacity = 0), 5200);
}
const visited = new Set();
function checkDiscoveries() {
  for (const [key, p] of Object.entries(PLACES)) {
    if (visited.has(key)) continue;
    const d = Math.hypot(P.pos.x - p.x, P.pos.z - p.z);
    const yOk = p.y === undefined || Math.abs(P.pos.y - p.y) < (p.dy || 30);
    if (d < p.r && yOk && (!p.under || P.eyeUnder)) { visited.add(key); if (settings.placeNames) toast(p.name, p.sub); }
  }
}
function togglePanel(force) {
  if (TUB.panelOpen) { closeTubPanel(); return; }
  panelOpen = force ?? !panelOpen;
  $('panel').hidden = !panelOpen;
  if (panelOpen) { if (document.pointerLockElement) document.exitPointerLock(); syncPanel(); }
  showHint();
}
const fmtHour = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h - Math.floor(h)) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
function syncPanel() {
  document.querySelectorAll('#q-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.q === settings.quality)));
  { const aa = renderer.getContextAttributes && renderer.getContextAttributes(); $('q-val').textContent = (settings.quality === 'max' || settings.quality === 'ultra') && aa && !aa.antialias ? 'Reload for smoother edges' : ''; }
  const set = (id, v, txt) => { $(id).value = v; if (txt !== undefined) $('v-' + id.slice(2)).textContent = txt; };
  set('s-fov', settings.fov, settings.fov + '°');
  $('s-bob').checked = settings.headBob; $('s-autores').checked = settings.autoRes; $('s-glow').checked = settings.glow !== false;
  $('s-water').value = settings.waterStyle || 'tropical'; $('s-sky').value = settings.skyStyle || 'physical';
  set('s-master', settings.master, Math.round(settings.master * 100) + '%');
  set('s-amb', settings.ambience, Math.round(settings.ambience * 100) + '%');
  set('s-music', settings.music, Math.round(settings.music * 100) + '%');
  set('s-sens', settings.sensitivity, settings.sensitivity.toFixed(2) + '×');
  $('s-inv').checked = settings.invertY;
  set('s-time', ENV.hour.toFixed(2), fmtHour(ENV.hour));
  $('s-flow').checked = settings.timeFlow; $('s-day').value = String(settings.dayMinutes);
  $('s-weather').value = settings.weather; $('s-names').checked = settings.placeNames;
  set('s-wind', settings.windSpeed ?? 1, (settings.windSpeed ?? 1) < 0.15 ? 'Still' : Math.round((settings.windSpeed ?? 1) * 100) + '%');
  set('s-waves', settings.waveSize, settings.waveSize < 0.35 ? 'Glassy' : settings.waveSize > 4.5 ? 'Monster ' + Math.round(settings.waveSize * 100) + '%' : settings.waveSize > 2.6 ? 'Giant ' + Math.round(settings.waveSize * 100) + '%' : Math.round(settings.waveSize * 100) + '%');
  $('s-tsu').value = settings.tsunamiSize;
  set('s-tsuspeed', settings.tsunamiSpeed ?? 1, (settings.tsunamiSpeed ?? 1).toFixed(1) + '×');
  set('s-shovel', settings.shovelPower, Math.round(settings.shovelPower * 100) + '%');
  { const f = settings.pumpFlow ?? 1; set('s-pump', f, Math.round(f * 100) + '% · ' + Math.round(f * 320) + ' L/s'); }
}
function wirePanel() {
  $('gear').addEventListener('click', () => togglePanel(true));
  $('resume').addEventListener('click', () => { togglePanel(false); if (!isTouch) lockPointer(); });
  document.querySelectorAll('#q-seg button').forEach(b => b.addEventListener('click', () => { settings.quality = b.dataset.q; saveSettings(); applyQuality(); syncPanel(); }));
  const bind = (id, key, parse, after) => $(id).addEventListener('input', e => { settings[key] = parse(e.target); saveSettings(); if (after) after(); syncPanel(); });
  bind('s-fov', 'fov', t => +t.value, updateFov);
  bind('s-bob', 'headBob', t => t.checked);
  bind('s-autores', 'autoRes', t => t.checked, () => { if (!settings.autoRes) { resScale = 1; applySize(); } });
  bind('s-glow', 'glow', t => t.checked, setupGlow);
  bind('s-water', 'waterStyle', t => t.value, applyWaterStyle);
  bind('s-sky', 'skyStyle', t => t.value);
  bind('s-master', 'master', t => +t.value, () => AUDIO.setVolumes && AUDIO.setVolumes());
  bind('s-amb', 'ambience', t => +t.value, () => AUDIO.setVolumes && AUDIO.setVolumes());
  bind('s-music', 'music', t => +t.value, () => AUDIO.setVolumes && AUDIO.setVolumes());
  bind('s-sens', 'sensitivity', t => +t.value);
  bind('s-inv', 'invertY', t => t.checked);
  bind('s-flow', 'timeFlow', t => t.checked);
  bind('s-day', 'dayMinutes', t => +t.value);
  bind('s-weather', 'weather', t => t.value, () => { if (settings.weather !== 'auto') WX.timer = 0; });
  bind('s-names', 'placeNames', t => t.checked);
  bind('s-wind', 'windSpeed', t => +t.value);
  $('s-time').addEventListener('input', e => { ENV.hour = +e.target.value; $('v-time').textContent = fmtHour(ENV.hour); });
  $('b-fs').addEventListener('click', () => {
    const d = document; try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { const el = d.documentElement; const r = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); if (r && r.catch) r.catch(() => {}); }
    } catch (e) { /* not available here */ }
  });
  $('b-spawn').addEventListener('click', () => { spawnPlayer(); togglePanel(false); });
  $('b-tsu').addEventListener('click', () => { sendTsunami(); togglePanel(false); if (!isTouch) lockPointer(); });
  $('b-calm').addEventListener('click', () => { calmSea(); });
  $('b-repair').addEventListener('click', () => { repairIsland(); });
  $('t-sonar').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); setSonar(!SUB.sonar); });
  $('sub-view').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); cycleSubView(); });
  $('t-lights').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); toggleHeadlights(); });
  $('b-journal').addEventListener('click', () => { togglePanel(false); toggleJournal(true); });
  $('j-close').addEventListener('click', () => toggleJournal(false));
  $('journal').addEventListener('pointerdown', e => e.stopPropagation());
  bind('s-tsuspeed', 'tsunamiSpeed', t => +t.value);
  $('b-boat').addEventListener('click', () => { returnBoat(); if (P.mode !== 'plane') resetPlane(); if (P.mode !== 'sub') resetSub(); toast('The boat, plane and sub are back', ''); });
  bind('s-waves', 'waveSize', t => +t.value);
  bind('s-tsu', 'tsunamiSize', t => t.value);
  bind('s-shovel', 'shovelPower', t => +t.value, applyShovelPower);
  bind('s-pump', 'pumpFlow', t => +t.value);
  $('panel').addEventListener('pointerdown', e => e.stopPropagation());
}
function applyQuality() {
  Q = QUALITY[settings.quality] || QUALITY.high;
  pixelRatio = Math.min(window.devicePixelRatio || 1, Q.pr); resScale = 1; applySize();
  configureShadows();
  applyVegetationQuality();
  if (typeof applyLifeQuality === 'function') applyLifeQuality();
  applyLawnQuality();
  if (WATER.ocean && WATER.oceanQ !== (Q.ocean === 'max') + '|' + oceanPPN()) { scene.remove(WATER.ocean); WATER.ocean.geometry.dispose(); WATER.ocean.material.dispose(); buildOcean(); }
  else if (WATER.ocean) oceanLodParams();
  setupRefraction(); setupGlow(); setupPost();
  if (!WFX.rip && Q.particles >= 0.5) buildRipples();
  WFX.uniforms.uRipOn.value = WFX.rip && Q.particles >= 0.5 ? 1 : 0;
}
// the instrument panel always matches what you're in: the plane's in the plane, the sub's in the sub, none otherwise
function syncVehicleHud() {
  const m = P.mode, want = m === 'plane' ? 'plane' : m === 'sub' ? 'sub' : '';
  if (syncVehicleHud.last === want) return;
  syncVehicleHud.last = want;
  $('hud').hidden = !want;
  $('hud-plane').hidden = want !== 'plane';
  $('hud-sub').hidden = want !== 'sub';
  if (want === 'sub' || m !== 'sub') syncSubHud();
  $('t-sonar').hidden = !(isTouch && want === 'sub');
  if (want !== 'sub' && SUB.sonar) setSonar(false);
}
function syncLightsButton() { const b = $('t-lights'); if (b) b.hidden = !(isTouch && (P.mode === 'boat' || !!DECK.boat)); }
function updatePrompt() {
  const it = nearestInteract();
  if (it) {
    promptText.textContent = it.label; promptEl.hidden = isTouch;
    actBtn.textContent = it.short || 'Sit'; actBtn.hidden = !isTouch;
    if (input.interact) {
      if (it.stand) stand(); else if (it.exitBoat) exitBoat(); else if (it.exitTube) { exitTube(false); TUBE.riding = true; }
      else if (it.exitPlane) exitPlane(); else if (it.exitSub) exitSub(); else if (it.exitSurf) endSurf(true);
      else if (it.kind === 'plane') boardPlane(); else if (it.kind === 'sub') boardSub();
      else if (it.kind === 'drive') boardBoat(it); else if (it.kind === 'tube') startTube();
      else if (it.takeLantern) takeLantern();
      else if (it.subStand) subStand(); else if (it.subSit) subSit(); else if (it.poolOut) poolClimbOut();
      else if (it.tubPanel) openTubPanel(); else if (it.pumpPick) pickPump(); else if (it.hosePick) pickHose(); else if (it.reel) reelHose();
      else if (it.action) cabinAction(it);
      else { sit(it); if (it.bed) startSleep(); }
      updateToolButtons();
    }
  } else { promptEl.hidden = true; actBtn.hidden = true; }
  input.interact = false;
  $('t-down').hidden = !(isTouch && (P.mode === 'swim' || P.mode === 'plane' || P.mode === 'sub' || P.mode === 'surf'));
  syncVehicleHud(); syncLightsButton();
  $('t-tool').hidden = !(isTouch && (P.mode === 'walk' || P.mode === 'boat' || P.mode === 'seat'));
  if (isTouch) updateToolButtons();
}

// ───────────────────── 34. Main loop ─────────────────────
let last = performance.now(), sim = 0, fpsT = 0, fpsN = 0, warm = 0, slowTick = 0;
const clockStart = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000)); last = now;
  sim += dt; U.uTime.value = sim;
  readKeys();
  updateEnvironment(dt, sim);
  updateTsunami(dt);
  updateDestruction(dt);
  updateTreefall(dt);
  updateTsunamiSpray();
  if (started) { updatePlayer(dt); updateCamera(dt); updatePrompt(); updateMultiplayer(dt); }
  else introCamera((now - clockStart) / 1000);
  // what the camera is in
  const cw = waterAt(camera.position.x, camera.position.z, camera.position.y);
  const under = camera.position.y < cw.level - 0.03 || (P.mode === 'sub' && camera.position.y < cw.level + 0.3);
  P.eyeUnder = under;
  U.uUnderwater.value = under ? 1 : 0;
  const camDepth = Math.max(0, cw.level - camera.position.y);
  if (cw.kind === 'fresh') { U.uWaterFog.value.set(0.10, 0.30, 0.26).multiplyScalar(0.25 + 0.75 * ENV.daylight); U.uWaterFogDensity.value = 0.075; }
  else if (cw.kind === 'fall') { U.uWaterFog.value.set(0.52, 0.66, 0.66).multiplyScalar(0.3 + 0.7 * ENV.daylight); U.uWaterFogDensity.value = 0.32; }   // churning white water all round you
  else { const b = ENV.uwBase || [0.06, 0.45, 0.56]; const k = Math.exp(-camDepth * 0.03) * (1 - WX.cur.dark * 0.4); U.uWaterFog.value.set(b[0] * k, b[1] * k, b[2] * k); U.uWaterFogDensity.value = 0.026 + WX.cur.dark * 0.02 + WX.cur.rain * 0.01; }
  if (under && SUB.sonar) { U.uWaterFog.value.set(0.0, 0.035, 0.03); U.uWaterFogDensity.value = 0.0035; }
  else if (under && P.mode === 'sub' && SUB.lights) U.uWaterFogDensity.value = Math.max(0.02, U.uWaterFogDensity.value * 0.8);
  if (under && P.mode === 'sub' && SUB.view === 'outside') U.uWaterFogDensity.value *= 0.55;
  $('uw').style.opacity = under ? (P.mode === 'sub' ? (SUB.view === 'inside' ? 0 : 0.3) : P.mode === 'subboard' || P.mode === 'subwalk' ? 0 : 1) : 0;
  WATER.uCenter.value.set(Math.round(camera.position.x), Math.round(camera.position.z));
  updateOceanLOD(camera);
  updateShadowFrame(started ? P.pos : camera.position);
  slowTick -= dt;
  if (slowTick <= 0) { slowTick = 0.25; for (const f of FIELDS) f.update(camera.position); if (started) checkDiscoveries(); }
  if (started) updateTools(dt);
  updateSand(dt, sim); updateDams(dt);
  updateBoats(sim, dt); if (P.mode !== 'plane') updatePlane(dt, false); if (P.mode !== 'sub') updateSub(dt); updateTubeWorld(dt, sim); updateWake(dt, sim); updateCabin(dt, sim); updateLights(dt, sim); updateFar(dt); updateTub(dt);
  updateSeaLife(dt, sim); updateBigAnimals(dt, sim); updateWildlife(dt, sim); FX.update(dt, sim); FX.updateLens(dt);
  if (P.wasUnder && !under && started) FX.lens(18 + (rng() * 12 | 0));
  P.wasUnder = under;
  if (AUDIO.update) AUDIO.update(dt);
  updateWaterFX(dt);
  updateWeatherFX(dt);
  renderSubCam();
  renderWorld();
  renderGlow();
  renderTools();
  // adaptive resolution keeps phones smooth
  warm += dt; fpsT += dt; fpsN++;
  if (fpsT > 2.5) {
    const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
    if (settings.autoRes && !Q.noAutoRes && warm > 6) {
      if (fps < 40 && resScale > 0.55) { resScale = Math.max(0.55, resScale - 0.12); applySize(); }
      else if (fps > 57 && resScale < 1) { resScale = Math.min(1, resScale + 0.06); applySize(); }
    }
    window.__fps = fps;
  }
}

// ───────────────────── 35. Boot ─────────────────────
const beginBtn = $('begin');
async function boot(saved) {
  const progress = f => { beginBtn.textContent = `Shaping the island… ${Math.round(f * 100)}%`; };
  applySize();
  progress(0.01); await nextFrame();
  U.uNoiseTex.value = makeNoiseTexture(); SKY.uCloudTex.value = makeCloudTexture(); WATER.uNormTex.value = makeWaterNormalTexture();
  WFX.uniforms.uFoamTex.value = makeFoamTexture();
  await buildTerrainData(progress);
  buildTerrainMesh();
  initDestruction();
  buildRiverChunks();
  buildSky(); buildOcean(); buildFreshwater(); applyWaterStyle();
  layoutPlaces();
  progress(0.62); await nextFrame();
  plantIsland(progress);
  progress(0.74); await nextFrame();
  buildProps();
  buildCabin();
  buildPoolDeck();
  buildSub();
  buildIslands();
  progress(0.8); await nextFrame();
  buildSeaLife();
  buildBigAnimals();
  buildWildlife();
  FX.build();
  buildSpray(); buildRipples(); setupRefraction(); setupGlow(); setupPost(); buildWeatherFX(); buildTsunamiSpray(); buildPourStream();
  buildTools(); buildFishing(); buildTreefall(); buildSurf(); buildLights();
  finishVegetation();
  buildLawn();
  if (typeof applyLifeQuality === 'function') applyLifeQuality();
  progress(0.88); await nextFrame();
  if (saved && saved.hour !== undefined) ENV.hour = saved.hour;
  snapWeather();
  spawnPlayer();
  if (saved && saved.x !== undefined) { P.pos.set(saved.x, saved.y, saved.z); P.yaw = saved.yaw; P.pitch = saved.pitch; P.camY = P.pos.y; }
  updateEnvironment(0, 0); introCamera(0);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); } catch (e) { /* compile lazily */ }
  progress(1);
  requestAnimationFrame(frame);
  wirePanel();
  beginBtn.disabled = false;
  beginBtn.textContent = isTouch ? 'Tap to begin' : 'Begin';
  beginBtn.focus({ preventScroll: true });
  window.__ready = true;
  startMultiplayer();
}
function begin() {
  if (started) return;
  started = true;
  $('start').classList.add('gone');
  setTimeout(() => ($('start').hidden = true), 1300);
  $('gear').hidden = false;
  if (isTouch) { $('touch').hidden = false; placeStickIdle(); }
  if (AUDIO.start) AUDIO.start();
  if (!isTouch) lockPointer();
  canvas.focus({ preventScroll: true });
  showHint();
}
beginBtn.addEventListener('click', begin);
addEventListener('resize', () => { applySize(); if (isTouch && started && touch.stickId === null) placeStickIdle(); });
document.addEventListener('visibilitychange', () => { if (AUDIO.visibility) AUDIO.visibility(document.hidden); });
// live-update support inside the Claude artifact viewer: keep your place on the island
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) { try { hot.snapshot(() => ({ x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, pitch: P.pitch, hour: ENV.hour })); } catch (e) { /* optional */ } }
const startBoot = data => boot(data || {}).catch(err => { console.error(err); fatal('Something went wrong while building the island: ' + (err && err.message ? err.message : err)); });
if (hot && hot.ready) hot.ready(startBoot); else startBoot(hot && hot.data);
// small handle for poking at the island from the browser console
// for tests: evaluate code inside this module, so anything defined in the game can be reached by name
window.__bpEval = (code) => eval(code);
window.__bp = { updateSeaLife, P, ENV, WX, settings, begin, camera, renderer, scene, spawnPlayer, groundHeight, PLACES, SPAWN, applyQuality, POOL, STREAM, FIELDS, INTERACT, input, keys, sit, U, updatePlayer, readKeys, waterAt, LAYOUT, SEA, PLATFORMS, updatePrompt,
  applyWaterStyle, updateCamera, FX, WFX, SPRAY, OLOD, updateOceanLOD, surfState, Q, LIGHTS, DECK, applyQuality, ISLANDS, FAR, farField, farHeight, TUB, PUMP, ABYSS, subStand, subSit, subWalk, poolClimbOut, nearestInteract, updatePlayer, input, keys, updatePump, updateSub, SUB_SEAT, cycleSubView, updateSubBoard, subCamera, renderSubCam, POOLB, TUBB, openTubPanel, closeTubPanel, pickPump, pickHose, placeCarried, reelHose, updateTub, poolWaterAt, cutGrass, LAWN, useLantern, takeLantern, toggleHeadlights, standOnDeck, deckTopAt, deckClimbFrom, updateLights, splashAt, rippleDrop, supportHeight, applyShovelPower, updateBoats, boatPhysics, updateTsunami, updateCabin, BUCKET, wetArea, SURF, startSurf, updateSurf, endSurf, surfAtJS, TREEFALL, breakTree, allTrees, blastTrees, updateTreefall, unhideTrees, VEG, PLANE, SUB, TRENCH, boardPlane, exitPlane, updatePlane, resetPlane, planeExplode, boardSub, exitSub, updateSub, setSonar, subDepth, implode, ANIMALS, updateBigAnimals, showHeldFish, FISHING, FISH, rollFish, hookFish, landFish, habitatAt, toggleJournal, updateFishing, WXFX, strike, updateWeatherFX, CABIN, WALLS, TSU, DESTROY, destroyCabin, repairIsland, flushTerrain, tsunamiErode, updateDestruction, sendTsunami, calmSea, insideCabin, cabinToWorld, worldToCabin, startSleep, cabinAction, nearestInteract, oceanHeight, tsunamiJS, pourAt, scoopAt, returnBoat,
  SAND, digAt, carveStroke, stampFoot, updateSand, riverQuery, BOATS, TUBE, boardBoat, exitBoat, startTube, setTool, TOOL, updateTools, aimGround, updateTubeWorld, sandWaterAt, SPRING, fillAt, pourAt, surveyRiver, DAM, updateDams, fallsWaterAt, swimStep, updateTools, riverLevelAt, riverCalmJS, oceanHeight, toggleShovelMode, T };
