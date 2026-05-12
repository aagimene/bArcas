# Nautilus System (New Wave Systems)

The **Nautilus System** is a family of hull-design programs by **New Wave Systems, Inc.**
(Jamestown, Rhode Island), authored by **Stephen M. Hollister**. It is the second of the two
prior-art codebases ArcasBoat treats as foundational reference — alongside Robert Livingston's
**BearBoatSP / BearBoatXL** (see [bearboat-history.md](bearboat-history.md)).

Most of the technique vocabulary modern interactive hull-design tools depend on — *edit
points on the surface*, *Move% / Ooch Point fine-fairing*, *K-curves* (dynamic curvature
overlays), *Gaussian-curvature color mapping*, *ruling-line plate development*, *automatic
hull variation under prismatic/LCB constraint* — was either invented or popularized inside
this family of programs. ArcasBoat aims to be **a superset of the capabilities of both
Nautilus and BearBoat**, in a browser-native, API-first form.

> The primary archived sources for this page are the three Nautilus installers and their
> bundled tutorial documents, committed read-only at
> [`resources/Nautilus/`](../../resources/Nautilus/). Citations below of the form
> `(Overview3 §X)` or `(DirtyLittleSecrets)` refer to files in
> [`resources/Nautilus/docs/`](../../resources/Nautilus/docs/).

---

## At a glance

| Program | Price (2001) | Scope |
|---|---|---|
| **ProSurf 3** | \$395 | Full NURB hull design, fairing, hydrostatics, stability, four resistance models, plate development, surface skinning/sweeping/offsetting, airfoil tools, solids. |
| **ProBasic 3** | \$195 | Same UI as ProSurf, capped at 10 surfaces per hull half; no full relational/trimmed surface kernel; same hydrostatics/stability/resistance/plate-dev. |
| **ProChine 3** | \$95 | Chine-hull subset (no round-bilge); developable hulls for plywood/aluminum/steel; stability + resistance. |
| **Pilot3D** | — | Sister general-purpose 3D NURB modeler sharing the same entity/fairing kernel; used as the "neutral" name in much of the doc set. |
| **Nautilus Hull Calculation Programs** | — | A separate suite of 14 programs for damaged-stability, weights, longitudinal strength — independent of the NURB surface modeler. |
| **Powerboat / Sailboat Analysis Programs** | — | Performance prediction modules, usable standalone or with the surface modeler. |

Plus general-purpose digitizer / area-moment / centroid utilities.

Source: `prod02.htm`, `prod01.htm`, `prod01a.htm` on https://www.newavesys.com/, cross-checked
against `Overview3.txt`, `README.TXT`.

---

## Surface modeling — what it actually is

**Industry-standard 3D NURB curves and surfaces** (`Overview3 §Geometric Entities`,
`Entities3 §Surface Entities`).

A surface is the standard rectangular NURB blend with control vertices arranged in a
grid of *rows* and *columns*:

```
S(s,t) = Σᵢ Σⱼ  Wᵢⱼ Pᵢⱼ · bᵢ(s) bⱼ(t)   /   Σᵢ Σⱼ  Wᵢⱼ bᵢ(s) bⱼ(t)
```

with control matrix `P(i,j)` of size `(k₁+1) × (k₂+1)`, weights `W(i,j)`, basis polynomials
of degree `M₁` (rows) and `M₂` (columns), and knot vectors `s, t`
(`DirtyLittleSecrets §What is a NURB?`).

### The one thing Nautilus made its own — edit points ON the surface

> "When we started providing B-spline surface modeling in 1985, we decided to allow the user
> to control the shape of the B-spline surfaces using points on the surface. This had not
> been done by any other commercial CAD program in any industry."
> — `Overview3.txt`

Standard NURB UIs let you grab the *defining vertices* — which do not lie on the surface and
"float in space." Nautilus instead displays and lets you drag a corresponding **point that
lies on the surface**, and back-solves for the vertex move. Two flavors are exposed
(`DirtyLittleSecrets §Vertices`):

