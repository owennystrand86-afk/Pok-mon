import * as THREE from 'three';

/* =====================================================================
   BEACH PARADISE
   A first-person tropical island for desktop and mobile browsers.
   Everything (terrain, plants, textures, sound) is generated in code.
   ===================================================================== */

// ───────────────────────────── 1. Utilities ─────────────────────────────
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const TAU = Math.PI * 2;
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(20261107);
const rand = (a = 0, b = 1) => a + (b - a) * rng();
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[(rng() * arr.length) | 0];
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
// display-space colour vector (no colour management) from an [r,g,b] triple
const v3 = (r, g, b) => new THREE.Vector3(r, g, b);
const lerpArr = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// Simplex noise (2D) + fractal helpers
const Noise = (() => {
  const r = mulberry32(9157);
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm8 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm8[i] = perm[i] & 7; }
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  function n2(xin, yin) {
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt;
    tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = pm8[ii + perm[jj]]; tt *= tt; n += tt * tt * (GX[g] * x0 + GY[g] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = pm8[ii + i1 + perm[jj + j1]]; tt *= tt; n += tt * tt * (GX[g] * x1 + GY[g] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = pm8[ii + 1 + perm[jj + 1]]; tt *= tt; n += tt * tt * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  }
  function fbm(x, y, oct) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
  function ridged(x, y, oct) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(n2(x * f + i * 17.3, y * f)); s += a * n * n; f *= 2.1; a *= 0.5; } return s; }
  const n3 = (x, y, z) => (n2(x + z * 0.71, y - z * 0.37) + n2(y + 31.7, z + x * 0.53)) * 0.5;
  return { n2, fbm, ridged, n3 };
})();

// ───────────────────────────── 2. Settings ─────────────────────────────
const STORE_KEY = 'beach-paradise:settings:v1';
const isTouch = (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;
const isMobile = isTouch || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
if (isTouch) document.body.classList.add('touch');
const DEFAULTS = {
  quality: isMobile ? 'medium' : 'high', fov: 75, headBob: true, autoRes: true,
  master: 0.85, ambience: 1, music: 0.3, sensitivity: 1, invertY: false,
  timeFlow: true, dayMinutes: 24, weather: 'auto', placeNames: true,
  waveSize: 1, tsunamiSize: 'big', tsunamiSpeed: 1, shovelPower: 1, pumpFlow: 1, windSpeed: 1, glow: true, waterStyle: 'tropical', skyStyle: 'physical',
};
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
function saveSettings() { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
const QUALITY = {
  // post: the HDR final image (see section 8d); ao: contact shading (1 or 2 = finer); rays: sun shafts; msaa: smooth edges on computers
  low:    { pr: 0.75, shadow: 0,    veg: 0.32, near: 60,  farMul: 0.6, particles: 0.35, fish: 0.45, refr: false, glow: false, post: false },
  medium: { pr: 1.0,  shadow: 1024, veg: 0.55, near: 90,  farMul: 0.8, particles: 0.65, fish: 0.7, glow: true, ao: 1, rays: true },
  high:   { pr: 1.5,  shadow: 2048, veg: 0.8,  near: 125, farMul: 1.0, particles: 1.0,  fish: 1.0, glow: true, ao: 1, rays: true, msaa: true },
  ultra:  { pr: 2.0,  shadow: 4096, veg: 1.0,  near: 175, farMul: 1.25, particles: 1.0, fish: 1.0, glow: true, planar: true, ao: 2, rays: true, msaa: true },
  // everything at full sharpness: the screen's own resolution (4K on a 4K screen), the finest sea, no frame-rate saving
  max:    { pr: 4.0,  shadow: 4096, veg: 1.0,  near: 220, farMul: 1.4, particles: 1.0, fish: 1.0, glow: true, ocean: 'max', noAutoRes: true, planar: true, ao: 2, rays: true, msaa: true },
};
let Q = QUALITY[settings.quality] || QUALITY.high;

// ───────────────────────────── 3. Renderer ─────────────────────────────
const canvas = document.getElementById('game');
function fatal(msg) {
  const d = document.createElement('div'); d.id = 'fatal';
  d.innerHTML = `<div><h1 style="font-size:44px">Beach Paradise</h1><p>${msg}</p></div>`;
  document.body.appendChild(d);
}
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || settings.quality === 'max' || settings.quality === 'ultra', powerPreference: 'high-performance', stencil: false });
} catch (e) {
  fatal('This browser could not start WebGL, which the island needs. Try a current version of Chrome, Safari, Edge or Firefox with hardware acceleration turned on.');
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // shadows are drawn once per frame, in the first pass (see renderWorld)
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
let pixelRatio = Math.min(window.devicePixelRatio || 1, Q.pr);
let resScale = 1; // adaptive multiplier
function applySize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio * resScale);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; updateFov();
}
// tall phone screens get a wider vertical view so the sides of the scene stay visible
function updateFov() {
  let fov = settings.fov;
  if (camera.aspect < 1) fov = Math.min(92, Math.max(fov, (2 * Math.atan(Math.tan((52 * Math.PI) / 360) / camera.aspect) * 180) / Math.PI));
  camera.fov = fov; camera.updateProjectionMatrix();
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.12, 14000);
camera.rotation.order = 'YXZ';
scene.add(camera);

