
// ───────────────────── 16c. Walking around on the boat ─────────────────────
// The motorboat's cockpit floor is solid: you can step down onto it from the dock, stand up from the
// helm, walk round the console and get carried along as it rolls and drifts. The gunwales and the
// console are walls; hop over the side to go swimming. Coordinates below are the hull's own.
const DECK = { boat: null, m: new THREE.Matrix4(), inv: new THREE.Matrix4(), d: new THREE.Matrix4(), v: new THREE.Vector3(), w: new THREE.Vector3(), f: new THREE.Vector3() };
const DECK_BOXES = [
  { hx: 0.45, z0: -0.88, z1: -0.12, h: 1.3 },   // the console
  { hx: 0.42, z0: 0.6, z1: 1.04, h: 1.05 },     // the leaning post
  { hx: 0.86, z0: 2.04, z1: 2.62, h: 0.42 },    // the stern bench
  { hx: 0.39, z0: -1.47, z1: -1.03, h: 0.51 },  // the cooler seat
];
const DECK_FORE = HULL.zb + (HULL.zs - HULL.zb) * 0.12, DECK_AFT = HULL.zs - 0.22;
function deckBoat(x, z) {
  const b = BOATS.motor;
  if (!b || !b.mesh || !b.mesh.userData.inner || b.sunk) return null;
  const dx = x - b.mesh.position.x, dz = z - b.mesh.position.z;
  return dx * dx + dz * dz < 4.6 * 4.6 ? b : null;
}
// (the boat's matrices are brought up to date once a frame, when it moves)
function deckInv(b) { return DECK.inv.copy(b.mesh.userData.inner.matrixWorld).invert(); }
const gunwaleY = z => sheerY(clamp(hullT(z), 0, 1));
// height of the deck (or the top of a bench you're standing on) under a world point, in the world
function deckTopAt(b, x, z, feet) {
  const lp = DECK.v.set(x, feet, z).applyMatrix4(deckInv(b));
  if (lp.z < DECK_FORE || lp.z > DECK_AFT || Math.abs(lp.x) > hullHalfJS(lp.z) - 0.12) return -1e9;
  let top = DECK_Y;
  for (const bx of DECK_BOXES) if (Math.abs(lp.x) < bx.hx && lp.z > bx.z0 && lp.z < bx.z1 && DECK_Y + bx.h <= lp.y + 0.08) top = Math.max(top, DECK_Y + bx.h);
  if (lp.y < DECK_Y - 0.45) return -1e9;                      // you're under the boat, not on it
  return DECK.w.set(lp.x, top, lp.z).applyMatrix4(b.mesh.userData.inner.matrixWorld).y;
}
// keep walkers inside the cockpit and swimmers outside the hull
function deckCollide(x, z, feet) {
  const b = deckBoat(x, z); if (!b) return null;
  const lp = DECK.v.set(x, feet, z).applyMatrix4(deckInv(b));
  const t = hullT(lp.z), half = t >= 0 && t <= 1 ? hullHalfJS(lp.z) : -1;
  const gw = gunwaleY(lp.z);
  let moved = false;
  if (lp.y >= DECK_Y - 0.3 && lp.y < gw - 0.08 && half > 0 && Math.abs(lp.x) < half + 0.1) {
    // on deck: the hull sides and the bow are walls
    const lim = Math.max(0.05, hullHalfJS(clamp(lp.z, DECK_FORE, DECK_AFT)) - 0.26);
    if (Math.abs(lp.x) > lim) { lp.x = Math.sign(lp.x) * lim; moved = true; }
    if (lp.z < DECK_FORE + 0.1) { lp.z = DECK_FORE + 0.1; moved = true; }
    if (lp.z > DECK_AFT - 0.05) { lp.z = DECK_AFT - 0.05; moved = true; }
    for (const bx of DECK_BOXES) {
      if (DECK_Y + bx.h <= lp.y + 0.08) continue;                // standing on it, or above it
      const R = 0.26, qx = clamp(lp.x, -bx.hx, bx.hx), qz = clamp(lp.z, bx.z0, bx.z1), ex = lp.x - qx, ez = lp.z - qz, d = Math.hypot(ex, ez);
      if (d >= R) continue;
      if (d > 1e-5) { lp.x = qx + ex / d * R; lp.z = qz + ez / d * R; }
      else { // right inside: out the nearest face
        const o = [bx.hx - lp.x, lp.x + bx.hx, bx.z1 - lp.z, lp.z - bx.z0], m = Math.min(...o), k = o.indexOf(m);
        if (k === 0) lp.x = bx.hx + R; else if (k === 1) lp.x = -bx.hx - R; else if (k === 2) lp.z = bx.z1 + R; else lp.z = bx.z0 - R;
      }
      moved = true;
    }
  } else if (lp.y < DECK_Y - 0.3 && lp.y > -1.6) {
    // in the water beside it: the hull pushes you away
    const zc = clamp(lp.z, HULL.zb, HULL.zs), hh = Math.max(0.15, hullHalfJS(zc)) + 0.32;
    if (lp.z > HULL.zb - 0.3 && lp.z < HULL.zs + 0.3 && Math.abs(lp.x) < hh) {
      const toSide = hh - Math.abs(lp.x), toBow = lp.z - (HULL.zb - 0.3), toStern = HULL.zs + 0.3 - lp.z;
      const m = Math.min(toSide, toBow, toStern);
      if (m === toSide) lp.x = Math.sign(lp.x || 1) * hh; else if (m === toBow) lp.z = HULL.zb - 0.3; else lp.z = HULL.zs + 0.3;
      moved = true;
    }
  }
  if (!moved) return null;
  lp.applyMatrix4(b.mesh.userData.inner.matrixWorld);
  return [lp.x, lp.z];
}
// before you move: the boat has moved under you since last frame, so you move with it
function deckCarry() {
  const b = DECK.boat; if (!b) return;
  const inner = b.mesh.userData.inner;
  DECK.d.copy(inner.matrixWorld).multiply(DECK.inv.copy(DECK.m).invert());
  const f = DECK.f.set(P.pos.x, P.pos.y - EYE, P.pos.z).applyMatrix4(DECK.d);
  P.pos.set(f.x, f.y + EYE, f.z);
  // turn with it too
  const e = DECK.d.elements, dyaw = Math.atan2(e[8], e[10]);
  if (Math.abs(dyaw) < 0.5) P.yaw += dyaw;
  DECK.m.copy(inner.matrixWorld);
}
// after you move: are you standing on the deck?
function deckTrack() {
  const b = deckBoat(P.pos.x, P.pos.z);
  if (b && P.mode === 'walk' && P.onGround) {
    const feet = P.pos.y - EYE, top = deckTopAt(b, P.pos.x, P.pos.z, feet);
    if (Math.abs(top - feet) < 0.12) { if (DECK.boat !== b) { DECK.boat = b; } DECK.m.copy(b.mesh.userData.inner.matrixWorld); return; }
  }
  DECK.boat = null;
}
// stand up from the helm: you're on your feet just behind the console
function standOnDeck(b) {
  const inner = b.mesh.userData.inner; inner.updateMatrixWorld();
  const p = DECK.w.set(0.18, DECK_Y + 0.02, 0.32).applyMatrix4(inner.matrixWorld);
  P.pos.set(p.x, p.y + EYE, p.z); P.mode = 'walk'; P.onGround = true; P.vel.set(0, 0, 0);
  DECK.boat = b; DECK.m.copy(inner.matrixWorld);
}
// from the water: grab the stern and haul yourself up over the transom
function deckClimbFrom() {
  const b = deckBoat(P.pos.x, P.pos.z); if (!b) return false;
  const lp = DECK.v.set(P.pos.x, P.pos.y, P.pos.z).applyMatrix4(deckInv(b));
  if (lp.z < HULL.zb - 0.6 || lp.z > HULL.zs + 1.4 || Math.abs(lp.x) > hullHalfJS(clamp(lp.z, HULL.zb, HULL.zs)) + 1.2) return false;
  const inner = b.mesh.userData.inner;
  const tz = clamp(lp.z, -1.9, 1.85), tx = clamp(lp.x, -(hullHalfJS(tz) - 0.35), hullHalfJS(tz) - 0.35);
  const to = DECK.w.set(tx, DECK_Y + 0.02, tz).applyMatrix4(inner.matrixWorld);
  P.climb = { from: P.pos.clone(), to: new THREE.Vector3(to.x, to.y + EYE, to.z), t: 0, boat: b };
  return true;
}
