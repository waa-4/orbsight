# Orbsight v0.12 — Posture Brain

This update does what the previous physics-only fixes did not: the Orbsight's MIND explicitly
recognizes curling as a bad strategy and deliberately stops doing it.

## Engine files
- index.html
- main-v012.js
- physics-v012.js
- mind-v012.js
- world-v012.js

## Posture brain
Each leg gets a continuous curl score based on:
- foot distance to shell
- sideways tuck distance
- knee flexion
- hip flexion
- ankle extremity

The mind combines those into a whole-body curl score.

States:
- normal
- uncurl
- stance

If curling becomes moderate/severe, the brain enters `uncurl`.

## What uncurl does
Without teleporting anything, the mind commands:
- hips outward
- hips slightly extended
- knees more open
- ankles neutral
- feet level

Motor babbling is suspended while uncurling.
Climbing grips are not started during posture trouble, and existing grips release.

Once the legs are clear, the mind holds a stable stance briefly before returning to exploration.

## Learned curl aversion
Every curl episode increases a persistent-in-runtime aversion value.

As aversion rises:
- policy outputs that flex a curled knee farther are suppressed
- inward hip/abduction commands are suppressed
- curled movement receives a much larger reward penalty
- a curled trial is NEVER allowed to become the saved best policy, even if it moved quickly

This closes the exploit where a curled controller could move enough to be selected as "successful."

## Telemetry
Selected Orbsights now show:
- Posture brain state
- Curl score
- Curl aversion
- Curl episodes
- Successful uncurl recoveries

All v0.11 systems remain: redesigned legs, freecam, remove selected, sleep, thoughts/chat,
developmental motor learning, climbing, and the expanded world.
