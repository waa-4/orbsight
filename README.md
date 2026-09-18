# Orbsight v0.14 — Mind–Body Bridge

Stable filenames remain:
- index.html
- main.js
- physics.js
- mind.js
- world.js
- README.md

## Why this version exists
The Rapier skeleton could exist without visibly acting alive. v0.14 makes the connection between
mind and rigid body explicit instead of assuming that issuing a motor target is enough.

## Explicit sensor → mind → actuator bridge
Every step:
1. physics.js measures each leg's spread/hip/knee/ankle/roll angles
2. touch/contact and nearby grip surfaces are sensed
3. mind.js creates individual joint commands
4. physics.js sends those commands through three physical actuator layers:
   - Rapier joint PD motor
   - equal/opposite torque impulse
   - equal/opposite angular-velocity muscle assist
5. Rapier hard limits still prevent impossible joint rotation

No joint positions are teleported.

## Self-calibrating muscles
From 2–8 simulated seconds, the brain tests one leg/joint at a time.
If a commanded joint barely changes angle, that joint's muscle gain is increased automatically.
If it responds, the gain settles back toward normal.

Telemetry reports:
- `Bridge: connecting / calibrating / boosting weak muscles / connected`
- average muscle gain
- motor activity
- runtime status

## Physical gripping
Feet now sense nearby:
- platforms
- walls
- pushable blocks
- logs
- planks

When the mind chooses to grip, Rapier creates a spherical point joint from that foot to the
surface/body. The foot may rotate around the grip point, so it behaves more like grasping than
being welded in place.

Grips release when:
- the leg returns to normal ground support
- the grip is stretched too far
- the mind moves on
- the Orbsight sleeps
- the grip exceeds its lifetime

A gripping leg deliberately pulls through its own hip/knee motors.

## Movement
After calibration, each leg continues individual self-generated experimentation on top of the
learned motor policy. This is not a predefined walking cycle: leg phases differ, sensory contact
affects the policy, and each joint still has its own learned weights/body-model feedback.

## Runtime resilience
Eye movement happens before the physics step.
Each Orbsight's mind/body step is guarded separately, so one subsystem error no longer freezes the
whole visible scene. Any error is reported in the Events panel.

## Proof of life
The pupil scan is deliberately more obvious in v0.14. If the eye moves but a leg doesn't, the
render loop is alive and the bridge telemetry tells us which actuator needs help.
