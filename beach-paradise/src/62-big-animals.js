
// ───────────────────── 19b. Big animals: sharks, dolphins, turtles, rays, a whale shark ─────────────────────
// They cruise the open water around the island and gather near you when you're out on the boat or
// swimming. None of them attack. A body is a lofted tube along its length with fins, bent along
// its spine in the vertex shader, so they swim rather than slide.
const ANIMALS = { list: [], mats: {} };
const SWIM_VS = /* glsl */`
  attribute float aBend;        // 0 at the nose → 1 at the tail
  uniform float uPhase; uniform float uAmp; uniform float uFreq; uniform float uMode; // mode 0 side-to-side, 1 up-and-down (dolphins, whales), 2 flap (rays, turtles)
  void swimBend(inout vec3 p){
    float w = sin(uPhase - aBend * uFreq) * uAmp * aBend * aBend;
    if (uMode < 0.5) p.x += w;
    else if (uMode < 1.5) p.y += w;
    else p.y += sin(uPhase) * uAmp * pow(abs(p.x), 1.4) * sign(1.0);
  }
`;
function animalMat(key, color, belly) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...color, THREE.SRGBColorSpace), roughness: 0.55, metalness: 0.0 });
  const u = { uPhase: { value: 0 }, uAmp: { value: 0.2 }, uFreq: { value: 3 }, uMode: { value: 0 }, uSonarTag: { value: 1 } };
  m.userData.u = u;
  return patch(m, {
    key: 'animal-' + key, uniforms: u, vHead: SWIM_VS + 'varying float vBelly;', vBegin: 'swimBend(transformed); vBelly = smoothstep(0.1, -0.25, normal.y);',
    fHead: 'varying float vBelly;', fColor: `diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${belly.map(v => v.toFixed(3)).join(',')}), vBelly * 0.85);`,
  });
}
// a body of revolution along -z (nose at z = 0, tail at z = len), with a profile function for radius
function loftBody(len, prof, segs = 22, ring = 12, flatten = 1) {
  const pos = [], bend = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, r = prof(t);
    for (let k = 0; k <= ring; k++) {
      const a = (k / ring) * TAU;
      pos.push(Math.cos(a) * r, Math.sin(a) * r * flatten, t * len);
      bend.push(t);
    }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < ring; k++) { const a = i * (ring + 1) + k, b = a + 1, c = a + ring + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a flat fin: a triangle-ish plate given by its outline in (x, y) plus thickness, placed at z
function fin(pts, z0, len, t = 0.03) {
  const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.translate(0, 0, -t / 2);
  return { g, z0, len };
}
function finToBody(f, bodyLen, rotY = 0, rotZ = 0, x = 0, y = 0) {
  const g = f.g.clone(); if (rotZ) g.rotateZ(rotZ); g.rotateY(rotY ? rotY : Math.PI / 2);
  g.translate(x, y, f.z0);
  const n = g.attributes.position.count, b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = clamp(g.attributes.position.getZ(i) / bodyLen, 0, 1);
  g.setAttribute('aBend', new THREE.BufferAttribute(b, 1));
  return g.index ? g.toNonIndexed() : g;
}
function mergeAnimal(parts) {
  return mergeGeos(parts.map(g => { g = g.index ? g.toNonIndexed() : g; const q = new THREE.BufferGeometry(); q.setAttribute('position', g.attributes.position); if (!g.attributes.normal) g.computeVertexNormals(); q.setAttribute('normal', g.attributes.normal); q.setAttribute('aBend', g.attributes.aBend); return q; }));
}
function sharkGeo(len, hammer = false) {
  const body = loftBody(len, t => len * 0.085 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04)), 0.7) * (t > 0.82 ? 0.55 : 1), 22, 12, 0.92);
  const parts = [body];
  parts.push(finToBody(fin([[0, 0], [len * 0.05, len * 0.13], [len * 0.12, 0]], len * 0.3, len), len, Math.PI / 2, 0, 0, len * 0.06));          // dorsal
  for (const s of [-1, 1]) parts.push(finToBody(fin([[0, 0], [len * 0.12, -len * 0.08], [len * 0.1, 0]], len * 0.24, len), len, Math.PI / 2, s * 1.25, s * len * 0.06, -len * 0.02)); // pectorals
  parts.push(finToBody(fin([[0, 0], [len * 0.07, len * 0.12], [len * 0.05, 0], [len * 0.08, -len * 0.06]], len * 0.92, len), len, Math.PI / 2));  // tail
  if (hammer) { const h = new THREE.BoxGeometry(len * 0.24, len * 0.025, len * 0.05); h.translate(0, 0, len * 0.03); const b = new Float32Array(h.attributes.position.count); h.setAttribute('aBend', new THREE.BufferAttribute(b, 1)); parts.push(h); }
  return mergeAnimal(parts);
}
function dolphinGeo(len) {
  const body = loftBody(len, t => (t < 0.08 ? len * 0.03 + t * len * 0.6 : len * 0.09 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.06)), 0.8)) * (t > 0.85 ? 0.5 : 1), 22, 12, 1.0);
  const parts = [body];
  parts.push(finToBody(fin([[0, 0], [len * 0.07, len * 0.11], [len * 0.13, 0]], len * 0.38, len), len, Math.PI / 2, 0, 0, len * 0.07));
  for (const s of [-1, 1]) parts.push(finToBody(fin([[0, 0], [len * 0.08, -len * 0.07], [len * 0.1, 0]], len * 0.26, len), len, Math.PI / 2, s * 1.3, s * len * 0.06, -len * 0.03));
  // flukes are horizontal
  const fl = new THREE.Shape([[0, 0], [len * 0.13, -len * 0.06], [len * 0.11, 0], [len * 0.13, len * 0.06]].map(([a, b]) => new THREE.Vector2(a, b)));
  const fg = new THREE.ExtrudeGeometry(fl, { depth: 0.03, bevelEnabled: false }); fg.rotateX(Math.PI / 2); fg.rotateY(-Math.PI / 2); fg.translate(0, 0, len * 0.9);
  const n = fg.attributes.position.count, b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = clamp(fg.attributes.position.getZ(i) / len, 0, 1);
  fg.setAttribute('aBend', new THREE.BufferAttribute(b, 1)); parts.push(fg);
  return mergeAnimal(parts);
}
function rayGeo(span) {
  // a manta: a wide diamond wing, thicker in the middle, with a whip tail
  const pos = [], bend = [], idx = [], NX = 16, NZ = 10;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX * 2 - 1, v = j / NZ;
    const w = (1 - Math.abs(u)) ;
    const zEdge = 0.05 + 0.55 * Math.pow(1 - Math.abs(u), 1.2);
    const z = v * zEdge * span * 0.6 + Math.abs(u) * span * 0.18;
    const th = 0.08 * span * w * Math.sin(Math.PI * v);
    pos.push(u * span * 0.5, th * 0.5, z); bend.push(0);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d, a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1)); g.setIndex(idx); g.computeVertexNormals();
  const tail = new THREE.CylinderGeometry(0.01, 0.025, span * 0.6, 4).rotateX(Math.PI / 2).translate(0, 0, span * 0.62);
  tail.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(tail.attributes.position.count).fill(0.5), 1));
  return mergeAnimal([g, tail]);
}
function turtleGeo(len) {
  const shell = new THREE.SphereGeometry(len * 0.4, 16, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.45, 1.25);
  shell.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(shell.attributes.position.count), 1));
  const belly = new THREE.CircleGeometry(len * 0.4, 16).rotateX(Math.PI / 2).scale(1, 1, 1.25);
  belly.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(belly.attributes.position.count), 1));
  const head = new THREE.SphereGeometry(len * 0.11, 10, 8).scale(1, 0.85, 1.3).translate(0, 0, -len * 0.58);
  head.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(head.attributes.position.count), 1));
  const parts = [shell, belly, head];
  for (const s of [-1, 1]) {
    const fl = new THREE.BoxGeometry(len * 0.5, len * 0.03, len * 0.16).translate(s * len * 0.42, 0, -len * 0.18);
    fl.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(fl.attributes.position.count), 1)); parts.push(fl);
    const bl = new THREE.BoxGeometry(len * 0.18, len * 0.03, len * 0.12).translate(s * len * 0.28, 0, len * 0.4);
    bl.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(bl.attributes.position.count), 1)); parts.push(bl);
  }
  return mergeAnimal(parts);
}
const ANIMAL_KINDS = [
  { kind: 'blacktip', n: 3, len: 2.0, speed: 2.2, depth: [1.5, 6], geo: () => sharkGeo(2.0), color: [0.42, 0.46, 0.5], belly: [0.88, 0.88, 0.86], amp: 0.14, freq: 3.2, mode: 0, rate: 4.5 },
  { kind: 'tiger', n: 1, len: 4.0, speed: 1.6, depth: [3, 12], geo: () => sharkGeo(4.0), color: [0.38, 0.4, 0.36], belly: [0.85, 0.84, 0.8], amp: 0.22, freq: 3.0, mode: 0, rate: 3.2 },
  { kind: 'hammerhead', n: 1, len: 3.6, speed: 1.8, depth: [4, 14], geo: () => sharkGeo(3.6, true), color: [0.44, 0.48, 0.52], belly: [0.88, 0.88, 0.86], amp: 0.2, freq: 3.0, mode: 0, rate: 3.5 },
  { kind: 'dolphin', n: 4, len: 2.3, speed: 4.5, depth: [0.6, 4], geo: () => dolphinGeo(2.3), color: [0.42, 0.47, 0.52], belly: [0.82, 0.84, 0.86], amp: 0.12, freq: 2.4, mode: 1, rate: 6, pod: true, leaps: true },
  { kind: 'turtle', n: 3, len: 1.0, speed: 0.7, depth: [0.8, 5], geo: () => turtleGeo(1.0), color: [0.3, 0.32, 0.18], belly: [0.7, 0.62, 0.42], amp: 0.06, freq: 1, mode: 2, rate: 2.2 },
  { kind: 'manta', n: 2, len: 3.4, speed: 1.4, depth: [2, 8], geo: () => rayGeo(3.4), color: [0.12, 0.13, 0.15], belly: [0.88, 0.88, 0.86], amp: 0.35, freq: 1, mode: 2, rate: 1.6 },
  { kind: 'whaleshark', n: 1, len: 9.0, speed: 1.1, depth: [2, 10], geo: () => sharkGeo(9.0), color: [0.26, 0.32, 0.38], belly: [0.82, 0.83, 0.82], amp: 0.4, freq: 2.6, mode: 0, rate: 1.8, spots: true },
];
function buildBigAnimals() {
  for (const K of ANIMAL_KINDS) {
    const geo = K.geo();
    const mat = animalMat(K.kind, K.color, K.belly);
    if (K.spots) mat.onBeforeCompile = ((orig) => sh => { orig(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n{ vec2 q = fract(vWPos.xz * 1.6) - 0.5; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), smoothstep(0.12, 0.08, length(q)) * (1.0 - vBelly) * 0.8); }'); })(mat.onBeforeCompile);
    mat.userData.u.uAmp.value = K.amp; mat.userData.u.uFreq.value = K.freq; mat.userData.u.uMode.value = K.mode;
    for (let i = 0; i < K.n; i++) {
      // each animal needs its own phase, so each gets a clone of the material sharing the shader program
      const m = mat.clone(); m.onBeforeCompile = mat.onBeforeCompile; m.customProgramCacheKey = mat.customProgramCacheKey;
      const u = { uPhase: { value: rand(0, 10) }, uAmp: { value: K.amp }, uFreq: { value: K.freq }, uMode: { value: K.mode }, uSonarTag: { value: 1 } }; m.userData.u = u;
      const ob = m.onBeforeCompile; m.onBeforeCompile = sh => { ob(sh); Object.assign(sh.uniforms, u); };
      const mesh = new THREE.Mesh(geo, m); mesh.castShadow = false; mesh.frustumCulled = true; scene.add(mesh);
      ANIMALS.list.push({ K, mesh, u, x: 0, y: -5, z: 0, yaw: rand(0, TAU), pitch: 0, roll: 0, tx: 0, tz: 0, ty: -3, retarget: 0, leapT: 0, placed: false });
    }
  }
}
// somewhere deep enough for this animal, near you if you're out on the water
function animalTarget(a, near) {
  const c = near ? camera.position : (LAYOUT.coralGarden || SPAWN);
  for (let k = 0; k < 20; k++) {
    const r = near ? rand(12, 70) : rand(30, 260), ang = rand(0, TAU);
    const x = c.x + Math.cos(ang) * r, z = c.z + Math.sin(ang) * r;
    const g = groundHeight(x, z);
    if (g < -(a.K.depth[0] + 1.2) && !(STREAM.near && STREAM.near.get(vIndex(x, z)))) return { x, z, y: Math.max(g + 0.8, -rand(a.K.depth[0], a.K.depth[1])) };
  }
  return null;
}
function updateBigAnimals(dt, t) {
  const cam = camera.position;
  const out = P.mode === 'boat' || P.mode === 'swim' || P.mode === 'sub' || (P.depth > 0.6 && P.mode === 'walk');
  for (const a of ANIMALS.list) {
    a.retarget -= dt;
    const dCam = Math.hypot(a.x - cam.x, a.z - cam.z);
    if (!a.placed || a.retarget <= 0 || (out && dCam > 140 && rng() < dt * 0.2)) {
      const tg = animalTarget(a, out && rng() < 0.75);
      if (tg) {
        if (!a.placed) { a.x = tg.x; a.z = tg.z; a.y = tg.y; a.placed = true; }
        a.tx = tg.x; a.tz = tg.z; a.ty = tg.y;
      }
      a.retarget = rand(6, 16);
    }
    // steer toward the target, keeping clear of the shallows
    const dx = a.tx - a.x, dz = a.tz - a.z, dist = Math.hypot(dx, dz);
    let want = Math.atan2(-dx, -dz);
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const ahead = groundHeight(a.x + fx * a.K.len * 3, a.z + fz * a.K.len * 3);
    if (ahead > -(a.K.depth[0] + 0.5)) want = a.yaw + 1.6;
    let dy = want - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const turn = clamp(dy, -1, 1) * 0.6 * dt;
    a.yaw += turn; a.roll = damp(a.roll, -turn / dt * 0.25, 3, dt);
    const sp = a.K.speed * (dist < 4 ? 0.4 : 1);
    a.x += fx * sp * dt; a.z += fz * sp * dt;
    if (dist < 3) a.retarget = 0;
    // depth: dolphins come up to breathe and sometimes leap clear of the water
    const surf = oceanHeight(a.x, a.z, t), floorY = groundHeight(a.x, a.z) + 0.6;
    let ty = a.ty;
    if (a.K.leaps) {
      a.leapT -= dt;
      if (a.leapT <= 0 && a.leapT > -1.6) { const k = -a.leapT / 1.6; ty = surf - 0.6 + Math.sin(k * Math.PI) * 2.2; }
      if (a.leapT < -1.6) { a.leapT = rand(2.5, 9); if (dCam < 60) { splashAt(a.x, surf, a.z, 0.9); if (AUDIO.splash) AUDIO.splash(0.4); } }
      if (a.leapT > 0) ty = surf - rand(0.5, 0.6) - Math.sin(t * 0.7 + a.u.uPhase.value) * 0.6;
    }
    ty = clamp(ty, floorY, surf - (a.K.leaps ? -2 : 0.5));
    const vy = (ty - a.y);
    a.y = damp(a.y, ty, a.K.leaps ? 3 : 0.6, dt);
    a.pitch = damp(a.pitch, clamp(-vy * 0.4, -0.6, 0.6), 2, dt);
    // the shark's dorsal fin cutting the surface leaves a little wake
    if (a.y > surf - 0.6 && dCam < 50 && rng() < dt * 6) rippleDrop(a.x, a.z, 0.4, 0.06, 0.2);
    a.u.uPhase.value += dt * a.K.rate * (0.6 + sp / a.K.speed * 0.4);
    a.mesh.position.set(a.x, a.y, a.z);
    a.mesh.rotation.set(a.pitch, a.yaw, a.roll, 'YXZ');
    a.mesh.visible = dCam < (Q.near * 2.2);
  }
}
