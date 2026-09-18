# Orbsight v0.11 — Leg Architecture Rebuild

This is not another anti-fold patch. The leg body plan itself was changed.

## Engine files
- index.html
- main-v011.js
- physics-v011.js
- mind-v011.js
- world-v011.js

## New leg architecture
- hips mount farther out from the shell
- upper/lower segments begin farther outward instead of nearly under the body
- feet are larger and more plantigrade
- knee range is reduced so the leg can bend deeply but not tuck into a near-paperclip
- ankle/roll ranges are smaller
- resting stance biases slightly outward/downward
- passive outward hip/foot spring acts like anatomy, not navigation

## Anti-curl support rule
A foot that is both:
- very close to the shell
- attached to a deeply flexed knee

does not count as a useful support contact.

This prevents the learner from exploiting curled-up bracing as a substitute for standing or walking.

## Learning bias
The mind still controls individual joints, but motor targets are gently biased toward a plausible
resting posture:
- modest outward hip spread
- slightly extended hip
- moderate knee flexion
- mild ankle extension

Actual movement remains learned.

## Preserved
- freecam
- remove selected
- sleep/mattresses
- thought bubbles + preset communication
- body-model learning
- motor babbling
- local mutation
- climbing grips
- expanded world
