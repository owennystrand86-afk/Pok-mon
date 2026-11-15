
// ───────────────────────────── 7. Sky ─────────────────────────────
const SKY = {
  uCloudTex: { value: null }, uCloudOffset: { value: new THREE.Vector2() }, uCloudDark: { value: 0 },
  uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uStars: { value: 0 }, uRainbow: { value: 0 },
  uSunDisk: { value: v3(1, 0.97, 0.9) }, uCloudLit: { value: v3(1, 1, 1) }, uCloudShade: { value: v3(0.6, 0.65, 0.72) },
  uSkyPhys: { value: 0 }, uSkyCover: { value: v3(0, 0, 0) },
};
function buildSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...SKY },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      uniform sampler2D uCloudTex; uniform vec2 uCloudOffset; uniform float uCloudDark; uniform vec3 uMoonDir;
      uniform float uStars; uniform float uRainbow; uniform vec3 uSunDisk; uniform vec3 uCloudLit; uniform vec3 uCloudShade;
      uniform float uSkyPhys; uniform vec3 uSkyCover;
      varying vec3 vDir;
      // single scattering through the air (Rayleigh, Mie and ozone) plus a little multiple scattering
      float airMass(float y){ y = max(y, 0.0); float deg = degrees(acos(min(1.0, y))); return 1.0 / (y + 0.50572 * pow(max(96.07995 - deg, 0.01), -1.6364)); }
      vec3 atmo(vec3 d, vec3 s){
        const vec3 BR = vec3(5.8e-6, 13.5e-6, 33.1e-6); const float BM = 4e-6; const vec3 OZ = vec3(0.01625, 0.047, 0.002125);
        float mu = dot(d, s), amV = airMass(d.y), amS = airMass(s.y);
        float pr = 0.0596831 * (1.0 + mu * mu);
        float g = 0.72, pm = 0.119366 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
        vec3 ext = BR * 8000.0 + BM * 1200.0 * 1.1;
        vec3 tS = exp(-(ext * 0.8 + OZ) * amS);
        vec3 L = 34.0 * (BR * pr + BM * pm * 0.55) / (BR + BM * 1.1) * (1.0 - exp(-ext * amV)) * tS;
        L += BR * 9000.0 * clamp((s.y + 0.1) * 4.0, 0.0, 1.0) * 0.25 * exp(-OZ * 6.0);
        L = pow(L, vec3(1.08));
        vec3 c = pow(1.0 - exp(-L), vec3(1.0 / 2.2));
        float l = dot(c, vec3(0.3, 0.55, 0.15)); c = mix(vec3(l), c, 1.3);
        return c * mix(vec3(0.92, 0.96, 1.08), vec3(1.0), smoothstep(0.0, 0.25, 1.0 - d.y));   // a deeper blue overhead
      }
      float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      vec3 hash33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
      vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      float cloudN(vec2 uv){ return texture2D(uCloudTex, uv).r * 0.64 + texture2D(uCloudTex, uv * 3.1 + uCloudOffset * 1.7).g * 0.36; }
      void main(){
        vec3 dir = normalize(vDir);
        if (uUnderwater > 0.5) { gl_FragColor = vec4(outCol(uWaterFog), 1.0); return; }
        float y = dir.y, yy = max(y, 0.0);
        vec3 col = mix(uSkyHorizon, uSkyZenith, pow(yy, 0.5));
        float sd = max(dot(dir, uSunDir), 0.0);
        col = mix(col, uSkyGlow, uGlowAmt * pow(sd, 5.0) * 0.7 * mix(1.0, pow(1.0 - yy, 4.0), 0.6));
        col += uSkyGlow * (uGlowAmt * pow(sd, 14.0) * 0.22);
        if (uSkyPhys > 0.001) {
          vec3 ph = atmo(vec3(dir.x, max(dir.y, 0.0) + 0.002, dir.z), uSunDir);
          float l = dot(ph, vec3(0.3, 0.55, 0.15));
          ph = mix(ph, vec3(l) * vec3(0.95, 1.0, 1.06), uSkyCover.x) * (1.0 - uSkyCover.y);   // cloud cover greys and darkens it
          col = mix(col, ph, uSkyPhys);
        }
        float sunUp = smoothstep(-0.03, 0.02, uSunDir.y);
        col += uSunDisk * (pow(sd, 1400.0) * 0.45 + pow(sd, 90.0) * 0.035) * sunUp;
        // clouds on a virtual plane high above the sea
        float cloudA = 0.0, sunCov = 0.0;
        if (y > 0.0) {
          vec2 p = dir.xz / (y + 0.06);
          vec2 uv = p * 0.22 + uCloudOffset;
          float n = cloudN(uv);
          // wispy, broken edges
          n -= (texture2D(uCloudTex, uv * 6.7 - uCloudOffset * 2.3).b - 0.5) * 0.085;
          float cov = mix(0.72, 0.16, uCloudCover);
          float dens = smoothstep(cov, cov + 0.26, n);
          // how much cloud the sunlight has come through to reach this bit: three steps toward the sun
          vec2 so = normalize(uSunDir.xz + vec2(1e-4)) * 0.016;
          float od = max(cloudN(uv + so) - cov, 0.0) + max(cloudN(uv + so * 2.2) - cov, 0.0) * 0.8 + max(cloudN(uv + so * 4.0) - cov, 0.0) * 0.6;
          float beer = exp(-od * 5.5);
          float thick = smoothstep(cov, cov + 0.5, n);
          // bright where the sun reaches, a soft blue-grey in the shade and at the base, never a dark smudge
          vec3 shadeC = mix(uCloudShade, vec3(dot(uCloudShade, vec3(0.3333))) * vec3(0.97, 1.0, 1.05), 0.55);
          vec3 cc = mix(shadeC * 1.04, uCloudLit, 0.3 + 0.7 * beer) * (0.9 + 0.1 * beer);
          cc = mix(cc, shadeC * 0.92, thick * 0.3 * (1.0 - beer));
          // the silver lining: thin edges glow when the sun is behind them
          float thin = (1.0 - thick) * dens;
          cc += uSkyGlow * uGlowAmt * pow(sd, 10.0) * (0.25 + 0.75 * beer) * (1.0 - thick) * 0.3;
          cc += uSunDisk * (pow(sd, 20.0) * 0.22 + pow(sd, 120.0) * 0.5) * (1.0 - thick * 0.85) * beer * sunUp;
          cc *= 1.0 - uCloudDark * 0.55 * thick;
          float fade = smoothstep(0.0, 0.22, y);
          { float ci = texture2D(uCloudTex, p * vec2(0.021, 0.075) + uCloudOffset * 0.35 + 0.31).a * 0.6 + texture2D(uCloudTex, p * vec2(0.06, 0.19) + uCloudOffset * 0.5).r * 0.4;
            float ca = smoothstep(0.58, 0.84, ci) * smoothstep(0.02, 0.3, y) * 0.3 * (1.0 - uCloudCover * 0.6);
            col = mix(col, uCloudLit * (0.92 + 0.08 * pow(sd, 6.0)), ca); }
          cloudA = dens * fade;
          col = mix(col, cc + uLightning * vec3(0.5, 0.52, 0.65) * thick, cloudA);
          // how much cloud is in front of the sun (for the disk)
          vec2 ps = uSunDir.xz / (max(uSunDir.y, 0.0) + 0.06) * 0.22 + uCloudOffset;
          sunCov = smoothstep(cov, cov + 0.24, cloudN(ps));
        } else {
          col = skyHaze(dir);
        }
        // sun disk
        float disk = smoothstep(0.99978, 0.99988, sd) * sunUp * (1.0 - cloudA * 0.92);
        col = mix(col, uSunDisk * (uHDR > 0.5 ? 2.6 : 0.98), disk);
        // night sky: stars, a faint galaxy band, and the moon
        if (uStars > 0.01 && y > 0.0) {
          vec3 sp = dir * 260.0; vec3 cell = floor(sp); vec3 f = fract(sp) - 0.5;
          float h = hash13(cell);
          if (h > 0.984) {
            vec3 o = (hash33(cell) - 0.5) * 0.55;
            float d = length(f - o);
            float tw = 0.65 + 0.35 * sin(uTime * (1.3 + h * 4.0) + h * 70.0);
            col += vec3(0.86, 0.92, 1.0) * smoothstep(0.26, 0.0, d) * tw * (0.5 + (h - 0.984) * 50.0) * uStars * (1.0 - cloudA) * smoothstep(0.0, 0.12, y);
          }
          float mw = exp(-pow(dot(dir, normalize(vec3(0.35, 0.45, -0.82))) / 0.2, 2.0));
          col += vec3(0.42, 0.46, 0.62) * mw * texture2D(uCloudTex, dir.xz * 1.6 + dir.y).g * 0.09 * uStars * (1.0 - cloudA);
          float md = dot(dir, uMoonDir);
          float moon = smoothstep(0.99935, 0.99952, md);
          float crat = texture2D(uNoiseTex, (dir.xz - uMoonDir.xz) * 38.0).r;
          col = mix(col, vec3(0.9, 0.92, 0.96) * (0.72 + 0.35 * crat), moon * uStars * (1.0 - cloudA * 0.85));
          col += vec3(0.55, 0.62, 0.8) * (pow(max(md, 0.0), 600.0) * 0.25 + pow(max(md, 0.0), 24.0) * 0.05) * uStars;
        }
        // rainbow after rain, opposite the sun
        if (uRainbow > 0.01) {
          float ang = acos(clamp(dot(dir, -uSunDir), -1.0, 1.0));
          float t = (ang - 0.703) / 0.036;
          if (t > 0.0 && t < 1.0) col += hue(0.78 * (1.0 - t)) * sin(t * 3.14159) * 0.16 * uRainbow * smoothstep(0.0, 0.06, y) * (1.0 - cloudA * 0.6);
        }
        col += (hash13(vec3(gl_FragCoord.xy, uTime)) - 0.5) / 255.0;
        gl_FragColor = vec4(outCol(col), 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), mat);
  sky.renderOrder = -100; sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

