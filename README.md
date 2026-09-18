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
