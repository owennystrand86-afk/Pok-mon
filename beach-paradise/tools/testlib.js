// Browser-side test helpers. tools/shot.cjs injects this file once the game is ready; use it as window.__T
// inside "eval" steps. Angles: yaw/pitch in radians (the camera looks along (-sin yaw, -cos yaw)); azimuth and
// elevation in degrees.
(() => {
  const bp = () => window.__bp;
  const r3 = v => Math.round(v * 1000) / 1000;
  const T = {
    // Start the game in a known state. o: { quality:'low'|'medium'|'high'|'ultra', hour:0..24, weather:'clear'|...,
    //   waveSize, hud:false (hide prompts and HUD) }. The clock is frozen so lighting does not drift between shots.
    setup(o = {}) {
      const b = bp(), s = b.settings;
      s.placeNames = false;
      if (o.quality && s.quality !== o.quality) { s.quality = o.quality; b.applyQuality(); }
      b.begin(); document.getElementById('start').hidden = true;
      s.timeFlow = false; s.weather = o.weather || 'clear';
      if (o.hour !== undefined) b.ENV.hour = o.hour;
      if (o.waveSize !== undefined) s.waveSize = o.waveSize;
      if (o.hud === false) T.hideHud();
      return 'setup: quality ' + s.quality + ', hour ' + b.ENV.hour;
    },
    hideHud() { for (const id of ['prompt', 'act-hint', 'hud', 'gear', 'touch', 'toolbar', 'tools']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } return 'hud hidden'; },
    // Free camera: put the eye at (x,y,z) looking along yaw/pitch (the player is parked in a seat so nothing moves it).
    look(x, y, z, yaw, pitch = 0) {
      const P = bp().P;
      P.mode = 'seat'; P.seat = { eye: { x, y, z }, yaw, pitch, x, z, y }; P.seatT = 1;
      P.pos.set(x, y, z); P.camY = y; P.yaw = yaw; P.pitch = pitch; P.vel.set(0, 0, 0);
      return [r3(x), r3(y), r3(z), r3(yaw), r3(pitch)];
    },
    // Free camera at (x,y,z) aimed at the point (tx,ty,tz).
    lookAt(x, y, z, tx, ty, tz) {
      return T.look(x, y, z, Math.atan2(-(tx - x), -(tz - z)), Math.atan2(ty - y, Math.hypot(tx - x, tz - z)));
    },
    // Height of the ground or the water surface at (x,z), whichever is higher (in the studio: its floor).
    floor(x, z) { if (T._st && T._st.on) return T._st.y0; const b = bp(); return Math.max(b.groundHeight(x, z), b.waterAt(x, z).level); },
    // Free camera h metres above the ground/water at (x,z), facing the point (tx,tz), with the given pitch.
    at(x, z, h, tx, tz, pitch = 0) { return T.look(x, T.floor(x, z) + h, z, Math.atan2(-(tx - x), -(tz - z)), pitch); },
    // Free camera on a sphere around a target: dist metres away, azimuth 0 = from +z, 90 = from +x; elevation up from
    // horizontal. The eye is kept at least `clear` metres above the ground/water so it never ends up underground.
    orbit(tx, ty, tz, dist, azDeg = 0, elDeg = 15, clear = 0.3) {
      const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
      const x = tx + dist * Math.sin(az) * Math.cos(el), z = tz + dist * Math.cos(az) * Math.cos(el);
      const y = Math.max(ty + dist * Math.sin(el), T.floor(x, z) + clear);
      return T.lookAt(x, y, z, tx, ty, tz);
    },
    // Put the player on foot at (x,z), standing on whatever is there (ground or a platform), facing yaw/pitch.
    walk(x, z, yaw = 0, pitch = 0) {
      const b = bp(), P = b.P;
      const feet = b.supportHeight(x, z, b.groundHeight(x, z) + 0.6);
      P.mode = 'walk'; P.seat = null; P.climb = null; P.vel.set(0, 0, 0); P.onGround = true;
      P.pos.set(x, feet + 1.62, z); P.camY = P.pos.y; P.yaw = yaw; P.pitch = pitch;
      return [r3(x), r3(feet), r3(z)];
    },
    // Input: hold('KeyW', 'ShiftLeft') keeps keys down and release(...) lifts them (no arguments: all of them).
    // KeyW/A/S/D move, Shift runs, Space is up/jump, KeyC is down, KeyF uses the tool in hand. interact() presses E once
    // (it acts on the prompt the player is looking at). Nothing happens until time advances: follow with step().
    hold(...codes) { const k = bp().keys; for (const c of codes) k.add(c); return [...k]; },
    release(...codes) { const k = bp().keys; if (!codes.length) k.clear(); else for (const c of codes) k.delete(c); return [...k]; },
    interact() { bp().input.interact = true; return 'interact pressed'; },
    // Advance the whole game by `seconds` of game time without drawing (frames are far too slow to wait for).
    step(seconds = 1, dt = 1 / 30) { return window.__bpStep ? window.__bpStep(seconds, dt) : 'no __bpStep in this build'; },
    // Draw calls and triangles of the last drawn frame (all passes) and live GPU objects.
    stats() { return window.__bpStats ? window.__bpStats() : 'no __bpStats in this build'; },
    // World-space bounding box of a scene object found by name (first match), for framing a camera on it.
    box(name) {
      const b = bp(); const o = b.scene.getObjectByName(name); if (!o) return null;
      o.updateWorldMatrix(true, true);
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      o.traverse(c => {
        if (!c.geometry) return; if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const bb = c.geometry.boundingBox, e = c.matrixWorld.elements;
        for (let i = 0; i < 8; i++) {
          const px = i & 1 ? bb.max.x : bb.min.x, py = i & 2 ? bb.max.y : bb.min.y, pz = i & 4 ? bb.max.z : bb.min.z;
          const w = [e[0] * px + e[4] * py + e[8] * pz + e[12], e[1] * px + e[5] * py + e[9] * pz + e[13], e[2] * px + e[6] * py + e[10] * pz + e[14]];
          for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
        }
      });
      return { min: mn.map(r3), max: mx.map(r3), center: mn.map((v, k) => r3((v + mx[k]) / 2)) };
    },
    // ───── The studio: ONE asset alone under the game's real sun, sky and final-image pipeline ─────
    // __T.studio(name, opts) hides the whole world except the lights and the sky, lays a wide, plain, sand-coloured
    // floor that takes shadows, and stands the model on it at a clear spot of the beach. A grab then costs about a
    // second instead of 5-20 (the first one of a run is slower: shaders compile), so looking at a model from six
    // sides is cheap. __T.studio(null) puts the world back. Use it with tools/snap.sh ("grab" steps).
    //   opts.lod      level of detail: 0 (default), 1, ... or 'auto'; an ARRAY gives one copy per level, side by side
    //   opts.copies   how many in a row (default 1); opts.gap: metres between them (default a quarter of the width)
    //   opts.rot      turn it: degrees about the vertical, or [x, y, z] degrees (tilt first, then turn)
    //   opts.light    turn it so that the sun stands this many degrees round from the model's front (0 = full on
    //                 the front, 90 = from its Blender +X side, 180 = from behind); the hour sets how high it stands
    //   opts.pose     { partName: [x, y, z] } turns moving parts by these degrees from where they stand at rest (assetPose)
    //   opts.static, opts.tint, opts.materials, opts.patch, opts.cast, opts.receive   passed on to assetModel
    //   opts.lift     false: the model's origin goes on the floor (default: its lowest point does)
    //   opts.grid     true: a faint one-metre grid on the floor, for scale
    //   opts.fov      camera field of view in degrees while the studio is on (the game's own is 75; 30 is close to
    //                 the Blender previews and gets nearer to small things)
    //   opts.at       [x, z]: another place on the island than the clear spot it finds
    // Returns { center, radius, fit, size, ground, sunAz, sunEl, lods, tris, models } : centre and radius of everything
    // it put there (for __T.orbit(center..., fit, azimuth, elevation)) and `fit`, the distance from which it fills the
    // picture. __T.studioView() does that arithmetic and uses the view names of the Blender previews.
    studio(name, o = {}) {
      const b = bp(), E = window.__bpEval, THREE = E('THREE'), scene = b.scene, D = Math.PI / 180;
      const S = T._st || (T._st = { on: false, hidden: new Map(), group: null, y0: 0, fov: null, spot: null });
      if (!T._grab0 && window.__bpGrab) { T._grab0 = window.__bpGrab; window.__bpGrab = fr => { if (T._st.on) T._studioHide(); return T._grab0(fr); }; }
      if (S.group) {
        scene.remove(S.group);
        S.group.traverse(c => { if (c.userData.studioOwn) { c.geometry.dispose(); if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
        S.group = null;
      }
      if (name == null) {
        for (const [obj, v] of S.hidden) obj.visible = v;
        S.hidden.clear(); S.on = false;
        if (S.fov != null) { b.settings.fov = S.fov; S.fov = null; E('updateFov')(); }
        return 'studio off: the world is back';
      }
      const meta = E('assetMeta')(name);
      if (!meta) throw new Error('studio: no asset called "' + name + '" in this page; it has: ' + ([...E('ASSETS').by.keys()].join(', ') || 'none'));
      const spot = o.at ? { x: o.at[0], z: o.at[1] } : (S.spot || (S.spot = T._studioSpot()));
      const y0 = S.y0 = b.groundHeight(spot.x, spot.z);
      const g = S.group = new THREE.Group(); g.name = 'studio';
      // the floor: the sand colour of the Blender previews, wide enough to meet the haze at the horizon
      const fm = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.804, 0.722, 0.576, THREE.SRGBColorSpace), roughness: 0.95, metalness: 0 });
      if (o.grid) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 256;
        const c2 = cv.getContext('2d'); c2.fillStyle = '#fff'; c2.fillRect(0, 0, 256, 256); c2.fillStyle = '#9a9488'; c2.fillRect(0, 0, 256, 3); c2.fillRect(0, 0, 3, 256);
        const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(12000, 12000); tx.anisotropy = 8; tx.colorSpace = THREE.SRGBColorSpace;
        fm.map = tx;
      }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), E('patch')(fm, { key: 'studio-floor' }));
      floor.position.set(spot.x, y0, spot.z); floor.receiveShadow = true; floor.userData.studioOwn = true; floor.name = 'studio-floor';
      g.add(floor);
      // the model(s)
      const lods = Array.isArray(o.lod) ? o.lod : null, n = lods ? lods.length : Math.max(1, o.copies | 0);
      const rot = Array.isArray(o.rot) ? o.rot : [0, o.rot || 0, 0];
      const sd = E('sunDirFor')(b.ENV.hour, new THREE.Vector3()), sunOrbit = Math.atan2(sd.x, sd.z) / D;
      const turn = rot[1] + (o.light !== undefined ? sunOrbit - 180 - o.light : 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * D, turn * D, rot[2] * D, 'YXZ'));
      const box = new THREE.Box3(), v = new THREE.Vector3(), bb = meta.bbox;
      for (let i = 0; i < 8; i++) box.expandByPoint(v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).applyQuaternion(q));
      const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
      const pitch = size.x + (o.gap !== undefined ? o.gap : Math.max(size.x * 0.25, 0.15)), lift = o.lift === false ? 0 : -box.min.y;
      const all = new THREE.Box3(), models = [], used = [];
      for (let i = 0; i < n; i++) {
        const lod = lods ? lods[i] : o.lod;
        const m = E('assetModel')(name, { lod: lod === 'auto' ? undefined : (lod | 0), static: o.static, tint: o.tint, materials: o.materials, patch: o.patch, cast: o.cast, receive: o.receive });
        m.quaternion.copy(q);
        m.position.set(spot.x + (i - (n - 1) / 2) * pitch - mid.x, y0 + lift, spot.z - mid.z);
        for (const [part, e] of Object.entries(o.pose || {})) {
          const nd = m.userData.nodes[part];
          if (!nd) throw new Error('studio: "' + name + '" has no moving part "' + part + '"' + (o.static ? ' (static welds the parts)' : '') + '; it has: ' + Object.keys(m.userData.nodes).slice(1).join(', '));
          E('assetPose')(m, part, e[0] * D, e[1] * D, e[2] * D);
        }
        g.add(m); models.push(m); used.push(m.userData.lod);
        all.union(box.clone().translate(m.position));
      }
      scene.add(g); g.updateMatrixWorld(true);
      if (o.fov) { if (S.fov == null) S.fov = b.settings.fov; b.settings.fov = o.fov; E('updateFov')(); }
      S.on = true; T._studioHide();
      const c = all.getCenter(new THREE.Vector3()), radius = all.getSize(new THREE.Vector3()).length() / 2, cam = b.camera;
      const half = Math.min(cam.fov * D / 2, Math.atan(Math.tan(cam.fov * D / 2) * cam.aspect));
      Object.assign(S, { c: [c.x, c.y, c.z], radius, fit: radius / Math.sin(half) * 1.04, turn, models, name, q });
      const norm = a => ((a + 180) % 360 + 360) % 360 - 180;
      return { name, center: S.c.map(r3), radius: r3(radius), fit: r3(S.fit), size: size.toArray().map(r3), ground: r3(y0), sunAz: Math.round(norm(sunOrbit - 180 - turn)), sunEl: Math.round(Math.asin(sd.y) / D),
        lods: used, tris: used.map(l => meta.tris[l]), models: n, spot: [r3(spot.x), r3(spot.z)] };
    },
    // Look at what stands in the studio the way the Blender previews do: view is a name ('hero', 'hero_back', 'front',
    // 'back', 'side', 'side2', 'top', 'low', 'high') or [azimuth, elevation] in degrees, azimuth 0 looking at the model's
    // front and 90 from its Blender +X side. zoom > 1 comes closer. target: an anchor's name, or [x, y, z] in the asset's
    // own (game) axes, to look at that spot of the first copy instead of the middle of everything.
    studioView(view = 'hero', zoom = 1, target = null) {
      const S = T._st, E = window.__bpEval;
      if (!S || !S.on) throw new Error('studioView: call __T.studio(name) first');
      const V = { hero: [-38, 22], hero_back: [142, 24], front: [0, 6], back: [180, 6], side: [90, 6], side2: [-90, 6], top: [0, 88], low: [-28, 3], high: [-35, 50] };
      const ae = typeof view === 'string' ? V[view] : view;
      if (!ae) throw new Error('studioView: no view "' + view + '"; have: ' + Object.keys(V).join(', '));
      let c = S.c;
      if (target) {
        const m = S.models[0], THREE = E('THREE');
        const p = typeof target === 'string' ? E('assetAnchorWorld')(m, target) : m.localToWorld(new THREE.Vector3().fromArray(target));
        if (!p) throw new Error('studioView: "' + S.name + '" has no anchor "' + target + '"');
        c = [p.x, p.y, p.z];
      }
      return T.orbit(c[0], c[1], c[2], S.fit / zoom, ae[0] + 180 + S.turn, ae[1], 0.03);
    },
    // (internal) hide everything in the scene that is not a light, the sky or the studio; the game's own ticks may
    // show things again, so every grab does this once more
    _studioHide() {
      const S = T._st, b = bp(), cam = b.camera;
      const sky = c => c.isMesh && c.renderOrder === -100 && c.material && c.material.isShaderMaterial && c.geometry && c.geometry.type === 'SphereGeometry';
      const hide = c => { if (c.visible) { if (!S.hidden.has(c)) S.hidden.set(c, true); c.visible = false; } };
      for (const c of b.scene.children) if (c !== S.group && c !== cam && !c.isLight && !sky(c)) hide(c);
      for (const c of cam.children) if (!c.isLight) hide(c);
    },
    // (internal) a clear stretch of dry sand on the arrival beach: the widest circle of beach round a point
    _studioSpot() {
      const b = bp(), L = b.LAYOUT, gh = b.groundHeight; let best = null;
      if (L && L.at) for (let fw = 0; fw <= 60; fw += 3) for (let rt = -90; rt <= 90; rt += 6) {
        const p = L.at(fw, rt), h = gh(p.x, p.z); if (h < 0.9 || h > 2.0) continue;
        let r = 2; search: for (; r <= 40; r += 2) for (let a = 0; a < 8; a++) { const hh = gh(p.x + Math.cos(a * Math.PI / 4) * r, p.z + Math.sin(a * Math.PI / 4) * r); if (hh < 0.45 || hh > 2.35) break search; }
        if (!best || r > best.r) best = { x: p.x, z: p.z, r };
      }
      return best || { x: b.SPAWN.x, z: b.SPAWN.z, r: 0 };
    },
  };
  window.__T = T;
})();
