# Side-by-side comparison

Comparison is an organizing principle of bArcas, not a side feature. Most of the app's value accrues when you're looking at two or more hulls at once. This page describes the comparison UX.

The user's stated workflow — *"I plan to make an imitation Coaster and visualize its variables for drag, stability, etc., and when designing I want to compare different hulls side by side"* — is the primary driver for this feature.

---

## What gets compared

A **Comparison** is a first-class resource (see [../project/api-design.md](../project/api-design.md)) containing:

- A set of hulls (2 or more).
- An alignment reference (how they line up in 3D space for visual comparison).
- A set of metrics to overlay.
- A displacement condition (optionally per-hull; optionally a single "fair" condition).

```
Comparison "Coaster study"
├── hulls: [my-attempt-3, library/coaster-style, library/nordkapp-style]
├── aligned_on: "midships"          # or: stem, LCB, LCG, waterline, CG
├── metrics: ["drag_curve", "GZ_curve", "sectional_area_curve"]
├── condition:
│     strategy: "common"             # or "per-hull"
│     common:
│       paddler_mass_kg: 80
│       water_density: 1025
│       ...
```

---

## Visual comparison — the 3D view

Several layout modes:

### 1. Overlay
All hulls rendered in the same 3D scene, transparent, different colors.
- Useful for seeing **shape differences** directly.
- Alignment matters a lot: aligning "midships to midships" vs "stem to stem" tells different stories.

### 2. Split pane
Multiple synchronized viewports, one per hull.
- Same camera angle and zoom.
- Useful for seeing **detail differences** without occlusion.
- Scrollable / scalable grid (2-up, 3-up, 4-up).

### 3. Station overlay
2D body plan, stations from each hull drawn as ghosted lines at each station index.
- Traditional naval-architecture comparison method.
- Clean, precise, low-distraction.

### 4. SAC overlay
All sectional-area curves on one chart.
- A quick read of volume distribution.

### 5. Waterline overlay
Waterplane shape of each hull drawn on top of each other.
- Shows width distribution: where is each hull fullest?

The user picks the layout; all layouts are synchronized on selection, heel angle, displacement condition.

---

## Alignment options

How to place hulls relative to each other in shared space.

| Alignment | What it preserves |
|---|---|
| **Midships** | Both hulls' midpoints of LWL coincide. Good for general shape comparison. |
| **Stem** | Bow tips coincide. Good when comparing hulls of different LOA. |
| **LCB** | Centers of buoyancy coincide. Emphasizes volume-distribution differences. |
| **LCG** | Centers of gravity (with paddler) coincide. Emphasizes load-placement differences. |
| **Waterplane center** | Waterplane centroids coincide. |

No single alignment is "correct" — the user picks based on the question they're asking.

---

## Metric overlays

Quantitative comparison panels that sit alongside the 3D view.

### Drag curve panel
- All hulls' R_T vs. U curves, same axes.
- Optionally: decomposed (friction, wave, total).
- Rulers at reference speeds (1.5, 2.0, 2.5, 3.0 m/s).
- Delta readout: "hull A is 12 N less at 2.5 m/s."

### Stability panel
- All hulls' GZ(φ) curves, same axes.
- Markers at peak GZ, AVS, cockpit flooding angle.

### Coefficient radar
- Spider chart: Cp, Cb, C_WP, L/B, rocker, WSA/V, reserve buoyancy.
- Each hull is a polygon overlay.

### Scalar grid
Side-by-side numeric table — one row per metric, one column per hull. Computed deltas relative to a selected "baseline" hull.

| Metric | my-attempt-3 | coaster-style | nordkapp-style |
|---|---|---|---|
| LOA (m) | 3.85 | **3.81** | 5.50 |
| BWL (m) | 0.57 | 0.58 | 0.52 |
| Displacement (kg) | 114 | **114** | 125 |
| Cp | 0.58 | 0.57 | 0.58 |
| WSA (m²) | 2.71 | 2.68 | 3.25 |
| R_T at 2.5 m/s (N) | 34.8 | 34.2 | **28.4** |
| GM_T (m) | 0.14 | 0.13 | 0.09 |
| AVS (deg) | 118 | 121 | 134 |

Highlighted cells show the "best" or "baseline" per row based on user preference.

---

## Semantic diff

For two hulls where one was forked from the other (or the user has made a sequence of edits), provide a **semantic diff**:

- Which signature curves changed, and by how much.
- Which control points moved.
- Which hydrostatic metrics changed.
- Attribution: for each metric change, which geometric change contributed most.

Example:
> *"Forward rocker reduced by 15 mm → LCB moved forward 4 mm, WSA reduced 0.03 m², drag at 2.5 m/s reduced 0.8 N (2.3%). Max GZ unchanged."*

This is extremely useful for iteration.

---

## Comparison at scale — sweeps

Sometimes you want to compare dozens of hulls — a parameter sweep, a catalog browse, a design-of-experiments run.

- **Pareto view** — scatter of hulls in 2D metric space (drag at 2.5 m/s vs. GM_T, for instance). Pareto front highlighted.
- **Parallel coordinates** — many hulls × many metrics on a single chart.
- **Table view** — sortable, filterable.

Sweeps are a natural output of AI agents (see [ai-workflow.md](ai-workflow.md)).

---

## Comparison as URL

A comparison has a shareable URL. Opening the URL on another machine shows the same hulls, alignment, metrics, and condition. No "paste these hulls into a comparison" step.

---

## API

All comparison operations are API calls:

```
POST   /comparisons                          # create
GET    /comparisons/{id}                     # read
PATCH  /comparisons/{id}                     # modify alignment, metrics
POST   /comparisons/{id}/hulls/{hull_id}     # add a hull
DELETE /comparisons/{id}/hulls/{hull_id}     # remove
GET    /comparisons/{id}/overlay?format=...  # rendered overlay image / data
GET    /comparisons/{id}/scalars             # the scalar grid
```

---

## Related

- [showcase-gallery.md](showcase-gallery.md)
- [ai-workflow.md](ai-workflow.md)
- [../project/visualization.md](../project/visualization.md)
- [../designs/coaster-analysis.md](../designs/coaster-analysis.md)
