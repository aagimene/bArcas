# Wave-making resistance (and the "hull speed" story)

Wave-making is the part of hull-design intuition that most often misleads beginners. This page gives a careful treatment.

---

## What "hull speed" actually is

The folk formula:
$$
U_\text{hull, knots} \approx 1.34 \sqrt{L_\text{WL, ft}}
$$

corresponds to $Fr \approx 0.40$ (roughly). It represents the speed at which the wavelength of the waves the hull makes at the bow equals the waterline length. Above this speed, the hull struggles to "climb out of its own wave" — the quarter wave trough forms behind midships, the stern drops into it, and the hull trims up bow-high.

**It is not a wall.** Hulls can and routinely do exceed it. What's true:

- Wave-making resistance **rises steeply** in this region.
- For heavy displacement hulls (ships), it's essentially an economic speed limit.
- For slender hulls (kayaks, rowing shells, long canoes), it's a region of rising cost, not a wall — you can paddle above it at the price of extra effort.

K1 sprinters routinely operate above $Fr = 0.45$. Surfskis can sustain $Fr \sim 0.50$ on downwind runs. Touring sea kayaks rarely exceed $Fr \sim 0.35$ comfortably.

---

## Why the hump exists — bow and stern wave interference

A moving hull makes two wave systems:
- **Bow wave** — crest at the bow, typical wavelength $\lambda = 2\pi U^2 / g$.
- **Stern wave** — secondary system originating near the stern.

As $U$ increases, $\lambda$ grows. At any speed, the stern sits somewhere in the bow-wave pattern. When the stern lies at a **crest** (constructive interference), wave-making is high. When at a **trough** (destructive), wave-making is locally low.

This produces **humps and hollows** in the wave-making resistance curve. The dominant hump occurs near $Fr \approx 0.40$ where the bow wavelength equals $L$. Secondary humps exist at lower Froude numbers.

---

## Michell's integral (1898)

For a slender, port-starboard-symmetric hull moving steadily on deep water, J. H. Michell derived:

$$
R_W = \frac{4\rho g^2}{\pi U^2} \int_1^{\infty} \frac{\lambda^2}{\sqrt{\lambda^2 - 1}} \big(|P|^2 + |Q|^2\big)\, d\lambda
$$

with the source strengths
$$
P(\lambda) + iQ(\lambda) = \iint_{\text{hull centerplane}} \frac{\partial f(x,z)}{\partial x} \, e^{-\lambda^2 k_0 z} \, e^{-i \lambda k_0 x}\, dx\, dz,
$$
$k_0 = g/U^2$.

### In English

Michell says the hull's wave-making can be computed from:
1. The **slope** of the hull surface along its length ($\partial f / \partial x$).
2. Weighted by a depth decay ($e^{-\lambda^2 k_0 z}$ — deep parts of the hull make fewer waves).
3. Fourier-transformed in $x$ at wave numbers $\lambda k_0$.
4. Integrated against a kernel that captures the wave-energy spectrum.

This is why **finer ends** reduce wave-making: $\partial f/\partial x$ is small there. A "fat" bow has a big $\partial f/\partial x$ → strong Fourier components → more waves → more drag.

### Assumptions (= limits)

- **Slender body.** Beam ≪ length.
- **Thin ship.** The hull is a small perturbation to the undisturbed free surface — linearization.
- **Deep water.** Formulas change in shallow water.
- **Steady motion.** No wave-body motion coupling.
- **No viscosity.** Add $R_F$ separately.

For a typical sea kayak (L/B ≈ 8–10), the slender and thin assumptions are *reasonable but imperfect*. Michell tends to **overestimate** wave-making somewhat; published tank measurements for rowing shells and slender hulls show Michell within ~20–30% of experiment with the trend correct.

### Practical computation

We discretize the hull centerplane and compute $P, Q$ by FFT-like integration, then numerically integrate the outer integral. A full drag-curve sweep (30 speeds) runs in well under a second on modern hardware.

---

## Sectional area curve (SAC)

A useful abstraction: collapse the hull to its sectional-area curve $A(x)$ — cross-section area below waterline at each station. Michell's integral can be rewritten in terms of $A(x)$ and its derivatives.

Designers learn to read SACs at a glance:
- **Peaked SAC** (sharp midship peak, fine ends) — low wave-making at low-to-mid Fr, favored for slow cruising.
- **Flatter SAC** (fuller ends, broader peak) — can be better at higher Fr, at the cost of higher wetted surface.
- **Skewness** (LCB fore/aft of midships) — shifts the humps/hollows in the drag curve.

The prismatic coefficient $C_P$ (see [hydrostatics.md](hydrostatics.md)) is essentially "how flat is the SAC relative to its peak." Low Cp = peaked SAC; high Cp = flat SAC.

---

## Empirical shortcuts

For quick estimates without computing Michell:

### Gerritsma / Holtrop-style regressions

Empirical formulas fit to tank data. Not directly valid at kayak scale (they were calibrated on ships), but the functional form is instructive.

### Taylor series (rowing / kayak literature)

Lazauskas has published fits for rowing shells and surfskis that express $R_W/\Delta$ as a function of $Fr_\nabla$, L/B, and Cp. Useful as a sanity check on Michell output.

---

## "But what about shallow water?"

Shallow water changes everything:
- Phase speed of waves depends on depth: $c^2 = g h$ in the limit of very shallow.
- Critical Froude depth: $Fr_h = U/\sqrt{gh} = 1$ is a real wall (supercritical vs subcritical).
- Kayaks paddling in shallow water (< ~1 m, at typical speeds) experience noticeably more wave drag.

Phase 1: deep-water assumption. Shallow-water model is a phase-3+ feature.

---

## Breaking waves and spray

At sufficiently high $Fr$, bow waves can break — a nonlinear phenomenon not in any linear theory. Kayaks rarely reach this regime in calm water; it matters mostly in surf and for planing hulls.

---

## What ArcasBoat reports

- **$R_W(U)$** curve.
- **Humps and hollows** marked.
- **Dominant Fourier components** of the hull's wave spectrum, visualized as a "kayak wake" on the 3D ground plane.
- **Sensitivity** to:
  - Prismatic coefficient.
  - LCB.
  - Rocker distribution.
  - End fineness (entry half-angle).

Hover any metric to see the attribution.

---

## Related

- [hydrodynamics.md](hydrodynamics.md)
- [drag-and-resistance.md](drag-and-resistance.md)
- [hydrostatics.md](hydrostatics.md)
- [../designs/k1-sprint.md](../designs/k1-sprint.md)
- [../designs/surfski.md](../designs/surfski.md)
