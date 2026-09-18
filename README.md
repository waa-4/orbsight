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


# Orbsight v0.5 — Skeleton Rebuild

This version stops trying to solve the folding bug with progressively stronger motor reflexes.
The mind, personality, memory, vestibular system, proprioception, developmental learning,
world interaction, and browser persistence are retained. The locomotion skeleton is rebuilt
around physical invariants.

## Why the old legs kept folding

Earlier versions clamped the *desired motor angle*, but a rigid-body solver could still push
the real joint outside that desired range during collisions or accumulated constraint error.
Self-collision helped, but it did not make the angle itself physically impossible.

v0.5 therefore has two layers:

1. normal muscles/tendons and collision physics
2. a post-physics anatomical validator that runs before every rendered frame

## Hard anatomical invariants

The validator checks:
- hip spread range
- hip swing range
- knee range (strong one-direction bias)
- ankle pitch range
- foot roll range
- lower-leg/ankle/foot penetration into the shell
- geometric crossing/overlap between separate leg segments
- merged feet

If physics ever produces an impossible state, only the affected leg is reconstructed at its
neutral attachment pose immediately after the physics step and before the frame is rendered.

This is intentionally **not** a brain action. A real animal does not need to learn that its
knee bones cannot pass through one another. It is a property of the skeleton.

## Anti-merge design

Separate legs still use independent collision groups and collide with:
- the shell
- the environment
- the other three legs

v0.5 additionally calculates distances between the actual upper/lower leg centerline segments.
If two different legs geometrically cross or occupy the same anatomical space, both are restored
to valid positions before rendering.

This means the previous failure state—folding, phasing into one another, and remaining merged—
should no longer persist.

## Natural stance

Fresh and restored Orbsights now start with:
- a slightly higher shell
- lower joints farther outward than the hips
- feet farther outward again
- 2.5 seconds of settling

The brain still has to learn useful locomotion. The stance only gives the skeleton a physically
reasonable starting configuration.

## Solver changes

- solver iterations: 28
- physics step: 1/120 second
- up to 6 substeps
- hard skeleton validation after every physics update, before visual synchronization

## Debugging

The Selected Orbsight panel now includes `Skeleton corrections`.
If it stays at 0, the physical solver has remained anatomical.
If it increases, the displayed reason tells which invariant was violated, such as:
- hard joint stop
- shell penetration
- inter-leg merge

That gives us a direct way to diagnose any remaining locomotion problem instead of guessing
from the rendered model.


# v0.5.1 — Gait + Grip Patch

This patch targets the v0.5 failure where Orbsight stayed anatomically valid but could mostly
rapidly tap-dance backward with very stiff legs.

## Softer gait
- gait frequency is reduced
- hip/knee/ankle amplitudes are slightly smaller
- swing phase is shorter
- stance phase is longer
- brain-selected joint targets are low-pass smoothed before reaching the motors
- motor speed limits are reduced
- relative joint angular velocity is fed back as damping
- stall torque reserve activates later and is less extreme

This makes the joints behave more like compliant muscles rather than servos snapping between poses.

## More foot grip
Foot-ground friction is increased substantially.

A new passive plantar-traction reflex also resists horizontal sliding whenever:
- the foot is near the floor
- that leg is in its planted/stance part of the gait

It only damps slip. It does not push in the desired travel direction, so locomotion still has to
come from the learned joint motion and physical contact.

## Less backward tap-dancing
The old sinusoid spent too much time rapidly alternating lift/plant states.
v0.5.1 uses a smooth thresholded swing phase, so each foot remains planted for more of the cycle
and lifts for a shorter portion.

## Anti-folding
The complete v0.5 hard-stop skeleton and anti-merge validator remain enabled.


# v0.5.2 — Soft Muscles + Strength Growth

This update makes the legs deliberately more compliant and animal-like while keeping the v0.5
hard skeleton rules that prevent folding and merging.

## Floppier limbs
Joint motors are no longer treated like rigid servos.

Each joint now behaves more like a spring-damper muscle:
- softer pull toward the brain's requested angle
- more response to actual joint angular velocity
- lower maximum motor speed
- lower immediate pose authority
- less limb damping, so legs can swing naturally
- longer planted phase and shorter swing phase

The skeleton is therefore allowed to wobble, sag, and react to contact, but it still cannot
enter anatomically impossible folded/merged states.

## Muscle adaptation
Each individual joint has its own adaptive muscle strength:
- hip spread
- hip swing
- knee
- ankle
- foot

New muscles begin at about 58% strength.

A muscle only gets stronger when:
1. it is actually being commanded,
2. the joint is physically moving,
3. the motion continues long enough to count as useful exercise.

Simply pushing against a stuck joint does not train it.

Strength rises very slowly with repeated use and is capped at 130%.

## Fatigue
Active muscles accumulate temporary fatigue.
Fatigue reduces their available strength a little, then recovers while the joint is less active.
This prevents a permanently rigid maximum-force posture and gives movement more natural variation.

## Persistence
Adaptive muscle strengths and fatigue state are included in the browser save so an individual
Orbsight can genuinely develop a stronger body over time instead of resetting on reload.

## Feet
High-grip plantar contact remains enabled and friction is increased again.
Grip only resists slipping; it does not add artificial forward movement.

## Safety
The v0.5 hard anatomical validator remains the final authority:
- knees cannot invert
- joints cannot exceed anatomical stops
- legs cannot remain inside the shell
- separate legs cannot remain geometrically merged


