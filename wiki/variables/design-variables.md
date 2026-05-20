# Design variables

Variables the *designer* directly sets. In bArcas every one of these is also an API parameter — see [../project/api-design.md](../project/api-design.md).

---

## High-level parametric variables

These form a "parametric template" — a minimal spec from which a reasonable starting hull can be generated, to be refined afterward.

| Variable | Symbol | Typical kayak range | API type |
|---|---|---|---|
| Length overall | LOA | 2.0–6.5 m | float, m |
| Waterline length | LWL | typically 0.8–0.95 × LOA | float, m |
| Maximum beam | B_max | 0.45–0.75 m | float, m |
| Waterline beam | B_WL | typically 0.8–0.95 × B_max | float, m |
| Depth of hull | D | 0.25–0.45 m | float, m |
| Max draft | T | 0.10–0.30 m | float, m |
| Rocker (bow + stern) | — | 0.02–0.20 m each end | float, m |
| Entry half-angle | α_entry | 10°–30° | float, deg |
| Exit / run half-angle | α_exit | 10°–30° | float, deg |
| Prismatic coefficient target | C_P | 0.50–0.66 | float |
| Longitudinal position of max beam | x_Bmax | 0.45–0.55 of LWL | float, 0..1 |
| Chine style | — | hard / soft / multi | enum |
| Section shape family | — | V / shallow V / round / flat / semicircular | enum |
| Tumblehome or flare | — | negative → positive | float or profile |
| Deck peak height | — | 0.05–0.25 m above sheer | float, m |
| Has cockpit | — | bool | |
| Cockpit length × width × position | — | — | floats |

A parametric template populates sensible defaults for everything not specified.

---

## Control-net variables (fine-grained)

Once you go below the parametric layer, the designer works directly on the NURBS control net:

- **Control point positions** (x, y, z) per net per (i, j).
- **Control point weights** (NURBS only).
- **Knot vectors** (rarely edited; user-facing only for advanced users).
- **Surface degree** in u and v (set at template creation; rarely changed).

Every modification is an API call: `PUT /hulls/{id}/control_nets/{net_id}/points/{i}/{j}`.

---

## Signature-curve variables (BearBoat-style)

If the designer is working in "signature curves" mode (see [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)):

- **Sheer line** — a 3D curve (control points in x,z plus y per point).
- **Keel line** — a 2D profile in the center plane (x, z per control point).
- **Max-beam curve** — a 2D curve in plan (x, y per control point).
- **Chine line** (if hard-chined) — a 3D curve.
- **Stem profile** — the bow stem's shape in profile.
- **Stern profile** — the stern's shape in profile.
- **Deck centerline** — a 2D profile in the center plane (above sheer).

These curves, with their control points, are all individually scriptable via the API.

---

## Higher-level shape ops

Operations that modify the hull at a level above individual control points:

- `adjust_rocker(at: "bow"|"stern"|"both", delta_m)`
- `scale_beam(factor, at_stations: list | "all")`
- `shift_lcb(delta_m)` — re-distribute volume to move LCB.
- `set_prismatic(target_Cp)` — re-shape the sectional-area curve to hit a Cp target.
- `add_flare(delta_deg, above_height_m)` — widen topsides above a reference height.
- `add_tumblehome(delta_deg, above_height_m)` — opposite.
- `sharpen_entry(delta_deg)` — reduce entry half-angle by re-shaping forward waterlines.
- `fillet_chine(radius_m)` — soften a hard chine to a given radius.
- `offset_surface(thickness_m)` — generate a mold shell (see [../project/export-formats.md](../project/export-formats.md)).

Each decomposes internally into control-point operations but is first-class for humans and agents.

---

## Displacement condition variables

Separate from the hull geometry itself; specifies the load state for hydrostatic / stability / drag analysis.

- **Paddler mass** (kg)
- **Paddler seat position** (x, y, z) — a point in the hull frame
- **Paddler CG offset from seat** (z, typically 0.4–0.5 m — torso above seat)
- **Gear / cargo** — list of { mass, position } entries
- **Water density** — fresh (1000 kg/m³) or sea (1025 kg/m³)
- **Trim input** (optional) — user can force a trim rather than letting the solve find equilibrium
- **Heel input** (optional) — same, for stability analysis at a specific heel

---

## Appendage variables

- **Skeg** — present? deployed? area, position, section.
- **Rudder** — present? under-hull position, area, section.
- **Dagger board** — rare for kayaks.

Appendages contribute to mass, drag, and side force; they're separate from the hull NURBS.

---

## Symmetry and mirror

- **Port-starboard symmetry** — default on, can be turned off for asymmetric designs (rare but possible for some experimental hulls or Greenland replicas with asymmetric seam lines).

---

## Provenance and metadata

- **Name**
- **Designer** (free text or linked user)
- **Inspired by / forked from** — points to another hull ID
- **Tags** (surf-play, expedition, sprint, recreational, …)
- **Notes** (markdown)

All queryable via API for search and comparison.

---

## What the API returns when you GET a hull

```json
{
  "id": "h-abc123",
  "name": "Coaster-inspired #3",
  "forked_from": "library/coaster-v1",
  "parameters": { "loa_m": 3.80, "beam_m": 0.66, "rocker_bow_m": 0.04, ... },
  "control_nets": [ { ... } ],
  "signature_curves": { "sheer": [...], "keel": [...], ... },
  "displacement_condition": {
     "paddler_mass_kg": 80, "paddler_seat_x_m": 2.05, ...
  },
  "appendages": [ {"type":"skeg", ... } ],
  "tags": ["sea-kayak", "surf"],
  "provenance": { "forked_from": "library/coaster-v1", "designer": "..." }
}
```

---

## Related

- [computed-hydrostatics.md](computed-hydrostatics.md)
- [performance-metrics.md](performance-metrics.md)
- [../project/api-design.md](../project/api-design.md)
- [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)
