# Developing Beach Paradise

Beach Paradise is a first-person three.js (r170) game delivered as ONE html file. Players are mostly
on Android phones in landscape, some on computers. This file is the shared rulebook for anyone (human
or agent) changing the game. `README.md` is for players; keep it about what the game does.

## Layout

```
beach-paradise/
  index.html        the released single-file game (built; commit it only when releasing)
  src/              the source: html/css head, then JS modules, joined in name order into one <script type="module">
  models/           Blender (bpy) scripts that build the 3D assets, their shared library, and the exported packs
    lib/            shared Blender helpers (materials, modelling helpers, export, preview render)
    out/            exported assets, one <name>.bpk per asset (committed: they are build inputs)
  tools/            build, check, test harness, asset packer, artifact maker, setup
  build/            build output and scratch (ignored by git)
```

Commands (run from `beach-paradise/`):

| | |
|---|---|
| `tools/setup.sh` | one-time: Blender as a Python module in `/opt/bl/venv`, three.js for the offline test harness |
| `/opt/bl/venv/bin/python models/<name>.py` | build one asset in Blender: writes `models/out/<name>.bpk` and preview renders to `build/preview/` |
| `tools/build.sh` | join `src/` (+ embed assets) into `build/index.html` for testing |
| `tools/check.sh` | syntax-check the built page's module script (always run after a build) |
| `tools/snap.sh steps.json` | run the game in a headless browser: logic tests and pictures (see Testing) |
| `tools/sheet.py out.png a.png b.png ...` | tile pictures into one labelled sheet for side-by-side comparison |
| `tools/build.sh --release` | write `index.html` (only when releasing) |

## How the game is put together

Everything in `src/*.js` is concatenated into a single ES module, so **all top-level names share one
scope**: a second `const _tmp` anywhere is a syntax error. Give new top-level names a module prefix
and run `tools/check.sh` after every build. Files (name order = load order):

| file | what |
|---|---|
| `00-head.html` | page head, all CSS, HUD/panel markup, opens the module script |
| `10-core.js` | settings, quality presets (`QUALITY`, `Q`), renderer/camera/scene, shared uniforms `U`, shared GLSL `COMMON`, `patch()` |
| `20-terrain.js` | the home island height field (`T`), river path (`STREAM`), terrain material, `groundHeight(x,z)` |
| `21-far.js` | far islands, abyss, lighthouse, volcano, summit clouds |
| `30-sky-water.js` | sky dome, ocean (CDLOD mesh, Gerstner swell + surf model), river/pool/waterfall shaders |
| `32-water-fx.js` | refraction inputs, ripples, spray, splashes, planar reflection, `renderWorld()` (direct path) |
| `33-glow.js`, `34-post.js` | old glow (fallback) and the HDR final-image pipeline (`renderWorldHDR`) |
| `40-vegetation.js`, `41-lawn.js` | palms, trees, bushes (instanced, wind), grass blades |
| `45-sand.js` | the living sand layer: digging, dirt, water simulation on sand, dams |
| `50-props.js` | dock, chairs, bridge, rocks and other props; `LAYOUT` |
| `51-boat.js`, `57-deck.js` | motorboat and rowboat physics/model; walking on the boat deck |
| `52-cabin.js`, `52b-pool.js`, `52c-pump.js` | log cabin (interior, door/windows, fire), pool + hot tub + power box, drain pump and hose |
| `53-plane.js`, `54-submarine.js`, `55-surf.js` | biplane, submarine, surfing |
| `56-lights.js` | storm lantern, boat headlights |
| `60-sealife.js`, `62-big-animals.js`, `70-wildlife-fx.js` | fish/coral, sharks/dolphins/turtles/rays, birds/crabs/butterflies and the particle system `FX` |
| `80-environment.js`, `82-weather.js` | time of day, sun/moon/hemisphere light, weather |
| `85-audio.js` | all sound (synthesised) |
| `86-fishing.js`, `88-activities.js` | fishing; tools (shovel, bucket, stick, rod, surfboard, lantern) and their first-person models |
| `87-tsunami.js`, `89-destruction.js`, `89b-treefall.js` | tsunami, terrain/cabin destruction, falling trees |
| `90-main.js` | input, player physics (`P`), interactions, settings panel, main loop `frame()`, boot `init()` |
| `95-multiplayer.js`, `99-tail.html` | room presence multiplayer; closes the page |

Things every change must respect:

- **Units and axes**: metres, Y up, the sea surface at y = 0. `groundHeight(x,z)`, `supportHeight(x,z,feet)`,
  `waterAt(x,z[,y])` are the world queries.
- **Solid things** the player collides with are boxes in `WALLS` (`{x,z,hx,hz,rot,y0,y1}`), cylinders in
  `COLLIDERS`, and walkable tops in `PLATFORMS` (`{x,z,hx,hz,rot,top}`). Things you can use are in
  `INTERACT`. If you change a model's shape, keep these in step with it (or keep the shape).
- **Materials**: lit materials are three.js standard/lambert materials passed through
  `patch(mat, {key, vHead, vBegin, fHead, fColor, fRough, fNormal, fLight, uniforms})`, which adds the
  game's fog, underwater caustics and absorption, and the HDR convention. Use `patch()` for anything new
  that is lit (give each distinct shader variant its own `key`).
- **HDR convention** (see `34-post.js`): the world is drawn into HDR targets, then tone-mapped in a
  final pass. A custom `ShaderMaterial` that paints screen-referred colour must output
  `outCol(colour)` (from `COMMON`); premultiplied outputs are `vec4(outCol(c) * a, a)`.
- **Draw layers**: 0 solid, 1 water surfaces (`markWater(mesh)`), 2 transparent things (assigned
  automatically from `material.transparent`). Water reads the solid pass, so a water mesh on layer 0 is
  drawn wrongly.
- **Quality**: `Q` (low/medium/high/ultra/max). Phones default to medium. Anything expensive must scale
  with `Q` (`Q.veg`, `Q.particles`, `Q.shadow` …). Keep the frame cheap: merge static geometry, instance
  repeated things, keep draw calls low.
- **Shaders** share uniforms through `U` and GLSL through `COMMON`; a fragment-shader global that is
  assigned must not be a varying.
- **No external files**: the game must stay one html file. Only three.js comes from the CDN
  (`https://cdn.jsdelivr.net/npm/three@0.170.0/...`). Assets are embedded (see below).

## Testing

There is no GPU here: the game is drawn in software, a single frame at quality `high` costs 5-20
seconds, and **only one picture-taking browser may run at a time on this machine** (the tools queue
runs behind a lock; never start Chromium yourself). So tests do not let the game run in real time.
`tools/snap.sh` opens the built page in a mode where the game draws nothing by itself and time only
moves when the test says so. That makes runs deterministic (the same steps give the same picture,
wave for wave) and many times faster:

```sh
cat > build/steps.json <<'EOF'
[ {"eval": "__T.setup({quality:'$QUALITY', hour:15, hud:false})"},
  {"eval": "(()=>{ const C = __bp.CABIN; return __T.orbit(C.x, C.floor + 1.5, C.z, 16, 200, 14) })()"},
  {"grab": "$OUT/cabin.png"},
  {"eval": "(()=>{ __T.walk(-372, 60, 1.2, -0.1); __bp.setTool('shovel'); return __bp.P.mode })()"},
  {"grab": "$OUT/shovel.png"},
  {"eval": "(()=>{ const p0 = __bp.P.pos.clone(); __T.hold('KeyW'); __T.step(3); __T.release(); const d = __bp.P.pos.distanceTo(p0); return (d > 3 ? 'PASS' : 'FAIL') + ' walk-forward: moved ' + d.toFixed(2) + ' m' })()"},
  {"eval": "JSON.stringify(__T.stats())"} ]
EOF
W=800 H=450 OUT=build/shots tools/snap.sh build/steps.json
```

