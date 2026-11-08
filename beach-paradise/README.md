# Beach Paradise

A first-person tropical island you can walk around in your browser, on a computer or a phone.
You wake up in a log cabin above the beach. There are no goals, coins or enemies: walk the beach,
swim out over the reef, find the hidden places, sit down and watch the sun set, or curl up by the
fire while the rain runs down the windows.

When other people have the island open at the same time, you are on it together: you see each
other walking, swimming, sailing, flying and diving, with names over your heads.

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
| Door and windows | Look at the cabin door or a window and press `E` to open or close it | The button that appears |
| Fly the biplane | `E` beside it on the beach, then `W`/`S` throttle, mouse or arrow keys for the stick (pull back to climb), `A`/`D` roll; land gently on the wheels and press `E` to climb out | Joystick for the stick (push forward to dive), ▲▼ throttle, drag to look around |
| Drive the submarine | `E` beside it at the dock, then `W`/`S` drive, `A`/`D` turn, `Space` rise, `C` dive, `X` sonar, `L` lights, `E` to open the hatch | Joystick, ▲▼ to rise and dive, Sonar button |
| Drive the motorboat | `E` beside it, then `W`/`S` throttle, `A`/`D` steer, `Shift` full speed, `E` to get out. Drive up the river from the sea and straight at the bottom of the waterfall to climb it | Joystick, Get out button |
| Ride the river on the inner tube | `E` beside the tube at the waterfall pool, `A`/`D` steer, `W` paddle | Joystick, Get off button |
| Tools | `Q` switches between hands, shovel, bucket, stick, fishing rod and surfboard (or `1`–`6`); in the boat, between hands and the rod | Tools button |
| Surf | With the surfboard (`6`): wade or swim out and click (or `F`) to hop on, `W` paddle, `A`/`D` turn; when a wave picks you up press `Space` to stand, then `A`/`D` carve, `W` pump, `S` slow, `C` lie back down, `E` get off | Hop on button, joystick, ▲ to stand, ▼ to lie down |
| Fish | With the rod: hold the mouse button (or `F`) to wind up a cast and let go to throw; click when the bobber dips; hold to reel and ease off when the line goes red | Cast, then Reel |
| Fish journal | `J` | Settings, Fish journal |
| Dig / scoop / write | Click (or hold `F`) to dig with the shovel; click to fill the bucket from the sea, the river or a pool you dug, and again to pour it out; hold and look around to write with the stick | Dig, Scoop / Pour, or Draw to start and stop writing |
| Settings | `Esc`, `M` or the button in the top-right corner | Button in the top-right corner |

If the browser does not allow the mouse to be captured (some embedded viewers), hold the mouse
button and drag to look instead.

### Settings

- **Graphics quality**: Low, Medium, High, Ultra, Max 4K. Phones start on Medium, computers on High.
  Ultra and Max add real reflections of the island, palms and boats in the sea; Max draws at your
  screen's full resolution (4K on a 4K screen) with the finest ocean and never lowers the
  resolution to keep the frame rate up, so it can be slow.
  Quality changes shadows, plant density and draw distance, particles, fish count and resolution;
  Low also turns off the see-through water and the glow.
- **Glow on bright light**, **Water look** (tropical, crystal clear or deep ocean blue) and **Sky**
  (natural light, a physically based sky, or the painted one).
- **Keep it smooth**: lowers the resolution a little when the frame rate drops.
- Field of view, head bob, look sensitivity, invert look.
- Master, ambience and music volume (the music is a quiet generated soundtrack and can be turned off).
- Time of day, whether time passes, the length of a day (12 to 72 minutes), the weather
  (changes naturally, always clear, cloudy, rain, distant storm, thunderstorm, windy, hurricane,
  morning mist), wind strength, and whether place names appear when you discover somewhere.
- **Sea**: wave size (from glassy up to monster surf six times the normal size; bigger waves start
  breaking further out), tsunami size (about 4, 7, 11, 20 or 34 m) and
  speed (up to three times as fast), buttons that send a tsunami toward the main beach, calm the
  sea again, bring the boat, plane and sub back, and repair the island after a tsunami.
- **Tools**: shovel power, from small careful scoops to huge ones.
- **Back to the cabin** puts you back where you started. **Fish journal** opens the journal.

Settings are remembered in your browser.

## What's on the island

- A log cabin on stilts behind the main beach, where you start: a living room with a stone
  fireplace, sofa and a window seat looking out to sea, a kitchen with a stove, kettle and shelves,
  a dining table, a bedroom with a bed you can sleep in, and a porch with chairs and string lights.
  The door and every window open and close. Sunlight only comes in through the windows and the
  open door, lamps come on in the evening, the fire crackles at night, and when it rains the drops
  bead and run down the glass while the rain drums on the roof (louder with the windows open).
- A wide west-facing main beach in front of it, with beach chairs, a towel, a sandcastle and a
  dock with a rowboat. The sun sets over the sea in front of it.
- A sea with rolling swell and breaking waves that peak and peel along their crests instead of
  arriving as straight walls, washing up the sand, and clear shallows over a coral garden full of
  fish. You see the sand and coral through the water, bent by the waves; foam breaks
  up into lace and bubbles as it thins; the sun glitters on the ripples. Around you the water
  really moves: swimming, wading, the boat, splashes and raindrops all leave rings and foam, and
  splashes throw droplets that fall back into the water. Every couple of minutes a set of bigger
  waves rolls in; they break over you, push you toward the beach and splash water onto the screen.