// ──────────────────── 4. Shared uniforms and shader code ────────────────────
// breaker heights for 16 consecutive waves (repeating every ~2 minutes); a set of three big ones rolls in each cycle
const SURF_TABLE = Array.from({ length: 16 }, (_, i) => 0.27 + 0.32 * mulberry32(700 + i * 13)());
SURF_TABLE[4] = 0.74; SURF_TABLE[5] = 1.02; SURF_TABLE[6] = 0.86; SURF_TABLE[12] = 0.66;
for (let i = 0; i < 16; i++) SURF_TABLE[i] *= 1.3; // peaks along a crest are taller, shoulders lower (see surfVar)
const U = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uLightDir: { value: new THREE.Vector3(0, 1, 0) },
  uSkyZenith: { value: v3(0.2, 0.45, 0.85) },
  uSkyHorizon: { value: v3(0.65, 0.82, 0.95) },
  uSkyGlow: { value: v3(1, 0.9, 0.8) },
  uGlowAmt: { value: 0.1 },
  uFogDensity: { value: 0.00042 },
  uUnderwater: { value: 0 },
  uWaterFog: { value: v3(0.05, 0.38, 0.48) },
  uWaterFogDensity: { value: 0.045 },
  uWind: { value: 1 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6) },
  uRain: { value: 0 },
  uWet: { value: 0 },
  uLightning: { value: 0 },
  uDaylight: { value: 1 },
  uSunLin: { value: new THREE.Vector3(3, 3, 3) },
  uNoiseTex: { value: null },
  uHeightTex: { value: null },
  uTerrainRect: { value: new THREE.Vector4() },
  uFarTex: { value: null }, uFarRect: { value: new THREE.Vector4(-8000, -8000, 1 / 16000, 0) },
  uSurfAmp: { value: 1 },
  uSurfTable: { value: SURF_TABLE },
  uCloudCover: { value: 0.2 },
  uTsu: { value: new THREE.Vector4(-5000, 0, 55, 0) }, // front position, height, width, strength
  uTsuDir: { value: new THREE.Vector2(1, 0) },
  uDestroyTex: { value: null }, uDestroyRect: { value: new THREE.Vector4(0, 0, 1, 0) },
  uSonar: { value: 0 }, uSonarTag: { value: 0 }, uSubL: { value: new THREE.Vector4(0, 0, 0, 0) }, uSubD: { value: new THREE.Vector3(0, 0, -1) },
  // the lantern and the boat's headlights, for the shaders that do their own lighting (water)
  // 1 while the world is being drawn into the HDR targets (see the final-image section), and the exposure the last pass will apply
  uHDR: { value: 0 }, uExposure: { value: 1 },
  uLLPos: { value: [0, 1, 2].map(() => new THREE.Vector4(0, -999, 0, 1)) }, uLLCol: { value: [0, 1, 2].map(() => new THREE.Vector4(0, 0, 0, 0)) }, uLLDir: { value: [0, 1, 2].map(() => new THREE.Vector4(0, -1, 0, -2)) },
};

