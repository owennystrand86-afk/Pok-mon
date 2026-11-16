
// ───────────────────── 4b. 3D assets made in Blender ─────────────────────
// Models are written as Blender scripts (models/*.py), exported as compact .bpk packs and embedded in the
// page by tools/pack_assets.py as one deflated, base64 blob (formats and workflow: DEVELOPING.md).
// loadAssets() unpacks it at boot. After that:
//   assetModel(name, opts)     a new THREE.Group per call; geometries and materials are shared between calls
//   assetGeometry(name, sel)   a raw BufferGeometry for instancing (vegetation, fish) or your own material
//   assetMeta(name), assetAnchor(name, anchor), assetAnchorWorld(model, anchor, pos, quat)
//   assetPose(model, part, rx, ry, rz, slide)   turn / slide a moving part from its rest position
//   assetMaterial(name, material)   the THREE material behind a named asset material
// Everything returns null when the pack or the name is missing: the game must boot without its assets.
const ASSETS = {
  ready: false, ms: 0, count: 0, tris: 0, bytes: 0, err: null,
  by: new Map(),              // name -> record
  images: [], textures: [],   // the pack's shared images and their textures
  details: [], detailTex: null, detailK: [],   // the detail textures of all assets, as one array texture
  mats: new Map(), depth: new Map(),
  lod: [], lodAt: 0, bias: 0,
  // What glossy surfaces mirror (there is no environment map): the sky at the zenith and at the horizon and the
  // glow round the sun, as linear light, and the light the sky sheds on the ground. updateAssets() sets them.
  uniforms: {
    uBpSkyZ: { value: new THREE.Vector3(0.05, 0.2, 0.9) }, uBpSkyH: { value: new THREE.Vector3(0.2, 0.4, 0.9) },
    uBpSkyG: { value: new THREE.Vector3(1, 0.8, 0.6) }, uBpAmb: { value: new THREE.Vector3(0.3, 0.5, 0.9) },
  },
};

