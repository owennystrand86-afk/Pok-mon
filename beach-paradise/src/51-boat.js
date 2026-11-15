
// ───────────────────── 16b. The motorboat ─────────────────────
// A 6 m centre-console boat: a lofted deep-V hull in glossy gelcoat with painted stripes,
// a teak deck, a T-top, stainless rails and an outboard whose propeller really turns.
// Bow toward local -z, keel at y = 0, the transom at z = +2.75.
const HULL = { zs: 2.75, zb: -3.05, beam: 1.12 };
const hullT = z => (HULL.zs - z) / (HULL.zs - HULL.zb);
function hullHalfJS(z) {
  const t = hullT(z); if (t < 0 || t > 1) return -1;
  const b = t < 0.5 ? 1 : Math.pow(Math.max(Math.cos(((t - 0.5) / 0.5) * Math.PI / 2), 0), 0.7);
  return HULL.beam * b * (0.93 + 0.07 * smoothstep(0, 0.15, t)) + 0.02;
}
const HULL_GLSL = /* glsl */`float hullHalf(float z){ float t = (2.75 - z) / 5.8; if (t < 0.0 || t > 1.0) return -1.0; float b = t < 0.5 ? 1.0 : pow(max(cos((t - 0.5) / 0.5 * 1.5707963), 0.0), 0.7); return 1.12 * b * (0.93 + 0.07 * smoothstep(0.0, 0.15, t)) + 0.02; }`;
const sheerY = t => 1.02 + 0.34 * t * t;
const keelY = t => 0.02 + 0.55 * Math.pow(t, 2.2);
const deadrise = t => lerp(0.36, 1.05, smoothstep(0.35, 1, t));
const DECK_Y = 0.52;

// sky and sea reflected in glossy and metal surfaces (there is no environment map)
const GLOSS_HEAD = /* glsl */`
vec3 glossSky(vec3 d){
  vec3 c = mix(skyHaze(d), uSkyZenith, smoothstep(0.02, 0.6, d.y));
  return d.y < 0.0 ? mix(c, uWaterFog * 0.6 + vec3(0.02, 0.06, 0.08) * uDaylight, smoothstep(0.0, -0.22, d.y)) : c;
}`;
const glossLight = (k, metal) => /* glsl */`
{ vec3 nW = inverseTransformDirection(normal, viewMatrix); vec3 Vw = normalize(cameraPosition - vWPos); vec3 Rw = reflect(-Vw, nW);
  float fr = ${metal ? '0.6 + 0.4' : '0.04 + 0.96'} * pow(1.0 - clamp(dot(nW, Vw), 0.0, 1.0), 5.0);
  vec3 sky = glossSky(Rw); ${metal ? 'sky = mix(sky, vec3(dot(sky, vec3(0.33))), 0.65) * diffuseColor.rgb * 1.1 + 0.04;' : ''}
  float sunS = pow(max(dot(Rw, uSunDir), 0.0), 700.0) * 4.0 * smoothstep(-0.05, 0.1, uSunDir.y);
  outgoingLight = outgoingLight * ${metal ? '0.35' : '1.0'} + (sky * ${k.toFixed(2)} + uSunLin * sunS * 0.2) * fr; }`;

