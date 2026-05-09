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
| E | Closed topology — bow / stern stem-line stations (2 centerline points each), closed-loop sections with a flat default deck, centerline-locked deck-end on every station |
| F | Sheer editor — stem stations get an X-Z profile editor (bottom point on rocker, add/move control points above it to shape the bow/stern outline from the side) |
| G | Hard-chine flags + longitudinal chine handling + sharp-edge shading in 3D |
| G | 3D view polish: smooth shading, lighting, station bands, camera reset, sheer overlay in side view |

A–C carry most of the work; D–G are layered polish.

## TODO / known issues

- **Ambient occlusion is weak.** Three.js's `SSAOPass` produces a mask that's
  very close to 1.0 (no occlusion) across most of a smooth kayak hull. Even
  with a `pow(mask, contrast)` boost on the blendMaterial up to contrast = 40,
  the visible darkening at deliberately-creased geometry is barely a tint of
  gray. AO is off by default in the controls panel for now.

  Options to investigate, roughly in order of effort vs. reward:
  1. **Better lighting** — a softer/larger area-style fill plus a slightly
     warmer key might make the existing AO read more strongly without
     touching the post-process. Cheapest first try.
  2. **Re-tuned SSAO kernel / sample distribution.** The default kernel is
     32 samples in a hemisphere; a Poisson disc on the tangent plane with
     more aggressive falloff can produce sharper crevice detection.
     Requires forking the SSAO shader.
  3. **GTAOPass** (Ground Truth AO) — Three.js shipped a GTAO addon
     post-r160. Generally produces stronger, more physically-plausible AO
     than SSAOPass. Drop-in replacement candidate.
  4. **Baked vertex-color AO.** Raycast from each vertex into the mesh on
     loft rebuild and store the occlusion factor as a vertex color. Free
     at render time, sharp results, but adds compute on every loft change
     (manageable at our mesh size). Doesn't help while dragging; could
     debounce or only bake on pointer-up.
  5. **Contour / form-line shader** instead of AO. Detect surface inflections
     in screen space and draw thin dark lines at chines, gunwale corners,
     and waterlines — naval-architect "form-lines" style. Stylistically
     this is what the user actually wants AO to imply.

  None of these are blocking the other phases — flagged here so we revisit
  when the hull form work is far enough along to benefit.

## TODO: history log + undo (deferred)

User flagged this as "a much bigger thing — note it down to refine later".
The intent isn't just `Ctrl+Z` for one-step undo; it's a **full visible
history log of every editing action** at a level of detail that an agent
could later replay or learn from. Two motivations:

1. **Undo / redo and arbitrary-jump rewind.** A scrollable log lets the
   user step back through any number of edits, not just the last one.
2. **Training corpus for a future ArcasBoat agent.** Each entry should
   describe a primitive action with enough information to reproduce it
   from a clean state — i.e. it should be the same shape as the API-call
   stream that a programmatic client / MCP agent would emit. This aligns
   with the "every design action has a corresponding API call" rule from
   [wiki/project/api-design.md](../wiki/project/api-design.md#principles).

### Sketch of the requirements

- **Append-only event log.** Each entry is a small structured record:
  `{ ts, kind, params, prev_value, new_value, source }`. `source` lets us
  distinguish hand-edits from agent-issued or replay-issued ones later.
- **Action granularity matched to the API surface.** One log entry per
  semantic action — `setBeamPeak(idx, x, y)`, `addStation(s, deckPt)`,
  `deleteStation(unifiedIdx)`, `setStationDeckPt(idx, x, z)`, etc. *Not*
  one entry per pixel of pointer movement; coalesce drag-stream into a
  single entry on pointer-up.
- **State = fold(events).** Bootstrap state, then replay the log to get
  the current state. This is the same "events not mutations" rule from
  [api-design.md](../wiki/project/api-design.md#principles).
- **Visible UI.** A timeline pane with one row per entry — timestamp,
  kind, short human-readable summary. Click a row to jump to that
  point in history.
- **Persistence.** Local-storage round-trip at minimum so a refresh
  doesn't lose history. JSON-export for sharing / training.

### Why not just stuff this into the prototype now

The prototype mutates `state` directly from a dozen drag handlers and
click handlers. To do this properly we'd want to route every mutation
through a single dispatcher that emits a log entry — i.e. we'd be
building the API layer that Phase 1 calls for. It's worth doing carefully
once, not bolted on per-handler. Capture this when the prototype work
stabilises and we start the proper TS/Python refactor.