// ---- unpacking ----
function assetB64(s) {
  if (Uint8Array.fromBase64) { try { return Uint8Array.fromBase64(s); } catch (e) { /* use atob */ } }
  const bin = atob(s), n = bin.length, out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// Raw deflate in plain JS, for browsers without DecompressionStream('deflate-raw'). Small rather than fast.
function assetInflateJS(src, outLen) {
  let out = new Uint8Array(outLen || Math.max(1024, src.length * 4)), op = 0, ip = 0, bb = 0, bn = 0;
  const bits = n => { while (bn < n) { bb |= src[ip++] << bn; bn += 8; } const v = bb & ((1 << n) - 1); bb >>>= n; bn -= n; return v; };
  const grow = need => { if (op + need > out.length) { const b = new Uint8Array(Math.max(out.length * 2, op + need)); b.set(out); out = b; } };
  const build = (lens, off, n) => {
    const cnt = new Uint16Array(16), offs = new Uint16Array(16), sym = new Uint16Array(n);
    for (let i = 0; i < n; i++) cnt[lens[off + i]]++;
    cnt[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + cnt[i - 1];
    for (let i = 0; i < n; i++) if (lens[off + i]) sym[offs[lens[off + i]]++] = i;
    return { cnt, sym };
  };
  const decode = h => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.cnt[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('bad deflate data');
  };
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  let fixL = null, fixD = null;
  for (let last = 0; !last;) {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {                                  // stored
      bb = 0; bn = 0;
      const len = src[ip] | (src[ip + 1] << 8); ip += 4;
      grow(len); out.set(src.subarray(ip, ip + len), op); op += len; ip += len;
      continue;
    }
    let hl, hd;
    if (type === 1) {                                  // fixed codes
      if (!fixL) {
        const l = new Uint8Array(320);
        l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); l.fill(5, 288, 318);
        fixL = build(l, 0, 288); fixD = build(l, 288, 30);
      }
      hl = fixL; hd = fixD;
    } else if (type === 2) {                           // dynamic codes
      const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, lens = new Uint8Array(320), cl = new Uint8Array(19);
      for (let i = 0; i < nc; i++) cl[ORDER[i]] = bits(3);
      const hc = build(cl, 0, 19);
      for (let i = 0; i < nl + nd;) {
        const s = decode(hc);
        if (s < 16) lens[i++] = s;
        else {
          let rep, val = 0;
          if (s === 16) { val = lens[i - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
          while (rep--) lens[i++] = val;
        }
      }
      hl = build(lens, 0, nl); hd = build(lens, nl, nd);
    } else throw new Error('bad deflate block');
    for (;;) {
      let s = decode(hl);
      if (s < 256) { if (op >= out.length) grow(1); out[op++] = s; continue; }
      if (s === 256) break;
      s -= 257;
      const len = LB[s] + bits(LE[s]), ds = decode(hd), dist = DB[ds] + bits(DE[ds]);
      grow(len);
      for (let i = 0, from = op - dist; i < len; i++) out[op++] = out[from + i];
    }
  }
  return out.subarray(0, op);
}
async function assetInflate(u8, rawLen) {
  if (typeof DecompressionStream === 'function') {
    try {
      const buf = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      if (!rawLen || buf.byteLength === rawLen) return new Uint8Array(buf);
    } catch (e) { /* this browser has no 'deflate-raw': inflate it ourselves */ }
  }
  return assetInflateJS(u8, rawLen);
}
// One array out of the pack: n elements of c components, each w bytes wide. acc.f says how the packer rewrote it:
// 0 as it was, 1 delta + zigzag + byte planes, 2 (indices) distance below the highest index so far + byte planes,
// 3 difference from a prediction made from the triangles (idx = the primitive's decoded indices) + zigzag + planes.
// Byte planes: byte k of component j of element i is at o + k * n * c + j * n + i.
function assetArray(blob, acc, n, c, w, signed, idx) {
  const o = acc.o, m = n * c, f = acc.f | 0;
  const out = new (w === 1 ? Uint8Array : w === 2 ? Uint16Array : Uint32Array)(m);
  const plane = q => (w === 1 ? blob[q] : w === 2 ? blob[q] | (blob[q + m] << 8) : (blob[q] | (blob[q + m] << 8) | (blob[q + 2 * m] << 16) | (blob[q + 3 * m] << 24)) >>> 0);
  if (!f) {
    if (w === 1) out.set(blob.subarray(o, o + m));
    else if (w === 2) for (let i = 0, p = o; i < m; i++, p += 2) out[i] = blob[p] | (blob[p + 1] << 8);
    else for (let i = 0, p = o; i < m; i++, p += 4) out[i] = (blob[p] | (blob[p + 1] << 8) | (blob[p + 2] << 16) | (blob[p + 3] << 24)) >>> 0;
  } else if (f === 1) {
    for (let j = 0; j < c; j++) {
      let prev = 0;
      for (let i = 0, q = o + j * n; i < n; i++, q++) {
        const z = plane(q);
        out[i * c + j] = prev + ((z >>> 1) ^ -(z & 1));     // the typed array wraps it to the element's width
        prev = out[i * c + j];
      }
    }
  } else if (f === 2) {
    let hw = 0;
    for (let i = 0; i < n; i++) {
      const z = plane(o + i);
      out[i] = hw - z;
      if (z === 0) hw++;
    }
  } else {
    // Vertices come in the order the triangle list first uses them. Each is predicted from corners of that
    // triangle that are already known: a + b - d across the edge shared with the triangle before, else the
    // mean of a and b, else the one known corner, else simply the vertex before.
    let v = 0;
    for (let q = 0; q < idx.length && v < n; q++) {
      if (idx[q] !== v) continue;
      const t = q - q % 3, k = q - t, o1 = idx[t + (k + 1) % 3], o2 = idx[t + (k + 2) % 3], k1 = o1 < v, k2 = o2 < v;
      let kind = k1 && k2 ? 2 : k1 || k2 ? 1 : 0, a = k1 ? o1 : o2, d = 0;
      if (kind === 2 && t > 0 && o1 !== o2) {
        const p0 = idx[t - 3], p1 = idx[t - 2], p2 = idx[t - 1];
        if ((p0 === o1 || p1 === o1 || p2 === o1) && (p0 === o2 || p1 === o2 || p2 === o2)) { kind = 3; d = p0 + p1 + p2 - o1 - o2; }
      }
      for (let j = 0; j < c; j++) {
        const z = plane(o + j * n + v);
        const pr = kind === 0 ? (v ? out[(v - 1) * c + j] : 0) : kind === 1 ? out[a * c + j] : kind === 2 ? Math.floor((out[o1 * c + j] + out[o2 * c + j]) / 2) : out[o1 * c + j] + out[o2 * c + j] - out[d * c + j];
        out[v * c + j] = pr + ((z >>> 1) ^ -(z & 1));
      }
      v++;
    }
  }
  return signed ? (w === 1 ? new Int8Array(out.buffer) : new Int16Array(out.buffer)) : out;
}
const ASSET_S2L = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; ASSET_S2L[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
// Turn a primitive's packed arrays into plain attribute arrays: positions, normals and UVs as floats, colour
// as linear floats (what three.js and the game's own geometry helpers expect), the extra byte attribute as is.
function assetDecodePrim(blob, p, alpha) {
  const nv = p.nv, d = {};
  const ix = d.idx = assetArray(blob, p.idx, p.ni, 1, p.idx.t === 'u32' ? 4 : 2);
  const qp = assetArray(blob, p.pos, nv, 3, p.pos.t === 'u32' ? 4 : 2, false, ix), mn = p.pos.min, st = p.pos.step;   // 32 bits where a primitive is too large for 16
  const pos = d.pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i += 3) { pos[i] = mn[0] + qp[i] * st; pos[i + 1] = mn[1] + qp[i + 1] * st; pos[i + 2] = mn[2] + qp[i + 2] * st; }
  const bits = p.nrm.bits || 8, qn = assetArray(blob, p.nrm, nv, 2, bits <= 8 ? 1 : 2, true, ix), k = 1 / ((1 << (bits - 1)) - 1);
  const nrm = d.nrm = new Float32Array(nv * 3);
  for (let i = 0, j = 0; i < nv; i++, j += 3) {         // octahedral
    let x = qn[i * 2] * k, y = qn[i * 2 + 1] * k;
    const z = 1 - Math.abs(x) - Math.abs(y), t = z < 0 ? -z : 0;
    x += x >= 0 ? -t : t; y += y >= 0 ? -t : t;
    const l = 1 / Math.hypot(x, y, z);
    nrm[j] = x * l; nrm[j + 1] = y * l; nrm[j + 2] = z * l;
  }
  if (p.uv) {
    const q = assetArray(blob, p.uv, nv, 2, p.uv.t === 'u32' ? 4 : 2, false, ix), u0 = p.uv.min, us = p.uv.step, uv = d.uv = new Float32Array(nv * 2);
    for (let i = 0; i < nv * 2; i += 2) { uv[i] = u0[0] + q[i] * us; uv[i + 1] = u0[1] + q[i + 1] * us; }
  }
  if (p.col) {
    const q = assetArray(blob, p.col, nv, 4, 1, false, ix), n = d.colN = alpha ? 4 : 3, col = d.col = new Float32Array(nv * n);
    for (let i = 0, a = 0, b = 0; i < nv; i++, a += 4, b += n) {
      col[b] = ASSET_S2L[q[a]]; col[b + 1] = ASSET_S2L[q[a + 1]]; col[b + 2] = ASSET_S2L[q[a + 2]];
      if (alpha) col[b + 3] = q[a + 3] / 255;
    }
  }
  if (p.aux) d.aux = assetArray(blob, p.aux, nv, 4, 1, false, ix);
  else { d.aux = new Uint8Array(nv * 4); for (let i = 0; i < nv * 4; i += 4) { d.aux[i] = 255; d.aux[i + 1] = 153; d.aux[i + 3] = 255; } }
  if (p.did) d.did = assetArray(blob, p.did, nv, 1, 1, false, ix);
  return d;
}
function assetParse(raw) {
  const u32 = o => (raw[o] | (raw[o + 1] << 8) | (raw[o + 2] << 16) | (raw[o + 3] << 24)) >>> 0;
  if (u32(0) !== 0x4b415042) throw new Error('not an asset pack');
  const dl = u32(8), dir = JSON.parse(new TextDecoder().decode(raw.subarray(12, 12 + dl))), blob = raw.subarray(12 + dl);
  ASSETS.images = (dir.images || []).map(im => ({ ...im, bytes: blob.slice(im.o, im.o + im.n) }));
  ASSETS.details = dir.details || [];
  for (const h of dir.assets || []) {
    const rec = {
      name: h.name, nodes: h.nodes, materials: h.materials || [], lods: h.lods || [{ dist: 0 }], tris: h.tris || [], meta: h.meta || {},
      anchors: h.anchors || {}, bbox: new THREE.Box3(new THREE.Vector3().fromArray(h.bbox[0]), new THREE.Vector3().fromArray(h.bbox[1])), groups: [], anchorCache: {},
    };
    const gmap = new Map();
    for (const p of h.prims) {
      const md = rec.materials[p.mat] || {};
      const prim = { ...assetDecodePrim(blob, p, !!md.blend), bb: p.bb, nv: p.nv, ni: p.ni, geo: null };
      const key = p.node + ':' + p.mat;
      let g = gmap.get(key);
      if (!g) { g = { node: p.node, mat: p.mat, lods: [] }; gmap.set(key, g); rec.groups.push(g); }
      g.lods[p.lod] = prim;
      if (prim.did) md.det = true;                       // some of its surfaces carry a detail texture
    }
    for (const md of rec.materials) md.sig = JSON.stringify({ ...md, name: 0, src: 0 });
    ASSETS.by.set(h.name, rec);
    ASSETS.tris += rec.tris[0] || 0;
  }
  ASSETS.count = ASSETS.by.size;
}
// Embedded pictures become textures without blob: or network addresses, which a strict page policy may block.
async function assetDecodeImages() {
  await Promise.all(ASSETS.images.map(async (im, i) => {
    let pic = null;
    const blob = new Blob([im.bytes], { type: im.mime });
    if (typeof createImageBitmap === 'function') {
      try { pic = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); }
      catch (e) { try { pic = await createImageBitmap(blob); } catch (e2) { pic = null; } }
    }
    if (!pic && typeof Image === 'function') {
      try {
        let bin = ''; const b = im.bytes;
        for (let k = 0; k < b.length; k += 8192) bin += String.fromCharCode.apply(null, b.subarray(k, k + 8192));
        const el = new Image(); el.src = 'data:' + im.mime + ';base64,' + btoa(bin);
        await el.decode(); pic = el;
      } catch (e) { pic = null; }
    }
    im.bytes = null;
    if (!pic) return;
    if (ASSETS.details.some(d => d.image === i)) { im.pic = pic; return; }       // goes into the detail array instead
    const t = new THREE.Texture(pic);
    t.name = im.name; t.flipY = false;                 // UVs are exported for row 0 at the top
    t.colorSpace = im.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = im.wrap === 'clamp' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = maxAniso; t.needsUpdate = true;
    ASSETS.textures[i] = t;
  }));
  assetBuildDetails();
}
// All detail textures (wood grain, brushing, weave...) as the layers of ONE array texture: each vertex says which
// layer it uses, so surfaces with different details still share a material and a draw call.
function assetBuildDetails() {
  const D = ASSETS.details, S = 256;
  if (!D.length || !renderer.capabilities.isWebGL2) return;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const data = new Uint8Array(S * S * D.length).fill(128);
    D.forEach((d, l) => {
      const pic = ASSETS.images[d.image] && ASSETS.images[d.image].pic; if (!pic) return;
      g.clearRect(0, 0, S, S); g.drawImage(pic, 0, 0, S, S);
      const px = g.getImageData(0, 0, S, S).data;
      for (let i = 0, o = l * S * S; i < S * S; i++) data[o + i] = px[i * 4];
      ASSETS.images[d.image].pic = null;
    });
    const t = new THREE.DataArrayTexture(data, S, S, D.length);
    t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = maxAniso; t.needsUpdate = true;
    ASSETS.detailTex = t;
    ASSETS.detailK = D.map(d => new THREE.Vector3().fromArray(d.k || [0.3, 0.2, 0.0002]));
  } catch (e) { ASSETS.detailTex = null; }             // no detail: the surfaces are just plainer
}
// Call once, before anything asks for a model. Never throws: without a pack the game runs without assets.
async function loadAssets() {
  const t0 = performance.now();
  try {
    const el = document.getElementById('bp-assets'), text = el && el.textContent;
    if (text && text.length > 16) {
      const packed = assetB64(text.trim());
      el.textContent = '';                               // the text is megabytes: let it go
      const raw = await assetInflate(packed, +el.dataset.raw || 0);
      ASSETS.bytes = raw.length;
      assetParse(raw);
      await assetDecodeImages();
      ASSETS.ms = performance.now() - t0;
      console.info(`assets: ${ASSETS.count} models, ${ASSETS.tris} triangles, ${ASSETS.images.length} images, ${(packed.length / 1024).toFixed(0)} KB packed, ${(raw.length / 1024).toFixed(0)} KB unpacked in ${ASSETS.ms.toFixed(1)} ms`);
    }
  } catch (e) {
    ASSETS.err = e; ASSETS.by.clear(); ASSETS.count = 0;
    console.info('assets: could not be unpacked (' + (e && e.message ? e.message : e) + '); the game goes on without them');
  }
  ASSETS.ready = true; ASSETS.ms = performance.now() - t0;
  return ASSETS;
}

// ---- materials ----
// Asset materials are standard materials sent through patch(), so they get the island's fog, the underwater
// light and the HDR convention like everything else. On top of that:
//   * colour, roughness and metalness come per vertex (one draw call for many "materials"): colour as the
//     ordinary vertex colour, the rest in bpAux = (ambient occlusion, roughness, metalness, weight);
//   * the baked occlusion shades the light of the sky and what is mirrored, and sunlight only slightly
//     (the same split three.js makes for an aoMap);
//   * glossy and metal surfaces mirror the sky and the ground (bpEnv), as there is no environment map;
//   * the sunlit ground throws light back up: bright sand fills the shaded sides and undersides of things;
//   * a detail texture can give fine grain: tone, roughness and relief from one grey image.
const ASSET_VHEAD = /* glsl */`
attribute vec4 bpAux; varying vec4 vBpAux; varying vec3 vBpGround;
#ifdef BP_DETAIL
attribute float bpDid; varying vec3 vBpUv;           // detail UV, and which detail texture (0 = none)
#endif
#ifdef BP_SWAY
uniform float bpSwayK;
#endif
`;
const ASSET_VSWAY = /* glsl */`
#ifdef BP_SWAY
{ // cloth, fringes and fronds move with the wind as far as their weight (bpAux.w) lets them
  vec4 bpW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  bpW = instanceMatrix * bpW;
  #endif
  bpW = modelMatrix * bpW;
  float bpPh = dot(bpW.xz, vec2(0.71, 0.53)) + bpW.y * 0.9;
  float bpGust = 0.55 + 0.45 * sin(uTime * 0.63 + bpW.x * 0.021 + bpW.z * 0.017);
  vec3 bpDir = normalize((vec4(uWindDir.x, 0.0, uWindDir.y, 0.0) * modelMatrix).xyz + vec3(1e-5));
  float bpAmp = bpSwayK * bpAux.w * uWind;
  transformed += bpDir * (bpAmp * (0.4 * bpGust + 0.3 * sin(uTime * 2.3 + bpPh * 1.7)));
  transformed += normal * (bpAmp * 0.25 * sin(uTime * 4.1 + bpPh * 3.1));
}
#endif
`;
const ASSET_VEND = /* glsl */`
vBpAux = bpAux;
{ // the ground under this vertex: pale sand low on the shore, turf higher up, dark water off the land
  float bpTh = terrainH(vWPos.xz);
  vBpGround = mix(vec3(0.04, 0.09, 0.10), mix(vec3(0.60, 0.50, 0.33), vec3(0.12, 0.16, 0.06), smoothstep(2.4, 5.0, bpTh)), smoothstep(-0.5, 0.2, bpTh));
}
#ifdef BP_DETAIL
vBpUv = vec3(uv, floor(bpDid * 255.0 + 0.5));
#endif
`;
const ASSET_FHEAD = /* glsl */`
varying vec4 vBpAux; varying vec3 vBpGround;
uniform vec3 uBpSkyZ; uniform vec3 uBpSkyH; uniform vec3 uBpSkyG; uniform vec3 uBpAmb; uniform float bpEnvK;
#ifdef BP_DETAIL
varying vec3 vBpUv; uniform sampler2DArray bpDetailTex; uniform vec3 bpDetailK[BP_NDETAIL];
#endif
// what a surface mirrors in world direction d: sky above (bluer overhead, a glow round the sun), the lit ground
// below. A rough surface sees a wide patch of it at once: more of the deep blue overhead, a soft horizon.
vec3 bpEnv(vec3 d, float rough, vec3 ground){
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 sky = mix(uBpSkyH, uBpSkyZ, smoothstep(0.0, 0.6, mix(d.y, 0.5, rough * 0.85)));
  sky = mix(sky, uBpSkyG, min(1.0, uGlowAmt * (0.75 * pow(sd, 3.0) + 0.25 * pow(sd, 14.0))) * (1.0 - rough));
  float w = mix(0.03, 0.9, rough);
  return mix(ground, sky, smoothstep(-w, w, d.y));
}
`;
const ASSET_FCOLOR = /* glsl */`
#ifdef BP_DETAIL
float bpLay = max(vBpUv.z - 1.0, 0.0);
float bpD = texture(bpDetailTex, vec3(vBpUv.xy, bpLay)).r - 0.5;                       // 0 = neutral
vec3 bpDk = bpDetailK[int(bpLay + 0.5)] * (step(0.5, vBpUv.z) * vBpAux.w);            // tone, roughness, relief (m)
diffuseColor.rgb *= 1.0 + 2.0 * bpDk.x * bpD;
#endif
`;
const ASSET_FROUGH = /* glsl */`
roughnessFactor *= vBpAux.y;
#ifdef BP_DETAIL
roughnessFactor = clamp(roughnessFactor - bpDk.y * bpD, 0.03, 1.0);
#endif
`;
const ASSET_FNORMAL = /* glsl */`
#ifdef BP_DETAIL
{ // relief from the same texture: tilt the normal by the slope of the height (bpDk.z metres deep)
  float bpH = bpD * bpDk.z;
  vec3 bpSx = dFdx(-vViewPosition), bpSy = dFdy(-vViewPosition);
  vec3 bpR1 = cross(bpSy, normal), bpR2 = cross(normal, bpSx);
  float bpDet = dot(bpSx, bpR1) * faceDirection;
  vec3 bpGrad = sign(bpDet) * (dFdx(bpH) * bpR1 + dFdy(bpH) * bpR2);
  normal = normalize(abs(bpDet) * normal - bpGrad);
}
#endif
`;
const ASSET_ENV = /* glsl */`
{ vec3 bpN = inverseTransformDirection(geometryNormal, viewMatrix), bpV = inverseTransformDirection(geometryViewDir, viewMatrix);
  vec3 bpSunG = uSunLin * max(uLightDir.y, 0.0);
  // sunlight thrown back up by the ground: it fills the shaded sides and the undersides of things
  reflectedLight.indirectDiffuse += vBpGround * bpSunG * (0.7 * bpEnvK * (0.5 - 0.5 * bpN.y)) * BRDF_Lambert(material.diffuseColor);
  // the sky and the ground mirrored in the surface
  vec3 bpGr = vBpGround * (bpSunG * 0.8 + uBpAmb) * RECIPROCAL_PI;
  vec3 bpR = normalize(mix(reflect(-bpV, bpN), bpN, material.roughness * material.roughness));
  reflectedLight.indirectSpecular += bpEnv(bpR, material.roughness, bpGr) * EnvironmentBRDF(geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness) * bpEnvK;
  #ifdef USE_CLEARCOAT
  vec3 bpNc = inverseTransformDirection(geometryClearcoatNormal, viewMatrix);
  clearcoatSpecularIndirect += bpEnv(reflect(-bpV, bpNc), material.clearcoatRoughness, bpGr) * EnvironmentBRDF(geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness) * bpEnvK;
  #endif
}
`;
const ASSET_AO = /* glsl */`
{ // baked ambient occlusion: nooks do not see the sky, so its light (and what is mirrored) takes the full
  // effect; sunlight only a little, for the creases the shadow map is too coarse to draw
  float bpAO = vBpAux.x;
  reflectedLight.indirectDiffuse *= bpAO;
  reflectedLight.indirectSpecular *= computeSpecularOcclusion(saturate(dot(geometryNormal, geometryViewDir)), bpAO, material.roughness);
  float bpSun = mix(1.0, bpAO, 0.3);
  reflectedLight.directDiffuse *= bpSun; reflectedLight.directSpecular *= bpSun;
  #ifdef USE_CLEARCOAT
  clearcoatSpecularIndirect *= bpAO;
  #endif
}
`;
function assetShader(sh) {
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vBpAux.z;')
    .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + ASSET_ENV)
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' + ASSET_AO)
    // light that is ADDED to the picture (blend 'add') must fade out in haze and murky water, not turn into a patch of haze
    .replace(/gl_FragColor\.rgb = uHDR > 0\.5 \? applyFogHDR\([^\n]*/, fog => '#ifdef BP_ADD\n{ float bpFog = fogCF(vWPos, 1.0).a; gl_FragColor.rgb *= 1.0 - (uHDR > 0.5 ? pow(bpFog, 1.5) : bpFog); }\n#else\n' + fog + '\n#endif');
}
// a colour the way the game writes them: a hex number, a THREE.Color, or a display-space [r, g, b] triple
function assetColor(c, out) {
  if (c && c.isColor) return out.copy(c);
  if (Array.isArray(c)) return out.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  return out.set(c);
}
// The THREE material for material definition d of an asset. o: { tint, patch } (see assetModel).
function assetMakeMaterial(rec, d, o = {}) {
  if (d.blend === 'shadow') {
    // the shade a thing leaves on the ground it stands on, baked by the artist: black, as dense as the vertex alpha
    let sm = ASSETS.mats.get('shadow');
    if (!sm) {
      sm = patch(new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), { key: 'asset-shadow', under: false });
      sm.name = 'shadow'; ASSETS.mats.set('shadow', sm);
    }
    return sm;
  }
  const tint = o.tint && d.src ? [d.name, ...d.src].map(n => o.tint[n]).find(v => v !== undefined) : undefined;
  const px = o.patch || null;
  const key = (d.own ? rec.name + '/' + d.name : d.sig) + '|' + (px ? px.key || 'x' : '') + '|' + (tint === undefined ? '' : JSON.stringify(tint));
  let m = ASSETS.mats.get(key);
  if (m) return m;
  const params = { vertexColors: true, roughness: 1, metalness: 1, side: d.double ? THREE.DoubleSide : THREE.FrontSide };
  m = d.coat ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat: d.coat, clearcoatRoughness: d.coatRough ?? 0.08 }) : new THREE.MeshStandardMaterial(params);
  m.name = d.name;
  if (d.blend === 'cutout') m.alphaTest = d.alphaTest ?? 0.5;
  else if (d.blend === 'blend') { m.transparent = true; m.depthWrite = false; }
  else if (d.blend === 'add') { m.transparent = true; m.depthWrite = false; m.blending = THREE.AdditiveBlending; m.defines.BP_ADD = ''; }
  if (d.emissive) m.emissive.setRGB(d.emissive[0], d.emissive[1], d.emissive[2]);
  if (d.map != null && ASSETS.textures[d.map]) m.map = ASSETS.textures[d.map];
  if (tint !== undefined) assetColor(tint, m.color);
  const uniforms = { ...ASSETS.uniforms, bpEnvK: { value: d.env ?? 1 } };
  if (d.det && ASSETS.detailTex) { m.defines.BP_DETAIL = ''; m.defines.BP_NDETAIL = ASSETS.detailK.length; uniforms.bpDetailTex = { value: ASSETS.detailTex }; uniforms.bpDetailK = { value: ASSETS.detailK }; }
  if (d.sway) { m.defines.BP_SWAY = ''; uniforms.bpSwayK = { value: d.sway }; }
  m.userData.asset = { def: d, uniforms };
  patch(m, {
    ...(px || {}),
    key: 'asset' + (px ? ':' + (px.key || 'x') : ''),
    uniforms: { ...uniforms, ...((px && px.uniforms) || {}) },
    vHead: ASSET_VHEAD + ((px && px.vHead) || ''), vBegin: ASSET_VSWAY + ((px && px.vBegin) || ''), vEnd: ASSET_VEND + ((px && px.vEnd) || ''),
    fHead: ASSET_FHEAD + ((px && px.fHead) || ''), fColor: ASSET_FCOLOR + ((px && px.fColor) || ''), fRough: ASSET_FROUGH + ((px && px.fRough) || ''),
    fNormal: ASSET_FNORMAL + ((px && px.fNormal) || ''),
    onShader: sh => { assetShader(sh); if (px && px.onShader) px.onShader(sh); },
  });
  ASSETS.mats.set(key, m);
  return m;
}
// shadows of see-through-in-places (cutout) and wind-moved materials need a depth material that does the same
function assetDepthMaterial(m) {
  const a = m.userData.asset; if (!a) return null;
  const d = a.def, cut = d.blend === 'cutout' && m.map, sway = !!d.sway;
  if (!cut && !sway) return null;
  const key = (cut ? m.map.uuid + ':' + m.alphaTest : '') + '|' + (sway ? d.sway : '');
  let dm = ASSETS.depth.get(key);
  if (!dm) {
    dm = depthMat(sway ? { key: 'asset-sway', vHead: 'attribute vec4 bpAux;\n#define BP_SWAY\nuniform float bpSwayK;\n', vBegin: ASSET_VSWAY, uniforms: { bpSwayK: a.uniforms.bpSwayK } } : { key: 'asset' }, cut ? m.map : null, cut ? m.alphaTest : 0);
    ASSETS.depth.set(key, dm);
  }
  return dm;
}

