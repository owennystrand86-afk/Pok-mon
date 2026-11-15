// ───────────────────── 16d. The submarine ─────────────────────
// A 36-metre black submarine lies at the end of a floating walkway off the dock. Climb onto its deck,
// up the sail and down through the hatch into the control room: a camera screen showing the view from
// the bow, a sonar screen, a radar screen of everything around you, and a big brass pressure gauge.
// V switches between the control room, the bow camera and a view from outside. X sonar, R radar,
// L lights. The hull is rated to 1200 m and gives way past 1450; the Abyss, south-west, goes deeper.
const SUB = {
  mesh: null, home: null, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, vy: 0, hull: 1, lights: true, sonar: false, radar: true,
  creakT: 0, beepT: 0, pingT: 0, state: 'moored', parts: {}, view: 'inside', board: null, L: 36, R: 3.1,
};
const SUB_RATED = 1200, SUB_CRUSH = 1450, HATCH_SAFE = 40;
const SUB_SEAT = new THREE.Vector3(0, 0.55, -6.2), SUB_HATCH = new THREE.Vector3(0, 3.1 + 4.9, -5.2), SUB_BOW = new THREE.Vector3(0, 0.2, -18.6);
const TRENCH = { x: -800, w0: 55, w1: 175, depth: 480 };
// the trench: a canyon running north–south off the west coast, cut into the sea floor
function trenchDepth(x, z) {
  const d = Math.abs(x - TRENCH.x + 18 * Math.sin(z * 0.006) + 9 * Math.sin(z * 0.017));
  if (d > TRENCH.w1) return 0;
  const along = 1 - smoothstep(560, 880, Math.abs(z));
  const k = 1 - smoothstep(TRENCH.w0, TRENCH.w1, d);
  const terr = Noise.fbm(x * 0.02, z * 0.02, 3) * 0.12;
  return Math.pow(k, 1.6) * (TRENCH.depth - 46) * along * (0.9 + terr);
}
function carveTrench() {
  const n = T.n, c = T.cell;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = T.min + i * c, z = T.min + j * c, k = j * n + i;
    if (Math.abs(x - TRENCH.x) > TRENCH.w1 + 40) continue;
    const td = trenchDepth(x, z);
    if (td > 0 && T.h[k] < -8) T.h[k] = Math.min(T.h[k], -46 - td + Math.max(0, T.h[k] + 46) * (1 - smoothstep(0, 30, td)));
  }
}

