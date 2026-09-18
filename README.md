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


## v0.10.1 bootstrap fix

v0.10 could appear permanently stuck on `starting v0.10…` when `main.js` never loaded.
The HTML was static while the real engine lived in external ES-module files, so a module-load
failure occurred before the old JavaScript error panel existed.

v0.10.1:
- catches `main.js` import failures directly from `index.html`
- catches unhandled module promises and startup exceptions
- reports which phase is loading
- cache-busts the local engine modules so GitHub Pages does not mix old/new JS files
- explicitly detects `file://`

Important: a modular ES-module build must be served over HTTP/HTTPS. Double-clicking
`index.html` directly from Windows uses `file://`, and browsers normally block local ES-module
imports. GitHub Pages works because it serves the five files over HTTPS.

Keep these together:
- index.html
- main.js
- physics.js
- mind.js
- world.js


## v0.10.2 browser syntax fix

The startup error was found in `mind.js` and `world.js`.

Several compact ternary expressions were accidentally written without spaces, for example:

`condition?.004:0`

Node's syntax checker accepts that as a different modern JavaScript construct, while Chromium
parses the intended expression differently and reports `SyntaxError: missing ) after argument list`.

They are now written unambiguously:

`condition ? .004 : 0`

The same correction was made to hip/knee target ranges and mattress-height logic.
Some optional-chaining/nullish expressions were also expanded into explicit checks.

Validation:
- Node syntax check for all four JavaScript files.
- Chromium's parser for all four local modules after stripping only module import/export wrappers.

Additional root cause found: `seedPolicy()` was also missing one closing parenthesis around `Array.from(...)`. This is fixed in v0.10.2.
