
// ───────────────────── 29b. Fishing ─────────────────────
// Cast from the beach, the dock, the boat, the river or the pool. What bites depends on where
// the bobber lands (sea, deep sea, reef, river, pool), the time of day and the weather.
// Reel it in by keeping the line tension in the green while the fish fights; big ones
// (sharks, marlin, tuna) take long runs. Every catch goes in the fish journal (J).
// habitat: s = shallow sea, d = deep sea (from the boat or the end of the dock), r = reef,
// f = river, p = waterfall pool. time: d = day, n = night, a = any.  rar: 1 common … 5 legendary
const FISH = [
  { id: 'sardine', name: 'Sardine', hab: 's', w: [0.05, 0.15], rar: 1, pow: 0.15, col: '#9fb3c4', shape: 'slim', tm: 'a' },
  { id: 'mullet', name: 'Striped Mullet', hab: 's', w: [0.4, 2.5], rar: 1, pow: 0.3, col: '#8a99a6', shape: 'torpedo', tm: 'a' },
  { id: 'bonefish', name: 'Bonefish', hab: 's', w: [1, 5], rar: 2, pow: 0.6, col: '#c3cdd3', shape: 'torpedo', tm: 'd' },
  { id: 'pompano', name: 'Florida Pompano', hab: 's', w: [0.7, 3], rar: 2, pow: 0.45, col: '#d9d5b8', shape: 'deep', tm: 'a' },
  { id: 'snook', name: 'Common Snook', hab: 's', w: [2, 12], rar: 2, pow: 0.6, col: '#c2b896', shape: 'torpedo', tm: 'n' },
  { id: 'permit', name: 'Permit', hab: 's', w: [4, 18], rar: 3, pow: 0.75, col: '#b8c0c4', shape: 'deep', tm: 'd' },
  { id: 'tarpon', name: 'Tarpon', hab: 's', w: [15, 80], rar: 4, pow: 0.9, col: '#d6e0e6', shape: 'torpedo', tm: 'a' },
  { id: 'stingray', name: 'Southern Stingray', hab: 's', w: [5, 40], rar: 3, pow: 0.7, col: '#6e6a5e', shape: 'ray', tm: 'a' },
  { id: 'sea_bass', name: 'Black Sea Bass', hab: 'sr', w: [0.5, 3.5], rar: 1, pow: 0.4, col: '#3d3f45', shape: 'bass', tm: 'a' },
  { id: 'snapper', name: 'Red Snapper', hab: 'r', w: [1, 15], rar: 2, pow: 0.5, col: '#d9573f', shape: 'bass', tm: 'a' },
  { id: 'grouper', name: 'Goliath Grouper', hab: 'r', w: [20, 250], rar: 4, pow: 0.85, col: '#6b5a3d', shape: 'bass', tm: 'a' },
  { id: 'parrot', name: 'Stoplight Parrotfish', hab: 'r', w: [0.5, 2], rar: 2, pow: 0.3, col: '#2fb39a', shape: 'deep', tm: 'd' },
  { id: 'triggerfish', name: 'Queen Triggerfish', hab: 'r', w: [0.5, 3], rar: 2, pow: 0.35, col: '#4f88c6', shape: 'deep', tm: 'd' },
  { id: 'lionfish', name: 'Lionfish', hab: 'r', w: [0.2, 1.2], rar: 3, pow: 0.25, col: '#c45a3b', shape: 'deep', tm: 'a' },
  { id: 'barracuda', name: 'Great Barracuda', hab: 'rd', w: [3, 40], rar: 3, pow: 0.8, col: '#a6b1b8', shape: 'slim', tm: 'a' },
  { id: 'moray', name: 'Green Moray', hab: 'r', w: [5, 29], rar: 3, pow: 0.7, col: '#4e6b2e', shape: 'eel', tm: 'n' },
  { id: 'octopus', name: 'Caribbean Reef Octopus', hab: 'r', w: [0.5, 1.5], rar: 3, pow: 0.4, col: '#a1503a', shape: 'octo', tm: 'n' },
  { id: 'lobster', name: 'Spiny Lobster', hab: 'r', w: [0.5, 4], rar: 2, pow: 0.3, col: '#b85a28', shape: 'lobster', tm: 'n' },
  { id: 'mahi', name: 'Mahi-mahi', hab: 'd', w: [7, 40], rar: 2, pow: 0.75, col: '#d9c43a', shape: 'mahi', tm: 'd' },
  { id: 'wahoo', name: 'Wahoo', hab: 'd', w: [10, 60], rar: 3, pow: 0.85, col: '#4b6d8c', shape: 'slim', tm: 'a' },
  { id: 'yellowfin', name: 'Yellowfin Tuna', hab: 'd', w: [20, 180], rar: 3, pow: 0.9, col: '#2c4a74', shape: 'tuna', tm: 'a' },
  { id: 'bluefin', name: 'Atlantic Bluefin Tuna', hab: 'd', w: [100, 450], rar: 4, pow: 0.97, col: '#1f3552', shape: 'tuna', tm: 'a' },
  { id: 'sailfish', name: 'Sailfish', hab: 'd', w: [25, 90], rar: 4, pow: 0.9, col: '#2c5a9e', shape: 'bill', tm: 'd' },
  { id: 'marlin', name: 'Blue Marlin', hab: 'd', w: [100, 600], rar: 5, pow: 1.0, col: '#1f4f8c', shape: 'bill', tm: 'd' },
  { id: 'blacktip', name: 'Blacktip Shark', hab: 'sd', w: [20, 100], rar: 3, pow: 0.9, col: '#6f7a82', shape: 'shark', tm: 'a' },
  { id: 'hammerhead', name: 'Great Hammerhead', hab: 'd', w: [200, 450], rar: 4, pow: 0.97, col: '#7b858c', shape: 'hammer', tm: 'a' },
  { id: 'tiger', name: 'Tiger Shark', hab: 'd', w: [300, 650], rar: 5, pow: 1.0, col: '#6d7166', shape: 'shark', tm: 'n' },
  { id: 'great_white', name: 'Great White Shark', hab: 'd', w: [700, 1900], rar: 5, pow: 1.0, col: '#5f6a72', shape: 'shark', tm: 'a', storm: true },
  { id: 'bass', name: 'Largemouth Bass', hab: 'fp', w: [0.5, 6], rar: 1, pow: 0.45, col: '#5b7a3a', shape: 'bass', tm: 'a' },
  { id: 'peacock_bass', name: 'Peacock Bass', hab: 'fp', w: [1, 8], rar: 2, pow: 0.6, col: '#9ba53a', shape: 'bass', tm: 'd' },
  { id: 'tilapia', name: 'Tilapia', hab: 'fp', w: [0.3, 2.5], rar: 1, pow: 0.25, col: '#7d8a80', shape: 'deep', tm: 'd' },
  { id: 'catfish', name: 'Channel Catfish', hab: 'fp', w: [1, 20], rar: 2, pow: 0.55, col: '#6b6650', shape: 'cat', tm: 'n' },
  { id: 'trout', name: 'Rainbow Trout', hab: 'f', w: [0.5, 5], rar: 2, pow: 0.45, col: '#b8a3a3', shape: 'torpedo', tm: 'd' },
  { id: 'eel', name: 'American Eel', hab: 'fp', w: [0.5, 7], rar: 3, pow: 0.5, col: '#5a5032', shape: 'eel', tm: 'n' },
  { id: 'arapaima', name: 'Arapaima', hab: 'p', w: [50, 200], rar: 5, pow: 0.95, col: '#7a3d2c', shape: 'torpedo', tm: 'a' },
  { id: 'boot', name: 'Old Boot', hab: 'sfprd', w: [0.6, 1.2], rar: 2, pow: 0.1, col: '#4a3a2a', shape: 'boot', tm: 'a', junk: true },
];
const RARITY = ['', 'Common', 'Uncommon', 'Rare', 'Very rare', 'Legendary'];
const FISHING = {
  state: 'idle', // idle → casting → flying → waiting → bite → fighting → caught/lost
  t: 0, power: 0, bob: null, line: null, hab: 's', fish: null, tension: 0.4, dist: 0, fishPull: 0, stamina: 1, biteT: 0, nibble: 0,
  journal: {}, rodTip: new THREE.Vector3(), vm: null, saveKey: 'beach-paradise:fish:v1',
};
try { FISHING.journal = JSON.parse(localStorage.getItem(FISHING.saveKey) || '{}'); } catch (e) { FISHING.journal = {}; }
const saveJournal = () => { try { localStorage.setItem(FISHING.saveKey, JSON.stringify(FISHING.journal)); } catch (e) { /* storage blocked */ } };