const COMMON = /* glsl */`
uniform float uTime; uniform vec3 uSunDir; uniform vec3 uLightDir;
uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon; uniform vec3 uSkyGlow; uniform float uGlowAmt;
uniform float uFogDensity; uniform float uUnderwater; uniform vec3 uWaterFog; uniform float uWaterFogDensity;
uniform float uWind; uniform vec2 uWindDir; uniform float uRain; uniform float uWet; uniform float uLightning;
uniform float uDaylight; uniform vec3 uSunLin; uniform sampler2D uNoiseTex; uniform sampler2D uHeightTex;
uniform vec4 uTerrainRect; uniform float uSurfAmp; uniform float uSurfTable[16]; uniform float uCloudCover;
uniform vec4 uTsu; uniform vec2 uTsuDir; uniform sampler2D uDestroyTex; uniform vec4 uDestroyRect;
uniform float uSonar; uniform float uSonarTag; uniform vec4 uSubL; uniform vec3 uSubD;
uniform vec4 uLLPos[3]; uniform vec4 uLLCol[3]; uniform vec4 uLLDir[3];
uniform float uHDR; uniform float uExposure;
// The filmic tone curve the screen uses (ACES fit), and its exact inverse. Shaders that paint a
// colour meant for the screen send it through toHDR() when the world is being drawn in HDR, so it
// still comes out as that colour after the final pass, while anything brighter than white keeps
// its extra energy for the glow.
vec3 bpFit(vec3 v){ return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
vec3 toDisplay(vec3 c){
  const mat3 AI = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 AO = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  c = clamp(AO * bpFit(AI * (c * (uExposure / 0.6))), 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(0.416667)) - 0.055, step(vec3(0.0031308), c));
}
vec3 toHDR(vec3 d){
  const mat3 AII = mat3(1.764741, -0.147028, -0.036337, -0.675778, 1.160252, -0.162436, -0.088963, -0.013224, 1.198773);
  const mat3 AOI = mat3(0.643038, 0.059269, 0.005962, 0.311187, 0.931436, 0.063929, 0.045775, 0.009295, 0.930118);
  float over = max(max(d.r, max(d.g, d.b)) - 0.985, 0.0);
  d = clamp(d, 0.0, 0.985);
  vec3 c = mix(d / 12.92, pow((d + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), d));
  vec3 y = clamp(AOI * c, 0.0, 0.99);
  vec3 A = 1.0 - 0.983729 * y, B = 0.0245786 - 0.432951 * y, C = -(0.000090537 + 0.238081 * y);
  vec3 v = (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
  return (AII * v) * (0.6 / uExposure) * (1.0 + min(over, 3.0) * 1.5);
}
vec3 outCol(vec3 d){ return uHDR > 0.5 ? toHDR(d) : d; }
// light from local lamp i at P (pos.w = reach, col.w = strength, dir.w = cos of a spotlight's edge, or -2)
vec3 llAt(int i, vec3 P, out vec3 Ld){
  vec3 d = uLLPos[i].xyz - P; float dd = dot(d, d), dl = sqrt(dd);
  Ld = d / max(dl, 1e-4);
  float a = uLLCol[i].w / (1.0 + dd) * (1.0 - smoothstep(uLLPos[i].w * 0.5, uLLPos[i].w, dl));
  if (uLLDir[i].w > -1.5) a *= smoothstep(uLLDir[i].w, mix(uLLDir[i].w, 1.0, 0.4), dot(-Ld, uLLDir[i].xyz));
  return uLLCol[i].rgb * a;
}
float flattenedAt(vec3 p){ if (uDestroyRect.w < 0.5) return 0.0; return texture2D(uDestroyTex, (p.xz - uDestroyRect.xy) * uDestroyRect.z).r; }
float sech2(float x){ float e = exp(-abs(x)); return 4.0 * e * e / ((1.0 + e * e) * (1.0 + e * e)); }
// a tsunami: the sea draws back, then a steep wall of water arrives and floods the low ground behind the beach
float tsunamiH(vec2 p, float depth){
  if (uTsu.w < 0.001) return 0.0;
  float s = dot(p, uTsuDir) - uTsu.x, w = uTsu.z;
  // the front steepens as the water shallows: a long swell offshore, a near-vertical wall at the beach
  float crest = sech2(s / (s > 0.0 ? w * mix(0.13, 0.3, smoothstep(2.0, 30.0, depth)) : w * 1.5));
  float tail = s < 0.0 ? 0.42 * exp(s / 520.0) : 0.0;
  float draw = -0.4 * exp(-pow((s - 2.6 * w) / (1.1 * w), 2.0));
  float shoal = clamp(pow(30.0 / max(depth, 3.0), 0.25), 1.0, 1.5);
  float A = uTsu.y * uTsu.w * shoal;
  float e = A * (max(crest, tail) + draw);
  if (depth < 0.0 && e > 0.0) e *= exp(depth / max(e * 1.5, 0.1));
  return e;
}
uniform sampler2D uFarTex; uniform vec4 uFarRect;
// the home island's detailed height map, and beyond it the deep ocean and the other islands
vec2 terrainHC(vec2 p){
  vec2 uv = (p - uTerrainRect.xy) * uTerrainRect.z + uTerrainRect.w;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) return texture2D(uHeightTex, uv).rg;
  return texture2D(uFarTex, (p - uFarRect.xy) * uFarRect.z).rg;
}
float terrainH(vec2 p){ return terrainHC(p).x; }
// 0 out at sea, 1 inside the river channel well upstream of its mouth: the sea's waves die away up the river
float riverCalm(vec2 p){
  vec2 uv = (p - uTerrainRect.xy) * uTerrainRect.z + uTerrainRect.w;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) return texture2D(uHeightTex, uv).b;
  return 0.0;
}
float coastL(vec2 p){ return terrainHC(p).y; }
vec3 skyHaze(vec3 dir){
  float sd = max(dot(dir, uSunDir), 0.0);
  vec3 c = mix(uSkyHorizon, uSkyGlow, uGlowAmt * pow(sd, 3.0) * 0.85);
  c += uSkyGlow * (uGlowAmt * pow(sd, 14.0) * 0.22);
  return c + uLightning * vec3(0.30, 0.33, 0.45);
}
// the haze between you and a point: its colour (for the screen) and how much of it there is
vec4 fogCF(vec3 wp, float mul){
  vec3 d = wp - cameraPosition; float dist = length(d) + 1e-4;
  if (uUnderwater > 0.5) return vec4(uWaterFog, 1.0 - exp(-dist * uWaterFogDensity));
  float fd = uFogDensity * mul * dist; float f = 1.0 - exp(-fd * fd);
  f *= 1.0 - 0.45 * smoothstep(0.0, 0.6, d.y / dist);
  return vec4(skyHaze(d / dist), f);
}
vec3 applyFog(vec3 col, vec3 wp, float mul){ vec4 cf = fogCF(wp, mul); return mix(col, cf.rgb, cf.a); }
// the same haze over a colour in HDR (light adds up in linear terms, so the amount is eased to look the same)
vec3 applyFogHDR(vec3 col, vec3 wp, float mul){ vec4 cf = fogCF(wp, mul); return mix(col, toHDR(cf.rgb), pow(cf.a, 1.5)); }
float surfOff(vec2 p){ return 0.18 * sin(p.x * 0.0041 + p.y * 0.0063) + 0.12 * sin(p.y * 0.0131 - p.x * 0.0077 + 1.7) + 0.07 * sin(p.x * 0.021 - p.y * 0.017) + 0.045 * sin(p.x * 0.009 + p.y * 0.026 + 2.0)
  + 0.03 * sin(p.x * 0.071 + p.y * 0.049 + 0.4) + 0.02 * sin(p.y * 0.113 - p.x * 0.083 + 0.7); }   // the last two bend each crest line so it is never a straight bar
// each wave is taller in some places than others along its crest: peaks and shoulders, never a wall
float surfVar(vec2 p, float nn){ return 0.68 + 0.18 * sin(dot(p, vec2(0.031, 0.022)) + nn * 2.3) + 0.09 * sin(dot(p, vec2(-0.017, 0.043)) + nn * 1.1 + 1.3) + 0.06 * sin(dot(p, vec2(0.083, -0.061)) + nn * 3.7); }
// The surf, wave by wave. Each wave rolls in along the depth contours, slowing as the water gets
// shallow (so the crests bunch up), growing taller as it shoals, and breaking once its crest is about
// half the depth: first a lip that pitches forward, then a white bore that runs to the sand and
// rushes up the beach. s = (phase g, crest height a, how broken 0..1, how hard it is plunging 0..1)
float surfAmpN(vec2 p, float m){ return uSurfTable[int(mod(m, 16.0))] * uSurfAmp * surfVar(p, m); }
float surfPsi(vec2 p, float depth){ return uTime / 8.5 + surfOff(p) + 1.25 * (sqrt(max(depth, 0.0) + 0.04) - 0.2); }
float surfAt(vec2 p, float depth, float cL, out vec4 s){
  float d = max(depth, 0.0);
  float psi = surfPsi(p, depth);
  float n = floor(psi), g = psi - n;
  float Hb = mix(surfAmpN(p, n), surfAmpN(p, n + 1.0), smoothstep(0.5, 0.78, g));
  float zk = max(1.0, uSurfAmp * 0.75);
  float zone = depth > 0.0 ? smoothstep(16.0 * zk, 4.0 * zk, depth) * smoothstep(-100.0 * zk, -40.0, cL) : 1.0;
  float db = Hb / 0.7 + 0.2, r = d / db;
  float brk = 1.0 - smoothstep(0.75, 1.0, r);
  float plunge = smoothstep(1.1, 0.95, r) * smoothstep(0.62, 0.85, r);
  float aUn = Hb * mix(0.5, 1.0, smoothstep(3.5, 1.0, r));
  float aBr = Hb * (0.35 + 0.45 * clamp(r, 0.0, 1.0)) + 0.03;
  float a = mix(aUn, aBr, brk) * zone;
  // a rounded crest and a face about as wide as the wave is tall: never a slab with a vertical edge
  float wf = mix(mix(0.4, 0.2, smoothstep(2.5, 1.0, r)), mix(0.34, 0.17, smoothstep(0.0, 0.5, d)), brk);
  float steep = clamp(smoothstep(2.2, 1.0, r) + brk, 0.0, 1.0), sh;
  if (g > 1.0 - wf) { float x = (g - 1.0 + wf) / wf; float sm = x * x * (3.0 - 2.0 * x); sh = mix(sm, sm * 0.55 + pow(x, 2.2) * 0.45, steep); }
  else { float x = g / (1.0 - wf); float xb = x < 0.12 ? x * x / 0.24 : x - 0.06; sh = mix(1.0 - x * x * (3.0 - 2.0 * x), pow(max(1.0 - xb / 0.94, 0.0), 1.3), brk); }
  s = vec4(g, a, brk * zone, plunge * zone);
  return a * (sh - mix(0.2, 0.1, brk));
}
float surfAt(vec2 p, float depth, out vec4 s){ return surfAt(p, depth, coastL(p), s); }
float causticPat(vec2 p){
  // classic iterated-trig caustic web, tiled every ~7 m
  vec2 q = mod(p * 0.85, 6.2831853) - 250.0;
  float t = uTime * 0.42 + 23.0;
  vec2 i = q; float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / 0.005), q.y / (cos(i.y + tt) / 0.005)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.6);
}
`;