- Steps: `eval` (JS in the page; a returned value is printed), `sim` (advance the whole game N seconds
  without drawing: `{"sim": 5}`), `grab` (picture of the game canvas: it first advances the game 0.6 s
  so the camera, level of detail and shadows catch up, then draws one frame; `"settle": seconds` and
  `"frames": n` change that). A step that throws prints `STEP ERROR` and the run carries on.
- `$OUT` and `$QUALITY` in a steps file come from the environment (defaults `build`, `high`), so the
  same file makes "before" and "after" sets and runs at any quality.
- `window.__T` (from `tools/testlib.js`) has the helpers: `setup({quality,hour,weather,waveSize,hud})`,
  `look(x,y,z,yaw,pitch)`, `lookAt(x,y,z,tx,ty,tz)`, `at(x,z,h,tx,tz,pitch)`,
  `orbit(tx,ty,tz,dist,azimuthDeg,elevationDeg)` (camera on a sphere round a target, kept above the
  ground), `walk(x,z,yaw,pitch)` (player on foot there: the first-person tool models only draw on
  foot), `hold('KeyW',...)` / `release()` / `interact()` (input), `step(seconds)`, `stats()` (draw
  calls and triangles of the last drawn frame, live textures), `box(name)` (world bounding box of a
  named scene object), `studio(name, opts)` / `studioView(view, zoom, target)` (ONE 3D asset alone under the
  game's sun and sky, a picture in about a second: see "The studio view" below; `studio(null)` puts the
  world back).
- `window.__bp` exposes many internals; `window.__bpEval("expr")` evaluates code inside the game's
  module, so tests can reach **anything** by name (e.g. `__bpEval("BOATS.motor.x")`). No need to add
  exports for tests.
- **Logic tests cost seconds**: a steps file with no `grab` draws nothing at all and does not wait for
  the picture queue. Write behaviour checks as `eval` steps that return a line starting with `PASS` or
  `FAIL` plus the measured values, and run them freely.
- **Pictures**: a `grab` costs 5-20 s at `W=800 H=450` on `high` (the first one in a run is slower:
  shaders compile). Use that size for most work, 480x270 for quick looks, 1280x720 only for final
  beauty shots. Put all the views you need into one run. A run may wait behind other people's runs:
  start it as a background command if your shell's time limit is shorter than the wait.
- The run ends with `no console errors` or `CONSOLE PROBLEMS:` and a list: treat shader compile errors
  and exceptions as failures.
- Look at every picture you take (open the image) and judge it honestly. `tools/sheet.py out.png a.png
  b.png ...` tiles pictures into one labelled sheet (`--pairs dirA dirB` puts same-named pictures of two
  folders side by side: before | after; `--crop x,y,w,h` zooms on a detail).
- To judge motion, grab the same view several times with a short `"settle"` between (0.2-0.5 s) and tile
  the frames into a strip.
- `grab` shows the game canvas only. For the page as a player sees it (HUD, touch controls, the
  underwater tint overlay) or real-time behaviour, use the slow path: `tools/shot.sh final.png
  @steps.json` with `wait` (milliseconds) and `shot` steps; there the game runs in real time at well
  under one frame a second.
- To compare with the last release: `git show HEAD:beach-paradise/index.html > build/old.html` and run
  with `FILE=file://$PWD/build/old.html` (an old page that predates `tools/snap.sh` only works with
  `tools/shot.sh`).
- Yaw convention: the camera looks along (-sin(yaw), -cos(yaw)); to face a point (tx,tz) from (x,z) use
  `Math.atan2(-(tx-x), -(tz-z))`. Pitch up is positive.

## 3D assets made in Blender

Models are written as Python scripts that drive Blender (`bpy`, no interactive Blender), so every asset
is reproducible, reviewable and rebuilt in seconds. One script per asset in `models/`; everything they
share is in `models/lib/`. This section is all you need to build one; the code is the reference
(`models/lib/bpkit.py` has a docstring on every function), and `models/shovel.py`, `models/lounger.py`
are finished models to read.

### How the pieces fit

```
models/<name>.py ── import bpkit as kit ──► Blender scene ──► kit.export_bpk()  ──► models/out/<name>.bpk   (committed)
                                                         └──► kit.preview()     ──► build/preview/<name>_<view>.png  (Cycles)
models/out/*.bpk ── tools/build.sh (tools/pack_assets.py) ──► one deflated base64 blob inside build/index.html
build/index.html ── boot: loadAssets() (src/15-assets.js) ──► assetModel('name') ... in the game's modules
```

| piece | what it is |
|---|---|
| `models/lib/bpkit.py` | the toolkit (`kit`): scene, materials, primitives, modelling, colour and wear, UVs, ambient occlusion, parts and anchors, levels of detail, export, previews |
| `models/lib/bptex.py` | four small tileable grey DETAIL textures made with numpy: `wood`, `brushed`, `weave`, `grunge` |
| `models/out/<name>.bpk` | one exported asset: quantised meshes, material definitions, nodes, anchors, embedded images |
| `tools/pack_assets.py` | bundles all `.bpk` into the page; `tools/build.sh` calls it and prints a size table |
| `src/15-assets.js` | the loader and the asset shader: `loadAssets`, `assetModel`, `assetPose`, `assetAnchor`, ... |
| `tools/testlib.js` | `__T.studio(name)`: one asset alone under the game's sun, a picture in about a second |
| `tools/assettest/` | regression tests of the pipeline itself (`run.sh`): run them after changing exporter, packer or loader |

The loop while modelling: edit the script; `/opt/bl/venv/bin/python models/<name>.py --quick` (export and
two previews: half a minute); open the previews; when the shape is right, `tools/build.sh` and look at it
in the studio view, then in its place in the game.

**Conventions**

- **Units and axes.** 1 Blender unit = 1 m. Model in Blender's axes: **Z up, the model's front faces -Y**
  (its left is +X). The exporter turns every point (x, y, z) into the game's (-x, z, y): Y up, front
  towards -Z, left at -X. That is a rotation, not a mirror image: text and handed things stay right.
- **Origin** where the game wants the pivot: on the ground under the middle for props, at the hand for
  tools, on the keel line for hulls. Write it in the script's docstring together with the names of the
  parts and anchors: that docstring is the contract with the game code.
- **Colours** are written as they look on screen: `'#c8a36a'`, `0xc8a36a` or an sRGB triple. Wrap a
  triple in `kit.linear(r, g, b)` when it is linear light (metal reflectances from a table).
- **Names.** Object names are yours to choose but must be unique; an object whose name starts with `_`
  is a helper and is not exported. Part and anchor names are API (see "Moving parts and anchors").
- **Scripts take two flags** by convention: `--no-preview` (export only) and `--quick` (fewer previews).

### A complete example

`models/example_crate.py` is a small wooden crate with a painted, hinged lid, strap hinges and rope
handles: about 3 800 triangles, three levels of detail, one moving part, two anchors. It exports to
`build/example/` (not `models/out/`), so it never ships; copy it to start a model of your own and delete
the `out_dir` argument.

