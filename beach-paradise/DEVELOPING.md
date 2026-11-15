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
  named scene object).
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

Models are built by Python scripts in `models/` using Blender's `bpy` (no interactive Blender), so
every asset is reproducible and reviewable. One script per asset; shared code in `models/lib/`.

Pipeline (see `models/lib/` and `tools/pack_assets.py` for the exact formats and API):

1. `models/<name>.py` builds the model in Blender, renders preview images to `build/preview/`, and
   exports `models/out/<name>.bpk` (a compact quantised mesh pack).
2. `tools/build.sh` packs all `.bpk` files into the page (deflated, base64).
3. At boot the game unpacks them (`src/15-assets.js`); modules ask for their models by name.

### Art direction (the bar is a modern AAA game: believable, crafted, coherent)

- **Real proportions and construction.** Model things the way they are built: planks with gaps,
  logs with notched corners, hull strakes, hinges, bolts, cleats, welds, stitched canvas. Look at how
  the real object is put together and include the parts that make it read as real.
- **No razor edges, no flat boxes.** Bevel hard edges (2-10 mm on small parts, more on large), use
  subdivision or proper curves for organic and streamlined shapes, add thickness to thin parts.
- **Scale**: 1 Blender unit = 1 m. Keep the dimensions the game logic relies on (the existing module
  documents them in code: hull outline, deck heights, seat and door positions, collision boxes).
- **Axes**: model in Blender's Z-up, facing -Y forward; the exporter converts to the game's Y-up,
  -Z forward. Put the origin where the game expects the pivot (documented per asset).
- **Moving parts are separate named objects** with their origin on the hinge/axle (propeller, wheel,
  doors, windows, rudder, lids …). Everything static is merged per material by the exporter.
- **Materials**: physically based. Use the shared material library (wood species, painted and bare
  metals, chrome, rubber, glass, canvas, rope, gelcoat, plastics). Vary colour within a material with
  vertex colours (wear, sun-bleaching, dirt in crevices, plank-to-plank variation). Bake ambient
  occlusion into vertex colours.
- **Budgets** (triangles, for the highest detail level): hand tools 3-8k; props 1-6k; a vehicle
  40-90k; the cabin with interior 120-200k; an instanced tree 2-6k near and under 400 far. Total new
  geometry should stay under about 700k triangles, and the page under 12 MB. Fewer, better-placed
  triangles beat noise: spend them on silhouettes and on what the player's eye is close to.
- **Check your work visually**: render previews from several angles and close-ups, look at them,
  and iterate until it would not look out of place in a AAA game. Then check it in the game.

## Working rules

- Build to `build/` and test there; do not commit `index.html` except for a release.
- Keep each change inside the files of the thing you are working on; touch shared files
  (`10-core.js`, `90-main.js`, `00-head.html`) only when you must, with small edits.
- Never leave the game unable to boot. Before finishing: `tools/build.sh && tools/check.sh`, then a
  browser run that boots the game and prints `no console errors`.
- Low quality and weak phones must keep working: scale detail with `Q`, do not assume a GPU feature
  without a fallback.
