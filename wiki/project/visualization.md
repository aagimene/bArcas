# Visualization

Kayak design is a visual activity. bArcas should feel like a 3D CAD tool, not a spreadsheet with a hull preview.

---

## Requirements

### R1. Hardware-accelerated 3D
- **WebGPU first**, WebGL2 fallback.
- 60 fps target for hulls up to ~200 control points.
- GPU-side compute for live field visualization (pressure, wetted area, station highlighting).

### R2. Multiple simultaneous views
- Perspective 3D
- Plan (top-down)
- Profile (side)
- Body plan (bow/stern stations overlaid) — a kayak-design convention; see [theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md#body-plan)
- Waterlines / buttocks views
All views share selection state and camera-sync where it makes sense.

### R3. Live metric overlays
- Hydrostatic quantities (displacement, LCB, Cp, WSA) update as control points move.
- Stability curve and drag curve panels recompute incrementally.
- "Why did this number change?" — hover a metric to see which control points most affected it (sensitivity from [api-design.md](api-design.md) introspection).

### R4. Field visualization
- **Waterline flood:** color the hull below the waterplane.
- **Wetted-area map:** highlight the wetted surface at the current displacement + trim.
- **Curvature map:** Gaussian / mean curvature coloring to spot unfair surfaces.
- **Pressure / velocity fields** (phase 2+): from thin-ship or strip-theory solver, shown as a colored wake on a ground plane.

### R5. Direct manipulation
- Drag control points in 3D with axis constraints (X/Y/Z/normal).
- Drag stations sideways to move them along length.
- Drag the whole hull longitudinally (e.g., to shift LCB).
- "Lasso" multiple control points and scale/translate as a group.

### R6. Comparison views (critical)
- Two or more hulls rendered simultaneously, aligned on a chosen reference (stem, midship, CG, LCB, waterline).
- Overlaid stations (ghosted lines).
- Overlaid metrics (stability curves in one chart, drag curves in another).
- Side-by-side paneled 3D views with synchronized cameras.
- See [../features/side-by-side-comparison.md](../features/side-by-side-comparison.md).

---

## Candidate rendering stack

| Layer | Candidate | Notes |
|---|---|---|
| Renderer | Three.js WebGPURenderer | Mature, WebGPU now landed, large community |
| Alternative | Babylon.js | Also solid, good CAD-ish features |
| Raw | Direct WebGPU via `wgpu` | Max flexibility, much more work |
| Scene graph | three.js built-in | Sufficient |
| Grid / gizmos | `three-mesh-bvh` + custom | BVH needed for fast picking on detailed meshes |
| 2D charts | `D3` or `uPlot` | uPlot is faster for live drag/stability curves |

Likely direction: three.js with WebGPU renderer, WebGL2 fallback, uPlot for charts.

---

## Picking, selection, gizmos

- BVH-accelerated picking so control-point selection is instant on dense meshes.
- Gizmos follow standard CAD conventions: red/green/blue for X/Y/Z, cone arrows for translate, rings for rotate, boxes for scale.
- Selection is per-hull and per-net; comparison views show selection only on the "active" hull to avoid confusion.

---

## Performance budget (phase-1 target)

| Operation | Target |
|---|---|
| Control point drag → hull re-mesh → render | < 16ms |
| Control point drag → live hydrostatics | < 100ms |
| Full drag curve recompute (ITTC + Michell, 30 speeds) | < 500ms |
| Stability curve (30 heel angles) | < 300ms |

These are targets, not floors. Early phases may miss them; phase-1 launch needs to hit them.

---

## Rendering the story, not just the model

- **Annotations** (waterline labels, LCB crosshair, station numbers) are part of the render, not a separate overlay.
- **Paddler avatar** (configurable mass, CG height) rendered on the hull. Shifts the CG visibly when edited.
- **Water plane** with ripple shader so waterline intersection is visually obvious.
- **Wake lines** at the current speed (visual, not quantitative): a Kelvin wake cone sketched on the ground plane.

Visualization is a feature, not a polish pass. Designed in from day one.

---

## Related

- [architecture.md](architecture.md)
- [../features/side-by-side-comparison.md](../features/side-by-side-comparison.md)
- [../theory/hull-geometry-representation.md](../theory/hull-geometry-representation.md)
