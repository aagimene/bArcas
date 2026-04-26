# Vision and Goals

## Vision

> A kayak designer should be able to sit down in a browser, sketch a hull in minutes, see it glide through a virtual wake with drag/stability fields rendered live, iterate by dragging control points or by telling an AI agent "make it 10% faster at 5 knots with no loss of initial stability," and then compare the result side-by-side with a Coaster, a Nordkapp, and an Epic V10 at the same displacement.

Every concrete goal below serves some part of that sentence.

---

## Goals

### G1. CAD-quality interactive 3D
- WebGPU-first, WebGL2 fallback. See [visualization.md](visualization.md).
- Smooth orbit/pan/zoom at ≥60 fps for hulls with up to ~200 control points per surface.
- Live recomputation of hydrostatics as control points move (sub-100ms on a typical hull).

### G2. API-first — every action scriptable
- No design action exists that is only reachable via UI. See [api-design.md](api-design.md).
- The UI is implemented *on top of* the API, not parallel to it.
- Deterministic, idempotent operations where possible (e.g. `set_control_point(hull_id, index, xyz)` rather than `nudge_control_point`).

### G3. AI agents as first-class users
- Agents get the same API surface as human clients, plus structured introspection (list hulls, get metrics, propose changes). See [ai-agent-integration.md](ai-agent-integration.md).
- MCP server for Claude / other LLM clients.
- "Design delta" operations — an agent should be able to propose `+5mm beam at station 6, −10mm rocker at bow`, preview the effect, then commit.

### G4. Honest physics
- All reported numbers cite the formula, assumptions, and validity range. No hidden constants. See [theory/drag-and-resistance.md](../theory/drag-and-resistance.md).
- Where empirical, explicit about the empirical base (ITTC 1957, Holtrop-Mennen, Savitsky).
- Where analytical (Michell's integral, thin-ship theory), the assumptions are surfaced next to the number.

### G5. Comparison is the default
- Many-hull views are the primary UI, not a "compare" button. See [features/side-by-side-comparison.md](../features/side-by-side-comparison.md).
- Overlay geometry (stations aligned, waterlines aligned, etc.).
- Overlay metrics (stability curves, drag curves, prismatic coefficient vs. speed).

### G6. Production-ready exports
- Every hull is exportable as **STEP** (for CAM / CNC), **STL and 3MF** (for 3D printing), and **IGES / OBJ / DXF / CSV offsets** for everything in between.
- Downstream workflows we support: CNC-milled composite plugs, 3D-printed plugs or mold sections, composite molds (wet/prepreg/infusion), and later thermoforming / rotomolding molds.
- **Strip-built and skin-on-frame are explicitly out of scope** as downstream workflows.
- See [export-formats.md](export-formats.md).

### G7. Respect the craft
- Kayak hull design has a ~5000-year tradition (Inuit qajaq) and a ~100-year engineering tradition (Chapelle, Winters, Livingston).
- Terminology follows established convention — we don't invent new words where existing ones exist. See [terminology/hull-terms.md](../terminology/hull-terms.md).
- Classic designs (Nordkapp, Coaster, K1s, Greenland qajaqs) are shipped as reference models users can fork and compare against. See [designs/README.md](../designs/README.md).

---

## Non-goals (explicit)

- **Not a racing-class rules validator.** We can compute length, beam, and weight, but we don't certify a K1 is ICF-legal. That's the sanctioning body's job.
- **Not a structural/FEA tool.** Hull shape only.
- **Not a rendering showpiece.** Pretty is nice, but honest is the requirement. A wireframe with correct hydrostatics beats a glossy render with wrong numbers.
- **Not offline-first.** A browser is assumed. A fat-client desktop app is out of scope.

---

## Success criteria (phase-1)

A user can:
1. Create a hull from a blank parametric template in under 60 seconds.
2. Modify it by dragging control points in a 3D view.
3. Read off displacement, LWL, LCB, prismatic coefficient, wetted surface, and static stability metrics that update live.
4. Compute a drag curve (resistance vs. speed) using a known formula and export it as CSV.
5. Duplicate the hull, modify the copy, and view both hulls side-by-side with all metrics overlaid.
6. Ask an AI agent via MCP: "make hull B 5% narrower at the waterline without changing LCB" — and see the proposed change previewed.

See [roadmap.md](roadmap.md) for how we stage toward this.
