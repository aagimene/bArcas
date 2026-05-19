# Loft prototype — TODO

Meticulously maintained. All user feedback goes here immediately, even if
not yet defined or prioritized. Items move from **Feedback / Unprioritized**
→ **Pending** (chunked + confirmed) → **Done**.

Rule: Claude writes down all feedback as it arrives. Nothing gets implemented
until it has been chunked, prioritized, and confirmed by the user.

---

## Feedback / Unprioritized

*Raw feedback captured from the user. Not yet scoped or confirmed.*

- **Matcap palette presets.** Initial MVP shipped under build tag
  `matcap-palettes`: dropdown with named palettes (blueprint, clay,
  chrome, gold, jade, copper, pewter, jet, rose) plus a "Custom" option;
  procedural generator extended from 2 → 3 colour stops (highlight, base,
  shadow). Any manual change to a colour picker auto-flips the dropdown
  to "Custom" and any preset selection writes all three stops into the
  pickers. Follow-up ideas: rim colour as a separate radial gradient
  layer, anisotropic specular for brushed-metal looks, support importing
  PNG matcaps from the nidorx/matcaps library so the user isn't limited
  to procedural sphere generation.

- **Chines.** Chines are numbered. Chine points are cross-section control
  points with a chine index assigned. The loft should produce edge loops that
  follow the chine points longitudinally, making chine lines visible in all
  views. Because chine control points are on the Bezier curve, handle lengths
  naturally control chine sharpness. A chine must span at least two
  neighboring stations but does not need to extend to all stations.
  **NOTE 2026-05-16:** initial MVP implemented under build tag `chine-mvp`.
  Additional behaviour requested in same prompt:
  - Chine points can be *drawn* in the side and top views (in addition to
    the section view). Click in chine-editor mode snaps to the nearest
    station and inserts a chine control point on that station's section.
  - Top-view click snaps to the bottom intersection (smaller n) since the
    section curve crosses any vertical (b = const) line twice.
  - Chine-editor mode is a toggle (default off); when off chine lines still
    render but no editing handles show.
  - Each chine point owns 3D Bezier handles (aft + fore), edited in all
    three 2D views via the appropriate axis-pair projection. The 3D handles
    drive the chine *line* (longitudinal Bezier through space); the section
    Bezier still uses its own per-point angle/aftLen/foreLen.
  - Remaining for follow-up: align the loft's transverse subdivision so
    actual mesh edge loops snap to chine points (current MVP draws the
    chine line as an overlay only — surface is unchanged); 3D-view handle
    gizmos; chine numbering UI for re-assigning index of existing points.

- **Cross-section aspect-ratio instability during station-point edits.**
  When dragging the widest control point, the aspect scaling can rapidly
  increase/decrease uncontrollably. Also, moving a station along X sometimes
  does not update the section's displayed height even though the actual H/B
  ratio has changed — possibly a degenerate state. **NOTE 2026-05-16:** user
  reports this may no longer be an issue; re-verify before scheduling.

- **Adding a new station is awkward.** The only path is the controls panel,
  and the new station gets an unpredictable starting shape. Desired behavior:
  click on the top or side view to draw a new station at that longitudinal
  position; the new station should automatically assume the interpolated
  cross-section shape of the existing lofted geometry at that point, so the
  hull shape does not change at all upon insertion.
  **NOTE 2026-05-16:** Interactive click-to-add with dynamic station preview is now functional, but the resulting station added is still not perfect; it sometimes inserts additional unnecessary points and changes/deforms the loft geometry slightly. Needs refinement.

- **Section view: uneditable center-loft marker.** The companion to the
  station-add line — show a small dot/cross in the cross-section view at
  the centerline that represents the "where the loft passes through the
  middle" reference. Non-editable. (Side/top spine lines are done.)


- **Side view aspect ratio may not always match the shaded 3D mesh.** Under
  certain conditions the 2D side view silhouette does not appear to match
  the 3D render's proportions. Not yet fully reproduced — needs further
  investigation to isolate.

---

## Execution plan

*Recommended ordering, model, and effort level for the items in
**Feedback / Unprioritized** above. Goal: ship visible progress quickly
without burning the 5-hour rate-limit on a single big task.*

**Strategy**

- Front-load cheap wins (Sonnet, low-effort) so the user sees fast progress
  and the codebase gets simpler as we go.
