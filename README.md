# Orbsight v0.10.3 — Clean Modules

This build keeps the engine at exactly five source files:

- `index.html`
- `main-v0103.js`
- `physics-v0103.js`
- `mind-v0103.js`
- `world-v0103.js`

The JavaScript filenames are deliberately new. This prevents GitHub Pages or the browser from
reusing a stale v0.10/v0.10.1/v0.10.2 module.

The loader now imports the modules one at a time:
1. physics
2. world
3. mind
4. main

If a module fails, the red panel names that exact module.

All fractional numbers were rewritten with leading zeros (`0.30` instead of `.30`) to remove
any remaining parser ambiguity.

No engine feature changes were made here; this is strictly a clean-load/debug build.