// ───────────────────────────── 8. Water ─────────────────────────────
const WAVES = [
  { L: 64, A: 0.4, ang: 0.15 }, { L: 34, A: 0.24, ang: -0.5 }, { L: 18, A: 0.12, ang: 0.72 },
  { L: 9.6, A: 0.055, ang: -1.1 }, { L: 5.3, A: 0.03, ang: 1.35 }, { L: 3.2, A: 0.016, ang: -0.25 },
];
for (const w of WAVES) { w.k = TAU / w.L; w.c = Math.sqrt(9.8 / w.k); w.dx = Math.cos(w.ang); w.dz = Math.sin(w.ang); w.steep = w.A * w.k; }
const WATER = {
  uCenter: { value: new THREE.Vector2() }, uLevel: { value: 0 }, uWaveAmp: { value: 1 },
  uLodCam: { value: new THREE.Vector3() }, uMorph: { value: Array.from({ length: 16 }, () => new THREE.Vector2(1e5, 2e5)) },
  uWaves: { value: WAVES.map(w => new THREE.Vector4(w.dx, w.dz, w.steep, w.L)) },
  uNormTex: { value: null }, uSpecCol: { value: v3(1, 1, 1) }, uWaterLight: { value: v3(1, 1, 1) },
  uFoamCol: { value: v3(0.95, 0.98, 1) }, uWhitecaps: { value: 0 },
  uShallow: { value: v3(0.22, 0.86, 0.80) }, uMid: { value: v3(0.03, 0.55, 0.62) }, uDeep: { value: v3(0.015, 0.17, 0.32) }, uClarity: { value: 1 }, uReflK: { value: 1 },
  uFallPos: { value: new THREE.Vector2() },
  uCloudTex: SKY.uCloudTex, uCloudOffset: SKY.uCloudOffset, uCloudLit: SKY.uCloudLit, uCloudShade: SKY.uCloudShade,
  uBoatInv: { value: new THREE.Matrix4() }, uBoatOn: { value: 0 }, uSubInv: { value: new THREE.Matrix4() }, uSubOn: { value: 0 },
};
let waveAmp = 1;
// three looks for the sea: the colours of shallow, middle and deep water, how clear it is, how mirror-like
const WATER_STYLES = {
  tropical: { sh: [0.22, 0.86, 0.80], mid: [0.03, 0.55, 0.62], deep: [0.015, 0.17, 0.32], clarity: 1.0, refl: 1.0 },
  crystal:  { sh: [0.36, 0.93, 0.88], mid: [0.06, 0.66, 0.72], deep: [0.02, 0.24, 0.40], clarity: 0.55, refl: 0.85 },
  ocean:    { sh: [0.10, 0.62, 0.74], mid: [0.02, 0.32, 0.55], deep: [0.005, 0.09, 0.24], clarity: 1.45, refl: 1.15 },
};
function applyWaterStyle() {
  const st = WATER_STYLES[settings.waterStyle] || WATER_STYLES.tropical;
  WATER.uShallow.value.set(...st.sh); WATER.uMid.value.set(...st.mid); WATER.uDeep.value.set(...st.deep);
  WATER.uClarity.value = st.clarity; WATER.uReflK.value = st.refl;
}
const SURF_P = 8.5;
const surfOffJS = (x, z) => 0.18 * Math.sin(x * 0.0041 + z * 0.0063) + 0.12 * Math.sin(z * 0.0131 - x * 0.0077 + 1.7) + 0.07 * Math.sin(x * 0.021 - z * 0.017) + 0.045 * Math.sin(x * 0.009 + z * 0.026 + 2.0)
  + 0.03 * Math.sin(x * 0.071 + z * 0.049 + 0.4) + 0.02 * Math.sin(z * 0.113 - x * 0.083 + 0.7);
const surfVarJS = (x, z, nn) => 0.68 + 0.18 * Math.sin(x * 0.031 + z * 0.022 + nn * 2.3) + 0.09 * Math.sin(-x * 0.017 + z * 0.043 + nn * 1.1 + 1.3) + 0.06 * Math.sin(x * 0.083 - z * 0.061 + nn * 3.7);
const surfAmpJS = (x, z, m) => SURF_TABLE[((m % 16) + 16) % 16] * U.uSurfAmp.value * surfVarJS(x, z, m);
const surfPsiJS = (x, z, depth, t) => t / SURF_P + surfOffJS(x, z) + 1.25 * (Math.sqrt(Math.max(depth, 0) + 0.04) - 0.2);
// the surf at (x,z): the same maths as surfAt() in the shaders. Fills o with the phase g, the crest
// height a, how broken the wave is (brk) and how hard it is plunging; returns the water's elevation
const SURF_S = { g: 0, a: 0, brk: 0, plunge: 0, Hb: 0, n: 0 };
function surfState(x, z, depth, t, o = SURF_S) {
  const d = Math.max(depth, 0), psi = surfPsiJS(x, z, depth, t);
  const n = Math.floor(psi), g = psi - n;
  const Hb = lerp(surfAmpJS(x, z, n), surfAmpJS(x, z, n + 1), smoothstep(0.5, 0.78, g));
  const zk = Math.max(1, U.uSurfAmp.value * 0.75);
  const zone = depth > 0 ? smoothstep(16 * zk, 4 * zk, depth) * smoothstep(-100 * zk, -40, coastAt(x, z)) : 1;
  const db = Hb / 0.7 + 0.2, r = d / db;
  const brk = 1 - smoothstep(0.75, 1, r);
  const plunge = smoothstep(1.1, 0.95, r) * smoothstep(0.62, 0.85, r);
  const aUn = Hb * lerp(0.5, 1, smoothstep(3.5, 1, r));
  const aBr = Hb * (0.35 + 0.45 * clamp(r, 0, 1)) + 0.03;
  const a = lerp(aUn, aBr, brk) * zone;
  const wf = lerp(lerp(0.4, 0.2, smoothstep(2.5, 1, r)), lerp(0.34, 0.17, smoothstep(0, 0.5, d)), brk);
  const steep = clamp(smoothstep(2.2, 1, r) + brk, 0, 1);
  let sh;
  if (g > 1 - wf) { const q = (g - 1 + wf) / wf, sm = q * q * (3 - 2 * q); sh = lerp(sm, sm * 0.55 + Math.pow(q, 2.2) * 0.45, steep); }
  else { const q = g / (1 - wf), qb = q < 0.12 ? q * q / 0.24 : q - 0.06; sh = lerp(1 - q * q * (3 - 2 * q), Math.pow(Math.max(1 - qb / 0.94, 0), 1.3), brk); }
  o.g = g; o.a = a; o.brk = brk * zone; o.plunge = plunge * zone; o.Hb = Hb * zone; o.n = n; o.r = r;
  return a * (sh - lerp(0.2, 0.1, brk));
}
function surfJS(x, z, depth, t) { return surfState(x, z, depth, t); }
// tsunami: the same profile as tsunamiH() in the shaders
const sech2 = x => { const e = Math.exp(-Math.abs(x)); return (4 * e * e) / ((1 + e * e) * (1 + e * e)); };
function tsunamiJS(x, z, depth) {
  const T = U.uTsu.value; if (T.w < 0.001) return 0;
  const d = U.uTsuDir.value, s = x * d.x + z * d.y - T.x, w = T.z;
  const crest = sech2(s / (s > 0 ? w * lerp(0.13, 0.3, smoothstep(2, 30, depth)) : w * 1.5));
  const tail = s < 0 ? 0.42 * Math.exp(s / 520) : 0;
  const draw = -0.4 * Math.exp(-(((s - 2.6 * w) / (1.1 * w)) ** 2));
  const shoal = clamp(Math.pow(30 / Math.max(depth, 3), 0.25), 1, 1.5);
  const A = T.y * T.w * shoal;
  let e = A * (Math.max(crest, tail) + draw);
  if (depth < 0 && e > 0) e *= Math.exp(depth / Math.max(e * 1.5, 0.1));
  return e;
}
// how fast the flood is running at (x,z), along the tsunami's direction
function tsunamiFlow(x, z) {
  const T = U.uTsu.value; if (T.w < 0.001) return 0;
  const d = U.uTsuDir.value, s = x * d.x + z * d.y - T.x;
  const e = tsunamiJS(x, z, -groundHeight(x, z));
  if (e < 0.08) return 0;
  return Math.min(10, Math.sqrt(9.8 * e) * 0.95) * (s > -260 ? 1 : 0.45);
}
// height of the sea surface at (x,z): the same maths as the ocean vertex shader
// how calm the river channel keeps the sea's waves at (x, z), as in riverCalm() in the shaders
function riverCalmJS(x, z) {
  if (!T.calm || x < T.min || z < T.min || x > -T.min || z > -T.min) return 0;
  return Math.max(0, gridSample(T.calm, x, z));
}
function oceanHeight(x, z, t) {
  const depth0 = -groundHeight(x, z), openK = 1 - riverCalmJS(x, z);
  const att0 = smoothstep(0.5, 6, depth0) * openK, att = att0 * waveAmp, chop = att0 * Math.min(waveAmp, 2.0);
  let px = x, pz = z;
  if (chop > 0.001) {
    let ox = 0, oz = 0;
    for (const w of WAVES) { const f = w.k * (w.dx * px + w.dz * pz - w.c * t); const a = (w.steep / w.k) * chop; ox += w.dx * a * Math.cos(f); oz += w.dz * a * Math.cos(f); }
    px = x - ox; pz = z - oz;
  }
  let y = 0;
  if (att > 0.001) for (const w of WAVES) { const f = w.k * (w.dx * px + w.dz * pz - w.c * t); y += (w.steep / w.k) * att * Math.sin(f); }
  return y + (openK > 0.001 ? surfJS(px, pz, depth0, t) * openK : 0) + tsunamiJS(px, pz, depth0);
}