// Underwater light absorption + caustics, applied to every lit material below sea level
const UNDER_GLSL = /* glsl */`
{
  float dBelow = -vWPos.y;
  if (dBelow > 0.0) {
    float cFade = 1.0 - smoothstep(22.0, 60.0, length(vWPos - cameraPosition));
    if (cFade > 0.0) outgoingLight += diffuseColor.rgb * uSunLin * causticPat(vWPos.xz) * 0.5 * exp(-dBelow * 0.06) * smoothstep(0.0, 0.8, dBelow) * cFade;
    outgoingLight *= exp(-dBelow * vec3(0.13, 0.045, 0.03));
    // the submarine's searchlights
    if (uSubL.w > 0.5) {
      vec3 Ls = uSubL.xyz - vWPos; float dl = length(Ls); vec3 Ld = Ls / max(dl, 1e-3);
      vec3 nW = normalize(inverseTransformDirection(normal, viewMatrix));
      float cone = smoothstep(0.78, 0.93, dot(-Ld, uSubD));
      outgoingLight += diffuseColor.rgb * vec3(1.0, 0.96, 0.86) * cone * max(dot(nW, Ld), 0.0) * 9.0 / (1.0 + dl * dl * 0.02) * exp(-dl * 0.04);
    }
    // sonar: everything as glowing contours in sweeping rings; living things stand out
    if (uSonar > 0.5) {
      float dc = length(vWPos - cameraPosition);
      vec3 nW = normalize(inverseTransformDirection(normal, viewMatrix));
      float facing = abs(dot(nW, normalize(cameraPosition - vWPos)));
      float ring = smoothstep(0.92, 1.0, fract(dc * 0.04 - uTime * 0.35)) * (1.0 - smoothstep(60.0, 260.0, dc));
      float grid = max(smoothstep(0.94, 1.0, fract(vWPos.x * 0.1)), smoothstep(0.94, 1.0, fract(vWPos.z * 0.1))) * 0.35 + smoothstep(0.9, 1.0, fract(vWPos.y * 0.2)) * 0.5;
      vec3 base = uSonarTag > 0.5 ? vec3(1.0, 0.45, 0.12) * (0.6 + 0.6 * facing) : vec3(0.08, 0.55, 0.38) * (0.25 + 0.6 * facing);
      outgoingLight = base * (1.0 - smoothstep(80.0, 320.0, dc) * 0.85) + vec3(0.3, 1.0, 0.7) * (ring + grid * (1.0 - smoothstep(30.0, 120.0, dc))) * (uSonarTag > 0.5 ? 0.3 : 1.0);
    }
  }
}
`;