// what lives where the bobber is
function habitatAt(x, z) {
  const w = waterAt(x, z), g = groundHeight(x, z), depth = w.level - g;
  if (depth < 0.25) return null;
  if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 1) return 'p';
  if (w.kind === 'river' || (w.kind === 'fresh' && !sandWaterAt(x, z))) return 'f';
  if (w.kind === 'fresh') return null;                          // a puddle you dug
  if (LAYOUT.coralGarden && Math.hypot(x - LAYOUT.coralGarden.x, z - LAYOUT.coralGarden.z) < 70 && depth < 14) return 'r';
  if (depth > 7 || shoreDistance(x, z) > 70) return 'd';
  return 's';
}
function rollFish(hab) {
  const night = ENV.night > 0.5, storm = WX.cur.storm > 0.5 || WX.cur.rain > 0.5;
  const pool = FISH.filter(f => f.hab.includes(hab) && (f.tm === 'a' || (f.tm === 'n') === night));
  let total = 0;
  const wts = pool.map(f => { let w = [0, 50, 22, 9, 3.2, 0.9][f.rar]; if (f.storm && storm) w *= 4; if (f.shape === 'shark' && night) w *= 1.6; if (f.junk) w = 5; total += w; return w; });
  let r = rng() * total; let f = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= wts[i]; if (r <= 0) { f = pool[i]; break; } }
  const k = Math.pow(rng(), 1.8); // most are small, a few are big
  const weight = f.w[0] + (f.w[1] - f.w[0]) * k;
  return { ...f, weight, size: k };
}