const WATER_FRAG_COMMON = /* glsl */`
  uniform float uLevel; uniform sampler2D uNormTex; uniform vec3 uSpecCol; uniform vec3 uWaterLight; uniform vec3 uFoamCol;
  uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep; uniform float uWhitecaps; uniform vec2 uFallPos; uniform float uClarity; uniform float uReflK;
  varying vec3 vWPos; varying vec3 vN; varying float vCrest;
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  // the lantern and the boat's headlights on the water: lighting up what's in it, glinting off the ripples
  vec3 llWater(vec3 P, vec3 N, vec3 V, vec3 body, float foam){
    vec3 o = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      if (uLLCol[i].w <= 0.001) continue;
      vec3 Ld; vec3 c = llAt(i, P, Ld);
      vec3 H = normalize(Ld + V); float nh = max(dot(N, H), 0.0), nl = max(dot(N, Ld), 0.0);
      o += c * (body * 0.5 * (0.3 + 0.7 * nl) + vec3(pow(nh, 220.0) * 4.0 + pow(nh, 30.0) * 0.18) + foam * nl * 0.85);
    }
    return o;
  }
  uniform sampler2D uCloudTex; uniform vec2 uCloudOffset; uniform vec3 uCloudLit; uniform vec3 uCloudShade;
  vec3 skyRefl(vec3 R){
    float yy = max(R.y, 0.0);
    vec3 c = mix(uSkyHorizon, uSkyZenith, pow(yy, 0.5));
    float sd = max(dot(R, uSunDir), 0.0);
    c = mix(c, uSkyGlow, uGlowAmt * pow(sd, 3.0) * 0.85 * mix(1.0, pow(1.0 - yy, 4.0), 0.6));
    c += uSkyGlow * uGlowAmt * pow(sd, 14.0) * 0.22;
    // the clouds themselves, mirrored: the same field the sky draws
    if (R.y > 0.015) {
      vec3 Rc = normalize(vec3(R.x, R.y + 0.16, R.z));
      vec2 cuv = Rc.xz / (Rc.y + 0.06) * 0.22 + uCloudOffset;
      float cn = texture2D(uCloudTex, cuv, 2.0).r * 0.64 + texture2D(uCloudTex, cuv * 3.1 + uCloudOffset * 1.7, 2.5).g * 0.36;
      float cov = mix(0.72, 0.16, uCloudCover);
      float dens = smoothstep(cov, cov + 0.24, cn) * smoothstep(0.0, 0.22, R.y);
      vec3 cc = mix(uCloudLit, uCloudShade, smoothstep(cov, cov + 0.5, cn) * 0.7) + uSkyGlow * uGlowAmt * pow(sd, 9.0) * 0.3;
      c = mix(c, cc, dens * 0.7);
    } else c = mix(c, mix(uSkyHorizon, vec3(dot(uSkyHorizon, vec3(0.33))), 0.4), uCloudCover * 0.55);
    return c + uLightning * vec3(0.3, 0.32, 0.42);
  }
  vec3 rainRipple(vec2 p){
    vec2 rp = p * 1.4; vec2 cell = floor(rp); vec2 f = fract(rp) - 0.5;
    float h = hash12(cell); float tt = fract(uTime * 1.1 + h * 7.0);
    vec2 o = (vec2(hash12(cell + 7.1), hash12(cell + 3.3)) - 0.5) * 0.5;
    vec2 q = f - o; float d = length(q);
    float ring = sin((d - tt * 0.45) * 46.0) * smoothstep(0.45 * tt + 0.06, 0.45 * tt, d) * (1.0 - tt) * step(0.35, h);
    return vec3(q.x, 0.0, q.y) / (d + 1e-3) * ring;
  }
`;

