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
| Scale gizmo on side/top/3D views (Y/X/Z axes, X updates length slider) | scale-gizmo, gizmo-fix |
| Scale gizmo removed from cross-section view (meaningless in normalised b/n) | section-bezier |
| Cross-section points → on-curve Bezier knots with angle/aftLen/foreLen handles (matches rocker / deck-line model) | section-bezier |