// ---- geometry, models ----
function assetGeo(prim) {
  if (prim.geo) return prim.geo;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(prim.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(prim.nrm, 3));
  if (prim.uv) g.setAttribute('uv', new THREE.BufferAttribute(prim.uv, 2));
  if (prim.col) g.setAttribute('color', new THREE.BufferAttribute(prim.col, prim.colN));
  g.setAttribute('bpAux', new THREE.BufferAttribute(prim.aux, 4, true));
  if (prim.did) g.setAttribute('bpDid', new THREE.BufferAttribute(prim.did, 1, true));
  g.setIndex(new THREE.BufferAttribute(prim.idx, 1));
  const a = new THREE.Vector3().fromArray(prim.bb[0]), b = new THREE.Vector3().fromArray(prim.bb[1]);
  g.boundingBox = new THREE.Box3(a, b);
  g.boundingSphere = new THREE.Sphere(a.clone().add(b).multiplyScalar(0.5), a.distanceTo(b) * 0.5 + 1e-4);
  return prim.geo = g;
}
// The same asset with its moving parts welded in place: one primitive per material and level of detail, for
// models nobody is going to animate (far fewer draw calls). Built the first time it is asked for.
// where every node stands in asset space while nothing has been moved: [{ m: Matrix4, q: Quaternion }]
function assetRest(rec) {
  if (rec.rest) return rec.rest;
  const one = new THREE.Vector3(1, 1, 1);
  rec.rest = [];
  rec.nodes.forEach((nd, i) => {
    const q = new THREE.Quaternion().fromArray(nd.r || [0, 0, 0, 1]), m = new THREE.Matrix4();
    if (i) { m.compose(new THREE.Vector3().fromArray(nd.t || [0, 0, 0]), q, one).premultiply(rec.rest[nd.parent].m); q.premultiply(rec.rest[nd.parent].q); }
    rec.rest.push({ m, q });
  });
  return rec.rest;
}
function assetStaticGroups(rec) {
  if (rec.fixed) return rec.fixed;
  const M = assetRest(rec).map(r => r.m);
  const by = new Map();
  for (const g of rec.groups) g.lods.forEach((prim, l) => { if (!prim) return; let L = by.get(g.mat); if (!L) by.set(g.mat, L = []); (L[l] || (L[l] = [])).push([prim, M[g.node]]); });
  const v = new THREE.Vector3(), n3 = new THREE.Matrix3();
  rec.fixed = [...by].map(([mat, L]) => ({ node: 0, mat, lods: L.map(list => {
    if (!list) return undefined;
    if (list.length === 1 && rec.nodes.length === 1) return list[0][0];
    let nv = 0, ni = 0; for (const [p] of list) { nv += p.nv; ni += p.ni; }
    const hasUv = list.some(([p]) => p.uv), hasDid = list.some(([p]) => p.did), cn = list[0][0].colN;
    const out = { nv, ni, geo: null, pos: new Float32Array(nv * 3), nrm: new Float32Array(nv * 3), col: new Float32Array(nv * cn), colN: cn, aux: new Uint8Array(nv * 4),
      uv: hasUv ? new Float32Array(nv * 2) : undefined, did: hasDid ? new Uint8Array(nv) : undefined, idx: new (nv > 65535 ? Uint32Array : Uint16Array)(ni) };
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    let vo = 0, io = 0;
    for (const [p, m] of list) {
      n3.setFromMatrix4(m);
      for (let i = 0; i < p.nv; i++) {
        v.fromArray(p.pos, i * 3).applyMatrix4(m).toArray(out.pos, (vo + i) * 3);
        for (let k = 0; k < 3; k++) { const c = out.pos[(vo + i) * 3 + k]; if (c < lo[k]) lo[k] = c; if (c > hi[k]) hi[k] = c; }
        v.fromArray(p.nrm, i * 3).applyMatrix3(n3).toArray(out.nrm, (vo + i) * 3);
      }
      out.col.set(p.col, vo * cn); out.aux.set(p.aux, vo * 4);
      if (p.uv) out.uv.set(p.uv, vo * 2);
      if (p.did) out.did.set(p.did, vo);
      for (let i = 0; i < p.ni; i++) out.idx[io + i] = p.idx[i] + vo;
      vo += p.nv; io += p.ni;
    }
    out.bb = [lo, hi];
    return out;
  }) }));
  return rec.fixed;
}
const assetHas = name => ASSETS.by.has(name);
// a level of detail the asset has: 0 .. its lightest
const assetLevel = (rec, lod) => Math.max(0, Math.min(lod | 0, rec.lods.length - 1));
function assetFindMat(rec, name) { return rec.materials.findIndex(d => d.name === name || (d.src && d.src.includes(name))); }
// Raw geometry for instancing or a material of your own: attributes position, normal, color (linear, per
// vertex base colour), uv (if textured), bpAux (occlusion, roughness, metalness, weight) and bpDid (which
// detail texture). sel: { node: 'name', material: 'name', lod: 0, static: true }; all optional (the first
// primitive of the root by default; static welds the moving parts in, as in assetModel). Null if nothing
// matches at that level of detail. The geometry is shared: clone it before changing it.
function assetGeometry(name, sel = {}) {
  const rec = ASSETS.by.get(name); if (!rec) return null;
  const ni = sel.node ? rec.nodes.findIndex(n => n.name === sel.node) : -1, mi = sel.material ? assetFindMat(rec, sel.material) : -1;
  if ((sel.node && ni < 0) || (sel.material && mi < 0)) return null;
  const l = assetLevel(rec, sel.lod);
  const g = (sel.static ? assetStaticGroups(rec) : rec.groups).find(q => (ni < 0 || q.node === ni) && (mi < 0 || q.mat === mi) && q.lods[l]);
  return g ? assetGeo(g.lods[l]) : null;                // null also when the thing does not exist at that level
}
// every primitive of an asset at one level of detail: [{ node, material, geometry }]
function assetGeometries(name, lod = 0) {
  const rec = ASSETS.by.get(name); if (!rec) return null;
  const l = assetLevel(rec, lod);
  return rec.groups.filter(g => g.lods[l]).map(g => ({ node: rec.nodes[g.node].name, material: rec.materials[g.mat].name, geometry: assetGeo(g.lods[l]) }));
}
// the shared THREE material of an asset's named material (for 'own' materials: that asset's alone)
function assetMaterial(name, material, o) {
  const rec = ASSETS.by.get(name); if (!rec) return null;
  const mi = assetFindMat(rec, material);
  return mi < 0 ? null : assetMakeMaterial(rec, rec.materials[mi], o);
}
// What the artist recorded about an asset: { bbox, size, tris, lods, nodes, materials, anchors, meta }
function assetMeta(name) {
  const rec = ASSETS.by.get(name); if (!rec) return null;
  return rec.info || (rec.info = { name, bbox: rec.bbox, size: rec.bbox.getSize(new THREE.Vector3()), tris: rec.tris, lods: rec.lods, nodes: rec.nodes.map(n => n.name),
    materials: rec.materials.map(d => d.name), anchors: Object.keys(rec.anchors), meta: rec.meta });
}
// A named point of an asset: { position, quaternion, node, data, rest }. position and quaternion are in the
// space of its node (the moving part it rides on; asset space for the root's); rest.position and
// rest.quaternion are the same in asset space while no part has been moved (what scenery placed once wants).
// Forward of an anchor is its -Z, up its +Y. Do not modify the returned vectors.
function assetAnchor(name, anchor) {
  const rec = ASSETS.by.get(name); if (!rec) return null;
  const a = rec.anchors[anchor]; if (!a) return null;
  if (rec.anchorCache[anchor]) return rec.anchorCache[anchor];
  const position = new THREE.Vector3().fromArray(a.p), quaternion = a.q ? new THREE.Quaternion().fromArray(a.q) : new THREE.Quaternion(), r = assetRest(rec)[a.node];
  return rec.anchorCache[anchor] = {
    position, quaternion, node: rec.nodes[a.node].name, data: a.data || {},
    rest: { position: position.clone().applyMatrix4(r.m), quaternion: r.q.clone().multiply(quaternion) },
  };
}
// The same point in world space for a model made by assetModel: it follows the model and its moving parts
// (in a static model the parts stand where they were welded). Returns pos, or null.
function assetAnchorWorld(model, anchor, pos = new THREE.Vector3(), quat = null) {
  const a = model && model.userData.asset ? assetAnchor(model.userData.asset, anchor) : null; if (!a) return null;
  const node = model.userData.nodes[a.node];
  if (node) {
    node.updateWorldMatrix(true, false);
    pos.copy(a.position).applyMatrix4(node.matrixWorld);
    if (quat) { node.getWorldQuaternion(quat); quat.multiply(a.quaternion); }
  } else {
    model.updateWorldMatrix(true, false);
    pos.copy(a.rest.position).applyMatrix4(model.matrixWorld);
    if (quat) { model.getWorldQuaternion(quat); quat.multiply(a.rest.quaternion); }
  }
  return pos;
}
// Turn and slide a moving part of a model, counted from where it stands at rest: rx, ry, rz are radians about the
// part's OWN axes (the ones kit.part gave it, in the game's terms: x = Blender -X, y = Blender Z, z = Blender Y, so
// a turn about Blender X changes sign and the other two keep theirs), slide = [x, y, z] metres along those axes.
// Setting node.rotation.x yourself is only right for a part that was made without a rotation of its own.
// Returns the part's Object3D, or null (no such part, or the model was made static).
const _assetE = new THREE.Euler(), _assetQ = new THREE.Quaternion(), _assetV = new THREE.Vector3();
function assetPose(model, part, rx = 0, ry = 0, rz = 0, slide = null) {
  const rec = model && ASSETS.by.get(model.userData.asset), node = rec && model.userData.nodes[part];
  const nd = node && node !== model ? rec.nodes.find(n => n.name === part) : null; if (!nd) return null;
  if (nd.r) node.quaternion.fromArray(nd.r); else node.quaternion.identity();
  if (nd.t) node.position.fromArray(nd.t); else node.position.set(0, 0, 0);
  if (slide) node.position.add(_assetV.fromArray(slide).applyQuaternion(node.quaternion));
  node.quaternion.multiply(_assetQ.setFromEuler(_assetE.set(rx, ry, rz, 'XYZ')));
  return node;
}
// Show one level of detail of a model (0 = full detail; clamped to the levels the asset has).
function assetSetLod(model, level) {
  const L = model.userData.lodMeshes, rec = ASSETS.by.get(model.userData.asset);
  level = model.userData.lod = assetLevel(rec, level);
  for (const e of L) {
    const prim = e.group.lods[level];                   // a thing that exists only in the finer levels is hidden
    e.mesh.visible = !!prim;
    if (prim) { const g = assetGeo(prim); if (e.mesh.geometry !== g) e.mesh.geometry = g; }
  }
}
// A model: a new Group whose children share the asset's geometries and materials.
//   opts.lod        'auto' (default): the lighter levels of detail take over with distance; or a fixed level 0, 1, ...
//   opts.cast, opts.receive   false to switch shadows off (default: as the materials say, normally on)
//   opts.tint       { materialName: colour } multiplies that material's colour for this model (colour: 0xrrggbb,
//                   THREE.Color or a display-space [r, g, b]); meant for materials made with own=True
//   opts.materials  { materialName: THREE.Material } replaces a material with one of your own
//   opts.patch      extra patch() options for every material of this model (give them a key), e.g. the cabin's
//                   indoor light: { key: 'cabin', uniforms, fHead, fLight, onShader }
//   opts.static     true: nobody will move its parts, so weld them in place (one draw call per material instead of
//                   one per material and part). Use it for scenery.
// model.userData.nodes[name] are the named moving parts (Object3D; move them with assetPose), model.userData.asset the name.
function assetModel(name, o = {}) {
  const rec = ASSETS.by.get(name); if (!rec) return null;
  const root = new THREE.Group(); root.name = name;
  const objs = [root], nodes = { [rec.nodes[0].name]: root };
  for (let i = 1; i < rec.nodes.length && !o.static; i++) {
    const nd = rec.nodes[i], g = new THREE.Group();
    g.name = nd.name;
    if (nd.t) g.position.fromArray(nd.t);
    if (nd.r) g.quaternion.fromArray(nd.r);
    objs[nd.parent].add(g); objs.push(g); nodes[nd.name] = g;
  }
  const lodMeshes = [];
  for (const g of (o.static ? assetStaticGroups(rec) : rec.groups)) {
    const d = rec.materials[g.mat];
    const over = o.materials && [d.name, ...(d.src || [])].map(n => o.materials[n]).find(Boolean);
    const mat = over || assetMakeMaterial(rec, d, o);
    const first = g.lods.find(Boolean);
    const mesh = new THREE.Mesh(assetGeo(first), mat);
    mesh.name = rec.nodes[g.node].name + ':' + d.name;
    mesh.castShadow = o.cast !== false && d.cast !== false; mesh.receiveShadow = o.receive !== false && d.receive !== false;
    if (mesh.castShadow && !over) { const dm = assetDepthMaterial(mat); if (dm) mesh.customDepthMaterial = dm; }
    if (mat.transparent) { mesh.layers.set(2); mesh.userData.layerSet = true; }
    if (d.blend === 'shadow') { mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = -2; }
    mesh.matrixAutoUpdate = false;                     // it never moves inside its node
    objs[g.node].add(mesh);
    lodMeshes.push({ mesh, group: g });
  }
  root.userData = { asset: name, nodes, lodMeshes, lod: 0, lodAuto: false };
  const fixed = typeof o.lod === 'number';
  if (fixed) assetSetLod(root, o.lod);
  else {
    assetSetLod(root, 0);
    if (rec.lods.length > 1) { root.userData.lodAuto = true; ASSETS.lod.push(typeof WeakRef === 'function' ? new WeakRef(root) : { deref: () => root }); }
  }
  return root;
}
// the display-referred colour d as linear light, the inverse of the final tone curve (same maths as toHDR in COMMON)
function assetToHDR(d, out, exposure) {
  const lin = c => { c = Math.min(Math.max(c, 0), 0.985); return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const r = lin(d.x), g = lin(d.y), b = lin(d.z);
  const y = [0.643038 * r + 0.311187 * g + 0.045775 * b, 0.059269 * r + 0.931436 * g + 0.009295 * b, 0.005962 * r + 0.063929 * g + 0.930118 * b];
  const v = y.map(q => { q = Math.min(Math.max(q, 0), 0.99); const A = 1 - 0.983729 * q, B = 0.0245786 - 0.432951 * q, C = -(0.000090537 + 0.238081 * q); return (-B + Math.sqrt(Math.max(B * B - 4 * A * C, 0))) / (2 * A); });
  const k = 0.6 / exposure;
  return out.set((1.764741 * v[0] - 0.675778 * v[1] - 0.088963 * v[2]) * k, (-0.147028 * v[0] + 1.160252 * v[1] - 0.013224 * v[2]) * k, (-0.036337 * v[0] - 0.162436 * v[1] + 1.198773 * v[2]) * k);
}
// Every frame (from the main loop): what the materials mirror, and which level of detail each model shows.
function updateAssets(dt) {
  if (!ASSETS.count) return;
  const ex = renderer.toneMappingExposure, A = ASSETS.uniforms;
  U.uExposure.value = ex;
  assetToHDR(U.uSkyZenith.value, A.uBpSkyZ.value, ex); assetToHDR(U.uSkyHorizon.value, A.uBpSkyH.value, ex); assetToHDR(U.uSkyGlow.value, A.uBpSkyG.value, ex);
  A.uBpAmb.value.set(hemi.color.r, hemi.color.g, hemi.color.b).multiplyScalar(hemi.intensity);   // the sky's light on the ground
  ASSETS.lodAt -= dt;
  if (ASSETS.lodAt > 0 || !ASSETS.lod.length) return;
  ASSETS.lodAt = 0.2;
  const bias = settings.quality === 'low' ? 1 : 0, scale = 90 / Q.near, c = camera.position;
  for (let i = ASSETS.lod.length - 1; i >= 0; i--) {
    const m = ASSETS.lod[i].deref();
    if (!m) { ASSETS.lod.splice(i, 1); continue; }
    if (!m.parent) continue;
    const rec = ASSETS.by.get(m.userData.asset), e = m.matrixWorld.elements, cur = m.userData.lod;
    const d = Math.hypot(e[12] - c.x, e[13] - c.y, e[14] - c.z) * scale;
    let want = 0;
    for (let l = 1; l < rec.lods.length; l++) if (d > rec.lods[l].dist * (l <= cur ? 0.94 : 1.06)) want = l;   // a little slack so it does not flicker
    want = Math.min(Math.max(want, bias), rec.lods.length - 1);
    if (want !== cur) assetSetLod(m, want);
  }
}
