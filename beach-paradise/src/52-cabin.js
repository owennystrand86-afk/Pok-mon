
// ───────────────────── 29. The log cabin ─────────────────────
// A cabin on log stilts behind the beach, facing the sunset. You start inside it.
// Local space: x to the right, z toward the back (the porch and the sea are at -z), y up from the floor.
const CW = 5.0, CD = 3.5, CWALL = 2.6, CRIDGE = 4.55, CPORCH = 6.0;
const CABIN = {
  x: 0, z: 0, yaw: 0, floor: 0, group: null, fireOn: false, lampsOn: 0, inside: false, spawn: null,
  tea: 0, fan: null, flames: null, glow: null, sleepT: -1, sleepTo: 0,
  uniforms: { uLamps: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, uLampCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, uCabinInv: { value: new THREE.Matrix4().makeTranslation(1e5, 0, 0) }, uDoorOpen: { value: 1 }, uLampFill: { value: new THREE.Vector3() } },
};
const WALLS = []; // solid boxes: { x, z, hx, hz, rot, y0, y1 }
function cabinToWorld(x, y, z) {
  const c = Math.cos(CABIN.yaw), s = Math.sin(CABIN.yaw);
  return { x: CABIN.x + x * c + z * s, y: CABIN.floor + y, z: CABIN.z - x * s + z * c };
}
function worldToCabin(x, z) {
  const dx = x - CABIN.x, dz = z - CABIN.z, c = Math.cos(CABIN.yaw), s = Math.sin(CABIN.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
function insideCabin(x, y, z) {
  if (!CABIN.group || CABIN.destroyed) return false;
  const l = worldToCabin(x, z);
  return Math.abs(l.x) < CW && Math.abs(l.z) < CD && y > CABIN.floor - 0.3 && y < CABIN.floor + CRIDGE;
}
// choose a level-ish spot a little behind the arrival beach, clear of the trail and the river
function cabinSite() {
  const F = LAYOUT.F;
  let best = null;
  for (let fw = -22; fw >= -40; fw -= 2) for (let rt = -10; rt <= 16; rt += 2) {
    const p = LAYOUT.at(fw, rt);
    if (nearTrail(p.x, p.z, 9) || nearStream(p.x, p.z, 14)) continue;
    let lo = 1e9, hi = -1e9;
    CABIN.yaw = SPAWN.yaw; CABIN.x = p.x; CABIN.z = p.z; CABIN.floor = 0;
    for (let z = -CPORCH - 2; z <= CD; z += 1.5) for (let x = -CW; x <= CW; x += 1.5) { const w = cabinToWorld(x, 0, z), h = groundHeight(w.x, w.z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (lo < 1.9) continue;
    const score = (hi - lo) * 1.5 + Math.abs(fw + 26) * 0.12 + Math.abs(rt - 4) * 0.05;
    if (!best || score < best.score) best = { p, hi, lo, score };
  }
  if (!best) { const p = LAYOUT.at(-26, 4); best = { p, hi: groundHeight(p.x, p.z) + 0.5 }; }
  CABIN.x = best.p.x; CABIN.z = best.p.z; CABIN.yaw = SPAWN.yaw; CABIN.floor = best.hi + 0.65;
  const c = cabinToWorld(0, 0, -1); EXCLUDE.push({ x: c.x, z: c.z, r: 10 });
  const st = cabinToWorld(0, 0, -CPORCH - 2); EXCLUDE.push({ x: st.x, z: st.z, r: 4 }); { const dk = cabinToWorld(1, 0, CD + 6.5); EXCLUDE.push({ x: dk.x, z: dk.z, r: 16 }); const dk2 = cabinToWorld(8.5, 0, CD + 4.5); EXCLUDE.push({ x: dk2.x, z: dk2.z, r: 3 }); }
  const sp = cabinToWorld(-2.6, 0, -1.45);
  CABIN.spawn = { x: sp.x, z: sp.z, yaw: SPAWN.yaw };
}

const CABIN_HEAD = /* glsl */`
uniform vec4 uLamps[4]; uniform vec3 uLampFill; uniform vec3 uLampCol[4]; uniform mat4 uCabinInv; uniform float uDoorOpen;
// inside the room: within the walls and under the roof boards
float cabinInside(vec3 wp){ vec3 l = (uCabinInv * vec4(wp, 1.0)).xyz; return step(abs(l.x), 4.98) * step(abs(l.z), 3.48) * step(-0.1, l.y) * step(l.y, 4.55 - 0.557 * abs(l.z) + 0.11); }
float cRect(vec2 q, vec4 r){ return step(r.x, q.x) * step(q.x, r.y) * step(r.z, q.y) * step(q.y, r.w); }
// does sunlight reach this point inside the cabin? only through the windows and the open door
float cabinSunVis(vec3 wp){
  vec3 p = (uCabinInv * vec4(wp, 1.0)).xyz, d = normalize((uCabinInv * vec4(uSunDir, 0.0)).xyz);
  if (d.y <= 0.0) return 0.0;
  float tx = abs(d.x) > 1e-4 ? (sign(d.x) * 5.0 - p.x) / d.x : 1e9;
  float tz = abs(d.z) > 1e-4 ? (sign(d.z) * 3.5 - p.z) / d.z : 1e9;
  float t = min(tx, tz); vec3 e = p + d * t;
  if (e.y > 2.6) return 0.0;
  float v = 0.0;
  if (tz < tx) {
    if (d.z < 0.0) {
      v = max(cRect(e.xy, vec4(-4.45, -1.45, 0.8, 2.15)) * (1.0 - step(abs(e.x + 3.95), 0.03)) * (1.0 - step(abs(e.x + 2.95), 0.03)) * (1.0 - step(abs(e.x + 1.95), 0.03)),
              max(cRect(e.xy, vec4(-0.7, 0.4, -0.1, 2.18)) * uDoorOpen, cRect(e.xy, vec4(2.5, 4.3, 0.85, 2.1)) * (1.0 - step(abs(e.x - 3.4), 0.03))));
      // the porch roof shades the front of the cabin unless the sun is low
      float t2 = (-6.3 - p.z) / d.z; vec3 e2 = p + d * t2;
      if (e2.y > 2.1 && abs(e2.x) < 5.4) v = 0.0;
    } else v = cRect(e.xy, vec4(-3.7, -2.3, 1.05, 1.95)) * (1.0 - step(abs(e.x + 3.0), 0.03));
  } else if (d.x > 0.0) v = cRect(e.zy, vec4(-1.2, 0.6, 0.9, 2.0)) * (1.0 - step(abs(e.z + 0.3), 0.03));
  return v;
}
`;
const CABIN_LIGHT = /* glsl */`
{ vec3 lampL = vec3(0.0);
  for (int i = 0; i < 4; i++) { vec3 d = uLamps[i].xyz - vWPos; lampL += uLampCol[i] * uLamps[i].w / (1.0 + dot(d, d) * 0.75); }
  float ins = cabinInside(vWPos);
  // the lamps and the fire, and the warm light they bounce round the room
  outgoingLight += diffuseColor.rgb * (lampL * mix(0.25, 1.0, ins) + uLampFill * ins); }
`;
// indoors the sky only gets in through the windows, and the sun only where it shines through them
const CABIN_SHADE = /* glsl */`
#include <aomap_fragment>
if (cabinInside(vWPos) > 0.5) {
  float sv = cabinSunVis(vWPos);
  reflectedLight.directDiffuse *= sv; reflectedLight.directSpecular *= sv;
  reflectedLight.indirectDiffuse *= 0.5; reflectedLight.indirectSpecular *= 0.4;
}
`;
const cabinShader = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', CABIN_SHADE); };
function cabinMat(key, o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.85, metalness: o.metal || 0, map: o.map || null, side: o.side || THREE.FrontSide });
  if (o.env) CABIN.envMats.push(m);
  return patch(m, { key, uniforms: CABIN.uniforms, fHead: CABIN_HEAD, fLight: CABIN_LIGHT, onShader: cabinShader, fColor: o.grain ? `{ float gr = texture2D(uNoiseTex, vec2((vWPos.x + vWPos.z) * 0.33, vWPos.y * 2.6)).a; diffuseColor.rgb *= 0.84 + 0.3 * gr; }` : (o.fColor || ''), fNormal: o.fNormal || '' });
}
CABIN.envMats = [];
// a horizontal log from a to b along one axis, with lighter end grain
function logGeo(len, r, color) {
  const g = new THREE.CylinderGeometry(r, r * 0.97, len, 12, 1).toNonIndexed();
  const n = g.attributes.position.count, col = new Float32Array(n * 3), nr = g.attributes.normal;
  const v = rand(0.85, 1.12);
  for (let i = 0; i < n; i++) {
    const cap = Math.abs(nr.getY(i)) > 0.9;
    const c = cap ? [0.55, 0.4, 0.25] : [color[0] * v, color[1] * v, color[2] * v];
    col.set(c, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function cutSpans(from, to, holes, y, r) {
  let segs = [[from, to]];
  for (const o of holes) {
    if (!(y + r * 0.8 > o.y0 && y - r * 0.8 < o.y1)) continue;
    segs = segs.flatMap(([a, b]) => { if (o.b <= a || o.a >= b) return [[a, b]]; const out = []; if (o.a > a) out.push([a, o.a]); if (o.b < b) out.push([o.b, b]); return out; });
  }
  return segs;
}
function buildCabin() {
  const G = { wood: [], dark: [], stone: [], fabric: [], paint: [], metal: [], roof: [], glow: [] };
  const add = (k, g) => G[k].push(g.attributes.color ? g : prep(g));
  const LOG = [0.3, 0.19, 0.11];
  const B = (k, w, h, d, c, x, y, z, rx, ry, rz) => add(k, bx(w, h, d, c, x, y, z, rx, ry, rz));
  const Cy = (k, rt, rb, h, seg, c, x, y, z, rx, ry, rz) => add(k, cy(rt, rb, h, seg, c, x, y, z, rx, ry, rz));
  // --- log walls with openings ---
  const front = [{ a: -4.45, b: -1.45, y0: 0.8, y1: 2.15 }, { a: -0.7, b: 0.4, y0: -1, y1: 2.18 }, { a: 2.5, b: 4.3, y0: 0.85, y1: 2.1 }];
  const back = [{ a: -3.7, b: -2.3, y0: 1.05, y1: 1.95 }, { a: -1.15, b: -0.15, y0: -1, y1: 2.18 }];
  const right = [{ a: -1.2, b: 0.6, y0: 0.9, y1: 2.0 }];
  const r = 0.15;
  for (let k = 0; k < 10; k++) {
    const yF = 0.15 + k * 0.28, yS = 0.29 + k * 0.28;
    if (yF < CWALL) {
      for (const [z, holes] of [[-CD, front], [CD, back]]) for (const [a, b] of cutSpans(-CW - 0.32, CW + 0.32, holes, yF, r)) if (b - a > 0.12) {
        const g = logGeo(b - a, r * rand(0.94, 1.04), LOG); g.rotateZ(Math.PI / 2); g.translate((a + b) / 2, yF, z); add('wood', g);
      }
    }
    if (yS < CWALL) {
      for (const [x, holes] of [[-CW, []], [CW, right]]) for (const [a, b] of cutSpans(-CD - 0.32, CD + 0.32, holes, yS, r)) if (b - a > 0.12) {
        const g = logGeo(b - a, r * rand(0.94, 1.04), LOG); g.rotateX(Math.PI / 2); g.translate(x, yS, (a + b) / 2); add('wood', g);
      }
    }
  }
  // squared sill timbers under the side walls
  for (const x of [-CW, CW]) B('wood', 0.3, 0.16, 2 * CD + 0.5, [0.26, 0.17, 0.1], x, 0.08, 0);
  // gable ends: vertical boards under the roof
  const roofY = z => CRIDGE - (CRIDGE - CWALL) * Math.abs(z) / CD;
  for (const x of [-CW, CW]) for (let z = -CD + 0.1; z < CD; z += 0.21) {
    const h = roofY(z) - CWALL + 0.15; if (h < 0.05) continue;
    B('wood', 0.06, h, 0.2, [0.34, 0.23, 0.14], x, CWALL + h / 2 - 0.05, z);
  }
  // interior partition (planks) with a doorway into the bedroom
  for (let z = -CD + 0.1; z < CD - 0.05; z += 0.17) {
    if (z > -0.55 && z < 0.55) { B('wood', 0.07, CWALL - 2.12, 0.16, [0.4, 0.29, 0.19], 1.8, 2.12 + (CWALL - 2.12) / 2, z); continue; }
    { const v = rand(0.88, 1.1); B('wood', 0.07, CWALL, 0.16, [0.4 * v, 0.29 * v, 0.19 * v], 1.8, CWALL / 2, z); }
  }
  for (const z of [-0.6, 0.6]) B('dark', 0.12, 2.15, 0.08, [0.36, 0.25, 0.16], 1.8, 1.07, z);
  // the back doorway out to the deck
  for (const x of [-1.2, -0.1]) B('dark', 0.1, 2.2, 0.34, [0.36, 0.25, 0.16], x, 1.1, CD);
  B('dark', 1.2, 0.12, 0.34, [0.36, 0.25, 0.16], -0.65, 2.22, CD);
  // floor: planks running front to back over the house and the porch
  for (let x = -CW + 0.09; x < CW; x += 0.18) { const v = rand(0.82, 1.12); B('wood', 0.17, 0.06, CD + CPORCH, [0.36 * v, 0.245 * v, 0.15 * v], x, -0.03, (CD - CPORCH) / 2); }
  for (const z of [-CPORCH + 0.2, -CD, -1, 1.2, CD]) { const g = logGeo(2 * CW + 0.3, 0.13, [0.4, 0.28, 0.18]); g.rotateZ(Math.PI / 2); g.translate(0, -0.2, z); add('wood', g); }
  // stilts down to the sand
  for (const x of [-CW, -1.6, 1.8, CW]) for (const z of [-CPORCH + 0.2, -CD, 0, CD]) {
    const w = cabinToWorld(x, 0, z), g0 = groundHeight(w.x, w.z) - CABIN.floor - 0.3;
    Cy('wood', 0.14, 0.16, -g0, 9, [0.42, 0.3, 0.2], x, g0 / 2 - 0.05, z);
  }
  // roof: two slopes of weathered boards, a ridge log, and a lean-to over the porch
  const slope = (CRIDGE - CWALL) / CD, ang = Math.atan(slope);
  for (const sd of [-1, 1]) for (let t = 0.12; t < CD + (sd < 0 ? 0.35 : 0.8); t += 0.235) {
    const z = sd * t, y = CRIDGE + 0.12 - slope * t;
    const c = [0.13, 0.25, 0.19].map(v => v * rand(0.94, 1.05));
    B('roof', 2 * CW + 1.1, 0.05, 0.27, c, 0, y, z, sd * ang);
  }
  { const g = logGeo(2 * CW + 1.2, 0.13, [0.36, 0.26, 0.17]); g.rotateZ(Math.PI / 2); g.translate(0, CRIDGE + 0.17, 0); add('wood', g); }
  for (const x of [-3.4, -0.9, 1.8, 3.6]) { const g = logGeo(2 * CD + 0.4, 0.11, [0.44, 0.31, 0.2]); g.rotateX(Math.PI / 2); g.translate(x, CWALL - 0.02, 0); add('wood', g); }
  // top plates under the eaves
  for (const z of [-CD, CD]) { const g = logGeo(2 * CW + 0.5, 0.13, [0.42, 0.29, 0.19]); g.rotateZ(Math.PI / 2); g.translate(0, CWALL - 0.03, z); add('wood', g); }
  const pSlope = 0.12, pY = 2.47;
  for (let t = 0.1; t < CPORCH - CD + 0.4; t += 0.235) B('roof', 2 * CW + 0.8, 0.05, 0.27, [0.13, 0.25, 0.19].map(v => v * rand(0.94, 1.05)), 0, pY - pSlope * t, -CD - t, -Math.atan(pSlope));
  for (const x of [-4.85, -1.6, 1.6, 4.85]) Cy('wood', 0.09, 0.1, 2.0, 8, [0.45, 0.32, 0.21], x, 1.0, -CPORCH + 0.2);
  { const g = logGeo(2 * CW + 0.4, 0.1, [0.42, 0.3, 0.2]); g.rotateZ(Math.PI / 2); g.translate(0, 2.0, -CPORCH + 0.2); add('wood', g); }
  for (const x of [-4.85, -1.6, 1.6, 4.85]) B('wood', 0.08, 0.1, CPORCH - CD + 0.2, [0.44, 0.31, 0.2], x, pY - 0.09 - pSlope * ((CPORCH - CD) / 2 - 0.1), -(CD + CPORCH) / 2 + 0.1, -Math.atan(pSlope));
  // porch railing (gap for the steps) and the steps down to the sand
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    for (const y of [0.5, 0.95]) B('wood', 0.07, 0.07, len, [0.55, 0.41, 0.27], (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ry);
    for (let t = 0; t <= 1.001; t += 1 / Math.max(1, Math.round(len / 1.1))) B('wood', 0.09, 1.0, 0.09, [0.5, 0.36, 0.24], lerp(x0, x1, t), 0.5, lerp(z0, z1, t));
    const w0 = cabinToWorld(x0, 0, z0), w1 = cabinToWorld(x1, 0, z1);
    WALLS.push({ ...(() => { const m = cabinToWorld((x0 + x1) / 2, 0, (z0 + z1) / 2); return { x: m.x, z: m.z }; })(), hx: 0.05, hz: len / 2, rot: CABIN.yaw + ry, y0: CABIN.floor - 0.2, y1: CABIN.floor + 1.0 });
  };
  rail(-CW, -CPORCH + 0.05, -1.32, -CPORCH + 0.05); rail(1.32, -CPORCH + 0.05, CW, -CPORCH + 0.05);
  rail(-CW, -CD, -CW, -CPORCH + 0.05); rail(CW, -CD, CW, -CPORCH + 0.05);
  const fw = cabinToWorld(0, 0, -CPORCH - 1.2), groundFront = groundHeight(fw.x, fw.z);
  // a proper staircase down from the porch: deep treads with risers, closed stringers, handrails on
  // posts with balusters, and lanterns on the newel posts at the bottom
  const drop = CABIN.floor - groundFront, nSteps = Math.max(2, Math.ceil(drop / 0.18)), rise = drop / nSteps, run = 0.33, SW = 1.25;
  for (let s = 1; s < nSteps; s++) {
    const y = -s * rise, z = -CPORCH - (s - 0.5) * run;
    B('wood', 2 * SW, 0.055, run + 0.05, [0.56, 0.42, 0.28].map(v => v * rand(0.92, 1.06)), 0, y - 0.027, z);
    B('dark', 2 * SW - 0.08, rise, 0.03, [0.3, 0.21, 0.13], 0, y + rise / 2 - 0.05, z + run / 2);
    const w = cabinToWorld(0, 0, z);
    PLATFORMS.push({ x: w.x, z: w.z, hx: SW, hz: run / 2 + 0.01, rot: CABIN.yaw, top: CABIN.floor + y, wood: true, cabin: true });
  }
  { const len = Math.hypot(nSteps * rise, nSteps * run), ang = -Math.atan2(rise, run), zb = -CPORCH - (nSteps - 0.6) * run, yb = -nSteps * rise;
    for (const x of [-SW - 0.05, SW + 0.05]) {
      B('dark', 0.09, 0.32, len, [0.34, 0.24, 0.15], x, yb / 2 - 0.12, -CPORCH - nSteps * run / 2, ang);
      Cy('wood', 0.075, 0.085, 1.2, 8, [0.45, 0.32, 0.2], x, yb + 0.6, zb);
      B('metal', 0.2, 0.05, 0.2, [0.15, 0.15, 0.16], x, yb + 1.22, zb); B('glow', 0.13, 0.17, 0.13, [1, 0.8, 0.5], x, yb + 1.33, zb); B('metal', 0.2, 0.06, 0.2, [0.15, 0.15, 0.16], x, yb + 1.45, zb);
      const rl = Math.hypot(-yb, -CPORCH - zb + 0.0001);
      B('wood', 0.075, 0.075, Math.hypot(yb, zb + CPORCH), [0.5, 0.36, 0.23], x, yb / 2 + 0.95, (zb - CPORCH) / 2, -Math.atan2(-yb, -(zb + CPORCH)));
      for (let s = 1; s < nSteps; s++) { const y = -s * rise, z = -CPORCH - (s - 0.5) * run; B('wood', 0.035, 0.92, 0.035, [0.48, 0.34, 0.22], x, y + 0.44, z); }
      void rl;
    }
    // stepping stones from the foot of the stairs toward the beach
    for (let k = 0; k < 7; k++) { const z = zb - 1.0 - k * 0.95, xx = Math.sin(k * 1.3) * 0.35, w = cabinToWorld(xx, 0, z), gy = groundHeight(w.x, w.z) - CABIN.floor; Cy('stone', 0.36, 0.4, 0.12, 9, [0.52, 0.5, 0.46].map(v => v * rand(0.85, 1.1)), xx, gy + 0.03, z); }
  }
  // chimney and fireplace on the left wall
  const chimneyBase = (() => { const w = cabinToWorld(-CW - 0.55, 0, 0); return groundHeight(w.x, w.z) - CABIN.floor - 0.2; })();
  const stoneCol = () => { const v = rand(0.62, 1.12), w = rand(-0.03, 0.03); return [0.4 * v + w, 0.38 * v, 0.35 * v - w]; };
  for (let y = chimneyBase; y < CRIDGE + 0.9; y += 0.32) for (let z = -0.5; z < 0.5; z += 0.34) B('stone', 0.95, 0.31, 0.33, stoneCol(), -CW - 0.55 + rand(-0.03, 0.03), y + 0.16, z + 0.17);
  // a fieldstone foundation all the way round, instead of bare stilts
  { const skirt = (x0, z0, x1, z1, skip) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      let row = 0;
      for (let u = 0; u < L - 0.05;) {
        const bl = Math.min(rand(0.42, 0.72), L - u), cxm = x0 + ux * (u + bl / 2), czm = z0 + uz * (u + bl / 2);
        if (!(skip && skip(cxm, czm))) {
          const w = cabinToWorld(cxm, 0, czm), gl = groundHeight(w.x, w.z) - CABIN.floor - 0.3;
          let k = 0;
          for (let y = gl; y < -0.19; y += 0.26, k++) { const hh = Math.min(0.26, -0.19 - y), off = (k + row) % 2 ? 0.06 : -0.06; B('stone', Math.abs(ux) > 0.5 ? bl - 0.03 : 0.34, hh - 0.025, Math.abs(uz) > 0.5 ? bl - 0.03 : 0.34, stoneCol(), cxm + ux * off, y + hh / 2, czm + uz * off); }
        }
        u += bl; row++;
      }
    };
    skirt(-CW - 0.12, -CPORCH, -CW - 0.12, CD + 0.12); skirt(CW + 0.12, -CPORCH, CW + 0.12, CD + 0.12); skirt(-CW - 0.12, CD + 0.12, CW + 0.12, CD + 0.12);
    skirt(-CW - 0.12, -CPORCH - 0.08, CW + 0.12, -CPORCH - 0.08, (x) => Math.abs(x) < SW + 0.15); }
  // flower boxes under the front windows
  for (const [a, b] of [[-4.45, -1.45], [2.5, 4.3]]) {
    B('wood', b - a + 0.1, 0.22, 0.26, [0.36, 0.25, 0.15], (a + b) / 2, 0.68, -CD - 0.28);
    for (let x = a + 0.12; x < b; x += 0.16) { const c = [[0.9, 0.15, 0.2], [0.98, 0.8, 0.2], [0.6, 0.3, 0.75], [0.98, 0.98, 0.95]][(Math.abs(x * 7) | 0) % 4]; add('paint', part(new THREE.IcosahedronGeometry(0.06, 0), c, x, 0.86 + rand(0, 0.06), -CD - 0.28 + rand(-0.06, 0.06))); add('paint', part(new THREE.IcosahedronGeometry(0.08, 0), [0.2, 0.42, 0.15], x + 0.05, 0.8, -CD - 0.28 + rand(-0.05, 0.05))); }
  }
  // lanterns either side of the door
  for (const x of [-1.05, 0.75]) { B('metal', 0.16, 0.05, 0.22, [0.12, 0.12, 0.13], x, 1.72, -CD - 0.2); B('glow', 0.12, 0.2, 0.12, [1, 0.8, 0.5], x, 1.86, -CD - 0.22); B('metal', 0.18, 0.05, 0.18, [0.12, 0.12, 0.13], x, 1.99, -CD - 0.22); }
  // a woodpile against the side wall by the chimney
  for (let row = 0; row < 4; row++) for (let k = 0; k < 7 - row; k++) { const g = logGeo(0.9, rand(0.07, 0.09), [0.42, 0.3, 0.19]); g.rotateX(Math.PI / 2); { const w = cabinToWorld(-CW - 0.5, 0, 1.3 + k * 0.17 + row * 0.085), gy = groundHeight(w.x, w.z) - CABIN.floor; g.translate(-CW - 0.5 - (k % 2) * 0.02, gy + 0.09 + row * 0.15, 1.3 + k * 0.17 + row * 0.085); } add('wood', g); }
  const hearthCol = () => { const v = rand(0.55, 0.85); return [0.36 * v, 0.33 * v, 0.3 * v]; };
  for (let y = 0; y < 1.5; y += 0.25) for (const z of [-0.78, -0.55, 0.55, 0.78]) B('stone', 0.5, 0.24, 0.22, hearthCol(), -CW + 0.3, y + 0.12, z);
  for (let z = -0.8; z < 0.8; z += 0.27) B('stone', 0.5, 0.26, 0.26, hearthCol(), -CW + 0.3, 1.25, z + 0.13);
  B('dark', 0.1, 1.05, 1.0, [0.1, 0.08, 0.07], -CW + 0.08, 0.52, 0);
  B('stone', 1.0, 0.08, 1.9, [0.26, 0.24, 0.22], -CW + 0.55, 0.04, 0);
  B('wood', 0.62, 0.1, 1.95, [0.45, 0.31, 0.2], -CW + 0.3, 1.42, 0);
  for (let i = 0; i < 3; i++) { const g = logGeo(0.55, 0.06, [0.3, 0.2, 0.12]); g.rotateX(Math.PI / 2); g.rotateY(rand(-0.4, 0.4)); g.translate(-CW + 0.36, 0.1 + (i === 2 ? 0.09 : 0), (i - 1) * 0.12); add('dark', g); }
  // --- kitchen along the back wall ---
  const sage = [0.4, 0.5, 0.44];
  B('paint', 3.4, 0.86, 0.6, sage, -3.05, 0.43, CD - 0.32);
  for (let x = -4.6; x < -1.5; x += 0.56) B('paint', 0.5, 0.66, 0.02, sage.map(v => v * 0.86), x + 0.27, 0.45, CD - 0.63);
  B('wood', 3.5, 0.05, 0.66, [0.62, 0.45, 0.28], -3.05, 0.885, CD - 0.33);
  B('metal', 0.72, 0.03, 0.42, [0.55, 0.57, 0.58], -3.0, 0.905, CD - 0.33);
  Cy('metal', 0.015, 0.015, 0.3, 6, [0.7, 0.7, 0.72], -3.0, 1.05, CD - 0.1); B('metal', 0.03, 0.03, 0.18, [0.7, 0.7, 0.72], -3.0, 1.2, CD - 0.18);
  B('dark', 0.62, 0.9, 0.62, [0.12, 0.12, 0.13], -1.65, 0.45, CD - 0.33);
  for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) add('metal', part(new THREE.TorusGeometry(0.07, 0.012, 5, 14).rotateX(Math.PI / 2), [0.22, 0.22, 0.24], -1.65 + dx, 0.91, CD - 0.33 + dz));
  { const kx = -1.79, kz = CD - 0.47; add('paint', part(new THREE.SphereGeometry(0.11, 12, 8).scale(1, 0.8, 1), [0.78, 0.16, 0.1], kx, 1.0, kz)); add('paint', part(new THREE.ConeGeometry(0.025, 0.14, 6), [0.78, 0.16, 0.1], kx + 0.12, 1.03, kz, 0, 0, -1.1)); add('dark', part(new THREE.TorusGeometry(0.07, 0.01, 4, 12, Math.PI), [0.1, 0.1, 0.1], kx, 1.08, kz)); CABIN.kettle = { x: kx + 0.18, y: 1.08, z: kz }; }
  for (const [y, w] of [[1.55, 3.0], [1.95, 3.0]]) { B('wood', w, 0.04, 0.26, [0.55, 0.4, 0.26], -3.05, y, CD - 0.17); }
  const jarCols = [[0.8, 0.55, 0.25], [0.35, 0.55, 0.4], [0.9, 0.85, 0.7], [0.55, 0.3, 0.2], [0.85, 0.7, 0.3]];
  for (let i = 0; i < 9; i++) Cy('fabric', 0.05, 0.05, rand(0.12, 0.22), 10, pick(jarCols), -4.4 + i * 0.36 + rand(-0.05, 0.05), 1.57 + 0.08, CD - 0.17);
  for (let i = 0; i < 6; i++) Cy('paint', 0.11, 0.11, 0.015, 16, [0.92, 0.9, 0.85], -3.9 + i * 0.05, 2.07, CD - 0.12, Math.PI / 2 - 0.15);
  for (let i = 0; i < 4; i++) Cy('fabric', 0.045, 0.04, 0.09, 10, pick([[0.85, 0.35, 0.25], [0.3, 0.45, 0.6], [0.9, 0.9, 0.85]]), -2.6 + i * 0.22, 2.0, CD - 0.17);
  for (const [i, c] of [[0, [0.95, 0.55, 0.1]], [1, [0.95, 0.85, 0.2]], [2, [0.45, 0.65, 0.2]], [3, [0.85, 0.3, 0.15]]]) add('fabric', part(new THREE.SphereGeometry(0.045, 8, 6), c, -4.25 + (i % 2) * 0.08, 0.95 + (i > 1 ? 0.05 : 0), CD - 0.38 + (i % 2) * 0.06));
  Cy('wood', 0.16, 0.11, 0.06, 14, [0.55, 0.38, 0.22], -4.2, 0.93, CD - 0.35);
  // --- dining table and chairs ---
  const tx = -0.35, tz = 2.05;
  B('wood', 1.15, 0.05, 0.78, [0.55, 0.38, 0.23], tx, 0.76, tz);
  for (const [dx, dz] of [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]]) B('wood', 0.05, 0.74, 0.05, [0.45, 0.31, 0.19], tx + dx, 0.37, tz + dz);
  for (const s of [-1, 1]) {
    B('wood', 0.42, 0.04, 0.42, [0.5, 0.35, 0.22], tx + s * 0.82, 0.45, tz);
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) B('wood', 0.035, 0.45, 0.035, [0.45, 0.31, 0.19], tx + s * 0.82 + dx, 0.22, tz + dz);
    B('wood', 0.04, 0.5, 0.42, [0.5, 0.35, 0.22], tx + s * 1.02, 0.72, tz);
  }
  Cy('paint', 0.13, 0.1, 0.05, 16, [0.92, 0.9, 0.86], tx, 0.81, tz);
  for (let i = 0; i < 4; i++) add('fabric', part(new THREE.SphereGeometry(0.04, 8, 6), pick([[0.95, 0.55, 0.1], [0.95, 0.85, 0.2], [0.85, 0.2, 0.15]]), tx + rand(-0.05, 0.05), 0.86, tz + rand(-0.05, 0.05)));
  // hanging lamp over the table
  Cy('dark', 0.006, 0.006, CRIDGE - 1.75, 4, [0.1, 0.1, 0.1], tx, 1.75 + (CRIDGE - 1.75) / 2 - 0.4, tz);
  add('paint', part(new THREE.ConeGeometry(0.2, 0.18, 16, 1, true), [0.2, 0.34, 0.3], tx, 1.75, tz));
  add('glow', part(new THREE.SphereGeometry(0.05, 10, 8), [1, 0.85, 0.6], tx, 1.67, tz));
  // --- living area: sofa, coffee table, floor lamp, bookshelf, window seat ---
  const fab = [0.33, 0.42, 0.5];
  B('fabric', 0.9, 0.42, 2.1, fab, -1.35, 0.21, -0.1);
  B('fabric', 0.22, 0.5, 2.1, fab.map(v => v * 0.92), -0.93, 0.62, -0.1);
  for (const s of [-1, 1]) B('fabric', 0.9, 0.58, 0.2, fab.map(v => v * 0.9), -1.35, 0.29, -0.1 + s * 1.05);
  for (const z of [-0.55, 0.35]) B('fabric', 0.68, 0.14, 0.86, fab.map(v => v * 1.08), -1.4, 0.48, z);
  B('fabric', 0.16, 0.36, 0.36, [0.86, 0.44, 0.32], -1.08, 0.72, -0.7, 0, 0, 0.2);
  B('fabric', 0.16, 0.34, 0.34, [0.85, 0.7, 0.3], -1.08, 0.72, 0.55, 0, 0, 0.15);
  B('wood', 0.62, 0.05, 1.0, [0.52, 0.36, 0.22], -2.9, 0.42, -0.1);
  for (const [dx, dz] of [[-0.25, -0.42], [0.25, -0.42], [-0.25, 0.42], [0.25, 0.42]]) B('wood', 0.05, 0.4, 0.05, [0.45, 0.31, 0.19], -2.9 + dx, 0.2, -0.1 + dz);
  B('fabric', 0.2, 0.04, 0.28, [0.6, 0.2, 0.2], -2.95, 0.465, 0.1); Cy('paint', 0.04, 0.035, 0.09, 10, [0.9, 0.88, 0.82], -2.8, 0.49, -0.35);
  Cy('dark', 0.015, 0.015, 1.45, 6, [0.15, 0.15, 0.15], -1.0, 0.72, -1.55); add('paint', part(new THREE.CylinderGeometry(0.14, 0.22, 0.3, 14, 1, true), [0.9, 0.84, 0.7], -1.0, 1.5, -1.55));
  add('glow', part(new THREE.SphereGeometry(0.045, 10, 8), [1, 0.85, 0.6], -1.0, 1.45, -1.55));
  B('wood', 0.36, 1.95, 1.2, [0.46, 0.32, 0.2], 1.6, 0.98, -2.65);
  for (let s = 0; s < 5; s++) { B('wood', 0.34, 0.03, 1.15, [0.42, 0.29, 0.18], 1.58, 0.2 + s * 0.42, -2.65); for (let b = 0; b < 8; b++) { const h = rand(0.2, 0.32); B('fabric', 0.24, h, rand(0.05, 0.09), pick([[0.6, 0.2, 0.18], [0.2, 0.32, 0.5], [0.3, 0.45, 0.3], [0.75, 0.62, 0.35], [0.85, 0.82, 0.75]]), 1.58, 0.22 + s * 0.42 + h / 2, -3.15 + b * 0.13); } }
  B('wood', 2.9, 0.42, 0.48, [0.5, 0.35, 0.22], -2.95, 0.21, -CD + 0.4);
  B('fabric', 2.85, 0.1, 0.46, [0.88, 0.83, 0.72], -2.95, 0.47, -CD + 0.4);
  for (const x of [-4.1, -3.4, -1.9]) B('fabric', 0.36, 0.34, 0.14, pick([[0.82, 0.42, 0.3], [0.3, 0.5, 0.55], [0.86, 0.72, 0.35]]), x, 0.68, -CD + 0.24, -0.25);
  // --- bedroom ---
  B('wood', 1.75, 0.3, 2.2, [0.45, 0.31, 0.19], 3.4, 0.22, 2.35);
  B('paint', 1.62, 0.2, 2.05, [0.93, 0.92, 0.88], 3.4, 0.46, 2.38);
  B('wood', 1.8, 1.05, 0.08, [0.43, 0.3, 0.19], 3.4, 0.6, CD - 0.08);
  for (const x of [3.0, 3.8]) B('paint', 0.62, 0.14, 0.38, [0.97, 0.96, 0.93], x, 0.62, CD - 0.34, -0.25);
  for (const x of [2.2, 4.6]) { B('wood', 0.44, 0.55, 0.42, [0.48, 0.33, 0.21], x, 0.28, CD - 0.3); }
  Cy('paint', 0.06, 0.08, 0.3, 10, [0.75, 0.7, 0.6], 2.2, 0.7, CD - 0.3); add('paint', part(new THREE.CylinderGeometry(0.1, 0.15, 0.2, 14, 1, true), [0.95, 0.9, 0.78], 2.2, 0.95, CD - 0.3));
  add('glow', part(new THREE.SphereGeometry(0.035, 8, 6), [1, 0.85, 0.6], 2.2, 0.92, CD - 0.3));
  B('wood', 0.62, 2.0, 1.25, [0.46, 0.32, 0.2], 4.66, 1.0, -2.6);
  B('dark', 0.02, 1.8, 0.02, [0.25, 0.17, 0.1], 4.34, 1.0, -2.6);
  Cy('paint', 0.12, 0.09, 0.22, 12, [0.75, 0.38, 0.25], 2.15, 0.11, -3.05); add('fabric', part(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 1.3, 1), [0.25, 0.45, 0.2], 2.15, 0.42, -3.05));
  // window and door frames
  const frame = (x0, x1, y0, y1, z, axis) => {
    const c = [0.62, 0.48, 0.32], th = 0.08, dpt = 0.36;
    if (axis === 'x') { B('wood', x1 - x0 + 0.16, th, dpt, c, (x0 + x1) / 2, y0 - th / 2, z); B('wood', x1 - x0 + 0.16, th, dpt, c, (x0 + x1) / 2, y1 + th / 2, z); B('wood', th, y1 - y0, dpt, c, x0 - th / 2, (y0 + y1) / 2, z); B('wood', th, y1 - y0, dpt, c, x1 + th / 2, (y0 + y1) / 2, z); }
    else { B('wood', dpt, th, x1 - x0 + 0.16, c, z, y0 - th / 2, (x0 + x1) / 2); B('wood', dpt, th, x1 - x0 + 0.16, c, z, y1 + th / 2, (x0 + x1) / 2); B('wood', dpt, y1 - y0, th, c, z, (y0 + y1) / 2, x0 - th / 2); B('wood', dpt, y1 - y0, th, c, z, (y0 + y1) / 2, x1 + th / 2); }
  };
  const glass = [];
  frame(-4.45, -1.45, 0.8, 2.15, -CD, 'x'); glass.push({ cx: -2.95, cy: 1.475, z: -CD, w: 3.0, h: 1.35, axis: 'x', mull: [-3.95, -2.95, -1.95] });
  frame(2.5, 4.3, 0.85, 2.1, -CD, 'x'); glass.push({ cx: 3.4, cy: 1.475, z: -CD, w: 1.8, h: 1.25, axis: 'x', mull: [3.4] });
  frame(-3.7, -2.3, 1.05, 1.95, CD, 'x'); glass.push({ cx: -3.0, cy: 1.5, z: CD, w: 1.4, h: 0.9, axis: 'x', mull: [-3.0] });
  frame(-1.2, 0.6, 0.9, 2.0, CW, 'z'); glass.push({ cx: -0.3, cy: 1.45, z: CW, w: 1.8, h: 1.1, axis: 'z', mull: [-0.3] });
  frame(-0.7, 0.4, 0.0, 2.18, -CD, 'x');
  // porch chairs, a lantern, a mat, string lights
  const chair = (x, z) => {
    B('wood', 0.62, 0.05, 0.6, [0.86, 0.84, 0.78], x, 0.38, z);
    for (let i = 0; i < 5; i++) B('wood', 0.11, 0.85, 0.03, [0.86, 0.84, 0.78], x - 0.24 + i * 0.12, 0.72, z + 0.36, -0.42);
    for (const s of [-1, 1]) { B('wood', 0.08, 0.04, 0.75, [0.86, 0.84, 0.78], x + s * 0.36, 0.62, z + 0.05); B('wood', 0.05, 0.62, 0.05, [0.8, 0.78, 0.72], x + s * 0.36, 0.31, z - 0.25); B('wood', 0.05, 0.42, 0.05, [0.8, 0.78, 0.72], x + s * 0.32, 0.21, z + 0.28); }
  };
  chair(-3.1, -4.85); chair(-1.7, -4.85);
  B('wood', 0.4, 0.42, 0.4, [0.5, 0.35, 0.22], -2.4, 0.21, -4.6);
  add('dark', part(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 8), [0.12, 0.12, 0.12], -2.4, 0.52, -4.6)); add('glow', part(new THREE.SphereGeometry(0.045, 8, 6), [1, 0.8, 0.5], -2.4, 0.53, -4.6));
  B('fabric', 0.9, 0.02, 0.6, [0.55, 0.42, 0.25], -0.15, 0.01, -CD - 0.45);
  for (let i = 0; i < 16; i++) { const x = -4.7 + i * 0.63; add('glow', part(new THREE.SphereGeometry(0.035, 6, 5), [1, 0.82, 0.55], x, 1.97 - Math.sin(((i % 4) / 4) * Math.PI) * 0.08, -CPORCH + 0.32)); }
  // ---- materials and meshes ----
  const group = new THREE.Group(); group.position.set(CABIN.x, CABIN.floor, CABIN.z); group.rotation.y = CABIN.yaw;
  const rugTex = canvasTex(256, 192, g => {
    g.fillStyle = '#7a3a2c'; g.fillRect(0, 0, 256, 192); g.strokeStyle = '#d9b67a'; g.lineWidth = 6; g.strokeRect(12, 12, 232, 168);
    g.fillStyle = '#2f4a5a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(40 + i * 36, 96); g.lineTo(58 + i * 36, 60); g.lineTo(76 + i * 36, 96); g.lineTo(58 + i * 36, 132); g.closePath(); g.fill(); }
    g.strokeStyle = '#e8d6a8'; g.lineWidth = 2; g.strokeRect(24, 24, 208, 144);
  });
  const quiltTex = canvasTex(256, 256, g => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = ['#e9e2d2', '#3d6e78', '#c8744f', '#e9e2d2', '#8aa39a'][(i * 3 + j * 2) % 5]; g.fillRect(i * 32, j * 32, 32, 32); } g.strokeStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); } });
  const mats = {
    wood: cabinMat('cabinWood', { grain: true }), dark: cabinMat('cabinDark', { rough: 0.7 }), stone: cabinMat('cabinStone', { rough: 0.95 }),
    fabric: cabinMat('cabinFabric', { rough: 0.95 }), paint: cabinMat('cabinPaint', { rough: 0.6 }), metal: cabinMat('cabinMetal', { rough: 0.3, metal: 0.6, env: true }),
    roof: cabinMat('cabinRoof', { rough: 0.42, metal: 0.45, side: THREE.DoubleSide, fNormal: '{ vec3 nW = inverseTransformDirection(normal, viewMatrix); if (nW.y < -0.3 || !gl_FrontFacing) { diffuseColor.rgb = vec3(0.4, 0.28, 0.17) * (0.82 + 0.3 * texture2D(uNoiseTex, vec2(vWPos.x * 0.3, (vWPos.z + vWPos.y) * 2.5)).a); metalnessFactor = 0.0; roughnessFactor = 0.8; } }' }),
  };
  CABIN.mats = mats;
  for (const [k, list] of Object.entries(G)) {
    if (!list.length || k === 'glow') continue;
    const m = new THREE.Mesh(mergeGeos(list.map(p => { const q = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'color', 'uv']) q.setAttribute(n, p.attributes[n] || new THREE.Float32BufferAttribute(new Float32Array(p.attributes.position.count * (n === 'uv' ? 2 : 3)), n === 'uv' ? 2 : 3)); return q; })), mats[k]);
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x333333 });
  const glowMesh = new THREE.Mesh(mergeGeos(G.glow.map(p => { const q = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'color', 'uv']) q.setAttribute(n, p.attributes[n]); return q; })), glowMat);
  group.add(glowMesh); CABIN.glow = glowMat;
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9).rotateX(-Math.PI / 2), cabinMatMap('rug', rugTex)); rug.position.set(-2.85, 0.012, -0.1); rug.receiveShadow = true; group.add(rug);
  const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.6), cabinMatMap('quilt', quiltTex)); quilt.position.set(3.4, 0.6, 1.95); quilt.castShadow = quilt.receiveShadow = true; group.add(quilt);
  // window glass with rain running down it
  const glassMat = makeWindowGlass(); CABIN.glassMat = glassMat;
  CABIN.openables = [];
  const sashCol = [0.6, 0.46, 0.3];
  // every window is a pair of casements hinged at the sides that swing out
  for (const g of glass) {
    const sw = g.w / 2, n = g.axis === 'x' ? new THREE.Vector3(0, 0, Math.sign(g.z)) : new THREE.Vector3(1, 0, 0);
    const win = { kind: 'window', open: false, a: 0, sashes: [] };
    for (const side of [-1, 1]) {
      const sash = new THREE.Group();
      const pg = new THREE.PlaneGeometry(sw, g.h), uvA = pg.attributes.uv;
      for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * sw + (side > 0 ? sw : 0), uvA.getY(i) * g.h);
      pg.translate(sw / 2, 0, 0);
      const pane = new THREE.Mesh(pg, glassMat); pane.renderOrder = 8; sash.add(pane);
      const bars = [bx(sw, 0.05, 0.05, sashCol, sw / 2, g.h / 2 - 0.025, 0), bx(sw, 0.05, 0.05, sashCol, sw / 2, -g.h / 2 + 0.025, 0), bx(0.05, g.h, 0.05, sashCol, 0.025, 0, 0), bx(0.05, g.h, 0.05, sashCol, sw - 0.025, 0, 0)];
      if (g.mull.length > 1) bars.push(bx(0.04, g.h, 0.04, sashCol, sw / 2, 0, 0));
      bars.push(bx(sw, 0.03, 0.03, sashCol, sw / 2, 0.02 * side, 0));
      const bm = new THREE.Mesh(mergeGeos(bars.map(p => { const q = new THREE.BufferGeometry(); for (const nm of ['position', 'normal', 'color', 'uv']) q.setAttribute(nm, p.attributes[nm]); return q; })), mats.wood);
      bm.castShadow = true; sash.add(bm);
      // hinge at the outer edge of each half; base rotation points the sash toward the middle
      const hingeAlong = side < 0 ? -g.w / 2 : g.w / 2;
      if (g.axis === 'x') { sash.position.set(g.cx + hingeAlong, g.cy, g.z); sash.rotation.y = side < 0 ? 0 : Math.PI; }
      else { sash.position.set(g.z, g.cy, g.cx + hingeAlong); sash.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2; }
      // open whichever way swings the free end outward
      const base = sash.rotation.y, end = th => new THREE.Vector3(Math.cos(base + th), 0, -Math.sin(base + th));
      const sign = end(1.2).dot(n) > end(-1.2).dot(n) ? 1 : -1;
      win.sashes.push({ g: sash, base, sign });
      group.add(sash);
    }
    const cW = g.axis === 'x' ? cabinToWorld(g.cx, g.cy, g.z) : cabinToWorld(g.z, g.cy, g.cx);
    const along = g.axis === 'x' ? new THREE.Vector3(Math.cos(CABIN.yaw), 0, -Math.sin(CABIN.yaw)) : new THREE.Vector3(Math.sin(CABIN.yaw), 0, Math.cos(CABIN.yaw));
    const nW = new THREE.Vector3(n.x, 0, n.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), CABIN.yaw);
    win.it = { x: cW.x, z: cW.z, y: CABIN.floor, r: 0, label: 'Open the window', short: 'Open', kind: 'window', action: true, cabin: true, open: win,
      aim: { c: new THREE.Vector3(cW.x, cW.y, cW.z), n: nW, a: along, hw: g.w / 2, hh: g.h / 2 } };
    INTERACT.push(win.it);
    CABIN.openables.push(win);
  }
  // the front door, hinged on its right-hand side, opening inward
  {
    const dg = prep(new THREE.BoxGeometry(1.06, 2.14, 0.05), [0.42, 0.28, 0.17], {}, 0.05); dg.translate(-0.53, 0, 0);
    const parts = [dg];
    for (const y of [-0.6, 0.0, 0.6]) parts.push(bx(1.0, 0.1, 0.07, [0.36, 0.24, 0.15], -0.53, y, 0));
    parts.push(bx(0.08, 1.9, 0.07, [0.36, 0.24, 0.15], -0.53, 0, 0, 0, 0, 0.53));
    const knob = cy(0.03, 0.03, 0.08, 8, [0.15, 0.13, 0.1], -0.95, 0, 0.05, Math.PI / 2); parts.push(knob);
    const dm = new THREE.Mesh(mergeGeos(parts.map(p => { const q = new THREE.BufferGeometry(); for (const nm of ['position', 'normal', 'color', 'uv']) q.setAttribute(nm, p.attributes[nm]); return q; })), mats.wood);
    dm.castShadow = dm.receiveShadow = true;
    const hinge = new THREE.Group(); hinge.position.set(0.4, 1.08, -CD + 0.05); hinge.add(dm); group.add(hinge);
    const door = { kind: 'door', open: true, a: 1, hinge };
    const cW = cabinToWorld(-0.15, 1.09, -CD);
    door.it = { x: cW.x, z: cW.z, y: CABIN.floor, r: 0, label: 'Close the door', short: 'Close', kind: 'door', action: true, cabin: true, open: door,
      aim: { c: new THREE.Vector3(cW.x, cW.y, cW.z), n: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), CABIN.yaw), a: new THREE.Vector3(Math.cos(CABIN.yaw), 0, -Math.sin(CABIN.yaw)), hw: 0.62, hh: 1.1 } };
    INTERACT.push(door.it);
    CABIN.openables.push(door); CABIN.door = door;
  }
  // ceiling fan, fire
  const fan = new THREE.Group(); fan.position.set(-1.8, CWALL - 0.12, -0.1);
  fan.add(new THREE.Mesh(prep(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 12), [0.25, 0.2, 0.15]), mats.dark));
  fan.add(new THREE.Mesh(prep(new THREE.CylinderGeometry(0.012, 0.012, CRIDGE - CWALL + 0.2, 6).translate(0, (CRIDGE - CWALL + 0.2) / 2, 0), [0.15, 0.12, 0.1]), mats.dark));
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(prep(new THREE.BoxGeometry(0.58, 0.012, 0.13).translate(0.38, -0.04, 0), [0.42, 0.3, 0.19]), mats.wood); b.rotation.y = i * Math.PI / 2; b.rotation.x = 0.08; fan.add(b); }
  group.add(fan); CABIN.fan = fan;
  CABIN.flames = makeFlames(); CABIN.flames.position.set(-CW + 0.38, 0.08, 0); group.add(CABIN.flames);
  scene.add(group); group.updateMatrixWorld(true);
  CABIN.group = group;
  CABIN.uniforms.uCabinInv.value.copy(group.matrixWorld).invert();
  // collisions: outer walls (gap at the door), partition, furniture, under the floor
  const wallBox = (x0, x1, z0, z1, y1 = CRIDGE, y0 = -0.2) => { const c = cabinToWorld((x0 + x1) / 2, 0, (z0 + z1) / 2); WALLS.push({ x: c.x, z: c.z, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, rot: CABIN.yaw, y0: CABIN.floor + y0, y1: CABIN.floor + y1 }); };
  wallBox(-CW - 0.15, -0.7, -CD - 0.15, -CD + 0.15); wallBox(0.4, CW + 0.15, -CD - 0.15, -CD + 0.15);
  { const c = cabinToWorld(-0.15, 0, -CD); CABIN.doorWall = { x: c.x, z: c.z, hx: 0.56, hz: 0.12, rot: CABIN.yaw, y0: CABIN.floor - 0.2, y1: CABIN.floor + 2.3 }; }
  wallBox(-CW - 0.15, -1.15, CD - 0.15, CD + 0.15); wallBox(-0.15, CW + 0.15, CD - 0.15, CD + 0.15); wallBox(-CW - 0.15, -CW + 0.15, -CD, CD);
  wallBox(-1.15, -0.15, CD - 0.15, CD + 0.15, CRIDGE, 2.18); wallBox(CW - 0.15, CW + 0.15, -CD, CD);
  wallBox(-CW - 1.05, -CW - 0.05, -0.5, 0.5, CRIDGE + 1);
  wallBox(1.76, 1.84, -CD, -0.55); wallBox(1.76, 1.84, 0.55, CD);
  wallBox(-4.75, -1.35, CD - 0.65, CD, 0.95); wallBox(tx - 0.6, tx + 0.6, tz - 0.42, tz + 0.42, 0.8); wallBox(-1.8, -0.85, -1.2, 1.0, 0.7);
  wallBox(-3.2, -2.6, -0.6, 0.4, 0.45); wallBox(1.42, 1.78, -3.25, -2.05, 1.95); wallBox(-4.4, -1.5, -CD, -CD + 0.65, 0.5);
  wallBox(2.5, 4.3, 1.25, CD, 0.65); wallBox(1.95, 2.45, CD - 0.55, CD, 0.55); wallBox(4.35, 4.9, CD - 0.55, CD, 0.55); wallBox(4.33, CW, -3.25, -1.95, 2.0);
  wallBox(-CW + 0.02, -CW + 0.6, -0.85, 0.85, 1.4);
  wallBox(-CW - 0.1, CW + 0.1, -CPORCH, CD, -0.05, -4);
  for (const [x, z] of [[-3.1, -4.85], [-1.7, -4.85], [-2.4, -4.6]]) wallBox(x - 0.33, x + 0.33, z - 0.3, z + 0.4, 0.45);
  const fl = cabinToWorld(0, 0, (CD - CPORCH) / 2);
  PLATFORMS.push({ x: fl.x, z: fl.z, hx: CW, hz: (CD + CPORCH) / 2, rot: CABIN.yaw, top: CABIN.floor, wood: true, cabin: true });
  // places to sit, a bed to sleep in, a kettle, the fire
  const seat = (label, short, x, z, eyeX, eyeY, eyeZ, yawLocal, pitch, kind, extra = {}) => {
    const p = cabinToWorld(x, 0, z), e = cabinToWorld(eyeX, eyeY, eyeZ);
    INTERACT.push({ x: p.x, z: p.z, y: CABIN.floor, r: 1.6, label, short, eye: new THREE.Vector3(e.x, e.y, e.z), yaw: CABIN.yaw + yawLocal, pitch, kind, cabin: true, ...extra });
  };
  seat('Sit on the window seat', 'Sit', -2.95, -CD + 0.9, -2.95, 1.35, -CD + 0.5, 0, 0.02, 'bench');
  seat('Sit on the sofa', 'Sit', -2.2, -0.1, -1.4, 1.2, -0.1, Math.PI / 2, -0.1, 'sofa');
  seat('Sit at the table', 'Sit', tx - 0.82, tz - 0.6, tx - 0.82, 1.22, tz, -Math.PI / 2, -0.15, 'chair');
  seat('Sit on the porch', 'Sit', -3.1, -4.4, -3.1, 1.25, -4.75, 0, -0.02, 'chair');
  seat('Sit on the porch', 'Sit', -1.7, -4.4, -1.7, 1.25, -4.75, 0, -0.02, 'chair');
  seat('Go to sleep', 'Sleep', 3.4, 0.9, 3.4, 0.98, 2.95, 0, 0.06, 'bed', { bed: true, standLabel: 'Get up' });
  const k = cabinToWorld(-1.75, 0, CD - 0.9); INTERACT.push({ x: k.x, z: k.z, y: CABIN.floor, r: 1.5, label: 'Put the kettle on', short: 'Tea', kind: 'kettle', action: true, cabin: true });
  const f = cabinToWorld(-CW + 1.4, 0, 0); INTERACT.push({ x: f.x, z: f.z, y: CABIN.floor, r: 1.7, label: 'Let the fire burn down', short: 'Fire', kind: 'fire', action: true, cabin: true });
  CABIN.lampPos = [cabinToWorld(tx, 1.62, tz), cabinToWorld(-1.0, 1.4, -1.55), cabinToWorld(2.2, 0.95, CD - 0.3), cabinToWorld(-CW + 0.45, 0.45, 0)];
}
function cabinMatMap(key, map) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
  return patch(m, { key: 'cabin-' + key, uniforms: CABIN.uniforms, fHead: CABIN_HEAD, fLight: CABIN_LIGHT, onShader: cabinShader });
}
function makeWindowGlass() {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, uIndoor: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vWPos; varying vec3 vN; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWPos = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON}
      uniform vec3 uSpecCol; uniform float uIndoor;
      varying vec2 vUv; varying vec3 vWPos; varying vec3 vN;
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      // one layer of drops sliding down the pane: x = drop, y = trail, z = highlight
      vec3 slide(vec2 uv, float t, float sc){
        vec2 g = uv * vec2(sc, sc * 0.4); vec2 id = floor(g); vec2 st = fract(g);
        float n = h12(id), on = step(0.58, n);
        float y = fract(-t * (0.04 + n * 0.11) + n * 7.0);
        float x = 0.5 + (h12(id + 5.3) - 0.5) * 0.45 + sin(y * 9.0 + n * 30.0) * 0.06;
        vec2 d = (st - vec2(x, y)) * vec2(1.0, 0.42);
        float r = 0.05 + 0.04 * h12(id + 1.7);
        float m = smoothstep(r, r * 0.7, length(d)) * on;
        float hl = m * (1.0 - smoothstep(0.0, r * 0.45, length(d - vec2(-0.3, 0.35) * r)));
        float trail = smoothstep(0.03, 0.0, abs(st.x - x)) * smoothstep(y, y + 0.04, st.y) * (1.0 - smoothstep(y + 0.04, y + 0.4, st.y)) * on;
        vec2 bq = fract(vec2(st.x * 7.0, st.y * 16.0)) - 0.5;
        float beads = smoothstep(0.3, 0.2, length(bq)) * trail * step(0.5, h12(floor(vec2(st.x * 7.0, st.y * 16.0)) + id));
        return vec3(clamp(m + beads * 0.6, 0.0, 1.0), trail, hl + beads * 0.3);
      }
      // still beads that land and sit on the glass
      vec2 speckle(vec2 uv, float t){
        vec2 g = uv * 34.0; vec2 id = floor(g); vec2 st = fract(g) - 0.5; float n = h12(id);
        float life = fract(t * 0.25 + n * 9.0);
        vec2 o = (vec2(h12(id + 3.1), h12(id + 7.7)) - 0.5) * 0.5;
        float r = 0.1 + 0.14 * h12(id + 2.2);
        float m = smoothstep(r, r * 0.6, length(st - o)) * step(0.72, n) * smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.85, 1.0, life));
        float hl = m * (1.0 - smoothstep(0.0, r * 0.5, length(st - o - vec2(-0.3, 0.3) * r)));
        return vec2(m, hl);
      }
      void main(){
        vec3 V = normalize(cameraPosition - vWPos); vec3 N = normalize(vN); if (dot(N, V) < 0.0) N = -N;
        float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 refl = skyHaze(reflect(-V, N));
        float rain = smoothstep(0.02, 0.4, uRain + uWet * 0.3);
        vec2 uv = vUv * vec2(0.55, 0.9);
        vec3 a = slide(uv, uTime, 9.0), b = slide(uv + 0.37, uTime * 1.3, 14.0);
        vec2 sp = speckle(uv, uTime);
        float m = clamp(a.x + b.x * 0.8 + sp.x, 0.0, 1.0) * rain;
        float hl = clamp(a.z + b.z * 0.8 + sp.y, 0.0, 1.0) * rain;
        float wetSheen = clamp(a.y + b.y, 0.0, 1.0) * rain * 0.25;
        // drops act like tiny lenses: a dark refracted core with a bright highlight where they catch the light
        float lightK = 0.25 + 0.75 * uDaylight + uIndoor * 0.5;
        vec3 hlCol = mix(vec3(0.85, 0.9, 0.95) * lightK, vec3(1.0, 0.82, 0.6), uIndoor * (1.0 - uDaylight) * 0.6);
        vec3 pm = refl * F * 0.9 + hlCol * hl * 0.7 + vec3(0.04, 0.05, 0.06) * m * 0.3 + vec3(0.55, 0.62, 0.68) * lightK * wetSheen * 0.3 + uSpecCol * hl * 0.25;
        float alpha = clamp(0.04 + F * 0.55 + m * 0.3 + hl * 0.45 + wetSheen * 0.25, 0.0, 0.85);
        vec3 col = pm / max(alpha, 1e-3);
        col = applyFog(col, vWPos, 1.0);
        gl_FragColor = vec4(outCol(col), alpha);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  return m;
}
function makeFlames() {
  const grp = new THREE.Group();
  // flames: tongues of fire, each one licking up with its own rhythm; drawn hot white-yellow at the
  // root, orange in the middle, deep red at the ragged tips
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uOn: { value: 1 }, uSeed: { value: 0 } },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying float vSeed; attribute float aSeed;
      void main(){ vUv = uv; vSeed = aSeed; vec3 p = position;
        p.x += sin(uTime * (3.0 + aSeed * 2.0) + p.y * 6.0 + aSeed * 9.0) * 0.04 * uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `${COMMON} uniform float uOn; varying vec2 vUv; varying float vSeed;
      void main(){
        vec2 uv = vUv; float t = uTime * (1.0 + vSeed * 0.4);
        float n = texture2D(uNoiseTex, vec2(uv.x * 0.8 + vSeed, uv.y * 0.55 - t * 1.6)).r;
        float n2 = texture2D(uNoiseTex, vec2(uv.x * 2.1 + 0.3 + vSeed, uv.y * 1.3 - t * 2.7)).g;
        float n3 = texture2D(uNoiseTex, vec2(uv.x * 4.0 + vSeed * 3.0, uv.y * 2.4 - t * 4.1)).b;
        float w = (0.5 - abs(uv.x - 0.5)) * 2.0;
        float flame = w * (1.0 - uv.y * 0.9) + (n * 0.55 + n2 * 0.4 + n3 * 0.2) * 0.85 - 0.62 - uv.y * 0.35;
        float f = smoothstep(0.0, 0.35, flame) * smoothstep(0.0, 0.08, uv.y) * uOn;
        float core = smoothstep(0.25, 0.65, flame);
        vec3 col = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.42, 0.06), smoothstep(0.0, 0.5, f));
        col = mix(col, vec3(1.0, 0.86, 0.5), core);
        gl_FragColor = vec4(outCol(col * f * 2.2), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 10; i++) {
    const w = rand(0.32, 0.6), h = i < 3 ? rand(0.85, 1.05) : rand(0.5, 0.85);
    const g = new THREE.PlaneGeometry(w, h).translate(rand(-0.14, 0.14), h / 2 - 0.02, rand(-0.2, 0.2));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(4).fill(rng()), 1));
    const p = new THREE.Mesh(g, mat); p.rotation.y = i * Math.PI / 10 * 2 + rand(-0.2, 0.2); p.renderOrder = 9; grp.add(p);
  }
  // the glow of the fire itself, filling the firebox with orange light
  { const tex = canvasTex(64, 64, c => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,190,110,1)'); g.addColorStop(0.35, 'rgba(255,120,40,0.45)'); g.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.scale.set(1.5, 1.2, 1); glow.position.y = 0.35; glow.renderOrder = 9; grp.add(glow); grp.userData.glow = glow; }
  // the logs, charred on top, with hot cracks glowing through the char and a bed of embers
  const logMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uOn: { value: 1 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON} uniform float uOn; varying vec3 vP; varying vec3 vN;
      void main(){
        float cr = texture2D(uNoiseTex, vP.xz * 6.0 + vP.y * 3.0).a;
        float pulse = 0.75 + 0.25 * sin(uTime * 3.0 + vP.x * 20.0) * sin(uTime * 1.7 + vP.z * 13.0);
        float crack = smoothstep(0.62, 0.8, cr) * uOn * pulse;
        float under = smoothstep(0.08, -0.05, vP.y) * uOn * 0.6;
        vec3 c = vec3(0.05, 0.035, 0.03) * (0.6 + 0.4 * max(vN.y, 0.0));
        c += vec3(1.0, 0.32, 0.05) * crack * 1.6 + vec3(1.0, 0.25, 0.04) * under;
        gl_FragColor = vec4(outCol(c), 1.0); }`,
  });
  for (const [ry, y, len] of [[0.5, 0.06, 0.62], [-0.55, 0.06, 0.6], [0.05, 0.15, 0.58]]) {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, len, 10).rotateZ(Math.PI / 2).rotateY(ry), logMat); lg.position.y = y; grp.add(lg);
  }
  const bed = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { ...U, uOn: logMat.uniforms.uOn },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${COMMON} uniform float uOn; varying vec2 vUv;
      void main(){ float n = texture2D(uNoiseTex, vUv * 3.0 + uTime * 0.02).r; float glow = smoothstep(0.45, 0.85, n) * (1.0 - length(vUv - 0.5) * 1.6) * (0.7 + 0.3 * sin(uTime * 2.0 + n * 20.0));
        gl_FragColor = vec4(outCol(vec3(0.05, 0.04, 0.035) + vec3(1.0, 0.28, 0.04) * max(glow, 0.0) * 1.4 * uOn), 1.0); }` }));
  bed.position.y = 0.012; grp.add(bed);
  grp.userData.mat = mat; grp.userData.logMat = logMat;
  return grp;
}
const _cabOp = new THREE.Vector3();
function updateCabin(dt, t) {
  if (!CABIN.group) return;
  if (CABIN.destroyed) { CABIN.inside = false; return; }
  const night = 1 - smoothstep(0.25, 0.6, ENV.daylight);
  CABIN.lampsOn = damp(CABIN.lampsOn, night > 0.5 ? 1 : (WX.cur.dark > 0.45 ? 0.7 : 0), 2, dt);
  if (!CABIN.fireManual) CABIN.fireOn = night > 0.6 || (WX.cur.rain > 0.5 && night > 0.2);
  const fireK = CABIN.fireOn ? 1 : 0;
  const flick = 0.8 + 0.13 * Math.sin(t * 11.3) * Math.sin(t * 5.7 + 1) + 0.07 * Math.sin(t * 23.0 + Math.sin(t * 3.1) * 2) + 0.05 * Math.sin(t * 37.0);
  const L = CABIN.uniforms.uLamps.value, LC = CABIN.uniforms.uLampCol.value;
  const lamp = [1.35, 0.95, 0.85].map(v => v * CABIN.lampsOn);
  for (let i = 0; i < 3; i++) { const p = CABIN.lampPos[i]; L[i].set(p.x, p.y, p.z, lamp[i]); LC[i].set(1.0, 0.56, 0.24); }   // warm tungsten
  const fp = CABIN.lampPos[3]; L[3].set(fp.x + Math.sin(t * 5.3) * 0.05, fp.y + Math.sin(t * 3.1) * 0.04, fp.z + Math.sin(t * 4.2) * 0.05, 2.4 * flick * CABIN.flames.userData.mat.uniforms.uOn.value); LC[3].set(1.0, 0.45, 0.14);
  { const fo = CABIN.flames.userData.mat.uniforms.uOn.value; CABIN.uniforms.uLampFill.value.set(1.0, 0.6, 0.3).multiplyScalar(0.03 * CABIN.lampsOn + 0.04 * fo * flick);
    const gl = CABIN.flames.userData.glow; if (gl) { gl.material.opacity = fo * (0.3 + 0.25 * flick); gl.scale.set(1.0 + 0.2 * flick, 0.85 + 0.25 * flick, 1); } }
  CABIN.flames.userData.logMat.uniforms.uOn.value = CABIN.flames.userData.mat.uniforms.uOn.value;
  CABIN.glow.color.setScalar(0.25 + CABIN.lampsOn * 1.8);
  CABIN.glassMat.uniforms.uIndoor.value = CABIN.lampsOn;
  CABIN.flames.userData.mat.uniforms.uOn.value = damp(CABIN.flames.userData.mat.uniforms.uOn.value, fireK, 1.5, dt);
  if (fireK && rng() < dt * 9 && FX.spawn) { const e = cabinToWorld(-CW + 0.38, 0.35, rand(-0.15, 0.15)); FX.spawn(e.x, e.y, e.z, rand(-0.05, 0.05), rand(0.4, 0.9), rand(-0.05, 0.05), rand(0.8, 1.6), rand(0.012, 0.025), 4, -0.2); }
  CABIN.fan.rotation.y += dt * 2.4;
  // doors and windows swing
  let openness = 0;
  for (const o of CABIN.openables) {
    o.a = damp(o.a, o.open ? 1 : 0, 4.5, dt);
    const e = o.a * o.a * (3 - 2 * o.a);
    // the outside gets in through an open door or window, more the nearer you are to it
    const op = o.kind === 'door' ? o.hinge : o.sashes[0].g;
    op.getWorldPosition(_cabOp); const dd = _cabOp.distanceTo(camera.position), near = 1 / (1 + (dd / 2.4) * (dd / 2.4));
    if (o.kind === 'door') { o.hinge.rotation.y = e * 1.8; openness += e * (0.25 + 1.1 * near); }
    else { for (const s of o.sashes) s.g.rotation.y = s.base + s.sign * e * 1.25; openness += e * (0.08 + 0.75 * near); }
    o.it.label = o.kind === 'door' ? (o.open ? 'Close the door' : 'Open the door') : (o.open ? 'Close the window' : 'Open the window');
    o.it.short = o.open ? 'Close' : 'Open';
  }
  CABIN.openness = Math.min(1, openness);
  CABIN.uniforms.uDoorOpen.value = CABIN.door ? smoothstep(0.2, 0.9, CABIN.door.a) : 1;
  const dw = CABIN.doorWall, has = WALLS.includes(dw);
  if (CABIN.door && !CABIN.door.open && CABIN.door.a < 0.6 && !has) WALLS.push(dw);
  if (CABIN.door && (CABIN.door.open || CABIN.door.a > 0.6) && has) WALLS.splice(WALLS.indexOf(dw), 1);
  if (CABIN.tea > 0) {
    CABIN.tea -= dt;
    if (CABIN.tea < 24 && rng() < dt * 9 && FX.spawn) { const k = cabinToWorld(CABIN.kettle.x, CABIN.kettle.y, CABIN.kettle.z); FX.spawn(k.x, k.y, k.z, rand(-0.05, 0.05), rand(0.3, 0.55), rand(-0.05, 0.05), rand(1.5, 2.6), rand(0.08, 0.16), 2, -0.05); }
    if (CABIN.tea <= 0 && AUDIO.kettle) AUDIO.kettle(false);
  }
  CABIN.inside = insideCabin(camera.position.x, camera.position.y, camera.position.z);
  // interactions that are actions rather than seats
  for (const it of INTERACT) if (it.kind === 'fire') { it.label = CABIN.fireOn ? 'Let the fire burn down' : 'Light the fire'; }
  for (const it of INTERACT) if (it.kind === 'bed') { const h = ENV.hour; it.label = (h > 19 || h < 6) ? 'Go to sleep until morning' : 'Take a nap'; }
  // sleeping: fade out, let the hours pass, fade back in
  const fade = $('fade');
  if (CABIN.sleepT >= 0) {
    CABIN.sleepT += dt;
    const st = CABIN.sleepT;
    fade.style.opacity = st < 1.6 ? st / 1.6 : st < 3.4 ? 1 : Math.max(0, 1 - (st - 3.4) / 2.2);
    if (st >= 2.2 && !CABIN.slept) { CABIN.slept = true; ENV.hour = CABIN.sleepTo; if (settings.weather === 'auto') { WX.target = pickWeather(); snapWeather(); } }
    if (st > 5.6) { CABIN.sleepT = -1; fade.style.opacity = 0; }
  }
}
function cabinAction(it) {
  if (it.open) { it.open.open = !it.open.open; if (AUDIO.door) AUDIO.door(it.kind, it.open.open); return; }
  if (it.kind === 'kettle') { if (CABIN.tea <= 0) { CABIN.tea = 34; if (AUDIO.kettle) AUDIO.kettle(true); } }
  if (it.kind === 'fire') { CABIN.fireOn = !CABIN.fireOn; CABIN.fireManual = true; if (AUDIO.splash && !CABIN.fireOn) AUDIO.splash(0.2); }
}
function startSleep() {
  const h = ENV.hour;
  CABIN.sleepTo = (h > 19 || h < 6) ? 7.1 : (h + 2) % 24;
  CABIN.sleepT = 0; CABIN.slept = false;
}
