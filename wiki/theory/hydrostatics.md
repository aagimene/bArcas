# Hydrostatics

Static fluid-force calculations on a hull at rest (or moving slowly enough that dynamic effects are secondary). This is the solid ground of hull design — given a shape and a displacement condition, the answers are exact up to numerical integration.

---

## Archimedes' principle

A body floats when the weight of water it displaces equals its own weight:

$$
\rho_w \, g \, V = m \, g \qquad \Rightarrow \qquad V = \frac{m}{\rho_w}
$$

where $V$ is the **displaced volume**, $m$ the total mass (boat + paddler + gear), $\rho_w$ the water density (≈ 1000 kg/m³ fresh, ≈ 1025 kg/m³ seawater).

The **waterplane** is the horizontal plane that cuts the hull at exactly the right height to displace volume $V$. Finding it is the first hydrostatic solve.

---

## Finding the waterplane (static float solve)

Given hull geometry and a desired displacement $V^\*$, solve for the waterplane height $z_{wl}$ such that
$$
V(z_{wl}) = V^\*
$$

This is a 1D root-find on a monotonic function (volume below-plane is monotonic in plane height). Bisection or Brent's method converges in a dozen iterations.

For **trim** (fore-aft angle), we additionally require the longitudinal moment of buoyancy to balance the longitudinal center of gravity (LCG), giving a 2D solve: waterplane height and trim angle. For **heel**, a third equation (transverse moment) is added — we usually treat heel separately in [stability.md](stability.md).

---

## Volume, centers, and moments

### Displaced volume

$$
V = \iint_{\text{hull}_{<wl}} dV
$$

Computed in bArcas either:
- **Analytically from the parametric surface** via the divergence theorem (integrate $\frac{1}{3} \mathbf{r}\cdot\mathbf{n}\, dA$ over a closed region) — exact for the NURBS surface, fast.
- **By Simpson's rule over sectional areas** — classic naval-architecture approach, also accurate if stations are dense enough.

### Sectional area curve

At each station $x$, let $A(x)$ = cross-sectional area below the waterplane. Then:

$$
V = \int_{x_{aft}}^{x_{fwd}} A(x)\, dx
$$

The shape of the sectional-area curve (SAC) is a huge deal in hull design — its skewness and peak govern much of the wave-making behavior. See [drag-and-resistance.md](drag-and-resistance.md).

### Longitudinal center of buoyancy (LCB)

$$
x_{LCB} = \frac{1}{V} \int x\, A(x)\, dx
$$

LCB is where the buoyancy force effectively acts. For the boat to trim level, **LCB must equal LCG** (longitudinal center of gravity). Designers care a lot about LCB placement — too far aft and the bow rides high; too far forward and the stern squats.

### Vertical center of buoyancy (VCB, or KB)

$$
z_{VCB} = \frac{1}{V} \iint z\, dV
$$

VCB is the height of the center of buoyancy above the baseline (keel). Used in stability calculations.

### Transverse center of buoyancy (TCB)

Zero for symmetric hulls on even keel. Non-zero when heeled; drives the righting moment. See [stability.md](stability.md).

---

## Waterplane area and its moments

The **waterplane** is the horizontal slice through the hull at the waterline — a closed 2D region in the $x$–$y$ plane.

### Waterplane area

$$
A_{wp} = \iint_{waterplane} dA
$$

Governs how much the boat rises/sinks when loaded: the **tons per cm immersion** (TPCI) is $\rho_w \cdot A_{wp}$ (at kayak scale, kilograms per cm).

### Longitudinal center of flotation (LCF)

$$
x_{LCF} = \frac{1}{A_{wp}}\iint x\, dA
$$

LCF is the "pivot point" for small trim changes. Load placed exactly at LCF doesn't change trim.

### Moments of inertia of the waterplane

$$
I_T = \iint y^2\, dA \qquad I_L = \iint (x - x_{LCF})^2\, dA
$$

$I_T$ is the transverse moment of inertia of the waterplane area; $I_L$ is the longitudinal. These give us the metacentric radii:

$$
BM_T = \frac{I_T}{V} \qquad BM_L = \frac{I_L}{V}
$$

See [stability.md](stability.md) for how these feed into GM.

---

## Wetted surface area (WSA)

$$
S = \iint_{\text{hull surface below waterplane}} dA
$$