```python
"""A worked example for DEVELOPING.md ('3D assets made in Blender'): a small wooden storage crate with a hinged,
painted lid, strap hinges and rope handles. Copy this file to start a new model.

It is NOT part of the game: it exports to build/example/ instead of models/out/. Look at it with
    /opt/bl/venv/bin/python models/example_crate.py            -> build/example/crate.bpk, build/preview/crate_*.png
    tools/build.sh --assets build/example --out build/example/index.html
    FILE=file://$PWD/build/example/index.html tools/snap.sh steps.json      with  __T.studio('crate', {pose: {lid: [55, 0, 0]}})

In the game: 0.60 x 0.40 x 0.34 m (0.69 wide with the handles), the front faces -Z, the origin is on the ground under
the middle. Moving part: 'lid' (assetPose(model, 'lid', angle): positive angles about its x axis open it). Anchors: 'grip' (front edge of the lid,
rides on the lid), 'inside' (the middle of the floor of the crate; data: litres).
"""
import math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import bpkit as kit
import numpy as np

kit.reset()
rng = np.random.default_rng(4)

# ── materials: from the library where it has one, made here where the model needs its own ──
pine = kit.lib('pine')
iron = kit.lib('steel_dark', 'hinge_iron', rough=0.6)
rope = kit.lib('rope')
teal = kit.paint('crate_paint', '#2a9a96', gloss=0.2)

# ── measures (metres; Blender axes: X to the model's left, -Y its front, Z up) ──
L, W, T = 0.60, 0.40, 0.018                 # outside length and width of the box, thickness of the boards
SKID, BOARD, GAP = 0.030, 0.085, 0.004      # height of the skids it stands on; height of a side board; gap between boards
Z0 = SKID + T                               # top of the floor
TOP = Z0 + 3 * (BOARD + GAP) - GAP          # top edge of the sides

wood, lid, iron_bits, rivets = [], [], [], []

def board(name, size, loc, into=wood, bevel=0.0025):
    """one sawn board: never quite straight, never quite in line with its neighbours"""
    o = kit.box(name, size, loc, rot=(0, 0, rng.uniform(-0.004, 0.004)), mat=pine, bevel=bevel)
    into.append(o)
    return o

# ── the box ──
for sx in (-1, 1):
    board('skid_%d' % sx, (0.045, W, SKID), (sx * 0.21, 0, SKID / 2), bevel=0.004)
for i in range(4):
    board('floor_%d' % i, (L, 0.096, T), (0, -0.15 + 0.1 * i, SKID + T / 2))
for i in range(3):
    z = Z0 + BOARD / 2 + i * (BOARD + GAP)
    for sy in (-1, 1):
        board('side_%d_%d' % (sy, i), (L, T, BOARD), (0, sy * (W - T) / 2, z))
    for sx in (-1, 1):
        board('end_%d_%d' % (sx, i), (T, W - 2 * T, BOARD), (sx * (L - T) / 2, 0, z))
for sx in (-1, 1):
    for sy in (-1, 1):
        board('post_%d_%d' % (sx, sy), (0.028, 0.028, TOP - Z0 - 0.004), (sx * (L / 2 - T - 0.014), sy * (W / 2 - T - 0.014), (TOP + Z0) / 2 - 0.002))

# ── the lid: four boards held by two battens, painted ──
for i in range(4):
    board('lid_%d' % i, (L + 0.016, 0.1, 0.016), (0, -0.153 + 0.102 * i, TOP + 0.008), into=lid)
for sx in (-1, 1):
    board('lid_batten_%d' % sx, (0.05, W - 0.02, 0.014), (sx * 0.25, 0, TOP + 0.016 + 0.007), into=lid, bevel=0.003)
kit.set_material(lid, teal)

# ── strap hinges: one leaf on the back of the box, one on the lid, a barrel between; domed rivets hold them ──
HINGE = (W / 2 + 0.006, TOP + 0.002)                                   # the hinge line (y, z)
for sx in (-1, 1):
    x = sx * 0.14
    leaf = kit.strap('hinge_box_%d' % sx, [(x, W / 2 + 0.0015, TOP - 0.085), (x, W / 2 + 0.0015, TOP - 0.004)], 0.032, 0.003, mat=iron, width_axis=(1, 0, 0))
    barrel = kit.cylinder('hinge_barrel_%d' % sx, 0.006, 0.05, (x, HINGE[0], HINGE[1]), mat=iron, verts=12, axis='x')
    top = kit.strap('hinge_lid_%d' % sx, [(x, W / 2 + 0.004, TOP + 0.0175), (x, W / 2 - 0.02, TOP + 0.0175), (x, W / 2 - 0.15, TOP + 0.0175)], [0.032, 0.032, 0.02], 0.003, mat=iron, width_axis=(1, 0, 0))
    iron_bits += [leaf, barrel, top]; lid.append(top)
    for k, z in enumerate((TOP - 0.07, TOP - 0.025)):
        rivets.append(kit.rivet('rivet_box_%d_%d' % (sx, k), (x, W / 2 + 0.003, z), (0, 1, 0), 0.005, mat=iron))
    for k, y in enumerate((W / 2 - 0.035, W / 2 - 0.12)):
        r = kit.rivet('rivet_lid_%d_%d' % (sx, k), (x, y, TOP + 0.019), (0, 0, 1), 0.005, mat=iron)
        rivets.append(r); lid.append(r)
iron_bits += rivets

# ── rope handles through the ends ──
ropes = []
for sx in (-1, 1):
    x = sx * L / 2
    ropes.append(kit.tube('handle_%d' % sx, [(x - sx * 0.01, -0.07, 0.21), (x + sx * 0.03, -0.05, 0.17), (x + sx * 0.04, 0, 0.15), (x + sx * 0.03, 0.05, 0.17), (x - sx * 0.01, 0.07, 0.21)],
                          0.007, mat=rope, verts=8, smooth=4))

# ── moving parts: everything that turns with the lid, with the pivot ON the hinge line ──
p_lid = kit.part('lid', lid, pivot=(0, HINGE[0], HINGE[1]))

# ── surfaces: UVs in metres, then colour and wear from large to small ──
kit.uv_tube(wood + lid)                              # timber: grain along each board, wrapped round it (few seams)
kit.uv_box(iron_bits)                                # the rope came with UVs (tube, strap, surface do)
timber = [o for o in wood + lid if o not in iron_bits]
kit.vary(timber, value=0.08, hue=0.03, noise=0.06, scale=0.25, seed=2)        # no two boards the same
kit.coat(wood, lambda P, N: np.clip(N[:, 2], 0, 1) * (0.3 + 0.4 * kit.noise3(P, 0.2, 3, 7)), color='#b3a590', rough=0.85)   # tops bleached silver by the sun
painted = [o for o in lid if o not in iron_bits]
kit.wear(painted, amount=0.75, color='#c9a878', rough=0.7, breakup=0.6, scale=0.04)   # paint rubbed through to the wood on the edges
kit.wear(wood, amount=0.5, lighten=0.25, breakup=0.6)
kit.coat(iron_bits, lambda P, N: np.clip((kit.noise3(P, 0.03, 3, 9) - 0.55) / 0.15, 0, 1), color='#7a4226', rough=0.9, metal=0.1)   # rust has started in patches
kit.gradient(wood, 'z', 0.0, 0.14, color_lo='#b9a78f', color_hi='#ffffff')      # the lowest boards are stained by damp sand
kit.detail_only(rivets, upto=0)                      # too small to see beyond the first level of detail

# ── shade: ambient occlusion (it stands on the ground), grime in the nooks, the shade it leaves on the sand ──
kit.bake_ao(distance=0.3, ground=0.0)
kit.dirt(timber, amount=0.5)
kit.ground_shadow(z=0.0, reach=0.4)

# ── what the game reads instead of hard-coded numbers ──
kit.anchor('grip', (0, -W / 2 - 0.008, TOP + 0.008), parent_part=p_lid)
kit.anchor('inside', (0, 0, Z0), litres=round((L - 2 * T) * (W - 2 * T) * (TOP - Z0) * 1000))

kit.export_bpk('crate', lods=[(0.4, 12), (0.14, 35)], meta=dict(kind='prop', collider=dict(hx=L / 2, hz=W / 2, top=TOP + 0.03)),
                       out_dir=os.path.join(kit.ROOT, 'build', 'example'))        # a real model leaves out_dir out: models/out

if '--no-preview' not in sys.argv:
    kit.preview('crate', views=('hero', 'hero_back', 'top'), extra=('ao', 'wire'), size=(480, 360),
                closeups={'hinge': ((0.14, W / 2, TOP), 0.12, 150, 30), 'handle': ((L / 2, 0, 0.18), 0.14, 60, 15)})
```

