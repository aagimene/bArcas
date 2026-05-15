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

- **Cross-section control points, lines, and labels should not scale with
  zoom.** Stroke widths, point radii, and font sizes should remain constant
  in screen pixels regardless of how far the section view is zoomed or how
  the section's size changes due to aspect-ratio scaling.

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

- **Cross-section view axis labels (+Z/+Y) should be statically positioned
  and sized.** Currently they move and scale with the viewport. They should
  be pinned to the lower-left corner at a fixed screen size, like the axis
  badges in the other views.

- **Deck line in loft should follow the deck control curve exactly.** The
  pink rendered deck perimeter sometimes deviates from the green deck control
  curve. The keel line follows the spine exactly; the deck line should behave
  identically.

- **Remove ambient occlusion; simplify render modes.** AO currently does
  nothing visible (depth map appears to be entirely white, suggesting depth
  scaling is off, which would also break AO). Remove AO entirely and
  simplify render modes to: "shaded" (current beauty pass) and "normals"
  (surface normal vectors visualized as color). Both modes should include the
  grid planes (the normals mode currently does not show grids). AO could be
  re-added from scratch later once the depth pass is fixed.


- **Tip closure flickering polygons.** The bow and stern closures show
  flickering/z-fighting polygons. Since the top and bottom tips share the
  same X value, the closure should simply be two triangles forming a flat
  rectangle the width of the spine radius — no additional geometry. Future
  spine-sharpness work will control the full spine cross-section profile
  including tips.

- **Side view aspect ratio may not always match the shaded 3D mesh.** Under
  certain conditions the 2D side view silhouette does not appear to match
  the 3D render's proportions. Not yet fully reproduced — needs further
  investigation to isolate.

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
| Top-view Bezier handle lines: solid → dashed | keel-blue |
| Scale gizmo on side/top/3D views (Y/X/Z axes, X updates length slider) | scale-gizmo, gizmo-fix |
| Scale gizmo removed from cross-section view (meaningless in normalised b/n) | section-bezier |
| Cross-section points → on-curve Bezier knots with angle/aftLen/foreLen handles (matches rocker / deck-line model) | section-bezier |
