# Orbsight v0.3

GitHub Pages prototype of the fictional simulated creature **Orbsight**.

## Major changes

### Population panel
- Spawn up to **20 Orbsights**
- Select any Orbsight to inspect its mind
- Remove the selected Orbsight
- Each creature has separate personality, memory, interests, and motor learning

### Editable world
You can add:
- food
- danger
- blocks
- toys
- markers

Objects can be placed at chosen X/Z coordinates or randomly.

### Personality
Every Orbsight now has persistent values for:
- curiosity
- bravery
- stubbornness
- sociability
- patience
- playfulness

These affect target choice and behavior.

### Interest fix
Interests are no longer a permanent "go toward this forever" command.
- repeated blocked approaches reduce interest
- recently failed targets receive cooldowns
- stuck detection forces a new direction
- good outcomes raise interest
- danger lowers its learned value
- personality and needs alter target scores

### Learning
Two kinds are present in v0.3:

1. **Experience learning**
   - object interests change from outcomes
   - locations/events enter memory
   - blocked routes temporarily lose priority

2. **Motor learning**
   - there is no fixed pre-authored walking animation
   - the brain controls hip, knee, ankle, and foot joints on all four legs
   - each creature starts with an imperfect gait parameter set
   - every trial window the simulation scores real displacement, balance, and collisions
   - useful gait changes are kept; worse changes are rolled back
   - the gait is then mutated again
   - motor confidence rises as successful trials accumulate

This is intentionally a simplified artificial-learning model, not biological neurons or full rigid-body physics yet.

## Roadmap

### v0.4
- real image input from the eye camera
- no direct object labels for vision
- language / reading
- learned physical communication using eye and body movements

## GitHub Pages
Upload `index.html` to a repo root and enable:

Settings -> Pages -> Deploy from branch -> main / root

Three.js is loaded from jsDelivr, so an internet connection is required.
