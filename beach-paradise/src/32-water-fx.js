
// ───────────────────── 8b. Water effects: refraction, ripples, foam and spray ─────────────────────
// The world is drawn first without its water; that picture is copied and the water surfaces
// then bend it (refraction) as they are drawn on top. Around the camera a small GPU wave
// simulation carries the rings and foam left by swimming, wading, the boat, splashes and rain.
const WFX = {
  refrOn: false, refrTex: null, ripOk: false, rip: null, drops: [], dropF: [], foamTex: null, acc: 0, layerT: 0,
  uniforms: {
    uRefrTex: { value: null }, uRefrOn: { value: 0 }, uScreen: { value: new THREE.Vector2(1, 1) }, uDepthTex: { value: null }, uDepthOn: { value: 0 }, uNearFar: { value: new THREE.Vector2(0.12, 14000) },
    uRipTex: { value: null }, uRipC: { value: new THREE.Vector3(0, 0, 30) }, uRipOn: { value: 0 }, uFoamTex: { value: null },
  },
};
const WFX_GLSL = /* glsl */`
uniform sampler2D uRefrTex; uniform float uRefrOn; uniform vec2 uScreen; uniform sampler2D uDepthTex; uniform float uDepthOn; uniform vec2 uNearFar;
uniform sampler2D uRipTex; uniform vec3 uRipC; uniform float uRipOn; uniform sampler2D uFoamTex;
// slope (xy) and foam (z) of the interactive ripples near the camera
vec3 ripple(vec2 p){
  if (uRipOn < 0.5) return vec3(0.0);
  vec2 ru = (p - uRipC.xy) / uRipC.z + 0.5;
  vec2 bd = min(ru, 1.0 - ru); float fade = smoothstep(0.0, 0.1, min(bd.x, bd.y));
  if (fade <= 0.0) return vec3(0.0);
  float e = 1.0 / 256.0;
  float hL = texture2D(uRipTex, ru - vec2(e, 0.0)).r, hR = texture2D(uRipTex, ru + vec2(e, 0.0)).r;
  float hD = texture2D(uRipTex, ru - vec2(0.0, e)).r, hU = texture2D(uRipTex, ru + vec2(0.0, e)).r;
  vec2 sl = vec2(hR - hL, hU - hD) * 1.1; float l = length(sl); if (l > 0.3) sl *= 0.3 / l;  // ripples are gentle slopes
  return vec3(sl, min(texture2D(uRipTex, ru).b, 1.0)) * fade;
}
// foam that breaks up into a web of lines and bubbles as it thins out
float foamMask(vec2 p, float amt, vec2 flow){
  if (amt <= 0.002) return 0.0;
  vec2 w = (texture2D(uNoiseTex, p * 0.045 + flow * 0.3).rg - 0.5) * 2.2;  // warp the cells so they never look regular
  w += (texture2D(uNoiseTex, p * 0.31 - flow * 0.7).ba - 0.5) * 0.7;       // and bend their walls locally
  float a = texture2D(uFoamTex, (p + w) * 0.17 + flow).r, b = texture2D(uFoamTex, (p - w * 0.6) * 0.52 - flow * 1.6 + 0.37).g;
  float v = a * 0.55 + b * 0.45;
  float am = clamp(amt, 0.0, 1.0);
  // soft edges: thin foam is a faint, broken veil rather than hard white cells
  float thr = 1.0 - am * 0.95, soft = 0.07 + 0.12 * (1.0 - am);
  float c = smoothstep(thr - soft, thr + soft, v);
  // dense whitewater is speckled with bubble holes and slightly see-through at its ragged edge
  float holes = texture2D(uFoamTex, (p + w * 0.3) * 1.3 - flow * 2.5).b;
  c *= mix(1.0, 0.8 + 0.2 * holes, smoothstep(0.5, 1.0, am));
  return c * (0.45 + 0.55 * smoothstep(0.0, 0.6, am));
}
uniform sampler2D uPlanarTex; uniform mat4 uPlanarMat; uniform float uPlanarOn;
// what the sea reflects at a point: the mirrored island and sky (Ultra/Max), or just the sky
vec3 planarRefl(vec3 wp, vec3 N, vec3 fallback, float dist){
  if (uPlanarOn < 0.5) return fallback;
  vec4 pc = uPlanarMat * vec4(wp.x, 0.0, wp.z, 1.0);
  vec2 uv = pc.xy / pc.w + N.xz * 0.035 / (1.0 + dist * 0.015);
  float inside = smoothstep(0.0, 0.03, uv.x) * smoothstep(1.0, 0.97, uv.x) * smoothstep(0.0, 0.03, uv.y) * smoothstep(1.0, 0.97, uv.y);
  return mix(fallback, texture2D(uPlanarTex, clamp(uv, 0.001, 0.999)).rgb, inside);
}
vec3 refrAt(vec2 off){ vec3 c = texture2D(uRefrTex, clamp((gl_FragCoord.xy + off) / uScreen, vec2(0.001), vec2(0.999))).rgb; return uHDR > 0.5 ? toDisplay(c) : c; }
float linDepth(float d){ return uNearFar.x * uNearFar.y / (uNearFar.y - d * (uNearFar.y - uNearFar.x)); }
// how far behind this pixel of water the solid world is, measured straight into the screen (metres);
// 'off' looks to one side, in pixels, as the bent view through the water does
float sceneGap(vec2 off){ return linDepth(texture2D(uDepthTex, clamp((gl_FragCoord.xy + off) / uScreen, vec2(0.001), vec2(0.999))).r) - linDepth(gl_FragCoord.z); }
`;

