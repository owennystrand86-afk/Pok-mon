
// ───────────────────── 13b. The back deck: a log pool and a cedar hot tub ─────────────────────
// Out of the cabin's new back door onto a deck at floor height: a swimming pool edged in half-logs and
// lined with blue tiles, and a cedar hot tub that spills over into it. A power box on a post runs the
// tub: power, bubbles, jets, the heater, draining and filling both, and the underwater lights. In the
// cabin there's a drain pump on a long hose: drop it in any water and lay the hose wherever you like,
// and it pumps the water out of the end (into the sea, onto the sand, into the pool...).
// Coordinates here are the cabin's own: x across the front, z toward the back, y from the floor.
const DECKZ = CD, POOLB = { x0: -5.5, x1: 1.5, z0: CD + 3, z1: CD + 8, floor: -1.95, top: -0.15 };
const TUBB = { x: 4.0, z: CD + 5.5, R: 1.25, floor: -0.55, top: 0.25 };
const TUB = {
  power: true, bubbles: false, jets: 0, heat: 38, temp: 27, lights: true,
  level: 1, poolLevel: 1, tubFlow: 0, poolFlow: 0, changed: 0, group: null, panelOpen: false,
};
const _pl = new THREE.Vector3();
const poolLevelY = () => POOLB.floor + (POOLB.top - POOLB.floor) * TUB.poolLevel;
const tubLevelY = () => TUBB.floor + (TUBB.top - TUBB.floor) * TUB.level;
// is (x,z) over the pool or in the tub? (world coordinates)
function poolWhere(x, z) {
  if (!TUB.group || !CABIN.group || CABIN.destroyed) return null;
  const l = worldToCabin(x, z);
  if (l.x > POOLB.x0 && l.x < POOLB.x1 && l.z > POOLB.z0 && l.z < POOLB.z1) return 'pool';
  if (Math.hypot(l.x - TUBB.x, l.z - TUBB.z) < TUBB.R - 0.08) return 'tub';
  return null;
}
function poolWaterAt(x, z) {
  const w = poolWhere(x, z); if (!w) return null;
  const lvl = CABIN.floor + (w === 'pool' ? poolLevelY() : tubLevelY());
  const floor = CABIN.floor + (w === 'pool' ? POOLB.floor : TUBB.floor);
  if (lvl < floor + 0.03) return null;
  return { level: lvl, kind: 'fresh', fx: 0, fz: 0, pool: w };
}
// water you can see through, lit from below at night, churned by bubbles and jets
function poolWaterMaterial(kind) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, ...WFX.uniforms, uBub: { value: 0 }, uJet: { value: 0 }, uLight: { value: 0 }, uWarm: { value: 0 }, uC: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */`varying vec3 vWPos; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`${COMMON}
      uniform sampler2D uNormTex; uniform sampler2D uFoamTex; uniform vec3 uSpecCol; uniform vec3 uWaterLight; uniform float uBub; uniform float uJet; uniform float uLight; uniform float uWarm; uniform vec2 uC;
      varying vec3 vWPos;
      void main(){
        vec3 V = normalize(cameraPosition - vWPos);
        float churn = uBub * 0.6 + uJet;
        vec3 n1 = texture2D(uNormTex, vWPos.xz * 0.35 + uTime * vec2(0.02, 0.015) * (1.0 + churn * 4.0)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormTex, vWPos.xz * 1.1 - uTime * vec2(0.03, 0.05) * (1.0 + churn * 6.0)).xyz * 2.0 - 1.0;
        vec3 N = normalize(vec3((n1.x + n2.x * 0.6) * (0.08 + churn * 0.35), 1.0, (n1.y + n2.y * 0.6) * (0.08 + churn * 0.35)));
        float F = 0.03 + 0.97 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 sky = skyHaze(R) * mix(0.35, 1.0, uDaylight);
        vec3 body = mix(vec3(0.26, 0.7, 0.78), vec3(0.08, 0.42, 0.55), 0.5) * uWaterLight;
        body += vec3(0.25, 0.75, 1.0) * uLight * 0.7;
        // bubbles and the boil over the jets
        float bub = texture2D(uFoamTex, vWPos.xz * 1.6 + vec2(uTime * 0.13, -uTime * 0.11)).b;
        float b2 = texture2D(uFoamTex, vWPos.xz * 0.7 - vec2(uTime * 0.07, uTime * 0.05)).g;
        float foam = smoothstep(0.55, 0.85, b2 * (0.5 + 0.5 * bub)) * uBub * 0.55;
        foam = max(foam, smoothstep(0.4, 0.9, b2) * uJet * smoothstep(0.9, 0.2, length(vWPos.xz - uC)) * 0.7);
        vec3 col = body * (1.0 - F) + sky * F + uSpecCol * pow(max(dot(R, uLightDir), 0.0), 300.0) * 2.0;
        col = mix(col, vec3(0.92, 0.96, 1.0) * mix(0.4, 1.0, uDaylight) + vec3(0.2, 0.6, 0.8) * uLight * 0.4, foam);
        float a = clamp(0.38 + F * 0.5 + foam, 0.0, 0.95);
        col = applyFog(col, vWPos, 1.0);
        gl_FragColor = vec4(outCol(col) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
function tileTexture() {
  return canvasTex(128, 128, g => { g.fillStyle = '#5fb7cf'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = `hsl(${193 + Math.random() * 8},${45 + Math.random() * 15}%,${52 + Math.random() * 12}%)`; g.fillRect(i * 16 + 1, j * 16 + 1, 14, 14); } });
}
// the ground behind the cabin is dug down so the deck stands clear of it
function levelDeckGround() {
  let i0 = 1e9, j0 = 1e9, i1 = -1, j1 = -1;
  const lim = CABIN.floor - 0.7;
  for (let j = 0; j <= T.res; j++) for (let i = 0; i <= T.res; i++) {
    const x = T.min + i * T.cell, z = T.min + j * T.cell, l = worldToCabin(x, z);
    const dx = Math.max(-7.6 - l.x, 0, l.x - 9.5), dz = Math.max(CD - 0.5 - l.z, 0, l.z - (CD + 13.6));
    const out = Math.hypot(dx, dz); if (out > 6) continue;
    const k = j * T.n + i, want = lim + out * 0.55;
    if (T.h[k] > want) { T.h[k] = lerp(T.h[k], want, 1 - smoothstep(4, 6, out)); i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
  }
  if (i1 >= 0 && typeof flushTerrain === 'function') { DESTROY.dirty = { i0, j0, i1, j1 }; flushTerrain(); }
}
function buildPoolDeck() {
  if (!CABIN.group) return;
  levelDeckGround();
  const grp = new THREE.Group(); grp.position.set(CABIN.x, CABIN.floor, CABIN.z); grp.rotation.y = CABIN.yaw; scene.add(grp); TUB.group = grp;
  const W = [], D = [], S = [], M = [];
  const plank = [0.5, 0.36, 0.23];
  // deck planks over the joists, around the pool and the tub
  const holeP = (x, z) => x > POOLB.x0 - 0.02 && x < POOLB.x1 + 0.02 && z > POOLB.z0 - 0.02 && z < POOLB.z1 + 0.02;
  const holeT = (x, z) => Math.hypot(x - TUBB.x, z - TUBB.z) < TUBB.R + 0.05;
  for (let z = DECKZ + 0.08; z < DECKZ + 13; z += 0.16) {
    let x = -7, run = null;
    const flush = (a, b) => { if (b - a > 0.05) D.push(bx(b - a, 0.05, 0.145, plank.map(v => v * rand(0.88, 1.08)), (a + b) / 2, -0.025, z)); };
    for (; x <= 7.001; x += 0.1) { const hole = holeP(x, z) || holeT(x, z); if (!hole && run === null) run = x; if ((hole || x > 6.99) && run !== null) { flush(run, x); run = null; } }
  }
  // the frame: rim joists, posts down to the ground, a fieldstone skirt round the open sides
  for (const [x, z, w, d] of [[0, DECKZ + 13, 14.2, 0.2], [-7, DECKZ + 6.5, 0.2, 13], [7, DECKZ + 6.5, 0.2, 13]]) D.push(bx(w, 0.3, d, [0.36, 0.25, 0.16], x, -0.2, z));
  const stoneCol = () => { const v = rand(0.62, 1.12); return [0.4 * v, 0.38 * v, 0.35 * v]; };
  const skirt = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (let u = 0, row = 0; u < L - 0.05; row++) {
      const bl = Math.min(rand(0.42, 0.72), L - u), cx = x0 + ux * (u + bl / 2), cz = z0 + uz * (u + bl / 2);
      const w = cabinToWorld(cx, 0, cz), gl = groundHeight(w.x, w.z) - CABIN.floor - 0.3;
      let k = 0; for (let y = gl; y < -0.33; y += 0.26, k++) { const hh = Math.min(0.26, -0.33 - y); S.push(bx(Math.abs(ux) > 0.5 ? bl - 0.03 : 0.34, hh - 0.025, Math.abs(uz) > 0.5 ? bl - 0.03 : 0.34, stoneCol(), cx, y + hh / 2, cz)); }
      u += bl;
    }
  };
  skirt(-7.1, DECKZ, -7.1, DECKZ + 13.1); skirt(7.1, DECKZ, 7.1, DECKZ + 3.4); skirt(7.1, DECKZ + 5.6, 7.1, DECKZ + 13.1); skirt(-7.1, DECKZ + 13.1, 7.1, DECKZ + 13.1);
  // railing round the deck with an opening on the right side for the steps
  const railC = [0.48, 0.34, 0.22];
  const rail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
    D.push(part(new THREE.BoxGeometry(0.08, 0.08, L), railC, (x0 + x1) / 2, 1.0, (z0 + z1) / 2, 0, a, 0));
    for (let t = 0; t <= L + 0.01; t += 1.6) { const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L; D.push(cy(0.055, 0.06, 1.0, 6, railC, x, 0.5, z)); }
    for (let t = 0.2; t < L; t += 0.16) { const x = x0 + (x1 - x0) * t / L, z = z0 + (z1 - z0) * t / L; D.push(bx(0.03, 0.82, 0.03, railC, x, 0.5, z)); }
  };
  rail(-7, DECKZ + 0.3, -7, DECKZ + 13); rail(-7, DECKZ + 13, 7, DECKZ + 13); rail(7, DECKZ + 13, 7, DECKZ + 5.6); rail(7, DECKZ + 3.4, 7, DECKZ + 0.3);
  // steps down from the right side of the deck
  const sw = cabinToWorld(8.2, 0, DECKZ + 4.5), gr = groundHeight(sw.x, sw.z), drop = CABIN.floor - gr, nS = Math.max(2, Math.ceil(drop / 0.18)), rise = drop / nS;
  for (let s = 1; s < nS; s++) {
    const x = 7 + (s - 0.5) * 0.32, y = -s * rise;
    D.push(bx(0.37, 0.05, 2.1, plank, x, y - 0.025, DECKZ + 4.5));
    const w = cabinToWorld(x, 0, DECKZ + 4.5);
    PLATFORMS.push({ x: w.x, z: w.z, hx: 0.17, hz: 1.05, rot: CABIN.yaw, top: CABIN.floor + y, wood: true, climb: true });
  }
  // the pool: blue tiles inside, a coping of half-logs round the rim
  const tiles = tileTexture(); tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  const pw = POOLB.x1 - POOLB.x0, pd = POOLB.z1 - POOLB.z0, ph = -POOLB.floor, pcx = (POOLB.x0 + POOLB.x1) / 2, pcz = (POOLB.z0 + POOLB.z1) / 2;
  const tileMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35, side: THREE.DoubleSide });
  const tileMesh = (w, h, rep, x, y, z, ry, rx) => { const t = tiles.clone(); t.needsUpdate = true; t.repeat.set(rep[0], rep[1]); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0, 'YXZ'); m.receiveShadow = true; grp.add(m); };
  void tileMat;
  tileMesh(pw, pd, [pw / 1.6, pd / 1.6], pcx, POOLB.floor, pcz, 0, -Math.PI / 2);
  tileMesh(pw, ph, [pw / 1.6, ph / 1.6], pcx, POOLB.floor / 2, POOLB.z0, 0);
  tileMesh(pw, ph, [pw / 1.6, ph / 1.6], pcx, POOLB.floor / 2, POOLB.z1, Math.PI);
  tileMesh(pd, ph, [pd / 1.6, ph / 1.6], POOLB.x0, POOLB.floor / 2, pcz, Math.PI / 2);
  tileMesh(pd, ph, [pd / 1.6, ph / 1.6], POOLB.x1, POOLB.floor / 2, pcz, -Math.PI / 2);
  const logC = [0.42, 0.29, 0.18];
  const halfLog = (len, x, z, along) => { const g = new THREE.CylinderGeometry(0.17, 0.17, len, 12, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); if (along === 'z') g.rotateY(Math.PI / 2); g.translate(x, 0.0, z); W.push(prep(g, logC.map(v => v * rand(0.92, 1.06)))); };
  halfLog(pw + 0.34, pcx, POOLB.z0 - 0.17, 'x'); halfLog(pw + 0.34, pcx, POOLB.z1 + 0.17, 'x'); halfLog(pd, POOLB.x0 - 0.17, pcz, 'z'); halfLog(pd, POOLB.x1 + 0.17, pcz, 'z');
  // a ladder into the deep end
  for (const s of [-0.28, 0.28]) M.push(part(new THREE.TorusGeometry(0.32, 0.025, 6, 12, Math.PI), [0.85, 0.86, 0.88], POOLB.x0 + 0.25, 0.05, pcz + s, 0, Math.PI / 2, 0), cy(0.025, 0.025, 1.9, 6, [0.85, 0.86, 0.88], POOLB.x0 + 0.57, -0.9, pcz + s));
  // the hot tub: a cedar barrel of staves in steel bands, a bench inside, a spillway into the pool
  for (let k = 0; k < 28; k++) { const a = k / 28 * TAU; W.push(part(new THREE.BoxGeometry(0.27, 1.0, 0.07), [0.55, 0.32, 0.2].map(v => v * rand(0.9, 1.08)), TUBB.x + Math.cos(a) * TUBB.R, TUBB.floor + 0.48, TUBB.z + Math.sin(a) * TUBB.R, 0, -a + Math.PI / 2, 0)); }
  for (const y of [-0.3, 0.3]) M.push(part(new THREE.TorusGeometry(TUBB.R + 0.045, 0.02, 4, 40).rotateX(Math.PI / 2), [0.3, 0.3, 0.32], TUBB.x, y, TUBB.z));
  W.push(part(new THREE.TorusGeometry(TUBB.R, 0.07, 6, 40).rotateX(Math.PI / 2), [0.5, 0.3, 0.19], TUBB.x, TUBB.floor + 0.98, TUBB.z));
  W.push(part(new THREE.CylinderGeometry(TUBB.R - 0.05, TUBB.R - 0.05, 0.04, 32), [0.4, 0.26, 0.17], TUBB.x, TUBB.floor, TUBB.z));
  W.push(part(new THREE.TorusGeometry(TUBB.R - 0.25, 0.18, 4, 32).rotateX(Math.PI / 2).scale(1, 0.4, 1), [0.48, 0.3, 0.19], TUBB.x, TUBB.floor + 0.3, TUBB.z));
  W.push(part(new THREE.BoxGeometry(0.5, 0.06, 1.2), [0.42, 0.29, 0.18], TUBB.x - TUBB.R - 0.35, 0.15, TUBB.z, 0, 0, 0.18));
  // the power box on its post
  const pbx = 6.1, pbz = DECKZ + 8.6;
  D.push(bx(0.14, 1.5, 0.14, [0.4, 0.28, 0.18], pbx, 0.75, pbz));
  M.push(bx(0.42, 0.55, 0.16, [0.6, 0.62, 0.62], pbx, 1.25, pbz - 0.15), bx(0.02, 0.04, 0.12, [0.15, 0.15, 0.16], pbx - 0.22, 1.25, pbz - 0.15));
  const add = (list, mat) => { if (!list.length) return null; const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  add(D, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), { key: 'deck-wood', fColor: '{ float gr = texture2D(uNoiseTex, vec2((vWPos.x + vWPos.z) * 0.25, vWPos.y * 3.0 + vWPos.x * 1.7)).a; diffuseColor.rgb *= 0.84 + 0.3 * gr; }' }));
  add(W, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), { key: 'deck-logs' }));
  add(S, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { key: 'deck-stone' }));
  add(M, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 }));
  // the readout on the power box
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; TUB.cv = cv;
  TUB.screen = new THREE.CanvasTexture(cv); TUB.screen.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: TUB.screen, toneMapped: false }));
  scr.position.set(pbx, 1.33, pbz - 0.235); scr.rotation.y = Math.PI; grp.add(scr);
  // the water
  TUB.poolWater = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2), poolWaterMaterial('pool')); TUB.poolWater.position.set(pcx, poolLevelY(), pcz); TUB.poolWater.renderOrder = 6; grp.add(TUB.poolWater);
  TUB.tubWater = new THREE.Mesh(new THREE.CircleGeometry(TUBB.R - 0.05, 40).rotateX(-Math.PI / 2), poolWaterMaterial('tub')); TUB.tubWater.position.set(TUBB.x, tubLevelY(), TUBB.z); TUB.tubWater.renderOrder = 6; grp.add(TUB.tubWater);
  // the water spilling from the tub into the pool
  TUB.spill = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.45), new THREE.MeshBasicMaterial({ color: 0xcfeef5, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  TUB.spill.position.set(POOLB.x1 + 0.05, -0.05, TUBB.z); TUB.spill.rotation.y = Math.PI / 2; grp.add(TUB.spill);
  // where you can walk: the deck round the holes, the pool floor, the tub floor
  const plat = (x0, z0, x1, z1, top, climb = true) => { const c = cabinToWorld((x0 + x1) / 2, 0, (z0 + z1) / 2); PLATFORMS.push({ x: c.x, z: c.z, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: CABIN.yaw, top: CABIN.floor + top, wood: true, climb }); };
  const ts = 0.82;
  plat(-7, DECKZ, 7, POOLB.z0, 0); plat(-7, POOLB.z1, 7, DECKZ + 13, 0); plat(-7, POOLB.z0, POOLB.x0, POOLB.z1, 0);
  plat(POOLB.x1, POOLB.z0, 7, TUBB.z - ts, 0); plat(POOLB.x1, TUBB.z + ts, 7, POOLB.z1, 0); plat(POOLB.x1, TUBB.z - ts, TUBB.x - ts, TUBB.z + ts, 0); plat(TUBB.x + ts, TUBB.z - ts, 7, TUBB.z + ts, 0);
  plat(POOLB.x0, POOLB.z0, POOLB.x1, POOLB.z1, POOLB.floor, false); plat(TUBB.x - ts, TUBB.z - ts, TUBB.x + ts, TUBB.z + ts, TUBB.floor, false);
  // pool walls (you climb out, you don't swim under the deck), the deck's outer railing
  const wall = (x0, z0, x1, z1, y0, y1) => { const c = cabinToWorld((x0 + x1) / 2, 0, (z0 + z1) / 2); WALLS.push({ x: c.x, z: c.z, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: CABIN.yaw, y0: CABIN.floor + y0, y1: CABIN.floor + y1 }); };
  wall(POOLB.x0 - 0.15, POOLB.z0 - 0.15, POOLB.x1 + 0.15, POOLB.z0, -2.1, 0); wall(POOLB.x0 - 0.15, POOLB.z1, POOLB.x1 + 0.15, POOLB.z1 + 0.15, -2.1, 0);
  wall(POOLB.x0 - 0.15, POOLB.z0, POOLB.x0, POOLB.z1, -2.1, 0); wall(POOLB.x1, POOLB.z0, POOLB.x1 + 0.15, POOLB.z1, -2.1, 0);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, x = TUBB.x + Math.cos(a) * TUBB.R, z = TUBB.z + Math.sin(a) * TUBB.R; wall(x - 0.18, z - 0.18, x + 0.18, z + 0.18, TUBB.floor - 0.1, 0.45); }
  wall(-7.1, DECKZ + 0.3, -6.95, DECKZ + 13, 0, 1.05); wall(-7, DECKZ + 12.95, 7, DECKZ + 13.1, 0, 1.05); wall(6.95, DECKZ + 5.6, 7.1, DECKZ + 13, 0, 1.05); wall(6.95, DECKZ + 0.3, 7.1, DECKZ + 3.4, 0, 1.05);
  wall(-7, DECKZ + 0.02, 7, DECKZ + 13, -0.05, -4);   // nothing walks under the deck
  // seats in the tub, the power box
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + 0.6, sx = TUBB.x + Math.cos(a) * (TUBB.R - 0.4), sz = TUBB.z + Math.sin(a) * (TUBB.R - 0.4);
    const w = cabinToWorld(sx, 0, sz), e = cabinToWorld(sx - Math.cos(a) * 0.05, -0.05, sz - Math.sin(a) * 0.05);
    const look = Math.atan2(Math.cos(a), Math.sin(a)) + CABIN.yaw;
    const it = { x: w.x, z: w.z, y: CABIN.floor + TUBB.floor, r: 0.9, label: 'Sit in the hot tub', short: 'Sit', eye: new THREE.Vector3(e.x, e.y + 0.62, e.z), yaw: look, pitch: -0.1, standX: w.x, standZ: w.z, kind: 'tub', tub: true };
    INTERACT.push(it);
  }
  { const w = cabinToWorld(pbx, 0, pbz - 0.8); INTERACT.push({ x: w.x, z: w.z, y: CABIN.floor, r: 1.4, label: 'Open the hot tub controls', short: 'Controls', tubPanel: true }); }
  // the cabin's back doorway leads out here
  PLACES.deck = { x: cabinToWorld(0, 0, DECKZ + 6).x, z: cabinToWorld(0, 0, DECKZ + 6).z, r: 9, name: 'The Pool Deck', sub: 'A log pool and a cedar hot tub' };
  buildPump();
  bindTubPanel();
  drawTubScreen();
}
// ---- the control panel ----
function bindTubPanel() {
  const el = $('tub-panel'); if (!el) return;
  const set = (fn) => () => { fn(); TUB.changed = Date.now(); syncTubPanel(); drawTubScreen(); if (AUDIO.beep) AUDIO.beep(); };
  $('tub-close').onclick = () => closeTubPanel();
  $('tub-power').onclick = set(() => { TUB.power = !TUB.power; });
  $('tub-bubbles').onclick = set(() => { TUB.bubbles = !TUB.bubbles; });
  el.querySelectorAll('#tub-jets button').forEach(b => b.onclick = set(() => { TUB.jets = +b.dataset.j; }));
  $('tub-cooler').onclick = set(() => { TUB.heat = TUB.heat <= 26 ? 0 : TUB.heat - 1; });
  $('tub-warmer').onclick = set(() => { TUB.heat = TUB.heat < 26 ? 26 : Math.min(40, TUB.heat + 1); });
  $('tub-drain').onclick = set(() => { TUB.tubFlow = TUB.tubFlow < 0 ? 0 : -1; });
  $('tub-fill').onclick = set(() => { TUB.tubFlow = TUB.tubFlow > 0 ? 0 : 1; });
  $('pool-drain').onclick = set(() => { TUB.poolFlow = TUB.poolFlow < 0 ? 0 : -1; });
  $('pool-fill').onclick = set(() => { TUB.poolFlow = TUB.poolFlow > 0 ? 0 : 1; });
  $('tub-lights').onclick = set(() => { TUB.lights = !TUB.lights; });
}
function syncTubPanel() {
  if (!$('tub-panel')) return;
  const on = TUB.power;
  $('tub-power').textContent = on ? 'On' : 'Off'; $('tub-power').setAttribute('aria-pressed', String(on));
  $('tub-bubbles').textContent = TUB.bubbles ? 'On' : 'Off'; $('tub-bubbles').setAttribute('aria-pressed', String(TUB.bubbles));
  document.querySelectorAll('#tub-jets button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.j === TUB.jets)));
  $('tub-temp').textContent = TUB.heat ? TUB.heat + '°C' : 'Heater off';
  $('tub-now').textContent = Math.round(TUB.temp) + '°C · ' + Math.round(TUB.level * 100) + '% full';
  $('pool-now').textContent = Math.round(TUB.poolLevel * 100) + '% full';
  $('tub-drain').textContent = TUB.tubFlow < 0 ? 'Stop draining' : 'Drain'; $('tub-fill').textContent = TUB.tubFlow > 0 ? 'Stop filling' : 'Fill';
  $('pool-drain').textContent = TUB.poolFlow < 0 ? 'Stop draining' : 'Drain'; $('pool-fill').textContent = TUB.poolFlow > 0 ? 'Stop filling' : 'Fill';
  $('tub-lights').textContent = TUB.lights ? 'On' : 'Off'; $('tub-lights').setAttribute('aria-pressed', String(TUB.lights));
  $('tub-panel').classList.toggle('off', !on);
}
function openTubPanel() { TUB.panelOpen = true; panelOpen = true; $('tub-panel').hidden = false; if (document.pointerLockElement) document.exitPointerLock(); syncTubPanel(); }
function closeTubPanel() { TUB.panelOpen = false; panelOpen = false; $('tub-panel').hidden = true; showHint(); }
function drawTubScreen() {
  const c = TUB.cv; if (!c) return; const g = c.getContext('2d');
  g.fillStyle = TUB.power ? '#06221e' : '#050505'; g.fillRect(0, 0, 128, 64);
  if (TUB.power) {
    g.fillStyle = '#7dffd8'; g.font = 'bold 26px monospace'; g.textAlign = 'center'; g.fillText(Math.round(TUB.temp) + '°C', 64, 30);
    g.font = '12px monospace'; g.fillStyle = '#9fd8ff'; g.fillText((TUB.heat ? 'SET ' + TUB.heat : 'HEAT OFF') + (TUB.jets ? ' JET' + TUB.jets : '') + (TUB.bubbles ? ' BUB' : ''), 64, 52);
  }
  TUB.screen.needsUpdate = true;
}
// ---- running it ----
function updateTub(dt) {
  if (!TUB.group) return;
  const on = TUB.power, night = 1 - smoothstep(0.15, 0.5, ENV.daylight);
  // the heater warms the tub slowly; off, it cools toward the air
  const target = on && TUB.heat ? TUB.heat : 26 + 3 * ENV.daylight;
  TUB.temp += (target - TUB.temp) * dt * (target > TUB.temp ? 0.02 : 0.006);
  // drain and fill
  const tubRate = 0.06, poolRate = 0.012;
  if (TUB.tubFlow) { TUB.level = clamp(TUB.level + TUB.tubFlow * tubRate * dt * (on || TUB.tubFlow < 0 ? 1 : 0), 0, 1); if (TUB.level <= 0 || TUB.level >= 1) TUB.tubFlow = 0; }
  if (TUB.poolFlow) { TUB.poolLevel = clamp(TUB.poolLevel + TUB.poolFlow * poolRate * dt, 0, 1); if (TUB.poolLevel <= 0 || TUB.poolLevel >= 1) TUB.poolFlow = 0; }
  TUB.poolWater.position.y = poolLevelY(); TUB.poolWater.visible = TUB.poolLevel > 0.01;
  TUB.tubWater.position.y = tubLevelY(); TUB.tubWater.visible = TUB.level > 0.01;
  const full = TUB.level > 0.85;
  const bub = on && TUB.bubbles && TUB.level > 0.3 ? 1 : 0, jet = on && TUB.level > 0.35 ? TUB.jets / 2 : 0;
  for (const m of [TUB.tubWater, TUB.poolWater]) {
    const u = m.material.uniforms;
    u.uBub.value = damp(u.uBub.value, m === TUB.tubWater ? bub : 0, 3, dt);
    u.uJet.value = damp(u.uJet.value, m === TUB.tubWater ? jet : 0, 3, dt);
    u.uLight.value = damp(u.uLight.value, on && TUB.lights ? night : 0, 3, dt);
    m.getWorldPosition(_pl); u.uC.value.set(_pl.x, _pl.z);
  }
  TUB.spill.visible = full && TUB.poolLevel < 0.999 ? true : full;
  TUB.spill.material.opacity = full ? 0.35 + 0.1 * Math.sin(U.uTime.value * 9) : 0;
  // steam off hot water, more on a cool night; bubbles rising from the seat jets
  TUB.tubWater.getWorldPosition(_pl);
  const steam = smoothstep(29, 40, TUB.temp) * (0.4 + 0.6 * night) * (TUB.level > 0.2 ? 1 : 0);
  if (FX.spawn && rng() < dt * 10 * steam) FX.spawn(_pl.x + rand(-0.9, 0.9), _pl.y + 0.05, _pl.z + rand(-0.9, 0.9), U.uWindDir.value.x * 0.3, rand(0.2, 0.5), U.uWindDir.value.y * 0.3, rand(2, 3.5), rand(0.5, 1.0), 2, -0.04);
  if ((bub || jet) && FX.spawn && rng() < dt * 25) FX.spawn(_pl.x + rand(-1, 1), _pl.y + 0.02, _pl.z + rand(-1, 1), 0, rand(0.3, 0.8), 0, 0.3, 0.03, 0, 4);
  // sound: the bubbling and the jets, louder when you're near
  const d = Math.hypot(camera.position.x - _pl.x, camera.position.z - _pl.z), near = 1 / (1 + (d / 4) ** 2);
  if (AUDIO.bubbles) AUDIO.bubbles((bub * 0.5 + jet) * near, jet);
  // the readout once a second
  TUB.scrT = (TUB.scrT || 0) - dt; if (TUB.scrT <= 0) { TUB.scrT = 1; drawTubScreen(); if (TUB.panelOpen) syncTubPanel(); }
  updatePump(dt);
}

function poolClimbOut() {
  if (P.climb) return;
  const l = worldToCabin(P.pos.x, P.pos.z), w = poolWhere(P.pos.x, P.pos.z);
  let tx, tz;
  if (w === 'tub') { const a = Math.atan2(l.z - TUBB.z, l.x - TUBB.x); tx = TUBB.x + Math.cos(a) * (TUBB.R + 0.55); tz = TUBB.z + Math.sin(a) * (TUBB.R + 0.55); }
  else {
    // the nearest edge of the pool, and a step beyond it onto the deck
    const opts = [[POOLB.x0 - 0.5, clamp(l.z, POOLB.z0 + 0.3, POOLB.z1 - 0.3), l.x - POOLB.x0], [POOLB.x1 + 0.5, clamp(l.z, POOLB.z0 + 0.3, POOLB.z1 - 0.3), POOLB.x1 - l.x], [clamp(l.x, POOLB.x0 + 0.3, POOLB.x1 - 0.3), POOLB.z0 - 0.5, l.z - POOLB.z0], [clamp(l.x, POOLB.x0 + 0.3, POOLB.x1 - 0.3), POOLB.z1 + 0.5, POOLB.z1 - l.z]];
    opts.sort((a, b) => a[2] - b[2]); [tx, tz] = opts[0];
  }
  const t = cabinToWorld(tx, 0, tz);
  P.climb = { from: P.pos.clone(), to: new THREE.Vector3(t.x, CABIN.floor + EYE, t.z), t: 0 };
}
