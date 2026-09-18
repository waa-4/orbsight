# Orbsight v0.3.3 — rigid-body rebuild

This version is a deliberate rebuild of locomotion. It removes the old fake walk/ground-clipping approach.

## Important: replace the old project root

This ZIP contains only:
- `index.html`
- `README.md`

For GitHub Pages, replace the old `index.html` with this one. Old `main.js` or `style.css` files are no longer used, so they cannot override the brain.

The page visibly reports:
- Brain: `0.3.3 motor-brain`
- Physics: `cannon-es rigid-body + motorized hinges`
- Runtime build ID

If those values appear, the new code is running.

## Locomotion changes

Each Orbsight now has separate physical bodies for:
- 1 lightweight shell/body
- 4 upper legs
- 4 lower legs
- 4 plantigrade feet

That is 13 rigid bodies per Orbsight.

Each leg has 3 real motorized hinge constraints:
- hip
- knee
- ankle

The brain chooses target angles. Hinge motors apply limited torque. The physics engine decides whether the leg can actually move there.

**Forward movement is never added directly to Orbsight's position.** It only travels when its physical feet push against the ground with friction.

## Floor clipping

The floor is a rigid physics collider. Feet are physical box colliders and the visible feet copy those collider transforms every frame. This is intended to eliminate the repeated visual animation-through-the-floor problem from earlier versions.

## Body weight

The large shell looks heavy but has a mass of only `1.15` physics units. Each limb segment is much lighter. The legs use limited motor force rather than unlimited animation strength.

## Motor learning

Every 7.5 seconds, a gait trial is scored using:
- actual physical distance moved
- uprightness
- collisions
- falls
- energy used
- joint-control error

Better gait genomes are kept. Worse ones are reverted, then mutated again. Each Orbsight learns independently.

## Falling / recovery

Falling is detected from the shell's real physics orientation and height. The motor brain first tries an extended-leg recovery posture. If it still cannot recover after several seconds, the lab resets it upright and heavily penalizes that gait.

## Brain verification

The Brain Event Log shows events such as:
- gait accepted/rejected
- collisions
- eating
- getting stuck
- falling
- recovery

This makes it possible to verify that the newer mind is actually executing instead of only seeing a changed tab title.

## GitHub Pages

Upload `index.html` at the repo root, then enable:

`Settings -> Pages -> Deploy from a branch -> main / root`

Three.js and cannon-es are loaded from pinned jsDelivr modules, so the page needs internet access.


## v0.3.4 biomechanics assistance

This update does not give the high-level mind new forced actions. Instead it improves the physical body and adds low-level/local reflexes.

### Lighter shell
- shell mass reduced from 1.15 to 0.72
- limb masses reduced slightly
- extra damping reduces uncontrolled spinning without selecting a destination

### More leg freedom
Each leg now has five physical joint degrees used by the simulation:
1. hip spread / abduction
2. hip forward/back swing
3. knee
4. ankle pitch
5. foot roll

The new hip-spread joint lets a leg physically extend farther outward and create a wider support base.

### Individual joint strength
Every Orbsight is born with separate strength multipliers for every leg:
- spread
- hip
- knee
- ankle
- foot

So one leg can genuinely be stronger or weaker than another.

### Passive foot leveling
Each foot has a separate roll hinge.
A local reflex compares that foot's orientation to the ground and rotates the foot toward a flatter contact angle when it is near the floor.

This reflex:
- does not know the Orbsight's target
- does not choose where to walk
- does not alter the gait phase
- only helps a foot make stable contact

### Other passive assistance
- soft joint limits resist hyperextension
- collapsing bodies temporarily receive a modest motor-force boost
- angular damping increases when the shell becomes unstable
- ground friction is slightly higher
- recovery mode boosts local support forces but leaves the normal motor brain's chosen targets intact

The only remaining external safety action is the existing lab upright reset after a long failed recovery.


## v0.3.5 anatomy + persistence

### Anatomical safety
The previous body could still be physically whipped into impossible poses even when motor targets were clamped.

This update adds:
- narrower anatomical joint ranges
- one-direction-biased knees that cannot invert backwards
- soft hard-zone force reduction near every joint limit
- passive tendon-like bias toward a safe range
- lower motor speed near joint edges
- jam detection
- muscle-relaxation reflex for physically trapped limbs
- per-leg limb health readout: normal / strained / relaxing

The relaxation reflex does **not** choose a step or destination. It simply reduces force temporarily so physics can free a trapped leg.

### Persistent world save
The GitHub Pages build now uses the browser's localStorage.

Autosave includes:
- all current Orbsights, up to 20
- approximate positions
- personality
- needs
- interests
- short-term and long-term memories
- learned gait genome
- best gait genome / score
- motor generation and confidence
- individual joint strength
- world objects and their positions

The world autosaves every ~4 seconds and before page unload.

Reloading the page automatically loads the saved world.

For safety, loaded Orbsights are restored in an anatomy-safe upright pose at approximately their saved location instead of restoring a potentially mangled rigid-body limb pose from the exact previous physics frame.