// ---- the rod (first-person model) and the line ----
function buildFishing() {
  const vm = TOOL.vm; if (!vm.grp) return;
  const rod = new THREE.Group();
  const blank = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.12, 0.13, 0.16, THREE.SRGBColorSpace), roughness: 0.35, metalness: 0.2 });
  const cork = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.6, 0.45, 0.3, THREE.SRGBColorSpace), roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.9 });
  // the rod is built along +y from the grip; it bends as a chain of segments
  const segs = [], N = 8, L = 1.9;
  let parent = rod;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.36, 10).translate(0, -0.1, 0), cork); rod.add(grip);
  const reel = new THREE.Group(); reel.position.set(0, 0.05, 0.035);
  reel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16).rotateZ(Math.PI / 2), metal));
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.01).translate(0, 0.03, 0), metal); handle.position.x = 0.025; reel.add(handle);
  rod.add(reel);
  for (let i = 0; i < N; i++) {
    const seg = new THREE.Group(); seg.position.y = i === 0 ? 0.08 : L / N;
    const r0 = lerp(0.011, 0.0025, i / N), r1 = lerp(0.011, 0.0025, (i + 1) / N);
    seg.add(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L / N, 6).translate(0, L / N / 2, 0), blank));
    if (i % 2 === 1) seg.add(new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0015, 4, 8).translate(0, L / N * 0.8, 0.01), metal));
    parent.add(seg); segs.push(seg); parent = seg;
  }
  const tip = new THREE.Object3D(); tip.position.y = L / N; parent.add(tip);
  vm.grp.add(rod); rod.visible = false;
  // a spool of line on the reel and the line running up the guides to the tip
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 16).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.6 })); reel.add(spool);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xf0f0e8, transparent: true, opacity: 0.8 });
  const rodLine = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3)), lineMat);
  rodLine.frustumCulled = false; vm.grp.add(rodLine);
  vm.rod = rod; FISHING.vm = { rod, segs, tip, reel, handle, rodLine };
  // the fish you just landed, held up in front of you
  const held = new THREE.Group(); held.visible = false; vm.grp.add(held);
  FISHING.held = held;
  // the line, in world space: from the rod tip to the bobber, drawn as a sagging curve
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xe8e8e0, transparent: true, opacity: 0.75 }));
  line.frustumCulled = false; line.visible = false; scene.add(line);
  // the bobber: red over white
  const bob = new THREE.Group();
  const bw = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 }));
  const br = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8261a, roughness: 0.4 }));
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ color: 0xd8261a }));
  bob.add(bw, br, st); bob.visible = false; scene.add(bob);
  FISHING.line = line; FISHING.bobber = bob;
  // the fish you're fighting shows as a dark shape under the water near the bobber
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a1418, transparent: true, opacity: 0.0, depthWrite: false }));
  shadow.renderOrder = 6; shadow.visible = false; scene.add(shadow); FISHING.shadow = shadow;
}
const _fsT = new THREE.Vector3(), _fsQ = new THREE.Vector3();
function rodTipWorld(out) {
  const v = FISHING.vm;
  if (TOOL.vm.grp && TOOL.vm.grp.visible && v) { TOOL.vm.grp.updateMatrixWorld(true); return v.tip.getWorldPosition(out); }
  // when the rod isn't drawn (in the boat, sitting), the line starts just in front of you
  camera.getWorldDirection(_fsQ);
  return out.copy(camera.position).addScaledVector(_fsQ, 1.6).add(_fsT.set(0.3, -0.2, 0).applyQuaternion(camera.quaternion));
}
function fishHint(t, secs = 0) { showActivityHint(t, !secs, secs); }

