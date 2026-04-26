# Roadmap

Staged plan. Dates are deliberately omitted — we'll add them once we've shipped the first phase and know our pace.

---

## Phase 0 — Research & Design (current)

**Deliverable: this wiki.**

- Project overview, goals, API sketch, architecture sketch.
- Theory pages covering the math and physics we need to implement.
- Terminology and variable references.
- Design history — what kayaks exist, what they optimize for.
- Feature sketches for showcase, comparison, AI integration.

**Exit criterion:** the wiki answers "what are we building and why" well enough that an engineer starting fresh can pick up phase 1.

---

## Phase 1 — MVP: single-hull design loop

**Deliverable: a browser app where one person can design one hull.**

### Backend
- REST API for hulls, control nets, events (see [api-design.md](api-design.md)).
- Geometry kernel: NURBS or B-spline surfaces, lofting, meshing.
- Hydrostatics solver (displacement, LCB, VCB, waterplane area, coefficients).
- Stability solver (GZ curve over heel angles).
- Drag estimator (ITTC 1957 friction + simple Michell thin-ship).
- **Exporters: STEP, IGES, STL, 3MF, OBJ, CSV offsets, JSON.** STEP + STL are required for phase-1 exit — without STEP we can't feed CAM; without STL we can't feed 3D printers. See [export-formats.md](export-formats.md).
- Event log + undo/redo.

### Frontend
- 3D view (WebGPU + WebGL2 fallback, three.js).
- Control-point drag, multi-select, gizmos.
- Parametric template creation ("blank sea kayak", "blank K1", ...).
- Live hydrostatic readout.
- Stability and drag curves as charts.

### Agent integration
- MCP server exposing read-only metrics + `propose / commit / reject`.
- Python SDK.

### Exit criterion
A user can do all six tasks in the [vision-and-goals.md success criteria](vision-and-goals.md#success-criteria-phase-1).

---

## Phase 2 — Comparison & showcase

**Deliverable: many-hull workflows.**

- Reference library: Coaster-like, K1-like, surfski-like, Greenland-like hulls.
- Comparison resource (align-on, overlay metrics).
- Side-by-side 3D views with camera sync.
- Stability/drag overlay charts.
- Showcase pages (public, shareable URLs).
- **Mold-prep operations**: surface offset for mold shells, parting-line definition, mold split into halves, alignment-feature generation. Parasolid and DXF exports.
- Lines plan / dimensioned drawing PDF export.

---

## Phase 3 — Better physics

- Michell's integral with higher-order corrections.
- Strip theory for motion in waves (pitch, heave).
- Trim / sinkage equilibrium solver (not just static waterplane).
- Optional: lift-line or vortex-lattice for skegs / rudders.
- Optional: plug-in path to OpenFOAM for offline CFD.

---

## Phase 4 — Collaboration & agents

- Multi-user editing (CRDT or ops-log merge).
- Agent-driven optimizers as hosted services (genetic, CMA-ES, surrogate-assisted).
- Design provenance / citation graphs (this hull was forked from X, influenced by Y).
- Public gallery with metrics.

---

## Phase 5 — Manufacturing mold workflows

- **Thermoforming mold support.** Draft-angle validation, undercut flagging, automatic draft-analysis coloring on the surface.
- **Rotomolding mold support.** Two/three-part female molds with parting-line at widest section, no-undercut validation along parting direction.
- Vent/gate placement suggestions.

## Later / speculative

- Canoes, SUPs.
- Layup / laminate overlays (areal weight maps, core placement) — still shape-only, no structural analysis.
- In-browser paddling simulation (paddler mass coupled to 6-DoF hull dynamics).

---

## Principles that should not change

No matter what phase we are in:

1. Every design action has an API call.
2. Physics numbers cite their formula.
3. Comparison is the default interaction mode.
4. The UI is built *on* the API, not parallel to it.
5. Agents are first-class.
6. Production-grade CAD/CAM/3D-printing exports (STEP, IGES, STL, 3MF, etc.). See [export-formats.md](export-formats.md).

---

## Related

- [overview.md](overview.md)
- [vision-and-goals.md](vision-and-goals.md)
- [architecture.md](architecture.md)
- [api-design.md](api-design.md)
