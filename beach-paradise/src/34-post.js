
// ───────────────────── 8d. The final image ─────────────────────
// The world is not drawn straight to the screen. It goes into floating-point (HDR) pictures first:
//   1. everything solid, together with its depth
//   2. soft shading in creases and where things meet, worked out from that depth
//   3. water and see-through things on top; water reads the solid picture and its depth, so it knows
//      how much water you are looking through at every pixel
//   4. shafts of sunlight, and a glow round anything truly bright
//   5. one last pass to the screen: anti-aliasing, a touch of sharpening, the filmic tone curve,
//      a light colour grade and a vignette
// If the device can't draw to floating-point textures the old direct path is used instead.
const POST = {
  on: false, size: new THREE.Vector2(), opaque: null, scene: null, ao: [], down: [], up: [], rays: null,
  quad: null, sc: null, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), M: null, msaa: 0,
  sun: new THREE.Vector3(), fwd: new THREE.Vector3(), sd: new THREE.Vector3(), uwTint: new THREE.Vector3(0.45, 0.95, 1.0), toolsDone: false,
};
const POST_TONE = /* glsl */`
  vec3 pFit(vec3 v){ return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
  // 'e' is already multiplied by the exposure
  vec3 pDisplay(vec3 e){
    const mat3 AI = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 AO = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    vec3 c = clamp(AO * pFit(AI * (e / 0.6)), 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(0.416667)) - 0.055, step(vec3(0.0031308), c));
  }
  float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;
function postSupported() {
  return renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
}
function postShader(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag, depthTest: false, depthWrite: false, ...extra });
}
function buildPostMaterials() {
  const M = POST.M = {};
  const exp = U.uExposure;
  // ambient occlusion: how much of the sky each point can't see because something is close by
  const aoFrag = n => /* glsl */`
    #define AO_N ${n}
    uniform sampler2D uDepth; uniform vec2 uTan; uniform vec2 uNF; uniform vec2 uRes; uniform float uRadius; uniform float uStr; varying vec2 vUv;
    ${POST_TONE}
    float lin(float d){ return uNF.x * uNF.y / (uNF.y - d * (uNF.y - uNF.x)); }
    vec3 vp(vec2 uv){ float z = lin(texture2D(uDepth, uv).r); return vec3((uv * 2.0 - 1.0) * uTan * z, -z); }
    void main(){
      float d0 = texture2D(uDepth, vUv).r;
      if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = vp(vUv); float z = -P.z;
      float fade = 1.0 - smoothstep(70.0, 160.0, z);
      if (fade <= 0.0) { gl_FragColor = vec4(1.0); return; }
      vec2 px = 1.0 / uRes;
      // the surface's direction from the depths beside it, taking the smoother side at an edge
      vec3 Pr = vp(vUv + vec2(px.x, 0.0)), Pl = vp(vUv - vec2(px.x, 0.0)), Pu = vp(vUv + vec2(0.0, px.y)), Pd = vp(vUv - vec2(0.0, px.y));
      vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
      vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
      vec3 N = normalize(cross(dx, dy));
      float rad = uRadius * (0.6 + 0.4 * smoothstep(2.0, 30.0, z) * 2.0);     // a wider reach further off, so distant trees still sit on the ground
      float rScr = min(rad / (z * uTan.y) * 0.5, 0.1);
      float a0 = ign(gl_FragCoord.xy) * 6.2832, occ = 0.0;
      for (int i = 0; i < AO_N; i++) {
        float fi = (float(i) + 0.5) / float(AO_N), r = sqrt(fi) * rScr, a = a0 + float(i) * 2.39996;
        vec2 o = vec2(cos(a), sin(a)) * r; o.x *= uRes.y / uRes.x;
        vec3 v = vp(vUv + o) - P;
        float d2 = dot(v, v), vn = dot(v, N);
        occ += max(vn - 0.012 * z - 0.01, 0.0) / (d2 + 0.006) * max(1.0 - d2 / (rad * rad), 0.0);
      }
      float ao = clamp(1.0 - occ * rad * (2.0 * uStr / float(AO_N)), 0.0, 1.0);
      gl_FragColor = vec4(vec3(mix(1.0, ao, fade)), 1.0);
    }`;
  const aoU = () => ({ uDepth: { value: null }, uTan: { value: new THREE.Vector2() }, uNF: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() }, uRadius: { value: 0.55 }, uStr: { value: 1.0 } });
  M.ao8 = postShader(aoFrag(8), aoU()); M.ao14 = postShader(aoFrag(14), aoU());
  // smooth it without bleeding across edges (neighbours at a very different depth don't count)
  M.aoBlur = postShader(/* glsl */`
    uniform sampler2D uAO; uniform sampler2D uDepth; uniform vec2 uNF; uniform vec2 uPx; varying vec2 vUv;
    float lin(float d){ return uNF.x * uNF.y / (uNF.y - d * (uNF.y - uNF.x)); }
    void main(){
      float z0 = lin(texture2D(uDepth, vUv).r), sum = 0.0, wsum = 0.0;
      for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
        vec2 uv = vUv + (vec2(float(i), float(j)) - 1.5) * uPx;
        float z = lin(texture2D(uDepth, uv).r), w = 1.0 / (1.0 + abs(z - z0) / (0.02 * z0 + 0.02) * 2.0);
        sum += texture2D(uAO, uv).r * w; wsum += w;
      }
      gl_FragColor = vec4(vec3(sum / wsum), 1.0);
    }`, { uAO: { value: null }, uDepth: { value: null }, uNF: { value: new THREE.Vector2() }, uPx: { value: new THREE.Vector2() } });
  // the solid picture and its depth go into the second target, shaded by the occlusion
  M.copy = postShader(/* glsl */`
    uniform sampler2D uColor; uniform sampler2D uDepth; uniform sampler2D uAO; uniform float uAOK; uniform float uExposure; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(uColor, vUv).rgb;
      if (uAOK > 0.0) {
        float ao = texture2D(uAO, vUv).r;
        // sunlit surfaces are shaded less: occlusion is about the light from the sky, not the sun
        float l = max(c.r, max(c.g, c.b)) * uExposure;
        ao = mix(ao, 1.0, smoothstep(0.5, 2.2, l) * 0.55);
        c *= mix(1.0, ao, uAOK) * mix(vec3(1.0), vec3(0.94, 0.97, 1.04), (1.0 - ao) * uAOK);
      }
      gl_FragColor = vec4(c, 1.0); gl_FragDepth = texture2D(uDepth, vUv).r;
    }`, { uColor: { value: null }, uDepth: { value: null }, uAO: { value: null }, uAOK: { value: 0 }, uExposure: exp }, { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth });
  // shafts of sunlight: the bright sky round the sun, smeared outwards from where the sun is on screen
  M.rays = postShader(/* glsl */`
    uniform sampler2D uScene; uniform sampler2D uDepth; uniform vec2 uSun; uniform float uExposure; uniform float uAspect; uniform vec2 uThr; varying vec2 vUv;
    ${POST_TONE}
    void main(){
      const int N = 22;
      vec2 d = uSun - vUv; float len = length(d * vec2(uAspect, 1.0));
      vec2 stp = d * (min(1.0, 0.9 / max(len, 1e-3)) * 0.95 / float(N));
      vec2 p = vUv + stp * ign(gl_FragCoord.xy);
      float acc = 0.0, w = 1.0, ws = 0.0;
      for (int i = 0; i < N; i++) {
        vec2 q = clamp(p, vec2(0.002), vec2(0.998));
        if (texture2D(uDepth, q).r >= 0.99999) { vec3 c = max(texture2D(uScene, q).rgb, 0.0) * uExposure; float l = max(c.r, max(c.g, c.b)); acc += w * smoothstep(uThr.x, uThr.y, l); }
        ws += w; w *= 0.965; p += stp;
      }
      float near = 1.0 - smoothstep(0.25, 1.15, len);
      gl_FragColor = vec4(vec3(acc / ws * (0.35 + 0.65 * near)), 1.0);
    }`, { uScene: { value: null }, uDepth: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uExposure: exp, uAspect: { value: 1 }, uThr: { value: new THREE.Vector2(1.3, 5.5) } });
  // glow: keep only what is brighter than white paper in the sun, at a quarter of the size
  M.bright = postShader(/* glsl */`
    uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uExposure; uniform float uThr; varying vec2 vUv;
    vec3 pick(vec2 uv){ vec3 c = max(texture2D(uSrc, uv).rgb, 0.0) * uExposure; float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uThr, uThr * 3.2, l); return c / (1.0 + l * 0.06); }
    void main(){
      vec3 c = pick(vUv + uTexel * vec2(-1.0, -1.0)) + pick(vUv + uTexel * vec2(1.0, -1.0)) + pick(vUv + uTexel * vec2(-1.0, 1.0)) + pick(vUv + uTexel * vec2(1.0, 1.0));
      gl_FragColor = vec4(c * 0.25, 1.0); }`, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uExposure: exp, uThr: { value: 1.6 } });
  M.down = postShader(/* glsl */`
    uniform sampler2D uSrc; uniform vec2 uH; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(uSrc, vUv).rgb * 4.0 + texture2D(uSrc, vUv + vec2(-uH.x, -uH.y)).rgb + texture2D(uSrc, vUv + vec2(uH.x, -uH.y)).rgb + texture2D(uSrc, vUv + vec2(-uH.x, uH.y)).rgb + texture2D(uSrc, vUv + uH).rgb;
      gl_FragColor = vec4(c / 8.0, 1.0); }`, { uSrc: { value: null }, uH: { value: new THREE.Vector2() } });
  M.upMix = postShader(/* glsl */`
    uniform sampler2D uSrc; uniform sampler2D uAdd; uniform vec2 uH; uniform float uSpread; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(uSrc, vUv + vec2(-2.0 * uH.x, 0.0)).rgb + texture2D(uSrc, vUv + vec2(2.0 * uH.x, 0.0)).rgb + texture2D(uSrc, vUv + vec2(0.0, 2.0 * uH.y)).rgb + texture2D(uSrc, vUv + vec2(0.0, -2.0 * uH.y)).rgb
        + 2.0 * (texture2D(uSrc, vUv + vec2(-uH.x, uH.y)).rgb + texture2D(uSrc, vUv + uH).rgb + texture2D(uSrc, vUv + vec2(-uH.x, -uH.y)).rgb + texture2D(uSrc, vUv + vec2(uH.x, -uH.y)).rgb);
      gl_FragColor = vec4(c / 12.0 * uSpread + texture2D(uAdd, vUv).rgb, 1.0); }`, { uSrc: { value: null }, uAdd: { value: null }, uH: { value: new THREE.Vector2() }, uSpread: { value: 0.85 } });
  // the last pass
  M.final = postShader(/* glsl */`
    uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uRays; uniform vec2 uTexel; uniform float uExposure;
    uniform float uBloomK; uniform float uRaysK; uniform vec3 uRayCol; uniform float uSharp; uniform float uVig; uniform float uSat; uniform float uCon; uniform float uTime; uniform vec3 uTint; uniform float uUnderK;
    varying vec2 vUv;
    ${POST_TONE}
    float lum(vec3 c){ return dot(max(c, 0.0), vec3(0.299, 0.587, 0.114)) * uExposure; }
    void main(){
      vec2 uv = vUv;
      // under water the view wavers a little
      if (uUnderK > 0.0) uv += vec2(sin(uv.y * 22.0 + uTime * 1.7), cos(uv.x * 18.0 + uTime * 1.3)) * 0.0016 * uUnderK;
      vec3 cM = texture2D(uScene, uv).rgb;
      vec3 cNW = texture2D(uScene, uv + vec2(-1.0, -1.0) * uTexel).rgb, cNE = texture2D(uScene, uv + vec2(1.0, -1.0) * uTexel).rgb;
      vec3 cSW = texture2D(uScene, uv + vec2(-1.0, 1.0) * uTexel).rgb, cSE = texture2D(uScene, uv + vec2(1.0, 1.0) * uTexel).rgb;
      // anti-aliasing (FXAA), on tone-mapped brightness so bright edges are smoothed too
      float lM = lum(cM), lNW = lum(cNW), lNE = lum(cNE), lSW = lum(cSW), lSE = lum(cSE);
      float tM = lM / (1.0 + lM), tNW = lNW / (1.0 + lNW), tNE = lNE / (1.0 + lNE), tSW = lSW / (1.0 + lSW), tSE = lSE / (1.0 + lSE);
      float tMin = min(tM, min(min(tNW, tNE), min(tSW, tSE))), tMax = max(tM, max(max(tNW, tNE), max(tSW, tSE)));
      vec3 c = cM;
      if (tMax - tMin > max(0.035, tMax * 0.11)) {
        vec2 dir = vec2(-((tNW + tNE) - (tSW + tSE)), (tNW + tSW) - (tNE + tSE));
        float red = max((tNW + tNE + tSW + tSE) * 0.03125, 0.0078);
        dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -8.0, 8.0) * uTexel;
        vec3 a1 = texture2D(uScene, uv + dir * (1.0 / 3.0 - 0.5)).rgb, a2 = texture2D(uScene, uv + dir * (2.0 / 3.0 - 0.5)).rgb;
        vec3 b1 = texture2D(uScene, uv - dir * 0.5).rgb, b2 = texture2D(uScene, uv + dir * 0.5).rgb;
        float w1 = 1.0 / (1.0 + lum(a1)), w2 = 1.0 / (1.0 + lum(a2)), w3 = 1.0 / (1.0 + lum(b1)), w4 = 1.0 / (1.0 + lum(b2));
        vec3 rA = (a1 * w1 + a2 * w2) / (w1 + w2);
        vec3 rB = (a1 * w1 + a2 * w2 + b1 * w3 + b2 * w4) / (w1 + w2 + w3 + w4);
        float lB = lum(rB), tB = lB / (1.0 + lB);
        c = (tB < tMin || tB > tMax) ? rA : rB;
      } else if (uSharp > 0.0) {
        // away from edges, a little crispness: push each pixel away from the average of its neighbours
        vec3 avg = (cNW + cNE + cSW + cSE) * 0.25;
        c = max(cM + (cM - avg) * uSharp / (1.0 + lM * 0.6), 0.0);
      }
      vec3 e = c * uExposure;
      e += texture2D(uBloom, uv).rgb * uBloomK;
      e += uRayCol * (texture2D(uRays, uv).r * uRaysK);
      vec3 d = pDisplay(e);
      // the grade: a touch more colour and contrast, and whatever tint the hour calls for
      float l = dot(d, vec3(0.2126, 0.7152, 0.0722));
      d = mix(vec3(l), d, uSat);
      d = mix(d, d * d * (3.0 - 2.0 * d), uCon);
      d *= mix(vec3(1.0), uTint, 0.5 + 0.5 * (1.0 - l));
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
      d *= 1.0 - uVig * smoothstep(0.32, 0.95, length(q));
      d += (ign(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
      gl_FragColor = vec4(d, 1.0);
    }`, { uScene: { value: null }, uBloom: { value: null }, uRays: { value: null }, uTexel: { value: new THREE.Vector2() }, uExposure: exp,
      uBloomK: { value: 0 }, uRaysK: { value: 0 }, uRayCol: { value: new THREE.Vector3(1, 0.9, 0.7) }, uSharp: { value: 0.35 }, uVig: { value: 0.22 },
      uSat: { value: 1.08 }, uCon: { value: 0.16 }, uTime: U.uTime, uTint: { value: new THREE.Vector3(1, 1, 1) }, uUnderK: { value: 0 } });
  POST.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), M.final); POST.quad.frustumCulled = false;
  POST.sc = new THREE.Scene(); POST.sc.add(POST.quad);
}
function disposePost() {
  for (const r of [POST.opaque, POST.scene, POST.rays, ...POST.ao, ...POST.down, ...POST.up]) if (r) { if (r.depthTexture) r.depthTexture.dispose(); r.dispose(); }
  POST.opaque = POST.scene = POST.rays = null; POST.ao = []; POST.down = []; POST.up = [];
}
function setupPost() {
  const want = postSupported() && Q.post !== false;
  if (!want) { if (POST.on) disposePost(); POST.on = false; WFX.uniforms.uDepthOn.value = 0; return; }
  if (!POST.M) buildPostMaterials();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  const msaa = Q.msaa && !isMobile ? Math.min(4, renderer.capabilities.maxSamples || 0) : 0;
  if (POST.on && POST.size.equals(s) && POST.msaa === msaa && POST.q === Q) return;
  disposePost();
  POST.size.copy(s); POST.msaa = msaa; POST.q = Q;
  const HF = THREE.HalfFloatType, lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  POST.opaque = new THREE.WebGLRenderTarget(s.x, s.y, { type: HF, depthBuffer: true, samples: msaa, ...lin });
  POST.opaque.depthTexture = new THREE.DepthTexture(s.x, s.y); POST.opaque.depthTexture.type = THREE.UnsignedIntType;
  POST.scene = new THREE.WebGLRenderTarget(s.x, s.y, { type: HF, depthBuffer: true, ...lin });
  const part = (d, type = HF) => new THREE.WebGLRenderTarget(Math.max(2, Math.round(s.x / d)), Math.max(2, Math.round(s.y / d)), { type, depthBuffer: false, ...lin });
  if (Q.ao) POST.ao = [part(2, THREE.UnsignedByteType), part(2, THREE.UnsignedByteType)];
  if (Q.glow) { POST.down = [part(4), part(8), part(16), part(32)]; POST.up = [part(16), part(8), part(4)]; }
  if (Q.rays) POST.rays = part(4, THREE.UnsignedByteType);
  POST.on = true;
  WFX.uniforms.uScreen.value.copy(s);
}
function postPass(mat, target) { POST.quad.material = mat; renderer.setRenderTarget(target); renderer.render(POST.sc, POST.cam); }
const _postSz = new THREE.Vector2(), _postSun = new THREE.Color();
function renderWorldHDR() {
  renderer.getDrawingBufferSize(_postSz);
  if (!_postSz.equals(POST.size) || POST.q !== Q) setupPost();
  if (!POST.on) return false;
  const M = POST.M, s = POST.size, under = U.uUnderwater.value > 0.5;
  const nf = WFX.uniforms.uNearFar.value.set(camera.near, camera.far);
  U.uHDR.value = 1; U.uExposure.value = renderer.toneMappingExposure;
  WFX.uniforms.uRefrOn.value = WFX.refrOn && !under ? 1 : 0;
  WFX.uniforms.uDepthOn.value = under ? 0 : 1;
  WFX.uniforms.uScreen.value.copy(s);
  // 1. everything solid (nothing may read the picture it is being drawn into, so the water's inputs are unhooked meanwhile)
  WFX.uniforms.uRefrTex.value = null; WFX.uniforms.uDepthTex.value = null;
  renderer.shadowMap.needsUpdate = true;
  renderer.setRenderTarget(POST.opaque); camera.layers.mask = 1; renderer.render(scene, camera);
  WFX.uniforms.uRefrTex.value = POST.opaque.texture; WFX.uniforms.uDepthTex.value = POST.opaque.depthTexture;
  // 2. occlusion
  const depth = POST.opaque.depthTexture;
  const aoOn = POST.ao.length && !under && settings.ao !== false;
  if (aoOn) {
    const A = Q.ao > 1 ? M.ao14 : M.ao8, tanY = Math.tan(camera.fov * Math.PI / 360);
    A.uniforms.uDepth.value = depth; A.uniforms.uTan.value.set(tanY * camera.aspect, tanY); A.uniforms.uNF.value.copy(nf); A.uniforms.uRes.value.set(POST.ao[0].width, POST.ao[0].height);
    postPass(A, POST.ao[0]);
    M.aoBlur.uniforms.uAO.value = POST.ao[0].texture; M.aoBlur.uniforms.uDepth.value = depth; M.aoBlur.uniforms.uNF.value.copy(nf); M.aoBlur.uniforms.uPx.value.set(1 / POST.ao[0].width, 1 / POST.ao[0].height);
    postPass(M.aoBlur, POST.ao[1]);
  }
  // 3. into the second target, then the water and everything see-through over it
  M.copy.uniforms.uColor.value = POST.opaque.texture; M.copy.uniforms.uDepth.value = depth;
  M.copy.uniforms.uAO.value = aoOn ? POST.ao[1].texture : null; M.copy.uniforms.uAOK.value = aoOn ? 0.9 : 0;
  postPass(M.copy, POST.scene);
  const ac = renderer.autoClear; renderer.autoClear = false;
  renderer.setRenderTarget(POST.scene);
  camera.layers.mask = 2; renderer.render(scene, camera);
  camera.layers.mask = 4; renderer.render(scene, camera);
  camera.layers.mask = 7;
  U.uHDR.value = 0;
  // what you're holding, drawn over the world
  if (TOOL.vs && TOOL.vm.grp && TOOL.vm.grp.visible) { renderer.clearDepth(); renderer.render(TOOL.vs, camera); }
  renderer.autoClear = ac;
  WFX.uniforms.uRefrTex.value = null; WFX.uniforms.uDepthTex.value = null;
  // 4. sun shafts and glow
  const F = M.final.uniforms;
  let raysK = 0;
  if (POST.rays && settings.rays !== false) {
    camera.getWorldDirection(POST.fwd);
    const sd = POST.sd.copy(ENV.sunDir);
    if (under) {   // seen from below, the sun stands higher: light bends toward the vertical as it enters the water
      const hz = Math.hypot(sd.x, sd.z) || 1e-4, sw = Math.min(1, hz) / 1.33, cw = Math.sqrt(1 - sw * sw);
      sd.set(sd.x / hz * sw, cw, sd.z / hz * sw);
    }
    const facing = POST.fwd.dot(sd);
    const up = smoothstep(-0.03, 0.06, ENV.sunDir.y) * (1 - 0.75 * (WX.cur.cover || 0));
    if (facing > 0.05 && up > 0.01) {
      POST.sun.copy(camera.position).addScaledVector(sd, 1000).project(camera);
      if (under) M.rays.uniforms.uThr.value.set(0.55, 2.4); else M.rays.uniforms.uThr.value.set(1.3, 5.5);
      const R = M.rays.uniforms;
      R.uScene.value = POST.scene.texture; R.uDepth.value = depth; R.uSun.value.set(POST.sun.x * 0.5 + 0.5, POST.sun.y * 0.5 + 0.5); R.uAspect.value = camera.aspect;
      postPass(M.rays, POST.rays);
      const off = Math.max(Math.abs(POST.sun.x), Math.abs(POST.sun.y));
      // strongest when the sun is low; fading as it leaves the picture
      raysK = smoothstep(0.05, 0.4, facing) * up * (1 - smoothstep(1.0, 1.9, off)) * (under ? 1.3 * Math.exp(-Math.max(0, -camera.position.y) * 0.05) : lerp(0.55, 1.5, 1 - smoothstep(0.08, 0.6, sd.y)));
      _postSun.setRGB(SKY.uSunDisk.value.x, SKY.uSunDisk.value.y, SKY.uSunDisk.value.z, THREE.SRGBColorSpace);
      F.uRayCol.value.set(_postSun.r, _postSun.g, _postSun.b); if (under) F.uRayCol.value.multiply(POST.uwTint);
    }
  }
  F.uRays.value = POST.rays ? POST.rays.texture : null; F.uRaysK.value = raysK * 0.85;
  const glow = POST.down.length && settings.glow !== false;
  if (glow) {
    const D = POST.down, Up = POST.up;
    M.bright.uniforms.uSrc.value = POST.scene.texture; M.bright.uniforms.uTexel.value.set(1 / s.x, 1 / s.y);
    postPass(M.bright, D[0]);
    for (let i = 1; i < D.length; i++) { M.down.uniforms.uSrc.value = D[i - 1].texture; M.down.uniforms.uH.value.set(0.5 / D[i - 1].width, 0.5 / D[i - 1].height); postPass(M.down, D[i]); }
    let src = D[D.length - 1];
    for (let i = 0; i < Up.length; i++) {
      M.upMix.uniforms.uSrc.value = src.texture; M.upMix.uniforms.uAdd.value = D[D.length - 2 - i].texture; M.upMix.uniforms.uH.value.set(0.5 / src.width, 0.5 / src.height);
      postPass(M.upMix, Up[i]); src = Up[i];
    }
    F.uBloom.value = src.texture;
  }
  F.uBloomK.value = glow ? 0.16 * GLOW.amount * (P.eyeUnder ? 0.5 : 1) : 0;
  // 5. to the screen
  F.uScene.value = POST.scene.texture; F.uTexel.value.set(1 / s.x, 1 / s.y);
  F.uUnderK.value = under ? 1 : 0;
  F.uSharp.value = (settings.sharpen ?? 1) * (pixelRatio * resScale < 1.4 ? 0.45 : 0.25);
  postPass(M.final, null);
  POST.toolsDone = true;
  return true;
}
