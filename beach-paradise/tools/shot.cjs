// Drive the game in headless Chromium (software GL) and take screenshots.
//   node tools/shot.cjs <final.png> '<json steps>'      (use tools/shot.sh: it queues runs, one browser at a time)
// steps: [{eval:"js"}, {wait:ms}, {shot:"file.png"}, {keydown:"KeyW"}, {keyup:"KeyW"}, {click:"css"}]
// env: FILE=file:///abs/page.html (default: build/index.html), W, H (viewport), TOUCH=1 (phone emulation), THREE_DIR
// Frames are slow in software GL (often under 1 fps): test game logic by calling update functions
// directly through window.__bp / window.__bpEval rather than waiting for real time to pass.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const THREE_DIR = process.env.THREE_DIR || [path.join(__dirname, 'node_modules/three'), '/opt/bl/node_modules/three'].find(p => fs.existsSync(p));
(async () => {
  const out = process.argv[2] || 'shot.png';
  let steps = process.argv[3] || '[]';
  if (steps.startsWith('@')) steps = fs.readFileSync(steps.slice(1), 'utf8');   // @file.json
  steps = JSON.parse(steps);
  const w = +(process.env.W || 1280), h = +(process.env.H || 720);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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
  await p.goto(process.env.FILE || 'file://' + path.resolve(__dirname, '../build/index.html'));
  try { await p.waitForFunction(() => window.__ready === true, null, { timeout: 240000 }); }
  catch (e) { console.log('NOT READY'); }
  console.log('ready in', (Date.now() - t0) / 1000, 's');
  for (const s of steps) {
    if (s.eval) { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r)); }
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.shot) { await p.screenshot({ path: s.shot, timeout: 420000 }); console.log('shot', s.shot); }
    if (s.click) await p.click(s.click);
    if (s.keydown) await p.keyboard.down(s.keydown);
    if (s.keyup) await p.keyboard.up(s.keyup);
  }
  const uniq = [...new Set(errs)].filter(e => !/KHR_parallel_shader_compile/.test(e));
  console.log(uniq.length ? 'CONSOLE PROBLEMS:\n' + uniq.slice(0, 30).join('\n') : 'no console errors');
  await p.screenshot({ path: out, timeout: 420000 });
  await b.close();
})();
