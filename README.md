# Orbsight v0.13 — Rapier Joint Rebuild

Stable filenames from now on:
- index.html
- main.js
- physics.js
- mind.js
- world.js
- README.md

## Why this rebuild exists
The Cannon-based versions repeatedly curled their legs despite:
- velocity limit guards
- collision spacing
- redesigned geometry
- explicit anti-curl brain rules

The root problem was that Cannon's HingeConstraint did not give this project the hard lower/upper
angular stops it needed. The project accumulated scripts trying to imitate anatomy.

## New physics foundation
v0.13 moves creature physics to Rapier 3D.

Each leg uses actual revolute joints with Rapier-enforced limits:
- spread
- hip
- knee
- ankle
- foot roll

The brain still chooses motor targets, but Rapier is the final authority on whether a joint may
rotate any farther.

## Geometric leg construction
Leg segments are created from actual hip → knee → ankle geometry. All segments begin with the same
outward splay rotation so their local revolute axes align correctly.

The body plan is:
shell → spread joint → hip mount → hip joint → upper leg → knee → lower leg → ankle → foot roll → foot

## 3-second newborn settling period
For the first three simulated seconds:
- learning is paused
- babbling is paused
- neutral joint targets are used
- gravity and the real joint limits are allowed to settle the skeleton

After settling, normal developmental learning begins.

## Mind simplification
v0.13 removes the giant anti-curl brain subsystem. The skeleton should physically prevent impossible
curling, so the mind can focus again on:
- body discovery
- support
- crawling
- weight transfer
- stepping
- walking
- free locomotion

## Preserved
- 0.5x–15x simulation speed
- freecam
- remove selected
- mattresses/sleep
- thought bubbles
- preset communication
- motor babbling
- local evolutionary policy mutation
- expanded terrain and physics objects

## Note
The browser imports `@dimforge/rapier3d-compat` 0.20.0 from jsDelivr. The compat build embeds its
WASM, which is convenient for GitHub Pages.


# v0.13.1 — Stance + Movement Fix

The first Rapier build had two practical problems:
1. The feet spawned roughly 0.2 blocks above the ground, so every Orbsight visibly dropped at birth.
2. Joint motors were too soft to reliably hold the shell's weight, so after the drop the legs often
   stayed collapsed and the learning policy had very little useful movement to work with.

Changes:
- shell/body spawns lower so feet begin essentially on the floor
- neutral knee target is straighter and more load-bearing
- Rapier motor stiffness/damping increased substantially
- foot friction increased
- 2-second settling period instead of 3 seconds
- added a body-height/fall support reflex that extends the legs when the shell is collapsing
- support reflex does NOT choose direction; it only resists falling
- stronger body-discovery babbling and wider legal exploration ranges
- early crawling/translation gets more immediate reward

Stable filenames are unchanged:
index.html / main.js / physics.js / mind.js / world.js


# v0.13.2 — Motor Calibration / Proof of Life

This build adds a diagnostic developmental phase because v0.13.1 could look completely inert.

- 0–2s: neutral settling
- 2–8s: each leg gets obvious safe joint sweeps, one leg at a time
- after 8s: normal learned motor experimentation

Rapier hard limits remain final authority. Motors now use target position + target velocity and a small equal/opposite physical torque impulse as muscle assist. No teleporting is used.

The pupil also scans independently every rendered frame, restoring the visible eye movement lost during the Rapier rewrite.

Stable filenames remain index.html / main.js / physics.js / mind.js / world.js.
