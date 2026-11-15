
// ───────────────────── 20. Sun, moon, time of day and weather ─────────────────────
const sun = new THREE.DirectionalLight(0xffffff, 3);
const SHADOW_EXTENT = 64;
function configureShadows() {
  sun.castShadow = Q.shadow > 0;
  const size = Q.shadow || 1024;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  const ext = SHADOW_EXTENT * (Q.shadow >= 4096 ? 1.4 : 1);
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 700 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.45;
}
configureShadows();
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0xd9c6a0, 1.0);
scene.add(hemi);

const ENV = {
  hour: 15.6, sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), elev: 0.5,
  daylight: 1, night: 0, rainRecent: 0, rainbow: 0, wet: 0, lightning: 0, nextBolt: 8, wind: 1, cloudOff: new THREE.Vector2(),
};
const SKY_KEYS = [
  { e: -0.35, zen: [0.012, 0.022, 0.06], hor: [0.035, 0.055, 0.11], glow: [0.05, 0.06, 0.12], ga: 0, sun: [0.55, 0.65, 1.0], sunI: 0, hs: [0.16, 0.24, 0.42], hg: [0.06, 0.07, 0.1], hi: 0.5, exp: 1.6, disk: [0, 0, 0], cl: [0.1, 0.12, 0.17], cs: [0.04, 0.05, 0.08], wl: [0.1, 0.13, 0.2], fo: [0.17, 0.2, 0.26], uw: [0.005, 0.025, 0.05] },
  { e: -0.12, zen: [0.035, 0.06, 0.15], hor: [0.16, 0.15, 0.26], glow: [0.5, 0.26, 0.32], ga: 0.35, sun: [0.6, 0.6, 0.9], sunI: 0, hs: [0.25, 0.3, 0.5], hg: [0.12, 0.1, 0.12], hi: 0.44, exp: 1.38, disk: [0, 0, 0], cl: [0.3, 0.25, 0.33], cs: [0.12, 0.12, 0.18], wl: [0.22, 0.22, 0.32], fo: [0.4, 0.38, 0.45], uw: [0.01, 0.06, 0.1] },
  { e: -0.025, zen: [0.12, 0.17, 0.36], hor: [0.66, 0.42, 0.38], glow: [1.0, 0.42, 0.24], ga: 0.85, sun: [1.0, 0.42, 0.2], sunI: 0.15, hs: [0.5, 0.42, 0.52], hg: [0.3, 0.22, 0.18], hi: 0.58, exp: 1.15, disk: [1.0, 0.45, 0.22], cl: [0.95, 0.5, 0.42], cs: [0.36, 0.27, 0.36], wl: [0.55, 0.42, 0.42], fo: [0.85, 0.65, 0.6], uw: [0.03, 0.14, 0.2] },
  { e: 0.04, zen: [0.2, 0.32, 0.6], hor: [0.98, 0.68, 0.46], glow: [1.0, 0.55, 0.25], ga: 1.0, sun: [1.0, 0.55, 0.3], sunI: 1.3, hs: [0.6, 0.6, 0.7], hg: [0.5, 0.38, 0.28], hi: 0.78, exp: 1.0, disk: [1.0, 0.62, 0.3], cl: [1.0, 0.74, 0.55], cs: [0.48, 0.42, 0.5], wl: [0.8, 0.68, 0.6], fo: [1.0, 0.86, 0.75], uw: [0.04, 0.24, 0.32] },
  { e: 0.15, zen: [0.22, 0.44, 0.78], hor: [0.86, 0.82, 0.76], glow: [1.0, 0.8, 0.55], ga: 0.5, sun: [1.0, 0.8, 0.58], sunI: 2.4, hs: [0.62, 0.74, 0.9], hg: [0.62, 0.55, 0.42], hi: 0.95, exp: 0.95, disk: [1.0, 0.86, 0.62], cl: [1.0, 0.93, 0.82], cs: [0.58, 0.6, 0.68], wl: [0.92, 0.9, 0.86], fo: [1.0, 0.97, 0.92], uw: [0.06, 0.4, 0.52] },
  { e: 0.35, zen: [0.18, 0.45, 0.85], hor: [0.66, 0.82, 0.95], glow: [1.0, 0.93, 0.8], ga: 0.18, sun: [1.0, 0.94, 0.84], sunI: 3.0, hs: [0.62, 0.78, 1.0], hg: [0.72, 0.64, 0.5], hi: 1.1, exp: 0.92, disk: [1.0, 0.97, 0.88], cl: [1.0, 1.0, 0.98], cs: [0.62, 0.67, 0.76], wl: [1, 1, 1], fo: [0.96, 0.98, 1.0], uw: [0.06, 0.45, 0.56] },
  { e: 0.8, zen: [0.13, 0.40, 0.84], hor: [0.62, 0.80, 0.95], glow: [1.0, 0.97, 0.9], ga: 0.1, sun: [1.0, 0.97, 0.92], sunI: 3.3, hs: [0.6, 0.78, 1.0], hg: [0.75, 0.66, 0.52], hi: 1.15, exp: 0.9, disk: [1, 0.98, 0.93], cl: [1, 1, 1], cs: [0.64, 0.69, 0.78], wl: [1.02, 1.02, 1.02], fo: [0.97, 0.99, 1.0], uw: [0.07, 0.48, 0.58] },
];
function sampleSky(e) {
  let i = 0; while (i < SKY_KEYS.length - 2 && e > SKY_KEYS[i + 1].e) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], t = clamp((e - a.e) / (b.e - a.e), 0, 1);
  const o = {};
  for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? lerpArr(a[k], b[k], t) : lerp(a[k], b[k], t);
  return o;
}
const WEATHER_TYPES = {
  clear:   { cover: 0.1, dark: 0, rain: 0, fog: 1.0, wind: 0.7, storm: 0, waves: 0.9 },
  fair:    { cover: 0.34, dark: 0.04, rain: 0, fog: 1.0, wind: 0.9, storm: 0, waves: 1.0 },
  cloudy:  { cover: 0.64, dark: 0.22, rain: 0, fog: 1.4, wind: 1.1, storm: 0, waves: 1.1 },
  drizzle: { cover: 0.8, dark: 0.36, rain: 0.3, fog: 1.9, wind: 1.1, storm: 0, waves: 1.15 },
  rain:    { cover: 0.92, dark: 0.52, rain: 0.78, fog: 2.5, wind: 1.35, storm: 0, waves: 1.35 },
  storm:   { cover: 1.0, dark: 0.72, rain: 1.0, fog: 2.8, wind: 1.9, storm: 1, waves: 1.75 },
  mist:    { cover: 0.42, dark: 0.08, rain: 0, fog: 15.0, wind: 0.35, storm: 0, waves: 0.75 },
  windy:   { cover: 0.5, dark: 0.12, rain: 0, fog: 1.3, wind: 2.5, storm: 0, waves: 1.7 },
  thunderstorm: { cover: 1.0, dark: 0.86, rain: 1.0, fog: 3.4, wind: 2.7, storm: 2, waves: 2.1 },
  hurricane: { cover: 1.0, dark: 0.92, rain: 1.0, fog: 5.0, wind: 4.2, storm: 1.6, waves: 2.9 },
};
const WX = { cur: { ...WEATHER_TYPES.fair }, target: 'fair', timer: 260 };
function pickWeather() {
  const opts = [['clear', 32], ['fair', 32], ['cloudy', 12], ['drizzle', 8], ['rain', 6], ['storm', 3], ['windy', 5], ['thunderstorm', 2]];
  if (ENV.hour > 4.5 && ENV.hour < 9.5) opts.push(['mist', 14]);
  let total = 0; for (const o of opts) total += o[1];
  let r = rng() * total; for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
  return 'fair';
}
const MAP_SETTING_WEATHER = { clear: 'clear', cloudy: 'cloudy', rain: 'rain', storm: 'storm', mist: 'mist', windy: 'windy', thunderstorm: 'thunderstorm', hurricane: 'hurricane' };
function updateWeather(dt) {
  if (settings.weather === 'auto') {
    WX.timer -= dt;
    if (WX.timer <= 0) { WX.target = pickWeather(); WX.timer = rand(170, 380); }
  } else WX.target = MAP_SETTING_WEATHER[settings.weather] || 'clear';
  const tgt = WEATHER_TYPES[WX.target];
  const k = 1 - Math.exp(-dt / 38);
  for (const key of Object.keys(tgt)) WX.cur[key] = lerp(WX.cur[key], tgt[key], key === 'rain' ? k * 1.3 : k);
  ENV.rainRecent = Math.max(WX.cur.rain, ENV.rainRecent - dt / 140);
  ENV.wet = clamp(ENV.wet + (WX.cur.rain > 0.15 ? dt / 25 : -dt / 160), 0, 1);
}
function snapWeather() { const t = WEATHER_TYPES[WX.target]; Object.assign(WX.cur, t); }

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const setV = (v, a, m = 1) => v.set(a[0] * m, a[1] * m, a[2] * m);
const lum = a => a[0] * 0.3 + a[1] * 0.55 + a[2] * 0.15;
const grayMix = (a, t, tint = [1, 1, 1]) => { const l = lum(a); return [lerp(a[0], l * tint[0], t), lerp(a[1], l * tint[1], t), lerp(a[2], l * tint[2], t)]; };