function boatMaterials() {
  const stripeColor = /* glsl */`
    if (vPaint > 0.5) {
      float t = clamp((2.75 - vHull.z) / 5.8, 0.0, 1.0);
      float ys = 1.02 + 0.34 * t * t, wl = 0.31 + 0.07 * t, y = vHull.y, e = fwidth(y) * 1.2 + 1e-4;
      vec3 c = vec3(0.93, 0.93, 0.91);
      c = mix(c, vec3(0.72, 0.1, 0.08), smoothstep(wl + 0.065 + e, wl + 0.065 - e, y));      // boot stripe
      c = mix(c, vec3(0.06, 0.1, 0.19), smoothstep(wl + e, wl - e, y));                       // antifouling below the waterline
      float sy = ys - y;
      c = mix(c, vec3(0.04, 0.15, 0.33), smoothstep(0.12 - e, 0.12 + e, sy) * smoothstep(0.26 + e, 0.26 - e, sy)); // sheer stripe
      c = mix(c, vec3(0.75, 0.58, 0.26), smoothstep(0.285 - e, 0.285 + e, sy) * smoothstep(0.305 + e, 0.305 - e, sy));
      diffuseColor.rgb = c;
    }`;
  const hull = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide }), {
    key: 'boatHull',
    vHead: 'attribute vec3 aHull; attribute float aPaint; varying vec3 vHull; varying float vPaint;',
    vEnd: 'vHull = aHull; vPaint = aPaint;',
    fHead: 'varying vec3 vHull; varying float vPaint;' + GLOSS_HEAD,
    fColor: stripeColor,
    fLight: glossLight(0.85, false),
  });
  const teakTex = canvasTex(512, 512, g => {
    for (let i = 0; i < 16; i++) {
      const v = 0.88 + Math.random() * 0.2;
      g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(98 * v)},${Math.round(58 * v)})`; g.fillRect(i * 32, 0, 32, 512);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(70,40,20,${0.05 + Math.random() * 0.08})`; g.fillRect(i * 32 + Math.random() * 30, Math.random() * 512, 1 + Math.random() * 2, 30 + Math.random() * 120); }
      g.fillStyle = '#1b1510'; g.fillRect(i * 32, 0, 3, 512);
    }
  });
  teakTex.wrapS = teakTex.wrapT = THREE.RepeatWrapping;
  const deck = patch(new THREE.MeshStandardMaterial({ map: teakTex, roughness: 0.72 }), { key: 'boatDeck' });
  const metal = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.86, 0.87, 0.88, THREE.SRGBColorSpace), roughness: 0.18, metalness: 1 }), {
    key: 'boatMetal', fHead: GLOSS_HEAD, fLight: glossLight(1.0, true),
  });
  const gloss = patch(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 }), {
    key: 'boatGloss', fHead: GLOSS_HEAD, fLight: glossLight(0.7, false),
  });
  const glass = patch(new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.12, 0.2, 0.22, THREE.SRGBColorSpace), roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false }), {
    key: 'boatGlass', fHead: GLOSS_HEAD, fLight: glossLight(1.0, false),
  });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const nameTex = canvasTex(512, 128, g => {
    g.clearRect(0, 0, 512, 128); g.fillStyle = '#0a2a55'; g.font = 'italic 600 74px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Sea Breeze', 256, 58); g.fillStyle = '#b08a3e'; g.fillRect(120, 104, 272, 5);
  });
  const name = new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return { hull, deck, metal, gloss, glass, glow, name, soft: propMat };
}

// loft a surface through rows of points (one row per hull station)
function loft(rows, paint, flip = false) {
  const cols = rows[0].length, pos = [], idx = [];
  for (const r of rows) for (const p of r) pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return finishBoatGeo(g, paint, [0.93, 0.93, 0.91]);
}
function finishBoatGeo(g, paint, color = [0.93, 0.93, 0.91]) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count;
  g.setAttribute('aHull', new THREE.BufferAttribute(g.attributes.position.array.slice(), 3));
  g.setAttribute('aPaint', new THREE.BufferAttribute(new Float32Array(n).fill(paint ? 1 : 0), 1));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color) { const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(color, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  return g;
}
const withHullAttrs = g => finishBoatGeo(g, false);
function mergeBoat(list) {
  return mergeGeos(list.map(p => {
    const q = new THREE.BufferGeometry(); const n = p.attributes.position.count;
    for (const nm of ['position', 'normal', 'color', 'uv']) q.setAttribute(nm, p.attributes[nm]);
    q.setAttribute('aHull', p.attributes.aHull || new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    q.setAttribute('aPaint', p.attributes.aPaint || new THREE.BufferAttribute(new Float32Array(n), 1));
    return q;
  }));
}
function tube(points, r, color, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return prep(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), r, 7, closed), color);
}