- **Local control** — moving an on-surface point moves the surface only locally, like moving
  one vertex; but several nearby on-surface points also shift along.
- **Global (full NURB interpolation)** — moving an on-surface point moves *only that point*
  on the surface; the entire surface adjusts to maintain interpolation. Most accurate,
  best for matching existing offsets.

The two payoffs are (a) you can dial in offsets directly and (b) you stop staring at a vertex
mesh that obscures the hull. ArcasBoat should expose both modes — `local` is what most users
expect, `global` is essential for reverse-engineering from offset tables.

### Combined polyline / NURB curve entity

Curves, polylines, lines, and combinations thereof are **one entity type**. A point is toggled
between *smooth* and *knuckle* with one command (`Knuckle Pnt`), converting a stretch of curve
into a polyline corner or vice versa without splitting and rejoining
(`Entities3 §Curve Entities`).

ArcasBoat already plans curve entities; we should make the same call — *one* "polycurve" type
with per-vertex smooth/knuckle flags.

### Surface knuckle / split

Pick any internal row or column of a surface and the `Cvt Row/Col Knuckle` command turns it
into a knuckle line, splitting the surface into two G⁰-joined pieces. Picking that bonded
edge again rejoins them (`Entities3 §Surface Entities`, last screens). This is how chines
are added or removed on the fly without losing exact edge matching.

### NURB shape controls Nautilus exposes (or hides)

| Control | Nautilus exposure |
|---|---|
| **Vertices / edit points** | First-class, draggable. |
| **Degree** | Cubic by default; user-configurable per direction. |
| **Knots** | Mostly uniform; the program can adjust automatically for uneven row/col spacing — but the docs explicitly warn against it because adjoining surfaces must share a knot vector to maintain exact edge matching. **Recommended practice: keep row/col spacing within 2:1 by inserting new ones halfway between two existing ones; that way uniform knots always work.** (`DirtyLittleSecrets §Knots`) |
| **Weights** | Per-vertex; mostly left at 1.0; only adjusted late in design for very local effects. Docs caution that weight manipulation usually causes more fairing problems than it solves. (`DirtyLittleSecrets §Weights`, `Vertex Weight Values`) |

### Row/column spacing rules (the "2:1 rule")

Every authoring tutorial in the suite restates this:

> *"Always insert a new row or column half-way between two existing rows or columns. This
> guarantees that consecutive spacing stays within a 2:1 ratio, which is the maximum the
> uniform-knot spline can absorb without bumps and wiggles."*
> — paraphrase across `Overview3`, `HullDesign3`, `Entities3`

The deeper reason is in `DirtyLittleSecrets §Spacing of Rows and Columns`: uniform knot
vectors stay valid only when control-net spacing stays near-uniform; non-uniform knots
break edge-matching with adjoining surfaces.

ArcasBoat note: if we expose row/col insertion in the editor, the API should default to
"insert at midpoint between selected neighbors" and we should compute and warn when the
2:1 ratio is violated.

---

## Hull creation — `Create Boat` wizard

The first thing you do in any Nautilus program is the **`File → Create Boat`** wizard. It
generates a complete starting NURB surface (3 rows × 3 columns) from a small set of principal
dimensions (`NewBoat3 §Using the Create Boat Command`):

- LWL (length on waterline)
- Bow overhang, stern overhang
- Distance from FP to amidships
- Draft (at amidships, zero trim)
- Sheer height at bow / amidships / stern
- Beam at bow / amidships / stern (a non-zero bow beam → pram bow)
- Draft
- Hull type: **Round Bilge** or **Chine Hull**

Coordinate convention: `X` toward the stern from FP at 0, `Y` to starboard (half-breadth),
`Z` upward from baseline at 0. The user is free to depart from these values in editing —
they are explicitly "target" values for the initial shape only.

ArcasBoat parallel: this is the same pattern as BearBoatSP's signature-curve form. A
`hull.create_from_principal_dimensions(...)` API call is the natural primitive.