# Orbsight v0.6 — Motor Learning Rebuild

This update changes the motor architecture because v0.5.2 still looked almost identical to
earlier versions.

## Why the behavior stayed the same

Previous builds softened the joints, changed friction, and changed strength, but the high-level
controller still generated the same basic sinusoidal leg cycle:

- oscillator phase
- predefined swing/stance waveform
- predefined hip/knee/ankle targets

Learning only mutated the parameters of that fixed gait. Therefore every Orbsight remained a
variation of the same tap-dancing controller.

## v0.6 removes the canned gait

Each leg now has a small learned policy for five muscle groups:

- hip spread
- hip swing
- knee
- ankle
- foot roll

The policy receives:
- internal oscillator sine/cosine (CPG-like rhythm)
- whether the foot is touching the ground
- current joint angle
- joint angular velocity
- body tilt from the vestibular system
- heading error

The oscillator is only an input. It does not decide which leg lifts or plants.

Each muscle output is produced by learned weights and converted into a soft activation target.
Those weights are mutated and selected according to real physical outcomes.

This is closer to a simplified animal architecture:
**central rhythm + proprioception + vestibular feedback + contact reflex + muscles.**

## Motor learning

Every Orbsight has its own motor-policy weights.

Trials reward different things depending on developmental stage:
- joint discovery: useful motion and controllability
- balance: uprightness and load symmetry
- standing: stable contact
- stepping: physical displacement while staying upright
- walking/free locomotion: forward progress, stability, efficiency

Backward movement is allowed, but a controller that only travels backward is no longer treated
as equally useful for target-directed locomotion.

## Save migration

Personality, memory, interests, joint strength, fatigue, and developmental state are retained.

Old pre-v0.6 gait genomes are deliberately discarded when loaded because keeping them would
reintroduce the exact old tap-dance controller. Existing Orbsights therefore keep who they are
and how strong they have become, but receive a fresh v0.6 motor-learning policy.

## Muscle growth

The use-driven muscle-strength system from v0.5.2 remains active.
Muscles strengthen only when commanded AND physically moving.

## Anatomy

The v0.5 hard skeleton validator remains active:
- no inverted knees
- no persistent shell penetration
- no persistent leg merging
- no persistent impossible joint angle


# Orbsight v0.7 — Relaxed Bodies + Physics World

## The stiffness fix

v0.6 still behaved stiffly because every learned output was converted into a joint *position*
and the motor continuously tried to hold that position.

v0.7 changes the interpretation closer to low-tone muscles:

- policy output now nudges the current joint angle instead of commanding a distant absolute pose
- motor force falls dramatically when learned activation is small
- knees have especially low holding force when the foot is not loaded
- knees have a weak passive resting bend around 0.24 radians
- joint target smoothing is slower
- limb angular damping is lower
- feet retain grip when actually loaded

The expected result is visible sag, wobble, relaxed knees, and more contact-driven movement.
The v0.5 hard skeleton remains the safety layer so "floppy" cannot become "inside-out."

## Pushable physics objects

New editable world objects:
- Pushable block
- Physics ball
- Rolling log
- Raised platform

Pushable blocks, balls, and logs are Cannon rigid bodies with mass, velocity, angular velocity,
friction, and collisions against the Orbsights, terrain, and each other.

Orbsights do not receive a scripted "push" action. If their body or legs physically contact a
dynamic object while moving, the object moves from the collision.

## Balls

Balls have low rolling damping and can be shoved, rolled, trapped between objects, or knocked
off raised terrain.

## Layered terrain

The default world now contains two low terrace groups at increasing heights. They are static
physics platforms, so Orbsights can discover stepping/climbing behavior through normal contact
and motor learning.

## Persistence

Dynamic object position and velocity are saved. Existing Orbsight personality, memory, motor
policy, muscle strength, fatigue, and developmental state continue to persist.


# v0.7.1 — Climb + Relax

## Freer legs

The previous relaxed controller still lived inside narrow joint ranges, so a leg could wobble
but could not really fold upward enough to climb.

v0.7.1 expands the usable ranges substantially:
- hip swing: ±1.05 rad
- knee flexion: up to 1.48 rad
- ankle pitch: -0.72 to +0.78 rad
- hip spread and foot roll also receive more room

Airborne knees have a slightly stronger passive bend, so an unloaded leg naturally tucks instead
of hanging like a straight stilt.

The learned policy can now explore much larger hip and knee excursions.

## Climbing

Orbsights receive a small `climbOpportunity` sensor for nearby raised solid surfaces.

It does not issue a climb command. It only tells the motor system that a reachable step exists.
When a step is nearby, the controller is allowed more hip/knee excursion from its own learned
output.

Motor learning also gives a small reward for genuine upward body progress while remaining stable.

Foot contact sensing now understands raised platforms instead of assuming every foot contact is
at world Y=0.

## Slower thinking

The high-level decision loop now runs about every 2.2–6.6 seconds depending partly on patience,
instead of roughly twice per second.

Orbsights also usually keep their current target between thoughts rather than selecting a new
interesting object each time.

## Less leg snapping

The hard skeleton validator no longer reconstructs a leg on the first small limit/overlap frame.

Minor violations and overlaps must persist for roughly a quarter-second before correction.
Severe impossible joint angles are still corrected immediately.

This keeps the anti-fold safety system while greatly reducing the tiny visible leg
"teleportation" that could interfere with locomotion.
