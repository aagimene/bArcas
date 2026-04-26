# Performance metrics

Higher-level computed outputs that a designer compares between hulls: drag, stability, speed curves, efficiency. Built on top of the hydrostatic primitives in [computed-hydrostatics.md](computed-hydrostatics.md).

---

## Drag / resistance metrics

Computed for each speed U in a user-chosen range (typically 0 to 3.5 m/s).

| Metric | Symbol | Unit | Source |
|---|---|---|---|
| Frictional resistance | R_F | N | ITTC 1957 + form factor; see [../theory/drag-and-resistance.md](../theory/drag-and-resistance.md) |
| Wave-making resistance | R_W | N | Michell thin-ship integral |
| Appendage resistance | R_APP | N | Simple empirical (skeg + rudder) |
| Aerodynamic drag | R_A | N | Optional; ½·ρ·V²·C_D·A_exposed |
| **Total resistance** | **R_T** | **N** | Sum of above |
| Power required | P | W | R_T · U |
| Specific resistance | R_T / Δg | — | Non-dimensional "how much you push per unit weight you carry" |

### Derived at reference speeds

ArcasBoat picks a handful of "reference speeds" for headline comparison:

| Speed | Use case |
|---|---|
| 1.5 m/s (≈ 3 kn) | Cruising pace for recreational paddlers |
| 2.0 m/s (≈ 4 kn) | Fit-touring pace |
| 2.5 m/s (≈ 5 kn) | Fast touring |
| 3.0 m/s (≈ 6 kn) | Racing cruise |
| 3.5 m/s (≈ 7 kn) | Sprint |

For each, the app reports R_T and P.

### The drag curve

A plot of R_T vs. U (and its decomposition). The curve's *shape* is more informative than any single number — humps reveal wave-interference regions; the low-speed slope reveals friction dominance; the high-speed slope reveals wave-making dominance.

---

## Stability metrics

| Metric | Unit | Notes |
|---|---|---|
| GM_T (transverse metacentric height) | m | Primary small-angle stability number |
| Max GZ | m | Peak righting arm |
| Angle at max GZ | deg | Where secondary stability peaks |
| Angle of vanishing stability (AVS) | deg | First zero crossing of GZ after peak |
| Range of positive stability | deg | 0° to AVS |
| Area under GZ curve | m·deg or m·rad | "Reserve" stability energy |
| Roll period (small-angle) | s | 2π · k_xx / √(g·GM_T) |
| Cockpit flooding angle | deg | Heel at which water enters the cockpit |

### Stability curve

GZ(φ) for φ in 0–120° (configurable). Shown as a chart.

---

## Maneuverability / tracking

Qualitative in phase 1, quantitative later:

- **Effective skeg area** — the vertical projection of the aft underwater profile.
- **Rocker asymmetry** — bow rocker vs stern rocker ratio, drives tracking balance.
- **Turning moment per edge degree** — ∂(yaw moment) / ∂(heel), for a given speed. Needs dynamic solver (phase 3+).

---

## Seaworthiness indicators

Qualitative in phase 1:

- **Reserve buoyancy forward** — volume above waterline in the forward 25% of LWL.
- **Reserve buoyancy aft** — same, aft 25%.
- **Deck volume fraction** — deck volume as fraction of total hull volume.
- **Freeboard at midships** — sheer height above waterplane at midship section.

These don't feed directly into a number but are reported and compared.

---

## Efficiency metrics

| Metric | Formula | Use |
|---|---|---|
| Drag-to-weight ratio | R_T / (Δ · g) | "How hard it is to push per kg carried" |
| Power-to-weight ratio | P / (Δ · g) | Similar, at speed |
| Wetted surface per unit displacement | S / V^(2/3) | Slenderness × surface efficiency |
| Transport efficiency | Δ · U / P | "Kayak-kg-m per watt" — range/endurance oriented |

---

## Comparison-friendly metrics

When comparing hulls (see [../features/side-by-side-comparison.md](../features/side-by-side-comparison.md)):

- Overlay drag curves on one chart.
- Overlay GZ curves on one chart.
- Scatter L/B vs. Cp with reference hulls shown.
- Radar chart of (drag at U_ref, GM_T, AVS, WSA/V, reserve buoyancy fore/aft) for quick head-to-head.

---

## Reported with provenance

Every performance metric ships with:

```json
{
  "value": 38.4,
  "unit": "N",
  "method": "ITTC 1957 + Michell thin-ship",
  "assumptions": ["deep water", "flat water", "paddler static", "k=0.12"],
  "validity_range": { "Fr": [0.05, 0.45] },
  "uncertainty_pct": 20
}
```

No raw-number reporting without this envelope.

---

## Related

- [design-variables.md](design-variables.md)
- [computed-hydrostatics.md](computed-hydrostatics.md)
- [simulation-parameters.md](simulation-parameters.md)
- [../theory/drag-and-resistance.md](../theory/drag-and-resistance.md)
- [../theory/stability.md](../theory/stability.md)