// The sea's mesh is a quadtree of square patches pinned to the world (CDLOD): fine right around you,
// coarser with distance, and each patch melts smoothly into the coarser grid before it hands over. Because
// the vertices never slide around with the camera, the waves don't shimmer or pop as you move.
const OLOD = { sp0: 0.5, levels: 10, K: 3.0, max: 9000, attr: null, n: 0, frustum: new THREE.Frustum(), pv: new THREE.Matrix4(), box: new THREE.Box3() };
function oceanLodParams() {
  const sp0 = Q.ocean === 'max' ? 0.25 : ({ low: 1.0, medium: 0.75, high: 0.5, ultra: 0.35 })[settings.quality] || 0.5;
  OLOD.sp0 = isMobile ? Math.max(sp0, 0.75) : sp0;
  OLOD.levels = Math.ceil(Math.log2(11000 / (OLOD.K * 32 * OLOD.sp0))) + 1;
  const m = WATER.uMorph.value;
  for (let l = 0; l < 16; l++) { const r = OLOD.K * 32 * OLOD.sp0 * 2 ** l; m[l].set(r * 0.78, r * 0.97); }
}
// per-pixel surf slopes (crisper wave faces) on the bigger quality settings
const oceanPPN = () => !isMobile && ['high', 'ultra', 'max'].includes(settings.quality);
function oceanPatch(n) {
  const pos = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(i, 0, j);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
    idx.push(a, c, d, a, d, b);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  OLOD.attr = new THREE.InstancedBufferAttribute(new Float32Array(OLOD.max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aNode', OLOD.attr);
  g.instanceCount = 0;
  return g;
}
// pick the patches for this frame: a node is split while the camera is within its children's range
function updateOceanLOD(cam) {
  if (!OLOD.attr) return;
  const sp0 = OLOD.sp0, L = OLOD.levels, K = OLOD.K, arr = OLOD.attr.array;
  const cx = cam.position.x, cy = Math.abs(cam.position.y - WATER.uLevel.value), cz = cam.position.z;
  WATER.uLodCam.value.set(cx, cam.position.y - WATER.uLevel.value, cz);
  cam.updateMatrixWorld();
  OLOD.pv.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); OLOD.frustum.setFromProjectionMatrix(OLOD.pv);
  const box = OLOD.box; let n = 0;
  const size = l => 32 * sp0 * 2 ** l, range = l => K * size(l);
  const d2 = (x0, z0, s) => { const dx = Math.max(x0 - cx, 0, cx - x0 - s), dz = Math.max(z0 - cz, 0, cz - z0 - s); return dx * dx + dz * dz + cy * cy; };
  const visible = (x0, z0, s) => { box.min.set(x0, -30, z0); box.max.set(x0 + s, 75, z0 + s); return OLOD.frustum.intersectsBox(box); };
  const quarter = (x0, z0, l) => {
    if (n >= OLOD.max) return;
    const sp = sp0 * 2 ** l;
    if (!visible(x0, z0, sp * 16)) return;
    const k = n * 4; arr[k] = x0; arr[k + 1] = z0; arr[k + 2] = sp; arr[k + 3] = l; n++;
  };
  const whole = (x0, z0, l) => { const h = size(l) / 2; quarter(x0, z0, l); quarter(x0 + h, z0, l); quarter(x0, z0 + h, l); quarter(x0 + h, z0 + h, l); };
  const sel = (x0, z0, l) => {
    const s = size(l), dd = d2(x0, z0, s), r = range(l);
    if (dd > r * r) return false;
    if (!visible(x0, z0, s)) return true;
    if (l === 0) { whole(x0, z0, 0); return true; }
    const r1 = range(l - 1);
    if (dd > r1 * r1) { whole(x0, z0, l); return true; }
    const h = s / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const x1 = x0 + i * h, z1 = z0 + j * h;
      if (!sel(x1, z1, l - 1)) quarter(x1, z1, l);
    }
    return true;
  };
  const top = L - 1, S = size(top), R = range(top);
  const i0 = Math.floor((cx - R) / S), i1 = Math.floor((cx + R) / S), j0 = Math.floor((cz - R) / S), j1 = Math.floor((cz + R) / S);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) sel(i * S, j * S, top);
  OLOD.n = n; OLOD.attr.needsUpdate = true; OLOD.attr.clearUpdateRanges?.(); OLOD.attr.addUpdateRange?.(0, n * 4);
  WATER.ocean.geometry.instanceCount = n;
}
function buildOcean() {
  const maxQ = Q.ocean === 'max';
  oceanLodParams();
  const geo = oceanPatch(16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, ...WFX.uniforms, uCabinInv: CABIN.uniforms.uCabinInv },
    vertexShader: /* glsl */`
      ${COMMON}
      attribute vec4 aNode;
      uniform vec3 uLodCam; uniform vec2 uMorph[16];
      uniform float uLevel; uniform vec4 uWaves[6]; uniform float uWaveAmp;
      varying vec3 vWPos; varying vec3 vN; varying float vCrest; varying vec2 vP0; varying vec2 vSG; varying float vTsu; varying float vTsuF; varying float vTsuS; varying float vTsuP;
      void main(){
        // where this vertex sits on its patch, melted toward the next coarser grid near the patch's range
        vec2 gp = position.xz;
        vec2 q = aNode.xy + gp * aNode.z;
        float dc = length(vec3(q.x, 0.0, q.y) - uLodCam);
        vec2 mr = uMorph[int(aNode.w + 0.5)];
        float mk = clamp((dc - mr.x) / (mr.y - mr.x), 0.0, 1.0);
        gp -= fract(gp * 0.5) * 2.0 * mk;
        vec2 p = aNode.xy + gp * aNode.z;
        float spacing = aNode.z * (1.0 + mk);
        vec2 hc = terrainHC(p);
        float h0 = hc.x;
        float depth = uLevel - h0;
        float openK = 1.0 - riverCalm(p);   // waves fade out up the river channel
        float att0 = smoothstep(0.5, 6.0, depth) * openK, att = att0 * uWaveAmp, chop = att0 * min(uWaveAmp, 2.0);
        vec3 tg = vec3(1.0, 0.0, 0.0), bn = vec3(0.0, 0.0, 1.0), disp = vec3(0.0);
        for (int i = 0; i < 6; i++) {
          vec4 w = uWaves[i];
          float k = 6.28318 / w.w, c = sqrt(9.8 / k);
          float fw = att * smoothstep(2.0, 5.0, w.w / spacing);
          float f = k * (dot(w.xy, p) - c * uTime);
          float fc = fw * chop / max(att, 1e-4);
          float a = w.z / k * fw, ah = w.z / k * fc, cf = cos(f), sf = sin(f), st = w.z * fw, sh = w.z * fc;
          disp += vec3(w.x * ah * cf, a * sf, w.y * ah * cf);
          tg += vec3(-w.x * w.x * sh * sf, w.x * st * cf, -w.x * w.y * sh * sf);
          bn += vec3(-w.x * w.y * sh * sf, w.y * st * cf, -w.y * w.y * sh * sf);
        }
        #ifdef OCEAN_MAX
        // extra short, choppy wavelets close to you (too small to matter for floating)
        for (int i = 0; i < 5; i++) {
          float fi = float(i), L = 2.4 / (1.0 + fi * 0.55), ang = 0.4 + fi * 1.37;
          vec2 d = vec2(cos(ang), sin(ang));
          float k = 6.28318 / L, c = sqrt(9.8 / k), fw = att0 * smoothstep(2.0, 5.0, L / spacing) * (0.5 + 0.5 * uWaveAmp);
          float stp = 0.11 * fw, f = k * (dot(d, p) - c * uTime) + fi * 1.7;
          float a = stp / k, cf = cos(f), sf = sin(f);
          disp += vec3(d.x * a * cf, a * sf, d.y * a * cf);
          tg += vec3(-d.x * d.x * stp * sf, d.x * stp * cf, -d.x * d.y * stp * sf);
          bn += vec3(-d.x * d.y * stp * sf, d.y * stp * cf, -d.y * d.y * stp * sf);
        }
        #endif
        // the surf (its slope is worked out per pixel, so the faces stay crisp at any distance)
        vec4 ss; float s0 = surfAt(p, depth, hc.y, ss) * openK; ss.yzw *= openK;
        disp.y += s0;
        float e = 0.8;
        float h1 = terrainH(p + vec2(e, 0.0)), h2 = terrainH(p + vec2(0.0, e));
        vec2 shore = normalize(vec2(h1 - h0, h2 - h0) + vec2(1e-5));
        vSG = vec2(0.0);
        #ifndef OCEAN_PPN
        { vec4 st; float es = max(spacing, 0.5);
          vSG = vec2(surfAt(p + vec2(es, 0.0), uLevel - terrainH(p + vec2(es, 0.0)), st) * openK - s0, surfAt(p + vec2(0.0, es), uLevel - terrainH(p + vec2(0.0, es)), st) * openK - s0) / es; }
        #endif
        // a plunging wave's crest leans forward over its face: only the very top, and only where the mesh is
        // fine enough to draw it (on a coarse mesh a big overhang turns into a slab with a vertical wall)
        float lipM = smoothstep(0.9, 0.99, ss.x) + 1.0 - smoothstep(0.0, 0.08, ss.x);
        float topK = smoothstep(0.5, 0.95, s0 / max(ss.y, 0.05) + 0.15);
        disp.xz += shore * ss.y * 0.28 * ss.w * lipM * topK * smoothstep(1.4, 0.5, spacing);
        // the broken wave's roller churns and heaves
        if (ss.z > 0.01) {
          float roll = ss.z * (smoothstep(0.86, 0.99, ss.x) + 1.0 - smoothstep(0.0, 0.25, ss.x));
          float tn = texture2D(uNoiseTex, p * 0.21 + vec2(uTime * 0.13, -uTime * 0.09)).r + texture2D(uNoiseTex, p * 0.57 - vec2(uTime * 0.21, uTime * 0.05)).g * 0.6 - 0.8;
          disp.y += tn * roll * ss.y * 0.16;
        }
        vTsu = 0.0; vTsuF = 0.0; vTsuS = 0.0; vTsuP = 1e4;
        if (uTsu.w > 0.001) {
          float t0 = tsunamiH(p, depth), tx = tsunamiH(p + vec2(e, 0.0), uLevel - h1), tz = tsunamiH(p + vec2(0.0, e), uLevel - h2);
          disp.y += t0; tg.y += (tx - t0) / e; bn.y += (tz - t0) / e;
          float sF = dot(p, uTsuDir) - uTsu.x;
          // the face steepens and its top pitches forward as it reaches shallow water
          float pitch = smoothstep(-30.0, 0.0, sF) * (1.0 - smoothstep(0.0, 45.0, sF)) * smoothstep(12.0, 2.0, depth);
          disp.xz += uTsuDir * t0 * 0.3 * pitch;
          vTsu = t0; vTsuF = pitch * smoothstep(0.5, 2.0, t0) * smoothstep(0.35, 0.7, clamp(length(vec2(tx - t0, tz - t0)) / e, 0.0, 1.0));
          vTsuS = sech2(sF / (sF > 0.0 ? uTsu.z * mix(0.13, 0.3, smoothstep(2.0, 30.0, depth)) : uTsu.z * 1.5)); // 1 on the crest line, falling away on both sides
          // the crest itself is a roller of churning white water, lumpy and tumbling forward
          { float rollT = smoothstep(-16.0, -2.0, sF) * (1.0 - smoothstep(-1.0, 7.0, sF)) * smoothstep(1.0, 3.5, t0) * smoothstep(24.0, 5.0, depth);
            float tr = texture2D(uNoiseTex, p * 0.09 + uTsuDir * uTime * 0.25).g + texture2D(uNoiseTex, p * 0.31 + uTsuDir * uTime * 0.6).r * 0.5 - 0.75;
            disp.y += tr * rollT * min(t0, 9.0) * 0.16; disp.xz += uTsuDir * rollT * max(tr, 0.0) * min(t0, 9.0) * 0.12; }
          vTsuP = sF;
          // the broken wave behind the front boils and heaves over the shallows
          float bore = smoothstep(-110.0, -6.0, sF) * (1.0 - smoothstep(-6.0, 8.0, sF)) * smoothstep(9.0, 0.5, depth) * smoothstep(0.4, 1.5, t0);
          float tn = texture2D(uNoiseTex, p * 0.045 + vec2(uTime * 0.11, -uTime * 0.07)).r + texture2D(uNoiseTex, p * 0.13 - vec2(uTime * 0.2, uTime * 0.05)).g * 0.5 - 0.75;
          disp.y += tn * bore * min(t0, 5.0) * 0.32;
        }
        vec3 wp = vec3(p.x, uLevel, p.y) + disp;
        vWPos = wp; vN = normalize(cross(bn, tg)); vCrest = disp.y; vP0 = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      ${WATER_FRAG_COMMON}
      ${WFX_GLSL}
      uniform mat4 uBoatInv; uniform float uBoatOn; uniform mat4 uCabinInv; uniform mat4 uSubInv; uniform float uSubOn;
      varying vec2 vP0; varying vec2 vSG; varying float vTsu; varying float vTsuF; varying float vTsuS; varying float vTsuP;
      ${HULL_GLSL}
      void main(){
        // no sea inside the boat or the cabin, however high the waves get
        if (uBoatOn > 0.5) { vec3 bl = (uBoatInv * vec4(vWPos, 1.0)).xyz; if (bl.y > -0.08 && bl.y < 1.45 && abs(bl.x) < hullHalf(bl.z) - 0.05) discard; }
        { vec3 cl = (uCabinInv * vec4(vWPos, 1.0)).xyz; if (abs(cl.x) < 5.05 && cl.z > -6.05 && cl.z < 3.55 && cl.y > -0.25 && cl.y < 4.6) discard; }
        if (uSubOn > 0.5) { vec3 sl = (uSubInv * vec4(vWPos, 1.0)).xyz; if (abs(sl.z) < 16.5 && length(sl.xy) < 3.0) discard; }
        // up the river the river's own surface is the water: the sea fades out beneath it where the two
        // meet (both at sea level there), so there is never a second, lower sea surface showing through
        float seaK = uTsu.w < 0.001 ? 1.0 - smoothstep(0.72, 0.97, riverCalm(vP0)) : 1.0;
        if (seaK < 0.01) discard;
        vec3 toCam = cameraPosition - vWPos; float dist = length(toCam); vec3 V = toCam / dist;
        float hT = terrainH(vWPos.xz);
        float depth = uLevel - hT;
        float thick = vWPos.y - hT;
        float fadeD = 1.0 / (1.0 + dist * 0.012);
        // the surf here, and its slope measured over about a pixel so the faces are sharp but never sparkle
        vec2 hc0 = terrainHC(vP0);
        float openF = 1.0 - riverCalm(vP0);
        vec4 ss; float sC = surfAt(vP0, uLevel - hc0.x, hc0.y, ss) * openF; ss.yzw *= openF;
        vec2 sg = vSG;
        #ifdef OCEAN_PPN
        { float ee = clamp(length(fwidth(vP0)) * 1.2, 0.15, 3.0);
          vec4 sTmp;
          float sX = surfAt(vP0 + vec2(ee, 0.0), uLevel - terrainH(vP0 + vec2(ee, 0.0)), sTmp);
          float sZ = surfAt(vP0 + vec2(0.0, ee), uLevel - terrainH(vP0 + vec2(0.0, ee)), sTmp);
          sg = vec2(sX * openF - sC, sZ * openF - sC) / ee; }
        #endif
        vec3 Ng = normalize(vN);
        vec2 grad = -Ng.xz / max(Ng.y, 0.15) + sg;
        vec3 Nb = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 n1 = texture2D(uNormTex, vWPos.xz * 0.05 + uTime * vec2(0.010, 0.006)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormTex, vWPos.xz * 0.17 + uTime * vec2(-0.017, 0.012)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(uNormTex, vWPos.xz * 0.53 + uTime * vec2(0.031, -0.024)).xyz * 2.0 - 1.0;
        // the smallest ripples, which break the sun's reflection into glints close to you
        n3 += (texture2D(uNormTex, vWPos.xz * 1.7 - uTime * vec2(0.05, 0.043)).xyz * 2.0 - 1.0) * 0.6;
        float fine = 1.0 / (1.0 + dist * 0.05);
        // the whitewater of a broken wave is lumpy; the face of a clean one is glassy
        float g = ss.x, aS = ss.y, brk = ss.z, pl = ss.w;
        float roll = brk * (smoothstep(0.86, 0.99, g) + 1.0 - smoothstep(0.0, 0.2, g));
        float glassy = smoothstep(0.7, 0.97, g) * (1.0 - smoothstep(0.985, 1.0, g)) * smoothstep(0.12, 0.5, aS) * (1.0 - brk);
        float detail = (0.3 + 0.14 * uDepthOn) * fadeD * (1.0 - 0.6 * glassy) * (1.0 + 1.2 * roll);
        vec3 N = normalize(Nb + vec3(n1.x + n2.x * 0.7 + n3.x * 0.3 * fine, 0.0, n1.y + n2.y * 0.7 + n3.y * 0.3 * fine) * detail);
        if (uRain > 0.02) N = normalize(N + rainRipple(vWPos.xz) * 0.35 * uRain * fadeD);
        vec3 rp = ripple(vWPos.xz);
        N = normalize(N + vec3(-rp.x, 0.0, -rp.y));
        vec3 col; float alpha;
        if (uUnderwater < 0.5) {
          float NdV = clamp(dot(N, V), 0.0, 1.0);
          float F = (0.02 + 0.98 * pow(1.0 - NdV, 5.0)) * uReflK;
          // far off, every pixel covers many little waves tilted every way: together they mirror the sky
          F = mix(F, max(F, 0.6), smoothstep(70.0, 800.0, dist) * 0.85);
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          vec3 refl = planarRefl(vWPos, N, skyRefl(R), dist);
          float sp = max(dot(R, uLightDir), 0.0);
          vec2 fl = vec2(uTime * 0.011, -uTime * 0.007);
          float fA = texture2D(uNoiseTex, vWPos.xz * 0.23 + vec2(uTime * 0.02, 0.0)).a;
          float fB = texture2D(uNoiseTex, vWPos.xz * 0.061 - vec2(0.0, uTime * 0.01)).g;
          // whitewater: the lip as it pitches, the roller riding the front of the broken wave, then lace
          // that stretches and thins behind it; small waves barely whiten at all
          float aK = smoothstep(0.05, 0.32, aS);
          // whitewater: the crest feathering white as a wave starts to spill, the lip as it pitches, the roller
          // riding the front of the broken wave, then a web of lace that stretches and thins behind it
          float pB = texture2D(uNoiseTex, vWPos.xz * 0.11 - fl * 1.3).g;
          float gj = fract(g + (pB - 0.5) * 0.035);
          float steepQ = aS / max(uLevel - hc0.x, 0.1);                       // crest height over depth: ~0.7 when it breaks
          float spill = smoothstep(0.93, 0.99, gj) * smoothstep(0.36, 0.56, steepQ) * smoothstep(0.25, 0.6, aS) * (1.0 - brk) * 0.75;
          float lipF = pl * smoothstep(0.9, 0.99, gj) * aK;
          float rollF = brk * (smoothstep(0.93, 0.99, gj) + 1.0 - smoothstep(0.0, 0.13, gj));
          float sheet = brk * (1.0 - smoothstep(0.1, 0.5, gj)) * (0.45 + 0.25 * fB);
          float trail = brk * (1.0 - smoothstep(0.4, 0.95, gj)) * 0.24;
          float famt = max(max(lipF * 1.2, spill), rollF * (0.75 + 0.25 * aK) * (0.9 + 0.2 * fA));
          famt = max(famt, sheet * aK) + trail * aK;
          famt = max(famt, (1.0 - smoothstep(0.0, 0.6, g)) * smoothstep(0.35, -0.4, depth) * 0.6);     // the swash running up the sand
          famt += smoothstep(0.3, 0.75, vCrest) * uWhitecaps * smoothstep(4.0, 10.0, depth) * (0.4 + 0.6 * fA);
          famt += rp.z * 0.7;                                                                         // foam you and the boat leave behind
          // tsunami: a boiling white crest, churned water behind it, brown flood water on land
          float flood = smoothstep(0.0, -0.5, depth) * smoothstep(0.05, 0.4, vTsu);
          float tsN = vTsuS * smoothstep(0.3, 2.0, vTsu);
          famt *= 1.0 - smoothstep(0.6, 2.5, vTsu) * (1.0 - flood);   // the everyday surf doesn't draw on a tsunami's face
          famt = max(famt, smoothstep(0.94, 0.995, vTsuS) * step(-12.0, vTsuP) * smoothstep(0.8, 2.5, vTsu));
          famt = max(famt, vTsuF * smoothstep(0.72, 0.95, vTsuS) * 1.1);
          famt = max(famt, smoothstep(-6.0, -40.0, vTsuP) * smoothstep(0.5, 1.5, vTsu) * 0.55);
          // white streaks pouring down the face of the wave
          { vec2 perp = vec2(-uTsuDir.y, uTsuDir.x);
            float st = texture2D(uNoiseTex, vec2(dot(vWPos.xz, perp) * 0.55, vTsuP * 0.012 + uTime * 0.12)).a;
            famt = max(famt, smoothstep(0.7, 0.9, st) * step(0.0, vTsuP) * smoothstep(0.35, 0.7, vTsuS) * (1.0 - smoothstep(0.92, 0.99, vTsuS)) * smoothstep(2.0, 4.0, vTsu) * 0.5); }
          famt = max(famt, flood * 0.45);
          // with the depth of the solid world behind this pixel: a line of foam wherever the sea touches something
          float zW = max(linDepth(gl_FragCoord.z), 0.05);
          float gap0 = uDepthOn > 0.5 ? max(sceneGap(vec2(0.0)), 0.0) * dist / zW : 9.0;
          famt = max(famt, (1.0 - smoothstep(0.03, 0.55, gap0)) * 0.4 * (0.55 + 0.45 * fA) * (1.0 - smoothstep(60.0, 160.0, dist)));
          float foam = foamMask(vWPos.xz, min(famt, 1.0), fl);
          float lace = smoothstep(0.1, 0.0, thick) * foamMask(vWPos.xz * 1.6, 0.3, fl * 2.0) * 0.6;
          foam = max(foam, lace);
          foam = clamp(foam, 0.0, 0.97) * (1.0 - smoothstep(250.0, 700.0, dist));
          // sun glitter: the sharp highlight broken into sparkles by the small ripples
          float glit = pow(sp, 720.0) * mix(5.0, 3.0, uDepthOn) + pow(sp, 90.0) * 0.22 + pow(sp, 2400.0) * 18.0 * fine;
          // tiny facets catch the sun and twinkle: round points that fade in and out, never squares
          { vec2 gq = vWPos.xz * 3.2, gc = floor(gq);
            float h1 = hash12(gc), h2 = hash12(gc + 17.3), h3 = hash12(gc + 41.7);
            vec2 cpos = vec2(0.2 + 0.6 * h1, 0.2 + 0.6 * h2);
            float px = max(length(fwidth(gq)), 0.02);
            float rad = max(0.05, px * 0.9);
            float pt = smoothstep(rad, 0.0, length(fract(gq) - cpos)) * min(1.0, 0.05 / rad) * min(1.0, 0.05 / rad);
            float tw = max(0.0, sin(uTime * (2.0 + 3.0 * h3) + h1 * 40.0));
            float path = pow(max(dot(normalize(reflect(-V, normalize(Nb + vec3(n2.x, 0.0, n2.y) * 0.5))), uLightDir), 0.0), 18.0);
            glit += step(0.955, h3) * pt * tw * tw * path * 10.0 * fine * smoothstep(-0.02, 0.06, uLightDir.y); }
          vec3 spec = uSpecCol * glit * (1.0 - foam);
          float path = max(thick, 0.0) / max(V.y, 0.12);
          // exactly how much water the view passes through, and where the bent view lands
          vec2 rOff = vec2(0.0); float edgeK = smoothstep(0.0, 0.07, thick); vec3 absorb = vec3(1.0);
          if (uDepthOn > 0.5) {
            rOff = N.xz * 44.0 * clamp(thick, 0.0, 1.6) * (uScreen.y / 900.0) / (1.0 + dist * 0.07) * (1.0 - foam);
            float gap = sceneGap(rOff);
            if (gap < 0.0) { rOff = vec2(0.0); gap = sceneGap(rOff); }       // something in front of the water there: don't bend the view onto it
            float pathD = max(gap, 0.0) * dist / zW;
            path = min(pathD, 80.0);
            edgeK = smoothstep(0.0, 0.09, min(pathD, gap0));                  // the surface thins away softly against sand, rocks, hulls and posts
            // water takes the red out of light first, then the green: sand goes green-gold, then turquoise, then blue
            absorb = exp(-min(path, 40.0) * vec3(0.34, 0.045, 0.012) * uClarity);
          }
          float Tr = exp(-path * (mix(0.15, 0.07, uDepthOn) * uClarity + flood * 1.4));     // clear water: you see the bottom well down
          float dEff = vTsu > 0.3 ? max(depth, thick * 1.6) : depth; // a tall tsunami face is as dark as deep water
          vec3 body = mix(uShallow, uMid, smoothstep(0.4, 5.0, dEff));
          body = mix(body, uDeep, smoothstep(5.0, 26.0, dEff));
          float backlit = pow(max(dot(-V, uSunDir), 0.0), 2.0);
          // light passing through the thin tops of waves
          body += mix(uShallow, uMid, 0.4) * 0.16 * smoothstep(0.1, 0.6, vCrest) * backlit;
          // the face of a steep wave glows green-blue where the light shines through it
          float face = smoothstep(0.72, 0.96, g) * (1.0 - smoothstep(0.988, 1.0, g)) * smoothstep(0.1, 0.55, aS) * (1.0 - 0.5 * brk);
          body = mix(body, mix(uShallow, uMid, 0.5), face * 0.35);
          body += mix(uShallow, uMid, 0.3) * face * 0.12 * backlit * smoothstep(0.0, 0.3, uLightDir.y);
          Tr *= 1.0 - face * 0.3;
          // milky turquoise where foam has churned air into the water
          body = mix(body, uShallow * 1.15 + 0.05, clamp(famt, 0.0, 1.0) * 0.35 * (1.0 - flood));
          body = mix(body, vec3(0.30, 0.27, 0.18), flood * 0.75);
          // sunlight glowing through the rising face of the wave
          body = mix(body, uMid * 0.8, smoothstep(0.1, 0.6, tsN) * (1.0 - flood) * 0.6);
          body += uShallow * 0.6 * smoothstep(0.55, 0.92, tsN) * (1.0 - flood) * (0.4 + 0.6 * backlit);
          body *= uWaterLight;
          F *= 1.0 - 0.65 * smoothstep(0.15, 0.6, tsN) * (1.0 - flood);   // the face of a tsunami shows its body, not the sky
          F *= 1.0 - 0.35 * face;
          col = body * (1.0 - Tr) * (1.0 - F) + refl * F + spec;
          alpha = 1.0 - Tr * (1.0 - F);
          // foam: brightest on top, a little shadowed and blue where it is thin or turned from the sun
          float lit = clamp(dot(N, uLightDir) * 0.5 + 0.5, 0.0, 1.0);
          // whitewater has relief: bright tumbling tops, bluish shadowed hollows, little glinting bubbles
          float fRel = texture2D(uFoamTex, vWPos.xz * 0.7 + fl * 4.0).g * 0.6 + texture2D(uNoiseTex, vWPos.xz * 0.35 - fl * 2.0).b * 0.5;
          vec3 foamC = uFoamCol * (0.84 + 0.16 * lit) * mix(vec3(0.86, 0.94, 0.98), vec3(1.0), smoothstep(0.2, 0.8, foam));
          foamC *= 0.9 + 0.2 * fRel * smoothstep(0.4, 0.95, famt);
          col = mix(col, foamC, foam); alpha = mix(alpha, 1.0, foam);
          col += llWater(vWPos, N, V, body, foam);
          float edge = edgeK;
          col *= edge; alpha *= edge;
          float fd = uFogDensity * dist; float ff = 1.0 - exp(-fd * fd);
          col = mix(col, skyHaze(-V) * alpha, ff);
          // whatever is under the surface, bent by the waves
          if (uRefrOn > 0.5) {
            vec2 off = uDepthOn > 0.5 ? rOff * edge : N.xz * 44.0 * clamp(thick, 0.0, 1.6) * edge * (uScreen.y / 900.0) / (1.0 + dist * 0.07) * (1.0 - foam);
            vec3 bg = vec3(refrAt(off * 1.05).r, refrAt(off).g, refrAt(off * 0.95).b) * mix(vec3(1.0), absorb, edge);
            col += bg * (1.0 - alpha); alpha = 1.0;
          }
          col *= seaK; alpha *= seaK;
        } else {
          vec3 I = -V;
          vec3 Tw = refract(I, -N, 1.333);
          float window = dot(Tw, Tw) > 0.001 ? 1.0 : 0.0;
          vec3 skyC = skyRefl(normalize(Tw + vec3(0.0, 1e-3, 0.0))) * 1.05;
          col = mix(uWaterFog * 0.8, skyC, window);
          col += uSpecCol * pow(max(dot(normalize(Tw + vec3(0.0, 1e-3, 0.0)), uLightDir), 0.0), 300.0) * 2.0 * window;
          alpha = mix(0.96, 0.5, window);
          float f = 1.0 - exp(-dist * uWaterFogDensity);
          col = mix(col, uWaterFog, f); alpha = mix(alpha, 1.0, f);
          col *= alpha;
        }
        gl_FragColor = vec4(outCol(col / max(alpha, 1e-3)) * alpha, alpha);
      }`,
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const ppn = oceanPPN();
  mat.defines = {}; if (maxQ) mat.defines.OCEAN_MAX = ''; if (ppn) mat.defines.OCEAN_PPN = '';
  const ocean = new THREE.Mesh(geo, mat);
  ocean.frustumCulled = false; ocean.renderOrder = 5; ocean.name = 'Ocean'; markWater(ocean); WATER.ocean = ocean; WATER.oceanQ = maxQ + '|' + ppn;
  scene.add(ocean);
  updateOceanLOD(camera);
  return ocean;
}