### Other hull-input paths

Per `NewBoat3`, ProSurf accepts:

1. The `Create Boat` wizard above.
2. A **table of offsets** in a text file (custom `PLINE3D` / `COMBO3D` format).
3. **Industry station files** — `SHCP` (US Navy Ship Hull Characteristics Program),
   `GHS` (Creative Systems General Hydrostatics), `NWS` (NWS Damaged Stability), `OFF`
   (US Sailing VPP).
4. Manual `Set Point` editing of an initial shape to match offsets.
5. **Digitizing** an existing body plan (tablet → polylines → fit NURB).
6. Reading polylines from another CAD program (DXF / IGES).
7. **Skin/Loft** — fit a NURB surface through a set of station curves (ProSurf only; this
   is the feature ProBasic/ProChine lack).

ArcasBoat should support 1, 2, 3, 6, and 7 from day one; 4 and 5 are nice-to-have.

---

## Fairing — "K-curves" and Gaussian curvature

Nautilus's fairing tooling is the part of the lineage most worth copying outright.

The doctrine is stated everywhere:

> "There is no mathematical definition of fairness. The fairness of a curve or surface is
> based on human interpretation and judgement."
> — `Fairing3 §Fairing Overview`

The tools are therefore *magnifiers* of unfairness, not automatic fairers.

### K-curves (dynamic curvature overlay)

For any row or column on a surface, the program draws an **overlay curve whose deflection
from the parent is proportional to the local curvature** of the parent curve. A fair curve
has a smooth K-curve. An unfair curve shows bumps that are invisible at screen resolution
on the parent itself but obvious on the K-curve. Multiple K-curves can be on at once to
compare neighbors. The `K-Up` / `K-Dn` buttons scale curvature magnification to suit the
hull (`Fairing3`, `HullDesign3 §detailed fairing`).

### Move% and Ooch Point

Two fine-fairing commands that move a control point by a **sub-pixel fraction of the
build-tolerance**, so that the K-curve responds visibly while the actual hull shape changes
by less than a builder could measure (`Overview3 §Basic Hull Editing`, `HullDesign3`).

### Gaussian-curvature color map

`Surf → K_Pat` colors the whole surface by Gaussian curvature: **dark blue at K=0 (locally
developable)**, through cyan / green / yellow / red as compound curvature increases. Used for
overall surface evaluation and as a developability check before plate development. The colors
mean *trend smoothness*, not specific numbers — adjust the curvature-gap setting until the
sensitivity matches your build tolerance (`HullDesign3 §Gaussian curvature`,
`PlateDevelopment §Notes`).

### The full fairing recipe (verbatim sequence)

From `HullDesign3 §detailed fairing process`:

1. Profile view: fair the **sheer** (top row K-curve), then the **bottom profile** (bottom row K-curve), then intermediate rows. Sheer + profile fairness is critical; intermediate rows less so.
2. Plan view: fair the sheer again from above; adjust intermediate rows; smooth the angled column near the bow without trying to fair it in this view.
3. Body plan view: fair columns one at a time; leave several column K-curves on simultaneously to compare *shape progression* between consecutive sections.
4. Repeat. Use plane-cut overlays (selectively, 1–2 at a time) to watch derived waterlines change live as you drag.
5. Verify with the full lines drawing + Gaussian curvature color map.

This sequence is what ArcasBoat's "fairing mode" should walk a user through. We can do
*much* better visually (web-GL, GPU curvature mapping), but the workflow is right.

---

## Hydrostatics and stability

Per `Overview3 §Hydrostatic Calculations` and the ProSurf product page:

- Calculations are done by **planar cuts** — `PlaneCuts` of type `YZ` (stations), `XY`
  (waterlines), `XZ` (buttocks), and arbitrary-angle diagonals. The user defines a set of
  stations (15–20 minimum) once; the program re-cuts on every shape change and updates
  hydrostatics live in a side panel.