```sh
/opt/bl/venv/bin/python models/example_crate.py        # export + 7 previews in build/preview/crate_*.png (about 30 s)
tools/build.sh --assets build/example --out build/example/index.html    # a test page that also holds the crate
cat > build/example/steps.json <<'EOF'
[ {"eval": "__T.setup({quality:'$QUALITY', hour:15, hud:false})"},
  {"eval": "(()=>{ __T.studio('crate', {fov:30, light:50}); return __T.studioView('hero') })()"},
  {"grab": "$OUT/crate_hero.png"},
  {"eval": "(()=>{ __T.studio('crate', {fov:30, light:50, pose:{lid:[55,0,0]}}); return __T.studioView('hero_back') })()"},
  {"grab": "$OUT/crate_open.png"},
  {"eval": "(()=>{ __T.studio('crate', {fov:30, lod:[0,1,2], grid:true}); return __T.studioView('high') })()"},
  {"grab": "$OUT/crate_lods.png"} ]
EOF
FILE=file://$PWD/build/example/index.html W=800 H=450 OUT=build/example tools/snap.sh build/example/steps.json
```

The export prints the line to check sizes and counts by:
`crate.bpk: 0.694 x 0.341 x 0.415 m (wide, high, long), 3794/1292/372 triangles, 3571/1104/710 vertices,
2 node(s), 3 draw batch(es) at full detail, 3 image(s), 187.5 KB`.

**The order of work in a script** (the example follows it, and it matters):

1. `kit.reset()`, materials, the measures as named constants.
2. Geometry: primitives, bevels, booleans, mirrors. Keep lists of what belongs together (`wood`, `steel`).
3. `kit.part(...)` for everything that moves.
4. UVs (`uv_tube`, `uv_box`), then colour from large to small: `vary`, `coat`, `gradient`, `wear`.
5. `kit.bake_ao(...)`, then what needs it: `kit.dirt(...)`, `kit.ground_shadow(...)`. The bake may add
   vertices, so nothing after it may count on vertex numbers.
6. `kit.anchor(...)`, `kit.export_bpk(...)`, `kit.preview(...)`.

### The toolkit, function by function

Everything takes one object or a list. `mat=` is a material from `kit.material` / `kit.lib`. Sizes in
metres, angles in radians unless a function says degrees.

**Scene and helpers**

| | |
|---|---|
| `kit.reset()` | empty scene in metres, Cycles on the CPU. Always first. |
| `kit.export_objects()` | every mesh object that is not a `_helper`: what the functions below use when given no objects |
| `kit.bounds(objs=None)` | world bounding box `(min, max)` as numpy arrays; by default of the model without its ground shade |
| `kit.tri_count(objs=None)` | triangles of the objects |
| `kit.noise3(P, scale, octaves, seed)` | smooth 0..1 noise at points `P` (n, 3); `scale` = size of the largest blotches in metres. The raw material of every mask. |
| `kit.rgb(c)`, `kit.linear(r, g, b)` | a colour as linear light; mark a triple as already linear |
| `kit.log(...)` | print with the `[bpkit]` prefix |

**Primitives** (each returns a new mesh object)

| | |
|---|---|
| `kit.box(name, size, loc, rot, mat, bevel, segments)` | a box of full size (x, y, z) centred on `loc`; `bevel` = edge radius. The workhorse: planks, beams, blocks. |
| `kit.cylinder(name, radius, depth, loc, rot, mat, verts, radius2, caps, axis, bevel)` | cylinder or cone frustum along `axis` ('x', 'y', 'z'); smooth sides, flat caps |
| `kit.sphere(name, radius, loc, mat, segments, rings, scale)` | UV sphere, `scale` squashes it |
| `kit.lathe(name, profile, steps, mat, loc, rot, angle, smooth)` | spins a profile `[(radius, z), ...]` round Z: knobs, wheels, bottles, posts, bowls |
| `kit.tube(name, points, radius, mat, verts, smooth, closed, caps, twist, squash)` | a circle swept along a path: rods, rails, rope, hoses, handles. `radius` may be one per point; `smooth` = curve subdivisions per span; `squash=(a, b)` makes it oval. Comes with UVs in metres. |
| `kit.strap(name, points, width, thickness, mat, width_axis, smooth)` | a flat bar bent along a path: hinge leaves, brackets, bands. Comes with UVs. |
| `kit.surface(name, fn, nu, nv, mat, closed_u, closed_v, thickness, uv_scale, smooth, grain)` | a sheet from a function `fn(u, v) -> (x, y, z)` on numpy arrays, u and v in 0..1: hull skins, cloth, blades, leaves. Comes with UVs in metres; `thickness` gives it a back. |
| `kit.extrude(name, outline, depth, mat, loc, rot, holes)` | a flat outline `[(x, y), ...]` (counter-clockwise) with thickness along +Z: plates, brackets, notched racks |
| `kit.rivet(name, loc, normal, radius, height, mat, segments, washer)` | a domed rivet or bolt head sitting on a surface |
| `kit.mesh_object(name, verts, faces, mat, uvs, smooth)` | anything else, from points and faces (`uvs`: one per face corner) |

**Modelling**

| | |
|---|---|
| `kit.bevel(obj, width, segments, angle, profile, edges, smooth)` | rounds the edges sharper than `angle` degrees by `width` metres and shades the result like a real chamfered part. It **remembers** the new faces (face attribute `bpk_edge`: +1 on outer edges, -1 in inner corners): `kit.wear` and `kit.dirt` put their effect exactly there. `edges=fn(BMEdge)` picks edges. |
| `kit.weighted_normals(obj, sharp)` | smooth shading in which big flat faces stay flat (what `bevel` does at the end) |
| `kit.shade_smooth(obj, angle)`, `kit.shade_flat(obj)` | smooth with edges sharper than `angle` degrees kept hard; all flat |
| `kit.subdivide(obj, levels, simple, crease_angle)` | subdivision surface for organic and streamlined shapes; `crease_angle` keeps sharp edges crisp |
| `kit.solidify(obj, thickness, offset)` | gives a sheet a back and edges |
| `kit.rim(obj, depth, direction)` | turns the border of an open sheet down by `depth`: cloth or a panel lying on something looks thick without a hidden underside |
| `kit.mirror(obj, axis, merge)` | mirrors the mesh across its own origin plane, keeping the original half |
| `kit.boolean(obj, cutter, op)` | cuts `cutter` out of `obj` ('DIFFERENCE', 'UNION', 'INTERSECT') |
| `kit.decimate(obj, ratio)` | fewer triangles by edge collapse |
| `kit.deform(obj, fn)` | moves vertices with `fn(P) -> P'` on an (n, 3) array: bend, taper, sag, dent |
| `kit.transform(obj, matrix)`, `kit.apply_transform(obj)` | move the mesh data by a matrix; push the object's rotation and scale into its mesh |
| `kit.join(objs, name)` | several objects into one (materials and layers kept) |
| `kit.duplicate(obj, name, loc, rot)`, `kit.delete(obj)` | a copy; remove |
| `kit.set_material(obj, mat, where)` | one material for the object, or only for the faces where `where(centre, normal)` is true |
| `kit.set_origin(obj, point)`, `kit.parent(child, par)` | move the origin without moving the geometry; parent in place |
| `kit.fix_normals(obj)`, `kit.apply_modifiers(obj)` | make all faces point outwards; bake Blender modifiers you added yourself |

Negative scales and mirrored objects are fine: the exporter turns their faces the right way round.
Parts (the Empties made by `kit.part`) must not be scaled.

**Colour and wear** (all of it per face corner, so it costs nothing in the game)

| | |
|---|---|
| `kit.vary(objs, value, hue, noise, scale, seed)` | natural unevenness: each object of the list gets its own slight brightness and hue, plus soft blotches. Call it with the list of planks. |
| `kit.tint(obj, color, fn, amount)` | multiplies the colour by one colour, or by `fn(P, N)` (world positions and normals of the corners -> factors) |
| `kit.gradient(obj, axis, lo, hi, color_lo, color_hi)` | a tint that blends along a world axis: grime near the ground, bleaching on top |
| `kit.coat(obj, mask, color, rough, metal, weight)` | lays a second finish where `mask(P, N)` is 1: paint over steel, rust, a wet patch, sun-bleached tops. Sets colour AND roughness / metalness. |
| `kit.wear(obj, amount, color, lighten, rough, metal, breakup, scale, spread)` | rubs the exposed edges: on the bevels made by `kit.bevel` the colour goes paler (`lighten`) or towards `color` (bare wood under paint, steel under enamel: `color=..., rough=0.35, metal=1`). `amount` how much of the edge length, `breakup` how patchy. **Bevel first**: on a mesh without remembered bevels it falls back to "every convex vertex", which on a plain box is the whole box. |
| `kit.dirt(obj, amount, color, rough, crease)` | grime where it gathers: in the nooks the baked occlusion found and in inner bevels. Needs (and if missing runs) `bake_ao`. |
| `kit.set_pbr(obj, rough, metal, weight, fn)` | roughness / metalness / weight per corner, constants or `fn(P, N) -> dict` |

