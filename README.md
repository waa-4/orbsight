# Orbsight v0.3.3 — rigid-body rebuild

This version is a deliberate rebuild of locomotion. It removes the old fake walk/ground-clipping approach.

## Important: replace the old project root

This ZIP contains only:
- `index.html`
- `README.md`

For GitHub Pages, replace the old `index.html` with this one. Old `main.js` or `style.css` files are no longer used, so they cannot override the brain.

The page visibly reports:
- Brain: `0.3.3 motor-brain`
- Physics: `cannon-es rigid-body + motorized hinges`
- Runtime build ID

If those values appear, the new code is running.

## Locomotion changes

Each Orbsight now has separate physical bodies for:
- 1 lightweight shell/body
- 4 upper legs
- 4 lower legs
- 4 plantigrade feet

That is 13 rigid bodies per Orbsight.

Each leg has 3 real motorized hinge constraints:
- hip
- knee
- ankle

The brain chooses target angles. Hinge motors apply limited torque. The physics engine decides whether the leg can actually move there.

**Forward movement is never added directly to Orbsight's position.** It only travels when its physical feet push against the ground with friction.

## Floor clipping

The floor is a rigid physics collider. Feet are physical box colliders and the visible feet copy those collider transforms every frame. This is intended to eliminate the repeated visual animation-through-the-floor problem from earlier versions.

## Body weight

The large shell looks heavy but has a mass of only `1.15` physics units. Each limb segment is much lighter. The legs use limited motor force rather than unlimited animation strength.

## Motor learning

Every 7.5 seconds, a gait trial is scored using:
- actual physical distance moved
- uprightness
- collisions
- falls
- energy used
- joint-control error

Better gait genomes are kept. Worse ones are reverted, then mutated again. Each Orbsight learns independently.

## Falling / recovery

Falling is detected from the shell's real physics orientation and height. The motor brain first tries an extended-leg recovery posture. If it still cannot recover after several seconds, the lab resets it upright and heavily penalizes that gait.

## Brain verification

The Brain Event Log shows events such as:
- gait accepted/rejected
- collisions
- eating
- getting stuck
- falling
- recovery

This makes it possible to verify that the newer mind is actually executing instead of only seeing a changed tab title.

## GitHub Pages

Upload `index.html` at the repo root, then enable:

`Settings -> Pages -> Deploy from a branch -> main / root`

Three.js and cannon-es are loaded from pinned jsDelivr modules, so the page needs internet access.
