
// ───────────────────── 13b. A real lawn: thousands of grass blades around you ─────────────────────
// Instead of scattered tufts, the meadows are covered in grass near the camera: a fixed grid of
// clumps that wraps around you as you move (so blades stay put in the world), each one placed on
// the terrain in the shader and thinned out wherever the ground is sand, rock, trail or forest.
const LAWN = { mesh: null, dens: null, R: 40, G: 0 };
function buildLawn() {
  const n = T.n, d = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = T.min + i * T.cell, z = T.min + j * T.cell, h = T.h[k];
    const sand = T.mask[k * 4] / 255, jungle = T.mask[k * 4 + 1] / 255, rock = T.mask[k * 4 + 2] / 255, trail = T.mask[k * 4 + 3] / 255;
    const slope = 1 - T.nrm[k * 3 + 1];
    let v = (1 - smoothstep(0.25, 0.6, sand)) * (1 - smoothstep(0.2, 0.5, rock)) * (1 - trail * 0.95) * (1 - smoothstep(0.32, 0.5, slope)) * (1 - jungle * 0.55);
    if (h < 1.2) v = 0;
    if (v > 0) {
      if (excluded(x, z, 0.5)) v *= 0.15;
      // nothing grows in the river, the pools or the spring, or right at their edges
      const q = riverQuery(x, z);
      if (q && q.d < q.W + 2.5) v = 0;
      if (Math.hypot(x - POOL.x, z - POOL.z) < POOL.r + 3.5 || Math.hypot(x - SPRING.x, z - SPRING.z) < SPRING.r + 2) v = 0;
      if (waterAt(x, z).level > h - 0.15) v = 0;
    }
    d[k] = Math.round(clamp(v, 0, 1) * 255);
  }
  const tex = new THREE.DataTexture(d, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  LAWN.dens = tex;
  const clump = grassGeometry(7, 3, true);
  // fold every clump into one instanced draw
  const G = Math.round(122 * Math.sqrt(Q.veg / 0.8)); LAWN.G = G;
  const g = new THREE.InstancedBufferGeometry();
  for (const nm of ['position', 'normal', 'color']) g.setAttribute(nm, clump.attributes[nm]);
  g.setIndex(clump.index);
  const off = new Float32Array(G * G * 3);
  const order = Array.from({ length: G * G }, (_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }  // shuffled, so fewer instances still cover the whole lawn
  order.forEach((c, n) => { const i = c % G, j = (c / G) | 0, k = n * 3; off[k] = (i + rng()) / G; off[k + 1] = (j + rng()) / G; off[k + 2] = rng(); });
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  g.instanceCount = G * G;
  const mat = patch(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), {
    key: 'lawn', uniforms: { uLawnDens: { value: tex }, uLawnBox: { value: LAWN.R * 2 } },
    vHead: 'attribute vec3 aOff; uniform sampler2D uLawnDens; uniform float uLawnBox; varying float vLawnShade;',
    vBegin: /* glsl */`
      {
        float B = uLawnBox;
        vec2 base = cameraPosition.xz + mod(aOff.xy * B - cameraPosition.xz, B) - B * 0.5;
        vec2 tuv = (base - uTerrainRect.xy) * uTerrainRect.z + uTerrainRect.w;
        float dens = texture2D(uLawnDens, tuv).r;
        float dist = length(base - cameraPosition.xz);
        float keep = step(aOff.z, dens * 1.15) * (1.0 - smoothstep(B * 0.36, B * 0.5, dist)) * (1.0 - step(0.35, flattenedAt(vec3(base.x, 0.0, base.y))));
        float nz = texture2D(uNoiseTex, base * 0.05).r;
        float sc = keep * (0.65 + 0.7 * nz) * (0.75 + 0.5 * fract(aOff.z * 13.7));
        float ang = aOff.z * 47.0;
        vec3 p = transformed; p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
        p *= sc;
        // the wind: gusts roll through the meadow as waves of bending blades
        float gust = 0.55 + 0.45 * sin(dot(base, uWindDir) * 0.18 - uTime * (1.4 + uWind * 0.6)) * sin(uTime * 0.37 + base.x * 0.03);
        float bend = p.y * p.y * (0.25 + 0.6 * gust) * uWind;
        p.xz += uWindDir * bend + vec2(sin(uTime * 3.1 + base.x * 2.0 + aOff.z * 9.0), cos(uTime * 2.7 + base.y * 2.0)) * 0.025 * p.y * uWind;
        transformed = p + vec3(base.x, terrainH(base) - 0.03, base.y);
        vLawnShade = nz;
      }`,
    fHead: 'varying float vLawnShade;',
    fNormal: 'normal = normalize(vNormal);',   // light both sides of a blade the same way
    fColor: `diffuseColor.rgb *= mix(vec3(0.60, 0.70, 0.52), vec3(0.86, 0.80, 0.56), vLawnShade);
      { float pn = texture2D(uNoiseTex, vWPos.xz * 0.0043 + 0.21).b;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.12, 0.8), smoothstep(0.55, 0.8, pn) * 0.6);
        diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.3, vWPos.y - terrainH(vWPos.xz))); }`,
    fLight: LEAF_GLOW,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false; scene.add(mesh);
  LAWN.mesh = mesh;
}
function applyLawnQuality() { if (LAWN.mesh) { const G = LAWN.G; LAWN.mesh.geometry.instanceCount = Math.round(G * G * clamp(Q.veg / 0.8, 0.25, 1)); } }

// digging cuts the grass: the blades go from the patch you dug, and the clippings fly
function cutGrass(x, z, r) {
  if (!LAWN.dens) return;
  const d = LAWN.dens.image.data, n = T.n;
  const i0 = Math.max(0, Math.floor((x - r - T.min) / T.cell)), i1 = Math.min(T.res, Math.ceil((x + r - T.min) / T.cell));
  const j0 = Math.max(0, Math.floor((z - r - T.min) / T.cell)), j1 = Math.min(T.res, Math.ceil((z + r - T.min) / T.cell));
  let cut = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const gx = T.min + i * T.cell, gz = T.min + j * T.cell, dd = Math.hypot(gx - x, gz - z);
    if (dd > r + T.cell * 0.7) continue;
    const k = j * n + i, keep = Math.round(d[k] * smoothstep(r * 0.5, r + T.cell * 0.7, dd));
    if (keep < d[k]) { cut += d[k] - keep; d[k] = keep; }
  }
  if (!cut) return;
  LAWN.dens.needsUpdate = true;
  if (FX.spawn) {
    const g = groundHeight(x, z), n2 = Math.min(26, 6 + cut / 40) * Q.particles;
    for (let i = 0; i < n2; i++) FX.spawn(x + rand(-r, r) * 0.7, g + 0.1, z + rand(-r, r) * 0.7, rand(-1.4, 1.4), rand(1.2, 3.2), rand(-1.4, 1.4), rand(0.8, 1.6), rand(0.05, 0.1), 7, 7.5);
  }
}