- **Inputs**: any draft + trim + heel angle, or a target displacement (program then sinks
  the boat to match). Heeled cases first run the upright calc, lock LCB = LCG, then heel,
  sink, and trim to match upright displacement and LCB.
- **Outputs** (per `DesignSpiral §4. Determine hydrostatic and stability`): volume,
  displacement, **LCB**, wetted surface, **metacentric heights (GMT, GML)**, **prismatic
  coefficient Cp**, **midship coefficient Cm**, **waterplane area**, **half-angle of
  waterplane entry**, longitudinal/transverse moments of inertia of the waterplane.
- **Stability**: full **curve of statical stability** (righting arms vs. heel angle,
  0–180°) and **cross curves of stability** (righting arms vs. displacement at fixed heel
  angles). Initial stability from curve slope at 0°; dynamic stability from area under
  curve; angle of vanishing stability where righting arm crosses zero.
  (`DesignSpiral §Stability calculation`.)

The companion **Nautilus Damaged Stability Package** (separate suite — `prod02.htm`)
adds:

- Up to 50 arbitrarily shaped stations defined via **cubic B-splines + breakpoint indicators**.
- Monohull, catamaran, trimaran, **SWATH** support.
- Compartment + tank definitions; ullages, volumes, centers, waterplane inertias.
- **Free-surface correction** via moment-of-transference, with large-heel correction.
- Trim-to-match: program automatically trims hull until LCB = LCG.
- **Longitudinal strength** module: weight curve, buoyancy curve, **shear force, bending
  moment, hog/sag deflection**.
- I/O: `NWS`, `SHCP`, `GHS`, `OFF`, DXF.

ArcasBoat already commits to LCB / GM / Cp / wetted-surface / waterplane-area reporting
([../theory/hydrostatics.md](../theory/hydrostatics.md)); the cross-curves visualization
and large-heel free-surface correction are good targets for Phase 2.

---

## Resistance — four named models

Per the **ProSurf 3** product page (`prod01.htm`), four resistance methods are bundled:

| Model | Hull regime | Reference |
|---|---|---|
| **Holtrop & Mennen** | Displacement ships | Holtrop & Mennen, "An Approximate Power Prediction Method," *Int. Shipbuilding Progress* Vol 29, July 1982; Holtrop, "A Statistical Re-Analysis of Resistance and Propulsion Data," ISP Vol 31, Nov 1984. Citations from `HullVary §References`. |
| **Delft 3** | Sailboats | Delft Series III sailboat regression. |
| **Kaper** | **Canoes / kayaks** | John Winters / Steve Killing's small-craft regression, the one ArcasBoat already plans to use as a sanity check against Michell. |
| **DispMode** | Planing powerboats | Savitsky-style planing analysis. |

The internal **Geosim decomposition** (from `HullVary §Geosim Coefficient Resistance Evaluation`)
is:

```
R_tot = R_visc + R_resid + R_corr + R_app + R_bulb + R_trans + R_air
```

with `R_visc = (1+k) · ½ρ U² S · Cf`, `Cf` from **ATTC** or **ITTC 1957** friction lines,
`k` the 3D viscous form factor. This is structurally identical to ArcasBoat's plan in
[../theory/drag-and-resistance.md](../theory/drag-and-resistance.md); we add Michell's
thin-ship as the wave-making term where Nautilus uses Holtrop/Delft regressions.

The **`Kaper`** entry is the one we should pay closest attention to — it is the empirical
fallback ArcasBoat needs for short, beamy kayaks that violate Michell's slenderness
assumption.

---

## Automatic hull variation — the `HullVary` paper

The `HullVary.txt` document is Hollister's SNAME-presented paper on **automatic, constrained
hull variation**. It is directly relevant to ArcasBoat's parametric-design plans.

The problem: parametric studies want you to change *one* hull variable (length, beam, Cp,
LCB, draft, displacement, Cm) while holding the others constant. But these variables are
coupled — stretching length changes Cp, LCB, and Δ.

