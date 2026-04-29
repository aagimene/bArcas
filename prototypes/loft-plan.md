# Loft prototype — plan

A new `prototypes/loft/` station for designing a 3D kayak hull by editing a curved spine (rocker) and a small set of transverse cross-sections, lofted into a 3D surface. This is a **shape-generation** prototype, parallel to `stability/` (which is a shape-analysis prototype). They stay independent; a future iteration may pipe a loft into stability for analysis.

## Scope

Confirmed from prior conversation:

- **Symmetric only** — port = starboard mirrored. Spine lives in the centerline plane.
- **Sharp bow + sharp stern** — endpoint sections collapse to a single point on the spine. No transom.
- **Hard-chine flag** — per cross-section control point.
- **Per-section reparameterization** — stations can have different control-point counts.
- **Cubic interpolation** longitudinally.
- **Curved spine, sections perpendicular to spine.** Rocker is first-class and very flexibly controlled.
- **5 editable interior cross-sections** (+ 2 implicit endpoint sections at bow & stern).

## Out of scope

- Asymmetric features (offset skeg, paddler-side cockpit recess).
- Multi-hull / catamaran / tunnel hulls.
- Decks. The cross-section's top edge IS the gunwale; no separate deck surface.
- Hydrostatics, stability, drag — those have their own prototypes / future stations.
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
- Self-intersection of the spine is invalid — detect and warn (don't auto-correct).

### Stations

5 editable interior stations + 2 implicit endpoint stations.

Per editable station:
- **Position** s ∈ (0, L_spine) along the spine — draggable.
- **Cross-section**: ordered list of control points in the local (b, n) frame, **starboard half only** (port mirrored). Each control point stores (b, n) and a boolean `chine` flag.
- Section curve: natural cubic spline through control points, **broken at chines** (left-derivative ≠ right-derivative — corner is preserved).

Endpoint stations are degenerate: a single point at the spine endpoint. They contribute "all transverse samples = 0" to the loft, producing a clean taper to a sharp bow/stern.

### Loft (longitudinal interpolation)

1. **Reparameterize** each station's section to a common N_loft transverse sample count (default 64) by equal arc-length sampling along the section curve.
2. **Chine alignment** — chines tagged with a logical ID propagate longitudinally. If station k has a chine at sample index i and station k+1 doesn't, the longitudinal chine line ends there (and the loft smooths). Plan: warn when a chine flag exists on some but not all stations of a contiguous run.
3. **Longitudinal interpolation** — for each of the N_loft transverse sample indices, fit a natural cubic spline along **spine arc length** (s, not X — robust for highly rockered hulls) through the 7 station values, sampled at M_loft longitudinal positions (default 30).
4. **Mesh** — M × N quad/triangle strip mesh on the starboard side, mirrored to port across Y = 0.

### Loft cost

For defaults (M=30, N=64): ~2k vertices per side, ~4k mirrored. Spline solves are O(N) tridiagonal. **Cheap enough that auto-loft on every edit (~150 ms debounce) is fine.** Still, per the spec:

- A **stale indicator** sits next to a **Recompute** button.
- An **☐ Auto-loft** checkbox (default on). Off → user-driven recompute only.
- Indicator: ● green = fresh, ● amber pulse = stale, ⟳ spinner during compute.

## UI layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  3D LOFT VIEW                                          ┌────────────┐  │
│  drag = rotate · wheel = zoom · dbl-click = reset      │ Hull L  m  │  │
│                                                        │ # stations │  │
│            ╱─────────────────╲                         │ Loft res ▾ │  │
│         ╱─                   ─╲                        │ ☑ auto-loft│  │
│       ╱─                       ─╲                      │ ●  fresh   │  │
│        ────────────────────────                        │ [Recompute]│  │
│                                                        │ Sel: St 3  │  │
│  (rotatable smooth-shaded mesh, station bands,         │ St 1 ▢ ▢ ▢ │  │
│   selected station highlighted)                        │ St 2 ▢ ▢ ▢ │  │
│                                                        │ St 3 ▣ ▢ ▢ │  │
│                                                        │ St 4 ▢ ▢ ▢ │  │
│                                                        │ St 5 ▢ ▢ ▢ │  │
│                                                        └────────────┘  │
├──────────────────────┬──────────────────────┬──────────────────────────┤
│  SIDE VIEW (X-Z)     │ BOTTOM VIEW (X-Y)    │ CROSS-SECTION (b, n)     │
│  rocker editor       │ plan + station picker│ Station 3  ◀  ▶          │
│                      │                      │                          │
│   ╱─●───●───●───●─╲  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │     ●─────●              │
│  ●  ●           ●  ● │  ╱  ╲                │      ╲   ╱               │
│   ╲─●───●───●───●─╱  │ ╱    ╲               │       ╲ ╱                │
│   bow←  ▲ ▲ ▲ ▲ ▲ →stern    ╲              │        ●  ★ chine        │
│         1 2 3 4 5    │  station 1 2 3 4 5   │       (centerline = b=0) │
│                      │  (click to select)   │                          │
│  ● spine ctrl pt     │                      │  ● ctrl pt   ★ chine     │
│  ▲ station marker    │  ghosted: lofted     │  + add  × delete         │
│  (drag along spine)  │  hull plan outline   │  (right-click for chine) │
└──────────────────────┴──────────────────────┴──────────────────────────┘
```

**Top region (~50% height): 3D loft + controls.** 3D view dominates; controls panel right-docked.

**Bottom region: three editor panes side-by-side.** Each is a focused 2D editor.

On narrow screens (mobile): collapse to a single column — 3D, then side, bottom, cross-section, controls.

## Pane behavior

### 3D Loft View
- Render: smooth-shaded triangle mesh (lit from above-port). Optional wireframe overlay toggle. Optional waterline reference plane at Z=0.
- Station bands: thin colored ribbons at each station, **selected station brighter / colored**.
- Camera: orbit on drag, zoom on wheel, double-click resets to a default 3/4 view.
- During recompute: ghost the previous mesh, show a spinner overlay.

### Side View — rocker editor (X-Z)
- Editable: spine control points (drag X & Z), spine endpoints (drag — sets hull length & end-Z), station positions (drag the ▲ markers along the spine).
- Read-only overlay: ghost projection of the lofted hull's silhouette (sheerline + keel) to give context for what the rocker is doing to the boat.
- Click a station marker → selects that station globally (also updates cross-section pane and controls panel).

### Bottom View — plan & station picker (X-Y)
- Read-only-ish: shows the lofted hull projected onto X-Y (max-beam silhouette), with each station drawn as a transverse line at its X position.
- Primary interaction: **click a station to select**. Optionally drag stations to reposition (same effect as in side view — they're the same parameter s).
- This pane is mostly an at-a-glance "where are my stations and what does plan-shape look like" view; section shape is not edited here.

### Cross-Section Editor (b-n)
- The selected station's section in its local frame, b horizontal, n vertical, b=0 at the spine.
- Starboard half drawn solid; port half drawn ghosted (mirror) for visual context.
- Drag any control point — port mirrors automatically (cf. stability prototype).
- "+ Add" places a new control point at click; "× Delete" removes the active one.
- Per control point: a small ★ toggle for chine (filled = chine, hollow = smooth). Right-click for the same toggle plus delete.
- Section count badge ("9 control pts") and arrow buttons to cycle ◀ St 2 · St 3 · St 4 ▶.

### Controls panel
- Hull length L (m, slider + numeric)
- Number of interior stations (default 5, range 3–9 — future-proofing)
- Loft resolution: low / med / high (M & N preset)
- ☑ Auto-loft, [Recompute], stale-state dot
- Station list with selection highlight; tiny sparkline / pip indicators of section complexity (control point count) per station

## Hard-chine handling

Each control point has a `chine` flag; sections are reparameterized to a common N_loft. To form a continuous longitudinal chine, the corresponding logical point must be flagged on every station along that run.

- **Auto-propagate?** No — too magical, and the user might want a chine that fades out (chine on stations 2–4, smooth at 1 and 5).
- **Warn?** Yes. If a chine appears on station k but not on adjacent stations, show a soft warning ("chine on St 3 doesn't extend to St 2 or St 4 — chine line will fade") in the controls panel and faintly highlight the orphan chines in the section editor.
- **Visual:** the 3D view renders smooth-shaded (vertex normals) **except** at chine edges, where it uses split normals so the crease is sharp.

## Open questions (please confirm before I build)

1. **Station spacing along arc length s, or along X?** I'd default to **arc length** (better for high-rocker designs; the side-view ▲ markers slide along the spine, not along the bottom of the page).
2. **5 stations: hard or default?** I'd default to 5 with a controls-panel knob 3–9.
3. **Sheerline editing.** Side view shows sheer as a derived ghost. Want a separate editable sheer curve too, or strictly derived from cross-sections? I'd start derived-only and add an editable sheer later if it feels needed.
4. **Auto-loft on by default?** I'd start with auto-loft on, debounced ~150 ms — the recompute button + stale dot are still there for users who turn auto-loft off (or for "I'm dragging fast and want no jank").
5. **3D library:** Three.js (battle-tested, ~600 KB) vs. hand-rolled WebGL (lighter, more code) vs. WebGL2 with a tiny shader (middle path). I'd pick **Three.js** — keeps the prototype small and lets us focus on the geometry, not the rasterizer. CLAUDE.md says "no build step / vanilla" — Three.js can ship as a single ESM CDN import which preserves the no-build rule.
6. **Should the loft prototype eventually feed the stability prototype?** Out of scope for this prototype, but worth confirming the eventual story so the geometry data shape is forward-compatible.

## Build phases

Each phase a self-contained commit, shippable to GitHub Pages.

| Phase | Deliverable |
|---|---|
| A | Layout skeleton: four panes, controls, no real geometry — just placeholders |
| B | Spine editor in side view + degenerate-endpoints-only loft (no editable cross-sections yet); 3D wireframe loft renders |
| C | Cross-section editor wired up; station selection works across all three editor panes |
| D | Hard-chine flags + longitudinal chine handling + sharp-edge shading in 3D |
| E | Bottom view polished (plan outline, station picker drag, ghost overlays) |
| F | 3D view polish: smooth shading, lighting, station bands, camera reset |
| G | Staleness indicator + Recompute button + auto-loft toggle (likely no-op in practice but per spec) |

Estimate: A–C are most of the work; D–G are layered polish.