// ---- a tileable foam texture: Worley cell edges (the web) plus small bubbles ----
function makeFoamTexture() {
  const S = 256, data = new Uint8Array(S * S * 4), r = mulberry32(4242);
  // tileable smooth value noise, used to bend the foam cells so their walls curve and wander
  const vnoise = (n) => {
    const g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = r();
    return (fx, fy) => {
      const x = ((fx % n) + n) % n, y = ((fy % n) + n) % n, i = Math.floor(x), j = Math.floor(y), tx = x - i, ty = y - j;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), i1 = (i + 1) % n, j1 = (j + 1) % n;
      const a = g[j * n + i], b = g[j * n + i1], c = g[j1 * n + i], d = g[j1 * n + i1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const nA = vnoise(6), nB = vnoise(13), nC = vnoise(29), nD = vnoise(61);
  const fbm = (u, v) => nA(u * 6, v * 6) * 0.45 + nB(u * 13, v * 13) * 0.3 + nC(u * 29, v * 29) * 0.17 + nD(u * 61, v * 61) * 0.08;
  const worley = (cells, warp) => {
    const pts = new Float32Array(cells * cells * 2);
    for (let i = 0; i < pts.length; i++) pts[i] = 0.15 + 0.7 * r();
    const out = new Float32Array(S * S * 2);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // warp the lookup so cell walls are wavy, not straight polygon edges
      const fx = u * cells + (nB(u * 13 + 3.1, v * 13) - 0.5) * warp + (nD(u * 61, v * 61 + 7.7) - 0.5) * warp * 0.35;
      const fy = v * cells + (nB(u * 13, v * 13 + 5.3) - 0.5) * warp + (nD(u * 61 + 2.2, v * 61) - 0.5) * warp * 0.35;
      const cx = Math.floor(fx), cy = Math.floor(fy);
      let f1 = 9, f2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = cx + i, gy = cy + j, wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells;
        const px = gx + pts[(wy * cells + wx) * 2], py = gy + pts[(wy * cells + wx) * 2 + 1];
        const d = Math.hypot(px - fx, py - fy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      out[(y * S + x) * 2] = f1; out[(y * S + x) * 2 + 1] = f2;
    }
    return out;
  };
  const A = worley(7, 1.6), B = worley(17, 1.4), Cb = worley(40, 0.6);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, u = x / S, v = y / S, fb = fbm(u, v);
    // soft, rounded ridges (a gaussian across the wall rather than a sharp V)
    const eA = A[i * 2 + 1] - A[i * 2], eB = B[i * 2 + 1] - B[i * 2];
    const webA = Math.exp(-eA * eA * 9) * (0.55 + 0.45 * nC(u * 29 + 9, v * 29));   // walls thicken and thin along their length
    const webB = Math.exp(-eB * eB * 16);
    const cellFill = 1 - Math.min(1, A[i * 2] * 0.9);
    const bub = Cb[i * 2] < 0.26 + 0.08 * nD(u * 61, v * 61) ? 0 : 1;               // round bubble holes of mixed sizes
    const cloud = Math.min(1, Math.max(0, (fb - 0.3) * 1.7));
    const v1 = Math.min(1, webA * 0.5 + webB * 0.22 + cellFill * 0.18 + cloud * 0.42) * (0.78 + 0.22 * bub);
    const v2 = Math.min(1, webB * 0.55 + (1 - Math.min(1, Cb[i * 2] * 2.2)) * 0.2 + webA * 0.15 + cloud * 0.3);
    data[i * 4] = Math.round(v1 * 255); data[i * 4 + 1] = Math.round(v2 * 255); data[i * 4 + 2] = Math.round(bub * 255); data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = maxAniso; t.needsUpdate = true;
  return t;
}

// ---- refraction: a copy of the frame before the water is drawn ----
function setupRefraction() {
  WFX.refrOn = Q.refr !== false;
  WFX.uniforms.uRefrOn.value = WFX.refrOn ? 1 : 0;
  if (!WFX.refrOn) return;
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (WFX.refrTex && WFX.refrTex.image.width === s.x && WFX.refrTex.image.height === s.y) return;
  if (WFX.refrTex) WFX.refrTex.dispose();
  WFX.refrTex = new THREE.FramebufferTexture(s.x, s.y);
  WFX.refrTex.minFilter = WFX.refrTex.magFilter = THREE.LinearFilter;
  WFX.uniforms.uRefrTex.value = WFX.refrTex; WFX.uniforms.uScreen.value.copy(s);
}
// water surfaces go on layer 1; transparent things that may sit in front of water on layer 2
function assignLayers() {
  scene.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isLine) || o.userData.layerSet) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (o.userData.water) o.layers.set(1);
    else if (m && m.transparent) o.layers.set(2);
    o.userData.layerSet = true;
  });
}
// (put on its layer at once: a water surface on the solid layer, even for a moment, would be drawn without what's behind it)
const markWater = (m, refract = true) => { m.userData.water = true; m.userData.refract = refract; m.layers.set(1); m.userData.layerSet = true; return m; };
const _rws = new THREE.Vector2();
function renderWorld() {
  renderPlanar();
  if (renderWorldHDR()) return;
  // the direct path, for devices that can't draw to floating-point textures (and the Low setting)
  WFX.uniforms.uDepthOn.value = 0; if (WFX.refrTex) WFX.uniforms.uRefrTex.value = WFX.refrTex;
  const under = U.uUnderwater.value > 0.5;
  if (WFX.refrOn) { renderer.getDrawingBufferSize(_rws); if (!WFX.refrTex || WFX.refrTex.image.width !== _rws.x || WFX.refrTex.image.height !== _rws.y) setupRefraction(); }
  if (!WFX.refrOn || under) {
    camera.layers.mask = 7; WFX.uniforms.uRefrOn.value = 0;
    renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
    return;
  }
  WFX.uniforms.uRefrOn.value = 1;
  renderer.shadowMap.needsUpdate = true;
  camera.layers.mask = 1; renderer.render(scene, camera);
  renderer.copyFramebufferToTexture(WFX.refrTex);
  const ac = renderer.autoClear; renderer.autoClear = false;
  camera.layers.mask = 2; renderer.render(scene, camera);
  camera.layers.mask = 4; renderer.render(scene, camera);
  renderer.autoClear = ac; camera.layers.mask = 7;
}