function buildMotorboat() {
  const M = boatMaterials();
  const N = 44, outer = [], top = [[], []];
  const stations = [];
  for (let i = 0; i <= N; i++) {
    const t = Math.min(i / N, 0.999), z = HULL.zs - t * (HULL.zs - HULL.zb), hb = Math.max(0.02, hullHalfJS(z));
    const yk = keelY(t), dr = deadrise(t), ys = sheerY(t);
    const yc = yk + dr * 0.84 * hb;
    stations.push({ t, z, hb, yk, yc, ys });
    const half = [[0.3, yk + dr * 0.3 * hb * 0.93], [0.6, yk + dr * 0.6 * hb * 0.96], [0.84, yc], [0.9, yc + 0.018]];
    const row = [];
    for (let k = half.length - 1; k >= 0; k--) row.push([-half[k][0] * hb, half[k][1], z]);
    row.push([0, yk, z]);
    for (const h of half) row.push([h[0] * hb, h[1], z]);
    outer.push(row);
    for (const s of [-1, 1]) top[s < 0 ? 0 : 1].push([[s * 0.9 * hb, yc + 0.018, z], [s * 0.975 * hb, lerp(yc, ys, 0.5), z], [s * hb, ys, z]]);
  }
  const H = []; // glossy hull parts
  H.push(loft(outer, true), loft(top[0], true, true), loft(top[1], true));
  // the inside of the topsides, the gunwale cap and the foredeck
  const inner = [[], []], cap = [[], []], fore = [];
  for (const st of stations) {
    if (st.t > 0.8) continue;
    for (const s of [-1, 1]) {
      const xi = s * Math.max(0.05, st.hb - 0.08);
      inner[s < 0 ? 0 : 1].push([[xi, DECK_Y, st.z], [xi, st.ys - 0.03, st.z]]);
      cap[s < 0 ? 0 : 1].push([[xi, st.ys - 0.03, st.z], [s * st.hb, st.ys, st.z]]);
    }
  }
  for (const st of stations) if (st.t >= 0.76) fore.push([[-st.hb, st.ys, st.z], [0, st.ys + 0.03, st.z], [st.hb, st.ys, st.z]]);
  H.push(loft(inner[0], false), loft(inner[1], false, true), loft(cap[0], false), loft(cap[1], false, true), loft(fore, false, true));
  // bulkhead closing the cockpit at the foredeck
  { const st = stations.find(s => s.t > 0.8); const w = Math.max(0.05, st.hb - 0.08); H.push(withHullAttrs(bx(2 * w, st.ys - DECK_Y, 0.04, [0.93, 0.93, 0.91], 0, (st.ys + DECK_Y) / 2, st.z))); }
  // transom: a flat face closing the stern
  {
    const st = stations[0], ring = [...outer[0], ...top[1][0].slice(1)].map(p => [p[0], p[1]]);
    const left = top[0][0].slice(1).reverse().map(p => [p[0], p[1]]);
    const outline = [...left, ...ring];
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ShapeGeometry(shape); g.translate(0, 0, st.z);
    H.push(finishBoatGeo(g, true));
    const motorWell = bx(0.6, 0.35, 0.04, [0.93, 0.93, 0.91], 0, 0.82, st.z - 0.02); H.push(withHullAttrs(motorWell));
  }
  // console, leaning post, stern bench, casting platform: moulded in the same gelcoat
  const gel = [0.94, 0.94, 0.92], soft = [], metal = [], glowP = [], dark = [];
  H.push(withHullAttrs(bx(0.86, 0.7, 0.72, gel, 0, DECK_Y + 0.35, -0.5)));
  H.push(withHullAttrs(bx(0.86, 0.32, 0.34, gel, 0, DECK_Y + 0.84, -0.73)));
  const dashM = new THREE.Matrix4().makeRotationX(0.62).premultiply(new THREE.Matrix4().makeTranslation(0, DECK_Y + 0.86, -0.32));
  const onDash = (g, u, v, lift = 0) => { g.translate(u, lift, v); g.applyMatrix4(dashM); return g; };
  H.push(withHullAttrs(onDash(prep(new THREE.BoxGeometry(0.86, 0.06, 0.52), gel), 0, 0)));
  dark.push(onDash(prep(new THREE.BoxGeometry(0.7, 0.012, 0.36), [0.06, 0.065, 0.07]), 0, 0, 0.035));
  for (const u of [-0.2, 0.2]) { dark.push(onDash(prep(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), [0.75, 0.75, 0.77]), u, -0.08, 0.042)); glowP.push(onDash(prep(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 20), [0.85, 0.92, 0.95]), u, -0.08, 0.047)); }
  glowP.push(onDash(prep(new THREE.BoxGeometry(0.28, 0.008, 0.16), [0.1, 0.42, 0.55]), 0, 0.07, 0.044));
  H.push(withHullAttrs(bx(0.74, 0.5, 0.34, gel, 0, DECK_Y + 0.25, 0.78)));
  soft.push(bx(0.8, 0.16, 0.34, [0.9, 0.86, 0.76], 0, DECK_Y + 0.6, 0.8), bx(0.8, 0.42, 0.1, [0.9, 0.86, 0.76], 0, DECK_Y + 0.9, 0.98, 0.12));
  soft.push(bx(0.82, 0.03, 0.36, [0.05, 0.16, 0.33], 0, DECK_Y + 0.69, 0.8));
  H.push(withHullAttrs(bx(1.7, 0.38, 0.55, gel, 0, DECK_Y + 0.19, 2.32)));
  soft.push(bx(1.66, 0.12, 0.52, [0.9, 0.86, 0.76], 0, DECK_Y + 0.44, 2.32), bx(1.66, 0.36, 0.1, [0.9, 0.86, 0.76], 0, DECK_Y + 0.66, 2.58, -0.15));
  // cooler seat in front of the console
  H.push(withHullAttrs(bx(0.75, 0.42, 0.42, gel, 0, DECK_Y + 0.21, -1.25)));
  soft.push(bx(0.78, 0.09, 0.45, [0.9, 0.86, 0.76], 0, DECK_Y + 0.46, -1.25));
  // T-top: stainless frame and a navy canvas top
  for (const s of [-1, 1]) {
    metal.push(tube([[s * 0.4, DECK_Y + 0.02, -0.82], [s * 0.48, 1.6, -0.75], [s * 0.6, 2.42, -0.48]], 0.022, [1, 1, 1]));
    metal.push(tube([[s * 0.4, DECK_Y + 0.02, -0.2], [s * 0.5, 1.6, 0.15], [s * 0.6, 2.42, 1.2]], 0.022, [1, 1, 1]));
    metal.push(tube([[s * 0.6, 2.43, -0.5], [s * 0.62, 2.46, 0.35], [s * 0.6, 2.43, 1.22]], 0.02, [1, 1, 1]));
  }
  metal.push(tube([[-0.6, 2.43, -0.5], [0, 2.45, -0.52], [0.6, 2.43, -0.5]], 0.02, [1, 1, 1]), tube([[-0.6, 2.43, 1.22], [0, 2.45, 1.24], [0.6, 2.43, 1.22]], 0.02, [1, 1, 1]));
  soft.push(bx(1.42, 0.05, 1.88, [0.05, 0.14, 0.3], 0, 2.5, 0.36));
  dark.push(bx(0.42, 0.1, 0.3, [0.08, 0.08, 0.09], 0, 2.42, 0.25));
  glowP.push(bx(1.2, 0.012, 0.02, [0.55, 0.75, 1.0], 0, 2.47, -0.42));
  // bow rails on stanchions, grab rails aft
  for (const s of [-1, 1]) {
    const pts = [];
    for (const st of stations) if (st.t >= 0.5) pts.push([s * Math.max(0.03, st.hb - 0.06), st.ys + 0.3, st.z]);
    pts.push([0, sheerY(0.995) + 0.3, HULL.zb + 0.12]);
    metal.push(tube(pts.filter((_, i) => i % 3 === 0 || i === pts.length - 1), 0.016, [1, 1, 1]));
    for (const st of stations) if (st.t >= 0.5 && Math.round(st.t * N) % 5 === 0) metal.push(prep(new THREE.CylinderGeometry(0.012, 0.014, 0.3, 6).translate(s * Math.max(0.03, st.hb - 0.06), st.ys + 0.15, st.z), [1, 1, 1]));
    metal.push(tube([[s * 0.98, 1.05, 2.5], [s * 0.98, 1.22, 2.2], [s * 0.98, 1.05, 1.9]], 0.014, [1, 1, 1]));
    // cleats and rub rail
    metal.push(prep(new THREE.BoxGeometry(0.04, 0.03, 0.16).translate(s * 0.98, 1.04, 0.6), [1, 1, 1]), prep(new THREE.BoxGeometry(0.04, 0.03, 0.16).translate(s * 0.4, sheerY(0.9) + 0.02, -2.2), [1, 1, 1]));
    const rub = []; for (const st of stations) if (st.t < 0.99) rub.push([s * (st.hb + 0.012), st.ys - 0.02, st.z]);
    dark.push(tube(rub.filter((_, i) => i % 2 === 0), 0.02, [0.12, 0.13, 0.15]));
  }
  // navigation lights: red to port, green to starboard, white all-round on the T-top
  const bowSt = stations.find(s => s.t > 0.86);
  glowP.push(prep(new THREE.BoxGeometry(0.04, 0.06, 0.12).translate(-bowSt.hb - 0.02, bowSt.ys - 0.05, bowSt.z), [1.0, 0.12, 0.08]));
  glowP.push(prep(new THREE.BoxGeometry(0.04, 0.06, 0.12).translate(bowSt.hb + 0.02, bowSt.ys - 0.05, bowSt.z), [0.1, 1.0, 0.3]));
  metal.push(prep(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6).translate(0, 2.68, 1.15), [1, 1, 1]));
  glowP.push(prep(new THREE.SphereGeometry(0.035, 10, 8).translate(0, 2.86, 1.15), [1, 1, 0.95]));
  // the outboard
  const eng = [], engG = [];
  engG.push(prep(new THREE.CapsuleGeometry(0.22, 0.36, 6, 18).rotateX(Math.PI / 2).scale(1.0, 1.3, 1.0).translate(0, 1.36, 3.06), [0.95, 0.95, 0.95]));
  engG.push(prep(new THREE.BoxGeometry(0.4, 0.05, 0.5).translate(0, 1.66, 3.1), [0.2, 0.21, 0.23]));
  engG.push(prep(new THREE.BoxGeometry(0.5, 0.26, 0.72).translate(0, 1.0, 3.06), [0.18, 0.19, 0.21]));
  engG.push(prep(new THREE.BoxGeometry(0.52, 0.04, 0.74).translate(0, 1.14, 3.06), [0.75, 0.12, 0.1]));
  eng.push(prep(new THREE.BoxGeometry(0.22, 0.62, 0.36).translate(0, 0.56, 3.1), [0.16, 0.17, 0.19]));
  eng.push(prep(new THREE.BoxGeometry(0.46, 0.025, 0.46).translate(0, 0.2, 3.12), [0.16, 0.17, 0.19]));
  eng.push(prep(new THREE.CylinderGeometry(0.075, 0.075, 0.44, 12).rotateX(Math.PI / 2).translate(0, 0.05, 3.1), [0.16, 0.17, 0.19]));
  eng.push(prep(new THREE.ConeGeometry(0.075, 0.14, 12).rotateX(-Math.PI / 2).translate(0, 0.05, 2.82), [0.16, 0.17, 0.19]));
  eng.push(prep(new THREE.BoxGeometry(0.03, 0.24, 0.16).translate(0, -0.11, 3.14), [0.16, 0.17, 0.19]));
  eng.push(prep(new THREE.BoxGeometry(0.32, 0.22, 0.2).translate(0, 0.9, 2.86), [0.2, 0.21, 0.23]));
  // fenders for when it's tied up
  const fend = [];
  for (const z of [-1.1, 0.4, 1.8]) {
    fend.push(prep(new THREE.CapsuleGeometry(0.09, 0.32, 4, 12).translate(1.17, 0.62, z), [0.95, 0.95, 0.94]));
    fend.push(prep(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 4).translate(1.1, 0.95, z), C.rope));
  }
  // assemble
  const outerG = new THREE.Group(), grp = new THREE.Group(); grp.position.z = -HULL_CG; outerG.add(grp);
  const mk = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; grp.add(m); return m; };
  mk(mergeBoat(H), M.hull);
  { // teak cockpit floor
    const pts = []; for (const st of stations) if (st.t <= 0.8) pts.push([st.hb - 0.08, st.z]);
    const shape = new THREE.Shape([...pts.map(([x, z]) => new THREE.Vector2(x, -z)), ...pts.slice().reverse().map(([x, z]) => new THREE.Vector2(-x, -z))]);
    const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); g.translate(0, DECK_Y, 0);
    const pa = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 1.12, pa.getZ(i) / 1.6);
    g.computeVertexNormals(); const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
    mk(g, M.deck, false);
  }
  mk(mergeGeos(soft.map(stripGeo)), M.soft);
  mk(mergeGeos(dark.map(stripGeo)), propMat);
  mk(mergeGeos(metal.map(stripGeo)), M.metal);
  mk(mergeGeos(engG.map(stripGeo)), M.gloss);
  mk(mergeGeos(eng.map(stripGeo)), propMat);
  const glowMesh = mk(mergeGeos(glowP.map(stripGeo)), M.glow, false);
  const fenders = mk(mergeGeos(fend.map(stripGeo)), propMat);
  // windscreen
  const ws = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 28, 1, true, Math.PI - 1.0, 2.0), M.glass);
  ws.position.set(0, DECK_Y + 1.18, -0.38); ws.renderOrder = 7; grp.add(ws);
  { const fr = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 28, 2.0).rotateX(Math.PI / 2).rotateY(Math.PI / 2 + 1.0), M.metal); fr.position.set(0, DECK_Y + 1.38, -0.38); grp.add(fr); }
  // the transom name
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), M.name); nm.position.set(0, 0.66, HULL.zs + 0.006); grp.add(nm);
  // steering wheel on the dash, a throttle lever and the spinning propeller
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.013, 8, 32), M.metal));
  for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.01).translate(0.075, 0, 0), M.metal); sp.rotation.z = i * TAU / 3; wheel.add(sp); }
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 12).rotateX(Math.PI / 2), M.gloss));
  wheel.position.set(0, DECK_Y + 0.96, -0.25); wheel.rotation.set(-0.95, 0, 0); grp.add(wheel);
  const throttle = new THREE.Group(); throttle.position.set(0.47, DECK_Y + 0.82, -0.45);
  throttle.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.03).translate(0, 0.1, 0), M.metal));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), propMat); knob.position.y = 0.2; throttle.add(knob);
  grp.add(throttle);
  const prop = new THREE.Group(); prop.position.set(0, 0.05, 3.36);
  for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.01).translate(0, 0.085, 0), M.metal); bl.rotation.y = 0.5; const h = new THREE.Group(); h.rotation.z = i * TAU / 3; h.add(bl); prop.add(h); }
  prop.add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 10).rotateX(Math.PI / 2), M.metal));
  grp.add(prop);
  outerG.userData = { wheel, throttle, prop, fenders, glow: glowMesh, glowMat: M.glow, inner: grp };
  return outerG;
}
function stripGeo(p) { const q = new THREE.BufferGeometry(); for (const n of ['position', 'normal', 'color', 'uv']) q.setAttribute(n, p.attributes[n]); return q; }