/**
 * Inject island-wide behaviour into a built-in three.js material:
 * sky-matched fog, underwater absorption, wind and other vertex animation.
 */
function patch(mat, o = {}) {
  const key = o.key || 'std';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, o.uniforms || {});
    let vs = sh.vertexShader, fs = sh.fragmentShader;
    vs = vs.replace('#include <common>', '#include <common>\n' + COMMON + '\nvarying vec3 vWPos;\n' + (o.vHead || ''));
    if (o.vBegin) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + o.vBegin);
    if (o.vNormal) vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + o.vNormal);
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 bpW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        bpW = instanceMatrix * bpW;
      #endif
        bpW = modelMatrix * bpW; vWPos = bpW.xyz; }
      ` + (o.vEnd || ''));
    fs = fs.replace('#include <common>', '#include <common>\n' + COMMON + '\nvarying vec3 vWPos;\n' + (o.fHead || ''));
    if (o.fade) fs = fs.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float fdist = length(vWPos.xz - cameraPosition.xz);
        float fz = (fdist - uFadeStart) / max(uFadeLen, 1.0);
        if (fz > 0.0) { float dn = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453); if (dn < fz) discard; } }`);
    if (o.fMap) fs = fs.replace('#include <map_fragment>', '#include <map_fragment>\n' + o.fMap);
    if (o.fColor) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + o.fColor);
    if (o.fRough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + o.fRough);
    if (o.fNormal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + o.fNormal);
    if (o.under !== false) fs = fs.replace('#include <opaque_fragment>', (o.fLight || '') + UNDER_GLSL + '\n#include <opaque_fragment>');
    else if (o.fLight) fs = fs.replace('#include <opaque_fragment>', o.fLight + '\n#include <opaque_fragment>');
    fs = fs.replace('#include <fog_fragment>', `gl_FragColor.rgb = uHDR > 0.5 ? applyFogHDR(gl_FragColor.rgb, vWPos, ${(o.fog ?? 1).toFixed(3)}) : applyFog(gl_FragColor.rgb, vWPos, ${(o.fog ?? 1).toFixed(3)});`);
    sh.vertexShader = vs; sh.fragmentShader = fs;
    if (o.onShader) o.onShader(sh);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