- Group items that touch the same code region into a single session so we
  amortise the read-context cost.
- Save Opus for items where the wrong approach is expensive: math
  correctness, architectural choices, ambiguous specs.
- Defer items that need more user input (vague repros, big design calls)
  until they bubble up naturally.

**Recommended model picks (heuristics)**

- **Haiku 4.5** — pure CSS / single-file mechanical edits with a clear
  before/after.
- **Sonnet 4.6** — most feature work and refactors. Good default.
- **Opus 4.7** — math correctness, subtle bug hunts, architectural
  decisions, large multi-file refactors.

| # | Order | Item (short) | Model | Effort | Why this rank |
|---|-------|--------------|-------|--------|---------------|
| 14b | 5 | Section view: uneditable centre-of-loft marker (companion to side/top station spine line) | Sonnet | low | Tiny SVG addition in renderSectionView; non-interactive marker at the centerline of the section. |
| 15 | 6 | **Chines** (numbered chine indices on section points; chine edge loops in loft; visualisation in all views) | Opus | high | Largest architectural change: data-model addition, loft change, three new render layers. Do last so other items don't conflict and so the codebase is in its simplest state when we tackle it. Plan a design pass first (separate session, no code) before implementing. |
| 16 | — | Side view aspect ratio may not match 3D mesh (vague) | — | — | Defer until user can reproduce concretely. Spending Opus on a vague spec is wasteful. |

**Suggested session bundles** (each bundle = one Claude session, ordered top-to-bottom):

1. **Session A — UI polish bundle (Sonnet, low):** items 1, 2, 5, 6. Touches CSS + small JS additions in one region. ~1 commit per item, 4 small commits.
2. **Session B — Render-mode cleanup (Sonnet, medium):** items 3, 4. Both touch the Three.js / build-loft code; do them together so the AO removal exposes the final render-mode shape. 1–2 commits.
3. **Session C — Bug-hunt bundle (Opus, medium):** items 7, 8, 9. Three subtle correctness issues. Opus is worth it — wrong approach on any of them costs more than the model tier. Investigate each, propose, then implement. 3 commits.
4. **Session D — Body plan + station-add UX (mixed):** items 10 (Opus medium) and 11 (Sonnet medium). Item 10 does the geometry; 11 layers visualisation on top of the same geometry. 2 commits.
5. **Session E — Textured render mode (Opus, medium):** item 12. Standalone. 1 commit.
6. **Session F — Layer toggle architecture (Opus, high):** item 13 first as a design pass (no code), then implementation. Then item 14 as a tiny follow-up. 2–3 commits.
7. **Session G — Chines (Opus, high):** item 15. Start with a design doc (no code), then implement in stages: data model → loft → visualisation. 3+ commits.

**Budget guard**

- Sessions A and B together should fit comfortably in one rate-limit window.
- Sessions C, D, E should each fit in one window.
- Sessions F and G are the expensive ones — give each its own fresh
  rate-limit window. Don't start either when less than ~3 hours remain.

---

## Pending (chunked, not yet implemented)

*Confirmed items waiting to be picked up. Ordered roughly by priority.*

### P2 — Spine edge sharpness
The closure strip (flat chisel edge) is implemented. The sharpness parameter
(`state.spineSharpness`) is in state but not yet wired to geometry.

Needs design: what does the sharpness cross-section look like? From flat chisel
(sharpness=0, done) toward a rounded ellipse (sharpness=1). How does it interact
with the top/bottom split (P3)?

### P3 — Top/bottom hull split along a longitudinal edge loop
A seam divides the hull into deck half and hull half. One longitudinal edge loop
(at some b-index in the cross-section) becomes the split seam.

Needs design before coding:
- How is the split b-index selected (control point on section, or chine flag)?
- Gap height: translate top half up by h/2 and bottom down by h/2 (not a scale)
- How does this interact with P2 (spine edge sharpness)?
- Export: two separate shells or one mesh with seam metadata?

---

## Needs design (not implementable yet)

- **Full visible history log + undo.** Full design sketch in `loft-plan.md`
  (history-log section). Requires routing all mutations through a single
  dispatcher — same as the future API layer. Do when prototype stabilizes.

- **Spine edge closing geometry and sharpness cross-section.** What shape
  connects the two half-meshes? Flat strip done. Rounded profile needs a
  parametric cross-section model. Should be designed alongside P3 (split).

