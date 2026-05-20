# Hull geometry representation

The conventional naval-architecture views of a hull, and how bArcas's internal geometry (NURBS surfaces, lofted curves) maps onto them.

---

## Axes convention

bArcas uses:
- **x** — longitudinal, positive toward bow.
- **y** — transverse, positive to starboard (right, looking from stern toward bow).
- **z** — vertical, positive upward.
- Origin at **aft perpendicular (AP)** for calculations, though exposed metrics (LCB, LCG) may be reported relative to midships.

Kayaks are (nearly) **port-starboard symmetric**, so we typically design one half and mirror.

---

## The three classical views

A hull's geometry is traditionally described by three orthogonal slicings:

### Stations (transverse slices) — body plan
- Cut the hull with planes of constant $x$.
- Each cut is a **station**: a 2D curve in the $y$–$z$ plane.
- Displayed together as the **body plan**: forward stations on one side of the vertical center line, aft stations on the other.
- Historically 11 stations ("station 0" through "station 10") between perpendiculars, but kayak designers often use more (20+) for precision.

### Waterlines (horizontal slices) — half-breadth plan
- Cut with planes of constant $z$.
- Each cut is a closed curve in the $x$–$y$ plane (one per side, mirrored).
- Displayed together as the **half-breadth plan** (plan view).

### Buttocks (longitudinal vertical slices) — profile / sheer plan
- Cut with planes of constant $y$.
- Each cut is a curve in the $x$–$z$ plane.
- The $y=0$ buttock is the **keel line** (or center profile); outer buttocks show fore-and-aft shape at various widths.

### Together: the "lines plan"
A classical lines plan combines all three views on one sheet — body plan (stations), half-breadth plan (waterlines), and profile (buttocks) — plus a few diagonals for fairing checks.

bArcas renders all three interactively and keeps them synchronized with the underlying NURBS surface.

---

## Longitudinal signature curves (the BearBoat/Kayak Foundry idiom)

Sea-kayak designers typically think not in terms of a dense NURBS net, but in terms of a few **signature curves** that run end-to-end:

| Curve | What it describes |
|---|---|
| **Sheer line** | Top edge of the hull (in profile) |
| **Deck centerline** | Center profile of the deck |
| **Keel line** (center buttock) | Bottom-center of the hull in profile — its curvature is **rocker** |
| **Chine line** | If hard-chined: the crease between bottom and sides |
| **Waterline (design)** | The intended loaded waterline, viewed in plan |
| **Max beam curve** | The locus of maximum $y$ at each station |

A hull can be reconstructed by:
1. Defining each signature curve as a 2D or 3D spline.
2. Lofting transverse stations between them.
3. Fitting a smooth surface through the stations.

This "signature-curve-first" design mode is what BearBoat institutionalizes. bArcas will offer it as one of two editing modes.

---

## Offsets

An **offset table** is the numerical form of a hull: for each (station, waterline, buttock) triple, list the measured offsets. It's how hulls have been communicated since before computers.

Typical rows of an offset table:
- **Half-breadths** at each station × waterline — distance from center plane to hull.
- **Heights** at each station × buttock — distance from baseline to hull.

bArcas exports offset tables as CSV; station molds as DXF.

---

## Reference planes

- **Baseline:** horizontal plane at the lowest point of the hull (or an arbitrary reference). Heights are measured up from here.
- **Center plane (centerline):** vertical longitudinal plane at $y=0$. Half-breadths measured from here.
- **Midship section:** the station at mid-LWL (half the waterline length).
- **Waterplane:** the horizontal plane at the design displacement waterline.
- **Forward perpendicular (FP):** vertical line through the foremost intersection of the waterline with the stem.
- **Aft perpendicular (AP):** vertical line through some defined stern point (often the rudder post for ships; for kayaks typically the aftmost waterline point).
- **Length between perpendiculars (LPP or LBP):** distance from FP to AP. Used in hydrostatics.

---

## Kayak-specific conventions

Kayaks have several quirks worth encoding:

- **Closed deck.** Unlike open boats, kayaks have a deck. The hull surface is actually a closed body (minus the cockpit opening). For hydrostatics we typically treat just the below-waterline portion.
- **Low freeboard.** The deck is close to the waterline; heel and trim matter more than for larger boats.
- **Cockpit.** A hole in the deck. For hydrostatics: ignored (assumed covered). For stability at extreme heel: it's the flooding angle.
- **Skeg / rudder.** Appendages. Often excluded from hull volume calculations, accounted for separately in drag.

---

## bArcas's internal representation

```
Hull
├── symmetry: port-starboard           # we store the port half; starboard is mirrored
├── surfaces: [NURBSSurface, ...]      # typically one surface for the hull body
├── signature_curves (optional)        # sheer, keel, chine, …
├── appendages: [Skeg, Rudder, …]       # separate, for drag + mass only
├── waterplane: Plane
├── displacement_condition
└── metadata
```

A `NURBSSurface` has its own control net, knot vectors, and degrees. A hull might be one surface (smooth, round-chined) or several surfaces stitched at $G^1/G^2$ continuity (hard-chined).

Derived artifacts — stations, waterlines, buttocks, meshes — are computed on demand and cached by hull hash.

---

## Body plan convention

When bArcas draws a body plan:
- **Starboard side (right half of drawing) = forward half of the hull** (stations forward of midship).
- **Port side (left half) = aft half of the hull.**
- Centerline vertical, baseline horizontal.
- Stations labeled 0 (aft) to N (forward) or by distance.

This matches naval-architecture convention.

---

## Related

- [mathematical-foundations.md](mathematical-foundations.md)
- [../terminology/hull-terms.md](../terminology/hull-terms.md)
- [../variables/design-variables.md](../variables/design-variables.md)
