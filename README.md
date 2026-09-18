# Orbsight v0.15 — Developmental Locomotion

Stable filenames:
- index.html
- main.js
- physics.js
- mind.js
- world.js
- README.md

## Goal
Movement should develop more like an animal instead of starting as a stiff robot.

### 1. Newborn flop
Orbsights begin with weak muscles (roughly 11–19% strength depending on the joint).
They make slow, independent joint twitches and are allowed to flop around.

### 2. Reach + crawl
As muscles strengthen through actual use, the mind begins reaching with individual legs.
Feet can physically grip the ground or nearby surfaces.

### 3. Supported crawl
A gripped foot acts as an anchor. The Orbsight flexes its hip and knee against the anchor,
physically pulling the shell toward it. Grip skill improves when this actually produces movement.

### 4. Stand practice
Once muscles and crawling ability are stronger, the animal begins trying to support itself with
multiple legs. Commands are still compliant and slightly wobbly.

### 5. First steps
With enough strength and balance experience, diagonal leg pairs begin small stepping experiments.

### 6. Walking practice
The learned motor policy gets progressively more authority as the body matures.

## Muscle system
Every joint now has:
- strength
- fatigue
- accumulated use
- smoothed target
- smoothed activation

Strength grows slowly from successful muscle work, especially while the leg is loaded.
Fatigue temporarily reduces effective strength. Sleeping restores fatigue faster.

The motor is intentionally soft:
- lower stiffness
- lower target velocity
- much weaker torque impulse
- much weaker angular-velocity assist

This removes the robotic jitter/stiffness from v0.14.

## Grip system
Feet can grip:
- the ground
- platforms
- walls
- pushable blocks
- logs
- planks

Grips are real Rapier spherical joints, not teleportation. They release after a pull, excessive
stretch, sleep, or naturally as grip skill develops.

## Floor tunneling fix
Moving body parts now use CCD (continuous collision detection), reducing the chance of a foot being
driven through the floor at higher simulation speeds.

## Learning
Development is mostly success-gated rather than purely age-gated:
- crawling skill grows from grounded horizontal motion
- grip skill grows when anchored pulls create motion
- standing skill grows from stable multi-foot support
- balance grows while upright with support
- walking skill grows from upright horizontal movement

The evolutionary/learned motor policy is still present, but it has little authority when the animal
is weak. It becomes a larger modifier only after the body develops.