---

## Done ✓

*For reference. Do not re-implement.*

| Feature | Build tag |
|---------|-----------|
| Top-view real aspect ratio (uniform px/m, letterboxed) | uniform-axes |
| Axis coordinate badges in every pane (X-Y, X-Z, Y-Z) | uniform-axes |
| Kayak-like default beam line (two parallel-midsection peaks) | uniform-axes |
| Cross-section pane: tight viewBox + proportional styling | section-fit |
| Pink deck line replaces green interior deck-line controls | pink-deck |
| Green endpoint diamonds removed; pink perimeter added | pink-perimeter, smooth-perimeter, mesh-perimeter |
| Sheer keel curves sourced from mesh vertices | mesh-keel |
| Station keel points recoloured to rocker blue | clean-green |
| Sheer-start tick + drag handle removed from rocker | clean-green |
| Paired keel/deck station model (chord-tilt lofting) | paired-stations |
| Sheer stations unified with interior (no midpoint drag) | unified-stations |
| Top-view station drag moves both keel+deck rigidly | top-rigging |
| Click-to-add and right-click-delete in both 2D views | top-rigging, clean-clicks |
| Rocker-relative station positions (deckLocal / sheerLocal) | rocker-relative |
| X-ordering constraint: each point ≤ neighbour on same line | simple-bounds + let-wx |
| Zoom/pan in side and top views with reset buttons | zoom-pan |
| Rotatable key light (shift+drag on 3D canvas) | light-orbit |
| Spine-radius slider (Y-translation of half-meshes) | spine-radius |
| Spine closure strips (keel + deck edge, watertight) | spine-closed |
| Grid depth-tests against hull (no longer overlays) | contour-mesh |
| AO on by default, contrast ×12, stronger key light | contour-mesh |
| Section + length subdivision controls | contour-mesh |
| Section subdivision retiered (16/24/32/48) | contour-mesh |
| Wireframe updates immediately on subdivision change | contour-mesh |
| Hull length slider scales all X coords proportionally | scale-all |
| Standard CAD mouse map (MMB pan, RMB orbit, scroll zoom) | mouse-map |
| Save/load hull state as JSON (export/import buttons) | section-fit |
| Reference image tracing (side + top views) | ref-image |
| History log design note (deferred, not implemented) | loft-plan.md |
| State: `spineSharpness` field added for future use | spine-closed |
| Default starting state — user-modelled kayak shape from dumbstart.json | kayak-start |
| Remove sheers entirely; rocker → N-knot piecewise Bezier; deck line Bezier; loft follows curves exactly | no-sheer |
| Section widest b-coord normalized to beam line (hull always fills top-view silhouette) | beam-fill |
| Control points and lines stay constant pixel size when zooming | fixed-dots |
| Font sizes non-scaling; axis badges pinned to pane corners as static HTML SVGs | fixed-labels |
| Rocker interior knots: amber → blue (#2563eb) | keel-blue |
| Section view: static axis badge (pinned corner, +Z/+Y), non-scaling via sf | section-scale |
| Section pan no longer triggers click-to-add control point | section-fix |
| Section strokes/fonts/dots truly constant screen-px via inline style= + actual SVG scale factor | const-pixels |
| Top-view and section-view axis badge viewBox widened (110px) so "+Y (stbd)" doesn't clip | const-pixels |
| Top-view Bezier handle lines: solid → dashed | keel-blue |
| Tip closure: N-1 z-fighting triangles → 2 flat triangles per tip | tip-flat |
| Deck line in loft now follows the green deck Bezier exactly (sample deck Z at row's actual X, not at arc-length s) | deck-init-fix |
| Initial-render retry loop: 2D views blank-on-load fix when ResizeObserver's first callback fired before layout settled | deck-init-fix |
| Remove ambient occlusion; simplify render modes to Shaded + Normals (both with grid) | (user) |
| Reference image in cross-section view (third wireRefImage instance) | (user) |
| Reference image positioning UX polish (lock-aspect / fit-to-hull) | (user) |
| Body plan overlay on cross-section view (bow/stern half + opacity controls) | (user) |
| Textured render modes for curvature: Matcap (procedural sphere texture, base + highlight colour pickers) and Checker (world-space cubic checker via shader injection, configurable size + 2 colours) | matcap-checker |
| Scale gizmo pivots at hull centre (X-mid / Z-mid); anisotropic correction on knot angles + handle lengths so a one-axis scale stretches only that axis | gizmo-center |
| Per-view layer toggles (≡ chip per pane → popover with coloured dots + checkboxes): side {keel/deck/stations/refImage/gizmo}, top {beam/stations/refImage/gizmo}, section {controls/refImage}.  CSS-driven grey-out + pointer-events lock via [class*] selectors keyed off data-layer-* attrs; click-to-add suppressed via state check.  Bold consistent colours: blue=keel, green=deck, teal=beam, purple=stations, neutral=refImage, amber=gizmo, dark=section curve.  Persisted via JSON. | layer-toggles |
| Station-add line in side + top views — dashed light-purple longitudinal centerline; click anywhere on it to insert a station with shape interpolated from the current loft (sectionAtS).  Loft drift on insertion < 0.04 SVG px in tests.  Auto-greyed/locked when stations layer is off. | station-add-line |
| Scale gizmo on side/top/3D views (Y/X/Z axes, X updates length slider) | scale-gizmo, gizmo-fix |
| Scale gizmo removed from cross-section view (meaningless in normalised b/n) | section-bezier |
| Cross-section points → on-curve Bezier knots with angle/aftLen/foreLen handles (matches rocker / deck-line model) | section-bezier |
| Prevent translation drift (panning) during scale gizmo drag | gizmo-pan-fix |
| Update starting layout percentages (col 25%, row 66%) | layout-66 |
| Fix inactive layer styling: hide large transparent hit targets entirely, style solid handles and hollow anchors elegantly instead of generating thick solid grey circles. | layer-toggles-fix |
| Block scale-gizmo drag events in top and side views when the gizmo layer is toggled off. | gizmo-toggle-lock |
| Apply pointer-events: none !important to deactivated scale gizmos and all their descendants so colocated control points can be clicked. | gizmo-pass-through |
| Make the controls drawer integrate into the layout grid as a squeezing sidebar on desktop, with mobile fallback. | controls-grid-squeeze |
| Set width: 100% and height: 100% on the Three.js canvas element so that it resizes seamlessly and keeps the hull perfectly centered when the sidebar collapses/expands. | three-center-fit |
| Fix Three.js canvas layout expansion by applying CSS !important on width/height and letting the ResizeObserver trigger a full render resize (updating canvas inline styles W/H). | three-render-fix |
| Make the station centerline in Side View curved (vertical average of Keel and Deck curves), styled as a thin solid purple control line (#7c3aed, width 1.6), and add a premium micro-animation highlight on hover. | curved-loftline-fix |
| Synchronize length slider, length output readout text, and top view rendering when dragging the deck line endpoints along X. | deck-length-sync |
| Correct scale gizmo cursors: dynamically assign vertical ns-resize or horizontal ew-resize cursors based on coordinate layout, and set the 3D overlay scale gizmo cursor to grab. | cursor-resize-fix |
| Add a dynamic Beam width slider (under Hull length) that proportionally scales all Y coordinates of the beam curve, styled with a real-time unit readout in metric and imperial. | beam-slider-addon |
| Add a dynamic, semitransparent purple dashed station preview line that tracks the pointer along the centerline in Top and Side views before clicking to add. | station-preview-hover |
| Chines MVP: numbered chines, chine editor mode toggle, chine point editing in section/side/top views (side/top snap to nearest station; top uses bottom-half intersection), per-chine-point 3D Bezier handles edited via 2-axis projection in each 2D view, longitudinal chine line rendered in side/top/3D, per-view chines layer toggle. | chine-mvp |
| Chines polish: reject duplicate chineIdx on the same station (each chine ≤ 1 anchor per section); render `#N` label in chine colour next to every chine anchor in side, top, and section views; default starting state now has 2 stations so a chine can be made immediately. | chine-id-everywhere |
| Chine draw flow: clicks start/extend a single chine; subsequent points must be on a station immediately neighbouring the chine's current range. Curved dashed ghost line + ghost anchor in side & top views tracks the cursor and previews where the chine will sweep. Floating hint near cursor shows "Add another chine point on a neighboring cross section" after the first point and "Right-click to complete chine" after the second. Right-click in any view finishes the chine (and removes lone single-anchor drafts); on a successful finish the chine number auto-increments. Toggling the editor off mid-draw discards the in-progress chine. | chine-draw-flow |
| Matcap palette presets: dropdown (Blueprint / Clay / Chrome / Gold / Jade / Copper / Pewter / Jet / Rose / Custom) drives a 3-stop procedural gradient (highlight, base, shadow). Picking a preset writes all three pickers; tweaking any picker auto-flips the dropdown to "Custom". | matcap-palettes |
| Chine handle polish: aft/fore 3D chine handles are now C1 (always collinear with the anchor, magnitudes independent); cross-section view drops the chine 3D-handle gizmos (those live in side/top, where the longitudinal sweep is visible) and colours each section knot's tangent handle in the chine colour when the knot is a chine anchor; right-clicking a chine point now smart-deletes — if the remainder would drop below 2 anchors or split into non-contiguous segments, the whole chine is removed (with a confirm dialog naming the chine). | chine-handle-polish |
| Loft follows chines: each chine is assigned a fixed transverse column index in [1, N-2] (sorted by avg n) so the mesh's edge loop at that column lands exactly on the chine's (b, n) at every station carrying it. sampleSectionAnchored() resamples each station's section with those anchors baked in (uniform arc-length within each gap); non-carrying stations sample arc-length-fraction at the same column so the existing cubic b/n splines feather the chine in/out smoothly at its endpoints. | loft-follows-chines |
| Chine click priority over station-add: in chine-editor mode, side/top clicks on the dashed station-add centerline route through the chine draw flow instead of triggering addStationAtS — so placing a chine no longer accidentally inserts a whole new station's worth of seed control points. | chine-click-priority |
| Chine influence oval: each chine anchor draws an oblong "area of influence" ellipse in side / top / 3D views. Major axis is along the 3D chine bezier handle line — tips literally touch the aft and fore handle endpoints, so dragging a chine handle re-shapes the oval longitudinally. Minor axis is the section knot's bezier handle direction in 3D (YZ in section plane) with length proportional to the section handle length — short = sharp chine (narrow oval), long = soft chine (wide oval). Dashed chine-coloured stroke + low-opacity fill; respects the per-view chines layer toggle. | chine-influence-oval |
| Chine influence tube (replaces per-anchor oval): a single stadium-like shape *per chine* that runs along the chine's full longitudinal Bezier with rounded end caps. Half-width comes purely from the section-knot bezier handles (avg of aft/fore section handle length, scaled to 3D world units via the per-station frame) — longer YZ handles → softer chine → wider tube. Width interpolates linearly between anchors; the chine's own 3D handles only shape the tube's centerline (not its width). Closed-loop SVG polygon in side and top views (with port mirror); two THREE.Line edge pairs in 3D, stbd + port mirrored. | chine-influence-tube |
| Chine feather tube: tube is now asymmetric — forward edge offsets by the per-anchor section *fore* handle length, backward edge by the per-anchor section *aft* handle length. The cap at each chine endpoint is a two-quarter ellipse whose third axis is the outward chine handle vector (anchor[0].aft for the start cap, anchor[last].fore for the end cap) so the cap literally feathers past the chine endpoint by the chine handle length — the feather tip IS the chine outward handle endpoint. All chine bezier handles (section + chine outward) now lie on the tube perimeter; only the internal chine handles (between adjacent anchors) remain inside the tube. Terminal chine handles render at full opacity (no longer dimmed) since they're functional. | chine-feather-tube |
| Chine extrapolation + solid perimeter: (1) fixed a NaN crash in the cap projection that left the influence fill drawn outside the real perimeter — `projVec` now reads chineHandles' dx/dy/dz fields; (2) the influence tube perimeter is now a solid, full-opacity chine-coloured outline (still translucent fill); (3) loft mesh now follows each chine's *extrapolated* curve out to the bow/stern tip — at any station that doesn't carry a chine, the chine's column k_c samples (b, n) from a linear extrapolation along the outward chine handle direction from the nearest chine endpoint. The natural cubic b/n spline therefore no longer "corrects" the column back toward the arc-length sample beyond the chine span. | chine-extrapolate |
| Chine column hold-at-endpoint rewrite (replaces the world-coord extrapolation): after user feedback, the loft column at every non-carrying station now simply holds the *nearest endpoint anchor's exact (b, n)* instead of extrapolating. The world position naturally tapers to the centerline at the tip because halfB → 0 there. Section curves at non-chine stations are not modified. The outward chine handle's role is reduced to "visual feather length for the influence tube cap" — it no longer participates in loft geometry. Removed the now-unused `chinePosAtX` helper. | chine-hold-endpoint |
| Chine line + influence shading derived from the actual loft (no internal handles): the chine curve in side/top/3D is now a polyline through the loft's column-kCol vertices, filtered to the chine's anchor X range expanded by the feather length at each end. Internal chine bezier handles are gone — non-endpoint anchors render as a non-interactive coloured dot with a `#N` label. Only the OUTWARD handle at each chine endpoint is editable, constrained to ±X axis only; dragging it changes only the feather length and is clamped to the anchor → tip distance so the tube can't run off the hull. Influence tube widths still come from the section knot's aftLen/foreLen at carrying stations and fade linearly to zero across the feather region — fwd and bwd edges of the closed polygon meet at the feather endpoints, so no separate cap geometry is needed. | chine-loft-derived |
| Ghost chine anchors for non-carrying stations: a chine's column k_c is now anchored at *every* station — at carriers it lands on the user's exact (b, n); at non-carriers it lands on the natural section curve at the chine's *interpolated arc-length fraction t*. The user-anchor t at each carrier is measured from its own dense section curve; t is linearly interpolated across station s (held outside the carrier s-range). Section curves at non-chine stations are not modified — the ghost anchor lives only inside the loft sampler. This finally kills the swoop between a chined station and a freshly-added neighbouring station: the loft column k_c varies continuously across all stations, and the section curves on non-chine stations stay exactly as the user authored them. | chine-ghost-anchor |
| Loft calculation modes: a new "Loft mode" picker in the controls drawer lets the user try six different surface-construction strategies. **Smooth** (default) keeps the prior cubic-spline-per-column + chines + ghost anchors. **Parallels** uses one reference (b, n) array per column = average across all stations' uniform samples — longitudinal lines are constant in normalised section space. **Uniform** uses per-station uniform arc-length sampling + Catmull-Rom interpolation across stations (C1, no overshoot). **Isoparametric** is the linear-interp counterpart of uniform — piecewise straight lines between stations in section space. **Ruled** interpolates the world position directly between station rows, producing flat 3D strips (useful for CNC plug strips). **Stations-only** forces xSubdiv = 1 so the mesh just spans the stations the user authored. Chines only affect geometry in 'smooth' mode for now; other modes ignore chine anchors entirely. | loft-modes |
| Chines now also affect Uniform-mode geometry: the smooth and uniform branches in buildLoft share the same chine-aware sampling (assignChineColumns + ghost anchors at curve-at-t for non-carriers + sampleSectionAnchored per station) and differ only in the cross-station interpolation function — natural cubic for smooth, Catmull-Rom for uniform. The chine ridge / influence band / 3D edge now render correctly in both modes; chineCols is exposed on the loft return in both. Isoparametric, ruled, parallels, stations-only still ignore chines. | chines-in-uniform |
| Section ctrl-drag switched from absolute to incremental (delta) coordinates: `sectionDrag` now stores `lastX/lastY` from pointerdown; each pointermove accumulates `db = Δx/SECTION_SCALE_B` and `dn = -Δy/SECTION_SCALE_N` onto the point rather than setting b/n from the absolute SVG position. Breaks the feedback loop where dragging the widest point outward increased `maxB` → raised `SECTION_SCALE_N` → shifted the SVG viewBox y-mapping → caused the point to jump vertically even though the mouse only moved horizontally. | section-drag-delta |
| Loft mode picker simplified to two options: **Smooth (cubic interpolation)** and **Precise (Catmull-Rom interpolation)**. Removed parallels, isoparametric, ruled, and stations-only branches from buildLoft; removed worldEvaluator and the stations-only xSubdiv=1 override. Both surviving modes are chine-aware. | two-modes |
| **Follow-up — loft feathering by chine handle length**: the chine line + chine influence visual now feather past the chine endpoints by the outward chine handle length, but the *loft mesh* feathering is still driven by the natural cubic b/n spline across stations (smooth fall-off, not user-controlled). To match the visual one-for-one, the loft mesh should fade the chine's column anchor over a band of length = outward chine handle length in X, then go fully unanchored. Adds a per-station blend factor between the chine's exact (b, n) and the natural arc-length sample. Captured here so the visual and surface match exactly later. | (follow-up) |