The Nautilus answer is a **variation kernel** with named transforms each of which fixes
some variables and lets others float:

| Transform | Fixed | Varied |
|---|---|---|
| **Stretch** | (nothing) | Length, beam, depth (Δ, Cp, LCB, etc. follow) |
| **Balance** | Δ | Draft (program sinks hull to displacement) |
| **Lackenby** | LWL, BWL, draft | **Cp, LCB, fwd/aft parallel-middle-body lengths** — via the classic *Lackenby quadratic "one minus prismatic" variation*, which shifts stations longitudinally while preserving half-breadths and heights. |
| **CmVary** | LWL, BWL, draft | Δ, Cp (varies midship-section fullness) |

A search loop drives any combination of these to a target, then runs the resistance
calculation, then graphs / contours results over a single variable or 2D matrix.

ArcasBoat's plan calls for similar parametric primitives — `hull.stretch(...)`,
`hull.lackenby_shift(target_cp, target_lcb)`, `hull.adjust_cm(...)`. The Lackenby shift in
particular is a known, citable, **non-fairness-destroying** transform and a strong candidate
for the first parametric verb we expose.

---

## Plate development — ruling lines + finite-element flattening

`PlateDevelopment.txt` is the canonical writeup. Two regimes:

- **Developable** — Gaussian curvature = 0 everywhere. The surface is a union of flat,
  cylindrical, and conical patches. Unwraps to 2D exactly.
- **Expandable** — has some compound curvature; unwrap is approximate. The amount of
  permissible curvature depends on material, thickness, size, machine, and operator skill;
  there is *no* formal threshold. Plot scale frames, build a cardboard model.

The algorithm:

1. User defines two boundary curves (e.g. sheer and chine of a panel).
2. Program divides each by arc length into N ruling-line endpoints (default 50).
3. For each candidate ruling line, search neighborhood of its curve-2 endpoint until the
   **twist angle** along the ruling line meets the user's `Desired Twist Angle` target.
   Twist angle: take a pencil normal to the surface at each end of the ruling line; the
   relative rotation between the two pencils when sighted along the line.
