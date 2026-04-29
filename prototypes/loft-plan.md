# Loft prototype — plan

A new `prototypes/loft/` station for designing a 3D kayak hull by editing a curved spine (rocker) and a small set of transverse cross-sections, lofted into a 3D surface. This is a **shape-generation** prototype, parallel to `stability/` (which is a shape-analysis prototype). They stay independent; eventually we want 3D stability that consumes a loft, but that's out of scope for this prototype.

## Scope

Confirmed:

- **Symmetric only** — port = starboard mirrored. Spine lives in the centerline plane.
- **Sharp bow + sharp stern** — endpoint sections collapse to a single point on the spine. No transom.
- **Hard-chine flag** — per cross-section control point.
- **Per-section reparameterization** — stations can have different control-point counts.
- **Cubic interpolation** longitudinally.
- **Curved spine, sections perpendicular to spine.** Rocker is first-class and very flexibly controlled.
- **Default 5 editable interior cross-sections**, with **add / remove**. Adding a new station seeds it from the *current lofted geometry* at that arc-length so the surface does not jump on insertion.
- **Station spacing along spine arc length** (not X).
- **Sheer line is derived** from the cross-sections — not separately editable.
- **Auto-loft is always on**, live, every edit. No staleness UI, no recompute button.
- **Three.js** for the 3D view (single ESM CDN import — preserves the no-build-step convention).

## Out of scope

- Asymmetric features (offset skeg, paddler-side cockpit recess).
- Multi-hull / catamaran / tunnel hulls.
- Decks. The cross-section's top edge IS the gunwale; no separate deck surface.
- 3D hydrostatics / stability / drag — separate prototypes / future stations. Forward-compatibility for an eventual loft → stability hand-off is a goal of the data model, but no analysis lives here.
- Persistence (file save/load, URL hash). Maybe later.

## Coordinate system

Standard naval-architecture frame, used consistently across all panes:

- **X** — longitudinal, +X toward bow
- **Y** — transverse, +Y to starboard (port = −Y, mirrored from starboard)
- **Z** — vertical, +Z up
- Centerline plane: Y = 0

Each station has a **local frame** anchored on the spine:

- Origin: P(s), the spine point at arc-length parameter s
- Tangent t̂(s) = dP/ds (in X-Z plane)
- Local "up" n̂(s) = t̂ rotated 90° in X-Z (still in centerline plane)
- Transverse b̂ = ŷ (perpendicular to centerline plane)
- Cross-sections are drawn in the (b̂, n̂) plane — b̂ horizontal, n̂ vertical

## Geometry model

### Spine (rocker)

