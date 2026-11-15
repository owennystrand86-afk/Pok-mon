
// ───────────────────── 23. Sound (all synthesized, no audio files) ─────────────────────
const AUDIO = (() => {
  let ctx = null, master, amb, musicBus, musicIn, lp, ready = false, musicTimer = 0;
  const L = {};
  const biq = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function makeNoise(kind, seconds = 5) {
    const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    const f = Math.floor(ctx.sampleRate * 0.08); // fold the tail into the head so the loop is seamless
    for (let i = 0; i < f; i++) { const t = i / f; d[i] = d[i] * t + d[n - f + i] * (1 - t); }
    const out = ctx.createBuffer(1, n - f, ctx.sampleRate); out.getChannelData(0).set(d.subarray(0, n - f));
    return out;
  }
  function layer(buf, filters, dest) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    let node = src; for (const f of filters) { node.connect(f); node = f; }
    const g = ctx.createGain(); g.gain.value = 0; node.connect(g); g.connect(dest || amb);
    src.start(0, Math.random() * buf.duration);
    return { src, g, filters };
  }
  const set = (param, v, tc = 0.3) => param.setTargetAtTime(v, ctx.currentTime, tc);
  function panner(x, y, z, ref = 8) {
    const p = ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 400;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    p.connect(amb); return p;
  }
  function burst(dest, buf, { t = 0, dur = 0.15, gain = 0.1, filters = [], attack = 0.005, rate = 1 }) {
    const now = ctx.currentTime + t;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + attack); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = s; for (const f of filters) { node.connect(f); node = f; } node.connect(g); g.connect(dest || amb);
    s.start(now, Math.random() * (buf.duration - dur - 0.1)); s.stop(now + dur + 0.05);
  }
  function tone(dest, { t = 0, type = 'sine', f0, f1, dur, gain, attack = 0.01, vib = 0, vibRate = 0, filter = null }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(now); l.stop(now + dur + 0.05); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + attack); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o; if (filter) { node.connect(filter); node = filter; } node.connect(g); g.connect(dest || amb);
    o.start(now); o.stop(now + dur + 0.05);
  }
  let NB = {};
  function start() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    lp = biq('lowpass', 20000, 0.5);
    amb = ctx.createGain(); musicBus = ctx.createGain();
    amb.connect(lp); lp.connect(master); musicBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    NB = { white: makeNoise('white'), pink: makeNoise('pink'), brown: makeNoise('brown') };
    L.surf = layer(NB.brown, [biq('lowpass', 480, 0.6)]);
    L.crash = layer(NB.pink, [biq('lowpass', 1600), biq('highpass', 120)]);
    L.wash = layer(NB.white, [biq('bandpass', 2600, 0.45)]);
    L.far = layer(NB.brown, [biq('lowpass', 240)]);
    L.windF = biq('bandpass', 520, 0.8);
    L.wind = layer(NB.pink, [L.windF]);
    L.leaves = layer(NB.white, [biq('highpass', 2600), biq('lowpass', 7500)]);
    L.rain = layer(NB.white, [biq('bandpass', 3400, 0.35)]);
    L.rainLow = layer(NB.pink, [biq('lowpass', 1000)]);
    L.under = layer(NB.brown, [biq('lowpass', 180)], master);
    L.falls = layer(NB.pink, [biq('bandpass', 850, 0.3)]);
    L.stream = layer(NB.white, [biq('bandpass', 2000, 1.2)]);
    L.roof = layer(NB.pink, [biq('bandpass', 900, 0.5)], master);           // rain drumming on the cabin roof
    L.roofHi = layer(NB.white, [biq('bandpass', 4200, 0.8)], master);
    L.tsu = layer(NB.brown, [biq('lowpass', 150, 0.8)], master);             // the tsunami's roar
    L.tsuHi = layer(NB.pink, [biq('lowpass', 900), biq('highpass', 90)]);
    L.fire = layer(NB.brown, [biq('lowpass', 400)]);
    L.insects = ctx.createGain(); L.insects.gain.value = 0; L.insects.connect(amb);
    for (const f of [4300, 4900, 5650]) {
      const o = ctx.createOscillator(); o.frequency.value = f * (0.98 + Math.random() * 0.04);
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 22 + Math.random() * 18;
      const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      o.connect(am); am.connect(L.insects); o.start(); lfo.start();
    }
    // music: soft pad + occasional marimba-like notes through a gentle echo
    musicIn = biq('lowpass', 1800, 0.4);
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.46; const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.35;
    musicIn.connect(musicBus); musicIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(musicBus);
    setVolumes(); ready = true;
    music();
  }
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[53, 57, 60, 64, 67], [50, 57, 60, 65, 69], [46, 53, 57, 62, 65], [48, 55, 60, 62, 67], [53, 60, 64, 67, 72], [45, 52, 57, 60, 64]];
  let chordI = 0;
  function music() {
    clearTimeout(musicTimer);
    const dur = 10;
    if (ctx && settings.music > 0.01 && ctx.state === 'running') {
      const now = ctx.currentTime;
      for (const m of CHORDS[chordI % CHORDS.length]) for (const det of [-5, 5]) {
        const o = ctx.createOscillator(); o.type = det < 0 ? 'sine' : 'triangle'; o.frequency.value = midi(m); o.detune.value = det;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.018, now + 3.5); g.gain.setValueAtTime(0.018, now + dur - 2); g.gain.linearRampToValueAtTime(0, now + dur + 3);
        o.connect(g); g.connect(musicIn); o.start(now); o.stop(now + dur + 3.2);
      }
      const scale = [65, 67, 69, 72, 74, 77, 79, 81, 84];
      for (let k = 0; k < 4; k++) if (Math.random() < 0.55) {
        const t = 1 + Math.random() * 8, m = scale[(Math.random() * scale.length) | 0];
        tone(musicIn, { t, type: 'sine', f0: midi(m), f1: midi(m), dur: 1.8, gain: 0.035, attack: 0.004 });
        tone(musicIn, { t, type: 'sine', f0: midi(m + 12) * 1.003, f1: midi(m + 12), dur: 0.6, gain: 0.01, attack: 0.002 });
      }
      chordI++;
    }
    musicTimer = setTimeout(music, dur * 1000);
  }
  function setVolumes() {
    if (!ctx) return;
    set(master.gain, settings.master, 0.1); set(amb.gain, settings.ambience, 0.1); set(musicBus.gain, settings.music * 0.7, 0.3);
  }
  let birdT = 3, cricketT = 2;
  const E = {}; let scratchL = null;
  const _fwdA = new THREE.Vector3(), _upA = new THREE.Vector3();
  function update(dt) {
    if (!ready || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const x = camera.position.x, y = camera.position.y, z = camera.position.z;
    const lis = ctx.listener;
    camera.getWorldDirection(_fwdA); _upA.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (lis.positionX) {
      lis.positionX.setValueAtTime(x, now); lis.positionY.setValueAtTime(y, now); lis.positionZ.setValueAtTime(z, now);
      lis.forwardX.setValueAtTime(_fwdA.x, now); lis.forwardY.setValueAtTime(_fwdA.y, now); lis.forwardZ.setValueAtTime(_fwdA.z, now);
      lis.upX.setValueAtTime(_upA.x, now); lis.upY.setValueAtTime(_upA.y, now); lis.upZ.setValueAtTime(_upA.z, now);
    } else { lis.setPosition(x, y, z); lis.setOrientation(_fwdA.x, _fwdA.y, _fwdA.z, _upA.x, _upA.y, _upA.z); }
    const under = P.eyeUnder;
    const inside = CABIN.inside;
    set(lp.frequency, under ? 380 : inside ? 900 * Math.pow(20, Math.pow(CABIN.openness || 0, 0.8)) : 20000, 0.1);
    set(L.roof.g.gain, inside ? WX.cur.rain * 0.22 : 0, 0.4);
    set(L.roofHi.g.gain, inside ? WX.cur.rain * 0.035 : 0, 0.4);
    set(L.tsu.g.gain, Math.min(0.9, TSU.roar * 0.7), 0.4);
    set(L.tsuHi.g.gain, Math.min(0.5, TSU.roar * 0.3), 0.4);
    if (CABIN.lampPos) {
      const fp = CABIN.lampPos[3], dfire = Math.hypot(x - fp.x, z - fp.z);
      const fk = CABIN.fireOn ? clamp(3 / (dfire + 1), 0, 0.6) : 0;
      set(L.fire.g.gain, fk * 0.18, 0.5);
      if (fk > 0.05 && rng() < dt * 7) burst(amb, NB.white, { dur: rand(0.02, 0.06), gain: fk * rand(0.04, 0.12), filters: [biq('bandpass', rand(1500, 4500), 1.5)], attack: 0.001 });
      if (E.kettle) { const k = CABIN.tea > 0 && CABIN.tea < 26 ? clamp((26 - CABIN.tea) / 5, 0, 1) * clamp(CABIN.tea / 3, 0, 1) : 0; set(E.kettleG.gain, k * clamp(4 / (Math.hypot(x - CABIN.lampPos[0].x, z - CABIN.lampPos[0].z) + 1), 0, 1) * 0.02, 0.3); }
    }
    const shore = shoreDistance(x, z);
    const nearSea = (1 - smoothstep(4, 85, shore)) * (1 - smoothstep(10, 60, y));
    const farSea = 1 - smoothstep(30, 450, shore);
    const psi = surfPsiJS(x, z, Math.max(0, Math.min(2, -groundHeight(x, z))), U.uTime.value), g = psi - Math.floor(psi);
    const crash = Math.max(smoothstep(0.86, 0.995, g), 1 - smoothstep(0.0, 0.3, g));
    const wash = (1 - smoothstep(0.03, 0.6, g)) * smoothstep(0.0, 0.05, g);
    const waves = WX.cur.waves;
    set(L.surf.g.gain, nearSea * (0.3 + 0.5 * crash) * 0.5 * waves, 0.15);
    set(L.crash.g.gain, nearSea * crash * 0.16 * waves, 0.08);
    set(L.wash.g.gain, nearSea * wash * 0.22, 0.12);
    set(L.far.g.gain, (0.2 + 0.8 * farSea) * 0.26 * (1 - nearSea * 0.4));
    const m = maskAt(x, z), veg = clamp((1 - m[0]) * (1 - m[2]), 0, 1), jungle = veg * m[1];
    const height = clamp((y - 4) / 120, 0, 1);
    const gust = 0.6 + 0.4 * Math.sin(now * 0.37) * Math.sin(now * 0.13 + 1);
    set(L.wind.g.gain, (0.03 + 0.09 * ENV.wind * gust) * (0.6 + height * 1.4) * (under ? 0 : 1));
    set(L.windF.frequency, 380 + 420 * gust * ENV.wind, 0.5);
    set(L.leaves.g.gain, veg * ENV.wind * gust * 0.05 * (under ? 0 : 1));
    set(L.rain.g.gain, WX.cur.rain * 0.12 * (under ? 0.2 : inside ? 0.4 : 1));
    set(L.rainLow.g.gain, WX.cur.rain * 0.2);
    set(L.under.g.gain, under ? 0.35 : 0, 0.1);
    const day = ENV.daylight;
    set(L.insects.gain, jungle * 0.006 * (0.4 + 0.6 * day) * (under ? 0 : 1), 1);
    const df = STREAM.fall ? Math.hypot(x - STREAM.fall.x, z - STREAM.fall.z) : 999;
    set(L.falls.g.gain, clamp(9 / (df + 2), 0, 0.5) * (under ? 0.6 : 1) * (STREAM.fallFlow ?? 1), 0.5);
    const rq = riverQuery(x, z);
    set(L.stream.g.gain, rq ? 0.1 * (1 - smoothstep(rq.W, rq.W + 28, rq.d)) * (0.4 + rq.speed / 3) * (under ? 0.5 : 1) * (1 - 0.9 * riverStillAt(rq)) : 0, 0.5);
    if (E.g && P.mode !== 'boat') { set(E.g.gain, 0, 0.3); set(E.n.g.gain, 0, 0.3); }
    // birdsong in the forest by day, crickets by night
    birdT -= dt; cricketT -= dt;
    if (birdT < 0) {
      birdT = rand(1.5, 6);
      if (!under && day > 0.3 && veg > 0.3 && rng() < 0.4 + jungle * 0.6) { const a = rand(0, TAU), d = rand(12, 45); songbird(x + Math.cos(a) * d, y + rand(4, 12), z + Math.sin(a) * d); }
    }
    if (cricketT < 0) {
      cricketT = rand(0.4, 1.8);
      if (!under && ENV.night > 0.5 && veg > 0.2) { const a = rand(0, TAU), d = rand(6, 25); cricket(x + Math.cos(a) * d, y - 1, z + Math.sin(a) * d); }
    }
    if (under && rng() < dt * 0.6) tone(null, { type: 'sine', f0: rand(500, 900), f1: rand(1100, 1700), dur: 0.06, gain: 0.02 });
  }
  function songbird(x, y, z) {
    const p = panner(x, y, z, 10), kind = (Math.random() * 3) | 0, base = rand(1800, 3200);
    const n = randInt(2, 6);
    for (let i = 0; i < n; i++) {
      const t = i * rand(0.12, 0.28);
      if (kind === 0) tone(p, { t, f0: base, f1: base * rand(1.2, 1.6), dur: 0.14, gain: 0.05 });
      else if (kind === 1) tone(p, { t, f0: base * 1.3, f1: base * 0.85, dur: 0.18, gain: 0.045, vib: 120, vibRate: 30 });
      else tone(p, { t, f0: base * (i % 2 ? 1.25 : 1), f1: base * (i % 2 ? 1.25 : 1), dur: 0.09, gain: 0.04 });
    }
  }
  function cricket(x, y, z) {
    const p = panner(x, y, z, 5);
    for (let i = 0; i < randInt(3, 6); i++) tone(p, { t: i * 0.06, type: 'square', f0: 4500, f1: 4400, dur: 0.035, gain: 0.006, filter: biq('bandpass', 4500, 6) });
  }
  return {
    start, setVolumes, update,
    visibility(hidden) { if (!ctx) return; if (hidden) ctx.suspend(); else if (started) ctx.resume(); },
    step(surface, run, depth) {
      if (!ready) return;
      const k = run ? 1.25 : 1;
      if (surface === 'sand') burst(amb, NB.white, { dur: 0.16, gain: 0.05 * k, filters: [biq('lowpass', 1100), biq('highpass', 180)], attack: 0.02, rate: rand(0.8, 1.1) });
      else if (surface === 'grass' || surface === 'path') burst(amb, NB.white, { dur: 0.12, gain: 0.04 * k, filters: [biq('bandpass', surface === 'path' ? 900 : 2200, 0.8)], attack: 0.01 });
      else if (surface === 'rock') { burst(amb, NB.white, { dur: 0.05, gain: 0.04 * k, filters: [biq('bandpass', 2400, 1.5)], attack: 0.002 }); }
      else if (surface === 'wood') { tone(amb, { f0: rand(160, 200), f1: 120, dur: 0.09, gain: 0.07 * k, attack: 0.002 }); burst(amb, NB.white, { dur: 0.04, gain: 0.03, filters: [biq('bandpass', 1800, 2)], attack: 0.001 }); }
      else if (surface === 'water') burst(amb, NB.white, { dur: 0.32, gain: 0.05 + Math.min(depth, 0.8) * 0.08, filters: [biq('bandpass', rand(900, 1600), 0.8)], attack: 0.03 });
    },
    splash(k = 1) { if (!ready) return; burst(amb, NB.white, { dur: 0.6 + k * 0.3, gain: 0.12 * k, filters: [biq('bandpass', 1300, 0.6)], attack: 0.01 }); burst(amb, NB.brown, { dur: 0.4, gain: 0.25 * k, filters: [biq('lowpass', 300)], attack: 0.01 }); },
    stroke(under) {
      if (!ready) return;
      if (under) { for (let i = 0; i < 3; i++) tone(null, { t: i * 0.05, f0: rand(400, 700), f1: rand(900, 1500), dur: 0.05, gain: 0.025 }); }
      else burst(amb, NB.white, { dur: 0.35, gain: 0.05, filters: [biq('bandpass', 1100, 0.7)], attack: 0.06 });
    },
    engine(throttle, speed, on) {
      if (!ready) return;
      if (!E.g) {
        E.o1 = ctx.createOscillator(); E.o1.type = 'sawtooth'; E.o2 = ctx.createOscillator(); E.o2.type = 'square';
        E.f = biq('lowpass', 700, 1.2); E.g = ctx.createGain(); E.g.gain.value = 0; const g2 = ctx.createGain(); g2.gain.value = 0.35;
        E.o1.connect(E.f); E.o2.connect(g2); g2.connect(E.f); E.f.connect(E.g); E.g.connect(amb); E.o1.start(); E.o2.start();
        E.n = layer(NB.white, [biq('bandpass', 1100, 0.7)]);
      }
      const f = 34 + speed * 5.2 + throttle * 20;
      set(E.o1.frequency, f, 0.08); set(E.o2.frequency, f * 2.01, 0.08); set(E.f.frequency, 500 + speed * 60 + throttle * 300, 0.1);
      set(E.g.gain, on ? 0.035 + throttle * 0.05 : 0, 0.15); set(E.n.g.gain, on ? 0.012 + speed * 0.0035 : 0, 0.2);
    },
    waveHit(k) {
      if (!ready) return;
      burst(amb, NB.pink, { dur: 1.1 + k, gain: 0.18 + k * 0.25, filters: [biq('lowpass', 2400), biq('highpass', 120)], attack: 0.03 });
      burst(amb, NB.brown, { dur: 0.6, gain: 0.2 + k * 0.3, filters: [biq('lowpass', 260)], attack: 0.02 });
    },
    slap(s) { if (!ready) return; burst(amb, NB.brown, { dur: 0.3, gain: 0.3 * s, filters: [biq('lowpass', 380)], attack: 0.003 }); burst(amb, NB.white, { dur: 0.45, gain: 0.09 * s, filters: [biq('bandpass', 1300, 0.7)], attack: 0.01 }); },
    dig() {
      if (!ready) return;
      burst(amb, NB.white, { dur: 0.16, gain: 0.08, filters: [biq('lowpass', 1500), biq('highpass', 200)], attack: 0.004 });
      burst(amb, NB.brown, { dur: 0.12, gain: 0.25, filters: [biq('lowpass', 180)], attack: 0.003 });
      burst(amb, NB.white, { t: 0.3, dur: 0.45, gain: 0.035, filters: [biq('bandpass', 2600, 0.6)], attack: 0.06 });
    },
    scratch(v) {
      if (!ready) return;
      if (!scratchL) scratchL = layer(NB.white, [biq('bandpass', 3000, 1.1)]);
      set(scratchL.g.gain, v * 0.05, 0.05);
    },
    crash() {
      if (!ready) return;
      burst(amb, NB.brown, { dur: 2.2, gain: 0.6, filters: [biq('lowpass', 300)], attack: 0.01 });
      for (let i = 0; i < 14; i++) burst(amb, NB.white, { t: rand(0, 1.6), dur: rand(0.05, 0.2), gain: rand(0.06, 0.16), filters: [biq('bandpass', rand(600, 2600), 1.2)], attack: 0.002 });
      for (let i = 0; i < 6; i++) tone(amb, { t: rand(0, 1.2), type: 'triangle', f0: rand(90, 160), f1: rand(50, 80), dur: rand(0.2, 0.5), gain: 0.08, attack: 0.005 });
    },
    door(kind, open) {
      if (!ready) return;
      if (kind === 'door') {
        tone(amb, { type: 'sawtooth', f0: open ? 240 : 320, f1: open ? 330 : 210, dur: 0.5, gain: 0.012, vib: 14, vibRate: 11, filter: biq('bandpass', 700, 2) });
        if (!open) burst(amb, NB.brown, { t: 0.42, dur: 0.25, gain: 0.35, filters: [biq('lowpass', 250)], attack: 0.003 });
      } else { tone(amb, { f0: 1400, f1: 900, dur: 0.05, gain: 0.03, type: 'square', filter: biq('bandpass', 1500, 3) }); burst(amb, NB.white, { dur: 0.25, gain: 0.03, filters: [biq('bandpass', 2500, 1)], attack: 0.02 }); }
    },
    cast(p) { if (!ready) return; burst(amb, NB.white, { dur: 0.35, gain: 0.05 + p * 0.05, filters: [biq('bandpass', 2400, 1.5)], attack: 0.05 }); },
    nibble() { if (!ready) return; burst(amb, NB.white, { dur: 0.08, gain: 0.03, filters: [biq('bandpass', 1800, 2)], attack: 0.005 }); },
    bite() { if (!ready) return; burst(amb, NB.white, { dur: 0.3, gain: 0.08, filters: [biq('bandpass', 1300, 1)], attack: 0.005 }); burst(amb, NB.brown, { dur: 0.2, gain: 0.2, filters: [biq('lowpass', 300)], attack: 0.003 }); },
    reelZip(v) {
      if (!ready) return;
      if (!E.zip) E.zip = layer(NB.white, [biq('bandpass', 3800, 3)]);
      set(E.zip.g.gain, v * 0.03, 0.05);
    },
    reelClick(on) {
      if (!ready) return;
      E.clickT = (E.clickT || 0) + (on ? 1 : 0);
      if (on && E.clickT % 4 === 0) tone(amb, { type: 'square', f0: 2600, f1: 2400, dur: 0.012, gain: 0.012, filter: biq('bandpass', 2600, 4) });
    },
    snap() { if (!ready) return; tone(amb, { type: 'sawtooth', f0: 900, f1: 120, dur: 0.15, gain: 0.05 }); },
    catchFish(r) {
      if (!ready) return;
      const notes = r >= 4 ? [72, 76, 79, 84] : [72, 76, 79];
      notes.forEach((m, i) => tone(musicIn, { t: i * 0.11, f0: 440 * Math.pow(2, (m - 69) / 12), f1: 440 * Math.pow(2, (m - 69) / 12), dur: 0.9, gain: 0.05, attack: 0.004 }));
      burst(amb, NB.white, { dur: 0.5, gain: 0.08, filters: [biq('bandpass', 1200, 0.7)], attack: 0.01 });
    },
    planeEngine(thr, speed, on) {
      if (!ready) return;
      if (!E.pg) {
        E.p1 = ctx.createOscillator(); E.p1.type = 'sawtooth'; E.p2 = ctx.createOscillator(); E.p2.type = 'square';
        E.pam = ctx.createGain(); E.pam.gain.value = 0.5; E.plfo = ctx.createOscillator(); E.plfo.type = 'square'; const lg = ctx.createGain(); lg.gain.value = 0.5; E.plfo.connect(lg); lg.connect(E.pam.gain);
        E.pf = biq('lowpass', 500, 1.5); E.pg = ctx.createGain(); E.pg.gain.value = 0;
        E.p1.connect(E.pam); E.p2.connect(E.pam); E.pam.connect(E.pf); E.pf.connect(E.pg); E.pg.connect(amb); E.p1.start(); E.p2.start(); E.plfo.start();
        E.pw = layer(NB.pink, [biq('bandpass', 700, 0.5)]);
      }
      const f = 28 + thr * 46 + speed * 0.3;
      set(E.p1.frequency, f, 0.15); set(E.p2.frequency, f * 0.5, 0.15); set(E.plfo.frequency, f * 0.5, 0.15); set(E.pf.frequency, 300 + thr * 900, 0.2);
      set(E.pg.gain, on ? 0.05 + thr * 0.08 : 0, 0.3); set(E.pw.g.gain, on ? Math.min(0.25, speed * 0.004) : 0, 0.3);
    },
    explode(dist = 0) {
      if (!ready) return;
      const k = clamp(1 - dist / 600, 0.15, 1);
      burst(amb, NB.brown, { dur: 3.5, gain: 0.9 * k, filters: [biq('lowpass', 220)], attack: 0.005 });
      burst(amb, NB.pink, { dur: 1.6, gain: 0.45 * k, filters: [biq('lowpass', 1800)], attack: 0.003 });
      for (let i = 0; i < 10; i++) burst(amb, NB.white, { t: rand(0.2, 2.2), dur: rand(0.04, 0.12), gain: rand(0.04, 0.1) * k, filters: [biq('bandpass', rand(800, 3000), 1.5)], attack: 0.002 });
    },
    subHum(thr, speed, on) {
      if (!ready) return;
      if (!E.sh) { E.sh = layer(NB.brown, [biq('lowpass', 140, 2)], master); E.so = ctx.createOscillator(); E.so.type = 'triangle'; E.sog = ctx.createGain(); E.sog.gain.value = 0; E.so.connect(E.sog); E.sog.connect(master); E.so.start(); }
      set(E.sh.g.gain, on ? 0.18 + speed * 0.03 : 0, 0.4); set(E.so.frequency, 90 + speed * 22, 0.3); set(E.sog.gain, on ? 0.008 + thr * 0.012 : 0, 0.3);
    },
    creak(k) { if (!ready) return; tone(master, { type: 'sawtooth', f0: rand(60, 110), f1: rand(40, 70), dur: rand(0.6, 1.6), gain: 0.05 + k * 0.08, vib: 6, vibRate: rand(8, 20), filter: biq('lowpass', 500, 4) }); },
    beep() { if (!ready) return; tone(master, { type: 'square', f0: 1320, f1: 1320, dur: 0.12, gain: 0.025 }); },
    ping() { if (!ready) return; tone(master, { type: 'sine', f0: 1480, f1: 1460, dur: 2.2, gain: 0.06, attack: 0.003 }); tone(master, { t: 0.9, type: 'sine', f0: 1480, f1: 1460, dur: 1.2, gain: 0.015 }); },
    implode() {
      if (!ready) return;
      burst(master, NB.brown, { dur: 2.6, gain: 1.0, filters: [biq('lowpass', 160)], attack: 0.002 });
      tone(master, { type: 'sawtooth', f0: 220, f1: 30, dur: 0.6, gain: 0.25, filter: biq('lowpass', 600) });
      for (let i = 0; i < 8; i++) burst(master, NB.white, { t: rand(0, 0.5), dur: rand(0.03, 0.1), gain: 0.15, filters: [biq('bandpass', rand(500, 2000), 2)], attack: 0.001 });
    },
    kettle(on) {
      if (!ready) return;
      if (!E.kettle) {
        E.kettle = ctx.createOscillator(); E.kettle.type = 'sine'; E.kettle.frequency.value = 1850;
        const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 6; vg.gain.value = 25; v.connect(vg); vg.connect(E.kettle.frequency); v.start();
        E.kettleG = ctx.createGain(); E.kettleG.gain.value = 0; E.kettle.connect(E.kettleG); E.kettleG.connect(amb); E.kettle.start();
      }
      if (on) burst(amb, NB.brown, { dur: 1.2, gain: 0.05, filters: [biq('lowpass', 600)], attack: 0.3 });
    },
    scoop() { if (!ready) return; burst(amb, NB.white, { dur: 0.5, gain: 0.1, filters: [biq('bandpass', 900, 0.9)], attack: 0.04 }); burst(amb, NB.brown, { dur: 0.35, gain: 0.25, filters: [biq('lowpass', 320)], attack: 0.02 }); },
    bubbles(v, jet) {
      if (!ready) return;
      if (!E.bub) { E.bub = layer(NB.white, [biq('bandpass', 700, 0.7)]); E.jet = layer(NB.pink, [biq('lowpass', 420)]); }
      set(E.bub.g.gain, v * 0.07, 0.2); set(E.jet.g.gain, v * jet * 0.16, 0.2);
    },
    pump(v) {
      if (!ready) return;
      if (!E.pumpO) { E.pumpO = ctx.createOscillator(); E.pumpO.type = 'sawtooth'; E.pumpO.frequency.value = 118; E.pumpG = ctx.createGain(); E.pumpG.gain.value = 0; const f = biq('lowpass', 500); E.pumpO.connect(f); f.connect(E.pumpG); E.pumpG.connect(amb); E.pumpO.start(); E.pumpW = layer(NB.white, [biq('bandpass', 1300, 0.6)]); }
      set(E.pumpG.gain, v * 0.02, 0.2); set(E.pumpW.g.gain, v * 0.05, 0.2);
    },
    pour(v) {
      if (!ready) return;
      if (!E.pour) E.pour = layer(NB.white, [biq('bandpass', 1500, 0.8)]);
      set(E.pour.g.gain, v * 0.09, 0.08);
    },
    land() { if (ready) burst(amb, NB.brown, { dur: 0.25, gain: 0.3, filters: [biq('lowpass', 200)], attack: 0.005 }); },
    seat(kind) { if (!ready) return; if (kind === 'chair' || kind === 'bench' || kind === 'dock' || kind === 'boat-seat') tone(amb, { f0: 210, f1: 150, dur: 0.25, gain: 0.03, type: 'triangle', vib: 8, vibRate: 25 }); else burst(amb, NB.white, { dur: 0.25, gain: 0.03, filters: [biq('lowpass', 1500)], attack: 0.04 }); },
    birdCall(kind, x, y, z) {
      if (!ready || P.eyeUnder) return;
      const p = panner(x, y, z, 14);
      if (kind === 'gull') {
        const n = randInt(1, 4), base = rand(1300, 1750);
        for (let i = 0; i < n; i++) {
          const t = i * rand(0.32, 0.42), f = biq('bandpass', 1900, 3);
          tone(p, { t, type: 'sawtooth', f0: base * 1.25, f1: base * 0.82, dur: i === 0 ? 0.42 : 0.24, gain: 0.07, attack: 0.03, vib: 30, vibRate: 22, filter: f });
        }
      } else {
        for (let i = 0; i < randInt(1, 3); i++) tone(p, { t: i * 0.25, type: 'square', f0: rand(800, 1100), f1: rand(1300, 1700), dur: 0.16, gain: 0.03, vib: 90, vibRate: 40, filter: biq('bandpass', 1500, 2) });
      }
    },
    thunder(dist) {
      if (!ready) return;
      const near = 1 - smoothstep(800, 3000, dist);
      const now = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = NB.brown;
      const f = biq('lowpass', 900 * (0.4 + near), 0.5); f.frequency.setValueAtTime(700 * (0.4 + near), now); f.frequency.exponentialRampToValueAtTime(70, now + 4);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5 * (0.35 + near), now + 0.08 + (1 - near) * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);
      s.connect(f); f.connect(g); g.connect(amb); s.start(now, Math.random()); s.stop(now + 5.6);
    },
  };
})();
