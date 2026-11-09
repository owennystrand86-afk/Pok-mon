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
| Drive the submarine | Walk the floating walkway from the end of the dock and press `E` by the sub: you climb up the sail and down the hatch into the control room. `W`/`S` drive, `A`/`D` turn, `Space` rise, `C` dive, `Shift` faster, `V` (or the View button at the top of the screen) switches between the control room, the bow camera and a view from outside, `X` sonar, `R` radar, `L` lights. `E` stands you up to walk round the control room; `E` at the chair to drive again, at the ladder to climb out of the hatch | Joystick, ▲▼ to rise and dive, View and Sonar buttons |
| Hot tub and pool | Out of the cabin's back door onto the deck. `E` at the power box opens its controls: power, bubbles, jets (low or high), the heater (26–40 °C), draining and filling the tub and the pool, and the underwater lights. `E` by the tub to sit in it; in the pool or the tub, `E` (or `Space`) climbs you out onto the deck | The button that appears, ▲ to climb out |
| Drain pump | `E` on the yellow pump by the cabin's back door to pick it up (its hose comes with it); click (or `F`) to set it down, best in some water. You're then holding the hose, which pays out as far as you walk: take it where you want the water to go and click to set it down. While the pump is under water it pumps. `E` on the hose's end to move it, or pick the pump up again to move both | Pick up, then Place |
| Drive the motorboat | `E` beside it, then `W`/`S` throttle, `A`/`D` steer, `Shift` full speed, `L` headlights, `E` to stand up on the deck (or step onto the dock). Walk around the deck, jump over the side to swim, `E` near the helm to drive again; from the water, swim up to the boat and press `Space` to climb aboard. Drive up the river from the sea and straight at the bottom of the waterfall to climb it | Joystick, Lights button, Get out button |
| Ride the river on the inner tube | `E` beside the tube at the waterfall pool, `A`/`D` steer, `W` paddle | Joystick, Get off button |
| Tools | `Q` switches between hands, shovel, bucket, stick, fishing rod, surfboard and storm lantern (or `1`–`7`); in the boat, between hands, the rod and the lantern | Tools button |
| Lantern | With the lantern (`7`): click (or `F`, or `L`) to light it or put it out. On or beside the boat, click to hang it from the T-top; `E` beside it (or click again with the lantern selected) takes it back | Light / Hang / Take button |
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
  arriving as straight walls. Each wave slows and bunches up as the water shallows, grows taller,
  steepens until its glassy face glows green-blue, pitches its lip forward and throws spray, then
  rolls in as a churning white bore that tears into patches and lace and rushes up the sand. The
  sea's mesh is pinned to the world and gets finer around you, so the waves never shimmer or pop
  as you move. Clear shallows over a coral garden full of
  fish. You see the sand and coral through the water, bent by the waves; foam breaks
  up into lace and bubbles as it thins; the sun glitters on the ripples. Around you the water
  really moves: swimming, wading, the boat, splashes and raindrops all leave rings and foam, and
  splashes throw droplets that fall back into the water. Every couple of minutes a set of bigger
  waves rolls in; they break over you, push you toward the beach and splash water onto the screen.
- A river that rises in a spring on the plateau, pours over the cliff as a thick, aerated waterfall
  into a jungle pool, then runs down to the sea as a mountain stream: calm, clear pools where you
  can see the bottom, each spilling into the next down a short white cascade. The ripples
  stream along with the current, slow boils drift down the calm runs, and standing waves hold
  still in the chutes while the water races through them. It is deep enough to swim in, and its
  current carries you downstream (and over the falls if you let it). A footbridge crosses it.
- A six-metre centre-console motorboat at the dock. You can drive it up the river from the sea
  (the banks steer you back to the middle) and, if you hit the bottom of the falls fast, it climbs
  the waterfall onto the river above. The boat: a deep-V hull in glossy gelcoat with painted
  stripes, a teak deck, a T-top, stainless rails, gauges, a wheel and throttle that move, navigation
  lights and an outboard whose propeller spins. It floats on eight points along its hull, so it
  pitches and rolls over the swell, leans into turns, rises onto the plane, catches air off waves
  and slams back down; the sea never shows inside the hull. Its deck is solid: stand up from the
  helm and walk around the console while it rolls under you, step down onto it from the dock, or
  climb back aboard from the water. Two headlights on the bow light up the sea ahead at night,
  with beams you can see in the mist and rain. An inner tube waits at the pool for floating the
  river to the sea.
- A storm lantern to carry at night: its flame flickers and lights the sand, the trees and the
  water around you, glinting on the ripples. Hang it from the boat's T-top and it swings with the
  boat as it rolls. Other players see your lantern and your headlights too.
- A tall volcanic mountain with knife-edge ridges and gullies, clouds caught on its summit, and the
  waterfall pouring 55 m down its cliff into the jungle pool; the river below runs through a valley
  in pools and short cascades, with spray and mist where each one drops.
- A wider world: six more islands kilometres out to sail, fly or dive to: Volcano Isle (black sand
  and a smoking crater), Lighthouse Rock (its beam sweeps the sea at night), the Coral Atoll round
  its turquoise lagoon, Shipwreck Cay with a wreck on its reef, the Twin Palms and Mesa Island
  behind its cliffs. Beyond the island's shelf the sea floor falls away hundreds of metres.
- The cabin: a fieldstone foundation, a wide staircase with handrails and lanterns, a green metal
  roof, flower boxes, a woodpile and stepping stones down to the beach; inside, a bigger fire whose
  flickering light fills the room. Indoors, the outside sounds muffled, less so the nearer you are
  to an open door or window.
- A back deck with a log-edged swimming pool and a cedar hot tub that spills into it: bubbles,
  jets, steam on a cool night, underwater lights, and a power box to run it all (other players
  see your settings). A drain pump on a hose that pays out as far as you take it, lies on the ground, drapes over edges and
  wraps round walls and trees; drop the pump in the pool and lay the hose to the sea to drain it,
  or the other way round to fill it, or onto the sand where the water soaks in and runs.
- Digging with the shovel cuts the grass, which flies off in clippings.
- Tsunamis on request: far out the sea rises, the water drains back off the beach and exposes the
  seabed, then the swell steepens as it reaches the shallows into a wall of water with a
  tumbling white roller on its crest that breaks over the sand, knocks you over, sweeps you
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
- A 36-metre black submarine at the end of a floating walkway: anechoic tiles over the hull, a sail
  with diving planes, cruciform rudders and a seven-bladed bronze propeller. You climb up the sail
  and down the ladder into the control room: a screen showing the bow camera's picture, a sonar
  screen that maps the sea floor ahead and anything swimming there, a radar screen of the land,
  boats, sharks and dolphins around you, a depth readout and a brass pressure gauge. Drive it from
  the control room, through the bow camera, or watch it from outside. It dives fast; every 10 m
  down is another atmosphere on the gauge, the hull is rated to 1,200 m and gives way past 1,450,
  and the Abyss, a sinkhole south-west of the island, goes down over 1,600 m.
- Out past the reef the sea floor drops into a trench nearly half a kilometre deep, pitch black
  apart from your searchlights and glowing plankton. Opening the hatch deeper than 40 m crushes you.
  With sonar on, the bow camera shows the trench walls and any animals as glowing contours.
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