function sunDirFor(hour, out) {
  const th = ((hour - 6) / 12) * Math.PI;
  return out.set(Math.cos(th), Math.sin(th) * 0.95, Math.sin(th) * 0.31 + 0.02).normalize();
}
function updateEnvironment(dt, sim) {
  // clock: one day lasts settings.dayMinutes; deep night passes three times as quickly
  if (settings.timeFlow && started) {
    const night = ENV.hour > 19.3 || ENV.hour < 4.9;
    ENV.hour += dt * (24 / (settings.dayMinutes * 60)) * (night ? 3 : 1);
    if (ENV.hour >= 24) ENV.hour -= 24;
  }
  updateWeather(dt);
  const w = WX.cur;
  sunDirFor(ENV.hour, ENV.sunDir);
  const e = ENV.sunDir.y; ENV.elev = e;
  ENV.moonDir.set(-ENV.sunDir.x * 0.9, Math.max(-ENV.sunDir.y, -0.3) * 0.85 + 0.12, -ENV.sunDir.z - 0.25).normalize();
  const K = sampleSky(e);
  // mornings: a little cooler and pinker than evenings
  const morning = smoothstep(13, 10, ENV.hour) * smoothstep(3, 5, ENV.hour);
  if (morning > 0) {
    K.hor = lerpArr(K.hor, [K.hor[0] * 0.9, K.hor[1] * 0.97, K.hor[2] * 1.06], morning * 0.8);
    K.glow = lerpArr(K.glow, [1.0, 0.6, 0.55], morning * 0.45);
    K.zen = lerpArr(K.zen, [K.zen[0] * 0.95, K.zen[1], K.zen[2] * 1.05], morning);
  }
  const c = w.cover, d = w.dark;
  const zen = grayMix(K.zen, c * 0.72, [0.95, 1, 1.06]).map(x => x * (1 - d * 0.5));
  const hor = grayMix(K.hor, c * 0.62).map(x => x * (1 - d * 0.38));
  // natural light: the sky, the haze at the horizon and the glow round the sun come from the same
  // scattering model the sky dome uses, blended into the painted night colours after sunset
  const phys = settings.skyStyle === 'painted' ? 0 : smoothstep(-0.1, 0.05, e);
  SKY.uSkyPhys.value = phys; SKY.uSkyCover.value.set(c * 0.62, d * 0.38, 0);
  if (phys > 0) {
    const s = ENV.sunDir, az = Math.atan2(s.z, s.x);
    const zp = atmoJS(0, 1, 0, s), hp = atmoJS(Math.cos(az + Math.PI / 2), 0.04, Math.sin(az + Math.PI / 2), s), gp = atmoJS(Math.cos(az), 0.04, Math.sin(az), s);
    const cov = a => grayMix(a, c * 0.62).map(x => x * (1 - d * 0.38));
    for (let i = 0; i < 3; i++) { zen[i] = lerp(zen[i], cov(zp)[i], phys); hor[i] = lerp(hor[i], cov(hp)[i], phys); }
    K.glow = lerpArr(K.glow, gp, phys); K.ga = lerp(K.ga, 0.9, phys);
  }
  setV(U.uSkyZenith.value, zen); setV(U.uSkyHorizon.value, hor);
  setV(U.uSkyGlow.value, K.glow);
  U.uGlowAmt.value = K.ga * (1 - c * 0.7);
  U.uSunDir.value.copy(ENV.sunDir);
  // lightning flashes during storms
  ENV.lightning = Math.max(0, ENV.lightning - dt * 6);
  if (w.storm > 0.5 && started) {
    ENV.nextBolt -= dt;
    if (ENV.nextBolt <= 0) { const overhead = w.storm > 1.2; ENV.nextBolt = overhead ? rand(2.5, 9) : rand(5, 18); strike(overhead && rng() < 0.65); }
    // flickers deep inside the clouds between strikes
    if (w.storm > 1.2 && rng() < dt * 0.5) ENV.lightning = Math.max(ENV.lightning, rand(0.25, 0.6));
  }
  U.uLightning.value = ENV.lightning * (0.6 + 0.4 * Math.sin(sim * 70));
  // sky detail
  ENV.cloudOff.x += dt * 0.0016 * (0.6 + ENV.wind); ENV.cloudOff.y += dt * 0.0009 * (0.6 + ENV.wind);
  SKY.uCloudOffset.value.copy(ENV.cloudOff);
  U.uCloudCover.value = c; SKY.uCloudDark.value = d;
  setV(SKY.uSunDisk.value, K.disk, 1 - c * 0.75);
  setV(SKY.uCloudLit.value, K.cl, 1 - d * 0.45); setV(SKY.uCloudShade.value, K.cs, 1 - d * 0.5);
  SKY.uMoonDir.value.copy(ENV.moonDir);
  ENV.night = smoothstep(-0.02, -0.2, e);
  SKY.uStars.value = ENV.night * (1 - c * 0.85);
  const bowWant = (ENV.rainRecent > 0.3 && w.rain < 0.08 && e > 0.04 && e < 0.62) ? 1 : 0;
  ENV.rainbow = damp(ENV.rainbow, bowWant * (1 - c), 0.25, dt);
  SKY.uRainbow.value = ENV.rainbow;
  // lights: the sun by day, the moon by night
  const sunUp = smoothstep(-0.06, 0.03, e);
  const moonI = 0.62 * smoothstep(-0.04, -0.18, e) * smoothstep(0.0, 0.15, ENV.moonDir.y);
  const useMoon = e < -0.05;
  const L = useMoon ? ENV.moonDir : ENV.sunDir;
  U.uLightDir.value.copy(L);
  // a clear day is mostly sun with a little skylight, so shade is properly dark and blue; under cloud it evens out
  const sunI = K.sunI * sunUp * (1 - c * 0.72) * 1.12;
  _c1.setRGB(K.sun[0], K.sun[1], K.sun[2], THREE.SRGBColorSpace);
  if (useMoon) { sun.color.setRGB(0.55, 0.66, 1.0, THREE.SRGBColorSpace); sun.intensity = moonI * (1 - c * 0.7); }
  else { sun.color.copy(_c1); sun.intensity = sunI; }
  U.uSunLin.value.set(_c1.r * sunI, _c1.g * sunI, _c1.b * sunI);
  const flash = ENV.lightning;
  _c2.setRGB(K.hs[0], K.hs[1], K.hs[2], THREE.SRGBColorSpace); hemi.color.copy(_c2);
  _c2.setRGB(K.hg[0], K.hg[1], K.hg[2], THREE.SRGBColorSpace); hemi.groundColor.copy(_c2);
  hemi.intensity = K.hi * (1 + c * 0.25) * (1 - d * 0.35) * lerp(1, 0.76, sunUp * (1 - c)) + flash * 2.2;
  renderer.toneMappingExposure = K.exp * (1 + d * 0.12);
  ENV.daylight = smoothstep(-0.12, 0.25, e);
  U.uDaylight.value = ENV.daylight;
  // water appearance
  setV(WATER.uWaterLight.value, K.wl, (1 - d * 0.42) + flash * 0.6);
  setV(WATER.uFoamCol.value, K.fo, (1 - d * 0.3) + flash * 0.5);
  if (useMoon) WATER.uSpecCol.value.set(0.55, 0.62, 0.8).multiplyScalar(0.55 * smoothstep(0, 0.2, ENV.moonDir.y) * (1 - c * 0.85));
  else setV(WATER.uSpecCol.value, K.disk, (1 - c * 0.88) * sunUp);
  const ws = settings.waveSize ?? 1;
  WATER.uWhitecaps.value = smoothstep(1.2, 1.8, w.waves * Math.sqrt(ws)) * 0.9;
  waveAmp = w.waves * ws; WATER.uWaveAmp.value = waveAmp;
  U.uSurfAmp.value = (0.75 + 0.35 * w.waves) * ws;
  // atmosphere
  U.uFogDensity.value = 0.00042 * w.fog * (Q.farMul < 1 ? 1.15 : 1);
  ENV.wind = w.wind * (settings.windSpeed ?? 1); U.uWind.value = ENV.wind;
  const wa = 0.7 + 0.35 * Math.sin(sim * 0.004);
  U.uWindDir.value.set(Math.cos(wa), Math.sin(wa));
  U.uRain.value = w.rain; U.uWet.value = ENV.wet;
  ENV.uwBase = K.uw;
}
const ATMO_BR = [5.8e-6, 13.5e-6, 33.1e-6], ATMO_OZ = [0.01625, 0.047, 0.002125];
const airMassJS = y => { y = Math.max(y, 0); const deg = Math.acos(Math.min(1, y)) * 180 / Math.PI; return 1 / (y + 0.50572 * Math.pow(Math.max(96.07995 - deg, 0.01), -1.6364)); };
function atmoJS(dx, dy, dz, s) {
  const l0 = Math.hypot(dx, dy, dz); dx /= l0; dy /= l0; dz /= l0;
  const mu = dx * s.x + dy * s.y + dz * s.z, amV = airMassJS(dy), amS = airMassJS(s.y), g = 0.72;
  const pr = 0.0596831 * (1 + mu * mu), pm = 0.119366 * ((1 - g * g) * (1 + mu * mu)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const ext = ATMO_BR[c] * 8000 + 4e-6 * 1200 * 1.1, tS = Math.exp(-(ext * 0.8 + ATMO_OZ[c]) * amS);
    let L = 34 * (ATMO_BR[c] * pr + 4e-6 * pm * 0.55) / (ATMO_BR[c] + 4e-6 * 1.1) * (1 - Math.exp(-ext * amV)) * tS;
    L += ATMO_BR[c] * 9000 * clamp((s.y + 0.1) * 4, 0, 1) * 0.25 * Math.exp(-ATMO_OZ[c] * 6);
    out[c] = Math.pow(1 - Math.exp(-Math.pow(L, 1.08)), 1 / 2.2);
  }
  const l = out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15, k = 1 - smoothstep(0, 0.25, 1 - dy), tint = [lerp(1, 0.92, k), lerp(1, 0.96, k), lerp(1, 1.08, k)];
  return out.map((v, i) => (l + (v - l) * 1.3) * tint[i]);
}
function triggerLightning() {
  ENV.lightning = 1;
  const a = rand(0, TAU), dist = rand(900, 2800);
  if (FX.bolt) FX.bolt(a, dist);
  if (AUDIO.thunder) setTimeout(() => AUDIO.thunder(dist), (dist / 343) * 1000);
  const fl = document.getElementById('flash'); fl.style.transition = 'none'; fl.style.opacity = 0.18 * smoothstep(2800, 900, dist) + 0.04;
  requestAnimationFrame(() => { fl.style.transition = 'opacity .5s ease-out'; fl.style.opacity = 0; });
}
function updateShadowFrame(center) {
  const L = U.uLightDir.value;
  const ext = sun.shadow.camera.right * 2;
  const texel = ext / sun.shadow.mapSize.x;
  const cx = Math.round(center.x / texel) * texel, cz = Math.round(center.z / texel) * texel, cy = Math.round(center.y / texel) * texel;
  sun.target.position.set(cx, cy, cz);
  sun.position.set(cx + L.x * 320, cy + L.y * 320, cz + L.z * 320);
  sun.target.updateMatrixWorld();
}