Directly proportional to skin-friction drag (see [drag-and-resistance.md](drag-and-resistance.md)). Computed by summing triangle areas below the waterplane.

For a typical sea kayak: WSA ≈ 2.5 – 3.5 m².
For a K1: WSA can be as high (longer, so more surface) despite narrower beam — a key reason K1s aren't low-drag at every speed.

---

## Hull coefficients

Dimensionless ratios that compress a hull's shape into a few numbers. Useful for comparison across boats of different size.

Let:
- $L$ = waterline length (LWL)
- $B$ = waterline beam (BWL), maximum
- $T$ = draft (maximum immersed depth)
- $V$ = displaced volume
- $A_m$ = midship sectional area

### Block coefficient ($C_B$)
$$
C_B = \frac{V}{L \cdot B \cdot T}
$$
How much of the bounding box is actually hull. Ships: 0.5–0.85. Kayaks: 0.3–0.5 (slender, fine-ended).

### Prismatic coefficient ($C_P$)
$$
C_P = \frac{V}{L \cdot A_m}
$$
How full the ends are, for a given midship section. **Probably the single most important coefficient for predicting wave-making resistance at low Froude number.** Typical values:
- Slow, fat hulls (Cp ≈ 0.55–0.60): efficient at very low Froude.
- **Sea kayaks: Cp ≈ 0.55–0.60.**
- **K1 sprint, surfskis: Cp ≈ 0.60–0.66** (fuller ends, optimized for higher cruise Froude).
- Planing hulls: not meaningful (different regime).

### Midship coefficient ($C_M$)
$$
C_M = \frac{A_m}{B \cdot T}
$$
Ratio of midship section area to its bounding rectangle. Box-shaped sections: near 1. Round-bilged kayaks: 0.6–0.8.

### Waterplane-area coefficient ($C_{WP}$)
$$
C_{WP} = \frac{A_{wp}}{L \cdot B}
$$
How full the waterplane. Sea kayaks: ~0.75–0.85.

### Length-to-beam ratio (L/B)
$$
\text{L/B} = \frac{L}{B}
$$
Slenderness. Sea kayaks: 7–10. K1s: 10–13. Surfskis: 10–14.

### Displacement-length ratio (metric or imperial)

Imperial form (sometimes seen): $\text{DLR} = \Delta_\text{LT} / (0.01 L_\text{ft})^3$ where $\Delta_\text{LT}$ is displacement in long tons. For kayaks the numbers are tiny, so we generally just report displacement in kg and LWL in m.

---

## Hydrostatic curves

Functions of waterline height (useful for displacement sensitivity):

| Curve | Meaning |
|---|---|
| $V(z_{wl})$ | Volume as function of waterline height |
| $A_{wp}(z_{wl})$ | Waterplane area — "TPCI" curve |
| $LCB(z_{wl})$ | Where buoyancy acts, varies with load |
| $KB(z_{wl})$ | Height of buoyancy |
| $BM_T(z_{wl})$, $BM_L(z_{wl})$ | Metacentric radii |

Plotted together these are the classic **Bonjean / hydrostatic curves** sheet. bArcas will generate these on demand.

---

## What bArcas reports at each load condition

For a given displacement condition (loaded mass, LCG, water density):

| Quantity | Symbol | Unit |
|---|---|---|
| Displaced volume | $V$ | m³ |
| Displaced mass | $\Delta$ | kg |
| Waterline length | LWL | m |
| Waterline beam | BWL | m |
| Max draft | $T$ | m |
| Waterplane area | $A_{wp}$ | m² |
| Wetted surface area | WSA | m² |
| Longitudinal center of buoyancy | LCB | m from midships |
| Vertical center of buoyancy | KB | m from baseline |
| Transverse metacentric radius | $BM_T$ | m |
| Longitudinal metacentric radius | $BM_L$ | m |
| Block coefficient | $C_B$ | — |
| Prismatic coefficient | $C_P$ | — |
| Midship coefficient | $C_M$ | — |
| Waterplane-area coefficient | $C_{WP}$ | — |

All computed from the current hull geometry and condition. All cacheable by hull-hash × condition-hash.

---

## Related

- [hull-geometry-representation.md](hull-geometry-representation.md)
- [stability.md](stability.md)
- [drag-and-resistance.md](drag-and-resistance.md)
- [../variables/computed-hydrostatics.md](../variables/computed-hydrostatics.md)
