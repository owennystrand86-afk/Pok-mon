
// ───────────────────── 36. Multiplayer ─────────────────────
// Everyone who has the island open at the same time is on it together, automatically: you see
// them walk, swim, sit, drive the boat, fly the plane and dive the sub, with their name above
// them. Each player shares where they are about eight times a second; between updates their
// figure glides smoothly. A tsunami one player sends reaches everyone.
const MP = { room: null, user: null, avatars: new Map(), sendT: 0, color: 0, names: {}, here: 0 };
const MP_COLORS = ['#e8604c', '#4c9be8', '#f2c14e', '#7fe0b8', '#c27ce8', '#ff9f43', '#5ad1e6', '#e86ba8'];
async function startMultiplayer() {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') return;
  let room = null;
  try { room = await c.use('room'); } catch (e) { room = null; }
  if (!room) return;
  MP.room = room;
  try { MP.user = await c.use('user'); } catch (e) { MP.user = null; }
  room.onPeers(ch => {
    for (const p of ch.left) removeAvatar(p.peer);
    for (const p of ch.joined) if (!p.sameTab) upsertPeer(p);
    for (const p of ch.updated) if (!p.sameTab) upsertPeer(p);
    MP.here = ch.peers.filter(p => !p.sameTab && p.kind === 'viewer').length;
    updateMpBadge();
  }, () => { MP.room = null; for (const k of [...MP.avatars.keys()]) removeAvatar(k); updateMpBadge(); });
}
function updateMpBadge() {
  const el = $('mp'); if (!el) return;
  el.hidden = !MP.room || MP.here === 0;
  el.textContent = MP.here === 1 ? '1 other player on the island' : `${MP.here} other players on the island`;
}
const q2 = v => Math.round(v * 100) / 100;
// what this player shares
function myPresence() {
  const pr = { v: 1, x: q2(P.pos.x), y: q2(P.pos.y), z: q2(P.pos.z), yw: q2(P.yaw), m: P.mode, t: TOOL.cur };
  if (P.mode === 'boat' && P.boat) { const b = P.boat.mesh; pr.vh = { k: 'boat', x: q2(b.position.x), y: q2(b.position.y), z: q2(b.position.z), r: [q2(b.rotation.x), q2(b.rotation.y), q2(b.rotation.z)], hl: LIGHTS.head.on ? 1 : 0 }; }
  if (TOOL.cur === 'lantern') pr.ln = LIGHTS.lantern.on && LIGHTS.lantern.where === 'hand' ? 1 : 0;
  if (P.mode === 'plane') { const e = new THREE.Euler().setFromQuaternion(PLANE.q, 'YXZ'); pr.vh = { k: 'plane', x: q2(PLANE.x), y: q2(PLANE.y), z: q2(PLANE.z), r: [q2(e.x), q2(e.y), q2(e.z)] }; }
  if (P.mode === 'sub') pr.vh = { k: 'sub', x: q2(SUB.x), y: q2(SUB.y), z: q2(SUB.z), r: [q2(SUB.pitch), q2(SUB.yaw), q2(SUB.roll)] };
  if (TUB.changed) pr.tub = { p: TUB.power ? 1 : 0, b: TUB.bubbles ? 1 : 0, j: TUB.jets, h: TUB.heat, l: TUB.lights ? 1 : 0, tf: TUB.tubFlow, pf: TUB.poolFlow, t: TUB.changed };
  if (TSU.on && TSU.front < TSU.end) pr.ts = { f: Math.round(TSU.front), A: TSU.A, s: Math.round(TSU.shore), e: Math.round(TSU.end), dx: q2(U.uTsuDir.value.x), dz: q2(U.uTsuDir.value.y), sp: q2(settings.tsunamiSpeed || 1), at: Date.now() };
  return pr;
}
function updateMultiplayer(dt) {
  if (!MP.room || !started) return;
  MP.sendT -= dt;
  if (MP.sendT <= 0) { MP.sendT = 0.125; MP.room.presence(myPresence()).catch(() => {}); }
  // glide everyone toward where they last said they were
  const t = U.uTime.value;
  for (const a of MP.avatars.values()) animateAvatar(a, dt, t);
}
// ---- the figures ----
function avatarMesh(color) {
  const g = new THREE.Group();
  const cloth = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.75 }), { key: 'avatarCloth' });
  const skin = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.78, 0.58, 0.44, THREE.SRGBColorSpace), roughness: 0.6 }), { key: 'avatarSkin' });
  const shorts = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.12, 0.2, 0.32, THREE.SRGBColorSpace), roughness: 0.8 }), { key: 'avatarShorts' });
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const torso = mk(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), cloth, 0, 1.22, 0);
  mk(new THREE.SphereGeometry(0.14, 14, 10), skin, 0, 1.66, 0);
  mk(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 14), cloth, 0, 1.79, 0);  // a cap
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.11, 0.9, 0); const lm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.68, 4, 8).translate(0, -0.42, 0), s ? shorts : skin); lm.castShadow = true; leg.add(lm);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.3, 4, 8).translate(0, -0.62, 0), skin); leg.add(shin); g.add(leg); legs.push(leg);
    const arm = new THREE.Group(); arm.position.set(s * 0.28, 1.42, 0); const am = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8).translate(0, -0.3, 0), skin); am.castShadow = true; arm.add(am); g.add(arm); arms.push(arm);
  }
  // a lantern they can carry in their left hand
  const lan = lanternModel(); lan.position.set(0, -0.62, 0.06); lan.rotation.y = 0.4; lan.visible = false; arms[0].add(lan);
  const lg = glareSprite(0xffb366); lg.position.y = 0.12; lg.scale.setScalar(0.9); lan.add(lg);
  g.userData = { legs, arms, torso, lan, lg };
  return g;
}
function nameTag(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d'); g.font = '600 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(250, g.measureText(text).width + 30);
  g.fillStyle = 'rgba(6,22,28,0.6)'; g.beginPath(); g.roundRect(128 - w / 2, 10, w, 44, 22); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(128 - w / 2 + 18, 32, 6, 0, TAU); g.fill();
  g.fillStyle = '#f2fbf8'; g.fillText(text, 136, 33);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  sp.scale.set(2.2, 0.55, 1); sp.renderOrder = 20;
  return sp;
}
function vehicleGhost(kind) {
  const src = kind === 'boat' ? BOATS.motor && BOATS.motor.mesh : kind === 'plane' ? PLANE.mesh : SUB.mesh;
  if (!src) return null;
  const g = src.clone(true); g.visible = true;
  // not your own lights and lantern: theirs are shown separately
  const drop = []; g.traverse(o => { if (o.isLight || o.userData.noGhost) drop.push(o); });
  for (const o of drop) if (o.parent) o.parent.remove(o);
  scene.add(g); return g;
}
function upsertPeer(p) {
  const pr = p.presence || {};
  if (pr.v !== 1 || typeof pr.x !== 'number' || !isFinite(pr.x) || !isFinite(pr.y) || !isFinite(pr.z)) return;
  let a = MP.avatars.get(p.peer);
  if (!a) {
    let h = 0; for (const ch of p.peer) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const color = MP_COLORS[h % MP_COLORS.length];
    const mesh = avatarMesh(color); scene.add(mesh);
    a = { peer: p.peer, mesh, color, x: pr.x, y: pr.y, z: pr.z, yaw: pr.yw || 0, tx: pr.x, ty: pr.y, tz: pr.z, tyaw: pr.yw || 0, mode: pr.m, walkPh: 0, speed: 0, veh: null, vehKind: null, tag: null, name: '' };
    MP.avatars.set(p.peer, a);
    setAvatarName(a, p.by, p.guest);
  }
  a.tx = clamp(pr.x, -2000, 2000); a.ty = clamp(pr.y, -600, 900); a.tz = clamp(pr.z, -2000, 2000); a.tyaw = +pr.yw || 0;
  a.mode = String(pr.m || 'walk').slice(0, 8); a.tool = String(pr.t || '').slice(0, 8); a.lanternOn = pr.ln === 1;
  // their vehicle
  const vh = pr.vh && typeof pr.vh === 'object' && ['boat', 'plane', 'sub'].includes(pr.vh.k) ? pr.vh : null;
  if (!vh && a.veh) { scene.remove(a.veh); a.veh = null; a.vehKind = null; }
  if (vh) {
    if (a.vehKind !== vh.k) { if (a.veh) scene.remove(a.veh); a.veh = vehicleGhost(vh.k); a.vehKind = vh.k; }
    a.vt = { x: +vh.x, y: +vh.y, z: +vh.z, r: Array.isArray(vh.r) ? vh.r.map(Number) : [0, 0, 0] };
    if (vh.k === 'boat' && a.veh) ghostHeadlights(a.veh, vh.hl === 1);
  }
  // someone else changed the hot tub's settings
  const tb = pr.tub;
  if (tb && typeof tb === 'object' && isFinite(tb.t) && tb.t > TUB.changed) {
    TUB.power = !!tb.p; TUB.bubbles = !!tb.b; TUB.jets = clamp(tb.j | 0, 0, 2); TUB.heat = clamp(+tb.h || 0, 0, 40); TUB.lights = !!tb.l;
    TUB.tubFlow = clamp(tb.tf | 0, -1, 1); TUB.poolFlow = clamp(tb.pf | 0, -1, 1); TUB.changed = tb.t; if (TUB.panelOpen) syncTubPanel(); drawTubScreen();
  }
  // a tsunami someone else sent arrives here too
  const ts = pr.ts;
  if (ts && typeof ts === 'object' && !TSU.on && isFinite(ts.f) && isFinite(ts.A) && ts.A > 0 && ts.A <= 40) {
    U.uTsuDir.value.set(clamp(+ts.dx, -1, 1), clamp(+ts.dz, -1, 1)).normalize();
    TSU.A = +ts.A; TSU.shore = +ts.s; TSU.end = +ts.e; TSU.front = +ts.f; TSU.on = true; TSU.k = 0.5; TSU.hit = false; TSU.warned = false;
    toast('A tsunami is coming', 'Another player sent it');
  }
}
async function setAvatarName(a, by, guest) {
  let name = guest ? 'Guest' : 'Visitor';
  try { if (by && MP.user && MP.user.profiles) { const ps = await MP.user.profiles([by]); const pf = ps && ps[by]; if (pf && pf.name) name = pf.name.split(' ')[0]; } } catch (e) { /* names are optional */ }
  a.name = name.slice(0, 20);
  if (a.tag) a.mesh.remove(a.tag);
  a.tag = nameTag(a.name, a.color); a.tag.position.y = 2.15; a.mesh.add(a.tag);
}
function removeAvatar(peer) {
  const a = MP.avatars.get(peer); if (!a) return;
  scene.remove(a.mesh); if (a.veh) scene.remove(a.veh);
  MP.avatars.delete(peer);
}
function animateAvatar(a, dt, t) {
  const k = 1 - Math.exp(-dt * 9);
  const px = a.x, pz = a.z;
  a.x += (a.tx - a.x) * k; a.y += (a.ty - a.y) * k; a.z += (a.tz - a.z) * k;
  let dy = a.tyaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * k;
  a.speed = damp(a.speed, Math.hypot(a.x - px, a.z - pz) / Math.max(dt, 1e-3), 6, dt);
  const m = a.mesh, u = m.userData;
  const inVeh = a.mode === 'boat' || a.mode === 'plane' || a.mode === 'sub';
  if (a.veh && a.vt) {
    const v = a.veh;
    v.position.lerp(_mpv.set(a.vt.x, a.vt.y, a.vt.z), k);
    v.rotation.set(a.vt.r[0], a.vt.r[1], a.vt.r[2], 'YXZ');
  }
  // the figure: standing on their feet (the position they send is their eyes)
  m.visible = a.mode !== 'sub' && a.mode !== 'dead';
  m.position.set(a.x, a.y - (a.mode === 'swim' ? 0.3 : EYE), a.z);
  m.rotation.set(a.mode === 'swim' ? -1.2 : 0, a.yaw, 0, 'YXZ');
  if (a.mode === 'swim') m.position.y = a.y - 0.35;
  const walking = (a.mode === 'walk') && a.speed > 0.4;
  a.walkPh += dt * (walking ? 2.2 + a.speed * 1.4 : a.mode === 'swim' ? 3 : 0);
  const sw = walking ? Math.sin(a.walkPh) * Math.min(0.7, a.speed * 0.15) : a.mode === 'swim' ? Math.sin(a.walkPh) * 0.5 : 0;
  const sitting = a.mode === 'seat' || inVeh || a.mode === 'tube';
  u.legs[0].rotation.x = sitting ? -1.45 : sw; u.legs[1].rotation.x = sitting ? -1.45 : -sw;
  u.arms[0].rotation.x = sitting ? -0.6 : -sw * 0.8; u.arms[1].rotation.x = sitting ? -0.6 : sw * 0.8;
  if (sitting) m.position.y += 0.45;
  // their lantern, lit or not
  const night = 1 - smoothstep(0.15, 0.6, ENV.daylight), lit = a.tool === 'lantern' && a.lanternOn;
  u.lan.visible = a.tool === 'lantern' && m.visible; u.lan.userData.flame.visible = lit; u.lan.userData.glassMat.emissiveIntensity = lit ? 0.6 + 1.6 * night : 0;
  u.lg.visible = lit && night > 0.05; u.lg.material.opacity = 0.6 * night;
  if (u.lan.visible) u.arms[0].rotation.x = Math.min(u.arms[0].rotation.x, -0.5);
  if (a.mode === 'plane') m.position.y -= 0.35;
}
const _mpv = new THREE.Vector3();

// another player's boat: two glowing headlamps on the bow when their lights are on
function ghostHeadlights(v, on) {
  if (!v.userData.hl) {
    v.userData.hl = [-1, 1].map(s => { const g = glareSprite(0xfff1d8); g.scale.setScalar(0.9); g.visible = false; g.position.set(s * 0.56, 1.12, -2.3 - HULL_CG - 0.1); v.add(g); return g; });
  }
  const night = 1 - smoothstep(0.15, 0.6, ENV.daylight);
  for (const g of v.userData.hl) { g.visible = on; g.material.opacity = 0.35 + 0.65 * night; }
}
