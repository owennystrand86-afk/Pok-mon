// Lighting checks on the torture asset: reads pixels of frames drawn by the game (window.__L).
(() => {
  const E = window.__bpEval, THREE = E('THREE'), b = window.__bp, T = window.__T;
  const s2l = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const f3 = a => a.map(v => +v.toFixed(3));
  const lum = c => 0.2126 * s2l(c[0]) + 0.7152 * s2l(c[1]) + 0.0722 * s2l(c[2]);
  const L = { out: [] };
  const ok = (c, name, info) => { L.out.push((c ? 'PASS ' : 'FAIL ') + name + ': ' + JSON.stringify(info)); return c; };
  // draw one frame and read the mean display colour (0..1) of a small patch at each world point
  L.read = (points, r = 2) => {
    b.camera.updateMatrixWorld(true);
    const g = window.__bpGrab(1), cam = b.camera;
    return points.map(p => {
      const v = (p.isVector3 ? p.clone() : new THREE.Vector3(...p)).project(cam);
      const x = Math.round((v.x * 0.5 + 0.5) * g.w), y = Math.round((v.y * 0.5 + 0.5) * g.h), acc = [0, 0, 0]; let n = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue; const o = (yy * g.w + xx) * 4; acc[0] += g.px[o]; acc[1] += g.px[o + 1]; acc[2] += g.px[o + 2]; n++; }
      return n ? acc.map(a => a / n / 255) : null;
    });
  };
  const model = () => T._st.models[0];
  const W = (bx, by, bz) => model().localToWorld(new THREE.Vector3(-bx, bz, by));     // a Blender-space point of the model, in the world
  L.W = W;
  L.ao = () => {
    L.out = [];
    const s = T.studio('torture', { fov: 30, light: 0 });
    const m = model();
    // a code-built plate of the same paint next to the asset's plates, through the game's ordinary patch()
    const ref = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4).rotateX(-Math.PI / 2), E('patch')(new THREE.MeshStandardMaterial({ color: new THREE.Color('#e0e0e0'), roughness: 0.9, metalness: 0 }), { key: 'lighttest' }));
    ref.position.set(-12.0, 0.3, 0); ref.receiveShadow = true; m.add(ref);
    // the game's sun shadows only reach surfaces well below the thing that casts them (see the note in DEVELOPING.md),
    // so the shade comes from an awning 3 m up, towards the sun
    const awn = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 5), E('patch')(new THREE.MeshStandardMaterial({ color: 0x808080 }), { key: 'lighttest' }));
    awn.position.set(-15.5, 3.0, -1.5); awn.castShadow = true; m.add(awn); m.updateMatrixWorld(true);
    const c = W(14, 0, 0.3); T.orbit(c.x, c.y, c.z, 9, 180 + T._st.turn, 16, 0.03); window.__bpStep(0.6);
    const [so, sc, ho, hc, rf, fl] = L.read([W(12.75, 0, 0.3), W(13.25, 0, 0.3), W(15.25, 0, 0.3), W(15.75, 0, 0.3), W(12.0, 0, 0.3), W(14.25, -0.6, 0)]);
    const rs = lum(sc) / lum(so), rh = lum(hc) / lum(ho);
    L.out.push('INFO sun elevation ' + s.sunEl + ' deg; display colours: sun open ' + f3(so) + ' crease ' + f3(sc) + ' | shade open ' + f3(ho) + ' crease ' + f3(hc) + ' | code-built plate ' + f3(rf) + ' | floor ' + f3(fl));
    ok(lum(ho) < lum(so) * 0.75, 'the roof shades its plate (shadow maps reach asset materials)', { sun: +lum(so).toFixed(3), shade: +lum(ho).toFixed(3) });
    ok(rs > 0.6, 'a crease (occlusion 0.25) in full sun keeps most of its brightness', { ratio: +rs.toFixed(3) });
    ok(rh < 0.5 && rh < rs - 0.2, 'the same crease lit by the sky alone is much darker', { ratio: +rh.toFixed(3) });
    const k = lum(so) / lum(rf);
    ok(k > 0.85 && k < 1.35, 'an asset surface is as bright as code-built geometry of the same paint in the same light (same exposure, same HDR path)', { asset_over_code: +k.toFixed(3) });
    // emissive: brighter than anything lit, and with the HDR glow it spills onto the pixels round it
    const bc = W(18.5, 0, 0.5); T.orbit(bc.x, bc.y, bc.z, 4, 180 + T._st.turn, 10, 0.03); window.__bpStep(0.6);
    const [bulb, halo, away] = L.read([bc, W(18.5 + 0.2, 0, 0.5), W(18.5 + 0.9, 0, 0.9)]);
    L.out.push('INFO bulb ' + f3(bulb) + ' just beside it ' + f3(halo) + ' further off ' + f3(away) + ' (HDR ' + E('U.uHDR.value') + ', post ' + !!E('Q.post !== false') + ')');
    ok(Math.min(...bulb) > 0.8, 'an emissive material burns out to (nearly) white', f3(bulb));
    m.remove(ref); m.remove(awn);
    return '[light: occlusion, exposure, emission]\n  ' + L.out.join('\n  ');
  };
  L.fog = () => {
    L.out = [];
    T.studio('torture', { fov: 30 });
    const m = model(), o = m.position.clone(), K = 50;
    m.scale.setScalar(K); m.updateMatrixWorld(true);
    const glow = []; m.traverse(c => { if (c.isMesh && c.material.blending === THREE.AdditiveBlending) glow.push(c); });
    for (const g of glow) g.material.emissive.setRGB(1.5, 0.6, 0.2);     // a flame: light of its own, added to the picture
    const rows = [];
    for (const D of [150, 600, 2000, 6000]) {
      m.position.set(o.x, o.y, o.z + D); m.updateMatrixWorld(true);
      // the board (50 m wide now, 125 m in front of the model's origin) is D metres from the camera
      const bc = W(0, -2.5, 1.0); T.lookAt(bc.x, bc.y, bc.z - D, bc.x, bc.y, bc.z); window.__bpStep(0.6);
      const a = L.read([W(0.3, -2.52, 0.25), W(-0.25, -2.55, 0.6), W(0, -2.5, 1.6)]);
      const gc = W(19.5, 0, 0.5); T.lookAt(gc.x, gc.y, gc.z - D, gc.x, gc.y, gc.z); window.__bpStep(0.6);
      const on = L.read([gc])[0];
      for (const g of glow) g.visible = false;
      const off = L.read([gc])[0];
      for (const g of glow) g.visible = true;
      rows.push({ D, white: a[0], red: a[1], sky: a[2], glowOn: on, glowOff: off });
    }
    const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    for (const r of rows) L.out.push('INFO ' + r.D + ' m: white ' + f3(r.white) + ' red ' + f3(r.red) + ' sky above ' + f3(r.sky) + ' | glow on ' + f3(r.glowOn) + ' off ' + f3(r.glowOff));
    const con = rows.map(r => +dist(r.white, r.red).toFixed(3));
    ok(con[0] > 0.3 && con[1] < con[0] && con[2] < con[1] && con[3] < 0.03, 'haze: the contrast between white paint and red paint falls with distance and is gone at 6 km', con);
    const far = rows[3];
    ok(dist(far.white, far.sky) < 0.12, 'at 6 km the model has the colour of the haze round it', { model: f3(far.white), sky: f3(far.sky) });
    const add = rows.map(r => +dist(r.glowOn, r.glowOff).toFixed(3));
    ok(add[0] > 0.05 && add[1] <= add[0] + 0.02 && add[2] < add[0] && add[3] < 0.02, 'additive light (blend "add") fades out in the haze instead of adding haze', add);
    for (const g of glow) g.material.emissive.setRGB(0, 0, 0);
    m.scale.setScalar(1); m.position.copy(o);
    T.studio(null);
    return '[light: haze]\n  ' + L.out.join('\n  ');
  };
  L.under = () => {
    L.out = [];
    T.studio(null);
    // deep water off the island
    let spot = null; const S = b.SPAWN;
    for (let r = 200; r < 3000 && !spot; r += 50) for (let a = 0; a < 16 && !spot; a++) { const x = S.x + Math.cos(a * 0.3927) * r, z = S.z + Math.sin(a * 0.3927) * r; if (b.groundHeight(x, z) < -14 && b.groundHeight(x + 30, z) < -12 && b.groundHeight(x - 30, z) < -12) spot = { x, z }; }
    const m = E('assetModel')('torture', { lod: 0, static: true });
    m.position.set(spot.x, 4, spot.z); b.scene.add(m); m.updateMatrixWorld(true);
    T._st.models = [m]; L.sea = m;
    const pts = () => [W(0.3, -2.52, 0.25), W(-0.25, -2.55, 0.6)];
    const view = d => { const c = W(0, -2.5, 0.6); T.lookAt(c.x, c.y, c.z - d, c.x, c.y, c.z); window.__bpStep(0.6); return L.read(pts()); };
    const air = view(3);
    m.position.y = -6; m.updateMatrixWorld(true);
    const near = view(3), far = view(30);
    L.out.push('INFO in the air, 3 m: white ' + f3(air[0]) + ' red ' + f3(air[1]) + ' | 5.4 m under water, 3 m: white ' + f3(near[0]) + ' red ' + f3(near[1]) + ' | 30 m: white ' + f3(far[0]) + ' red ' + f3(far[1]) + ' | uUnderwater ' + E('U.uUnderwater.value') + ' water fog ' + f3(E('U.uWaterFog.value').toArray()));
    ok(near[0][0] / near[0][2] < 0.8 * air[0][0] / air[0][2], 'under water white paint loses its red (absorption with depth)', { red_over_blue_air: +(air[0][0] / air[0][2]).toFixed(3), under: +(near[0][0] / near[0][2]).toFixed(3) });
    const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    ok(d(far[0], far[1]) < 0.4 * d(near[0], near[1]), 'under water the murk swallows the model with distance', { contrast_3m: +d(near[0], near[1]).toFixed(3), contrast_30m: +d(far[0], far[1]).toFixed(3) });
    view(5);
    return '[light: under water]\n  ' + L.out.join('\n  ');
  };
  L.done = () => { if (L.sea) { b.scene.remove(L.sea); L.sea = null; } return 'cleaned up'; };
  window.__L = L;
})();
