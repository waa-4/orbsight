# Orbsight v0.2

## Display patch
v0.1's blank page came from the Three.js addon import not being resolved correctly. v0.2 uses a browser import map for both `three` and `three/addons/`, and also shows a visible startup error if something fails.

## v0.2
- articulated plantigrade legs: hip, knee, ankle, foot
- independently moving eye
- senses: vision, smell, touch, spatial awareness
- needs: energy, hunger, safety, curiosity
- short-term memory
- long-term memories of important events and approximate food/danger locations
- remembered food can influence later navigation
- food can be eaten; danger can hurt
- pause/reset/follow/brain-view controls
- mobile layout

## Roadmap
- v0.3: personality + learning
- v0.4: real eye-camera vision + language/reading communicated through learned body movements

## GitHub Pages
Upload `index.html` to the repository root, then use Settings -> Pages -> Deploy from branch -> main / root.

This page imports Three.js from jsDelivr and therefore needs internet access.


## v0.2.1 collision patch
- Orbsight model scaled down to 74% of its previous size.
- Body collision radius reduced to match the new size.
- Wall collision changed from rough circle-vs-circle collision to proper circle-vs-box collision.
- If Orbsight somehow lands fully inside a block, it snaps back to its last safe position instead of getting trapped.
- Collision responses turn it away more aggressively from obstacles.
- Follow camera moved closer to fit the smaller creature.
