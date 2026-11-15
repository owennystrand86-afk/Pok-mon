
// ───────────────────── 8c. Glow: bright light blooms ─────────────────────
// The finished frame is copied, the brightest parts (sun glints on the water, the sun, lightning,
// the fire and lamps) are picked out at quarter and eighth resolution, blurred, and added back
// on top, so highlights shine instead of just clipping to white.
const GLOW = { on: false, src: null, rts: [], quad: null, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mats: {}, size: new THREE.Vector2(), amount: 1 };
function glowShader(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: frag, depthTest: false, depthWrite: false,
  });
}
function setupGlow() {
  GLOW.on = !!Q.glow && settings.glow !== false;
  if (!GLOW.on) return;
  const s = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (GLOW.src && GLOW.size.equals(s)) return;
  GLOW.size.copy(s);
  if (GLOW.src) { GLOW.src.dispose(); for (const r of GLOW.rts) r.dispose(); }
  GLOW.src = new THREE.FramebufferTexture(s.x, s.y); GLOW.src.minFilter = GLOW.src.magFilter = THREE.LinearFilter;
  const mk = d => new THREE.WebGLRenderTarget(Math.max(1, Math.round(s.x / d)), Math.max(1, Math.round(s.y / d)), { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  GLOW.rts = [mk(4), mk(4), mk(8), mk(8)];
  if (!GLOW.quad) {
    GLOW.mats.bright = glowShader(/* glsl */`
      uniform sampler2D uSrc; uniform vec2 uTexel; varying vec2 vUv;
      vec3 pick(vec2 uv){ vec3 c = texture2D(uSrc, uv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(0.93, 1.0, l); return c * k * k * k; }
      void main(){
        vec3 c = pick(vUv + uTexel * vec2(-1.0, -1.0)) + pick(vUv + uTexel * vec2(1.0, -1.0)) + pick(vUv + uTexel * vec2(-1.0, 1.0)) + pick(vUv + uTexel * vec2(1.0, 1.0));
        gl_FragColor = vec4(c * 0.25, 1.0); }`, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    GLOW.mats.blur = glowShader(/* glsl */`
      uniform sampler2D uSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(uSrc, vUv).rgb * 0.227027;
        c += (texture2D(uSrc, vUv + uDir * 1.3846).rgb + texture2D(uSrc, vUv - uDir * 1.3846).rgb) * 0.316216;
        c += (texture2D(uSrc, vUv + uDir * 3.2308).rgb + texture2D(uSrc, vUv - uDir * 3.2308).rgb) * 0.070270;
        gl_FragColor = vec4(c, 1.0); }`, { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    GLOW.mats.add = glowShader(/* glsl */`
      uniform sampler2D uA; uniform sampler2D uB; uniform float uAmt; varying vec2 vUv;
      void main(){ vec3 c = texture2D(uA, vUv).rgb * 0.75 + texture2D(uB, vUv).rgb * 1.1; gl_FragColor = vec4(c * uAmt, 1.0); }`,
      { uA: { value: null }, uB: { value: null }, uAmt: { value: 1 } });
    GLOW.mats.add.blending = THREE.AdditiveBlending; GLOW.mats.add.transparent = true;
    GLOW.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), GLOW.mats.bright); GLOW.quad.frustumCulled = false;
    GLOW.scene = new THREE.Scene(); GLOW.scene.add(GLOW.quad);
  }
}
function glowPass(mat, target) { GLOW.quad.material = mat; renderer.setRenderTarget(target); renderer.render(GLOW.scene, GLOW.cam); }
function renderGlow() {
  if (POST.on) return;       // the HDR path has its own glow
  if (!GLOW.on || !GLOW.src) return;
  const s = renderer.getDrawingBufferSize(_rws); if (!s.equals(GLOW.size)) { setupGlow(); if (!GLOW.src) return; }
  renderer.copyFramebufferToTexture(GLOW.src);
  const [a4, b4, a8, b8] = GLOW.rts, M = GLOW.mats;
  const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  M.bright.uniforms.uSrc.value = GLOW.src; M.bright.uniforms.uTexel.value.set(1 / s.x, 1 / s.y);
  glowPass(M.bright, a4);
  M.blur.uniforms.uSrc.value = a4.texture; M.blur.uniforms.uDir.value.set(1 / a4.width, 0); glowPass(M.blur, b4);
  M.blur.uniforms.uSrc.value = b4.texture; M.blur.uniforms.uDir.value.set(0, 1 / a4.height); glowPass(M.blur, a4);
  M.blur.uniforms.uSrc.value = a4.texture; M.blur.uniforms.uDir.value.set(2 / a8.width, 0); glowPass(M.blur, b8);
  M.blur.uniforms.uSrc.value = b8.texture; M.blur.uniforms.uDir.value.set(0, 2 / a8.height); glowPass(M.blur, a8);
  M.add.uniforms.uA.value = a4.texture; M.add.uniforms.uB.value = a8.texture;
  M.add.uniforms.uAmt.value = 0.26 * GLOW.amount * (P.eyeUnder ? 0.5 : 1);
  const ac = renderer.autoClear; renderer.autoClear = false;
  glowPass(M.add, null);
  renderer.autoClear = ac; renderer.toneMapping = tm;
}