// ---- interactive ripples: a 256 x 256 height field covering 30 m around the camera ----
const RIP_N = 256, RIP_L = 30;
function buildRipples() {
  const gl2 = renderer.capabilities.isWebGL2;
  const ext = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  if (!gl2 || !ext || Q.particles < 0.5) { WFX.uniforms.uRipOn.value = 0; return; }
  const mk = () => new THREE.WebGLRenderTarget(RIP_N, RIP_N, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const rtA = mk(), rtB = mk();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPrev: { value: null }, uShift: { value: new THREE.Vector2() }, uDrops: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uDropF: { value: new Float32Array(16) }, uN: { value: 0 }, uC: { value: new THREE.Vector3() }, uDamp: { value: 0.985 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D uPrev; uniform vec2 uShift; uniform vec4 uDrops[16]; uniform float uDropF[16]; uniform int uN; uniform vec3 uC; uniform float uDamp;
      varying vec2 vUv;
      void main(){
        vec2 e = vec2(1.0 / ${RIP_N}.0);
        vec2 uv = vUv + uShift;
        if (uv.x < e.x || uv.y < e.y || uv.x > 1.0 - e.x || uv.y > 1.0 - e.y) { gl_FragColor = vec4(0.0); return; }
        vec4 c = texture2D(uPrev, uv);
        vec4 l = texture2D(uPrev, uv - vec2(e.x, 0.0)), r = texture2D(uPrev, uv + vec2(e.x, 0.0)), d = texture2D(uPrev, uv - vec2(0.0, e.y)), u = texture2D(uPrev, uv + vec2(0.0, e.y));
        float h = ((l.r + r.r + d.r + u.r) * 0.5 - c.g) * uDamp;
        float foam = mix(c.b, (l.b + r.b + d.b + u.b) * 0.25, 0.1) * 0.986;
        vec2 wp = uC.xy + (vUv - 0.5) * uC.z;
        for (int i = 0; i < 16; i++) {
          if (i >= uN) break;
          vec4 dr = uDrops[i]; float q = length(wp - dr.xy) / dr.z;
          if (q < 1.0) { float k = 1.0 - q * q; h -= dr.w * k * k; foam = max(foam, uDropF[i] * k); }
        }
        gl_FragColor = vec4(clamp(h, -1.5, 1.5), c.r, min(foam, 1.0), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const sc = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; sc.add(quad);
  WFX.rip = { rtA, rtB, sc, cam: new THREE.Camera(), mat, cx: 0, cz: 0, init: false };
  WFX.uniforms.uRipOn.value = 1;
}
// disturb the water at (x, z): r is the radius in metres, s how hard, foam how much foam it leaves
function rippleDrop(x, z, r, s, foam = 0) {
  if (!WFX.rip) return;
  const R = WFX.rip;
  if (Math.abs(x - R.cx) > RIP_L / 2 || Math.abs(z - R.cz) > RIP_L / 2) return;
  if (WFX.drops.length >= 16) { // merge into the weakest one
    let wi = 0; for (let i = 1; i < 16; i++) if (WFX.drops[i].w < WFX.drops[wi].w) wi = i;
    if (WFX.drops[wi].w > s) return;
    WFX.drops[wi].set(x, z, Math.max(r, 0.12), s); WFX.dropF[wi] = foam; return;
  }
  WFX.drops.push(new THREE.Vector4(x, z, Math.max(r, 0.12), s)); WFX.dropF.push(foam);
}
function updateRipples(dt) {
  const R = WFX.rip; if (!R || !WFX.uniforms.uRipOn.value) return;
  WFX.acc += dt;
  const STEP = 1 / 30;
  if (WFX.acc < STEP) return;
  WFX.acc = Math.min(WFX.acc - STEP, STEP);
  // rain makes rings around you
  if (U.uRain.value > 0.05 && !P.eyeUnder) {
    const n = Math.round(U.uRain.value * 5 * Q.particles);
    for (let i = 0; i < n && WFX.drops.length < 16; i++) rippleDrop(R.cx + rand(-12, 12), R.cz + rand(-12, 12), rand(0.12, 0.2), rand(0.05, 0.12), 0);
  }
  // follow the camera in whole texels so nothing smears
  const tex = RIP_L / RIP_N;
  const nx = Math.round(camera.position.x / tex) * tex, nz = Math.round(camera.position.z / tex) * tex;
  const m = R.mat.uniforms;
  m.uShift.value.set(R.init ? (nx - R.cx) / RIP_L : 0, R.init ? (nz - R.cz) / RIP_L : 0);
  R.cx = nx; R.cz = nz; R.init = true;
  m.uC.value.set(nx, nz, RIP_L);
  m.uN.value = WFX.drops.length;
  for (let i = 0; i < 16; i++) { if (i < WFX.drops.length) { m.uDrops.value[i].copy(WFX.drops[i]); m.uDropF.value[i] = WFX.dropF[i]; } }
  WFX.drops.length = 0; WFX.dropF.length = 0;
  m.uPrev.value = R.rtA.texture;
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(R.rtB); renderer.render(R.sc, R.cam); renderer.setRenderTarget(prev);
  const t = R.rtA; R.rtA = R.rtB; R.rtB = t;
  WFX.uniforms.uRipTex.value = R.rtA.texture;
  WFX.uniforms.uRipC.value.set(nx, nz, RIP_L);
}

// ---- spray: droplets drawn as little streaks stretched along their motion ----
const SPRAY = { n: 1700, parts: [], free: [], mesh: null };
function buildSpray() {
  const n = SPRAY.n;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), lif = new Float32Array(n * 2);
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aVel', new THREE.InstancedBufferAttribute(vel, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aLife', new THREE.InstancedBufferAttribute(lif, 2).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER },
    vertexShader: /* glsl */`${COMMON}
      attribute vec3 aPos; attribute vec3 aVel; attribute vec2 aLife; varying vec2 vQ; varying float vA; varying vec3 vW;
      void main(){
        vec4 c0 = viewMatrix * vec4(aPos, 1.0), c1 = viewMatrix * vec4(aPos - aVel * 0.045, 1.0);
        vec2 d = c1.xy - c0.xy; float len = length(d); vec2 dir = len > 1e-5 ? d / len : vec2(0.0, 1.0), side = vec2(-dir.y, dir.x);
        float sz = aLife.y;
        vec4 mv = mix(c0, c1, 0.5 + position.y * 0.5);
        mv.xy += side * position.x * sz + dir * position.y * sz;
        vQ = position.xy; vA = aLife.x; vW = aPos;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`${COMMON}
      uniform vec3 uFoamCol; uniform vec3 uWaterLight; uniform vec3 uSpecCol;
      varying vec2 vQ; varying float vA; varying vec3 vW;
      void main(){
        float d = length(vQ); if (d > 1.0 || vA <= 0.0) discard;
        float a = smoothstep(1.0, 0.5, d) * vA;
        // each drop is a little lens: a darker rim, a bright body, and on some of them a hard glint of the sun
        float h = fract(sin(dot(floor(vW.xz * 53.0) + floor(vW.y * 31.0), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 c = mix(uWaterLight * vec3(0.42, 0.66, 0.72), uFoamCol, 0.45 + 0.4 * (1.0 - d));
        float glint = smoothstep(0.5, 0.0, length(vQ - vec2(-0.25, 0.3)));
        c += uSpecCol * glint * (0.35 + step(0.62, h) * 4.5) * smoothstep(0.0, 0.15, uLightDir.y);
        c = applyFog(c, vW, 1.0);
        gl_FragColor = vec4(outCol(c) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 9; scene.add(mesh);
  SPRAY.mesh = mesh; SPRAY.pos = pos; SPRAY.vel = vel; SPRAY.lif = lif;
  for (let i = 0; i < n; i++) SPRAY.parts.push({ on: false });
  SPRAY.free = SPRAY.parts.slice();
}
function sprayDrop(x, y, z, vx, vy, vz, life, size) {
  const p = SPRAY.free.pop(); if (!p) return;
  Object.assign(p, { on: true, x, y, z, vx, vy, vz, life, age: 0, size });
}
// a splash: droplets thrown up and out, mist, a ring on the water and foam
function splashAt(x, y, z, k = 1, opts = {}) {
  const n = Math.round((10 + k * 28) * Q.particles);
  const up = opts.up ?? 1, spread = opts.spread ?? 1;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.4, 2.2) * spread * Math.sqrt(k);
    sprayDrop(x + Math.cos(a) * rand(0, 0.25) * k, y + 0.02, z + Math.sin(a) * rand(0, 0.25) * k, Math.cos(a) * s + (opts.vx || 0), rand(1.5, 4.2) * Math.sqrt(k) * up, Math.sin(a) * s + (opts.vz || 0), rand(0.5, 1.2), rand(0.018, 0.045) * (0.8 + k * 0.3));
  }
  if (k > 0.55) {
    // the crown: a ring of drops thrown up and outwards together, then a jet straight up from the middle
    const m = Math.round(Math.min(40, 16 + k * 14) * Q.particles), r0 = 0.12 + 0.1 * k, a0 = rand(0, TAU), vu = rand(2.8, 3.6) * Math.sqrt(k) * up, vo = rand(1.1, 1.6) * spread * Math.sqrt(k);
    for (let i = 0; i < m; i++) {
      const a = a0 + (i / m) * TAU + rand(-0.06, 0.06), j = rand(0.85, 1.15);
      sprayDrop(x + Math.cos(a) * r0, y + 0.03, z + Math.sin(a) * r0, Math.cos(a) * vo * j + (opts.vx || 0), vu * j, Math.sin(a) * vo * j + (opts.vz || 0), rand(0.7, 1.1), rand(0.022, 0.04) * (0.8 + k * 0.3));
    }
    for (let i = 0; i < Math.round(5 * Q.particles * Math.min(k, 2)); i++) sprayDrop(x + rand(-0.04, 0.04), y + 0.05, z + rand(-0.04, 0.04), rand(-0.2, 0.2) + (opts.vx || 0), rand(3.6, 5.6) * Math.sqrt(k) * up, rand(-0.2, 0.2) + (opts.vz || 0), rand(0.9, 1.3), rand(0.03, 0.055));
  }
  // fine mist hanging over it
  if (k > 0.4 && FX.spawn) for (let i = 0; i < Math.round((2 + k * 4) * Q.particles); i++) FX.spawn(x + rand(-0.35, 0.35) * k, y + rand(0.1, 0.6) * Math.sqrt(k), z + rand(-0.35, 0.35) * k, rand(-0.5, 0.5) + (opts.vx || 0) * 0.3, rand(0.4, 1.3), rand(-0.5, 0.5) + (opts.vz || 0) * 0.3, rand(1.2, 2.4), rand(0.6, 1.5) * Math.sqrt(k), 2, -0.05);
  rippleDrop(x, z, 0.3 + k * 0.35, 0.08 + k * 0.22, Math.min(0.85, (opts.foam ?? 1) * (0.12 + k * 0.45)));
}
function updateSpray(dt) {
  if (!SPRAY.mesh) return;
  const pos = SPRAY.pos, vel = SPRAY.vel, lif = SPRAY.lif;
  let k = 0;
  for (let i = 0; i < SPRAY.n; i++) {
    const p = SPRAY.parts[i]; if (!p.on) continue;
    p.age += dt;
    p.vy -= 9.8 * dt; const drag = Math.exp(-0.6 * dt); p.vx *= drag; p.vz *= drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.age > p.life) { p.on = false; SPRAY.free.push(p); continue; }
    if (p.vy < 0 && (k & 3) === 0) {
      const lv = waterAt(p.x, p.z).level, g = groundHeight(p.x, p.z);
      if (p.y < Math.max(lv, g)) { if (lv > g && rng() < 0.08) rippleDrop(p.x, p.z, 0.15, 0.06, 0.15); p.on = false; SPRAY.free.push(p); continue; }
    }
    const f = 1 - Math.pow(p.age / p.life, 3);
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    vel[k * 3] = p.vx; vel[k * 3 + 1] = p.vy; vel[k * 3 + 2] = p.vz;
    lif[k * 2] = f * 0.85; lif[k * 2 + 1] = p.size;
    k++;
  }
  const g = SPRAY.mesh.geometry;
  g.instanceCount = k;
  g.attributes.aPos.needsUpdate = g.attributes.aVel.needsUpdate = g.attributes.aLife.needsUpdate = true;
  g.attributes.aPos.addUpdateRange(0, k * 3); g.attributes.aVel.addUpdateRange(0, k * 3); g.attributes.aLife.addUpdateRange(0, k * 2);
}
// how the player stirs the water every frame: a wake while swimming, rings round your legs when wading
function playerWaterFX(dt) {
  if (!WFX.rip && !SPRAY.mesh) return;
  const w = P.water || {}, sp = Math.hypot(P.vel.x - (w.fx || 0) * 0.92, P.vel.z - (w.fz || 0) * 0.92); // your own speed, not the current's
  if (P.mode === 'swim' && P.pos.y > P.water.level - 0.6) {
    WFX.swimT = (WFX.swimT || 0) + dt * (0.6 + sp * 0.6);
    if (WFX.swimT > 0.12) { WFX.swimT = 0; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); rippleDrop(P.pos.x + fx * 0.5, P.pos.z + fz * 0.5, 0.4, 0.03 + sp * 0.03, Math.min(0.22, sp * 0.06)); }
  } else if (P.mode === 'walk' && P.depth > 0.05 && P.depth < 1.4) {
    WFX.wadeT = (WFX.wadeT || 0) + dt * (0.5 + sp);
    if (WFX.wadeT > 0.16) {
      WFX.wadeT = 0;
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      rippleDrop(P.pos.x + fx * 0.25, P.pos.z + fz * 0.25, 0.3, 0.03 + sp * 0.03, Math.min(0.3, sp * 0.07));
      if (sp > 2.5 && P.depth < 0.8) for (let i = 0; i < 3 * Q.particles; i++) sprayDrop(P.pos.x + fx * 0.4 + rand(-0.2, 0.2), P.water.level + 0.02, P.pos.z + fz * 0.4 + rand(-0.2, 0.2), P.vel.x * 0.6 + rand(-0.6, 0.6), rand(0.8, 2.0), P.vel.z * 0.6 + rand(-0.6, 0.6), 0.5, rand(0.01, 0.02));
    }
  }
}
function updateWaterFX(dt) {
  WFX.layerT -= dt;
  if (WFX.layerT <= 0) { WFX.layerT = 0.5; assignLayers(); }
  if (started) playerWaterFX(dt);
  updateRipples(dt);
  if (started) { surfSpray(dt); cascadeMist(dt); }
  updateSpray(dt);
}
// breaking waves near you throw spray off their lips and leave a drifting mist behind the roller
const _ss = {};
function surfSpray(dt) {
  if (!SPRAY.free || Q.particles < 0.5 || P.eyeUnder) return;
  const cx = camera.position.x, cz = camera.position.z, t = U.uTime.value;
  const tries = Math.round(70 * Q.particles);
  for (let i = 0; i < tries; i++) {
    const a = rng() * TAU, r = 4 + Math.sqrt(rng()) * 70, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const g0 = groundHeight(x, z); if (g0 > 0.2 || g0 < -14) continue;
    const e = surfState(x, z, -g0, t, _ss);
    if (_ss.a < 0.3) continue;
    const lip = _ss.plunge * smoothstep(0.955, 0.99, _ss.g) * (1 - smoothstep(0.995, 1, _ss.g));
    const roll = _ss.brk * (1 - smoothstep(0.0, 0.06, _ss.g));
    const k = Math.max(lip, roll * 0.35);
    if (k < 0.05 || rng() > k * dt * 40) continue;
    const sd = seaDir(x, z), y = e + 0.05, s = Math.min(1.6, _ss.a);
    // thrown forward and up off the crest, then blown back as a fine mist
    for (let j = 0; j < 5; j++) sprayDrop(x + rand(-0.6, 0.6), y + rand(0, 0.3), z + rand(-0.6, 0.6), -sd.x * rand(1.5, 4) * s + rand(-0.6, 0.6), rand(1.2, 3.5) * s, -sd.z * rand(1.5, 4) * s + rand(-0.6, 0.6), rand(0.5, 1.1), rand(0.04, 0.09) * (0.7 + s * 0.4));
    if (FX.spawn && rng() < 0.75 * k) FX.spawn(x, y + 0.3 * s, z, -sd.x * 0.8 + (U.uWindDir.value.x * ENV.wind * 0.3), rand(0.3, 0.9), -sd.z * 0.8 + (U.uWindDir.value.y * ENV.wind * 0.3), rand(1.4, 2.8), rand(0.9, 2.2) * s, 2, -0.05);
  }
}
// ---- a stream of poured water: a ribbon along the falling arc that thins, twists and breaks into drops ----
const POUR = { mesh: null, N: 24, on: 0 };
function buildPourStream() {
  const N = POUR.N, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const uv = new Float32Array((N + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= N; i++) { uv.set([0, i / N, 1, i / N], i * 4); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, ...WATER, ...WFX.uniforms, uOn: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${COMMON} ${WATER_FRAG_COMMON} ${WFX_GLSL} uniform float uOn; varying vec2 vUv;
      void main(){
        float x = vUv.x * 2.0 - 1.0, t = vUv.y;
        float n = texture2D(uNoiseTex, vec2(vUv.x * 0.6, t * 3.0 - uTime * 4.0)).r;
        float body = 1.0 - smoothstep(0.55 - t * 0.2, 1.0 - t * 0.25, abs(x));
        float breakup = smoothstep(0.45, 0.75, t) * smoothstep(0.35, 0.65, n);
        float a = body * (1.0 - breakup) * uOn * (1.0 - smoothstep(0.92, 1.0, t));
        if (a < 0.02) discard;
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vec3(x * 0.8, 0.0, sqrt(max(1.0 - x * x, 0.0))) + vec3(0.0, n - 0.5, 0.0) * 0.3);
        float F = 0.06 + 0.94 * pow(1.0 - abs(x), 5.0) * 0.0 + abs(x) * 0.5;
        vec3 refl = skyRefl(normalize(reflect(-V, N) + vec3(0.0, 0.3, 0.0)));
        float glint = pow(max(dot(reflect(-V, N), uLightDir), 0.0), 60.0) * 1.5;
        vec3 col = refl * F + uSpecCol * glint + uWaterLight * vec3(0.5, 0.65, 0.65) * 0.25;
        float alpha = clamp(0.25 + F * 0.6 + glint * 0.3, 0.0, 0.85) * a;
        if (uRefrOn > 0.5) { vec3 bg = refrAt(vec2(x * 6.0, 0.0)); col = mix(bg * 0.95, col, 0.55); alpha = a * 0.92; }
        gl_FragColor = vec4(outCol(col) * alpha, alpha); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 9; scene.add(mesh);
  POUR.mesh = mesh;
}
// lip: where it leaves the bucket; v0: launch velocity; amount 0..1
const _pd = new THREE.Vector3(), _ps = new THREE.Vector3();
function updatePourStream(lip, v0, amount) {
  const M = POUR.mesh; if (!M) return;
  POUR.on = damp(POUR.on, amount > 0 ? 1 : 0, 10, 1 / 60);
  M.visible = POUR.on > 0.02 && amount >= 0;
  if (!M.visible || !lip) { if (amount <= 0) M.visible = POUR.on > 0.02 && POUR.lastLip; if (!POUR.lastLip) return; lip = POUR.lastLip; v0 = POUR.lastV; }
  POUR.lastLip = lip.clone ? lip.clone() : lip; POUR.lastV = v0;
  const pos = M.geometry.attributes.position.array, N = POUR.N;
  const g = groundHeight(lip.x, lip.z);
  // time until it lands
  const a = -4.9, b = v0.y, c = lip.y - Math.max(g, waterAt(lip.x, lip.z).level);
  const tl = Math.max(0.05, (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a));
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * tl;
    const px = lip.x + v0.x * t, py = lip.y + v0.y * t - 4.9 * t * t, pz = lip.z + v0.z * t;
    _pd.set(v0.x, v0.y - 9.8 * t, v0.z).normalize();
    _ps.set(camera.position.x - px, camera.position.y - py, camera.position.z - pz).cross(_pd).normalize();
    const w = (0.045 - 0.025 * (i / N)) * Math.min(1, POUR.on * 1.4);
    pos.set([px - _ps.x * w, py - _ps.y * w, pz - _ps.z * w, px + _ps.x * w, py + _ps.y * w, pz + _ps.z * w], i * 6);
  }
  M.geometry.attributes.position.needsUpdate = true;
  M.material.uniforms.uOn.value = POUR.on;
}
// ---- planar reflections (Ultra and Max): the island, palms and boats mirrored in the sea ----
// The mirrored view is drawn first, at half size, straight to the screen (so it gets exactly the same
// colour handling as the real view), copied into a texture, and then the real frame is drawn over it.
const PLANAR = { tex: null, cam: new THREE.PerspectiveCamera(), mat: new THREE.Matrix4(), plane: new THREE.Plane(), clip: new THREE.Vector4(), q: new THREE.Vector4(), size: new THREE.Vector2() };
WFX.uniforms.uPlanarTex = { value: null }; WFX.uniforms.uPlanarMat = { value: PLANAR.mat }; WFX.uniforms.uPlanarOn = { value: 0 };
const _pv1 = new THREE.Vector3(), _pv2 = new THREE.Vector3(), _pcss = new THREE.Vector2();
function renderPlanar() {
  const on = !!Q.planar && U.uUnderwater.value < 0.5 && camera.position.y > 0.3 && camera.position.y < 900;
  WFX.uniforms.uPlanarOn.value = on ? 1 : 0;
  if (!on) return;
  const db = renderer.getDrawingBufferSize(_rws), w = Math.max(2, Math.floor(db.x / 2)), h = Math.max(2, Math.floor(db.y / 2));
  if (!PLANAR.tex || PLANAR.size.x !== w || PLANAR.size.y !== h) {
    if (PLANAR.tex) PLANAR.tex.dispose();
    PLANAR.tex = new THREE.FramebufferTexture(w, h); PLANAR.tex.minFilter = PLANAR.tex.magFilter = THREE.LinearFilter;
    PLANAR.size.set(w, h); WFX.uniforms.uPlanarTex.value = PLANAR.tex;
  }
  // the mirror camera: the real one reflected in the sea surface (y = 0)
  const C = PLANAR.cam;
  camera.updateMatrixWorld();
  C.position.copy(camera.position); C.position.y = -camera.position.y;
  _pv1.set(0, 0, -1).applyQuaternion(camera.quaternion); _pv1.y = -_pv1.y;
  _pv2.set(0, 1, 0).applyQuaternion(camera.quaternion); _pv2.y = -_pv2.y;
  C.up.copy(_pv2); C.lookAt(_pv1.add(C.position));
  C.fov = camera.fov; C.aspect = camera.aspect; C.near = camera.near; C.far = camera.far;
  C.updateProjectionMatrix(); C.updateMatrixWorld();
  PLANAR.mat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(C.projectionMatrix).multiply(C.matrixWorldInverse);
  // an oblique near plane at the water line, so nothing under the sea shows in the reflection
  PLANAR.plane.setFromNormalAndCoplanarPoint(_pv1.set(0, 1, 0), _pv2.set(0, -0.15, 0)).applyMatrix4(C.matrixWorldInverse);
  const cp = PLANAR.clip.set(PLANAR.plane.normal.x, PLANAR.plane.normal.y, PLANAR.plane.normal.z, PLANAR.plane.constant), pm = C.projectionMatrix.elements, q = PLANAR.q;
  q.x = (Math.sign(cp.x) + pm[8]) / pm[0]; q.y = (Math.sign(cp.y) + pm[9]) / pm[5]; q.z = -1; q.w = (1 + pm[10]) / pm[14];
  cp.multiplyScalar(2 / cp.dot(q));
  pm[2] = cp.x; pm[6] = cp.y; pm[10] = cp.z + 1 - 0.003; pm[14] = cp.w;
  C.layers.set(0);
  renderer.getSize(_pcss);
  renderer.setViewport(0, 0, _pcss.x / 2, _pcss.y / 2);
  renderer.render(scene, C);
  renderer.copyFramebufferToTexture(PLANAR.tex);
  renderer.setViewport(0, 0, _pcss.x, _pcss.y);
}

// the river's cascades: spray thrown up where each chute hits the pool below, and a drifting mist,
// so you can see the water tumbling over even from upstream
function cascadeMist(dt) {
  if (!STREAM.lower || !FX.spawn || Q.particles < 0.3) return;
  if (!STREAM.drops) {
    STREAM.drops = [];
    const L = STREAM.lower;
    for (let i = 1; i < L.length - 1; i++) if (L[i - 1].S - L[i + 1].S > 1.2 && !STREAM.drops.some(d => Math.hypot(d.x - L[i + 1].x, d.z - L[i + 1].z) < 8)) STREAM.drops.push({ x: L[i + 1].x, z: L[i + 1].z, y: L[i + 1].S, tx: L[i].tx || 0, tz: L[i].tz || 0, W: L[i].W, drop: L[i - 1].S - L[i + 1].S });
  }
  const cx = camera.position.x, cz = camera.position.z;
  for (const d of STREAM.drops) {
    const dist = Math.hypot(d.x - cx, d.z - cz); if (dist > 160) continue;
    const k = Math.min(1, d.drop / 2.2);
    if (rng() < dt * 9 * k) { const a = rand(-0.8, 0.8) * d.W; FX.spawn(d.x - d.tz * a, d.y + 0.2, d.z + d.tx * a, d.tx * rand(0.3, 1) + rand(-0.3, 0.3), rand(0.5, 1.4), d.tz * rand(0.3, 1) + rand(-0.3, 0.3), rand(1.5, 3), rand(0.8, 1.8), 2, -0.06); }
    if (dist < 70) for (let i = 0; i < Math.round(dt * 50 * k * Q.particles); i++) { const a = rand(-0.9, 0.9) * d.W; sprayDrop(d.x - d.tz * a, d.y + 0.05, d.z + d.tx * a, d.tx * rand(0.5, 2) + rand(-0.8, 0.8), rand(0.8, 2.4), d.tz * rand(0.5, 2) + rand(-0.8, 0.8), rand(0.4, 0.8), rand(0.03, 0.06)); }
  }
}