**UVs in metres** (1 UV unit = 1 m; the detail textures need them; `tube`, `strap` and `surface` come with them)

| | |
|---|---|
| `kit.uv_tube(obj, axis, scale, offset)` | wraps the UVs round the object's long axis: U along it (the grain), V round it, one seam. The right choice for round things AND for planks, slats, legs, beams: far fewer seams than box projection, so fewer vertices. |
| `kit.uv_box(obj, grain, scale, offset, world)` | projects each face from its nearest axis; `grain` = the axis wood grain or brushing runs along (default: the longest) |
| `kit.uv_smart(obj, angle, margin, scale)` | Blender's Smart UV Project, rescaled to metres, for shapes the other two would tear |

Each object gets its own random UV offset (from its name), so neighbouring planks never show the same
piece of grain.

**Ambient occlusion**

| | |
|---|---|
| `kit.bake_ao(objs, distance, samples, ground, strength, floor, refine, tol)` | bakes how much of the sky each corner sees into the `bpk_ao` layer, all objects shading each other where they stand. `ground=0.0` for things that stand on the ground; `distance` = how far a surface looks for blockers (default a quarter of the model's size, 0.15 to 2 m: about the width of the gaps you want to read). `refine` lets it add up to that fraction of triangles where a long edge cannot follow the shade (a leg that is dark only at the floor). |
| `kit.ground_shadow(objs, z, strength, reach, margin, cell, upto)` | the soft shade the thing leaves on the ground, as a flat see-through mesh just above `z`. **Give every prop that stands on the ground one**: the sun's shadow map cannot draw shade that close to a thing (see "How the game shades a model"). `reach`: how high above the ground parts still shade it. |

`export_bpk` bakes occlusion itself if you did not (`ao=False` to forbid, or a dict of `bake_ao` arguments).
Moving parts are baked where they stand at rest: a lid shades the box as if it were always shut.

**Moving parts and anchors**

| | |
|---|---|
| `kit.part(name, objs, pivot, rot, parent_part)` | declares a MOVING PART: a named node the game turns or slides. `pivot` (world) goes on the hinge line or axle; `rot` orients the part so that it turns about ONE of its own axes; `parent_part` nests parts (a prop inside a backrest). Objects not in any part are static and merged. |
| `kit.anchor(name, loc, rot, parent_part, **data)` | a named point with a direction for the game code: a seat, a grip, where the light or the exhaust goes. Forward is its own -Y, up its +Z (like the model). Extra keyword values (numbers, strings, lists, dicts) travel with it. With `parent_part` it rides on that part. |

Naming rules (the names are what game code is written against, so treat a rename as an API change):

- lower case, words joined by `_`: `lid`, `door`, `rudder`, `prop`, `wheel_fl`; sides as `_l` / `_r` seen
  from the model itself (its left is Blender +X);
- the root node has the asset's name, so no part may be called that; node names are unique within an
  asset, anchor names are unique among anchors (a part and an anchor, or a part and a mesh object, may
  share a name);
- anchors say what happens there, not what the thing is: `seat`, `stand`, `grip`, `hand`, `tip`,
  `light`, `exhaust`, `tow`. Put numbers the game needs into the anchor's data or into `meta=` of the
  export, never into game code.

**Levels of detail**

| | |
|---|---|
| `export_bpk(..., lods=[(ratio, distance), ...])` | lighter copies made by decimating each node's geometry: `[(0.4, 14), (0.14, 40)]` keeps 40 % of the triangles beyond 14 m and 14 % beyond 40 m |
| `kit.detail_only(objs, upto=0)` | small things (bolts, stitches, notches) that exist only in levels 0..`upto` and simply vanish in the lighter ones: cheaper and cleaner than decimating them into crumbs |

How to choose: a detail of size s metres covers about `700 * s / d` pixels at d metres on a 1080-line
screen. Switch to level 1 where the bevels and bolts fall under a pixel (2 cm details: about 14 m) and
to level 2 at roughly three times that, where only the silhouette is left; typical ratios are 0.35-0.45
and 0.12-0.15. The distances are for the **medium** preset; the game scales them with `Q.near / 90`
(low x0.67, high x1.4, ultra x1.9) and switches with 6 % slack so that nothing flickers. On **low** a
model that has lighter levels never shows level 0 at all, so level 1 must hold up at arm's length.
Distance is measured to the model's origin. The lighter levels carry no detail textures and no UVs
(unless `lod_detail=True`, or the material has a picture). Things only ever seen close (a tool in the
hand: `assetModel(name, {lod: 0})`) need at most one lighter level for when they lie on the ground;
things seen only from afar need a low ratio, not a high-detail level nobody sees. Always look at the
levels side by side: `__T.studio(name, {lod: [0, 1, 2]})`.

**Export**

`kit.export_bpk(name, objects=None, lods=(), lod_detail=False, ao=True, meta=None, pos_step=None,
normal_bits=10, uv_step=None, optimise=True, out_dir=None)` writes `models/out/<name>.bpk` and returns
statistics (`tris`, `verts` per level, `size`, `bytes`, `prims`, `lost`). `meta` is a free dict for the
game (`kind`, collider sizes, lengths). Positions are stored on a grid of `pos_step` metres (default
0.1 mm, or 4 millionths of the model's size if that is coarser), normals to about 0.2 degrees. A
`WARNING: n triangle(s) vanished` means some triangles are smaller than the grid: drop that detail or
pass a finer `pos_step`. `out_dir` is for test assets that must not ship.

**Previews**

`kit.preview(name, views=('hero', 'hero_back', 'side', 'top'), closeups=None, size=(640, 480), samples=16,
ground=0.0, rest=None, sun=(52, 46), extra=())` renders `build/preview/<name>_<view>.png` with Cycles:
sun and sky, sand-coloured ground, the camera framed on the model, a tone curve close to the game's.

- `views`: names from `hero` `hero_back` `front` `back` `side` `side2` `top` `low` `high` `under`, or
  `(name, azimuth, elevation)` in degrees (azimuth 0 looks at the front, 90 from the model's +X side).
- `closeups={'hinge': (centre, radius)}` or `(centre, radius, azimuth, elevation)`: look closely at a spot.
- `rest=Matrix`: pose the whole model for the pictures only (a spade stuck in the sand, lying down).
- `extra=('ao', 'wire')`: the baked occlusion alone, and the triangles. Look at both once per model.
- A view costs 3-5 s at 640x480 on this machine's CPU, which other people share: use `--quick` while iterating.

The preview material reads the same per-corner layers and detail textures as the game, but it is a path
tracer with real bounce light and real reflections: it flatters. The studio view is the truth.

### Materials

`kit.material(name, color, rough, metal, ...)` makes a material twice: a Blender one for the previews
and the definition that travels to the game.

| field | meaning |
|---|---|
| `color` | base colour (sRGB as written; `kit.linear` for linear). The `Col` layer multiplies it. |
| `rough`, `metal` | 0..1; the starting values of the per-corner roughness and metalness |
| `detail`, `detail_strength`, `detail_scale` | a detail texture: `'wood'` (0.5 x 0.125 m per repeat, grain along U), `'brushed'` (0.2 x 0.05 m), `'weave'` (48 mm), `'grunge'` (0.3 m); strength 0..1; scale enlarges the pattern. Needs UVs in metres: the export stops with a clear message if they are missing. |
| `blend` | `'opaque'`, `'cutout'` (holes where alpha < `alpha_test`: leaves, nets), `'blend'` (see-through: glass), `'add'` (light added to the picture: flames, glows), `'shadow'` (what `ground_shadow` uses) |
| `alpha` | opacity for `blend`; the alpha of the `Col` layer and of a picture multiply it |
| `emissive`, `emissive_strength` | emitted light (sRGB colour x strength). Above about 1 it burns out to white and blooms on medium and higher. |
| `map` | a colour picture registered with `kit.image(name, pixels)` (numpy array, top row first; `fmt`, `wrap='repeat'/'clamp'`): multiplies the base colour, its alpha drives cutout / blend. Uses the mesh's UVs as they are (0..1). A material with a picture gets no detail texture. |
| `coat`, `coat_rough` | clear coat 0..1: gelcoat, varnish, car paint |
| `double_sided` | draw both faces: thin sheets (cloth, leaves, fins) |
| `cast_shadow`, `receive_shadow` | as they say |
| `env` | how much sky the surface mirrors: 1 outdoors, lower for things that live indoors |
| `sway` | metres the wind moves a vertex whose weight is 1 (flags, canvas, fringes); set the weight with `kit.set_pbr(obj, fn=...)`: 0 where it is fastened |
| `own` | `True`: never merged with other materials, never shared between assets, so the game can find it by name and change it (a lamp that switches on, a towel that gets a colour per model) |
| `flags` | a free dict handed to the game untouched |

Use as many materials as the model needs. Materials that are DRAWN the same way (same blend, sides,
shadows, emission, picture, coat, env, sway, flags) are merged into **one draw call per node**, because
colour, roughness, metalness and even which detail texture a vertex uses all travel per vertex. Oak,
steel, paint and rope on one prop are a single draw call. What costs draw calls: every moving part,
every `own` material, glass, cutout, emissive, double-sided and coated surfaces.

Shortcuts: `kit.paint(name, color, gloss)` (gloss 0 chalky .. 1 wet enamel), `kit.plastic(name, color,
rough)`, `kit.fabric(name, color)` (woven; usually wants `double_sided=True`), `kit.gelcoat(name, color)`.

`kit.lib(key, name=None, **overrides)` takes a ready-made material from the shared library `LIB`,
optionally renamed and changed: `kit.lib('teak')`, `kit.lib('steel', 'blade_steel', rough=0.3)`.

| key | colour | rough | metal | detail and extras |
|---|---|---|---|---|
| **timber** | | | | |
| `ash` | `#c9a779` | 0.58 | 0 | wood x 0.9 |
| `oak` | `#a8804f` | 0.62 | 0 | wood |
| `pine` | `#d3b17d` | 0.66 | 0 | wood x 0.8 |
| `teak` | `#9a6a3c` | 0.60 | 0 | wood |
| `teak_grey` | `#9b9388` | 0.82 | 0 | wood x 0.8 |
| `mahogany` | `#6d3a25` | 0.50 | 0 | wood x 0.8 |
| `cedar` | `#b06c43` | 0.66 | 0 | wood |
| `walnut` | `#5b4030` | 0.55 | 0 | wood x 0.8 |
| `driftwood` | `#a59c8f` | 0.90 | 0 | wood x 0.7 |
| `log_bark` | `#5a4636` | 0.95 | 0 | grunge |
| `plywood` | `#c8a777` | 0.70 | 0 | wood x 0.6, scale 1.6 |
| **bare metals** | | | | |
| `steel` | linear 0.56 0.57 0.58 | 0.42 | 1 | brushed |
| `steel_polished` | linear 0.60 0.61 0.62 | 0.20 | 1 | brushed x 0.5 |
| `steel_dark` | linear 0.16 0.17 0.18 | 0.50 | 1 | grunge |
| `stainless` | linear 0.63 0.62 0.60 | 0.28 | 1 | brushed x 0.6 |
| `chrome` | linear 0.55 0.56 0.56 | 0.06 | 1 | none |
| `galvanised` | linear 0.62 0.64 0.66 | 0.48 | 1 | grunge |
| `cast_iron` | linear 0.22 0.22 0.22 | 0.72 | 1 | grunge |
| `aluminium` | linear 0.91 0.92 0.92 | 0.36 | 1 | brushed x 0.5 |
| `brass` | linear 0.89 0.72 0.36 | 0.30 | 1 | brushed x 0.4 |
| `bronze` | linear 0.71 0.48 0.26 | 0.42 | 1 | grunge x 0.6 |
| `copper` | linear 0.95 0.64 0.54 | 0.32 | 1 | brushed x 0.4 |
| `rust` | `#7a4226` | 0.90 | 0.15 | grunge |
| **coatings and plastics** | | | | |
| `rubber` | `#1b1b1c` | 0.85 | 0 | grunge x 0.5 |
| `plastic_black` | `#19191b` | 0.45 | 0 | none |
| `plastic_white` | `#e9e9e6` | 0.42 | 0 | none |
| `gelcoat_white` | `#eeeeea` | 0.22 | 0 | coat 1.0 |
| `enamel_white` | `#ecebe6` | 0.30 | 0 | none |
| `concrete` | `#9b9a94` | 0.92 | 0 | grunge |
| **cloth, rope, leather** | | | | |
| `canvas` | `#d9cfb4` | 0.92 | 0 | weave |
| `canvas_white` | `#efede6` | 0.90 | 0 | weave |
| `rope` | `#b39a6c` | 0.95 | 0 | weave, scale 0.6 |
| `leather` | `#5a3a26` | 0.62 | 0 | grunge x 0.7 |
| `cork` | `#b08a5e` | 0.90 | 0 | grunge |
| **see-through** | | | | |
| `glass` | `#cfe6e6` | 0.04 | 0 | alpha 0.28, blend blend |

Metals are their measured reflectance; wood colours are for clean timber: age them with `coat` and
`wear`, do not make a new grey material. If several models need a material the library lacks, add it to
`LIB` instead of repeating it in scripts.

### The per-corner layers

Every mesh carries three colour layers per face corner (made on demand; `kit.ensure_layers` forces them):

| layer | holds | written by |
|---|---|---|
| `Col` | rgb: a tint that multiplies the material's base colour (white = unchanged; may exceed 1); a: multiplies opacity | `tint`, `vary`, `gradient`, `coat`, `wear`, `dirt` |
| `bpk_pbr` | r: roughness, g: metalness, b: weight (strength of the detail texture, or how far the wind may move the vertex) | starts from the material; `coat`, `wear`, `dirt`, `set_pbr` |
| `bpk_ao` | r: ambient occlusion, 1 = open sky, 0 = buried | `bake_ao` |

plus the face attribute `bpk_edge` left by `kit.bevel`. In the game they arrive as the vertex colour
(base colour x tint, as linear light) and the attribute `bpAux` = (occlusion, roughness, metalness,
weight); each is stored in 64 steps. Because the weight is one channel, a material that both sways and
has a detail texture uses the same number for both.

### How the game shades a model, and what that means for you

Asset materials are three.js standard (or physical, with a clear coat) materials sent through the game's
`patch()`, so they get the island's haze, the underwater absorption and caustics and the HDR
output like everything else, and sit in the picture at the same exposure as code-built geometry.
On top of that the asset shader (`src/15-assets.js`) does four things:

- **Baked occlusion dims sky light fully and sunlight only a little.** Light from the sky, light bounced
  off the ground and reflections are multiplied by the occlusion; direct sun by `mix(1, ao, 0.3)`. A
  crease with occlusion 0.25 keeps 80 % of its brightness in full sun and drops to 10 % in shade
  (measured). So do not expect occlusion to draw dark lines in sunlight, and never paint shade into `Col`
  to force it: use `dirt` for grime, which is colour, and let occlusion be light.
- **Reflections are an analytic sky and ground, not an environment map.** A glossy or metal surface
  mirrors a gradient: deep blue overhead, pale at the horizon, a glow round the sun, and below the
  horizon the ground under the model (sand, turf or water, lit by the sun). There is nothing else to
  reflect: no trees, no cabin, no other parts of the model. A large mirror-smooth surface therefore
  looks like a clean two-tone gradient. Keep chrome and polished metal to small parts, and break large
  glossy surfaces up with roughness variation (`coat`, `wear`, the detail texture) so the highlight has
  something to catch on.
- **The sunlit ground lights the undersides.** Bright sand fills shaded sides and soffits with warm
  light; undersides are not black, so model them.
- **Detail textures give grain without texture memory.** All detail textures of all assets are the layers
  of one 256-pixel array texture; each vertex says which layer it uses. The grey value drives three
  things at once: tone (the base colour is multiplied by up to +-40 %), roughness, and relief (the normal
  is tilted by the slope of the height, a fraction of a millimetre deep). There are **no normal maps and
  no colour textures** beyond that and the optional `map` picture: form must be geometry (bevels, real
  gaps, real bolts), colour variation must be in the corners. That is why bevels are not optional here.
  Detail fades with the per-corner weight, and the lighter levels of detail have none.

Other things to know:

- **The sun's shadow map only reaches surfaces well below the thing that casts the shade** (about 0.7 m
  at midday, more with a low sun; it is tuned for terrain and trees, and absent on quality low). A lounger
  does not shadow the sand directly under it, a bolt does not shadow its plate, a lid does not shadow
  the box. Contact shade is YOUR job: baked occlusion for the model's own nooks, `kit.ground_shadow` for
  the ground under it. A prop without a ground shadow floats.
- **Glass and other see-through materials** are plain alpha blending, drawn after the water, without
  depth writing and sorted per mesh: keep each pane a simple convex piece, do not nest see-through
  shells, and expect no refraction.
- **`'add'` materials** add their light to the picture and fade out in haze; give them an `emissive`
  colour (a lit, non-emissive additive surface is almost invisible in daylight).
- **Under water** everything loses red with depth and vanishes into the murk within some tens of metres;
  saturated accent colours read as blue-grey a few metres down.
- Models that live in the first-person view (tools in the hand) are drawn in a small scene of their own
  with a fixed pair of lights; they still mirror the real sky.

### Using a model in the game

`loadAssets()` runs once at boot before anything is built. After that (all in `src/15-assets.js`;
**everything returns `null` when the pack or the name is missing**, and the game must keep working then):

| | |
|---|---|
| `assetModel(name, opts)` | a new `THREE.Group`; geometries and materials are shared between calls. `opts.static: true` welds the moving parts in place (one draw call per material instead of one per part and material: use it for scenery); `opts.lod`: a fixed level, default automatic; `opts.tint: { materialName: colour }` colours an `own` material for this model; `opts.cast` / `opts.receive: false`; `opts.materials: { name: THREE.Material }` swaps a material; `opts.patch: { key, ... }` adds your own `patch()` options to every material (the cabin's indoor light). `model.userData.nodes[part]` are the moving parts. |
| `assetPose(model, part, rx, ry, rz, slide)` | turns (radians, about the part's OWN axes) and slides (`[x, y, z]` metres) a moving part, counted from where it stands at rest. The part's axes in the game are Blender's with x reversed: a turn about Blender X changes sign, turns about Blender Z (game y) and Blender Y (game z) keep theirs. Use this instead of setting `node.rotation`, which is only right for parts made without a rotation of their own. |
| `assetAnchor(name, anchor)` | `{ position, quaternion, node, data, rest }`: the point in the space of the part it rides on, and `rest.position` / `rest.quaternion` in the asset's own space with nothing moved (what scenery wants). Forward is the anchor's -Z, up its +Y. Do not modify the vectors. |
| `assetAnchorWorld(model, anchor, pos, quat)` | the same point in the world for one model, following the model and its moving parts |
| `assetMeta(name)` | `{ bbox, size, tris, lods, nodes, materials, anchors, meta }` |
| `assetMaterial(name, material)` | the shared `THREE.Material` behind a material name (to switch a lamp's `emissive`, for example) |
| `assetGeometry(name, { node, material, lod, static })` | a raw shared `BufferGeometry` for instancing or a material of your own: attributes `position`, `normal`, `color`, `bpAux`, and `uv`, `bpDid` where textured. `assetGeometries(name, lod)` lists all of them. |
| `assetSetLod(model, level)`, `assetHas(name)` | pin a level; is the asset in the page |

Replacing code-built geometry with a model, driving a part and reading an anchor:

```js
// before:  propMesh([bx(0.6, 0.3, 0.4, C.wood, 0, 0.15, 0)], p.x, gy(p), p.z, yaw);
const crate = assetModel('crate');                       // no { static: true }: its lid is going to move
if (crate) {
  crate.position.set(p.x, groundHeight(p.x, p.z), p.z); crate.rotation.y = yaw;
  scene.add(crate);
  const c = assetMeta('crate').meta.collider;            // sizes come from the model, not from numbers typed here
  WALLS.push({ x: p.x, z: p.z, hx: c.hx, hz: c.hz, rot: yaw, y0: crate.position.y, y1: crate.position.y + c.top });
  CRATE.model = crate;
}
// every frame: open or shut the lid (positive x opens it, see the model's docstring)
if (CRATE.model) assetPose(CRATE.model, 'lid', CRATE.open * 1.9);
// where the hand goes: an anchor that rides on the lid, in world space
const grip = CRATE.model && assetAnchorWorld(CRATE.model, 'grip', CRATE.gripPos);
// facts the artist recorded: the middle of the floor inside (asset space), and how much it holds
const inside = assetAnchor('crate', 'inside');           // inside.rest.position, inside.data.litres
```

Rules on the game side: keep `WALLS`, `COLLIDERS`, `PLATFORMS` and `INTERACT` in step with the model
(read the numbers from `meta` and anchors); use `static: true` for everything nobody animates; for many
copies of one thing (plants, fish, fence posts) build an `InstancedMesh` from `assetGeometry(name,
{ static: true })` and `assetMaterial(...)` instead of many models; never assume an asset is there.
Draw calls, measured on `high`: a static lounger is 3 meshes and 5 calls a frame (colour and shadow
passes), the same lounger with its parts free 7 meshes and 13 calls; the spade 1 mesh, 2 calls.

### Checking sizes, counts and bytes

- The export line and `stats`: size in metres, triangles and vertices per level, draw batches, bytes.
  `kit.bounds()` and `kit.tri_count(objs)` answer the same inside a script, per part if you ask.
- `extra=('wire',)` in `kit.preview` shows where the triangles went. Spend them on silhouettes and on
  what the eye is close to; a flat board needs 12.
- `tools/build.sh` prints a table: triangles at full detail and over all levels, vertices, raw and packed
  bytes, bytes per triangle. The pilots pack to 7-9 bytes per triangle (all levels counted; 24-33 raw).
  Many small parts with hard edges and UV seams cost vertices: prefer `uv_tube`, share smooth edges.
- In the page: `__bpEval("assetMeta('name')")`, the dictionary `__T.studio` returns (size, triangles per
  level) and `__T.stats()` (draw calls and triangles of the last frame).
- On the GPU a vertex takes 49 bytes (position, normal, colour, UV, occlusion/roughness/metalness/weight,
  detail number) plus 2 or 4 bytes per index: about 44 MB for 1 M triangles. Unpacking at boot costs
  about 0.3 s for 500 000 triangles on a desktop.

### The pack format, briefly

A `.bpk` is `'BPK1'`, two u32 lengths, a JSON header and a binary body. The header lists `nodes` (name,
parent, translation `t`, rotation `r` as a quaternion), `materials` (the merged draw batches: `name`,
`src` = the material names merged into it, `blend`, `own`, `map`, `coat`, ...), `prims` (one per node,
batch and level of detail: counts, bounding box and where its arrays are in the body), `lods`,
`anchors`, `images`, `details`, `bbox`, `tris`, `verts`, `meta`. Arrays per primitive: positions (16-bit
steps of `pos_step` from the primitive's own minimum, 32-bit where the primitive is too large for
that), normals (octahedral, 10 bits), UVs (16-bit steps of a quarter texel), colour (sRGB bytes + alpha),
`aux` (occlusion, roughness, metalness, weight), `did` (detail texture number) and indices (16 or 32
bit). Triangles are ordered for the vertex cache and vertices by first use.

`tools/pack_assets.py` bundles all packs into one container (`'BPAK'`, a directory of the headers, one
blob), stores identical images once, renumbers the detail textures into one table, rewrites every array
so that it deflates well (deltas or predictions from the neighbouring triangle, split into byte planes:
29 % smaller for the pilots) and puts the raw-deflated, base64-encoded result into the page as
`<script id="bp-assets" type="application/octet-stream" data-raw="N">`. The loader inflates it with the
browser's `DecompressionStream`, or with its own small inflate where that is missing. Exact layouts: the
docstrings of `pack_assets.py` and `export_bpk`.

`tools/build.sh --assets DIR` (repeatable) also embeds the packs of another folder, `--out FILE` writes
the page elsewhere, `--no-assets` embeds none: for test pages only, a release refuses them.

### The studio view

`__T.studio(name, opts)` (in `tools/testlib.js`, for `tools/snap.sh` runs) shows ONE asset alone under
the game's real sun, sky and final-image pipeline: it hides the rest of the world, lays a wide plain
sand-coloured floor that takes shadows and stands the model on it. A grab then costs 1-2.5 s instead of
5-25 s (the first of a run about 10 s: shaders compile), so looking at a model from six sides is cheap.
`__T.studio(null)` puts the world back.

| option | |
|---|---|
| `lod` | a level (default 0) or `'auto'`; an ARRAY gives one copy per level side by side: `{lod: [0, 1, 2]}` |
| `copies`, `gap` | several in a row |
| `rot` | degrees about the vertical, or `[x, y, z]` degrees (lay a tool down: `[0, 0, 90]`) |
| `light` | turn the model so that the sun stands this many degrees round from its front (0 full on the front, 90 from its Blender +X side, 180 from behind); the hour set in `__T.setup` gives the height |
| `pose` | `{ part: [x, y, z] }` degrees, through `assetPose` |
| `fov` | camera field of view while the studio is on: 30 is close to the Blender previews (the game's own is 75) |
| `grid` | a faint one-metre grid on the floor, for scale |
| `static`, `tint`, `materials`, `patch`, `cast`, `receive` | passed on to `assetModel` |
| `lift`, `at` | `lift: false` puts the origin on the floor instead of the lowest point; `at: [x, z]` another place |

It returns `{ center, radius, fit, size, tris, lods, sunAz, sunEl, ... }`: centre and radius of what it
put there, and `fit`, the distance from which it fills the picture, for `__T.orbit(cx, cy, cz, fit,
azimuth, elevation)`. `__T.studioView(view, zoom, target)` does that for you with the view names of the
Blender previews (`'hero'`, `'side'`, `'top'`, ... or `[azimuth, elevation]`); `zoom` > 1 comes closer;
`target` is an anchor's name or `[x, y, z]` in the asset's game axes to look at one spot. See the steps
file in "A complete example". Look at every model at noon and with a low sun (`hour: 12.5` and `17.5`),
from the front and against the light (`light: 30` and `light: 150`), and on quality `low` as well.

### Art direction (the bar is a modern AAA game: believable, crafted, coherent)

The island is a real, present-day private tropical island seen in first person; the reference is the
prop and material quality of Uncharted 4, Far Cry 6 and Red Dead Redemption 2. Realistic, not stylised.

- **Real proportions and construction.** Model things the way they are built: planks with gaps, logs
  with notched corners, hull strakes, hinges, bolts, cleats, welds, stitched canvas. Look at how the
  real object is put together (find its real measurements) and include the parts that make it read as
  real. Everything at real-world scale: the player's eye is at 1.62 m and will come within 30 cm.
- **No razor edges, no flat boxes.** Bevel every hard edge (2-4 mm on small parts and planks, up to
  10 mm and more on large ones): the bevel is where the highlight, the wear and the dirt live, and there
  are no normal maps to fake it. Use subdivision or proper curves for organic and streamlined shapes,
  give thin parts thickness, let no two boards line up perfectly.
- **Lived-in but cared for.** Sun-bleached and silvered wood on the tops, warm wood in the shelter;
  salt-pitted, scuffed metal with bright edges; paint chipped on the edges and rubbed where hands go;
  coiled rope; rust starting in joints, not everywhere. Build it in layers: base material, `vary`,
  `coat` for the weather, `wear` for use, `dirt` for the nooks. Clean, uniform colour is the look to avoid.
- **Palette.** Natural materials carry the picture; a few saturated accents (teal, coral, navy, cream,
  sunflower yellow) on painted and cloth parts. Chrome and gloss in small doses.
- **Scale**: keep the dimensions the game logic relies on (the module that uses the model documents
  them: hull outline, deck heights, seat and door positions, collision boxes), and record them in `meta`.
- **Moving parts are separate named parts** with the pivot on the hinge or axle (propeller, wheel, door,
  window, rudder, lid). Everything static is merged by the exporter.
- **Budgets** (triangles at full detail): hand tools 3-8k; props 1-6k; a vehicle 40-90k; the cabin with
  interior 120-200k; an instanced tree 2-6k near and under 400 far. All new geometry together should
  stay under about 700k triangles and the page under 12 MB. Fewer, better-placed triangles beat noise.
- **Judge it honestly.** Render previews from several angles and close-ups, look at them, then look at
  it in the studio view and in its place in the game. Iterate until it would not look out of place in
  the reference games.

### Before you call a model done

- [ ] The export line shows the size you meant, in metres, and a triangle count inside the budget; no
      `WARNING` about vanished triangles (or you know which ones and do not miss them).
- [ ] Origin, front (-Y in Blender), part names, anchor names and `meta` are in the script's docstring,
      and the game code reads positions and sizes from anchors and `meta`, not from typed numbers.
- [ ] Every hard edge is bevelled; no face is a flat untextured colour: `vary` / `coat` / `wear` / `dirt`
      have been through it, and the wear is where hands, feet, sand and weather would put it.
- [ ] Everything with a detail texture has UVs in metres with the grain running the right way.
- [ ] Occlusion is baked (with `ground=` if it stands on something); the `ao` preview shows shade in
      joints and under overhangs and no black triangles.
- [ ] It has a `ground_shadow` if it stands on the ground.
- [ ] Each moving part turns about its hinge without cutting through its neighbours: posed in the studio
      (`pose:`) at both ends of its travel.
- [ ] Levels of detail: looked at side by side in the studio (`lod: [0, 1, 2]`); same colour and
      silhouette at the switch distances; small things marked `detail_only`; level 1 is acceptable close up.
- [ ] Studio pictures on `high` and on `low`, at noon and with a low sun, lit from the front and from
      behind: reads as the real thing, nothing glows, nothing is pitch black, highlights sit on the bevels.
- [ ] Pictures in its place in the game, at the distance the player sees it from and at 30 cm; it sits
      on the ground (or in the hand) and matches its neighbours in scale and saturation.
- [ ] `tools/build.sh && tools/check.sh`, then a run on `low`, `medium` and `high` that ends with
      `no console errors`; the bytes-per-triangle column is in line with the other models.
- [ ] The game still boots and plays without the model (`tools/build.sh --no-assets --out build/na.html`).
- [ ] `models/out/<name>.bpk` is committed together with the script.

## Working rules

- Build to `build/` and test there; do not commit `index.html` except for a release.
- Keep each change inside the files of the thing you are working on; touch shared files
  (`10-core.js`, `90-main.js`, `00-head.html`) only when you must, with small edits.
- Never leave the game unable to boot. Before finishing: `tools/build.sh && tools/check.sh`, then a
  browser run that boots the game and prints `no console errors`.
- Low quality and weak phones must keep working: scale detail with `Q`, do not assume a GPU feature
  without a fallback.
