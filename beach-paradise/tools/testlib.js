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
    // Height of the ground or the water surface at (x,z), whichever is higher.
    floor(x, z) { const b = bp(); return Math.max(b.groundHeight(x, z), b.waterAt(x, z).level); },
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
  };
  window.__T = T;
})();
