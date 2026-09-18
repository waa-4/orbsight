# Orbsight v0.16 — Neuromuscular Movement Remake

Stable filenames:
- index.html
- main.js
- physics.js
- mind.js
- world.js
- README.md

## Why this is a remake
v0.15 still let the newborn controller continuously wave individual joints around like an
inflatable tube. v0.16 removes that control style.

There is NO continuous newborn oscillator driving every joint.

## New architecture

MIND
- picks goals and developmental priorities
- learns which leg primitives were useful
- does not directly fling five joint targets continuously

SPINAL LEG CONTROLLER
Each leg can be in one action state:
- relax
- reach
- plant
- grip
- pull
- push
- lift

The spinal controller converts that ONE whole-leg action into coordinated hip/knee/ankle/spread/roll
targets. It is anatomy/reflex behavior, not navigation.

MUSCLES
- soft compliant motor
- slow neural target changes
- strength
- fatigue
- use-driven training
- approximate antagonistic flexor/extensor behavior

PHYSICS
- Rapier hard joint limits
- CCD
- sole/contact sensors
- physical spherical grip constraints

## Newborn behavior
Only one voluntary leg is usually active at a time.
Occasionally one opposite leg may act as support.
Other legs relax.

If a foot swings too fast, proprioception immediately sends that leg to RELAX instead of issuing
another command.

If a planted foot finds useful support, the spinal controller keeps it planted briefly instead of
instantly waving it away.

## Development
1. newborn motor discovery
2. reach + plant
3. grip + pull crawling
4. supported crawling
5. standing practice
6. first steps
7. walking practice

Progress is experience-based:
- body map grows from successful movement/contact
- crawl skill grows from grounded translation
- grip skill grows from anchored pulls that actually move the body
- support/balance grow from useful planted feet
- step/walk skill grow only after upright translation

## Grip → crawl
A planted foot can create a ground grip.
A reaching foot can grip nearby platforms, walls, blocks, logs, and planks.
A gripped leg may enter PULL:
- hip retracts
- knee flexes
- anchored foot stays put
- the shell is physically pulled toward that anchor
- grip releases and another leg can reach

## Floor protection
Each foot has a sole-pressure sensor and foot-height sensor.
If a foot is already contacting/pressing the floor, the controller does not deliberately continue a
downward reach. A tiny emergency upward velocity correction only activates below the floor plane.

## Walking
Walking is not active at birth.
After crawling/support/balance develop, the mind begins choosing lift/plant/push primitives in a
more useful sequence. The learned policy only makes small nudges to these spinal primitives later.