// freshwater surfaces: the pools (flat, with ripples from the falls or the spring) and the river (flowing)
function freshMaterial(flowing) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, ...WFX.uniforms, uRipple: { value: new THREE.Vector3(0, 0, 0) }, uPoolC: { value: new THREE.Vector4(POOL.x, POOL.z, POOL.r, 0) }, uPoolExit: { value: new THREE.Vector3(0, 0, 0) }, uDam: { value: new THREE.Vector4(0, 0, 0, 0) } },
    vertexShader: /* glsl */`
      ${COMMON}
      attribute float aFlow; attribute float aFoam; attribute vec3 aRiv;${flowing ? ' attribute vec2 aDir; varying vec2 vDir; attribute float aSea; varying float vSea; uniform vec4 uWaves[6]; uniform float uWaveAmp; uniform float uLevel; uniform vec4 uDam; varying float vLift; varying float vStill;' : ''}
      varying vec3 vWPos; varying vec3 vN; varying float vCrest; varying vec2 vUv; varying float vFlow; varying float vFoamA; varying vec3 vRiv;
      void main(){${flowing ? ' vDir = aDir;' : ''}
        vec4 wp = modelMatrix * vec4(position, 1.0);
        ${flowing ? `wp.y += (sin(wp.x * 0.9 + uTime * 2.1) * sin(wp.z * 0.8 - uTime * 1.7) * 0.025 + sin(uv.y * 9.0 - uTime * 6.0 + uv.x * 3.0) * 0.03 * aFoam) * (0.4 + aFoam);
        vSea = aSea; vLift = 0.0; vStill = 0.0;
        // a dam across the river (see updateDams): dry below it, a rising pond above it
        if (uDam.w > 0.5) {
          float S0 = position.y, bed = S0 - aRiv.z, dv = uv.y - uDam.x;
          float yDown = max(max(bed + 0.12, bed < 0.0 ? min(S0, 0.0) : -1e4), S0 - uDam.y);
          float yUp = max(S0, uDam.z);
          float kD = smoothstep(0.05, 0.6, dv), kU = 1.0 - smoothstep(-0.05, 0.05, dv);
          float y = mix(mix(S0, yUp, kU), yDown, kD);
          vLift = y - S0; wp.y += vLift;
          vStill = kD * clamp(uDam.y / max(aRiv.z - 0.12, 0.2), 0.0, 1.0) + kU * clamp((uDam.z - S0) / 0.25, 0.0, 1.0);
        }
        // near the mouth the sea's swell and surf run up into the river exactly as they move the ocean
        // here (same waves, same damping), so the two surfaces rise and fall together
        if (aSea < 60.0) {
          vec2 p = wp.xz; vec2 hc = terrainHC(p); float depth = uLevel - hc.x;
          float openK = 1.0 - riverCalm(p);
          float att0 = smoothstep(0.5, 6.0, depth) * openK, att = att0 * uWaveAmp, chop = att0 * min(uWaveAmp, 2.0);
          vec3 d = vec3(0.0);
          for (int i = 0; i < 6; i++) {
            vec4 w = uWaves[i]; float k = 6.28318 / w.w, c = sqrt(9.8 / k), f = k * (dot(w.xy, p) - c * uTime);
            d += vec3(w.x * w.z / k * chop * cos(f), w.z / k * att * sin(f), w.y * w.z / k * chop * cos(f));
          }
          vec4 ss; d.y += surfAt(p, depth, hc.y, ss) * openK;
          wp.xyz += d;
        }` : ''}
        vWPos = wp.xyz; vN = vec3(0.0, 1.0, 0.0); vCrest = 0.0; vUv = uv; vFlow = aFlow; vFoamA = aFoam; vRiv = aRiv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      ${COMMON}
      ${WATER_FRAG_COMMON}
      ${WFX_GLSL}
      uniform vec3 uRipple; uniform vec4 uPoolC; uniform vec3 uPoolExit;
      varying vec2 vUv; varying float vFlow; varying float vFoamA; varying vec3 vRiv;${flowing ? ' varying vec2 vDir; varying float vSea; varying float vLift; varying float vStill;' : ''}
      void main(){
        vec3 toCam = cameraPosition - vWPos; float dist = length(toCam); vec3 V = toCam / dist;
        ${flowing ? `
        float rd = abs(vRiv.x), W = vRiv.y, Dp = vRiv.z;
        float bed = rd < W ? -Dp * pow(max(1.0 - (rd / W) * (rd / W), 0.0), 0.8) : (rd - W) * 0.55;
        float thick = -bed + vLift;
        float still = clamp(vStill, 0.0, 1.0);
        float spd = (0.5 + vFlow * 4.0) * (1.0 - 0.92 * still);
        float foamA = vFoamA * (1.0 - still);
        // two phases of flow-mapped normals, cross-faded, so the surface streams downhill without stretching
        float ph0 = fract(uTime * 0.35), ph1 = fract(uTime * 0.35 + 0.5), bl = abs(ph0 - 0.5) * 2.0;
        vec2 base = vec2(vUv.x * 2.2, vUv.y * 1.4);
        vec2 fuv = base - vec2(0.0, ph0 * spd * 0.6), fuv2 = base * 1.9 + 0.37 - vec2(0.0, ph1 * spd * 0.6);
        vec3 n1 = mix(texture2D(uNormTex, fuv).xyz, texture2D(uNormTex, fuv2).xyz, bl) * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormTex, base * 3.7 - vec2(0.0, uTime * spd * 0.3)).xyz * 2.0 - 1.0;
        float nk = 0.22 + smoothstep(0.4, 1.0, foamA) * 0.55 + vFlow * 0.12;
        // ripples lie along the current (x across it, y along it), stretched downstream
        vec2 Tv = normalize(vDir + vec2(1e-5)), Tu = vec2(-Tv.y, Tv.x);
        vec2 gr = vec2((n1.x + n2.x * 0.5) * nk, (n1.y + n2.y * 0.5) * nk * 1.6);
        // where it pours over a drop: standing waves that hold still while the water races through them,
        // and a broken chop riding over them
        { float rap = smoothstep(0.35, 0.95, foamA);
          float swp = vUv.y * 30.0 + sin(vUv.x * 11.0 + vUv.y * 3.0) * 1.4;
          gr.y += (cos(swp) * 0.5 + cos(swp * 1.9 + 1.3 - uTime * 1.5) * 0.18) * rap;
          gr.x += sin(vUv.x * 25.0 + vUv.y * 9.0 - uTime * 3.0) * 0.14 * rap;
          // boils: slow upwellings drifting down the calm runs
          vec2 bq = vec2(vUv.x * 3.0, vUv.y * 2.0 - uTime * spd * 0.12);
          gr += (texture2D(uNoiseTex, bq * 0.35).gb - 0.5) * 0.12 * (1.0 - rap); }
        vec2 gw = Tu * gr.x + Tv * gr.y;
        vec3 N = normalize(vec3(gw.x, 1.0, gw.y));` : `
        float thick = vWPos.y - terrainH(vWPos.xz);
        vec2 fuv = vWPos.xz * 0.12 + uTime * vec2(0.01, 0.013), fuv2 = fuv * 2.3 + 0.4 + uTime * 0.02;
        vec3 n1 = texture2D(uNormTex, fuv).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormTex, fuv2).xyz * 2.0 - 1.0;
        vec3 N = normalize(vec3((n1.x + n2.x * 0.7) * 0.22, 1.0, (n1.y + n2.y * 0.7) * 0.22));`}
        float churn = 0.0;
        ${flowing ? '' : `
        float dF = length(vWPos.xz - uRipple.xy);
        float ringW = sin(dF * 3.2 - uTime * 5.0) * exp(-dF * 0.22) * uRipple.z;
        N = normalize(N + vec3(vWPos.x - uRipple.x, 0.0, vWPos.z - uRipple.y) / (dF + 0.01) * ringW * 0.28);
        churn = smoothstep(7.0 * uRipple.z, 0.4, dF) * uRipple.z;`}
        if (uRain > 0.02) N = normalize(N + rainRipple(vWPos.xz) * 0.35 * uRain);
        vec3 rp = ripple(vWPos.xz);
        N = normalize(N + vec3(-rp.x, 0.0, -rp.y));
        vec3 col; float alpha;
        if (uUnderwater < 0.5) {
          float NdV = clamp(dot(N, V), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          // a river or a pool is walled in by its banks and the jungle: low reflections show them, not the sky
          vec3 bank = vec3(0.10, 0.14, 0.07) * (0.25 + 0.75 * uDaylight) * (1.0 - uCloudCover * 0.3);
          vec3 refl = mix(bank, skyRefl(R) * 0.85, smoothstep(0.06, 0.38, R.y));
          float sp = max(dot(R, uLightDir), 0.0);
          float path = max(thick, 0.0) / max(V.y, 0.15);
          float Tr = exp(-path * mix(0.32, 0.19, uDepthOn));
          vec3 body = mix(vec3(0.20, 0.48, 0.40), vec3(0.04, 0.20, 0.19), smoothstep(0.3, 2.5, thick)) * uWaterLight;
          ${flowing ? `
          // the river takes on the sea's colour as it meets it
          float mouthK = 1.0 - smoothstep(6.0, 60.0, vSea);
          body = mix(body, mix(uShallow, uMid, smoothstep(0.5, 3.0, thick)) * uWaterLight * 0.9, mouthK * 0.8);
          // white water only where the river runs fast over the rocks, along the banks, and in its eddies
          // clear water: thin lines of bubbles drawn out along the current, white water only in the real rapids
          float rap = smoothstep(0.55, 0.95, foamA);
          float line1 = texture2D(uNoiseTex, vec2(vUv.x * 7.0, vUv.y * 0.11 - uTime * spd * 0.07)).a;
          float line2 = texture2D(uNoiseTex, vec2(vUv.x * 13.0 + 0.4, vUv.y * 0.2 - uTime * spd * 0.11)).r;
          float lines = smoothstep(0.8, 0.93, line1) * 0.28 + smoothstep(0.84, 0.95, line2) * 0.18;
          float strk = texture2D(uFoamTex, vec2(vUv.x * 2.6, vUv.y * 0.55 - uTime * spd * 0.1)).r * 0.6 + texture2D(uFoamTex, vec2(vUv.x * 5.3 + 0.3, vUv.y * 1.1 - uTime * spd * 0.16)).g * 0.5;
          float amt = rap * 0.55 + smoothstep(0.18, 0.0, thick) * 0.25;
          float thr = 1.05 - amt;
          float foam = max(smoothstep(thr - 0.16, thr + 0.2, strk) * clamp(amt * 3.0, 0.0, 1.0) * 0.8, lines * (0.35 + 0.65 * vFlow) * (1.0 - rap));` : `
          float foam = foamMask(vWPos.xz * 1.2, churn * 1.1, vec2(uTime * 0.02, -uTime * 0.015) + normalize(vWPos.xz - uRipple.xy + 1e-3) * uTime * 0.0) * 0.9;`}
          foam = clamp(max(foam, foamMask(vWPos.xz, rp.z, vec2(0.0))), 0.0, 0.92);
          // water full of air bubbles goes milky, so the white of a chute fades into it instead of ending in hard lines
          body = mix(body, vec3(0.5, 0.7, 0.64) * uWaterLight, clamp(${flowing ? 'smoothstep(0.5, 0.95, foamA) * 0.7' : 'churn * 0.5'}, 0.0, 1.0));
          vec3 spec = uSpecCol * (pow(sp, 500.0) * 1.7 + pow(sp, 60.0) * 0.07 + pow(sp, 2000.0) * 2.6) * (1.0 - foam);
          col = body * (1.0 - Tr) * (1.0 - F) + refl * F + spec;
          alpha = 1.0 - Tr * (1.0 - F);
          col = mix(col, uFoamCol * (0.85 + 0.15 * N.y), foam); alpha = mix(alpha, 1.0, foam);
          col += llWater(vWPos, N, V, body, foam);
          float edge = smoothstep(0.0, 0.06, thick);
          vec3 absorb = vec3(1.0); float gapR = 1.0;
          if (uDepthOn > 0.5) {
            float zW = max(linDepth(gl_FragCoord.z), 0.05);
            gapR = sceneGap(vec2(0.0)) * dist / zW;
            edge = min(edge, smoothstep(0.0, 0.08, gapR));
            absorb = exp(-clamp(gapR, 0.0, 20.0) * vec3(0.30, 0.06, 0.05));
          }
          col *= edge; alpha *= edge;
          // where the river leaves the pool the two surfaces cross-fade instead of meeting at an edge
          { vec2 pc = vWPos.xz - uPoolC.xy; float pr = length(pc);
            ${flowing ? 'float k = smoothstep(uPoolC.z + 0.2, uPoolC.z + 2.6, pr);' : 'float k = 1.0 - smoothstep(uPoolC.z + 0.1, uPoolC.z + 1.4, pr) * smoothstep(0.82, 0.94, dot(pc / max(pr, 1e-3), uPoolExit.xy)) * uPoolExit.z;'}
            col *= k; alpha *= k; }
          col = applyFog(col, vWPos, 1.0);
          if (uRefrOn > 0.5) {
            vec2 off = N.xz * 40.0 * clamp(thick, 0.0, 1.5) * edge * (uScreen.y / 900.0) / (1.0 + dist * 0.08) * (1.0 - foam);
            if (uDepthOn > 0.5 && sceneGap(off) < 0.0) off = vec2(0.0);
            col += refrAt(off) * mix(vec3(1.0), absorb, edge) * (1.0 - alpha); alpha = 1.0;
          }
          ${flowing ? `// at the mouth it thins away into the sea (drawn just before it) over about twenty metres
          { float mk = smoothstep(-15.0, 10.0, vSea);
            // and its sides melt into the sea too, rather than ending on a straight line
            mk *= mix(1.0, smoothstep(1.0, 0.35, abs(vRiv.x) / max(vRiv.y, 0.5)), 1.0 - smoothstep(0.0, 6.0, vSea));   // only where the sea is there underneath
            if (mk < 0.01) discard; col *= mk; alpha *= mk; }` : ''}
        } else {
          col = uWaterFog * 0.9 + uSpecCol * 0.05; alpha = 0.85; col *= alpha;
        }
        gl_FragColor = vec4(outCol(col / max(alpha, 1e-3)) * alpha, alpha);
      }`,
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}
function poolDisk(x, y, z, r, ripple) {
  const g = new THREE.CircleGeometry(r, 56).rotateX(-Math.PI / 2);
  const n = g.attributes.position.count;
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aFoam', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('aRiv', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const m = new THREE.Mesh(g, freshMaterial(false));
  m.material.uniforms.uRipple.value.copy(ripple);
  m.position.set(x, y, z); m.renderOrder = 6; markWater(m); scene.add(m); return m;
}
function riverRibbon(pts, kind) {
  const ACROSS = 9, P = [], UV = [], FL = [], FO = [], RV = [], DR = [], SE = [], I = [];
  let v = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i > 0) v += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) / 6;
    const nx = -p.tz, nz = p.tx, half = p.W + 0.9;
    p.rv = v;
    for (let k = 0; k < ACROSS; k++) {
      const u = k / (ACROSS - 1), off = (u - 0.5) * 2 * half;
      P.push(p.x + nx * off, p.S, p.z + nz * off);
      UV.push(u, v); RV.push(off, p.W, p.D); DR.push(p.tx, p.tz); SE.push(p.sUp !== undefined ? p.sUp : 1e3);
      FL.push(clamp((p.speed - 0.55) / 4, 0, 1)); FO.push(smoothstep(0.06, 0.16, p.slope));
    }
    if (i > 0) { const a = (i - 1) * ACROSS; for (let k = 0; k < ACROSS - 1; k++) I.push(a + k, a + k + ACROSS, a + k + 1, a + k + 1, a + k + ACROSS, a + k + ACROSS + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(FL, 1));
  g.setAttribute('aFoam', new THREE.Float32BufferAttribute(FO, 1));
  g.setAttribute('aRiv', new THREE.Float32BufferAttribute(RV, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(DR, 2));
  g.setAttribute('aSea', new THREE.Float32BufferAttribute(SE, 1));
  g.setIndex(I); g.computeBoundingSphere();
  const mat = freshMaterial(true);
  // drawn just in front of the sea where the two overlap at the mouth, so it fades over it cleanly
  mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -4;
  const m = new THREE.Mesh(g, mat); m.renderOrder = 6; markWater(m); scene.add(m); m.frustumCulled = false; m.userData.kind = kind; return m;
}
// The path the falls take: the river slides to the edge of the plateau, then falls, and wherever the
// rock face is in the way the water runs down over it instead of through it. Everything is measured
// along the falls' direction (d, from the lip) and up (y); the water has real thickness (th) and width (hw).
function fallsPath(lip, topY, botY, dirX, dirZ, lipW) {
  const ax = -dirZ, az = dirX;
  const gAt = (d, half) => { let m = -1e9; for (const t of [-0.85, -0.45, 0, 0.45, 0.85]) m = Math.max(m, groundHeight(lip.x + dirX * d + ax * t * half, lip.z + dirZ * d + az * t * half)); return m; };
  let edgeD = 0; while (edgeD < 14 && groundHeight(lip.x + dirX * edgeD, lip.z + dirZ * edgeD) > topY - 0.7) edgeD += 0.25;
  const out = [];
  const rec = (d, y, f) => out.push({ d, y, f, th: lerp(0.55, 1.5, Math.pow(f, 0.8)), hw: lipW * (1 + f * 0.35) });
  // its top sits just on the river's surface as it slides to the brink (no hump above the river)
  const y0 = topY + 0.05 - 0.55 * 0.5;
  for (let d = -3; d < edgeD - 0.01; d += 0.5) rec(d, y0, 0);
  let d = edgeD, y = y0, vd = Math.max(1.8, (lip.speed || 1.5) * 1.3), vy = 0, travel = 0;
  const dt = 0.008;
  for (let step = 0; step < 9000 && y > botY - 0.25; step++) {
    vy -= 9.8 * dt;
    const d0 = d, y0 = y;
    d += vd * dt; y += vy * dt;
    const f = clamp((topY - y) / Math.max(1, topY - botY), 0, 1), th = lerp(0.55, 1.5, Math.pow(f, 0.8)), hw = lipW * (1 + f * 0.35);
    const g = gAt(d, hw);
    if (y < g + th * 0.5) {
      // on a ledge or the sloping face: it pours along the rock
      y = g + th * 0.5;
      const sl = (gAt(d + 0.3, hw) - gAt(d - 0.3, hw)) / 0.6, sp = Math.hypot(vd, vy) * 0.99, l = Math.hypot(1, sl);
      if (sl < -0.05) { vd = sp / l; vy = sp * sl / l; } else { vd = Math.max(1.3, sp * 0.75); vy = 0; }
    }
    // and never sinks into the cliff behind it
    for (let k = 0; k < 60 && gAt(d - th * 0.5, hw) > y - 0.05; k++) d += 0.03;
    travel += Math.hypot(d - d0, y - y0);
    if (travel > 0.4) { travel = 0; rec(d, y, f); }
  }
  rec(d, Math.max(y, botY - 0.2), 1);
  return { pts: out, edgeD, endD: d, endX: lip.x + dirX * d, endZ: lip.z + dirZ * d };
}
function buildFreshwater() {
  const lip = STREAM.lip;
  const topY = lip.S, botY = POOL.level;
  const dirX = -WF.nx, dirZ = -WF.nz;
  const lipW = (lip.W || 2.5) * 0.92;
  const FP = fallsPath(lip, topY, botY, dirX, dirZ, lipW);
  const fallLen = FP.endD, endX = FP.endX, endZ = FP.endZ;
  const pd = poolDisk(POOL.x, POOL.level, POOL.z, POOL.r + 1.4, new THREE.Vector3(endX, endZ, 1));
  { const L0 = STREAM.lower[0]; if (L0) { const dx = L0.x - POOL.x, dz = L0.z - POOL.z, l = Math.hypot(dx, dz) || 1; pd.material.uniforms.uPoolExit.value.set(dx / l, dz / l, 1); } }
  poolDisk(SPRING.x, SPRING.level, SPRING.z, SPRING.r + 0.8, new THREE.Vector3(SPRING.x, SPRING.z, 0.45));
  STREAM.ribbons = [];
  if (STREAM.upper.length > 2) STREAM.ribbons.push(riverRibbon(STREAM.upper, 'upper'));
  const lowerVisible = STREAM.lower.filter(p => p.S > 0.04 || (p.sUp !== undefined && p.sUp > -16));
  if (lowerVisible.length > 2) STREAM.ribbons.push(riverRibbon([...(STREAM.leadIn || []), ...lowerVisible], 'lower'));
  STREAM.mouth = lowerVisible[lowerVisible.length - 1];
  // the falls: a thick body of water (an outer shell and a denser core) that follows the path above,
  // its cross-section always square to the flow: deep where it slides over the lip, wide and full as it falls
  const FPts = FP.pts;
  for (let i = 0; i < FPts.length; i++) {
    const a = FPts[Math.max(0, i - 1)], b = FPts[Math.min(FPts.length - 1, i + 1)];
    const td = b.d - a.d, ty = b.y - a.y, l = Math.hypot(td, ty) || 1;
    FPts[i].nd = -ty / l; FPts[i].ny = td / l;          // across the flow, in the (d, y) plane, pointing up/out
    if (FPts[i].ny < 0) { FPts[i].nd *= -1; FPts[i].ny *= -1; }
  }
  const fallMats = [];
  const curtain = (scaleW, scaleT, speed, phase) => {
    const segV = FPts.length - 1, ring = 18, P = [], UV = [], AT = [], NR = [], I = [];
    let arc = 0, prev = null;
    for (let iv = 0; iv <= segV; iv++) {
      const fp = FPts[iv], t = fp.f;
      const hw = fp.hw * scaleW, ht = fp.th * 0.5 * scaleT;
      const cx = lip.x + dirX * fp.d, cz = lip.z + dirZ * fp.d, y = fp.y;
      if (prev) arc += Math.hypot(cx - prev[0], y - prev[1], cz - prev[2]);
      prev = [cx, y, cz];
      for (let k = 0; k <= ring; k++) {
        // a rounded slab: flat-ish faces, round edges (a superellipse), lumpy as it breaks up
        const a = (k / ring) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const cs = Math.sign(ca) * Math.pow(Math.abs(ca), 0.55), sn = Math.sign(sa) * Math.pow(Math.abs(sa), 0.7);
        const lump = 1 + 0.18 * t * Noise.n2(k * 0.7 + phase, iv * 0.35);
        const side = cs * hw, thk = sn * ht * lump;
        P.push(cx - dirZ * side + dirX * fp.nd * thk, y + fp.ny * thk, cz + dirX * side + dirZ * fp.nd * thk);
        NR.push(-dirZ * ca * 0.5 + dirX * fp.nd * sa, fp.ny * sa, dirX * ca * 0.5 + dirZ * fp.nd * sa);
        UV.push(k / ring, arc / 2.6); AT.push(t);
      }
    }
    for (let iv = 0; iv < segV; iv++) for (let k = 0; k < ring; k++) { const a = iv * (ring + 1) + k, b = a + 1, c = a + ring + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(NR, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('aT', new THREE.Float32BufferAttribute(AT, 1));
    g.setIndex(I); g.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, ...WATER, ...WFX.uniforms, uSpeed: { value: speed }, uPhase: { value: phase }, uFlow: { value: 1 } },
      vertexShader: `${COMMON}
        attribute float aT; uniform float uPhase; varying vec2 vUv; varying vec3 vWPos; varying vec3 vNw; varying float vT;
        void main(){ vUv = uv; vT = aT; vNw = normal; vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.xyz += normal * (sin(uv.y * 5.0 - uTime * 6.0 + uv.x * 12.0 + uPhase) * 0.06 + sin(uv.y * 13.0 - uTime * 11.0 + uv.x * 31.0) * 0.025) * (0.3 + aT);
          vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `${COMMON}
        uniform vec3 uFoamCol; uniform vec3 uWaterLight; uniform vec3 uSpecCol; uniform float uSpeed; uniform float uPhase; uniform sampler2D uFoamTex; uniform float uFlow;
        varying vec2 vUv; varying vec3 vWPos; varying vec3 vNw; varying float vT;
        void main(){
          vec3 V = normalize(cameraPosition - vWPos), Nn = normalize(vNw);
          float fres = 1.0 - abs(dot(Nn, V));
          // long strands of aerated water racing down, at three speeds
          float s1 = texture2D(uFoamTex, vec2(vUv.x * 2.2 + uPhase, vUv.y * 0.16 - uTime * 0.95 * uSpeed)).r;
          float s2 = texture2D(uFoamTex, vec2(vUv.x * 4.6 + 0.3, vUv.y * 0.32 - uTime * 1.55 * uSpeed)).g;
          float s3 = texture2D(uNoiseTex, vec2(vUv.x * 1.1 + 0.7, vUv.y * 0.07 - uTime * 0.55 * uSpeed)).r;
          float s4 = texture2D(uNoiseTex, vec2(vUv.x * 7.0 + 0.1, vUv.y * 0.5 - uTime * 2.1 * uSpeed)).a;
          float aer = clamp(s1 * 0.5 + s2 * 0.38 + s3 * 0.35 + vT * 0.5 - 0.32, 0.0, 1.0);
          float white = smoothstep(0.18, 0.75, aer) * (0.3 + 0.7 * smoothstep(0.0, 0.3, vT));  // glassy as it slides over the lip, white as it breaks up
          // glassy, see-through water where it is still a smooth sheet near the lip
          vec3 glassC = mix(vec3(0.16, 0.34, 0.33), vec3(0.3, 0.5, 0.48), fres) * uWaterLight + skyHaze(reflect(-V, Nn)) * fres * 0.35;
          float lit = 0.8 + 0.2 * max(dot(Nn, uLightDir), 0.0);
          vec3 c = mix(glassC, uFoamCol * lit, white);
          c += uSpecCol * pow(max(dot(reflect(-V, Nn), uLightDir), 0.0), 40.0) * 0.25 * (1.0 - white);
          c += uFoamCol * smoothstep(0.75, 0.95, s4) * 0.25 * vT;
          float sideFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          // a full body of water: you can't see through it once it has broken up into white water
          float a = clamp(0.46 + white * 0.55 + fres * 0.22 + smoothstep(0.82, 0.97, s4) * 0.2 + vT * 0.15, 0.0, 0.97);
          a *= smoothstep(0.0, 1.2, vUv.y * 2.6);                           // fades in on the river surface
          // strands breaking into separate falling streaks near the bottom
          a *= 1.0 - smoothstep(0.55, 1.0, vT) * smoothstep(0.55, 0.25, s2) * 0.6;
          a *= uFlow;                                                            // runs dry when the river above is dammed
          vec3 col = applyFog(c, vWPos, 1.0);
          gl_FragColor = vec4(outCol(col) * a, a); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    fallMats.push(mat);
    const m = new THREE.Mesh(g, mat); m.renderOrder = 7; scene.add(m); return m;
  };
  curtain(1, 1, 1, 0);
  curtain(0.72, 0.55, 1.35, 3.1);
  // the churning white water where the falls hit the pool
  {
    const g = new THREE.CircleGeometry(5.5, 48).rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...U, ...WATER, ...WFX.uniforms, uC: { value: new THREE.Vector2(endX, endZ) }, uFlow: { value: 1 } },
      vertexShader: `${COMMON} uniform vec2 uC; varying vec3 vWPos; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); wp.y += sin(length(wp.xz - uC) * 3.0 - uTime * 7.0) * 0.03; vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `${COMMON} uniform vec3 uFoamCol; uniform vec2 uC; uniform sampler2D uFoamTex; uniform float uFlow; varying vec3 vWPos;
        void main(){
          vec2 d = vWPos.xz - uC; float r = length(d); vec2 dir = d / (r + 1e-3);
          float amt = smoothstep(5.4, 0.6, r) * 1.05;
          vec2 q = vec2(atan(d.y, d.x) * 1.4, r * 0.55 - uTime * 0.45);
          float v = texture2D(uFoamTex, q * 0.5).r * 0.6 + texture2D(uFoamTex, vWPos.xz * 0.35 + dir * uTime * 0.25).g * 0.4;
          float thr = 1.0 - clamp(amt, 0.0, 1.0) * 0.92;
          float f = smoothstep(thr - 0.06, thr + 0.1, v) * clamp(amt * 2.0, 0.0, 1.0);
          float a = f * 0.92 * uFlow;
          vec3 c = applyFog(uFoamCol * (0.9 + 0.1 * v), vWPos, 1.0);
          gl_FragColor = vec4(outCol(c) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    fallMats.push(mat);
    const m = new THREE.Mesh(g, mat); m.position.set(endX, POOL.level + 0.04, endZ); m.renderOrder = 7; scene.add(m);
  }
  WATER.uFallPos.value.set(endX, endZ);
  STREAM.fall = { x: endX, z: endZ, topY, botY, lipX: lip.x, lipZ: lip.z, dirX, dirZ, fallLen, path: FPts, edgeD: FP.edgeD, mats: fallMats };
  PLACES.falls = { x: POOL.x, z: POOL.z, r: 28, name: 'Hidden Falls', sub: `A ${Math.round(topY - botY)} m drop into a jungle pool` };
  PLACES.spring = { x: SPRING.x, z: SPRING.z, r: 14, name: 'The Spring', sub: 'Where the river begins' };
}
