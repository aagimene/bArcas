# Stability

How hard the hull resists being heeled over, and whether it self-rights when disturbed. For a kayak this governs the feel of "tippy" vs "reassuring" and also capsize behavior at extreme angles.

---

## Two kinds of stability

Paddlers (and designers) distinguish:

- **Initial (primary) stability** — the hull's resistance to *small* heel angles (0°–15°). Governed by waterplane shape. High initial stability = "feels stable sitting still."
- **Secondary stability** — resistance at larger heel angles (15°–60°+), where the hull is rolled onto its side. Governed by hull volume distribution high on the sides. High secondary stability = "holds the edge when leaned."

Fundamentally these are two points on the same continuous **stability curve** (GZ vs. heel angle), but they feel different to the paddler and are optimized differently.

---

## The metacenter — small-angle stability

For small heel angles, the buoyancy force moves laterally as the hull rolls, and can be thought of as acting through a single fixed point: the **metacenter**, $M$.

Let:
- $G$ = center of gravity (boat + paddler + gear)
- $B$ = center of buoyancy (the centroid of displaced volume)
- $K$ = keel point (bottom of hull on center plane)

Geometric relations (small-angle approximation):

$$
KM = KB + BM_T
$$
$$
GM = KM - KG
$$

where $BM_T = I_T / V$ is the **metacentric radius** ($I_T$ is the transverse moment of inertia of the waterplane — see [hydrostatics.md](hydrostatics.md)).

**GM (metacentric height)** is the single most important small-angle stability number.

- **GM > 0:** stable. A disturbance produces a righting moment.
- **GM = 0:** neutral.
- **GM < 0:** unstable. The boat wants to flop onto its side.

For sea kayaks with paddler: $GM_T$ is typically in the range ~0.05 m to ~0.25 m depending on design intent.

### Righting moment (small angle)

$$
M_R(\phi) = \Delta \cdot g \cdot GM \cdot \sin\phi \approx \Delta g\, GM\, \phi
$$

where $\Delta$ is displaced mass and $\phi$ is heel angle. This is linear in $\phi$ — only valid small.

### Period of roll (small angle)

The natural roll period:
$$
T_\phi \approx \frac{2\pi\, k_{xx}}{\sqrt{g\, GM}}
$$

where $k_{xx}$ is the transverse radius of gyration. Short $T_\phi$ = "twitchy"; long = "smooth."

---

## The GZ curve — large-angle stability

For real heel angles, we can't rely on the metacentric approximation. Instead we compute the **righting arm** $GZ(\phi)$ directly:

1. Rotate the hull through heel angle $\phi$.
2. Find the new waterplane that still displaces volume $V$ (1D solve).
3. Compute the new center of buoyancy $B_\phi$.
4. $GZ(\phi)$ = horizontal distance from $G$ to the line of action of buoyancy through $B_\phi$.

$$
M_R(\phi) = \Delta \cdot g \cdot GZ(\phi)
$$

The plot of $GZ(\phi)$ vs. $\phi$ is the **statical stability curve**. It is the defining characterization of a hull's large-angle behavior.

### What to read off the GZ curve

| Quantity | Meaning |
|---|---|
| Slope at origin | $GM_T$ (small-angle stability) |
| Peak $GZ$ | Maximum righting arm |
| Angle at peak | Heel where righting is strongest |
| Zero crossing | **Angle of vanishing stability (AVS)** — past this, the boat wants to roll upside down |
| Area under curve | Energy absorbed during capsize — a measure of "reserve" stability |
| Range of positive stability | 0° to AVS |

### Kayak-specific notes

- Traditional sea kayaks usually have AVS in the 90°–150° range (depends on deck volume).
- Paddler's body is a significant fraction of system mass — paddler's posture changes $KG$ and therefore GZ.
- **Cockpit flooding angle** — at some heel, water pours into the cockpit. Beyond that, the hull is no longer watertight; the classical GZ curve stops being meaningful. For closed-deck kayaks, this is usually past 90° of heel; for sit-on-tops, irrelevant.

---

## Stability vs. displacement

GM, GZ, and AVS all depend on load:
- **Heavier paddler + gear** → lower waterplane, different $I_T$, different $KG$. Usually more initial stability (more waterplane width at the heavier waterline) but lower AVS.
- **Lighter load** → higher riding, less initial stability, more AVS headroom.

ArcasBoat reports stability at the user's configured displacement condition, and can plot the stability curve for a sweep of conditions.

---

## Longitudinal stability

Rarely a concern at kayak scale — longitudinal GM ($GM_L = BM_L - BG$) is typically huge because the boat is long and thin, so longitudinal tip-over is essentially impossible.

But the longitudinal moment drives **trim** response to load placement: shifting a paddler aft by $\Delta x$ causes trim change ≈ $\Delta x \cdot m_{paddler} / (\Delta \cdot GM_L)$ radians.

---

## Dynamic / responsive stability (paddler perspective)

Paddlers care about behavior in motion, not just statics. Key dynamic effects:

- **Roll damping** — how fast oscillation decays. Largely governed by hull shape in the immersed region; flat-bottomed hulls have less damping than V'd ones.
- **Coupling to wave motion** — in beam seas, waves add a heeling moment. A hull with high GM "follows" the waves more, which can feel more or less stable depending on frequency.
- **Reserve buoyancy** — if a bow is buried by a wave, how quickly does it lift out? Depends on above-waterline volume forward. Sea kayaks often have notably full bow decks for this reason.

These are qualitative in phase 1; phase 3+ may add strip-theory motion analysis (see [seakeeping.md](seakeeping.md)).

---

## What designers do with stability numbers

| Goal | Lever |
|---|---|
| Increase initial stability | Flatter/wider waterplane (increases $I_T$) |
| Increase secondary stability | Flare (wider above waterline) — hull gets wider as it heels |
| Lower GM | Reduce waterplane beam, or raise paddler CG |
| Increase AVS | More deck volume, closed decks |
| Reduce roll period | Increase GM |

Note the tension: wider waterplane helps initial stability but costs drag; flared topsides help secondary but cost paddler reach to the water. The Coaster, for instance, is **soft-chined with pronounced flare** — trading some initial stability for strong secondary, then the flare recovers initial stability visually while keeping the waterline narrow for speed. See [../designs/coaster-analysis.md](../designs/coaster-analysis.md).

---

## What ArcasBoat computes and displays

- **Initial metric:** $GM_T$ at the user's displacement condition.
- **Curve:** $GZ(\phi)$ for $\phi \in [0°, 120°]$ (configurable).
- **Derived:** AVS, peak GZ and its angle, range of positive stability, area under GZ.
- **Interactive heel:** a slider lets the user heel the hull visually; the 3D view shows the rotated hull and current waterplane.

---

## Related

- [hydrostatics.md](hydrostatics.md)
- [hydrodynamics.md](hydrodynamics.md)
- [../variables/performance-metrics.md](../variables/performance-metrics.md)
- [../designs/coaster-analysis.md](../designs/coaster-analysis.md)
