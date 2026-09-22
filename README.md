# Orbsight v0.17 — Debug Panel + Binary Orbsight Files

Stable engine filenames are STILL unchanged:
- index.html
- main.js
- physics.js
- mind.js
- world.js
- README.md

## Debug Panel

The new Debug Panel always edits only the selected Orbsight.

It contains more than 40 controls, including:
- walking tutor
- crawling tutor
- grip / stand / balance teaching
- max/reset learning
- muscle strength +/- / max / newborn
- fatigue clear / exhaust
- energy / hunger controls
- sleep / wake
- whole-leg relax / plant / lift / push / pull
- individual reach tests for all four legs
- ground grip / release grips
- body velocity stop / nudges
- personality editing
- forced developmental phases
- brain freeze
- motor-policy randomization
- +50 generations

Tutor modes are temporary debug demonstrations. They do not replace the normal movement system.

## Pure binary `.orb` files

Every Orbsight can now be exported as its own `.orb` file.

The file contains ONLY `1`, `0`, spaces, and line breaks.

Each group is 8 bits:
`01001111 01010010 01000010 00010001 ...`

Each bit has the normal binary positional weight inside its byte:
128, 64, 32, 16, 8, 4, 2, 1.

The fixed schema stores:
- binary magic + format version
- name
- source ID
- age
- energy and hunger
- personality
- generation and best score
- developmental phase
- body-map / crawl / grip / support / balance / step / walk skills
- successful pulls / plants
- motor-policy frequency + gain + phase
- all current learned policy weights
- each leg's current action and primitive memories
- all 20 joint muscle strengths
- all 20 joint fatigue values
- learned body-model forward/lift/support effects
- body-model sample counts

## Editing bits manually

Open Debug Panel -> Binary Orbsight file.

`Refresh bits` writes the selected Orbsight into the text box.
You can manually flip bits, then press `Apply edited bits`.

Invalid magic/version or incomplete bytes are rejected instead of corrupting the creature.

## Import / export

- `Export selected .orb` downloads the selected individual.
- `Import .orb as new` creates another Orbsight from the file.
- `Load .orb into selected` replaces the selected Orbsight's learned/personality/muscle data.
- Clone creates another creature by round-tripping through the same binary format.

This means an Orbsight is now portable as a compact binary-state creature file rather than only
existing inside the running page.


## v0.17.1 Debug Panel visibility fix

The v0.17 Debug Panel was placed at the very bottom of the scrollable sidebar. The toggle could
open it without changing anything visible near the button, which made it look like the button did
nothing.

v0.17.1 fixes that by:
- moving the Debug Panel directly under Simulation
- auto-scrolling the opened panel into view
- changing the button label to `Close Debug`
- adding a Close button inside the panel
- adding `aria-expanded`
- writing a visible Debug Panel opened message

No movement, binary `.orb`, or learning data format changed.
Stable filenames remain unchanged.


## v0.17.2 Floating Debug Window

The Debug Panel is no longer part of the sidebar layout.

Clicking `Debug Panel` now opens a desktop-style floating window centered over the simulation.

Features:
- always initially centered on screen
- high z-index above the Three.js canvas and sidebar
- draggable by its title bar
- resizable using the browser resize handle in the bottom-right corner
- minimum and maximum sizes prevent it from disappearing
- `Center` button restores it to the middle
- `Close` button and Escape close it
- position is kept while it remains open/closed during the session
- window-edge safety recenters it after browser resizing if it ends up mostly offscreen

All v0.17 binary `.orb` and 40+ debug controls are unchanged.
Stable repo filenames are unchanged.