- A river that rises in a spring on the plateau, pours over the cliff as a thick, aerated waterfall
  into a jungle pool, then runs down to the sea as a mountain stream: calm, clear pools where you
  can see the bottom, each spilling into the next down a short white cascade. It is deep enough to swim in, and its
  current carries you downstream (and over the falls if you let it). A footbridge crosses it.
- A six-metre centre-console motorboat at the dock. You can drive it up the river from the sea
  (the banks steer you back to the middle) and, if you hit the bottom of the falls fast, it climbs
  the waterfall onto the river above. The boat: a deep-V hull in glossy gelcoat with painted
  stripes, a teak deck, a T-top, stainless rails, gauges, a wheel and throttle that move, navigation
  lights and an outboard whose propeller spins. It floats on eight points along its hull, so it
  pitches and rolls over the swell, leans into turns, rises onto the plane, catches air off waves
  and slams back down; the sea never shows inside the hull. An inner tube waits at the pool for
  floating the river to the sea.
- Tsunamis on request: far out the sea rises, the water drains back off the beach and exposes the
  seabed, then a wall of water with a white crest breaks over the sand, knocks you over, sweeps you
  and the boat inland and floods the low ground with churning brown water before it drains away.
  It scours the land it runs over (the beach can be planed down to almost sea level), snaps palms
  and trees into pieces (trunks, fronds, branches, coconuts) that tumble and float away on the
  flood, and a big enough one tears the cabin apart into floating logs, boards and
  furniture. **Repair the island** puts everything back.
- Trees growing at the edge of a channel you dig or the river washes out lose their footing and
  fall into the water and drift off.
- A surfboard: paddle out past the break, turn for the beach as a set comes in, paddle to catch a
  wave and stand up. Angle along the face to ride it, pump for speed and carve; go straight down a
  big one and you nose-dive, let the lip catch you and you wipe out, turn too hard and you fall.
  Your ride time and best ride are shown when you come off.
- Big animals out on the water: blacktip, tiger and hammerhead sharks, a pod of dolphins that leap,
  sea turtles, manta rays and a whale shark. They gather round when you're out in the boat or
  swimming, and none of them attack.
- An open-cockpit biplane on the beach. Take off along the sand, loop around the island, and land
  it gently. Touch the sea and it sinks to the bottom (bring it back from the settings); fly it into
  the ground and it explodes in a fireball and burning wreckage.
- A little research submarine at the dock with a glass bubble nose. Out past the reef the sea floor
  drops into a trench nearly half a kilometre deep, pitch black apart from your searchlights and
  glowing plankton. The pressure gauge climbs past 40 atmospheres; the hull is rated to 400 m and
  gives way past 450, and opening the hatch deeper than 40 m crushes you. Sonar shows the trench
  walls and any animals around you as glowing contours.
- Fishing with 36 kinds of catch, from sardines and bass to tarpon, marlin, bluefin tuna,
  hammerheads, tiger sharks and great whites (and the odd old boot). What bites depends on where
  the bobber lands (shallows, open sea, the reef, the river or the falls pool), the time of day and
  the weather; dawn and dusk are best. Fight the fish by keeping the line tension up without
  snapping it. Fish leap out of the water as you fight them, and you hold up each catch for a moment
  before it goes in the fish journal with your biggest of each.
- Weather you can see: streaks of wind, leaves and sand blowing past, spray torn off the wave tops,
  palms and trees bending harder the stronger it blows, raindrops bursting on the ground and running
  off the roof, and in a thunderstorm real branching bolts striking close by.
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
8. Ocean, pools, river and waterfall shaders (the waterfall is one sheet from the river surface over
   the lip into free fall); 8c. glow on bright light; 8b. water effects: refraction (the frame is drawn
   without water, copied, and the water bends it), a GPU ripple simulation around the camera, a
   foam texture, and spray droplets drawn as streaks
9–13. Vegetation: chunked instancing, wind animation, canvas-drawn leaf textures; 13b. a lawn of
    individual grass blades placed around the camera in the shader
14–17. Places, props (dock, inner tube, footbridge) and rocks; 16b. the motorboat and its hull
    physics; 16c. the biplane and its flight model; 16d. the submarine, the trench, sonar; 16e. surfing
18–19. Coral, seagrass and fish; 19b. sharks, dolphins, turtles, rays and a whale shark
20. Time of day, lighting and weather; 20b. wind streaks, blown leaves and sand, sea spray, rain
    splashes, roof drips and branching lightning
21–22. Wildlife and effects
23. Synthesized sound
24. Living sand: 32 m chunks at 0.5 m resolution that refine the island where the river runs and
    where you dig, a small shallow-water simulation (pipe model) fed by the river, the sea and
    groundwater with erosion and sand slumping, and a 7 cm texture for footprints and writing
25–28. Waves that hit you, driving the boat, the inner tube ride, and the shovel, bucket and stick
29. The log cabin: log walls, furniture, window glass with running rain, lamps and fire light,
    a sun mask that only lets light in through the openings, sleeping
29b. Fishing and the fish journal
30. Tsunamis; 31. what they leave behind; 31b. trees breaking into pieces (terrain erosion, flattened plants, the cabin wrecked)
36. Multiplayer through the claude.ai room (each player shares where they are about eight times a
    second; everyone else sees a figure, their vehicle and their name)
32–35. Input, player (walking, wading, swimming, diving, sitting), camera, interface, main loop

The sea surface the player swims in is computed with the same wave maths on the CPU as in the
ocean shader (tsunami included), so what you see and where you float agree.