- 2D curve in the X-Z plane, sampled as a natural cubic spline through user-editable control points.
- Endpoints fixed by user-set bow & stern positions (X, Z); interior control points freely draggable in both X and Z.
- Self-intersection is invalid — detect and warn (don't auto-correct).

### Stations

Default: 5 editable interior + 2 implicit endpoint stations. The user can **add** or **remove** interior stations.

Per editable station:
- **Position** s ∈ (0, L_spine) along the spine — draggable.
- **Cross-section**: ordered list of control points in the local (b, n) frame, **starboard half only** (port mirrored). Each control point stores (b, n) and a boolean `chine` flag.
- Section curve: natural cubic spline through control points, **broken at chines** (left-derivative ≠ right-derivative — corner is preserved).

**Add station:** the user clicks an "+ add station" affordance and picks an arc-length s on the spine. The new station's control points are seeded by **sampling the current lofted surface at s** and snapping to a default control-point count (median of neighbor stations). This guarantees the loft surface is unchanged at the moment of insertion. After insertion the user can edit the new station like any other.

**Remove station:** removes one constraint from the longitudinal cubic spline; the loft re-fits with one fewer pinned section, so the surface *will* relax slightly. Acceptable — the natural consequence of fewer constraints.

Endpoint stations are degenerate: a single point at the spine endpoint. They contribute "all transverse samples = 0" to the loft, producing a clean taper to a sharp bow/stern.

### Sheer line (derived)

The sheer (top-of-hull line seen in side view) is *not* a primitive; it is the curve traced by each cross-section's topmost-and-outermost control point as you walk the loft from stern to bow. It's drawn as a ghosted overlay in the side view for context, but cannot be edited there — adjusting sheer requires adjusting the gunwale points of the cross-sections.

### Loft (longitudinal interpolation)

1. **Reparameterize** each station's section to a common N_loft transverse sample count (default 64) by equal arc-length sampling along the section curve.
2. **Chine alignment** — chines tagged with a logical ID propagate longitudinally. If station k has a chine at sample index i and station k+1 doesn't, the longitudinal chine line ends there (and the loft smooths). Plan: warn when a chine flag exists on some but not all stations of a contiguous run.
3. **Longitudinal interpolation** — for each of the N_loft transverse sample indices, fit a natural cubic spline along **spine arc length s** through all station values (5 default + 2 endpoints), sampled at M_loft longitudinal positions (default 30).
4. **Mesh** — M × N quad/triangle strip mesh on the starboard side, mirrored to port across Y = 0.

### Loft cost

For defaults (M=30, N=64): ~2k vertices per side, ~4k mirrored. Spline solves are O(N) tridiagonal. Negligible — a few ms per recompute. **Auto-loft on every edit, every drag tick, no debounce or staleness UI needed.** If profiling later shows jank during heavy drags we can add a debounce; not pre-optimizing for it.

## UI layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  3D LOFT VIEW                                          ┌────────────┐  │
│  drag = rotate · wheel = zoom · dbl-click = reset      │ Hull L  m  │  │
│                                                        │ # stations │  │
│            ╱─────────────────╲                         │  − 5 +     │  │
│         ╱─                   ─╲                        │ Loft res ▾ │  │
│       ╱─                       ─╲                      │ Sel: St 3  │  │
│        ────────────────────────                        │ St 1 ▢ ▢ ▢ │  │
│                                                        │ St 2 ▢ ▢ ▢ │  │
│  (rotatable smooth-shaded mesh, station bands,         │ St 3 ▣ ▢ ▢ │  │
│   selected station highlighted, sharp shading at       │ St 4 ▢ ▢ ▢ │  │
│   chine lines)                                         │ St 5 ▢ ▢ ▢ │  │
│                                                        │ [+ add] [×]│  │
│                                                        └────────────┘  │
├────────────────────────────────┬───────────────────────────────────────┤
│  SIDE VIEW (X-Z) — rocker      │  CROSS-SECTION (b, n)                 │
│                                │  Station 3 of 5  ◀  ▶                 │
│   ╱─●───●───●───●─╲ sheer (ghost)                                      │
│  ●  ●           ●  ●           │     ●─────●                           │
│   ╲─●───●───●───●─╱ keel       │      ╲   ╱                            │
│   bow←  ▲ ▲ ▲ ▲ ▲ →stern       │       ╲ ╱                             │
│         1 2 3 4 5              │        ●  ★ chine                     │
│                                │       (centerline = b=0)              │
│  ● spine ctrl pt               │                                       │
│  ▲ station marker              │  ● ctrl pt   ★ chine                  │
│  drag along spine, click to    │  + add  × delete                      │
│  select; [+ add station]       │  (right-click for chine toggle)       │
└────────────────────────────────┴───────────────────────────────────────┘
```

**Top region (~50% height):** 3D loft + controls panel (right-docked).

**Bottom region:** two editor panes side-by-side — side view (rocker) and cross-section editor.

On narrow screens (mobile): collapse to a single column — 3D, side view, cross-section, controls.

## Pane behavior

### 3D Loft View
- Render: smooth-shaded triangle mesh (lit from above-port). Optional wireframe overlay toggle. Optional waterline reference plane at Z=0.
- Station bands: thin colored ribbons at each station, **selected station brighter / colored**.
- Camera: orbit on drag, zoom on wheel, double-click resets to a default 3/4 view.
- Sharp shading at longitudinal chine lines (split vertex normals).

### Side View — rocker editor (X-Z)
- Editable: spine control points (drag X & Z), spine endpoints (drag — sets hull length & end-Z), station positions (drag the ▲ markers along the spine arc length).
- Read-only overlays: sheerline (derived, ghosted) and the lofted hull's silhouette (keel + sheer) for context — when you tweak the rocker you can see the whole hull profile move with it.
- Click a station marker → selects that station globally (also updates cross-section pane and controls panel).
- "+ add station" button: click, then click on the spine to place; new station is seeded from the current loft so the surface does not jump.

### Cross-Section Editor (b-n)
- The selected station's section in its local frame, b horizontal, n vertical, b=0 at the spine.
- Starboard half drawn solid; port half drawn ghosted (mirror) for visual context.
- Drag any control point — port mirrors automatically (cf. stability prototype).
- "+ Add" places a new control point at click; "× Delete" removes the active one.
- Per control point: a small ★ toggle for chine (filled = chine, hollow = smooth). Right-click for the same toggle plus delete.
- Section count badge ("9 control pts") and arrow buttons to cycle ◀ St 2 · St 3 · St 4 ▶.

### Controls panel
- Hull length L (m, slider + numeric).
- Number of interior stations: − [5] + (range 3–9), with [+ add station] / [× remove selected] buttons.
- Loft resolution dropdown: low / med / high (M & N preset).
- Station list with selection highlight; tiny pip indicators of section complexity (control-point count) per station.

## Hard-chine handling

Each control point has a `chine` flag; sections are reparameterized to a common N_loft. To form a continuous longitudinal chine, the corresponding logical point must be flagged on every station along that run.

- **No auto-propagation.** Too magical — the user might want a chine that fades out (e.g. flagged on stations 2–4, smooth at 1 and 5).
- **Warn on orphans.** If a chine appears on station k but not on adjacent stations, show a soft warning in the controls panel and faintly highlight the orphan chines in the section editor.
- **Visual:** the 3D view uses split vertex normals at chine edges so the crease is sharp; smooth shading elsewhere.

## Build phases

Each phase is a self-contained commit, shippable to GitHub Pages.

| Phase | Deliverable |
|---|---|
| A | Layout skeleton: three panes + controls, placeholders only |
| B | Spine editor in side view + degenerate-endpoints-only loft (no editable cross-sections yet); 3D wireframe loft renders live |
| C | Cross-section editor wired up; station selection works across panes |
| D | Add / remove station, with seed-from-current-loft on add |
| E | Hard-chine flags + longitudinal chine handling + sharp-edge shading in 3D |
| F | 3D view polish: smooth shading, lighting, station bands, camera reset, sheer overlay in side view |

A–C carry most of the work; D–F are layered polish.
