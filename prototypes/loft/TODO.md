# Loft prototype — TODO

Meticulously maintained. All user feedback goes here immediately, even if
not yet defined or prioritized. Items move from **Feedback / Unprioritized**
→ **Pending** (chunked + confirmed) → **Done**.

Rule: Claude writes down all feedback as it arrives. Nothing gets implemented
until it has been chunked, prioritized, and confirmed by the user.

---

## Feedback / Unprioritized

*Raw feedback captured from the user. Not yet scoped or confirmed.*

- **Reference image positioning UX.** Currently position is set via number
  inputs or dragging. May need finer controls (e.g. scale-by-matching-hull-
  length button, or lock-aspect-ratio when resizing).

- **Chines.** Chines are numbered. Chine points are cross-section control
  points with a chine index assigned. The loft should produce edge loops that
  follow the chine points longitudinally, making chine lines visible in all
  views. Because chine control points are on the Bezier curve, handle lengths
  naturally control chine sharpness. A chine must span at least two
  neighboring stations but does not need to extend to all stations.

- **Body plan overlay on the cross-section view.** The body plan is a
  half-and-half front view: one side shows stations from the widest point
  toward the bow, the other from the widest point toward the stern. It
  overlays the cross-section view as a background layer (behind
  control-point curves and handles). Controls: enabled/disabled, opacity,
  and which half shows bow vs. stern (both halves can show the same
  direction). Layering order from back to front: reference image, body plan,
  control curves and points.

- **Reference image in the cross-section view.** The cross-section view
  needs a reference image background like the side and top views, loaded and
  positioned independently.


- **Scale gizmo: unexpected translation during scaling.** For example,
  scaling horizontally (Y axis) in the top view also translates the whole
  hull in that direction. In the side view, Z-axis scaling appears to be
  relative to the world origin (0, 0, 0) rather than the hull center, which
  shifts the hull. Need to decide the correct pivot point (hull geometric
  center? bounding-box center?) and ensure scaling applies purely as a scale
  with no net translation.

- **"Textured surface" render mode to accentuate curvature.** Not yet sure
  of the best approach — checkerboard UV or similar. Intent is to make
  curvature deviations visually obvious.

- **Cross-section aspect-ratio instability during station-point edits.**
  When dragging the widest control point, the aspect scaling can rapidly
  increase/decrease uncontrollably. Also, moving a station along X sometimes
  does not update the section's displayed height even though the actual H/B
  ratio has changed — possibly a degenerate state.

- **Adding a new station is awkward.** The only path is the controls panel,
  and the new station gets an unpredictable starting shape. Desired behavior:
  click on the top or side view to draw a new station at that longitudinal
  position; the new station should automatically assume the interpolated
  cross-section shape of the existing lofted geometry at that point, so the
  hull shape does not change at all upon insertion.

- **Per-view interactive layer toggles (visibility + editability).** Too
  many things are simultaneously interactive. Each view (side, top, section)
  should have a small collapsible legend/control widget in a corner that
  lists the available layers — e.g., "stations", "deck line", "keel line",
  "reference image", "scale gizmo" — with a toggle for each. Layers are
  always rendered but are dark-grey and non-interactive when deactivated;
  they become colored and editable when activated. Colors should be
  consistent throughout: e.g., stations as purple lines/dots in the top
  view, with the currently selected station darker than the others. Reference
  image toggle should lock position/scale so the image cannot be accidentally
  moved while panning. Gizmo should also be toggleable this way. Layer
  toggles are per-view (side view has its own set, top view has its own set,
  etc.).

- **Drawing new stations from the top or side view when the station layer is
  active.** When the stations layer is active in the top or side view, a
  "station spine line" — a vertical or longitudinal line running through the
  center of the loft — should be visible and clickable to insert a new
  station at that position (same behavior as the desired click-to-add
  station, described above). The same center line should appear in the
  cross-section view as a non-editable reference point (center of loft).


- **Remove ambient occlusion; simplify render modes.** AO currently does
  nothing visible (depth map appears to be entirely white, suggesting depth
  scaling is off, which would also break AO). Remove AO entirely and
  simplify render modes to: "shaded" (current beauty pass) and "normals"
  (surface normal vectors visualized as color). Both modes should include the
  grid planes (the normals mode currently does not show grids). AO could be
  re-added from scratch later once the depth pass is fixed.


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
| 3 | 1 | Tip closure: replace with two flat triangles | Sonnet | medium | Localised to `buildLoft()`. Visible quality win, no UI changes. |
| 4 | 4 | Remove ambient occlusion, simplify render modes (shaded + normals, both with grid) | Sonnet | medium | Pure deletion + small addition. Removes a lot of incidental complexity, makes future render-mode work easier. Do BEFORE the textured-surface mode. |
| 5 | 5 | Reference image in cross-section view | Sonnet | low | `wireRefImage` already factored — just instantiate a third one. |
| 6 | 6 | Reference-image positioning UX polish (lock-aspect, fit-to-hull) | Sonnet | low | Small additions next to existing ref-image controls. Bundle with #5. |
| 8 | 8 | Scale gizmo: pivot at hull center, no translation drift | Opus | medium | Math correctness — apply scale around (cx, 0, cz) rather than world origin; subtract pivot, scale, add back, also scale knot/handle handle-lengths uniformly. Wrong approach causes regressions in other gizmo uses. |
| 9 | 9 | Section aspect-ratio instability when dragging widest point | Opus | medium | Subtle: the `max(b)` factor in `SECTION_SCALE_N` creates a feedback loop — as the dragged point shrinks, scale shrinks, the visible position changes, and the user's drag offset interprets differently. Also fix the "no update when station moves along X" degenerate case. |
| 10 | 10 | Click-to-add station in top/side view, auto-shape from existing geometry | Opus | medium | Needs to interpolate the lofted shape at an arbitrary X (use the existing `denseRows` pipeline), then convert back to (b, n) control points. Some design choices about how many points to keep. |
| 11 | 11 | Body plan overlay on cross-section view (with bow/stern half controls + opacity) | Sonnet | medium | Composable feature; add behind ref-image / in front. Touches only `renderSectionView()` plus a small controls block. |
| 12 | 12 | Textured surface render mode (checkerboard or matcap to expose curvature) | Opus | medium | Three.js material design choice. Best done after AO is removed (#4) so the render-mode picker has its final shape. |
| 13 | 13 | Per-view interactive layer toggles (visibility + editability lock per layer per view) | Opus | high | Biggest UI refactor: every clickable element now consults a per-view per-layer enabled flag. Affects every drag handler, every render function. Do this once the smaller fixes have settled. |
| 14 | 14 | Station spine line in top/side; uneditable center point in section | Sonnet | low | Trivial after #13 lands (depends on the "stations layer is active" trigger from #13). |
| 15 | 15 | **Chines** (numbered chine indices on section points; chine edge loops in loft; visualisation in all views) | Opus | high | Largest architectural change: data-model addition, loft change, three new render layers. Do last so other items don't conflict and so the codebase is in its simplest state when we tackle it. Plan a design pass first (separate session, no code) before implementing. |
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
| Scale gizmo on side/top/3D views (Y/X/Z axes, X updates length slider) | scale-gizmo, gizmo-fix |
| Scale gizmo removed from cross-section view (meaningless in normalised b/n) | section-bezier |
| Cross-section points → on-curve Bezier knots with angle/aftLen/foreLen handles (matches rocker / deck-line model) | section-bezier |
