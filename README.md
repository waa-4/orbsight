# Orbsight v0.10 — Modular Joint Rebuild

This version intentionally re-architects the project into exactly five source files:

1. `index.html` — UI/CSS only; no simulation heavy lifting.
2. `main.js` — bootstrap, renderer, fixed-step loop, selection/UI wiring.
3. `physics.js` — Cannon world, Orbsight rigid bodies, joint controller, anti-fold anatomy, grip constraints.
4. `mind.js` — personality, thoughts/chat bubbles, sleep, developmental motor learning, policy mutation.
5. `world.js` — map, terrain, physics props, mattresses, environment updates.

## Joint rebuild
The joint system is centralized in `physics.js`.

The previous project had many layers of patches around the original hinges. v0.10 replaces those motor/limit helpers with one joint controller where:
- muscle authority is deliberately weaker than the anatomical stop
- approaching a limit automatically vetoes outward muscle intent
- hard-stop authority increases near a limit
- relative angular velocity is damped at the stop
- there are no normal positional teleports
- upper/foot, hip/foot, and upper/ankle spacing prevents same-leg collapse
- lower leg, ankle, and foot are kept out of the shell core
- inter-leg separation remains continuous
- climbing grips release after 1.5s and the motor limit guard remains stronger than the grip

The physics loop uses a fixed 1/180 second step.

## Preserved systems
- developmental body discovery / crawling / stepping / walking learning
- motor babbling
- local policy mutation
- mattresses and sleep
- thought bubbles
- preset communication
- climbing grips
- expanded terrain and physics objects
- 0.5x–15x simulation speed

This rebuild favors a smaller, understandable engine over continuing to patch one enormous `index.html`.