4. Color the ruling lines by twist angle as feedback while editing. Dark blue = developable.
5. When ruling-line shape is acceptable, fit a NURB surface to the ruling lines
   (ruling lines become the surface's columns).
6. **Unwrap** via a finite-element calculation: discretize the surface, lay it flat
   element-by-element while accumulating internal strain. For perfect developables, strain
   is zero. For expandables, sum of strains is what you minimize over an edge-stretch
   percentage input.

This is **out of scope** for ArcasBoat per `CLAUDE.md` (strip-built / plywood-stitch-and-glue
workflows are explicit non-goals); we record the algorithm here for reference but do not
plan to implement it. STL/STEP export drives our CNC-plug / 3D-printed-plug / composite-mold
pipeline instead.

---

## Geometric entities — the inventory ArcasBoat needs to match

From `Entities3.txt`, the program's six top-level entity types:

| Type | Notes |
|---|---|
| **Point** | Position only; used as offset targets ("tick marks") to drag the hull to. Symmetrical flag for one-sided modeling. |
| **Line / Polyline** | Polyline points are entered by clicking; right-click terminates. |
| **NURB Curve** | Same input idiom as polyline. |
| **Combo curve** | Curve + polyline in one entity; per-vertex smooth/knuckle toggle via `Knuckle Pnt`. |
| **NURB Surface** | Row/column net, on-surface or vertex edit modes, knuckle-row splitting, symmetry flag. |
| **3D Solid** | Triangles, boxes, wedges, cylinders, cones, spheres, ellipsoids — with optional hollow variants and partial-angle rotational solids. (Mostly used for fitting context geometry around the hull.) |

ArcasBoat's geometry kernel (planned: OpenCASCADE via WASM) covers all of these natively;
the only one worth singling out is the **combo curve / knuckle toggle**, which is a UI
convention we should emulate even though OCCT internally separates `BSplineCurve` and
`Polyline`.

---

## File I/O

`prod01.htm` lists ProSurf's input/output formats:

- **Native:** `.SRF` (proprietary binary; the file header contains a hull-name string and
  a serialized `CSurfModel` payload — see the kayak samples
  [`resources/Nautilus/`](../../resources/Nautilus/) was extracted from).
- **CAD interchange:** **DXF**, **IGES** (entities 143 trimmed surface, 144 trimmed-surface-of-revolution).
- **Manufacturing:** **STL**.
- **Naval architecture stations:** **NWS**, **GHS**, **SHCP**, **OFF**.
- **Hydrodynamics:** **Michlet** offsets (the same format Leo Lazauskas's Michlet expects;
  ArcasBoat already plans to support this).
- **Plain text** (spreadsheet-importable).

ArcasBoat's [export-formats](../project/export-formats.md) plan already lists STEP, IGES,
STL, DXF as Phase-1 must-haves. We should add **Michlet offset import/export** since it's a
well-defined format already used by the open hull-design community, and **NWS/GHS/SHCP/OFF
import** is the cheapest way to ingest most existing kayak station tables.

---

## Bundled kayak sample hulls

The original installer's `DB\KAYAK` directory shipped these kayak-class `.SRF` files
(extracted from `prosurf3.exe`'s `Data.Cab`):

`GRNLAND` ("Greenland Kayak"), `NOKOMIS` ("Nokomis" by George McClain), `NGRN199`
("North Greenland Figure 199"), `NUK`, `POLAR`, `UNALASKA` ("Unalaska kayak"). The
boat-class samples also include `BKR4`/6/8/10/12/18/20/21 (likely Baidarka-family or
"Bear Kayak Reference" — not yet confirmed) and `WIGLEY` (the classic Wigley parabolic
hull used to validate Michell).

These tell us the Nautilus author shipped a kayak focus *as a first-class concern* in 1990,
not as an afterthought. The `Greenland Kayak` SRF header says *"© 1990 — This is …"* — the
kayak focus pre-dates BearBoatSP's known public releases.

---

## What ArcasBoat takes from Nautilus

Concrete commitments for the wiki and the eventual implementation:

1. **Edit points on the surface** — both `local` and `global` modes. The default is `local`.
   The API exposes both; AI agents pick `global` when fitting to offsets.
2. **Combo polycurve entity** with per-vertex smooth/knuckle flag. One type, not two.
3. **Surface knuckle-line split** as a primitive (insert a chine without losing
   edge-matching).
4. **K-curves** — animated curvature overlays on selected rows/columns; sensitivity slider.
5. **Gaussian-curvature color map** — overall surface evaluation. Phase 1 deliverable.
6. **`Create Boat` wizard** — parametric starting hull from principal dimensions; equivalent
   to BearBoat's signature-curve form.
7. **Plane-cut overlays during drag** — selected waterlines / buttocks / stations re-cut
   live while the user drags a control point.
8. **Cross curves of stability** — Phase 2.
9. **Lackenby parametric variation** as a first-class API verb. Named after the method;
   citation in every result it produces.
10. **`Kaper` empirical resistance** for kayak speed ranges (alongside Michell thin-ship and
    ITTC 1957 friction).
11. **Michlet-offset I/O** and **NWS/GHS/SHCP/OFF** station-table ingest.
12. **"2:1 row/column spacing" warning** — soft constraint surfaced in the editor.

What we deliberately **do not** copy:

- **Plate development** — out of scope per [`CLAUDE.md`](../../CLAUDE.md).
- **Vertex-mesh-as-default UI** — Nautilus already moved past this in 1985; so do we.
- **Knot-vector manipulation as user surface** — keep knots uniform; rely on the 2:1 rule.

---

## Mariner / BearBoat / Nautilus — what we know and what we don't

A working hypothesis on the lineage diagram, recorded here so it can be confirmed or
rejected:

- **Robert Livingston** designed the **Ursa** kayaks using his own **BearBoatSP** program.
- **Matt and Cam Broze** at **Mariner Kayaks** were influenced by Ursa designs and may also
  have used a Nautilus-family program for some of their own commercial hulls; the
  community claim that "Mariner hulls were designed in Nautilus" is plausible (timing,
  geography, and feature-fit all align) but **we do not yet have direct documentary
  evidence**. The bundled Nautilus sample `.SRF` files do not include any with a
  `Mariner`/`Coaster`/`Broze` author tag.

If a reader has a Mariner shop document, an interview reference, or a Sea Kayaker / WaveLength
back-issue confirming which program was used for which hulls, this page is where it should
land.

See also [bearboat-history.md](bearboat-history.md) for the Ursa → Mariner → Coaster thread.

---

## Primary sources

- Website snapshot (May 2026): https://www.newavesys.com/, in particular
  `products.htm`, `prod01.htm`, `prod01a.htm`, `prod02.htm`.
- Installers and bundled documentation: [`resources/Nautilus/`](../../resources/Nautilus/).
  - [`docs/DirtyLittleSecrets.txt`](../../resources/Nautilus/docs/DirtyLittleSecrets.txt)
    — Hollister's plain-English explanation of NURB-based hull design. Read first.
  - [`docs/HullVary.txt`](../../resources/Nautilus/docs/HullVary.txt) — SNAME paper on
    constrained hull variation (Lackenby et al.).
  - [`docs/DesignSpiral.txt`](../../resources/Nautilus/docs/DesignSpiral.txt) — full
    design-spiral tutorial covering everything from conceptual to detailed design.
  - [`docs/Overview3.txt`](../../resources/Nautilus/docs/Overview3.txt),
    [`docs/HullDesign3.txt`](../../resources/Nautilus/docs/HullDesign3.txt),
    [`docs/Fairing3.txt`](../../resources/Nautilus/docs/Fairing3.txt),
    [`docs/Entities3.txt`](../../resources/Nautilus/docs/Entities3.txt),
    [`docs/NewBoat3.txt`](../../resources/Nautilus/docs/NewBoat3.txt),
    [`docs/PlateDevelopment.txt`](../../resources/Nautilus/docs/PlateDevelopment.txt) —
    tutorial set.

Citations from `HullVary §References` worth pulling forward into our theory pages:

- Holtrop, J. and Mennen, G., "An Approximate Power Prediction Method," *International
  Shipbuilding Progress*, Vol 29, July 1982.
- Holtrop, J., "A Statistical Re-Analysis of Resistance and Propulsion Data," ISP Vol 31,
  Nov 1984.
- Todd, F., "Series 60, Methodized Experiments with Models of Single-Screw Merchant Ships,"
  DTMB Report 1712, July 1963.
- Lackenby, H., on the "one minus prismatic" quadratic hull variation (cited but no
  full reference given in the Hollister paper — `(Lackenby, 1950)` in *TINA* Vol 92 is
  the standard citation we should use).

---

## Related

- [bearboat-history.md](bearboat-history.md) — the other primary-source lineage.
- [existing-hull-design-software.md](existing-hull-design-software.md) — broader survey.
- [kayak-design-literature.md](kayak-design-literature.md) — Winters, Killing, Lazauskas.
- [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)
  — where NURB row/column conventions land in our internal model.
- [../theory/drag-and-resistance.md](../theory/drag-and-resistance.md) — where Holtrop /
  Kaper / Delft / Savitsky options would slot into ArcasBoat's drag stack.
- [../theory/hydrostatics.md](../theory/hydrostatics.md) — where `PlaneCuts` and the
  cross-curves visualization plan live.
- [../project/export-formats.md](../project/export-formats.md) — adds Michlet and NWS/GHS/SHCP/OFF
  to the import/export matrix.
- [../../resources/Nautilus/README.md](../../resources/Nautilus/README.md) — index of the
  archived installers and bundled docs.
