
// ───────────────────── 30. Tsunami ─────────────────────
// Sent from the settings. It forms far out to sea, races in toward the main beach,
// pulls the water back off the sand, then breaks and floods the low ground behind it.
const TSU = { on: false, front: 0, shore: 0, end: 0, A: 7, k: 0, hit: false, warned: false, roar: 0, t: 0 };
const TSU_SIZES = { small: 4, big: 7, huge: 11, mega: 20, extinction: 34 };
function sendTsunami() {
  if (TSU.on && TSU.front < TSU.shore) return;
  const F = LAYOUT.F, dir = { x: -F.x, z: -F.z };
  U.uTsuDir.value.set(dir.x, dir.z);
  TSU.shore = SPAWN.x * dir.x + SPAWN.z * dir.z;
  TSU.A = TSU_SIZES[settings.tsunamiSize] || 7;
  TSU.front = TSU.shore - 760; TSU.end = TSU.shore + 380 + Math.max(0, TSU.A - 7) * 32; // the big ones run right across the island
  TSU.on = true; TSU.k = 0; TSU.hit = false; TSU.warned = false; TSU.t = 0;
  toast(TSU.A >= 20 ? 'A monster tsunami is coming' : 'A tsunami is coming', TSU.A >= 20 ? 'Nothing on the island will be safe' : TSU.A >= 11 ? 'Run for the hills' : 'Watch the sea pull back from the beach');
}
function updateTsunami(dt) {
  const T = U.uTsu.value;
  if (!TSU.on) { T.w = 0; TSU.roar = 0; return; }
  TSU.t += dt;
  const ahead = TSU.shore - TSU.front; // how far the front still has to go to the main beach
  const speed = lerp(16, 50, smoothstep(140, 700, ahead)) * (settings.tsunamiSpeed || 1) * (1 + Math.max(0, TSU.A - 11) * 0.025);
  TSU.front += speed * dt;
  const ending = TSU.front > TSU.end;
  TSU.k = ending ? Math.max(0, TSU.k - dt / 16) : Math.min(1, TSU.k + dt / 4);
  if (ending && TSU.k <= 0) { TSU.on = false; T.w = 0; return; }
  T.set(TSU.front, TSU.A, 55, TSU.k);
  if (!TSU.warned && ahead < 260) { TSU.warned = true; if (P.mode !== 'boat') P.shake = Math.max(P.shake || 0, 0.5); }
  // how loud the roar is where you are
  const d = U.uTsuDir.value;
  const sP = camera.position.x * d.x + camera.position.z * d.y - TSU.front;
  TSU.roar = TSU.k * smoothstep(900, 60, Math.abs(sP)) * (TSU.A / 7);
  // the front reaching you: knocked over, swept along, soaked
  if (!TSU.hit && sP < 6 && sP > -30 && started) {
    const feet = P.mode === 'boat' && P.boat ? P.boat.y + 0.4 : P.pos.y - EYE;
    const lvl = oceanHeight(P.pos.x, P.pos.z, U.uTime.value);
    if (lvl > feet + 0.15 && !(typeof CABIN !== 'undefined' && insideCabin(P.pos.x, P.pos.y, P.pos.z))) {
      TSU.hit = true;
      const k = clamp((lvl - feet) / 2.5, 0.4, 1.6);
      P.dunk = 1; P.shake = 1; if (P.mode !== 'boat') { P.stumble = 1; P.vel.x += d.x * 6 * k; P.vel.z += d.y * 6 * k; P.vel.y += 2 * k; }
      if (FX.lens) FX.lens(Math.round(30 + k * 20));
      if (FX.splash) for (let i = 0; i < 4; i++) FX.splash(P.pos.x + rand(-2, 2), lvl, P.pos.z + rand(-2, 2), 1.6);
      if (AUDIO.waveHit) AUDIO.waveHit(1.8);
    }
  }
  // spray boiling off the front where it breaks near you
  if (FX.spawn && Math.abs(sP) < 140 && TSU.k > 0.3) {
    const n = Math.min(6, dt * 90 * Q.particles);
    for (let i = 0; i < n; i++) {
      const along = rand(-60, 60), px = camera.position.x - d.x * sP + -d.y * along, pz = camera.position.z - d.y * sP + d.x * along;
      const g = groundHeight(px, pz); if (g > 4) continue;
      const y = oceanHeight(px, pz, U.uTime.value); if (y - g < 0.3) continue;
      FX.spawn(px, y + rand(0, 0.6), pz, d.x * rand(4, 9) + rand(-1, 1), rand(2, 6), d.y * rand(4, 9) + rand(-1, 1), rand(0.7, 1.4), rand(0.08, 0.2), 0, 9.8);
      if (rng() < 0.3) FX.spawn(px, y + rand(0.5, 2), pz, d.x * 3, rand(0.5, 1.5), d.y * 3, rand(2, 4), rand(1.2, 3), 2, -0.1);
    }
  }
}
function calmSea() { TSU.on = false; U.uTsu.value.w = 0; TSU.roar = 0; }
// spray blown back off the crest: a soft, churning sheet that follows the crest line near you
const TSPRAY = { mesh: null, N: 64 };
function buildTsunamiSpray() {
  const N = TSPRAY.N, pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= N; i++) { uv.set([i / N, 0, i / N, 1], i * 4); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, uAmt: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON} uniform float uAmt; uniform vec3 uFoamCol; varying vec2 vUv; varying vec3 vW;
      void main(){
        float n1 = texture2D(uNoiseTex, vec2(vUv.x * 9.0, vUv.y * 0.8 - uTime * 0.35)).r;
        float n2 = texture2D(uNoiseTex, vec2(vUv.x * 23.0 + 0.3, vUv.y * 1.6 - uTime * 0.7)).g;
        float body = smoothstep(1.0, 0.05, vUv.y) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float a = body * smoothstep(0.35, 0.8, n1 * 0.6 + n2 * 0.55 - vUv.y * 0.25) * uAmt * 0.75;
        if (a < 0.01) discard;
        vec3 c = uFoamCol * (0.85 + 0.25 * max(dot(normalize(cameraPosition - vW), uSunDir), 0.0));
        c = applyFog(c, vW, 1.0);
        gl_FragColor = vec4(outCol(c) * a, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 9; scene.add(mesh);
  TSPRAY.mesh = mesh;
}
function updateTsunamiSpray() {
  const M = TSPRAY.mesh; if (!M) return;
  const T = U.uTsu.value;
  if (!TSU.on || T.w < 0.05 || P.eyeUnder) { M.visible = false; return; }
  const d = U.uTsuDir.value, px = -d.y, pz = d.x, cam = camera.position;
  const along0 = cam.x * px + cam.z * pz;
  // the crest sits a little behind the front position; find it once at the camera's line
  const crestS = TSU.front - 6, half = 260, N = TSPRAY.N, pos = M.geometry.attributes.position.array;
  let any = false;
  for (let i = 0; i <= N; i++) {
    const a = along0 - half + (i / N) * half * 2;
    const x = d.x * crestS + px * a, z = d.y * crestS + pz * a;
    const g = groundHeight(x, z), e = tsunamiJS(x, z, -g);
    const top = Math.max(e, 0) + 0.2, h = Math.max(0.5, e * 0.55);
    const okHere = e > 0.8 && g < e;
    pos.set([x - d.x * 2, top, z - d.y * 2, x - d.x * (6 + h * 0.8), top + (okHere ? h : 0), z - d.y * (6 + h * 0.8)], i * 6);
    if (okHere) any = true;
  }
  M.geometry.attributes.position.needsUpdate = true;
  M.visible = any;
  M.material.uniforms.uAmt.value = TSU.k * smoothstep(1, 4, TSU.A);
}
