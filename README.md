# Orbsight v0.10.4 — Joint Collision + Freecam

Five engine files remain:
- index.html
- main-v0104.js
- physics-v0104.js
- mind-v0104.js
- world-v0104.js

## Folding fix
The important change is real same-leg collision.

Earlier builds excluded a leg's own collision group, so non-adjacent parts of one leg could pass
through each other. v0.10.4 includes the leg's own group in its collision mask. Because every hinge
already uses `collideConnected:false`, directly connected neighbors still do not fight at the joint,
while non-adjacent pieces can physically stop one another.

Also:
- solver iterations: 42
- tighter solver tolerance
- earlier/stronger limit barriers
- more angular damping
- continuous anti-fold spacing remains active

## Freecam
- Click Freecam or press F.
- WASD moves horizontally.
- Q/E moves vertically.
- Mouse OrbitControls still rotate/pan.
- Toggle again to follow selected.

## Remove
`Remove selected` destroys the selected Orbsight and its constraints/mind bubble, then selects
another remaining Orbsight if possible.
