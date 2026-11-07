# Beach Paradise

A first-person tropical island you can walk around in your browser, on a computer or a phone.
There are no goals, coins or enemies: walk the beach, swim out over the reef, find the hidden
places, sit down and watch the sun set.

Everything is generated in code when the page loads: the island, plants, textures, fish, birds
and all of the sound. The only download is [three.js](https://threejs.org) (r170) from the
jsDelivr CDN.

## Playing it

Open `index.html` in a current browser (Chrome, Edge, Safari or Firefox). Double-clicking the file
works, or serve the folder with any static web server, for example:

```sh
npx serve beach-paradise
# or
python3 -m http.server --directory beach-paradise
```

It needs WebGL 2 and an internet connection the first time (for three.js and the fonts).

### Controls

| | Computer | Phone / tablet |
|---|---|---|
| Walk | `W` `A` `S` `D` or arrow keys | Left thumb (a joystick appears where you touch) |
| Look around | Mouse (click the island to capture it, `Esc` to release) | Drag anywhere on the right side |
| Run | Hold `Shift` | Push the joystick all the way |
| Jump / swim up | `Space` | ▲ button |
| Dive / swim down | `C` (or look down and swim forward) | ▼ button while swimming |
| Sit, lie down, stand up | `E` near a chair, towel, bench, hammock, rock or the dock | The button that appears |
| Drive the motorboat | `E` beside it, then `W`/`S` throttle, `A`/`D` steer, `Shift` full speed, `E` to get out | Joystick, Get out button |
| Ride the river on the inner tube | `E` beside the tube at the waterfall pool, `A`/`D` steer, `W` paddle | Joystick, Get off button |
| Tools | `Q` switches between hands, shovel and stick (or `1` `2` `3`) | Tools button |
| Dig / write | Click (or hold `F`) to dig with the shovel; hold and look around to write with the stick | Dig button, or Draw to start and stop writing |
| Settings | `Esc`, `M` or the button in the top-right corner | Button in the top-right corner |

If the browser does not allow the mouse to be captured (some embedded viewers), hold the mouse
button and drag to look instead.

### Settings

- **Graphics quality**: Low, Medium, High, Ultra. Phones start on Medium, computers on High.
  Quality changes shadows, plant density and draw distance, particles, fish count and resolution.
- **Keep it smooth**: lowers the resolution a little when the frame rate drops.
- Field of view, head bob, look sensitivity, invert look.
- Master, ambience and music volume (the music is a quiet generated soundtrack and can be turned off).
- Time of day, whether time passes, the length of a day (12 to 72 minutes), the weather
  (changes naturally, always clear, cloudy, rain, distant storm, morning mist) and whether place
  names appear when you discover somewhere.

Settings are remembered in your browser.

## What's on the island

- A wide west-facing main beach where you arrive, with beach chairs, a towel, a sandcastle and a
  dock with a rowboat. The sun sets over the sea in front of it.
- A sea with rolling swell, waves that break and wash up the sand, foam, wet sand that dries
  as the water drains away, and clear shallows over a coral garden full of fish. Every couple
  of minutes a set of bigger waves rolls in; they break over you, push you toward the beach and
  splash water onto the screen.
- A river that rises in a spring on the plateau, pours over the cliff as a thick, aerated waterfall
  into a jungle pool, then widens all the way to the sea. It is deep enough to swim in, and its
  current carries you downstream (and over the falls if you let it). A footbridge crosses it.
- A motorboat at the dock that rides over the swell, catches air off waves, leaves a wake and
  can't be driven onto the sand, and an inner tube at the pool for floating the river to the sea.
- A shovel and a driftwood stick. Holes near the sea fill with groundwater, a channel dug from the
  sea or the river fills and flows (and slowly erodes and slumps like real sand), and you can write
  in the sand. Waves wash writing, footprints and dug sand away again near the water.
- Places to find on your own: a hidden cove with a hammock, a summit lookout with a bench, a ring
  of palms around a clearing, a sea arch, a small island across the lagoon and tide pools on the
  rocky east shore.
- A day and night cycle with stars and a moon, changing weather (clouds, rain, storms with
  lightning, morning mist, rainbows after rain), birds, crabs, butterflies and fireflies.

## How it's built

The whole game is `index.html`. The script is organised in numbered sections:

1. Utilities and noise
2. Settings and quality presets
3. Renderer
4. Shared shader code (sky-matched fog, underwater light, shore waves, caustics)
5. Procedural textures
6. Island terrain: coastline field, beaches, mountains, waterfall cliff, stream, pool, trail, tide pools
7. Sky dome with clouds, sun, moon, stars and rainbow
8. Ocean, pools, river and waterfall shaders
9–13. Vegetation: chunked instancing, wind animation, canvas-drawn leaf textures
14–17. Places, props (dock, motorboat, inner tube, footbridge) and rocks
18–19. Coral, seagrass and fish
20. Time of day, lighting and weather
21–22. Wildlife and effects
23. Synthesized sound
24. Living sand: 32 m chunks at 0.5 m resolution that refine the island where the river runs and
    where you dig, a small shallow-water simulation (pipe model) fed by the river, the sea and
    groundwater with erosion and sand slumping, and a 7 cm texture for footprints and writing
25–28. Waves that hit you, the motorboat, the inner tube ride, and the shovel and stick
30–35. Input, player (walking, wading, swimming, diving, sitting), camera, interface, main loop

The sea surface the player swims in is computed with the same wave maths on the CPU as in the
ocean shader, so what you see and where you float agree.
