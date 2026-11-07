# Beach Paradise

A first-person tropical island you can walk around in your browser, on a computer or a phone.
You wake up in a log cabin above the beach. There are no goals, coins or enemies: walk the beach,
swim out over the reef, find the hidden places, sit down and watch the sun set, or curl up by the
fire while the rain runs down the windows.

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
| Sit, lie down, stand up | `E` near a chair, sofa, window seat, towel, bench, hammock, rock or the dock | The button that appears |
| Sleep | `E` at the cabin bed: at night you sleep until morning, by day you take a two-hour nap | The button that appears |
| Kettle, fire | `E` at the stove puts the kettle on; `E` at the fireplace lights it or lets it burn down | The button that appears |
| Drive the motorboat | `E` beside it, then `W`/`S` throttle, `A`/`D` steer, `Shift` full speed, `E` to get out | Joystick, Get out button |
| Ride the river on the inner tube | `E` beside the tube at the waterfall pool, `A`/`D` steer, `W` paddle | Joystick, Get off button |
| Tools | `Q` switches between hands, shovel, bucket and stick (or `1` `2` `3` `4`) | Tools button |
| Dig / scoop / write | Click (or hold `F`) to dig with the shovel; click to fill the bucket from the sea, the river or a pool you dug, and again to pour it out; hold and look around to write with the stick | Dig, Scoop / Pour, or Draw to start and stop writing |
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
- **Sea**: wave size (from glassy to big surf), tsunami size (about 4, 7 or 11 m), a button that
  sends a tsunami toward the main beach, one that calms the sea again, and one that brings the
  boat back to the dock.
- **Tools**: shovel power, from small careful scoops to huge ones.
- **Back to the cabin** puts you back where you started.

Settings are remembered in your browser.

## What's on the island

- A log cabin on stilts behind the main beach, where you start: a living room with a stone
  fireplace, sofa and a window seat looking out to sea, a kitchen with a stove, kettle and shelves,
  a dining table, a bedroom with a bed you can sleep in, and a porch with chairs and string lights.
  Sunlight only comes in through the windows and the open door, lamps come on in the evening, the
  fire crackles at night, and when it rains the drops bead and run down the glass while the rain
  drums on the roof.
- A wide west-facing main beach in front of it, with beach chairs, a towel, a sandcastle and a
  dock with a rowboat. The sun sets over the sea in front of it.
- A sea with rolling swell, waves that break and wash up the sand, foam, wet sand that dries
  as the water drains away, and clear shallows over a coral garden full of fish. Every couple
  of minutes a set of bigger waves rolls in; they break over you, push you toward the beach and
  splash water onto the screen.
- A river that rises in a spring on the plateau, pours over the cliff as a thick, aerated waterfall
  into a jungle pool, then widens all the way to the sea. It is deep enough to swim in, and its
  current carries you downstream (and over the falls if you let it). A footbridge crosses it.
- A six-metre centre-console motorboat at the dock: a deep-V hull in glossy gelcoat with painted
  stripes, a teak deck, a T-top, stainless rails, gauges, a wheel and throttle that move, navigation
  lights and an outboard whose propeller spins. It floats on eight points along its hull, so it
  pitches and rolls over the swell, leans into turns, rises onto the plane, catches air off waves
  and slams back down; the sea never shows inside the hull. An inner tube waits at the pool for
  floating the river to the sea.
- Tsunamis on request: far out the sea rises, the water drains back off the beach and exposes the
  seabed, then a wall of water with a white crest breaks over the sand, knocks you over, sweeps you
  and the boat inland and floods the low ground with churning brown water before it drains away.
  The cabin stays dry.
- A shovel, a bucket and a driftwood stick. Holes near the sea fill with groundwater, a channel dug
  from the sea or the river fills and flows (and slowly erodes and slumps like real sand), poured
  water soaks in and leaves wet sand that dries over a minute or two or collects in what you dug,
  and you can write in the sand. Waves wash writing, footprints and dug sand away again near the
  water. A bucket of water also puts out the fire.
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
14–17. Places, props (dock, inner tube, footbridge) and rocks; 16b. the motorboat and its hull physics
18–19. Coral, seagrass and fish
20. Time of day, lighting and weather
21–22. Wildlife and effects
23. Synthesized sound
24. Living sand: 32 m chunks at 0.5 m resolution that refine the island where the river runs and
    where you dig, a small shallow-water simulation (pipe model) fed by the river, the sea and
    groundwater with erosion and sand slumping, and a 7 cm texture for footprints and writing
25–28. Waves that hit you, driving the boat, the inner tube ride, and the shovel, bucket and stick
29. The log cabin: log walls, furniture, window glass with running rain, lamps and fire light,
    a sun mask that only lets light in through the openings, sleeping
30. Tsunamis
30–35. Input, player (walking, wading, swimming, diving, sitting), camera, interface, main loop

The sea surface the player swims in is computed with the same wave maths on the CPU as in the
ocean shader (tsunami included), so what you see and where you float agree.
