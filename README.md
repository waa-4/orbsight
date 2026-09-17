# Orbsight v0.1

A tiny GitHub Pages prototype for the fictional simulated creature **Orbsight**.

## What v0.1 contains
- Primitive 3D Orbsight built entirely from Three.js geometry
- One large forward-facing eye
- Four simple animated legs
- Small world containing food, danger objects, and walls
- Forward vision-cone logic
- Touch/collision sensing
- Curiosity and fear values
- Deliberately simple visible decision loop
- Live brain monitor
- Pause, reset, and camera-follow controls
- Mobile-friendly layout

## Why there is no Python yet
GitHub Pages can only host static browser files, so a normal Python process cannot run directly on it.

For v0.1, the simulation runs entirely in JavaScript. Later versions can use:
1. Local Python brain + FastAPI/WebSocket + Three.js front end
2. Hosted Python backend
3. Pyodide, which runs Python in the browser

My recommendation: keep v0.1 and probably v0.2 browser-only, then move the actual brain into Python after the sensory/body loop is stable.

## Run locally
Because this uses JavaScript modules, run a small local server instead of double-clicking index.html.

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages
Upload all files to a repository, then go to:

Settings -> Pages -> Deploy from a branch -> main / root

The page imports Three.js from jsDelivr, so it needs an internet connection.

## Good v0.2 targets
- short-term memory
- remembered danger/food locations
- real personality traits
- hunger/energy
- object placement tools
- multiple Orbsights