function startCast() {
  FISHING.state = 'casting'; FISHING.power = 0; FISHING.t = 0;
  fishHint(isTouch ? 'Hold Cast to wind up, let go to throw' : 'Hold to wind up the cast, let go to throw');
}
function releaseCast() {
  const pw = FISHING.power;
  camera.getWorldDirection(_fsQ); _fsQ.y = 0; _fsQ.normalize();
  const tip = rodTipWorld(new THREE.Vector3());
  const range = 6 + pw * 30;
  FISHING.bobPos = tip.clone();
  FISHING.bobVel = new THREE.Vector3(_fsQ.x * range * 0.62, 5.5 + pw * 4, _fsQ.z * range * 0.62);
  FISHING.state = 'flying'; FISHING.t = 0;
  if (AUDIO.cast) AUDIO.cast(pw);
}
function landBobber() {
  const p = FISHING.bobPos, hab = habitatAt(p.x, p.z);
  if (!hab) { fishHint('No fish there. Cast into the sea, the river or the pool', 2.6); reelIn(); return; }
  FISHING.hab = hab; FISHING.state = 'waiting'; FISHING.t = 0;
  FISHING.biteT = rand(3, 11) * (hab === 'd' ? 1.2 : 1) * (WX.cur.rain > 0.3 ? 0.75 : 1) * (ENV.hour > 5 && ENV.hour < 8.5 || ENV.hour > 17 && ENV.hour < 20 ? 0.6 : 1);
  FISHING.nibble = 0;
  splashAt(p.x, waterAt(p.x, p.z).level, p.z, 0.25, { foam: 0.3 });
  fishHint(hab === 'd' ? 'Deep water. Something big could be down there…' : hab === 'r' ? 'Over the reef. Wait for a bite' : hab === 'p' ? 'The waterfall pool. Wait for a bite' : hab === 'f' ? 'In the river. Wait for a bite' : 'Wait for a bite', 3);
}
function reelIn() {
  FISHING.state = 'idle'; FISHING.fish = null;
  FISHING.bobber.visible = false; FISHING.line.visible = false; FISHING.shadow.visible = false;
  setTension(-1);
}
function hookFish() {
  const f = rollFish(FISHING.hab);
  FISHING.fish = f; FISHING.state = 'fighting'; FISHING.t = 0;
  const p = FISHING.bobPos, tip = rodTipWorld(new THREE.Vector3());
  FISHING.dist = Math.hypot(p.x - tip.x, p.z - tip.z);
  FISHING.tension = 0.45; FISHING.stamina = 1; FISHING.run = 0; FISHING.runDir = rand(0, TAU);
  FISHING.power = Math.min(1, 0.25 + f.pow * 0.75);
  splashAt(p.x, waterAt(p.x, p.z).level, p.z, 0.4 + f.pow * 0.8);
  if (AUDIO.reelZip) AUDIO.reelZip(1);
  fishHint(isTouch ? 'Hold Reel to pull in, let go when the line is tight' : 'Hold the mouse button (or F) to reel; ease off when the line goes red', 0);
}
function landFish() {
  showHeldFish(FISHING.fish);
  const f = FISHING.fish;
  const j = FISHING.journal[f.id] || { n: 0, best: 0 };
  const first = j.n === 0, record = f.weight > j.best;
  j.n++; j.best = Math.max(j.best, f.weight); FISHING.journal[f.id] = j; saveJournal();
  const kg = f.weight < 10 ? f.weight.toFixed(2) : f.weight.toFixed(1);
  showCatchCard(f, first, record);
  const p = FISHING.bobPos; splashAt(p.x, waterAt(p.x, p.z).level, p.z, 0.6);
  if (AUDIO.catchFish) AUDIO.catchFish(f.rar);
  reelIn();
}
function loseFish(why) {
  fishHint(why, 2.6);
  if (AUDIO.snap && why.includes('snapped')) AUDIO.snap();
  reelIn();
}
function setTension(v) {
  const el = $('tension'); if (!el) return;
  if (v < 0) { el.hidden = true; return; }
  el.hidden = false;
  $('tension-fill').style.width = Math.round(clamp(v, 0, 1) * 100) + '%';
  $('tension-fill').style.background = v > 0.85 ? '#ff6b57' : v < 0.15 ? '#f2c14e' : '#7fe0b8';
  $('tension-dist').textContent = Math.max(0, FISHING.dist).toFixed(0) + ' m';
}
function updateFishing(dt) {
  const F = FISHING, using = input.use;
  if (!F.vm) return;
  updateLeap(dt);
  const active = TOOL.cur === 'rod' && (P.mode === 'walk' || P.mode === 'boat' || P.mode === 'swim' || P.mode === 'seat');
  if (!active) { if (F.state !== 'idle') reelIn(); return; }
  const tip = rodTipWorld(F.rodTip);
  F.t += dt;
  if (F.state === 'idle') { if (input.usePressed) startCast(); }
  else if (F.state === 'casting') {
    F.power = Math.min(1, F.power + dt * 0.8);
    setTension(F.power); $('tension-dist').textContent = 'Cast ' + Math.round(F.power * 100) + '%';
    if (!using) { setTension(-1); releaseCast(); }
  } else if (F.state === 'flying') {
    F.bobVel.y -= 9.8 * dt; F.bobPos.addScaledVector(F.bobVel, dt);
    const lv = waterAt(F.bobPos.x, F.bobPos.z).level, g = groundHeight(F.bobPos.x, F.bobPos.z);
    if (F.bobPos.y <= Math.max(lv, g)) { F.bobPos.y = Math.max(lv, g); if (lv > g + 0.1) landBobber(); else { fishHint('It landed on the sand', 1.8); reelIn(); } }
    if (input.usePressed && F.t > 0.3) reelIn();
  } else if (F.state === 'waiting' || F.state === 'bite') {
    const w = waterAt(F.bobPos.x, F.bobPos.z);
    F.bobPos.y = w.level + 0.01;
    F.bobPos.x += (w.fx || 0) * dt * 0.5; F.bobPos.z += (w.fz || 0) * dt * 0.5; // the current carries it
    if (F.state === 'waiting') {
      F.biteT -= dt;
      if (F.biteT < 2.5 && rng() < dt * 1.5) { F.nibble = 0.25; rippleDrop(F.bobPos.x, F.bobPos.z, 0.15, 0.06, 0); if (AUDIO.nibble) AUDIO.nibble(); }
      if (F.biteT <= 0) { F.state = 'bite'; F.t = 0; rippleDrop(F.bobPos.x, F.bobPos.z, 0.3, 0.3, 0.3); if (AUDIO.bite) AUDIO.bite(); fishHint(isTouch ? 'Bite! Tap Reel now!' : 'Bite! Click now!', 0); }
      if (input.usePressed) { fishHint('Reeled in', 1.2); reelIn(); }
    } else {
      F.nibble = 0.5 + Math.sin(F.t * 30) * 0.2;
      if (input.usePressed) hookFish();
      else if (F.t > 1.1) { fishHint('Too slow, it got away', 2.2); F.state = 'waiting'; F.biteT = rand(4, 10); }
    }
    F.nibble = Math.max(0, F.nibble - dt * 2);
  } else if (F.state === 'fighting') {
    const f = F.fish;
    // the fish runs, rests and turns; reeling while it runs strains the line
    F.run -= dt;
    if (F.run <= 0) { F.running = rng() < 0.35 + f.pow * 0.4 && F.stamina > 0.15; F.run = F.running ? rand(1, 2.5 + f.pow * 2.5) : rand(0.8, 2.5); F.runDir += rand(-1.5, 1.5); }
    const pull = F.running ? (0.35 + f.pow * 0.9) * (0.4 + 0.6 * F.stamina) : 0.08 + f.pow * 0.12;
    const reel = using ? 1 : 0;
    F.tension += ((reel ? 0.55 : -0.42) + (F.running ? pull * 0.9 : -0.05) - (reel ? 0 : pull * 0.15)) * dt * 1.4;
    F.tension = clamp(F.tension, 0, 1.2);
    // distance: reeling pulls it in, running takes line out
    const reelSpeed = 5.5 * (1 - f.pow * 0.5);
    F.dist += ((F.running ? pull * 3.2 * (0.5 + f.pow) : 0.15) - reel * reelSpeed * (F.tension < 0.95 ? 1 : 0.2)) * dt;
    F.stamina = Math.max(0, F.stamina - dt * (reel ? 0.06 : 0.02) * (F.tension > 0.6 ? 1.6 : 1) / (0.4 + f.pow));
    if (F.tension >= 1.0) F.overT = (F.overT || 0) + dt; else F.overT = 0;
    if (F.overT > 0.7) return loseFish('The line snapped!');
    if (F.tension <= 0.02 && !F.running) F.slackT = (F.slackT || 0) + dt; else F.slackT = 0;
    if (F.slackT > 2.4) return loseFish('The line went slack and it shook the hook');
    if (F.dist > 75) return loseFish('It ran out all your line');
    // move the bobber/fish along the dist, swimming side to side
    const dx = F.bobPos.x - tip.x, dz = F.bobPos.z - tip.z, d = Math.hypot(dx, dz) || 1;
    const tx = tip.x + (dx / d) * Math.max(F.dist, 0.5) + Math.cos(F.runDir) * dt * (F.running ? 2 : 0.3), tz = tip.z + (dz / d) * Math.max(F.dist, 0.5) + Math.sin(F.runDir) * dt * (F.running ? 2 : 0.3);
    if (habitatAt(tx, tz)) { F.bobPos.x = tx; F.bobPos.z = tz; }
    F.bobPos.y = waterAt(F.bobPos.x, F.bobPos.z).level - (F.running ? 0.25 : 0.05);
    if (F.running && rng() < dt * 2.5) splashAt(F.bobPos.x, F.bobPos.y + 0.25, F.bobPos.z, 0.2 + f.pow * 0.45, { foam: 0.25 });
    if (rng() < dt * 0.5 * f.pow && F.running && !F.leap && f.shape !== 'ray' && f.shape !== 'octo' && f.shape !== 'lobster' && f.shape !== 'boot') startLeap(f); // jumps clear of the water
    if (AUDIO.reelZip) AUDIO.reelZip(F.running ? 0.6 + pull * 0.4 : 0);
    if (AUDIO.reelClick) AUDIO.reelClick(reel);
    P.shake = Math.max(P.shake || 0, F.tension > 0.8 ? 0.15 : 0);
    setTension(F.tension);
    if (F.dist < 1.6) landFish();
  }
  input.usePressed = false;
  // draw the line and the bobber
  const B = F.bobber, Lm = F.line;
  const showBob = F.state === 'flying' || F.state === 'waiting' || F.state === 'bite' || F.state === 'fighting';
  B.visible = showBob && F.state !== 'fighting'; Lm.visible = showBob;
  if (showBob) {
    B.position.copy(F.bobPos); B.position.y -= F.nibble * 0.06; B.rotation.z = Math.sin(U.uTime.value * 2) * 0.1;
    const pa = Lm.geometry.attributes.position.array, n = 32;
    const sag = F.state === 'fighting' ? (1 - F.tension) * 0.6 : F.state === 'flying' ? 0.2 : 0.9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pa[i * 3] = lerp(tip.x, F.bobPos.x, t); pa[i * 3 + 2] = lerp(tip.z, F.bobPos.z, t);
      pa[i * 3 + 1] = lerp(tip.y, F.bobPos.y + 0.04, t) - Math.sin(t * Math.PI) * sag * Math.min(1, Math.hypot(F.bobPos.x - tip.x, F.bobPos.z - tip.z) / 10);
    }
    Lm.geometry.attributes.position.needsUpdate = true;
  }
  // the fish's shadow under the water while you fight it
  const S = F.shadow;
  S.visible = F.state === 'fighting' && !F.fish.junk;
  if (S.visible) {
    const sc = 0.4 + Math.cbrt(F.fish.weight) * 0.32;
    S.scale.set(sc, 1, sc); S.position.set(F.bobPos.x, waterAt(F.bobPos.x, F.bobPos.z).level - 0.02, F.bobPos.z);
    S.rotation.y = Math.atan2(F.bobPos.x - tip.x, F.bobPos.z - tip.z) + Math.PI / 2;
    S.material.opacity = 0.35;
  }
}
// the rod in your hands: it bends with the tension and whips forward when you cast
function poseRod(dt, sway, bob) {
  const v = FISHING.vm; if (!v) return;
  const F = FISHING;
  const castBack = F.state === 'casting' ? F.power : 0;
  const whip = F.state === 'flying' ? Math.max(0, 1 - F.t * 3) : 0;
  const bend = F.state === 'fighting' ? F.tension : F.state === 'bite' ? 0.35 : F.nibble * 0.4;
  v.rod.position.set(0.22 + sway, -0.42 + bob, -0.5);
  v.rod.rotation.set(-0.55 - castBack * 1.1 + whip * 0.9 - bend * 0.35, 0.05, -0.08);
  for (let i = 0; i < v.segs.length; i++) v.segs[i].rotation.x = -(bend * 0.12 + castBack * 0.04 - whip * 0.05) * (i / v.segs.length + 0.3);
  v.handle.parent.rotation.x += (F.state === 'fighting' && input.use ? 18 : 0) * dt;
  // the rod is pulled toward where the fish is running
  if (F.state === 'fighting' && F.bobPos) { const a = Math.atan2(-(F.bobPos.x - camera.position.x), -(F.bobPos.z - camera.position.z)); let d = a - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); v.rod.rotation.y = clamp(d, -0.6, 0.6) * F.tension; }
  // the line from the reel up through the guides
  const pa = v.rodLine.geometry.attributes.position.array; v.rod.updateMatrixWorld(true);
  const tmp = new THREE.Vector3();
  v.reel.getWorldPosition(tmp); TOOL.vm.grp.worldToLocal(tmp); pa.set([tmp.x, tmp.y, tmp.z], 0);
  for (let i = 0; i < v.segs.length && i < 8; i++) { v.segs[i].getWorldPosition(tmp); tmp.add(_heldOff.set(0, 0, 0.012).applyQuaternion(camera.quaternion)); TOOL.vm.grp.worldToLocal(tmp); pa.set([tmp.x, tmp.y, tmp.z], (i + 1) * 3); }
  v.tip.getWorldPosition(tmp); TOOL.vm.grp.worldToLocal(tmp); pa.set([tmp.x, tmp.y, tmp.z], 27);
  v.rodLine.geometry.attributes.position.needsUpdate = true;
  v.rodLine.visible = v.rod.visible;
  // holding up your catch
  const H = FISHING.held;
  if (H && H.visible) {
    FISHING.holdT -= dt;
    const k = Math.min(1, (3.4 - FISHING.holdT) * 3), out = FISHING.holdT < 0.4 ? FISHING.holdT / 0.4 : 1;
    H.position.set(0.02, -0.22 - (1 - k) * 0.4 - (1 - out) * 0.5, -0.62);
    H.rotation.set(0.15, Math.PI / 2 + 0.35 + Math.sin(U.uTime.value * 1.3) * 0.08, Math.sin(U.uTime.value * 9) * 0.18 * Math.max(0, FISHING.holdT - 1.5) / 1.9);
    v.rod.position.y -= 0.35 * k * out;
    if (FISHING.holdT <= 0) { H.visible = false; while (H.children.length) H.remove(H.children[0]); }
  }
}
const _heldOff = new THREE.Vector3();
// a 3-D model of a catch, from the same shapes the journal draws
function fishModel(f, len) {
  const col = new THREE.Color(f.col);
  const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.38, metalness: 0.15 });
  const g = new THREE.Group();
  if (f.shape === 'boot') { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), m); const t = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.26), m); t.position.set(0, -0.09, 0.07); g.add(b, t); return g; }
  if (f.shape === 'octo') { const h = new THREE.Mesh(new THREE.SphereGeometry(len * 0.25, 14, 10).scale(1, 1.2, 1), m); g.add(h); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.025, len * 0.8, 6).translate(0, -len * 0.4, 0), m); arm.position.set(Math.cos(a) * len * 0.1, -len * 0.1, Math.sin(a) * len * 0.1); arm.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); g.add(arm); } return g; }
  if (f.shape === 'ray') { const r = new THREE.Mesh(new THREE.SphereGeometry(len * 0.5, 16, 6).scale(1, 0.12, 0.8), m); g.add(r); return g; }
  const geo = f.shape === 'shark' || f.shape === 'hammer' ? sharkGeo(len, f.shape === 'hammer') : f.shape === 'tuna' || f.shape === 'mahi' || f.shape === 'bill' ? dolphinGeo(len) : loftBody(len, t => len * ({ deep: 0.22, bass: 0.15, slim: 0.07, torpedo: 0.1, cat: 0.11, eel: 0.04, lobster: 0.06 }[f.shape] || 0.12) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.03 + 0.03)), 0.7), 18, 12, f.shape === 'deep' ? 0.45 : 0.8);
  const body = new THREE.Mesh(geo, m); body.position.z = -len * 0.5; g.add(body);
  if (!['shark', 'hammer', 'tuna', 'mahi', 'bill'].includes(f.shape)) { const tail = new THREE.Mesh(new THREE.ConeGeometry(len * 0.12, len * 0.2, 4).rotateX(-Math.PI / 2).scale(0.15, 1, 1), m); tail.position.z = len * 0.55; g.add(tail); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(len * 0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.1 }));
  for (const s of [-1, 1]) { const e = eye.clone(); e.position.set(s * len * 0.06, len * 0.03, -len * 0.42); g.add(e); }
  return g;
}
function showHeldFish(f) {
  const H = FISHING.held; if (!H) return;
  while (H.children.length) H.remove(H.children[0]);
  const len = f.junk ? 0.3 : clamp(0.25 + Math.cbrt(f.weight) * 0.12, 0.25, 0.9);   // the biggest ones are only shown at arm's length
  H.add(fishModel(f, len));
  H.visible = true; FISHING.holdT = 3.4;
}
// a fish leaping clear of the water during the fight
function startLeap(f) {
  const F = FISHING;
  if (!F.leapMesh) { F.leapMesh = new THREE.Group(); scene.add(F.leapMesh); }
  while (F.leapMesh.children.length) F.leapMesh.remove(F.leapMesh.children[0]);
  const len = clamp(0.3 + Math.cbrt(f.weight) * 0.22, 0.3, 3.5);
  F.leapMesh.add(fishModel(f, len));
  F.leap = { t: 0, x: F.bobPos.x, z: F.bobPos.z, y0: waterAt(F.bobPos.x, F.bobPos.z).level, h: 0.6 + f.pow * 1.4, dir: F.runDir, len };
  splashAt(F.leap.x, F.leap.y0, F.leap.z, 0.6 + f.pow * 0.6);
}
function updateLeap(dt) {
  const F = FISHING, L = F.leap; if (!L) return;
  L.t += dt / 0.9;
  const k = Math.min(1, L.t);
  F.leapMesh.visible = true;
  F.leapMesh.position.set(L.x + Math.cos(L.dir) * k * 1.5, L.y0 + Math.sin(k * Math.PI) * L.h, L.z + Math.sin(L.dir) * k * 1.5);
  F.leapMesh.rotation.set(-Math.cos(k * Math.PI) * 0.9, -L.dir + Math.PI / 2, Math.sin(U.uTime.value * 18) * 0.25);
  if (L.t >= 1) { splashAt(F.leapMesh.position.x, L.y0, F.leapMesh.position.z, 0.8 + L.len * 0.3); if (AUDIO.splash) AUDIO.splash(0.5); F.leap = null; F.leapMesh.visible = false; }
}

