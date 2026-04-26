# Simulation parameters

Environmental and numerical knobs that control how analyses are computed. Separate from hull geometry (see [design-variables.md](design-variables.md)) and from computed outputs (see [computed-hydrostatics.md](computed-hydrostatics.md)).

---

## Water / environment

| Parameter | Typical value | Notes |
|---|---|---|
| Water density ρ | 1000 kg/m³ fresh, 1025 kg/m³ sea | Affects displacement, drag |
| Water kinematic viscosity ν | 1.00 × 10⁻⁶ m²/s at 20 °C; 1.35 × 10⁻⁶ at 10 °C | Affects Re → C_F |
| Water temperature | 20 °C default | Sets ρ and ν |
| Water depth | infinite (deep) default | Shallow-water effects phase 3+ |
| Gravity g | 9.81 m/s² | Rarely changed |

## Atmosphere (for aero)

| Parameter | Typical |
|---|---|
| Air density | 1.225 kg/m³ |
| Wind speed | 0 (default) |
| Wind direction | N/A |

## Sea state (for seakeeping — phase 3+)

| Parameter | Typical |
|---|---|
| Significant wave height H_s | 0 – 2 m |
| Peak period T_p | 4 – 10 s |
| Spectrum | JONSWAP or Pierson-Moskowitz |
| Heading (relative to waves) | 0 – 180° |

---

## Drag-estimator parameters

| Parameter | Default | Notes |
|---|---|---|
| Frictional model | ITTC 1957 | Could swap in Schultz or Grigson |
| Form factor k | 0.10 (sea kayak default), 0.12 (general) | Per-hull adjustable |
| Wave-making solver | Michell thin-ship | Alternatives: empirical fit, panel method |
| Speed range | 0.2 – 3.5 m/s | Adjustable |
| Speed sample count | 30 | More = smoother curve, more compute |
| Include appendage drag | off by default | Skeg / rudder toggle |
| Include aero drag | off by default | Needs wind speed |

## Stability-solver parameters

| Parameter | Default | Notes |
|---|---|---|
| Heel sweep start | 0° | |
| Heel sweep end | 120° | Past AVS for most hulls |
| Heel sweep step | 2° | Refined near AVS |
| Allow water ingress at cockpit | yes | Once cockpit floods, stability curve terminates |
| Displacement conservation tolerance | 0.1% | Waterplane-solve convergence |

## Mesher parameters

| Parameter | Default | Notes |
|---|---|---|
| Chord deviation | 0.1 mm for export, 1 mm for display | Finer = slower |
| Adaptive refinement | on | More triangles near high-curvature regions |
| Max triangles | 200k for interactive, 2M for export | Guardrail |

## Export parameters (see [../project/export-formats.md](../project/export-formats.md))

| Parameter | Default | Notes |
|---|---|---|
| STEP tolerance | 0.01 mm | Geometric fidelity |
| STEP units | mm | CAM convention |
| STL tolerance | 0.15 mm | 3D-printing default |
| STL binary | yes | vs ASCII |
| 3MF units | mm | |
| Mold offset thickness | 8 mm (GRP mold typical) | |
| Mold parting line | "sheer" (default) or user-curve | |

---

## Why these are first-class parameters

All simulation parameters are serialized into the hull document's `analysis_config` block, so that:

- Analysis results are **reproducible** (same hull + same config → same numbers).
- Comparisons are **fair** (comparing hull A's drag at ITTC+Michell vs hull B's at Schultz would mislead).
- AI agents know **exactly what conditions were assumed**.
- Users can **export + share** not just hulls but the analysis context.

---

## Related

- [design-variables.md](design-variables.md)
- [computed-hydrostatics.md](computed-hydrostatics.md)
- [performance-metrics.md](performance-metrics.md)
- [../theory/hydrodynamics.md](../theory/hydrodynamics.md)
- [../theory/drag-and-resistance.md](../theory/drag-and-resistance.md)
- [../project/export-formats.md](../project/export-formats.md)
