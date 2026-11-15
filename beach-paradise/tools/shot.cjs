// Drive the game in headless Chromium (software GL) and take screenshots.
//   tools/shot.sh <final.png> @steps.json        (always use shot.sh: it queues runs, one browser at a time)
// steps (a JSON array, run in order):
//   {"eval": "js expression"}      run in the page; a returned value is printed. window.__T (tools/testlib.js) has
//                                  helpers: setup, look, lookAt, at, orbit, walk, hold, release, interact, step,
//                                  stats, box, hideHud
//   {"sim": seconds}               advance the whole game without drawing (optional "dt", default 1/30)
//   {"grab": "file.png"}           FAST picture of the game canvas (no HUD or other page elements): advances the game
//                                  0.6 s ("settle": seconds, to change it) so camera, level of detail and shadows catch
//                                  up, draws one frame ("frames": n for more) and saves the canvas. Use with DRAW=0
//                                  (tools/snap.sh).
//   {"wait": ms}                   real time, lets frames draw (only meaningful without DRAW=0)
//   {"shot": "file.png"}           screenshot of the whole page as a player sees it, HUD included (slow: needs the game
//                                  to be drawing continuously, so not with DRAW=0); optional "clip": {"x","y","width","height"}
//   {"keydown": "KeyW"}, {"keyup": "KeyW"}, {"click": "css selector"}
// A step that throws is reported as STEP ERROR and the run continues. The run ends with either
// "no console errors" or "CONSOLE PROBLEMS:" and the list.
// env: FILE=file:///abs/page.html (default: build/index.html), W, H (viewport, default 1280x720), TOUCH=1 (phone
// emulation), THREE_DIR, DRAW=0 (the game draws nothing by itself and game time only advances through "sim" and
// "grab" steps: runs are deterministic and many times faster; tools/snap.sh sets it; use it for everything except
// real-time behaviour and HUD screenshots), OUT and QUALITY (replace $OUT and $QUALITY anywhere in the steps; defaults build, high). Frames are slow in software GL (often under 1 fps): test game logic with "sim" steps or by
// calling functions through window.__bp / window.__bpEval rather than waiting for real time to pass.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const THREE_DIR = process.env.THREE_DIR || [path.join(__dirname, 'node_modules/three'), '/opt/bl/node_modules/three'].find(p => fs.existsSync(p));
const tStart = Date.now();
const zlib = require('zlib');
// PNG file from raw RGBA rows given bottom row first (what gl.readPixels returns); alpha is dropped
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    let o = y * (w * 3 + 1) + 1, i = (h - 1 - y) * w * 4;
    for (let x = 0; x < w; x++, i += 4) { raw[o++] = rgba[i]; raw[o++] = rgba[i + 1]; raw[o++] = rgba[i + 2]; }
  }
  const table = png.t || (png.t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  const crc = b => { let c = ~0; for (let n = 0; n < b.length; n++) c = table[(c ^ b[n]) & 0xff] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
// MEM=1: after every step print the resident memory of the browser's processes (main, GPU, page)
function memMB() {
  try {
    const out = require('child_process').execSync('ps -eo rss,args', { encoding: 'utf8' }).split('\n').filter(l => /chrome-headless-shell/.test(l));
    const pick = re => Math.round(out.filter(l => re.test(l)).reduce((a, l) => a + parseInt(l), 0) / 1024);
    return [pick(/^(?!.*--type=)/), pick(/--type=gpu-process/), pick(/--type=renderer/)].join(', ');
  } catch (e) { return '?'; }
}
(async () => {
  const out = process.argv[2] || 'shot.png';
  let steps = process.argv[3] || '[]';
  if (steps.startsWith('@')) steps = fs.readFileSync(steps.slice(1), 'utf8');   // @file.json
  // $OUT and $QUALITY in a steps file are replaced from the environment (defaults: build, high), so one views file
  // can write "before" and "after" sets and run at any quality: OUT=build/after QUALITY=medium tools/shot.sh ...
  const OUT = process.env.OUT || 'build', QUALITY = process.env.QUALITY || 'high';
  steps = JSON.parse(steps.split('$OUT').join(OUT).split('$QUALITY').join(QUALITY));
  const w = +(process.env.W || 1280), h = +(process.env.H || 720);
  // tiny local server that receives the pixels of "grab" steps from the page
  const srv = require('http').createServer((req, res) => { const parts = []; req.on('data', c => parts.push(c)); req.on('end', () => { res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('ok'); if (onPixels) onPixels(Buffer.concat(parts)); }); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port; let onPixels = null;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : [])] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.route('https://cdn.jsdelivr.net/npm/three@0.170.0/**', r => {
    const rel = r.request().url().split('three@0.170.0/')[1];
    r.fulfill({ path: path.join(THREE_DIR, rel), contentType: 'application/javascript' });
  });
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route('https://fonts.gstatic.com/**', r => r.abort());
  const t0 = Date.now();
  const noDraw = process.env.DRAW === '0';   // logic-only run: the game draws nothing, so the run takes seconds
  await p.goto((process.env.FILE || 'file://' + path.resolve(__dirname, '../build/index.html')) + (noDraw ? '#nodraw' : ''));
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 }); }
  catch (e) { console.log('NOT READY'); }
  console.log('ready in', (Date.now() - t0) / 1000, 's');
  try { await p.evaluate(fs.readFileSync(path.join(__dirname, 'testlib.js'), 'utf8')); } catch (e) { console.log('testlib failed:', e.message); }
  let n = 0;
  for (const s of steps) {
    n++;
    try {
      if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r)); }
      if (s.sim) { const r = await p.evaluate(([sec, dt]) => window.__bpStep(sec, dt), [s.sim, s.dt || 1 / 30]); console.log('sim: game time', r); }
      if (s.grab) {   // fast picture of the game canvas: settle the game logic, draw just the frames needed, read the pixels back
        const t1 = Date.now();
        const got = new Promise(r => { onPixels = r; });
        // the pixels come back over a local socket: returning megabytes through the debugging channel makes the browser leak
        const g = await p.evaluate(async ([sec, frames, port]) => {
          if (sec > 0) window.__bpStep(sec);
          const g = window.__bpGrab(frames);
          await fetch('http://127.0.0.1:' + port + '/', { method: 'POST', mode: 'no-cors', body: g.px });
          return { w: g.w, h: g.h };
        }, [s.settle === undefined ? 0.6 : s.settle, s.frames || 1, port]);
        fs.mkdirSync(path.dirname(path.resolve(s.grab)), { recursive: true });
        fs.writeFileSync(s.grab, png(g.w, g.h, await got));
        console.log('grab', s.grab, ((Date.now() - t1) / 1000).toFixed(1) + ' s');
      }
      if (s.wait) await p.waitForTimeout(s.wait);
      if (s.shot) { fs.mkdirSync(path.dirname(path.resolve(s.shot)), { recursive: true }); await p.screenshot({ path: s.shot, timeout: 420000, ...(s.clip ? { clip: s.clip } : {}) }); console.log('shot', s.shot); }
      if (s.click) await p.click(s.click, { timeout: 20000 });
      if (s.keydown) await p.keyboard.down(s.keydown);
      if (s.keyup) await p.keyboard.up(s.keyup);
      if (process.env.MEM) console.log('  [' + ((Date.now() - tStart) / 1000).toFixed(0) + ' s] step ' + n + ' ' + Object.keys(s)[0] + '; memory MB (browser, gpu, page): ' + memMB());
    } catch (e) { console.log('STEP ' + n + ' ERROR (' + Object.keys(s).join(',') + '): ' + String(e.message || e).split('\n').slice(0, 4).join(' | ')); }
  }
  const uniq = [...new Set(errs)].filter(e => !/KHR_parallel_shader_compile|GPU stall due to ReadPixels/.test(e));
  console.log(uniq.length ? 'CONSOLE PROBLEMS:\n' + uniq.slice(0, 30).join('\n') : 'no console errors');
  if (!noDraw) { try { await p.screenshot({ path: out, timeout: 420000 }); } catch (e) { console.log('final screenshot failed:', e.message); } }
  const t2 = Date.now();
  srv.close();
  await b.close();
  console.log('run took', ((Date.now() - tStart) / 1000).toFixed(0), 's (closing the browser', ((Date.now() - t2) / 1000).toFixed(1), 's)');
})().catch(e => { console.log('HARNESS ERROR:', e && e.message ? e.message : e); process.exit(1); });