// matching shadow-depth material, so animated/displaced meshes cast correct shadows
function depthMat(o = {}, map = null, alphaTest = 0) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, o.uniforms || {});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + COMMON + (o.vHead || ''));
    if (o.vBegin) sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + o.vBegin);
  };
  m.customProgramCacheKey = () => 'depth-' + (o.key || 'std');
  return m;
}
const fadeUniforms = (start, len) => ({ uFadeStart: { value: start }, uFadeLen: { value: len } });
const FADE_HEAD = 'uniform float uFadeStart; uniform float uFadeLen;\n';

// ───────────────────── 5. Procedural textures ─────────────────────
function tileFbm(size, baseFreq, octaves, seed, gain = 0.5) {
  const out = new Float32Array(size * size);
  const r = mulberry32(seed);
  let amp = 1;
  for (let o = 0; o < octaves; o++) {
    const f = baseFreq << o;
    const lat = new Float32Array(f * f); for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * f, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % f) * f, yb = ((y0 + 1) % f) * f;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * f, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % f, xb = (x0 + 1) % f;
        const a = lat[ya + xa] + (lat[ya + xb] - lat[ya + xa]) * sx;
        const b = lat[yb + xa] + (lat[yb + xb] - lat[yb + xa]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    amp *= gain;
  }
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < out.length; i++) { if (out[i] < mn) mn = out[i]; if (out[i] > mx) mx = out[i]; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}
function dataTex(data, size, opts = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = opts.aniso || 1;
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
function makeNoiseTexture() {
  const S = 256;
  const r = tileFbm(S, 4, 5, 11), g = tileFbm(S, 8, 4, 23), b = tileFbm(S, 4, 2, 37, 0.35), a = tileFbm(S, 32, 3, 51);
  const d = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { d[i * 4] = r[i] * 255; d[i * 4 + 1] = g[i] * 255; d[i * 4 + 2] = b[i] * 255; d[i * 4 + 3] = a[i] * 255; }
  return dataTex(d, S, { aniso: maxAniso });
}
function makeCloudTexture() {
  const S = 256;
  const r = tileFbm(S, 4, 6, 101, 0.52), g = tileFbm(S, 8, 5, 131, 0.55);
  const d = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { d[i * 4] = r[i] * 255; d[i * 4 + 1] = g[i] * 255; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
  return dataTex(d, S);
}
function makeWaterNormalTexture() {
  const S = 256;
  const h = tileFbm(S, 8, 5, 211, 0.55);
  const d = new Uint8Array(S * S * 4);
  const k = 7.0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hx = h[y * S + ((x + 1) % S)] - h[y * S + ((x - 1 + S) % S)];
    const hy = h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x];
    let nx = -hx * k, ny = -hy * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  return dataTex(d, S, { aniso: maxAniso });
}
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = maxAniso; t.wrapS = t.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return t;
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
