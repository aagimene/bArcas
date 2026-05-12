# Drag and resistance

How ArcasBoat estimates the force required to push a kayak through still water at a given speed. This is the single most-requested performance number; it also encapsulates the app's commitment to honest physics.

---

## Total resistance decomposition

We decompose total resistance $R_T$ as:

$$
R_T = R_F \;+\; R_W \;+\; R_\text{APP} \;+\; R_A
$$

| Component | Source | Our method |
|---|---|---|
| $R_F$ frictional | Skin friction on wetted surface | ITTC 1957 flat-plate + form factor |
| $R_W$ wave-making | Gravity waves on free surface | Michell's integral (thin-ship) |
| $R_\text{APP}$ appendage | Skeg, rudder, seat skirts | Empirical add-on |
| $R_A$ air / aerodynamic | Wind on exposed body + hull | Optional, small |

There are also **squat** and **trim-induced** effects that change the waterline shape as speed increases; we handle them by re-solving the trim equilibrium at each speed in the drag curve.

---

## Frictional resistance — ITTC 1957

$$
R_F = \tfrac{1}{2}\rho U^2 \cdot S \cdot C_F (1 + k)
$$

with:
- $\rho$ — water density (1000 kg/m³ fresh, 1025 kg/m³ sea).
- $U$ — speed through water (m/s).
- $S$ — wetted surface area (m²), from [hydrostatics.md](hydrostatics.md).
- $C_F$ — ITTC 1957 friction coefficient: $C_F = 0.075 / (\log_{10} Re - 2)^2$.
- $Re$ — Reynolds number based on $L_\text{WL}$.
- $k$ — form factor (≈ 0.1 for slender sea kayaks, ≈ 0.15–0.2 for fuller hulls).

**Validity.** ITTC 1957 is well-established for turbulent flow over ship-like hulls; kayak-scale $Re \sim 10^7$ sits comfortably in its validated range. The form factor $k$ is empirical and is the biggest source of per-hull uncertainty.

### What this tells designers

At low speeds, $R_F$ dominates. Reducing it is almost entirely about reducing **wetted surface area** (without sacrificing too much displacement or stability).

Two hulls of equal length and displacement can have meaningfully different $S$ — a round-bilged hull typically has less surface per volume than a flat-bottomed one, for instance.

---

## Wave-making resistance — Michell's integral

For a slender hull (thin-ship), the wave-making resistance in deep water is:

$$
R_W = \frac{4\rho g^2}{\pi U^2} \int_1^{\infty} \frac{\lambda^2}{\sqrt{\lambda^2 - 1}} \left( |P(\lambda)|^2 + |Q(\lambda)|^2 \right) d\lambda
$$

where $P, Q$ are Fourier-like transforms of the **hull offset function** $y = f(x,z)$:

$$
P(\lambda) + iQ(\lambda) = \iint \frac{\partial f}{\partial x}\, e^{-\lambda^2 k_0 z}\, e^{-i\lambda k_0 x}\, dx\, dz
$$
with $k_0 = g/U^2$.

We can compute this numerically from a tessellation of the hull. Leo Lazauskas's [Michlet](http://www.cyberiad.net/) and its descendants are the standard open implementation; FreeShip contains a compatible implementation we can learn from.

### Validity

Thin-ship assumes the hull is a small vertical disturbance to a flat water plane. Kayaks have length-to-beam ratios of 7+ — they're slender enough for Michell to be a good approximation. Error typically 10–30% vs. experiment; structurally correct in the trend sense.

### Features of the $R_W$ curve

- Starts at ~0 for very slow speeds.
- Has a series of **humps and hollows** at specific Froude numbers (due to interference between bow and stern wave systems).
- Rises steeply around $Fr \approx 0.4$.
- For sufficiently slender hulls, continues rising but more smoothly above that.

Humps-and-hollows are real, and they matter: a hull that's optimized for $Fr = 0.33$ might have noticeably *more* drag at $Fr = 0.36$ because of a wave-interference peak.

More details and the "hull speed" discussion: [wave-making.md](wave-making.md).

---

## Appendage drag

Skegs, rudders, and dagger boards add:
- Extra wetted surface → added $R_F$.
- Form drag depending on foil section and angle of attack.
- Induced drag if generating side force.

Simple model:
$$
R_\text{APP} \approx \tfrac{1}{2}\rho U^2 \cdot S_\text{APP} \cdot (C_{D_0} + C_L^2 / (\pi A R))
$$

For a deployed skeg at zero yaw: $C_{D_0} \sim 0.01$, small. Under yaw: induced drag becomes significant.

At phase 1, we treat appendages as optional with a simple drag model; at phase 3 we could model them as lifting surfaces with strip theory.

---

## Aerodynamic drag

$$
R_A \approx \tfrac{1}{2}\rho_\text{air} V_a^2 \cdot C_{D,\text{air}} \cdot A_\text{exposed}
$$

Tiny at calm-air kayak speeds (paddler exposes perhaps 0.3 m² frontal area; $R_A$ at 2 m/s water speed in still air is under 2 N). Becomes non-negligible in headwind. Optional in ArcasBoat.

