# Loft prototype — TODO

Meticulously maintained. All user feedback goes here immediately, even if
not yet defined or prioritized. Items move from **Feedback / Unprioritized**
→ **Pending** (chunked + confirmed) → **Done**.

Rule: Claude writes down all feedback as it arrives. Nothing gets implemented
until it has been chunked, prioritized, and confirmed by the user.

---

## Feedback / Unprioritized

*Raw feedback captured from the user. Not yet scoped or confirmed.*

- **Matcap palette presets.** Current matcap mode has just two colour
  pickers (base + highlight). Add a "preset" dropdown with named palettes
  (e.g. clay, chrome, gold, jade, blueprint) plus a "Custom" option that
  reveals the colour pickers. Possibly extend the procedural generator to
  support a few palette knobs beyond two flat colours (rim colour, multi-
  stop gradient, anisotropic highlight). To define more concretely later.

- **Chines.** Chines are numbered. Chine points are cross-section control
  points with a chine index assigned. The loft should produce edge loops that
  follow the chine points longitudinally, making chine lines visible in all
  views. Because chine control points are on the Bezier curve, handle lengths
  naturally control chine sharpness. A chine must span at least two
  neighboring stations but does not need to extend to all stations.

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