// the hull's skin: anechoic tiles over black, dark red below the waterline
const SUB_SKIN = {
  vHead: 'varying vec3 vLoc;', vBegin: 'vLoc = position;', fHead: 'varying vec3 vLoc;',
  fColor: `{ vec2 g = abs(fract(vec2(vLoc.z * 1.1, atan(vLoc.x, vLoc.y) * 3.1)) - 0.5); float line = smoothstep(0.47, 0.5, max(g.x, g.y));
    vec3 c = mix(vec3(0.035, 0.038, 0.042), vec3(0.2, 0.035, 0.03), smoothstep(-1.2, -1.6, vLoc.y) * step(abs(vLoc.z), 15.0));
    c *= 0.88 + 0.2 * texture2D(uNoiseTex, vLoc.xz * 0.15 + vLoc.y * 0.05).r; c *= 1.0 - line * 0.35; diffuseColor.rgb = c; }`,
};
function subGeometry() {
  const g = new THREE.Group(), L = SUB.L, R = SUB.R;
  const skin = patch(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.78, metalness: 0.15 }), { key: 'sub-skin', ...SUB_SKIN });
  const black = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.04, 0.042, 0.046, THREE.SRGBColorSpace), roughness: 0.7, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.3, metalness: 0.9 });
  const bronze = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.55, 0.38, 0.18, THREE.SRGBColorSpace), roughness: 0.3, metalness: 0.95 });
  // the pressure hull: a long body of revolution, round at the bow, tapering to the stern
  const prof = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, z = -L / 2 + t * L;
    let r;
    if (z < -L / 2 + 6) { const u = (z + L / 2) / 6; r = R * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))); }
    else if (z < L / 2 - 12) r = R;
    else { const u = (z - (L / 2 - 12)) / 12; r = R * (1 - u * u * 0.82) - u * 0.1; }
    prof.push(new THREE.Vector2(Math.max(r, 0.02), z));
  }
  // the lathe turns round y; tip it so the axis runs along z, bow at -z
  const hullG = new THREE.LatheGeometry(prof, 40); hullG.rotateX(Math.PI / 2); hullG.computeVertexNormals();
  const hull = new THREE.Mesh(hullG, skin); hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
  // a flat walking deck along the top
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 24), black); deck.position.set(0, R - 0.05, -2); g.add(deck);
  // the sail, with its fairwater planes, masts and the hatch on top
  const sailShape = new THREE.Shape(); { const w = 0.85, l = 3.6; sailShape.moveTo(-w, -l + 1); sailShape.quadraticCurveTo(-w, -l - 0.3, 0, -l - 0.4); sailShape.quadraticCurveTo(w, -l - 0.3, w, -l + 1); sailShape.lineTo(w * 0.8, l); sailShape.quadraticCurveTo(0, l + 0.5, -w * 0.8, l); sailShape.lineTo(-w, -l + 1); }
  const sailG = new THREE.ExtrudeGeometry(sailShape, { depth: 4.9, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3 });
  sailG.rotateX(-Math.PI / 2); sailG.rotateY(Math.PI); const sail = new THREE.Mesh(sailG, skin); sail.position.set(0, R - 0.3, -5.2); sail.castShadow = true; g.add(sail);
  for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.3), black); pl.position.set(s * 2.0, R + 2.9, -6.6); g.add(pl); }
  for (const [x, h, z] of [[0.25, 2.2, -4.4], [-0.25, 1.6, -3.9], [0, 1.2, -3.3]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, h, 10), black); m.position.set(x, R + 4.7 + h / 2, z); g.add(m); }
  const hatchRim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.5, 0.12, 20), black); hatchRim.position.set(0, R + 4.85, -5.2); g.add(hatchRim);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, R + 4.92, -5.65); g.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 20), steel); lid.position.set(0, 0, 0.45); lidPivot.add(lid);
  // the stern: cruciform rudders and planes, and a big skewed propeller
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 3.2), skin), a = k * Math.PI / 2;
    fin.position.set(Math.sin(a) * 1.7, Math.cos(a) * 1.7, L / 2 - 3.6); fin.rotation.z = -a; fin.castShadow = true; g.add(fin);
  }
  const prop = new THREE.Group(); prop.position.set(0, 0, L / 2 + 0.25);
  for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.25, 0.06).translate(0, 0.72, 0), bronze); b.rotation.y = 0.55; const h = new THREE.Group(); h.rotation.z = k / 7 * TAU; h.add(b); prop.add(h); }
  prop.add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 16).rotateX(Math.PI / 2), bronze));
  g.add(prop);
  // searchlights under the bow and a light on the sail
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.25, 14).rotateX(Math.PI / 2), black); l.position.set(s * 1.0, -1.6, -L / 2 + 3.2); g.add(l); const lens = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d8 })); lens.position.set(s * 1.0, -1.6, -L / 2 + 3.06); lens.rotation.y = Math.PI; g.add(lens); }
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 })); mastLight.position.set(0, R + 7.0, -4.4); g.add(mastLight);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uOn: { value: 1 } },
    vertexShader: 'varying float vT; void main(){ vT = -position.y / 40.0 + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${COMMON} uniform float uOn; varying float vT; void main(){ float a = (1.0 - vT) * 0.05 * uOn * uUnderwater; gl_FragColor = vec4(outCol(vec3(0.9, 0.95, 0.85)) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const beams = [];
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.ConeGeometry(7, 40, 20, 1, true).translate(0, -20, 0).rotateX(-Math.PI / 2 - 0.1).rotateY(-s * 0.05), beamMat); b.position.set(s * 1.0, -1.6, -L / 2 + 3.0); b.renderOrder = 9; g.add(b); beams.push(b); }
  // the shaft down from the hatch, and the control room
  const interior = subInterior(); g.add(interior);
  SUB.parts = { prop, mastLight, beams, beamMat, lidPivot, interior };
  return g;
}
// ---- inside: the control room ----
function screenTex(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return { cv, t, g: cv.getContext('2d') }; }
function subInterior() {
  const g = new THREE.Group();
  const P = [];
  const add = (geo, c, x, y, z, rx = 0, ry = 0, rz = 0) => P.push(part(geo, c, x, y, z, rx, ry, rz, 0.03));
  // a curved hull lining with ribs, deck plates, bulkheads at either end
  const lining = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 9, 28, 1, true).rotateX(Math.PI / 2), patch(new THREE.MeshStandardMaterial({ color: 0x55605f, roughness: 0.7, metalness: 0.3, side: THREE.BackSide }), { key: 'sub-lining', fLight: 'outgoingLight += diffuseColor.rgb * vec3(0.4, 0.55, 0.6) * 0.35;' }));
  lining.position.set(0, 0.6, -5.5); g.add(lining);
  for (let z = -9.6; z <= -1.4; z += 1.0) add(new THREE.TorusGeometry(2.4, 0.06, 4, 28), [0.32, 0.36, 0.36], 0, 0.6, z);
  add(new THREE.BoxGeometry(3.6, 0.1, 9), [0.22, 0.24, 0.24], 0, -1.15, -5.5);
  for (const z of [-10.0, -1.0]) add(new THREE.CylinderGeometry(2.46, 2.46, 0.1, 28).rotateX(Math.PI / 2), [0.4, 0.44, 0.44], 0, 0.6, z);
  // the ladder up into the sail
  for (const s of [-0.28, 0.28]) add(new THREE.BoxGeometry(0.05, 6.5, 0.05), [0.6, 0.6, 0.6], s, 4.2, -5.2);
  for (let y = 1.4; y < 7.2; y += 0.35) add(new THREE.BoxGeometry(0.56, 0.035, 0.04), [0.6, 0.6, 0.6], 0, y, -5.2);
  add(new THREE.CylinderGeometry(0.55, 0.55, 5.6, 16, 1, true), [0.3, 0.32, 0.32], 0, 4.6, -5.2);
  // the pilot's seat and the console in front of it
  add(new THREE.BoxGeometry(0.6, 0.1, 0.6), [0.12, 0.12, 0.14], 0, -0.55, -5.9); add(new THREE.BoxGeometry(0.6, 0.7, 0.1), [0.12, 0.12, 0.14], 0, -0.2, -5.6);
  add(new THREE.BoxGeometry(3.2, 0.9, 0.7), [0.28, 0.31, 0.32], 0, -0.7, -8.0); add(new THREE.BoxGeometry(3.2, 0.06, 0.8), [0.12, 0.13, 0.14], 0, -0.24, -7.85, 0.3);
  add(new THREE.BoxGeometry(3.4, 1.7, 0.12), [0.18, 0.2, 0.21], 0, 0.85, -8.55);
  add(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12).rotateX(Math.PI / 2), [0.3, 0.3, 0.32], 0, -0.1, -7.5);   // control yoke
  add(new THREE.BoxGeometry(0.7, 0.05, 0.08), [0.15, 0.15, 0.16], 0, -0.1, -7.35);
  for (let k = 0; k < 12; k++) add(new THREE.BoxGeometry(0.07, 0.03, 0.07), k % 3 ? [0.2, 0.75, 0.4] : [0.9, 0.3, 0.2], -1.2 + (k % 6) * 0.14, -0.2, -8.0 + Math.floor(k / 6) * 0.12);
  const body = new THREE.Mesh(mergeGeos(P), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }), { key: 'sub-int', fLight: 'outgoingLight += diffuseColor.rgb * vec3(0.5, 0.6, 0.65) * 0.3;' }));
  g.add(body);
  // the screens: camera, sonar, radar; a depth readout; the pressure gauge
  const cam = new THREE.WebGLRenderTarget(384, 216, { type: THREE.HalfFloatType });
  const mk = (w, h, tex, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.set(x, y, z); g.add(m); return m; };
  const camScr = mk(1.35, 0.76, cam.texture, 0, 1.15, -8.48);
  const sonar = screenTex(256, 256), radar = screenTex(256, 256), depth = screenTex(256, 64);
  mk(0.72, 0.72, sonar.t, -1.18, 0.95, -8.48); mk(0.72, 0.72, radar.t, 1.18, 0.95, -8.48); mk(1.1, 0.27, depth.t, 0, 0.42, -8.48);
  // the gauge: a brass ring, a dial face and a needle
  const face = screenTex(256, 256); drawGaugeFace(face);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.7, 0.5, 0.22, THREE.SRGBColorSpace), metalness: 0.95, roughness: 0.25 }));
  ring.position.set(-1.25, 0.1, -8.5); ring.rotation.set(0.2, 0, 0); g.add(ring);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), new THREE.MeshBasicMaterial({ map: face.t, toneMapped: false })); dial.position.set(-1.25, 0.1, -8.49); dial.rotation.set(0.2, 0, 0); g.add(dial);
  const needle = new THREE.Group(); needle.position.set(-1.25, 0.1, -8.47); needle.rotation.x = 0.2; g.add(needle);
  needle.add(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.27, 0.008).translate(0, 0.12, 0), new THREE.MeshBasicMaterial({ color: 0xd8261b }))); needle.add(new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: 0x222222 })));
  // a little red light for the hull alarm
  const alarm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x441010 })); alarm.position.set(1.25, 0.15, -8.45); g.add(alarm);
  SUB.scr = { cam, camScr, sonar, radar, depth, needle, alarm, t: 0 };
  g.visible = false;
  return g;
}
function drawGaugeFace(f) {
  const g = f.g; g.fillStyle = '#f2ead6'; g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  for (let v = 0; v <= 160; v += 5) {
    const a = (-135 + v / 160 * 270) * Math.PI / 180, big = v % 20 === 0;
    g.strokeStyle = v >= 145 ? '#c0281c' : v >= 121 ? '#d98a1c' : '#222'; g.lineWidth = big ? 4 : 2;
    g.beginPath(); g.moveTo(Math.sin(a) * (big ? 92 : 100), -Math.cos(a) * (big ? 92 : 100)); g.lineTo(Math.sin(a) * 112, -Math.cos(a) * 112); g.stroke();
    if (big) { g.fillStyle = '#222'; g.font = 'bold 17px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), Math.sin(a) * 74, -Math.cos(a) * 74); }
  }
  g.fillStyle = '#333'; g.font = 'italic 15px Georgia'; g.textAlign = 'center'; g.fillText('PRESSURE', 0, 38); g.fillText('atm', 0, 56);
  g.setTransform(1, 0, 0, 1, 0, 0); f.t.needsUpdate = true;
}
const _subv = new THREE.Vector3(), _subq = new THREE.Quaternion(), _sube = new THREE.Euler();
function subToWorld(v, out = _subv) { SUB.mesh.updateMatrixWorld(); return out.copy(v).applyMatrix4(SUB.mesh.matrixWorld); }
// ---- the screens, redrawn several times a second ----
function drawSonar() {
  const s = SUB.scr.sonar, g = s.g, W = 256, t = U.uTime.value;
  g.fillStyle = '#021410'; g.fillRect(0, 0, W, W);
  if (!SUB.sonar) { g.fillStyle = '#1f6b52'; g.font = '16px monospace'; g.textAlign = 'center'; g.fillText('SONAR STANDBY', 128, 128); g.fillText('press X', 128, 150); s.t.needsUpdate = true; return; }
  // a fan ahead of the bow: returns from the sea floor and whatever swims there
  const cx = 128, cy = 236, range = 240, sweep = ((t * 0.6) % 1) * 2 - 1;
  const fx = -Math.sin(SUB.yaw), fz = -Math.cos(SUB.yaw), rx = Math.cos(SUB.yaw), rz = -Math.sin(SUB.yaw);
  for (let a = -55; a <= 55; a += 3) for (let r = 6; r < range; r += 6) {
    const ang = a * Math.PI / 180, wx = SUB.x + (fx * Math.cos(ang) + rx * Math.sin(ang)) * r, wz = SUB.z + (fz * Math.cos(ang) + rz * Math.sin(ang)) * r;
    const gh = groundHeight(wx, wz), close = smoothstep(18, 0, Math.abs(gh - SUB.y)), wall = gh > SUB.y - 3 ? 1 : 0;
    const v = Math.max(close * 0.6, wall * 0.9) * (0.75 + 0.25 * Math.sin(r * 0.3 + t));
    if (v < 0.05) continue;
    const px = cx + Math.sin(ang) * r / range * 220, py = cy - Math.cos(ang) * r / range * 220;
    g.fillStyle = `rgba(80,255,170,${v * 0.8})`; g.fillRect(px - 2.5, py - 2.5, 5, 5);
  }
  for (const an of ANIMALS.list) { const dx = an.x - SUB.x, dz = an.z - SUB.z, f = dx * fx + dz * fz, sd = dx * rx + dz * rz, r = Math.hypot(dx, dz); if (f <= 0 || r > range || Math.abs(Math.atan2(sd, f)) > 1) continue; g.fillStyle = '#e8fff4'; g.beginPath(); g.arc(cx + sd / range * 220, cy - f / range * 220, 3.5, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(80,255,170,0.5)'; g.lineWidth = 1;
  for (const r of [60, 120, 180, 240]) { g.beginPath(); g.arc(cx, cy, r / range * 220, -Math.PI / 2 - 0.96, -Math.PI / 2 + 0.96); g.stroke(); }
  g.strokeStyle = 'rgba(160,255,210,0.9)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(sweep * 0.96) * 220, cy - Math.cos(sweep * 0.96) * 220); g.stroke();
  g.fillStyle = '#7fe0b8'; g.font = '12px monospace'; g.textAlign = 'left'; g.fillText('SONAR 240 m', 6, 14);
  s.t.needsUpdate = true;
}
function drawRadar() {
  const s = SUB.scr.radar, g = s.g, W = 256, t = U.uTime.value, range = 400;
  g.fillStyle = '#020c14'; g.fillRect(0, 0, W, W);
  if (!SUB.radar) { g.fillStyle = '#2a5f80'; g.font = '16px monospace'; g.textAlign = 'center'; g.fillText('RADAR OFF', 128, 128); g.fillText('press R', 128, 150); s.t.needsUpdate = true; return; }
  const cx = 128, cy = 128, sc = 118 / range, fx = -Math.sin(SUB.yaw), fz = -Math.cos(SUB.yaw), rx = Math.cos(SUB.yaw), rz = -Math.sin(SUB.yaw);
  // land and shallows around you, heading up
  for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
    if (i * i + j * j > 144) continue;
    const f = -j * range / 12, sd = i * range / 12, wx = SUB.x + fx * f + rx * sd, wz = SUB.z + fz * f + rz * sd, h = groundHeight(wx, wz);
    g.fillStyle = h > 0 ? 'rgba(120,220,140,0.7)' : h > -12 ? 'rgba(60,150,190,0.45)' : h > -80 ? 'rgba(30,80,120,0.35)' : 'rgba(10,30,60,0.3)';
    g.fillRect(cx + i * 118 / 12 - 5, cy + j * 118 / 12 - 5, 10, 10);
  }
  const blip = (x, z, col, r = 3) => { const dx = x - SUB.x, dz = z - SUB.z, f = dx * fx + dz * fz, sd = dx * rx + dz * rz; if (Math.hypot(f, sd) > range) return; g.fillStyle = col; g.beginPath(); g.arc(cx + sd * sc, cy - f * sc, r, 0, TAU); g.fill(); };
  for (const an of ANIMALS.list) blip(an.x, an.z, /shark|tiger|hammer|blacktip/.test(an.K.kind) ? '#ff5a4a' : '#ffd84a', 3);
  if (BOATS.motor) blip(BOATS.motor.x, BOATS.motor.z, '#ffffff', 4);
  if (typeof MP !== 'undefined' && MP.avatars) for (const a of MP.avatars.values()) blip(a.x, a.z, '#7fd0ff', 4);
  g.strokeStyle = 'rgba(120,200,255,0.45)'; for (const r of [100, 200, 300, 400]) { g.beginPath(); g.arc(cx, cy, r * sc, 0, TAU); g.stroke(); }
  const sw = t * 1.8; g.strokeStyle = 'rgba(150,230,255,0.9)'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(sw) * 118, cy - Math.cos(sw) * 118); g.stroke();
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx - 5, cy + 5); g.lineTo(cx + 5, cy + 5); g.fill();
  g.fillStyle = '#9fd8ff'; g.font = '12px monospace'; g.textAlign = 'left'; g.fillText('RADAR 400 m', 6, 14);
  s.t.needsUpdate = true;
}
function drawDepth() {
  const s = SUB.scr.depth, g = s.g, d = subDepth(), atm = 1 + d / 10.06;
  g.fillStyle = '#0b0f0e'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = d > SUB_RATED ? '#ff6b57' : '#ffb84a'; g.font = 'bold 26px monospace'; g.textAlign = 'left'; g.fillText(String(Math.round(d)).padStart(4, '0') + ' m', 10, 30);
  g.font = '15px monospace'; g.fillStyle = '#e8d8b8'; g.fillText(atm.toFixed(1) + ' atm   ' + Math.abs(SUB.speed * 1.94).toFixed(1) + ' kn', 10, 54);
  g.fillStyle = SUB.hull < 0.5 ? '#ff6b57' : '#7fe0b8'; g.textAlign = 'right'; g.fillText('HULL ' + Math.round(SUB.hull * 100) + '%', 246, 30);
  s.t.needsUpdate = true;
}
// the bow camera's picture on the big screen
const subCam = new THREE.PerspectiveCamera(70, 384 / 216, 0.3, 3000);
function renderSubCam() {
  if (!SUB.scr || (P.mode !== 'sub' && P.mode !== 'subwalk') || SUB.view !== 'inside') return;
  SUB.scr.t = (SUB.scr.t || 0) + 1; if (SUB.scr.t % 2) return;
  subToWorld(SUB_BOW, subCam.position); subCam.quaternion.copy(SUB.mesh.quaternion);
  subCam.layers.mask = camera.layers.mask | 7;
  const vis = SUB.parts.interior.visible; SUB.parts.interior.visible = false; SUB.mesh.visible = false;
  renderer.setRenderTarget(SUB.scr.cam); renderer.render(scene, subCam); renderer.setRenderTarget(null);
  SUB.parts.interior.visible = vis; SUB.mesh.visible = true;
}
// ---- at the dock ----
function buildSub() {
  const D = LAYOUT.dock; if (!D) return;
  const dyaw = Math.atan2(-D.dir.x, -D.dir.z);
  // out past the dock where the water is deep enough for her to lie alongside a floating walkway
  let k = D.len + 8;
  for (; k < D.len + 320; k += 2) { const p = local({ x: D.x, z: D.z }, dyaw, k, 0), q = local({ x: D.x, z: D.z }, dyaw, k + 4, 6.5); if (groundHeight(p.x, p.z) < -9.5 && groundHeight(q.x, q.z) < -9.5) break; }
  const side = 6.5, bp = local({ x: D.x, z: D.z }, dyaw, k + 4, side);
  SUB.home = { x: bp.x, z: bp.z, yaw: dyaw + Math.PI / 2 };
  SUB.mesh = subGeometry(); scene.add(SUB.mesh);
  resetSub();
  // the walkway: floats from the end of the dock out to her side
  { const a = local({ x: D.x, z: D.z }, dyaw, D.len, 0), b = local({ x: D.x, z: D.z }, dyaw, k + 4, side - SUB.R - 0.6), L = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const P = [];
    for (let t = 0; t < L; t += 0.7) P.push(bx(1.6, 0.1, 0.6, [0.5, 0.38, 0.26].map(v => v * rand(0.9, 1.06)), 0, 0, t));
    for (let t = 1; t < L; t += 3) for (const s of [-0.7, 0.7]) P.push(cy(0.22, 0.22, 1.5, 10, [0.85, 0.85, 0.82], s, -0.25, t, Math.PI / 2, 0, 0));
    const m = new THREE.Mesh(mergeGeos(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.position.set(a.x, 0.42, a.z); m.rotation.y = yaw; scene.add(m);
    const c = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    PLATFORMS.push({ x: c.x, z: c.z, hx: 0.8, hz: L / 2, rot: yaw, top: 0.47, wood: true, climb: true });
    SUB.walkEnd = b; }
  SUB.seat = { x: SUB.x, z: SUB.z, y: 0.5, r: 9, label: 'Climb into the submarine', short: 'Board', kind: 'sub', anyMode: true };
  INTERACT.push(SUB.seat);
  PLACES.trench = { x: TRENCH.x, z: 0, r: 120, under: true, name: 'The Trench', sub: 'Nearly half a kilometre straight down', y: -60, dy: 1000 };
  PLACES.abyss = { x: ABYSS.x, z: ABYSS.z, r: 300, under: true, name: 'The Abyss', sub: 'A mile down, and the hull is rated to 1200 m', y: -100, dy: 3000 };
}
function resetSub() {
  const H = SUB.home; if (!H) return;
  SUB.x = H.x; SUB.z = H.z; SUB.yaw = H.yaw; SUB.y = oceanHeight(H.x, H.z, U.uTime.value) - SUB.R * 0.62; SUB.speed = 0; SUB.vy = 0; SUB.hull = 1; SUB.state = 'moored'; SUB.pitch = SUB.roll = 0;
  SUB.mesh.visible = true; syncSub();
}
function syncSub() { SUB.mesh.position.set(SUB.x, SUB.y, SUB.z); SUB.mesh.rotation.set(SUB.pitch, SUB.yaw, SUB.roll, 'YXZ'); SUB.mesh.updateMatrixWorld(); WATER.uSubInv.value.copy(SUB.mesh.matrixWorld).invert(); WATER.uSubOn.value = SUB.mesh.visible ? 1 : 0; if (SUB.seat) { SUB.seat.x = SUB.x; SUB.seat.z = SUB.z; } }
const subDepth = () => Math.max(0, -(SUB.y + SUB.R * 0.62));
// ---- getting in: onto the deck, up the sail, down through the hatch ----
function boardSub() {
  if (SUB.state === 'lost') return;
  if (TOOL.cur !== 'hands') setTool('hands');
  SUB.board = { t: 0, from: camera.position.clone(), dir: 1 };
  P.mode = 'subboard'; SUB.state = 'driving'; P.vel.set(0, 0, 0);
  if (AUDIO.door) AUDIO.door('latch', true);
}
function updateSubBoard(dt) {
  const B = SUB.board; B.t = Math.min(1, B.t + dt / 3.4);
  const top = subToWorld(SUB_HATCH.clone().add(new THREE.Vector3(0, 1.4, 0)), new THREE.Vector3()), seat = subToWorld(SUB_SEAT, new THREE.Vector3());
  const lid = SUB.parts.lidPivot;
  let pos, look;
  if (B.t < 0.42) { const e = smoothstep(0, 0.42, B.t); pos = new THREE.Vector3().lerpVectors(B.from, top, e); pos.y += Math.sin(e * Math.PI) * 2.5; look = 0.0 - e * 0.7; lid.rotation.x = -e * 1.9; }
  else { const e = smoothstep(0.42, 1, B.t); const shaft = subToWorld(new THREE.Vector3(0, 1.2, -5.2), new THREE.Vector3()); pos = e < 0.75 ? new THREE.Vector3().lerpVectors(top, shaft, e / 0.75) : new THREE.Vector3().lerpVectors(shaft, seat, (e - 0.75) / 0.25); look = -0.7 + e * 0.75; lid.rotation.x = -1.9 * (1 - smoothstep(0.5, 0.75, e)); SUB.parts.interior.visible = e > 0.1; }
  SUB.boardCam = { pos, pitch: look };
  if (B.t >= 1) { SUB.board = null; P.mode = 'sub'; SUB.view = 'inside'; P.yaw = 0; P.pitch = -0.08; enterSubControls(); syncSubViewBtn(); }
}
function enterSubControls() {
  if (AUDIO.seat) AUDIO.seat('boat-seat');
  showActivityHint(isTouch ? 'Joystick to steer · ▲▼ rise and dive · Sonar button · V view' : 'W/S drive · A/D turn · Space rise · C dive · Shift fast · V view · X sonar · R radar · L lights · E hatch', false, 8);
  syncSubHud();
  $('t-sonar').hidden = !isTouch;
}
function syncSubHud() {
  const inside = SUB.view === 'inside' && P.mode === 'sub';
  $('hud').hidden = P.mode !== 'sub' || inside; $('hud-plane').hidden = true; $('hud-sub').hidden = P.mode !== 'sub' || inside;
  const gg = document.querySelector('#hud-sub .gauge'); if (gg) gg.hidden = true;
  $('subcam').hidden = !(P.mode === 'sub' && SUB.view === 'nose');
}
function cycleSubView() {
  SUB.view = SUB.view === 'inside' ? 'nose' : SUB.view === 'nose' ? 'outside' : 'inside';
  P.yaw = 0; P.pitch = SUB.view === 'outside' ? -0.25 : -0.05;
  SUB.parts.interior.visible = SUB.view === 'inside';
  toast(SUB.view === 'inside' ? 'Control room' : SUB.view === 'nose' ? 'Bow camera' : 'Outside view', '');
  syncSubHud(); syncSubViewBtn();
}
function exitSub() {
  const d = subDepth(); if ($('sub-view')) $('sub-view').hidden = true;
  $('hud').hidden = true; $('t-sonar').hidden = true; $('subcam').hidden = true; setSonar(false);
  SUB.parts.interior.visible = false;
  if (d > HATCH_SAFE) { implode(false); return; }
  SUB.state = 'parked'; SUB.speed = 0; SUB.vy = 0;
  if (AUDIO.subHum) AUDIO.subHum(0, 0, false);
  // at the surface by the walkway you step onto it; elsewhere on the surface, onto her deck and over the side; deeper, you swim out
  const lid = SUB.parts.lidPivot; lid.rotation.x = 0;
  if (d < 2 && SUB.walkEnd && Math.hypot(SUB.x - SUB.home.x, SUB.z - SUB.home.z) < 6) { const w = SUB.walkEnd; P.pos.set(w.x, 0.47 + EYE, w.z); P.mode = 'walk'; P.vel.set(0, 0, 0); P.onGround = true; return; }
  const top = subToWorld(SUB_HATCH.clone().add(new THREE.Vector3(1.6, 0.4, 0)), new THREE.Vector3());
  const surf = oceanHeight(top.x, top.z, U.uTime.value);
  P.mode = 'swim'; P.pos.set(top.x, Math.min(top.y, surf + 0.2), top.z); P.vel.set(0, 0, 0);
  if (d > 8) toast(`${Math.round(d)} m down`, 'Swim for the surface');
}
// the hull gives way (too deep), or you opened the hatch too deep
function implode(hullFailed) {
  const fl = $('flash'); fl.style.transition = 'none'; fl.style.background = '#e8f4ff'; fl.style.opacity = 1;
  requestAnimationFrame(() => { fl.style.transition = 'opacity 1.6s ease-out'; fl.style.opacity = 0; setTimeout(() => fl.style.background = '', 1700); });
  if (AUDIO.implode) AUDIO.implode();
  if ($('sub-view')) $('sub-view').hidden = true;
  for (let i = 0; i < 80 && FX.bubbles; i++) FX.bubbles(SUB.x + rand(-6, 6), SUB.y + rand(-2, 4), SUB.z + rand(-12, 12), 2);
  P.shake = 1; P.dunk = 1; P.mode = 'dead'; if (!hullFailed) SUB.state = 'parked';
  SUB.parts.interior.visible = false; $('subcam').hidden = true;
  if (hullFailed) { SUB.mesh.visible = false; SUB.state = 'lost'; toast('The hull gave way', `Crushed at ${Math.round(subDepth())} m · the sub will be back at the dock`); }
  else toast('The pressure crushed you', `Opening the hatch at ${Math.round(subDepth())} m was a mistake`);
  if (AUDIO.subHum) AUDIO.subHum(0, 0, false);
  const fade = $('fade'); fade.style.transition = 'opacity 0.5s'; fade.style.opacity = 1;
  setTimeout(() => { spawnPlayer(); if (hullFailed) resetSub(); else { SUB.state = 'parked'; } fade.style.opacity = 0; setTimeout(() => fade.style.transition = '', 900); }, 1800);
  $('hud').hidden = true; $('t-sonar').hidden = true; setSonar(false);
}
function setSonar(on) {
  SUB.sonar = on;
  // the x-ray sonar picture is for the bow camera; inside, it's the sonar screen
  U.uSonar.value = on && SUB.view === 'nose' && P.mode === 'sub' ? 1 : 0;
  if (on && AUDIO.ping) AUDIO.ping();
  $('hud-sonar').textContent = on ? 'SONAR ON' : '';
}
function updateSub(dt) {
  if (!SUB.mesh) return;
  const t = U.uTime.value;
  if (P.mode === 'subboard' && SUB.board) { updateSubBoard(dt); syncSub(); return; }
  if (SUB.state !== 'driving') {
    if (SUB.state === 'lost') return;
    const surf = oceanHeight(SUB.x, SUB.z, t);
    if (SUB.y > -SUB.R - 2) { SUB.y = damp(SUB.y, surf - SUB.R * 0.62, 2, dt); SUB.roll = Math.sin(t * 0.6) * 0.012; SUB.pitch = Math.sin(t * 0.45) * 0.006; }
    syncSub(); SUB.parts.beamMat.uniforms.uOn.value = 0; SUB.parts.mastLight.visible = Math.sin(t * 3) > 0;
    U.uSubL.value.w = 0;
    if (P.mode === 'subwalk') { const d = subDepth(), atm = 1 + d / 10.06, S = SUB.scr; S.needle.rotation.z = -(-135 + clamp(atm / 160, 0, 1.04) * 270) * Math.PI / 180; S.drawT = (S.drawT || 0) - dt; if (S.drawT <= 0) { S.drawT = 0.12; drawSonar(); drawRadar(); drawDepth(); } }
    return;
  }
  // controls
  let fwd, turn, up;
  if (isTouch) { fwd = input.my; turn = -input.mx; up = (touch.up ? 1 : 0) - (touch.down ? 1 : 0); }
  else { fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); turn = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0); up = (keys.has('Space') ? 1 : 0) - (keys.has('KeyC') || keys.has('KeyZ') ? 1 : 0); }
  const boost = input.run ? 1.7 : 1;
  SUB.speed = damp(SUB.speed, fwd * 11 * boost, 0.6, dt);
  SUB.vy = damp(SUB.vy, up * 6 * boost, 0.9, dt);
  const yr = turn * 0.32; SUB.yaw += yr * dt;
  const fx = -Math.sin(SUB.yaw), fz = -Math.cos(SUB.yaw);
  let nx = SUB.x + fx * SUB.speed * dt, nz = SUB.z + fz * SUB.speed * dt, ny = SUB.y + SUB.vy * dt;
  // the sea floor and the shore: scrape and stop
  const ahead = Math.sign(SUB.speed || 1) * SUB.L * 0.52;
  const gN = Math.max(groundHeight(nx, nz), groundHeight(nx + fx * SUB.L * 0.35, nz + fz * SUB.L * 0.35), groundHeight(nx - fx * SUB.L * 0.35, nz - fz * SUB.L * 0.35));
  const gAhead = groundHeight(nx + fx * ahead, nz + fz * ahead);
  if (gAhead > ny - SUB.R * 0.6) { if (Math.abs(SUB.speed) > 2) { P.shake = 0.7; if (AUDIO.slap) AUDIO.slap(0.7); SUB.hull = Math.max(0, SUB.hull - Math.abs(SUB.speed) * 0.006); } SUB.speed *= -0.2; nx = SUB.x; nz = SUB.z; }
  if (ny < gN + SUB.R + 0.4) { ny = gN + SUB.R + 0.4; SUB.vy = Math.max(0, SUB.vy); }
  const surf = oceanHeight(nx, nz, t);
  if (ny > surf - SUB.R * 0.62) { ny = surf - SUB.R * 0.62; SUB.vy = Math.min(SUB.vy, 0); }
  SUB.x = nx; SUB.z = nz; SUB.y = ny;
  SUB.pitch = damp(SUB.pitch, -SUB.vy * 0.035 + (ny > surf - SUB.R ? Math.sin(t * 0.45) * 0.008 : 0), 1.5, dt);
  SUB.roll = damp(SUB.roll, -yr * 0.1 * Math.abs(SUB.speed) / 11, 1.5, dt);
  SUB.parts.prop.rotation.z += SUB.speed * dt * 0.9;
  syncSub();
  SUB.mesh.updateMatrixWorld();
  subToWorld(SUB.view === 'outside' ? new THREE.Vector3(0, 0, 0) : SUB_SEAT, P.pos); P.camY = P.pos.y;
  // lights
  if (SUB.lightsToggle) { SUB.lights = !SUB.lights; SUB.lightsToggle = false; }
  const d = subDepth(), dark = 1 - Math.exp(-d * 0.03);
  SUB.parts.beamMat.uniforms.uOn.value = SUB.lights ? 0.4 + dark : 0;
  const L = subToWorld(new THREE.Vector3(0, -1.6, -SUB.L / 2 + 3.0), new THREE.Vector3()), D = new THREE.Vector3(0, -0.1, -1).applyQuaternion(SUB.mesh.quaternion).normalize();
  U.uSubL.value.set(L.x, L.y, L.z, SUB.lights ? 1 : 0); U.uSubD.value.copy(D);
  SUB.parts.mastLight.visible = false;
  // pressure on the hull: a deeper dive is a heavier sea
  const atm = 1 + d / 10.06;
  if (d > SUB_RATED) SUB.hull = Math.max(0, SUB.hull - dt * (d - SUB_RATED) / 900);
  if (d > SUB_CRUSH || SUB.hull <= 0) { implode(true); return; }
  SUB.creakT -= dt;
  if (d > 700 && SUB.creakT <= 0) { SUB.creakT = rand(2, 7) * (1 - smoothstep(700, 1400, d) * 0.8); if (AUDIO.creak) AUDIO.creak(smoothstep(700, 1400, d)); if (d > 1000) P.shake = Math.max(P.shake || 0, 0.25); }
  SUB.beepT -= dt;
  if (d > SUB_RATED - 50 && SUB.beepT <= 0) { SUB.beepT = d > SUB_RATED ? 0.35 : 0.9; if (AUDIO.beep) AUDIO.beep(); }
  if (d > 50 && FX.spawn && rng() < dt * 30 * Q.particles * smoothstep(50, 150, d)) FX.spawn(SUB.x + rand(-14, 14), SUB.y + rand(-6, 6), SUB.z + rand(-14, 14), rand(-0.1, 0.1), rand(-0.05, 0.1), rand(-0.1, 0.1), rand(3, 8), rand(0.03, 0.07), 6, 0);
  if (SUB.sonar) { SUB.pingT -= dt; if (SUB.pingT <= 0) { SUB.pingT = 3; if (AUDIO.ping) AUDIO.ping(); } }
  if (AUDIO.subHum) AUDIO.subHum(Math.abs(fwd), Math.abs(SUB.speed) * 0.6, true);
  U.uSonar.value = SUB.sonar && SUB.view === 'nose' ? 1 : 0;
  // the control room: needle, readouts, screens, the alarm
  const S = SUB.scr;
  S.needle.rotation.z = -(-135 + clamp(atm / 160, 0, 1.04) * 270) * Math.PI / 180;
  S.alarm.material.color.setHex(d > SUB_RATED ? (Math.sin(t * 10) > 0 ? 0xff2a1a : 0x441010) : SUB.hull < 0.6 ? 0xff8a1a : 0x441010);
  S.drawT = (S.drawT || 0) - dt;
  if (S.drawT <= 0 && SUB.view === 'inside') { S.drawT = 0.12; drawSonar(); drawRadar(); drawDepth(); }
  // the small readout for the camera and outside views
  $('hud-depth').textContent = d.toFixed(0); $('hud-press').textContent = atm.toFixed(1); $('hud-hull').textContent = Math.round(SUB.hull * 100);
  $('hud-hullbar').style.width = Math.round(SUB.hull * 100) + '%'; $('hud-hullbar').style.background = SUB.hull < 0.4 ? '#ff6b57' : SUB.hull < 0.75 ? '#f2c14e' : '#7fe0b8';
  $('hud-subwarn').textContent = d > SUB_RATED ? 'HULL STRESS — GO UP' : d > SUB_RATED - 60 ? 'Approaching rated depth' : d > HATCH_SAFE ? 'Hatch locked: too deep to open safely' : '';
  $('hud-subwarn').className = d > SUB_RATED ? 'warn hot' : 'warn';
  $('hud-sspeed').textContent = Math.abs(SUB.speed * 1.94).toFixed(1);
  if (SUB.view === 'nose') $('subcam-txt').textContent = `CAM 1 · ${Math.round(d)} m · ${atm.toFixed(1)} atm · HDG ${String(Math.round(((-SUB.yaw * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, '0')}`;
}
// where the camera is in each view
const _subc = new THREE.Vector3();
function subCamera() {
  if (P.mode === 'subboard' && SUB.boardCam) { camera.position.copy(SUB.boardCam.pos); camera.rotation.set(SUB.boardCam.pitch, SUB.yaw + Math.PI, 0, 'YXZ'); return; }
  if (P.mode === 'subwalk') { const W = SUB.walk, bob = Math.sin(W.bob * 2) * 0.025; subToWorld(new THREE.Vector3(W.x, -1.15 + EYE + bob, W.z), camera.position); _sube.set(clamp(P.pitch, -1.3, 1.3), P.yaw, 0, 'YXZ'); _subq.setFromEuler(_sube); camera.quaternion.copy(SUB.mesh.quaternion).multiply(_subq); return; }
  const q = SUB.mesh.quaternion;
  if (SUB.view === 'outside') {
    const yaw = SUB.yaw + P.yaw, pitch = clamp(P.pitch, -1.2, 0.6) - 0.1, dist = 34;
    _subc.set(SUB.x + Math.sin(yaw) * Math.cos(pitch) * dist, SUB.y - Math.sin(pitch) * dist + 4, SUB.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    _subc.y = Math.max(_subc.y, groundHeight(_subc.x, _subc.z) + 2);
    camera.position.copy(_subc); camera.lookAt(SUB.x, SUB.y + 2, SUB.z); return;
  }
  subToWorld(SUB.view === 'nose' ? SUB_BOW : SUB_SEAT, camera.position);
  _sube.set(clamp(P.pitch, -1.2, 1.2), clamp(P.yaw, SUB.view === 'nose' ? -1.1 : -3.1, SUB.view === 'nose' ? 1.1 : 3.1), 0, 'YXZ'); _subq.setFromEuler(_sube);
  camera.quaternion.copy(q).multiply(_subq);
}

// ---- on your feet in the control room ----
SUB.walk = { x: 0, z: -4.6, bob: 0 };
const SUB_LADDER = { x: 0, z: -5.2 }, SUB_CHAIR = { x: 0, z: -6.2 };
function subStand() {
  if (SUB.view !== 'inside') { SUB.view = 'inside'; SUB.parts.interior.visible = true; }
  P.mode = 'subwalk'; SUB.state = 'parked'; SUB.speed = 0; SUB.vy = 0;
  SUB.walk.x = 0.6; SUB.walk.z = -5.6; P.yaw = 0; P.pitch = -0.05;
  if (AUDIO.subHum) AUDIO.subHum(0, 0, true);
  syncSubHud(); syncSubViewBtn();
  showActivityHint(isTouch ? 'Walk round the control room · Sit to drive · the ladder takes you out' : 'Walk round the control room · E at the chair to drive · E at the ladder to climb out', false, 5);
}
function subSit() {
  P.mode = 'sub'; SUB.state = 'driving'; SUB.view = 'inside'; P.yaw = 0; P.pitch = -0.08;
  enterSubControls(); syncSubViewBtn();
}
function subWalk(dt) {
  const W = SUB.walk;
  let mx = input.mx, my = input.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const sp = 2.1 * (input.run ? 1.5 : 1);
  let x = W.x + (fx * my + rx * mx) * sp * dt, z = W.z + (fz * my + rz * mx) * sp * dt;
  // the curve of the hull, the console in front and the bulkhead behind
  x = clamp(x, -1.5, 1.5); z = clamp(z, -7.4, -1.6);
  for (const o of [{ x: 0, z: -5.85, r: 0.5 }, { x: SUB_LADDER.x, z: SUB_LADDER.z, r: 0.3 }]) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz); if (d < o.r) { x = o.x + dx / (d || 1) * o.r; z = o.z + dz / (d || 1) * o.r; } }
  const moved = Math.hypot(x - W.x, z - W.z); W.x = x; W.z = z; W.bob += moved * 2.2;
  if (moved > 0.6 * dt && AUDIO.step && (W.stepT = (W.stepT || 0) + moved) > 0.75) { W.stepT = 0; AUDIO.step('wood', false, 0); }
  subToWorld(new THREE.Vector3(W.x, -1.15 + EYE, W.z), P.pos); P.camY = P.pos.y;
}
// what you can do on your feet in here
function subWalkInteract() {
  const W = SUB.walk, dc = Math.hypot(W.x - SUB_CHAIR.x, W.z - SUB_CHAIR.z), dl = Math.hypot(W.x - SUB_LADDER.x, W.z - SUB_LADDER.z);
  if (dc < 1.0 && dc <= dl) return { label: 'Sit at the controls', short: 'Sit', subSit: true };
  if (dl < 1.0) { const d = subDepth(); return { label: d > HATCH_SAFE ? `Climb out of the hatch (deadly at ${Math.round(d)} m!)` : 'Climb up the ladder and out', short: 'Climb out', exitSub: true }; }
  return null;
}
// the view button: control room, bow camera, outside
function syncSubViewBtn() {
  const b = $('sub-view'); if (!b) return;
  b.hidden = P.mode !== 'sub';
  b.textContent = SUB.view === 'inside' ? 'Bow camera' : SUB.view === 'nose' ? 'Outside view' : 'Control room';
}