// ---- riding the water: a rigid hull resting on eight points along its bottom ----
// (x, height of the bottom there, z) in hull coordinates; the bow points only touch the water in waves
const HULL_PTS0 = [[0, 0.42, -2.7], [-0.5, 0.3, -1.6], [0.5, 0.3, -1.6], [-0.85, 0.14, 0.2], [0.85, 0.14, 0.2], [-0.9, 0.12, 2.3], [0.9, 0.12, 2.3], [0, 0.04, 1.0]];
const REST_WL = 0.36; // where the water sits on the hull when it's calm
const HULL_CG = (() => { let a = 0, m = 0; for (const p of HULL_PTS0) { const s = Math.max(0, REST_WL - p[1]); a += s * p[2]; m += s; } return a / m; })();
const BUOY_K = 9.8 / HULL_PTS0.reduce((a, p) => a + Math.max(0, REST_WL - p[1]), 0);
const HULL_PTS = HULL_PTS0.map(([x, y, z]) => [x, y, z - HULL_CG]); // relative to the centre of gravity
const BUOY_C = 1.6, I_PITCH = 2.6, I_ROLL = 0.55;
function boatPhysics(b, dt, thr) {
  const t = U.uTime.value;
  if (!b.hPrev) { b.hPrev = new Float32Array(HULL_PTS.length); b.hInit = false; b.pv = 0; b.rv = 0; b.vy = b.vy || 0; b.airT = 0; b.dvx = 0; b.dvz = 0; }
  const sp = Math.abs(b.speed || 0);
  const subN = 3, h = dt / subN;
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  // the river's current or a tsunami's flood carries the boat along
  const w0 = b.airT < 0.5 ? waterAt(b.x, b.z) : null;
  const fx0 = w0 ? (w0.fx || 0) : 0, fz0 = w0 ? (w0.fz || 0) : 0, moving = Math.abs(fx0) + Math.abs(fz0) > 0.05;
  b.dvx = damp(b.dvx, fx0 * 0.85, moving ? 1.0 : 2.5, dt); b.dvz = damp(b.dvz, fz0 * 0.85, moving ? 1.0 : 2.5, dt);
  let wet = 0, bowSub = 0;
  for (let k = 0; k < subN; k++) {
    let ay = -9.8, ap = 0, ar = 0; wet = 0;
    for (let i = 0; i < HULL_PTS.length; i++) {
      const [lx, ly, lz] = HULL_PTS[i];
      const wx = b.x + lx * c + lz * s, wz = b.z - lx * s + lz * c;
      const y = b.y + ly - lz * b.pitch + lx * b.roll;
      const hw = k === 0 ? boatWaterLevel(wx, wz, t) : b.hNow[i];
      if (k === 0) { (b.hNow || (b.hNow = new Float32Array(HULL_PTS.length)))[i] = hw; }
      const wvy = b.hInit ? (hw - b.hPrev[i]) / dt : 0;
      const sub = hw - y;
      if (sub <= 0) continue;
      wet++;
      if (i === 0) bowSub = sub;
      const vrel = b.vy - lz * b.pv + lx * b.rv - wvy;
      const a = BUOY_K * (Math.min(sub, 0.9) + 3 * Math.max(sub - 0.6, 0) ** 2) - BUOY_C * vrel;
      ay += a; ap += a * -lz / I_PITCH; ar += a * lx / I_ROLL;
    }
    if (wet) {
      const plane = smoothstep(3, 12, sp);
      ay += plane * 3.2;
      ap += (smoothstep(2.5, 6, sp) - 0.75 * smoothstep(7, 13, sp)) * 1.6 + thr * 0.5 + plane * 0.25;
      ar += (b.yawRate || 0) * Math.min(sp, 14) * 0.13;
    }
    b.vy += ay * h; b.pv += ap * h; b.rv += ar * h;
    if (!wet) { b.pv *= Math.exp(-0.4 * h); b.rv *= Math.exp(-0.8 * h); }
    b.y += b.vy * h; b.pitch += b.pv * h; b.roll += b.rv * h;
    b.pitch = clamp(b.pitch, -0.45, 0.65); b.roll = clamp(b.roll, -0.55, 0.55);
  }
  for (let i = 0; i < HULL_PTS.length; i++) b.hPrev[i] = b.hNow[i];
  b.hInit = true;
  b.x += b.dvx * dt; b.z += b.dvz * dt;
  const gb = groundHeight(b.x, b.z);
  if (gb > b.y - 0.05) { b.y = Math.max(b.y, gb + 0.02); b.vy = Math.max(b.vy, 0); b.speed *= Math.exp(-3 * dt); b.dvx *= Math.exp(-6 * dt); b.dvz *= Math.exp(-6 * dt); }
  // a buried bow slows you down; landing from a jump slams
  if (bowSub > 0.55) b.speed *= 1 - Math.min(0.6, (bowSub - 0.55) * 1.6) * dt * 3;
  if (!wet) b.airT += dt;
  else {
    if (b.airT > 0.12 && b.vy < -1.2) {
      const k = Math.min(1.6, -b.vy / 3 + b.airT);
      const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
      if (FX.splash) { FX.splash(b.x + rx * 1.1, b.y + 0.3, b.z + rz * 1.1, k); FX.splash(b.x - rx * 1.1, b.y + 0.3, b.z - rz * 1.1, k); }
      if (AUDIO.slap) AUDIO.slap(k);
      if (b.driving) { P.shake = Math.min(1, k * 0.8); if (FX.lens && k > 0.8) FX.lens(Math.round(k * 12)); }
    }
    b.airT = 0;
  }
  b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ');
}
// the water under a point of the hull: the sea, the river, the pools or the spring
function boatWaterLevel(x, z, t) {
  const q = STREAM.near && STREAM.near.get(vIndex(x, z));
  if (!q && !(Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 2)) return oceanHeight(x, z, t);
  const w = waterAt(x, z);
  return w.kind === 'river' || w.kind === 'fresh' ? w.level : oceanHeight(x, z, t);
}
function returnBoat() {
  const b = BOATS.motor; if (!b) return;
  b.x = b.home.x; b.z = b.home.z; b.yaw = b.home.yaw; b.speed = 0; b.yawRate = 0; b.vy = 0; b.pv = b.rv = 0; b.dvx = b.dvz = 0; b.pitch = b.roll = 0;
  b.y = oceanHeight(b.x, b.z, U.uTime.value) - REST_WL; b.hInit = false;
}
// moving parts, lights and the water mask, every frame
function updateMotorboatParts(b, dt, thr, steer) {
  const u = b.mesh.userData;
  b.wheelA = damp(b.wheelA || 0, b.driving ? -steer * 2.4 : 0, 6, dt);
  u.wheel.rotation.z = b.wheelA;
  u.throttle.rotation.x = damp(u.throttle.rotation.x, b.driving ? -thr * 0.7 : 0, 8, dt);
  b.propA = (b.propA || 0) + dt * (b.driving ? 8 + Math.abs(thr) * 70 + Math.abs(b.speed) * 2.5 : 0) * Math.sign(b.speed || 1);
  u.prop.rotation.z = b.propA;
  u.fenders.visible = !b.driving && Math.hypot(b.x - b.home.x, b.z - b.home.z) < 3;
  const night = 1 - smoothstep(0.2, 0.55, ENV.daylight);
  u.glowMat.color.setScalar(0.45 + night * 1.6);
  b.mesh.updateMatrixWorld();
  WATER.uBoatInv.value.copy(u.inner.matrixWorld).invert(); WATER.uBoatOn.value = 1;
}
// the hull pushing water aside, the bow throwing spray and the propeller churning a white trail
function boatWaterFX(b, dt, thr) {
  if (b.airT > 0) return;
  const sp = Math.abs(b.speed), fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
  const bowF = HULL_CG + 3.05 - 1.5, sternB = 2.75 - HULL_CG + 0.5;
  b.fxT = (b.fxT || 0) + dt;
  if (b.fxT > 0.066) {
    b.fxT = 0;
    rippleDrop(b.x + fx * bowF, b.z + fz * bowF, 0.8, Math.min(0.18, 0.02 + sp * 0.009), Math.min(0.45, sp * 0.03));
    for (const s of [-1, 1]) rippleDrop(b.x + fx * (bowF - 2.2) + rx * s * 1.15, b.z + fz * (bowF - 2.2) + rz * s * 1.15, 0.6, Math.min(0.14, sp * 0.008), Math.min(0.75, sp * 0.055));
    rippleDrop(b.x - fx * sternB, b.z - fz * sternB, 0.7 + sp * 0.03, 0.03 + Math.abs(thr) * 0.05, Math.min(1, 0.15 + sp * 0.07 + Math.abs(thr) * 0.35));
  }
  if (sp > 3.5) {
    const n = Math.min(14, dt * sp * 10 * Q.particles);
    for (let i = 0; i < n; i++) {
      const s = rng() < 0.5 ? -1 : 1, along = rand(-0.4, 0.6);
      const px = b.x + fx * (bowF + along) + rx * s * (0.55 + along * 0.2), pz = b.z + fz * (bowF + along) + rz * s * (0.55 + along * 0.2);
      sprayDrop(px, b.y + REST_WL + 0.05, pz, rx * s * rand(1.2, 3.2) + fx * sp * 0.35, rand(1.0, 2.8) * Math.min(1.6, sp / 8), rz * s * rand(1.2, 3.2) + fz * sp * 0.35, rand(0.5, 1.0), rand(0.025, 0.06));
    }
  }
  if (Math.abs(thr) > 0.3 && sp < 6 && rng() < dt * 20 * Q.particles) sprayDrop(b.x - fx * sternB + rand(-0.3, 0.3), b.y + REST_WL, b.z - fz * sternB + rand(-0.3, 0.3), -fx * rand(1, 3) + rand(-0.5, 0.5), rand(0.5, 1.6), -fz * rand(1, 3) + rand(-0.5, 0.5), 0.6, rand(0.02, 0.04));
}
