
// ───────────────────── 16d. A storm lantern and the boat's headlights ─────────────────────
// The lantern is a tool: carry it to light your way at night, hang it from the boat's T-top, or put
// it out. The motorboat has a pair of headlights on its bow (L, or the Lights button). Both light the
// world (real three.js lights), throw glints across the water and, on a misty night, visible beams.
const LIGHTS = {
  lantern: { on: true, where: 'hand', flick: 1, swing: 0, swingV: 0, roll: 0, rollV: 0 },
  head: { on: false, k: 0 },
  lamp: null, spots: [], beams: [], glares: [], vmLantern: null, boatLantern: null, pivot: null,
  pos: new THREE.Vector3(), tmp: new THREE.Vector3(), tmp2: new THREE.Vector3(),
};
// a hurricane lantern: fuel tank, glass globe in a wire guard, a chimney cap and a bail to hang it by
function lanternModel(paint) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.32, 0.33, 0.34, THREE.SRGBColorSpace), roughness: 0.42, metalness: 0.75 });
  const red = paint || new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.62, 0.09, 0.06, THREE.SRGBColorSpace), roughness: 0.38, metalness: 0.35 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.055, 24), red); tank.position.y = 0.028; g.add(tank);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 24).rotateX(Math.PI / 2), red); lip.position.y = 0.056; g.add(lip);
  // the globe, bulging in the middle
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(0.034 + 0.03 * Math.sin(t * Math.PI), t * 0.13)); }
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, emissive: new THREE.Color(1.0, 0.62, 0.25), emissiveIntensity: 0, depthWrite: false });
  const globe = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), glassMat); globe.position.y = 0.06; globe.renderOrder = 8; g.add(globe);
  // the wick's flame
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.32).multiplyScalar(2.2), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10).scale(1, 2.3, 1), flameMat); flame.position.y = 0.105; flame.renderOrder = 9; g.add(flame);
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.02, 12), steel); burner.position.y = 0.075; g.add(burner);
  // guard wires and the side tubes that feed air to the burner
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4, r = 0.072;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.13, 4), steel); w.position.set(Math.cos(a) * r, 0.125, Math.sin(a) * r); g.add(w);
  }
  for (const s of [-1, 1]) { const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 8), red); tube.position.set(s * 0.085, 0.13, 0); g.add(tube); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.003, 4, 24).rotateX(Math.PI / 2), steel); ring.position.y = 0.125; g.add(ring);
  // the cap, chimney and bail handle
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.035, 24), red); cap.position.y = 0.21; g.add(cap);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 16), red); chim.position.y = 0.24; g.add(chim);
  const top = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 16).rotateX(Math.PI / 2), steel); top.position.y = 0.255; g.add(top);
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.0035, 6, 24, Math.PI), steel); bail.position.y = 0.2; g.add(bail);
  g.userData = { flame, flameMat, glassMat };
  return g;
}
// a soft round glow for the lamps, seen from the side or head-on
function glareSprite(col) {
  const tex = canvasTex(64, 64, c => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.renderOrder = 9; return s;
}
function buildLights() {
  // the lantern's light, wherever the lantern is
  const lamp = new THREE.PointLight(0xffa04a, 0, 24, 2); scene.add(lamp); LIGHTS.lamp = lamp;
  // carried in your left hand
  const vm = TOOL.vm;
  if (vm.grp) {
    const l = lanternModel(); l.scale.setScalar(1.05); l.visible = false; vm.grp.add(l); vm.lantern = l; LIGHTS.vmLantern = l;
    // its own flame lights the lantern you're holding
    const vl = new THREE.PointLight(0xffa04a, 0, 1.5, 2); vl.position.set(0, 0.12, 0.09); l.add(vl); LIGHTS.vmLamp = vl;
  }
  // its spot on the boat: hanging under the back of the T-top
  const b = BOATS.motor;
  if (b && b.mesh.userData.inner) {
    const inner = b.mesh.userData.inner;
    const pivot = new THREE.Group(); pivot.position.set(0, 2.42, 1.2); pivot.userData.noGhost = true; inner.add(pivot); LIGHTS.pivot = pivot;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.3 })); pivot.add(hook);
    const bl = lanternModel(); bl.position.y = -0.31; bl.visible = false; pivot.add(bl); LIGHTS.boatLantern = bl;
    hook.visible = true;
    // two headlights on the bow flanks, aimed a little down and out
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 0.95, roughness: 0.18 });
    for (const s of [-1, 1]) {
      const z = -2.3, x = s * (hullHalfJS(z) - 0.02), y = 1.12;
      const house = new THREE.Group(); house.position.set(x, y, z); house.rotation.y = s * 0.08; house.userData.noGhost = true; inner.add(house);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 20).rotateX(Math.PI / 2), chrome); house.add(shell);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0x334044 });
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), lensMat); lens.position.z = -0.061; lens.rotation.y = Math.PI; house.add(lens);
      const sp = new THREE.SpotLight(0xfff4e0, 0, 110, 0.36, 0.55, 2);
      sp.position.set(0, 0, -0.08); house.add(sp);
      const tgt = new THREE.Object3D(); tgt.position.set(s * 2.0, -1.6, -30); house.add(tgt); sp.target = tgt;
      // the beam you can see in mist and rain
      const len = 34, rad = Math.tan(0.36) * len;
      const bg = new THREE.ConeGeometry(rad, len, 32, 1, true); bg.translate(0, -len / 2, 0); bg.rotateX(Math.PI / 2);
      const beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uLen: { value: len } },
        vertexShader: /* glsl */`varying vec3 vL; varying vec3 vNv; varying vec3 vVv;
          void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vNv = normalize(normalMatrix * normal); vVv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */`uniform float uK; uniform float uLen; varying vec3 vL; varying vec3 vNv; varying vec3 vVv;
          void main(){ float t = clamp(-vL.z / uLen, 0.0, 1.0);
            float edge = pow(abs(dot(normalize(vNv), normalize(vVv))), 1.6);
            float a = uK * edge * pow(1.0 - t, 2.2) * smoothstep(0.0, 0.04, t);
            gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a, 0.0); }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }));
      beam.rotation.set(-Math.atan2(1.6, 30), s * 0.0, 0); beam.position.z = -0.06; beam.renderOrder = 9; beam.frustumCulled = false; beam.visible = false; house.add(beam);
      const gl = glareSprite(0xfff1d8); gl.position.z = -0.12; gl.visible = false; house.add(gl);
      LIGHTS.spots.push(sp); LIGHTS.beams.push(beam); LIGHTS.glares.push({ s: gl, lens: lensMat, house });
    }
  }
  const lg = glareSprite(0xffb366); lg.visible = false; scene.add(lg); LIGHTS.lanternGlare = lg;
  // "Take the lantern" when it hangs on the boat
  LIGHTS.take = { x: 0, z: 0, y: -99, r: 1.5, label: 'Take the lantern', short: 'Lantern', kind: 'lantern', takeLantern: true, anyMode: false };
}
// what holding the lantern and pressing F (or Use) does
function nearBoatForLantern() {
  const b = BOATS.motor; if (!b || !LIGHTS.pivot) return false;
  if (P.mode === 'boat') return true;
  return DECK.boat === b || Math.hypot(P.pos.x - b.mesh.position.x, P.pos.z - b.mesh.position.z) < 4.2;
}
function useLantern() {
  const L = LIGHTS.lantern;
  if (L.where === 'boat') { takeLantern(); return; }
  if (nearBoatForLantern()) {
    L.where = 'boat'; L.on = true; L.swing = 0.3; L.swingV = 0;
    if (AUDIO.door) AUDIO.door('latch', false);
    showActivityHint('Lantern hung on the boat', false, 2.2);
  } else {
    L.on = !L.on;
    showActivityHint(L.on ? 'Lantern lit' : 'Lantern out', false, 1.6);
  }
  updateToolButtons();
}
function takeLantern() {
  const L = LIGHTS.lantern; if (L.where !== 'boat') return;
  L.where = 'hand'; L.on = true;
  if (TOOL.cur !== 'lantern') setTool('lantern');
  showActivityHint('Got the lantern back', false, 1.6);
  updateToolButtons();
}
function toggleHeadlights(on = !LIGHTS.head.on) {
  LIGHTS.head.on = on;
  if (AUDIO.beep) AUDIO.beep(on ? 880 : 520);
  showActivityHint(on ? 'Headlights on' : 'Headlights off', false, 1.4);
  const tb = $('t-lights'); if (tb) tb.classList.toggle('down', on);
}
// where the held lantern hangs in front of you, and how it swings as you walk
function poseLantern(dt, sway, bob) {
  const l = LIGHTS.vmLantern; if (!l) return;
  const L = LIGHTS.lantern;
  L.swingV += (-L.swing * 18 - L.swingV * 2.2 + (input.lookX || 0) * 0.002 - P.bobAmt * Math.sin(P.bob * 2) * 0.4) * dt;
  L.swing += L.swingV * dt;
  l.position.set(-0.3 + sway, -0.42 + bob, -0.58);
  l.rotation.set(0.12, 0.3, L.swing * 0.5 + 0.05);
}
const _llc = new THREE.Color();
function updateLights(dt, t) {
  if (!LIGHTS.lamp) return;
  const L = LIGHTS.lantern, night = 1 - smoothstep(0.15, 0.6, ENV.daylight);
  // a living flame: a slow breathing and a quick flutter
  L.flick = 0.86 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1) + 0.06 * Math.sin(t * 23.0 + Math.sin(t * 5.0) * 3.0);
  const held = TOOL.cur === 'lantern' && L.where === 'hand' && (P.mode === 'walk' || P.mode === 'boat' || P.mode === 'swim' || P.mode === 'seat') && started;
  const onBoat = L.where === 'boat' && LIGHTS.boatLantern;
  const lit = L.on && (held || onBoat) && !(held && P.eyeUnder);
  // where the light is
  if (held && LIGHTS.vmLantern) {
    LIGHTS.pos.set(-0.3, -0.29, -0.58).applyQuaternion(camera.quaternion).add(camera.position);
  } else if (onBoat) {
    LIGHTS.boatLantern.getWorldPosition(LIGHTS.pos); LIGHTS.pos.y += 0.1;
  }
  LIGHTS.lamp.position.copy(LIGHTS.pos);
  LIGHTS.lamp.intensity = lit ? 4.2 * L.flick * (0.35 + 0.65 * night) : 0;
  // the models: flame and glowing glass
  for (const m of [LIGHTS.vmLantern, LIGHTS.boatLantern]) {
    if (!m) continue; const u = m.userData;
    u.flame.visible = lit; u.flame.scale.set(1, L.flick * 1.1, 1);
    u.glassMat.emissiveIntensity = lit ? (0.6 + 1.6 * night) * L.flick : 0;
  }
  if (LIGHTS.vmLantern) LIGHTS.vmLantern.visible = TOOL.cur === 'lantern' && L.where === 'hand';
  if (LIGHTS.vmLamp) LIGHTS.vmLamp.intensity = held && lit ? 0.5 * L.flick : 0;
  if (LIGHTS.boatLantern) LIGHTS.boatLantern.visible = L.where === 'boat';
  const lg = LIGHTS.lanternGlare;
  lg.visible = lit && onBoat && night > 0.05;
  if (lg.visible) { lg.position.copy(LIGHTS.pos); lg.scale.setScalar(0.9 + 0.2 * L.flick); lg.material.opacity = 0.55 * night * L.flick; }
  // the lantern swings on its hook as the boat rolls and pitches
  if (LIGHTS.pivot) {
    const b = BOATS.motor, pv = LIGHTS.pivot;
    const accRoll = (b.roll - (L.lastRoll ?? b.roll)) / Math.max(dt, 1e-3), accPitch = (b.pitch - (L.lastPitch ?? b.pitch)) / Math.max(dt, 1e-3);
    L.lastRoll = b.roll; L.lastPitch = b.pitch;
    L.rollV += (-(L.roll + b.roll) * 14 - L.rollV * 1.4 - accRoll * 2.5 + (b.yawRate || 0) * Math.abs(b.speed || 0) * 0.08) * dt; L.roll += L.rollV * dt;
    L.swingV += (-(L.swing + b.pitch) * 14 - L.swingV * 1.4 - accPitch * 2.5) * dt * (held ? 0 : 1); if (!held) L.swing += L.swingV * dt;
    pv.rotation.set(clamp(L.swing, -0.8, 0.8), 0, clamp(L.roll, -0.8, 0.8));
    LIGHTS.take.x = LIGHTS.pos.x; LIGHTS.take.z = LIGHTS.pos.z; LIGHTS.take.y = LIGHTS.pos.y - 1.75;
    const inList = INTERACT.includes(LIGHTS.take);
    if (onBoat && !inList) INTERACT.push(LIGHTS.take); else if (!onBoat && inList) INTERACT.splice(INTERACT.indexOf(LIGHTS.take), 1);
  }
  // the headlights
  const H = LIGHTS.head; H.k = damp(H.k, H.on ? 1 : 0, 14, dt);
  const fog = clamp(U.uFogDensity.value / 0.0006, 0, 3), mist = 0.12 + 0.35 * (U.uRain.value || 0) + 0.12 * fog;
  LIGHTS.spots.forEach((sp, i) => {
    sp.intensity = 160 * H.k * (0.3 + 0.7 * night);
    const gl = LIGHTS.glares[i], bm = LIGHTS.beams[i];
    gl.lens.color.setRGB(0.2 + 2.4 * H.k, 0.25 + 2.3 * H.k, 0.27 + 2.1 * H.k);
    gl.s.visible = H.k > 0.01; gl.s.scale.setScalar(0.35 + 0.5 * night); gl.s.material.opacity = H.k * (0.25 + 0.75 * night);
    bm.visible = H.k > 0.01 && night > 0.05; bm.material.uniforms.uK.value = H.k * night * mist * 0.5;
  });
  // the same lights for the water shaders (which do their own lighting)
  const P0 = U.uLLPos.value, C0 = U.uLLCol.value, D0 = U.uLLDir.value;
  P0[0].set(LIGHTS.pos.x, LIGHTS.pos.y, LIGHTS.pos.z, 24); C0[0].set(1.0, 0.64, 0.3, LIGHTS.lamp.intensity * 0.6); D0[0].set(0, -1, 0, -2);
  LIGHTS.spots.forEach((sp, i) => {
    sp.getWorldPosition(LIGHTS.tmp); sp.target.getWorldPosition(LIGHTS.tmp2);
    const d = LIGHTS.tmp2.sub(LIGHTS.tmp).normalize();
    P0[i + 1].set(LIGHTS.tmp.x, LIGHTS.tmp.y, LIGHTS.tmp.z, 110); C0[i + 1].set(1.0, 0.96, 0.88, sp.intensity * 0.5); D0[i + 1].set(d.x, d.y, d.z, Math.cos(0.36));
  });
}