---

## The drag curve

For a hull + condition, ArcasBoat computes:

$$
R_T(U) \text{ for } U \in [0, U_\text{max}]
$$

typically sampled at 20–40 speeds between 0 and 3.5 m/s. The curve is shown as **total** plus **decomposition** (frictional, wave, other):

```
  R (N)
  │                            ╱── total
  │                           ╱╱
  │                          ╱╱── wave-making
  │                        ╱╱
  │                      ╱╱
  │                  ╱──╯
  │              ╱──╯── frictional
  │ ───────────╯
  └──────────────────────────────── U (m/s)
  0      1      2      3
```

### Power required

Power is $P = R_T U$. Often more useful to paddlers than force alone, since paddler output is naturally expressed in watts.

### Speed at a given sustained power

Inverse lookup: "at 100 W continuous output (moderate paddler), what's the cruise speed?" → find $U$ such that $R_T(U) U = 100$.

Typical numbers:
- Recreational paddler: ~50 W sustained.
- Fit touring paddler: ~100 W sustained, ~200 W for short intervals.
- Elite sprint racer: ~300–400 W in a 500 m race.
These are orders of magnitude — they vary wildly between paddlers.

---

## Sensitivity and what designers learn

ArcasBoat will offer, for a given hull and target speed:

- **Partial derivatives** of drag with respect to design variables (beam, rocker, Cp, …).
- **Which component dominates** at this speed — friction or wave?

Rules of thumb from this analysis:

| Regime | What matters |
|---|---|
| Low Fr (< 0.25) | Minimize wetted surface. Longer+narrower helps if it reduces $S$; fuller sections hurt. |
| Mid Fr (0.25–0.40) | Balance. Prismatic coefficient matters (typically Cp ≈ 0.56–0.62 optimal). |
| High Fr (> 0.40) | Minimize wave-making. Longer hull, finer ends, pay in $S$. |

---

## Honesty guarantee

Every drag number displayed in ArcasBoat must carry:
- **Value** (and units).
- **Method** — e.g., "ITTC 1957 + Michell thin-ship + $k=0.12$."
- **Assumptions** — flat water, no wind, no current, hull at static trim.
- **Uncertainty band** — typical ±20% on total drag at design speeds; larger if Michell is extrapolated beyond its validity.

No hidden tuning coefficients. No "correction to match experiment X" without citing X.

---

## Validation targets

Where we calibrate:

- Published drag measurements for rowing shells (Lazauskas papers).
- Tank tests on kayak hulls (a handful of published datasets exist).
- Comparison to BearBoatXL's own resistance output on identical hulls (we can run it manually from `~/Applications`).
- Comparison to the **Nautilus / ProSurf** resistance stack (Holtrop / Delft 3 / Kaper /
  DispMode-Savitsky). See [../research/nautilus-system.md](../research/nautilus-system.md#resistance--four-named-models).
  Nautilus's `Kaper` option is the **canoe/kayak-specific empirical regression** and is the
  closest direct analog to what we want in the kayak speed range.

---

## Alternative empirical models (selectable, citation-tracked)

Per the wiki's commitment to surface the formula behind every reported number, ArcasBoat
should also expose the following empirical methods alongside the Michell-thin-ship default.
Each runs from the same hydrostatic state and is selected by the user (or an agent) per
hull:

| Method | Regime | Citation | When to prefer |
|---|---|---|---|
| **Michell thin-ship + ITTC 1957** | Slender displacement (default for kayaks) | Michell 1898; ITTC 1957 | Default. |
| **Kaper (Winters / Killing)** | Canoes and kayaks | John Winters, *The Shape of the Canoe*; Steve Killing regression | Short, beamy hulls where Michell's slenderness assumption gets thin. |
| **Holtrop & Mennen** | Displacement ships and powerboats | Holtrop & Mennen, *Int. Shipbuilding Progress* Vol 29 (1982); Holtrop, ISP Vol 31 (1984) | Powerboats / canoes-with-engine extreme case; mostly out of kayak scope but easy to include since the same Geosim decomposition fits. |
| **Delft Series III** | Sailboats | Delft Yacht Hydrodynamics group regressions | Out of scope. Recorded for completeness. |
| **Savitsky / DispMode** | Planing hulls | Savitsky, *Marine Tech* (1964) | Out of scope. |

The decomposition stays the same in all cases:

```
R_total = R_friction + R_wave + R_correlation + R_appendage + R_air
        + (model-specific terms: bulb, transom, planing lift)
```

(form per `HullVary §Geosim Coefficient Resistance Evaluation` in
[`resources/Nautilus/docs/HullVary.txt`](../../resources/Nautilus/docs/HullVary.txt)).

---

## Related

- [hydrodynamics.md](hydrodynamics.md)
- [wave-making.md](wave-making.md)
- [hydrostatics.md](hydrostatics.md)
- [../variables/performance-metrics.md](../variables/performance-metrics.md)
- [../research/kayak-design-literature.md](../research/kayak-design-literature.md) — Lazauskas, Winters