// ---- the journal: every fish there is, the ones you've caught, and your biggest of each ----
function buildJournal() {
  const grid = $('j-grid'); if (!grid) return;
  grid.innerHTML = '';
  let caught = 0;
  for (const f of FISH) {
    const j = FISHING.journal[f.id], has = !!j;
    if (has) caught++;
    const card = document.createElement('div'); card.className = 'fcard' + (has ? '' : ' unknown') + ' r' + f.rar;
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 64; drawFish(cv.getContext('2d'), f, has);
    const nm = document.createElement('div'); nm.className = 'fname'; nm.textContent = has ? f.name : '???';
    const meta = document.createElement('div'); meta.className = 'fmeta';
    const where = { s: 'Shallows', d: 'Open sea', r: 'Reef', f: 'River', p: 'Falls pool' };
    meta.textContent = has ? `${j.n} caught · best ${j.best < 10 ? j.best.toFixed(2) : j.best.toFixed(1)} kg` : `${RARITY[f.rar]} · ${[...new Set(f.hab.split(''))].map(h => where[h]).join(', ')}${f.tm === 'n' ? ' · night' : f.tm === 'd' ? ' · day' : ''}`;
    card.append(cv, nm, meta); grid.appendChild(card);
  }
  $('j-count').textContent = `${caught} of ${FISH.length} caught`;
}
function drawFish(g, f, known) {
  const W = 120, H = 64;
  g.clearRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H / 2);
  g.fillStyle = known ? f.col : 'rgba(255,255,255,0.12)';
  g.strokeStyle = known ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5;
  const body = (len, ht) => { g.beginPath(); g.ellipse(0, 0, len, ht, 0, 0, TAU); g.fill(); g.stroke(); };
  const tail = (x, h) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 14, -h); g.lineTo(x + 10, 0); g.lineTo(x + 14, h); g.closePath(); g.fill(); g.stroke(); };
  const sh = f.shape;
  if (sh === 'ray') { g.beginPath(); g.moveTo(-30, 0); g.quadraticCurveTo(0, -30, 26, 0); g.quadraticCurveTo(0, 30, -30, 0); g.fill(); g.stroke(); g.beginPath(); g.moveTo(24, 0); g.lineTo(52, 3); g.stroke(); }
  else if (sh === 'eel') { g.lineWidth = 9; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(-44, 4); g.bezierCurveTo(-20, -14, 10, 16, 44, -4); g.stroke(); }
  else if (sh === 'octo') { body(16, 14); for (let i = 0; i < 6; i++) { g.lineWidth = 3; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(-6 + i * 3, 10); g.quadraticCurveTo(-14 + i * 6, 24, -20 + i * 8, 28); g.stroke(); } }
  else if (sh === 'lobster') { body(26, 8); g.beginPath(); g.moveTo(-26, -4); g.lineTo(-48, -18); g.moveTo(-26, 4); g.lineTo(-48, 18); g.stroke(); tail(22, 9); }
  else if (sh === 'boot') { g.fillRect(-22, -20, 18, 34); g.fillRect(-22, 6, 44, 10); }
  else {
    const dims = { slim: [42, 8], torpedo: [38, 11], deep: [26, 18], bass: [32, 14], tuna: [36, 15], mahi: [38, 13], bill: [36, 11], shark: [44, 12], hammer: [44, 12], cat: [36, 11] }[sh] || [32, 12];
    tail(dims[0] - 4, dims[1]);
    body(dims[0], dims[1]);
    if (sh === 'bill') { g.beginPath(); g.moveTo(-dims[0], -1); g.lineTo(-dims[0] - 18, 0); g.lineTo(-dims[0], 2); g.fill(); g.beginPath(); g.moveTo(-14, -9); g.quadraticCurveTo(0, -30, 16, -10); g.fill(); g.stroke(); }
    if (sh === 'shark' || sh === 'hammer') { g.beginPath(); g.moveTo(-4, -11); g.lineTo(6, -26); g.lineTo(12, -10); g.fill(); g.stroke(); }
    if (sh === 'hammer') { g.fillRect(-dims[0] - 6, -12, 8, 24); }
    if (sh === 'mahi') { g.beginPath(); g.moveTo(-30, -10); g.quadraticCurveTo(0, -20, 30, -6); g.lineTo(-30, -6); g.fill(); }
    if (sh === 'cat') { g.beginPath(); g.moveTo(-36, 2); g.lineTo(-48, 10); g.moveTo(-36, 0); g.lineTo(-50, -6); g.stroke(); }
    if (known) { g.fillStyle = '#111'; g.beginPath(); g.arc(-dims[0] + 8, -3, 2, 0, TAU); g.fill(); }
  }
  g.restore();
}
function showCatchCard(f, first, record) {
  const el = $('catch'); if (!el) return;
  drawFish($('catch-cv').getContext('2d'), f, true);
  $('catch-name').textContent = f.name;
  $('catch-w').textContent = f.junk ? '' : `${f.weight < 10 ? f.weight.toFixed(2) : f.weight.toFixed(1)} kg · ${RARITY[f.rar]}`;
  $('catch-tag').textContent = first ? 'New to your journal' : record ? 'Your biggest yet' : '';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function toggleJournal(force) {
  const el = $('journal'); if (!el) return;
  const open = force ?? el.hidden;
  if (open) { buildJournal(); if (document.pointerLockElement) document.exitPointerLock(); }
  el.hidden = !open;
  if (!open && !isTouch && started && !panelOpen) lockPointer();
}
