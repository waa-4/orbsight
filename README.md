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


## v0.3.6 motor-revive patch

The v0.3.5 anatomical safety system could accidentally make an Orbsight appear "dead."

### Root cause fixed
The previous safety math reduced motor speed toward zero as a joint approached its anatomical range.
If several joints started near/outside those ranges at once, they could lose enough authority that the body could never recover.

### Changes
- joints now always retain at least 35% corrective authority
- joints outside their safe range actively drive inward instead of freezing
- anatomical limits are slightly more forgiving while still preventing backward knee inversion
- muscle-relaxation state now reduces force less aggressively
- motor output is visible in the selected-Orbsight panel
- motor stall detection watches for high joint activity with near-zero physical movement
- stalled bodies receive a temporary torque reserve
- long stalls clear stale local jam/relaxation flags
- anti-stall assistance never changes the creature's destination, gait phase, target object, or brain decision

### Saves
The save key remains `orbsight-v0.3.5-save` on purpose.
Existing v0.3.5 Orbsights should load into v0.3.6 with their:
- memories
- personalities
- interests
- learned gait genomes
- joint strengths
- world objects

The physical pose is still rebuilt into an anatomy-safe starting posture.


# Orbsight v0.4 — Sensorimotor

v0.4 combines motor-recovery work with two new body senses.

## Vestibular system
Each Orbsight now measures:
- body tilt relative to gravity
- angular speed
- linear acceleration
- whether it is falling
- body-up direction

The vestibular system does not choose actions. It is sensory input plus a low-level stabilizing reflex that can adjust damping and available muscle authority.

## Proprioception
Each Orbsight now receives internal body information:
- hip spread angle
- hip swing angle
- knee angle
- ankle angle
- foot-roll angle
- approximate limb angular speed
- whether each foot is touching the ground
- approximate load on each foot
- load symmetry
- current motor error

This gives the motor learner information about what the body actually did rather than only what it commanded.

## Developmental motor learning
Motor learning now has six developmental stages:
1. joint discovery
2. balance
3. standing
4. stepping
5. walking
6. free locomotion

The stage does not force an action or overwrite joint targets. It changes the reward used when judging a gait trial.

For example:
- joint discovery rewards controllable motor output
- balance rewards upright, symmetric support
- stepping rewards coordinated ground contact
- walking begins rewarding real displacement

## Motor-deadlock recovery
The v0.3.6 anti-deadlock work is retained and strengthened:
- newborn motor confidence starts higher
- shell mass is reduced again
- low-level torque reserve activates earlier
- vestibular instability can increase available support force
- passive damping rises during excessive spinning
- normal brain-selected gait targets remain intact

## Persistence
The existing v0.3.5 save slot remains in use so previous saved Orbsights can migrate forward.
v0.4 additionally saves developmental motor stage/progress.

Exact transient sensor readings are recomputed from the current physical body instead of being persisted.


# v0.4.1 — Stability Patch

This patch targets the collapsed/crooked posture visible in v0.4.

## What was wrong
The sensor systems were working, but the physical skeleton could still:
- settle too low until the shell almost rested on the floor
- twist limb bodies into awkward poses
- inherit an overly aggressive saved gait immediately after loading
- partially disable a jammed leg for too long
- fold limb segments inward because creature parts intentionally do not self-collide

## Fixes
- shell restore/spawn height increased
- 2.2 second neutral stance settling period after spawn/load
- old saved gait genomes are sanitized into safe ranges
- stronger angular damping on limb bodies to reduce corkscrew/twist
- body-clearance reflex extends support when the shell gets too low
- stance widens slightly when support is needed
- joint working ranges are tighter without killing motor authority
- jam relaxation is much shorter and only partially reduces force
- anti-shell-fold skeletal repulsion prevents limb segments drifting through the center of the shell
- torque reserve activates sooner during genuine motor stalls
- new Body clearance and Support reflex telemetry in the panel

These are low-level biomechanical protections. They do not select destinations,
objects, headings, or gait phase for the Orbsight.


# v0.4.2 — Leg Separation Patch

This patch fixes a deeper physics issue from v0.4/v0.4.1:

Previously, all creature body parts had a collision mask that only included the environment.
That meant **legs did not physically collide with the shell or with other legs**.
The visual anti-fold reflex could push them apart somewhat, but Cannon itself still allowed
two separate legs to occupy the same space.

## New collision anatomy

Collision layers are now split into:
- shell
- front-left leg
- front-right leg
- back-left leg
- back-right leg
- environment

Each leg:
- collides with the floor/world
- collides with the shell
- collides with all three other legs
- does not collide with its own connected segments

The shell also collides with other shells and all leg groups.

Connected hinge pairs still use `collideConnected:false`, so the joints themselves are not
fighting their own constraint.

## Anti-crossing ligaments

A low-level anatomical reflex now also:
- keeps limb segments out of the solid center of the shell
- prevents left legs from fully crossing to the right side and vice versa
- allows a small amount of natural crossover for gait
- does not choose heading, target, or gait phase

## Physics tuning

- solver iterations increased from 14 to 20
- body-on-body friction reduced so touching legs slide apart instead of sticking
- existing stance, vestibular, proprioceptive, persistence, and learning systems are retained

A new `Leg separation` readout shows the approximate minimum distance between lower
limb/foot bodies of different legs.
